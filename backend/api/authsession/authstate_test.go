package authsession

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

// --------------------------------------------------------------------------
// Test helpers — configurable-endpoint clones of the production functions
// --------------------------------------------------------------------------

// exchangeGitHubCodeForTokenWithURL is a test-only clone of ExchangeGitHubCodeForToken
// that hits a configurable endpoint URL.
func exchangeGitHubCodeForTokenWithURL(endpoint, code, redirectURI, clientID, clientSecret string) (string, error) {
	data := url.Values{}
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)
	data.Set("code", code)
	data.Set("redirect_uri", redirectURI)

	req, err := http.NewRequest("POST", endpoint, strings.NewReader(data.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var result struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("failed to parse GitHub token response: %w", err)
	}
	if result.Error != "" {
		return "", fmt.Errorf("GitHub OAuth error: %s", result.Error)
	}
	if result.AccessToken == "" {
		return "", fmt.Errorf("GitHub returned empty access token")
	}
	return result.AccessToken, nil
}

// exchangeGoogleCodeWithEndpoint is a test-only clone of ExchangeGoogleCode
// that hits a configurable endpoint URL.
func exchangeGoogleCodeWithEndpoint(endpoint, code, redirectURI, clientID, clientSecret string) (refreshToken, idToken string, err error) {
	data := url.Values{}
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)
	data.Set("code", code)
	data.Set("redirect_uri", redirectURI)
	data.Set("grant_type", "authorization_code")

	req, reqErr := http.NewRequest("POST", endpoint, strings.NewReader(data.Encode()))
	if reqErr != nil {
		return "", "", reqErr
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, doErr := http.DefaultClient.Do(req)
	if doErr != nil {
		return "", "", doErr
	}
	defer resp.Body.Close()

	body, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return "", "", readErr
	}

	var result struct {
		RefreshToken string `json:"refresh_token"`
		IDToken      string `json:"id_token"`
		Error        string `json:"error"`
		ErrorDesc    string `json:"error_description"`
	}
	if jsonErr := json.Unmarshal(body, &result); jsonErr != nil {
		return "", "", fmt.Errorf("failed to parse Google token response: %w", jsonErr)
	}
	if result.Error != "" {
		return "", "", fmt.Errorf("Google OAuth error: %s: %s", result.Error, result.ErrorDesc)
	}
	if result.IDToken == "" {
		return "", "", fmt.Errorf("Google returned empty id_token")
	}
	return result.RefreshToken, result.IDToken, nil
}

// validateGoogleRefreshTokenWithEndpoint is a test-only clone of ValidateGoogleRefreshToken
// that hits a configurable endpoint URL.
func validateGoogleRefreshTokenWithEndpoint(endpoint, refreshToken, clientID, clientSecret string) error {
	data := url.Values{}
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)
	data.Set("refresh_token", refreshToken)
	data.Set("grant_type", "refresh_token")

	req, reqErr := http.NewRequest("POST", endpoint, strings.NewReader(data.Encode()))
	if reqErr != nil {
		return reqErr
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, doErr := http.DefaultClient.Do(req)
	if doErr != nil {
		return doErr
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Google refresh token validation failed: HTTP %d", resp.StatusCode)
	}
	return nil
}

// --------------------------------------------------------------------------
// TestExchangeGitHubCodeForToken
// --------------------------------------------------------------------------

func TestExchangeGitHubCodeForToken(t *testing.T) {
	t.Run("success returns access token", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"access_token": "ghp_test123"})
		}))
		defer srv.Close()

		token, err := exchangeGitHubCodeForTokenWithURL(srv.URL, "code123", "http://localhost/cb", "client_id", "client_secret")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if token != "ghp_test123" {
			t.Errorf("token = %q, want ghp_test123", token)
		}
	})

	t.Run("GitHub returns error field", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"error": "bad_verification_code"})
		}))
		defer srv.Close()

		_, err := exchangeGitHubCodeForTokenWithURL(srv.URL, "badcode", "http://localhost/cb", "cid", "cs")
		if err == nil {
			t.Fatal("expected error")
		}
		if got := err.Error(); got != "GitHub OAuth error: bad_verification_code" {
			t.Errorf("error = %q", got)
		}
	})

	t.Run("GitHub returns empty access token", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"access_token": ""})
		}))
		defer srv.Close()

		_, err := exchangeGitHubCodeForTokenWithURL(srv.URL, "code", "http://localhost/cb", "cid", "cs")
		if err == nil {
			t.Fatal("expected error for empty token")
		}
	})

	t.Run("invalid endpoint returns error", func(t *testing.T) {
		_, err := exchangeGitHubCodeForTokenWithURL("http://127.0.0.1:1", "code", "http://localhost/cb", "cid", "cs")
		if err == nil {
			t.Fatal("expected error for unreachable endpoint")
		}
	})

	t.Run("sends correct request params", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != "POST" {
				t.Errorf("method = %q, want POST", r.Method)
			}
			if ct := r.Header.Get("Content-Type"); ct != "application/x-www-form-urlencoded" {
				t.Errorf("Content-Type = %q, want application/x-www-form-urlencoded", ct)
			}
			if accept := r.Header.Get("Accept"); accept != "application/json" {
				t.Errorf("Accept = %q, want application/json", accept)
			}
			r.ParseForm()
			if v := r.FormValue("client_id"); v != "my_cid" {
				t.Errorf("client_id = %q, want my_cid", v)
			}
			if v := r.FormValue("client_secret"); v != "my_secret" {
				t.Errorf("client_secret = %q, want my_secret", v)
			}
			if v := r.FormValue("code"); v != "auth_code" {
				t.Errorf("code = %q, want auth_code", v)
			}
			if v := r.FormValue("redirect_uri"); v != "http://example.com/cb" {
				t.Errorf("redirect_uri = %q, want http://example.com/cb", v)
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"access_token": "tok"})
		}))
		defer srv.Close()

		_, err := exchangeGitHubCodeForTokenWithURL(srv.URL, "auth_code", "http://example.com/cb", "my_cid", "my_secret")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("non-JSON response returns error", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html")
			w.Write([]byte("<html>502 Bad Gateway</html>"))
		}))
		defer srv.Close()

		_, err := exchangeGitHubCodeForTokenWithURL(srv.URL, "code", "http://localhost/cb", "cid", "cs")
		if err == nil {
			t.Fatal("expected error for non-JSON response")
		}
		if !strings.Contains(err.Error(), "failed to parse") {
			t.Errorf("error = %q, want 'failed to parse' substring", err.Error())
		}
	})
}

// --------------------------------------------------------------------------
// TestExchangeGoogleCode
// --------------------------------------------------------------------------

func TestExchangeGoogleCode(t *testing.T) {
	t.Run("success returns refresh token and ID token", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{
				"refresh_token": "1//refresh",
				"id_token":      "header.payload.sig",
			})
		}))
		defer srv.Close()

		rt, idt, err := exchangeGoogleCodeWithEndpoint(srv.URL, "code", "http://localhost/cb", "cid", "cs")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if rt != "1//refresh" {
			t.Errorf("refresh_token = %q", rt)
		}
		if idt != "header.payload.sig" {
			t.Errorf("id_token = %q", idt)
		}
	})

	t.Run("Google returns error with description", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{
				"error":             "invalid_grant",
				"error_description": "Code was already redeemed",
			})
		}))
		defer srv.Close()

		_, _, err := exchangeGoogleCodeWithEndpoint(srv.URL, "code", "http://localhost/cb", "cid", "cs")
		if err == nil {
			t.Fatal("expected error")
		}
	})

	t.Run("Google returns empty ID token", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"refresh_token": "rt", "id_token": ""})
		}))
		defer srv.Close()

		_, _, err := exchangeGoogleCodeWithEndpoint(srv.URL, "code", "http://localhost/cb", "cid", "cs")
		if err == nil {
			t.Fatal("expected error for empty id_token")
		}
	})

	t.Run("invalid endpoint returns error", func(t *testing.T) {
		_, _, err := exchangeGoogleCodeWithEndpoint("http://127.0.0.1:1", "code", "http://localhost/cb", "cid", "cs")
		if err == nil {
			t.Fatal("expected error for unreachable endpoint")
		}
	})

	t.Run("sends correct request params", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != "POST" {
				t.Errorf("method = %q, want POST", r.Method)
			}
			if ct := r.Header.Get("Content-Type"); ct != "application/x-www-form-urlencoded" {
				t.Errorf("Content-Type = %q, want application/x-www-form-urlencoded", ct)
			}
			r.ParseForm()
			if v := r.FormValue("client_id"); v != "g_cid" {
				t.Errorf("client_id = %q, want g_cid", v)
			}
			if v := r.FormValue("client_secret"); v != "g_secret" {
				t.Errorf("client_secret = %q, want g_secret", v)
			}
			if v := r.FormValue("code"); v != "g_code" {
				t.Errorf("code = %q, want g_code", v)
			}
			if v := r.FormValue("redirect_uri"); v != "http://example.com/gcb" {
				t.Errorf("redirect_uri = %q, want http://example.com/gcb", v)
			}
			if v := r.FormValue("grant_type"); v != "authorization_code" {
				t.Errorf("grant_type = %q, want authorization_code", v)
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{
				"refresh_token": "rt",
				"id_token":      "hdr.payload.sig",
			})
		}))
		defer srv.Close()

		_, _, err := exchangeGoogleCodeWithEndpoint(srv.URL, "g_code", "http://example.com/gcb", "g_cid", "g_secret")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("non-JSON response returns error", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html")
			w.Write([]byte("<html>502 Bad Gateway</html>"))
		}))
		defer srv.Close()

		_, _, err := exchangeGoogleCodeWithEndpoint(srv.URL, "code", "http://localhost/cb", "cid", "cs")
		if err == nil {
			t.Fatal("expected error for non-JSON response")
		}
		if !strings.Contains(err.Error(), "failed to parse") {
			t.Errorf("error = %q, want 'failed to parse' substring", err.Error())
		}
	})

	t.Run("success without refresh token", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{
				"id_token": "hdr.payload.sig",
			})
		}))
		defer srv.Close()

		rt, idt, err := exchangeGoogleCodeWithEndpoint(srv.URL, "code", "http://localhost/cb", "cid", "cs")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if rt != "" {
			t.Errorf("refresh_token = %q, want empty", rt)
		}
		if idt != "hdr.payload.sig" {
			t.Errorf("id_token = %q", idt)
		}
	})
}

// --------------------------------------------------------------------------
// TestDecodeGoogleIDToken
// --------------------------------------------------------------------------

func TestDecodeGoogleIDToken(t *testing.T) {
	makeToken := func(claims map[string]string) string {
		header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"RS256"}`))
		payload, _ := json.Marshal(claims)
		encodedPayload := base64.RawURLEncoding.EncodeToString(payload)
		return fmt.Sprintf("%s.%s.signature", header, encodedPayload)
	}

	t.Run("decodes valid 3-part JWT", func(t *testing.T) {
		token := makeToken(map[string]string{"name": "Alice", "email": "alice@example.com", "picture": "https://photo.url/alice.jpg"})
		claims, err := DecodeGoogleIDToken(token)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if claims.Name != "Alice" {
			t.Errorf("name = %q, want Alice", claims.Name)
		}
		if claims.Email != "alice@example.com" {
			t.Errorf("email = %q, want alice@example.com", claims.Email)
		}
		if claims.Picture != "https://photo.url/alice.jpg" {
			t.Errorf("picture = %q, want https://photo.url/alice.jpg", claims.Picture)
		}
	})

	t.Run("extracts name and email from claims", func(t *testing.T) {
		token := makeToken(map[string]string{"name": "Bob Smith", "email": "bob@test.com"})
		claims, err := DecodeGoogleIDToken(token)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if claims.Name != "Bob Smith" || claims.Email != "bob@test.com" {
			t.Errorf("got name=%q email=%q", claims.Name, claims.Email)
		}
	})

	t.Run("returns error for invalid JWT format", func(t *testing.T) {
		_, err := DecodeGoogleIDToken("onlyonepart")
		if err == nil {
			t.Fatal("expected error for single-part token")
		}
	})

	t.Run("returns error for invalid base64 payload", func(t *testing.T) {
		_, err := DecodeGoogleIDToken("header.!!!invalid-base64!!!.sig")
		if err == nil {
			t.Fatal("expected error for invalid base64")
		}
	})

	t.Run("returns error for missing email claim", func(t *testing.T) {
		token := makeToken(map[string]string{"name": "No Email"})
		_, err := DecodeGoogleIDToken(token)
		if err == nil {
			t.Fatal("expected error for missing email")
		}
	})

	t.Run("handles padding correctly (payload length % 4 == 2)", func(t *testing.T) {
		inputClaims := map[string]string{"name": "A", "email": "a@b.c"}
		payload, _ := json.Marshal(inputClaims)
		encoded := base64.RawURLEncoding.EncodeToString(payload)
		token := fmt.Sprintf("hdr.%s.sig", encoded)

		claims, err := DecodeGoogleIDToken(token)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if claims.Email != "a@b.c" {
			t.Errorf("email = %q", claims.Email)
		}
	})

	t.Run("handles padding correctly (payload length % 4 == 3)", func(t *testing.T) {
		inputClaims := map[string]string{"name": "Ab", "email": "ab@cd.ef"}
		payload, _ := json.Marshal(inputClaims)
		encoded := base64.RawURLEncoding.EncodeToString(payload)
		token := fmt.Sprintf("hdr.%s.sig", encoded)

		claims, err := DecodeGoogleIDToken(token)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if claims.Email != "ab@cd.ef" {
			t.Errorf("email = %q", claims.Email)
		}
	})

	t.Run("succeeds with email but no name", func(t *testing.T) {
		token := makeToken(map[string]string{"email": "noname@example.com"})
		claims, err := DecodeGoogleIDToken(token)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if claims.Name != "" {
			t.Errorf("name = %q, want empty", claims.Name)
		}
		if claims.Email != "noname@example.com" {
			t.Errorf("email = %q", claims.Email)
		}
	})

	t.Run("returns error for valid base64 but invalid JSON", func(t *testing.T) {
		payload := base64.RawURLEncoding.EncodeToString([]byte("not valid json"))
		token := fmt.Sprintf("hdr.%s.sig", payload)
		_, err := DecodeGoogleIDToken(token)
		if err == nil {
			t.Fatal("expected error for invalid JSON payload")
		}
		if !strings.Contains(err.Error(), "failed to parse") {
			t.Errorf("error = %q, want 'failed to parse' substring", err.Error())
		}
	})
}

// --------------------------------------------------------------------------
// TestValidateGoogleRefreshToken
// --------------------------------------------------------------------------

func TestValidateGoogleRefreshToken(t *testing.T) {
	t.Run("returns nil for valid refresh token", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"access_token":"new_at"}`))
		}))
		defer srv.Close()

		err := validateGoogleRefreshTokenWithEndpoint(srv.URL, "refresh_tok", "cid", "cs")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("returns error for revoked token", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(`{"error":"invalid_grant"}`))
		}))
		defer srv.Close()

		err := validateGoogleRefreshTokenWithEndpoint(srv.URL, "revoked_tok", "cid", "cs")
		if err == nil {
			t.Fatal("expected error for revoked token")
		}
	})

	t.Run("returns error for network failure", func(t *testing.T) {
		err := validateGoogleRefreshTokenWithEndpoint("http://127.0.0.1:1", "tok", "cid", "cs")
		if err == nil {
			t.Fatal("expected error for unreachable endpoint")
		}
	})

	t.Run("sends correct request params", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != "POST" {
				t.Errorf("method = %q, want POST", r.Method)
			}
			if ct := r.Header.Get("Content-Type"); ct != "application/x-www-form-urlencoded" {
				t.Errorf("Content-Type = %q, want application/x-www-form-urlencoded", ct)
			}
			r.ParseForm()
			if v := r.FormValue("client_id"); v != "v_cid" {
				t.Errorf("client_id = %q, want v_cid", v)
			}
			if v := r.FormValue("client_secret"); v != "v_secret" {
				t.Errorf("client_secret = %q, want v_secret", v)
			}
			if v := r.FormValue("refresh_token"); v != "v_refresh" {
				t.Errorf("refresh_token = %q, want v_refresh", v)
			}
			if v := r.FormValue("grant_type"); v != "refresh_token" {
				t.Errorf("grant_type = %q, want refresh_token", v)
			}
			w.WriteHeader(http.StatusOK)
		}))
		defer srv.Close()

		err := validateGoogleRefreshTokenWithEndpoint(srv.URL, "v_refresh", "v_cid", "v_secret")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})
}
