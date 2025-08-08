package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"symboloader/server"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
)

func main() {
	config := server.NewConfig()
	server.Init(config)

	defer server.Server.PgPool.Close()

	r := gin.Default()

	closeTracer := config.InitTracer()
	// close otel tracer
	defer func() {
		if err := closeTracer(context.Background()); err != nil {
			log.Fatalf("Unable to close otel tracer: %v", err)
		}
	}()

	r.Use(otelgin.Middleware(config.OtelServiceName))
	r.Use(server.CaptureRequest())
	r.Use(server.CapturePanic())
	r.Use(server.CaptureErrorBody())

	// health check
	r.GET("/ping", func(c *gin.Context) {
		c.String(http.StatusOK, "pong")
	})

	r.POST("/receive-symbols", ProcessSymbolNotification)

	// listen and serve on 0.0.0.0:${PORT}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8084"
	}
	if err := r.Run(":" + port); err != nil {
		fmt.Printf("Failed to listen and serve on 0.0.0.0:%s\n", port)
	}
}
