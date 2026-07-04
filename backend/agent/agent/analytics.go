package agent

import (
	"time"

	"backend/libs/posthog"
)

// agentQueryEvent carries the metadata for one agent turn.
type agentQueryEvent struct {
	appID            string
	teamID           string
	conversationID   string
	continued        bool
	entryPoint       string
	llmCalls         int
	promptTokens     int
	completionTokens int
	reasoningTokens  int
	cacheReadTokens  int
	cacheWriteTokens int
	// budgetExhaustedAnswer marks a turn answered by the forced final call;
	// its rate says whether the LLM-call budget is sized right.
	budgetExhaustedAnswer bool
	duration              time.Duration
	success               bool
}

// fireAgentQueryEvent fires the PostHog `agent_query_made` event for one
// agent turn, follow-ups included. Fired whether or not the turn succeeded;
// success tells them apart.
func fireAgentQueryEvent(userID string, e agentQueryEvent) {
	posthog.Capture(userID, "agent_query_made", map[string]any{
		"schema_version":          "v1",
		"app_id":                  e.appID,
		"team_id":                 e.teamID,
		"conversation_id":         e.conversationID,
		"conversation_continued":  e.continued,
		"llm_calls":               e.llmCalls,
		"prompt_tokens":           e.promptTokens,
		"completion_tokens":       e.completionTokens,
		"reasoning_tokens":        e.reasoningTokens,
		"cache_read_tokens":       e.cacheReadTokens,
		"cache_write_tokens":      e.cacheWriteTokens,
		"budget_exhausted_answer": e.budgetExhaustedAnswer,
		"duration_ms":             e.duration.Milliseconds(),
		"success":                 e.success,
		"feature_area":            "agent",
		"entry_point":             e.entryPoint,
	}, nil)
}
