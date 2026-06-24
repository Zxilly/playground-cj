// cj-runner: the Cangjie compile/run/format backend for Azure Container Apps
// Express. Unlike server/ (which isolates each request in a fresh Docker
// container), Express reuses one warm replica, so we sandbox the RUN step
// in-process with the only primitives ACA Express allows unprivileged:
//   - CLONE_NEWUSER+CLONE_NEWNET  -> empty network namespace = no egress
//   - CLONE_NEWPID                -> binary is pid 1 in its own ns; killing it
//                                    reaps every descendant (fork bombs)
//   - prlimit rlimits             -> cgroup delegation is read-only on Express
//   - per-request temp dir + cleanup, wall-clock timeout, capped output
// The replica being ephemeral (scale-to-zero / restart) is the final backstop.
// Endpoints match server/: POST /run ({code,stdin} JSON or raw), POST /format
// (raw code), returning the same RunMessage / FormatMessage JSON shapes.
//
//go:build linux

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"syscall"
	"time"
)

type runReq struct {
	Code  string `json:"code"`
	Stdin string `json:"stdin"`
}

type runMessage struct {
	CompilerOutput string `json:"compiler_output"`
	CompilerCode   int    `json:"compiler_code"`
	BinOutput      string `json:"bin_output"`
	BinCode        int    `json:"bin_code"`
}

type formatMessage struct {
	Formatted       string `json:"formatted"`
	FormatterOutput string `json:"formatter_output"`
	FormatterCode   int    `json:"formatter_code"`
}

const (
	compileTimeout = 12 * time.Second
	runTimeout     = 8 * time.Second
	formatTimeout  = 8 * time.Second
	outputCap      = 1 << 20 // 1 MiB

	// rlimits applied to the user binary via prlimit (soft caps; no cgroup on
	// Express). prlimit (unlike dash's ulimit) supports --nproc. nproc is set
	// generously: fork bombs are already reaped by the pid ns + group kill +
	// CPU limit, so this only needs to leave headroom for the Cangjie runtime's
	// own threads while still capping runaway OS-process spawning.
	limAddrSpaceBytes = 768 * 1024 * 1024 // RLIMIT_AS   768 MiB
	limCPUSeconds     = 8                 // RLIMIT_CPU
	limNProc          = 256               // RLIMIT_NPROC
	limFsizeBytes     = 16 * 1024 * 1024  // RLIMIT_FSIZE
	limNoFile         = 256               // RLIMIT_NOFILE
)

const cangjieLibs = "/cangjie/runtime/lib/linux_x86_64_cjnative:/cangjie/tools/lib:/linux_x86_64_cjnative/dynamic/stdx"

// cappedBuffer keeps at most cap bytes then drops the rest, so a print-bomb
// can't OOM the runner.
type cappedBuffer struct {
	buf       bytes.Buffer
	cap       int
	truncated bool
}

func (c *cappedBuffer) Write(p []byte) (int, error) {
	if r := c.cap - c.buf.Len(); r <= 0 {
		c.truncated = true
		return len(p), nil
	} else if len(p) > r {
		c.buf.Write(p[:r])
		c.truncated = true
		return len(p), nil
	}
	return c.buf.Write(p)
}

func (c *cappedBuffer) String() string {
	if c.truncated {
		return c.buf.String() + "\n[output truncated]"
	}
	return c.buf.String()
}

func envWithLibPath() []string {
	out := make([]string, 0, len(os.Environ())+1)
	val := cangjieLibs
	for _, e := range os.Environ() {
		if strings.HasPrefix(e, "LD_LIBRARY_PATH=") {
			if ex := strings.TrimPrefix(e, "LD_LIBRARY_PATH="); ex != "" {
				val = cangjieLibs + ":" + ex
			}
			continue
		}
		out = append(out, e)
	}
	return append(out, "LD_LIBRARY_PATH="+val)
}

func compileAndRun(code, stdin string) runMessage {
	var msg runMessage

	srcDir, err := os.MkdirTemp("/playground", "run-")
	if err != nil {
		msg.CompilerOutput = "mktemp: " + err.Error()
		msg.CompilerCode = -1
		return msg
	}
	defer os.RemoveAll(srcDir)

	if err := os.WriteFile(srcDir+"/main.cj", []byte(code), 0644); err != nil {
		msg.CompilerOutput = "write source: " + err.Error()
		msg.CompilerCode = -1
		return msg
	}

	// --- compile (bounded by a timeout; cjc is trusted, input is not) ---
	cctx, ccancel := context.WithTimeout(context.Background(), compileTimeout)
	defer ccancel()
	args := []string{
		"--import-path=/linux_x86_64_cjnative/dynamic",
		"--no-sub-pkg",
		"--output-dir=" + srcDir,
		"-L", "/linux_x86_64_cjnative/dynamic/stdx",
		"-ldl", "-V", "-j1", "-p", srcDir, "--output-type=exe", "-o=main",
	}
	cout := &cappedBuffer{cap: outputCap}
	ccmd := exec.CommandContext(cctx, "cjc", args...)
	ccmd.Stdout, ccmd.Stderr, ccmd.Dir = cout, cout, srcDir
	cerr := ccmd.Run()
	msg.CompilerOutput = cout.String()
	msg.CompilerCode = ccmd.ProcessState.ExitCode()
	if cctx.Err() == context.DeadlineExceeded {
		msg.CompilerOutput += "\n[compile timed out]"
		return msg
	}
	if cerr != nil || !ccmd.ProcessState.Success() {
		return msg
	}

	// --- run the produced binary inside the sandbox ---
	msg.BinOutput, msg.BinCode = runSandboxed(srcDir+"/main", stdin)
	return msg
}

// runSandboxed executes bin in a fresh user+net+pid namespace with rlimits and a
// wall-clock timeout, returning the (capped) combined output and exit code.
func runSandboxed(bin, stdin string) (string, int) {
	ctx, cancel := context.WithTimeout(context.Background(), runTimeout)
	defer cancel()

	// prlimit applies the rlimits then execs the user binary in the same process,
	// so the limits (incl. nproc) bind to it directly (no cgroup on Express).
	cmd := exec.CommandContext(ctx, "prlimit",
		"--as="+strconv.Itoa(limAddrSpaceBytes),
		"--cpu="+strconv.Itoa(limCPUSeconds),
		"--nproc="+strconv.Itoa(limNProc),
		"--fsize="+strconv.Itoa(limFsizeBytes),
		"--nofile="+strconv.Itoa(limNoFile),
		"--", bin)
	cmd.Env = envWithLibPath()
	cmd.SysProcAttr = &syscall.SysProcAttr{
		// CLONE_NEWUSER is required: the container root lacks CAP_SYS_ADMIN, but
		// inside a fresh userns we hold the caps needed to create net/pid ns.
		Cloneflags: syscall.CLONE_NEWUSER | syscall.CLONE_NEWNET |
			syscall.CLONE_NEWPID | syscall.CLONE_NEWUTS | syscall.CLONE_NEWIPC,
		UidMappings:                []syscall.SysProcIDMap{{ContainerID: 0, HostID: os.Getuid(), Size: 1}},
		GidMappings:                []syscall.SysProcIDMap{{ContainerID: 0, HostID: os.Getgid(), Size: 1}},
		GidMappingsEnableSetgroups: false,
		Setpgid:                    true,
	}

	out := &cappedBuffer{cap: outputCap}
	cmd.Stdout, cmd.Stderr = out, out
	if stdin != "" {
		cmd.Stdin = strings.NewReader(stdin)
	}

	if err := cmd.Start(); err != nil {
		return "sandbox start: " + err.Error(), -1
	}
	// Kill the whole process group on timeout; with CLONE_NEWPID the group's
	// pid-1 reap tears down every descendant (fork bombs included).
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	select {
	case <-ctx.Done():
		_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		<-done
		return out.String() + "\n[killed: exceeded " + runTimeout.String() + " wall clock]", -1
	case <-done:
		return out.String(), cmd.ProcessState.ExitCode()
	}
}

// formatCode runs cjfmt on the source. Formatting is trusted (no user binary
// executes), so it only needs a timeout, not the full namespace sandbox.
func formatCode(code string) formatMessage {
	var msg formatMessage
	f, err := os.CreateTemp("/playground", "fmt-*.cj")
	if err != nil {
		msg.FormatterOutput = "mktemp: " + err.Error()
		msg.FormatterCode = -1
		return msg
	}
	name := f.Name()
	_ = f.Close()
	defer os.Remove(name)
	if err := os.WriteFile(name, []byte(code), 0644); err != nil {
		msg.FormatterOutput = "write source: " + err.Error()
		msg.FormatterCode = -1
		return msg
	}

	ctx, cancel := context.WithTimeout(context.Background(), formatTimeout)
	defer cancel()
	out := &cappedBuffer{cap: outputCap}
	cmd := exec.CommandContext(ctx, "cjfmt", "-f", name, "-o", name)
	cmd.Stdout, cmd.Stderr = out, out
	cmd.Env = envWithLibPath()
	_ = cmd.Run()

	formatted, _ := os.ReadFile(name)
	msg.Formatted = string(formatted)
	msg.FormatterOutput = out.String()
	msg.FormatterCode = cmd.ProcessState.ExitCode()
	return msg
}

func readBody(r *http.Request) ([]byte, string) {
	buf := bytes.NewBuffer(nil)
	_, _ = buf.ReadFrom(r.Body)
	_ = r.Body.Close()
	return buf.Bytes(), r.Header.Get("Content-Type")
}

func handleRun(w http.ResponseWriter, r *http.Request) {
	body, ct := readBody(r)
	var in runReq
	if strings.Contains(ct, "application/json") {
		_ = json.Unmarshal(body, &in)
	} else {
		in.Code = string(body)
	}
	writeJSON(w, compileAndRun(in.Code, in.Stdin))
}

func handleFormat(w http.ResponseWriter, r *http.Request) {
	body, ct := readBody(r)
	code := string(body)
	// Tolerate a JSON {code} body too, in case a proxy wraps it.
	if strings.Contains(ct, "application/json") {
		var in runReq
		if json.Unmarshal(body, &in) == nil && in.Code != "" {
			code = in.Code
		}
	}
	writeJSON(w, formatCode(code))
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/run", handleRun)
	mux.HandleFunc("/format", handleFormat)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	if err := http.ListenAndServe("0.0.0.0:"+port, mux); err != nil {
		panic(err)
	}
}
