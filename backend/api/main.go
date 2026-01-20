package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"backend/api/concur"
	"backend/api/inet"
	"backend/api/measure"
	"backend/api/server"

	"github.com/gin-gonic/gin"

	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
)

func main() {
	config := server.NewConfig()
	server.Init(config)

	defer server.Server.PgPool.Close()

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

	// SDK routes
	r.PUT("/events", measure.ValidateAPIKey(), measure.PutEvents)
	r.PUT("/builds", measure.ValidateAPIKey(), measure.PutBuilds)
	r.GET("/config", measure.ValidateAPIKey(), measure.GetConfigForSdk)

	// Proxy routes
	r.GET("/proxy/attachments", measure.ProxyAttachment)
	r.PUT("/proxy/attachments", measure.ProxyAttachment)
	if !config.IsCloud() {
		r.PUT("/proxy/symbols", measure.ProxySymbol)
	}

	// Auth routes
	auth := r.Group("/auth")
	{
		auth.POST("github", measure.SigninGitHub)
		auth.POST("google", measure.SigninGoogle)
		auth.POST("validateInvite", measure.ValidateInvite)
		auth.POST("refresh", measure.ValidateRefreshToken(), measure.RefreshToken)
		auth.GET("session", measure.ValidateAccessToken(), measure.GetAuthSession)
		auth.DELETE("signout", measure.ValidateRefreshToken(), measure.Signout)
	}

	// Dashboard routes
	apps := r.Group("/apps", measure.ValidateAccessToken())
	{
		apps.GET(":id/journey", measure.GetAppJourney)
		apps.GET(":id/metrics", measure.GetAppMetrics)
		apps.GET(":id/filters", measure.GetAppFilters)

		// crashes
		apps.GET(":id/crashGroups", measure.GetCrashOverview)
		apps.GET(":id/crashGroups/plots/instances", measure.GetCrashOverviewPlotInstances)
		apps.GET(":id/crashGroups/:crashGroupId/crashes", measure.GetCrashDetailCrashes)
		apps.GET(":id/crashGroups/:crashGroupId/path", measure.GetCrashGroupCommonPath)
		apps.GET(":id/crashGroups/:crashGroupId/plots/instances", measure.GetCrashDetailPlotInstances)
		apps.GET(":id/crashGroups/:crashGroupId/plots/distribution", measure.GetCrashDetailAttributeDistribution)

		// ANRs
		apps.GET(":id/anrGroups", measure.GetANROverview)
		apps.GET(":id/anrGroups/plots/instances", measure.GetANROverviewPlotInstances)
		apps.GET(":id/anrGroups/:anrGroupId/anrs", measure.GetANRDetailANRs)
		apps.GET(":id/anrGroups/:anrGroupId/path", measure.GetANRGroupCommonPath)
		apps.GET(":id/anrGroups/:anrGroupId/plots/instances", measure.GetANRDetailPlotInstances)
		apps.GET(":id/anrGroups/:anrGroupId/plots/distribution", measure.GetANRDetailAttributeDistribution)

		// sessions
		apps.GET(":id/sessions", measure.GetSessionsOverview)
		apps.GET(":id/sessions/:sessionId", measure.GetSession)
		apps.GET(":id/sessions/plots/instances", measure.GetSessionsOverviewPlotInstances)

		// spans & traces
		apps.GET(":id/spans/roots/names", measure.GetRootSpanNames)
		apps.GET(":id/spans", measure.GetSpansForSpanName)
		apps.GET(":id/spans/plots/metrics", measure.GetMetricsPlotForSpanName)
		apps.GET(":id/traces/:traceId", measure.GetTrace)

		// bug reports
		apps.GET(":id/bugReports", measure.GetBugReportsOverview)
		apps.GET(":id/bugReports/plots/instances", measure.GetBugReportsInstancesPlot)
		apps.GET(":id/bugReports/:bugReportId", measure.GetBugReport)
		apps.PATCH(":id/bugReports/:bugReportId", measure.UpdateBugReportStatus)

		// alerts
		apps.GET(":id/alerts", measure.GetAlertsOverview)

		// alert preferences
		apps.GET(":id/alertPrefs", measure.GetAlertPrefs)
		apps.PATCH(":id/alertPrefs", measure.UpdateAlertPrefs)

		// app management
		apps.GET(":id/config", measure.GetConfig)
		apps.PATCH(":id/config", measure.PatchConfig)
		apps.GET(":id/retention", measure.GetAppRetention)
		apps.PATCH(":id/retention", measure.UpdateAppRetention)
		apps.PATCH(":id/rename", measure.RenameApp)

		// filters
		apps.POST(":id/shortFilters", measure.CreateShortFilters)
	}

	teams := r.Group("/teams", measure.ValidateAccessToken())
	{
		teams.POST("", measure.CreateTeam)
		teams.GET("", measure.GetTeams)
		teams.GET(":id/apps", measure.GetTeamApps)
		teams.GET(":id/apps/:appId", measure.GetTeamApp)
		teams.POST(":id/apps", measure.CreateApp)
		teams.GET(":id/invites", measure.GetValidTeamInvites)
		teams.POST(":id/invite", measure.InviteMembers)
		teams.PATCH(":id/invite/:inviteId", measure.ResendInvite)
		teams.DELETE(":id/invite/:inviteId", measure.RemoveInvite)
		teams.PATCH(":id/rename", measure.RenameTeam)
		teams.PATCH(":id/members/:memberId/role", measure.ChangeMemberRole)
		teams.GET(":id/authz", measure.GetAuthzRoles)
		teams.GET(":id/members", measure.GetTeamMembers)
		teams.DELETE(":id/members/:memberId", measure.RemoveTeamMember)
		teams.GET(":id/usage", measure.GetUsage)
		teams.GET(":id/slack", measure.GetTeamSlack)
		teams.PATCH(":id/slack/status", measure.UpdateTeamSlackStatus)
		teams.POST(":id/slack/test", measure.SendTestSlackAlert)
		teams.GET(":id/billing/info", measure.GetTeamBilling)
		teams.PATCH(":id/billing/checkout", measure.CreateCheckoutSession)
		teams.PATCH(":id/billing/downgrade", measure.CancelAndDowngradeToFreePlan)
	}

	slack := r.Group("/slack")
	{
		slack.POST("/connect", measure.ConnectTeamSlack)
		slack.POST("/events", measure.HandleSlackEvents)
	}

	stripe := r.Group("/stripe")
	{
		stripe.POST("/webhook", measure.HandleStripeWebhook)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: r,
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
	fmt.Println("Shutting down API service...")

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
