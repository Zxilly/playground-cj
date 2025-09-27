package main

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/pkg/stdcopy"
	"github.com/gorilla/websocket"
	"github.com/shirou/gopsutil/v3/mem"

	"github.com/Zxilly/playground-cj/server"
)

const (
	writeWait  = 10 * time.Second
	pongWait   = 10 * time.Second
	pingPeriod = (pongWait * 4) / 5

	minRequiredMemoryMB = 512
)

var (
	upgrader = websocket.Upgrader{
		EnableCompression: true,
		CheckOrigin: func(_ *http.Request) bool {
			return true
		},
	}

	// 确保资源检查的原子性
	resourceMutex sync.Mutex
)

func checkSystemResources() error {
	resourceMutex.Lock()
	defer resourceMutex.Unlock()

	v, err := mem.VirtualMemory()
	if err != nil {
		return fmt.Errorf("failed to get system memory info: %v", err)
	}

	availableMemoryMB := v.Available / 1024 / 1024
	if availableMemoryMB < minRequiredMemoryMB {
		return errors.New("insufficient system memory")
	}

	return nil
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	if err := checkSystemResources(); err != nil {
		log.Printf("Resource check failed: %v", err)
		http.Error(w, "System resources insufficient", http.StatusServiceUnavailable)
		return
	}

	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Websocket upgrade failed: %v", err)
		return
	}

	ctx, cancel := context.WithCancel(r.Context())
	var wg sync.WaitGroup

	cleanup := func() {
		cancel()
		_ = r.Body.Close()
		wg.Wait()
	}
	defer cleanup()

	name := "cangjie-lsp-" + server.RandomString(5)

	resp, err := dockerClient.ContainerCreate(ctx, &container.Config{
		Image:        defaultImage,
		OpenStdin:    true,
		StdinOnce:    true,
		AttachStdin:  true,
		AttachStdout: true,
		Cmd:          []string{"lsp"},
	}, hostConfig, nil, nil, name)
	if err != nil {
		log.Printf("Container creation failed: %v", err)
		return
	}

	if err := dockerClient.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		log.Printf("Container start failed: %v", err)
		return
	}

	defer func() {
		log.Printf("Cleaning up container")
		timeout := 1
		if err := dockerClient.ContainerStop(context.Background(), resp.ID, container.StopOptions{
			Timeout: &timeout,
		}); err != nil {
			log.Printf("Container stop failed: %v", err)
			if err = dockerClient.ContainerRemove(context.Background(), resp.ID, container.RemoveOptions{
				Force: true,
			}); err != nil {
				log.Printf("Container remove failed: %v", err)
			}
		}
	}()

	attach, err := dockerClient.ContainerAttach(ctx, resp.ID, container.AttachOptions{
		Stream: true,
		Stdin:  true,
		Stdout: true,
	})
	if err != nil {
		log.Printf("Container attach failed: %v", err)
		return
	}
	defer attach.Close()

	go func() {
		wg.Add(1)
		defer wg.Done()
		_ = ws.SetReadDeadline(time.Now().Add(pongWait))
		ws.SetPongHandler(func(string) error {
			_ = ws.SetReadDeadline(time.Now().Add(pongWait))
			return nil
		})

		for {
			_, data, err := ws.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("Read error: %v", err)
				}
				cancel()
				return
			}
			data = append(data, '\n')
			_, err = attach.Conn.Write(data)
			if err != nil {
				log.Printf("Write error: %v", err)
				cancel()
				return
			}
		}
	}()

	go func() {
		wg.Add(1)
		defer wg.Done()
		ticker := time.NewTicker(pingPeriod)
		defer ticker.Stop()

		wg.Add(1)
		go func() {
			defer wg.Done()
			stderr := strings.Builder{}
			in, out := net.Pipe()

			go func() {
				scanner := bufio.NewScanner(out)
				for scanner.Scan() {
					select {
					case <-ctx.Done():
						return
					default:
						data := scanner.Bytes()
						_ = ws.SetWriteDeadline(time.Now().Add(writeWait))
						if err := ws.WriteMessage(websocket.TextMessage, data); err != nil {
							log.Printf("Write error: %v", err)
							cancel()
							return
						}
					}
				}
			}()

			_, err := stdcopy.StdCopy(in, &stderr, attach.Reader)
			if err != nil {
				log.Printf("Stdcopy error: %v", err)
			}
			if stderr.Len() > 0 {
				log.Printf("Stderr: %s", stderr.String())
				stderr.Reset()
			}
		}()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				_ = ws.SetWriteDeadline(time.Now().Add(writeWait))
				if err := ws.WriteMessage(websocket.PingMessage, nil); err != nil {
					log.Printf("Ping error: %v", err)
					cancel()
					return
				}
			}
		}
	}()

	<-ctx.Done()
}
