// cj-runner is the Cangjie compile/run process embedded in a single-use Modal
// container. Modal owns the request isolation and resource boundary; this
// process only validates input, invokes the compiler and learner executable,
// caps output, and enforces wall-clock deadlines.
// The endpoint is POST /run ({code,stdin} JSON or raw), returning the canonical
// RunMessage JSON shape. Formatting runs locally in the browser through WASM.
//
//go:build linux

package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
	"unicode/utf8"
)

type runReq struct {
	Code  string `json:"code"`
	Stdin string `json:"stdin"`
}

type runPhase string

const (
	runPhaseCompile runPhase = "compile"
	runPhaseRun     runPhase = "run"
)

type runMessage struct {
	Phase                   runPhase `json:"phase"`
	CompilerOutput          string   `json:"compiler_output"`
	CompilerOutputTruncated bool     `json:"compiler_output_truncated"`
	CompilerCode            int      `json:"compiler_code"`
	BinStdout               string   `json:"bin_stdout"`
	BinStdoutTruncated      bool     `json:"bin_stdout_truncated"`
	BinStderr               string   `json:"bin_stderr"`
	BinStderrTruncated      bool     `json:"bin_stderr_truncated"`
	BinCode                 *int     `json:"bin_code"`
}

const (
	compileTimeout        = 12 * time.Second
	runTimeout            = 8 * time.Second
	toolchainProbeTimeout = 5 * time.Second
	processWaitDelay      = time.Second

	// Classroom runner response schemas accept at most 1,000,000 UTF-8 bytes
	// per output field. This is deliberately decimal, not one mebibyte.
	maxSerializedOutputBytes = 1_000_000

	// Keep this in sync with MAX_RUNNER_REQUEST_BYTES in src/lib/runner-proxy.ts.
	// Both boundaries enforce it independently so a direct request cannot bypass
	// the Next.js gateway's memory bound.
	maxRequestBodyBytes = 256 * 1024
	minSharedTokenBytes = 32
	maxSharedTokenBytes = 512

	readHeaderTimeout = 5 * time.Second
	readTimeout       = 7 * time.Second
	writeTimeout      = 24 * time.Second
	idleTimeout       = 30 * time.Second
	maxHeaderBytes    = 16 * 1024
)

const cangjieLibs = "/cangjie/runtime/lib/linux_x86_64_cjnative:/cangjie/tools/lib:/linux_x86_64_cjnative/dynamic/stdx"
const toolchainLockHeader = "X-Playground-Cangjie-Toolchain-Lock-Sha256"
const toolchainMismatchHeader = "X-Playground-Cangjie-Toolchain-Status"

const (
	cangjieCompilerPath        = "/cangjie/bin/cjc"
	cangjieToolchainLockPath   = "/usr/share/playground-cj/cangjie-toolchain.lock.json"
	cangjieToolchainMarkerPath = "/cangjie/.playground-cj-toolchain-lock.sha256"
)

type runnerConfig struct {
	sharedToken         string
	toolchainLockSha256 string
}

type cangjieToolchainLock struct {
	SchemaVersion int    `json:"schemaVersion"`
	Release       string `json:"release"`
	Compiler      struct {
		Name             string `json:"name"`
		Version          string `json:"version"`
		Backend          string `json:"backend"`
		Target           string `json:"target"`
		ExecutableSHA256 string `json:"executableSha256"`
	} `json:"compiler"`
	SDK struct {
		Platform string `json:"platform"`
		URL      string `json:"url"`
		SHA256   string `json:"sha256"`
	} `json:"sdk"`
	Stdx struct {
		Version     string `json:"version"`
		URL         string `json:"url"`
		ReleasePage string `json:"releasePage"`
		SHA256      string `json:"sha256"`
	} `json:"stdx"`
}

type runnerOperations struct {
	compileAndRun func(context.Context, string, string) (runMessage, error)
}

type runnerServer struct {
	config     runnerConfig
	operations runnerOperations
}

type outputChannel struct {
	content   string
	truncated bool
}

type processSpec struct {
	executable              string
	arguments               []string
	environment             []string
	workingDirectory        string
	timeout                 time.Duration
	timeoutIsInfrastructure bool
	stdin                   string
}

type processResult struct {
	stdout   outputChannel
	stderr   outputChannel
	exitCode int
	timedOut bool
}

type runnerInfrastructureError struct {
	operation string
	cause     error
}

func (e *runnerInfrastructureError) Error() string {
	return e.operation + ": " + e.cause.Error()
}

func (e *runnerInfrastructureError) Unwrap() error {
	return e.cause
}

func infrastructureError(operation string, cause error) error {
	return &runnerInfrastructureError{operation: operation, cause: cause}
}

// cappedBuffer keeps at most cap raw bytes then drops the rest, so a print-bomb
// cannot OOM the runner. Truncation is protocol metadata, never in-band text.
type cappedBuffer struct {
	mu        sync.Mutex
	buf       bytes.Buffer
	cap       int
	truncated bool
}

func (c *cappedBuffer) Write(p []byte) (int, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

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

func (c *cappedBuffer) Len() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.buf.Len()
}

func (c *cappedBuffer) Result() outputChannel {
	c.mu.Lock()
	maxBytes := c.cap
	truncated := c.truncated
	rawOutput := c.buf.String()
	c.mu.Unlock()

	if maxBytes < 0 {
		maxBytes = 0
	}

	validOutput := strings.ToValidUTF8(rawOutput, "\uFFFD")
	if len(validOutput) > maxBytes {
		truncated = true
		validOutput = validUTF8Within(validOutput, maxBytes)
	}
	return outputChannel{content: validOutput, truncated: truncated}
}

func validUTF8Within(value string, maxBytes int) string {
	if maxBytes <= 0 {
		return ""
	}
	valid := strings.ToValidUTF8(value, "\uFFFD")
	if len(valid) <= maxBytes {
		return valid
	}
	end := maxBytes
	for end > 0 && !utf8.ValidString(valid[:end]) {
		end--
	}
	return valid[:end]
}

func trustedToolEnvironment(requestDirectory string) []string {
	return []string{
		"CANGJIE_HOME=/cangjie",
		"PATH=/cangjie/bin:/cangjie/tools/bin:/usr/bin:/bin",
		"LD_LIBRARY_PATH=" + cangjieLibs,
		"HOME=" + requestDirectory,
		"TMPDIR=" + requestDirectory,
		"LANG=C.UTF-8",
		"LC_ALL=C.UTF-8",
	}
}

func compileAndRun(ctx context.Context, code, stdin string) (runMessage, error) {
	msg := runMessage{Phase: runPhaseCompile}

	srcDir, err := os.MkdirTemp("/playground", "run-")
	if err != nil {
		return msg, infrastructureError("create compile request directory", err)
	}
	defer os.RemoveAll(srcDir)

	sourcePath := filepath.Join(srcDir, "main.cj")
	if err := os.WriteFile(sourcePath, []byte(code), 0o600); err != nil {
		return msg, infrastructureError("write compile source", err)
	}

	compileResult, err := runProcess(ctx, processSpec{
		executable:              cangjieCompilerPath,
		arguments:               compilerArguments(srcDir),
		environment:             trustedToolEnvironment(srcDir),
		workingDirectory:        srcDir,
		timeout:                 compileTimeout,
		timeoutIsInfrastructure: true,
	}, "compile")
	if err != nil {
		return msg, err
	}
	compilerOutput := combineOutputChannels(compileResult.stdout, compileResult.stderr)
	msg.CompilerOutput = compilerOutput.content
	msg.CompilerOutputTruncated = compilerOutput.truncated
	msg.CompilerCode = compileResult.exitCode
	if compileResult.exitCode != 0 {
		return msg, nil
	}

	msg.Phase = runPhaseRun
	runResult, err := runProcess(ctx, processSpec{
		executable:       filepath.Join(srcDir, "main"),
		environment:      runtimeEnvironment(srcDir),
		workingDirectory: srcDir,
		timeout:          runTimeout,
		stdin:            stdin,
	}, "run learner binary")
	if err != nil {
		return msg, err
	}
	msg.BinStdout = runResult.stdout.content
	msg.BinStdoutTruncated = runResult.stdout.truncated
	msg.BinStderr = runResult.stderr.content
	msg.BinStderrTruncated = runResult.stderr.truncated
	msg.BinCode = &runResult.exitCode
	return msg, nil
}

func compilerArguments(requestDirectory string) []string {
	return []string{
		"--import-path=/linux_x86_64_cjnative/dynamic",
		"--no-sub-pkg",
		"--output-dir=" + requestDirectory,
		"-L", "/linux_x86_64_cjnative/dynamic/stdx",
		"-ldl", "-V", "-j1", "-p", requestDirectory, "--output-type=exe", "-o=main",
	}
}

func runProcess(
	parent context.Context,
	spec processSpec,
	operation string,
) (processResult, error) {
	ctx, cancel := context.WithTimeout(parent, spec.timeout)
	defer cancel()

	cmd, err := processCommand(ctx, spec)
	if err != nil {
		return processResult{}, infrastructureError(operation+" command", err)
	}

	stdout := &cappedBuffer{cap: maxSerializedOutputBytes}
	stderr := &cappedBuffer{cap: maxSerializedOutputBytes}
	cmd.Stdout, cmd.Stderr = stdout, stderr
	if spec.stdin != "" {
		cmd.Stdin = strings.NewReader(spec.stdin)
	}

	if err := cmd.Start(); err != nil {
		return processResult{}, infrastructureError(operation+" start", err)
	}
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()

	select {
	case <-ctx.Done():
		_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		<-done
		if parent.Err() != nil {
			return processResult{}, infrastructureError(operation, parent.Err())
		}
		if spec.timeoutIsInfrastructure {
			return processResult{}, infrastructureError(operation, context.DeadlineExceeded)
		}
		_, _ = stderr.Write([]byte("\n[killed: exceeded " + spec.timeout.String() + " wall clock]"))
		return processResult{
			stdout:   stdout.Result(),
			stderr:   stderr.Result(),
			exitCode: -1,
			timedOut: true,
		}, nil
	case waitErr := <-done:
		if cmd.ProcessState == nil {
			return processResult{}, infrastructureError(
				operation,
				errors.New("process exited without status"),
			)
		}
		if errors.Is(waitErr, exec.ErrWaitDelay) {
			return processResult{}, infrastructureError(
				operation,
				errors.New("process output pipes did not close within wait deadline"),
			)
		}
		return processResult{
			stdout:   stdout.Result(),
			stderr:   stderr.Result(),
			exitCode: cmd.ProcessState.ExitCode(),
		}, nil
	}
}

func processCommand(ctx context.Context, spec processSpec) (*exec.Cmd, error) {
	if !filepath.IsAbs(spec.executable) {
		return nil, errors.New("process executable must be absolute")
	}
	if !filepath.IsAbs(spec.workingDirectory) {
		return nil, errors.New("process working directory must be absolute")
	}
	executableInfo, err := os.Lstat(spec.executable)
	if err != nil {
		return nil, fmt.Errorf("inspect process executable: %w", err)
	}
	if !executableInfo.Mode().IsRegular() || executableInfo.Mode()&0o111 == 0 {
		return nil, errors.New("process executable must be a regular executable file")
	}
	for _, entry := range spec.environment {
		name, _, ok := strings.Cut(entry, "=")
		if !ok || name == "" {
			return nil, fmt.Errorf("invalid process environment entry %q", entry)
		}
	}
	cmd := exec.CommandContext(ctx, spec.executable, spec.arguments...)
	cmd.Env = spec.environment
	cmd.Dir = spec.workingDirectory
	configureCommandLifecycle(cmd)
	return cmd, nil
}

func configureCommandLifecycle(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.WaitDelay = processWaitDelay
	cmd.Cancel = func() error {
		if cmd.Process == nil {
			return os.ErrProcessDone
		}
		err := syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		if errors.Is(err, syscall.ESRCH) {
			return os.ErrProcessDone
		}
		return err
	}
}

func runtimeEnvironment(requestDirectory string) []string {
	return []string{
		"CANGJIE_HOME=/cangjie",
		"PATH=/usr/bin:/bin",
		"LD_LIBRARY_PATH=" + cangjieLibs,
		"HOME=" + requestDirectory,
		"TMPDIR=" + requestDirectory,
		"LANG=C.UTF-8",
		"LC_ALL=C.UTF-8",
	}
}

func combineOutputChannels(channels ...outputChannel) outputChannel {
	var builder strings.Builder
	builder.Grow(maxSerializedOutputBytes)
	truncated := false
	for _, channel := range channels {
		if channel.truncated {
			truncated = true
		}
		remaining := maxSerializedOutputBytes - builder.Len()
		if remaining <= 0 {
			if channel.content != "" {
				truncated = true
			}
			continue
		}
		content := validUTF8Within(channel.content, remaining)
		if len(content) != len(channel.content) {
			truncated = true
		}
		builder.WriteString(content)
	}
	return outputChannel{content: builder.String(), truncated: truncated}
}

func decodeStrictJSON(data []byte, value any) error {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		return err
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		if err == nil {
			return errors.New("JSON value has trailing data")
		}
		return err
	}
	return nil
}

func isLowerHexSHA256(value string) bool {
	if len(value) != sha256.Size*2 {
		return false
	}
	for _, character := range value {
		if (character < '0' || character > '9') &&
			(character < 'a' || character > 'f') {
			return false
		}
	}
	return true
}

func isReleaseIdentifier(value string) bool {
	if value == "" {
		return false
	}
	for index, character := range value {
		alphanumeric := character >= '0' && character <= '9' ||
			character >= 'A' && character <= 'Z' ||
			character >= 'a' && character <= 'z'
		if !alphanumeric && (index == 0 ||
			(character != '.' && character != '+' && character != '-')) {
			return false
		}
	}
	return true
}

func validateSDKURL(rawURL, release string) error {
	prefix := "https://cangjie-lang.cn/v1/files/auth/downLoad" +
		"?nsId=142267&fileName=cangjie-sdk-linux-x64-" + release +
		".tar.gz&objectKey="
	if !strings.HasPrefix(rawURL, prefix) {
		return errors.New("SDK URL must use the exact official Cangjie download endpoint")
	}
	objectKey := strings.TrimPrefix(rawURL, prefix)
	if objectKey == "" {
		return errors.New("SDK URL has an empty official-download object key")
	}
	for _, character := range objectKey {
		if !((character >= '0' && character <= '9') ||
			(character >= 'A' && character <= 'Z') ||
			(character >= 'a' && character <= 'z')) {
			return errors.New("SDK URL has an invalid official-download object key")
		}
	}
	return nil
}

func validateCangjieToolchainLock(lock cangjieToolchainLock) error {
	if lock.SchemaVersion != 1 {
		return errors.New("toolchain lock schemaVersion must be 1")
	}
	if !isReleaseIdentifier(lock.Release) ||
		lock.Compiler.Version != lock.Release ||
		lock.Compiler.Name != "cjc" ||
		lock.Compiler.Backend != "cjnative" ||
		lock.Compiler.Target != "x86_64-unknown-linux-gnu" ||
		!isLowerHexSHA256(lock.Compiler.ExecutableSHA256) {
		return errors.New("toolchain lock compiler identity is invalid")
	}
	if lock.SDK.Platform != "linux-x64" ||
		!isLowerHexSHA256(lock.SDK.SHA256) {
		return errors.New("toolchain lock SDK identity is invalid")
	}
	if err := validateSDKURL(lock.SDK.URL, lock.Release); err != nil {
		return err
	}
	if !isReleaseIdentifier(lock.Stdx.Version) ||
		!isLowerHexSHA256(lock.Stdx.SHA256) ||
		lock.Stdx.ReleasePage !=
			"https://gitcode.com/Cangjie/cangjie_stdx/releases/tag/v"+lock.Stdx.Version ||
		lock.Stdx.URL !=
			"https://gitcode.com/Cangjie/cangjie_stdx/releases/download/v"+
				lock.Stdx.Version+"/cangjie-stdx-linux-x64-"+lock.Stdx.Version+".zip" {
		return errors.New("toolchain lock stdx identity is invalid")
	}
	return nil
}

func canonicalJSONSHA256(data []byte) (string, error) {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	var value any
	if err := decoder.Decode(&value); err != nil {
		return "", err
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		if err == nil {
			return "", errors.New("JSON value has trailing data")
		}
		return "", err
	}

	var canonical bytes.Buffer
	encoder := json.NewEncoder(&canonical)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return "", err
	}
	canonicalBytes := bytes.TrimSuffix(canonical.Bytes(), []byte{'\n'})
	digest := sha256.Sum256(canonicalBytes)
	return fmt.Sprintf("%x", digest), nil
}

func readRegularFile(path string) ([]byte, error) {
	info, err := os.Lstat(path)
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() {
		return nil, errors.New("path must be a regular, non-symlink file")
	}
	return os.ReadFile(path)
}

func hashRegularExecutable(path string) (string, error) {
	info, err := os.Lstat(path)
	if err != nil {
		return "", err
	}
	if !info.Mode().IsRegular() || info.Mode()&0o111 == 0 {
		return "", errors.New("compiler path must be a regular executable")
	}
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	digest := sha256.New()
	if _, err := io.Copy(digest, file); err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", digest.Sum(nil)), nil
}

func verifyInstalledCangjieToolchain(
	ctx context.Context,
	lockPath string,
	compilerPath string,
	markerPath string,
) (string, error) {
	lockBytes, err := readRegularFile(lockPath)
	if err != nil {
		return "", fmt.Errorf("read toolchain lock: %w", err)
	}
	var lock cangjieToolchainLock
	if err := decodeStrictJSON(lockBytes, &lock); err != nil {
		return "", fmt.Errorf("parse toolchain lock: %w", err)
	}
	if err := validateCangjieToolchainLock(lock); err != nil {
		return "", err
	}
	lockSHA256, err := canonicalJSONSHA256(lockBytes)
	if err != nil {
		return "", fmt.Errorf("canonicalize toolchain lock: %w", err)
	}
	markerBytes, err := readRegularFile(markerPath)
	if err != nil {
		return "", fmt.Errorf("read installed toolchain marker: %w", err)
	}
	if string(markerBytes) != lockSHA256+"\n" {
		return "", errors.New("installed toolchain marker does not match bundled lock")
	}

	compilerSHA256, err := hashRegularExecutable(compilerPath)
	if err != nil {
		return "", fmt.Errorf("hash installed compiler: %w", err)
	}
	if compilerSHA256 != lock.Compiler.ExecutableSHA256 {
		return "", errors.New("installed compiler bytes do not match bundled lock")
	}

	probeContext, cancel := context.WithTimeout(ctx, toolchainProbeTimeout)
	defer cancel()
	command := exec.CommandContext(probeContext, compilerPath, "--version")
	command.Env = trustedToolEnvironment("/tmp")
	output, err := command.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("query installed compiler identity: %w", err)
	}
	lines := strings.Split(strings.TrimSuffix(string(output), "\n"), "\n")
	if len(lines) != 2 ||
		lines[0] !=
			"Cangjie Compiler: "+lock.Compiler.Version+" ("+lock.Compiler.Backend+")" ||
		lines[1] != "Target: "+lock.Compiler.Target {
		return "", errors.New("installed compiler identity does not match bundled lock")
	}
	compilerSHA256AfterProbe, err := hashRegularExecutable(compilerPath)
	if err != nil {
		return "", fmt.Errorf("rehash installed compiler: %w", err)
	}
	if compilerSHA256AfterProbe != compilerSHA256 {
		return "", errors.New("installed compiler changed during identity verification")
	}
	return lockSHA256, nil
}

func loadRunnerConfig(environment map[string]string) (runnerConfig, error) {
	runtimeEnvironment := strings.ToLower(strings.TrimSpace(environment["CJ_RUNNER_ENV"]))
	if runtimeEnvironment == "" {
		// The runner is a separately deployed internet-facing service. Secure
		// defaults matter more than a zero-config local invocation.
		runtimeEnvironment = "production"
	}
	if runtimeEnvironment != "production" {
		return runnerConfig{}, errors.New("CJ_RUNNER_ENV must be production")
	}

	token := environment["CJ_RUNNER_SHARED_TOKEN"]
	if token != strings.TrimSpace(token) {
		return runnerConfig{}, errors.New("CJ_RUNNER_SHARED_TOKEN must not contain surrounding whitespace")
	}
	if token != "" && (len(token) < minSharedTokenBytes || len(token) > maxSharedTokenBytes) {
		return runnerConfig{}, fmt.Errorf(
			"CJ_RUNNER_SHARED_TOKEN must contain %d-%d bytes",
			minSharedTokenBytes,
			maxSharedTokenBytes,
		)
	}
	if strings.IndexFunc(token, func(r rune) bool { return r < 0x21 || r > 0x7e }) != -1 {
		return runnerConfig{}, errors.New("CJ_RUNNER_SHARED_TOKEN must contain only printable ASCII bytes without spaces")
	}
	if token == "" {
		return runnerConfig{}, errors.New("CJ_RUNNER_SHARED_TOKEN must be set")
	}

	isolationDriver := strings.TrimSpace(environment["CJ_RUNNER_ISOLATION_DRIVER"])
	if isolationDriver != "modal-single-use-container" {
		return runnerConfig{}, errors.New(
			"production requires CJ_RUNNER_ISOLATION_DRIVER=modal-single-use-container",
		)
	}

	return runnerConfig{
		sharedToken: token,
	}, nil
}

func environment() map[string]string {
	return map[string]string{
		"CJ_RUNNER_ENV":              os.Getenv("CJ_RUNNER_ENV"),
		"CJ_RUNNER_SHARED_TOKEN":     os.Getenv("CJ_RUNNER_SHARED_TOKEN"),
		"CJ_RUNNER_ISOLATION_DRIVER": os.Getenv("CJ_RUNNER_ISOLATION_DRIVER"),
	}
}

func newRunnerHandler(config runnerConfig, operations runnerOperations) http.Handler {
	server := &runnerServer{
		config:     config,
		operations: operations,
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/run", server.handleRun)
	mux.HandleFunc("/", handleHealth)
	return mux
}

func (s *runnerServer) authenticate(w http.ResponseWriter, r *http.Request) bool {
	values := r.Header.Values("Authorization")
	if len(values) != 1 {
		w.Header().Set("WWW-Authenticate", "Bearer")
		writeError(w, http.StatusUnauthorized, "unauthorized", "Authentication is required.")
		return false
	}
	provided := values[0]
	expected := "Bearer " + s.config.sharedToken
	providedDigest := sha256.Sum256([]byte(provided))
	expectedDigest := sha256.Sum256([]byte(expected))
	if subtle.ConstantTimeCompare(providedDigest[:], expectedDigest[:]) != 1 {
		w.Header().Set("WWW-Authenticate", "Bearer")
		writeError(w, http.StatusUnauthorized, "unauthorized", "Authentication is required.")
		return false
	}
	return true
}

func (s *runnerServer) verifyToolchainExpectation(
	w http.ResponseWriter,
	r *http.Request,
) bool {
	values := r.Header.Values(toolchainLockHeader)
	if len(values) != 1 || !isLowerHexSHA256(values[0]) {
		w.Header().Set(toolchainMismatchHeader, "mismatch")
		writeError(
			w,
			http.StatusServiceUnavailable,
			"runner_toolchain_mismatch",
			"Runner toolchain does not match the requesting deployment.",
		)
		return false
	}
	providedDigest := sha256.Sum256([]byte(values[0]))
	expectedDigest := sha256.Sum256([]byte(s.config.toolchainLockSha256))
	if subtle.ConstantTimeCompare(providedDigest[:], expectedDigest[:]) != 1 {
		w.Header().Set(toolchainMismatchHeader, "mismatch")
		writeError(
			w,
			http.StatusServiceUnavailable,
			"runner_toolchain_mismatch",
			"Runner toolchain does not match the requesting deployment.",
		)
		return false
	}
	return true
}

func requirePost(w http.ResponseWriter, r *http.Request) bool {
	if r.Method == http.MethodPost {
		return true
	}
	w.Header().Set("Allow", http.MethodPost)
	writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST requests are supported.")
	return false
}

func parseRequestMediaType(r *http.Request, allowJSON bool) (string, bool) {
	value := r.Header.Get("Content-Type")
	if value == "" {
		return "", false
	}
	mediaType, parameters, err := mime.ParseMediaType(value)
	if err != nil {
		return "", false
	}
	mediaType = strings.ToLower(mediaType)
	if mediaType != "text/plain" && (!allowJSON || mediaType != "application/json") {
		return "", false
	}
	for name, value := range parameters {
		if strings.ToLower(name) != "charset" {
			return "", false
		}
		charset := strings.ToLower(value)
		if charset != "utf-8" && charset != "utf8" {
			return "", false
		}
	}
	return mediaType, true
}

func readBoundedBody(w http.ResponseWriter, r *http.Request) ([]byte, error) {
	if r.ContentLength > maxRequestBodyBytes {
		return nil, &http.MaxBytesError{Limit: maxRequestBodyBytes}
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)
	defer r.Body.Close()
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, err
	}
	if !utf8.Valid(body) {
		return nil, errors.New("request body is not valid UTF-8")
	}
	return body, nil
}

func writeBodyReadError(w http.ResponseWriter, r *http.Request, err error) {
	var tooLarge *http.MaxBytesError
	switch {
	case errors.As(err, &tooLarge):
		writeError(
			w,
			http.StatusRequestEntityTooLarge,
			"request_body_too_large",
			fmt.Sprintf("Request body exceeds the %d-byte limit.", maxRequestBodyBytes),
		)
	case r.Context().Err() != nil:
		writeError(w, 499, "request_cancelled", "Request was cancelled.")
	default:
		writeError(w, http.StatusBadRequest, "invalid_request_body", "Request body must be valid UTF-8.")
	}
}

func parseRunRequest(body []byte, mediaType string) (runReq, error) {
	if mediaType == "text/plain" {
		return runReq{Code: string(body)}, nil
	}

	var wire map[string]json.RawMessage
	decoder := json.NewDecoder(bytes.NewReader(body))
	if err := decoder.Decode(&wire); err != nil {
		return runReq{}, err
	}
	if wire == nil {
		return runReq{}, errors.New("request body must be a JSON object")
	}
	for key := range wire {
		if key != "code" && key != "stdin" {
			return runReq{}, fmt.Errorf("unknown field %q", key)
		}
	}
	rawCode, ok := wire["code"]
	if !ok || bytes.Equal(bytes.TrimSpace(rawCode), []byte("null")) {
		return runReq{}, errors.New("code is required")
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		return runReq{}, errors.New("request body must contain exactly one JSON object")
	}
	var in runReq
	if err := json.Unmarshal(rawCode, &in.Code); err != nil {
		return runReq{}, errors.New("code must be a string")
	}
	if rawStdin, ok := wire["stdin"]; ok {
		if bytes.Equal(bytes.TrimSpace(rawStdin), []byte("null")) {
			return runReq{}, errors.New("stdin must be a string")
		}
		if err := json.Unmarshal(rawStdin, &in.Stdin); err != nil {
			return runReq{}, errors.New("stdin must be a string")
		}
	}
	return in, nil
}

func (s *runnerServer) handleRun(w http.ResponseWriter, r *http.Request) {
	if !requirePost(w, r) ||
		!s.authenticate(w, r) ||
		!s.verifyToolchainExpectation(w, r) {
		return
	}
	mediaType, ok := parseRequestMediaType(r, true)
	if !ok {
		writeError(
			w,
			http.StatusUnsupportedMediaType,
			"unsupported_media_type",
			"Content-Type must be text/plain or application/json with UTF-8 content.",
		)
		return
	}
	body, err := readBoundedBody(w, r)
	if err != nil {
		writeBodyReadError(w, r, err)
		return
	}
	in, err := parseRunRequest(body, mediaType)
	if err != nil {
		writeError(
			w,
			http.StatusBadRequest,
			"invalid_json_body",
			`JSON body must contain only a string "code" field and an optional string "stdin" field.`,
		)
		return
	}
	message, err := s.operations.compileAndRun(r.Context(), in.Code, in.Stdin)
	if err != nil {
		writeOperationError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, message)
}

func writeOperationError(w http.ResponseWriter, r *http.Request, err error) {
	var infrastructureFailure *runnerInfrastructureError
	if !errors.As(err, &infrastructureFailure) {
		writeError(
			w,
			http.StatusInternalServerError,
			"runner_internal_error",
			"Runner operation failed.",
		)
		return
	}
	if r.Context().Err() != nil {
		writeError(w, 499, "request_cancelled", "Request was cancelled.")
		return
	}
	writeError(
		w,
		http.StatusServiceUnavailable,
		"runner_infrastructure_failure",
		"Runner infrastructure is temporarily unavailable.",
	)
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		writeError(w, http.StatusNotFound, "not_found", "Route not found.")
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET and HEAD requests are supported.")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	if r.Method != http.MethodHead {
		_, _ = w.Write([]byte("ok"))
	}
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{"code": code, "error": message})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func newHTTPServer(address string, handler http.Handler) *http.Server {
	return &http.Server{
		Addr:              address,
		Handler:           handler,
		ReadHeaderTimeout: readHeaderTimeout,
		ReadTimeout:       readTimeout,
		WriteTimeout:      writeTimeout,
		IdleTimeout:       idleTimeout,
		MaxHeaderBytes:    maxHeaderBytes,
	}
}

func runnerListenAddress(port string) string {
	return "127.0.0.1:" + port
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}
	config, err := loadRunnerConfig(environment())
	if err != nil {
		panic(err)
	}
	toolchainLockSHA256, err := verifyInstalledCangjieToolchain(
		context.Background(),
		cangjieToolchainLockPath,
		cangjieCompilerPath,
		cangjieToolchainMarkerPath,
	)
	if err != nil {
		panic("locked Cangjie toolchain unavailable: " + err.Error())
	}
	config.toolchainLockSha256 = toolchainLockSHA256
	handler := newRunnerHandler(config, runnerOperations{
		compileAndRun: compileAndRun,
	})
	server := newHTTPServer(runnerListenAddress(port), handler)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		panic(err)
	}
}
