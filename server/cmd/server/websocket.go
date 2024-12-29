package main

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/pkg/stdcopy"
	"github.com/gorilla/websocket"
	"go.lsp.dev/jsonrpc2"
)

const (
	writeWait  = 10 * time.Second
	pongWait   = 10 * time.Second
	pingPeriod = (pongWait * 4) / 5
)

var upgrader = websocket.Upgrader{
	EnableCompression: true,
	CheckOrigin: func(_ *http.Request) bool {
		return true
	},
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	defer func() {
		_ = r.Body.Close()
	}()

	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Websocket upgrade failed: %v", err)
		return
	}
	defer func(ws *websocket.Conn) {
		_ = ws.Close()
	}(ws)

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	resp, err := dockerClient.ContainerCreate(ctx, &container.Config{
		Image:        defaultImage,
		OpenStdin:    true,
		StdinOnce:    true,
		AttachStdin:  true,
		AttachStdout: true,
		Cmd:          []string{"lsp"},
	}, hostConfig, nil, nil, "")
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
		_ = ws.SetReadDeadline(time.Now().Add(pongWait))
		ws.SetPongHandler(func(string) error {
			_ = ws.SetReadDeadline(time.Now().Add(pongWait))
			return nil
		})

		stream := jsonrpc2.NewStream(attach.Conn)
		for {
			_, msgData, err := ws.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("Read error: %v", err)
				}
				break
			}
			msg, err := jsonrpc2.DecodeMessage(msgData)
			if err != nil {
				log.Printf("Decode error: %v", err)
				break
			}

			_, err = stream.Write(ctx, msg)
			if err != nil {
				log.Printf("Write error: %v", err)
				break
			}
		}
	}()

	go func() {
		ticker := time.NewTicker(pingPeriod)
		defer func() {
			log.Printf("Closing websocket")
			ticker.Stop()
			_ = ws.Close()
			cancel()
		}()

		go func() {
			stderr := strings.Builder{}
			in, out := net.Pipe()

			go func() {
				stream := jsonrpc2.NewStream(out)
				for {
					msg, _, err := stream.Read(ctx)
					if err != nil {
						if err != io.EOF {
							log.Printf("Read error: %v", err)
						}
						break
					}

					msgData, err := json.Marshal(msg)
					if err != nil {
						log.Printf("Marshal error: %v", err)
						break
					}

					_ = ws.SetWriteDeadline(time.Now().Add(writeWait))
					if err := ws.WriteMessage(websocket.TextMessage, msgData); err != nil {
						log.Printf("Write error: %v", err)
						break
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

		for range ticker.C {
			_ = ws.SetWriteDeadline(time.Now().Add(writeWait))
			if err := ws.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("Ping error: %v", err)
				break
			}
		}
	}()

	<-ctx.Done()
}
