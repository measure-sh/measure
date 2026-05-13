package testinfra

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/valkey-io/valkey-go"
)

// --------------------------------------------------------------------------
// Pointer helpers
// --------------------------------------------------------------------------

func StrPtr(s string) *string { return &s }
func Int64Ptr(n int64) *int64 { return &n }

// --------------------------------------------------------------------------
// TestHelper holds shared DB connections for test seed/cleanup methods.
// --------------------------------------------------------------------------

type TestHelper struct {
	PgPool *pgxpool.Pool
	ChConn driver.Conn
	VK     valkey.Client
}

func NewTestHelper(pgPool *pgxpool.Pool, chConn driver.Conn, vk valkey.Client) *TestHelper {
	return &TestHelper{PgPool: pgPool, ChConn: chConn, VK: vk}
}

// --------------------------------------------------------------------------
// Cleanup
// --------------------------------------------------------------------------

func (h *TestHelper) CleanupAll(ctx context.Context, t *testing.T) {
	t.Helper()

	// Postgres: dynamically truncate all tables in the measure schema,
	// excluding migration metadata and reference tables with seed data.
	if _, err := h.PgPool.Exec(ctx, `
		DO $$ DECLARE r RECORD;
		BEGIN
			FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'measure' AND tablename NOT IN ('schema_migrations', 'roles') LOOP
				EXECUTE 'TRUNCATE TABLE measure.' || quote_ident(r.tablename) || ' CASCADE';
			END LOOP;
		END $$;
	`); err != nil {
		t.Fatalf("cleanup postgres: %v", err)
	}

	// ClickHouse: dynamically truncate all non-view tables.
	rows, err := h.ChConn.Query(ctx,
		"SELECT name FROM system.tables WHERE database = 'measure' AND engine NOT LIKE '%View%' AND name != 'schema_migrations'")
	if err != nil {
		t.Fatalf("cleanup clickhouse list tables: %v", err)
	}

	var tables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatalf("cleanup clickhouse scan: %v", err)
		}
		tables = append(tables, name)
	}
	rows.Close()

	for _, table := range tables {
		if err := h.ChConn.Exec(ctx, fmt.Sprintf("TRUNCATE TABLE measure.%s", table)); err != nil {
			t.Fatalf("cleanup clickhouse table %s: %v", table, err)
		}
	}

	// Valkey: flush all keys.
	if h.VK != nil {
		if err := h.VK.Do(ctx, h.VK.B().Flushall().Build()).Error(); err != nil {
			t.Fatalf("cleanup valkey: %v", err)
		}
	}
}

// --------------------------------------------------------------------------
// Postgres seed helpers
// --------------------------------------------------------------------------

// SeedTeam inserts a team row.
func (h *TestHelper) SeedTeam(ctx context.Context, t *testing.T, teamID, name string) {
	t.Helper()
	now := time.Now()

	_, err := h.PgPool.Exec(ctx,
		`INSERT INTO teams (id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)`,
		teamID, name, now, now)
	if err != nil {
		t.Fatalf("seed team: %v", err)
	}
}

// SeedTeamAutumnCustomer sets teams.autumn_customer_id for the given team.
func (h *TestHelper) SeedTeamAutumnCustomer(ctx context.Context, t *testing.T, teamID, autumnCustomerID string) {
	t.Helper()
	_, err := h.PgPool.Exec(ctx,
		`UPDATE teams SET autumn_customer_id = $1, updated_at = now() WHERE id = $2`,
		autumnCustomerID, teamID)
	if err != nil {
		t.Fatalf("seed autumn_customer_id: %v", err)
	}
}

func (h *TestHelper) SeedUser(ctx context.Context, t *testing.T, userID, email string) {
	t.Helper()
	now := time.Now()

	_, err := h.PgPool.Exec(ctx,
		`INSERT INTO users (id, email, last_sign_in_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
		userID, email, now, now, now)
	if err != nil {
		t.Fatalf("seed user: %v", err)
	}
}

func (h *TestHelper) SeedTeamMembership(ctx context.Context, t *testing.T, teamID, userID, role string) {
	t.Helper()

	_, err := h.PgPool.Exec(ctx,
		`INSERT INTO team_membership (team_id, user_id, role, role_updated_at) VALUES ($1, $2, $3, $4)`,
		teamID, userID, role, time.Now())
	if err != nil {
		t.Fatalf("seed team_membership: %v", err)
	}
}

func (h *TestHelper) SeedApp(ctx context.Context, t *testing.T, appID, teamID, appName string, retention int) {
	t.Helper()
	now := time.Now()

	_, err := h.PgPool.Exec(ctx,
		`INSERT INTO apps (id, team_id, app_name, unique_identifier, os_name, first_version, onboarded, onboarded_at, retention, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		appID, teamID, appName, appName, "android", "1.0.0", true, now, retention, now, now)
	if err != nil {
		t.Fatalf("seed app: %v", err)
	}
}

func (h *TestHelper) SeedAPIKey(
	ctx context.Context,
	t *testing.T,
	appID, keyPrefix, keyValue, checksum string,
	revoked bool,
	lastSeen *time.Time,
	createdAt time.Time,
) {
	t.Helper()

	_, err := h.PgPool.Exec(ctx,
		`INSERT INTO api_keys (app_id, key_prefix, key_value, checksum, revoked, last_seen, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		appID, keyPrefix, keyValue, checksum, revoked, lastSeen, createdAt)
	if err != nil {
		t.Fatalf("seed api_key: %v", err)
	}
}

// --------------------------------------------------------------------------
// ClickHouse seed helpers
// --------------------------------------------------------------------------

func (h *TestHelper) SeedIngestionUsage(ctx context.Context, t *testing.T, teamID, appID string, ts time.Time, events, spans, metrics uint32, bytesIn uint64) {
	t.Helper()

	query := fmt.Sprintf(`
		INSERT INTO ingestion_metrics
		SELECT '%s', '%s', toDateTime64('%s', 3, 'UTC'),
			sumState(toUInt32(0)),
			sumState(toUInt32(%d)),
			sumState(toUInt32(%d)),
			sumState(toUInt32(0)),
			sumState(toUInt32(%d)),
			sumState(toUInt64(%d))
		FROM system.one`,
		teamID, appID, ts.UTC().Format("2006-01-02 15:04:05"), events, spans, metrics, bytesIn)

	if err := h.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed ingestion usage: %v", err)
	}
}

func (h *TestHelper) SeedEvents(ctx context.Context, t *testing.T, teamID, appID string, count int) {
	t.Helper()
	for i := 0; i < count; i++ {
		query := fmt.Sprintf(
			`INSERT INTO measure.events (id, type, session_id, app_id, team_id, timestamp, user_triggered, `+
				"`attribute.installation_id`, `attribute.app_version`, `attribute.app_build`, "+
				"`attribute.app_unique_id`, `attribute.platform`, `attribute.measure_sdk_version`) "+
				`VALUES ('%s', 'test', '%s', '%s', '%s', now(), false, '%s', 'v1', '1', 'com.test', 'android', '0.1')`,
			uuid.New().String(), uuid.New().String(), appID, teamID, uuid.New().String())
		if err := h.ChConn.Exec(ctx, query); err != nil {
			t.Fatalf("seed events: %v", err)
		}
	}
}

// SeedGenericEvents inserts count generic ("test" type) events at the given
// timestamp using a single bulk INSERT…SELECT FROM numbers(count). Each row
// gets a server-generated UUID for its id, session_id, and installation_id,
// so every event represents a distinct session.
func (h *TestHelper) SeedGenericEvents(ctx context.Context, t *testing.T, teamID, appID string, count int, ts time.Time) {
	t.Helper()
	query := fmt.Sprintf(
		`INSERT INTO measure.events (id, type, session_id, app_id, team_id, timestamp, user_triggered, `+
			"`attribute.installation_id`, `attribute.app_version`, `attribute.app_build`, "+
			"`attribute.app_unique_id`, `attribute.platform`, `attribute.measure_sdk_version`) "+
			`SELECT generateUUIDv4(), 'test', generateUUIDv4(), '%s', '%s', '%s', false, generateUUIDv4(), 'v1', '1', 'com.test', 'android', '0.1' FROM numbers(%d)`,
		appID, teamID, ts.UTC().Format("2006-01-02 15:04:05"), count)
	if err := h.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed generic events: %v", err)
	}
}

// SeedIssueEvent inserts a single exception or ANR event with explicit handled
// state and fingerprint, using a random session_id.
//
// eventType must be "exception" or "anr".
// fingerprint may be empty for default FixedString(32) zero-byte value.
func (h *TestHelper) SeedIssueEvent(
	ctx context.Context,
	t *testing.T,
	teamID, appID, eventType, fingerprint string,
	handled bool,
	ts time.Time,
) {
	t.Helper()
	h.SeedIssueEventInSession(ctx, t, teamID, appID, uuid.New().String(), eventType, fingerprint, handled, ts)
}

// SeedIssueEventInSession inserts a single exception or ANR event with an
// explicit session_id, handled state, and fingerprint. Use this when events
// must share a session_id (e.g. common-path tests). Exception/ANR data
// columns are left empty (default ClickHouse values).
//
// eventType must be "exception" or "anr".
func (h *TestHelper) SeedIssueEventInSession(
	ctx context.Context,
	t *testing.T,
	teamID, appID, sessionID, eventType, fingerprint string,
	handled bool,
	ts time.Time,
) {
	t.Helper()
	h.SeedIssueEventWithDataInSession(ctx, t, teamID, appID, sessionID, eventType, fingerprint, handled, "", ts)
}

// SeedIssueEventWithDataInSession inserts an exception or ANR event with
// explicit exception/ANR JSON data. When exceptionsJSON is non-empty it is
// written to both exception.exceptions and anr.exceptions columns so the
// row is reusable across issue-oriented queries.
//
// eventType must be "exception" or "anr".
func (h *TestHelper) SeedIssueEventWithDataInSession(
	ctx context.Context,
	t *testing.T,
	teamID, appID, sessionID, eventType, fingerprint string,
	handled bool,
	exceptionsJSON string,
	ts time.Time,
) {
	t.Helper()
	query := fmt.Sprintf(
		`INSERT INTO measure.events (id, type, session_id, app_id, team_id, timestamp, user_triggered, `+
			"`attribute.installation_id`, `attribute.app_version`, `attribute.app_build`, "+
			"`attribute.app_unique_id`, `attribute.platform`, `attribute.measure_sdk_version`, "+
			"`exception.handled`, `exception.foreground`, `exception.fingerprint`, `exception.exceptions`, "+
			"`anr.handled`, `anr.foreground`, `anr.fingerprint`, `anr.exceptions`) "+
			`VALUES ('%s', '%s', '%s', '%s', '%s', '%s', false, '%s', 'v1', '1', 'com.test', 'android', '0.1', %t, true, '%s', '%s', %t, true, '%s', '%s')`,
		uuid.New().String(), eventType, sessionID, appID, teamID,
		ts.UTC().Format("2006-01-02 15:04:05"), uuid.New().String(),
		handled, fingerprint, exceptionsJSON, handled, fingerprint, exceptionsJSON)
	if err := h.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed issue event with data (%s): %v", eventType, err)
	}
}

// SeedNavigationEventInSession inserts a navigation event with a known
// session_id and destination screen name.
func (h *TestHelper) SeedNavigationEventInSession(ctx context.Context, t *testing.T, teamID, appID, sessionID, destination string, ts time.Time) {
	t.Helper()
	query := fmt.Sprintf(
		`INSERT INTO measure.events (id, type, session_id, app_id, team_id, timestamp, user_triggered, `+
			"`attribute.installation_id`, `attribute.app_version`, `attribute.app_build`, "+
			"`attribute.app_unique_id`, `attribute.platform`, `attribute.measure_sdk_version`, "+
			"`navigation.to`) "+
			`VALUES ('%s', 'navigation', '%s', '%s', '%s', '%s', false, '%s', 'v1', '1', 'com.test', 'android', '0.1', '%s')`,
		uuid.New().String(), sessionID, appID, teamID,
		ts.UTC().Format("2006-01-02 15:04:05"), uuid.New().String(), destination)
	if err := h.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed navigation event: %v", err)
	}
}

// SeedEventWithSession inserts one event with a known session_id so that
// sessions_index gets populated via the materialized view.
func (h *TestHelper) SeedEventWithSession(ctx context.Context, t *testing.T, teamID, appID, sessionID string, ts time.Time) {
	t.Helper()
	query := fmt.Sprintf(
		`INSERT INTO measure.events (id, type, session_id, app_id, team_id, timestamp, user_triggered, `+
			"`attribute.installation_id`, `attribute.app_version`, `attribute.app_build`, "+
			"`attribute.app_unique_id`, `attribute.platform`, `attribute.measure_sdk_version`) "+
			`VALUES ('%s', 'test', '%s', '%s', '%s', '%s', false, '%s', 'v1', '1', 'com.test', 'android', '0.1')`,
		uuid.New().String(), sessionID, appID, teamID,
		ts.UTC().Format("2006-01-02 15:04:05"), uuid.New().String())
	if err := h.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed event with session: %v", err)
	}
}

// SeedExceptionGroup inserts a row into fatal_exception_groups so that
// crash-alert group-info lookups succeed. fingerprint must be exactly 32
// characters to match the FixedString(32) id column.
func (h *TestHelper) SeedExceptionGroup(ctx context.Context, t *testing.T, teamID, appID, fingerprint string) {
	t.Helper()

	query := `insert into
		fatal_exception_groups (
			team_id, app_id, id, app_version, type, message, method_name, file_name, line_number, os_versions, country_codes, network_providers, network_types, network_generations, device_locales, device_manufacturers, device_names, device_models, count, timestamp
		)
		select
			toUUID(?),
			toUUID(?),
			?,
			('v1', '1'),
			'java.lang.RuntimeException',
			'Test crash',
			'testMethod',
			'TestFile.java',
			42,
			groupUniqArrayState(tuple('android', '33')),
			groupUniqArrayState('US'),
			groupUniqArrayState('Verizon'),
			groupUniqArrayState('cellular'),
			groupUniqArrayState('5g'),
			groupUniqArrayState('en-US'),
			groupUniqArrayState('Google'),
			groupUniqArrayState('Pixel'),
			groupUniqArrayState('Pixel 8'),
			sumState(toUInt64(1)),
			now64(3)`

	if err := h.ChConn.Exec(ctx, query, []any{teamID, appID, fingerprint}...); err != nil {
		t.Fatalf("seed exception group: %v", err)
	}
}

// SeedAnrGroup inserts a row into anr_groups so that ANR-alert group-info
// lookups succeed. fingerprint must be exactly 32 characters.
func (h *TestHelper) SeedAnrGroup(ctx context.Context, t *testing.T, teamID, appID, fingerprint string) {
	t.Helper()

	query := `insert into
		anr_groups (
			team_id, app_id, id, app_version, type, message, method_name, file_name, line_number, os_versions, country_codes, network_providers, network_types, network_generations, device_locales, device_manufacturers, device_names, device_models, count, timestamp
		)
		select
			toUUID(?),
			toUUID(?),
			?,
			('v1', '1'),
			'ANR',
			'Test ANR',
			'testMethod',
			'TestFile.java',
			42,
			groupUniqArrayState(tuple('android', '33')),
			groupUniqArrayState('US'),
			groupUniqArrayState('Verizon'),
			groupUniqArrayState('cellular'),
			groupUniqArrayState('5g'),
			groupUniqArrayState('en-US'),
			groupUniqArrayState('Google'),
			groupUniqArrayState('Pixel'),
			groupUniqArrayState('Pixel 8'),
			sumState(toUInt64(1)),
			now64(3)`

	if err := h.ChConn.Exec(ctx, query, []any{teamID, appID, fingerprint}...); err != nil {
		t.Fatalf("seed ANR group: %v", err)
	}
}

// SeedAppMetrics inserts generic, exception/error, and ANR events so that
// the app_metrics_mv materialised view populates app_metrics. Each event gets
// a unique session_id, so:
//
//	total_sessions = genericCount + crashCount + anrCount
//	crash_sessions = crashCount   (type="exception", exception.handled=false)
//	anr_sessions   = anrCount     (type="anr")
func (h *TestHelper) SeedAppMetrics(ctx context.Context, t *testing.T, teamID, appID string, ts time.Time, genericCount, crashCount, anrCount int) {
	t.Helper()
	if genericCount > 0 {
		h.SeedGenericEvents(ctx, t, teamID, appID, genericCount, ts)
	}
	for i := 0; i < crashCount; i++ {
		h.SeedIssueEvent(ctx, t, teamID, appID, "exception", "", false, ts)
	}
	for i := 0; i < anrCount; i++ {
		h.SeedIssueEvent(ctx, t, teamID, appID, "anr", "", false, ts)
	}
}

// SeedLaunchEvent inserts a single cold_launch, warm_launch, or hot_launch
// event with the given p95-contributing duration. durationMs must be > 0.
func (h *TestHelper) SeedLaunchEvent(ctx context.Context, t *testing.T, teamID, appID, launchType string, durationMs uint32, ts time.Time) {
	t.Helper()
	durationCol := fmt.Sprintf("`%s.duration`", launchType)
	query := fmt.Sprintf(
		`INSERT INTO measure.events (id, type, session_id, app_id, team_id, timestamp, user_triggered, `+
			"`attribute.installation_id`, `attribute.app_version`, `attribute.app_build`, "+
			"`attribute.app_unique_id`, `attribute.platform`, `attribute.measure_sdk_version`, "+
			"%s) "+
			`VALUES ('%s', '%s', '%s', '%s', '%s', '%s', false, '%s', 'v1', '1', 'com.test', 'android', '0.1', %d)`,
		durationCol,
		uuid.New().String(), launchType, uuid.New().String(), appID, teamID,
		ts.UTC().Format("2006-01-02 15:04:05"), uuid.New().String(), durationMs)
	if err := h.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed launch event (%s): %v", launchType, err)
	}
}

// SeedBugReport inserts a single bug report into the bug_reports table.
func (h *TestHelper) SeedBugReport(ctx context.Context, t *testing.T, teamID, appID, eventID, description string, ts time.Time) {
	t.Helper()
	query := fmt.Sprintf(`
		INSERT INTO measure.bug_reports
		(team_id, event_id, app_id, session_id, timestamp, updated_at, status, description, app_version, os_version, country_code, network_provider, network_type, network_generation, device_locale, device_manufacturer, device_name, device_model, user_id, device_low_power_mode, device_thermal_throttling_enabled, user_defined_attribute, attachments)
		VALUES (toUUID('%s'), '%s', '%s', '%s', '%s', '%s', 1, '%s', ('v1', 'b1'), ('Android', '14'), 'US', 'Verizon', 'wifi', '4g', 'en-US', 'Google', 'Pixel', 'Pixel 6', 'u1', false, false, map('test', (1, 'val')), '[]')`,
		teamID, eventID, appID, uuid.New().String(), ts.UTC().Format("2006-01-02 15:04:05"), ts.UTC().Format("2006-01-02 15:04:05"), description)
	if err := h.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed bug report: %v", err)
	}
}

// SeedTeamSlack inserts an active Slack integration for a team.
// channelIDs may be empty (integration exists but no channels configured).
func (h *TestHelper) SeedTeamSlack(ctx context.Context, t *testing.T, teamID string, channelIDs []string) {
	t.Helper()
	_, err := h.PgPool.Exec(ctx,
		`INSERT INTO team_slack
		(team_id, slack_team_id, slack_team_name, bot_token, bot_user_id, channel_ids, is_active, created_at, updated_at)
		VALUES ($1, left($1::text, 8), 'Test Workspace', 'xoxb-test-token', 'U12345', $2, true, now(), now())`,
		teamID, channelIDs)
	if err != nil {
		t.Fatalf("seed team_slack: %v", err)
	}
}

func (h *TestHelper) SeedAppThresholdPrefs(ctx context.Context, t *testing.T, appID string, errorGoodThreshold, errorCautionThreshold float64, errorSpikeMinCountThreshold int, errorSpikeMinRateThreshold float64) {
	t.Helper()
	_, err := h.PgPool.Exec(ctx,
		`INSERT INTO measure.app_threshold_prefs
		(app_id, error_good_threshold, error_caution_threshold, error_spike_min_count_threshold, error_spike_min_rate_threshold, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, now(), now())`,
		appID, errorGoodThreshold, errorCautionThreshold, errorSpikeMinCountThreshold, errorSpikeMinRateThreshold)
	if err != nil {
		t.Fatalf("seed app_threshold_prefs: %v", err)
	}
}

func (h *TestHelper) SeedSpans(ctx context.Context, t *testing.T, teamID, appID string, count int) {
	t.Helper()
	for i := 0; i < count; i++ {
		ts := time.Now().UTC().Add(time.Duration(i) * time.Second)
		h.SeedSpan(ctx, t, teamID, appID, "test", 1, ts, ts, "v1", "1")
	}
}

// SeedSpan inserts one span at the provided time window so span_metrics_mv
// can materialize rows for plot aggregation tests. Returns the generated
// traceID so callers can use it for trace detail lookups.
func (h *TestHelper) SeedSpan(
	ctx context.Context,
	t *testing.T,
	teamID, appID, spanName string,
	status uint8,
	startTime, endTime time.Time,
	appVersion, appBuild string,
) string {
	t.Helper()

	traceID := strings.ReplaceAll(uuid.New().String(), "-", "")
	spanID := traceID[:16]

	query := fmt.Sprintf(
		`INSERT INTO measure.spans (team_id, app_id, span_name, span_id, trace_id, session_id, status, `+
			"start_time, end_time, "+
			"`attribute.app_unique_id`, `attribute.installation_id`, "+
			"`attribute.measure_sdk_version`, `attribute.app_version`, `attribute.os_version`, "+
			"`attribute.platform`, `attribute.device_low_power_mode`, `attribute.device_thermal_throttling_enabled`) "+
			`VALUES ('%s', '%s', '%s', '%s', '%s', '%s', %d, '%s', '%s', 'com.test', '%s', '0.1', ('%s','%s'), ('Android','14'), 'android', false, false)`,
		teamID, appID, spanName, spanID, traceID, uuid.New().String(), status,
		startTime.UTC().Format("2006-01-02 15:04:05"), endTime.UTC().Format("2006-01-02 15:04:05"),
		uuid.New().String(), appVersion, appBuild,
	)
	if err := h.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed span: %v", err)
	}
	return traceID
}

// --------------------------------------------------------------------------
// MCP seed helpers
// --------------------------------------------------------------------------

// SeedMCPClient inserts a row into measure.mcp_clients.
// The clientSecret is stored as a sha256 hex hash of rawSecret.
func (h *TestHelper) SeedMCPClient(ctx context.Context, t *testing.T, clientID, clientName string, redirectURIs []string, rawSecret string) {
	t.Helper()
	hash := sha256HexTestinfra(rawSecret)
	_, err := h.PgPool.Exec(ctx,
		`INSERT INTO measure.mcp_clients (client_id, client_secret, client_name, redirect_uris)
		 VALUES ($1, $2, $3, $4)`,
		clientID, hash, clientName, redirectURIs)
	if err != nil {
		t.Fatalf("seed mcp_client: %v", err)
	}
}

// SeedMCPAuthCode inserts a row into measure.mcp_auth_codes.
func (h *TestHelper) SeedMCPAuthCode(ctx context.Context, t *testing.T, code, userID, clientID, redirectURI, codeChallenge string, expiresAt time.Time, providerToken, provider string) {
	t.Helper()
	var pt *string
	if providerToken != "" {
		pt = &providerToken
	}
	var prov *string
	if provider != "" {
		prov = &provider
	}
	_, err := h.PgPool.Exec(ctx,
		`INSERT INTO measure.mcp_auth_codes (code, user_id, client_id, redirect_uri, code_challenge, provider, provider_token, expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		code, userID, clientID, redirectURI, codeChallenge, prov, pt, expiresAt)
	if err != nil {
		t.Fatalf("seed mcp_auth_code: %v", err)
	}
}

// SeedMCPAccessToken hashes rawToken and inserts a row into measure.mcp_access_tokens.
// When providerToken is non-empty, provider and provider_token_checked_at are also set.
// If provider is empty and providerToken is non-empty, defaults to "github".
func (h *TestHelper) SeedMCPAccessToken(ctx context.Context, t *testing.T, rawToken, userID, clientID string, expiresAt time.Time, providerToken, provider string) {
	t.Helper()
	hash := sha256HexTestinfra(rawToken)
	if providerToken != "" {
		if provider == "" {
			provider = "github"
		}
		_, err := h.PgPool.Exec(ctx,
			`INSERT INTO measure.mcp_access_tokens (token_hash, user_id, client_id, expires_at, provider, provider_token, provider_token_checked_at)
			 VALUES ($1, $2, $3, $4, $5, $6, now())`,
			hash, userID, clientID, expiresAt, provider, providerToken)
		if err != nil {
			t.Fatalf("seed mcp_access_token: %v", err)
		}
	} else {
		_, err := h.PgPool.Exec(ctx,
			`INSERT INTO measure.mcp_access_tokens (token_hash, user_id, client_id, expires_at)
			 VALUES ($1, $2, $3, $4)`,
			hash, userID, clientID, expiresAt)
		if err != nil {
			t.Fatalf("seed mcp_access_token: %v", err)
		}
	}
}

// SeedHttpEvent inserts count rows into the events table with type='http',
// setting http.url, http.method, http.status_code, http.start_time and
// http.end_time (100ms latency). url must be a full URL
// like "https://api.example.com/api/v1/users".
func (h *TestHelper) SeedHttpEvent(
	ctx context.Context,
	t *testing.T,
	teamID, appID, url, method string,
	statusCode int,
	count int,
	ts time.Time,
) {
	t.Helper()
	tsStr := ts.UTC().Format("2006-01-02 15:04:05")
	query := fmt.Sprintf(
		`INSERT INTO measure.events (id, type, session_id, app_id, team_id, timestamp, inserted_at, user_triggered, `+
			"`attribute.installation_id`, `attribute.app_version`, `attribute.app_build`, "+
			"`attribute.app_unique_id`, `attribute.platform`, `attribute.measure_sdk_version`, "+
			"`http.url`, `http.method`, `http.status_code`, `http.start_time`, `http.end_time`, `inet.country_code`) "+
			`SELECT generateUUIDv4(), 'http', generateUUIDv4(), '%s', '%s', toDateTime64('%s', 3, 'UTC') + toIntervalMillisecond(number), '%s', false, generateUUIDv4(), 'v1', '1', 'com.test', 'android', '0.1', '%s', '%s', %d, 1000, 1100, 'US' FROM numbers(%d)`,
		appID, teamID, tsStr, tsStr, url, method, statusCode, count)
	if err := h.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed http event: %v", err)
	}
}

// SeedUrlPattern inserts a single row into the url_patterns table.
func (h *TestHelper) SeedUrlPattern(
	ctx context.Context,
	t *testing.T,
	teamID, appID, domain, path string,
) {
	t.Helper()
	query := fmt.Sprintf(
		`INSERT INTO url_patterns (team_id, app_id, domain, path, updated_at, updated_by) VALUES ('%s', '%s', '%s', '%s', now(), '%s')`,
		teamID, appID, domain, path, uuid.Nil.String())
	if err := h.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed url_patterns: %v", err)
	}
}

// sha256HexTestinfra returns the hex-encoded SHA-256 hash of s.
func sha256HexTestinfra(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}
