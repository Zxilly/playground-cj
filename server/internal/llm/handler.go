// Package llm wires the LLM proxy endpoints. It exposes an OpenAI-compatible
// /chat/completions endpoint backed by github.com/maximhq/bifrost/core, plus a
// /budget endpoint that reports the caller's per-IP allotment.
package llm

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/Zxilly/playground-cj/server/internal/budget"
	"github.com/gin-gonic/gin"
	bifrost "github.com/maximhq/bifrost/core"
	"github.com/maximhq/bifrost/core/schemas"
)

// Service holds shared state for the LLM proxy.
type Service struct {
	budget   *budget.Manager
	bifrost  *bifrost.Bifrost
	upstream string // fallback OpenAI-compatible base URL when bifrost can't fulfil the request
	http     *http.Client
}

// NewService constructs the proxy. It tries to initialize bifrost from env
// vars; if no provider keys are configured, requests fall through to a direct
// HTTP proxy at upstream (default https://api.openai.com/v1).
func NewService(b *budget.Manager) *Service {
	upstream := os.Getenv("LLM_UPSTREAM_URL")
	if upstream == "" {
		upstream = "https://api.openai.com/v1"
	}

	svc := &Service{
		budget:   b,
		upstream: strings.TrimRight(upstream, "/"),
		// Timeout=0 because chat-completions stream responses can stay open for
		// minutes; per-request cancellation is driven by the gin context.
		http: &http.Client{Timeout: 0},
	}

	if client, err := bifrost.Init(context.Background(), schemas.BifrostConfig{Account: newEnvAccount()}); err != nil {
		log.Printf("[llm] bifrost init failed (will use direct proxy): %v", err)
	} else {
		svc.bifrost = client
	}

	return svc
}

// Close releases bifrost resources.
func (s *Service) Close() {
	if s.bifrost != nil {
		s.bifrost.Shutdown()
	}
}

// HandleChatCompletions handles POST /llm/v1/chat/completions.
func (s *Service) HandleChatCompletions(c *gin.Context) {
	ip := c.ClientIP()

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
		return
	}

	// Probe budget before forwarding (estimate $0.001 minimum).
	hasUserKey := c.GetHeader("Authorization") != ""
	if !hasUserKey {
		if err := s.budget.Acquire(ip, 0.001); err != nil {
			c.Header("Retry-After", "3600")
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "budget exceeded; supply your own API key in the LLM settings"})
			return
		}
	}

	// Parse model out for budget accounting later.
	var req struct {
		Model    string `json:"model"`
		Stream   bool   `json:"stream"`
		Messages []any  `json:"messages"`
	}
	_ = json.Unmarshal(body, &req)
	model := req.Model

	// Direct HTTP proxy path. We keep this as the primary forwarding mechanism
	// because bifrost's request schema differs from OpenAI's; bifrost is
	// initialized for future expansion (multi-provider routing, observability).
	upstreamURL := s.upstream + "/chat/completions"
	httpReq, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, upstreamURL, bytes.NewReader(body))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if hasUserKey {
		httpReq.Header.Set("Authorization", c.GetHeader("Authorization"))
	} else if k := os.Getenv("OPENAI_API_KEY"); k != "" {
		httpReq.Header.Set("Authorization", "Bearer "+k)
	}

	resp, err := s.http.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()

	for k, vs := range resp.Header {
		for _, v := range vs {
			c.Writer.Header().Add(k, v)
		}
	}
	c.Writer.WriteHeader(resp.StatusCode)

	if !req.Stream {
		// Non-streaming: read whole body, account usage, write through.
		respBody, _ := io.ReadAll(resp.Body)
		s.accountUsage(ip, model, respBody, hasUserKey)
		_, _ = c.Writer.Write(respBody)
		return
	}

	// Streaming: tee the SSE stream while looking for usage in the final chunk.
	flusher, _ := c.Writer.(http.Flusher)
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)
	var lastDataLine []byte
	for scanner.Scan() {
		line := scanner.Bytes()
		if bytes.HasPrefix(line, []byte("data:")) {
			payload := bytes.TrimSpace(bytes.TrimPrefix(line, []byte("data:")))
			if !bytes.Equal(payload, []byte("[DONE]")) {
				lastDataLine = append(lastDataLine[:0], payload...)
			}
		}
		_, _ = c.Writer.Write(line)
		_, _ = c.Writer.Write([]byte("\n"))
		if flusher != nil {
			flusher.Flush()
		}
	}
	if err := scanner.Err(); err != nil && !errors.Is(err, context.Canceled) {
		log.Printf("[llm] stream scan error: %v", err)
	}

	if !hasUserKey && len(lastDataLine) > 0 {
		s.accountUsage(ip, model, lastDataLine, hasUserKey)
	}
}

// HandleBudget returns remaining USD and reset time for the caller's IP.
// The shape mirrors OpenAI-style top-level objects so it can sit alongside
// /chat/completions and /models without surprising clients.
func (s *Service) HandleBudget(c *gin.Context) {
	ip := c.ClientIP()
	remaining, resetAt := s.budget.Snapshot(ip)
	c.JSON(http.StatusOK, gin.H{
		"object":       "budget",
		"ip":           ip,
		"remainingUSD": remaining,
		"resetAt":      resetAt.UnixMilli(),
		"resetInSec":   int64(time.Until(resetAt).Seconds()),
	})
}

// HandleModels returns the allowed model list to the client.
func (s *Service) HandleModels(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"object": "list",
		"data": []gin.H{
			{"id": "gpt-4o-mini", "object": "model"},
			{"id": "gpt-4o", "object": "model"},
			{"id": "claude-sonnet-4-6", "object": "model"},
		},
	})
}

// usageProbe parses a single OpenAI-compatible chunk to extract token usage.
type usageProbe struct {
	Usage *struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
	} `json:"usage"`
}

func (s *Service) accountUsage(ip, model string, body []byte, hasUserKey bool) {
	if hasUserKey {
		return
	}
	var u usageProbe
	if err := json.Unmarshal(body, &u); err != nil || u.Usage == nil {
		// Fall back to a minimum charge so a stream with no usage still costs something.
		s.budget.Charge(ip, 0.0005)
		return
	}
	cost := budget.Cost(model, u.Usage.PromptTokens, u.Usage.CompletionTokens)
	s.budget.Charge(ip, cost)
}

