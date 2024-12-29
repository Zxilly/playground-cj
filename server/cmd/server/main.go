package main

import (
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true

	r.Use(cors.New(config))

	r.POST("/run", handleRun)
	r.POST("/format", handleFormat)
	r.GET("/ws", func(ctx *gin.Context) {
		handleWebSocket(ctx.Writer, ctx.Request)
	})
	log.Fatal(r.Run(":8080"))
}
