//go:build integration

package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
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
// counterpart: there is no ack to remove, so the thread status is cleared
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

// TestSlackAgentDisabledPostsNotice checks that with the agent disabled, a
// question gets the unavailability notice instead of a turn, and a redelivery
// of the same event doesn't repost it.
func TestSlackAgentDisabledPostsNotice(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, _, _ := seedTeamUserApp(ctx, t)
	seedTeamSlack(ctx, t, teamID, []string{"C1"})

	orig := deps.Config.AgentEnabled
	deps.Config.AgentEnabled = false
	t.Cleanup(func() { deps.Config.AgentEnabled = orig })

	var posts []string
	slacktest.MockPostMessage(t, func(_ context.Context, _, _, _, text string) (string, error) {
		posts = append(posts, text)
		return "notice.1", nil
	})

	c, stub := newTestAgent(t) // no scripted responses; the turn must not start
	handleSlackQuestion(t, c, slackQuestionEvent(teamID, slack.SurfaceMention, "how is the app?", "Ev-agentoff"))

	if stub.callCount() != 0 {
		t.Errorf("llm called %d times, want 0 (turn must not run when the agent is off)", stub.callCount())
	}
	if len(posts) != 1 {
		t.Fatalf("PostMessage calls = %d, want 1 (the unavailability notice): %v", len(posts), posts)
	}
	if posts[0] != UnavailableReply {
		t.Errorf("notice = %q, want %q", posts[0], UnavailableReply)
	}

	// Redelivery of the same event is deduped: no second notice.
	posts = nil
	handleSlackQuestion(t, c, slackQuestionEvent(teamID, slack.SurfaceMention, "how is the app?", "Ev-agentoff"))
	if len(posts) != 0 {
		t.Errorf("redelivery posted %v, want nothing (deduped)", posts)
	}
}

// TestSlackConversationTeamMismatchRejected checks that a thread whose stored
// conversation belongs to a different team is not continued: a workspace can
// be relinked to another team, and the old team's transcript must not reach
// the new team's turns.
func TestSlackConversationTeamMismatchRejected(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	const email = "relink@test.dev"
	teamA, teamB, userID := uuid.New(), uuid.New(), uuid.New()
	seedTeam(ctx, t, teamA, "team a")
	seedTeam(ctx, t, teamB, "team b")
	seedUser(ctx, t, userID, email)
	seedTeamMembership(ctx, t, teamA, userID, "owner")
	seedTeamMembership(ctx, t, teamB, userID, "owner")
	seedApp(ctx, t, uuid.New(), teamA, "appa", 30)
	seedApp(ctx, t, uuid.New(), teamB, "appb", 30)
	seedTeamSlack(ctx, t, teamA, []string{"C1"})
	seedTeamSlack(ctx, t, teamB, []string{"C1"})

	slacktest.MockUserEmail(t, func(context.Context, string, string) (string, error) { return email, nil })
	delivered := captureSlackDelivery(t)

	c, stub := newTestAgent(t,
		`{"choices":[{"message":{"role":"assistant","content":"Team A answer."}}],"usage":{"prompt_tokens":10,"completion_tokens":3}}`,
	)

	// The first question creates the thread's conversation under team A.
	handleSlackQuestion(t, c, slackQuestionEvent(teamA, slack.SurfaceMention, "how is the app?", "Ev-team-a"))
	if stub.callCount() != 1 {
		t.Fatalf("llm calls = %d, want 1 (team A's turn)", stub.callCount())
	}

	// The same thread under team B is refused without a turn.
	handleSlackQuestion(t, c, slackQuestionEvent(teamB, slack.SurfaceMention, "and now?", "Ev-team-b"))
	if stub.callCount() != 1 {
		t.Errorf("llm calls = %d, want 1 (team B must not get a turn)", stub.callCount())
	}
	if !strings.Contains(*delivered, "previous Measure connection") {
		t.Errorf("delivered = %q, want the team mismatch reply", *delivered)
	}
}

// TestSlackTurnScopedToTeam checks that a Slack turn only exposes the
// connected team's apps even when the asker belongs to other teams: list_apps
// omits the other teams' apps and a typed tool call naming another team's
// app is denied, since the reply is read by the workspace's channel.
func TestSlackTurnScopedToTeam(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	const email = "twoteams@test.dev"
	teamA, teamB, userID := uuid.New(), uuid.New(), uuid.New()
	alphaID, bravoID := uuid.New(), uuid.New()
	seedTeam(ctx, t, teamA, "team a")
	seedTeam(ctx, t, teamB, "team b")
	seedUser(ctx, t, userID, email)
	seedTeamMembership(ctx, t, teamA, userID, "owner")
	seedTeamMembership(ctx, t, teamB, userID, "owner")
	seedApp(ctx, t, alphaID, teamA, "alpha", 30)
	seedApp(ctx, t, bravoID, teamB, "bravo", 30)
	seedTeamSlack(ctx, t, teamA, []string{"C1"})

	slacktest.MockUserEmail(t, func(context.Context, string, string) (string, error) { return email, nil })
	delivered := captureSlackDelivery(t)

	// Three model calls: list apps, try the other team's app, answer.
	getFiltersArgs := fmt.Sprintf(`{"app_id":%q}`, bravoID)
	c, stub := newTestAgent(t,
		`{"choices":[{"message":{"role":"assistant","tool_calls":[{"id":"c1","type":"function","function":{"name":"list_apps","arguments":"{}"}}]}}],"usage":{"prompt_tokens":10,"completion_tokens":2}}`,
		fmt.Sprintf(`{"choices":[{"message":{"role":"assistant","tool_calls":[{"id":"c2","type":"function","function":{"name":"get_filters","arguments":%s}}]}}],"usage":{"prompt_tokens":10,"completion_tokens":2}}`, strconv.Quote(getFiltersArgs)),
		`{"choices":[{"message":{"role":"assistant","content":"Only alpha here."}}],"usage":{"prompt_tokens":10,"completion_tokens":3}}`,
	)
	handleSlackQuestion(t, c, slackQuestionEvent(teamA, slack.SurfaceMention, "what apps do we have?", "Ev-scope"))

	if stub.callCount() != 3 {
		t.Fatalf("llm calls = %d, want 3", stub.callCount())
	}
	// The list_apps result carries team A's app and not team B's. The whole
	// request carries alphaID in the app list, so the check reads the tool
	// message itself.
	var second chatRequest
	if err := json.Unmarshal(stub.requests[1], &second); err != nil {
		t.Fatalf("decode second request: %v", err)
	}
	listResult := second.Messages[len(second.Messages)-1]
	if listResult.Role != "tool" {
		t.Fatalf("last message of second call = %q, want the tool result", listResult.Role)
	}
	if !strings.Contains(listResult.Content, alphaID.String()) {
		t.Errorf("list_apps result missing the connected team's app %s: %q", alphaID, listResult.Content)
	}
	if strings.Contains(listResult.Content, bravoID.String()) {
		t.Errorf("list_apps result leaked another team's app %s: %q", bravoID, listResult.Content)
	}
	// The typed tool call for team B's app is denied; the result is the tool
	// message of the third call.
	var third chatRequest
	if err := json.Unmarshal(stub.requests[2], &third); err != nil {
		t.Fatalf("decode third request: %v", err)
	}
	denied := third.Messages[len(third.Messages)-1]
	if !strings.Contains(denied.Content, "access denied") {
		t.Errorf("get_filters on another team's app should be denied, got %q", denied.Content)
	}
	if !strings.Contains(*delivered, "Only alpha here.") {
		t.Errorf("delivered = %q, want the model's answer", *delivered)
	}
}

// TestSlackTurnCarriesAppList checks that a mention's turn gets the team's
// full app list in its system message, with the thread context summarized
// beside it, so the model can pick apps from the discussion on its own.
func TestSlackTurnCarriesAppList(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	const email = "ctxapp@test.dev"
	teamID, userID := uuid.New(), uuid.New()
	alphaID, bravoID := uuid.New(), uuid.New()
	seedTeam(ctx, t, teamID, "team")
	seedUser(ctx, t, userID, email)
	seedTeamMembership(ctx, t, teamID, userID, "owner")
	seedApp(ctx, t, alphaID, teamID, "alpha", 30)
	seedApp(ctx, t, bravoID, teamID, "bravo", 30)
	charlieID := uuid.New()
	seedApp(ctx, t, charlieID, teamID, "charlie", 30)
	seedTeamSlack(ctx, t, teamID, []string{"C1"})
	// bravo is an iOS build and charlie has no telemetry, exercising the
	// per-app platform notes beside the android default.
	if _, err := deps.PgPool.Exec(ctx, "UPDATE measure.apps SET os_names = '{ios}' WHERE id = $1", bravoID); err != nil {
		t.Fatalf("set bravo os_names: %v", err)
	}
	if _, err := deps.PgPool.Exec(ctx, "UPDATE measure.apps SET os_names = '{}' WHERE id = $1", charlieID); err != nil {
		t.Fatalf("clear charlie os_names: %v", err)
	}

	slacktest.MockUserEmail(t, func(context.Context, string, string) (string, error) { return email, nil })
	delivered := captureSlackDelivery(t)
	// The question names no app; the discussion describes one loosely.
	msgs := []slack.Message{{User: "U2", Text: "the second app keeps crashing", TS: "1"}}
	slacktest.MockConversationHistory(t, func(context.Context, string, string, int) ([]slack.Message, error) { return msgs, nil })

	// Two model calls, in order: the context summary, then the turn's answer.
	c, stub := newTestAgent(t,
		`{"choices":[{"message":{"role":"assistant","content":"They said the second app keeps crashing."}}],"usage":{"prompt_tokens":10,"completion_tokens":5}}`,
		`{"choices":[{"message":{"role":"assistant","content":"For bravo: 12 crashes this week."}}],"usage":{"prompt_tokens":10,"completion_tokens":5}}`,
	)
	handleSlackQuestion(t, c, slackQuestionEvent(teamID, slack.SurfaceMention, "how many crashes this week?", "Ev-ctx-app"))

	if stub.callCount() != 2 {
		t.Fatalf("llm calls = %d, want 2 (summary, turn)", stub.callCount())
	}
	turnReq := string(stub.requests[1])
	for _, want := range []string{
		"The team's apps", alphaID.String(), bravoID.String(), charlieID.String(),
		"runs on android", "runs on ios (no ANRs)", "platform unknown (no telemetry yet)",
		"second app keeps crashing",
	} {
		if !strings.Contains(turnReq, want) {
			t.Errorf("turn request missing %q", want)
		}
	}
	// The ANR caveat applies per app: the android line must not carry it.
	if strings.Contains(turnReq, "runs on android (no ANRs)") {
		t.Error("the android line should not carry the ANR caveat")
	}
	// The method rule is for stateless MCP callers; Slack threads keep
	// server-side history and must not carry it.
	if strings.Contains(turnReq, "each call reaches you with no memory of earlier ones") {
		t.Error("slack turn request should not carry the mcp method rule")
	}
	if !strings.Contains(*delivered, "12 crashes this week.") {
		t.Errorf("reply should carry the model's answer, got %q", *delivered)
	}
}
