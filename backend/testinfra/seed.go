package testinfra

import (
	"context"
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

func (h *TestHelper) SeedTeam(ctx context.Context, t *testing.T, teamID, name string, allowIngest bool) {
	t.Helper()
	now := time.Now()

	_, err := h.PgPool.Exec(ctx,
		`INSERT INTO teams (id, name, allow_ingest, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
		teamID, name, allowIngest, now, now)
	if err != nil {
		t.Fatalf("seed team: %v", err)
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
		`INSERT INTO apps (id, team_id, app_name, retention, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
		appID, teamID, appName, retention, now, now)
	if err != nil {
		t.Fatalf("seed app: %v", err)
	}
}

func (h *TestHelper) SeedTeamBilling(ctx context.Context, t *testing.T, teamID, plan string, stripeCustomerID, stripeSubscriptionID *string) {
	t.Helper()
	now := time.Now()

	_, err := h.PgPool.Exec(ctx,
		`INSERT INTO team_billing (team_id, plan, stripe_customer_id, stripe_subscription_id, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		teamID, plan, stripeCustomerID, stripeSubscriptionID, now, now)
	if err != nil {
		t.Fatalf("seed team_billing: %v", err)
	}
}

func (h *TestHelper) SeedTeamIngestBlocked(ctx context.Context, t *testing.T, teamID string, reason string) {
	t.Helper()

	_, err := h.PgPool.Exec(ctx,
		`UPDATE teams SET allow_ingest = false, ingest_blocked_reason = $1 WHERE id = $2`,
		reason, teamID)
	if err != nil {
		t.Fatalf("seed ingest blocked: %v", err)
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

func (h *TestHelper) SeedBillingMetricsReporting(ctx context.Context, t *testing.T, teamID string, reportDate time.Time, events, spans, metrics uint64, reported bool) {
	t.Helper()
	var reportedAt interface{}
	if reported {
		reportedAt = time.Now()
	}

	_, err := h.PgPool.Exec(ctx,
		`INSERT INTO billing_metrics_reporting (team_id, report_date, events, spans, metrics, reported_at) VALUES ($1, $2, $3, $4, $5, $6)`,
		teamID, reportDate, events, spans, metrics, reportedAt)
	if err != nil {
		t.Fatalf("seed billing_metrics_reporting: %v", err)
	}
}

func (h *TestHelper) SetStripeCustomerID(ctx context.Context, t *testing.T, teamID, customerID string) {
	t.Helper()
	_, err := h.PgPool.Exec(ctx,
		"UPDATE team_billing SET stripe_customer_id = $1 WHERE team_id = $2",
		customerID, teamID)
	if err != nil {
		t.Fatalf("set stripe_customer_id: %v", err)
	}
}

// --------------------------------------------------------------------------
// ClickHouse seed helpers
// --------------------------------------------------------------------------

func (h *TestHelper) SeedIngestionUsage(ctx context.Context, t *testing.T, teamID, appID string, ts time.Time, events, spans, metrics uint32) {
	t.Helper()

	query := fmt.Sprintf(`
		INSERT INTO ingestion_metrics
		SELECT '%s', '%s', toDateTime64('%s', 3, 'UTC'),
			sumState(toUInt32(0)),
			sumState(toUInt32(%d)),
			sumState(toUInt32(%d)),
			sumState(toUInt32(0)),
			sumState(toUInt32(%d))
		FROM system.one`,
		teamID, appID, ts.UTC().Format("2006-01-02 15:04:05"), events, spans, metrics)

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
// state and fingerprint.
//
// eventType must be "exception" or "anr".
// fingerprint may be empty for default FixedString(32) zero-byte value.
// Both exception/anr fingerprint columns are always written so the row can be
// reused across issue-oriented queries.
func (h *TestHelper) SeedIssueEvent(
	ctx context.Context,
	t *testing.T,
	teamID, appID, eventType, fingerprint string,
	handled bool,
	ts time.Time,
) {
	t.Helper()
	query := fmt.Sprintf(
		`INSERT INTO measure.events (id, type, session_id, app_id, team_id, timestamp, user_triggered, `+
			"`attribute.installation_id`, `attribute.app_version`, `attribute.app_build`, "+
			"`attribute.app_unique_id`, `attribute.platform`, `attribute.measure_sdk_version`, "+
			"`exception.handled`, `exception.foreground`, `exception.fingerprint`, `anr.handled`, `anr.foreground`, `anr.fingerprint`) "+
			`VALUES ('%s', '%s', '%s', '%s', '%s', '%s', false, '%s', 'v1', '1', 'com.test', 'android', '0.1', %t, true, '%s', %t, true, '%s')`,
		uuid.New().String(), eventType, uuid.New().String(), appID, teamID,
		ts.UTC().Format("2006-01-02 15:04:05"), uuid.New().String(),
		handled, fingerprint, handled, fingerprint)
	if err := h.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed issue event (%s): %v", eventType, err)
	}
}

// SeedExceptionGroup inserts a row into unhandled_exception_groups so that
// crash-alert group-info lookups succeed. fingerprint must be exactly 32
// characters to match the FixedString(32) id column.
func (h *TestHelper) SeedExceptionGroup(ctx context.Context, t *testing.T, teamID, appID, fingerprint string) {
	t.Helper()
	query := fmt.Sprintf(
		`INSERT INTO measure.unhandled_exception_groups
		(team_id, app_id, id, app_version, type, message, method_name, file_name, line_number, timestamp)
		VALUES (toUUID('%s'), toUUID('%s'), '%s', ('v1', '1'), 'java.lang.RuntimeException', 'Test crash', 'testMethod', 'TestFile.java', 42, now())`,
		teamID, appID, fingerprint)
	if err := h.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed exception group: %v", err)
	}
}

// SeedAnrGroup inserts a row into anr_groups so that ANR-alert group-info
// lookups succeed. fingerprint must be exactly 32 characters.
func (h *TestHelper) SeedAnrGroup(ctx context.Context, t *testing.T, teamID, appID, fingerprint string) {
	t.Helper()
	query := fmt.Sprintf(
		`INSERT INTO measure.anr_groups
		(team_id, app_id, id, app_version, type, message, method_name, file_name, line_number, timestamp)
		VALUES (toUUID('%s'), toUUID('%s'), '%s', ('v1', '1'), 'ANR', 'Test ANR', 'testMethod', 'TestFile.java', 42, now())`,
		teamID, appID, fingerprint)
	if err := h.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed ANR group: %v", err)
	}
}

// SeedAppMetrics inserts generic, unhandled-exception, and ANR events so that
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
		VALUES (toUUID('%s'), '%s', '%s', '%s', '%s', '%s', 1, '%s', ('v1', 'b1'), ('Android', '14'), 'US', 'Verizon', 'wifi', '4g', 'en-US', 'Google', 'Pixel', 'Pixel 6', 'u1', false, false, map('test', (1, 'val')), '')`,
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

func (h *TestHelper) SeedTeamThresholdPrefs(ctx context.Context, t *testing.T, teamID string, errorGoodThreshold, errorCautionThreshold float64) {
	t.Helper()
	_, err := h.PgPool.Exec(ctx,
		`INSERT INTO measure.team_threshold_prefs
		(team_id, error_good_threshold, error_caution_threshold, created_at, updated_at)
		VALUES ($1, $2, $3, now(), now())`,
		teamID, errorGoodThreshold, errorCautionThreshold)
	if err != nil {
		t.Fatalf("seed team_threshold_prefs: %v", err)
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
// can materialize rows for plot aggregation tests.
func (h *TestHelper) SeedSpan(
	ctx context.Context,
	t *testing.T,
	teamID, appID, spanName string,
	status uint8,
	startTime, endTime time.Time,
	appVersion, appBuild string,
) {
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
}
