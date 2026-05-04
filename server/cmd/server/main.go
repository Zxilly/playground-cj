package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/Zxilly/playground-cj/server/internal/budget"
	"github.com/Zxilly/playground-cj/server/internal/llm"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func envFloat(key string, def float64) float64 {
	if v := os.Getenv(key); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
	}
	return def
}

func envDuration(key string, def time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return def
}

func main() {
	if len(os.Args) != 2 {
		log.Fatalf("Usage: %s <address>", os.Args[0])
	}

	addr := os.Args[1]

	r := gin.Default()
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowAllOrigins = true
	corsConfig.AllowHeaders = append(corsConfig.AllowHeaders, "x-llm-base-url", "x-llm-api-key", "x-llm-model", "Authorization")

	r.Use(cors.New(corsConfig))

	r.POST("/run", handleRun)
	r.POST("/format", handleFormat)

	budgetMgr := budget.New(
		envFloat("LLM_DEFAULT_BUDGET_USD", 0.10),
		envDuration("LLM_BUDGET_WINDOW", 24*time.Hour),
	)
	defer budgetMgr.Close()

	llmSvc := llm.NewService(budgetMgr)
	defer llmSvc.Close()

	llmV1 := r.Group("/llm/v1")
	llmV1.GET("/budget", llmSvc.HandleBudget)
	llmV1.GET("/models", llmSvc.HandleModels)
	llmV1.POST("/chat/completions", llmSvc.HandleChatCompletions)

	server := &http.Server{
		Addr:    addr,
		Handler: r.Handler(),
	}

	go func() {
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %s\n", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutdown Server...")

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatal("Server Shutdown:", err)
	}

	log.Println("Server exit")
}
