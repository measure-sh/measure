//go:build integration

package agent

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

// TestConversationRoundtrip checks createConversation assigns an id and
// persists the row intact.
func TestConversationRoundtrip(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, userID, _ := seedTeamUserApp(ctx, t)
	c := &Config{Deps: deps}

	conv := &conversation{UserID: userID, TeamID: teamID, Surface: "mcp"}
	if err := c.createConversation(ctx, conv, "first question"); err != nil {
		t.Fatalf("createConversation: %v", err)
	}
	if conv.ID == uuid.Nil {
		t.Fatal("createConversation did not assign an id")
	}

	var gotUser, gotTeam uuid.UUID
	var gotSurface string
	if err := deps.PgPool.QueryRow(ctx,
		`select user_id, team_id, surface from measure.agent_conversations where id = $1`, conv.ID).
		Scan(&gotUser, &gotTeam, &gotSurface); err != nil {
		t.Fatalf("read conversation row: %v", err)
	}
	if gotUser != userID || gotTeam != teamID || gotSurface != "mcp" {
		t.Errorf("roundtrip mismatch: user %s team %s surface %q", gotUser, gotTeam, gotSurface)
	}
}

// TestFindSlackConversation checks a slack-surface conversation is found by its
// channel + thread coordinates, and that an unknown thread returns nil.
func TestFindSlackConversation(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, userID, _ := seedTeamUserApp(ctx, t)
	c := &Config{Deps: deps}

	conv := &conversation{
		UserID: userID, TeamID: teamID,
		Surface:        "slack_assistant",
		SlackChannelID: "C123", SlackThreadTS: "1700000000.0001", SlackUserID: "U123",
	}
	if err := c.createConversation(ctx, conv, "slack q"); err != nil {
		t.Fatalf("createConversation: %v", err)
	}

	t.Run("found by channel + thread", func(t *testing.T) {
		got, err := c.findSlackConversation(ctx, "C123", "1700000000.0001")
		if err != nil {
			t.Fatalf("findSlackConversation: %v", err)
		}
		if got == nil || got.ID != conv.ID {
			t.Fatalf("want conv %s, got %+v", conv.ID, got)
		}
	})

	t.Run("nil for unknown thread", func(t *testing.T) {
		got, err := c.findSlackConversation(ctx, "C123", "9999999999.0001")
		if err != nil {
			t.Fatalf("findSlackConversation: %v", err)
		}
		if got != nil {
			t.Errorf("want nil for unknown thread, got %+v", got)
		}
	})
}

// TestSetSlackContextThrough checks the high-water mark is persisted and read
// back.
func TestSetSlackContextThrough(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, userID, _ := seedTeamUserApp(ctx, t)
	c := &Config{Deps: deps}

	conv := &conversation{
		UserID: userID, TeamID: teamID,
		Surface:        "slack_assistant",
		SlackChannelID: "C1", SlackThreadTS: "1.1", SlackUserID: "U1",
	}
	if err := c.createConversation(ctx, conv, "q"); err != nil {
		t.Fatalf("createConversation: %v", err)
	}

	if err := c.setSlackContextThrough(ctx, conv.ID, "1700000000.5"); err != nil {
		t.Fatalf("setSlackContextThrough: %v", err)
	}
	got, err := c.findSlackConversation(ctx, "C1", "1.1")
	if err != nil {
		t.Fatalf("findSlackConversation: %v", err)
	}
	if got == nil {
		t.Fatal("conversation not found by its thread")
	}
	if got.SlackContextThroughTS != "1700000000.5" {
		t.Errorf("through ts = %q, want 1700000000.5", got.SlackContextThroughTS)
	}
}

// TestAppendAndLoadMessages checks a turn's messages round-trip, that
// loadMessages reads the prompt/completion tokens it needs for the compaction
// threshold, and that the write-only reasoning/cache columns are persisted.
func TestAppendAndLoadMessages(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, userID, _ := seedTeamUserApp(ctx, t)
	c := &Config{Deps: deps}

	conv := &conversation{UserID: userID, TeamID: teamID, Surface: "mcp"}
	if err := c.createConversation(ctx, conv, "q"); err != nil {
		t.Fatalf("createConversation: %v", err)
	}

	usage := chatUsage{PromptTokens: 100, CompletionTokens: 20}
	usage.PromptDetails.CachedTokens = 40
	usage.PromptDetails.CacheWriteTokens = 10
	usage.CompletionDetails.ReasoningTokens = 5
	if err := c.appendMessages(ctx, conv.ID, []storedMessage{
		{msg: chatMessage{Role: "user", Content: "how many crashes?"}},
		{msg: chatMessage{Role: "assistant", Content: "42 crashes"}, model: "test-medium", usage: usage},
	}); err != nil {
		t.Fatalf("appendMessages: %v", err)
	}

	loaded, err := c.loadMessages(ctx, conv.ID)
	if err != nil {
		t.Fatalf("loadMessages: %v", err)
	}
	if len(loaded) != 2 {
		t.Fatalf("want 2 messages, got %d", len(loaded))
	}
	if loaded[0].msg.Role != "user" || loaded[1].msg.Role != "assistant" {
		t.Errorf("roles/order = %q,%q, want user,assistant", loaded[0].msg.Role, loaded[1].msg.Role)
	}
	if loaded[1].msg.Content != "42 crashes" {
		t.Errorf("assistant content = %q", loaded[1].msg.Content)
	}
	if loaded[1].promptTokens != 100 || loaded[1].completionTokens != 20 {
		t.Errorf("loaded tokens = (%d,%d), want (100,20)", loaded[1].promptTokens, loaded[1].completionTokens)
	}

	// reasoning/cache columns aren't read back by loadMessages, so assert them
	// straight from the row.
	var reasoning, cacheRead, cacheWrite int
	err = deps.PgPool.QueryRow(ctx,
		`select coalesce(reasoning_tokens, 0), coalesce(cache_read_tokens, 0), coalesce(cache_write_tokens, 0)
		   from measure.agent_messages where conversation_id = $1 and role = 'assistant'`,
		conv.ID).Scan(&reasoning, &cacheRead, &cacheWrite)
	if err != nil {
		t.Fatalf("scan token columns: %v", err)
	}
	if reasoning != 5 || cacheRead != 40 || cacheWrite != 10 {
		t.Errorf("stored (reasoning, cacheRead, cacheWrite) = (%d, %d, %d), want (5, 40, 10)", reasoning, cacheRead, cacheWrite)
	}
}

// TestCompactionSkipsSummarizedMessages checks that after a summary row is
// written through a given message, loadMessages returns the summary first and
// skips the messages it covers, keeping the rest.
func TestCompactionSkipsSummarizedMessages(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, userID, _ := seedTeamUserApp(ctx, t)
	c := &Config{Deps: deps}

	conv := &conversation{UserID: userID, TeamID: teamID, Surface: "mcp"}
	if err := c.createConversation(ctx, conv, "q"); err != nil {
		t.Fatalf("createConversation: %v", err)
	}

	if err := c.appendMessages(ctx, conv.ID, []storedMessage{
		{msg: chatMessage{Role: "user", Content: "q1"}},
		{msg: chatMessage{Role: "assistant", Content: "a1"}, model: "m"},
	}); err != nil {
		t.Fatalf("append turn 1: %v", err)
	}
	if err := c.appendMessages(ctx, conv.ID, []storedMessage{
		{msg: chatMessage{Role: "user", Content: "q2"}},
		{msg: chatMessage{Role: "assistant", Content: "a2"}, model: "m"},
	}); err != nil {
		t.Fatalf("append turn 2: %v", err)
	}

	loaded, err := c.loadMessages(ctx, conv.ID)
	if err != nil {
		t.Fatalf("loadMessages: %v", err)
	}
	if len(loaded) != 4 {
		t.Fatalf("want 4 messages before compaction, got %d", len(loaded))
	}

	// Summarize through the end of turn 1 (the 2nd message).
	through := loaded[1].id
	summary := chatMessage{Role: "system", Content: "Summary: user asked q1, got a1."}
	if err := c.insertSummary(ctx, conv.ID, summary, through, "test-small", chatUsage{PromptTokens: 30, CompletionTokens: 8}); err != nil {
		t.Fatalf("insertSummary: %v", err)
	}

	loaded, err = c.loadMessages(ctx, conv.ID)
	if err != nil {
		t.Fatalf("loadMessages after compaction: %v", err)
	}
	if len(loaded) != 3 {
		t.Fatalf("want 3 messages after compaction, got %d: %+v", len(loaded), loaded)
	}
	if !loaded[0].summary || loaded[0].msg.Content != summary.Content {
		t.Errorf("first loaded should be the summary, got %+v", loaded[0])
	}
	if loaded[1].msg.Content != "q2" || loaded[2].msg.Content != "a2" {
		t.Errorf("post-summary messages = %q,%q, want q2,a2", loaded[1].msg.Content, loaded[2].msg.Content)
	}
}
