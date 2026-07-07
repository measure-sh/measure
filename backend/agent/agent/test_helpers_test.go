//go:build integration

package agent

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"testing"

	"backend/agent/server"
	"backend/libs/autumn"
	"backend/testinfra"

	"github.com/google/uuid"
)

// Shared rig for the agent package's integration tests. One set of containers
// (Postgres + ClickHouse + Valkey) is started once and reused; each test cleans
// up after itself with cleanupAll. Seeding delegates to testinfra so the helpers
// stay in one place across services.
var (
	th   *testinfra.TestHelper
	deps *server.Deps
)

func TestMain(m *testing.M) {
	ctx := context.Background()

	pgPool, pgCleanup := testinfra.SetupPostgres(ctx)
	chConn, chCleanup := testinfra.SetupClickHouse(ctx)
	vk, vkCleanup := testinfra.SetupValkey(ctx)

	th = testinfra.NewTestHelper(pgPool, chConn, vk)
	deps = &server.Deps{
		PgPool:  pgPool,
		ChPool:  chConn,
		RchPool: chConn,
		VK:      vk,
		Config:  &server.Config{BillingEnabled: true, AgentEnabled: true},
	}

	// Background token tracking must never reach the network in tests. Tests
	// that care about it override autumn.TrackTokens themselves.
	autumn.TrackTokens = func(context.Context, autumn.TrackTokensRequest) error { return nil }

	code := m.Run()

	vkCleanup()
	pgCleanup()
	chCleanup()
	os.Exit(code)
}

// ----------------------------------------------------------------------------
// Seed wrappers — thin callers over testinfra so logic stays shared.
// ----------------------------------------------------------------------------

func cleanupAll(ctx context.Context, t *testing.T) { th.CleanupAll(ctx, t) }

func seedTeam(ctx context.Context, t *testing.T, teamID uuid.UUID, name string) {
	th.SeedTeam(ctx, t, teamID.String(), name)
}

func seedUser(ctx context.Context, t *testing.T, userID uuid.UUID, email string) {
	th.SeedUser(ctx, t, userID.String(), email)
}

func seedTeamMembership(ctx context.Context, t *testing.T, teamID, userID uuid.UUID, role string) {
	th.SeedTeamMembership(ctx, t, teamID.String(), userID.String(), role)
}

func seedApp(ctx context.Context, t *testing.T, appID, teamID uuid.UUID, name string, retention int) {
	th.SeedApp(ctx, t, appID.String(), teamID.String(), name, retention)
}

func seedTeamAutumnCustomer(ctx context.Context, t *testing.T, teamID uuid.UUID, customerID string) {
	th.SeedTeamAutumnCustomer(ctx, t, teamID.String(), customerID)
}

func seedTeamSlack(ctx context.Context, t *testing.T, teamID uuid.UUID, channelIDs []string) {
	th.SeedTeamSlack(ctx, t, teamID.String(), channelIDs)
}

// seedTeamUserApp creates a team, an owner user in it, and an app, returning
// their ids. It's the common precondition for conversation and turn tests,
// which all FK onto these rows.
func seedTeamUserApp(ctx context.Context, t *testing.T) (teamID, userID, appID uuid.UUID) {
	t.Helper()
	teamID, userID, appID = uuid.New(), uuid.New(), uuid.New()
	th.SeedTeam(ctx, t, teamID.String(), "test-team")
	th.SeedUser(ctx, t, userID.String(), fmt.Sprintf("u-%s@test.dev", userID.String()[:8]))
	th.SeedTeamMembership(ctx, t, teamID.String(), userID.String(), "owner")
	th.SeedApp(ctx, t, appID.String(), teamID.String(), fmt.Sprintf("app-%s", appID.String()[:8]), 30)
	return teamID, userID, appID
}

// ----------------------------------------------------------------------------
// LLM stub — one httptest server scripts a turn's successive chat calls.
// ----------------------------------------------------------------------------

// stubLLM answers each /chat/completions request with the next scripted body,
// in order, and records every request so tests can assert what was sent. With
// repeat set it serves the last scripted body for every request past the
// script, so a "model never stops calling tools" loop can be tested.
type stubLLM struct {
	mu        sync.Mutex
	responses []string
	repeat    bool
	calls     int
	requests  [][]byte
}

func (s *stubLLM) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	body, _ := io.ReadAll(r.Body)
	s.requests = append(s.requests, body)
	i := s.calls
	s.calls++
	switch {
	case i < len(s.responses):
		w.Write([]byte(s.responses[i]))
	case s.repeat && len(s.responses) > 0:
		w.Write([]byte(s.responses[len(s.responses)-1]))
	default:
		http.Error(w, `{"error":{"message":"no scripted llm response"}}`, http.StatusInternalServerError)
	}
}

func (s *stubLLM) callCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.calls
}

// newTestAgent wires a *Config to the shared deps and a stub LLM that serves the
// given response bodies in order. Returns the config and the stub for assertions.
func newTestAgent(t *testing.T, responses ...string) (*Config, *stubLLM) {
	t.Helper()
	stub := &stubLLM{responses: responses}
	srv := httptest.NewServer(stub)
	t.Cleanup(srv.Close)
	cfg := &Config{
		Deps:        deps,
		BaseURL:     srv.URL,
		APIKey:      "test-key",
		ModelSmall:  "test-small",
		ModelMedium: "test-medium",
	}
	cfg.initTools()
	return cfg, stub
}
