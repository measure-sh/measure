//go:build integration

package agent

import (
	"context"
	"errors"
	"strings"
	"testing"

	"backend/libs/slack"
	slacktest "backend/libs/slack/testhelpers"

	"github.com/google/uuid"
)

// TestDeliverSlackReplyFallsBackToFreshPost checks that when editing the ack
// placeholder fails, the answer is posted fresh instead of being lost.
func TestDeliverSlackReplyFallsBackToFreshPost(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	const email = "fallback@test.dev"
	teamID, userID, appID := uuid.New(), uuid.New(), uuid.New()
	seedTeam(ctx, t, teamID, "team")
	seedUser(ctx, t, userID, email)
	seedTeamMembership(ctx, t, teamID, userID, "owner")
	seedApp(ctx, t, appID, teamID, "soleapp", 30)
	seedTeamSlack(ctx, t, teamID, []string{"C1"})

	slacktest.MockUserEmail(t, func(context.Context, string, string) (string, error) { return email, nil })
	slacktest.MockSetAssistantStatus(t, func(context.Context, string, string, string, string) error { return nil })
	slacktest.MockConversationHistory(t, func(context.Context, string, string, int) ([]slack.Message, error) { return nil, nil })
	slacktest.MockConversationReplies(t, func(context.Context, string, string, string, string, int) ([]slack.Message, error) { return nil, nil })

	var posts []string
	slacktest.MockPostMessage(t, func(_ context.Context, _, _, _, text string) (string, error) {
		posts = append(posts, text)
		return "ack.1", nil
	})
	updateAttempted := false
	slacktest.MockUpdateMessage(t, func(context.Context, string, string, string, string) error {
		updateAttempted = true
		return errors.New("message_not_found")
	})

	c, _ := newTestAgent(t, `{"choices":[{"message":{"role":"assistant","content":"Fresh answer."}}],"usage":{"prompt_tokens":10,"completion_tokens":3}}`)
	handleSlackQuestion(t, c, slackQuestionEvent(teamID, slack.SurfaceMention, "how is the app?", "Ev-fallback"))

	if !updateAttempted {
		t.Error("expected an UpdateMessage attempt on the ack placeholder")
	}
	// First PostMessage is the ack placeholder; the second is the fresh answer.
	if len(posts) != 2 {
		t.Fatalf("PostMessage calls = %d, want 2 (ack + fresh post): %v", len(posts), posts)
	}
	if !strings.Contains(posts[1], "Fresh answer") {
		t.Errorf("fresh post = %q, want the answer", posts[1])
	}
}

// TestSlackChannelUnreachableSkipsTurn checks that when the ack can't be posted
// because the channel is unreachable, the turn is skipped rather than burning
// LLM calls on an answer that can't be delivered.
func TestSlackChannelUnreachableSkipsTurn(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, _, _ := seedTeamUserApp(ctx, t)
	seedTeamSlack(ctx, t, teamID, []string{"C1"})

	slacktest.MockPostMessage(t, func(context.Context, string, string, string, string) (string, error) {
		return "", errors.New("channel_not_found")
	})
	c, stub := newTestAgent(t) // no scripted responses; the turn must not start

	handleSlackQuestion(t, c, slackQuestionEvent(teamID, slack.SurfaceMention, "how is the app?", "Ev-unreachable"))
	if stub.callCount() != 0 {
		t.Errorf("llm called %d times, want 0 (turn skipped when channel unreachable)", stub.callCount())
	}
}

// TestSlackNoIntegrationBails checks that a team with no active Slack
// integration produces no turn and no Slack calls.
func TestSlackNoIntegrationBails(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, _, _ := seedTeamUserApp(ctx, t) // no seedTeamSlack: no integration
	c, stub := newTestAgent(t)

	handleSlackQuestion(t, c, slackQuestionEvent(teamID, slack.SurfaceAssistant, "how is the app?", "Ev-nointeg"))
	if stub.callCount() != 0 {
		t.Errorf("llm called %d times, want 0 (no slack integration → bail)", stub.callCount())
	}
}

// TestSlackDisabledIntegrationPostsNotice checks that when a team has paused its
// Slack integration, the agent posts a notice explaining it's disabled instead
// of running a turn, and a redelivery of the same event doesn't repost it.
func TestSlackDisabledIntegrationPostsNotice(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, _, _ := seedTeamUserApp(ctx, t)
	seedTeamSlack(ctx, t, teamID, []string{"C1"})
	if _, err := deps.PgPool.Exec(ctx,
		"UPDATE measure.team_slack SET is_active = false WHERE team_id = $1", teamID); err != nil {
		t.Fatalf("disable slack integration: %v", err)
	}

	var posts []string
	slacktest.MockPostMessage(t, func(_ context.Context, _, _, _, text string) (string, error) {
		posts = append(posts, text)
		return "notice.1", nil
	})

	c, stub := newTestAgent(t) // no scripted responses; the turn must not start
	handleSlackQuestion(t, c, slackQuestionEvent(teamID, slack.SurfaceMention, "how is the app?", "Ev-disabled"))

	if stub.callCount() != 0 {
		t.Errorf("llm called %d times, want 0 (turn must not run when disabled)", stub.callCount())
	}
	if len(posts) != 1 {
		t.Fatalf("PostMessage calls = %d, want 1 (the disabled notice): %v", len(posts), posts)
	}
	// The shared test deps configure no site origin, so the notice carries
	// the plain word rather than a dashboard link.
	if posts[0] != slackDisabledNotice("dashboard") {
		t.Errorf("notice = %q, want the disabled notice", posts[0])
	}

	// Redelivery of the same event is deduped: no second notice.
	posts = nil
	handleSlackQuestion(t, c, slackQuestionEvent(teamID, slack.SurfaceMention, "how is the app?", "Ev-disabled"))
	if len(posts) != 0 {
		t.Errorf("redelivery posted %v, want nothing (deduped)", posts)
	}
}

// TestResolveAppFromContextUsesModel checks the LLM-driven app resolution: when
// the team has several apps and the discussion describes one only loosely, the
// small model picks it from the surrounding context.
func TestResolveAppFromContextUsesModel(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	apps := []slackApp{
		{id: uuid.New(), name: "alpha", uniqueIdentifier: "com.x.alpha"},
		{id: uuid.New(), name: "bravo", uniqueIdentifier: "com.x.bravo"},
	}
	// The discussion names no app outright, so the exact match fails and the
	// small model decides from the loose description.
	msgs := []slack.Message{{User: "U2", Text: "the prod build keeps crashing on startup", TS: "1"}}
	slacktest.MockConversationHistory(t, func(context.Context, string, string, int) ([]slack.Message, error) { return msgs, nil })
	slacktest.MockConversationReplies(t, func(context.Context, string, string, string, string, int) ([]slack.Message, error) { return msgs, nil })

	c, stub := newTestAgent(t, `{"choices":[{"message":{"role":"assistant","content":"2"}}],"usage":{"prompt_tokens":15,"completion_tokens":1}}`)
	ev := slack.AgentEvent{Surface: slack.SurfaceMention, Channel: "C1", ThreadTS: "1.1", EventTS: "9", SlackUserID: "U1"}

	resolved, _, ok := c.resolveAppFromContext(ctx, "tok", "Ubot", ev, apps)
	if !ok {
		t.Fatal("expected the model to resolve an app from context")
	}
	if resolved.id != apps[1].id {
		t.Errorf("resolved %s, want bravo %s", resolved.id, apps[1].id)
	}
	if stub.callCount() != 1 {
		t.Errorf("llm calls = %d, want 1 (the app-resolution call)", stub.callCount())
	}
}
