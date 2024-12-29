package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"runtime"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"

	"github.com/playground-cj/server"
)

var (
	hostConfig = &container.HostConfig{
		AutoRemove: true,
		Resources: container.Resources{
			Memory:   512 * 1024 * 1024,
			NanoCPUs: 1_000_000_000,
		},
		SecurityOpt: []string{"no-new-privileges"},
	}

	dockerClient *client.Client
)

const defaultImage = "cangjie"

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
	)
	if err != nil {
		log.Fatalf("Failed to create docker client: %v", err)
	}
}

func runCmd(ctx context.Context, cmd string, payload []byte) ([]byte, error) {
	resp, err := dockerClient.ContainerCreate(ctx, &container.Config{
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

	attach, err := dockerClient.ContainerAttach(ctx, resp.ID, container.AttachOptions{
		Stream: true,
		Stdin:  true,
		Stdout: true,
	})
	if err != nil {
		return nil, err
	}

	if err := dockerClient.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return nil, fmt.Errorf("failed to start container: %w", err)
	}

	go func() {
		msg := server.ForwardMessage{
			Data: payload,
		}
		b, err := json.Marshal(msg)
		if err != nil {
			panic(err)
		}
		_, _ = attach.Conn.Write(b)
		_ = attach.CloseWrite()
	}()

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	_, err = stdcopy.StdCopy(&stdout, &stderr, attach.Reader)
	if err != nil {
		return nil, fmt.Errorf("failed to copy stdout: %w", err)
	}

	timeoutCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	statusCh, errCh := dockerClient.ContainerWait(timeoutCtx, resp.ID, container.WaitConditionNotRunning)
	select {
	case err := <-errCh:
		if err != nil {
			return nil, fmt.Errorf("failed to wait for container: %w", err)
		}
	case status := <-statusCh:
		if status.Error != nil {
			return nil, fmt.Errorf("container exited with error: %s", status.Error.Message)
		}

		if status.StatusCode != 0 {
			log.Printf("agent stderr: %s", stderr.String())
			return nil, fmt.Errorf("container exited with status code: %d", status.StatusCode)
		}

		return stdout.Bytes(), nil
	}

	panic("unreachable")
}
