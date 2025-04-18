package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"backend/api/inet"
	"backend/api/measure"
	"backend/api/server"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
)

func main() {
	config := server.NewConfig()
	server.Init(config)

	defer server.Server.PgPool.Close()

	// close clickhouse connection pool at shutdown
	defer func() {
		if err := server.Server.ChPool.Close(); err != nil {
			log.Fatalf("Unable to close clickhouse connection: %v", err)
		}
	}()

	// close geo ip database at shutdown
	defer func() {
		if err := inet.Close(); err != nil {
			log.Fatalf("Unable to close geo ip db: %v", err)
		}
	}()

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

	// SDK routes
	r.PUT("/events", measure.ValidateAPIKey(), measure.PutEvents)
	r.PUT("/builds", measure.ValidateAPIKey(), measure.PutBuild)

	cors := cors.New(cors.Config{
		AllowOrigins:     []string{config.SiteOrigin},
		AllowMethods:     []string{"GET", "OPTIONS", "PATCH", "DELETE", "PUT"},
		AllowHeaders:     []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	})

	// Dashboard routes
	// Any route below this point will use CORS
	r.Use(cors)

	// Proxy route
	r.GET("/attachments", measure.ProxyAttachment)

	// Auth routes
	auth := r.Group("/auth")
	{
		auth.POST("github", measure.SigninGitHub)
		auth.POST("google", measure.SigninGoogle)
		auth.POST("refresh", measure.ValidateRefreshToken(), measure.RefreshToken)
		auth.DELETE("signout", measure.ValidateRefreshToken(), measure.Signout)
	}

	apps := r.Group("/apps", measure.ValidateAccessToken())
	{
		apps.GET(":id/journey", measure.GetAppJourney)
		apps.GET(":id/metrics", measure.GetAppMetrics)
		apps.GET(":id/filters", measure.GetAppFilters)
		apps.GET(":id/crashGroups", measure.GetCrashOverview)
		apps.GET(":id/crashGroups/plots/instances", measure.GetCrashOverviewPlotInstances)
		apps.GET(":id/crashGroups/:crashGroupId/crashes", measure.GetCrashDetailCrashes)
		apps.GET(":id/crashGroups/:crashGroupId/plots/instances", measure.GetCrashDetailPlotInstances)
		apps.GET(":id/crashGroups/:crashGroupId/plots/distribution", measure.GetCrashDetailAttributeDistribution)
		apps.GET(":id/crashGroups/:crashGroupId/plots/journey", measure.GetCrashDetailPlotJourney)
		apps.GET(":id/anrGroups", measure.GetANROverview)
		apps.GET(":id/anrGroups/plots/instances", measure.GetANROverviewPlotInstances)
		apps.GET(":id/anrGroups/:anrGroupId/anrs", measure.GetANRDetailANRs)
		apps.GET(":id/anrGroups/:anrGroupId/plots/instances", measure.GetANRDetailPlotInstances)
		apps.GET(":id/anrGroups/:anrGroupId/plots/distribution", measure.GetANRDetailAttributeDistribution)
		apps.GET(":id/anrGroups/:anrGroupId/plots/journey", measure.GetANRDetailPlotJourney)
		apps.GET(":id/sessions", measure.GetSessionsOverview)
		apps.GET(":id/sessions/:sessionId", measure.GetSession)
		apps.GET(":id/sessions/plots/instances", measure.GetSessionsOverviewPlotInstances)
		apps.GET(":id/alertPrefs", measure.GetAlertPrefs)
		apps.PATCH(":id/alertPrefs", measure.UpdateAlertPrefs)
		apps.GET(":id/settings", measure.GetAppSettings)
		apps.PATCH(":id/settings", measure.UpdateAppSettings)
		apps.PATCH(":id/rename", measure.RenameApp)
		apps.POST(":id/shortFilters", measure.CreateShortFilters)
		apps.GET(":id/spans/roots/names", measure.GetRootSpanNames)
		apps.GET(":id/spans", measure.GetSpansForSpanName)
		apps.GET(":id/spans/plots/metrics", measure.GetMetricsPlotForSpanName)
		apps.GET(":id/traces/:traceId", measure.GetTrace)
		apps.GET(":id/bugReports", measure.GetBugReportsOverview)
		apps.GET(":id/bugReports/plots/instances", measure.GetBugReportsInstancesPlot)
		apps.GET(":id/bugReports/:bugReportId", measure.GetBugReport)
		apps.PATCH(":id/bugReports/:bugReportId", measure.UpdateBugReportStatus)
	}

	teams := r.Group("/teams", measure.ValidateAccessToken())
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

	// listen and serve on 0.0.0.0:${PORT}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	if err := r.Run(":" + port); err != nil {
		fmt.Printf("Failed to listen and serve on 0.0.0.0:%s\n", port)
	}
}
