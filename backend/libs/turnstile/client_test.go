package turnstile

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

// setupTestServer points the client at a test server that answers with the
// given status and body, and records the form each request sent.
func setupTestServer(t *testing.T, status int, body string) *[]url.Values {
	t.Helper()
	var forms []url.Values
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Fatalf("parse form: %v", err)
		}
		forms = append(forms, r.PostForm)
		w.WriteHeader(status)
		w.Write([]byte(body))
	}))
	t.Cleanup(ts.Close)

	origSecret, origURL := secretKey, verifyURL
	secretKey, verifyURL = "secret_test", ts.URL
	t.Cleanup(func() { secretKey, verifyURL = origSecret, origURL })
	return &forms
}

func TestVerify(t *testing.T) {
	ctx := context.Background()

	t.Run("sends the secret and the token, and accepts a passed check", func(t *testing.T) {
		forms := setupTestServer(t, http.StatusOK, `{"success":true,"error-codes":[]}`)

		ok, err := Verify(ctx, "tok_123")
		if err != nil || !ok {
			t.Fatalf("Verify = %v, %v, want true, nil", ok, err)
		}
		if len(*forms) != 1 || (*forms)[0].Get("secret") != "secret_test" || (*forms)[0].Get("response") != "tok_123" {
			t.Errorf("forms = %v, want one with the secret and the token", *forms)
		}
	})

	t.Run("refuses a failed or reused token", func(t *testing.T) {
		setupTestServer(t, http.StatusOK, `{"success":false,"error-codes":["timeout-or-duplicate"]}`)

		if ok, err := Verify(ctx, "tok_used"); err != nil || ok {
			t.Fatalf("Verify = %v, %v, want false, nil", ok, err)
		}
	})

	t.Run("refuses an empty token without calling Cloudflare", func(t *testing.T) {
		forms := setupTestServer(t, http.StatusOK, `{"success":true}`)

		if ok, err := Verify(ctx, ""); err != nil || ok {
			t.Fatalf("Verify = %v, %v, want false, nil", ok, err)
		}
		if len(*forms) != 0 {
			t.Errorf("requests = %d, want 0", len(*forms))
		}
	})

	t.Run("a bad secret is an error, not a refused token", func(t *testing.T) {
		setupTestServer(t, http.StatusOK, `{"success":false,"error-codes":["invalid-input-secret"]}`)

		if _, err := Verify(ctx, "tok_123"); err == nil {
			t.Fatal("Verify err = nil, want an error")
		}
	})

	t.Run("a Cloudflare error is an error", func(t *testing.T) {
		setupTestServer(t, http.StatusInternalServerError, `oops`)

		if _, err := Verify(ctx, "tok_123"); err == nil {
			t.Fatal("Verify err = nil, want an error")
		}
	})
}
