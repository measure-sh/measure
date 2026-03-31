package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"backend/ingest-worker/measure"
	"backend/ingest-worker/server"
	"backend/libs/concur"
	"backend/libs/inet"

	"github.com/gin-gonic/gin"

	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
)

func main() {
	config := server.NewConfig()
	server.Init(config)

	defer server.Server.PgPool.Close()
	if server.Server.VK != nil {
		defer server.Server.VK.Close()
	}

	// Close ClickHouse connection pool at shutdown
	defer func() {
		if err := server.Server.ChPool.Close(); err != nil {
			log.Fatalf("Unable to close clickhouse connection: %v", err)
		}
	}()

	// Close geo ip database at shutdown
	defer func() {
		if err := inet.Close(); err != nil {
			log.Fatalf("Unable to close geo ip db: %v", err)
		}
	}()

	appCtx, appCancel := context.WithCancel(context.Background())
	defer appCancel()

	r := gin.Default()

	closeTracer := config.InitTracing()
	// Close OTel tracer
	defer func() {
		if err := closeTracer(context.Background()); err != nil {
			log.Fatalf("Unable to close OTel tracer: %v", err)
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

	// ingest batch receive endpoint
	if config.IsCloud() {
		r.POST("/subscribe/batch", measure.PushHandler)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8086"
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	// Start bus consumer if initialized
	if server.Server.BusConsumer != nil {
		defer server.Server.BusConsumer.Close()

		handler := measure.ConsumeHandler // async for Iggy
		if config.IsCloud() {
			handler = measure.ConsumeHandlerSync // sync for Pub/Sub
		}

		go func() {
			if err := server.Server.BusConsumer.Listen(appCtx, handler); err != nil && !errors.Is(err, context.Canceled) {
				log.Printf("bus consumer stopped: %v\n", err)
			}

			fmt.Println("bus consumer listening")
		}()
	}

	// Run server in a goroutine
	go func() {
		fmt.Printf("Listening and serving HTTP on %s\n", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("Failed to listen and serve on %s\n", srv.Addr)
		}
	}()

	// Listen for shutdown signals
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	fmt.Println("Shutting down ingest-worker service...")

	shutdownTimeout := 9 * time.Second
	if gin.Mode() == gin.DebugMode {
		shutdownTimeout = 0 * time.Second
	}

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		fmt.Printf("Failed to gracefully shutdown server: %v\n", err)
	}

	// Wait for all background tasks
	fmt.Println("Waiting for background tasks...")
	concur.GlobalWg.Wait()
}
