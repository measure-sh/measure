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

// runSlackConsumer keeps a Slack consumer alive for the life of the process.
// Bus connections die (idle session reaping, broker restarts) and Listen
// returns once its client is beyond recovery, so build a fresh client and
// rejoin, backing off between attempts.
func runSlackConsumer(ctx context.Context, config *server.Config, handler func(context.Context, []byte) error) {
	backoff := time.Second
	for ctx.Err() == nil {
		consumer, err := newSlackConsumer(ctx, config)
		// A nil consumer with a nil error means no bus is configured, so there
		// is nothing to supervise; stop for good.
		if consumer == nil && err == nil {
			return
		}
		// With a consumer in hand, run it. A construction error (err != nil)
		// skips this block and falls through to the backoff below.
		if err == nil {
			log.Println("slack consumer listening")
			start := time.Now()
			// Listen blocks for the whole healthy life of the consumer,
			// dispatching each event to handler. It returns only when the bus
			// connection is beyond recovery or when ctx is cancelled.
			err = consumer.Listen(ctx, handler)
			// Listen has returned, so this client is finished. Close frees its
			// socket and consumer-group membership before we build a fresh one.
			consumer.Close()
			// ctx here carries no timeout, so shutdown is the only thing that
			// can cancel it. A non-nil error therefore means Listen returned
			// because we are stopping, not because the bus broke, so exit
			// without retrying.
			if ctx.Err() != nil {
				return
			}
			// Otherwise the bus broke while we were still live. A consumer that
			// lasted a while was healthy, so reset to the base one-second
			// backoff rather than inheriting the growth from an earlier streak
			// of fast failures.
			if time.Since(start) > time.Minute {
				backoff = time.Second
			}
		}
		log.Printf("slack consumer stopped, retrying in %s: %v\n", backoff, err)
		// Wait out the backoff before retrying, staying responsive to shutdown:
		// whichever of the timer and ctx.Done fires first wins.
		select {
		// Shutdown landed during the wait, stop
		case <-ctx.Done():
			return
		// Backoff elapsed, so fall through and loop back to rebuild the consumer.
		case <-time.After(backoff):
		}
		// Each failure waits longer, capped at a minute, so a broker that stays
		// down is not hammered with reconnect attempts.
		backoff = min(backoff*2, time.Minute)
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

	// Attachment URLs in tool results point at this service's origin only
	// outside cloud; in cloud PreSignURL returns direct GCS signed URLs, so
	// the read proxy is registered for self-host only.
	if !config.IsCloud() {
		r.GET("/proxy/attachments", proxyAttachment(deps))
	}

	// MCP OAuth 2.0 Authorization Server endpoints
	r.GET("/.well-known/oauth-authorization-server", mcpH.MCPOAuthMetadata)
	r.POST("/oauth/register", mcpH.MCPRegisterClient)
	r.GET("/oauth/authorize", mcpH.MCPAuthorize)
	r.POST("/mcp/auth/callback", mcpH.MCPCallbackExchange)
	r.POST("/oauth/token", mcpH.MCPToken)

	// MCP Streamable HTTP transport
	mcpHandler := mcp.NewMCPHandler(agent.MCPTools(agentConfig))
	r.POST("/mcp", mcpH.ValidateMCPToken(), gin.WrapH(mcpHandler))
	r.GET("/mcp", mcpH.ValidateMCPToken(), gin.WrapH(mcpHandler))

	// Slack events arrive either by push to an HTTP endpoint or by a background
	// pull consumer. Exactly one is active.
	pushEnabled := os.Getenv("AGENT_SLACK_PUBSUB_PUSH_ENABLED") == "true"

	// Consume Slack questions the api service publishes to the bus.
	// runSlackConsumer supervises the consumer, rebuilding it whenever the
	// connection dies, and runs until consumerCtx is cancelled. stopConsumer is
	// that cancel, called on shutdown below to bring the supervisor down.
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
