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
	"time"

	"backend/libs/autumn"
	autumntest "backend/libs/autumn/testhelpers"
	"backend/libs/slack"
	slacktest "backend/libs/slack/testhelpers"
	"backend/testinfra"

	"github.com/google/uuid"
)

// ----------------------------------------------------------------------------
// Access control
// ----------------------------------------------------------------------------

// TestResolveAppAccess checks a team member resolves the app's team and Autumn
// customer, and a user from another team is denied (the cross-team boundary).
func TestResolveAppAccess(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	c := &Config{Deps: deps}

	teamID, userID, appID := seedTeamUserApp(ctx, t)
	custID := uuid.New().String()
	seedTeamAutumnCustomer(ctx, t, teamID, custID)

	t.Run("member resolves team and customer", func(t *testing.T) {
		gotTeam, gotCust, err := c.resolveAppAccess(ctx, userID, appID)
		if err != nil {
			t.Fatalf("resolveAppAccess: %v", err)
		}
		if gotTeam != teamID || gotCust != custID {
			t.Errorf("got team=%s cust=%q, want %s %s", gotTeam, gotCust, teamID, custID)
		}
	})

	t.Run("non-member is denied", func(t *testing.T) {
		_, strangerID, _ := seedTeamUserApp(ctx, t) // a user in a different team
		if _, _, err := c.resolveAppAccess(ctx, strangerID, appID); err == nil {
			t.Error("want access denied for a non-member, got nil")
		}
	})
}

// TestAskQuestionRejections checks the pre-turn guards: an unauthenticated
// caller, an invalid app id, and a billing-blocked team all fail before any
// LLM call.
func TestAskQuestionRejections(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, userID, appID := seedTeamUserApp(ctx, t)

	c, stub := newTestAgent(t, `{"choices":[{"message":{"role":"assistant","content":"should not run"}}],"usage":{}}`)

	t.Run("unauthenticated", func(t *testing.T) {
		if _, err := c.askQuestion(ctx, askQuestionInput{AppID: appID.String(), Question: "hi"}); err == nil {
			t.Error("want error for missing user, got nil")
		}
	})

	t.Run("invalid app_id", func(t *testing.T) {
		uctx := WithUserID(ctx, userID.String())
		if _, err := c.askQuestion(uctx, askQuestionInput{AppID: "not-a-uuid", Question: "hi"}); err == nil {
			t.Error("want error for invalid app_id, got nil")
		}
	})

	t.Run("billing blocked", func(t *testing.T) {
		seedTeamAutumnCustomer(ctx, t, teamID, uuid.New().String())
		autumntest.MockCheck(t, func(context.Context, string, string) (*autumn.CheckResponse, error) {
			return &autumn.CheckResponse{Allowed: false}, nil
		})
		uctx := WithUserID(ctx, userID.String())
		if _, err := c.askQuestion(uctx, askQuestionInput{AppID: appID.String(), Question: "hi"}); err == nil {
			t.Error("want error when billing blocks the team, got nil")
		}
	})

	if stub.callCount() != 0 {
		t.Errorf("llm called %d times, want 0 (all rejected before the turn)", stub.callCount())
	}
}

// ----------------------------------------------------------------------------
// Turn failure modes
// ----------------------------------------------------------------------------

// TestRunTurnLLMFailure checks a failed LLM call caps the turn with the
// retry-friendly marker and returns an error, so a redelivery has a well-formed
// transcript to answer against.
func TestRunTurnLLMFailure(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, userID, appID := seedTeamUserApp(ctx, t)
	c, _ := newTestAgent(t) // no scripted responses → the chat call fails

	conv := &conversation{UserID: userID, AppID: appID, TeamID: teamID, Surface: "mcp"}
	if err := c.createConversation(ctx, conv, "q"); err != nil {
		t.Fatalf("createConversation: %v", err)
	}

	if _, err := c.runTurn(ctx, turn{userID: userID, appID: appID, teamID: teamID, conv: conv, question: "boom", entryPoint: "mcp"}); err == nil {
		t.Fatal("want error on llm failure, got nil")
	}

	loaded, err := c.loadMessages(ctx, conv.ID)
	if err != nil {
		t.Fatalf("loadMessages: %v", err)
	}
	if len(loaded) != 2 || loaded[1].msg.Content != turnFailureMarker {
		t.Errorf("want [user, failure-marker], got %v", msgRoles(loaded))
	}
}

// TestRunTurnBudgetExhausted checks a model that keeps calling a tool runs out
// of the LLM-call budget: the low-budget warning and the exhausted notice are
// injected on the right calls, the final call forbids tools, and a model that
// still returns only tool calls there yields errNoAnswer.
func TestRunTurnBudgetExhausted(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, userID, appID := seedTeamUserApp(ctx, t)
	now := time.Now().UTC()
	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{Timestamp: now})

	args := fmt.Sprintf(`{"query":"select count(*) as n from {{events}}","from":"%s","to":"%s"}`,
		now.Add(-time.Hour).Format(time.RFC3339), now.Add(time.Hour).Format(time.RFC3339))
	toolCall := fmt.Sprintf(`{"choices":[{"message":{"role":"assistant","tool_calls":[{"id":"c","type":"function","function":{"name":"run_sql","arguments":%s}}]}}],"usage":{"prompt_tokens":10,"completion_tokens":2}}`,
		strconv.Quote(args))
	c, stub := newTestAgent(t, toolCall)
	stub.repeat = true // every request gets another tool call, never an answer

	conv := &conversation{UserID: userID, AppID: appID, TeamID: teamID, Surface: "mcp"}
	if err := c.createConversation(ctx, conv, "q"); err != nil {
		t.Fatalf("createConversation: %v", err)
	}

	_, err := c.runTurn(ctx, turn{userID: userID, appID: appID, teamID: teamID, conv: conv, question: "loop", entryPoint: "mcp"})
	if !errors.Is(err, errNoAnswer) {
		t.Errorf("want errNoAnswer, got %v", err)
	}
	if stub.callCount() != maxLLMCalls {
		t.Errorf("llm calls = %d, want maxLLMCalls=%d", stub.callCount(), maxLLMCalls)
	}

	stub.mu.Lock()
	warnReq, finalReq := stub.requests[maxLLMCalls-1-lowBudgetWarningAt], stub.requests[maxLLMCalls-1]
	stub.mu.Unlock()

	var warn chatRequest
	if err := json.Unmarshal(warnReq, &warn); err != nil {
		t.Fatalf("decode warning request: %v", err)
	}
	if last := warn.Messages[len(warn.Messages)-1]; last.Role != "system" || last.Content != lowBudgetNotice {
		t.Errorf("warning call should end with the low-budget notice, got role=%q content=%q", last.Role, last.Content)
	}

	var final chatRequest
	if err := json.Unmarshal(finalReq, &final); err != nil {
		t.Fatalf("decode final request: %v", err)
	}
	if final.ToolChoice != "none" {
		t.Errorf("final call tool_choice = %q, want none", final.ToolChoice)
	}
	if last := final.Messages[len(final.Messages)-1]; last.Role != "system" || last.Content != budgetExhaustedNotice {
		t.Errorf("final call should end with the exhausted notice, got role=%q content=%q", last.Role, last.Content)
	}
}

// TestRunTurnBudgetExhaustedAnswer checks the final forced call turns a
// budget-exhausted turn into an answer: 24 tool rounds, then the model
// answers in text and the turn succeeds with the notices persisted.
func TestRunTurnBudgetExhaustedAnswer(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, userID, appID := seedTeamUserApp(ctx, t)
	now := time.Now().UTC()
	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{Timestamp: now})

	args := fmt.Sprintf(`{"query":"select count(*) as n from {{events}}","from":"%s","to":"%s"}`,
		now.Add(-time.Hour).Format(time.RFC3339), now.Add(time.Hour).Format(time.RFC3339))
	toolCall := fmt.Sprintf(`{"choices":[{"message":{"role":"assistant","tool_calls":[{"id":"c","type":"function","function":{"name":"run_sql","arguments":%s}}]}}],"usage":{"prompt_tokens":10,"completion_tokens":2}}`,
		strconv.Quote(args))
	responses := make([]string, 0, maxLLMCalls)
	for range maxLLMCalls - 1 {
		responses = append(responses, toolCall)
	}
	responses = append(responses, `{"choices":[{"message":{"role":"assistant","content":"Partial: found the top error."}}],"usage":{"prompt_tokens":10,"completion_tokens":5}}`)
	c, stub := newTestAgent(t, responses...)

	conv := &conversation{UserID: userID, AppID: appID, TeamID: teamID, Surface: "mcp"}
	if err := c.createConversation(ctx, conv, "q"); err != nil {
		t.Fatalf("createConversation: %v", err)
	}

	answer, err := c.runTurn(ctx, turn{userID: userID, appID: appID, teamID: teamID, conv: conv, question: "loop", entryPoint: "mcp"})
	if err != nil {
		t.Fatalf("runTurn: %v", err)
	}
	if answer != "Partial: found the top error." {
		t.Errorf("answer = %q, want the forced final answer", answer)
	}
	if stub.callCount() != maxLLMCalls {
		t.Errorf("llm calls = %d, want maxLLMCalls=%d", stub.callCount(), maxLLMCalls)
	}

	// Both notices are part of the turn and must be stored with it, so the
	// next turn's replayed transcript matches what the model saw.
	loaded, err := c.loadMessages(ctx, conv.ID)
	if err != nil {
		t.Fatalf("loadMessages: %v", err)
	}
	var sawWarning, sawExhausted bool
	for _, m := range loaded {
		if m.msg.Role != "system" {
			continue
		}
		sawWarning = sawWarning || m.msg.Content == lowBudgetNotice
		sawExhausted = sawExhausted || m.msg.Content == budgetExhaustedNotice
	}
	if !sawWarning || !sawExhausted {
		t.Errorf("persisted transcript missing notices: warning=%v exhausted=%v", sawWarning, sawExhausted)
	}
}

// TestRunTurnCompactsLongHistory checks that when the loaded history is past the
// compaction threshold, the turn summarizes the older messages (a small-model
// call) and writes a summary row before answering.
func TestRunTurnCompactsLongHistory(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, userID, appID := seedTeamUserApp(ctx, t)

	c, stub := newTestAgent(t,
		`{"choices":[{"message":{"role":"assistant","content":"Summary of earlier turns."}}],"usage":{"prompt_tokens":500,"completion_tokens":50}}`,
		`{"choices":[{"message":{"role":"assistant","content":"Current answer."}}],"usage":{"prompt_tokens":80,"completion_tokens":10}}`,
	)

	conv := &conversation{UserID: userID, AppID: appID, TeamID: teamID, Surface: "mcp"}
	if err := c.createConversation(ctx, conv, "q"); err != nil {
		t.Fatalf("createConversation: %v", err)
	}

	if err := c.appendMessages(ctx, conv.ID, []storedMessage{
		{msg: chatMessage{Role: "user", Content: "old q1"}},
		{msg: chatMessage{Role: "assistant", Content: "old a1"}, model: "m", usage: chatUsage{PromptTokens: 100, CompletionTokens: 10}},
	}); err != nil {
		t.Fatalf("append turn 1: %v", err)
	}
	// The newest assistant message reports a context already past the threshold.
	if err := c.appendMessages(ctx, conv.ID, []storedMessage{
		{msg: chatMessage{Role: "user", Content: "old q2"}},
		{msg: chatMessage{Role: "assistant", Content: "old a2"}, model: "m", usage: chatUsage{PromptTokens: 33000, CompletionTokens: 100}},
	}); err != nil {
		t.Fatalf("append turn 2: %v", err)
	}

	answer, err := c.runTurn(ctx, turn{userID: userID, appID: appID, teamID: teamID, conv: conv, question: "new question", entryPoint: "mcp"})
	if err != nil {
		t.Fatalf("runTurn: %v", err)
	}
	if answer != "Current answer." {
		t.Errorf("answer = %q, want Current answer.", answer)
	}
	if stub.callCount() != 2 {
		t.Errorf("llm calls = %d, want 2 (compaction + turn)", stub.callCount())
	}

	var summaries int
	if err := deps.PgPool.QueryRow(ctx,
		`select count(*) from measure.agent_messages where conversation_id = $1 and compacted_through is not null`,
		conv.ID).Scan(&summaries); err != nil {
		t.Fatalf("count summaries: %v", err)
	}
	if summaries != 1 {
		t.Errorf("summary rows = %d, want 1", summaries)
	}

	loaded, err := c.loadMessages(ctx, conv.ID)
	if err != nil {
		t.Fatalf("loadMessages: %v", err)
	}
	if len(loaded) == 0 || !loaded[0].summary {
		t.Errorf("expected the summary first after compaction, got %v", msgRoles(loaded))
	}
}

// ----------------------------------------------------------------------------
// run_sql edge cases
// ----------------------------------------------------------------------------

// TestRunSQLNilScope checks run_sql fails closed on an incomplete scope rather
// than running an unscoped query.
func TestRunSQLNilScope(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	c := &Config{Deps: deps}
	from, to := time.Now().Add(-time.Hour), time.Now()
	if _, err := c.runSQL(ctx, `select count(*) from {{events}}`, uuid.Nil, uuid.New(), from, to); err == nil {
		t.Error("want error for a nil team id (fail closed), got nil")
	}
}

// TestRunSQLTruncation checks the result is capped and marked when a query
// returns more rows than the formatter renders.
func TestRunSQLTruncation(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, _, appID := seedTeamUserApp(ctx, t)
	now := time.Now().UTC()
	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 250, testinfra.EventRow{Timestamp: now})
	c := &Config{Deps: deps}

	out, err := c.runSQL(ctx, `select id from {{events}}`, teamID, appID, now.Add(-time.Hour), now.Add(time.Hour))
	if err != nil {
		t.Fatalf("runSQL: %v", err)
	}
	if !strings.Contains(out, "truncated") {
		t.Errorf("expected a truncation marker for 250 rows, got:\n%s", out[:min(len(out), 300)])
	}
}

// ----------------------------------------------------------------------------
// Slack rejection and alternate paths
// ----------------------------------------------------------------------------

// captureSlackDelivery mocks the Slack calls a question turn makes other than
// UserEmail (each test sets that), and returns a pointer to the delivered reply.
func captureSlackDelivery(t *testing.T) *string {
	t.Helper()
	var delivered string
	slacktest.MockSetAssistantStatus(t, func(context.Context, string, string, string, string) error { return nil })
	slacktest.MockSetAssistantTitle(t, func(context.Context, string, string, string, string) error { return nil })
	slacktest.MockConversationHistory(t, func(context.Context, string, string, int) ([]slack.Message, error) { return nil, nil })
	slacktest.MockConversationReplies(t, func(context.Context, string, string, string, string, int) ([]slack.Message, error) { return nil, nil })
	slacktest.MockPostMessage(t, func(_ context.Context, _, _, _, text string) (string, error) { delivered = text; return "ack.1", nil })
	slacktest.MockUpdateMessage(t, func(_ context.Context, _, _, _, text string) error { delivered = text; return nil })
	return &delivered
}

func handleSlackQuestion(t *testing.T, c *Config, ev slack.AgentEvent) {
	t.Helper()
	data, _ := json.Marshal(ev)
	if err := c.HandleSlackEvent(context.Background(), data); err != nil {
		t.Fatalf("HandleSlackEvent: %v", err)
	}
}

func slackQuestionEvent(teamID uuid.UUID, surface, text, eventID string) slack.AgentEvent {
	return slack.AgentEvent{
		Kind: slack.KindQuestion, Surface: surface,
		TeamID: teamID.String(), SlackTeamID: "T1", Channel: "C1",
		ThreadTS: "1700000000.1", EventTS: "1700000000.1",
		SlackUserID: "U1", Text: text, EventID: eventID,
	}
}

// TestSlackQuestionEmailHidden checks a Slack profile with no readable email
// gets a clear can't-match-you reply.
func TestSlackQuestionEmailHidden(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, _, _ := seedTeamUserApp(ctx, t)
	seedTeamSlack(ctx, t, teamID, []string{"C1"})

	slacktest.MockUserEmail(t, func(context.Context, string, string) (string, error) { return "", nil })
	delivered := captureSlackDelivery(t)
	c, _ := newTestAgent(t)

	handleSlackQuestion(t, c, slackQuestionEvent(teamID, slack.SurfaceAssistant, "how is the app?", "Ev-hidden"))
	if !strings.Contains(*delivered, "couldn't read an email") {
		t.Errorf("delivered = %q, want the email-hidden reply", *delivered)
	}
}

// TestSlackQuestionNotMember checks a Slack user whose email matches no team
// member is told to ask an admin.
func TestSlackQuestionNotMember(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, _, _ := seedTeamUserApp(ctx, t)
	seedTeamSlack(ctx, t, teamID, []string{"C1"})

	slacktest.MockUserEmail(t, func(context.Context, string, string) (string, error) { return "stranger@nowhere.dev", nil })
	delivered := captureSlackDelivery(t)
	c, _ := newTestAgent(t)

	handleSlackQuestion(t, c, slackQuestionEvent(teamID, slack.SurfaceAssistant, "how is the app?", "Ev-stranger"))
	if !strings.Contains(*delivered, "couldn't find a Measure team member") {
		t.Errorf("delivered = %q, want the not-a-member reply", *delivered)
	}
}

// TestSlackQuestionWithFiles checks a message carrying attachments is answered
// with the paste-the-contents reply instead of running a turn, including a
// bare file drop with no text, which must not get the greeting.
func TestSlackQuestionWithFiles(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, _, _ := seedTeamUserApp(ctx, t)
	seedTeamSlack(ctx, t, teamID, []string{"C1"})

	slacktest.MockUserEmail(t, func(context.Context, string, string) (string, error) { return "", nil })
	delivered := captureSlackDelivery(t)
	c, stub := newTestAgent(t)

	ev := slackQuestionEvent(teamID, slack.SurfaceAssistant, "what does this crash log say?", "Ev-files")
	ev.HasFiles = true
	handleSlackQuestion(t, c, ev)
	if !strings.Contains(*delivered, "can't read file attachments") {
		t.Errorf("delivered = %q, want the paste-the-contents reply", *delivered)
	}

	bare := slackQuestionEvent(teamID, slack.SurfaceAssistant, "", "Ev-files-bare")
	bare.HasFiles = true
	handleSlackQuestion(t, c, bare)
	if !strings.Contains(*delivered, "can't read file attachments") {
		t.Errorf("delivered = %q, want the paste-the-contents reply for a bare file drop", *delivered)
	}

	if stub.callCount() != 0 {
		t.Errorf("llm called %d times for file-carrying messages, want 0", stub.callCount())
	}
}

// TestSlackQuestionEmpty checks a mention with no question text gets the
// greeting rather than running a turn.
func TestSlackQuestionEmpty(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, _, _ := seedTeamUserApp(ctx, t)
	seedTeamSlack(ctx, t, teamID, []string{"C1"})

	slacktest.MockUserEmail(t, func(context.Context, string, string) (string, error) { return "", nil })
	delivered := captureSlackDelivery(t)
	c, stub := newTestAgent(t)

	handleSlackQuestion(t, c, slackQuestionEvent(teamID, slack.SurfaceMention, "   ", "Ev-empty"))
	if !strings.Contains(*delivered, "help you debug your app") {
		t.Errorf("delivered = %q, want the greeting", *delivered)
	}
	if stub.callCount() != 0 {
		t.Errorf("llm called %d times for an empty question, want 0", stub.callCount())
	}
}

// TestAnswerSlackQuestionMention checks the mention surface: the placeholder is
// posted, then edited to the answer.
func TestAnswerSlackQuestionMention(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	const email = "mentioner@test.dev"
	teamID, userID, appID := uuid.New(), uuid.New(), uuid.New()
	seedTeam(ctx, t, teamID, "team")
	seedUser(ctx, t, userID, email)
	seedTeamMembership(ctx, t, teamID, userID, "owner")
	seedApp(ctx, t, appID, teamID, "soleapp", 30)
	seedTeamSlack(ctx, t, teamID, []string{"C1"})

	slacktest.MockUserEmail(t, func(context.Context, string, string) (string, error) { return email, nil })
	delivered := captureSlackDelivery(t)
	c, stub := newTestAgent(t,
		`{"choices":[{"message":{"role":"assistant","content":"The app is fine."}}],"usage":{"prompt_tokens":20,"completion_tokens":5}}`)

	handleSlackQuestion(t, c, slackQuestionEvent(teamID, slack.SurfaceMention, "how is the app?", "Ev-mention"))
	if !strings.Contains(*delivered, "The app is fine") {
		t.Errorf("delivered = %q, want the answer", *delivered)
	}
	if stub.callCount() != 1 {
		t.Errorf("llm calls = %d, want 1", stub.callCount())
	}
}

// TestSlackMultiAppClarification checks that when a team has several apps and the
// question names none (and the thread gives no hint), the agent asks which app
// rather than guessing, with no turn run.
func TestSlackMultiAppClarification(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	const email = "multi@test.dev"
	teamID, userID := uuid.New(), uuid.New()
	seedTeam(ctx, t, teamID, "team")
	seedUser(ctx, t, userID, email)
	seedTeamMembership(ctx, t, teamID, userID, "owner")
	seedApp(ctx, t, uuid.New(), teamID, "alpha", 30)
	seedApp(ctx, t, uuid.New(), teamID, "bravo", 30)
	seedTeamSlack(ctx, t, teamID, []string{"C1"})

	slacktest.MockUserEmail(t, func(context.Context, string, string) (string, error) { return email, nil })
	delivered := captureSlackDelivery(t)
	c, stub := newTestAgent(t)

	handleSlackQuestion(t, c, slackQuestionEvent(teamID, slack.SurfaceAssistant, "show me the data", "Ev-multi"))
	if !strings.Contains(*delivered, "alpha") || !strings.Contains(*delivered, "bravo") {
		t.Errorf("delivered = %q, want both apps listed for clarification", *delivered)
	}
	if stub.callCount() != 0 {
		t.Errorf("llm called %d times, want 0 (clarify needs no turn)", stub.callCount())
	}
}

// TestSlackUserEmailCached checks the Slack-user-to-email lookup is cached in
// Valkey: a second resolution for the same user skips the Slack API.
func TestSlackUserEmailCached(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	const email = "cached@test.dev"
	teamID, userID, _ := uuid.New(), uuid.New(), uuid.New()
	seedTeam(ctx, t, teamID, "team")
	seedUser(ctx, t, userID, email)
	seedTeamMembership(ctx, t, teamID, userID, "owner")

	calls := 0
	slacktest.MockUserEmail(t, func(context.Context, string, string) (string, error) {
		calls++
		return email, nil
	})
	c := &Config{Deps: deps}

	for i := range 2 {
		gotID, gotEmail, err := c.resolveSlackUser(ctx, "tok", "T1", "U1", teamID)
		if err != nil {
			t.Fatalf("resolveSlackUser #%d: %v", i, err)
		}
		if gotID != userID || gotEmail != email {
			t.Fatalf("resolveSlackUser #%d = (%s, %q), want (%s, %s)", i, gotID, gotEmail, userID, email)
		}
	}
	if calls != 1 {
		t.Errorf("slack.UserEmail called %d times, want 1 (second resolution hits the cache)", calls)
	}
}
