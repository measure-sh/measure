package measure

import (
	"net/http"
	"strconv"
	"testing"
	"time"
)

// slackSignHeader builds the headers Slack would send for the given body,
// timestamp and signing secret.
func slackSignHeader(secret string, ts time.Time, body []byte) http.Header {
	timestamp := strconv.FormatInt(ts.Unix(), 10)

	h := http.Header{}
	h.Set("X-Slack-Request-Timestamp", timestamp)
	h.Set("X-Slack-Signature", computeSlackSignature(secret, timestamp, body))
	return h
}

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
