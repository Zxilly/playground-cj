package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"runtime"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"

	"github.com/Zxilly/playground-cj/server"
)

const (
	defaultImage     = "cangjie"
	execTimeout      = 10 * time.Second
	cleanupTimeout   = 5 * time.Second
	killTimeout      = 3 * time.Second
	waitTimeout      = 5 * time.Second
	stdoutLimitBytes = 1 << 20 // 1 MiB
	stderrLimitBytes = 1 << 20
)

var pidsLimit = int64(256)

var (
	hostConfig = &container.HostConfig{
		AutoRemove: true,
		Resources: container.Resources{
			Memory:    512 * 1024 * 1024,
			NanoCPUs:  1_000_000_000,
			PidsLimit: &pidsLimit,
		},
		SecurityOpt: []string{"no-new-privileges"},
		NetworkMode: "none",
	}

	dockerClient *client.Client
)

func init() {
	var err error

	var host string
	if runtime.GOOS == "windows" {
		host = "npipe:////./pipe/docker_engine"
	} else {
		host = "unix:///var/run/docker.sock"
	}

	dockerClient, err = client.NewClientWithOpts(
		client.WithHost(host),
		client.WithHostFromEnv(),
		client.WithAPIVersionNegotiation(),
	)
	if err != nil {
		log.Fatalf("Failed to create docker client: %v", err)
	}
}

// cappedBuffer writes up to cap bytes then silently drops further input, so
// stdcopy keeps draining the pipe without OOMing the host. When truncated,
// Bytes() appends a marker so callers can tell.
type cappedBuffer struct {
	buf       bytes.Buffer
	cap       int
	truncated bool
}

func (c *cappedBuffer) Write(p []byte) (int, error) {
	remaining := c.cap - c.buf.Len()
	if remaining <= 0 {
		c.truncated = true
		return len(p), nil
	}
	if len(p) > remaining {
		c.buf.Write(p[:remaining])
		c.truncated = true
		return len(p), nil
	}
	return c.buf.Write(p)
}

func (c *cappedBuffer) Bytes() []byte {
	if !c.truncated {
		return c.buf.Bytes()
	}
	return append(c.buf.Bytes(), []byte("\n[output truncated]")...)
}

func (c *cappedBuffer) String() string {
	return string(c.Bytes())
}

func runCmd(ctx context.Context, cmd string, payload []byte) ([]byte, error) {
	execCtx, cancel := context.WithTimeout(ctx, execTimeout)
	defer cancel()

	resp, err := dockerClient.ContainerCreate(execCtx, &container.Config{
		Image:        defaultImage,
		OpenStdin:    true,
		StdinOnce:    true,
		AttachStdin:  true,
		AttachStdout: true,
		Cmd:          []string{cmd},
	}, hostConfig, nil, nil, "")
	if err != nil {
		return nil, fmt.Errorf("failed to create container: %w", err)
	}

	// AutoRemove only fires on stop; force-remove covers every other state
	// (never-started, running, zombie exit status) and runs on any return path.
	defer func() {
		rmCtx, rmCancel := context.WithTimeout(context.Background(), cleanupTimeout)
		defer rmCancel()
		if err := dockerClient.ContainerRemove(rmCtx, resp.ID, container.RemoveOptions{Force: true}); err != nil && !client.IsErrNotFound(err) {
			log.Printf("container remove %s: %v", resp.ID, err)
		}
	}()

	attach, err := dockerClient.ContainerAttach(execCtx, resp.ID, container.AttachOptions{
		Stream: true,
		Stdin:  true,
		Stdout: true,
	})
	if err != nil {
		return nil, fmt.Errorf("attach container: %w", err)
	}
	defer attach.Close()

	if err := dockerClient.ContainerStart(execCtx, resp.ID, container.StartOptions{}); err != nil {
		return nil, fmt.Errorf("start container: %w", err)
	}

	// Watchdog: when execCtx is cancelled (timeout or upstream disconnect)
	// signal-kill the container so stdcopy unblocks and we can collect output.
	// stdcopy itself doesn't honor ctx, which is why we need this.
	watchdogDone := make(chan struct{})
	defer close(watchdogDone)
	go func() {
		select {
		case <-execCtx.Done():
			kctx, kcancel := context.WithTimeout(context.Background(), killTimeout)
			defer kcancel()
			if err := dockerClient.ContainerKill(kctx, resp.ID, "SIGKILL"); err != nil && !client.IsErrNotFound(err) {
				log.Printf("container kill %s: %v", resp.ID, err)
			}
		case <-watchdogDone:
		}
	}()

	payloadMsg, err := json.Marshal(server.ForwardMessage{Data: payload})
	if err != nil {
		return nil, fmt.Errorf("marshal payload: %w", err)
	}
	if _, err := attach.Conn.Write(payloadMsg); err != nil {
		return nil, fmt.Errorf("write payload: %w", err)
	}
	if err := attach.CloseWrite(); err != nil {
		log.Printf("close stdin for %s: %v", resp.ID, err)
	}

	stdout := &cappedBuffer{cap: stdoutLimitBytes}
	stderr := &cappedBuffer{cap: stderrLimitBytes}
	if _, err := stdcopy.StdCopy(stdout, stderr, attach.Reader); err != nil && !errors.Is(err, io.EOF) {
		log.Printf("stdcopy %s: %v", resp.ID, err)
	}

	if execCtx.Err() != nil {
		return nil, fmt.Errorf("execution timed out after %s", execTimeout)
	}

	statusCtx, statusCancel := context.WithTimeout(context.Background(), waitTimeout)
	defer statusCancel()

	statusCh, errCh := dockerClient.ContainerWait(statusCtx, resp.ID, container.WaitConditionNotRunning)
	select {
	case err := <-errCh:
		return nil, fmt.Errorf("wait container: %w", err)
	case status := <-statusCh:
		if status.Error != nil {
			return nil, fmt.Errorf("container error: %s", status.Error.Message)
		}
		if status.StatusCode != 0 {
			log.Printf("agent stderr (%s): %s", resp.ID, stderr.String())
			return nil, fmt.Errorf("container exited with status code: %d", status.StatusCode)
		}
		return stdout.Bytes(), nil
	}
}
