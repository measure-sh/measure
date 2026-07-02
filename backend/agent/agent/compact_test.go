package agent

import (
	"strings"
	"testing"
)

func lm(role, content string) loadedMessage {
	return loadedMessage{msg: chatMessage{Role: role, Content: content}}
}

func TestElideOldToolResults(t *testing.T) {
	history := []loadedMessage{
		lm("user", "q1"),
		lm("assistant", ""),
		lm("tool", "rows1"),
		lm("assistant", "a1"),
		lm("user", "q2"),
		lm("assistant", ""),
		lm("tool", "rows2"),
		lm("assistant", "a2"),
	}
	elideOldToolResults(history)

	if history[2].msg.Content != elidedToolResult {
		t.Errorf("old tool result should be elided, got %q", history[2].msg.Content)
	}
	if history[6].msg.Content != "rows2" {
		t.Errorf("last turn's tool result should be kept, got %q", history[6].msg.Content)
	}
	if history[3].msg.Content != "a1" {
		t.Errorf("assistant message should be untouched, got %q", history[3].msg.Content)
	}
}

func TestElideOldToolResultsNoUserMessage(t *testing.T) {
	history := []loadedMessage{lm("tool", "rows")}
	elideOldToolResults(history)
	if history[0].msg.Content != "rows" {
		t.Errorf("nothing should be elided without a user message, got %q", history[0].msg.Content)
	}
}

func TestContextTokens(t *testing.T) {
	history := []loadedMessage{
		lm("user", "q1"),
		{msg: chatMessage{Role: "assistant", Content: "a1"}, promptTokens: 100, completionTokens: 10},
		lm("user", "q2"),
		{msg: chatMessage{Role: "assistant", Content: "a2"}, promptTokens: 4000, completionTokens: 50},
	}
	if got := contextTokens(history); got != 4050 {
		t.Errorf("contextTokens = %d, want 4050 (newest assistant row)", got)
	}
	if got := contextTokens([]loadedMessage{lm("user", "q")}); got != 0 {
		t.Errorf("contextTokens without assistant rows = %d, want 0", got)
	}
}

func TestRenderTranscript(t *testing.T) {
	history := []loadedMessage{
		lm("system", "Summary of the conversation so far: earlier facts"),
		lm("user", "how many crashes?"),
		lm("assistant", ""),
		lm("tool", "big result blob"),
		lm("assistant", "42 crashes"),
	}
	got := renderTranscript(history)

	for _, want := range []string{"earlier facts", "how many crashes?", "42 crashes"} {
		if !strings.Contains(got, want) {
			t.Errorf("transcript should contain %q, got:\n%s", want, got)
		}
	}
	if strings.Contains(got, "big result blob") {
		t.Errorf("transcript should skip tool results, got:\n%s", got)
	}
}
