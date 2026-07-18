//go:build integration

package agent

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"testing"
	"time"

	"backend/testinfra"

	"github.com/google/uuid"
)

func msgRoles(msgs []loadedMessage) []string {
	roles := make([]string, len(msgs))
	for i, m := range msgs {
		roles[i] = m.msg.Role
	}
	return roles
}

// TestRunTurnToolLoop drives a full turn with a scripted LLM: the first call
// asks for run_sql, the second returns the answer. It checks the answer, that
// the tool actually ran against ClickHouse, and that the whole transcript is
// persisted.
func TestRunTurnToolLoop(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, userID, appID := seedTeamUserApp(ctx, t)

	now := time.Now().UTC()
	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 3, testinfra.EventRow{Timestamp: now})

	args := fmt.Sprintf(`{"query":"select count(*) as n from {{events}}","app_ids":["%s"],"from":"%s","to":"%s"}`,
		appID, now.Add(-time.Hour).Format(time.RFC3339), now.Add(time.Hour).Format(time.RFC3339))
	toolCall := fmt.Sprintf(
		`{"choices":[{"message":{"role":"assistant","tool_calls":[{"id":"call_1","type":"function","function":{"name":"run_sql","arguments":%s}}]}}],"usage":{"prompt_tokens":50,"completion_tokens":10}}`,
		strconv.Quote(args))
	finalAnswer := `{"choices":[{"message":{"role":"assistant","content":"There were 3 crashes."}}],"usage":{"prompt_tokens":80,"completion_tokens":15,"prompt_tokens_details":{"cached_tokens":40}}}`

	c, stub := newTestAgent(t, toolCall, finalAnswer)

	conv := &conversation{UserID: userID, TeamID: teamID, Surface: "mcp"}
	if err := c.createConversation(ctx, conv, "crashes?"); err != nil {
		t.Fatalf("createConversation: %v", err)
	}

	answer, _, err := c.runTurn(ctx, turn{
		userID: userID, teamID: teamID,
		conv: conv, question: "how many crashes?", entryPoint: "mcp",
	})
	if err != nil {
		t.Fatalf("runTurn: %v", err)
	}
	if answer != "There were 3 crashes." {
		t.Errorf("answer = %q, want %q", answer, "There were 3 crashes.")
	}
	if stub.callCount() != 2 {
		t.Errorf("llm calls = %d, want 2 (tool call + answer)", stub.callCount())
	}

	loaded, err := c.loadMessages(ctx, conv.ID)
	if err != nil {
		t.Fatalf("loadMessages: %v", err)
	}
	roles := msgRoles(loaded)
	want := []string{"user", "assistant", "tool", "assistant"}
	if len(roles) != len(want) {
		t.Fatalf("persisted roles = %v, want %v", roles, want)
	}
	for i := range want {
		if roles[i] != want[i] {
			t.Fatalf("persisted roles = %v, want %v", roles, want)
		}
	}
	if !strings.Contains(loaded[2].msg.Content, "3") {
		t.Errorf("tool result should carry the count, got %q", loaded[2].msg.Content)
	}
}

// TestAskQuestionEndToEnd drives the MCP entry point: authz, the (no-customer)
// billing gate, and the turn. ask_question is stateless: each call runs as its
// own conversation, so a follow-up gets a fresh transcript and carries any
// context it needs in the question itself.
func TestAskQuestionEndToEnd(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	_, userID, appID := seedTeamUserApp(ctx, t)

	c, stub := newTestAgent(t,
		`{"choices":[{"message":{"role":"assistant","content":"All good."}}],"usage":{"prompt_tokens":20,"completion_tokens":5}}`,
		`{"choices":[{"message":{"role":"assistant","content":"Still good."}}],"usage":{"prompt_tokens":25,"completion_tokens":5}}`,
	)
	ctx = WithUserID(ctx, userID.String())

	out, err := c.askQuestion(ctx, askQuestionInput{AppIDs: []string{appID.String()}, Question: "how is the app?"})
	if err != nil {
		t.Fatalf("askQuestion: %v", err)
	}
	if out.Answer != "All good." {
		t.Errorf("answer = %q, want All good.", out.Answer)
	}
	if stub.callCount() != 1 {
		t.Errorf("llm calls = %d, want 1", stub.callCount())
	}

	out2, err := c.askQuestion(ctx, askQuestionInput{AppIDs: []string{appID.String()}, Question: "and now?"})
	if err != nil {
		t.Fatalf("askQuestion follow-up: %v", err)
	}
	if out2.Answer != "Still good." {
		t.Errorf("answer = %q, want Still good.", out2.Answer)
	}

	// Two calls, two conversations: each holds one question + one answer,
	// with the caller's focus appended to the question rather than stored
	// as its own row.
	rows, err := deps.PgPool.Query(ctx,
		`select id from measure.agent_conversations where user_id = $1`, userID)
	if err != nil {
		t.Fatalf("query conversations: %v", err)
	}
	defer rows.Close()
	var convIDs []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			t.Fatalf("scan conversation id: %v", err)
		}
		convIDs = append(convIDs, id)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("read conversations: %v", err)
	}
	if len(convIDs) != 2 {
		t.Fatalf("conversations = %d, want 2 (one per call)", len(convIDs))
	}
	for _, cid := range convIDs {
		loaded, err := c.loadMessages(ctx, cid)
		if err != nil {
			t.Fatalf("loadMessages: %v", err)
		}
		if got := len(loaded); got != 2 {
			t.Errorf("conversation %s: persisted messages = %d, want 2 (one q/a pair): %v", cid, got, msgRoles(loaded))
			continue
		}
		if loaded[0].msg.Role != "user" || !strings.Contains(loaded[0].msg.Content, "The caller asked about these apps") {
			t.Errorf("the question should carry the focus note, got role %q content %q", loaded[0].msg.Role, loaded[0].msg.Content)
		}
	}
}

// TestAskQuestionMultiApp drives ask_question with two apps of one team: the
// turn's system message lists both and the focus note names
// both, so the model can compare them in one turn.
func TestAskQuestionMultiApp(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, userID, appID := seedTeamUserApp(ctx, t)
	secondApp := uuid.New()
	seedApp(ctx, t, secondApp, teamID, "second", 30)

	c, stub := newTestAgent(t,
		`{"choices":[{"message":{"role":"assistant","content":"App one: 3, second: 5."}}],"usage":{"prompt_tokens":20,"completion_tokens":5}}`,
	)
	ctx = WithUserID(ctx, userID.String())

	out, err := c.askQuestion(ctx, askQuestionInput{
		AppIDs:   []string{appID.String(), secondApp.String()},
		Question: "compare crashes across both apps",
	})
	if err != nil {
		t.Fatalf("askQuestion: %v", err)
	}
	if out.Answer == "" {
		t.Fatal("expected an answer")
	}

	req := string(stub.requests[0])
	for _, want := range []string{"The team's apps", appID.String(), secondApp.String(), "The caller asked about these apps"} {
		if !strings.Contains(req, want) {
			t.Errorf("turn request missing %q", want)
		}
	}
	if !strings.Contains(req, "second (second)") {
		t.Errorf("focus note should carry the second app's label, got request without it")
	}
	// MCP turns carry the method rule: the stateless caller quotes the
	// Method line back in follow-ups.
	if !strings.Contains(req, "each call reaches you with no memory of earlier ones") {
		t.Error("mcp turn request should carry the method rule")
	}
}
