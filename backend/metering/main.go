package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"backend/billing"
	"backend/metering/server"

	"github.com/gin-gonic/gin"
	"github.com/robfig/cron/v3"
	"github.com/stripe/stripe-go/v84"
	"github.com/stripe/stripe-go/v84/billing/meterevent"
	"github.com/stripe/stripe-go/v84/subscription"
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

	cronDaily, cronHourly := initCrons(context.Background())

	meteringTracer := initTracer(config.OtelServiceName)

	// close postres pool at shutdown
	defer server.Server.PgPool.Close()

	// close clickhouse connection pool at shutdown
	defer func() {
		if err := server.Server.ChPool.Close(); err != nil {
			fmt.Printf("Unable to close clickhouse operator connection: %v\n", err)
		}
	}()

	defer func() {
		if err := server.Server.RchPool.Close(); err != nil {
			fmt.Printf("Unable to close clickhouse reader connection: %v\n", err)
		}
	}()

	// close otel tracer at shutdown
	defer func() {
		if err := meteringTracer(context.Background()); err != nil {
			fmt.Printf("Unable to close otel tracer: %v\n", err)
		}
	}()

	// stop cron scheduler at shutdown
	defer cronDaily.Stop()
	defer cronHourly.Stop()

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
		port = "8084"
	}
	if err := r.Run(":" + port); err != nil {
		fmt.Printf("Failed to listen and serve on 0.0.0.0:%s\n", port)
	}
}

func initCrons(ctx context.Context) (*cron.Cron, *cron.Cron) {
	cronDaily := cron.New()
	cronHourly := cron.New()

	deps := billing.Deps{
		PgPool:         server.Server.PgPool,
		ChPool:         server.Server.RchPool,
		SiteOrigin:     server.Server.Config.SiteOrigin,
		TxEmailAddress: server.Server.Config.TxEmailAddress,
		MeterName:      server.Server.Config.StripeUnitDaysMeterName,
		GetSubscription: func(id string, params *stripe.SubscriptionParams) (*stripe.Subscription, error) {
			return subscription.Get(id, params)
		},
		ReportToStripe: func(params *stripe.BillingMeterEventParams) (*stripe.BillingMeterEvent, error) {
			return meterevent.New(params)
		},
	}

	// Run billing check at beginning of every hour to check limits
	if _, err := cronHourly.AddFunc("0 * * * *", func() { billing.RunHourlyBillingCheck(ctx, deps) }); err != nil {
		fmt.Printf("Failed to schedule hourly metering job: %v\n", err)
	}

	// Run metering job at 3 AM UTC every day to report for the previous day
	if _, err := cronDaily.AddFunc("0 3 * * *", func() { billing.RunDailyMetering(ctx, deps) }); err != nil {
		fmt.Printf("Failed to schedule daily metering job: %v\n", err)
	}

	if server.Server.Config.IsBillingEnabled() {
		fmt.Println("Scheduled daily metering job")
		cronDaily.Start()
		cronHourly.Start()
	}
	return cronDaily, cronHourly
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
