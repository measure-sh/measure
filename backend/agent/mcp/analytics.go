package mcp

import (
	"time"

	"backend/libs/posthog"
)

// fireMCPQueryEvent fires the PostHog `mcp_query_made` event after an MCP tool
// invocation. Fired whether or not the tool succeeded; success tells them
// apart. Called from the observeToolCall hook that NewMCPHandler attaches to
// every registered tool.
func fireMCPQueryEvent(userID, toolName string, duration time.Duration, success bool) {
	posthog.Capture(userID, "mcp_query_made", map[string]any{
		"schema_version": "v1",
		"tool_name":      toolName,
		"duration_ms":    duration.Milliseconds(),
		"success":        success,
		"feature_area":   "mcp",
		"entry_point":    "mcp",
	}, nil)
}
