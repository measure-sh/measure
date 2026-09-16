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

	"backend/agent/agent"
	"backend/agent/mcp"
	"backend/agent/server"
	"backend/libs/bus"
	"backend/libs/concur"
	"backend/libs/inet"
	"backend/libs/middleware"
	"backend/libs/posthog"
	"backend/libs/slack"

	"cloud.google.com/go/pubsub/v2"
	"github.com/gin-gonic/gin"

	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
)

// maxConcurrentSlackTurns caps how many questions Pub/Sub hands the agent at
// once; each one runs a full LLM turn in its handler. Events carry per-thread
// ordering keys, so the concurrent questions are always from different
// threads; this needs the subscription created with message ordering
// enabled. Iggy (self-host) delivers strictly one at a time, so no cap is
// needed there.
const maxConcurrentSlackTurns = 4

// newSlackConsumer builds the bus consumer carrying Slack events published
// to the queue by the api service. A nil consumer with a nil error means no
// bus is configured; the agent then runs without Slack.
func newSlackConsumer(ctx context.Context, config *server.Config) (bus.Consumer, error) {
	if config.IsCloud() {
		subscription := os.Getenv("AGENT_SLACK_PUBSUB_SUBSCRIPTION")
		if subscription == "" {
			log.Println("AGENT_SLACK_PUBSUB_SUBSCRIPTION env var is not set, the Slack agent will not work")
			return nil, nil
		}
		return bus.NewPubSubConsumer(ctx, subscription,
			bus.WithPubSubReceiveSettings(pubsub.ReceiveSettings{MaxOutstandingMessages: maxConcurrentSlackTurns}))
	}

	if config.IG.Addr == "" {
		return nil, nil
	}
	return bus.NewIggyGroupConsumer(
		config.IG.Addr,
		config.IG.Username,
		config.IG.Password,
		"agent-slack-consumer",
		bus.DefaultStreamName,
		slack.AgentEventsTopic,
	)
}

// runSlackConsumer consumes Slack questions until ctx is cancelled. The
// consumer stopping for any other reason is unrecoverable, so the process
// exits.
func runSlackConsumer(ctx context.Context, config *server.Config, handler func(context.Context, []byte) error) {
	consumer, err := newSlackConsumer(ctx, config)
	if err != nil {
		log.Fatalf("failed to create slack consumer: %v", err)
	}
	if consumer == nil {
		return
	}
	defer consumer.Close()
	log.Println("slack consumer listening")
	if err := consumer.Listen(ctx, handler); err != nil && ctx.Err() == nil {
		log.Fatalf("slack consumer stopped: %v", err)
	}
}

func main() {
	config := server.NewConfig()
	deps := server.Connect(config)

	agentConfig := agent.NewConfig()
	agentConfig.Deps = deps

	// Handlers bound to the process infrastructure; their methods are the
	// HTTP route handlers and middleware registered below.
	mcpH := mcp.NewHandlers(deps)

	defer deps.PgPool.Close()
	if deps.VK != nil {
		defer deps.VK.Close()
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

	closeTracer := server.InitTracing(config)
	// Close OTel tracer
	defer func() {
		if err := closeTracer(context.Background()); err != nil {
			log.Fatalf("Unable to close OTel tracer: %v", err)
		}
	}()

	r.Use(otelgin.Middleware(config.OtelServiceName))
	r.Use(middleware.CaptureRequest())
	r.Use(middleware.CapturePanic())
	r.Use(middleware.CaptureErrorBody())

	// health check
	r.GET("/ping", func(c *gin.Context) {
		c.String(http.StatusOK, "pong")
	})

	// ask well-behaved crawlers not to fetch any route in this service
	r.GET("/robots.txt", func(c *gin.Context) {
		c.String(http.StatusOK, "User-agent: *\nDisallow: /\n")
	})

	// Attachment URLs in tool results point at this service's origin only
	// outside cloud; in cloud PreSignURL returns direct GCS signed URLs, so
	// the read proxy is registered for self-host only.
	if !config.IsCloud() {
		r.GET("/proxy/attachments", proxyAttachment(deps))
	}

	// MCP OAuth 2.0 Authorization Server endpoints
	r.GET("/.well-known/oauth-protected-resource", mcpH.MCPProtectedResourceMetadata)
	r.GET("/.well-known/oauth-protected-resource/mcp", mcpH.MCPEndpointProtectedResourceMetadata)
	r.GET("/.well-known/oauth-authorization-server", mcpH.MCPOAuthMetadata)
	r.POST("/oauth/register", mcpH.MCPRegisterClient)
	r.GET("/oauth/authorize", mcpH.MCPAuthorize)
	r.POST("/mcp/auth/callback", mcpH.MCPCallbackExchange)
	r.POST("/oauth/token", mcpH.MCPToken)

	// MCP Streamable HTTP transport. GET and DELETE are routed so clients on
	// older protocol revisions get the transport's 405 rather than Gin's 404.
	mcpHandler := mcp.NewMCPHandler(agent.MCPTools(agentConfig))
	r.POST("/mcp", mcpH.ValidateMCPToken(), gin.WrapH(mcpHandler))
	r.GET("/mcp", mcpH.ValidateMCPToken(), gin.WrapH(mcpHandler))
	r.DELETE("/mcp", mcpH.ValidateMCPToken(), gin.WrapH(mcpHandler))

	// Slack events arrive either by push to an HTTP endpoint or by a background
	// pull consumer. Exactly one is active.
	pushEnabled := os.Getenv("AGENT_SLACK_PUBSUB_PUSH_ENABLED") == "true"

	// Consume Slack questions the api service publishes to the bus until
	// shutdown.
	consumerCtx, stopConsumer := context.WithCancel(context.Background())
	defer stopConsumer()

	if config.IsCloud() && pushEnabled {
		// The token audience is this service's origin plus the push path.
		audience := config.AgentOrigin + "/subscribe/slack"
		r.POST("/subscribe/slack", slackPushHandler(agentConfig, audience))
	} else {
		go runSlackConsumer(consumerCtx, config, agentConfig.HandleSlackEvent)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8084"
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
	fmt.Println("Shutting down agent service...")

	// Stop the consumer. A turn in flight aborts without acking its event,
	// which then re-runs after restart.
	stopConsumer()

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
