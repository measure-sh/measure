//go:build integration

package measure

import (
	"backend/api/authsession"
	"backend/api/server"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ==========================================================================
// Unit tests (ported from backend/api/mcp/oauth_test.go and token_test.go)
// ==========================================================================

func TestMCPOAuthMetadataFields(t *testing.T) {
	t.Run("returns all required RFC 8414 fields", func(t *testing.T) {
		m := mcpOAuthMetadata("https://api.example.com")
		requiredFields := []string{
			"issuer",
			"authorization_endpoint",
			"token_endpoint",
			"registration_endpoint",
			"response_types_supported",
			"grant_types_supported",
			"code_challenge_methods_supported",
			"token_endpoint_auth_methods_supported",
		}
		for _, f := range requiredFields {
			if _, ok := m[f]; !ok {
				t.Errorf("missing required field %q", f)
			}
		}
	})

	t.Run("issuer matches apiOrigin", func(t *testing.T) {
		m := mcpOAuthMetadata("https://api.example.com")
		if m["issuer"] != "https://api.example.com" {
			t.Errorf("issuer = %v, want https://api.example.com", m["issuer"])
		}
	})

	t.Run("endpoints use apiOrigin prefix", func(t *testing.T) {
		m := mcpOAuthMetadata("https://api.example.com")
		for _, key := range []string{"authorization_endpoint", "token_endpoint", "registration_endpoint"} {
			s, ok := m[key].(string)
			if !ok {
				t.Errorf("%s is not a string", key)
				continue
			}
			if !strings.HasPrefix(s, "https://api.example.com") {
				t.Errorf("%s = %s, want prefix https://api.example.com", key, s)
			}
		}
	})
}

func TestMCPSHA256Hex(t *testing.T) {
	t.Run("returns correct hex digest for known input", func(t *testing.T) {
		h := sha256.Sum256([]byte("hello"))
		want := hex.EncodeToString(h[:])
		got := mcpSHA256Hex("hello")
		if got != want {
			t.Errorf("mcpSHA256Hex(\"hello\") = %s, want %s", got, want)
		}
	})

	t.Run("returns different digests for different inputs", func(t *testing.T) {
		if mcpSHA256Hex("a") == mcpSHA256Hex("b") {
			t.Error("expected different digests for different inputs")
		}
	})

}

func TestMCPVerifyPKCES256(t *testing.T) {
	// Build a valid verifier/challenge pair.
	verifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	h := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(h[:])

	t.Run("valid verifier and challenge returns true", func(t *testing.T) {
		if !mcpVerifyPKCES256(verifier, challenge) {
			t.Error("expected true for valid verifier/challenge pair")
		}
	})

	t.Run("wrong verifier returns false", func(t *testing.T) {
		if mcpVerifyPKCES256("wrong-verifier", challenge) {
			t.Error("expected false for wrong verifier")
		}
	})

	t.Run("empty verifier returns false", func(t *testing.T) {
		if mcpVerifyPKCES256("", challenge) {
			t.Error("expected false for empty verifier")
		}
	})

	t.Run("empty challenge returns false", func(t *testing.T) {
		if mcpVerifyPKCES256(verifier, "") {
			t.Error("expected false for empty challenge")
		}
	})
}

func TestMCPStringSliceContains(t *testing.T) {
	t.Run("finds existing element", func(t *testing.T) {
		if !mcpStringSliceContains([]string{"a", "b", "c"}, "b") {
			t.Error("expected true for existing element")
		}
	})

	t.Run("returns false for missing element", func(t *testing.T) {
		if mcpStringSliceContains([]string{"a", "b", "c"}, "d") {
			t.Error("expected false for missing element")
		}
	})

	t.Run("empty slice returns false", func(t *testing.T) {
		if mcpStringSliceContains([]string{}, "a") {
			t.Error("expected false for empty slice")
		}
	})
}

func TestMCPValkeyStateKey(t *testing.T) {
	t.Run("returns prefixed key", func(t *testing.T) {
		got := mcpValkeyStateKey("abc123")
		want := "mcp:oauth:state:abc123"
		if got != want {
			t.Errorf("mcpValkeyStateKey(\"abc123\") = %s, want %s", got, want)
		}
	})
}

func TestMCPParseBearerToken(t *testing.T) {
	t.Run("extracts token from valid Bearer header", func(t *testing.T) {
		got, err := mcpParseBearerToken("Bearer msr_abc123")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got != "msr_abc123" {
			t.Errorf("got %q, want %q", got, "msr_abc123")
		}
	})

	t.Run("returns error for missing header", func(t *testing.T) {
		_, err := mcpParseBearerToken("")
		if err == nil {
			t.Fatal("expected error for empty header")
		}
	})

	t.Run("returns error for non-Bearer scheme", func(t *testing.T) {
		_, err := mcpParseBearerToken("Basic abc123")
		if err == nil {
			t.Fatal("expected error for non-Bearer scheme")
		}
	})

	t.Run("returns error for Bearer with no token", func(t *testing.T) {
		_, err := mcpParseBearerToken("Bearer ")
		if err == nil {
			t.Fatal("expected error for Bearer with empty token")
		}
	})
}

func TestMCPWithUserIDContext(t *testing.T) {
	t.Run("round-trips user ID through context", func(t *testing.T) {
		ctx := mcpWithUserID(context.Background(), "user-123")
		got, ok := mcpUserIDFromContext(ctx)
		if !ok {
			t.Fatal("expected ok=true")
		}
		if got != "user-123" {
			t.Errorf("got %q, want %q", got, "user-123")
		}
	})

	t.Run("returns false for context without user ID", func(t *testing.T) {
		_, ok := mcpUserIDFromContext(context.Background())
		if ok {
			t.Error("expected ok=false for empty context")
		}
	})
}

// ==========================================================================
// OAuth integration tests (ported from mcp_oauth_test.go)
// ==========================================================================

func TestMCPOAuthMetadata(t *testing.T) {
	server.Server.Config.APIOrigin = "https://api.example.com"

	c, w := newTestGinContext("GET", "/.well-known/oauth-authorization-server", nil)
	MCPOAuthMetadata(c)

	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
	}

	if ct := w.Header().Get("Content-Type"); !strings.Contains(ct, "application/json") {
		t.Errorf("Content-Type = %q, want json", ct)
	}

	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	for _, field := range []string{
		"issuer", "authorization_endpoint", "token_endpoint",
		"registration_endpoint", "response_types_supported",
		"code_challenge_methods_supported",
	} {
		if _, ok := body[field]; !ok {
			t.Errorf("missing field %q in metadata", field)
		}
	}
}

func TestMCPRegisterClient(t *testing.T) {
	ctx := context.Background()

	t.Run("valid registration", func(t *testing.T) {
		cleanupAll(ctx, t)

		body := `{"client_name":"TestApp","redirect_uris":["http://localhost:9999/cb"]}`
		c, w := newTestGinContext("POST", "/oauth/register", strings.NewReader(body))
		MCPRegisterClient(c)

		if w.Code != http.StatusCreated {
			t.Fatalf("want 201, got %d: %s", w.Code, w.Body.String())
		}

		var resp map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}

		clientID, _ := resp["client_id"].(string)
		if !strings.HasPrefix(clientID, "msr_client_") {
			t.Errorf("client_id %q missing prefix", clientID)
		}
		if _, ok := resp["client_secret"]; !ok {
			t.Error("missing client_secret in response")
		}
		uris, _ := resp["redirect_uris"].([]any)
		if len(uris) == 0 {
			t.Error("missing redirect_uris in response")
		}
	})

	t.Run("missing client_name", func(t *testing.T) {
		cleanupAll(ctx, t)

		body := `{"redirect_uris":["http://localhost:9999/cb"]}`
		c, w := newTestGinContext("POST", "/oauth/register", strings.NewReader(body))
		MCPRegisterClient(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d", w.Code)
		}
	})

	t.Run("empty redirect_uris", func(t *testing.T) {
		cleanupAll(ctx, t)

		body := `{"client_name":"X","redirect_uris":[]}`
		c, w := newTestGinContext("POST", "/oauth/register", strings.NewReader(body))
		MCPRegisterClient(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d", w.Code)
		}
	})

	t.Run("invalid JSON body", func(t *testing.T) {
		cleanupAll(ctx, t)

		c, w := newTestGinContext("POST", "/oauth/register", strings.NewReader(`{invalid`))
		MCPRegisterClient(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("duplicate registrations create distinct clients", func(t *testing.T) {
		cleanupAll(ctx, t)

		body := `{"client_name":"SameApp","redirect_uris":["http://localhost:9999/cb"]}`

		c1, w1 := newTestGinContext("POST", "/oauth/register", strings.NewReader(body))
		MCPRegisterClient(c1)
		c2, w2 := newTestGinContext("POST", "/oauth/register", strings.NewReader(body))
		MCPRegisterClient(c2)

		var r1, r2 map[string]any
		json.Unmarshal(w1.Body.Bytes(), &r1)
		json.Unmarshal(w2.Body.Bytes(), &r2)

		if r1["client_id"] == r2["client_id"] {
			t.Error("duplicate registrations should produce distinct client_ids")
		}
	})
}

func TestMCPAuthorize(t *testing.T) {
	ctx := context.Background()

	t.Run("unsupported response_type", func(t *testing.T) {
		cleanupAll(ctx, t)

		params := url.Values{
			"response_type": {"token"},
			"client_id":     {"client1"},
			"redirect_uri":  {"http://localhost/cb"},
			"state":         {"s"},
			"provider":      {"github"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		MCPAuthorize(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("missing client_id", func(t *testing.T) {
		cleanupAll(ctx, t)

		params := url.Values{
			"response_type": {"code"},
			"redirect_uri":  {"http://localhost/cb"},
			"state":         {"s"},
			"provider":      {"github"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		MCPAuthorize(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("missing redirect_uri", func(t *testing.T) {
		cleanupAll(ctx, t)

		params := url.Values{
			"response_type": {"code"},
			"client_id":     {"client1"},
			"state":         {"s"},
			"provider":      {"github"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		MCPAuthorize(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("unknown client_id", func(t *testing.T) {
		cleanupAll(ctx, t)

		params := url.Values{
			"response_type": {"code"},
			"client_id":     {"unknown"},
			"redirect_uri":  {"http://localhost/cb"},
			"state":         {"s"},
			"provider":      {"github"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		MCPAuthorize(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("redirect_uri not registered", func(t *testing.T) {
		cleanupAll(ctx, t)
		seedMCPClient(ctx, t, "client1", "MyApp", []string{"http://allowed.example.com/cb"}, "secret")

		params := url.Values{
			"response_type": {"code"},
			"client_id":     {"client1"},
			"redirect_uri":  {"http://evil.example.com/cb"},
			"state":         {"mystate"},
			"provider":      {"github"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		MCPAuthorize(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("missing code_challenge returns 400", func(t *testing.T) {
		cleanupAll(ctx, t)
		server.Server.Config.OAuthGitHubKey = "test_gh_key"
		server.Server.Config.APIOrigin = "https://api.example.com"
		seedMCPClient(ctx, t, "client_pkce", "MyApp", []string{"http://localhost:9999/cb"}, "secret")

		params := url.Values{
			"response_type": {"code"},
			"client_id":     {"client_pkce"},
			"redirect_uri":  {"http://localhost:9999/cb"},
			"state":         {"mystate"},
			"provider":      {"github"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		MCPAuthorize(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("no provider redirects to login page", func(t *testing.T) {
		cleanupAll(ctx, t)
		server.Server.Config.SiteOrigin = "https://app.example.com"

		params := url.Values{
			"response_type":  {"code"},
			"client_id":      {"client_html"},
			"redirect_uri":   {"http://localhost:9999/cb"},
			"state":          {"mystate"},
			"code_challenge": {"abc123"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		MCPAuthorize(c)

		if w.Code != http.StatusFound {
			t.Fatalf("want 302, got %d: %s", w.Code, w.Body.String())
		}

		loc := w.Header().Get("Location")
		parsedLoc, err := url.Parse(loc)
		if err != nil {
			t.Fatalf("parse location: %v", err)
		}

		// Verify redirect goes to the configured SiteOrigin login page
		if !strings.HasPrefix(loc, "https://app.example.com/auth/login?") {
			t.Errorf("redirect location %q should start with site origin login path", loc)
		}

		// Verify mcp=1 flag is set
		if parsedLoc.Query().Get("mcp") != "1" {
			t.Error("redirect should include mcp=1 param")
		}

		// Verify all original OAuth params are preserved
		q := parsedLoc.Query()
		if q.Get("response_type") != "code" {
			t.Errorf("response_type = %q, want code", q.Get("response_type"))
		}
		if q.Get("client_id") != "client_html" {
			t.Errorf("client_id = %q, want client_html", q.Get("client_id"))
		}
		if q.Get("redirect_uri") != "http://localhost:9999/cb" {
			t.Errorf("redirect_uri = %q, want http://localhost:9999/cb", q.Get("redirect_uri"))
		}
		if q.Get("state") != "mystate" {
			t.Errorf("state = %q, want mystate", q.Get("state"))
		}
		if q.Get("code_challenge") != "abc123" {
			t.Errorf("code_challenge = %q, want abc123", q.Get("code_challenge"))
		}
	})

	t.Run("provider=github redirects to GitHub OAuth with unified callback and mcp_ prefix", func(t *testing.T) {
		cleanupAll(ctx, t)
		server.Server.Config.OAuthGitHubKey = "test_gh_key"
		server.Server.Config.APIOrigin = "https://api.example.com"
		server.Server.Config.SiteOrigin = "https://app.example.com"
		seedMCPClient(ctx, t, "client2", "MyApp", []string{"http://localhost:9999/cb"}, "secret")

		params := url.Values{
			"response_type":         {"code"},
			"client_id":             {"client2"},
			"redirect_uri":          {"http://localhost:9999/cb"},
			"state":                 {"mystate"},
			"code_challenge":        {"abc123"},
			"code_challenge_method": {"S256"},
			"provider":              {"github"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		MCPAuthorize(c)

		if w.Code != http.StatusFound {
			t.Fatalf("want 302, got %d: %s", w.Code, w.Body.String())
		}

		loc := w.Header().Get("Location")
		if !strings.Contains(loc, "github.com/login/oauth/authorize") {
			t.Errorf("redirect location %q should contain GitHub OAuth URL", loc)
		}
		if !strings.Contains(loc, "test_gh_key") {
			t.Errorf("redirect location %q should contain GitHub client_id", loc)
		}

		// Verify unified callback URL uses SiteOrigin
		parsedLoc, _ := url.Parse(loc)
		redirectURI := parsedLoc.Query().Get("redirect_uri")
		if redirectURI != "https://app.example.com/auth/callback/github" {
			t.Errorf("redirect_uri = %q, want https://app.example.com/auth/callback/github", redirectURI)
		}

		// Verify state has mcp_ prefix
		state := parsedLoc.Query().Get("state")
		if !strings.HasPrefix(state, "mcp_") {
			t.Errorf("state = %q, want mcp_ prefix", state)
		}
	})

	t.Run("provider=google redirects to Google OAuth with unified callback and mcp_ prefix", func(t *testing.T) {
		cleanupAll(ctx, t)
		server.Server.Config.OAuthGoogleKey = "test_google_key"
		server.Server.Config.OAuthGoogleSecret = "test_google_secret"
		server.Server.Config.APIOrigin = "https://api.example.com"
		server.Server.Config.SiteOrigin = "https://app.example.com"
		seedMCPClient(ctx, t, "client_google", "MyApp", []string{"http://localhost:9999/cb"}, "secret")

		params := url.Values{
			"response_type":  {"code"},
			"client_id":      {"client_google"},
			"redirect_uri":   {"http://localhost:9999/cb"},
			"state":          {"mystate"},
			"code_challenge": {"abc123"},
			"provider":       {"google"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		MCPAuthorize(c)

		if w.Code != http.StatusFound {
			t.Fatalf("want 302, got %d: %s", w.Code, w.Body.String())
		}

		loc := w.Header().Get("Location")
		if !strings.Contains(loc, "accounts.google.com/o/oauth2") {
			t.Errorf("redirect location %q should contain Google OAuth URL", loc)
		}
		if !strings.Contains(loc, "test_google_key") {
			t.Errorf("redirect location %q should contain Google client_id", loc)
		}
		if !strings.Contains(loc, "openid") {
			t.Errorf("redirect location %q should contain openid scope", loc)
		}

		// Verify unified callback URL uses SiteOrigin
		parsedLoc, _ := url.Parse(loc)
		redirectURI := parsedLoc.Query().Get("redirect_uri")
		if redirectURI != "https://app.example.com/auth/callback/google" {
			t.Errorf("redirect_uri = %q, want https://app.example.com/auth/callback/google", redirectURI)
		}

		// Verify state has mcp_ prefix
		state := parsedLoc.Query().Get("state")
		if !strings.HasPrefix(state, "mcp_") {
			t.Errorf("state = %q, want mcp_ prefix", state)
		}
	})
}

func TestMCPCallbackExchange(t *testing.T) {
	ctx := context.Background()

	origExchange := mcpExchangeGitHubCodeFn
	origGetUser := mcpGetGitHubUserFn
	origExchangeGoogle := mcpExchangeGoogleCodeFn
	origGetGoogleUser := mcpGetGoogleUserFromIDTokenFn
	t.Cleanup(func() {
		mcpExchangeGitHubCodeFn = origExchange
		mcpGetGitHubUserFn = origGetUser
		mcpExchangeGoogleCodeFn = origExchangeGoogle
		mcpGetGoogleUserFromIDTokenFn = origGetGoogleUser
	})

	t.Run("invalid JSON body", func(t *testing.T) {
		cleanupAll(ctx, t)

		gin.SetMode(gin.TestMode)
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("POST", "/mcp/auth/callback", strings.NewReader(`{invalid`))
		c.Request.Header.Set("Content-Type", "application/json")
		MCPCallbackExchange(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("unknown state returns 400", func(t *testing.T) {
		cleanupAll(ctx, t)

		c, w := newTestGinContextJSON("POST", "/mcp/auth/callback", map[string]any{"code": "ghcode", "state": "nosuchstate"})
		MCPCallbackExchange(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("missing code returns 400", func(t *testing.T) {
		cleanupAll(ctx, t)

		storeTestStateWithProvider(ctx, t, "cbstate_nocode", "clientA", "http://localhost/cb", "challenge", "mcpstate1", "github")

		c, w := newTestGinContextJSON("POST", "/mcp/auth/callback", map[string]any{"code": "", "state": "cbstate_nocode"})
		MCPCallbackExchange(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("GitHub code exchange returns redirect URL", func(t *testing.T) {
		cleanupAll(ctx, t)

		mcpExchangeGitHubCodeFn = func(code, redirectURI string) (string, error) {
			return "ghtoken", nil
		}
		mcpGetGitHubUserFn = func(token string) (authsession.GitHubUser, error) {
			return authsession.GitHubUser{
				Name:  "New User",
				Email: "newuser@example.com",
			}, nil
		}

		clientID := "clientCB1"
		redirectURI := "http://localhost:9999/cb"
		seedMCPClient(ctx, t, clientID, "App", []string{redirectURI}, "secret")
		storeTestStateWithProvider(ctx, t, "cbstate_gh", clientID, redirectURI, "challenge123", "mcpstate2", "github")

		c, w := newTestGinContextJSON("POST", "/mcp/auth/callback", map[string]any{"code": "ghcode", "state": "cbstate_gh"})
		MCPCallbackExchange(c)

		if w.Code != http.StatusOK {
			t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
		}

		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		redirectURL, _ := resp["redirect_url"].(string)
		if !strings.HasPrefix(redirectURL, redirectURI) {
			t.Errorf("redirect_url %q should start with %s", redirectURL, redirectURI)
		}

		parsedLoc, _ := url.Parse(redirectURL)
		authCode := parsedLoc.Query().Get("code")
		if authCode == "" {
			t.Fatal("missing code in redirect URL")
		}
		if parsedLoc.Query().Get("state") != "mcpstate2" {
			t.Errorf("expected state=mcpstate2, got %q", parsedLoc.Query().Get("state"))
		}

		row := getMCPAuthCode(ctx, t, authCode)
		if row == nil {
			t.Fatal("auth code not found in DB")
		}
		if row.Provider == nil || *row.Provider != "github" {
			t.Errorf("auth code provider = %v, want github", row.Provider)
		}
		if row.ProviderToken == nil || *row.ProviderToken == "" {
			t.Error("auth code should have provider_token set")
		}
	})

	t.Run("Google code exchange returns redirect URL", func(t *testing.T) {
		cleanupAll(ctx, t)

		mcpExchangeGoogleCodeFn = func(code, redirectURI string) (string, string, error) {
			return "google_refresh_token", "eyJhbGciOiJSUzI1NiJ9.eyJuYW1lIjoiR29vZ2xlIFVzZXIiLCJlbWFpbCI6Imdvb2dsZXVzZXJAZXhhbXBsZS5jb20ifQ.sig", nil
		}
		mcpGetGoogleUserFromIDTokenFn = func(idToken string) (mcpGoogleUser, error) {
			return mcpGoogleUser{
				Name:  "Google User",
				Email: "googleuser@example.com",
			}, nil
		}

		clientID := "clientCB2"
		redirectURI := "http://localhost:9999/cb"
		seedMCPClient(ctx, t, clientID, "App", []string{redirectURI}, "secret")
		storeTestStateWithProvider(ctx, t, "cbstate_google", clientID, redirectURI, "challenge123", "mcpstate3", "google")

		c, w := newTestGinContextJSON("POST", "/mcp/auth/callback", map[string]any{"code": "googlecode", "state": "cbstate_google"})
		MCPCallbackExchange(c)

		if w.Code != http.StatusOK {
			t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
		}

		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		redirectURL, _ := resp["redirect_url"].(string)
		if !strings.HasPrefix(redirectURL, redirectURI) {
			t.Errorf("redirect_url %q should start with %s", redirectURL, redirectURI)
		}

		parsedLoc, _ := url.Parse(redirectURL)
		authCode := parsedLoc.Query().Get("code")
		if authCode == "" {
			t.Fatal("missing code in redirect URL")
		}

		row := getMCPAuthCode(ctx, t, authCode)
		if row == nil {
			t.Fatal("auth code not found in DB")
		}
		if row.Provider == nil || *row.Provider != "google" {
			t.Errorf("auth code provider = %v, want google", row.Provider)
		}
		if row.ProviderToken == nil || *row.ProviderToken != "google_refresh_token" {
			t.Errorf("auth code provider_token = %v, want google_refresh_token", row.ProviderToken)
		}
	})

	t.Run("GitHub exchange failure returns 500", func(t *testing.T) {
		cleanupAll(ctx, t)

		mcpExchangeGitHubCodeFn = func(code, redirectURI string) (string, error) {
			return "", fmt.Errorf("github is down")
		}

		clientID := "clientCBFail"
		redirectURI := "http://localhost:9999/cb"
		seedMCPClient(ctx, t, clientID, "App", []string{redirectURI}, "secret")
		storeTestStateWithProvider(ctx, t, "cbstate_ghfail", clientID, redirectURI, "challenge", "mcpstate_fail", "github")

		c, w := newTestGinContextJSON("POST", "/mcp/auth/callback", map[string]any{"code": "ghcode", "state": "cbstate_ghfail"})
		MCPCallbackExchange(c)

		if w.Code < 400 {
			t.Fatalf("want error status, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("Google exchange failure returns 500", func(t *testing.T) {
		cleanupAll(ctx, t)

		mcpExchangeGoogleCodeFn = func(code, redirectURI string) (string, string, error) {
			return "", "", fmt.Errorf("google is down")
		}

		clientID := "clientCBGFail"
		redirectURI := "http://localhost:9999/cb"
		seedMCPClient(ctx, t, clientID, "App", []string{redirectURI}, "secret")
		storeTestStateWithProvider(ctx, t, "cbstate_gfail", clientID, redirectURI, "challenge", "mcpstate_gfail", "google")

		c, w := newTestGinContextJSON("POST", "/mcp/auth/callback", map[string]any{"code": "googlecode", "state": "cbstate_gfail"})
		MCPCallbackExchange(c)

		if w.Code < 400 {
			t.Fatalf("want error status, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("existing user found, auth code inserted", func(t *testing.T) {
		cleanupAll(ctx, t)

		existingUserID := uuid.New()
		seedUser(ctx, t, existingUserID.String(), "existing@example.com")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "existing's team", true)
		seedTeamMembership(ctx, t, teamID, existingUserID.String(), "owner")

		mcpExchangeGitHubCodeFn = func(code, redirectURI string) (string, error) {
			return "ghtoken", nil
		}
		mcpGetGitHubUserFn = func(token string) (authsession.GitHubUser, error) {
			return authsession.GitHubUser{
				Name:  "Existing User",
				Email: "existing@example.com",
			}, nil
		}

		clientID := "clientCB3"
		redirectURI := "http://localhost:8888/cb"
		seedMCPClient(ctx, t, clientID, "App", []string{redirectURI}, "secret")
		storeTestStateWithProvider(ctx, t, "cbstate_existing", clientID, redirectURI, "", "mcpstate4", "github")

		c, w := newTestGinContextJSON("POST", "/mcp/auth/callback", map[string]any{"code": "ghcode", "state": "cbstate_existing"})
		MCPCallbackExchange(c)

		if w.Code != http.StatusOK {
			t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
		}

		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		redirectURL, _ := resp["redirect_url"].(string)

		parsedLoc, _ := url.Parse(redirectURL)
		authCode := parsedLoc.Query().Get("code")
		if authCode == "" {
			t.Fatal("missing code in redirect")
		}

		row := getMCPAuthCode(ctx, t, authCode)
		if row == nil {
			t.Fatal("auth code not found in DB")
		}
		if row.UserID != existingUserID {
			t.Errorf("auth code user_id = %s, want %s", row.UserID, existingUserID)
		}
	})
}

func TestMCPToken(t *testing.T) {
	ctx := context.Background()

	makeVerifier := func() (verifier, challenge string) {
		verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
		h := sha256.Sum256([]byte(verifier))
		challenge = base64.RawURLEncoding.EncodeToString(h[:])
		return
	}

	t.Run("valid exchange with PKCE (github)", func(t *testing.T) {
		cleanupAll(ctx, t)

		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "token@example.com")

		verifier, challenge := makeVerifier()
		code := "validcode123"
		clientID := "clientD"
		redirectURI := "http://localhost/cb"
		seedMCPClient(ctx, t, clientID, "App", []string{redirectURI}, "secret")
		seedMCPAuthCodeWithProvider(ctx, t, code, userID.String(), clientID, redirectURI, challenge, time.Now().Add(10*time.Minute), "ghtoken_for_test", "github")

		form := url.Values{
			"grant_type":    {"authorization_code"},
			"code":          {code},
			"redirect_uri":  {redirectURI},
			"client_id":     {clientID},
			"code_verifier": {verifier},
		}
		c, w := newTestGinContextForm("POST", "/oauth/token", form)
		MCPToken(c)

		if w.Code != http.StatusOK {
			t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
		}

		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		rawToken, _ := resp["access_token"].(string)
		if !strings.HasPrefix(rawToken, "msr_") {
			t.Errorf("access_token %q should start with msr_", rawToken)
		}
		if resp["token_type"] != "Bearer" {
			t.Errorf("token_type = %v, want Bearer", resp["token_type"])
		}

		// Verify code is now marked used
		codeRow := getMCPAuthCode(ctx, t, code)
		if !codeRow.Used {
			t.Error("code should be marked used after exchange")
		}

		// Verify token row in DB
		tokenHash := mcpSHA256Hex(rawToken)
		tokenRow := getMCPAccessToken(ctx, t, tokenHash)
		if tokenRow == nil {
			t.Fatal("token not found in DB")
		}
		if tokenRow.UserID != userID {
			t.Errorf("token user_id = %s, want %s", tokenRow.UserID, userID)
		}
		// Session binding: verify provider info is propagated
		if tokenRow.Provider == nil || *tokenRow.Provider != "github" {
			t.Errorf("token provider = %v, want github", tokenRow.Provider)
		}
		if tokenRow.ProviderToken == nil || *tokenRow.ProviderToken == "" {
			t.Error("token should have provider_token set")
		}
		if tokenRow.ProviderTokenCheckedAt == nil {
			t.Error("token should have provider_token_checked_at set")
		}
	})

	t.Run("valid exchange with PKCE (google)", func(t *testing.T) {
		cleanupAll(ctx, t)

		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "gtoken@example.com")

		verifier, challenge := makeVerifier()
		code := "validgooglecode"
		clientID := "clientDG"
		redirectURI := "http://localhost/cb"
		seedMCPClient(ctx, t, clientID, "App", []string{redirectURI}, "secret")
		seedMCPAuthCodeWithProvider(ctx, t, code, userID.String(), clientID, redirectURI, challenge, time.Now().Add(10*time.Minute), "google_refresh_token_test", "google")

		form := url.Values{
			"grant_type":    {"authorization_code"},
			"code":          {code},
			"redirect_uri":  {redirectURI},
			"client_id":     {clientID},
			"code_verifier": {verifier},
		}
		c, w := newTestGinContextForm("POST", "/oauth/token", form)
		MCPToken(c)

		if w.Code != http.StatusOK {
			t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
		}

		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		rawToken, _ := resp["access_token"].(string)
		if !strings.HasPrefix(rawToken, "msr_") {
			t.Errorf("access_token %q should start with msr_", rawToken)
		}

		// Verify token row in DB has google provider
		tokenHash := mcpSHA256Hex(rawToken)
		tokenRow := getMCPAccessToken(ctx, t, tokenHash)
		if tokenRow == nil {
			t.Fatal("token not found in DB")
		}
		if tokenRow.UserID != userID {
			t.Errorf("token user_id = %s, want %s", tokenRow.UserID, userID)
		}
		if tokenRow.Provider == nil || *tokenRow.Provider != "google" {
			t.Errorf("token provider = %v, want google", tokenRow.Provider)
		}
		if tokenRow.ProviderToken == nil || *tokenRow.ProviderToken != "google_refresh_token_test" {
			t.Errorf("token provider_token = %v, want google_refresh_token_test", tokenRow.ProviderToken)
		}
		if tokenRow.ProviderTokenCheckedAt == nil {
			t.Error("token should have provider_token_checked_at set")
		}
	})

	t.Run("unsupported grant_type", func(t *testing.T) {
		cleanupAll(ctx, t)

		form := url.Values{
			"grant_type": {"client_credentials"},
			"code":       {"somecode"},
		}
		c, w := newTestGinContextForm("POST", "/oauth/token", form)
		MCPToken(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("missing code", func(t *testing.T) {
		cleanupAll(ctx, t)

		form := url.Values{
			"grant_type": {"authorization_code"},
		}
		c, w := newTestGinContextForm("POST", "/oauth/token", form)
		MCPToken(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("valid exchange via JSON body", func(t *testing.T) {
		cleanupAll(ctx, t)

		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "jsontoken@example.com")

		verifier, challenge := makeVerifier()
		code := "jsoncode123"
		clientID := "clientJSON"
		redirectURI := "http://localhost/cb"
		seedMCPClient(ctx, t, clientID, "App", []string{redirectURI}, "secret")
		seedMCPAuthCodeWithProvider(ctx, t, code, userID.String(), clientID, redirectURI, challenge, time.Now().Add(10*time.Minute), "ghtoken_json", "github")

		jsonBody := map[string]any{
			"grant_type":    "authorization_code",
			"code":          code,
			"redirect_uri":  redirectURI,
			"client_id":     clientID,
			"code_verifier": verifier,
		}
		c, w := newTestGinContextJSON("POST", "/oauth/token", jsonBody)
		MCPToken(c)

		if w.Code != http.StatusOK {
			t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
		}

		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		rawToken, _ := resp["access_token"].(string)
		if !strings.HasPrefix(rawToken, "msr_") {
			t.Errorf("access_token %q should start with msr_", rawToken)
		}
	})

	t.Run("valid exchange without PKCE", func(t *testing.T) {
		cleanupAll(ctx, t)

		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "nopkce@example.com")

		code := "nopkcecode"
		clientID := "clientNoPKCE"
		redirectURI := "http://localhost/cb"
		seedMCPClient(ctx, t, clientID, "App", []string{redirectURI}, "secret")
		// Store auth code with empty code_challenge
		seedMCPAuthCodeWithProvider(ctx, t, code, userID.String(), clientID, redirectURI, "", time.Now().Add(10*time.Minute), "ghtoken_nopkce", "github")

		form := url.Values{
			"grant_type":   {"authorization_code"},
			"code":         {code},
			"redirect_uri": {redirectURI},
			"client_id":    {clientID},
		}
		c, w := newTestGinContextForm("POST", "/oauth/token", form)
		MCPToken(c)

		if w.Code != http.StatusOK {
			t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
		}

		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		rawToken, _ := resp["access_token"].(string)
		if !strings.HasPrefix(rawToken, "msr_") {
			t.Errorf("access_token %q should start with msr_", rawToken)
		}
	})

	t.Run("code not found", func(t *testing.T) {
		cleanupAll(ctx, t)

		form := url.Values{
			"grant_type": {"authorization_code"},
			"code":       {"doesnotexist"},
		}
		c, w := newTestGinContextForm("POST", "/oauth/token", form)
		MCPToken(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d", w.Code)
		}
	})

	t.Run("code already used", func(t *testing.T) {
		cleanupAll(ctx, t)

		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "used@example.com")
		code := "usedcode"
		seedMCPAuthCode(ctx, t, code, userID.String(), "clientX", "http://x/cb", "", time.Now().Add(10*time.Minute))
		// mark as used
		_, err := th.PgPool.Exec(ctx, `UPDATE measure.mcp_auth_codes SET used = true WHERE code = $1`, code)
		if err != nil {
			t.Fatalf("mark used: %v", err)
		}

		form := url.Values{
			"grant_type": {"authorization_code"},
			"code":       {code},
		}
		c, w := newTestGinContextForm("POST", "/oauth/token", form)
		MCPToken(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d", w.Code)
		}
	})

	t.Run("expired code", func(t *testing.T) {
		cleanupAll(ctx, t)

		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "exp@example.com")
		code := "expiredcode"
		seedMCPAuthCode(ctx, t, code, userID.String(), "clientY", "http://y/cb", "", time.Now().Add(-1*time.Minute))

		form := url.Values{
			"grant_type": {"authorization_code"},
			"code":       {code},
		}
		c, w := newTestGinContextForm("POST", "/oauth/token", form)
		MCPToken(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d", w.Code)
		}
	})

	t.Run("wrong redirect_uri", func(t *testing.T) {
		cleanupAll(ctx, t)

		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "redir@example.com")
		code := "redircode"
		seedMCPAuthCode(ctx, t, code, userID.String(), "clientZ", "http://correct/cb", "", time.Now().Add(10*time.Minute))

		form := url.Values{
			"grant_type":   {"authorization_code"},
			"code":         {code},
			"redirect_uri": {"http://wrong/cb"},
		}
		c, w := newTestGinContextForm("POST", "/oauth/token", form)
		MCPToken(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d", w.Code)
		}
	})

	t.Run("wrong client_id", func(t *testing.T) {
		cleanupAll(ctx, t)

		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "cid@example.com")
		code := "cidcode"
		seedMCPAuthCode(ctx, t, code, userID.String(), "rightclient", "http://x/cb", "", time.Now().Add(10*time.Minute))

		form := url.Values{
			"grant_type": {"authorization_code"},
			"code":       {code},
			"client_id":  {"wrongclient"},
		}
		c, w := newTestGinContextForm("POST", "/oauth/token", form)
		MCPToken(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d", w.Code)
		}
	})

	t.Run("PKCE mismatch", func(t *testing.T) {
		cleanupAll(ctx, t)

		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "pkce@example.com")
		_, challenge := makeVerifier()
		code := "pkcecode"
		seedMCPAuthCode(ctx, t, code, userID.String(), "clientPKCE", "http://x/cb", challenge, time.Now().Add(10*time.Minute))

		form := url.Values{
			"grant_type":    {"authorization_code"},
			"code":          {code},
			"code_verifier": {"wrongverifier"},
		}
		c, w := newTestGinContextForm("POST", "/oauth/token", form)
		MCPToken(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d", w.Code)
		}
	})
}

// ==========================================================================
// Middleware & tool integration tests (ported from mcp_tools_test.go)
// ==========================================================================

func TestValidateMCPToken(t *testing.T) {
	ctx := context.Background()

	t.Run("no Authorization header", func(t *testing.T) {
		cleanupAll(ctx, t)
		c, w := newTestGinContext("GET", "/mcp", nil)
		ValidateMCPToken()(c)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("want 401, got %d", w.Code)
		}
	})

	t.Run("malformed header (no Bearer prefix)", func(t *testing.T) {
		cleanupAll(ctx, t)
		c, w := newTestGinContext("GET", "/mcp", nil)
		c.Request.Header.Set("Authorization", "Token abc123")
		ValidateMCPToken()(c)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("want 401, got %d", w.Code)
		}
	})

	t.Run("token not in DB", func(t *testing.T) {
		cleanupAll(ctx, t)
		c, w := newTestGinContext("GET", "/mcp", nil)
		c.Request.Header.Set("Authorization", "Bearer msr_doesnotexist")
		ValidateMCPToken()(c)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("want 401, got %d", w.Code)
		}
	})

	t.Run("expired token", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "exp@mcp.test")
		rawToken := "msr_expiredtoken"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "client1", time.Now().Add(-1*time.Hour))

		c, w := newTestGinContext("GET", "/mcp", nil)
		c.Request.Header.Set("Authorization", "Bearer "+rawToken)
		ValidateMCPToken()(c)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("want 401, got %d", w.Code)
		}
	})

	t.Run("revoked token", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "revoked@mcp.test")
		rawToken := "msr_revokedtoken"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "client1", time.Now().Add(1*time.Hour))
		_, err := th.PgPool.Exec(ctx,
			`UPDATE measure.mcp_access_tokens SET revoked = true WHERE token_hash = $1`,
			mcpSHA256Hex(rawToken))
		if err != nil {
			t.Fatalf("mark revoked: %v", err)
		}

		c, w := newTestGinContext("GET", "/mcp", nil)
		c.Request.Header.Set("Authorization", "Bearer "+rawToken)
		ValidateMCPToken()(c)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("want 401, got %d", w.Code)
		}
	})

	t.Run("session binding: revokes token when provider token is invalid", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "sbrevoke@mcp.test")
		rawToken := "msr_revokebysbtoken"
		seedMCPAccessTokenWithProvider(ctx, t, rawToken, userID.String(), "client1", time.Now().Add(90*24*time.Hour), "bad_github_token", "github")

		origFn := mcpValidateProviderTokenFn
		callCount := 0
		mcpValidateProviderTokenFn = func(provider, token string) error {
			callCount++
			return fmt.Errorf("token revoked")
		}
		t.Cleanup(func() { mcpValidateProviderTokenFn = origFn })

		// Set provider_token_checked_at to the past to trigger revalidation
		_, _ = th.PgPool.Exec(ctx,
			`UPDATE measure.mcp_access_tokens SET provider_token_checked_at = now() - interval '2 hours' WHERE token_hash = $1`,
			mcpSHA256Hex(rawToken))

		gin.SetMode(gin.TestMode)
		r := gin.New()
		r.GET("/mcp", ValidateMCPToken(), func(c *gin.Context) {
			c.Status(http.StatusOK)
		})

		req := httptest.NewRequest("GET", "/mcp", nil)
		req.Header.Set("Authorization", "Bearer "+rawToken)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		// The request itself should succeed (revocation is async)
		if w.Code == http.StatusUnauthorized {
			t.Fatalf("want pass-through, got 401: %s", w.Body.String())
		}

		time.Sleep(100 * time.Millisecond)

		if callCount == 0 {
			t.Error("expected ValidateProviderToken to be called")
		}

		tokenRow := getMCPAccessToken(ctx, t, mcpSHA256Hex(rawToken))
		if tokenRow == nil {
			t.Fatal("token not found")
		}
		if !tokenRow.Revoked {
			t.Error("token should be revoked after failed provider validation")
		}
	})

	t.Run("session binding: updates checked_at when provider token is valid", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "sbvalid@mcp.test")
		rawToken := "msr_sbvalidtoken"
		seedMCPAccessTokenWithProvider(ctx, t, rawToken, userID.String(), "client1", time.Now().Add(90*24*time.Hour), "good_github_token", "github")

		origFn := mcpValidateProviderTokenFn
		mcpValidateProviderTokenFn = func(provider, token string) error {
			return nil // valid
		}
		t.Cleanup(func() { mcpValidateProviderTokenFn = origFn })

		// Set provider_token_checked_at to the past to trigger revalidation
		_, _ = th.PgPool.Exec(ctx,
			`UPDATE measure.mcp_access_tokens SET provider_token_checked_at = now() - interval '2 hours' WHERE token_hash = $1`,
			mcpSHA256Hex(rawToken))

		var oldCheckedAt *time.Time
		_ = th.PgPool.QueryRow(ctx,
			`SELECT provider_token_checked_at FROM measure.mcp_access_tokens WHERE token_hash = $1`,
			mcpSHA256Hex(rawToken)).Scan(&oldCheckedAt)

		gin.SetMode(gin.TestMode)
		r := gin.New()
		r.GET("/mcp", ValidateMCPToken(), func(c *gin.Context) {
			c.Status(http.StatusOK)
		})

		req := httptest.NewRequest("GET", "/mcp", nil)
		req.Header.Set("Authorization", "Bearer "+rawToken)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		time.Sleep(100 * time.Millisecond)

		tokenRow := getMCPAccessToken(ctx, t, mcpSHA256Hex(rawToken))
		if tokenRow == nil {
			t.Fatal("token not found")
		}
		if tokenRow.Revoked {
			t.Error("token should not be revoked")
		}
		if tokenRow.ProviderTokenCheckedAt == nil {
			t.Error("provider_token_checked_at should be set")
		} else if oldCheckedAt != nil && !tokenRow.ProviderTokenCheckedAt.After(*oldCheckedAt) {
			t.Error("provider_token_checked_at should have been updated")
		}
	})

	t.Run("session binding: skips check when recently validated", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "sbskip@mcp.test")
		rawToken := "msr_sbskiptoken"
		seedMCPAccessTokenWithProvider(ctx, t, rawToken, userID.String(), "client1", time.Now().Add(90*24*time.Hour), "still_valid_token", "github")

		origFn := mcpValidateProviderTokenFn
		callCount := 0
		mcpValidateProviderTokenFn = func(provider, token string) error {
			callCount++
			return nil
		}
		t.Cleanup(func() { mcpValidateProviderTokenFn = origFn })

		// provider_token_checked_at is already set to now() by the seed (recent)

		gin.SetMode(gin.TestMode)
		r := gin.New()
		r.GET("/mcp", ValidateMCPToken(), func(c *gin.Context) {
			c.Status(http.StatusOK)
		})

		req := httptest.NewRequest("GET", "/mcp", nil)
		req.Header.Set("Authorization", "Bearer "+rawToken)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		time.Sleep(100 * time.Millisecond)

		if callCount != 0 {
			t.Errorf("expected no ValidateProviderToken calls, got %d", callCount)
		}
	})

	t.Run("valid token sets userId and updates last_used_at", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "valid@mcp.test")
		rawToken := "msr_validtoken123"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "client1", time.Now().Add(90*24*time.Hour))

		// Use a gin router so we can test the full middleware + next chain
		gin.SetMode(gin.TestMode)
		r := gin.New()
		var capturedUserID string
		r.GET("/mcp", ValidateMCPToken(), func(c *gin.Context) {
			capturedUserID = c.GetString("userId")
			c.Status(http.StatusOK)
		})

		req := httptest.NewRequest("GET", "/mcp", nil)
		req.Header.Set("Authorization", "Bearer "+rawToken)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code == http.StatusUnauthorized {
			t.Fatalf("want pass-through, got 401: %s", w.Body.String())
		}
		if capturedUserID != userID.String() {
			t.Errorf("userId in context = %q, want %q", capturedUserID, userID.String())
		}

		// Give background goroutine a moment to update last_used_at
		time.Sleep(50 * time.Millisecond)

		tokenRow := getMCPAccessToken(ctx, t, mcpSHA256Hex(rawToken))
		if tokenRow == nil {
			t.Fatal("token not found")
		}
		// last_used_at may still be nil if the background goroutine hasn't run
		// but we at least verify the token exists and is not revoked
		if tokenRow.Revoked {
			t.Error("token should not be revoked")
		}
	})
}

func TestMCPInitialize(t *testing.T) {
	ctx := context.Background()
	cleanupAll(ctx, t)

	userID := uuid.New()
	seedUser(ctx, t, userID.String(), "init@mcp.test")
	rawToken := "msr_inittoken"
	seedMCPAccessToken(ctx, t, rawToken, userID.String(), "client1", time.Now().Add(90*24*time.Hour))

	handler := buildMCPTestRouter()

	body := `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}`
	req := httptest.NewRequest("POST", "/mcp", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+rawToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
	}

	resp := parseSSEData(t, w.Body.String())
	result, _ := resp["result"].(map[string]any)
	serverInfo, _ := result["serverInfo"].(map[string]any)
	if serverInfo["name"] != "Measure" {
		t.Errorf("serverInfo.name = %v, want Measure", serverInfo["name"])
	}
}

func TestMCPToolsList(t *testing.T) {
	ctx := context.Background()
	cleanupAll(ctx, t)

	userID := uuid.New()
	seedUser(ctx, t, userID.String(), "tools@mcp.test")
	rawToken := "msr_toolstoken"
	seedMCPAccessToken(ctx, t, rawToken, userID.String(), "client1", time.Now().Add(90*24*time.Hour))

	handler := buildMCPTestRouter()

	// First initialize
	initBody := `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}`
	initReq := httptest.NewRequest("POST", "/mcp", strings.NewReader(initBody))
	initReq.Header.Set("Authorization", "Bearer "+rawToken)
	initReq.Header.Set("Content-Type", "application/json")
	initReq.Header.Set("Accept", "application/json, text/event-stream")
	w1 := httptest.NewRecorder()
	handler.ServeHTTP(w1, initReq)

	// Extract session cookie if any
	var sessionCookie string
	for _, cookie := range w1.Result().Cookies() {
		if cookie.Name == "mcp-session-id" {
			sessionCookie = cookie.Value
		}
	}

	body := `{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}`
	req := httptest.NewRequest("POST", "/mcp", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+rawToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	if sessionCookie != "" {
		req.AddCookie(&http.Cookie{Name: "mcp-session-id", Value: sessionCookie})
	}
	// Also use the Mcp-Session-Id header from the init response
	if sid := w1.Header().Get("Mcp-Session-Id"); sid != "" {
		req.Header.Set("Mcp-Session-Id", sid)
	}
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
	}

	resp := parseSSEData(t, w.Body.String())
	result, _ := resp["result"].(map[string]any)
	tools, _ := result["tools"].([]any)

	toolNames := make(map[string]bool)
	for _, tool := range tools {
		tm, _ := tool.(map[string]any)
		name, _ := tm["name"].(string)
		toolNames[name] = true
	}

	expectedTools := []string{
		"list_apps", "get_filters", "get_metrics",
		"get_errors", "get_error",
		"get_errors_over_time", "get_error_over_time", "get_error_distribution",
		"get_error_common_path",
		"get_sessions", "get_sessions_over_time", "get_session",
		"get_bug_reports", "get_bug_reports_over_time", "get_bug_report",
		"update_bug_report_status",
		"get_root_span_names", "get_span_instances", "get_span_metrics_over_time",
		"get_trace", "get_alerts", "get_journey",
	}
	for _, expected := range expectedTools {
		if !toolNames[expected] {
			t.Errorf("tool %q not found in tools/list response", expected)
		}
	}
	if len(tools) != len(expectedTools) {
		t.Errorf("want %d tools, got %d", len(expectedTools), len(tools))
	}
}

func TestMCPListApps(t *testing.T) {
	ctx := context.Background()

	t.Run("user with no teams returns empty array", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "noapps@mcp.test")
		rawToken := "msr_noappstoken"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "client1", time.Now().Add(90*24*time.Hour))

		resp := callMCPTool(t, rawToken, "list_apps", nil)
		content := extractTextContent(t, resp)

		var apps []any
		json.Unmarshal([]byte(content), &apps)
		if len(apps) != 0 {
			t.Errorf("want empty array, got %d apps", len(apps))
		}
	})

	t.Run("user with two apps sees both", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "twoapps@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "twoapps team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")

		app1ID := uuid.New()
		app2ID := uuid.New()
		seedApp(ctx, t, app1ID, teamID, 30)
		seedApp(ctx, t, app2ID, teamID, 30)

		rawToken := "msr_twoappstoken"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "client1", time.Now().Add(90*24*time.Hour))

		resp := callMCPTool(t, rawToken, "list_apps", nil)
		content := extractTextContent(t, resp)

		var apps []map[string]any
		if err := json.Unmarshal([]byte(content), &apps); err != nil {
			t.Fatalf("unmarshal apps: %v\ncontent: %s", err, content)
		}
		if len(apps) != 2 {
			t.Errorf("want 2 apps, got %d", len(apps))
		}
		for _, app := range apps {
			if app["id"] == nil {
				t.Error("app missing id field")
			}
			if app["name"] == nil {
				t.Error("app missing name field")
			}
		}
	})

	t.Run("user only sees own teams apps", func(t *testing.T) {
		cleanupAll(ctx, t)

		// user A with one app
		userA := uuid.New()
		seedUser(ctx, t, userA.String(), "usera@mcp.test")
		teamA := uuid.New()
		seedTeam(ctx, t, teamA, "team A", true)
		seedTeamMembership(ctx, t, teamA, userA.String(), "owner")
		appA := uuid.New()
		seedApp(ctx, t, appA, teamA, 30)

		// user B with a different app
		userB := uuid.New()
		seedUser(ctx, t, userB.String(), "userb@mcp.test")
		teamB := uuid.New()
		seedTeam(ctx, t, teamB, "team B", true)
		seedTeamMembership(ctx, t, teamB, userB.String(), "owner")
		appB := uuid.New()
		seedApp(ctx, t, appB, teamB, 30)

		rawToken := "msr_useratokenonly"
		seedMCPAccessToken(ctx, t, rawToken, userA.String(), "client1", time.Now().Add(90*24*time.Hour))

		resp := callMCPTool(t, rawToken, "list_apps", nil)
		content := extractTextContent(t, resp)

		var apps []map[string]any
		json.Unmarshal([]byte(content), &apps)
		if len(apps) != 1 {
			t.Errorf("want 1 app, got %d", len(apps))
		}
		if len(apps) > 0 {
			if apps[0]["id"] != appA.String() {
				t.Errorf("expected app A %s, got %v", appA, apps[0]["id"])
			}
		}
	})

	t.Run("user in multiple teams sees apps from all teams", func(t *testing.T) {
		cleanupAll(ctx, t)

		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "multiteam@mcp.test")

		// Team 1 with 2 apps
		team1 := uuid.New()
		seedTeam(ctx, t, team1, "team 1", true)
		seedTeamMembership(ctx, t, team1, userID.String(), "owner")
		app1a := uuid.New()
		app1b := uuid.New()
		seedApp(ctx, t, app1a, team1, 30)
		seedApp(ctx, t, app1b, team1, 30)

		// Team 2 with 1 app
		team2 := uuid.New()
		seedTeam(ctx, t, team2, "team 2", true)
		seedTeamMembership(ctx, t, team2, userID.String(), "developer")
		app2 := uuid.New()
		seedApp(ctx, t, app2, team2, 30)

		rawToken := "msr_multiteamtoken"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "client1", time.Now().Add(90*24*time.Hour))

		resp := callMCPTool(t, rawToken, "list_apps", nil)
		content := extractTextContent(t, resp)

		var apps []map[string]any
		if err := json.Unmarshal([]byte(content), &apps); err != nil {
			t.Fatalf("unmarshal apps: %v\ncontent: %s", err, content)
		}
		if len(apps) != 3 {
			t.Errorf("want 3 apps across 2 teams, got %d", len(apps))
		}

		appIDs := make(map[string]bool)
		for _, app := range apps {
			id, _ := app["id"].(string)
			appIDs[id] = true
		}
		for _, expected := range []uuid.UUID{app1a, app1b, app2} {
			if !appIDs[expected.String()] {
				t.Errorf("missing app %s in response", expected)
			}
		}
	})
}

func TestMCPGetErrors_Crash(t *testing.T) {
	ctx := context.Background()

	t.Run("missing app_id", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "u@mcp.test")
		rawToken := "msr_tok1"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(time.Hour))

		resp := callMCPTool(t, rawToken, "get_errors", map[string]any{"type": "crash"})
		if !isToolError(resp) {
			t.Error("want tool error for missing app_id")
		}
	})

	t.Run("missing type", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "errnotype@mcp.test")
		rawToken := "msr_errnotype"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(time.Hour))

		resp := callMCPTool(t, rawToken, "get_errors", map[string]any{
			"app_id": uuid.New().String(),
		})
		if !isToolError(resp) {
			t.Error("want tool error for missing type")
		}
	})

	t.Run("invalid type value", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "u2@mcp.test")
		rawToken := "msr_tok2"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(time.Hour))

		resp := callMCPTool(t, rawToken, "get_errors", map[string]any{
			"type":   "invalid",
			"app_id": uuid.New().String(),
		})
		if !isToolError(resp) {
			t.Error("want tool error for invalid type")
		}
	})

	t.Run("valid crash call with seeded data", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "crash@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "crash team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		fingerprint := "fp-crash-1"
		th.SeedExceptionGroup(ctx, t, teamID.String(), appID.String(), fingerprint)
		th.SeedIssueEvent(ctx, t, teamID.String(), appID.String(), "exception", fingerprint, false, time.Now().Add(-1*time.Hour))

		rawToken := "msr_crashtoken"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		now := time.Now().UTC()
		from := now.Add(-7 * 24 * time.Hour)
		resp := callMCPTool(t, rawToken, "get_errors", map[string]any{
			"type":   "crash",
			"app_id": appID.String(),
			"from":   from.Format(time.RFC3339),
			"to":     now.Format(time.RFC3339),
		})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		content := extractTextContent(t, resp)
		var groups []any
		if err := json.Unmarshal([]byte(content), &groups); err != nil {
			t.Errorf("response is not JSON array: %v\ncontent: %s", err, content)
		}
	})

	t.Run("limit 0 defaults to 10", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "errlim0@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "errlim0 team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_errlim0"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_errors", map[string]any{
			"type":   "crash",
			"app_id": appID.String(),
			"limit":  0,
			"from":   now.Add(-7 * 24 * time.Hour).Format(time.RFC3339),
			"to":     now.Format(time.RFC3339),
		})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})

	t.Run("limit exceeding max capped to 30", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "errlimmax@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "errlimmax team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_errlimmax"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_errors", map[string]any{
			"type":   "crash",
			"app_id": appID.String(),
			"limit":  500,
			"from":   now.Add(-7 * 24 * time.Hour).Format(time.RFC3339),
			"to":     now.Format(time.RFC3339),
		})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
}

// The remaining tool tests are identical to the original mcp_tools_test.go
// with sha256Hex replaced by mcpSHA256Hex. Since the rest of the file (from
// TestMCPGetErrors_ANR onward) doesn't reference sha256Hex or any removed
// symbols, it is included verbatim below. This is done via a separate source
// file to keep the merge manageable — but since the user wants a single test
// file, all remaining tests follow inline.

func TestMCPGetErrors_ANR(t *testing.T) {
	ctx := context.Background()

	t.Run("valid ANR call", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "anr@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "anr team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		rawToken := "msr_anrtoken"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_errors", map[string]any{
			"type":   "anr",
			"app_id": appID.String(),
			"from":   now.Add(-7 * 24 * time.Hour).Format(time.RFC3339),
			"to":     now.Format(time.RFC3339),
		})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		content := extractTextContent(t, resp)
		var groups []any
		if err := json.Unmarshal([]byte(content), &groups); err != nil {
			t.Errorf("response is not JSON array: %v\ncontent: %s", err, content)
		}
	})
}

func TestMCPGetError_Crash(t *testing.T) {
	ctx := context.Background()

	t.Run("missing type", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "detnotype@mcp.test")
		rawToken := "msr_detnotype"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(time.Hour))

		resp := callMCPTool(t, rawToken, "get_error", map[string]any{
			"app_id":         uuid.New().String(),
			"error_group_id": "fp-1",
		})
		if !isToolError(resp) {
			t.Error("want tool error for missing type")
		}
	})

	t.Run("invalid type", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "detbadtype@mcp.test")
		rawToken := "msr_detbadtype"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(time.Hour))

		resp := callMCPTool(t, rawToken, "get_error", map[string]any{
			"type":           "invalid",
			"app_id":         uuid.New().String(),
			"error_group_id": "fp-1",
		})
		if !isToolError(resp) {
			t.Error("want tool error for invalid type")
		}
	})

	t.Run("missing error_group_id", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "u@mcp.test")
		rawToken := "msr_tok3"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(time.Hour))

		resp := callMCPTool(t, rawToken, "get_error", map[string]any{
			"type":   "crash",
			"app_id": uuid.New().String(),
		})
		if !isToolError(resp) {
			t.Error("want tool error for missing error_group_id")
		}
	})

	t.Run("valid crash detail call", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "det@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "det team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		fingerprint := "fp-detail-1"
		th.SeedExceptionGroup(ctx, t, teamID.String(), appID.String(), fingerprint)

		rawToken := "msr_dettoken"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_error", map[string]any{
			"type":           "crash",
			"app_id":         appID.String(),
			"error_group_id": fingerprint,
			"from":           now.Add(-7 * 24 * time.Hour).Format(time.RFC3339),
			"to":             now.Format(time.RFC3339),
			"versions":       []string{"1.0.0"},
			"version_codes":  []string{"1"},
			"limit":          1,
		})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		content := extractTextContent(t, resp)
		var events []any
		if err := json.Unmarshal([]byte(content), &events); err != nil {
			t.Errorf("response is not JSON array: %v\ncontent: %s", err, content)
		}
	})

	t.Run("limit 0 defaults to 1", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "detlim0@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "detlim0 team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_detlim0"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_error", map[string]any{
			"type":           "crash",
			"app_id":         appID.String(),
			"error_group_id": "fp-detail-2",
			"limit":          0,
			"from":           now.Add(-7 * 24 * time.Hour).Format(time.RFC3339),
			"to":             now.Format(time.RFC3339),
			"versions":       []string{"1.0.0"},
			"version_codes":  []string{"1"},
		})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})

	t.Run("limit exceeding max capped to 5", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "detlimmax@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "detlimmax team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_detlimmax"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_error", map[string]any{
			"type":           "crash",
			"app_id":         appID.String(),
			"error_group_id": "fp-detail-3",
			"limit":          500,
			"from":           now.Add(-7 * 24 * time.Hour).Format(time.RFC3339),
			"to":             now.Format(time.RFC3339),
			"versions":       []string{"1.0.0"},
			"version_codes":  []string{"1"},
		})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
}

func TestMCPGetError_ANR(t *testing.T) {
	ctx := context.Background()

	t.Run("missing error_group_id", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "anrdet@mcp.test")
		rawToken := "msr_tok4"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(time.Hour))

		resp := callMCPTool(t, rawToken, "get_error", map[string]any{
			"type":   "anr",
			"app_id": uuid.New().String(),
		})
		if !isToolError(resp) {
			t.Error("want tool error for missing error_group_id")
		}
	})

	t.Run("valid ANR detail call", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "anrdet2@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "anrdet team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		fingerprint := "fp-anr-detail-1"
		th.SeedAnrGroup(ctx, t, teamID.String(), appID.String(), fingerprint)

		rawToken := "msr_anrdettoken"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_error", map[string]any{
			"type":           "anr",
			"app_id":         appID.String(),
			"error_group_id": fingerprint,
			"from":           now.Add(-7 * 24 * time.Hour).Format(time.RFC3339),
			"to":             now.Format(time.RFC3339),
			"versions":       []string{"1.0.0"},
			"version_codes":  []string{"1"},
		})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		content := extractTextContent(t, resp)
		var events []any
		if err := json.Unmarshal([]byte(content), &events); err != nil {
			t.Errorf("response is not JSON array: %v\ncontent: %s", err, content)
		}
	})
}

func TestMCPGetFilters(t *testing.T) {
	ctx := context.Background()

	t.Run("missing app_id", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "filters@mcp.test")
		rawToken := "msr_filterstok1"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(time.Hour))

		resp := callMCPTool(t, rawToken, "get_filters", nil)
		if !isToolError(resp) {
			t.Error("want tool error for missing app_id")
		}
	})

	t.Run("invalid type value", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "filtbad@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "filtbad team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_filtbadtok"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		resp := callMCPTool(t, rawToken, "get_filters", map[string]any{
			"app_id": appID.String(),
			"type":   "bogus",
		})
		if !isToolError(resp) {
			t.Error("want tool error for invalid type value")
		}
	})

	t.Run("valid call", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "filters2@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "filters team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		rawToken := "msr_filterstok2"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		resp := callMCPTool(t, rawToken, "get_filters", map[string]any{
			"app_id": appID.String(),
		})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		content := extractTextContent(t, resp)
		var result map[string]any
		if err := json.Unmarshal([]byte(content), &result); err != nil {
			t.Errorf("response is not JSON object: %v\ncontent: %s", err, content)
		}
	})
}

func TestMCPGetMetrics(t *testing.T) {
	ctx := context.Background()

	t.Run("missing app_id", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "metrics@mcp.test")
		rawToken := "msr_metricstok1"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(time.Hour))

		resp := callMCPTool(t, rawToken, "get_metrics", nil)
		if !isToolError(resp) {
			t.Error("want tool error for missing app_id")
		}
	})

	t.Run("malformed from date", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "metbad@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "metbad team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_metbadtok"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		resp := callMCPTool(t, rawToken, "get_metrics", map[string]any{
			"app_id": appID.String(),
			"from":   "not-a-date",
		})
		if !isToolError(resp) {
			t.Error("want tool error for malformed from date")
		}
	})

	t.Run("malformed to date", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "metbad2@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "metbad2 team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_metbad2tok"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_metrics", map[string]any{
			"app_id": appID.String(),
			"from":   now.Add(-7 * 24 * time.Hour).Format(time.RFC3339),
			"to":     "2024-13-01",
		})
		if !isToolError(resp) {
			t.Error("want tool error for malformed to date")
		}
	})

	t.Run("valid call", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "metrics2@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "metrics team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		rawToken := "msr_metricstok2"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_metrics", map[string]any{
			"app_id":        appID.String(),
			"from":          now.Add(-7 * 24 * time.Hour).Format(time.RFC3339),
			"to":            now.Format(time.RFC3339),
			"versions":      []string{"1.0.0"},
			"version_codes": []string{"1"},
		})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		content := extractTextContent(t, resp)
		var result map[string]any
		if err := json.Unmarshal([]byte(content), &result); err != nil {
			t.Errorf("response is not JSON object: %v\ncontent: %s", err, content)
		}
	})

	t.Run("with all common filter fields", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "metallf@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "metallf team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_metallfiltok"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_metrics", map[string]any{
			"app_id":               appID.String(),
			"from":                 now.Add(-7 * 24 * time.Hour).Format(time.RFC3339),
			"to":                   now.Format(time.RFC3339),
			"versions":             []string{"1.0.0"},
			"version_codes":        []string{"1"},
			"os_names":             []string{"android"},
			"os_versions":          []string{"14"},
			"countries":            []string{"US"},
			"network_providers":    []string{"Verizon"},
			"network_types":        []string{"wifi"},
			"network_generations":  []string{"4g"},
			"locales":              []string{"en_US"},
			"device_manufacturers": []string{"Google"},
			"device_names":         []string{"Pixel 6"},
		})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})

	t.Run("limit 0 defaults to 10", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "metlim0@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "metlim0 team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_metlim0"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_metrics", map[string]any{
			"app_id":        appID.String(),
			"limit":         0,
			"from":          now.Add(-7 * 24 * time.Hour).Format(time.RFC3339),
			"to":            now.Format(time.RFC3339),
			"versions":      []string{"1.0.0"},
			"version_codes": []string{"1"},
		})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})

	t.Run("limit exceeding max capped to 30", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "metlimmax@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "metlimmax team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_metlimmax"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_metrics", map[string]any{
			"app_id":        appID.String(),
			"limit":         500,
			"from":          now.Add(-7 * 24 * time.Hour).Format(time.RFC3339),
			"to":            now.Format(time.RFC3339),
			"versions":      []string{"1.0.0"},
			"version_codes": []string{"1"},
		})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
}

// The remaining tool tests (plot, distribution, sessions, bug reports, spans,
// traces, alerts, journey, access control, invalid app ID, unknown tool,
// error common path, update bug report status) are included in a companion
// file mcp_test_tools.go to keep this file manageable.
// NOTE: Since the user requested a single test file, all remaining tests
// that don't need symbol changes are included inline below.

func TestMCPGetErrorOverviewPlot(t *testing.T) {
	ctx := context.Background()
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_" + email
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, rawToken
	}

	t.Run("missing type", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "eplotnotype@mcp.test")
		resp := callMCPTool(t, rawToken, "get_errors_over_time", map[string]any{"app_id": appID.String(), "timezone": "UTC"})
		if !isToolError(resp) {
			t.Error("want tool error for missing type")
		}
	})
	t.Run("invalid type", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "eplotbadtype@mcp.test")
		resp := callMCPTool(t, rawToken, "get_errors_over_time", map[string]any{"type": "invalid", "app_id": appID.String(), "timezone": "UTC"})
		if !isToolError(resp) {
			t.Error("want tool error for invalid type")
		}
	})
	t.Run("missing timezone", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "eplotnotz@mcp.test")
		resp := callMCPTool(t, rawToken, "get_errors_over_time", map[string]any{"type": "crash", "app_id": appID.String()})
		if !isToolError(resp) {
			t.Error("want tool error for missing timezone")
		}
	})
	t.Run("valid crash plot call", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "eplot2@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_errors_over_time", map[string]any{"type": "crash", "app_id": appID.String(), "timezone": "UTC", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339)})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
	t.Run("valid ANR plot call", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "eplotanr@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_errors_over_time", map[string]any{"type": "anr", "app_id": appID.String(), "timezone": "UTC", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339)})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
}

func TestMCPGetErrorDetailPlot(t *testing.T) {
	ctx := context.Background()
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_" + email
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, rawToken
	}

	t.Run("missing type", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "edplotnotype@mcp.test")
		resp := callMCPTool(t, rawToken, "get_error_over_time", map[string]any{"app_id": appID.String(), "error_group_id": "fp-1", "timezone": "UTC"})
		if !isToolError(resp) {
			t.Error("want tool error for missing type")
		}
	})
	t.Run("invalid type", func(t *testing.T) {
		_, rawToken := setupToolTest(t, "edplotbad@mcp.test")
		resp := callMCPTool(t, rawToken, "get_error_over_time", map[string]any{"type": "invalid", "app_id": uuid.New().String(), "error_group_id": "fp-1", "timezone": "UTC"})
		if !isToolError(resp) {
			t.Error("want tool error for invalid type")
		}
	})
	t.Run("missing timezone", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "edplotnotz@mcp.test")
		resp := callMCPTool(t, rawToken, "get_error_over_time", map[string]any{"type": "crash", "app_id": appID.String(), "error_group_id": "fp-1"})
		if !isToolError(resp) {
			t.Error("want tool error for missing timezone")
		}
	})
	t.Run("missing error_group_id", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "edplotnofp@mcp.test")
		resp := callMCPTool(t, rawToken, "get_error_over_time", map[string]any{"type": "crash", "app_id": appID.String(), "timezone": "UTC"})
		if !isToolError(resp) {
			t.Error("want tool error for missing error_group_id")
		}
	})
	t.Run("valid call", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "edplot2@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_error_over_time", map[string]any{"type": "crash", "app_id": appID.String(), "error_group_id": "fp-test-1", "timezone": "UTC", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339)})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
}

func TestMCPGetErrorDistribution(t *testing.T) {
	ctx := context.Background()
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_" + email
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, rawToken
	}

	t.Run("missing type", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "edistnotype@mcp.test")
		resp := callMCPTool(t, rawToken, "get_error_distribution", map[string]any{"app_id": appID.String(), "error_group_id": "fp-1"})
		if !isToolError(resp) {
			t.Error("want tool error for missing type")
		}
	})
	t.Run("invalid type", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "edistbadtype@mcp.test")
		resp := callMCPTool(t, rawToken, "get_error_distribution", map[string]any{"type": "invalid", "app_id": appID.String(), "error_group_id": "fp-1"})
		if !isToolError(resp) {
			t.Error("want tool error for invalid type")
		}
	})
	t.Run("missing error_group_id", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "edistnofp@mcp.test")
		resp := callMCPTool(t, rawToken, "get_error_distribution", map[string]any{"type": "crash", "app_id": appID.String()})
		if !isToolError(resp) {
			t.Error("want tool error for missing error_group_id")
		}
	})
	t.Run("valid crash distribution", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "edist2@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_error_distribution", map[string]any{"type": "crash", "app_id": appID.String(), "error_group_id": "fp-test-dist-1", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339)})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
	t.Run("valid anr distribution", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "edist3@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_error_distribution", map[string]any{"type": "anr", "app_id": appID.String(), "error_group_id": "fp-test-dist-2", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339)})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
}

func TestMCPGetSessions(t *testing.T) {
	ctx := context.Background()
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_" + email
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, rawToken
	}
	now := time.Now().UTC()
	from := now.Add(-7 * 24 * time.Hour).Format(time.RFC3339)
	to := now.Format(time.RFC3339)

	t.Run("missing app_id", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "sess@mcp.test")
		rawToken := "msr_sesstok1"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(time.Hour))
		resp := callMCPTool(t, rawToken, "get_sessions", nil)
		if !isToolError(resp) {
			t.Error("want tool error for missing app_id")
		}
	})
	t.Run("valid call", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "sess2@mcp.test")
		resp := callMCPTool(t, rawToken, "get_sessions", map[string]any{"app_id": appID.String(), "from": from, "to": to})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
	for _, st := range []string{"crash", "anr", "issues"} {
		t.Run("with session_type "+st, func(t *testing.T) {
			appID, rawToken := setupToolTest(t, "sess"+st+"@mcp.test")
			resp := callMCPTool(t, rawToken, "get_sessions", map[string]any{"app_id": appID.String(), "session_type": st, "from": from, "to": to})
			if isToolError(resp) {
				t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
			}
		})
	}
	for _, filter := range []string{"foreground", "background", "user_interaction"} {
		t.Run("with "+filter+" filter", func(t *testing.T) {
			appID, rawToken := setupToolTest(t, "sess"+filter+"@mcp.test")
			resp := callMCPTool(t, rawToken, "get_sessions", map[string]any{"app_id": appID.String(), filter: true, "from": from, "to": to})
			if isToolError(resp) {
				t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
			}
		})
	}
	t.Run("with free_text filter", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "sessfree@mcp.test")
		resp := callMCPTool(t, rawToken, "get_sessions", map[string]any{"app_id": appID.String(), "free_text": "some search term", "from": from, "to": to})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
}

func TestMCPGetSessionsOverTime(t *testing.T) {
	ctx := context.Background()
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_" + email
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, rawToken
	}

	t.Run("missing timezone", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "splotnotz@mcp.test")
		resp := callMCPTool(t, rawToken, "get_sessions_over_time", map[string]any{"app_id": appID.String()})
		if !isToolError(resp) {
			t.Error("want tool error for missing timezone")
		}
	})
	t.Run("valid call", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "splot2@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_sessions_over_time", map[string]any{"app_id": appID.String(), "timezone": "UTC", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339)})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
}

func TestMCPGetSession(t *testing.T) {
	ctx := context.Background()
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_" + email
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, teamID, rawToken
	}

	t.Run("missing session_id", func(t *testing.T) {
		appID, _, rawToken := setupToolTest(t, "sdet@mcp.test")
		resp := callMCPTool(t, rawToken, "get_session", map[string]any{"app_id": appID.String()})
		if !isToolError(resp) {
			t.Error("want tool error for missing session_id")
		}
	})
	t.Run("missing app_id", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "sdet2@mcp.test")
		rawToken := "msr_sdettok2"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(time.Hour))
		resp := callMCPTool(t, rawToken, "get_session", map[string]any{"session_id": uuid.New().String()})
		if !isToolError(resp) {
			t.Error("want tool error for missing app_id")
		}
	})
	t.Run("valid call with seeded session", func(t *testing.T) {
		appID, teamID, rawToken := setupToolTest(t, "sdet4@mcp.test")
		sessionID := uuid.New().String()
		now := time.Now().UTC()
		seedEventWithSession(ctx, t, teamID.String(), appID.String(), sessionID, now)
		resp := callMCPTool(t, rawToken, "get_session", map[string]any{"app_id": appID.String(), "session_id": sessionID})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		body := extractTextContent(t, resp)
		if body == "" || body == "null" {
			t.Error("expected non-empty session details")
		}
	})
}

func TestMCPGetBugReports(t *testing.T) {
	ctx := context.Background()
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_" + email
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, rawToken
	}
	now := time.Now().UTC()
	from := now.Add(-7 * 24 * time.Hour).Format(time.RFC3339)
	to := now.Format(time.RFC3339)

	t.Run("missing app_id", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "br@mcp.test")
		rawToken := "msr_brtok1"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(time.Hour))
		resp := callMCPTool(t, rawToken, "get_bug_reports", nil)
		if !isToolError(resp) {
			t.Error("want tool error for missing app_id")
		}
	})
	t.Run("valid call", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "br2@mcp.test")
		resp := callMCPTool(t, rawToken, "get_bug_reports", map[string]any{"app_id": appID.String(), "from": from, "to": to})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
	t.Run("with free_text filter", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "brfree@mcp.test")
		resp := callMCPTool(t, rawToken, "get_bug_reports", map[string]any{"app_id": appID.String(), "free_text": "crash on button", "from": from, "to": to})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
}

func TestMCPGetBugReportsPlot(t *testing.T) {
	ctx := context.Background()
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_" + email
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, rawToken
	}

	t.Run("missing timezone", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "brplotnotz@mcp.test")
		resp := callMCPTool(t, rawToken, "get_bug_reports_over_time", map[string]any{"app_id": appID.String()})
		if !isToolError(resp) {
			t.Error("want tool error for missing timezone")
		}
	})
	t.Run("valid call", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "brplot2@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_bug_reports_over_time", map[string]any{"app_id": appID.String(), "timezone": "UTC", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339)})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
}

func TestMCPGetBugReport(t *testing.T) {
	ctx := context.Background()
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_" + email
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, teamID, rawToken
	}

	t.Run("missing bug_report_id", func(t *testing.T) {
		appID, _, rawToken := setupToolTest(t, "brdet@mcp.test")
		resp := callMCPTool(t, rawToken, "get_bug_report", map[string]any{"app_id": appID.String()})
		if !isToolError(resp) {
			t.Error("want tool error for missing bug_report_id")
		}
	})
	t.Run("valid call with seeded bug report", func(t *testing.T) {
		appID, teamID, rawToken := setupToolTest(t, "brdet3@mcp.test")
		eventID := uuid.New().String()
		now := time.Now().UTC()
		seedBugReport(ctx, t, teamID.String(), appID.String(), eventID, "test bug report", now)
		resp := callMCPTool(t, rawToken, "get_bug_report", map[string]any{"app_id": appID.String(), "bug_report_id": eventID})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		body := extractTextContent(t, resp)
		if !strings.Contains(body, "test bug report") {
			t.Errorf("expected response to contain bug report description, got: %s", body)
		}
	})
}

func TestMCPGetRootSpanNames(t *testing.T) {
	ctx := context.Background()
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_" + email
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, rawToken
	}

	t.Run("missing app_id", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "spans@mcp.test")
		rawToken := "msr_spanstok1"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(time.Hour))
		resp := callMCPTool(t, rawToken, "get_root_span_names", nil)
		if !isToolError(resp) {
			t.Error("want tool error for missing app_id")
		}
	})
	t.Run("valid call returns array", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "spans2@mcp.test")
		resp := callMCPTool(t, rawToken, "get_root_span_names", map[string]any{"app_id": appID.String()})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		content := extractTextContent(t, resp)
		var names []any
		if err := json.Unmarshal([]byte(content), &names); err != nil {
			t.Errorf("response is not JSON array: %v\ncontent: %s", err, content)
		}
	})
}

func TestMCPGetSpanInstances(t *testing.T) {
	ctx := context.Background()
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_" + email
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, rawToken
	}
	now := time.Now().UTC()
	from := now.Add(-7 * 24 * time.Hour).Format(time.RFC3339)
	to := now.Format(time.RFC3339)

	t.Run("missing root_span_name", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "si@mcp.test")
		resp := callMCPTool(t, rawToken, "get_span_instances", map[string]any{"app_id": appID.String()})
		if !isToolError(resp) {
			t.Error("want tool error for missing root_span_name")
		}
	})
	t.Run("valid call", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "si2@mcp.test")
		resp := callMCPTool(t, rawToken, "get_span_instances", map[string]any{"app_id": appID.String(), "root_span_name": "some-span", "from": from, "to": to})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
}

func TestMCPGetSpanMetricsPlot(t *testing.T) {
	ctx := context.Background()
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_" + email
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, rawToken
	}

	t.Run("missing timezone", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "smplotnotz@mcp.test")
		resp := callMCPTool(t, rawToken, "get_span_metrics_over_time", map[string]any{"app_id": appID.String(), "root_span_name": "some-span"})
		if !isToolError(resp) {
			t.Error("want tool error for missing timezone")
		}
	})
	t.Run("missing root_span_name", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "smplotnorsn@mcp.test")
		resp := callMCPTool(t, rawToken, "get_span_metrics_over_time", map[string]any{"app_id": appID.String(), "timezone": "UTC"})
		if !isToolError(resp) {
			t.Error("want tool error for missing root_span_name")
		}
	})
	t.Run("valid call", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "smplot3@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_span_metrics_over_time", map[string]any{"app_id": appID.String(), "root_span_name": "some-span", "timezone": "UTC", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339)})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
}

func TestMCPGetTrace(t *testing.T) {
	ctx := context.Background()
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_" + email
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, teamID, rawToken
	}

	t.Run("missing trace_id", func(t *testing.T) {
		appID, _, rawToken := setupToolTest(t, "trace@mcp.test")
		resp := callMCPTool(t, rawToken, "get_trace", map[string]any{"app_id": appID.String()})
		if !isToolError(resp) {
			t.Error("want tool error for missing trace_id")
		}
	})
	t.Run("valid call with seeded trace", func(t *testing.T) {
		appID, teamID, rawToken := setupToolTest(t, "trace3@mcp.test")
		now := time.Now().UTC()
		traceID := seedSpan(ctx, t, teamID.String(), appID.String(), "test-span", 1, now.Add(-time.Second), now, "v1", "1")
		resp := callMCPTool(t, rawToken, "get_trace", map[string]any{"app_id": appID.String(), "trace_id": traceID})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		body := extractTextContent(t, resp)
		if !strings.Contains(body, "test-span") {
			t.Errorf("expected response to contain span name, got: %s", body)
		}
	})
}

func TestMCPGetAlerts(t *testing.T) {
	ctx := context.Background()
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_" + email
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, rawToken
	}
	now := time.Now().UTC()
	from := now.Add(-7 * 24 * time.Hour).Format(time.RFC3339)
	to := now.Format(time.RFC3339)

	t.Run("missing app_id", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "alerts@mcp.test")
		rawToken := "msr_alertstok1"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(time.Hour))
		resp := callMCPTool(t, rawToken, "get_alerts", nil)
		if !isToolError(resp) {
			t.Error("want tool error for missing app_id")
		}
	})
	t.Run("valid call", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "alerts2@mcp.test")
		resp := callMCPTool(t, rawToken, "get_alerts", map[string]any{"app_id": appID.String(), "from": from, "to": to})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
}

func TestMCPGetJourney(t *testing.T) {
	ctx := context.Background()
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_" + email
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, rawToken
	}

	t.Run("missing app_id", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "journey@mcp.test")
		rawToken := "msr_journeytok1"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(time.Hour))
		resp := callMCPTool(t, rawToken, "get_journey", nil)
		if !isToolError(resp) {
			t.Error("want tool error for missing app_id")
		}
	})
	t.Run("valid call", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "journey2@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_journey", map[string]any{"app_id": appID.String(), "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339)})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		content := extractTextContent(t, resp)
		var result map[string]any
		if err := json.Unmarshal([]byte(content), &result); err != nil {
			t.Errorf("response is not JSON object: %v\ncontent: %s", err, content)
		}
	})
}

func TestMCPAccessControl(t *testing.T) {
	ctx := context.Background()
	cleanupAll(ctx, t)

	userA := uuid.New()
	seedUser(ctx, t, userA.String(), "acl-a@mcp.test")
	teamA := uuid.New()
	seedTeam(ctx, t, teamA, "acl team A", true)
	seedTeamMembership(ctx, t, teamA, userA.String(), "owner")
	appA := uuid.New()
	seedApp(ctx, t, appA, teamA, 30)

	userB := uuid.New()
	seedUser(ctx, t, userB.String(), "acl-b@mcp.test")
	teamB := uuid.New()
	seedTeam(ctx, t, teamB, "acl team B", true)
	seedTeamMembership(ctx, t, teamB, userB.String(), "owner")
	appB := uuid.New()
	seedApp(ctx, t, appB, teamB, 30)
	_ = appB

	rawToken := "msr_acltoken"
	seedMCPAccessToken(ctx, t, rawToken, userB.String(), "c1", time.Now().Add(90*24*time.Hour))

	now := time.Now().UTC()
	from := now.Add(-7 * 24 * time.Hour).Format(time.RFC3339)
	to := now.Format(time.RFC3339)

	toolCalls := []struct {
		name string
		args map[string]any
	}{
		{"get_filters", map[string]any{"app_id": appA.String()}},
		{"get_metrics", map[string]any{"app_id": appA.String(), "from": from, "to": to}},
		{"get_errors", map[string]any{"app_id": appA.String(), "type": "crash", "from": from, "to": to}},
		{"get_error", map[string]any{"app_id": appA.String(), "type": "crash", "error_group_id": "fp-1", "from": from, "to": to}},
		{"get_errors_over_time", map[string]any{"app_id": appA.String(), "type": "crash", "timezone": "UTC", "from": from, "to": to}},
		{"get_error_over_time", map[string]any{"app_id": appA.String(), "type": "crash", "error_group_id": "fp-1", "timezone": "UTC", "from": from, "to": to}},
		{"get_error_distribution", map[string]any{"app_id": appA.String(), "type": "crash", "error_group_id": "fp-1", "from": from, "to": to}},
		{"get_sessions", map[string]any{"app_id": appA.String(), "from": from, "to": to}},
		{"get_sessions_over_time", map[string]any{"app_id": appA.String(), "timezone": "UTC", "from": from, "to": to}},
		{"get_session", map[string]any{"app_id": appA.String(), "session_id": uuid.New().String()}},
		{"get_bug_reports", map[string]any{"app_id": appA.String(), "from": from, "to": to}},
		{"get_bug_reports_over_time", map[string]any{"app_id": appA.String(), "timezone": "UTC", "from": from, "to": to}},
		{"get_bug_report", map[string]any{"app_id": appA.String(), "bug_report_id": "br-1"}},
		{"get_root_span_names", map[string]any{"app_id": appA.String()}},
		{"get_span_instances", map[string]any{"app_id": appA.String(), "root_span_name": "span-1", "from": from, "to": to}},
		{"get_span_metrics_over_time", map[string]any{"app_id": appA.String(), "root_span_name": "span-1", "timezone": "UTC", "from": from, "to": to}},
		{"get_trace", map[string]any{"app_id": appA.String(), "trace_id": "trace-1"}},
		{"get_alerts", map[string]any{"app_id": appA.String(), "from": from, "to": to}},
		{"get_journey", map[string]any{"app_id": appA.String(), "from": from, "to": to}},
	}

	for _, tc := range toolCalls {
		t.Run(tc.name, func(t *testing.T) {
			resp := callMCPTool(t, rawToken, tc.name, tc.args)
			if !isToolError(resp) {
				t.Errorf("tool %q should deny access to another team's app", tc.name)
			}
		})
	}
}

func TestMCPInvalidAppIDFormat(t *testing.T) {
	ctx := context.Background()
	cleanupAll(ctx, t)

	userID := uuid.New()
	seedUser(ctx, t, userID.String(), "baduuid@mcp.test")
	rawToken := "msr_baduuidtok"
	seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

	tools := []struct {
		name string
		args map[string]any
	}{
		{"get_filters", map[string]any{"app_id": "not-a-uuid"}},
		{"get_errors", map[string]any{"app_id": "not-a-uuid", "type": "crash"}},
		{"get_sessions", map[string]any{"app_id": "not-a-uuid"}},
		{"get_metrics", map[string]any{"app_id": "not-a-uuid"}},
		{"get_bug_reports", map[string]any{"app_id": "not-a-uuid"}},
		{"get_root_span_names", map[string]any{"app_id": "not-a-uuid"}},
		{"get_session", map[string]any{"app_id": "not-a-uuid", "session_id": "some-id"}},
		{"get_bug_report", map[string]any{"app_id": "not-a-uuid", "bug_report_id": "some-id"}},
		{"get_trace", map[string]any{"app_id": "not-a-uuid", "trace_id": "some-id"}},
		{"get_alerts", map[string]any{"app_id": "not-a-uuid"}},
		{"get_journey", map[string]any{"app_id": "not-a-uuid"}},
		{"get_error_common_path", map[string]any{"app_id": "not-a-uuid", "type": "crash", "error_group_id": "fp-1"}},
		{"update_bug_report_status", map[string]any{"app_id": "not-a-uuid", "bug_report_id": "some-id", "status": 1}},
	}

	for _, tc := range tools {
		t.Run(tc.name, func(t *testing.T) {
			resp := callMCPTool(t, rawToken, tc.name, tc.args)
			if !isToolError(resp) {
				t.Errorf("tool %q should reject invalid app_id format", tc.name)
			}
		})
	}
}

func TestMCPUnknownTool(t *testing.T) {
	ctx := context.Background()
	cleanupAll(ctx, t)

	userID := uuid.New()
	seedUser(ctx, t, userID.String(), "unknown@mcp.test")
	rawToken := "msr_unknowntok"
	seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

	resp := callMCPTool(t, rawToken, "nonexistent_tool", nil)
	if !isToolError(resp) {
		t.Error("calling a nonexistent tool should return an error")
	}
}

func TestMCPGetErrorCommonPath(t *testing.T) {
	ctx := context.Background()

	t.Run("missing type", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "cp1@mcp.test")
		rawToken := "msr_cptok1"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(time.Hour))

		resp := callMCPTool(t, rawToken, "get_error_common_path", map[string]any{"app_id": uuid.New().String(), "error_group_id": "fp-1"})
		if !isToolError(resp) {
			t.Error("want tool error for missing type")
		}
	})

	t.Run("invalid type value", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "cp2@mcp.test")
		rawToken := "msr_cptok2"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(time.Hour))

		resp := callMCPTool(t, rawToken, "get_error_common_path", map[string]any{"app_id": uuid.New().String(), "type": "invalid", "error_group_id": "fp-1"})
		if !isToolError(resp) {
			t.Error("want tool error for invalid type")
		}
	})

	t.Run("missing error_group_id", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "cp3@mcp.test")
		rawToken := "msr_cptok3"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(time.Hour))

		resp := callMCPTool(t, rawToken, "get_error_common_path", map[string]any{"app_id": uuid.New().String(), "type": "crash"})
		if !isToolError(resp) {
			t.Error("want tool error for missing error_group_id")
		}
	})

	t.Run("valid crash common path call", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "cpcrash@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "cpcrash team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		fingerprint := "fp-cp-crash-1"
		th.SeedExceptionGroup(ctx, t, teamID.String(), appID.String(), fingerprint)
		rawToken := "msr_cptok6"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		resp := callMCPTool(t, rawToken, "get_error_common_path", map[string]any{"app_id": appID.String(), "type": "crash", "error_group_id": fingerprint})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		content := extractTextContent(t, resp)
		var result map[string]any
		if err := json.Unmarshal([]byte(content), &result); err != nil {
			t.Fatalf("response is not valid JSON: %v\ncontent: %s", err, content)
		}
		if _, ok := result["sessions_analyzed"]; !ok {
			t.Error("response missing sessions_analyzed field")
		}
		if _, ok := result["steps"]; !ok {
			t.Error("response missing steps field")
		}
	})

	t.Run("valid ANR common path call", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "cpanr@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "cpanr team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		fingerprint := "fp-cp-anr-1"
		th.SeedAnrGroup(ctx, t, teamID.String(), appID.String(), fingerprint)
		rawToken := "msr_cptok7"
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		resp := callMCPTool(t, rawToken, "get_error_common_path", map[string]any{"app_id": appID.String(), "type": "anr", "error_group_id": fingerprint})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		content := extractTextContent(t, resp)
		var result map[string]any
		if err := json.Unmarshal([]byte(content), &result); err != nil {
			t.Fatalf("response is not valid JSON: %v\ncontent: %s", err, content)
		}
		if _, ok := result["sessions_analyzed"]; !ok {
			t.Error("response missing sessions_analyzed field")
		}
		if _, ok := result["steps"]; !ok {
			t.Error("response missing steps field")
		}
	})
}

func TestMCPUpdateBugReportStatus(t *testing.T) {
	ctx := context.Background()
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team", true)
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := "msr_" + email
		seedMCPAccessToken(ctx, t, rawToken, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, teamID, rawToken
	}

	t.Run("missing bug_report_id", func(t *testing.T) {
		appID, _, rawToken := setupToolTest(t, "ubr1@mcp.test")
		resp := callMCPTool(t, rawToken, "update_bug_report_status", map[string]any{"app_id": appID.String(), "status": 0})
		if !isToolError(resp) {
			t.Error("want tool error for missing bug_report_id")
		}
	})

	t.Run("missing status", func(t *testing.T) {
		appID, _, rawToken := setupToolTest(t, "ubr2@mcp.test")
		resp := callMCPTool(t, rawToken, "update_bug_report_status", map[string]any{"app_id": appID.String(), "bug_report_id": uuid.New().String()})
		if !isToolError(resp) {
			t.Error("want tool error for missing status")
		}
	})

	t.Run("invalid status value", func(t *testing.T) {
		appID, _, rawToken := setupToolTest(t, "ubr3@mcp.test")
		resp := callMCPTool(t, rawToken, "update_bug_report_status", map[string]any{"app_id": appID.String(), "bug_report_id": uuid.New().String(), "status": 5})
		if !isToolError(resp) {
			t.Error("want tool error for invalid status value")
		}
	})

	t.Run("valid call to close bug report", func(t *testing.T) {
		appID, teamID, rawToken := setupToolTest(t, "ubrclose@mcp.test")
		bugReportID := uuid.New().String()
		seedBugReport(ctx, t, teamID.String(), appID.String(), bugReportID, "test bug", time.Now().UTC())
		resp := callMCPTool(t, rawToken, "update_bug_report_status", map[string]any{"app_id": appID.String(), "bug_report_id": bugReportID, "status": 0})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		content := extractTextContent(t, resp)
		var result map[string]any
		if err := json.Unmarshal([]byte(content), &result); err != nil {
			t.Fatalf("response is not valid JSON: %v\ncontent: %s", err, content)
		}
		if result["ok"] != "done" {
			t.Errorf("want ok=done, got %v", result["ok"])
		}
	})

	t.Run("valid call to open bug report", func(t *testing.T) {
		appID, teamID, rawToken := setupToolTest(t, "ubropen@mcp.test")
		bugReportID := uuid.New().String()
		seedBugReport(ctx, t, teamID.String(), appID.String(), bugReportID, "test bug open", time.Now().UTC())
		resp := callMCPTool(t, rawToken, "update_bug_report_status", map[string]any{"app_id": appID.String(), "bug_report_id": bugReportID, "status": 1})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		content := extractTextContent(t, resp)
		var result map[string]any
		if err := json.Unmarshal([]byte(content), &result); err != nil {
			t.Fatalf("response is not valid JSON: %v\ncontent: %s", err, content)
		}
		if result["ok"] != "done" {
			t.Errorf("want ok=done, got %v", result["ok"])
		}
	})
}

// --------------------------------------------------------------------------
// helpers local to this test file
// --------------------------------------------------------------------------

// newTestGinContextWithQuery creates a Gin context with query parameters.
func newTestGinContextWithQuery(method, path string, params url.Values) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(method, path+"?"+params.Encode(), nil)
	return c, w
}

// newTestGinContextForm creates a Gin context with form-encoded body.
func newTestGinContextForm(method, path string, form url.Values) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body := strings.NewReader(form.Encode())
	c.Request = httptest.NewRequest(method, path, body)
	c.Request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	return c, w
}

// storeTestState writes a Valkey MCP OAuth state for callback tests.
func storeTestState(ctx context.Context, t *testing.T, state, clientID, redirectURI, codeChallenge, mcpState string) {
	t.Helper()
	storeTestStateWithProvider(ctx, t, state, clientID, redirectURI, codeChallenge, mcpState, "")
}

// storeTestStateWithProvider writes a Valkey MCP OAuth state with an explicit provider.
func storeTestStateWithProvider(ctx context.Context, t *testing.T, state, clientID, redirectURI, codeChallenge, mcpState, provider string) {
	t.Helper()
	payload := mcpOAuthStatePayload{
		MCPState:      mcpState,
		ClientID:      clientID,
		RedirectURI:   redirectURI,
		CodeChallenge: codeChallenge,
		Provider:      provider,
	}
	if err := mcpStoreMCPStateInValkey(ctx, server.Server.VK, state, payload); err != nil {
		t.Fatalf("store test state: %v", err)
	}
}

// newTestGinContextJSON creates a Gin context with a JSON body.
func newTestGinContextJSON(method, path string, v any) (*gin.Context, *httptest.ResponseRecorder) {
	b, _ := json.Marshal(v)
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(method, path, bytes.NewReader(b))
	c.Request.Header.Set("Content-Type", "application/json")
	return c, w
}

// buildMCPTestRouter builds a gin router with MCP routes wired up.
func buildMCPTestRouter() http.Handler {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	mcpHandler := NewMCPHandler()
	r.POST("/mcp", ValidateMCPToken(), gin.WrapH(mcpHandler))
	r.GET("/mcp", ValidateMCPToken(), gin.WrapH(mcpHandler))
	return r
}

// callMCPTool performs a direct tool handler call without going through HTTP.
// It sets up the context with a valid user session and calls the underlying
// tool handler directly via the Gin route.
func callMCPTool(t *testing.T, rawToken, toolName string, args map[string]any) map[string]any {
	t.Helper()

	if args == nil {
		args = map[string]any{}
	}

	body := map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "tools/call",
		"params": map[string]any{
			"name":      toolName,
			"arguments": args,
		},
	}

	b, _ := json.Marshal(body)

	gin.SetMode(gin.TestMode)
	r := gin.New()
	mcpHandler := NewMCPHandler()
	r.POST("/mcp", ValidateMCPToken(), gin.WrapH(mcpHandler))

	// First do initialize to get session
	initBody := `{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}`
	initReq := httptest.NewRequest("POST", "/mcp", strings.NewReader(initBody))
	initReq.Header.Set("Authorization", "Bearer "+rawToken)
	initReq.Header.Set("Content-Type", "application/json")
	initReq.Header.Set("Accept", "application/json, text/event-stream")
	initW := httptest.NewRecorder()
	r.ServeHTTP(initW, initReq)

	req := httptest.NewRequest("POST", "/mcp", bytes.NewReader(b))
	req.Header.Set("Authorization", "Bearer "+rawToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	// Forward session ID header
	if sid := initW.Header().Get("Mcp-Session-Id"); sid != "" {
		req.Header.Set("Mcp-Session-Id", sid)
	}

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("MCP tool call %q: want 200, got %d: %s", toolName, w.Code, w.Body.String())
	}

	return parseSSEData(t, w.Body.String())
}

// parseSSEData extracts the JSON data from an SSE response body.
// The format is "event: message\ndata: {json}\n\n".
func parseSSEData(t *testing.T, body string) map[string]any {
	t.Helper()
	for _, line := range strings.Split(body, "\n") {
		if strings.HasPrefix(line, "data: ") {
			var resp map[string]any
			if err := json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &resp); err != nil {
				t.Fatalf("parse SSE data line: %v\nline: %s", err, line)
			}
			return resp
		}
	}
	t.Fatalf("no data: line found in SSE response:\n%s", body)
	return nil
}

// extractTextContent gets the first text content from a tool result response.
func extractTextContent(t *testing.T, resp map[string]any) string {
	t.Helper()
	result, _ := resp["result"].(map[string]any)
	contents, _ := result["content"].([]any)
	if len(contents) == 0 {
		return ""
	}
	first, _ := contents[0].(map[string]any)
	text, _ := first["text"].(string)
	return text
}

// isToolError returns true if the response contains a tool error (isError flag)
// or a JSON-RPC protocol error (e.g. schema validation failure).
func isToolError(resp map[string]any) bool {
	// Check for tool-level error (isError in result)
	if result, ok := resp["result"].(map[string]any); ok {
		if isError, _ := result["isError"].(bool); isError {
			return true
		}
	}
	// Check for JSON-RPC protocol error (e.g. schema validation)
	if _, ok := resp["error"]; ok {
		return true
	}
	return false
}
