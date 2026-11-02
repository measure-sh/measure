//go:build integration

package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"backend/libs/email"
	"backend/libs/measure"
	resendtest "backend/libs/resend/testhelpers"
	"backend/libs/turnstile"
	turnstiletest "backend/libs/turnstile/testhelpers"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/wneessen/go-mail"
)

type mailingListEvent struct {
	Subscribed  bool
	Attribution string
}

type mailingListSubscriber struct {
	Subscribed bool
	Events     []mailingListEvent
}

func (s *mailingListSubscriber) lastEvent() mailingListEvent {
	if len(s.Events) == 0 {
		return mailingListEvent{}
	}
	return s.Events[len(s.Events)-1]
}

// getMailingListSubscriber reads an address's current state and its
// history, oldest first, or nil when the address has no row.
func getMailingListSubscriber(ctx context.Context, t *testing.T, emailAddr string) *mailingListSubscriber {
	t.Helper()
	var s mailingListSubscriber
	var id string
	err := th.PgPool.QueryRow(ctx,
		`select id, subscribed from mailing_list_subscribers where email = $1`, emailAddr).Scan(&id, &s.Subscribed)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		t.Fatalf("read mailing list subscriber: %v", err)
	}
	rows, err := th.PgPool.Query(ctx,
		`select subscribed, coalesce(attribution, '') from mailing_list_subscribe_events where subscriber_id = $1 order by created_at`, id)
	if err != nil {
		t.Fatalf("read mailing list events: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var e mailingListEvent
		if err := rows.Scan(&e.Subscribed, &e.Attribution); err != nil {
			t.Fatalf("scan mailing list event: %v", err)
		}
		s.Events = append(s.Events, e)
	}
	return &s
}

func seedMailingListSubscriber(ctx context.Context, t *testing.T, emailAddr, attribution string) {
	t.Helper()
	var id string
	if err := th.PgPool.QueryRow(ctx,
		`insert into mailing_list_subscribers (email, subscribed) values ($1, true) returning id`, emailAddr).Scan(&id); err != nil {
		t.Fatalf("seed mailing list subscriber: %v", err)
	}
	if _, err := th.PgPool.Exec(ctx,
		`insert into mailing_list_subscribe_events (subscriber_id, subscribed, attribution) values ($1, true, $2)`, id, attribution); err != nil {
		t.Fatalf("seed mailing list event: %v", err)
	}
}

func TestGetMailingListPrefs(t *testing.T) {
	ctx := context.Background()

	get := func(userId uuid.UUID) *httptest.ResponseRecorder {
		c, w := newTestGinContext("GET", "/prefs/mailingList", nil)
		c.Set("userId", userId.String())
		h.GetMailingListPrefs(c)
		return w
	}

	t.Run("a user who never opted in is not subscribed", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		resendtest.Enable(t)

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "ada@example.com")

		w := get(userId)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", w.Code)
		}
		wantJSON(t, w, "enabled", true)
		wantJSON(t, w, "subscribed", false)
	})

	t.Run("an opted-in user is subscribed", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		resendtest.Enable(t)

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "ada@example.com")
		seedMailingListSubscriber(ctx, t, "ada@example.com", "settings")

		wantJSON(t, get(userId), "subscribed", true)
	})

	t.Run("a user whose address joined from the blog is subscribed", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		resendtest.Enable(t)

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "Ada@Example.com")
		seedMailingListSubscriber(ctx, t, "ada@example.com", "blog")

		wantJSON(t, get(userId), "subscribed", true)
	})

	t.Run("disabled without Resend", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "ada@example.com")

		w := get(userId)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", w.Code)
		}
		wantJSON(t, w, "enabled", false)
	})

	t.Run("unknown user → 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		if w := get(uuid.New()); w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", w.Code)
		}
	})
}

func TestUpdateMailingListPrefs(t *testing.T) {
	ctx := context.Background()

	patch := func(userId uuid.UUID, body string) *httptest.ResponseRecorder {
		c, w := newTestGinContext("PATCH", "/prefs/mailingList", strings.NewReader(body))
		c.Set("userId", userId.String())
		h.UpdateMailingListPrefs(c)
		return w
	}

	t.Run("opting in subscribes in Resend and records when and where", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		resendtest.Enable(t)

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "Ada@Example.com")

		var gotEmail string
		resendtest.MockSubscribe(t, func(_ context.Context, email, _ string) error {
			gotEmail = email
			return nil
		})

		w := patch(userId, `{"subscribed": true, "attribution": "signup"}`)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		if gotEmail != "ada@example.com" {
			t.Errorf("subscribed %q, want ada@example.com", gotEmail)
		}
		s := getMailingListSubscriber(ctx, t, "ada@example.com")
		want := mailingListEvent{Subscribed: true, Attribution: "signup"}
		if s == nil || !s.Subscribed || len(s.Events) != 1 || s.lastEvent() != want {
			t.Errorf("subscriber = %+v, want subscribed from signup", s)
		}
	})

	t.Run("opting out unsubscribes in Resend and records when and where", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		resendtest.Enable(t)

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "ada@example.com")
		seedMailingListSubscriber(ctx, t, "ada@example.com", "settings")

		unsubscribed := ""
		resendtest.MockUnsubscribe(t, func(_ context.Context, email string) error {
			unsubscribed = email
			return nil
		})

		w := patch(userId, `{"subscribed": false, "attribution": "settings"}`)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", w.Code)
		}
		if unsubscribed != "ada@example.com" {
			t.Errorf("unsubscribed %q, want ada@example.com", unsubscribed)
		}
		s := getMailingListSubscriber(ctx, t, "ada@example.com")
		want := mailingListEvent{Subscribed: false, Attribution: "settings"}
		if s == nil || s.Subscribed || len(s.Events) != 2 || s.lastEvent() != want {
			t.Errorf("subscriber = %+v, want an unsubscribe from settings appended", s)
		}
	})

	t.Run("saving the state the address already has records nothing", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		resendtest.Enable(t)
		resendtest.MockSubscribe(t, func(context.Context, string, string) error { return nil })

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "ada@example.com")
		seedMailingListSubscriber(ctx, t, "ada@example.com", "signup")

		if w := patch(userId, `{"subscribed": true, "attribution": "settings"}`); w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", w.Code)
		}

		s := getMailingListSubscriber(ctx, t, "ada@example.com")
		want := mailingListEvent{Subscribed: true, Attribution: "signup"}
		if s == nil || !s.Subscribed || len(s.Events) != 1 || s.lastEvent() != want {
			t.Errorf("subscriber = %+v, want only the original subscribe from signup", s)
		}
	})

	t.Run("a Resend failure records nothing → 500", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		resendtest.Enable(t)

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "ada@example.com")

		resendtest.MockSubscribe(t, func(context.Context, string, string) error {
			return errors.New("resend down")
		})

		w := patch(userId, `{"subscribed": true, "attribution": "settings"}`)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want 500", w.Code)
		}
		if s := getMailingListSubscriber(ctx, t, "ada@example.com"); s != nil {
			t.Errorf("subscriber = %+v, want none", s)
		}
	})

	t.Run("any attribution is recorded as sent", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		resendtest.Enable(t)
		resendtest.MockSubscribe(t, func(context.Context, string, string) error { return nil })

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "ada@example.com")

		if w := patch(userId, `{"subscribed": true, "attribution": "onboarding_email"}`); w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", w.Code)
		}
		if s := getMailingListSubscriber(ctx, t, "ada@example.com"); s == nil || s.lastEvent().Attribution != "onboarding_email" {
			t.Errorf("subscriber = %+v, want attribution onboarding_email", s)
		}
	})

	t.Run("missing attribution → 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		resendtest.Enable(t)

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "ada@example.com")

		if w := patch(userId, `{"subscribed": true}`); w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", w.Code)
		}
	})

	t.Run("disabled without Resend → 404", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "ada@example.com")

		if w := patch(userId, `{"subscribed": true, "attribution": "settings"}`); w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", w.Code)
		}
		if s := getMailingListSubscriber(ctx, t, "ada@example.com"); s != nil {
			t.Errorf("subscriber = %+v, want none", s)
		}
	})
}

// enableMailingList turns on public signups for the test and returns the
// emails that would have been sent.
func enableMailingList(t *testing.T) *[]email.EmailInfo {
	t.Helper()
	resendtest.Enable(t)
	turnstiletest.Enable(t)

	origOrigin, origFrom := deps.Config.SiteOrigin, deps.Config.TxEmailAddress
	deps.Config.SiteOrigin = "https://measure.test"
	deps.Config.TxEmailAddress = "noreply@measure.test"

	var sent []email.EmailInfo
	origSend := sendEmail
	sendEmail = func(_ *mail.Client, info email.EmailInfo) error {
		sent = append(sent, info)
		return nil
	}

	t.Cleanup(func() {
		deps.Config.SiteOrigin, deps.Config.TxEmailAddress = origOrigin, origFrom
		sendEmail = origSend
	})
	return &sent
}

func postMailingListSubscribe(body string) *httptest.ResponseRecorder {
	c, w := newTestGinContext("POST", "/mailingList/subscribe", strings.NewReader(body))
	h.SubscribeMailingList(c)
	return w
}

func subscribeMailingList(t *testing.T, emailAddr string) *httptest.ResponseRecorder {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"email": emailAddr, "attribution": "blog", "turnstile_token": turnstiletest.PassingToken})
	return postMailingListSubscribe(string(body))
}

func confirmMailingList(t *testing.T, token string) *httptest.ResponseRecorder {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"token": token})
	c, w := newTestGinContext("POST", "/mailingList/confirm", strings.NewReader(string(body)))
	h.ConfirmMailingList(c)
	return w
}

var confirmTokenPattern = regexp.MustCompile(`/mailing_list/confirm\?token=([A-Za-z0-9_-]+)`)

func tokenFromEmail(t *testing.T, info email.EmailInfo) string {
	t.Helper()
	m := confirmTokenPattern.FindStringSubmatch(info.Body)
	if m == nil {
		t.Fatalf("no confirmation link in email body")
	}
	return m[1]
}

type mailingListSignup struct {
	Subscribed  bool
	HasToken    bool
	Attribution string
}

func getMailingListSignup(ctx context.Context, t *testing.T, emailAddr string) *mailingListSignup {
	t.Helper()
	var s mailingListSignup
	err := th.PgPool.QueryRow(ctx,
		`select subscribed, confirmation_token_hash is not null, coalesce(confirmation_attribution, '') from mailing_list_subscribers where email = $1`, emailAddr).
		Scan(&s.Subscribed, &s.HasToken, &s.Attribution)
	if err != nil {
		return nil
	}
	return &s
}

func TestSubscribeMailingList(t *testing.T) {
	ctx := context.Background()

	t.Run("disabled without Turnstile → 404", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		sent := enableMailingList(t)
		turnstile.Init(turnstile.Config{})

		if w := subscribeMailingList(t, "ada@example.com"); w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", w.Code)
		}
		if len(*sent) != 0 {
			t.Errorf("emails = %d, want 0", len(*sent))
		}
	})

	t.Run("a missing or failed Turnstile check is refused without an email", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		sent := enableMailingList(t)

		for name, body := range map[string]string{
			"missing": `{"email": "ada@example.com", "attribution": "blog"}`,
			"failed":  `{"email": "ada@example.com", "attribution": "blog", "turnstile_token": "bot"}`,
		} {
			if w := postMailingListSubscribe(body); w.Code != http.StatusBadRequest {
				t.Errorf("%s token status = %d, want 400", name, w.Code)
			}
		}
		if len(*sent) != 0 {
			t.Errorf("emails = %d, want 0", len(*sent))
		}
		if s := getMailingListSignup(ctx, t, "ada@example.com"); s != nil {
			t.Errorf("signup = %+v, want none", s)
		}
	})

	t.Run("when Cloudflare cannot be reached nothing is sent → 500", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		sent := enableMailingList(t)
		turnstiletest.MockVerify(t, func(context.Context, string) (bool, error) {
			return false, errors.New("cloudflare down")
		})

		if w := subscribeMailingList(t, "ada@example.com"); w.Code != http.StatusInternalServerError {
			t.Errorf("status = %d, want 500", w.Code)
		}
		if len(*sent) != 0 {
			t.Errorf("emails = %d, want 0", len(*sent))
		}
	})

	t.Run("a new address gets a confirmation email and is not subscribed yet", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		sent := enableMailingList(t)
		resendtest.MockSubscribe(t, func(context.Context, string, string) error {
			t.Error("Resend called before the address was confirmed")
			return nil
		})

		w := subscribeMailingList(t, " Ada@Example.com ")

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		if len(*sent) != 1 {
			t.Fatalf("emails = %d, want 1", len(*sent))
		}
		info := (*sent)[0]
		if info.To != "ada@example.com" || info.From != "noreply@measure.test" || !strings.Contains(info.Subject, "Confirm") {
			t.Errorf("email = %+v", info)
		}
		if !strings.Contains(info.Body, "https://measure.test/mailing_list/confirm?token=") {
			t.Errorf("email body has no confirmation link")
		}
		s := getMailingListSignup(ctx, t, "ada@example.com")
		if s == nil || s.Subscribed || !s.HasToken || s.Attribution != "blog" {
			t.Errorf("signup = %+v, want pending blog signup", s)
		}
	})

	t.Run("an address subscribed from the dashboard stays subscribed while it confirms", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		sent := enableMailingList(t)
		resendtest.MockSubscribe(t, func(context.Context, string, string) error { return nil })
		seedMailingListSubscriber(ctx, t, "ada@example.com", "settings")

		if w := subscribeMailingList(t, "ada@example.com"); w.Code != http.StatusOK {
			t.Fatalf("status = %d", w.Code)
		}
		if s := getMailingListSignup(ctx, t, "ada@example.com"); s == nil || !s.Subscribed || !s.HasToken {
			t.Errorf("before confirming = %+v, want subscribed with a pending confirmation", s)
		}

		if w := confirmMailingList(t, tokenFromEmail(t, (*sent)[0])); w.Code != http.StatusOK {
			t.Fatalf("confirm status = %d", w.Code)
		}
		if s := getMailingListSignup(ctx, t, "ada@example.com"); s == nil || !s.Subscribed || s.HasToken {
			t.Errorf("after confirming = %+v, want subscribed with the link used up", s)
		}
		s := getMailingListSubscriber(ctx, t, "ada@example.com")
		want := mailingListEvent{Subscribed: true, Attribution: "settings"}
		if s == nil || len(s.Events) != 1 || s.lastEvent() != want {
			t.Errorf("history = %+v, want only the original subscribe from settings", s)
		}
	})

	t.Run("a subscriber who unsubscribed can subscribe again", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		sent := enableMailingList(t)
		var subscribed []string
		resendtest.MockSubscribe(t, func(_ context.Context, addr, _ string) error {
			subscribed = append(subscribed, addr)
			return nil
		})

		subscribeMailingList(t, "ada@example.com")
		if w := confirmMailingList(t, tokenFromEmail(t, (*sent)[0])); w.Code != http.StatusOK {
			t.Fatalf("first confirm status = %d", w.Code)
		}

		w := subscribeMailingList(t, "ada@example.com")

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", w.Code)
		}
		wantJSON(t, w, "ok", "Check your inbox to confirm your subscription.")
		if len(*sent) != 2 {
			t.Fatalf("emails = %d, want 2", len(*sent))
		}
		if w := confirmMailingList(t, tokenFromEmail(t, (*sent)[1])); w.Code != http.StatusOK {
			t.Fatalf("second confirm status = %d", w.Code)
		}
		if len(subscribed) != 2 {
			t.Errorf("Resend subscribes = %d, want 2 (the second re-subscribes)", len(subscribed))
		}
	})

	t.Run("a repeat request replaces the earlier link", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		sent := enableMailingList(t)
		resendtest.MockSubscribe(t, func(context.Context, string, string) error { return nil })

		subscribeMailingList(t, "ada@example.com")
		subscribeMailingList(t, "ada@example.com")

		if len(*sent) != 2 {
			t.Fatalf("emails = %d, want 2", len(*sent))
		}
		if w := confirmMailingList(t, tokenFromEmail(t, (*sent)[0])); w.Code != http.StatusBadRequest {
			t.Errorf("old link status = %d, want 400", w.Code)
		}
		if w := confirmMailingList(t, tokenFromEmail(t, (*sent)[1])); w.Code != http.StatusOK {
			t.Errorf("new link status = %d, want 200", w.Code)
		}
	})

	t.Run("the attribution comes from the request, and is required", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		sent := enableMailingList(t)

		send := func(attribution string) int {
			body, _ := json.Marshal(map[string]string{"email": "ada@example.com", "attribution": attribution, "turnstile_token": turnstiletest.PassingToken})
			return postMailingListSubscribe(string(body)).Code
		}
		if code := send(""); code != http.StatusBadRequest {
			t.Errorf("missing attribution status = %d, want 400", code)
		}
		if code := send("  "); code != http.StatusBadRequest {
			t.Errorf("blank attribution status = %d, want 400", code)
		}
		if code := send("changelog"); code != http.StatusOK {
			t.Fatalf("status = %d, want 200", code)
		}
		if s := getMailingListSignup(ctx, t, "ada@example.com"); s == nil || s.Attribution != "changelog" {
			t.Errorf("signup = %+v, want attribution changelog", s)
		}
		if len(*sent) != 1 {
			t.Errorf("emails = %d, want 1", len(*sent))
		}
	})

	t.Run("invalid addresses are refused without an email", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		sent := enableMailingList(t)

		for _, addr := range []string{"", "not-an-email", "Ada <ada@example.com>", "a@b, c@d", "ada@localhost", strings.Repeat("a", 250) + "@example.com"} {
			if w := subscribeMailingList(t, addr); w.Code != http.StatusBadRequest {
				t.Errorf("%q status = %d, want 400", addr, w.Code)
			}
		}
		if len(*sent) != 0 {
			t.Errorf("emails = %d, want 0", len(*sent))
		}
	})
}

func TestConfirmMailingList(t *testing.T) {
	ctx := context.Background()

	t.Run("the link subscribes the address in Resend", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		sent := enableMailingList(t)
		var subscribed []string
		resendtest.MockSubscribe(t, func(_ context.Context, addr, _ string) error {
			subscribed = append(subscribed, addr)
			return nil
		})

		subscribeMailingList(t, "ada@example.com")
		token := tokenFromEmail(t, (*sent)[0])

		if w := confirmMailingList(t, token); w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		s := getMailingListSubscriber(ctx, t, "ada@example.com")
		want := mailingListEvent{Subscribed: true, Attribution: "blog"}
		if s == nil || !s.Subscribed || len(s.Events) != 1 || s.lastEvent() != want {
			t.Errorf("subscriber = %+v, want subscribed from the blog", s)
		}

		// Each link works once.
		if w := confirmMailingList(t, token); w.Code != http.StatusBadRequest {
			t.Errorf("second status = %d, want 400", w.Code)
		}
		if len(subscribed) != 1 || subscribed[0] != "ada@example.com" {
			t.Errorf("subscribed = %v, want [ada@example.com]", subscribed)
		}
	})

	t.Run("an unknown token is refused", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		enableMailingList(t)

		if w := confirmMailingList(t, "not-a-real-token"); w.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want 400", w.Code)
		}
	})

	t.Run("an expired link is refused", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		sent := enableMailingList(t)
		resendtest.MockSubscribe(t, func(context.Context, string, string) error {
			t.Error("Resend called for an expired link")
			return nil
		})

		subscribeMailingList(t, "ada@example.com")
		if _, err := th.PgPool.Exec(ctx, `update mailing_list_subscribers set confirmation_expires_at = now() - interval '1 minute'`); err != nil {
			t.Fatalf("expire token: %v", err)
		}

		w := confirmMailingList(t, tokenFromEmail(t, (*sent)[0]))
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", w.Code)
		}
		wantJSONContains(t, w, "error", "expired")
	})

	t.Run("a Resend failure leaves the signup unconfirmed → 500", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		sent := enableMailingList(t)
		resendtest.MockSubscribe(t, func(context.Context, string, string) error { return errors.New("resend down") })

		subscribeMailingList(t, "ada@example.com")
		if w := confirmMailingList(t, tokenFromEmail(t, (*sent)[0])); w.Code != http.StatusInternalServerError {
			t.Errorf("status = %d, want 500", w.Code)
		}
		if s := getMailingListSignup(ctx, t, "ada@example.com"); s == nil || s.Subscribed {
			t.Errorf("signup = %+v, want unconfirmed", s)
		}
	})
}

func TestHandleResendWebhook(t *testing.T) {
	ctx := context.Background()
	const secret = "whsec_C2FVsBQIhrscChlQIMV+b5sSYspob7oD"

	enable := func(t *testing.T) {
		t.Helper()
		resendtest.Enable(t)
		orig := deps.Config.ResendWebhookSecret
		deps.Config.ResendWebhookSecret = secret
		t.Cleanup(func() { deps.Config.ResendWebhookSecret = orig })
	}

	post := func(payload []byte, headers http.Header) *httptest.ResponseRecorder {
		c, w := newTestGinContext("POST", "/resend/webhook", strings.NewReader(string(payload)))
		for k, v := range headers {
			c.Request.Header[k] = v
		}
		h.HandleResendWebhook(c)
		return w
	}

	contactUpdated := func(emailAddr string, unsubscribed bool) []byte {
		return []byte(fmt.Sprintf(`{"type":"contact.updated","created_at":"2026-10-31T10:00:00.000Z","data":{"id":"e169aa45-1ecf-4183-9955-b1499d5701d3","audience_id":"78261eea-8f8b-4381-83c6-79fa7120f1cf","segment_ids":["seg_test"],"created_at":"2026-10-01T10:00:00.000Z","updated_at":"2026-10-31T10:00:00.000Z","email":%q,"first_name":"","last_name":"","unsubscribed":%t}}`, emailAddr, unsubscribed))
	}

	t.Run("a blog subscriber who unsubscribes through an email link is recorded", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		enable(t)
		seedMailingListSubscriber(ctx, t, "ada@example.com", "blog")

		payload := contactUpdated("Ada@example.com", true)
		w := post(payload, signSvixWebhook(t, secret, "msg_unsub", payload))

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		s := getMailingListSubscriber(ctx, t, "ada@example.com")
		want := mailingListEvent{Subscribed: false, Attribution: measure.MailingListAttributionUnsubscribeLink}
		if s == nil || s.Subscribed || len(s.Events) != 2 || s.lastEvent() != want {
			t.Errorf("subscriber = %+v, want an unsubscribe through the email link appended", s)
		}
	})

	t.Run("an unsubscribe already recorded here is not recorded again", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		enable(t)

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "ada@example.com")
		seedMailingListSubscriber(ctx, t, "ada@example.com", "settings")
		resendtest.MockUnsubscribe(t, func(context.Context, string) error { return nil })
		if err := measure.SetMailingListSubscription(ctx, th.PgPool, userId, false, "settings"); err != nil {
			t.Fatalf("unsubscribe from settings: %v", err)
		}

		payload := contactUpdated("ada@example.com", true)
		if w := post(payload, signSvixWebhook(t, secret, "msg_settings", payload)); w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", w.Code)
		}
		want := mailingListEvent{Subscribed: false, Attribution: "settings"}
		if s := getMailingListSubscriber(ctx, t, "ada@example.com"); s == nil || len(s.Events) != 2 || s.lastEvent() != want {
			t.Errorf("subscriber = %+v, want only the unsubscribe from settings", s)
		}
	})

	t.Run("an invalid signature is refused and records nothing", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		enable(t)
		seedMailingListSubscriber(ctx, t, "ada@example.com", "blog")

		payload := contactUpdated("ada@example.com", true)
		headers := signSvixWebhook(t, secret, "msg_forged", contactUpdated("someone@example.com", true))
		if w := post(payload, headers); w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", w.Code)
		}
		if s := getMailingListSubscriber(ctx, t, "ada@example.com"); s == nil || !s.Subscribed || len(s.Events) != 1 {
			t.Errorf("subscriber = %+v, want unchanged", s)
		}
	})

	t.Run("disabled without the webhook secret → 404", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		resendtest.Enable(t)

		payload := contactUpdated("ada@example.com", true)
		if w := post(payload, signSvixWebhook(t, secret, "msg_disabled", payload)); w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", w.Code)
		}
	})
}
