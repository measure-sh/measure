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

	"backend/api/handlers"
	"backend/api/server"
	"backend/api/slackwebhook"
	"backend/libs/concur"
	"backend/libs/inet"
	"backend/libs/posthog"

	"github.com/gin-gonic/gin"

	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
)

func main() {
	config := server.NewConfig()
	deps := server.Connect(config)
	producer := server.NewAgentEventsProducer(config)

	defer deps.PgPool.Close()
	if deps.VK != nil {
		defer deps.VK.Close()
	}
	if producer != nil {
		defer producer.Close()
	}

	// Close ClickHouse connection pool at shutdown
	defer func() {
		if err := deps.ChPool.Close(); err != nil {
			log.Fatalf("Unable to close clickhouse connection: %v", err)
		}

		if err := deps.RchPool.Close(); err != nil {
			log.Fatalf("Unable to close clickhouse readonly connection: %v", err)
		}
	}()

	// Close geo ip database at shutdown
	defer func() {
		if err := inet.Close(); err != nil {
			log.Fatalf("Unable to close geo ip db: %v", err)
		}
	}()

	r := gin.Default()

	// Handlers bound to the process infrastructure; their methods are the
	// HTTP route handlers and middleware registered below.
	hdl := handlers.New(deps)
	sh := slackwebhook.New(deps, producer)

	closeTracer := server.InitTracing(config)
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
	r.PUT("/events", hdl.ValidateAPIKey(), hdl.PutEvents)
	r.PUT("/builds", hdl.ValidateAPIKey(), hdl.PutBuilds)
	r.GET("/config", hdl.ValidateAPIKey(), hdl.GetConfigForSdk)

	// Proxy routes
	r.GET("/proxy/attachments", hdl.ProxyAttachment)
	r.PUT("/proxy/attachments", hdl.ProxyAttachment)
	if !config.IsCloud() {
		r.PUT("/proxy/symbols", hdl.ProxySymbol)
	}

	// Auth routes
	auth := r.Group("/auth")
	{
		auth.POST("github", hdl.SigninGitHub)
		auth.POST("google", hdl.SigninGoogle)
		auth.POST("validateInvite", hdl.ValidateInvite)
		auth.POST("refresh", hdl.ValidateRefreshToken(), hdl.RefreshToken)
		auth.GET("session", hdl.ValidateAccessToken(), hdl.GetAuthSession)
		auth.DELETE("signout", hdl.ValidateRefreshToken(), hdl.Signout)
	}

	// Dashboard routes
	apps := r.Group("/apps", hdl.ValidateAccessToken())
	{
		apps.GET(":id/journey", hdl.GetAppJourney)
		apps.GET(":id/metrics", hdl.GetAppMetrics)
		apps.GET(":id/health/plots/instances", hdl.GetHealthOverviewPlotInstances)
		apps.GET(":id/filters", hdl.GetAppFilters)

		// crashes
		apps.GET(":id/crashGroups", hdl.GetCrashOverview)
		apps.GET(":id/crashGroups/plots/instances", hdl.GetCrashOverviewPlotInstances)
		apps.GET(":id/crashGroups/:crashGroupId/crashes", hdl.GetCrashDetailCrashes)
		apps.GET(":id/crashGroups/:crashGroupId/path", hdl.GetCrashGroupCommonPath)
		apps.GET(":id/crashGroups/:crashGroupId/plots/instances", hdl.GetCrashDetailPlotInstances)
		apps.GET(":id/crashGroups/:crashGroupId/plots/distribution", hdl.GetCrashDetailAttributeDistribution)

		// ANRs
		apps.GET(":id/anrGroups", hdl.GetANROverview)
		apps.GET(":id/anrGroups/plots/instances", hdl.GetANROverviewPlotInstances)
		apps.GET(":id/anrGroups/:anrGroupId/anrs", hdl.GetANRDetailANRs)
		apps.GET(":id/anrGroups/:anrGroupId/path", hdl.GetANRGroupCommonPath)
		apps.GET(":id/anrGroups/:anrGroupId/plots/instances", hdl.GetANRDetailPlotInstances)
		apps.GET(":id/anrGroups/:anrGroupId/plots/distribution", hdl.GetANRDetailAttributeDistribution)

		// errors
		apps.GET(":id/errorGroups", hdl.GetErrorOverview)
		apps.GET(":id/errorGroups/plots/instances", hdl.GetErrorOverviewPlotInstances)
		apps.GET(":id/errorGroups/:errorGroupId/errors", hdl.GetErrorDetailErrors)
		apps.GET(":id/errorGroups/:errorGroupId/path", hdl.GetErrorGroupCommonPath)
		apps.GET(":id/errorGroups/:errorGroupId/plots/instances", hdl.GetErrorDetailPlotInstances)
		apps.GET(":id/errorGroups/:errorGroupId/plots/distribution", hdl.GetErrorDetailAttributeDistribution)

		// sessions
		apps.GET(":id/sessions", hdl.GetSessionsOverview)
		apps.GET(":id/sessions/:sessionId", hdl.GetSession)
		apps.GET(":id/sessions/plots/instances", hdl.GetSessionsOverviewPlotInstances)

		// spans & traces
		apps.GET(":id/spans/roots/names", hdl.GetRootSpanNames)
		apps.GET(":id/spans", hdl.GetSpansForSpanName)
		apps.GET(":id/spans/plots/metrics", hdl.GetMetricsPlotForSpanName)
		apps.GET(":id/traces/:traceId", hdl.GetTrace)

		// bug reports
		apps.GET(":id/bugReports", hdl.GetBugReportsOverview)
		apps.GET(":id/bugReports/plots/instances", hdl.GetBugReportsInstancesPlot)
		apps.GET(":id/bugReports/:bugReportId", hdl.GetBugReport)
		apps.PATCH(":id/bugReports/:bugReportId", hdl.UpdateBugReportStatus)

		// alerts
		apps.GET(":id/alerts", hdl.GetAlertsOverview)

		// threshold preferences
		apps.GET(":id/thresholdPrefs", hdl.GetAppThresholdPrefs)
		apps.PATCH(":id/thresholdPrefs", hdl.UpdateAppThresholdPrefs)

		// app management
		apps.GET(":id/config", hdl.GetConfig)
		apps.PATCH(":id/config", hdl.PatchConfig)
		apps.GET(":id/retention", hdl.GetAppRetention)
		apps.PATCH(":id/retention", hdl.UpdateAppRetention)

		// network requests
		apps.GET(":id/networkRequests/domains", hdl.GetNetworkRequestsDomains)
		apps.GET(":id/networkRequests/paths", hdl.GetNetworkRequestsPaths)
		apps.GET(":id/networkRequests/trends", hdl.GetNetworkRequestsTrends)
		apps.GET(":id/networkRequests/plots/overviewStatusCodes", hdl.GetNetworkOverviewStatusCodesPlot)
		apps.GET(":id/networkRequests/plots/overviewTimeline", hdl.GetNetworkOverviewTimelinePlot)
		apps.GET(":id/networkRequests/plots/endpointLatency", hdl.GetNetworkEndpointLatencyPlot)
		apps.GET(":id/networkRequests/plots/endpointStatusCodes", hdl.GetNetworkEndpointStatusCodesPlot)
		apps.GET(":id/networkRequests/plots/endpointTimeline", hdl.GetNetworkEndpointTimelinePlot)

		// misc
		apps.PATCH(":id/rename", hdl.RenameApp)
		apps.PATCH(":id/apiKey", hdl.RotateApiKey)

		// filters
		apps.POST(":id/shortFilters", hdl.CreateShortFilters)
	}

	teams := r.Group("/teams", hdl.ValidateAccessToken())
	{
		teams.POST("", hdl.CreateTeam)
		teams.GET("", hdl.GetTeams)
		teams.GET(":id/apps", hdl.GetTeamApps)
		teams.GET(":id/apps/:appId", hdl.GetTeamApp)
		teams.POST(":id/apps", hdl.CreateApp)
		teams.GET(":id/invites", hdl.GetValidTeamInvites)
		teams.POST(":id/invite", hdl.InviteMembers)
		teams.PATCH(":id/invite/:inviteId", hdl.ResendInvite)
		teams.DELETE(":id/invite/:inviteId", hdl.RemoveInvite)
		teams.PATCH(":id/rename", hdl.RenameTeam)
		teams.PATCH(":id/members/:memberId/role", hdl.ChangeMemberRole)
		teams.GET(":id/authz", hdl.GetAuthzRoles)
		teams.GET(":id/members", hdl.GetTeamMembers)
		teams.DELETE(":id/members/:memberId", hdl.RemoveTeamMember)
		teams.GET(":id/usage", hdl.GetUsage)
		teams.GET(":id/slack", hdl.GetTeamSlack)
		teams.PATCH(":id/slack/status", hdl.UpdateTeamSlackStatus)
		teams.POST(":id/slack/test", hdl.SendTestSlackAlert)
		teams.GET(":id/billing/info", hdl.GetTeamBilling)
		teams.PATCH(":id/billing/checkout", hdl.CreateCheckoutSession)
		teams.PATCH(":id/billing/downgrade", hdl.CancelAndDowngradeToFreePlan)
		teams.PATCH(":id/billing/undo-downgrade", hdl.UndoDowngradeToFreePlan)
		teams.POST(":id/billing/portal", hdl.CreateCustomerPortalSession)
	}

	// Preferences
	prefs := r.Group("/prefs", hdl.ValidateAccessToken())
	{
		prefs.GET("notifPrefs", hdl.GetNotifPrefs)
		prefs.PATCH("notifPrefs", hdl.UpdateNotifPrefs)
	}

	slack := r.Group("/slack")
	{
		slack.POST("/connect", hdl.ConnectTeamSlack)
		slack.POST("/events", sh.HandleSlackEvents)
	}

	autumn := r.Group("/autumn")
	{
		autumn.POST("/webhook", hdl.HandleAutumnWebhook)
	}

	// The MCP endpoints live in the agent service. Clients still pointing
	// here get an error that says where to go, instead of a plain 404.
	mcpMoved := func(c *gin.Context) {
		msg := "The Measure MCP server has moved"
		if config.AgentOrigin != "" {
			msg = fmt.Sprintf("%s to %s/mcp", msg, config.AgentOrigin)
		}
		msg += ". Update your MCP client's server URL and re-authenticate."
		c.JSON(http.StatusGone, gin.H{"error": msg})
	}
	r.GET("/.well-known/oauth-authorization-server", mcpMoved)
	r.POST("/oauth/register", mcpMoved)
	r.GET("/oauth/authorize", mcpMoved)
	r.POST("/mcp/auth/callback", mcpMoved)
	r.POST("/oauth/token", mcpMoved)
	r.POST("/mcp", mcpMoved)
	r.GET("/mcp", mcpMoved)

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

	// Flush PostHog after background tasks settle so any events they enqueue
	// during shutdown still get delivered.
	posthog.Close()
}
