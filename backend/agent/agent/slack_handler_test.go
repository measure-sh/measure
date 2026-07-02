//go:build integration

package agent

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"backend/libs/slack"
	slacktest "backend/libs/slack/testhelpers"

	"github.com/google/uuid"
)

// TestGreetAssistantThread checks that opening the agent's DM sets the starter
// prompts, with the team's bot token and no thread (Agent view).
func TestGreetAssistantThread(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, _, _ := seedTeamUserApp(ctx, t)
	seedTeamSlack(ctx, t, teamID, []string{"C123"})

	var gotToken string
	var gotPrompts []slack.SuggestedPrompt
	slacktest.MockSetAssistantSuggestedPrompts(t, func(_ context.Context, token, _ string, prompts []slack.SuggestedPrompt) error {
		gotToken = token
		gotPrompts = prompts
		return nil
	})

	c := &Config{Deps: deps}
	c.greetAssistantThread(ctx, slack.AgentEvent{
		Kind: slack.KindGreeting, Surface: slack.SurfaceAssistant,
		TeamID: teamID.String(), Channel: "C123", EventID: "Ev1",
	})

	if gotToken != "xoxb-test-token" {
		t.Errorf("bot token = %q, want xoxb-test-token", gotToken)
	}
	if len(gotPrompts) == 0 {
		t.Error("expected starter prompts to be set")
	}
}

// TestAnswerSlackQuestionAssistant drives a question end to end on the assistant
// surface: resolve the Slack user to a seeded member, auto-pick the team's only
// app, run the turn with a scripted answer, and deliver the reply to the thread.
// A redelivery of the same event is deduped and delivers nothing further.
func TestAnswerSlackQuestionAssistant(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	const email = "slackuser@test.dev"
	teamID, userID, appID := uuid.New(), uuid.New(), uuid.New()
	seedTeam(ctx, t, teamID, "team")
	seedUser(ctx, t, userID, email)
	seedTeamMembership(ctx, t, teamID, userID, "owner")
	seedApp(ctx, t, appID, teamID, "myapp", 30)
	seedTeamSlack(ctx, t, teamID, []string{"C123"})

	// Slack profile resolves to the seeded member's email; thread/channel
	// history is empty so nothing extra is summarized.
	slacktest.MockUserEmail(t, func(context.Context, string, string) (string, error) { return email, nil })
	slacktest.MockSetAssistantStatus(t, func(context.Context, string, string, string, string) error { return nil })
	slacktest.MockSetAssistantTitle(t, func(context.Context, string, string, string, string) error { return nil })
	slacktest.MockConversationHistory(t, func(context.Context, string, string, int) ([]slack.Message, error) { return nil, nil })
	slacktest.MockConversationReplies(t, func(context.Context, string, string, string, string, int) ([]slack.Message, error) { return nil, nil })

	var delivered string
	capture := func(text string) { delivered = text }
	slacktest.MockPostMessage(t, func(_ context.Context, _, _, _, text string) (string, error) {
		capture(text)
		return "1700000000.9", nil
	})
	slacktest.MockUpdateMessage(t, func(_ context.Context, _, _, _, text string) error {
		capture(text)
		return nil
	})

	c, stub := newTestAgent(t,
		`{"choices":[{"message":{"role":"assistant","content":"The app is healthy."}}],"usage":{"prompt_tokens":20,"completion_tokens":6}}`)

	ev := slack.AgentEvent{
		Kind: slack.KindQuestion, Surface: slack.SurfaceAssistant,
		TeamID: teamID.String(), SlackTeamID: "T1", Channel: "C123",
		ThreadTS: "1700000000.1", EventTS: "1700000000.1",
		SlackUserID: "U1", Text: "how is the app?", EventID: "Ev-slack-1",
	}
	data, _ := json.Marshal(ev)

	if err := c.HandleSlackEvent(ctx, data); err != nil {
		t.Fatalf("HandleSlackEvent: %v", err)
	}
	if !strings.Contains(delivered, "The app is healthy") {
		t.Errorf("delivered reply = %q, want it to contain the answer", delivered)
	}
	if stub.callCount() != 1 {
		t.Errorf("llm calls = %d, want 1 (the single turn)", stub.callCount())
	}

	// The thread now has a conversation with the persisted turn.
	conv, err := c.findSlackConversation(ctx, "C123", "1700000000.1")
	if err != nil || conv == nil {
		t.Fatalf("expected a slack conversation, got conv=%v err=%v", conv, err)
	}

	// Redelivery of the same event id is deduped: no further LLM call.
	delivered = ""
	if err := c.HandleSlackEvent(ctx, data); err != nil {
		t.Fatalf("HandleSlackEvent (redelivery): %v", err)
	}
	if stub.callCount() != 1 {
		t.Errorf("llm calls after redelivery = %d, want still 1 (deduped)", stub.callCount())
	}
	if delivered != "" {
		t.Errorf("redelivery delivered %q, want nothing", delivered)
	}
}
