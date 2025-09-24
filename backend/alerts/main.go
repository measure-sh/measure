package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"backend/alerts/alerts"
	"backend/alerts/email"
	"backend/alerts/server"
	"backend/alerts/slack"

	"github.com/gin-gonic/gin"
	"github.com/robfig/cron/v3"
	"google.golang.org/grpc/credentials"

	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/sdk/resource"
	"go.opentelemetry.io/otel/sdk/trace"
)

func main() {
	config := server.NewConfig()
	server.Init(config)

	cron := initCron(context.Background())

	alertsTracer := initTracer(config.OtelServiceName)

	// close postgres pool at shutdown
	defer server.Server.PgPool.Close()
	defer server.Server.RpgPool.Close()

	// close clickhouse connection pool at shutdown
	defer func() {
		if err := server.Server.ChPool.Close(); err != nil {
			log.Fatalf("Unable to close clickhouse operator connection: %v", err)
		}

		if err := server.Server.RchPool.Close(); err != nil {
			log.Fatalf("Unable to close clickhouse reader connection: %v", err)
		}
	}()

	// close otel tracer at shutdown
	defer func() {
		if err := alertsTracer(context.Background()); err != nil {
			log.Fatalf("Unable to close otel tracer: %v", err)
		}
	}()

	// stop cron scheduler at shutdown
	defer cron.Stop()

	// set up gin
	r := gin.Default()
	r.Use(otelgin.Middleware(config.OtelServiceName))

	// health check
	r.GET("/ping", func(c *gin.Context) {
		c.String(http.StatusOK, "pong")
	})

	// listen and serve on 0.0.0.0:${PORT}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}
	if err := r.Run(":" + port); err != nil {
		fmt.Printf("Failed to listen and serve on 0.0.0.0:%s\n", port)
	}
}

func initCron(ctx context.Context) *cron.Cron {
	cron := cron.New()
	cron.AddFunc("0 0 * * * *", func() { alerts.CreateCrashAndAnrAlerts(ctx) })
	cron.AddFunc("0 0 6 * * *", func() { alerts.CreateDailySummary(ctx) })
	cron.AddFunc("@every 5m", func() { email.SendPendingAlertEmails(ctx) })
	cron.AddFunc("@every 5m", func() { slack.SendPendingAlertSlackMessages(ctx) })

	cron.Start()
	return cron
}

func initTracer(otelServiceName string) func(context.Context) error {
	otelCollectorURL := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	otelInsecureMode := os.Getenv("OTEL_INSECURE_MODE")

	var secureOption otlptracegrpc.Option

	if strings.ToLower(otelInsecureMode) == "false" || otelInsecureMode == "0" || strings.ToLower(otelInsecureMode) == "f" {
		secureOption = otlptracegrpc.WithTLSCredentials(credentials.NewClientTLSFromCert(nil, ""))
	} else {
		secureOption = otlptracegrpc.WithInsecure()
	}

	exporter, err := otlptrace.New(
		context.Background(),
		otlptracegrpc.NewClient(
			secureOption,
			otlptracegrpc.WithEndpoint(otelCollectorURL),
		),
	)

	if err != nil {
		log.Fatalf("Failed to create exporter: %v", err)
	}
	resources, err := resource.New(
		context.Background(),
		resource.WithAttributes(
			attribute.String("service.name", otelServiceName),
			attribute.String("library.language", "go"),
		),
	)
	if err != nil {
		log.Fatalf("Could not set resources: %v", err)
	}

	otel.SetTracerProvider(
		trace.NewTracerProvider(
			trace.WithSampler(trace.AlwaysSample()),
			trace.WithBatcher(exporter),
			trace.WithResource(resources),
		),
	)
	return exporter.Shutdown
}
