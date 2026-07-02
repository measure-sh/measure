package mcp

import (
	"context"
	"net/http"
	"time"

	"backend/agent/agent"

	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

// NewMCPHandler builds the MCP server: it registers the given tools and
// returns the Streamable HTTP transport handler.
func NewMCPHandler(tools []agent.Tool) http.Handler {
	s := mcpsdk.NewServer(
		&mcpsdk.Implementation{Name: "Measure", Version: "1.0.0"},
		nil,
	)

	for _, t := range tools {
		t.Register(s, observeToolCall)
	}

	return mcpsdk.NewStreamableHTTPHandler(
		func(r *http.Request) *mcpsdk.Server { return s },
		&mcpsdk.StreamableHTTPOptions{Stateless: true},
	)
}

// observeToolCall fires the MCP usage analytics event after a tool call,
// recording whether it succeeded.
func observeToolCall(ctx context.Context, toolName string, duration time.Duration, success bool) {
	if userID, ok := agent.UserIDFromContext(ctx); ok {
		fireMCPQueryEvent(userID, toolName, duration, success)
	}
}
