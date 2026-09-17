//go:build integration

package mcp

import (
	"backend/agent/server"
	"backend/libs/authsession"
	"backend/libs/autumn"
	"backend/testinfra"
	"context"
	"fmt"
	"io"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// --------------------------------------------------------------------------
// TestMain — one-time setup: spin up containers, run migrations, wire server
// --------------------------------------------------------------------------

var (
	th   *testinfra.TestHelper
	deps *server.Deps
	h    Handlers
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
		Config: &server.Config{
			BillingEnabled:     true,
			AgentEnabled:       true,
			AccessTokenSecret:  []byte("test-access-secret-at-least-32-characters"),
			RefreshTokenSecret: []byte("test-refresh-secret-at-least-32-character"),
		},
	}
	h = NewHandlers(deps)

	// Default no-op Autumn mocks so tests that incidentally trigger team
	// creation (e.g. MCP signup flows) don't need their own mocks.
	// Tests that care about Autumn behavior override these per-test.
	autumn.GetOrCreateCustomer = func(_ context.Context, id, email, name string) (*autumn.Customer, error) {
		return &autumn.Customer{ID: id, Email: email, Name: name}, nil
	}
	autumn.Attach = func(_ context.Context, req autumn.AttachRequest) (*autumn.AttachResponse, error) {
		return &autumn.AttachResponse{CustomerID: req.CustomerID}, nil
	}

	code := m.Run()

	vkCleanup()
	pgCleanup()
	chCleanup()
	os.Exit(code)
}

// setConfig applies overrides to the shared test config and restores the
// previous values when the test finishes, so config changes never leak
// across tests and the suite stays order-independent. Tests must use this
// instead of assigning deps.Config fields directly.
func setConfig(t *testing.T, mutate func(c *server.Config)) {
	t.Helper()
	orig := *deps.Config
	mutate(deps.Config)
	t.Cleanup(func() { *deps.Config = orig })
}

// --------------------------------------------------------------------------
// Thin wrappers delegating to testinfra.TestHelper
// --------------------------------------------------------------------------

func cleanupAll(ctx context.Context, t *testing.T) {
	th.CleanupAll(ctx, t)
}

func seedTeam(ctx context.Context, t *testing.T, teamID uuid.UUID, name string) {
	th.SeedTeam(ctx, t, teamID.String(), name)
}

func seedUser(ctx context.Context, t *testing.T, userID, email string) {
	th.SeedUser(ctx, t, userID, email)
}

func seedTeamMembership(ctx context.Context, t *testing.T, teamID uuid.UUID, userID, role string) {
	th.SeedTeamMembership(ctx, t, teamID.String(), userID, role)
}

func seedApp(ctx context.Context, t *testing.T, appID, teamID uuid.UUID, retention int) {
	th.SeedApp(ctx, t, appID.String(), teamID.String(), fmt.Sprintf("app-%s", appID.String()[:8]), retention)
}

func seedEventRows(ctx context.Context, t *testing.T, teamID, appID string, count int, row testinfra.EventRow) {
	th.SeedEventRows(ctx, t, teamID, appID, count, row)
}

func seedAppMetrics(ctx context.Context, t *testing.T, teamID, appID string, ts time.Time, genericCount, crashCount, anrCount int) {
	th.SeedAppMetrics(ctx, t, teamID, appID, ts, genericCount, crashCount, anrCount)
}

func seedHttpEvent(ctx context.Context, t *testing.T, teamID, appID, url, method string, statusCode, count int, ts time.Time) {
	th.SeedHttpEvent(ctx, t, teamID, appID, url, method, statusCode, count, ts)
}

func seedUrlPattern(ctx context.Context, t *testing.T, teamID, appID, domain, path string) {
	th.SeedUrlPattern(ctx, t, teamID, appID, domain, path)
}

func seedHttpMetrics(
	ctx context.Context,
	t *testing.T,
	teamID, appID, domain, path string,
	requestCount, count2xx, count4xx, count5xx uint64,
	ts time.Time,
) {
	t.Helper()
	tsStr := ts.UTC().Format("2006-01-02 15:04:05")
	query := fmt.Sprintf(
		`INSERT INTO http_metrics
		SELECT
			'%s' AS team_id,
			'%s' AS app_id,
			'%s' AS timestamp,
			'%s' AS domain,
			'%s' AS path,
			['https'] AS protocols,
			[toUInt16(443)] AS ports,
			['GET'] AS methods,
			[toUInt16(200)] AS status_codes,
			[('1.0','1')] AS app_versions,
			[('android','14')] AS os_versions,
			[''] AS patch_versions,
			[toUUID('00000000-0000-0000-0000-000000000000')] AS patch_ids,
			['samsung'] AS device_manufacturers,
			['galaxy'] AS device_names,
			['provider'] AS network_providers,
			['wifi'] AS network_types,
			['4g'] AS network_generations,
			['en_US'] AS device_locales,
			['US'] AS `+"`inet.country_code`"+`,
			%d AS request_count,
			%d AS count_2xx,
			0 AS count_3xx,
			%d AS count_4xx,
			%d AS count_5xx,
			(SELECT quantilesState(0.5, 0.75, 0.90, 0.95, 0.99)(toInt64(100)) FROM numbers(%d)),
			([toUInt32(5),toUInt32(10)],[toUInt64(%d),toUInt64(%d)]) AS session_elapsed_counts,
			(SELECT uniqCombined64State(generateUUIDv4()) FROM numbers(%d))`,
		teamID, appID, tsStr,
		domain, path,
		requestCount,
		count2xx,
		count4xx,
		count5xx,
		requestCount,
		requestCount/2, requestCount-requestCount/2,
		requestCount,
	)
	if err := th.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed http_metrics: %v", err)
	}
}

func seedBugReport(ctx context.Context, t *testing.T, teamID, appID, eventID, description string, ts time.Time) {
	th.SeedBugReport(ctx, t, teamID, appID, eventID, description, ts)
}

func seedSpan(
	ctx context.Context,
	t *testing.T,
	teamID, appID, spanName string,
	status uint8,
	startTime, endTime time.Time,
	appVersion, appBuild string,
) string {
	return th.SeedSpan(ctx, t, teamID, appID, spanName, status, startTime, endTime, appVersion, appBuild)
}

func seedSpanUDAttr(ctx context.Context, t *testing.T, teamID, appID string, row testinfra.SpanUDAttrRow) {
	th.SeedSpanUDAttrRow(ctx, t, teamID, appID, row)
}

func seedEventWithSession(ctx context.Context, t *testing.T, teamID, appID, sessionID string, ts time.Time) {
	th.SeedEventWithSession(ctx, t, teamID, appID, sessionID, ts)
}

// --------------------------------------------------------------------------
// Gin test context
// --------------------------------------------------------------------------

func newTestGinContext(method, path string, body io.Reader) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(method, path, body)
	c.Request.Header.Set("Content-Type", "application/json")
	return c, w
}

// --------------------------------------------------------------------------
// MCP seed / read helpers
// --------------------------------------------------------------------------

func seedMCPClient(ctx context.Context, t *testing.T, clientID, clientName string, redirectURIs []string) {
	th.SeedMCPClient(ctx, t, clientID, clientName, redirectURIs)
}

func seedMCPAuthCode(ctx context.Context, t *testing.T, code, userID, clientID, redirectURI, codeChallenge string, expiresAt time.Time) {
	th.SeedMCPAuthCode(ctx, t, code, userID, clientID, redirectURI, codeChallenge, expiresAt, "", "")
}

func seedMCPAuthCodeWithProvider(ctx context.Context, t *testing.T, code, userID, clientID, redirectURI, codeChallenge string, expiresAt time.Time, providerToken, provider string) {
	th.SeedMCPAuthCode(ctx, t, code, userID, clientID, redirectURI, codeChallenge, expiresAt, providerToken, provider)
}

// seedMCPSession opens a session and returns a signed access token for it.
func seedMCPSession(ctx context.Context, t *testing.T, userID, clientID string, expiresAt time.Time) string {
	return seedMCPSessionWithProvider(ctx, t, userID, clientID, expiresAt, "", "")
}

func seedMCPSessionWithProvider(ctx context.Context, t *testing.T, userID, clientID string, expiresAt time.Time, providerToken, provider string) string {
	t.Helper()
	sessionID := uuid.New()
	th.SeedMCPAuthSession(ctx, t, sessionID.String(), userID, clientID, sessionID.String(), expiresAt, time.Now().Add(mcpRefreshTokenExpiry), providerToken, provider)
	token, err := authsession.CreateAccessToken(deps.Config.AccessTokenSecret, sessionID, sessionID, uuid.MustParse(userID), expiresAt, authsession.AudienceMCP)
	if err != nil {
		t.Fatalf("sign access token: %v", err)
	}
	return token
}

func seedMCPRefreshToken(t *testing.T, sessionID uuid.UUID, expiresAt time.Time) string {
	return seedMCPRefreshTokenWithID(t, sessionID, sessionID, expiresAt)
}

func seedMCPRefreshTokenWithID(t *testing.T, sessionID, tokenID uuid.UUID, expiresAt time.Time) string {
	t.Helper()
	token, err := authsession.CreateRefreshToken(deps.Config.RefreshTokenSecret, tokenID, sessionID, expiresAt, authsession.AudienceMCP)
	if err != nil {
		t.Fatalf("sign refresh token: %v", err)
	}
	return token
}

// ageProviderCheck backdates a session's provider check so the next refresh
// re-validates it.
func ageProviderCheck(ctx context.Context, t *testing.T, sessionID uuid.UUID) {
	t.Helper()
	if _, err := th.PgPool.Exec(ctx,
		`UPDATE measure.mcp_auth_sessions SET provider_token_checked_at = now() - interval '2 hours' WHERE id = $1`,
		sessionID); err != nil {
		t.Fatalf("age provider check: %v", err)
	}
}

func sessionIDOf(t *testing.T, rawToken string) uuid.UUID {
	t.Helper()
	claims, err := mcpParseSignedToken(rawToken, deps.Config.AccessTokenSecret)
	if err != nil {
		claims, err = mcpParseSignedToken(rawToken, deps.Config.RefreshTokenSecret)
	}
	if err != nil {
		t.Fatalf("parse token: %v", err)
	}
	claim := "jti"
	if _, ok := claims["sid"]; ok {
		claim = "sid"
	}
	id, idErr := mcpClaimUUID(claims, claim)
	if idErr != nil {
		t.Fatalf("read %s: %v", claim, idErr)
	}
	return id
}

type mcpSessionRow struct {
	ID                     uuid.UUID
	UserID                 uuid.UUID
	ClientID               string
	Provider               *string
	ProviderToken          *string
	ProviderTokenCheckedAt *time.Time
	RefreshTokenID         uuid.UUID
	AccessExpiresAt        time.Time
	RefreshExpiresAt       time.Time
}

func getMCPSession(ctx context.Context, t *testing.T, sessionID uuid.UUID) *mcpSessionRow {
	t.Helper()
	var r mcpSessionRow
	err := th.PgPool.QueryRow(ctx,
		`SELECT id, user_id, client_id, provider, provider_token, provider_token_checked_at, rt_jti, at_expiry_at, rt_expiry_at
		 FROM measure.mcp_auth_sessions WHERE id = $1`, sessionID).
		Scan(&r.ID, &r.UserID, &r.ClientID, &r.Provider, &r.ProviderToken, &r.ProviderTokenCheckedAt, &r.RefreshTokenID, &r.AccessExpiresAt, &r.RefreshExpiresAt)
	if err != nil {
		return nil
	}
	return &r
}

type mcpAuthCodeRow struct {
	ID            uuid.UUID
	Code          string
	UserID        uuid.UUID
	ClientID      string
	RedirectURI   string
	CodeChallenge string
	Provider      *string
	ProviderToken *string
	ExpiresAt     time.Time
	Used          bool
}

func getMCPAuthCode(ctx context.Context, t *testing.T, code string) *mcpAuthCodeRow {
	t.Helper()
	var r mcpAuthCodeRow
	err := th.PgPool.QueryRow(ctx,
		`SELECT id, code, user_id, client_id, redirect_uri, code_challenge, provider, provider_token, expires_at, used
		 FROM measure.mcp_auth_codes WHERE code = $1`, code).
		Scan(&r.ID, &r.Code, &r.UserID, &r.ClientID, &r.RedirectURI, &r.CodeChallenge, &r.Provider, &r.ProviderToken, &r.ExpiresAt, &r.Used)
	if err != nil {
		return nil
	}
	return &r
}
