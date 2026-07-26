//go:build linux

package main

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
	"unicode/utf8"
)

const testSharedToken = "0123456789abcdef0123456789abcdef"
const testToolchainLockSHA256 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

func TestDockerfilePinsAndVerifiesRunnerSupplyChain(t *testing.T) {
	dockerfile, err := os.ReadFile("../../Dockerfile")
	if err != nil {
		t.Fatalf("read runner Dockerfile: %v", err)
	}
	content := string(dockerfile)
	lockBytes, err := os.ReadFile("../../cangjie-toolchain.lock.json")
	if err != nil {
		t.Fatalf("read Cangjie toolchain lock: %v", err)
	}
	var lock struct {
		Release  string `json:"release"`
		Compiler struct {
			Version          string `json:"version"`
			ExecutableSHA256 string `json:"executableSha256"`
		} `json:"compiler"`
		SDK struct {
			URL    string `json:"url"`
			SHA256 string `json:"sha256"`
		} `json:"sdk"`
		Stdx struct {
			URL    string `json:"url"`
			SHA256 string `json:"sha256"`
		} `json:"stdx"`
	}
	if err := json.Unmarshal(lockBytes, &lock); err != nil {
		t.Fatalf("parse Cangjie toolchain lock: %v", err)
	}
	if lock.Release == "" || lock.Compiler.Version != lock.Release ||
		len(lock.Compiler.ExecutableSHA256) != 64 ||
		len(lock.SDK.SHA256) != 64 || len(lock.Stdx.SHA256) != 64 ||
		lock.SDK.URL == "" || lock.Stdx.URL == "" {
		t.Fatal("Cangjie toolchain lock is incomplete or internally inconsistent")
	}
	for _, required := range []string{
		"golang:1.26@sha256:3aff6657219a4d9c14e27fb1d8976c49c29fddb70ba835014f477e1c70636647",
		"debian:12-slim@sha256:7b140f374b289a7c2befc338f42ebe6441b7ea838a042bbd5acbfca6ec875818",
		"COPY cangjie-toolchain.lock.json install-cangjie-toolchain.sh",
		"install-cangjie-toolchain.sh",
		"USER 65532:65532",
	} {
		if !strings.Contains(content, required) {
			t.Fatalf("Dockerfile omits pinned supply-chain requirement %q", required)
		}
	}
	installer, err := os.ReadFile("../../install-cangjie-toolchain.sh")
	if err != nil {
		t.Fatalf("read locked toolchain installer: %v", err)
	}
	installerContent := string(installer)
	for _, required := range []string{
		"compiler.executableSha256",
		"sdk.sha256",
		"stdx.sha256",
		"sha256sum --check",
	} {
		if !strings.Contains(installerContent, required) {
			t.Fatalf("toolchain installer omits lock check %q", required)
		}
	}
	for _, forbidden := range []string{
		"CJV_VERSION",
		"cjv install",
		"@latest",
		"ARG CANGJIE_",
	} {
		if strings.Contains(content, forbidden) {
			t.Fatalf("Dockerfile contains unpinned installer input %q", forbidden)
		}
	}
}

func testOperations() runnerOperations {
	return runnerOperations{
		compileAndRun: func(_ context.Context, code, stdin string) (runMessage, error) {
			binCode := 0
			return runMessage{
				Phase:          runPhaseRun,
				CompilerOutput: code,
				CompilerCode:   0,
				BinStdout:      stdin,
				BinStderr:      "runtime diagnostic",
				BinCode:        &binCode,
			}, nil
		},
	}
}

func TestRunResponseIdentifiesCompileFailureWithoutBinaryExitCode(t *testing.T) {
	operations := testOperations()
	operations.compileAndRun = func(_ context.Context, _, _ string) (runMessage, error) {
		return runMessage{
			Phase:          runPhaseCompile,
			CompilerOutput: "compile failed",
			CompilerCode:   1,
		}, nil
	}
	handler := testHandler(operations, 1)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(
		recorder,
		runnerRequest(http.MethodPost, "/run", "text/plain", "invalid"),
	)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", recorder.Code, http.StatusOK, recorder.Body.String())
	}
	var payload struct {
		Phase   string `json:"phase"`
		BinCode *int   `json:"bin_code"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.Phase != string(runPhaseCompile) {
		t.Fatalf("phase = %q, want %q", payload.Phase, runPhaseCompile)
	}
	if payload.BinCode != nil {
		t.Fatalf("bin_code = %d, want null", *payload.BinCode)
	}
	var wire map[string]json.RawMessage
	if err := json.Unmarshal(recorder.Body.Bytes(), &wire); err != nil {
		t.Fatalf("decode raw response: %v", err)
	}
	if raw, ok := wire["bin_code"]; !ok || string(raw) != "null" {
		t.Fatalf("bin_code JSON = %s, want explicit null", raw)
	}
	if _, ok := wire["bin_stdout"]; !ok {
		t.Fatal("run response omits bin_stdout")
	}
	if _, ok := wire["bin_stderr"]; !ok {
		t.Fatal("run response omits bin_stderr")
	}
	for _, field := range []string{
		"compiler_output_truncated",
		"bin_stdout_truncated",
		"bin_stderr_truncated",
	} {
		if raw, ok := wire[field]; !ok || string(raw) != "false" {
			t.Fatalf("%s JSON = %s, want required false", field, raw)
		}
	}
	if _, ok := wire["bin_output"]; ok {
		t.Fatal("run response exposes legacy combined bin_output")
	}
}

func TestRunResponseIdentifiesRunStageFailureWithExitCode(t *testing.T) {
	operations := testOperations()
	operations.compileAndRun = func(_ context.Context, _, _ string) (runMessage, error) {
		binCode := -1
		return runMessage{
			Phase:        runPhaseRun,
			CompilerCode: 0,
			BinStderr:    "sandbox start: unavailable",
			BinCode:      &binCode,
		}, nil
	}
	handler := testHandler(operations, 1)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(
		recorder,
		runnerRequest(http.MethodPost, "/run", "text/plain", "main() {}"),
	)

	var payload struct {
		Phase   string `json:"phase"`
		BinCode *int   `json:"bin_code"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.Phase != string(runPhaseRun) {
		t.Fatalf("phase = %q, want %q", payload.Phase, runPhaseRun)
	}
	if payload.BinCode == nil || *payload.BinCode != -1 {
		t.Fatalf("bin_code = %v, want -1", payload.BinCode)
	}
}

func TestCappedBufferKeepsFinalOutputWithinDomainLimit(t *testing.T) {
	t.Run("exact boundary is preserved", func(t *testing.T) {
		output := &cappedBuffer{cap: maxSerializedOutputBytes}
		input := strings.Repeat("x", maxSerializedOutputBytes)

		written, err := output.Write([]byte(input))
		if err != nil {
			t.Fatalf("write output: %v", err)
		}
		if written != len(input) {
			t.Fatalf("written = %d, want %d", written, len(input))
		}
		got := output.Result()
		if len(got.content) != maxSerializedOutputBytes {
			t.Fatalf("serialized bytes = %d, want %d", len(got.content), maxSerializedOutputBytes)
		}
		if got.truncated {
			t.Fatal("exact-boundary output reported truncation")
		}
	})

	t.Run("truncation is out-of-band metadata", func(t *testing.T) {
		output := &cappedBuffer{cap: maxSerializedOutputBytes}
		input := strings.Repeat("x", maxSerializedOutputBytes+1)
		_, _ = output.Write([]byte(input))

		got := output.Result()
		if len(got.content) != maxSerializedOutputBytes {
			t.Fatalf("serialized bytes = %d, want %d", len(got.content), maxSerializedOutputBytes)
		}
		if !got.truncated {
			t.Fatal("truncated output did not set its protocol flag")
		}
		if strings.Contains(got.content, "output truncated") {
			t.Fatalf("truncation metadata leaked into content: %q", got.content[len(got.content)-32:])
		}
	})

	t.Run("a multibyte boundary remains valid UTF-8", func(t *testing.T) {
		output := &cappedBuffer{cap: maxSerializedOutputBytes}
		// The leading ASCII byte makes the retained prefix end part-way through
		// a three-byte rune once room is reserved for the truncation marker.
		input := "a" + strings.Repeat("界", maxSerializedOutputBytes/3+2)
		_, _ = output.Write([]byte(input))

		got := output.Result()
		if len(got.content) > maxSerializedOutputBytes {
			t.Fatalf("serialized bytes = %d, want at most %d", len(got.content), maxSerializedOutputBytes)
		}
		if !utf8.ValidString(got.content) {
			t.Fatal("serialized output is not valid UTF-8")
		}
		if !got.truncated {
			t.Fatal("multibyte truncation did not set its protocol flag")
		}
	})
}

func TestCappedBufferSupportsConcurrentWritersAndSnapshots(t *testing.T) {
	const (
		limit           = 4_096
		writerCount     = 8
		writesPerWriter = 1_000
	)
	output := &cappedBuffer{cap: limit}
	start := make(chan struct{})
	done := make(chan struct{})
	var writers sync.WaitGroup
	var reader sync.WaitGroup
	var invalidOperations atomic.Int32

	reader.Add(1)
	go func() {
		defer reader.Done()
		<-start
		for {
			select {
			case <-done:
				return
			default:
				snapshot := output.Result()
				if len(snapshot.content) > limit || !utf8.ValidString(snapshot.content) {
					invalidOperations.Add(1)
				}
			}
		}
	}()

	payload := []byte("stdout/stderr:界\n")
	writers.Add(writerCount)
	for range writerCount {
		go func() {
			defer writers.Done()
			<-start
			for range writesPerWriter {
				written, err := output.Write(payload)
				if err != nil || written != len(payload) {
					invalidOperations.Add(1)
				}
			}
		}()
	}

	close(start)
	writers.Wait()
	close(done)
	reader.Wait()

	if invalidOperations.Load() != 0 {
		t.Fatalf("concurrent buffer operations produced %d invalid results", invalidOperations.Load())
	}
	got := output.Result()
	if len(got.content) > limit {
		t.Fatalf("serialized bytes = %d, want at most %d", len(got.content), limit)
	}
	if !utf8.ValidString(got.content) {
		t.Fatal("serialized output is not valid UTF-8")
	}
	if !got.truncated {
		t.Fatal("concurrent overflow did not set its protocol flag")
	}
}

func TestTrustedToolEnvironmentDoesNotInheritServiceSecrets(t *testing.T) {
	t.Setenv("CJ_RUNNER_SHARED_TOKEN", "must-not-cross-the-process-boundary")
	t.Setenv("MODAL_TOKEN_SECRET", "must-not-cross-the-process-boundary")

	environment := trustedToolEnvironment("/request")
	joined := strings.Join(environment, "\n")

	for _, secretName := range []string{"CJ_RUNNER_SHARED_TOKEN", "MODAL_TOKEN_SECRET"} {
		if strings.Contains(joined, secretName+"=") {
			t.Fatalf("trusted tool environment inherited %s: %q", secretName, environment)
		}
	}
	for _, required := range []string{
		"CANGJIE_HOME=/cangjie",
		"LD_LIBRARY_PATH=" + cangjieLibs,
		"HOME=/request",
		"TMPDIR=/request",
	} {
		if !containsExact(environment, required) {
			t.Fatalf("trusted tool environment omits %q: %q", required, environment)
		}
	}
}

func TestSandboxCommandUsesAnEmptyRootAndExplicitEnvironment(t *testing.T) {
	t.Setenv("CJ_RUNNER_SHARED_TOKEN", "must-not-reach-bubblewrap")
	executable := filepath.Join(t.TempDir(), "main")
	if err := os.WriteFile(executable, []byte("#!/bin/sh\nexit 0\n"), 0o700); err != nil {
		t.Fatalf("write sandbox executable: %v", err)
	}
	settings := sandboxSettings{
		bubblewrapPath: "/usr/bin/bwrap",
		prlimitPath:    "/usr/bin/prlimit",
		readOnlyPaths:  []string{"/usr", "/lib", "/cangjie"},
	}

	command, err := sandboxCommand(context.Background(), sandboxCommandSpec{
		executable:              sandboxExecutablePath,
		environment:             runtimeEnvironment(),
		workingDirectory:        sandboxWorkingDirectory,
		readOnlyExecutableMount: executable,
		timeout:                 runTimeout,
		limits:                  runtimeResourceLimits,
	}, settings)
	if err != nil {
		t.Fatalf("build sandbox command: %v", err)
	}
	args := command.Args[1:]

	for _, required := range [][]string{
		{"--unshare-all"},
		{"--unshare-user"},
		{"--clearenv"},
		{"--disable-userns"},
		{"--assert-userns-disabled"},
		{"--ro-bind", "/usr", "/usr"},
		{"--ro-bind", "/lib", "/lib"},
		{"--ro-bind", "/cangjie", "/cangjie"},
		{"--ro-bind", executable, sandboxExecutablePath},
		{"--proc", "/proc"},
		{"--dev", "/dev"},
		{"--size", strconv.Itoa(sandboxTmpBytes), "--tmpfs", "/tmp"},
		{"--size", strconv.Itoa(sandboxWorkBytes), "--tmpfs", sandboxWorkingDirectory},
		{"--tmpfs", "/tmp"},
		{"--tmpfs", sandboxWorkingDirectory},
		{"--remount-ro", "/"},
		{"--setenv", "LD_LIBRARY_PATH", cangjieLibs},
		{"--as=" + strconv.Itoa(limAddrSpaceBytes)},
		{"--cpu=" + strconv.Itoa(limCPUSeconds)},
		{"--nproc=" + strconv.Itoa(limNProc)},
		{"--fsize=" + strconv.Itoa(limFsizeBytes)},
		{"--nofile=" + strconv.Itoa(limNoFile)},
	} {
		if !containsArgumentSequence(args, required) {
			t.Fatalf("sandbox args omit %q: %q", required, args)
		}
	}
	for _, forbidden := range []string{"/", "/etc", "/playground"} {
		if containsArgumentSequence(args, []string{"--ro-bind", forbidden, forbidden}) {
			t.Fatalf("sandbox exposes forbidden host path %q: %q", forbidden, args)
		}
	}
	joinedEnvironment := strings.Join(command.Env, "\n")
	if strings.Contains(joinedEnvironment, "CJ_RUNNER_SHARED_TOKEN=") {
		t.Fatalf("bubblewrap launcher inherited the runner token: %q", command.Env)
	}
	if command.SysProcAttr == nil || !command.SysProcAttr.Setpgid {
		t.Fatal("sandbox command does not own a killable process group")
	}
	if command.Cancel == nil || command.WaitDelay != processWaitDelay {
		t.Fatalf("sandbox command cancellation is not bounded: cancel=%v waitDelay=%s", command.Cancel != nil, command.WaitDelay)
	}
}

func TestSandboxCommandCanUseAnExplicitOuterContainerBoundary(t *testing.T) {
	executable := filepath.Join(t.TempDir(), "main")
	if err := os.WriteFile(executable, []byte("#!/bin/sh\nexit 0\n"), 0o700); err != nil {
		t.Fatalf("write sandbox executable: %v", err)
	}
	settings := sandboxSettings{
		bubblewrapPath:            "/usr/bin/bwrap",
		prlimitPath:               "/usr/bin/prlimit",
		readOnlyPaths:             []string{"/usr", "/lib", "/cangjie"},
		useOuterContainerBoundary: true,
	}

	command, err := sandboxCommand(context.Background(), sandboxCommandSpec{
		executable:              sandboxExecutablePath,
		environment:             runtimeEnvironment(),
		workingDirectory:        sandboxWorkingDirectory,
		readOnlyExecutableMount: executable,
		timeout:                 runTimeout,
		limits:                  runtimeResourceLimits,
	}, settings)
	if err != nil {
		t.Fatalf("build sandbox command: %v", err)
	}
	args := command.Args[1:]
	for _, required := range []string{
		"--reuid=65532",
		"--regid=65532",
		"--bounding-set=-all",
		"--no-new-privs",
		"/usr/bin/prlimit",
	} {
		if !containsArgumentSequence(args, []string{required}) {
			t.Fatalf("sandbox lost non-network boundary %q: %q", required, args)
		}
	}
	for _, forbidden := range []string{
		"--unshare-all",
		"--unshare-user",
		"--disable-userns",
		"--assert-userns-disabled",
		"/usr/bin/bwrap",
	} {
		if containsArgumentSequence(args, []string{forbidden}) {
			t.Fatalf("sandbox attempted unavailable nested boundary %q: %q", forbidden, args)
		}
	}
	if command.Path != "/usr/bin/setpriv" {
		t.Fatalf("outer-boundary command path = %q, want setpriv", command.Path)
	}
	if command.Dir != "/tmp" {
		t.Fatalf("outer-boundary working directory = %q", command.Dir)
	}
}

func TestSandboxCommandRejectsSymlinkExecutableArtifacts(t *testing.T) {
	directory := t.TempDir()
	target := filepath.Join(directory, "target")
	link := filepath.Join(directory, "main")
	if err := os.WriteFile(target, []byte("#!/bin/sh\nexit 0\n"), 0o700); err != nil {
		t.Fatalf("write executable target: %v", err)
	}
	if err := os.Symlink(target, link); err != nil {
		t.Fatalf("create executable symlink: %v", err)
	}

	_, err := sandboxCommand(context.Background(), sandboxCommandSpec{
		executable:              sandboxExecutablePath,
		environment:             runtimeEnvironment(),
		workingDirectory:        sandboxWorkingDirectory,
		readOnlyExecutableMount: link,
		timeout:                 runTimeout,
		limits:                  runtimeResourceLimits,
	}, sandboxSettings{
		bubblewrapPath: "/usr/bin/bwrap",
		prlimitPath:    "/usr/bin/prlimit",
	})
	if err == nil || !strings.Contains(err.Error(), "regular executable file") {
		t.Fatalf("sandbox symlink executable error = %v", err)
	}
}

func TestSandboxHidesServiceSecretsAndConcurrentSiblingDirectories(t *testing.T) {
	t.Setenv("CJ_RUNNER_SHARED_TOKEN", "runner-token-must-stay-server-only")
	root := t.TempDir()
	firstDir := filepath.Join(root, "run-first")
	secondDir := filepath.Join(root, "run-second")
	for _, directory := range []string{firstDir, secondDir} {
		if err := os.Mkdir(directory, 0o700); err != nil {
			t.Fatalf("create request directory: %v", err)
		}
	}
	firstSecret := filepath.Join(firstDir, "request-secret")
	secondSecret := filepath.Join(secondDir, "request-secret")
	if err := os.WriteFile(firstSecret, []byte("first-request-secret"), 0o600); err != nil {
		t.Fatalf("write first request secret: %v", err)
	}
	if err := os.WriteFile(secondSecret, []byte("second-request-secret"), 0o600); err != nil {
		t.Fatalf("write second request secret: %v", err)
	}

	firstProbe := writeSandboxProbe(t, firstDir, secondSecret)
	secondProbe := writeSandboxProbe(t, secondDir, firstSecret)
	settings := sandboxTestSettings(t)

	type result struct {
		stdout string
		stderr string
		code   int
	}
	start := make(chan struct{})
	results := make(chan result, 2)
	for _, probe := range []string{firstProbe, secondProbe} {
		go func(executable string) {
			<-start
			sandboxResult, err := runSandboxedWithSettings(
				context.Background(),
				executable,
				"",
				settings,
			)
			if err != nil {
				results <- result{stderr: err.Error(), code: -1}
				return
			}
			results <- result{
				stdout: sandboxResult.stdout.content,
				stderr: sandboxResult.stderr.content,
				code:   sandboxResult.exitCode,
			}
		}(probe)
	}
	close(start)

	for range 2 {
		got := <-results
		if got.code != 0 {
			t.Fatalf("sandbox probe exited %d; stdout=%q stderr=%q", got.code, got.stdout, got.stderr)
		}
		if got.stderr != "" {
			t.Fatalf("sandbox probe wrote stderr: %q", got.stderr)
		}
		if !strings.Contains(got.stdout, "runner_token=unset\n") {
			t.Fatalf("sandbox inherited the service token: %q", got.stdout)
		}
		if !strings.Contains(got.stdout, "sibling_read=blocked\n") {
			t.Fatalf("sandbox could inspect a sibling request directory: %q", got.stdout)
		}
		if !strings.Contains(got.stdout, "sibling_write=blocked\n") {
			t.Fatalf("sandbox could modify a sibling request directory: %q", got.stdout)
		}
		if strings.Contains(got.stdout, "first-request-secret") ||
			strings.Contains(got.stdout, "second-request-secret") ||
			strings.Contains(got.stdout, "runner-token-must-stay-server-only") {
			t.Fatalf("sandbox leaked protected data: %q", got.stdout)
		}
	}
	for path, expected := range map[string]string{
		firstSecret:  "first-request-secret",
		secondSecret: "second-request-secret",
	} {
		content, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("read protected sibling file: %v", err)
		}
		if string(content) != expected {
			t.Fatalf("protected sibling file %s was modified: %q", path, content)
		}
	}
}

func TestToolSandboxSeesOnlyItsWritableRequestDirectory(t *testing.T) {
	t.Setenv("CJ_RUNNER_SHARED_TOKEN", "tool-must-not-see-runner-token")
	root := t.TempDir()
	requestDirectory := filepath.Join(root, "request")
	siblingDirectory := filepath.Join(root, "sibling")
	for _, directory := range []string{requestDirectory, siblingDirectory} {
		if err := os.Mkdir(directory, 0o700); err != nil {
			t.Fatalf("create tool request directory: %v", err)
		}
	}
	siblingSecret := filepath.Join(siblingDirectory, "secret")
	if err := os.WriteFile(siblingSecret, []byte("sibling-secret"), 0o600); err != nil {
		t.Fatalf("write sibling secret: %v", err)
	}
	probe := filepath.Join(requestDirectory, "probe")
	script := fmt.Sprintf(`#!/bin/sh
printf 'token=%%s\n' "${CJ_RUNNER_SHARED_TOKEN-unset}"
printf 'own-write' > /request/generated
if [ "$(cat /request/generated)" = "own-write" ]; then
  printf 'request=rw\n'
fi
if [ -r %s ]; then printf 'sibling_read=visible\n'; else printf 'sibling_read=blocked\n'; fi
if printf 'tampered' 2>/dev/null > %s; then printf 'sibling_write=visible\n'; else printf 'sibling_write=blocked\n'; fi
`, shellSingleQuote(siblingSecret), shellSingleQuote(siblingSecret))
	if err := os.WriteFile(probe, []byte(script), 0o700); err != nil {
		t.Fatalf("write tool sandbox probe: %v", err)
	}

	result, err := runSandboxOperation(context.Background(), sandboxCommandSpec{
		executable:              "/bin/sh",
		arguments:               []string{"/request/probe"},
		environment:             trustedToolEnvironment("/request"),
		workingDirectory:        "/request",
		requestDirectory:        requestDirectory,
		timeout:                 time.Second,
		limits:                  toolResourceLimits,
		timeoutIsInfrastructure: true,
	}, sandboxTestSettings(t), "tool isolation probe")
	if err != nil {
		t.Fatalf("run tool sandbox probe: %v", err)
	}
	if result.exitCode != 0 || result.stderr.content != "" {
		t.Fatalf("tool probe exited %d; stdout=%q stderr=%q", result.exitCode, result.stdout.content, result.stderr.content)
	}
	for _, expected := range []string{
		"token=unset\n",
		"request=rw\n",
		"sibling_read=blocked\n",
		"sibling_write=blocked\n",
	} {
		if !strings.Contains(result.stdout.content, expected) {
			t.Fatalf("tool sandbox output omits %q: %q", expected, result.stdout.content)
		}
	}
	content, err := os.ReadFile(filepath.Join(requestDirectory, "generated"))
	if err != nil || string(content) != "own-write" {
		t.Fatalf("tool request write was not retained: content=%q err=%v", content, err)
	}
	content, err = os.ReadFile(siblingSecret)
	if err != nil || string(content) != "sibling-secret" {
		t.Fatalf("tool sandbox modified sibling content: content=%q err=%v", content, err)
	}
}

func TestCangjieCompilerSandboxIntegration(t *testing.T) {
	if os.Getenv("CJ_RUNNER_TOOLCHAIN_INTEGRATION") != "1" {
		t.Skip("set CJ_RUNNER_TOOLCHAIN_INTEGRATION=1 inside the runner filesystem")
	}
	if err := verifySandboxBoundary(context.Background(), productionSandboxSettings); err != nil {
		t.Fatalf("verify production sandbox profiles: %v", err)
	}
	message, err := compileAndRun(
		context.Background(),
		"main(): Int64 {\n    println(\"sandboxed\")\n    return 0\n}\n",
		"",
	)
	if err != nil {
		t.Fatalf("compile and run in toolchain sandbox: %v", err)
	}
	if message.CompilerCode != 0 || message.BinCode == nil || *message.BinCode != 0 {
		t.Fatalf("compile/run result = %#v", message)
	}
	if message.BinStdout != "sandboxed\n" {
		t.Fatalf("runtime stdout = %q", message.BinStdout)
	}
}

func TestSandboxSetupFailureCannotMasqueradeAsLearnerExit(t *testing.T) {
	settings := sandboxTestSettings(t)
	settings.readOnlyPaths = append(
		settings.readOnlyPaths,
		"/definitely-missing-runner-runtime",
	)

	_, err := runSandboxedWithSettings(
		context.Background(),
		"/usr/bin/true",
		"",
		settings,
	)

	var infrastructureFailure *runnerInfrastructureError
	if !errors.As(err, &infrastructureFailure) {
		t.Fatalf("sandbox setup error = %v, want typed infrastructure failure", err)
	}
	if !strings.Contains(err.Error(), "sandbox setup") {
		t.Fatalf("sandbox setup diagnostic = %q", err)
	}
}

func TestSandboxPreservesLearnerExitAndSeparateOutput(t *testing.T) {
	requestDirectory := t.TempDir()
	probe := filepath.Join(requestDirectory, "probe")
	if err := os.WriteFile(
		probe,
		[]byte("#!/bin/sh\nprintf 'learner stdout\\n'\nprintf 'nofile=%s\\n' \"$(ulimit -n)\"\nprintf 'learner stderr\\n' >&2\nexit 7\n"),
		0o700,
	); err != nil {
		t.Fatalf("write learner probe: %v", err)
	}

	result, err := runSandboxedWithSettings(
		context.Background(),
		probe,
		"",
		sandboxTestSettings(t),
	)

	if err != nil {
		t.Fatalf("run learner probe: %v", err)
	}
	if result.exitCode != 7 {
		t.Fatalf("learner exit code = %d, want 7; stdout=%q stderr=%q", result.exitCode, result.stdout.content, result.stderr.content)
	}
	if result.stdout.content != "learner stdout\nnofile=256\n" {
		t.Fatalf("learner stdout = %q", result.stdout.content)
	}
	if result.stderr.content != "learner stderr\n" {
		t.Fatalf("learner stderr = %q", result.stderr.content)
	}
	if strings.Contains(result.stderr.content, sandboxReadyMarker) {
		t.Fatalf("internal sandbox marker leaked into learner stderr: %q", result.stderr.content)
	}
}

func TestSandboxKeepsHostNetworkAndPIDNamespacePrivate(t *testing.T) {
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("open host listener: %v", err)
	}
	defer listener.Close()
	hostPort := listener.Addr().(*net.TCPAddr).Port

	const hostProcessSentinel = "cj-runner-host-process-sentinel"
	hostProcess := exec.Command("sleep", "30")
	hostProcess.Env = append(os.Environ(), "CJ_SANDBOX_PID_SENTINEL="+hostProcessSentinel)
	if err := hostProcess.Start(); err != nil {
		t.Fatalf("start host sibling process: %v", err)
	}
	defer func() {
		_ = hostProcess.Process.Kill()
		_ = hostProcess.Wait()
	}()

	requestDirectory := t.TempDir()
	probe := filepath.Join(requestDirectory, "probe")
	script := fmt.Sprintf(`#!/bin/sh
if /bin/grep -a -q %s /proc/%d/environ 2>/dev/null; then
  printf 'host_pid=visible\n'
else
  printf 'host_pid=hidden\n'
fi
network=hidden
while IFS= read -r line; do
  case "$line" in
    *":%04X "*) network=visible ;;
  esac
done < /proc/net/tcp
printf 'host_network=%%s\n' "$network"
`, shellSingleQuote(hostProcessSentinel), hostProcess.Process.Pid, hostPort)
	if err := os.WriteFile(probe, []byte(script), 0o700); err != nil {
		t.Fatalf("write namespace probe: %v", err)
	}

	result, err := runSandboxedWithSettings(
		context.Background(),
		probe,
		"",
		sandboxTestSettings(t),
	)
	if err != nil {
		t.Fatalf("run namespace probe: %v", err)
	}
	if result.exitCode != 0 || result.stderr.content != "" {
		t.Fatalf("namespace probe exited %d; stdout=%q stderr=%q", result.exitCode, result.stdout.content, result.stderr.content)
	}
	if result.stdout.content != "host_pid=hidden\nhost_network=hidden\n" {
		t.Fatalf("host namespace resources were visible: %q", result.stdout.content)
	}
}

func TestSandboxBoundaryFailsClosedWhenBubblewrapCannotStart(t *testing.T) {
	settings := sandboxSettings{
		bubblewrapPath: "/definitely-not-installed/bwrap",
		prlimitPath:    "/usr/bin/prlimit",
		readOnlyPaths:  []string{"/usr"},
	}

	_, runErr := runSandboxedWithSettings(
		context.Background(),
		"/usr/bin/true",
		"",
		settings,
	)

	var infrastructureFailure *runnerInfrastructureError
	if !errors.As(runErr, &infrastructureFailure) {
		t.Fatalf("sandbox start error = %v, want typed infrastructure error", runErr)
	}
	if !strings.Contains(runErr.Error(), settings.bubblewrapPath) {
		t.Fatalf("sandbox start diagnostic = %q", runErr)
	}
	if err := verifySandboxBoundary(context.Background(), settings); err == nil {
		t.Fatal("sandbox readiness probe accepted a missing bubblewrap executable")
	}
}

func sandboxTestSettings(t *testing.T) sandboxSettings {
	t.Helper()
	bubblewrapPath, err := exec.LookPath("bwrap")
	if err != nil {
		t.Fatalf("bubblewrap is required for the runner boundary: %v", err)
	}
	prlimitPath, err := exec.LookPath("prlimit")
	if err != nil {
		t.Fatalf("prlimit is required for the runner boundary: %v", err)
	}
	return sandboxSettings{
		bubblewrapPath: bubblewrapPath,
		prlimitPath:    prlimitPath,
		readOnlyPaths: existingSandboxRuntimePaths(
			[]string{"/usr", "/bin", "/lib", "/lib64"},
		),
	}
}

func containsExact(values []string, wanted string) bool {
	for _, value := range values {
		if value == wanted {
			return true
		}
	}
	return false
}

func containsArgumentSequence(values, wanted []string) bool {
	if len(wanted) == 0 || len(wanted) > len(values) {
		return false
	}
	for start := 0; start <= len(values)-len(wanted); start++ {
		matches := true
		for offset := range wanted {
			if values[start+offset] != wanted[offset] {
				matches = false
				break
			}
		}
		if matches {
			return true
		}
	}
	return false
}

func existingSandboxRuntimePaths(candidates []string) []string {
	paths := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			paths = append(paths, candidate)
		}
	}
	return paths
}

func writeSandboxProbe(t *testing.T, requestDirectory, siblingSecret string) string {
	t.Helper()
	path := filepath.Join(requestDirectory, "probe")
	script := fmt.Sprintf(`#!/bin/sh
printf 'runner_token=%%s\n' "${CJ_RUNNER_SHARED_TOKEN-unset}"
sleep 0.2
if [ -r %s ]; then
  printf 'sibling_read=readable\n'
  /bin/cat %s
else
  printf 'sibling_read=blocked\n'
fi
if printf 'tampered' 2>/dev/null > %s; then
  printf 'sibling_write=writable\n'
else
  printf 'sibling_write=blocked\n'
fi
`,
		shellSingleQuote(siblingSecret),
		shellSingleQuote(siblingSecret),
		shellSingleQuote(siblingSecret),
	)
	if err := os.WriteFile(path, []byte(script), 0o700); err != nil {
		t.Fatalf("write sandbox probe: %v", err)
	}
	return path
}

func shellSingleQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", `'"'"'`) + "'"
}

func testHandler(operations runnerOperations, concurrency int) http.Handler {
	if concurrency != 1 {
		panic("runner test helper only supports fixed single-flight admission")
	}
	return newRunnerHandler(runnerConfig{
		sharedToken:         testSharedToken,
		toolchainLockSha256: testToolchainLockSHA256,
	}, operations)
}

func runnerRequest(method, path, contentType, body string) *http.Request {
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	if contentType != "" {
		request.Header.Set("Content-Type", contentType)
	}
	request.Header.Set("Authorization", "Bearer "+testSharedToken)
	request.Header.Set(toolchainLockHeader, testToolchainLockSHA256)
	return request
}

func responseError(t *testing.T, recorder *httptest.ResponseRecorder) map[string]string {
	t.Helper()
	var payload map[string]string
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return payload
}

func TestLoadRunnerConfigFailsClosed(t *testing.T) {
	t.Run("production requires a token", func(t *testing.T) {
		_, err := loadRunnerConfig(map[string]string{"CJ_RUNNER_ENV": "production"})
		if err == nil {
			t.Fatal("expected missing production token to fail")
		}
	})

	t.Run("the secure default is production", func(t *testing.T) {
		_, err := loadRunnerConfig(map[string]string{})
		if err == nil {
			t.Fatal("expected missing token to fail when environment is omitted")
		}
	})

	t.Run("development may explicitly run without authentication", func(t *testing.T) {
		config, err := loadRunnerConfig(map[string]string{"CJ_RUNNER_ENV": "development"})
		if err != nil {
			t.Fatalf("load development config: %v", err)
		}
		if !config.allowUnauthenticatedDev {
			t.Fatal("expected explicit development mode to allow a local unauthenticated runner")
		}
	})

	t.Run("tokens are validated", func(t *testing.T) {
		if _, err := loadRunnerConfig(map[string]string{
			"CJ_RUNNER_ENV":          "production",
			"CJ_RUNNER_SHARED_TOKEN": "short",
		}); err == nil {
			t.Fatal("expected a weak token to fail")
		}
	})

	t.Run("production requires the Modal isolation driver", func(t *testing.T) {
		if _, err := loadRunnerConfig(map[string]string{
			"CJ_RUNNER_ENV":          "production",
			"CJ_RUNNER_SHARED_TOKEN": testSharedToken,
		}); err == nil {
			t.Fatal("production runner started outside the Modal single-use container")
		}
	})

	t.Run("outer network isolation is explicit and production-only", func(t *testing.T) {
		config, err := loadRunnerConfig(map[string]string{
			"CJ_RUNNER_ENV":              "production",
			"CJ_RUNNER_SHARED_TOKEN":     testSharedToken,
			"CJ_RUNNER_ISOLATION_DRIVER": "modal-single-use-container",
		})
		if err != nil {
			t.Fatalf("valid Modal network boundary was rejected: %v", err)
		}
		if !sandboxSettingsForConfig(config).useOuterContainerBoundary {
			t.Fatal("Modal boundary did not retain the outer user and network namespaces")
		}
		if _, err := loadRunnerConfig(map[string]string{
			"CJ_RUNNER_ENV":              "production",
			"CJ_RUNNER_SHARED_TOKEN":     testSharedToken,
			"CJ_RUNNER_ISOLATION_DRIVER": "disabled",
		}); err == nil {
			t.Fatal("unknown outer network isolation mode was accepted")
		}
		if _, err := loadRunnerConfig(map[string]string{
			"CJ_RUNNER_ENV":              "test",
			"CJ_RUNNER_SHARED_TOKEN":     testSharedToken,
			"CJ_RUNNER_ISOLATION_DRIVER": "modal-single-use-container",
		}); err == nil {
			t.Fatal("external network boundary was accepted outside production")
		}
	})
}

func TestInstalledCangjieToolchainIsBoundToLockBytesIdentityAndTarget(t *testing.T) {
	lockBytes, err := os.ReadFile("../../cangjie-toolchain.lock.json")
	if err != nil {
		t.Fatalf("read repository toolchain lock: %v", err)
	}
	var lock cangjieToolchainLock
	if err := decodeStrictJSON(lockBytes, &lock); err != nil {
		t.Fatalf("decode repository toolchain lock: %v", err)
	}

	directory := t.TempDir()
	compilerPath := filepath.Join(directory, "cjc")
	compilerScript := fmt.Sprintf(
		"#!/bin/sh\nprintf 'Cangjie Compiler: %s (%s)\\nTarget: %s\\n'\n",
		lock.Compiler.Version,
		lock.Compiler.Backend,
		lock.Compiler.Target,
	)
	if err := os.WriteFile(compilerPath, []byte(compilerScript), 0o700); err != nil {
		t.Fatalf("write compiler probe: %v", err)
	}
	compilerSHA256, err := hashRegularExecutable(compilerPath)
	if err != nil {
		t.Fatalf("hash compiler probe: %v", err)
	}
	lock.Compiler.ExecutableSHA256 = compilerSHA256
	fixtureLockBytes, err := json.MarshalIndent(lock, "", "  ")
	if err != nil {
		t.Fatalf("marshal fixture lock: %v", err)
	}
	fixtureLockBytes = append(fixtureLockBytes, '\n')
	lockPath := filepath.Join(directory, "cangjie-toolchain.lock.json")
	if err := os.WriteFile(lockPath, fixtureLockBytes, 0o600); err != nil {
		t.Fatalf("write fixture lock: %v", err)
	}
	lockSHA256, err := canonicalJSONSHA256(fixtureLockBytes)
	if err != nil {
		t.Fatalf("canonicalize fixture lock: %v", err)
	}
	markerPath := filepath.Join(directory, ".playground-cj-toolchain-lock.sha256")
	if err := os.WriteFile(markerPath, []byte(lockSHA256+"\n"), 0o600); err != nil {
		t.Fatalf("write fixture marker: %v", err)
	}

	verified, err := verifyInstalledCangjieToolchain(
		context.Background(),
		lockPath,
		compilerPath,
		markerPath,
	)
	if err != nil {
		t.Fatalf("verify fixture toolchain: %v", err)
	}
	if verified != lockSHA256 {
		t.Fatalf("verified lock digest = %q, want %q", verified, lockSHA256)
	}

	markerLink := filepath.Join(directory, "marker-link")
	if err := os.Symlink(markerPath, markerLink); err != nil {
		t.Fatalf("symlink fixture marker: %v", err)
	}
	if _, err := verifyInstalledCangjieToolchain(
		context.Background(),
		lockPath,
		compilerPath,
		markerLink,
	); err == nil || !strings.Contains(err.Error(), "regular") {
		t.Fatalf("symlink marker verification error = %v", err)
	}

	if err := os.WriteFile(compilerPath, []byte(compilerScript+"\n"), 0o700); err != nil {
		t.Fatalf("tamper compiler probe: %v", err)
	}
	if _, err := verifyInstalledCangjieToolchain(
		context.Background(),
		lockPath,
		compilerPath,
		markerPath,
	); err == nil || !strings.Contains(err.Error(), "compiler bytes") {
		t.Fatalf("tampered compiler verification error = %v", err)
	}
}

func TestInstalledCangjieToolchainRejectsUnknownLockFieldsAndUnofficialURL(t *testing.T) {
	lockBytes, err := os.ReadFile("../../cangjie-toolchain.lock.json")
	if err != nil {
		t.Fatalf("read repository toolchain lock: %v", err)
	}
	var lock cangjieToolchainLock
	if err := decodeStrictJSON(lockBytes, &lock); err != nil {
		t.Fatalf("decode repository toolchain lock: %v", err)
	}
	if err := validateCangjieToolchainLock(lock); err != nil {
		t.Fatalf("repository toolchain lock failed validation: %v", err)
	}

	invalidURLs := []string{
		"https://example.invalid/cangjie-sdk-linux-x64-" +
			lock.Release + ".tar.gz",
		strings.Replace(
			lock.SDK.URL,
			"?nsId=142267&fileName=",
			"?fileName=",
			1,
		),
		lock.SDK.URL + "-not-alphanumeric",
	}
	for _, invalidURL := range invalidURLs {
		invalidLock := lock
		invalidLock.SDK.URL = invalidURL
		if err := validateCangjieToolchainLock(invalidLock); err == nil {
			t.Fatalf("invalid SDK URL passed toolchain lock validation: %s", invalidURL)
		}
	}

	var withUnknownField map[string]any
	if err := json.Unmarshal(lockBytes, &withUnknownField); err != nil {
		t.Fatalf("decode generic repository lock: %v", err)
	}
	withUnknownField["unexpected"] = true
	unknownBytes, err := json.Marshal(withUnknownField)
	if err != nil {
		t.Fatalf("marshal lock with unknown field: %v", err)
	}
	if err := decodeStrictJSON(unknownBytes, &cangjieToolchainLock{}); err == nil {
		t.Fatal("unknown toolchain lock field passed strict decoding")
	}
}

func TestCanonicalJSONSHA256SortsObjectKeysWithoutHTMLEscaping(t *testing.T) {
	input := []byte("{\n  \"z\": 1,\n  \"a\": {\"y\": \"<\", \"x\": 2}\n}\n")
	got, err := canonicalJSONSHA256(input)
	if err != nil {
		t.Fatalf("canonicalize JSON fixture: %v", err)
	}
	canonical := []byte(`{"a":{"x":2,"y":"<"},"z":1}`)
	expected := fmt.Sprintf("%x", sha256.Sum256(canonical))
	if got != expected {
		t.Fatalf("canonical JSON digest = %q, want %q", got, expected)
	}
}

func TestDevelopmentModeWithoutTokenIsExplicitlyUnauthenticated(t *testing.T) {
	config, err := loadRunnerConfig(map[string]string{"CJ_RUNNER_ENV": "development"})
	if err != nil {
		t.Fatalf("load development config: %v", err)
	}
	config.toolchainLockSha256 = testToolchainLockSHA256
	handler := newRunnerHandler(config, testOperations())
	request := httptest.NewRequest(http.MethodPost, "/run", strings.NewReader("main() {}"))
	request.Header.Set("Content-Type", "text/plain")
	request.Header.Set(toolchainLockHeader, testToolchainLockSHA256)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("development request status = %d, want %d; body: %s", recorder.Code, http.StatusOK, recorder.Body.String())
	}
	if got := runnerListenAddress(config, "8000"); got != "127.0.0.1:8000" {
		t.Fatalf("unauthenticated development listen address = %q, want loopback", got)
	}
}

func TestRunnerBoundaryRejectsInvalidRequests(t *testing.T) {
	handler := testHandler(testOperations(), 1)

	tests := []struct {
		name        string
		request     *http.Request
		wantStatus  int
		wantCode    string
		wantAllowed string
	}{
		{
			name:        "only POST is accepted",
			request:     runnerRequest(http.MethodGet, "/run", "text/plain", ""),
			wantStatus:  http.StatusMethodNotAllowed,
			wantCode:    "method_not_allowed",
			wantAllowed: http.MethodPost,
		},
		{
			name:       "authentication is mandatory",
			request:    httptest.NewRequest(http.MethodPost, "/run", strings.NewReader("main() {}")),
			wantStatus: http.StatusUnauthorized,
			wantCode:   "unauthorized",
		},
		{
			name: "a wrong bearer token is rejected",
			request: func() *http.Request {
				request := runnerRequest(http.MethodPost, "/run", "text/plain", "main() {}")
				request.Header.Set("Authorization", "Bearer wrong")
				return request
			}(),
			wantStatus: http.StatusUnauthorized,
			wantCode:   "unauthorized",
		},
		{
			name: "the expected toolchain digest is required",
			request: func() *http.Request {
				request := runnerRequest(http.MethodPost, "/run", "text/plain", "main() {}")
				request.Header.Del(toolchainLockHeader)
				return request
			}(),
			wantStatus: http.StatusServiceUnavailable,
			wantCode:   "runner_toolchain_mismatch",
		},
		{
			name: "a stale toolchain digest is rejected",
			request: func() *http.Request {
				request := runnerRequest(http.MethodPost, "/run", "text/plain", "main() {}")
				request.Header.Set(
					toolchainLockHeader,
					"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
				)
				return request
			}(),
			wantStatus: http.StatusServiceUnavailable,
			wantCode:   "runner_toolchain_mismatch",
		},
		{
			name:       "content type is required",
			request:    runnerRequest(http.MethodPost, "/run", "", "main() {}"),
			wantStatus: http.StatusUnsupportedMediaType,
			wantCode:   "unsupported_media_type",
		},
		{
			name:       "non UTF-8 charsets are rejected",
			request:    runnerRequest(http.MethodPost, "/run", "text/plain; charset=iso-8859-1", "main() {}"),
			wantStatus: http.StatusUnsupportedMediaType,
			wantCode:   "unsupported_media_type",
		},
		{
			name:       "unknown JSON fields are rejected",
			request:    runnerRequest(http.MethodPost, "/run", "application/json", `{"code":"main() {}","admin":true}`),
			wantStatus: http.StatusBadRequest,
			wantCode:   "invalid_json_body",
		},
		{
			name:       "JSON code is required",
			request:    runnerRequest(http.MethodPost, "/run", "application/json", `{"stdin":""}`),
			wantStatus: http.StatusBadRequest,
			wantCode:   "invalid_json_body",
		},
		{
			name:       "JSON null stdin is rejected",
			request:    runnerRequest(http.MethodPost, "/run", "application/json", `{"code":"main() {}","stdin":null}`),
			wantStatus: http.StatusBadRequest,
			wantCode:   "invalid_json_body",
		},
		{
			name:       "trailing JSON is rejected",
			request:    runnerRequest(http.MethodPost, "/run", "application/json", `{"code":""}{}`),
			wantStatus: http.StatusBadRequest,
			wantCode:   "invalid_json_body",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, test.request)
			if recorder.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d; body: %s", recorder.Code, test.wantStatus, recorder.Body.String())
			}
			if got := responseError(t, recorder)["code"]; got != test.wantCode {
				t.Fatalf("code = %q, want %q", got, test.wantCode)
			}
			if test.wantCode == "runner_toolchain_mismatch" &&
				recorder.Header().Get(toolchainMismatchHeader) != "mismatch" {
				t.Fatalf(
					"%s = %q, want mismatch",
					toolchainMismatchHeader,
					recorder.Header().Get(toolchainMismatchHeader),
				)
			}
			if test.wantAllowed != "" && recorder.Header().Get("Allow") != test.wantAllowed {
				t.Fatalf("Allow = %q, want %q", recorder.Header().Get("Allow"), test.wantAllowed)
			}
		})
	}
}

func TestRunnerBoundaryLimitsBodyAndPreservesStructuredInput(t *testing.T) {
	handler := testHandler(testOperations(), 1)

	oversized := runnerRequest(
		http.MethodPost,
		"/run",
		"text/plain; charset=utf-8",
		strings.Repeat("x", maxRequestBodyBytes+1),
	)
	oversizedRecorder := httptest.NewRecorder()
	handler.ServeHTTP(oversizedRecorder, oversized)
	if oversizedRecorder.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("oversized status = %d, want %d", oversizedRecorder.Code, http.StatusRequestEntityTooLarge)
	}

	chunked := runnerRequest(
		http.MethodPost,
		"/run",
		"text/plain; charset=utf-8",
		strings.Repeat("x", maxRequestBodyBytes+1),
	)
	chunked.ContentLength = -1
	chunked.TransferEncoding = []string{"chunked"}
	chunkedRecorder := httptest.NewRecorder()
	handler.ServeHTTP(chunkedRecorder, chunked)
	if chunkedRecorder.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("chunked status = %d, want %d", chunkedRecorder.Code, http.StatusRequestEntityTooLarge)
	}

	valid := runnerRequest(
		http.MethodPost,
		"/run",
		"application/json; charset=UTF-8",
		`{"code":"main() {}","stdin":"one\n"}`,
	)
	validRecorder := httptest.NewRecorder()
	handler.ServeHTTP(validRecorder, valid)
	if validRecorder.Code != http.StatusOK {
		t.Fatalf("valid status = %d, want %d; body: %s", validRecorder.Code, http.StatusOK, validRecorder.Body.String())
	}
	var payload runMessage
	if err := json.Unmarshal(validRecorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode valid response: %v", err)
	}
	if payload.CompilerOutput != "main() {}" ||
		payload.BinStdout != "one\n" ||
		payload.BinStderr != "runtime diagnostic" {
		t.Fatalf("unexpected structured input projection: %#v", payload)
	}
}

func TestRunnerReturnsNon2xxForInfrastructureFailures(t *testing.T) {
	tests := []struct {
		name       string
		path       string
		operations runnerOperations
	}{
		{
			name: "compile infrastructure failure",
			path: "/run",
			operations: runnerOperations{
				compileAndRun: func(context.Context, string, string) (runMessage, error) {
					return runMessage{}, infrastructureError(
						"create compile request directory",
						errors.New("storage unavailable"),
					)
				},
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			testHandler(test.operations, 1).ServeHTTP(
				recorder,
				runnerRequest(http.MethodPost, test.path, "text/plain", "main() {}"),
			)
			if recorder.Code != http.StatusServiceUnavailable {
				t.Fatalf("status = %d, want %d; body=%s", recorder.Code, http.StatusServiceUnavailable, recorder.Body.String())
			}
			payload := responseError(t, recorder)
			if payload["code"] != "runner_infrastructure_failure" {
				t.Fatalf("infrastructure error code = %q", payload["code"])
			}
			if strings.Contains(recorder.Body.String(), "storage unavailable") {
				t.Fatalf("internal infrastructure detail leaked: %s", recorder.Body.String())
			}
		})
	}
}

func TestRunnerSerializesRequiredOutOfBandTruncationFlags(t *testing.T) {
	binCode := 0
	operations := testOperations()
	operations.compileAndRun = func(context.Context, string, string) (runMessage, error) {
		return runMessage{
			Phase:                   runPhaseRun,
			CompilerOutput:          "compiler",
			CompilerOutputTruncated: true,
			CompilerCode:            0,
			BinStdout:               "stdout",
			BinStdoutTruncated:      true,
			BinStderr:               "stderr",
			BinStderrTruncated:      true,
			BinCode:                 &binCode,
		}, nil
	}

	for _, test := range []struct {
		path   string
		fields []string
	}{
		{
			path: "/run",
			fields: []string{
				"compiler_output_truncated",
				"bin_stdout_truncated",
				"bin_stderr_truncated",
			},
		},
	} {
		recorder := httptest.NewRecorder()
		testHandler(operations, 1).ServeHTTP(
			recorder,
			runnerRequest(http.MethodPost, test.path, "text/plain", "main() {}"),
		)
		if recorder.Code != http.StatusOK {
			t.Fatalf("%s status = %d; body=%s", test.path, recorder.Code, recorder.Body.String())
		}
		var wire map[string]json.RawMessage
		if err := json.Unmarshal(recorder.Body.Bytes(), &wire); err != nil {
			t.Fatalf("decode %s response: %v", test.path, err)
		}
		for _, field := range test.fields {
			if raw, ok := wire[field]; !ok || string(raw) != "true" {
				t.Fatalf("%s %s = %s, want required true", test.path, field, raw)
			}
		}
		if strings.Contains(recorder.Body.String(), "output truncated") {
			t.Fatalf("%s response carries in-band truncation marker: %s", test.path, recorder.Body.String())
		}
	}
}

func TestRunnerPassesRequestContextToOperations(t *testing.T) {
	var received context.Context
	operations := testOperations()
	operations.compileAndRun = func(ctx context.Context, _, _ string) (runMessage, error) {
		received = ctx
		return runMessage{}, nil
	}
	handler := testHandler(operations, 1)
	request := runnerRequest(http.MethodPost, "/run", "text/plain", "main() {}")

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if received != request.Context() {
		t.Fatal("compile operation did not receive the request context")
	}
}

func TestRunnerConcurrencyBulkhead(t *testing.T) {
	entered := make(chan struct{})
	release := make(chan struct{})
	var calls atomic.Int32
	operations := testOperations()
	operations.compileAndRun = func(_ context.Context, _, _ string) (runMessage, error) {
		if calls.Add(1) == 1 {
			close(entered)
		}
		<-release
		return runMessage{}, nil
	}
	handler := testHandler(operations, 1)

	firstDone := make(chan *httptest.ResponseRecorder, 1)
	go func() {
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(
			recorder,
			runnerRequest(http.MethodPost, "/run", "text/plain", "main() {}"),
		)
		firstDone <- recorder
	}()
	<-entered

	overloaded := httptest.NewRecorder()
	handler.ServeHTTP(
		overloaded,
		runnerRequest(http.MethodPost, "/run", "text/plain", "main() {}"),
	)
	if overloaded.Code != http.StatusTooManyRequests {
		t.Fatalf("overloaded status = %d, want %d", overloaded.Code, http.StatusTooManyRequests)
	}
	if overloaded.Header().Get("Retry-After") != "1" {
		t.Fatalf("Retry-After = %q, want 1", overloaded.Header().Get("Retry-After"))
	}

	close(release)
	select {
	case recorder := <-firstDone:
		if recorder.Code != http.StatusOK {
			t.Fatalf("first request status = %d, want %d", recorder.Code, http.StatusOK)
		}
	case <-time.After(time.Second):
		t.Fatal("first request did not release its runner slot")
	}
	if calls.Load() != 1 {
		t.Fatalf("compile calls = %d, want 1", calls.Load())
	}
}

func TestHTTPServerHasResourceTimeouts(t *testing.T) {
	server := newHTTPServer("127.0.0.1:0", http.NewServeMux())
	if server.ReadHeaderTimeout != readHeaderTimeout ||
		server.ReadTimeout != readTimeout ||
		server.WriteTimeout != writeTimeout ||
		server.IdleTimeout != idleTimeout ||
		server.MaxHeaderBytes != maxHeaderBytes {
		t.Fatalf("server resource limits were not configured: %#v", server)
	}
}
