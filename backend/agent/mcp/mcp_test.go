//go:build integration

package mcp

import (
	"backend/agent/agent"
	"backend/agent/server"
	"backend/libs/authsession"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"backend/testinfra"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ==========================================================================
// Unit tests
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

	t.Run("advertises client id metadata documents, iss, and public clients", func(t *testing.T) {
		m := mcpOAuthMetadata("https://api.example.com")
		if m["client_id_metadata_document_supported"] != true {
			t.Error("client_id_metadata_document_supported should be true")
		}
		if m["authorization_response_iss_parameter_supported"] != true {
			t.Error("authorization_response_iss_parameter_supported should be true")
		}
		methods, _ := m["token_endpoint_auth_methods_supported"].([]string)
		if !slices.Contains(methods, "none") {
			t.Errorf("token_endpoint_auth_methods_supported = %v, want to include none", methods)
		}
		grants, _ := m["grant_types_supported"].([]string)
		if !slices.Contains(grants, "refresh_token") {
			t.Errorf("grant_types_supported = %v, want to include refresh_token", grants)
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

func TestMCPProtectedResourceMetadataFields(t *testing.T) {
	m := mcpProtectedResourceMetadata("https://api.example.com", "https://api.example.com/mcp")
	if m["resource"] != "https://api.example.com/mcp" {
		t.Errorf("resource = %v, want https://api.example.com/mcp", m["resource"])
	}
	servers, _ := m["authorization_servers"].([]string)
	if !slices.Equal(servers, []string{"https://api.example.com"}) {
		t.Errorf("authorization_servers = %v, want [https://api.example.com]", servers)
	}
}

func TestMCPValidateResource(t *testing.T) {
	origin := "https://api.example.com"
	for _, tc := range []struct {
		resource string
		ok       bool
	}{
		{"", true},
		{"https://api.example.com/mcp", true},
		{"https://api.example.com/mcp/", true},
		{"https://api.example.com", true},
		{"https://api.example.com/", true},
		{"https://other.example.com/mcp", false},
		{"https://api.example.com/other", false},
	} {
		err := mcpValidateResource(origin, tc.resource)
		if (err == nil) != tc.ok {
			t.Errorf("mcpValidateResource(%q) error = %v, want ok=%v", tc.resource, err, tc.ok)
		}
	}
}

func TestMCPRedirectURIAllowed(t *testing.T) {
	registered := []string{"https://claude.ai/api/mcp/auth_callback", "http://localhost/callback", "http://127.0.0.1/callback"}
	for _, tc := range []struct {
		requested string
		ok        bool
	}{
		{"https://claude.ai/api/mcp/auth_callback", true},
		{"http://localhost/callback", true},
		{"http://localhost:3118/callback", true},
		{"http://127.0.0.1:52000/callback", true},
		{"http://localhost:3118/other", false},
		{"http://localhost:3118/callback?nonce=7", false},
		{"http://localhost:3118/callback#frag", false},
		{"http://user:pw@localhost:3118/callback", false},
		{"https://localhost:3118/callback", false},
		{"https://claude.ai:8443/api/mcp/auth_callback", false},
		{"https://evil.example.com/callback", false},
	} {
		if got := mcpRedirectURIAllowed(tc.requested, registered); got != tc.ok {
			t.Errorf("mcpRedirectURIAllowed(%q) = %v, want %v", tc.requested, got, tc.ok)
		}
	}
}

func TestMCPRefuseNonPublicDial(t *testing.T) {
	for _, tc := range []struct {
		address string
		ok      bool
	}{
		{"93.184.216.34:443", true},
		{"[2606:2800:220:1:248:1893:25c8:1946]:443", true},
		{"127.0.0.1:443", false},
		{"[::1]:443", false},
		{"10.0.0.5:8443", false},
		{"172.16.3.4:443", false},
		{"192.168.1.1:443", false},
		{"169.254.169.254:80", false},
		{"[fe80::1]:443", false},
		{"[fc00::1]:443", false},
		{"0.0.0.0:443", false},
		{"0.0.0.1:443", false},
		{"100.64.0.1:443", false},
		{"100.100.100.200:80", false},
		{"192.0.0.8:443", false},
		{"198.18.0.1:443", false},
		{"240.0.0.1:443", false},
		{"255.255.255.255:443", false},
		{"[fec0::1]:443", false},
		{"[64:ff9b::a00:1]:443", false},
		{"[2002:a00:1::1]:443", false},
		{"[2001::1]:443", false},
		{"[::ffff:100.64.0.1]:443", false},
		{"[::ffff:93.184.216.34]:443", true},
	} {
		err := mcpRefuseNonPublicDial("tcp", tc.address, nil)
		if (err == nil) != tc.ok {
			t.Errorf("mcpRefuseNonPublicDial(%q) error = %v, want ok=%v", tc.address, err, tc.ok)
		}
	}
}

func TestMCPAppendRedirectParams(t *testing.T) {
	params := url.Values{"code": {"abc"}, "state": {"s"}}
	got, err := mcpAppendRedirectParams("http://127.0.0.1:52000/callback?nonce=7", params)
	if err != nil {
		t.Fatal(err)
	}
	u, _ := url.Parse(got)
	if u.Query().Get("nonce") != "7" || u.Query().Get("code") != "abc" || u.Query().Get("state") != "s" {
		t.Errorf("redirect %q should keep the registered query and add the response parameters", got)
	}
}

func TestMCPBearerChallenge(t *testing.T) {
	want := `Bearer resource_metadata="https://api.example.com/.well-known/oauth-protected-resource/mcp"`
	if got := mcpBearerChallenge("https://api.example.com", false); got != want {
		t.Errorf("challenge without token = %q, want %q", got, want)
	}
	want = `Bearer error="invalid_token", resource_metadata="https://api.example.com/.well-known/oauth-protected-resource/mcp"`
	if got := mcpBearerChallenge("https://api.example.com", true); got != want {
		t.Errorf("challenge with token = %q, want %q", got, want)
	}
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
		ctx := agent.WithUserID(context.Background(), "user-123")
		got, ok := agent.UserIDFromContext(ctx)
		if !ok {
			t.Fatal("expected ok=true")
		}
		if got != "user-123" {
			t.Errorf("got %q, want %q", got, "user-123")
		}
	})

	t.Run("returns false for context without user ID", func(t *testing.T) {
		_, ok := agent.UserIDFromContext(context.Background())
		if ok {
			t.Error("expected ok=false for empty context")
		}
	})
}

// ==========================================================================
// OAuth integration tests
// ==========================================================================

func TestMCPOAuthMetadata(t *testing.T) {
	setConfig(t, func(c *server.Config) {
		c.AgentOrigin = "https://api.example.com"
	})

	c, w := newTestGinContext("GET", "/.well-known/oauth-authorization-server", nil)
	h.MCPOAuthMetadata(c)

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

func TestMCPProtectedResourceMetadata(t *testing.T) {
	setConfig(t, func(c *server.Config) {
		c.AgentOrigin = "https://api.example.com"
	})

	c, w := newTestGinContext("GET", "/.well-known/oauth-protected-resource/mcp", nil)
	h.MCPEndpointProtectedResourceMetadata(c)

	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body["resource"] != "https://api.example.com/mcp" {
		t.Errorf("resource = %v, want https://api.example.com/mcp", body["resource"])
	}
	servers, _ := body["authorization_servers"].([]any)
	if len(servers) != 1 || servers[0] != "https://api.example.com" {
		t.Errorf("authorization_servers = %v, want [https://api.example.com]", servers)
	}
}

func TestMCPProtectedResourceMetadataAtRoot(t *testing.T) {
	setConfig(t, func(c *server.Config) {
		c.AgentOrigin = "https://api.example.com"
	})

	c, w := newTestGinContext("GET", "/.well-known/oauth-protected-resource", nil)
	h.MCPProtectedResourceMetadata(c)

	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body["resource"] != "https://api.example.com" {
		t.Errorf("resource = %v, want the origin for the root document", body["resource"])
	}
}

func TestMCPRegisterClient(t *testing.T) {
	ctx := context.Background()

	t.Run("valid registration", func(t *testing.T) {
		cleanupAll(ctx, t)

		body := `{"client_name":"TestApp","redirect_uris":["http://localhost:9999/cb"]}`
		c, w := newTestGinContext("POST", "/oauth/register", strings.NewReader(body))
		h.MCPRegisterClient(c)

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
		if _, ok := resp["client_secret"]; ok {
			t.Error("a public client should not be issued a secret")
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
		h.MCPRegisterClient(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d", w.Code)
		}
	})

	t.Run("empty redirect_uris", func(t *testing.T) {
		cleanupAll(ctx, t)

		body := `{"client_name":"X","redirect_uris":[]}`
		c, w := newTestGinContext("POST", "/oauth/register", strings.NewReader(body))
		h.MCPRegisterClient(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d", w.Code)
		}
	})

	t.Run("invalid JSON body", func(t *testing.T) {
		cleanupAll(ctx, t)

		c, w := newTestGinContext("POST", "/oauth/register", strings.NewReader(`{invalid`))
		h.MCPRegisterClient(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("duplicate registrations create distinct clients", func(t *testing.T) {
		cleanupAll(ctx, t)

		body := `{"client_name":"SameApp","redirect_uris":["http://localhost:9999/cb"]}`

		c1, w1 := newTestGinContext("POST", "/oauth/register", strings.NewReader(body))
		h.MCPRegisterClient(c1)
		c2, w2 := newTestGinContext("POST", "/oauth/register", strings.NewReader(body))
		h.MCPRegisterClient(c2)

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
		h.MCPAuthorize(c)

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
		h.MCPAuthorize(c)

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
		h.MCPAuthorize(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("metadata URL without a path returns 400", func(t *testing.T) {
		cleanupAll(ctx, t)

		params := url.Values{
			"response_type":  {"code"},
			"client_id":      {"https://claude.ai/"},
			"redirect_uri":   {"http://localhost/cb"},
			"state":          {"s"},
			"code_challenge": {"abc123"},
			"provider":       {"github"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		h.MCPAuthorize(c)

		if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), "https URL") {
			t.Fatalf("want 400 naming the URL requirement, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("unknown registered client_id returns 400", func(t *testing.T) {
		cleanupAll(ctx, t)

		params := url.Values{
			"response_type":  {"code"},
			"client_id":      {"msr_client_0123456789abcdef"},
			"redirect_uri":   {"http://localhost/cb"},
			"state":          {"s"},
			"code_challenge": {"abc123"},
			"provider":       {"github"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		h.MCPAuthorize(c)

		if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), "unknown client_id") {
			t.Fatalf("want 400 for the unknown client, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("registered client redirects to the provider", func(t *testing.T) {
		cleanupAll(ctx, t)
		setConfig(t, func(c *server.Config) {
			c.OAuthGitHubKey = "test_gh_key"
			c.AgentOrigin = "https://api.example.com"
			c.SiteOrigin = "https://app.example.com"
		})
		seedMCPClient(ctx, t, "msr_client_registered", "Cursor", []string{"https://www.cursor.com/agents/mcp/oauth/callback"})

		params := url.Values{
			"response_type":  {"code"},
			"client_id":      {"msr_client_registered"},
			"redirect_uri":   {"https://www.cursor.com/agents/mcp/oauth/callback"},
			"state":          {"mystate"},
			"code_challenge": {"abc123"},
			"provider":       {"github"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		h.MCPAuthorize(c)

		if w.Code != http.StatusFound || !strings.Contains(w.Header().Get("Location"), "github.com/login/oauth/authorize") {
			t.Fatalf("want 302 to GitHub, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("registered client with another redirect_uri returns 400", func(t *testing.T) {
		cleanupAll(ctx, t)
		seedMCPClient(ctx, t, "msr_client_registered2", "Cursor", []string{"https://www.cursor.com/agents/mcp/oauth/callback"})

		params := url.Values{
			"response_type":  {"code"},
			"client_id":      {"msr_client_registered2"},
			"redirect_uri":   {"https://evil.example.com/cb"},
			"state":          {"mystate"},
			"code_challenge": {"abc123"},
			"provider":       {"github"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		h.MCPAuthorize(c)

		if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), "redirect_uri not registered") {
			t.Fatalf("want 400 for the redirect_uri, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("client metadata problems are rejected by reason", func(t *testing.T) {
		cleanupAll(ctx, t)
		for _, tc := range []struct {
			name   string
			serve  func(w http.ResponseWriter, selfURL string)
			reason string
		}{
			{"not found", func(w http.ResponseWriter, _ string) { w.WriteHeader(http.StatusNotFound) }, "did not return 200"},
			{"redirect", func(w http.ResponseWriter, _ string) {
				w.Header().Set("Location", "https://claude.ai/oauth/claude-code-client-metadata")
				w.WriteHeader(http.StatusMovedPermanently)
			}, "did not return 200"},
			{"invalid json", func(w http.ResponseWriter, _ string) { w.Write([]byte("{not json")) }, "not valid JSON"},
			{"oversized", func(w http.ResponseWriter, _ string) { w.Write(bytes.Repeat([]byte(" "), mcpClientMetadataMaxBytes+1)) }, "failed to read"},
			{"no redirect uris", func(w http.ResponseWriter, selfURL string) {
				json.NewEncoder(w).Encode(map[string]any{"client_id": selfURL, "redirect_uris": []string{}})
			}, "no redirect_uris"},
		} {
			t.Run(tc.name, func(t *testing.T) {
				clientID := newTestClientMetadataServerWith(t, func(w http.ResponseWriter, selfURL string) { tc.serve(w, selfURL) })
				params := url.Values{
					"response_type":  {"code"},
					"client_id":      {clientID},
					"redirect_uri":   {"http://localhost/cb"},
					"state":          {"s"},
					"code_challenge": {"abc123"},
					"provider":       {"github"},
				}
				c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
				h.MCPAuthorize(c)
				if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), tc.reason) {
					t.Fatalf("want 400 with %q, got %d: %s", tc.reason, w.Code, w.Body.String())
				}
			})
		}
	})

	t.Run("the production fetcher refuses a loopback metadata URL", func(t *testing.T) {
		cleanupAll(ctx, t)
		requests := 0
		srv := httptest.NewTLSServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { requests++ }))
		t.Cleanup(srv.Close)

		_, err := mcpFetchClientMetadata(ctx, srv.URL+"/client-metadata.json")
		if err == nil || !strings.Contains(err.Error(), "failed to fetch") {
			t.Fatalf("want a fetch failure from the dial guard, got %v", err)
		}
		if requests != 0 {
			t.Error("the loopback server must never be reached")
		}
	})

	t.Run("client metadata whose client_id differs from its URL returns 400", func(t *testing.T) {
		cleanupAll(ctx, t)
		clientID := newTestClientMetadataServer(t, []string{"http://localhost/cb"}, func(doc map[string]any) {
			doc["client_id"] = "https://other.example.com/client-metadata.json"
		})

		params := url.Values{
			"response_type":  {"code"},
			"client_id":      {clientID},
			"redirect_uri":   {"http://localhost/cb"},
			"state":          {"s"},
			"code_challenge": {"abc123"},
			"provider":       {"github"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		h.MCPAuthorize(c)

		if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), "does not match its URL") {
			t.Fatalf("want 400 for the client_id mismatch, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("redirect_uri not registered", func(t *testing.T) {
		cleanupAll(ctx, t)
		clientID := newTestClientMetadataServer(t, []string{"http://allowed.example.com/cb"}, nil)

		params := url.Values{
			"response_type":  {"code"},
			"client_id":      {clientID},
			"redirect_uri":   {"http://evil.example.com/cb"},
			"state":          {"mystate"},
			"code_challenge": {"abc123"},
			"provider":       {"github"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		h.MCPAuthorize(c)

		if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), "redirect_uri not registered") {
			t.Fatalf("want 400 for the redirect_uri, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("loopback redirect_uri matches with any port", func(t *testing.T) {
		cleanupAll(ctx, t)
		setConfig(t, func(c *server.Config) {
			c.OAuthGitHubKey = "test_gh_key"
			c.AgentOrigin = "https://api.example.com"
			c.SiteOrigin = "https://app.example.com"
		})
		clientID := newTestClientMetadataServer(t, []string{"http://localhost/callback", "http://127.0.0.1/callback"}, nil)

		params := url.Values{
			"response_type":  {"code"},
			"client_id":      {clientID},
			"redirect_uri":   {"http://localhost:3118/callback"},
			"state":          {"mystate"},
			"code_challenge": {"abc123"},
			"provider":       {"github"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		h.MCPAuthorize(c)

		if w.Code != http.StatusFound {
			t.Fatalf("want 302, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("resource naming another server returns 400", func(t *testing.T) {
		cleanupAll(ctx, t)
		setConfig(t, func(c *server.Config) {
			c.OAuthGitHubKey = "test_gh_key"
			c.AgentOrigin = "https://api.example.com"
			c.SiteOrigin = "https://app.example.com"
		})
		clientID := newTestClientMetadataServer(t, []string{"http://localhost:9999/cb"}, nil)

		params := url.Values{
			"response_type":  {"code"},
			"client_id":      {clientID},
			"redirect_uri":   {"http://localhost:9999/cb"},
			"state":          {"mystate"},
			"code_challenge": {"abc123"},
			"resource":       {"https://other.example.com/mcp"},
			"provider":       {"github"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		h.MCPAuthorize(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("missing code_challenge returns 400", func(t *testing.T) {
		cleanupAll(ctx, t)
		setConfig(t, func(c *server.Config) {
			c.OAuthGitHubKey = "test_gh_key"
			c.AgentOrigin = "https://api.example.com"
		})
		clientID := newTestClientMetadataServer(t, []string{"http://localhost:9999/cb"}, nil)

		params := url.Values{
			"response_type": {"code"},
			"client_id":     {clientID},
			"redirect_uri":  {"http://localhost:9999/cb"},
			"state":         {"mystate"},
			"provider":      {"github"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		h.MCPAuthorize(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("no provider with a malformed metadata URL returns 400 before the login page", func(t *testing.T) {
		cleanupAll(ctx, t)

		params := url.Values{
			"response_type":  {"code"},
			"client_id":      {"https://claude.ai/"},
			"redirect_uri":   {"http://localhost:9999/cb"},
			"state":          {"mystate"},
			"code_challenge": {"abc123"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		h.MCPAuthorize(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("no provider with an unregistered redirect_uri returns 400 before the login page", func(t *testing.T) {
		cleanupAll(ctx, t)
		clientID := newTestClientMetadataServer(t, []string{"http://localhost:9999/cb"}, nil)

		params := url.Values{
			"response_type":  {"code"},
			"client_id":      {clientID},
			"redirect_uri":   {"https://evil.example.com/cb"},
			"state":          {"mystate"},
			"code_challenge": {"abc123"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		h.MCPAuthorize(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("no provider redirects to login page", func(t *testing.T) {
		cleanupAll(ctx, t)
		setConfig(t, func(c *server.Config) {
			c.SiteOrigin = "https://app.example.com"
		})
		clientID := newTestClientMetadataServer(t, []string{"http://localhost:9999/cb"}, nil)

		params := url.Values{
			"response_type":  {"code"},
			"client_id":      {clientID},
			"redirect_uri":   {"http://localhost:9999/cb"},
			"state":          {"mystate"},
			"code_challenge": {"abc123"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		h.MCPAuthorize(c)

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
		if q.Get("client_id") != clientID {
			t.Errorf("client_id = %q, want %q", q.Get("client_id"), clientID)
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

	t.Run("a failure after the redirect_uri check goes back to the client", func(t *testing.T) {
		cleanupAll(ctx, t)
		setConfig(t, func(c *server.Config) {
			c.AgentOrigin = "https://api.example.com"
			c.SiteOrigin = "https://app.example.com"
		})
		clientID := newTestClientMetadataServer(t, []string{"http://localhost:9999/cb"}, nil)

		params := url.Values{
			"response_type":  {"code"},
			"client_id":      {clientID},
			"redirect_uri":   {"http://localhost:9999/cb"},
			"state":          {"mystate"},
			"code_challenge": {"abc123"},
			"provider":       {"myspace"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		h.MCPAuthorize(c)

		if w.Code != http.StatusFound {
			t.Fatalf("want 302, got %d: %s", w.Code, w.Body.String())
		}
		loc, parseErr := url.Parse(w.Header().Get("Location"))
		if parseErr != nil {
			t.Fatalf("parse redirect location: %v", parseErr)
		}
		if got := loc.Scheme + "://" + loc.Host + loc.Path; got != "http://localhost:9999/cb" {
			t.Errorf("sent to %q, want the client's redirect_uri", got)
		}
		q := loc.Query()
		if q.Get("error") != "invalid_request" {
			t.Errorf("error = %q, want invalid_request", q.Get("error"))
		}
		if q.Get("error_description") != "unsupported provider" {
			t.Errorf("error_description = %q, want unsupported provider", q.Get("error_description"))
		}
		if q.Get("state") != "mystate" {
			t.Errorf("state = %q, want mystate", q.Get("state"))
		}
		if q.Get("iss") != "https://api.example.com" {
			t.Errorf("iss = %q, want https://api.example.com", q.Get("iss"))
		}
		if q.Get("code") != "" {
			t.Error("an error response must not carry a code")
		}
	})

	t.Run("a failure before the redirect_uri check stays in the browser", func(t *testing.T) {
		cleanupAll(ctx, t)
		setConfig(t, func(c *server.Config) {
			c.AgentOrigin = "https://api.example.com"
		})
		clientID := newTestClientMetadataServer(t, []string{"http://localhost:9999/cb"}, nil)

		params := url.Values{
			"response_type":  {"code"},
			"client_id":      {clientID},
			"redirect_uri":   {"http://localhost:9999/not-registered"},
			"state":          {"mystate"},
			"code_challenge": {"abc123"},
			"provider":       {"myspace"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		h.MCPAuthorize(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
		if loc := w.Header().Get("Location"); loc != "" {
			t.Errorf("an unchecked address must not be redirected to, got %q", loc)
		}
	})

	t.Run("provider=github redirects to GitHub OAuth with unified callback and mcp_ prefix", func(t *testing.T) {
		cleanupAll(ctx, t)
		setConfig(t, func(c *server.Config) {
			c.OAuthGitHubKey = "test_gh_key"
			c.AgentOrigin = "https://api.example.com"
			c.SiteOrigin = "https://app.example.com"
		})
		clientID := newTestClientMetadataServer(t, []string{"http://localhost:9999/cb"}, nil)

		params := url.Values{
			"response_type":         {"code"},
			"client_id":             {clientID},
			"redirect_uri":          {"http://localhost:9999/cb"},
			"state":                 {"mystate"},
			"code_challenge":        {"abc123"},
			"code_challenge_method": {"S256"},
			"resource":              {"https://api.example.com/mcp"},
			"provider":              {"github"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		h.MCPAuthorize(c)

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
		setConfig(t, func(c *server.Config) {
			c.OAuthGoogleKey = "test_google_key"
			c.OAuthGoogleSecret = "test_google_secret"
			c.AgentOrigin = "https://api.example.com"
			c.SiteOrigin = "https://app.example.com"
		})
		clientID := newTestClientMetadataServer(t, []string{"http://localhost:9999/cb"}, nil)

		params := url.Values{
			"response_type":  {"code"},
			"client_id":      {clientID},
			"redirect_uri":   {"http://localhost:9999/cb"},
			"state":          {"mystate"},
			"code_challenge": {"abc123"},
			"resource":       {"https://api.example.com"},
			"provider":       {"google"},
		}
		c, w := newTestGinContextWithQuery("GET", "/oauth/authorize", params)
		h.MCPAuthorize(c)

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
		h.MCPCallbackExchange(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("unknown state returns 400", func(t *testing.T) {
		cleanupAll(ctx, t)

		c, w := newTestGinContextJSON("POST", "/mcp/auth/callback", map[string]any{"code": "ghcode", "state": "nosuchstate"})
		h.MCPCallbackExchange(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("missing code returns 400", func(t *testing.T) {
		cleanupAll(ctx, t)

		storeTestStateWithProvider(ctx, t, "cbstate_nocode", "clientA", "http://localhost/cb", "challenge", "mcpstate1", "github")

		c, w := newTestGinContextJSON("POST", "/mcp/auth/callback", map[string]any{"code": "", "state": "cbstate_nocode"})
		h.MCPCallbackExchange(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("GitHub code exchange returns redirect URL", func(t *testing.T) {
		cleanupAll(ctx, t)

		mcpExchangeGitHubCodeFn = func(code, redirectURI, _, _ string) (string, error) {
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
		storeTestStateWithProvider(ctx, t, "cbstate_gh", clientID, redirectURI, "challenge123", "mcpstate2", "github")

		c, w := newTestGinContextJSON("POST", "/mcp/auth/callback", map[string]any{"code": "ghcode", "state": "cbstate_gh"})
		h.MCPCallbackExchange(c)

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
		if iss := parsedLoc.Query().Get("iss"); iss != deps.Config.AgentOrigin {
			t.Errorf("expected iss=%q, got %q", deps.Config.AgentOrigin, iss)
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

		mcpExchangeGoogleCodeFn = func(code, redirectURI, _, _ string) (string, string, error) {
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
		storeTestStateWithProvider(ctx, t, "cbstate_google", clientID, redirectURI, "challenge123", "mcpstate3", "google")

		c, w := newTestGinContextJSON("POST", "/mcp/auth/callback", map[string]any{"code": "googlecode", "state": "cbstate_google"})
		h.MCPCallbackExchange(c)

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

		mcpExchangeGitHubCodeFn = func(code, redirectURI, _, _ string) (string, error) {
			return "", fmt.Errorf("github is down")
		}

		clientID := "clientCBFail"
		redirectURI := "http://localhost:9999/cb"
		storeTestStateWithProvider(ctx, t, "cbstate_ghfail", clientID, redirectURI, "challenge", "mcpstate_fail", "github")

		c, w := newTestGinContextJSON("POST", "/mcp/auth/callback", map[string]any{"code": "ghcode", "state": "cbstate_ghfail"})
		h.MCPCallbackExchange(c)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("want 500, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("GitHub invalid code returns 400", func(t *testing.T) {
		cleanupAll(ctx, t)

		mcpExchangeGitHubCodeFn = func(code, redirectURI, _, _ string) (string, error) {
			return "", fmt.Errorf("%w: bad_verification_code", authsession.ErrInvalidOAuthCode)
		}

		clientID := "clientCBBadCode"
		redirectURI := "http://localhost:9999/cb"
		storeTestStateWithProvider(ctx, t, "cbstate_ghbadcode", clientID, redirectURI, "challenge", "mcpstate_badcode", "github")

		c, w := newTestGinContextJSON("POST", "/mcp/auth/callback", map[string]any{"code": "usedcode", "state": "cbstate_ghbadcode"})
		h.MCPCallbackExchange(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("Google exchange failure returns 500", func(t *testing.T) {
		cleanupAll(ctx, t)

		mcpExchangeGoogleCodeFn = func(code, redirectURI, _, _ string) (string, string, error) {
			return "", "", fmt.Errorf("google is down")
		}

		clientID := "clientCBGFail"
		redirectURI := "http://localhost:9999/cb"
		storeTestStateWithProvider(ctx, t, "cbstate_gfail", clientID, redirectURI, "challenge", "mcpstate_gfail", "google")

		c, w := newTestGinContextJSON("POST", "/mcp/auth/callback", map[string]any{"code": "googlecode", "state": "cbstate_gfail"})
		h.MCPCallbackExchange(c)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("want 500, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("Google invalid code returns 400", func(t *testing.T) {
		cleanupAll(ctx, t)

		mcpExchangeGoogleCodeFn = func(code, redirectURI, _, _ string) (string, string, error) {
			return "", "", fmt.Errorf("%w: invalid_grant", authsession.ErrInvalidOAuthCode)
		}

		clientID := "clientCBGBadCode"
		redirectURI := "http://localhost:9999/cb"
		storeTestStateWithProvider(ctx, t, "cbstate_gbadcode", clientID, redirectURI, "challenge", "mcpstate_gbadcode", "google")

		c, w := newTestGinContextJSON("POST", "/mcp/auth/callback", map[string]any{"code": "usedcode", "state": "cbstate_gbadcode"})
		h.MCPCallbackExchange(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	// State is consumed with GETDEL, so a replayed callback never reaches the
	// provider a second time with the same single-use code.
	t.Run("replayed state returns 400", func(t *testing.T) {
		cleanupAll(ctx, t)

		var exchanges int
		mcpExchangeGitHubCodeFn = func(code, redirectURI, _, _ string) (string, error) {
			exchanges++
			return "ghtoken", nil
		}
		mcpGetGitHubUserFn = func(token string) (authsession.GitHubUser, error) {
			return authsession.GitHubUser{Name: "Replay User", Email: "replay@example.com"}, nil
		}

		clientID := "clientCBReplay"
		redirectURI := "http://localhost:9999/cb"
		storeTestStateWithProvider(ctx, t, "cbstate_replay", clientID, redirectURI, "challenge", "mcpstate_replay", "github")

		body := map[string]any{"code": "ghcode", "state": "cbstate_replay"}

		c, w := newTestGinContextJSON("POST", "/mcp/auth/callback", body)
		h.MCPCallbackExchange(c)
		if w.Code != http.StatusOK {
			t.Fatalf("first callback: want 200, got %d: %s", w.Code, w.Body.String())
		}

		c, w = newTestGinContextJSON("POST", "/mcp/auth/callback", body)
		h.MCPCallbackExchange(c)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("replayed callback: want 400, got %d: %s", w.Code, w.Body.String())
		}

		if exchanges != 1 {
			t.Errorf("exchanges = %d, want 1", exchanges)
		}
	})

	t.Run("existing user found, auth code inserted", func(t *testing.T) {
		cleanupAll(ctx, t)

		existingUserID := uuid.New()
		seedUser(ctx, t, existingUserID.String(), "existing@example.com")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "existing's team")
		seedTeamMembership(ctx, t, teamID, existingUserID.String(), "owner")

		mcpExchangeGitHubCodeFn = func(code, redirectURI, _, _ string) (string, error) {
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
		storeTestStateWithProvider(ctx, t, "cbstate_existing", clientID, redirectURI, "", "mcpstate4", "github")

		c, w := newTestGinContextJSON("POST", "/mcp/auth/callback", map[string]any{"code": "ghcode", "state": "cbstate_existing"})
		h.MCPCallbackExchange(c)

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
		seedMCPAuthCodeWithProvider(ctx, t, code, userID.String(), clientID, redirectURI, challenge, time.Now().Add(10*time.Minute), "ghtoken_for_test", "github")

		form := url.Values{
			"grant_type":    {"authorization_code"},
			"code":          {code},
			"redirect_uri":  {redirectURI},
			"client_id":     {clientID},
			"code_verifier": {verifier},
		}
		c, w := newTestGinContextForm("POST", "/oauth/token", form)
		h.MCPToken(c)

		if w.Code != http.StatusOK {
			t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
		}

		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		rawToken, _ := resp["access_token"].(string)
		if resp["token_type"] != "Bearer" {
			t.Errorf("token_type = %v, want Bearer", resp["token_type"])
		}
		if expiresIn, _ := resp["expires_in"].(float64); int(expiresIn) != int(mcpTokenExpiry.Seconds()) {
			t.Errorf("expires_in = %v, want %d", resp["expires_in"], int(mcpTokenExpiry.Seconds()))
		}
		refreshToken, _ := resp["refresh_token"].(string)
		if sessionIDOf(t, refreshToken) != sessionIDOf(t, rawToken) {
			t.Error("both tokens should name the same session")
		}

		// Verify code is now marked used
		codeRow := getMCPAuthCode(ctx, t, code)
		if !codeRow.Used {
			t.Error("code should be marked used after exchange")
		}

		tokenRow := getMCPSession(ctx, t, sessionIDOf(t, rawToken))
		if tokenRow == nil {
			t.Fatal("session not found in DB")
		}
		if tokenRow.UserID != userID {
			t.Errorf("session user_id = %s, want %s", tokenRow.UserID, userID)
		}
		if tokenRow.RefreshExpiresAt.Before(time.Now().Add(89 * 24 * time.Hour)) {
			t.Errorf("rt_expiry_at = %v, want about 90 days out", tokenRow.RefreshExpiresAt)
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
		seedMCPAuthCodeWithProvider(ctx, t, code, userID.String(), clientID, redirectURI, challenge, time.Now().Add(10*time.Minute), "google_refresh_token_test", "google")

		form := url.Values{
			"grant_type":    {"authorization_code"},
			"code":          {code},
			"redirect_uri":  {redirectURI},
			"client_id":     {clientID},
			"code_verifier": {verifier},
		}
		c, w := newTestGinContextForm("POST", "/oauth/token", form)
		h.MCPToken(c)

		if w.Code != http.StatusOK {
			t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
		}

		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		rawToken, _ := resp["access_token"].(string)

		tokenRow := getMCPSession(ctx, t, sessionIDOf(t, rawToken))
		if tokenRow == nil {
			t.Fatal("session not found in DB")
		}
		if tokenRow.UserID != userID {
			t.Errorf("session user_id = %s, want %s", tokenRow.UserID, userID)
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
		h.MCPToken(c)

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
		h.MCPToken(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("resource naming this server is accepted", func(t *testing.T) {
		cleanupAll(ctx, t)
		setConfig(t, func(c *server.Config) {
			c.AgentOrigin = "https://api.example.com"
		})

		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "resource@example.com")

		verifier, challenge := makeVerifier()
		code := "resourcecode"
		clientID := "https://claude.ai/oauth/claude-code-client-metadata"
		redirectURI := "http://localhost:3118/callback"
		seedMCPAuthCodeWithProvider(ctx, t, code, userID.String(), clientID, redirectURI, challenge, time.Now().Add(10*time.Minute), "ghtoken_resource", "github")

		form := url.Values{
			"grant_type":    {"authorization_code"},
			"code":          {code},
			"redirect_uri":  {redirectURI},
			"client_id":     {clientID},
			"code_verifier": {verifier},
			"resource":      {"https://api.example.com/mcp"},
		}
		c, w := newTestGinContextForm("POST", "/oauth/token", form)
		h.MCPToken(c)

		if w.Code != http.StatusOK {
			t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("resource naming another server returns 400", func(t *testing.T) {
		cleanupAll(ctx, t)
		setConfig(t, func(c *server.Config) {
			c.AgentOrigin = "https://api.example.com"
		})

		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "badresource@example.com")

		verifier, challenge := makeVerifier()
		code := "badresourcecode"
		clientID := "https://claude.ai/oauth/claude-code-client-metadata"
		redirectURI := "http://localhost:3118/callback"
		seedMCPAuthCodeWithProvider(ctx, t, code, userID.String(), clientID, redirectURI, challenge, time.Now().Add(10*time.Minute), "ghtoken_badresource", "github")

		form := url.Values{
			"grant_type":    {"authorization_code"},
			"code":          {code},
			"redirect_uri":  {redirectURI},
			"client_id":     {clientID},
			"code_verifier": {verifier},
			"resource":      {"https://other.example.com/mcp"},
		}
		c, w := newTestGinContextForm("POST", "/oauth/token", form)
		h.MCPToken(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
		if codeRow := getMCPAuthCode(ctx, t, code); codeRow.Used {
			t.Error("code should stay unused when the resource is rejected")
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
		seedMCPAuthCodeWithProvider(ctx, t, code, userID.String(), clientID, redirectURI, challenge, time.Now().Add(10*time.Minute), "ghtoken_json", "github")

		jsonBody := map[string]any{
			"grant_type":    "authorization_code",
			"code":          code,
			"redirect_uri":  redirectURI,
			"client_id":     clientID,
			"code_verifier": verifier,
		}
		c, w := newTestGinContextJSON("POST", "/oauth/token", jsonBody)
		h.MCPToken(c)

		if w.Code != http.StatusOK {
			t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
		}

		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		rawToken, _ := resp["access_token"].(string)
		if getMCPSession(ctx, t, sessionIDOf(t, rawToken)) == nil {
			t.Error("the issued token should name a session")
		}
	})

	t.Run("valid exchange without PKCE", func(t *testing.T) {
		cleanupAll(ctx, t)

		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "nopkce@example.com")

		code := "nopkcecode"
		clientID := "clientNoPKCE"
		redirectURI := "http://localhost/cb"
		// Store auth code with empty code_challenge
		seedMCPAuthCodeWithProvider(ctx, t, code, userID.String(), clientID, redirectURI, "", time.Now().Add(10*time.Minute), "ghtoken_nopkce", "github")

		form := url.Values{
			"grant_type":   {"authorization_code"},
			"code":         {code},
			"redirect_uri": {redirectURI},
			"client_id":    {clientID},
		}
		c, w := newTestGinContextForm("POST", "/oauth/token", form)
		h.MCPToken(c)

		if w.Code != http.StatusOK {
			t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
		}

		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		rawToken, _ := resp["access_token"].(string)
		if getMCPSession(ctx, t, sessionIDOf(t, rawToken)) == nil {
			t.Error("the issued token should name a session")
		}
	})

	t.Run("code not found", func(t *testing.T) {
		cleanupAll(ctx, t)

		form := url.Values{
			"grant_type": {"authorization_code"},
			"code":       {"doesnotexist"},
		}
		c, w := newTestGinContextForm("POST", "/oauth/token", form)
		h.MCPToken(c)

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
		h.MCPToken(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d", w.Code)
		}
		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		if resp["error"] != "invalid_grant" {
			t.Errorf("error = %v, want invalid_grant", resp["error"])
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
		h.MCPToken(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d", w.Code)
		}
		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		if resp["error"] != "invalid_grant" {
			t.Errorf("error = %v, want invalid_grant", resp["error"])
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
		h.MCPToken(c)

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
		h.MCPToken(c)

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
		h.MCPToken(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d", w.Code)
		}
	})
}

// ==========================================================================
// Middleware & tool integration tests
// ==========================================================================

func issueTestTokenPair(ctx context.Context, t *testing.T, userID uuid.UUID, clientID string) mcpTokenPair {
	t.Helper()
	code := "code_" + uuid.NewString()
	seedMCPAuthCodeWithProvider(ctx, t, code, userID.String(), clientID, "http://localhost/cb", "", time.Now().Add(10*time.Minute), "ghtoken_"+code, "github")
	form := url.Values{
		"grant_type":   {"authorization_code"},
		"code":         {code},
		"redirect_uri": {"http://localhost/cb"},
		"client_id":    {clientID},
	}
	c, w := newTestGinContextForm("POST", "/oauth/token", form)
	h.MCPToken(c)
	if w.Code != http.StatusOK {
		t.Fatalf("issue token pair: want 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode token response: %v", err)
	}
	return mcpTokenPair{AccessToken: resp.AccessToken, RefreshToken: resp.RefreshToken}
}

func refreshTestToken(refreshToken, clientID string) *httptest.ResponseRecorder {
	form := url.Values{
		"grant_type":    {"refresh_token"},
		"refresh_token": {refreshToken},
	}
	if clientID != "" {
		form.Set("client_id", clientID)
	}
	c, w := newTestGinContextForm("POST", "/oauth/token", form)
	h.MCPToken(c)
	return w
}

func TestMCPRefreshToken(t *testing.T) {
	ctx := context.Background()
	clientID := "https://claude.ai/oauth/claude-code-client-metadata"

	oauthError := func(t *testing.T, w *httptest.ResponseRecorder) string {
		t.Helper()
		var resp map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("decode error response: %v", err)
		}
		e, _ := resp["error"].(string)
		return e
	}

	refreshTokenOf := func(t *testing.T, w *httptest.ResponseRecorder) string {
		t.Helper()
		var resp map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("decode token response: %v", err)
		}
		rt, _ := resp["refresh_token"].(string)
		return rt
	}

	t.Run("a refresh token presented twice after the reuse window ends the session", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "reuse@example.com")
		first := issueTestTokenPair(ctx, t, userID, clientID)
		sessionID := sessionIDOf(t, first.AccessToken)

		if w := refreshTestToken(first.RefreshToken, clientID); w.Code != http.StatusOK {
			t.Fatalf("first refresh: want 200, got %d: %s", w.Code, w.Body.String())
		}
		ageRotation(ctx, t, sessionID)

		w := refreshTestToken(first.RefreshToken, clientID)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("second use: want 400, got %d: %s", w.Code, w.Body.String())
		}
		if getMCPSession(ctx, t, sessionID) != nil {
			t.Error("reusing a refresh token should end the session")
		}
	})

	t.Run("a refresh token presented twice within the reuse window returns the current pair", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "reuse-window@example.com")
		first := issueTestTokenPair(ctx, t, userID, clientID)
		sessionID := sessionIDOf(t, first.AccessToken)

		w := refreshTestToken(first.RefreshToken, clientID)
		if w.Code != http.StatusOK {
			t.Fatalf("first refresh: want 200, got %d: %s", w.Code, w.Body.String())
		}
		current := refreshTokenOf(t, w)
		currentID := getMCPSession(ctx, t, sessionID).RefreshTokenID

		w = refreshTestToken(first.RefreshToken, clientID)
		if w.Code != http.StatusOK {
			t.Fatalf("second use: want 200, got %d: %s", w.Code, w.Body.String())
		}
		if got := refreshTokenOf(t, w); got != current {
			t.Error("a repeat within the window should return the current refresh token")
		}
		row := getMCPSession(ctx, t, sessionID)
		if row == nil {
			t.Fatal("a repeat within the window should keep the session")
		}
		if row.RefreshTokenID != currentID {
			t.Error("a repeat within the window should not rotate the session")
		}

		if w := refreshTestToken(current, clientID); w.Code != http.StatusOK {
			t.Errorf("current refresh token: want 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("concurrent refreshes with one token all get the same pair", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "concurrent@example.com")
		first := issueTestTokenPair(ctx, t, userID, clientID)
		sessionID := sessionIDOf(t, first.AccessToken)

		const n = 5
		results := make([]*httptest.ResponseRecorder, n)
		var wg sync.WaitGroup
		for i := range n {
			wg.Add(1)
			go func() {
				defer wg.Done()
				results[i] = refreshTestToken(first.RefreshToken, clientID)
			}()
		}
		wg.Wait()

		var want string
		for i, w := range results {
			if w.Code != http.StatusOK {
				t.Fatalf("refresh %d: want 200, got %d: %s", i, w.Code, w.Body.String())
			}
			got := refreshTokenOf(t, w)
			if want == "" {
				want = got
			}
			if got != want {
				t.Errorf("refresh %d returned a different refresh token", i)
			}
		}
		if getMCPSession(ctx, t, sessionID) == nil {
			t.Error("concurrent refreshes should keep the session")
		}
	})

	t.Run("a refresh that loses the rotation race after a slow provider check gets the current pair", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "slow-provider@example.com")
		first := issueTestTokenPair(ctx, t, userID, clientID)
		sessionID := sessionIDOf(t, first.AccessToken)
		ageProviderCheck(ctx, t, sessionID)

		entered := make(chan struct{})
		release := make(chan struct{})
		var calls atomic.Int32
		origFn := mcpValidateProviderTokenFn
		mcpValidateProviderTokenFn = func(provider, token, _, _ string) error {
			if calls.Add(1) == 1 {
				close(entered)
				<-release
			}
			return nil
		}
		t.Cleanup(func() { mcpValidateProviderTokenFn = origFn })

		slow := make(chan *httptest.ResponseRecorder)
		go func() { slow <- refreshTestToken(first.RefreshToken, clientID) }()
		<-entered

		w := refreshTestToken(first.RefreshToken, clientID)
		if w.Code != http.StatusOK {
			t.Fatalf("fast refresh: want 200, got %d: %s", w.Code, w.Body.String())
		}
		current := refreshTokenOf(t, w)
		ageRotation(ctx, t, sessionID)

		close(release)
		w = <-slow
		if w.Code != http.StatusOK {
			t.Fatalf("slow refresh: want 200, got %d: %s", w.Code, w.Body.String())
		}
		if got := refreshTokenOf(t, w); got != current {
			t.Error("the slow refresh should return the current refresh token")
		}
		if getMCPSession(ctx, t, sessionID) == nil {
			t.Error("the slow refresh should keep the session")
		}
	})

	t.Run("a refresh token older than the last rotation ends the session within the reuse window", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "reuse-older@example.com")
		first := issueTestTokenPair(ctx, t, userID, clientID)
		sessionID := sessionIDOf(t, first.AccessToken)

		w := refreshTestToken(first.RefreshToken, clientID)
		if w.Code != http.StatusOK {
			t.Fatalf("first refresh: want 200, got %d: %s", w.Code, w.Body.String())
		}
		if w := refreshTestToken(refreshTokenOf(t, w), clientID); w.Code != http.StatusOK {
			t.Fatalf("second refresh: want 200, got %d: %s", w.Code, w.Body.String())
		}

		w = refreshTestToken(first.RefreshToken, clientID)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("oldest token: want 400, got %d: %s", w.Code, w.Body.String())
		}
		if getMCPSession(ctx, t, sessionID) != nil {
			t.Error("a token older than the last rotation should end the session")
		}
	})

	t.Run("a refresh token the session never issued ends it", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "forged-rt@example.com")
		first := issueTestTokenPair(ctx, t, userID, clientID)
		sessionID := sessionIDOf(t, first.AccessToken)

		stray := seedMCPRefreshTokenWithID(t, sessionID, uuid.New(), time.Now().Add(mcpRefreshTokenExpiry))
		w := refreshTestToken(stray, clientID)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
		if getMCPSession(ctx, t, sessionID) != nil {
			t.Error("a refresh token the session never issued should end it")
		}
	})

	t.Run("valid refresh replaces the pair", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "refresh@example.com")
		first := issueTestTokenPair(ctx, t, userID, clientID)
		sessionID := sessionIDOf(t, first.AccessToken)
		oldRefreshTokenID := getMCPSession(ctx, t, sessionID).RefreshTokenID

		w := refreshTestToken(first.RefreshToken, clientID)
		if w.Code != http.StatusOK {
			t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
		}
		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		newAccess, _ := resp["access_token"].(string)
		newRefresh, _ := resp["refresh_token"].(string)
		if newAccess == "" || newRefresh == "" {
			t.Fatalf("response should carry a new pair: %s", w.Body.String())
		}
		if newAccess == first.AccessToken || newRefresh == first.RefreshToken {
			t.Error("refresh should issue different tokens")
		}

		if sessionIDOf(t, newAccess) != sessionID {
			t.Error("a refresh should stay on the same session")
		}
		newRow := getMCPSession(ctx, t, sessionID)
		if newRow == nil {
			t.Fatal("the session row should outlive a refresh")
		}
		if newRow.RefreshTokenID == oldRefreshTokenID {
			t.Error("the row should record the new refresh token")
		}
		if newRow.UserID != userID || newRow.ClientID != clientID {
			t.Error("the new pair should keep the user and client")
		}
		if newRow.ProviderToken == nil || *newRow.ProviderToken == "" {
			t.Error("the new pair should carry the provider token forward")
		}

		// The old access token is signed and not looked up, so it keeps
		// working until its own expiry. Only the refresh token dies at once.
		c, w2 := newTestGinContext("POST", "/mcp", nil)
		c.Request.Header.Set("Authorization", "Bearer "+first.AccessToken)
		h.ValidateMCPToken()(c)
		if w2.Code != http.StatusOK {
			t.Errorf("old access token before its expiry: want 200, got %d", w2.Code)
		}
		c, w3 := newTestGinContext("POST", "/mcp", nil)
		c.Request.Header.Set("Authorization", "Bearer "+newAccess)
		h.ValidateMCPToken()(c)
		if w3.Code != http.StatusOK {
			t.Errorf("new access token: want 200, got %d: %s", w3.Code, w3.Body.String())
		}

		ageRotation(ctx, t, sessionID)
		w = refreshTestToken(first.RefreshToken, clientID)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("old refresh token: want 400, got %d: %s", w.Code, w.Body.String())
		}
		if got := oauthError(t, w); got != "invalid_grant" {
			t.Errorf("error = %q, want invalid_grant", got)
		}
	})

	t.Run("expired refresh token returns invalid_grant", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "expiredrefresh@example.com")
		pair := issueTestTokenPair(ctx, t, userID, clientID)
		if _, err := deps.PgPool.Exec(ctx,
			`UPDATE measure.mcp_auth_sessions SET rt_expiry_at = now() - interval '1 minute' WHERE id = $1`,
			sessionIDOf(t, pair.RefreshToken)); err != nil {
			t.Fatalf("expire refresh token: %v", err)
		}

		w := refreshTestToken(pair.RefreshToken, clientID)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
		if got := oauthError(t, w); got != "invalid_grant" {
			t.Errorf("error = %q, want invalid_grant", got)
		}
	})

	t.Run("unknown refresh token returns invalid_grant", func(t *testing.T) {
		cleanupAll(ctx, t)

		w := refreshTestToken("msr_nosuchrefreshtoken", clientID)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
		if got := oauthError(t, w); got != "invalid_grant" {
			t.Errorf("error = %q, want invalid_grant", got)
		}
	})

	t.Run("ended session cannot be refreshed", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "endedrefresh@example.com")
		pair := issueTestTokenPair(ctx, t, userID, clientID)
		if err := mcpEndSession(ctx, deps, sessionIDOf(t, pair.AccessToken)); err != nil {
			t.Fatal(err)
		}

		w := refreshTestToken(pair.RefreshToken, clientID)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
		if got := oauthError(t, w); got != "invalid_grant" {
			t.Errorf("error = %q, want invalid_grant", got)
		}
	})

	t.Run("client_id mismatch returns invalid_grant", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "wrongclient@example.com")
		pair := issueTestTokenPair(ctx, t, userID, clientID)

		w := refreshTestToken(pair.RefreshToken, "https://other.example.com/client-metadata.json")
		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
		if got := oauthError(t, w); got != "invalid_grant" {
			t.Errorf("error = %q, want invalid_grant", got)
		}
		if getMCPSession(ctx, t, sessionIDOf(t, pair.AccessToken)) == nil {
			t.Error("a rejected refresh must leave the pair in place")
		}
	})

	t.Run("an access token is not accepted as a refresh token", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "atasrt@example.com")
		pair := issueTestTokenPair(ctx, t, userID, clientID)
		sessionID := sessionIDOf(t, pair.AccessToken)

		// Separate signing secrets would reject the access token before its
		// jti is ever read, so both are set to one value here, leaving the
		// jti as the only thing that tells the two tokens apart.
		setConfig(t, func(c *server.Config) { c.RefreshTokenSecret = c.AccessTokenSecret })

		w := refreshTestToken(pair.AccessToken, clientID)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
		if got := oauthError(t, w); got != "invalid_grant" {
			t.Errorf("error = %q, want invalid_grant", got)
		}
		if getMCPSession(ctx, t, sessionID) != nil {
			t.Error("presenting an access token as a refresh token should end the session")
		}
	})

	t.Run("missing refresh_token returns 400", func(t *testing.T) {
		cleanupAll(ctx, t)

		w := refreshTestToken("", clientID)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("refresh via JSON body", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "jsonrefresh@example.com")
		pair := issueTestTokenPair(ctx, t, userID, clientID)

		c, w := newTestGinContextJSON("POST", "/oauth/token", map[string]any{
			"grant_type":    "refresh_token",
			"refresh_token": pair.RefreshToken,
			"client_id":     clientID,
		})
		h.MCPToken(c)
		if w.Code != http.StatusOK {
			t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
		}
	})
}

func TestValidateMCPToken(t *testing.T) {
	ctx := context.Background()

	t.Run("no Authorization header", func(t *testing.T) {
		cleanupAll(ctx, t)
		setConfig(t, func(c *server.Config) {
			c.AgentOrigin = "https://api.example.com"
		})
		c, w := newTestGinContext("POST", "/mcp", nil)
		h.ValidateMCPToken()(c)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("want 401, got %d", w.Code)
		}
		want := `Bearer resource_metadata="https://api.example.com/.well-known/oauth-protected-resource/mcp"`
		if got := w.Header().Get("WWW-Authenticate"); got != want {
			t.Errorf("WWW-Authenticate = %q, want %q", got, want)
		}
	})

	t.Run("malformed header (no Bearer prefix)", func(t *testing.T) {
		cleanupAll(ctx, t)
		c, w := newTestGinContext("GET", "/mcp", nil)
		c.Request.Header.Set("Authorization", "Token abc123")
		h.ValidateMCPToken()(c)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("want 401, got %d", w.Code)
		}
	})

	t.Run("token not in DB", func(t *testing.T) {
		cleanupAll(ctx, t)
		setConfig(t, func(c *server.Config) {
			c.AgentOrigin = "https://api.example.com"
		})
		c, w := newTestGinContext("POST", "/mcp", nil)
		c.Request.Header.Set("Authorization", "Bearer msr_doesnotexist")
		h.ValidateMCPToken()(c)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("want 401, got %d", w.Code)
		}
		want := `Bearer error="invalid_token", resource_metadata="https://api.example.com/.well-known/oauth-protected-resource/mcp"`
		if got := w.Header().Get("WWW-Authenticate"); got != want {
			t.Errorf("WWW-Authenticate = %q, want %q", got, want)
		}
	})

	t.Run("expired token", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "exp@mcp.test")
		rawToken := seedMCPSession(ctx, t, userID.String(), "client1", time.Now().Add(-1*time.Hour))

		c, w := newTestGinContext("GET", "/mcp", nil)
		c.Request.Header.Set("Authorization", "Bearer "+rawToken)
		h.ValidateMCPToken()(c)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("want 401, got %d", w.Code)
		}
	})

	t.Run("a dashboard token is not accepted", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "dashtoken@mcp.test")
		// The dashboard issues tokens on this key with no audience.
		dashboard, err := authsession.CreateAccessToken(deps.Config.AccessTokenSecret, uuid.New(), uuid.New(), userID, time.Now().Add(time.Hour), "")
		if err != nil {
			t.Fatal(err)
		}

		c, w := newTestGinContext("POST", "/mcp", nil)
		c.Request.Header.Set("Authorization", "Bearer "+dashboard)
		h.ValidateMCPToken()(c)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("want 401, got %d", w.Code)
		}
	})

	t.Run("tokens are refused while the signing secret is missing", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "nosecret@mcp.test")
		rawToken := seedMCPSession(ctx, t, userID.String(), "client1", time.Now().Add(time.Hour))

		setConfig(t, func(c *server.Config) { c.AccessTokenSecret = nil })

		c, w := newTestGinContext("POST", "/mcp", nil)
		c.Request.Header.Set("Authorization", "Bearer "+rawToken)
		h.ValidateMCPToken()(c)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("want 401, got %d", w.Code)
		}
	})

	t.Run("token signed with another secret", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "forged@mcp.test")
		forged, err := authsession.CreateAccessToken([]byte("not-our-secret"), uuid.New(), uuid.New(), userID, time.Now().Add(time.Hour), authsession.AudienceMCP)
		if err != nil {
			t.Fatal(err)
		}

		c, w := newTestGinContext("POST", "/mcp", nil)
		c.Request.Header.Set("Authorization", "Bearer "+forged)
		h.ValidateMCPToken()(c)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("want 401, got %d", w.Code)
		}
	})

	t.Run("session binding: ends the session when the provider token is rejected", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "sbrevoke@mcp.test")
		accessToken := seedMCPSessionWithProvider(ctx, t, userID.String(), "client1", time.Now().Add(time.Hour), "bad_github_token", "github")
		sessionID := sessionIDOf(t, accessToken)

		origFn := mcpValidateProviderTokenFn
		callCount := 0
		mcpValidateProviderTokenFn = func(provider, token, _, _ string) error {
			callCount++
			return fmt.Errorf("github rejected the token: %w", authsession.ErrProviderAccessRevoked)
		}
		t.Cleanup(func() { mcpValidateProviderTokenFn = origFn })

		ageProviderCheck(ctx, t, sessionID)

		w := refreshTestToken(seedMCPRefreshToken(t, sessionID, time.Now().Add(mcpRefreshTokenExpiry)), "client1")
		if w.Code != http.StatusBadRequest {
			t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
		}
		if callCount == 0 {
			t.Error("expected the provider token to be checked")
		}
		if getMCPSession(ctx, t, sessionID) != nil {
			t.Error("the session should be gone after a failed provider check")
		}
	})

	t.Run("session binding: carries a fresh check time when the provider token is good", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "sbvalid@mcp.test")
		accessToken := seedMCPSessionWithProvider(ctx, t, userID.String(), "client1", time.Now().Add(time.Hour), "good_github_token", "github")
		sessionID := sessionIDOf(t, accessToken)

		origFn := mcpValidateProviderTokenFn
		mcpValidateProviderTokenFn = func(provider, token, _, _ string) error { return nil }
		t.Cleanup(func() { mcpValidateProviderTokenFn = origFn })

		ageProviderCheck(ctx, t, sessionID)

		w := refreshTestToken(seedMCPRefreshToken(t, sessionID, time.Now().Add(mcpRefreshTokenExpiry)), "client1")
		if w.Code != http.StatusOK {
			t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
		}
		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		newAccess, _ := resp["access_token"].(string)

		newRow := getMCPSession(ctx, t, sessionIDOf(t, newAccess))
		if newRow == nil {
			t.Fatal("the refreshed session should exist")
		}
		if newRow.ProviderTokenCheckedAt == nil || time.Since(*newRow.ProviderTokenCheckedAt) > time.Minute {
			t.Errorf("provider_token_checked_at = %v, want just now", newRow.ProviderTokenCheckedAt)
		}
	})

	t.Run("session binding: keeps the session when the provider cannot be reached", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "sbdown@mcp.test")
		accessToken := seedMCPSessionWithProvider(ctx, t, userID.String(), "client1", time.Now().Add(time.Hour), "github_token", "github")
		sessionID := sessionIDOf(t, accessToken)

		origFn := mcpValidateProviderTokenFn
		mcpValidateProviderTokenFn = func(provider, token, _, _ string) error {
			return fmt.Errorf("github is having a bad day: HTTP 503")
		}
		t.Cleanup(func() { mcpValidateProviderTokenFn = origFn })

		ageProviderCheck(ctx, t, sessionID)

		w := refreshTestToken(seedMCPRefreshToken(t, sessionID, time.Now().Add(mcpRefreshTokenExpiry)), "client1")
		if w.Code != http.StatusOK {
			t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
		}
		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		newAccess, _ := resp["access_token"].(string)

		newRow := getMCPSession(ctx, t, sessionIDOf(t, newAccess))
		if newRow == nil {
			t.Fatal("the session should survive a provider outage")
		}
		if newRow.ProviderTokenCheckedAt == nil || time.Since(*newRow.ProviderTokenCheckedAt) < time.Hour {
			t.Error("the check time should be left alone so the next refresh retries")
		}
	})

	t.Run("session binding: skips the check when it ran recently", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "sbskip@mcp.test")
		accessToken := seedMCPSessionWithProvider(ctx, t, userID.String(), "client1", time.Now().Add(time.Hour), "still_valid_token", "github")
		sessionID := sessionIDOf(t, accessToken)

		origFn := mcpValidateProviderTokenFn
		callCount := 0
		mcpValidateProviderTokenFn = func(provider, token, _, _ string) error {
			callCount++
			return nil
		}
		t.Cleanup(func() { mcpValidateProviderTokenFn = origFn })

		// The seed already set provider_token_checked_at to the current time.
		w := refreshTestToken(seedMCPRefreshToken(t, sessionID, time.Now().Add(mcpRefreshTokenExpiry)), "client1")
		if w.Code != http.StatusOK {
			t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
		}
		if callCount != 0 {
			t.Errorf("expected no provider checks, got %d", callCount)
		}
	})

	t.Run("valid token sets userId", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "valid@mcp.test")
		rawToken := seedMCPSession(ctx, t, userID.String(), "client1", time.Now().Add(90*24*time.Hour))

		// Use a gin router so we can test the full middleware + next chain
		gin.SetMode(gin.TestMode)
		r := gin.New()
		var capturedUserID string
		r.GET("/mcp", h.ValidateMCPToken(), func(c *gin.Context) {
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

		if getMCPSession(ctx, t, sessionIDOf(t, rawToken)) == nil {
			t.Error("the token should still name a live session")
		}
	})
}

func TestMCPDiscover(t *testing.T) {
	ctx := context.Background()
	cleanupAll(ctx, t)

	userID := uuid.New()
	seedUser(ctx, t, userID.String(), "discover@mcp.test")
	rawToken := seedMCPSession(ctx, t, userID.String(), "client1", time.Now().Add(90*24*time.Hour))

	handler := buildMCPTestRouter()

	req := newMCPRequest(rawToken, "server/discover", "", mcpRequestBody(1, "server/discover", nil))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
	}

	resp := parseSSEData(t, w.Body.String())
	result, _ := resp["result"].(map[string]any)
	versions, _ := result["supportedVersions"].([]any)
	if !slices.Contains(versions, any("2026-07-28")) {
		t.Errorf("supportedVersions = %v, want to include 2026-07-28", versions)
	}
	meta, _ := result["_meta"].(map[string]any)
	serverInfo, _ := meta["io.modelcontextprotocol/serverInfo"].(map[string]any)
	if serverInfo["name"] != "Measure" {
		t.Errorf("serverInfo.name = %v, want Measure", serverInfo["name"])
	}
}

func TestMCPGetStream(t *testing.T) {
	ctx := context.Background()
	cleanupAll(ctx, t)
	setConfig(t, func(c *server.Config) {
		c.AgentOrigin = "https://api.example.com"
	})

	userID := uuid.New()
	seedUser(ctx, t, userID.String(), "getstream@mcp.test")
	rawToken := seedMCPSession(ctx, t, userID.String(), "client1", time.Now().Add(time.Hour))

	handler := buildMCPTestRouter()

	req := httptest.NewRequest("GET", "/mcp", nil)
	req.Header.Set("Authorization", "Bearer "+rawToken)
	req.Header.Set("Accept", "text/event-stream")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("authenticated GET: want 405, got %d: %s", w.Code, w.Body.String())
	}

	req = httptest.NewRequest("GET", "/mcp", nil)
	req.Header.Set("Accept", "text/event-stream")
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized || !strings.Contains(w.Header().Get("WWW-Authenticate"), "resource_metadata=") {
		t.Errorf("unauthenticated GET: want 401 with a bearer challenge, got %d %q", w.Code, w.Header().Get("WWW-Authenticate"))
	}

	req = httptest.NewRequest("DELETE", "/mcp", nil)
	req.Header.Set("Authorization", "Bearer "+rawToken)
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("authenticated DELETE: want 405, got %d: %s", w.Code, w.Body.String())
	}
}

// TestMCPLegacyProtocol pins the initialize-based flow that clients on
// protocol revisions before 2026-07-28 still use.
func TestMCPLegacyProtocol(t *testing.T) {
	ctx := context.Background()
	cleanupAll(ctx, t)

	userID := uuid.New()
	seedUser(ctx, t, userID.String(), "legacy@mcp.test")
	rawToken := seedMCPSession(ctx, t, userID.String(), "client1", time.Now().Add(time.Hour))

	handler := buildMCPTestRouter()
	send := func(version, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest("POST", "/mcp", strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+rawToken)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "application/json, text/event-stream")
		if version != "" {
			req.Header.Set("Mcp-Protocol-Version", version)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		return w
	}

	w := send("", `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}`)
	if w.Code != http.StatusOK {
		t.Fatalf("initialize at 2024-11-05: want 200, got %d: %s", w.Code, w.Body.String())
	}
	result, _ := parseSSEData(t, w.Body.String())["result"].(map[string]any)
	serverInfo, _ := result["serverInfo"].(map[string]any)
	if serverInfo["name"] != "Measure" {
		t.Errorf("serverInfo.name = %v, want Measure", serverInfo["name"])
	}

	w = send("2025-06-18", `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_apps","arguments":{}}}`)
	if w.Code != http.StatusOK {
		t.Fatalf("tools/call at 2025-06-18: want 200, got %d: %s", w.Code, w.Body.String())
	}
	if isToolError(parseSSEData(t, w.Body.String())) {
		t.Errorf("tools/call at 2025-06-18 should succeed: %s", w.Body.String())
	}
}

func TestMCPToolsList(t *testing.T) {
	ctx := context.Background()
	cleanupAll(ctx, t)

	userID := uuid.New()
	seedUser(ctx, t, userID.String(), "tools@mcp.test")
	rawToken := seedMCPSession(ctx, t, userID.String(), "client1", time.Now().Add(90*24*time.Hour))

	handler := buildMCPTestRouter()

	req := newMCPRequest(rawToken, "tools/list", "", mcpRequestBody(2, "tools/list", nil))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
	}

	resp := parseSSEData(t, w.Body.String())
	result, _ := resp["result"].(map[string]any)
	tools, _ := result["tools"].([]any)

	toolNames := make(map[string]bool)
	toolSchemas := make(map[string]map[string]any)
	for _, tool := range tools {
		tm, _ := tool.(map[string]any)
		name, _ := tm["name"].(string)
		toolNames[name] = true
		if schema, ok := tm["inputSchema"].(map[string]any); ok {
			toolSchemas[name] = schema
		}
	}

	expectedTools := []string{
		"list_apps", "get_filter_keys", "get_filter_values", "get_metrics",
		"get_app_health_over_time",
		"get_errors", "get_error",
		"get_errors_over_time", "get_error_over_time", "get_error_distribution",
		"get_error_common_path",
		"get_sessions", "get_sessions_over_time", "get_session",
		"get_bug_reports", "get_bug_reports_over_time", "get_bug_report",
		"update_bug_report_status",
		"get_root_span_names", "get_span_instances", "get_span_metrics_over_time",
		"get_trace", "get_alerts", "get_journey",
		"get_network_metrics_trends",
		"get_network_status_codes_over_time",
		"get_network_endpoint_status_codes_over_time",
		"get_network_latency_over_time",
		"get_network_timeline",
		"ask_question",
	}
	for _, expected := range expectedTools {
		if !toolNames[expected] {
			t.Errorf("tool %q not found in tools/list response", expected)
		}
	}
	if len(tools) != len(expectedTools) {
		t.Errorf("want %d tools, got %d", len(expectedTools), len(tools))
	}
	if toolNames["get_network_endpoints"] {
		t.Error("get_network_endpoints should not be exposed over MCP")
	}
	for _, name := range []string{
		"get_network_status_codes_over_time",
		"get_network_latency_over_time",
		"get_network_timeline",
	} {
		schema := toolSchemas[name]
		required, _ := schema["required"].([]any)
		for _, field := range required {
			if field == "domain" || field == "path" {
				t.Errorf("tool %q advertises optional field %q as required", name, field)
			}
		}
	}
}

// TestMCPAskQuestionAgentDisabled checks that with the agent disabled,
// ask_question returns the unavailability notice while the plain data tools
// keep working.
func TestMCPAskQuestionAgentDisabled(t *testing.T) {
	ctx := context.Background()
	cleanupAll(ctx, t)

	userID := uuid.New()
	seedUser(ctx, t, userID.String(), "agentoff@mcp.test")
	rawToken := seedMCPSession(ctx, t, userID.String(), "client1", time.Now().Add(90*24*time.Hour))

	setConfig(t, func(c *server.Config) {
		c.AgentEnabled = false
	})

	resp := callMCPTool(t, rawToken, "ask_question", map[string]any{
		"app_ids":  []string{uuid.New().String()},
		"question": "how is the app?",
	})
	if text := extractTextContent(t, resp); text != agent.UnavailableReply {
		t.Errorf("ask_question text = %q, want %q", text, agent.UnavailableReply)
	}

	// A data tool is not agent-dependent: list_apps still answers normally.
	resp = callMCPTool(t, rawToken, "list_apps", nil)
	content := extractTextContent(t, resp)
	if content == agent.UnavailableReply {
		t.Fatalf("list_apps returned the unavailability notice, want a normal answer")
	}
	var apps []any
	if err := json.Unmarshal([]byte(content), &apps); err != nil {
		t.Errorf("list_apps content = %q, want a JSON app list: %v", content, err)
	}
}

func TestMCPListApps(t *testing.T) {
	ctx := context.Background()

	t.Run("user with no teams returns empty array", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "noapps@mcp.test")
		rawToken := seedMCPSession(ctx, t, userID.String(), "client1", time.Now().Add(90*24*time.Hour))

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
		seedTeam(ctx, t, teamID, "twoapps team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")

		app1ID := uuid.New()
		app2ID := uuid.New()
		seedApp(ctx, t, app1ID, teamID, 30)
		seedApp(ctx, t, app2ID, teamID, 30)

		rawToken := seedMCPSession(ctx, t, userID.String(), "client1", time.Now().Add(90*24*time.Hour))

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
			// The team fields tell a multi-team caller which apps may go into
			// one ask_question call together.
			if app["team_id"] != teamID.String() {
				t.Errorf("app team_id = %v, want %s", app["team_id"], teamID)
			}
			if app["team_name"] != "twoapps team" {
				t.Errorf("app team_name = %v, want twoapps team", app["team_name"])
			}
		}
	})

	t.Run("user only sees own teams apps", func(t *testing.T) {
		cleanupAll(ctx, t)

		// user A with one app
		userA := uuid.New()
		seedUser(ctx, t, userA.String(), "usera@mcp.test")
		teamA := uuid.New()
		seedTeam(ctx, t, teamA, "team A")
		seedTeamMembership(ctx, t, teamA, userA.String(), "owner")
		appA := uuid.New()
		seedApp(ctx, t, appA, teamA, 30)

		// user B with a different app
		userB := uuid.New()
		seedUser(ctx, t, userB.String(), "userb@mcp.test")
		teamB := uuid.New()
		seedTeam(ctx, t, teamB, "team B")
		seedTeamMembership(ctx, t, teamB, userB.String(), "owner")
		appB := uuid.New()
		seedApp(ctx, t, appB, teamB, 30)

		rawToken := seedMCPSession(ctx, t, userA.String(), "client1", time.Now().Add(90*24*time.Hour))

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
		seedTeam(ctx, t, team1, "team 1")
		seedTeamMembership(ctx, t, team1, userID.String(), "owner")
		app1a := uuid.New()
		app1b := uuid.New()
		seedApp(ctx, t, app1a, team1, 30)
		seedApp(ctx, t, app1b, team1, 30)

		// Team 2 with 1 app
		team2 := uuid.New()
		seedTeam(ctx, t, team2, "team 2")
		seedTeamMembership(ctx, t, team2, userID.String(), "developer")
		app2 := uuid.New()
		seedApp(ctx, t, app2, team2, 30)

		rawToken := seedMCPSession(ctx, t, userID.String(), "client1", time.Now().Add(90*24*time.Hour))

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

func TestMCPGetAppHealthOverTime(t *testing.T) {
	ctx := context.Background()

	t.Run("missing timezone", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "healthnotz@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "healthnotz team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		resp := callMCPTool(t, rawToken, "get_app_health_over_time", map[string]any{"app_id": appID.String()})
		if !isToolError(resp) {
			t.Error("want tool error for missing timezone")
		}
	})

	t.Run("missing app_id", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "healthnoapp@mcp.test")
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(time.Hour))

		resp := callMCPTool(t, rawToken, "get_app_health_over_time", map[string]any{"timezone": "UTC"})
		if !isToolError(resp) {
			t.Error("want tool error for missing app_id")
		}
	})

	t.Run("valid call with seeded data", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "health@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "health team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		now := time.Now().UTC()
		ts := now.Add(-1 * time.Hour)
		// 5 plain sessions, 2 crash sessions (legacy fatal), 1 ANR session.
		seedAppMetrics(ctx, t, teamID.String(), appID.String(), ts, 5, 2, 1)

		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		resp := callMCPTool(t, rawToken, "get_app_health_over_time", map[string]any{
			"app_id":      appID.String(),
			"timezone":    "UTC",
			"filter_expr": "version_name:in:v1 AND version_code:in:1",
			"from":        now.Add(-7 * 24 * time.Hour).Format(time.RFC3339),
			"to":          now.Format(time.RFC3339),
		})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}

		content := extractTextContent(t, resp)
		var result map[string][]struct {
			DateTime  string `json:"datetime"`
			Instances uint64 `json:"instances"`
		}
		if err := json.Unmarshal([]byte(content), &result); err != nil {
			t.Fatalf("response is not the expected JSON object: %v\ncontent: %s", err, content)
		}

		sumInstances := func(series string) uint64 {
			var total uint64
			for _, pt := range result[series] {
				total += pt.Instances
			}
			return total
		}

		for _, series := range []string{"sessions", "crashes", "anrs"} {
			if _, ok := result[series]; !ok {
				t.Errorf("response missing %q series", series)
			}
		}
		if got := sumInstances("sessions"); got != 8 {
			t.Errorf("sessions = %d, want 8 (5 generic + 2 crash + 1 anr)", got)
		}
		if got := sumInstances("crashes"); got != 2 {
			t.Errorf("crashes = %d, want 2", got)
		}
		if got := sumInstances("anrs"); got != 1 {
			t.Errorf("anrs = %d, want 1", got)
		}
	})

	t.Run("invalid filter_expr returns the issue", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "healthbadexpr@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "healthbadexpr team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(time.Hour))

		resp := callMCPTool(t, rawToken, "get_app_health_over_time", map[string]any{
			"app_id":      appID.String(),
			"timezone":    "UTC",
			"filter_expr": "os_name:in:android",
		})
		if !isToolError(resp) {
			t.Fatal("want tool error for a key the entity does not have")
		}
		if text := extractTextContent(t, resp); !strings.Contains(text, "filter_expr is invalid") || !strings.Contains(text, "os_name") {
			t.Errorf("error text %q should name the unknown key", text)
		}
	})

	t.Run("a filter expression narrows the series", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "healthnarrow@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "healthnarrow team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		now := time.Now().UTC()
		// The seed helpers tag every event with app_version v1 / build 1.
		seedAppMetrics(ctx, t, teamID.String(), appID.String(), now.Add(-time.Hour), 5, 2, 1)

		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		resp := callMCPTool(t, rawToken, "get_app_health_over_time", map[string]any{
			"app_id":      appID.String(),
			"timezone":    "UTC",
			"filter_expr": "version_name:in:v2 AND version_code:in:2",
			"from":        now.Add(-7 * 24 * time.Hour).Format(time.RFC3339),
			"to":          now.Format(time.RFC3339),
		})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}

		content := extractTextContent(t, resp)
		var result map[string][]struct {
			Instances uint64 `json:"instances"`
		}
		if err := json.Unmarshal([]byte(content), &result); err != nil {
			t.Fatalf("response is not the expected JSON object: %v\ncontent: %s", err, content)
		}
		for _, series := range []string{"sessions", "crashes", "anrs"} {
			if len(result[series]) != 0 {
				t.Errorf("%s = %v, want nothing for an unseeded version", series, result[series])
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
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(time.Hour))

		resp := callMCPTool(t, rawToken, "get_errors", map[string]any{})
		if !isToolError(resp) {
			t.Error("want tool error for missing app_id")
		}
	})

	t.Run("invalid filter_expr returns the issue", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "u2@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "badtype team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(time.Hour))

		resp := callMCPTool(t, rawToken, "get_errors", map[string]any{
			"filter_expr": "bogus_key:in:x",
			"app_id":      appID.String(),
		})
		if !isToolError(resp) {
			t.Fatal("want tool error for unknown filter key")
		}
		if text := extractTextContent(t, resp); !strings.Contains(text, "filter_expr is invalid") || !strings.Contains(text, "bogus_key") {
			t.Errorf("error text %q should name the unknown key", text)
		}
	})

	t.Run("an error type the key does not offer is refused", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "u3@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "badsev team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(time.Hour))

		resp := callMCPTool(t, rawToken, "get_errors", map[string]any{
			"filter_expr": "error_type:in:crash",
			"app_id":      appID.String(),
		})
		if !isToolError(resp) {
			t.Error("want tool error for an unknown error type")
		}
	})

	t.Run("valid crash call with seeded data", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "crash@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "crash team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		// exception.fingerprint is FixedString(32); a shorter value is padded
		// and never matches its group row.
		fingerprint := "0000000000000000000000000000f001"
		th.SeedFatalExceptionGroupWithCustomFlag(ctx, t, teamID.String(), appID.String(), fingerprint, false)
		th.SeedIssueEventWithSeverity(ctx, t, teamID.String(), appID.String(), fingerprint, "fatal", time.Now().Add(-1*time.Hour))

		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		now := time.Now().UTC()
		from := now.Add(-7 * 24 * time.Hour)
		resp := callMCPTool(t, rawToken, "get_errors", map[string]any{
			"filter_expr": `error_type:in:[Crash]`,
			"app_id":      appID.String(),
			"from":        from.Format(time.RFC3339),
			"to":          now.Add(time.Hour).Format(time.RFC3339),
		})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		content := extractTextContent(t, resp)
		var groups []map[string]any
		if err := json.Unmarshal([]byte(content), &groups); err != nil {
			t.Fatalf("response is not JSON array: %v\ncontent: %s", err, content)
		}
		if len(groups) != 1 || groups[0]["id"] != fingerprint {
			t.Fatalf("want only the crash group %q, got %s", fingerprint, content)
		}
		for _, field := range []string{"users", "sessions", "last_seen"} {
			if _, ok := groups[0][field]; !ok {
				t.Errorf("group is missing %q: %s", field, content)
			}
		}
		for _, field := range []string{"trend", "percentage_contribution"} {
			if _, ok := groups[0][field]; ok {
				t.Errorf("group has %q: %s", field, content)
			}
		}

		resp = callMCPTool(t, rawToken, "get_errors", map[string]any{
			"app_id":        appID.String(),
			"from":          from.Format(time.RFC3339),
			"to":            now.Add(time.Hour).Format(time.RFC3339),
			"include_trend": true,
		})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		content = extractTextContent(t, resp)
		var withTrend []struct {
			Count uint64 `json:"count"`
			Trend []struct {
				Instances uint64 `json:"instances"`
			} `json:"trend"`
		}
		if err := json.Unmarshal([]byte(content), &withTrend); err != nil {
			t.Fatalf("response is not JSON array: %v\ncontent: %s", err, content)
		}
		if len(withTrend) != 1 {
			t.Fatalf("want the crash group, got %s", content)
		}
		var total uint64
		for _, point := range withTrend[0].Trend {
			total += point.Instances
		}
		if total != withTrend[0].Count {
			t.Errorf("trend total = %d, want the count %d: %s", total, withTrend[0].Count, content)
		}
	})

	t.Run("limit 0 defaults to 10", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "errlim0@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "errlim0 team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_errors", map[string]any{
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
		seedTeam(ctx, t, teamID, "errlimmax team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_errors", map[string]any{
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
		seedTeam(ctx, t, teamID, "anr team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_errors", map[string]any{
			"filter_expr": `error_type:in:[ANR]`,
			"app_id":      appID.String(),
			"from":        now.Add(-7 * 24 * time.Hour).Format(time.RFC3339),
			"to":          now.Format(time.RFC3339),
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

	t.Run("missing error_group_id", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "u@mcp.test")
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(time.Hour))

		resp := callMCPTool(t, rawToken, "get_error", map[string]any{
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
		seedTeam(ctx, t, teamID, "det team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		fingerprint := "fp-detail-1"
		th.SeedFatalExceptionGroupWithCustomFlag(ctx, t, teamID.String(), appID.String(), fingerprint, false)

		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_error", map[string]any{
			"app_id":         appID.String(),
			"error_group_id": fingerprint,
			"from":           now.Add(-7 * 24 * time.Hour).Format(time.RFC3339),
			"to":             now.Format(time.RFC3339),
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

	t.Run("error_type is not a key of one group's events", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "dettype@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "dettype team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		resp := callMCPTool(t, rawToken, "get_error", map[string]any{
			"app_id":         appID.String(),
			"error_group_id": "fp-detail-type",
			"filter_expr":    `error_type:in:[ANR]`,
		})
		if !isToolError(resp) {
			t.Fatal("want tool error for an error_type condition on one group's events")
		}
		if content := extractTextContent(t, resp); !strings.Contains(content, "error_type") {
			t.Errorf("want the unknown key named, got %s", content)
		}
	})

	t.Run("limit 0 defaults to 1", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "detlim0@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "detlim0 team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_error", map[string]any{
			"app_id":         appID.String(),
			"error_group_id": "fp-detail-2",
			"limit":          0,
			"from":           now.Add(-7 * 24 * time.Hour).Format(time.RFC3339),
			"to":             now.Format(time.RFC3339),
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
		seedTeam(ctx, t, teamID, "detlimmax team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_error", map[string]any{
			"app_id":         appID.String(),
			"error_group_id": "fp-detail-3",
			"limit":          500,
			"from":           now.Add(-7 * 24 * time.Hour).Format(time.RFC3339),
			"to":             now.Format(time.RFC3339),
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
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(time.Hour))

		resp := callMCPTool(t, rawToken, "get_error", map[string]any{
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
		seedTeam(ctx, t, teamID, "anrdet team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		fingerprint := "fp-anr-detail-1"
		th.SeedAnrGroup(ctx, t, teamID.String(), appID.String(), fingerprint)

		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_error", map[string]any{
			"app_id":         appID.String(),
			"error_group_id": fingerprint,
			"from":           now.Add(-7 * 24 * time.Hour).Format(time.RFC3339),
			"to":             now.Format(time.RFC3339),
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

func TestMCPGetFilterKeys(t *testing.T) {
	ctx := context.Background()
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, rawToken
	}

	t.Run("unknown entity", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "fkeys1@mcp.test")
		resp := callMCPTool(t, rawToken, "get_filter_keys", map[string]any{"app_id": appID.String(), "entity": "bogus"})
		if !isToolError(resp) {
			t.Fatal("want tool error for unknown entity")
		}
		if text := extractTextContent(t, resp); !strings.Contains(text, "bogus") {
			t.Errorf("error text %q should name the unknown entity", text)
		}
	})
	t.Run("spans keys", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "fkeys2@mcp.test")
		resp := callMCPTool(t, rawToken, "get_filter_keys", map[string]any{"app_id": appID.String(), "entity": "spans"})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}

		var result struct {
			Keys []struct {
				Name                string   `json:"name"`
				Label               string   `json:"label"`
				KeyGroup            string   `json:"key_group"`
				ValueType           string   `json:"value_type"`
				Operators           []string `json:"operators"`
				ValueSuggestionMode string   `json:"value_suggestion_mode"`
			} `json:"keys"`
			KeyGroups []string `json:"key_groups"`
		}
		if err := json.Unmarshal([]byte(extractTextContent(t, resp)), &result); err != nil {
			t.Fatalf("parse filter keys response: %v", err)
		}

		keysByName := make(map[string]bool)
		for _, key := range result.Keys {
			keysByName[key.Name] = true
			if key.Label == "" || key.KeyGroup == "" || key.ValueType == "" || len(key.Operators) == 0 || key.ValueSuggestionMode == "" {
				t.Errorf("key %q is missing fields: %+v", key.Name, key)
			}
		}
		for _, want := range []string{"version_name", "version_code", "patch_version", "patch_id", "span_status", "os_name", "country"} {
			if !keysByName[want] {
				t.Errorf("spans keys missing %q", want)
			}
		}
		if len(result.KeyGroups) == 0 {
			t.Error("want non-empty key_groups")
		}
	})
	t.Run("bug_reports keys", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "fkeysbr@mcp.test")
		resp := callMCPTool(t, rawToken, "get_filter_keys", map[string]any{"app_id": appID.String(), "entity": "bug_reports"})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}

		var result struct {
			Keys []struct {
				Name string `json:"name"`
			} `json:"keys"`
			KeyGroups []string `json:"key_groups"`
		}
		if err := json.Unmarshal([]byte(extractTextContent(t, resp)), &result); err != nil {
			t.Fatalf("parse filter keys response: %v", err)
		}

		keysByName := make(map[string]bool)
		for _, key := range result.Keys {
			keysByName[key.Name] = true
		}
		for _, want := range []string{"version_name", "version_code", "patch_version", "patch_id", "bug_report_status", "user_id", "bug_report_description", "session_id", "os_name", "country"} {
			if !keysByName[want] {
				t.Errorf("bug_reports keys missing %q", want)
			}
		}
		if len(result.KeyGroups) == 0 {
			t.Error("want non-empty key_groups")
		}
	})
	t.Run("a user-defined attribute joins the spans keys", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "fkeys3@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "fkeys3 team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		seedSpanUDAttr(ctx, t, teamID.String(), appID.String(), testinfra.SpanUDAttrRow{Key: "plan", Value: "pro"})

		resp := callMCPTool(t, rawToken, "get_filter_keys", map[string]any{"app_id": appID.String(), "entity": "spans"})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}

		var result struct {
			Keys []struct {
				Name     string `json:"name"`
				Label    string `json:"label"`
				KeyGroup string `json:"key_group"`
			} `json:"keys"`
			KeyGroups     []string `json:"key_groups"`
			KeysTruncated bool     `json:"keys_truncated"`
		}
		if err := json.Unmarshal([]byte(extractTextContent(t, resp)), &result); err != nil {
			t.Fatalf("parse filter keys response: %v", err)
		}

		found := false
		for _, key := range result.Keys {
			if key.Name == "custom.plan" {
				found = true
				if key.Label != "plan" || key.KeyGroup != "Custom" {
					t.Errorf("want the label unprefixed under the Custom group, got %+v", key)
				}
			}
		}
		if !found {
			t.Error("want the seeded attribute listed as custom.plan")
		}
		if !slices.Contains(result.KeyGroups, "Custom") {
			t.Errorf("want the Custom group listed, got %v", result.KeyGroups)
		}
		if result.KeysTruncated {
			t.Error("want the listing complete for one attribute")
		}
	})
	t.Run("a key requested through the keys input is included", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "fkeys4@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "fkeys4 team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		seedSpanUDAttr(ctx, t, teamID.String(), appID.String(), testinfra.SpanUDAttrRow{Key: "plan", Value: "pro"})

		resp := callMCPTool(t, rawToken, "get_filter_keys", map[string]any{
			"app_id": appID.String(),
			"entity": "spans",
			"keys":   []string{"custom.plan", "custom.ghost"},
		})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}

		var result struct {
			Keys []struct {
				Name string `json:"name"`
			} `json:"keys"`
		}
		if err := json.Unmarshal([]byte(extractTextContent(t, resp)), &result); err != nil {
			t.Fatalf("parse filter keys response: %v", err)
		}

		planCount := 0
		ghostFound := false
		for _, key := range result.Keys {
			if key.Name == "custom.plan" {
				planCount++
			}
			if key.Name == "custom.ghost" {
				ghostFound = true
			}
		}
		if planCount != 1 {
			t.Errorf("want custom.plan once, got it %d times", planCount)
		}
		if ghostFound {
			t.Error("want a name the app never reported left out")
		}
	})
}

func TestMCPGetFilterValues(t *testing.T) {
	ctx := context.Background()
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, teamID, rawToken
	}
	now := time.Now().UTC()

	valueTexts := func(t *testing.T, resp map[string]any) []string {
		t.Helper()
		var result struct {
			Values []struct {
				Text string `json:"text"`
			} `json:"values"`
			Truncated bool `json:"truncated"`
		}
		if err := json.Unmarshal([]byte(extractTextContent(t, resp)), &result); err != nil {
			t.Fatalf("parse filter values response: %v", err)
		}
		texts := make([]string, len(result.Values))
		for i, value := range result.Values {
			texts[i] = value.Text
		}
		return texts
	}

	t.Run("missing key_name", func(t *testing.T) {
		appID, _, rawToken := setupToolTest(t, "fvals1@mcp.test")
		resp := callMCPTool(t, rawToken, "get_filter_values", map[string]any{"app_id": appID.String(), "entity": "spans"})
		if !isToolError(resp) {
			t.Error("want tool error for missing key_name")
		}
	})
	t.Run("unknown key", func(t *testing.T) {
		appID, _, rawToken := setupToolTest(t, "fvals2@mcp.test")
		resp := callMCPTool(t, rawToken, "get_filter_values", map[string]any{"app_id": appID.String(), "entity": "spans", "key_name": "bogus_key"})
		if !isToolError(resp) {
			t.Fatal("want tool error for unknown key")
		}
		if text := extractTextContent(t, resp); !strings.Contains(text, "bogus_key") {
			t.Errorf("error text %q should name the unknown key", text)
		}
	})
	t.Run("seeded span values", func(t *testing.T) {
		appID, teamID, rawToken := setupToolTest(t, "fvals3@mcp.test")
		// The span_filters rollup serving these values keeps only spans
		// carrying every attribute, so the seeds set them all.
		th.SeedSpanRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.SpanRow{
			SpanName: "checkout", Status: 1, StartTime: now.Add(-2 * time.Hour),
			AppVersion: "v1", AppBuild: "1",
			CountryCode: "US", NetworkProvider: "T-Mobile", NetworkType: "wifi",
			NetworkGeneration: "5g", DeviceLocale: "en-US",
			DeviceManufacturer: "Google", DeviceName: "pixel 4a",
		})
		th.SeedSpanRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.SpanRow{
			SpanName: "checkout", Status: 1, StartTime: now.Add(-time.Hour),
			AppVersion: "v2", AppBuild: "2",
			CountryCode: "US", NetworkProvider: "T-Mobile", NetworkType: "wifi",
			NetworkGeneration: "5g", DeviceLocale: "en-US",
			DeviceManufacturer: "Google", DeviceName: "pixel 4a",
		})

		resp := callMCPTool(t, rawToken, "get_filter_values", map[string]any{"app_id": appID.String(), "entity": "spans", "key_name": "version_name"})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		texts := valueTexts(t, resp)
		if !reflect.DeepEqual(texts, []string{"v2", "v1"}) {
			t.Errorf("want versions [v2 v1], got %v", texts)
		}
	})
	t.Run("search narrows values", func(t *testing.T) {
		appID, teamID, rawToken := setupToolTest(t, "fvals4@mcp.test")
		th.SeedSpanRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.SpanRow{
			SpanName: "checkout", Status: 1, StartTime: now.Add(-2 * time.Hour),
			AppVersion: "1.2.0", AppBuild: "1",
			CountryCode: "US", NetworkProvider: "T-Mobile", NetworkType: "wifi",
			NetworkGeneration: "5g", DeviceLocale: "en-US",
			DeviceManufacturer: "Google", DeviceName: "pixel 4a",
		})
		th.SeedSpanRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.SpanRow{
			SpanName: "checkout", Status: 1, StartTime: now.Add(-time.Hour),
			AppVersion: "2.0.0", AppBuild: "2",
			CountryCode: "US", NetworkProvider: "T-Mobile", NetworkType: "wifi",
			NetworkGeneration: "5g", DeviceLocale: "en-US",
			DeviceManufacturer: "Google", DeviceName: "pixel 4a",
		})

		resp := callMCPTool(t, rawToken, "get_filter_values", map[string]any{"app_id": appID.String(), "entity": "spans", "key_name": "version_name", "search": "1.2"})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		texts := valueTexts(t, resp)
		if !reflect.DeepEqual(texts, []string{"1.2.0"}) {
			t.Errorf("want [1.2.0], got %v", texts)
		}
	})
	t.Run("enum key lists its full set", func(t *testing.T) {
		appID, _, rawToken := setupToolTest(t, "fvals5@mcp.test")
		resp := callMCPTool(t, rawToken, "get_filter_values", map[string]any{"app_id": appID.String(), "entity": "spans", "key_name": "span_status"})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		texts := valueTexts(t, resp)
		if !reflect.DeepEqual(texts, []string{"unset", "ok", "error"}) {
			t.Errorf("want [unset ok error], got %v", texts)
		}
	})
	t.Run("bug report status enum lists its full set", func(t *testing.T) {
		appID, _, rawToken := setupToolTest(t, "fvalsbr@mcp.test")
		resp := callMCPTool(t, rawToken, "get_filter_values", map[string]any{"app_id": appID.String(), "entity": "bug_reports", "key_name": "bug_report_status"})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		texts := valueTexts(t, resp)
		if !reflect.DeepEqual(texts, []string{"open", "closed"}) {
			t.Errorf("want [open closed], got %v", texts)
		}
	})
	t.Run("limit above the maximum", func(t *testing.T) {
		appID, _, rawToken := setupToolTest(t, "fvals6@mcp.test")
		resp := callMCPTool(t, rawToken, "get_filter_values", map[string]any{"app_id": appID.String(), "entity": "spans", "key_name": "version_name", "limit": 1000})
		if !isToolError(resp) {
			t.Error("want tool error for limit above the maximum")
		}
	})
	t.Run("a user-defined attribute serves its values", func(t *testing.T) {
		appID, teamID, rawToken := setupToolTest(t, "fvals7@mcp.test")
		seedSpanUDAttr(ctx, t, teamID.String(), appID.String(), testinfra.SpanUDAttrRow{Key: "plan", Value: "free", Timestamp: now.Add(-2 * time.Hour)})
		seedSpanUDAttr(ctx, t, teamID.String(), appID.String(), testinfra.SpanUDAttrRow{Key: "plan", Value: "pro", Timestamp: now.Add(-time.Hour)})

		resp := callMCPTool(t, rawToken, "get_filter_values", map[string]any{"app_id": appID.String(), "entity": "spans", "key_name": "custom.plan"})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		texts := valueTexts(t, resp)
		if !reflect.DeepEqual(texts, []string{"pro", "free"}) {
			t.Errorf("want [pro free] most recent first, got %v", texts)
		}
	})
	t.Run("an unknown user-defined attribute", func(t *testing.T) {
		appID, _, rawToken := setupToolTest(t, "fvals8@mcp.test")
		resp := callMCPTool(t, rawToken, "get_filter_values", map[string]any{"app_id": appID.String(), "entity": "spans", "key_name": "custom.nope"})
		if !isToolError(resp) {
			t.Fatal("want tool error for an attribute the app's spans never reported")
		}
		if text := extractTextContent(t, resp); !strings.Contains(text, "custom.nope") {
			t.Errorf("error text %q should name the unknown key", text)
		}
	})
}

func TestMCPGetMetrics(t *testing.T) {
	ctx := context.Background()

	setupMetricsApp := func(t *testing.T, email string) (uuid.UUID, uuid.UUID, string) {
		t.Helper()
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		token := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(time.Hour))
		return teamID, appID, token
	}

	t.Run("missing app_id", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "metrics@mcp.test")
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(time.Hour))

		resp := callMCPTool(t, rawToken, "get_metrics", nil)
		if !isToolError(resp) {
			t.Error("want tool error for missing app_id")
		}
	})

	t.Run("malformed from date", func(t *testing.T) {
		_, appID, rawToken := setupMetricsApp(t, "metbad@mcp.test")

		resp := callMCPTool(t, rawToken, "get_metrics", map[string]any{
			"app_id": appID.String(),
			"from":   "not-a-date",
		})
		if !isToolError(resp) {
			t.Error("want tool error for malformed from date")
		}
	})

	t.Run("malformed to date", func(t *testing.T) {
		_, appID, rawToken := setupMetricsApp(t, "metbad2@mcp.test")

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

	t.Run("invalid filter_expr returns the issue", func(t *testing.T) {
		_, appID, rawToken := setupMetricsApp(t, "metbadexpr@mcp.test")

		resp := callMCPTool(t, rawToken, "get_metrics", map[string]any{
			"app_id":      appID.String(),
			"filter_expr": "os_name:in:android",
		})
		if !isToolError(resp) {
			t.Fatal("want tool error for a key the entity does not have")
		}
		if text := extractTextContent(t, resp); !strings.Contains(text, "filter_expr is invalid") || !strings.Contains(text, "os_name") {
			t.Errorf("error text %q should name the unknown key", text)
		}
	})

	t.Run("no filter expression covers every version", func(t *testing.T) {
		teamID, appID, rawToken := setupMetricsApp(t, "metall@mcp.test")

		now := time.Now().UTC()
		ts := now.Add(-time.Hour)
		seedEventRows(ctx, t, teamID.String(), appID.String(), 3, testinfra.EventRow{AppVersion: "v1", AppBuild: "1", Timestamp: ts})
		seedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{AppVersion: "v2", AppBuild: "2", Timestamp: ts})

		resp := callMCPTool(t, rawToken, "get_metrics", map[string]any{
			"app_id": appID.String(),
			"from":   now.Add(-7 * 24 * time.Hour).Format(time.RFC3339),
			"to":     now.Format(time.RFC3339),
		})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}

		var result struct {
			Adoption struct {
				AllVersions     uint64  `json:"all_versions"`
				SelectedVersion uint64  `json:"selected_version"`
				Adoption        float64 `json:"adoption"`
			} `json:"adoption"`
			Sizes struct {
				MultipleVersions bool `json:"multiple_versions"`
			} `json:"sizes"`
		}
		content := extractTextContent(t, resp)
		if err := json.Unmarshal([]byte(content), &result); err != nil {
			t.Fatalf("response is not JSON object: %v\ncontent: %s", err, content)
		}
		if result.Adoption.SelectedVersion != 4 || result.Adoption.AllVersions != 4 || result.Adoption.Adoption != 100 {
			t.Errorf("adoption = %+v, want 4 of 4 at 100%%", result.Adoption)
		}
		if !result.Sizes.MultipleVersions {
			t.Errorf("sizes = %+v, want multiple versions without a filter expression", result.Sizes)
		}
	})

	t.Run("a filter expression narrows the metrics", func(t *testing.T) {
		teamID, appID, rawToken := setupMetricsApp(t, "metnarrow@mcp.test")

		now := time.Now().UTC()
		ts := now.Add(-time.Hour)
		seedEventRows(ctx, t, teamID.String(), appID.String(), 3, testinfra.EventRow{AppVersion: "v1", AppBuild: "1", Timestamp: ts})
		seedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{AppVersion: "v2", AppBuild: "2", Timestamp: ts})

		resp := callMCPTool(t, rawToken, "get_metrics", map[string]any{
			"app_id":      appID.String(),
			"filter_expr": "version_name:in:v1 AND version_code:in:1",
			"from":        now.Add(-7 * 24 * time.Hour).Format(time.RFC3339),
			"to":          now.Format(time.RFC3339),
		})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}

		var result struct {
			Adoption struct {
				AllVersions     uint64  `json:"all_versions"`
				SelectedVersion uint64  `json:"selected_version"`
				Adoption        float64 `json:"adoption"`
			} `json:"adoption"`
		}
		content := extractTextContent(t, resp)
		if err := json.Unmarshal([]byte(content), &result); err != nil {
			t.Fatalf("response is not JSON object: %v\ncontent: %s", err, content)
		}
		if result.Adoption.SelectedVersion != 3 || result.Adoption.AllVersions != 4 || result.Adoption.Adoption != 75 {
			t.Errorf("adoption = %+v, want 3 of 4 at 75%%", result.Adoption)
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
		seedTeam(ctx, t, teamID, email+" team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, rawToken
	}

	t.Run("invalid filter_expr returns the issue", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "eplotbadtype@mcp.test")
		resp := callMCPTool(t, rawToken, "get_errors_over_time", map[string]any{"filter_expr": "bogus_key:in:x", "app_id": appID.String(), "timezone": "UTC"})
		if !isToolError(resp) {
			t.Fatal("want tool error for unknown filter key")
		}
		if text := extractTextContent(t, resp); !strings.Contains(text, "filter_expr is invalid") || !strings.Contains(text, "bogus_key") {
			t.Errorf("error text %q should name the unknown key", text)
		}
	})
	t.Run("missing timezone", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "eplotnotz@mcp.test")
		resp := callMCPTool(t, rawToken, "get_errors_over_time", map[string]any{"app_id": appID.String()})
		if !isToolError(resp) {
			t.Error("want tool error for missing timezone")
		}
	})
	t.Run("valid crash plot call", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "eplot2@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_errors_over_time", map[string]any{"filter_expr": `error_type:in:[Crash]`, "app_id": appID.String(), "timezone": "UTC", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339)})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
	t.Run("valid ANR plot call", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "eplotanr@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_errors_over_time", map[string]any{"filter_expr": `error_type:in:[ANR]`, "app_id": appID.String(), "timezone": "UTC", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339)})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
	t.Run("valid no-filter plot call", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "eplotall@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_errors_over_time", map[string]any{"app_id": appID.String(), "timezone": "UTC", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339)})
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
		seedTeam(ctx, t, teamID, email+" team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, rawToken
	}

	t.Run("missing timezone", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "edplotnotz@mcp.test")
		resp := callMCPTool(t, rawToken, "get_error_over_time", map[string]any{"app_id": appID.String(), "error_group_id": "fp-1"})
		if !isToolError(resp) {
			t.Error("want tool error for missing timezone")
		}
	})
	t.Run("missing error_group_id", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "edplotnofp@mcp.test")
		resp := callMCPTool(t, rawToken, "get_error_over_time", map[string]any{"app_id": appID.String(), "timezone": "UTC"})
		if !isToolError(resp) {
			t.Error("want tool error for missing error_group_id")
		}
	})
	t.Run("valid call", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "edplot2@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_error_over_time", map[string]any{"app_id": appID.String(), "error_group_id": "fp-test-1", "timezone": "UTC", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339)})
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
		seedTeam(ctx, t, teamID, email+" team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, rawToken
	}

	t.Run("missing error_group_id", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "edistnofp@mcp.test")
		resp := callMCPTool(t, rawToken, "get_error_distribution", map[string]any{"app_id": appID.String()})
		if !isToolError(resp) {
			t.Error("want tool error for missing error_group_id")
		}
	})
	t.Run("valid crash distribution", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "edist2@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_error_distribution", map[string]any{"app_id": appID.String(), "error_group_id": "fp-test-dist-1", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339)})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
	t.Run("valid anr distribution", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "edist3@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_error_distribution", map[string]any{"app_id": appID.String(), "error_group_id": "fp-test-dist-2", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339)})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
}

func TestMCPGetSessions(t *testing.T) {
	ctx := context.Background()
	setupToolTestWithTeam := func(t *testing.T, email string) (uuid.UUID, uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, teamID, rawToken
	}
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, string) {
		appID, _, rawToken := setupToolTestWithTeam(t, email)
		return appID, rawToken
	}
	now := time.Now().UTC()
	from := now.Add(-7 * 24 * time.Hour).Format(time.RFC3339)
	to := now.Format(time.RFC3339)

	t.Run("missing app_id", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "sess@mcp.test")
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(time.Hour))
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
	t.Run("filter_expr narrows results", func(t *testing.T) {
		appID, teamID, rawToken := setupToolTestWithTeam(t, "sessexpr@mcp.test")
		crashSession := uuid.New().String()
		th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{
			Type: "exception", SessionID: crashSession, Fingerprint: "sess-fp",
			Severity: "fatal", Timestamp: now.Add(-time.Hour),
		})
		seedEventWithSession(ctx, t, teamID.String(), appID.String(), uuid.New().String(), now.Add(-time.Hour))

		sessions := func(t *testing.T, args map[string]any) []map[string]any {
			t.Helper()
			resp := callMCPTool(t, rawToken, "get_sessions", args)
			if isToolError(resp) {
				t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
			}
			var sessions []map[string]any
			if err := json.Unmarshal([]byte(extractTextContent(t, resp)), &sessions); err != nil {
				t.Fatalf("unmarshal sessions: %v", err)
			}
			return sessions
		}

		args := map[string]any{"app_id": appID.String(), "from": from, "to": to}
		if got := sessions(t, args); len(got) != 2 {
			t.Fatalf("want 2 sessions with no filter, got %d", len(got))
		}

		args["filter_expr"] = "session_events:in:fatal_error"
		got := sessions(t, args)
		if len(got) != 1 {
			t.Fatalf("want 1 session with the session type filter, got %d", len(got))
		}
		if got[0]["session_id"] != crashSession {
			t.Errorf("filtered session_id = %v, want %s", got[0]["session_id"], crashSession)
		}
	})
	t.Run("invalid filter_expr returns the issue", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "sessexprbad@mcp.test")
		resp := callMCPTool(t, rawToken, "get_sessions", map[string]any{"app_id": appID.String(), "from": from, "to": to, "filter_expr": "bogus_key:in:x"})
		if !isToolError(resp) {
			t.Fatal("want tool error for unknown filter key")
		}
		if text := extractTextContent(t, resp); !strings.Contains(text, "filter_expr is invalid") || !strings.Contains(text, "bogus_key") {
			t.Errorf("error text %q should name the unknown key", text)
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
		seedTeam(ctx, t, teamID, email+" team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
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
	t.Run("valid call with filter_expr", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "sploterr@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_sessions_over_time", map[string]any{"app_id": appID.String(), "filter_expr": "session_events:in:fatal_error", "timezone": "UTC", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339)})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
	t.Run("invalid filter_expr returns the issue", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "splotbadexpr@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_sessions_over_time", map[string]any{"app_id": appID.String(), "filter_expr": "bogus_key:in:x", "timezone": "UTC", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339)})
		if !isToolError(resp) {
			t.Fatal("want tool error for unknown filter key")
		}
		if text := extractTextContent(t, resp); !strings.Contains(text, "filter_expr is invalid") || !strings.Contains(text, "bogus_key") {
			t.Errorf("error text %q should name the unknown key", text)
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
		seedTeam(ctx, t, teamID, email+" team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
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
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(time.Hour))
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
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, teamID, rawToken
	}
	now := time.Now().UTC()
	from := now.Add(-7 * 24 * time.Hour).Format(time.RFC3339)
	to := now.Format(time.RFC3339)

	t.Run("missing app_id", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "br@mcp.test")
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(time.Hour))
		resp := callMCPTool(t, rawToken, "get_bug_reports", nil)
		if !isToolError(resp) {
			t.Error("want tool error for missing app_id")
		}
	})
	t.Run("valid call", func(t *testing.T) {
		appID, _, rawToken := setupToolTest(t, "br2@mcp.test")
		resp := callMCPTool(t, rawToken, "get_bug_reports", map[string]any{"app_id": appID.String(), "from": from, "to": to})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
	t.Run("filter_expr narrows results", func(t *testing.T) {
		appID, teamID, rawToken := setupToolTest(t, "brexpr@mcp.test")
		th.SeedBugReportRow(ctx, t, teamID.String(), appID.String(), testinfra.BugReportRow{
			Status: 0, Description: "open bug", Timestamp: now.Add(-time.Hour),
		})
		th.SeedBugReportRow(ctx, t, teamID.String(), appID.String(), testinfra.BugReportRow{
			Status: 1, Description: "closed bug", Timestamp: now.Add(-time.Hour),
		})

		args := map[string]any{"app_id": appID.String(), "from": from, "to": to}
		resp := callMCPTool(t, rawToken, "get_bug_reports", args)
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		var reports []map[string]any
		if err := json.Unmarshal([]byte(extractTextContent(t, resp)), &reports); err != nil {
			t.Fatalf("unmarshal bug reports: %v", err)
		}
		if len(reports) != 2 {
			t.Fatalf("want 2 bug reports with no filter, got %d", len(reports))
		}

		args["filter_expr"] = "bug_report_status:in:open"
		resp = callMCPTool(t, rawToken, "get_bug_reports", args)
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		if err := json.Unmarshal([]byte(extractTextContent(t, resp)), &reports); err != nil {
			t.Fatalf("unmarshal filtered bug reports: %v", err)
		}
		if len(reports) != 1 {
			t.Fatalf("want 1 bug report with status filter, got %d", len(reports))
		}
		if reports[0]["description"] != "open bug" {
			t.Errorf("filtered bug report description = %v, want open bug", reports[0]["description"])
		}
	})
	t.Run("a patch filter_expr narrows results", func(t *testing.T) {
		appID, teamID, rawToken := setupToolTest(t, "brpatch@mcp.test")
		patchID := uuid.New()
		// One report came from an app running an OTA patch and one did not.
		th.SeedBugReportRow(ctx, t, teamID.String(), appID.String(), testinfra.BugReportRow{
			Status: 0, Description: "patched bug", Timestamp: now.Add(-time.Hour),
			PatchID: patchID, PatchVersion: "1.2.0-patch.3",
		})
		th.SeedBugReportRow(ctx, t, teamID.String(), appID.String(), testinfra.BugReportRow{
			Status: 0, Description: "unpatched bug", Timestamp: now.Add(-time.Hour),
		})

		reports := func(t *testing.T, filterExpr string) []map[string]any {
			t.Helper()
			resp := callMCPTool(t, rawToken, "get_bug_reports", map[string]any{"app_id": appID.String(), "from": from, "to": to, "filter_expr": filterExpr})
			if isToolError(resp) {
				t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
			}
			var reports []map[string]any
			if err := json.Unmarshal([]byte(extractTextContent(t, resp)), &reports); err != nil {
				t.Fatalf("unmarshal bug reports: %v", err)
			}
			return reports
		}

		for _, filterExpr := range []string{
			"patch_id:is_set",
			"patch_id:in:" + patchID.String(),
			"patch_version:in:1.2.0-patch.3",
		} {
			got := reports(t, filterExpr)
			if len(got) != 1 {
				t.Fatalf("filter %q: want 1 bug report, got %d", filterExpr, len(got))
			}
			if got[0]["description"] != "patched bug" {
				t.Errorf("filter %q: description = %v, want patched bug", filterExpr, got[0]["description"])
			}
		}
	})
	t.Run("invalid filter_expr returns the issue", func(t *testing.T) {
		appID, _, rawToken := setupToolTest(t, "brexprbad@mcp.test")
		resp := callMCPTool(t, rawToken, "get_bug_reports", map[string]any{"app_id": appID.String(), "from": from, "to": to, "filter_expr": "bogus_key:in:x"})
		if !isToolError(resp) {
			t.Fatal("want tool error for unknown filter key")
		}
		if text := extractTextContent(t, resp); !strings.Contains(text, "Unknown key") || !strings.Contains(text, "bogus_key") {
			t.Errorf("error text %q should name the unknown key", text)
		}
	})
	t.Run("unparseable filter_expr returns the parse error", func(t *testing.T) {
		appID, _, rawToken := setupToolTest(t, "brexprparse@mcp.test")
		resp := callMCPTool(t, rawToken, "get_bug_reports", map[string]any{"app_id": appID.String(), "from": from, "to": to, "filter_expr": "version_name:in:v1 AND"})
		if !isToolError(resp) {
			t.Fatal("want tool error for unparseable filter")
		}
		if text := extractTextContent(t, resp); !strings.Contains(text, "filter_expr could not be parsed") || !strings.Contains(text, "at position") {
			t.Errorf("error text %q should report the parse failure and its position", text)
		}
	})
	t.Run("a custom filter_expr narrows results", func(t *testing.T) {
		appID, teamID, rawToken := setupToolTest(t, "brexprcustom@mcp.test")
		reportOne := uuid.New().String()
		th.SeedBugReportRow(ctx, t, teamID.String(), appID.String(), testinfra.BugReportRow{
			EventID: reportOne, Status: 0, Description: "premium bug", Timestamp: now.Add(-time.Hour),
		})
		th.SeedBugReportRow(ctx, t, teamID.String(), appID.String(), testinfra.BugReportRow{
			Status: 0, Description: "free bug", Timestamp: now.Add(-time.Hour),
		})
		th.SeedUDAttrRow(ctx, t, teamID.String(), appID.String(), testinfra.UDAttrRow{
			EventID: reportOne, BugReport: true, Key: "plan", Value: "pro", Timestamp: now.Add(-time.Hour),
		})

		resp := callMCPTool(t, rawToken, "get_bug_reports", map[string]any{"app_id": appID.String(), "from": from, "to": to, "filter_expr": "custom.plan:in:pro"})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		var reports []map[string]any
		if err := json.Unmarshal([]byte(extractTextContent(t, resp)), &reports); err != nil {
			t.Fatalf("unmarshal bug reports: %v", err)
		}
		if len(reports) != 1 {
			t.Fatalf("want 1 bug report with the custom filter, got %d", len(reports))
		}
		if reports[0]["description"] != "premium bug" {
			t.Errorf("filtered bug report description = %v, want premium bug", reports[0]["description"])
		}
	})
	t.Run("an unknown custom key returns the issue", func(t *testing.T) {
		appID, _, rawToken := setupToolTest(t, "brexprnocustom@mcp.test")
		resp := callMCPTool(t, rawToken, "get_bug_reports", map[string]any{"app_id": appID.String(), "from": from, "to": to, "filter_expr": "custom.nope:in:x"})
		if !isToolError(resp) {
			t.Fatal("want tool error for an attribute the app's bug reports never reported")
		}
		if text := extractTextContent(t, resp); !strings.Contains(text, "Unknown key") || !strings.Contains(text, "custom.nope") {
			t.Errorf("error text %q should name the unknown key", text)
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
		seedTeam(ctx, t, teamID, email+" team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
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
	t.Run("valid filter_expr is accepted", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "brplotexpr@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_bug_reports_over_time", map[string]any{"app_id": appID.String(), "timezone": "UTC", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339), "filter_expr": "version_name:in:v1 AND bug_report_status:in:open"})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
	t.Run("a patch filter_expr is accepted", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "brplotpatch@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_bug_reports_over_time", map[string]any{"app_id": appID.String(), "timezone": "UTC", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339), "filter_expr": "patch_id:is_set"})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
	t.Run("invalid filter_expr returns the issue", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "brplotexprbad@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_bug_reports_over_time", map[string]any{"app_id": appID.String(), "timezone": "UTC", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339), "filter_expr": "bug_report_status:in:bogus"})
		if !isToolError(resp) {
			t.Fatal("want tool error for invalid bug_report_status value")
		}
		if text := extractTextContent(t, resp); !strings.Contains(text, "bug_report_status") || !strings.Contains(text, "bogus") {
			t.Errorf("error text %q should name the bad value", text)
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
		seedTeam(ctx, t, teamID, email+" team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
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
		seedTeam(ctx, t, teamID, email+" team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, rawToken
	}

	t.Run("missing app_id", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "spans@mcp.test")
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(time.Hour))
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
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, teamID, rawToken
	}
	now := time.Now().UTC()
	from := now.Add(-7 * 24 * time.Hour).Format(time.RFC3339)
	to := now.Format(time.RFC3339)

	t.Run("missing root_span_name", func(t *testing.T) {
		appID, _, rawToken := setupToolTest(t, "si@mcp.test")
		resp := callMCPTool(t, rawToken, "get_span_instances", map[string]any{"app_id": appID.String(), "from": from, "to": to})
		if !isToolError(resp) {
			t.Error("want tool error for missing root_span_name")
		}
	})
	t.Run("valid call", func(t *testing.T) {
		appID, _, rawToken := setupToolTest(t, "si2@mcp.test")
		resp := callMCPTool(t, rawToken, "get_span_instances", map[string]any{"app_id": appID.String(), "root_span_name": "some-span", "from": from, "to": to})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
	t.Run("filter_expr narrows results", func(t *testing.T) {
		appID, teamID, rawToken := setupToolTest(t, "si3@mcp.test")
		seedSpan(ctx, t, teamID.String(), appID.String(), "checkout", 1, now.Add(-time.Hour), now.Add(-time.Hour+time.Second), "v1", "1")
		seedSpan(ctx, t, teamID.String(), appID.String(), "checkout", 1, now.Add(-time.Hour), now.Add(-time.Hour+time.Second), "v2", "2")

		args := map[string]any{"app_id": appID.String(), "root_span_name": "checkout", "from": from, "to": to}
		resp := callMCPTool(t, rawToken, "get_span_instances", args)
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		var spans []map[string]any
		if err := json.Unmarshal([]byte(extractTextContent(t, resp)), &spans); err != nil {
			t.Fatalf("unmarshal spans: %v", err)
		}
		if len(spans) != 2 {
			t.Fatalf("want 2 spans with no filter, got %d", len(spans))
		}

		args["filter_expr"] = "version_name:in:v1"
		resp = callMCPTool(t, rawToken, "get_span_instances", args)
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		if err := json.Unmarshal([]byte(extractTextContent(t, resp)), &spans); err != nil {
			t.Fatalf("unmarshal filtered spans: %v", err)
		}
		if len(spans) != 1 {
			t.Fatalf("want 1 span with version filter, got %d", len(spans))
		}
		if spans[0]["app_version"] != "v1" {
			t.Errorf("filtered span app_version = %v, want v1", spans[0]["app_version"])
		}
	})
	t.Run("a patch filter_expr narrows results", func(t *testing.T) {
		appID, teamID, rawToken := setupToolTest(t, "si8@mcp.test")
		patchID := uuid.New()
		// One checkout span ran an OTA patch and one did not.
		th.SeedSpanRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.SpanRow{
			SpanName: "checkout", Status: 1,
			StartTime: now.Add(-time.Hour), EndTime: now.Add(-time.Hour + time.Second),
			AppVersion: "v1", AppBuild: "1",
			PatchID: patchID, PatchVersion: "1.2.0-patch.3",
		})
		seedSpan(ctx, t, teamID.String(), appID.String(), "checkout", 1, now.Add(-time.Hour), now.Add(-time.Hour+time.Second), "v2", "2")

		instances := func(t *testing.T, filterExpr string) []map[string]any {
			t.Helper()
			resp := callMCPTool(t, rawToken, "get_span_instances", map[string]any{"app_id": appID.String(), "root_span_name": "checkout", "from": from, "to": to, "filter_expr": filterExpr})
			if isToolError(resp) {
				t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
			}
			var spans []map[string]any
			if err := json.Unmarshal([]byte(extractTextContent(t, resp)), &spans); err != nil {
				t.Fatalf("unmarshal spans: %v", err)
			}
			return spans
		}

		for _, filterExpr := range []string{
			"patch_id:is_set",
			"patch_id:in:" + patchID.String(),
			"patch_version:in:1.2.0-patch.3",
		} {
			spans := instances(t, filterExpr)
			if len(spans) != 1 {
				t.Fatalf("filter %q: want 1 span, got %d", filterExpr, len(spans))
			}
			if spans[0]["app_version"] != "v1" {
				t.Errorf("filter %q: span app_version = %v, want v1", filterExpr, spans[0]["app_version"])
			}
		}
	})
	t.Run("invalid filter_expr returns the issue", func(t *testing.T) {
		appID, _, rawToken := setupToolTest(t, "si4@mcp.test")
		resp := callMCPTool(t, rawToken, "get_span_instances", map[string]any{"app_id": appID.String(), "root_span_name": "checkout", "from": from, "to": to, "filter_expr": "bogus_key:in:x"})
		if !isToolError(resp) {
			t.Fatal("want tool error for unknown filter key")
		}
		if text := extractTextContent(t, resp); !strings.Contains(text, "Unknown key") || !strings.Contains(text, "bogus_key") {
			t.Errorf("error text %q should name the unknown key", text)
		}
	})
	t.Run("unparseable filter_expr returns the parse error", func(t *testing.T) {
		appID, _, rawToken := setupToolTest(t, "si5@mcp.test")
		resp := callMCPTool(t, rawToken, "get_span_instances", map[string]any{"app_id": appID.String(), "root_span_name": "checkout", "from": from, "to": to, "filter_expr": "version_name:in:v1 AND"})
		if !isToolError(resp) {
			t.Fatal("want tool error for unparseable filter")
		}
		if text := extractTextContent(t, resp); !strings.Contains(text, "filter_expr could not be parsed") {
			t.Errorf("error text %q should report the parse failure", text)
		}
	})
	t.Run("a custom filter_expr narrows results", func(t *testing.T) {
		appID, teamID, rawToken := setupToolTest(t, "si6@mcp.test")
		traceOne := seedSpan(ctx, t, teamID.String(), appID.String(), "checkout", 1, now.Add(-time.Hour), now.Add(-time.Hour+time.Second), "v1", "1")
		seedSpan(ctx, t, teamID.String(), appID.String(), "checkout", 1, now.Add(-time.Hour), now.Add(-time.Hour+time.Second), "v2", "2")
		seedSpanUDAttr(ctx, t, teamID.String(), appID.String(), testinfra.SpanUDAttrRow{SpanID: traceOne[:16], Key: "plan", Value: "pro", Timestamp: now.Add(-time.Hour)})

		resp := callMCPTool(t, rawToken, "get_span_instances", map[string]any{"app_id": appID.String(), "root_span_name": "checkout", "from": from, "to": to, "filter_expr": "custom.plan:in:pro"})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		var spans []map[string]any
		if err := json.Unmarshal([]byte(extractTextContent(t, resp)), &spans); err != nil {
			t.Fatalf("unmarshal spans: %v", err)
		}
		if len(spans) != 1 {
			t.Fatalf("want 1 span with the custom filter, got %d", len(spans))
		}
		if spans[0]["app_version"] != "v1" {
			t.Errorf("filtered span app_version = %v, want v1", spans[0]["app_version"])
		}
	})
	t.Run("an unknown custom key returns the issue", func(t *testing.T) {
		appID, _, rawToken := setupToolTest(t, "si7@mcp.test")
		resp := callMCPTool(t, rawToken, "get_span_instances", map[string]any{"app_id": appID.String(), "root_span_name": "checkout", "from": from, "to": to, "filter_expr": "custom.nope:in:x"})
		if !isToolError(resp) {
			t.Fatal("want tool error for an attribute the app's spans never reported")
		}
		if text := extractTextContent(t, resp); !strings.Contains(text, "Unknown key") || !strings.Contains(text, "custom.nope") {
			t.Errorf("error text %q should name the unknown key", text)
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
		seedTeam(ctx, t, teamID, email+" team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
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
	t.Run("valid filter_expr is accepted", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "smplot4@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_span_metrics_over_time", map[string]any{"app_id": appID.String(), "root_span_name": "some-span", "timezone": "UTC", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339), "filter_expr": "version_name:in:v1 AND span_status:in:error"})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
	t.Run("a patch filter_expr runs against the span metrics rollup", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "smplot6@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "smplot6 team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		// The metrics plot reads the span_metrics rollup, not the spans table.
		now := time.Now().UTC()
		th.SeedSpanRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.SpanRow{
			SpanName: "checkout", Status: 1,
			StartTime: now.Add(-time.Hour), EndTime: now.Add(-time.Hour + time.Second),
			AppVersion: "v1", AppBuild: "1",
			PatchID: uuid.New(), PatchVersion: "1.2.0-patch.3",
		})

		resp := callMCPTool(t, rawToken, "get_span_metrics_over_time", map[string]any{"app_id": appID.String(), "root_span_name": "checkout", "timezone": "UTC", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339), "filter_expr": "patch_id:is_set"})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
	t.Run("invalid filter_expr returns the issue", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "smplot5@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_span_metrics_over_time", map[string]any{"app_id": appID.String(), "root_span_name": "some-span", "timezone": "UTC", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339), "filter_expr": "span_status:in:bogus"})
		if !isToolError(resp) {
			t.Fatal("want tool error for invalid span_status value")
		}
		if text := extractTextContent(t, resp); !strings.Contains(text, "span_status") || !strings.Contains(text, "bogus") {
			t.Errorf("error text %q should name the bad value", text)
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
		seedTeam(ctx, t, teamID, email+" team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
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
		seedTeam(ctx, t, teamID, email+" team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, rawToken
	}
	now := time.Now().UTC()
	from := now.Add(-7 * 24 * time.Hour).Format(time.RFC3339)
	to := now.Format(time.RFC3339)

	t.Run("missing app_id", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "alerts@mcp.test")
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(time.Hour))
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
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, teamID, rawToken
	}
	now := time.Now().UTC()
	from := now.Add(-7 * 24 * time.Hour).Format(time.RFC3339)
	to := now.Format(time.RFC3339)

	t.Run("missing app_id", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "journey@mcp.test")
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(time.Hour))
		resp := callMCPTool(t, rawToken, "get_journey", nil)
		if !isToolError(resp) {
			t.Error("want tool error for missing app_id")
		}
	})
	t.Run("valid call", func(t *testing.T) {
		appID, _, rawToken := setupToolTest(t, "journey2@mcp.test")
		resp := callMCPTool(t, rawToken, "get_journey", map[string]any{"app_id": appID.String(), "from": from, "to": to})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		content := extractTextContent(t, resp)
		var result map[string]any
		if err := json.Unmarshal([]byte(content), &result); err != nil {
			t.Errorf("response is not JSON object: %v\ncontent: %s", err, content)
		}
	})
	t.Run("filter_expr narrows results", func(t *testing.T) {
		appID, teamID, rawToken := setupToolTest(t, "journeyexpr@mcp.test")
		// The seeded screens carry app version v1 with build 1.
		sessionID := uuid.NewString()
		th.SeedLifecycleActivityInSession(ctx, t, teamID.String(), appID.String(), sessionID, "resumed", "HomeActivity", now.Add(-time.Hour))
		th.SeedLifecycleActivityInSession(ctx, t, teamID.String(), appID.String(), sessionID, "resumed", "CartActivity", now.Add(-time.Hour).Add(time.Second))

		nodes := func(t *testing.T, filterExpr string) []any {
			t.Helper()
			args := map[string]any{"app_id": appID.String(), "from": from, "to": to}
			if filterExpr != "" {
				args["filter_expr"] = filterExpr
			}
			resp := callMCPTool(t, rawToken, "get_journey", args)
			if isToolError(resp) {
				t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
			}
			var result struct {
				Nodes []any `json:"nodes"`
			}
			if err := json.Unmarshal([]byte(extractTextContent(t, resp)), &result); err != nil {
				t.Fatalf("unmarshal journey: %v", err)
			}
			return result.Nodes
		}

		if got := nodes(t, ""); len(got) != 2 {
			t.Fatalf("want 2 nodes with no filter, got %v", got)
		}
		if got := nodes(t, "version_name:in:v1 AND version_code:in:1"); len(got) != 2 {
			t.Fatalf("want 2 nodes for the seeded version, got %v", got)
		}
		if got := nodes(t, "version_name:in:v9"); len(got) != 0 {
			t.Fatalf("want no nodes for a version never seen, got %v", got)
		}
	})
	t.Run("invalid filter_expr returns the issue", func(t *testing.T) {
		appID, _, rawToken := setupToolTest(t, "journeyexprbad@mcp.test")
		resp := callMCPTool(t, rawToken, "get_journey", map[string]any{"app_id": appID.String(), "from": from, "to": to, "filter_expr": "os_name:in:android"})
		if !isToolError(resp) {
			t.Fatal("want tool error for a key the journeys entity does not have")
		}
		if text := extractTextContent(t, resp); !strings.Contains(text, "Unknown key") || !strings.Contains(text, "os_name") {
			t.Errorf("error text %q should name the unknown key", text)
		}
	})
	t.Run("unparseable filter_expr returns the parse error", func(t *testing.T) {
		appID, _, rawToken := setupToolTest(t, "journeyexprparse@mcp.test")
		resp := callMCPTool(t, rawToken, "get_journey", map[string]any{"app_id": appID.String(), "from": from, "to": to, "filter_expr": "version_name:in:v1 AND"})
		if !isToolError(resp) {
			t.Fatal("want tool error for unparseable filter")
		}
		if text := extractTextContent(t, resp); !strings.Contains(text, "filter_expr could not be parsed") || !strings.Contains(text, "at position") {
			t.Errorf("error text %q should report the parse failure and its position", text)
		}
	})
}

func TestMCPNetworkSelectionScopes(t *testing.T) {
	ctx := context.Background()
	cleanupAll(ctx, t)

	userID := uuid.New()
	teamID := uuid.New()
	appID := uuid.New()
	seedUser(ctx, t, userID.String(), "networkscopes@mcp.test")
	seedTeam(ctx, t, teamID, "network scopes team")
	seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
	seedApp(ctx, t, appID, teamID, 30)
	rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(time.Hour))

	now := time.Now().UTC().Truncate(15 * time.Minute)
	seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://a.example.com/one", "GET", 200, 5, now)
	seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://a.example.com/two", "GET", 404, 2, now)
	seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://b.example.com/three", "GET", 500, 3, now)
	seedHttpMetrics(ctx, t, teamID.String(), appID.String(), "a.example.com", "/one", 5, 5, 0, 0, now)
	seedHttpMetrics(ctx, t, teamID.String(), appID.String(), "a.example.com", "/two", 2, 0, 2, 0, now)
	seedHttpMetrics(ctx, t, teamID.String(), appID.String(), "b.example.com", "/three", 3, 0, 0, 3, now)

	from := now.Add(-time.Hour).Format(time.RFC3339)
	to := now.Add(time.Hour).Format(time.RFC3339)
	scopes := []struct {
		name   string
		args   map[string]any
		count  float64
		points int
	}{
		{"app", map[string]any{}, 10, 3},
		{"domain", map[string]any{"domain": "a.example.com"}, 7, 2},
		{"endpoint", map[string]any{"domain": "a.example.com", "path": "/one"}, 5, 1},
		{"path across domains", map[string]any{"path": "/one"}, 5, 1},
		{"wildcard endpoint pattern", map[string]any{"domain": "*.example.com", "path": "/*"}, 10, 3},
	}

	sumDataPoints := func(t *testing.T, content, field string) float64 {
		t.Helper()
		var points []map[string]any
		if err := json.Unmarshal([]byte(content), &points); err != nil {
			t.Fatalf("response is not a data-point array: %v", err)
		}
		var total float64
		for _, point := range points {
			total += point[field].(float64)
		}
		return total
	}
	for _, scope := range scopes {
		t.Run(scope.name, func(t *testing.T) {
			plotArgs := map[string]any{"app_id": appID.String(), "from": from, "to": to, "timezone": "UTC"}
			for key, value := range scope.args {
				plotArgs[key] = value
			}

			bucket := callMCPTool(t, rawToken, "get_network_status_codes_over_time", plotArgs)
			if isToolError(bucket) {
				t.Fatalf("bucket tool error: %s", extractTextContent(t, bucket))
			}
			if got := sumDataPoints(t, extractTextContent(t, bucket), "total_count"); got != scope.count {
				t.Errorf("bucket total = %v, want %v", got, scope.count)
			}

			latency := callMCPTool(t, rawToken, "get_network_latency_over_time", plotArgs)
			if isToolError(latency) {
				t.Fatalf("latency tool error: %s", extractTextContent(t, latency))
			}
			if got := sumDataPoints(t, extractTextContent(t, latency), "count"); got != scope.count {
				t.Errorf("latency total = %v, want %v", got, scope.count)
			}

			timelineArgs := map[string]any{"app_id": appID.String(), "from": from, "to": to}
			for key, value := range scope.args {
				timelineArgs[key] = value
			}
			timeline := callMCPTool(t, rawToken, "get_network_timeline", timelineArgs)
			if isToolError(timeline) {
				t.Fatalf("timeline tool error: %s", extractTextContent(t, timeline))
			}
			var timelineResult struct {
				Points []any `json:"points"`
			}
			if err := json.Unmarshal([]byte(extractTextContent(t, timeline)), &timelineResult); err != nil {
				t.Fatalf("timeline response is not JSON: %v", err)
			}
			if len(timelineResult.Points) != scope.points*2 {
				t.Errorf("timeline points = %d, want %d", len(timelineResult.Points), scope.points*2)
			}
		})
	}

	exactStatusCodes := callMCPTool(t, rawToken, "get_network_endpoint_status_codes_over_time", map[string]any{
		"app_id":   appID.String(),
		"path":     "/one",
		"from":     from,
		"to":       to,
		"timezone": "UTC",
	})
	if isToolError(exactStatusCodes) {
		t.Fatalf("exact status-code tool error: %s", extractTextContent(t, exactStatusCodes))
	}
	var exactResult struct {
		StatusCodes []int            `json:"status_codes"`
		DataPoints  []map[string]any `json:"data_points"`
	}
	if err := json.Unmarshal([]byte(extractTextContent(t, exactStatusCodes)), &exactResult); err != nil {
		t.Fatalf("exact status-code response is not JSON: %v", err)
	}
	if len(exactResult.StatusCodes) != 1 || exactResult.StatusCodes[0] != 200 {
		t.Errorf("status codes = %v, want [200]", exactResult.StatusCodes)
	}
	if len(exactResult.DataPoints) != 1 || exactResult.DataPoints[0]["count_200"] != float64(5) {
		t.Errorf("data points = %v, want one count_200=5", exactResult.DataPoints)
	}
}

func TestMCPNetworkFilterExpr(t *testing.T) {
	ctx := context.Background()
	cleanupAll(ctx, t)

	userID := uuid.New()
	teamID := uuid.New()
	appID := uuid.New()
	seedUser(ctx, t, userID.String(), "networkexpr@mcp.test")
	seedTeam(ctx, t, teamID, "network expr team")
	seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
	seedApp(ctx, t, appID, teamID, 30)
	rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(time.Hour))

	now := time.Now().UTC().Truncate(15 * time.Minute)
	seedHttpEvent(ctx, t, teamID.String(), appID.String(), "https://a.example.com/one", "GET", 200, 5, now)
	seedHttpMetrics(ctx, t, teamID.String(), appID.String(), "a.example.com", "/one", 5, 5, 0, 0, now)

	from := now.Add(-time.Hour).Format(time.RFC3339)
	to := now.Add(time.Hour).Format(time.RFC3339)

	latencyCount := func(t *testing.T, filterExpr string) float64 {
		t.Helper()
		args := map[string]any{"app_id": appID.String(), "from": from, "to": to, "timezone": "UTC"}
		if filterExpr != "" {
			args["filter_expr"] = filterExpr
		}
		resp := callMCPTool(t, rawToken, "get_network_latency_over_time", args)
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
		var points []map[string]any
		if err := json.Unmarshal([]byte(extractTextContent(t, resp)), &points); err != nil {
			t.Fatalf("response is not a data-point array: %v", err)
		}
		var total float64
		for _, point := range points {
			total += point["count"].(float64)
		}
		return total
	}

	t.Run("filter_expr narrows the events queries", func(t *testing.T) {
		if got := latencyCount(t, ""); got != 5 {
			t.Fatalf("unfiltered count = %v, want 5", got)
		}
		if got := latencyCount(t, "version_name:in:v1 AND http_method:in:get"); got != 5 {
			t.Errorf("matching filter count = %v, want 5", got)
		}
		if got := latencyCount(t, "version_name:in:v9"); got != 0 {
			t.Errorf("count for a version never seen = %v, want 0", got)
		}
	})

	t.Run("filter_expr narrows the rollup queries", func(t *testing.T) {
		points := func(t *testing.T, filterExpr string) int {
			t.Helper()
			resp := callMCPTool(t, rawToken, "get_network_timeline", map[string]any{
				"app_id": appID.String(), "from": from, "to": to, "filter_expr": filterExpr,
			})
			if isToolError(resp) {
				t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
			}
			var result struct {
				Points []any `json:"points"`
			}
			if err := json.Unmarshal([]byte(extractTextContent(t, resp)), &result); err != nil {
				t.Fatalf("timeline response is not JSON: %v", err)
			}
			return len(result.Points)
		}

		if got := points(t, "http_method:in:get"); got == 0 {
			t.Error("want the seeded bucket kept by a matching filter")
		}
		if got := points(t, "http_method:in:post"); got != 0 {
			t.Errorf("timeline points for a method never seen = %d, want 0", got)
		}
	})

	t.Run("invalid filter_expr returns the issue", func(t *testing.T) {
		resp := callMCPTool(t, rawToken, "get_network_metrics_trends", map[string]any{
			"app_id": appID.String(), "from": from, "to": to, "filter_expr": "span_status:in:error",
		})
		if !isToolError(resp) {
			t.Fatal("want tool error for a key the network entity does not have")
		}
		if text := extractTextContent(t, resp); !strings.Contains(text, "Unknown key") || !strings.Contains(text, "span_status") {
			t.Errorf("error text %q should name the unknown key", text)
		}
	})

	t.Run("unparseable filter_expr returns the parse error", func(t *testing.T) {
		resp := callMCPTool(t, rawToken, "get_network_metrics_trends", map[string]any{
			"app_id": appID.String(), "from": from, "to": to, "filter_expr": "version_name:in:v1 AND",
		})
		if !isToolError(resp) {
			t.Fatal("want tool error for unparseable filter")
		}
		if text := extractTextContent(t, resp); !strings.Contains(text, "filter_expr could not be parsed") || !strings.Contains(text, "at position") {
			t.Errorf("error text %q should report the parse failure and its position", text)
		}
	})
}

func TestMCPGetNetworkTrends(t *testing.T) {
	ctx := context.Background()
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, rawToken
	}

	t.Run("missing app_id", func(t *testing.T) {
		_, rawToken := setupToolTest(t, "nettrend1@mcp.test")
		resp := callMCPTool(t, rawToken, "get_network_metrics_trends", nil)
		if !isToolError(resp) {
			t.Error("want tool error for missing app_id")
		}
	})
	t.Run("valid call", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "nettrend2@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_network_metrics_trends", map[string]any{"app_id": appID.String(), "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339)})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
}

func TestMCPGetNetworkOverviewStatusOverTime(t *testing.T) {
	ctx := context.Background()
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, rawToken
	}

	t.Run("missing timezone", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "netovstat1@mcp.test")
		resp := callMCPTool(t, rawToken, "get_network_status_codes_over_time", map[string]any{"app_id": appID.String()})
		if !isToolError(resp) {
			t.Error("want tool error for missing timezone")
		}
	})
	t.Run("valid call", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "netovstat2@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_network_status_codes_over_time", map[string]any{"app_id": appID.String(), "timezone": "UTC", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339)})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
}

func TestMCPGetNetworkDetailLatencyOverTime(t *testing.T) {
	ctx := context.Background()
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, rawToken
	}

	t.Run("missing timezone", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "netdetlat1@mcp.test")
		resp := callMCPTool(t, rawToken, "get_network_latency_over_time", map[string]any{"app_id": appID.String(), "domain": "api.example.com", "path": "/v1/users"})
		if !isToolError(resp) {
			t.Error("want tool error for missing timezone")
		}
	})
	t.Run("valid call", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "netdetlat3@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_network_latency_over_time", map[string]any{"app_id": appID.String(), "domain": "api.example.com", "path": "/v1/users", "timezone": "UTC", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339)})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
}

func TestMCPGetNetworkTimeline(t *testing.T) {
	ctx := context.Background()
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, rawToken
	}

	t.Run("missing app_id", func(t *testing.T) {
		_, rawToken := setupToolTest(t, "nettl1@mcp.test")
		resp := callMCPTool(t, rawToken, "get_network_timeline", nil)
		if !isToolError(resp) {
			t.Error("want tool error for missing app_id")
		}
	})
	t.Run("valid call", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "nettl2@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_network_timeline", map[string]any{"app_id": appID.String(), "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339)})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
}

func TestMCPGetNetworkEndpointTimeline(t *testing.T) {
	ctx := context.Background()
	setupToolTest := func(t *testing.T, email string) (uuid.UUID, string) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), email)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, email+" team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		return appID, rawToken
	}

	t.Run("missing app_id", func(t *testing.T) {
		_, rawToken := setupToolTest(t, "neteptl1@mcp.test")
		resp := callMCPTool(t, rawToken, "get_network_timeline", nil)
		if !isToolError(resp) {
			t.Error("want tool error for missing app_id")
		}
	})
	t.Run("valid call", func(t *testing.T) {
		appID, rawToken := setupToolTest(t, "neteptl3@mcp.test")
		now := time.Now().UTC()
		resp := callMCPTool(t, rawToken, "get_network_timeline", map[string]any{"app_id": appID.String(), "domain": "api.example.com", "path": "/v1/users", "from": now.Add(-7 * 24 * time.Hour).Format(time.RFC3339), "to": now.Format(time.RFC3339)})
		if isToolError(resp) {
			t.Fatalf("unexpected tool error: %s", extractTextContent(t, resp))
		}
	})
}

func TestMCPAccessControl(t *testing.T) {
	ctx := context.Background()
	cleanupAll(ctx, t)

	userA := uuid.New()
	seedUser(ctx, t, userA.String(), "acl-a@mcp.test")
	teamA := uuid.New()
	seedTeam(ctx, t, teamA, "acl team A")
	seedTeamMembership(ctx, t, teamA, userA.String(), "owner")
	appA := uuid.New()
	seedApp(ctx, t, appA, teamA, 30)

	userB := uuid.New()
	seedUser(ctx, t, userB.String(), "acl-b@mcp.test")
	teamB := uuid.New()
	seedTeam(ctx, t, teamB, "acl team B")
	seedTeamMembership(ctx, t, teamB, userB.String(), "owner")
	appB := uuid.New()
	seedApp(ctx, t, appB, teamB, 30)
	_ = appB

	rawToken := seedMCPSession(ctx, t, userB.String(), "c1", time.Now().Add(90*24*time.Hour))

	now := time.Now().UTC()
	from := now.Add(-7 * 24 * time.Hour).Format(time.RFC3339)
	to := now.Format(time.RFC3339)

	toolCalls := []struct {
		name string
		args map[string]any
	}{
		{"get_filter_keys", map[string]any{"app_id": appA.String(), "entity": "spans"}},
		{"get_filter_values", map[string]any{"app_id": appA.String(), "entity": "spans", "key_name": "version_name"}},
		{"get_metrics", map[string]any{"app_id": appA.String(), "from": from, "to": to}},
		{"get_app_health_over_time", map[string]any{"app_id": appA.String(), "timezone": "UTC", "from": from, "to": to}},
		{"get_errors", map[string]any{"app_id": appA.String(), "from": from, "to": to}},
		{"get_error", map[string]any{"app_id": appA.String(), "error_group_id": "fp-1", "from": from, "to": to}},
		{"get_errors_over_time", map[string]any{"app_id": appA.String(), "timezone": "UTC", "from": from, "to": to}},
		{"get_error_over_time", map[string]any{"app_id": appA.String(), "error_group_id": "fp-1", "timezone": "UTC", "from": from, "to": to}},
		{"get_error_distribution", map[string]any{"app_id": appA.String(), "error_group_id": "fp-1", "from": from, "to": to}},
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
	rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

	tools := []struct {
		name string
		args map[string]any
	}{
		{"get_filter_keys", map[string]any{"app_id": "not-a-uuid", "entity": "spans"}},
		{"get_filter_values", map[string]any{"app_id": "not-a-uuid", "entity": "spans", "key_name": "version_name"}},
		{"get_errors", map[string]any{"app_id": "not-a-uuid"}},
		{"get_sessions", map[string]any{"app_id": "not-a-uuid"}},
		{"get_metrics", map[string]any{"app_id": "not-a-uuid"}},
		{"get_bug_reports", map[string]any{"app_id": "not-a-uuid"}},
		{"get_root_span_names", map[string]any{"app_id": "not-a-uuid"}},
		{"get_session", map[string]any{"app_id": "not-a-uuid", "session_id": "some-id"}},
		{"get_bug_report", map[string]any{"app_id": "not-a-uuid", "bug_report_id": "some-id"}},
		{"get_trace", map[string]any{"app_id": "not-a-uuid", "trace_id": "some-id"}},
		{"get_alerts", map[string]any{"app_id": "not-a-uuid"}},
		{"get_journey", map[string]any{"app_id": "not-a-uuid"}},
		{"get_error_common_path", map[string]any{"app_id": "not-a-uuid", "error_group_id": "fp-1"}},
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
	rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

	req := newMCPRequest(rawToken, "tools/call", "nonexistent_tool", mcpRequestBody(1, "tools/call", map[string]any{
		"name":      "nonexistent_tool",
		"arguments": map[string]any{},
	}))
	w := httptest.NewRecorder()
	buildMCPTestRouter().ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if _, ok := resp["error"]; !ok {
		t.Errorf("want a JSON-RPC error, got %s", w.Body.String())
	}
}

func TestMCPGetErrorCommonPath(t *testing.T) {
	ctx := context.Background()

	t.Run("missing error_group_id", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "cp3@mcp.test")
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(time.Hour))

		resp := callMCPTool(t, rawToken, "get_error_common_path", map[string]any{"app_id": uuid.New().String()})
		if !isToolError(resp) {
			t.Error("want tool error for missing error_group_id")
		}
	})

	t.Run("valid crash common path call", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "cpcrash@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "cpcrash team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		fingerprint := "fp-cp-crash-1"
		th.SeedFatalExceptionGroupWithCustomFlag(ctx, t, teamID.String(), appID.String(), fingerprint, false)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		resp := callMCPTool(t, rawToken, "get_error_common_path", map[string]any{"app_id": appID.String(), "error_group_id": fingerprint})
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
		seedTeam(ctx, t, teamID, "cpanr team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		fingerprint := "fp-cp-anr-1"
		th.SeedAnrGroup(ctx, t, teamID.String(), appID.String(), fingerprint)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))

		resp := callMCPTool(t, rawToken, "get_error_common_path", map[string]any{"app_id": appID.String(), "error_group_id": fingerprint})
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
		seedTeam(ctx, t, teamID, email+" team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
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

	t.Run("viewer cannot update bug report status", func(t *testing.T) {
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "ubrviewer@mcp.test")
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "viewer team")
		seedTeamMembership(ctx, t, teamID, userID.String(), "viewer")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		rawToken := seedMCPSession(ctx, t, userID.String(), "c1", time.Now().Add(90*24*time.Hour))
		bugReportID := uuid.New().String()
		seedBugReport(ctx, t, teamID.String(), appID.String(), bugReportID, "viewer test bug", time.Now().UTC())

		resp := callMCPTool(t, rawToken, "update_bug_report_status", map[string]any{"app_id": appID.String(), "bug_report_id": bugReportID, "status": 1})
		if !isToolError(resp) {
			t.Fatal("want tool error: viewers must not update bug reports")
		}
		if content := extractTextContent(t, resp); !strings.Contains(content, "not authorized") {
			t.Errorf("want authorization error, got %q", content)
		}

		// Reads stay allowed for viewers.
		readResp := callMCPTool(t, rawToken, "get_bug_reports", map[string]any{"app_id": appID.String()})
		if isToolError(readResp) {
			t.Errorf("viewer should still read bug reports, got error: %q", extractTextContent(t, readResp))
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
	if err := mcpStoreMCPStateInValkey(ctx, deps.VK, state, payload); err != nil {
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
	cfg := agent.NewConfig()
	cfg.Deps = deps
	mcpHandler := NewMCPHandler(agent.MCPTools(cfg))
	r.POST("/mcp", h.ValidateMCPToken(), gin.WrapH(mcpHandler))
	r.GET("/mcp", h.ValidateMCPToken(), gin.WrapH(mcpHandler))
	r.DELETE("/mcp", h.ValidateMCPToken(), gin.WrapH(mcpHandler))
	return r
}

// mcpRequestBody encodes a JSON-RPC request at protocol version 2026-07-28, in
// which every request states its own protocol version and client capabilities.
func mcpRequestBody(id int, method string, params map[string]any) []byte {
	if params == nil {
		params = map[string]any{}
	}
	params["_meta"] = map[string]any{
		"io.modelcontextprotocol/protocolVersion":    "2026-07-28",
		"io.modelcontextprotocol/clientCapabilities": map[string]any{},
	}
	b, _ := json.Marshal(map[string]any{
		"jsonrpc": "2.0",
		"id":      id,
		"method":  method,
		"params":  params,
	})
	return b
}

// newMCPRequest sets the headers that protocol version 2026-07-28 requires
// alongside the JSON-RPC body.
func newMCPRequest(rawToken, method, name string, body []byte) *http.Request {
	req := httptest.NewRequest("POST", "/mcp", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+rawToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	req.Header.Set("Mcp-Protocol-Version", "2026-07-28")
	req.Header.Set("Mcp-Method", method)
	if name != "" {
		req.Header.Set("Mcp-Name", name)
	}
	return req
}

// callMCPTool sends one tools/call request and returns the decoded response.
func callMCPTool(t *testing.T, rawToken, toolName string, args map[string]any) map[string]any {
	t.Helper()

	if args == nil {
		args = map[string]any{}
	}

	req := newMCPRequest(rawToken, "tools/call", toolName, mcpRequestBody(1, "tools/call", map[string]any{
		"name":      toolName,
		"arguments": args,
	}))
	w := httptest.NewRecorder()
	buildMCPTestRouter().ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("MCP tool call %q: want 200, got %d: %s", toolName, w.Code, w.Body.String())
	}

	return parseSSEData(t, w.Body.String())
}

// newTestClientMetadataServer serves a Client ID Metadata Document over TLS
// and returns its URL, which is the client_id to send. mutate lets a test
// serve an invalid document.
func newTestClientMetadataServer(t *testing.T, redirectURIs []string, mutate func(doc map[string]any)) string {
	t.Helper()
	var srv *httptest.Server
	srv = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/client-metadata.json" {
			http.NotFound(w, r)
			return
		}
		doc := map[string]any{
			"client_id":     srv.URL + "/client-metadata.json",
			"client_name":   "Test Client",
			"redirect_uris": redirectURIs,
		}
		if mutate != nil {
			mutate(doc)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(doc)
	}))
	orig := mcpClientMetadataHTTPClient
	mcpClientMetadataHTTPClient = mcpNewClientMetadataHTTPClient(nil, srv.Client().Transport.(*http.Transport).TLSClientConfig)
	t.Cleanup(func() {
		mcpClientMetadataHTTPClient = orig
		srv.Close()
	})
	return srv.URL + "/client-metadata.json"
}

// newTestClientMetadataServerWith lets the test write the whole response,
// rather than serving a valid metadata document.
func newTestClientMetadataServerWith(t *testing.T, serve func(w http.ResponseWriter, selfURL string)) string {
	t.Helper()
	var srv *httptest.Server
	srv = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		serve(w, srv.URL+"/client-metadata.json")
	}))
	orig := mcpClientMetadataHTTPClient
	mcpClientMetadataHTTPClient = mcpNewClientMetadataHTTPClient(nil, srv.Client().Transport.(*http.Transport).TLSClientConfig)
	t.Cleanup(func() {
		mcpClientMetadataHTTPClient = orig
		srv.Close()
	})
	return srv.URL + "/client-metadata.json"
}

// parseSSEData extracts the JSON data from an SSE response body.
// The format is "event: message\ndata: {json}\n\n".
func parseSSEData(t *testing.T, body string) map[string]any {
	t.Helper()
	for line := range strings.SplitSeq(body, "\n") {
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
