//go:build integration

package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"backend/libs/email"
	"backend/libs/measure"
	resendtest "backend/libs/resend/testhelpers"

	"github.com/gin-gonic/gin"
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

// seedMailingListSubscriber subscribes an address, with the event that
// subscribed it.
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
		resendtest.MockContactSubscribed(t, func(context.Context, string) (bool, error) { return true, nil })

		wantJSON(t, get(userId), "subscribed", true)
	})

	t.Run("a user whose address joined from the blog is subscribed", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		resendtest.Enable(t)

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "Ada@Example.com")
		seedMailingListSubscriber(ctx, t, "ada@example.com", "blog")
		var looked string
		resendtest.MockContactSubscribed(t, func(_ context.Context, email string) (bool, error) {
			looked = email
			return true, nil
		})

		wantJSON(t, get(userId), "subscribed", true)
		if looked != "ada@example.com" {
			t.Errorf("looked up %q, want the lowercased address", looked)
		}
	})

	t.Run("a user who unsubscribed through an email link is not subscribed, and the record says so", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		resendtest.Enable(t)

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "ada@example.com")
		seedMailingListSubscriber(ctx, t, "ada@example.com", "settings")
		resendtest.MockContactSubscribed(t, func(context.Context, string) (bool, error) { return false, nil })

		wantJSON(t, get(userId), "subscribed", false)
		s := getMailingListSubscriber(ctx, t, "ada@example.com")
		want := mailingListEvent{Subscribed: false, Attribution: measure.MailingListAttributionUnsubscribeLink}
		if s == nil || s.Subscribed || len(s.Events) != 2 || s.lastEvent() != want {
			t.Errorf("subscriber = %+v, want an unsubscribe through the email link appended", s)
		}
	})

	t.Run("when Resend cannot be reached the record's answer is used", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		resendtest.Enable(t)

		userId := uuid.New()
		seedUser(ctx, t, userId.String(), "ada@example.com")
		seedMailingListSubscriber(ctx, t, "ada@example.com", "settings")
		resendtest.MockContactSubscribed(t, func(context.Context, string) (bool, error) {
			return false, errors.New("resend down")
		})

		wantJSON(t, get(userId), "subscribed", true)
		if s := getMailingListSubscriber(ctx, t, "ada@example.com"); s == nil || !s.Subscribed || len(s.Events) != 1 {
			t.Errorf("subscriber = %+v, want unchanged", s)
		}
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

const (
	testProxySecret       = "test-dashboard-proxy-secret"
	testMailingListClient = "203.0.113.7"
)

// enableMailingList turns public mailing list signups on for the duration of a
// test, and captures every email instead of sending it.
func enableMailingList(t *testing.T) *[]email.EmailInfo {
	t.Helper()
	resendtest.Enable(t)

	origSecret, origOrigin, origFrom := deps.Config.DashboardProxySecret, deps.Config.SiteOrigin, deps.Config.TxEmailAddress
	deps.Config.DashboardProxySecret = testProxySecret
	deps.Config.SiteOrigin = "https://measure.test"
	deps.Config.TxEmailAddress = "noreply@measure.test"

	var sent []email.EmailInfo
	origSend := sendEmail
	sendEmail = func(_ *mail.Client, info email.EmailInfo) error {
		sent = append(sent, info)
		return nil
	}

	t.Cleanup(func() {
		deps.Config.DashboardProxySecret, deps.Config.SiteOrigin, deps.Config.TxEmailAddress = origSecret, origOrigin, origFrom
		sendEmail = origSend
	})
	return &sent
}

// newProxiedContext builds a request as the dashboard proxy forwards it,
// from the visitor at clientIP.
func newProxiedContext(method, path, clientIP string, body io.Reader) (*gin.Context, *httptest.ResponseRecorder) {
	c, w := newTestGinContext(method, path, body)
	c.Request.Header.Set(dashboardProxySecretHeader, testProxySecret)
	c.Request.Header.Set(dashboardClientIPHeader, clientIP)
	return c, w
}

func subscribeMailingList(t *testing.T, emailAddr string) *httptest.ResponseRecorder {
	t.Helper()
	return subscribeMailingListFrom(t, testMailingListClient, emailAddr)
}

func subscribeMailingListFrom(t *testing.T, clientIP, emailAddr string) *httptest.ResponseRecorder {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"email": emailAddr, "attribution": "blog"})
	c, w := newProxiedContext("POST", "/mailingList/subscribe", clientIP, strings.NewReader(string(body)))
	h.SubscribeMailingList(c)
	return w
}

func confirmMailingList(t *testing.T, token string) *httptest.ResponseRecorder {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"token": token})
	c, w := newProxiedContext("POST", "/mailingList/confirm", testMailingListClient, strings.NewReader(string(body)))
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

	t.Run("disabled without the dashboard proxy secret → 404", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		sent := enableMailingList(t)
		deps.Config.DashboardProxySecret = ""

		if w := subscribeMailingList(t, "ada@example.com"); w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", w.Code)
		}
		if len(*sent) != 0 {
			t.Errorf("emails = %d, want 0", len(*sent))
		}
	})

	t.Run("requests that skip the dashboard proxy → 403", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		sent := enableMailingList(t)

		for name, secret := range map[string]string{"missing": "", "wrong": "not-the-secret"} {
			c, w := newTestGinContext("POST", "/mailingList/subscribe", strings.NewReader(`{"email":"ada@example.com"}`))
			if secret != "" {
				c.Request.Header.Set(dashboardProxySecretHeader, secret)
			}
			h.SubscribeMailingList(c)
			if w.Code != http.StatusForbidden {
				t.Errorf("%s secret status = %d, want 403", name, w.Code)
			}
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
		s := getMailingListSubscriber(ctx, t, "ada@example.com")
		if s == nil || !s.Subscribed || len(s.Events) != 2 || s.lastEvent().Attribution != "blog" {
			t.Errorf("after confirming = %+v, want a second subscribe from the blog", s)
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

		// Ada unsubscribes through Resend, then asks again from the blog.
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

		send := func(body string) int {
			c, w := newProxiedContext("POST", "/mailingList/subscribe", testMailingListClient, strings.NewReader(body))
			h.SubscribeMailingList(c)
			return w.Code
		}
		if code := send(`{"email": "ada@example.com"}`); code != http.StatusBadRequest {
			t.Errorf("missing attribution status = %d, want 400", code)
		}
		if code := send(`{"email": "ada@example.com", "attribution": "  "}`); code != http.StatusBadRequest {
			t.Errorf("blank attribution status = %d, want 400", code)
		}
		if code := send(`{"email": "ada@example.com", "attribution": "changelog"}`); code != http.StatusOK {
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

	t.Run("one address gets at most five emails a day", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		sent := enableMailingList(t)

		for i := 0; i < 5; i++ {
			if w := subscribeMailingListFrom(t, fmt.Sprintf("198.51.100.%d", i+1), "ada@example.com"); w.Code != http.StatusOK {
				t.Fatalf("request %d status = %d", i+1, w.Code)
			}
		}
		if w := subscribeMailingListFrom(t, "198.51.100.9", "ADA@example.com"); w.Code != http.StatusTooManyRequests {
			t.Errorf("sixth status = %d, want 429", w.Code)
		}
		if len(*sent) != 5 {
			t.Errorf("emails = %d, want 5", len(*sent))
		}
	})

	t.Run("one visitor's IP gets at most five emails a day, others are not limited", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		sent := enableMailingList(t)

		for i := 0; i < 6; i++ {
			w := subscribeMailingListFrom(t, "198.51.100.1", fmt.Sprintf("reader%d@example.com", i))
			want := http.StatusOK
			if i == 5 {
				want = http.StatusTooManyRequests
			}
			if w.Code != want {
				t.Errorf("request %d status = %d, want %d", i+1, w.Code, want)
			}
		}
		if w := subscribeMailingListFrom(t, "198.51.100.2", "reader5@example.com"); w.Code != http.StatusOK {
			t.Errorf("other IP status = %d, want 200", w.Code)
		}
		if len(*sent) != 6 {
			t.Errorf("emails = %d, want 6", len(*sent))
		}
	})

	t.Run("the overall limit caps confirmation emails", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		sent := enableMailingList(t)
		orig := mailingListLimits
		mailingListLimits.total = 2
		t.Cleanup(func() { mailingListLimits = orig })

		for i, addr := range []string{"a@example.com", "b@example.com", "c@example.com"} {
			w := subscribeMailingListFrom(t, fmt.Sprintf("198.51.100.%d", i+1), addr)
			want := http.StatusOK
			if i == 2 {
				want = http.StatusTooManyRequests
			}
			if w.Code != want {
				t.Errorf("%s status = %d, want %d", addr, w.Code, want)
			}
		}
		if len(*sent) != 2 {
			t.Errorf("emails = %d, want 2", len(*sent))
		}
	})

	t.Run("a client over its own limit does not use up the overall limit", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		sent := enableMailingList(t)
		orig := mailingListLimits
		mailingListLimits.total = 6
		t.Cleanup(func() { mailingListLimits = orig })

		for i := 0; i < 10; i++ {
			subscribeMailingListFrom(t, "198.51.100.1", fmt.Sprintf("bot%d@example.com", i))
		}
		if w := subscribeMailingListFrom(t, "198.51.100.2", "ada@example.com"); w.Code != http.StatusOK {
			t.Errorf("reader status = %d, want 200", w.Code)
		}
		if len(*sent) != 6 {
			t.Errorf("emails = %d, want 6 (5 for the bot, 1 for the reader)", len(*sent))
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
