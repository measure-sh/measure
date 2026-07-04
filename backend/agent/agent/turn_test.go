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

	args := fmt.Sprintf(`{"query":"select count(*) as n from {{events}}","from":"%s","to":"%s"}`,
		now.Add(-time.Hour).Format(time.RFC3339), now.Add(time.Hour).Format(time.RFC3339))
	toolCall := fmt.Sprintf(
		`{"choices":[{"message":{"role":"assistant","tool_calls":[{"id":"call_1","type":"function","function":{"name":"run_sql","arguments":%s}}]}}],"usage":{"prompt_tokens":50,"completion_tokens":10}}`,
		strconv.Quote(args))
	finalAnswer := `{"choices":[{"message":{"role":"assistant","content":"There were 3 crashes."}}],"usage":{"prompt_tokens":80,"completion_tokens":15,"prompt_tokens_details":{"cached_tokens":40}}}`

	c, stub := newTestAgent(t, toolCall, finalAnswer)

	conv := &conversation{UserID: userID, AppID: appID, TeamID: teamID, Surface: "mcp"}
	if err := c.createConversation(ctx, conv, "crashes?"); err != nil {
		t.Fatalf("createConversation: %v", err)
	}

	answer, _, err := c.runTurn(ctx, turn{
		userID: userID, appID: appID, teamID: teamID,
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
// billing gate, conversation creation, and the turn. A follow-up with the
// returned id continues the same conversation rather than starting a new one.
func TestAskQuestionEndToEnd(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	_, userID, appID := seedTeamUserApp(ctx, t)

	c, stub := newTestAgent(t,
		`{"choices":[{"message":{"role":"assistant","content":"All good."}}],"usage":{"prompt_tokens":20,"completion_tokens":5}}`,
		`{"choices":[{"message":{"role":"assistant","content":"Still good."}}],"usage":{"prompt_tokens":25,"completion_tokens":5}}`,
	)
	ctx = WithUserID(ctx, userID.String())

	out, err := c.askQuestion(ctx, askQuestionInput{AppID: appID.String(), Question: "how is the app?"})
	if err != nil {
		t.Fatalf("askQuestion: %v", err)
	}
	if out.Answer != "All good." {
		t.Errorf("answer = %q, want All good.", out.Answer)
	}
	if out.ConversationID == "" {
		t.Fatal("expected a conversation id")
	}
	if stub.callCount() != 1 {
		t.Errorf("llm calls = %d, want 1", stub.callCount())
	}

	out2, err := c.askQuestion(ctx, askQuestionInput{
		AppID: appID.String(), Question: "and now?", ConversationID: out.ConversationID,
	})
	if err != nil {
		t.Fatalf("askQuestion follow-up: %v", err)
	}
	if out2.ConversationID != out.ConversationID {
		t.Errorf("follow-up started a new conversation: %s vs %s", out2.ConversationID, out.ConversationID)
	}

	// The continued conversation holds both turns: 2 questions + 2 answers.
	cid, _ := uuid.Parse(out.ConversationID)
	loaded, err := c.loadMessages(ctx, cid)
	if err != nil {
		t.Fatalf("loadMessages: %v", err)
	}
	if got := len(loaded); got != 4 {
		t.Errorf("persisted messages = %d, want 4 (two q/a turns): %v", got, msgRoles(loaded))
	}
}
