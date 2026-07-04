//go:build integration

package slackwebhook

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

	"backend/libs/slack"

	"github.com/google/uuid"
)

// ----------------------------------------------------------------------------
// Request signature verification
// ----------------------------------------------------------------------------

// TestComputeSlackSignature_KnownAnswer pins our signature computation to the
// worked example published in Slack's documentation, proving we follow the spec
// byte-for-byte: https://docs.slack.dev/authentication/verifying-requests-from-slack
func TestComputeSlackSignature_KnownAnswer(t *testing.T) {
	const (
		secret    = "8f742231b10e8888abcd99yyyzzz85a5"
		timestamp = "1531420618"
		body      = "token=xyzz0WbapA4vBCDEFasx0q6G&team_id=T1DC2JH3J&team_domain=testteamnow&channel_id=G8PSS9T3V&channel_name=foobar&user_id=U2CERLKJA&user_name=roadrunner&command=%2Fwebhook-collect&text=&response_url=https%3A%2F%2Fhooks.slack.com%2Fcommands%2FT1DC2JH3J%2F397700885554%2F96rGlfmibIGlgcZRskXaIFfN&trigger_id=398738663015.47445629121.803a0bc887a14d10d2c447fce8b6703c"
		want      = "v0=a2114d57b48eac39b9ad189dd8316235a7b4a8d21a10bd27519666489c69b503"
	)

	if got := computeSlackSignature(secret, timestamp, []byte(body)); got != want {
		t.Fatalf("signature mismatch with Slack's documented example:\n got: %s\nwant: %s", got, want)
	}
}

func TestVerifySlackSignature(t *testing.T) {
	const secret = "8f742231b10e8888abcd99yyyzzz85a5"
	body := []byte("token=xyz&team_id=T123&command=%2Fsubscribe-alerts&channel_id=C123")

	t.Run("valid signature passes", func(t *testing.T) {
		h := slackSignHeader(secret, time.Now(), body)
		if err := verifySlackSignature(h, body, secret); err != nil {
			t.Fatalf("expected valid signature to pass, got: %v", err)
		}
	})

	t.Run("lowercase headers pass", func(t *testing.T) {
		// Slack documents that header names are case-insensitive; Go's
		// http.Header.Get canonicalizes the lookup key, so a request whose
		// headers arrived lowercase must still verify.
		timestamp := strconv.FormatInt(time.Now().Unix(), 10)
		h := http.Header{}
		h.Set("x-slack-request-timestamp", timestamp)
		h.Set("x-slack-signature", computeSlackSignature(secret, timestamp, body))
		if err := verifySlackSignature(h, body, secret); err != nil {
			t.Fatalf("expected lowercase headers to pass, got: %v", err)
		}
	})

	t.Run("tampered body fails", func(t *testing.T) {
		h := slackSignHeader(secret, time.Now(), body)
		if err := verifySlackSignature(h, []byte("token=xyz&channel_id=EVIL"), secret); err == nil {
			t.Fatal("expected tampered body to fail verification")
		}
	})

	t.Run("wrong secret fails", func(t *testing.T) {
		h := slackSignHeader(secret, time.Now(), body)
		if err := verifySlackSignature(h, body, "different-secret"); err == nil {
			t.Fatal("expected wrong secret to fail verification")
		}
	})

	t.Run("missing timestamp header fails", func(t *testing.T) {
		h := slackSignHeader(secret, time.Now(), body)
		h.Del("X-Slack-Request-Timestamp")
		if err := verifySlackSignature(h, body, secret); err == nil {
			t.Fatal("expected missing timestamp to fail verification")
		}
	})

	t.Run("missing signature header fails", func(t *testing.T) {
		h := slackSignHeader(secret, time.Now(), body)
		h.Del("X-Slack-Signature")
		if err := verifySlackSignature(h, body, secret); err == nil {
			t.Fatal("expected missing signature to fail verification")
		}
	})

	t.Run("non-numeric timestamp fails", func(t *testing.T) {
		h := slackSignHeader(secret, time.Now(), body)
		h.Set("X-Slack-Request-Timestamp", "not-a-number")
		if err := verifySlackSignature(h, body, secret); err == nil {
			t.Fatal("expected non-numeric timestamp to fail verification")
		}
	})

	t.Run("stale timestamp fails", func(t *testing.T) {
		// Sign with an old timestamp so the signature itself is valid but the
		// request falls outside the allowed replay window.
		old := time.Now().Add(-10 * time.Minute)
		h := slackSignHeader(secret, old, body)
		if err := verifySlackSignature(h, body, secret); err == nil {
			t.Fatal("expected stale timestamp to fail verification")
		}
	})

	t.Run("future timestamp fails", func(t *testing.T) {
		future := time.Now().Add(10 * time.Minute)
		h := slackSignHeader(secret, future, body)
		if err := verifySlackSignature(h, body, secret); err == nil {
			t.Fatal("expected future timestamp to fail verification")
		}
	})
}

// ----------------------------------------------------------------------------
// Event normalization
// ----------------------------------------------------------------------------

func TestNormalizeSlackAgentEvent(t *testing.T) {
	envelope := slackEventEnvelope{
		Type:    "event_callback",
		EventID: "Ev123",
		TeamID:  "T123",
	}

	t.Run("top-level mention roots its own thread", func(t *testing.T) {
		event, ok := normalizeSlackAgentEvent(envelope, slackInnerEvent{
			Type:    "app_mention",
			User:    "U111",
			Text:    "<@U999> any crashes today?",
			TS:      "1718000000.000100",
			Channel: "C123",
		})
		if !ok {
			t.Fatal("expected mention to normalize")
		}
		if event.Kind != slack.KindQuestion || event.Surface != slack.SurfaceMention {
			t.Fatalf("got kind=%q surface=%q", event.Kind, event.Surface)
		}
		if event.ThreadTS != "1718000000.000100" {
			t.Fatalf("expected thread to root at the mention's ts, got %q", event.ThreadTS)
		}
		if event.TeamID != "" {
			t.Fatalf("team mapping is the handler's job, got %q", event.TeamID)
		}
		if event.SlackTeamID != "T123" || event.EventID != "Ev123" || event.SlackUserID != "U111" {
			t.Fatalf("envelope fields not carried over: %+v", event)
		}
	})

	t.Run("threaded mention keeps the enclosing thread", func(t *testing.T) {
		event, ok := normalizeSlackAgentEvent(envelope, slackInnerEvent{
			Type:     "app_mention",
			User:     "U111",
			Text:     "<@U999> and yesterday?",
			TS:       "1718000222.000200",
			ThreadTS: "1718000000.000100",
			Channel:  "C123",
		})
		if !ok {
			t.Fatal("expected mention to normalize")
		}
		if event.ThreadTS != "1718000000.000100" || event.EventTS != "1718000222.000200" {
			t.Fatalf("got thread_ts=%q event_ts=%q", event.ThreadTS, event.EventTS)
		}
	})

	t.Run("file attachment still counts as a question", func(t *testing.T) {
		event, ok := normalizeSlackAgentEvent(envelope, slackInnerEvent{
			Type:        "message",
			ChannelType: "im",
			Subtype:     "file_share",
			User:        "U111",
			Text:        "what does this crash mean?",
			TS:          "1718000555.000500",
			Channel:     "D123",
			Files:       []json.RawMessage{json.RawMessage(`{"id":"F1"}`)},
		})
		if !ok {
			t.Fatal("expected a file_share message with text to normalize")
		}
		if event.Kind != slack.KindQuestion {
			t.Fatalf("got kind=%q", event.Kind)
		}
		if !event.HasFiles {
			t.Fatal("expected the attachment to be flagged on the event")
		}
	})

	t.Run("file-only message survives the empty-text drop", func(t *testing.T) {
		event, ok := normalizeSlackAgentEvent(envelope, slackInnerEvent{
			Type:        "message",
			ChannelType: "im",
			Subtype:     "file_share",
			User:        "U111",
			TS:          "1718000556.000500",
			Channel:     "D123",
			Files:       []json.RawMessage{json.RawMessage(`{"id":"F1"}`)},
		})
		if !ok {
			t.Fatal("expected a textless file message to normalize; the agent asks for the contents")
		}
		if !event.HasFiles {
			t.Fatal("expected the attachment to be flagged on the event")
		}
	})

	t.Run("mention with files sets the flag without a subtype", func(t *testing.T) {
		event, ok := normalizeSlackAgentEvent(envelope, slackInnerEvent{
			Type:    "app_mention",
			User:    "U111",
			Text:    "<@U999> what does this log say?",
			TS:      "1718000557.000500",
			Channel: "C123",
			Files:   []json.RawMessage{json.RawMessage(`{"id":"F1"}`)},
		})
		if !ok {
			t.Fatal("expected mention with files to normalize")
		}
		if !event.HasFiles {
			t.Fatal("expected the attachment to be flagged on the event")
		}
	})

	t.Run("dm message maps to the assistant surface", func(t *testing.T) {
		event, ok := normalizeSlackAgentEvent(envelope, slackInnerEvent{
			Type:        "message",
			ChannelType: "im",
			User:        "U111",
			Text:        "how many sessions today?",
			TS:          "1718000333.000300",
			ThreadTS:    "1718000000.000100",
			Channel:     "D123",
		})
		if !ok {
			t.Fatal("expected dm to normalize")
		}
		if event.Kind != slack.KindQuestion || event.Surface != slack.SurfaceAssistant {
			t.Fatalf("got kind=%q surface=%q", event.Kind, event.Surface)
		}
	})

	t.Run("messages-tab open greets", func(t *testing.T) {
		event, ok := normalizeSlackAgentEvent(envelope, slackInnerEvent{
			Type:    "app_home_opened",
			Tab:     "messages",
			User:    "U111",
			Channel: "D123",
		})
		if !ok {
			t.Fatal("expected a messages-tab open to normalize")
		}
		if event.Kind != slack.KindGreeting || event.Surface != slack.SurfaceAssistant {
			t.Fatalf("got kind=%q surface=%q", event.Kind, event.Surface)
		}
		if event.Channel != "D123" || event.SlackUserID != "U111" {
			t.Fatalf("greeting fields not carried over: %+v", event)
		}
	})

	t.Run("ignored events", func(t *testing.T) {
		cases := map[string]slackInnerEvent{
			"bot message":           {Type: "app_mention", BotID: "B999", Text: "hi"},
			"message edit":          {Type: "message", ChannelType: "im", Subtype: "message_changed", User: "U111", Text: "hi"},
			"plain channel message": {Type: "message", ChannelType: "channel", User: "U111", Text: "hi"},
			"unsubscribed type":     {Type: "reaction_added", User: "U111"},
			"home-tab open":         {Type: "app_home_opened", Tab: "home", User: "U111", Channel: "D123"},
			"empty question":        {Type: "app_mention", User: "U111", Text: "   "},
			// A DM mention also arrives as message.im; that one answers.
			"mention inside a dm": {Type: "app_mention", User: "U111", Text: "hi", Channel: "D123"},
		}
		for name, inner := range cases {
			if _, ok := normalizeSlackAgentEvent(envelope, inner); ok {
				t.Fatalf("%s: expected event to be ignored", name)
			}
		}
	})
}

// ----------------------------------------------------------------------------
// Team resolution (Postgres)
// ----------------------------------------------------------------------------

// TestGetTeamIDForSlackTeamResolvesPausedIntegration checks that the events edge
// resolves a workspace to its Measure team whether the integration is active or
// paused. A paused integration must still resolve so its events reach the agent,
// which then posts the disabled notice. Only a workspace no team has connected
// resolves to empty.
func TestGetTeamIDForSlackTeamResolvesPausedIntegration(t *testing.T) {
	ctx := context.Background()
	defer cleanupSlack(ctx, t)

	teamID := uuid.New()
	slackTeamID := slackTeamIDFor(teamID)
	seedTeam(ctx, t, teamID, "team")
	seedTeamSlack(ctx, t, teamID, []string{"C1"})

	got, err := getTeamIDForSlackTeam(ctx, deps, slackTeamID)
	if err != nil {
		t.Fatalf("active lookup: %v", err)
	}
	if got != teamID.String() {
		t.Fatalf("active: got team %q, want %q", got, teamID.String())
	}

	pauseTeamSlack(ctx, t, teamID)
	got, err = getTeamIDForSlackTeam(ctx, deps, slackTeamID)
	if err != nil {
		t.Fatalf("paused lookup: %v", err)
	}
	if got != teamID.String() {
		t.Fatalf("paused: got team %q, want %q (a paused integration must still resolve)", got, teamID.String())
	}

	got, err = getTeamIDForSlackTeam(ctx, deps, "nosuchws")
	if err != nil {
		t.Fatalf("unknown lookup: %v", err)
	}
	if got != "" {
		t.Fatalf("unknown workspace: got %q, want empty", got)
	}
}

// ----------------------------------------------------------------------------
// HandleSlackEvents end to end (signature -> normalize -> resolve -> publish)
// ----------------------------------------------------------------------------

// publishedEvent decodes the single event a fake producer captured, failing if
// the count is not exactly one.
func publishedEvent(t *testing.T, fp *fakeProducer) slack.AgentEvent {
	t.Helper()
	if len(fp.published) != 1 {
		t.Fatalf("published %d events, want 1", len(fp.published))
	}
	var ev slack.AgentEvent
	if err := json.Unmarshal(fp.published[0], &ev); err != nil {
		t.Fatalf("unmarshal published event: %v", err)
	}
	return ev
}

func TestHandleSlackEventsURLVerification(t *testing.T) {
	body := []byte(`{"type":"url_verification","challenge":"abc123"}`)
	fp := &fakeProducer{}
	w := postSignedSlack(New(deps, fp), testSigningSecret, "application/json", body)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var resp map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp["challenge"] != "abc123" {
		t.Errorf("challenge echoed as %q, want abc123", resp["challenge"])
	}
	if len(fp.published) != 0 {
		t.Errorf("handshake published %d events, want 0", len(fp.published))
	}
}

func TestHandleSlackEventsPublishesMention(t *testing.T) {
	ctx := context.Background()
	defer cleanupSlack(ctx, t)

	teamID := uuid.New()
	slackTeamID := slackTeamIDFor(teamID)
	seedTeam(ctx, t, teamID, "team")
	seedTeamSlack(ctx, t, teamID, []string{"C1"})

	body := eventCallback(slackTeamID, "Ev-mention",
		`{"type":"app_mention","user":"U1","text":"<@U9> any crashes?","ts":"1718000000.000100","channel":"C1"}`)

	fp := &fakeProducer{}
	w := postSignedSlack(New(deps, fp), testSigningSecret, "application/json", body)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
	ev := publishedEvent(t, fp)
	if ev.Kind != slack.KindQuestion || ev.Surface != slack.SurfaceMention {
		t.Errorf("kind=%q surface=%q, want question/mention", ev.Kind, ev.Surface)
	}
	if ev.TeamID != teamID.String() {
		t.Errorf("team_id = %q, want the resolved team %q", ev.TeamID, teamID.String())
	}
	if ev.EventID != "Ev-mention" || ev.SlackUserID != "U1" || ev.Channel != "C1" {
		t.Errorf("event fields not carried over: %+v", ev)
	}
}

// TestHandleSlackEventsGreetsOnMessagesTabOpen checks that opening the DM's
// Messages tab publishes a greeting, while opening the Home tab is ignored.
func TestHandleSlackEventsGreetsOnMessagesTabOpen(t *testing.T) {
	ctx := context.Background()
	defer cleanupSlack(ctx, t)

	teamID := uuid.New()
	slackTeamID := slackTeamIDFor(teamID)
	seedTeam(ctx, t, teamID, "team")
	seedTeamSlack(ctx, t, teamID, []string{"C1"})

	body := eventCallback(slackTeamID, "Ev-open-msg",
		`{"type":"app_home_opened","tab":"messages","user":"U1","channel":"D1"}`)
	fp := &fakeProducer{}
	w := postSignedSlack(New(deps, fp), testSigningSecret, "application/json", body)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	ev := publishedEvent(t, fp)
	if ev.Kind != slack.KindGreeting || ev.Surface != slack.SurfaceAssistant {
		t.Errorf("kind=%q surface=%q, want greeting/assistant", ev.Kind, ev.Surface)
	}
	if ev.TeamID != teamID.String() || ev.Channel != "D1" || ev.SlackUserID != "U1" {
		t.Errorf("greeting fields wrong: %+v", ev)
	}

	// Opening the Home tab is not a greeting trigger.
	homeBody := eventCallback(slackTeamID, "Ev-open-home",
		`{"type":"app_home_opened","tab":"home","user":"U1","channel":"D1"}`)
	fp2 := &fakeProducer{}
	w = postSignedSlack(New(deps, fp2), testSigningSecret, "application/json", homeBody)
	if w.Code != http.StatusOK {
		t.Fatalf("home-tab status = %d, want 200", w.Code)
	}
	if len(fp2.published) != 0 {
		t.Errorf("home-tab open published %d events, want 0", len(fp2.published))
	}
}

// TestHandleSlackEventsForwardsPausedIntegration is the end-to-end counterpart to
// the resolver test: a paused integration must still publish to the bus so the
// agent can answer with the disabled notice.
func TestHandleSlackEventsForwardsPausedIntegration(t *testing.T) {
	ctx := context.Background()
	defer cleanupSlack(ctx, t)

	teamID := uuid.New()
	slackTeamID := slackTeamIDFor(teamID)
	seedTeam(ctx, t, teamID, "team")
	seedTeamSlack(ctx, t, teamID, []string{"C1"})
	pauseTeamSlack(ctx, t, teamID)

	body := eventCallback(slackTeamID, "Ev-paused",
		`{"type":"app_mention","user":"U1","text":"<@U9> any crashes?","ts":"1718000000.000100","channel":"C1"}`)

	fp := &fakeProducer{}
	w := postSignedSlack(New(deps, fp), testSigningSecret, "application/json", body)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	ev := publishedEvent(t, fp)
	if ev.TeamID != teamID.String() {
		t.Errorf("paused integration published team_id %q, want %q", ev.TeamID, teamID.String())
	}
}

func TestHandleSlackEventsDropsUnconnectedWorkspace(t *testing.T) {
	ctx := context.Background()
	defer cleanupSlack(ctx, t)

	// No team_slack row for this workspace.
	body := eventCallback("Tnobody", "Ev-nobody",
		`{"type":"app_mention","user":"U1","text":"<@U9> hi","ts":"1718000000.000100","channel":"C1"}`)

	fp := &fakeProducer{}
	w := postSignedSlack(New(deps, fp), testSigningSecret, "application/json", body)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (ack so Slack doesn't retry)", w.Code)
	}
	if len(fp.published) != 0 {
		t.Errorf("published %d events for an unconnected workspace, want 0", len(fp.published))
	}
}

func TestHandleSlackEventsRejectsBadSignature(t *testing.T) {
	body := eventCallback("T1", "Ev-bad",
		`{"type":"app_mention","user":"U1","text":"<@U9> hi","ts":"1.1","channel":"C1"}`)

	fp := &fakeProducer{}
	w := postSignedSlack(New(deps, fp), "the-wrong-secret", "application/json", body)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401 for a bad signature", w.Code)
	}
	if len(fp.published) != 0 {
		t.Errorf("published %d events despite a bad signature, want 0", len(fp.published))
	}
}

func TestHandleSlackEventsIgnoresBotMessage(t *testing.T) {
	ctx := context.Background()
	defer cleanupSlack(ctx, t)

	teamID := uuid.New()
	slackTeamID := slackTeamIDFor(teamID)
	seedTeam(ctx, t, teamID, "team")
	seedTeamSlack(ctx, t, teamID, []string{"C1"})

	// A message from a bot (its own answers included) must never loop back in.
	body := eventCallback(slackTeamID, "Ev-bot",
		`{"type":"app_mention","bot_id":"B1","text":"<@U9> hi","ts":"1718000000.000100","channel":"C1"}`)

	fp := &fakeProducer{}
	w := postSignedSlack(New(deps, fp), testSigningSecret, "application/json", body)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	if len(fp.published) != 0 {
		t.Errorf("published %d events for a bot message, want 0", len(fp.published))
	}
}

// TestHandleSlackSlashCommands drives the alert-channel commands end to end
// against the seeded integration: register a channel, list it, then stop it.
func TestHandleSlackSlashCommands(t *testing.T) {
	ctx := context.Background()
	defer cleanupSlack(ctx, t)

	teamID := uuid.New()
	slackTeamID := slackTeamIDFor(teamID)
	seedTeam(ctx, t, teamID, "team")
	seedTeamSlack(ctx, t, teamID, []string{"C1"})

	slash := func(command, channelID string) string {
		form := url.Values{
			"command":    {command},
			"team_id":    {slackTeamID},
			"channel_id": {channelID},
		}
		body := []byte(form.Encode())
		w := postSignedSlack(New(deps, &fakeProducer{}), testSigningSecret,
			"application/x-www-form-urlencoded", body)
		if w.Code != http.StatusOK {
			t.Fatalf("%s: status = %d, want 200", command, w.Code)
		}
		return w.Body.String()
	}

	if got := slash("/subscribe-alerts", "C2"); !strings.Contains(got, "successfully registered") {
		t.Errorf("subscribe response = %q, want it to confirm registration", got)
	}
	if got := slash("/subscribe-alerts", "C2"); !strings.Contains(got, "already registered") {
		t.Errorf("re-subscribe response = %q, want it to report the channel already registered", got)
	}
	if got := slash("/list-alert-channels", ""); !strings.Contains(got, "C1") || !strings.Contains(got, "C2") {
		t.Errorf("list response = %q, want it to include C1 and C2", got)
	}
	if got := slash("/stop-alerts", "C2"); !strings.Contains(got, "successfully unregistered") {
		t.Errorf("stop response = %q, want it to confirm removal", got)
	}
	if got := slash("/list-alert-channels", ""); strings.Contains(got, "C2") {
		t.Errorf("list after stop = %q, want C2 gone", got)
	}
}
