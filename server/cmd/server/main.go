package main

import (
	"context"
	"io"
	"log"
	"net/http"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/gorilla/websocket"
)

const (
	defaultImage = "alpine:latest"
	socketPath   = "/var/run/docker.sock"
)

var (
	upgrader = websocket.Upgrader{
		EnableCompression: true,
	}

	// 容器运行限制
	containerConfig = &container.Config{
		Image:        defaultImage,
		Tty:          true,
		OpenStdin:    true,
		StdinOnce:    true,
		AttachStdin:  true,
		AttachStdout: true,
		AttachStderr: true,
	}

	hostConfig = &container.HostConfig{
		AutoRemove: true,
		Resources: container.Resources{
			Memory:   512 * 1024 * 1024,
			NanoCPUs: 1000000000,
		},
		SecurityOpt: []string{"no-new-privileges"},
	}
)

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Websocket upgrade failed: %v", err)
		return
	}
	defer ws.Close()

	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithHost("unix://"+socketPath))
	if err != nil {
		log.Printf("Failed to create docker client: %v", err)
		return
	}
	defer cli.Close()

	ctx := context.Background()

	resp, err := cli.ContainerCreate(ctx, containerConfig, hostConfig, nil, nil, "")
	if err != nil {
		log.Printf("Container creation failed: %v", err)
		return
	}

	if err := cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		log.Printf("Container start failed: %v", err)
		return
	}

	attach, err := cli.ContainerAttach(ctx, resp.ID, container.AttachOptions{
		Stream: true,
		Stdin:  true,
		Stdout: true,
		Stderr: true,
	})
	if err != nil {
		log.Printf("Container attach failed: %v", err)
		return
	}
	defer attach.Close()

	// 处理输入输出
	go func() {
		for {
			_, message, err := ws.ReadMessage()
			if err != nil {
				return
			}
			if _, err := attach.Conn.Write(message); err != nil {
				return
			}
		}
	}()

	go func() {
		for {
			buf := make([]byte, 1024)
			n, err := attach.Reader.Read(buf)
			if err != nil {
				if err != io.EOF {
					log.Printf("Read error: %v", err)
				}
				return
			}
			if err := ws.WriteMessage(websocket.TextMessage, buf[:n]); err != nil {
				return
			}
		}
	}()

	<-ctx.Done()

	timeout := 1
	if err := cli.ContainerStop(context.Background(), resp.ID, container.StopOptions{
		Timeout: &timeout,
	}); err != nil {
		log.Printf("Container stop failed: %v", err)
	}
}

func main() {
	http.HandleFunc("/ws", handleWebSocket)
	log.Fatal(http.ListenAndServe(":8080", nil))
}
