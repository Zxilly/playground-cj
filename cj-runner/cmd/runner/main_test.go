//go:build linux

package main

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
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
	handler := testHandler(operations)
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
			BinStderr:    "process start: unavailable",
			BinCode:      &binCode,
		}, nil
	}
	handler := testHandler(operations)
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

func TestModalProcessCommandRunsTheRequestedExecutableDirectly(t *testing.T) {
	executable := filepath.Join(t.TempDir(), "probe")
	if err := os.WriteFile(executable, []byte("#!/bin/sh\nexit 0\n"), 0o700); err != nil {
		t.Fatalf("write process executable: %v", err)
	}
	environment := []string{"PATH=/usr/bin:/bin", "LANG=C.UTF-8"}
	command, err := processCommand(context.Background(), processSpec{
		executable:       executable,
		arguments:        []string{"first", "second"},
		environment:      environment,
		workingDirectory: filepath.Dir(executable),
		timeout:          time.Second,
	})
	if err != nil {
		t.Fatalf("build Modal worker process command: %v", err)
	}
	if command.Path != executable {
		t.Fatalf("process path = %q, want %q", command.Path, executable)
	}
	if got, want := command.Args, []string{executable, "first", "second"}; !slices.Equal(got, want) {
		t.Fatalf("process args = %q, want %q", got, want)
	}
	if !slices.Equal(command.Env, environment) {
		t.Fatalf("process environment = %q, want %q", command.Env, environment)
	}
	if command.Dir != filepath.Dir(executable) {
		t.Fatalf("process directory = %q, want %q", command.Dir, filepath.Dir(executable))
	}
	if command.SysProcAttr == nil || !command.SysProcAttr.Setpgid {
		t.Fatal("process does not own a killable process group")
	}
	if command.Cancel == nil || command.WaitDelay != processWaitDelay {
		t.Fatalf("process cancellation is not bounded: cancel=%v waitDelay=%s", command.Cancel != nil, command.WaitDelay)
	}
}

func TestModalProcessPreservesLearnerExitAndSeparateOutput(t *testing.T) {
	requestDirectory := t.TempDir()
	probe := filepath.Join(requestDirectory, "probe")
	if err := os.WriteFile(
		probe,
		[]byte("#!/bin/sh\nprintf 'learner stdout\\n'\nprintf 'learner stderr\\n' >&2\nexit 7\n"),
		0o700,
	); err != nil {
		t.Fatalf("write learner probe: %v", err)
	}

	result, err := runProcess(context.Background(), processSpec{
		executable:       probe,
		environment:      runtimeEnvironment(requestDirectory),
		workingDirectory: requestDirectory,
		timeout:          time.Second,
	}, "run learner binary")
	if err != nil {
		t.Fatalf("run learner probe: %v", err)
	}
	if result.exitCode != 7 {
		t.Fatalf("learner exit code = %d, want 7", result.exitCode)
	}
	if result.stdout.content != "learner stdout\n" {
		t.Fatalf("learner stdout = %q", result.stdout.content)
	}
	if result.stderr.content != "learner stderr\n" {
		t.Fatalf("learner stderr = %q", result.stderr.content)
	}
}

func TestCompilerArgumentsStayInsideTheSingleRequestDirectory(t *testing.T) {
	requestDirectory := "/playground/run-test"
	arguments := compilerArguments(requestDirectory)
	if !containsExact(arguments, "--output-dir="+requestDirectory) {
		t.Fatalf("compiler output directory is not request-local: %q", arguments)
	}
	if !containsExact(arguments, requestDirectory) {
		t.Fatalf("compiler package path is not request-local: %q", arguments)
	}
	for _, argument := range arguments {
		if strings.Contains(argument, "/request") {
			t.Fatalf("compiler argument retained removed nested mount path: %q", argument)
		}
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

func testHandler(operations runnerOperations) http.Handler {
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

	t.Run("development and test modes have no local isolation fallback", func(t *testing.T) {
		for _, runtimeEnvironment := range []string{"development", "test"} {
			if _, err := loadRunnerConfig(map[string]string{
				"CJ_RUNNER_ENV": runtimeEnvironment,
			}); err == nil {
				t.Fatalf("%s runner started outside Modal", runtimeEnvironment)
			}
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

	t.Run("Modal single-use isolation is required", func(t *testing.T) {
		_, err := loadRunnerConfig(map[string]string{
			"CJ_RUNNER_ENV":              "production",
			"CJ_RUNNER_SHARED_TOKEN":     testSharedToken,
			"CJ_RUNNER_ISOLATION_DRIVER": "modal-single-use-container",
		})
		if err != nil {
			t.Fatalf("valid Modal network boundary was rejected: %v", err)
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

func TestRunnerBoundaryRejectsInvalidRequests(t *testing.T) {
	handler := testHandler(testOperations())

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
	handler := testHandler(testOperations())

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
			testHandler(test.operations).ServeHTTP(
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
		testHandler(operations).ServeHTTP(
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
	handler := testHandler(operations)
	request := runnerRequest(http.MethodPost, "/run", "text/plain", "main() {}")

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if received != request.Context() {
		t.Fatal("compile operation did not receive the request context")
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
