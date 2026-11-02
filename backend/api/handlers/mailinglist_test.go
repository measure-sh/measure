//go:build integration

package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"regexp"
	"strings"
	"testing"

	"backend/libs/email"
	"backend/libs/measure"
	"backend/libs/turnstile"
	turnstiletest "backend/libs/turnstile/testhelpers"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/wneessen/go-mail"
)

type mailingListEvent struct {
	ListID      string
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
		`select s.id, coalesce(l.subscribed, false) from mailing_list_subscribers s left join mailing_list_subscriptions l on l.subscriber_id = s.id and l.list_id = 'newsletter' where s.email = $1`, emailAddr).Scan(&id, &s.Subscribed)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		t.Fatalf("read mailing list subscriber: %v", err)
	}
	rows, err := th.PgPool.Query(ctx,
		`select list_id, subscribed, coalesce(attribution, '') from mailing_list_subscribe_events where subscriber_id = $1 order by created_at`, id)
	if err != nil {
		t.Fatalf("read mailing list events: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var e mailingListEvent
		if err := rows.Scan(&e.ListID, &e.Subscribed, &e.Attribution); err != nil {
			t.Fatalf("scan mailing list event: %v", err)
		}
		s.Events = append(s.Events, e)
	}
	return &s
}

// seedMailingListSubscriber subscribes the address to the newsletter and
// returns its subscriber id.
func seedMailingListSubscriber(ctx context.Context, t *testing.T, emailAddr, attribution string) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	if err := th.PgPool.QueryRow(ctx,
		`insert into mailing_list_subscribers (email) values ($1) returning id`, emailAddr).Scan(&id); err != nil {
		t.Fatalf("seed mailing list subscriber: %v", err)
	}
	if _, err := th.PgPool.Exec(ctx,
		`insert into mailing_list_subscriptions (subscriber_id, list_id, subscribed) values ($1, 'newsletter', true)`, id); err != nil {
		t.Fatalf("seed mailing list subscription: %v", err)
	}
	if _, err := th.PgPool.Exec(ctx,
		`insert into mailing_list_subscribe_events (subscriber_id, list_id, subscribed, attribution) values ($1, 'newsletter', true, $2)`, id, attribution); err != nil {
		t.Fatalf("seed mailing list event: %v", err)
	}
	return id
}

// newsletterSubscribed reads whether a response's lists have the newsletter
// subscribed.
func newsletterSubscribed(t *testing.T, w *httptest.ResponseRecorder) bool {
	t.Helper()
	var body struct {
		Lists []struct {
			ListID     string `json:"list_id"`
			Name       string `json:"name"`
			Subscribed bool   `json:"subscribed"`
		} `json:"lists"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode lists: %v, body: %s", err, w.Body.String())
	}
	if len(body.Lists) != 1 || body.Lists[0].ListID != "newsletter" || body.Lists[0].Name != "Measure newsletter" {
		t.Fatalf("lists = %+v, want only the Measure newsletter", body.Lists)
	}
	return body.Lists[0].Subscribed
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
		enableCloud(t)

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "ada@example.com")

		w := get(userId)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", w.Code)
		}
		wantJSON(t, w, "enabled", true)
		if newsletterSubscribed(t, w) {
			t.Error("subscribed, want not subscribed")
		}
	})

	t.Run("an opted-in user is subscribed", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		enableCloud(t)

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "ada@example.com")
		seedMailingListSubscriber(ctx, t, "ada@example.com", "settings")

		if !newsletterSubscribed(t, get(userId)) {
			t.Error("not subscribed, want subscribed")
		}
	})

	t.Run("a user whose address joined from the blog is subscribed", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		enableCloud(t)

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "Ada@Example.com")
		seedMailingListSubscriber(ctx, t, "ada@example.com", "blog")

		if !newsletterSubscribed(t, get(userId)) {
			t.Error("not subscribed, want subscribed")
		}
	})

	t.Run("disabled outside Measure cloud", func(t *testing.T) {
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

	t.Run("opting in records when and where", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		enableCloud(t)

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "Ada@Example.com")

		w := patch(userId, `{"list_id": "newsletter", "subscribed": true, "attribution": "signup"}`)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		s := getMailingListSubscriber(ctx, t, "ada@example.com")
		want := mailingListEvent{ListID: "newsletter", Subscribed: true, Attribution: "signup"}
		if s == nil || !s.Subscribed || len(s.Events) != 1 || s.lastEvent() != want {
			t.Errorf("subscriber = %+v, want subscribed from signup", s)
		}
	})

	t.Run("opting out records when and where", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		enableCloud(t)

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "ada@example.com")
		seedMailingListSubscriber(ctx, t, "ada@example.com", "settings")

		w := patch(userId, `{"list_id": "newsletter", "subscribed": false, "attribution": "settings"}`)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", w.Code)
		}
		s := getMailingListSubscriber(ctx, t, "ada@example.com")
		want := mailingListEvent{ListID: "newsletter", Subscribed: false, Attribution: "settings"}
		if s == nil || s.Subscribed || len(s.Events) != 2 || s.lastEvent() != want {
			t.Errorf("subscriber = %+v, want an unsubscribe from settings appended", s)
		}
	})

	t.Run("saving the state the address already has records nothing", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		enableCloud(t)

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "ada@example.com")
		seedMailingListSubscriber(ctx, t, "ada@example.com", "signup")

		if w := patch(userId, `{"list_id": "newsletter", "subscribed": true, "attribution": "settings"}`); w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", w.Code)
		}

		s := getMailingListSubscriber(ctx, t, "ada@example.com")
		want := mailingListEvent{ListID: "newsletter", Subscribed: true, Attribution: "signup"}
		if s == nil || !s.Subscribed || len(s.Events) != 1 || s.lastEvent() != want {
			t.Errorf("subscriber = %+v, want only the original subscribe from signup", s)
		}
	})

	t.Run("any attribution is recorded as sent", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		enableCloud(t)

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "ada@example.com")

		if w := patch(userId, `{"list_id": "newsletter", "subscribed": true, "attribution": "onboarding_email"}`); w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", w.Code)
		}
		if s := getMailingListSubscriber(ctx, t, "ada@example.com"); s == nil || s.lastEvent().Attribution != "onboarding_email" {
			t.Errorf("subscriber = %+v, want attribution onboarding_email", s)
		}
	})

	t.Run("an unknown list → 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		enableCloud(t)

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "ada@example.com")

		if w := patch(userId, `{"list_id": "weekly", "subscribed": true, "attribution": "settings"}`); w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", w.Code)
		}
		if s := getMailingListSubscriber(ctx, t, "ada@example.com"); s != nil {
			t.Errorf("subscriber = %+v, want none", s)
		}
	})

	t.Run("missing attribution → 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		enableCloud(t)

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "ada@example.com")

		if w := patch(userId, `{"list_id": "newsletter", "subscribed": true}`); w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", w.Code)
		}
	})

	t.Run("disabled outside Measure cloud → 404", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "ada@example.com")

		if w := patch(userId, `{"list_id": "newsletter", "subscribed": true, "attribution": "settings"}`); w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", w.Code)
		}
		if s := getMailingListSubscriber(ctx, t, "ada@example.com"); s != nil {
			t.Errorf("subscriber = %+v, want none", s)
		}
	})
}

// enableCloud runs the test as Measure cloud, where the mailing list is on.
func enableCloud(t *testing.T) {
	t.Helper()
	orig := deps.Config.CloudEnv
	deps.Config.CloudEnv = true
	t.Cleanup(func() { deps.Config.CloudEnv = orig })
}

// enableMailingList turns on public signups for the test and returns the
// emails that would have been sent.
func enableMailingList(t *testing.T) *[]email.EmailInfo {
	t.Helper()
	enableCloud(t)
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
	body, _ := json.Marshal(map[string]string{"email": emailAddr, "list_id": "newsletter", "attribution": "blog", "turnstile_token": turnstiletest.PassingToken})
	return postMailingListSubscribe(string(body))
}

func confirmMailingList(t *testing.T, token string) *httptest.ResponseRecorder {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"token": token})
	c, w := newTestGinContext("POST", "/mailingList/confirm", strings.NewReader(string(body)))
	h.ConfirmMailingList(c)
	return w
}

var confirmTokenPattern = regexp.MustCompile(`/subscribe/confirm\?token=([A-Za-z0-9_-]+)`)

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
		`select coalesce(l.subscribed, false), s.confirmation_token_hash is not null, coalesce(s.confirmation_attribution, '') from mailing_list_subscribers s left join mailing_list_subscriptions l on l.subscriber_id = s.id and l.list_id = 'newsletter' where s.email = $1`, emailAddr).
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
			"missing": `{"email": "ada@example.com", "list_id": "newsletter", "attribution": "blog"}`,
			"failed":  `{"email": "ada@example.com", "list_id": "newsletter", "attribution": "blog", "turnstile_token": "bot"}`,
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
		if !strings.Contains(info.Body, "https://measure.test/subscribe/confirm?token=") {
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
		want := mailingListEvent{ListID: "newsletter", Subscribed: true, Attribution: "settings"}
		if s == nil || len(s.Events) != 1 || s.lastEvent() != want {
			t.Errorf("history = %+v, want only the original subscribe from settings", s)
		}
	})

	t.Run("a subscriber who unsubscribed can subscribe again", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		sent := enableMailingList(t)

		subscribeMailingList(t, "ada@example.com")
		if w := confirmMailingList(t, tokenFromEmail(t, (*sent)[0])); w.Code != http.StatusOK {
			t.Fatalf("first confirm status = %d", w.Code)
		}
		if _, err := th.PgPool.Exec(ctx, `update mailing_list_subscriptions set subscribed = false`); err != nil {
			t.Fatalf("unsubscribe: %v", err)
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
		if s := getMailingListSignup(ctx, t, "ada@example.com"); s == nil || !s.Subscribed {
			t.Errorf("signup = %+v, want subscribed again", s)
		}
	})

	t.Run("a repeat request replaces the earlier link", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		sent := enableMailingList(t)

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
			body, _ := json.Marshal(map[string]string{"email": "ada@example.com", "list_id": "newsletter", "attribution": attribution, "turnstile_token": turnstiletest.PassingToken})
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

	t.Run("an unknown list is refused without an email", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		sent := enableMailingList(t)

		body, _ := json.Marshal(map[string]string{"email": "ada@example.com", "list_id": "weekly", "attribution": "blog", "turnstile_token": turnstiletest.PassingToken})
		if w := postMailingListSubscribe(string(body)); w.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want 400", w.Code)
		}
		if len(*sent) != 0 {
			t.Errorf("emails = %d, want 0", len(*sent))
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

	t.Run("the link subscribes the address", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		sent := enableMailingList(t)

		subscribeMailingList(t, "ada@example.com")
		token := tokenFromEmail(t, (*sent)[0])

		if w := confirmMailingList(t, token); w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		s := getMailingListSubscriber(ctx, t, "ada@example.com")
		want := mailingListEvent{ListID: "newsletter", Subscribed: true, Attribution: "blog"}
		if s == nil || !s.Subscribed || len(s.Events) != 1 || s.lastEvent() != want {
			t.Errorf("subscriber = %+v, want subscribed from the blog", s)
		}

		// Each link works once.
		if w := confirmMailingList(t, token); w.Code != http.StatusBadRequest {
			t.Errorf("second status = %d, want 400", w.Code)
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

}

func TestUnsubscribeMailingList(t *testing.T) {
	ctx := context.Background()
	const key = "test-unsubscribe-key"

	enable := func(t *testing.T) {
		t.Helper()
		enableCloud(t)
		origKey, origOrigin := deps.Config.MailingListUnsubscribeKey, deps.Config.SiteOrigin
		deps.Config.MailingListUnsubscribeKey = key
		deps.Config.SiteOrigin = "https://measure.test"
		t.Cleanup(func() { deps.Config.MailingListUnsubscribeKey, deps.Config.SiteOrigin = origKey, origOrigin })
	}

	linkQuery := func(id uuid.UUID) string {
		return url.Values{"id": {id.String()}, "sig": {measure.SignMailingListUnsubscribe(key, id)}, "list": {"newsletter"}}.Encode()
	}

	fromPage := func(id uuid.UUID, sig string) *httptest.ResponseRecorder {
		body, _ := json.Marshal(map[string]string{"id": id.String(), "sig": sig, "list_id": "newsletter"})
		c, w := newTestGinContext("POST", "/mailingList/unsubscribe", strings.NewReader(string(body)))
		h.UnsubscribeMailingList(c)
		return w
	}

	oneClick := func(query string) *httptest.ResponseRecorder {
		c, w := newTestGinContext("POST", "/mailingList/unsubscribe?"+query, strings.NewReader("List-Unsubscribe=One-Click"))
		c.Request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		h.UnsubscribeMailingList(c)
		return w
	}

	subscriptions := func(query string) *httptest.ResponseRecorder {
		c, w := newTestGinContext("GET", "/mailingList/subscriptions?"+query, nil)
		h.GetMailingListLinkSubscriptions(c)
		return w
	}

	t.Run("the page's button unsubscribes and records the link", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		enable(t)
		id := seedMailingListSubscriber(ctx, t, "ada@example.com", "blog")

		w := fromPage(id, measure.SignMailingListUnsubscribe(key, id))

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		wantJSON(t, w, "ok", "You're unsubscribed.")
		s := getMailingListSubscriber(ctx, t, "ada@example.com")
		want := mailingListEvent{ListID: "newsletter", Subscribed: false, Attribution: measure.MailingListAttributionUnsubscribeLink}
		if s == nil || s.Subscribed || len(s.Events) != 2 || s.lastEvent() != want {
			t.Errorf("subscriber = %+v, want an unsubscribe through the link appended", s)
		}
	})

	t.Run("a one-click unsubscribe from the inbox gets an empty 200", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		enable(t)
		id := seedMailingListSubscriber(ctx, t, "ada@example.com", "blog")

		w := oneClick(linkQuery(id))

		if w.Code != http.StatusOK || w.Body.Len() != 0 {
			t.Fatalf("status = %d, body = %q, want an empty 200", w.Code, w.Body.String())
		}
		if s := getMailingListSubscriber(ctx, t, "ada@example.com"); s == nil || s.Subscribed {
			t.Errorf("subscriber = %+v, want unsubscribed", s)
		}
	})

	t.Run("unsubscribing again records nothing", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		enable(t)
		id := seedMailingListSubscriber(ctx, t, "ada@example.com", "blog")

		oneClick(linkQuery(id))
		if w := oneClick(linkQuery(id)); w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", w.Code)
		}
		if s := getMailingListSubscriber(ctx, t, "ada@example.com"); s == nil || len(s.Events) != 2 {
			t.Errorf("subscriber = %+v, want one unsubscribe", s)
		}
	})

	t.Run("a link with a wrong signature, another subscriber's signature or an unknown list is refused", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		enable(t)
		id := seedMailingListSubscriber(ctx, t, "ada@example.com", "blog")
		other := seedMailingListSubscriber(ctx, t, "grace@example.com", "blog")

		for name, query := range map[string]string{
			"wrong signature":   url.Values{"id": {id.String()}, "sig": {"forged"}, "list": {"newsletter"}}.Encode(),
			"other subscriber":  url.Values{"id": {id.String()}, "sig": {measure.SignMailingListUnsubscribe(key, other)}, "list": {"newsletter"}}.Encode(),
			"other key":         url.Values{"id": {id.String()}, "sig": {measure.SignMailingListUnsubscribe("another-key", id)}, "list": {"newsletter"}}.Encode(),
			"unknown list":      url.Values{"id": {id.String()}, "sig": {measure.SignMailingListUnsubscribe(key, id)}, "list": {"weekly"}}.Encode(),
			"not a subscriber":  linkQuery(uuid.New()),
			"missing signature": url.Values{"id": {id.String()}, "list": {"newsletter"}}.Encode(),
		} {
			if w := oneClick(query); w.Code != http.StatusBadRequest {
				t.Errorf("%s: status = %d, want 400", name, w.Code)
			}
		}
		if s := getMailingListSubscriber(ctx, t, "ada@example.com"); s == nil || !s.Subscribed || len(s.Events) != 1 {
			t.Errorf("subscriber = %+v, want unchanged", s)
		}
	})

	t.Run("without a key every link is refused", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		enable(t)
		deps.Config.MailingListUnsubscribeKey = ""
		id := seedMailingListSubscriber(ctx, t, "ada@example.com", "blog")

		if w := fromPage(id, measure.SignMailingListUnsubscribe("", id)); w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", w.Code)
		}
	})

	t.Run("the page reads the link's lists", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		enable(t)
		id := seedMailingListSubscriber(ctx, t, "ada@example.com", "blog")

		w := subscriptions(linkQuery(id))

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		if !newsletterSubscribed(t, w) {
			t.Error("not subscribed, want subscribed")
		}
		if w := subscriptions(url.Values{"id": {id.String()}, "sig": {"forged"}}.Encode()); w.Code != http.StatusBadRequest {
			t.Errorf("forged link status = %d, want 400", w.Code)
		}
	})

	t.Run("opening the header's address in a browser goes to the page", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		enable(t)
		id := seedMailingListSubscriber(ctx, t, "ada@example.com", "blog")

		c, w := newTestGinContext("GET", "/mailingList/unsubscribe?"+linkQuery(id), nil)
		h.RedirectMailingListUnsubscribe(c)

		if w.Code != http.StatusFound {
			t.Fatalf("status = %d, want 302", w.Code)
		}
		if got, want := w.Header().Get("Location"), "https://measure.test/unsubscribe?"+linkQuery(id); got != want {
			t.Errorf("Location = %q, want %q", got, want)
		}
		if s := getMailingListSubscriber(ctx, t, "ada@example.com"); s == nil || !s.Subscribed {
			t.Errorf("subscriber = %+v, want still subscribed", s)
		}
	})

	t.Run("disabled outside Measure cloud → 404", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		id := seedMailingListSubscriber(ctx, t, "ada@example.com", "blog")

		if w := oneClick(linkQuery(id)); w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", w.Code)
		}
	})
}
