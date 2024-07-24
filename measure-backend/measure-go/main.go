package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"measure-backend/measure-go/measure"
	"measure-backend/measure-go/server"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"google.golang.org/grpc/credentials"

	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

func main() {
	config := server.NewConfig()

	pgDSN := os.Getenv("POSTGRES_DSN")
	if pgDSN == "" {
		log.Printf(`"POSTGRES_DSN" missing, will proceed with default "%s"`, config.PG.DSN)
	} else {
		config.PG.DSN = pgDSN
	}

	chDSN := os.Getenv("CLICKHOUSE_DSN")
	if chDSN == "" {
		log.Printf(`"CLICKHOUSE_DSN" missing, will proceed with default "%s"`, config.CH.DSN)
	} else {
		config.CH.DSN = chDSN
	}

	otelServiceName := os.Getenv("OTEL_SERVICE_NAME")

	server.Init(config)
	cleanup := initTracer(otelServiceName)

	defer server.Server.PgPool.Close()
	defer server.Server.ChPool.Close()
	defer cleanup(context.Background())

	r := gin.Default()
	r.Use(otelgin.Middleware(otelServiceName))
	cors := cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "https://www.measure.sh"},
		AllowMethods:     []string{"GET", "OPTIONS", "PATCH", "DELETE", "PUT"},
		AllowHeaders:     []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	})

	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "pong"})
	})

	// Auth routes
	r.Use(cors)
	auth := r.Group("/auth")
	{
		auth.POST("github", measure.SigninGitHub)
		auth.POST("google", measure.SigninGoogle)
		auth.POST("refresh", measure.ValidateRefreshToken(), measure.RefreshToken)
		auth.DELETE("signout", measure.ValidateRefreshToken(), measure.Signout)
	}

	// SDK routes
	r.PUT("/events", measure.ValidateAPIKey(), measure.PutEvents)
	r.PUT("/builds", measure.ValidateAPIKey(), measure.PutBuild)

	// Dashboard routes
	r.Use(cors).Use(measure.ValidateAccessToken())
	apps := r.Group("/apps")
	{
		apps.GET(":id/journey", measure.GetAppJourney)
		apps.GET(":id/metrics", measure.GetAppMetrics)
		apps.GET(":id/filters", measure.GetAppFilters)
		apps.GET(":id/crashGroups", measure.GetCrashOverview)
		apps.GET(":id/crashGroups/plots/instances", measure.GetCrashOverviewPlotInstances)
		apps.GET(":id/crashGroups/:crashGroupId/crashes", measure.GetCrashDetailCrashes)
		apps.GET(":id/crashGroups/:crashGroupId/plots/instances", measure.GetCrashDetailPlotInstances)
		apps.GET(":id/crashGroups/:crashGroupId/plots/journey", measure.GetCrashDetailPlotJourney)
		apps.GET(":id/anrGroups", measure.GetANROverview)
		apps.GET(":id/anrGroups/plots/instances", measure.GetANROverviewPlotInstances)
		apps.GET(":id/anrGroups/:anrGroupId/anrs", measure.GetANRDetailANRs)
		apps.GET(":id/anrGroups/:anrGroupId/plots/instances", measure.GetANRDetailPlotInstances)
		apps.GET(":id/anrGroups/:anrGroupId/plots/journey", measure.GetANRDetailPlotJourney)
		apps.GET(":id/sessions/:sessionId", measure.GetAppSession)
		apps.GET(":id/alertPrefs", measure.GetAlertPrefs)
		apps.PATCH(":id/alertPrefs", measure.UpdateAlertPrefs)
		apps.GET(":id/settings", measure.GetAppSettings)
		apps.PATCH(":id/settings", measure.UpdateAppSettings)
	}

	teams := r.Group("/teams")
	{
		teams.POST("", measure.CreateTeam)
		teams.GET("", measure.GetTeams)
		teams.GET(":id/apps", measure.GetTeamApps)
		teams.GET(":id/usage", measure.GetUsage)
		teams.GET(":id/apps/:appId", measure.GetTeamApp)
		teams.POST(":id/apps", measure.CreateApp)
		teams.POST(":id/invite", measure.InviteMembers)
		teams.PATCH(":id/rename", measure.RenameTeam)
		teams.PATCH(":id/members/:memberId/role", measure.ChangeMemberRole)
		teams.GET(":id/authz", measure.GetAuthzRoles)
		teams.GET(":id/members", measure.GetTeamMembers)
		teams.DELETE(":id/members/:memberId", measure.RemoveTeamMember)
	}

	r.Run(":8080") // listen and serve on 0.0.0.0:8080
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
		sdktrace.NewTracerProvider(
			sdktrace.WithSampler(sdktrace.AlwaysSample()),
			sdktrace.WithBatcher(exporter),
			sdktrace.WithResource(resources),
		),
	)
	return exporter.Shutdown
}
