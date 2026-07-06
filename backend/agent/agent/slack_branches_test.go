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
	slacktest.MockThreadMessageExists(t, func(context.Context, string, string, string, string) (bool, error) { return true, nil })

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

// TestSlackQuestionDeletedStaysSilent checks that a question deleted while
// the turn ran gets no reply: the ack placeholder is removed, nothing else is
// posted, and a redelivery of the event posts nothing either. What is checked
// is the question's own message, so a question inside a thread is dropped
// only when it is itself deleted, not when the thread's root is.
func TestSlackQuestionDeletedStaysSilent(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	const email = "deleter@test.dev"
	teamID, userID, appID := uuid.New(), uuid.New(), uuid.New()
	seedTeam(ctx, t, teamID, "team")
	seedUser(ctx, t, userID, email)
	seedTeamMembership(ctx, t, teamID, userID, "owner")
	seedApp(ctx, t, appID, teamID, "soleapp", 30)
	seedTeamSlack(ctx, t, teamID, []string{"C1"})

	slacktest.MockUserEmail(t, func(context.Context, string, string) (string, error) { return email, nil })
	slacktest.MockConversationHistory(t, func(context.Context, string, string, int) ([]slack.Message, error) { return nil, nil })
	slacktest.MockConversationReplies(t, func(context.Context, string, string, string, string, int) ([]slack.Message, error) { return nil, nil })
	var checkedThreadRootTS, checkedMessageTS string
	slacktest.MockThreadMessageExists(t, func(_ context.Context, _, _, threadRootTS, messageTS string) (bool, error) {
		checkedThreadRootTS, checkedMessageTS = threadRootTS, messageTS
		return false, nil
	})

	var posts []string
	slacktest.MockPostMessage(t, func(_ context.Context, _, _, _, text string) (string, error) {
		posts = append(posts, text)
		return "ack.1", nil
	})
	updated := false
	slacktest.MockUpdateMessage(t, func(context.Context, string, string, string, string) error {
		updated = true
		return nil
	})
	var deletedTS string
	slacktest.MockDeleteMessage(t, func(_ context.Context, _, _, ts string) error {
		deletedTS = ts
		return nil
	})

	// A question asked as a reply inside an existing thread: what must be
	// checked is the question's own message, not the thread's root.
	ev := slackQuestionEvent(teamID, slack.SurfaceMention, "how is the app?", "Ev-deleted")
	ev.EventTS = "1700000000.5"

	c, stub := newTestAgent(t, `{"choices":[{"message":{"role":"assistant","content":"Too late."}}],"usage":{"prompt_tokens":10,"completion_tokens":2}}`)
	handleSlackQuestion(t, c, ev)

	if stub.callCount() != 1 {
		t.Errorf("llm calls = %d, want 1 (the turn still ran)", stub.callCount())
	}
	if checkedThreadRootTS != ev.ThreadTS || checkedMessageTS != "1700000000.5" {
		t.Errorf("checked thread root=%q message=%q, want the question's own message in its thread", checkedThreadRootTS, checkedMessageTS)
	}
	if len(posts) != 1 {
		t.Fatalf("PostMessage calls = %d, want 1 (the ack only): %v", len(posts), posts)
	}
	if updated {
		t.Error("the ack must not be edited into an answer")
	}
	if deletedTS != "ack.1" {
		t.Errorf("deleted message ts = %q, want the ack placeholder", deletedTS)
	}

	// A redelivery finds the event marked answered and posts nothing.
	posts = nil
	handleSlackQuestion(t, c, ev)
	if stub.callCount() != 1 || len(posts) != 0 {
		t.Errorf("redelivery ran again: llm calls = %d, posts = %v", stub.callCount(), posts)
	}
}

// TestSlackQuestionDeletedClearsAssistantStatus checks the assistant surface
// counterpart: there is no ack to remove, so the "digging" status is cleared
// explicitly and nothing is posted.
func TestSlackQuestionDeletedClearsAssistantStatus(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	const email = "dm-deleter@test.dev"
	teamID, userID, appID := uuid.New(), uuid.New(), uuid.New()
	seedTeam(ctx, t, teamID, "team")
	seedUser(ctx, t, userID, email)
	seedTeamMembership(ctx, t, teamID, userID, "owner")
	seedApp(ctx, t, appID, teamID, "soleapp", 30)
	seedTeamSlack(ctx, t, teamID, []string{"C1"})

	slacktest.MockUserEmail(t, func(context.Context, string, string) (string, error) { return email, nil })
	delivered := captureSlackDelivery(t)
	var statuses []string
	slacktest.MockSetAssistantStatus(t, func(_ context.Context, _, _, _, status string) error {
		statuses = append(statuses, status)
		return nil
	})
	slacktest.MockThreadMessageExists(t, func(context.Context, string, string, string, string) (bool, error) { return false, nil })

	c, stub := newTestAgent(t, `{"choices":[{"message":{"role":"assistant","content":"Too late."}}],"usage":{"prompt_tokens":10,"completion_tokens":2}}`)
	handleSlackQuestion(t, c, slackQuestionEvent(teamID, slack.SurfaceAssistant, "how is the app?", "Ev-dm-deleted"))

	if stub.callCount() != 1 {
		t.Errorf("llm calls = %d, want 1 (the turn still ran)", stub.callCount())
	}
	if *delivered != "" {
		t.Errorf("delivered = %q, want nothing", *delivered)
	}
	if len(statuses) == 0 || statuses[len(statuses)-1] != "" {
		t.Errorf("statuses = %v, want a final empty status clearing the thread", statuses)
	}
}

// TestSlackQuestionDeletionCheckFailsOpen checks that when the deletion check
// itself errors, the answer is still delivered; a transient API failure must
// not drop answers.
func TestSlackQuestionDeletionCheckFailsOpen(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	const email = "blipped@test.dev"
	teamID, userID, appID := uuid.New(), uuid.New(), uuid.New()
	seedTeam(ctx, t, teamID, "team")
	seedUser(ctx, t, userID, email)
	seedTeamMembership(ctx, t, teamID, userID, "owner")
	seedApp(ctx, t, appID, teamID, "soleapp", 30)
	seedTeamSlack(ctx, t, teamID, []string{"C1"})

	slacktest.MockUserEmail(t, func(context.Context, string, string) (string, error) { return email, nil })
	delivered := captureSlackDelivery(t)
	slacktest.MockThreadMessageExists(t, func(context.Context, string, string, string, string) (bool, error) {
		return false, errors.New("ratelimited")
	})

	c, _ := newTestAgent(t, `{"choices":[{"message":{"role":"assistant","content":"Still delivered."}}],"usage":{"prompt_tokens":10,"completion_tokens":2}}`)
	handleSlackQuestion(t, c, slackQuestionEvent(teamID, slack.SurfaceAssistant, "how is the app?", "Ev-check-blip"))

	if !strings.Contains(*delivered, "Still delivered") {
		t.Errorf("delivered = %q, want the answer despite the failed check", *delivered)
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
	apps := []measureApp{
		{id: uuid.New(), name: "alpha", uniqueIdentifier: "com.x.alpha"},
		{id: uuid.New(), name: "bravo", uniqueIdentifier: "com.x.bravo"},
	}
	// The discussion names no app outright; the small model decides from the
	// loose description.
	msgs := []slack.Message{{User: "U2", Text: "the prod build keeps crashing on startup", TS: "1"}}
	slacktest.MockConversationHistory(t, func(context.Context, string, string, int) ([]slack.Message, error) { return msgs, nil })
	slacktest.MockConversationReplies(t, func(context.Context, string, string, string, string, int) ([]slack.Message, error) { return msgs, nil })

	c, stub := newTestAgent(t, `{"choices":[{"message":{"role":"assistant","content":"2"}}],"usage":{"prompt_tokens":15,"completion_tokens":1}}`)
	ev := slack.AgentEvent{Surface: slack.SurfaceMention, Channel: "C1", ThreadTS: "1.1", EventTS: "9", SlackUserID: "U1"}

	resolved, _, ok := c.resolveAppFromContext(ctx, "tok", "Ubot", ev, "why does it crash?", apps)
	if !ok {
		t.Fatal("expected the model to resolve an app from context")
	}
	if resolved.id != apps[1].id {
		t.Errorf("resolved %s, want bravo %s", resolved.id, apps[1].id)
	}
	if stub.callCount() != 1 {
		t.Errorf("llm calls = %d, want 1 (the app-resolution call)", stub.callCount())
	}
	// The model must see the question apart from the discussion, so it can
	// judge which app the question itself is about.
	req := string(stub.requests[0])
	for _, want := range []string{"Question:", "why does it crash?", "Discussion (recent messages, oldest first):"} {
		if !strings.Contains(req, want) {
			t.Errorf("app-resolution request should contain %q, got %s", want, req)
		}
	}
}

// TestResolveAppFromContextNamedAppStillGoesToModel checks that the model is
// consulted even when the discussion names an app outright, since a literal
// name may be chatter unrelated to the question, and that a 0 from it falls
// back to asking which app.
func TestResolveAppFromContextNamedAppStillGoesToModel(t *testing.T) {
	ctx := context.Background()
	apps := []measureApp{
		{id: uuid.New(), name: "alpha", uniqueIdentifier: "com.x.alpha"},
		{id: uuid.New(), name: "bravo", uniqueIdentifier: "com.x.bravo"},
	}
	ev := slack.AgentEvent{Surface: slack.SurfaceMention, Channel: "C1", ThreadTS: "9", EventTS: "9", SlackUserID: "U1"}
	msgs := []slack.Message{
		{User: "U2", Text: "bravo release party is tomorrow", TS: "1"},
		{User: "U2", Text: "bring cake", TS: "2"},
	}
	slacktest.MockConversationHistory(t, func(context.Context, string, string, int) ([]slack.Message, error) { return msgs, nil })

	c, stub := newTestAgent(t, `{"choices":[{"message":{"role":"assistant","content":"0"}}],"usage":{"prompt_tokens":10,"completion_tokens":1}}`)
	_, _, ok := c.resolveAppFromContext(ctx, "tok", "Ubot", ev, "how many crashes this week?", apps)
	if ok {
		t.Fatal("expected no pick when the model answers 0")
	}
	if stub.callCount() != 1 {
		t.Errorf("llm calls = %d, want 1 (a named app still goes through the model)", stub.callCount())
	}
}

// TestSlackContextResolvedAppNoteReachesTurn checks that when the app was
// resolved from the discussion rather than named in the question, the turn's
// model is told which app was picked and to open its reply by naming it; the
// announcement wording is the model's own.
func TestSlackContextResolvedAppNoteReachesTurn(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	const email = "ctxapp@test.dev"
	teamID, userID := uuid.New(), uuid.New()
	seedTeam(ctx, t, teamID, "team")
	seedUser(ctx, t, userID, email)
	seedTeamMembership(ctx, t, teamID, userID, "owner")
	seedApp(ctx, t, uuid.New(), teamID, "alpha", 30)
	seedApp(ctx, t, uuid.New(), teamID, "bravo", 30)
	seedTeamSlack(ctx, t, teamID, []string{"C1"})

	slacktest.MockUserEmail(t, func(context.Context, string, string) (string, error) { return email, nil })
	delivered := captureSlackDelivery(t)
	// The question names no app; the discussion describes one loosely.
	msgs := []slack.Message{{User: "U2", Text: "the second app keeps crashing", TS: "1"}}
	slacktest.MockConversationHistory(t, func(context.Context, string, string, int) ([]slack.Message, error) { return msgs, nil })

	// Three model calls, in order: the app resolution picks bravo, the
	// context summary, and the turn's answer.
	c, stub := newTestAgent(t,
		`{"choices":[{"message":{"role":"assistant","content":"2"}}],"usage":{"prompt_tokens":10,"completion_tokens":1}}`,
		`{"choices":[{"message":{"role":"assistant","content":"They said the second app keeps crashing."}}],"usage":{"prompt_tokens":10,"completion_tokens":5}}`,
		`{"choices":[{"message":{"role":"assistant","content":"You're asking about bravo. 12 crashes this week."}}],"usage":{"prompt_tokens":10,"completion_tokens":5}}`,
	)
	handleSlackQuestion(t, c, slackQuestionEvent(teamID, slack.SurfaceMention, "how many crashes this week?", "Ev-ctx-app"))

	if stub.callCount() != 3 {
		t.Fatalf("llm calls = %d, want 3 (resolution, summary, turn)", stub.callCount())
	}
	turnReq := string(stub.requests[2])
	if !strings.Contains(turnReq, "did not name an app") ||
		!strings.Contains(turnReq, "Write the app exactly as bravo (bravo)") {
		t.Errorf("turn request should carry the note with the app in label form, got %s", turnReq)
	}
	if !strings.Contains(*delivered, "12 crashes this week.") {
		t.Errorf("reply should carry the model's answer, got %q", *delivered)
	}
}
