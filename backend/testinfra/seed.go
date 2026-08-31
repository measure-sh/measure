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
		`INSERT INTO apps (id, team_id, app_name, unique_identifier, os_names, first_version, onboarded, onboarded_at, retention, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		appID, teamID, appName, appName, []string{"android"}, "1.0.0", true, now, retention, now, now)
	if err != nil {
		t.Fatalf("seed app: %v", err)
	}
}

// SeedBuildMappingRow inserts a single build mapping row with an
// explicit key, patch id and patch version. Only the table row is
// written; no mapping file object is uploaded. The zero UUID patch id
// marks a regular build upload; OTA patch uploads carry a patch id and
// empty version columns, plus a patch version when the SDK sends one.
// An empty key marks a file whose upload has not finished processing.
func (h *TestHelper) SeedBuildMappingRow(ctx context.Context, t *testing.T, mappingID, appID, versionName, versionCode, mappingType, key, patchID, patchVersion string, lastUpdated time.Time) {
	t.Helper()

	_, err := h.PgPool.Exec(ctx,
		`INSERT INTO build_mappings (id, app_id, version_name, version_code, mapping_type, key, location, fnv1_hash, file_size, patch_id, patch_version, last_updated)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		mappingID, appID, versionName, versionCode, mappingType, key,
		fmt.Sprintf("http://minio.test:9000/msr-symbols-test/%s", key),
		"0xtesthash", 100, patchID, patchVersion, lastUpdated)
	if err != nil {
		t.Fatalf("seed build mapping row: %v", err)
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

// EventRow describes one or more rows to insert into the events table. It is
// the single source of truth for seeding events: every higher-level helper
// (generic, issue, severity, app-metrics, ...) builds an EventRow and delegates
// to SeedEventRows, so any attribute (app version, severity, handled state,
// session) can be varied without adding new helpers.
//
// Zero-value fields fall back to defaults applied by (EventRow).filled:
//   - Type:       "test"
//   - AppVersion: "v1", AppBuild: "1"
//   - Timestamp:  time.Now().UTC()
//   - EventID, SessionID: a fresh UUID per inserted row
type EventRow struct {
	Type       string
	EventID    string
	SessionID  string
	Timestamp  time.Time
	AppVersion string
	AppBuild   string

	// Exception/ANR payload, written only for issue events (Type "exception"
	// or "anr"). Severity, ExceptionsJSON and IsCustom are written only when
	// set, leaving ClickHouse column defaults otherwise.
	Handled        bool
	Fingerprint    string
	Severity       string
	ExceptionsJSON string
	IsCustom       bool

	// Description is the bug report text, written only for Type "bug_report".
	// For those events the seed also writes '[]' into the attachments column,
	// the value real ingestion stores for a report without attachments.
	// Readers of the derived bug_reports row json-decode that column and
	// would fail on the empty-string column default.
	Description string

	// Device/network attributes, written only when OSName is non-empty.
	// app_filters_mv requires all nine of these non-empty to emit a row, so
	// set every field together when a test needs to reach that view.
	OSName             string
	OSVersion          string
	CountryCode        string
	NetworkProvider    string
	NetworkType        string
	NetworkGeneration  string
	DeviceLocale       string
	DeviceManufacturer string
	DeviceName         string

	// Attributes written individually only when set, leaving ClickHouse
	// column defaults otherwise. PatchID and PatchVersion identify an OTA
	// patch the app was running; both stay unwritten for an unpatched app.
	UserID       string
	DeviceModel  string
	PatchID      uuid.UUID
	PatchVersion string
}

func (r EventRow) filled() EventRow {
	if r.Type == "" {
		r.Type = "test"
	}
	if r.AppVersion == "" {
		r.AppVersion = "v1"
	}
	if r.AppBuild == "" {
		r.AppBuild = "1"
	}
	if r.Timestamp.IsZero() {
		r.Timestamp = time.Now().UTC()
	}
	return r
}

// SeedEventRows inserts count rows described by row into the events table using
// a single bulk INSERT ... SELECT FROM numbers(count). Each row gets a fresh id
// and installation id; the session id is fresh per row unless row.SessionID
// pins it, so a batch of generic events represents distinct sessions. Issue
// payload columns are emitted only for exception/anr events.
func (h *TestHelper) SeedEventRows(ctx context.Context, t *testing.T, teamID, appID string, count int, row EventRow) {
	t.Helper()
	if count <= 0 {
		return
	}
	row = row.filled()
	ts := row.Timestamp.UTC().Format("2006-01-02 15:04:05")
	isIssue := row.Type == "exception" || row.Type == "anr"

	quote := func(s string) string { return "'" + s + "'" }
	boolLit := func(b bool) string {
		if b {
			return "true"
		}
		return "false"
	}

	// generateUUIDv4() is evaluated per row by ClickHouse, so id, installation
	// id and (unpinned) event and session ids are unique across the batch.
	idExpr := "generateUUIDv4()"
	if row.EventID != "" {
		idExpr = quote(row.EventID)
	}
	sessionExpr := "generateUUIDv4()"
	if row.SessionID != "" {
		sessionExpr = quote(row.SessionID)
	}

	cols := []string{
		"id", "type", "session_id", "app_id", "team_id", "timestamp", "user_triggered",
		"`attribute.installation_id`", "`attribute.app_version`", "`attribute.app_build`",
		"`attribute.app_unique_id`", "`attribute.measure_sdk_version`",
	}
	vals := []string{
		idExpr, quote(row.Type), sessionExpr, quote(appID), quote(teamID),
		quote(ts), "false", "generateUUIDv4()",
		quote(row.AppVersion), quote(row.AppBuild), "'com.test'", "'0.1'",
	}

	if isIssue {
		cols = append(cols,
			"`exception.handled`", "`exception.foreground`", "`exception.fingerprint`",
			"`anr.handled`", "`anr.foreground`", "`anr.fingerprint`")
		vals = append(vals,
			boolLit(row.Handled), "true", quote(row.Fingerprint),
			boolLit(row.Handled), "true", quote(row.Fingerprint))

		if row.ExceptionsJSON != "" {
			cols = append(cols, "`exception.exceptions`", "`anr.exceptions`")
			vals = append(vals, quote(row.ExceptionsJSON), quote(row.ExceptionsJSON))
		}
		if row.Severity != "" {
			cols = append(cols, "`exception.severity`")
			vals = append(vals, quote(row.Severity))
		}
		if row.IsCustom {
			cols = append(cols, "`exception.is_custom`")
			vals = append(vals, "true")
		}
	}

	if row.Type == "bug_report" {
		cols = append(cols, "`bug_report.description`", "attachments")
		vals = append(vals, quote(row.Description), "'[]'")
	}

	if row.OSName != "" {
		cols = append(cols,
			"`attribute.os_name`", "`attribute.os_version`", "`inet.country_code`",
			"`attribute.network_provider`", "`attribute.network_type`", "`attribute.network_generation`",
			"`attribute.device_locale`", "`attribute.device_manufacturer`", "`attribute.device_name`")
		vals = append(vals,
			quote(row.OSName), quote(row.OSVersion), quote(row.CountryCode),
			quote(row.NetworkProvider), quote(row.NetworkType), quote(row.NetworkGeneration),
			quote(row.DeviceLocale), quote(row.DeviceManufacturer), quote(row.DeviceName))
	}

	if row.UserID != "" {
		cols = append(cols, "`attribute.user_id`")
		vals = append(vals, quote(row.UserID))
	}
	if row.DeviceModel != "" {
		cols = append(cols, "`attribute.device_model`")
		vals = append(vals, quote(row.DeviceModel))
	}
	if row.PatchID != uuid.Nil {
		cols = append(cols, "`attribute.patch_id`")
		vals = append(vals, quote(row.PatchID.String()))
	}
	if row.PatchVersion != "" {
		cols = append(cols, "`attribute.patch_version`")
		vals = append(vals, quote(row.PatchVersion))
	}

	query := fmt.Sprintf("INSERT INTO measure.events (%s) SELECT %s FROM numbers(%d)",
		strings.Join(cols, ", "), strings.Join(vals, ", "), count)
	if err := h.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed event (%s): %v", row.Type, err)
	}
}

// SeedEvents inserts count generic ("test") events at the current time.
func (h *TestHelper) SeedEvents(ctx context.Context, t *testing.T, teamID, appID string, count int) {
	t.Helper()
	h.SeedEventRows(ctx, t, teamID, appID, count, EventRow{})
}

// SpanRow describes one or more rows to insert into the spans table. It is
// the single source of truth for seeding spans: SeedSpan and SeedSpans build
// a SpanRow and delegate to SeedSpanRows.
//
// Zero-value fields fall back to defaults applied by (SpanRow).filled:
//   - SpanName:   "test_span"
//   - StartTime:  time.Now().UTC()
//   - EndTime:    StartTime + Duration (Duration defaults to 100ms)
//   - AppVersion: "v1", AppBuild: "1"
//   - OSName: "Android", OSVersion: "14"
//   - SessionID, TraceID, SpanID: fresh per inserted row
//
// The device, network and country attributes stay empty strings unless set,
// as they are for a span whose SDK did not report them. PatchID stays the nil
// uuid and PatchVersion an empty string unless set, as they are for a span
// not running an OTA patch.
type SpanRow struct {
	SpanName           string
	SessionID          string
	TraceID            string
	SpanID             string
	Status             uint8
	StartTime          time.Time
	EndTime            time.Time
	Duration           time.Duration
	AppVersion         string
	AppBuild           string
	PatchID            uuid.UUID
	PatchVersion       string
	OSName             string
	OSVersion          string
	CountryCode        string
	NetworkProvider    string
	NetworkType        string
	NetworkGeneration  string
	DeviceLocale       string
	DeviceManufacturer string
	DeviceName         string
	Checkpoints        []string
}

func (r SpanRow) filled() SpanRow {
	if r.SpanName == "" {
		r.SpanName = "test_span"
	}
	if r.StartTime.IsZero() {
		r.StartTime = time.Now().UTC()
	}
	if r.Duration == 0 {
		r.Duration = 100 * time.Millisecond
	}
	if r.EndTime.IsZero() {
		r.EndTime = r.StartTime.Add(r.Duration)
	}
	if r.AppVersion == "" {
		r.AppVersion = "v1"
	}
	if r.AppBuild == "" {
		r.AppBuild = "1"
	}
	if r.OSName == "" {
		r.OSName = "Android"
	}
	if r.OSVersion == "" {
		r.OSVersion = "14"
	}
	return r
}

// SeedSpanRows inserts count rows described by row into the spans table using
// a single bulk INSERT ... SELECT FROM numbers(count). Session, trace and span
// ids are fresh per row unless the row pins them. The app and os attribute
// columns are always written so span_metrics_mv materializes rows.
// Checkpoints are written at the span's start time.
func (h *TestHelper) SeedSpanRows(ctx context.Context, t *testing.T, teamID, appID string, count int, row SpanRow) {
	t.Helper()
	if count <= 0 {
		return
	}
	row = row.filled()
	quote := func(s string) string { return "'" + s + "'" }
	chTime := func(ts time.Time) string {
		return fmt.Sprintf("toDateTime64('%s', 3, 'UTC')", ts.UTC().Format("2006-01-02 15:04:05.000"))
	}

	sessionExpr := "generateUUIDv4()"
	if row.SessionID != "" {
		sessionExpr = quote(row.SessionID)
	}
	traceExpr := "replaceAll(toString(generateUUIDv4()), '-', '')"
	if row.TraceID != "" {
		traceExpr = quote(row.TraceID)
	}
	spanExpr := "substring(replaceAll(toString(generateUUIDv4()), '-', ''), 1, 16)"
	if row.SpanID != "" {
		spanExpr = quote(row.SpanID)
	}

	cols := []string{
		"team_id", "app_id", "span_name", "span_id", "trace_id", "session_id",
		"status", "start_time", "end_time",
		"`attribute.app_unique_id`", "`attribute.installation_id`",
		"`attribute.measure_sdk_version`", "`attribute.app_version`", "`attribute.os_version`",
		"`attribute.patch_id`", "`attribute.patch_version`",
		"`attribute.country_code`", "`attribute.network_provider`",
		"`attribute.network_type`", "`attribute.network_generation`",
		"`attribute.device_locale`", "`attribute.device_manufacturer`", "`attribute.device_name`",
		"`attribute.device_low_power_mode`", "`attribute.device_thermal_throttling_enabled`",
	}
	vals := []string{
		quote(teamID), quote(appID), quote(row.SpanName),
		spanExpr, traceExpr, sessionExpr,
		fmt.Sprintf("%d", row.Status), chTime(row.StartTime), chTime(row.EndTime),
		"'com.test'", "generateUUIDv4()",
		"'0.1'", fmt.Sprintf("('%s','%s')", row.AppVersion, row.AppBuild),
		fmt.Sprintf("('%s','%s')", row.OSName, row.OSVersion),
		quote(row.PatchID.String()), quote(row.PatchVersion),
		quote(row.CountryCode), quote(row.NetworkProvider),
		quote(row.NetworkType), quote(row.NetworkGeneration),
		quote(row.DeviceLocale), quote(row.DeviceManufacturer), quote(row.DeviceName),
		"false", "false",
	}

	if len(row.Checkpoints) > 0 {
		points := make([]string, len(row.Checkpoints))
		for i, name := range row.Checkpoints {
			points[i] = fmt.Sprintf("('%s', %s)", name, chTime(row.StartTime))
		}
		cols = append(cols, "checkpoints")
		vals = append(vals, "["+strings.Join(points, ", ")+"]")
	}

	query := fmt.Sprintf("INSERT INTO measure.spans (%s) SELECT %s FROM numbers(%d)",
		strings.Join(cols, ", "), strings.Join(vals, ", "), count)
	if err := h.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed span (%s): %v", row.SpanName, err)
	}
}

// SpanUDAttrRow describes one row to insert into the span_user_def_attrs
// table: one user-defined attribute of one span. Values of every type are
// stored as text in the one value column, with Type naming which of
// "string", "int64", "float64" or "bool" the text holds.
//
// Zero-value fields fall back to defaults:
//   - Type:       "string"
//   - Timestamp:  time.Now().UTC()
//   - AppVersion: "v1", AppBuild: "1"
//   - OSName: "Android", OSVersion: "14"
//   - SessionID, SpanID: fresh per row
//
// Pin SpanID (exactly 16 characters) to attach the attribute to a span seeded
// with the same id.
type SpanUDAttrRow struct {
	SpanID     string
	SessionID  string
	Key        string
	Type       string
	Value      string
	Timestamp  time.Time
	AppVersion string
	AppBuild   string
	OSName     string
	OSVersion  string
}

// SeedSpanUDAttrRow inserts one row described by row into the
// span_user_def_attrs table.
func (h *TestHelper) SeedSpanUDAttrRow(ctx context.Context, t *testing.T, teamID, appID string, row SpanUDAttrRow) {
	t.Helper()

	if row.SpanID == "" {
		row.SpanID = strings.ReplaceAll(uuid.New().String(), "-", "")[:16]
	}
	if row.SessionID == "" {
		row.SessionID = uuid.New().String()
	}
	if row.Type == "" {
		row.Type = "string"
	}
	if row.Timestamp.IsZero() {
		row.Timestamp = time.Now().UTC()
	}
	if row.AppVersion == "" {
		row.AppVersion = "v1"
	}
	if row.AppBuild == "" {
		row.AppBuild = "1"
	}
	if row.OSName == "" {
		row.OSName = "Android"
	}
	if row.OSVersion == "" {
		row.OSVersion = "14"
	}

	query := fmt.Sprintf(`INSERT INTO measure.span_user_def_attrs
		(team_id, app_id, span_id, session_id, app_version, os_version, key, type, value, timestamp)
		VALUES ('%s', '%s', '%s', '%s', ('%s','%s'), ('%s','%s'), '%s', '%s', '%s', toDateTime64('%s', 3, 'UTC'))`,
		teamID, appID, row.SpanID, row.SessionID,
		row.AppVersion, row.AppBuild, row.OSName, row.OSVersion,
		row.Key, row.Type, row.Value,
		row.Timestamp.UTC().Format("2006-01-02 15:04:05.000"))
	if err := h.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed span user-defined attribute (%s): %v", row.Key, err)
	}
}

// SeedGenericEvents inserts count generic ("test" type) events at the given
// timestamp. Each row gets a fresh id, session id and installation id, so
// every event represents a distinct session.
func (h *TestHelper) SeedGenericEvents(ctx context.Context, t *testing.T, teamID, appID string, count int, ts time.Time) {
	t.Helper()
	h.SeedEventRows(ctx, t, teamID, appID, count, EventRow{Timestamp: ts})
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
	h.SeedEventRows(ctx, t, teamID, appID, 1, EventRow{
		Type:           eventType,
		SessionID:      sessionID,
		Fingerprint:    fingerprint,
		Handled:        handled,
		ExceptionsJSON: exceptionsJSON,
		Timestamp:      ts,
	})
}

// SeedIssueEventWithSeverityInSession inserts an exception event with an
// explicit session_id, severity and exception JSON, mimicking new-SDK
// ingestion. Handled is always false: no current SDK sends it.
func (h *TestHelper) SeedIssueEventWithSeverityInSession(
	ctx context.Context,
	t *testing.T,
	teamID, appID, sessionID, fingerprint, severity, exceptionsJSON string,
	ts time.Time,
) {
	t.Helper()
	h.SeedEventRows(ctx, t, teamID, appID, 1, EventRow{
		Type:           "exception",
		SessionID:      sessionID,
		Fingerprint:    fingerprint,
		Severity:       severity,
		ExceptionsJSON: exceptionsJSON,
		Timestamp:      ts,
	})
}

// SeedIssueEventWithSeverity inserts an exception event with an explicit
// exception.severity value, mimicking new-SDK ingestion. Handled is always
// false: no current SDK sends the deprecated handled field, so ingest
// zero-values it whatever the severity.
func (h *TestHelper) SeedIssueEventWithSeverity(
	ctx context.Context,
	t *testing.T,
	teamID, appID, fingerprint, severity string,
	ts time.Time,
) {
	t.Helper()
	h.SeedEventRows(ctx, t, teamID, appID, 1, EventRow{
		Type:        "exception",
		Fingerprint: fingerprint,
		Severity:    severity,
		Handled:     false,
		Timestamp:   ts,
	})
}

// SeedIssueEventWithFullAttributes inserts an exception event with an explicit
// severity, a handled flag & every device/network attribute app_filters_mv
// requires non-empty to emit a row. Use it to reach that view instead of the
// SeedAppFilters direct-insert bypass. severity="" with handled=true models a
// legacy pre-severity handled exception, the row the old predicate excluded.
func (h *TestHelper) SeedIssueEventWithFullAttributes(
	ctx context.Context,
	t *testing.T,
	teamID, appID, severity string,
	handled bool,
	ts time.Time,
) {
	t.Helper()
	h.SeedEventRows(ctx, t, teamID, appID, 1, EventRow{
		Type:               "exception",
		Severity:           severity,
		Handled:            handled,
		Timestamp:          ts,
		OSName:             "Android",
		OSVersion:          "14",
		CountryCode:        "US",
		NetworkProvider:    "carrier",
		NetworkType:        "wifi",
		NetworkGeneration:  "4g",
		DeviceLocale:       "en-US",
		DeviceManufacturer: "TestCo",
		DeviceName:         "pixel",
	})
}

// SeedNavigationEventInSession inserts a navigation event with a known
// session_id and destination screen name.
func (h *TestHelper) SeedNavigationEventInSession(ctx context.Context, t *testing.T, teamID, appID, sessionID, destination string, ts time.Time) {
	t.Helper()
	query := fmt.Sprintf(
		`INSERT INTO measure.events (id, type, session_id, app_id, team_id, timestamp, user_triggered, `+
			"`attribute.installation_id`, `attribute.app_version`, `attribute.app_build`, "+
			"`attribute.app_unique_id`, `attribute.measure_sdk_version`, "+
			"`navigation.to`) "+
			`VALUES ('%s', 'navigation', '%s', '%s', '%s', '%s', false, '%s', 'v1', '1', 'com.test', '0.1', '%s')`,
		uuid.New().String(), sessionID, appID, teamID,
		ts.UTC().Format("2006-01-02 15:04:05"), uuid.New().String(), destination)
	if err := h.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed navigation event: %v", err)
	}
}

// SeedLifecycleActivityInSession inserts a lifecycle_activity event with a
// known session_id, activity type & class name, feeding journey_mv.
func (h *TestHelper) SeedLifecycleActivityInSession(ctx context.Context, t *testing.T, teamID, appID, sessionID, activityType, className string, ts time.Time) {
	t.Helper()
	query := fmt.Sprintf(
		`INSERT INTO measure.events (id, type, session_id, app_id, team_id, timestamp, user_triggered, `+
			"`attribute.installation_id`, `attribute.app_version`, `attribute.app_build`, "+
			"`attribute.app_unique_id`, `attribute.measure_sdk_version`, "+
			"`lifecycle_activity.type`, `lifecycle_activity.class_name`) "+
			`VALUES ('%s', 'lifecycle_activity', '%s', '%s', '%s', '%s', false, '%s', 'v1', '1', 'com.test', '0.1', '%s', '%s')`,
		uuid.New().String(), sessionID, appID, teamID,
		ts.UTC().Format("2006-01-02 15:04:05.000"), uuid.New().String(), activityType, className)
	if err := h.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed lifecycle activity event: %v", err)
	}
}

// SeedScreenViewInSession inserts a screen_view event with a known session_id
// & screen name, feeding journey_mv.
func (h *TestHelper) SeedScreenViewInSession(ctx context.Context, t *testing.T, teamID, appID, sessionID, screenName string, ts time.Time) {
	t.Helper()
	query := fmt.Sprintf(
		`INSERT INTO measure.events (id, type, session_id, app_id, team_id, timestamp, user_triggered, `+
			"`attribute.installation_id`, `attribute.app_version`, `attribute.app_build`, "+
			"`attribute.app_unique_id`, `attribute.measure_sdk_version`, "+
			"`screen_view.name`) "+
			`VALUES ('%s', 'screen_view', '%s', '%s', '%s', '%s', false, '%s', 'v1', '1', 'com.test', '0.1', '%s')`,
		uuid.New().String(), sessionID, appID, teamID,
		ts.UTC().Format("2006-01-02 15:04:05.000"), uuid.New().String(), screenName)
	if err := h.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed screen view event: %v", err)
	}
}

// SeedLifecycleFragmentInSession inserts a lifecycle_fragment event with a
// known session_id, fragment type & class name, feeding journey_mv.
func (h *TestHelper) SeedLifecycleFragmentInSession(ctx context.Context, t *testing.T, teamID, appID, sessionID, fragmentType, className string, ts time.Time) {
	t.Helper()
	query := fmt.Sprintf(
		`INSERT INTO measure.events (id, type, session_id, app_id, team_id, timestamp, user_triggered, `+
			"`attribute.installation_id`, `attribute.app_version`, `attribute.app_build`, "+
			"`attribute.app_unique_id`, `attribute.measure_sdk_version`, "+
			"`lifecycle_fragment.type`, `lifecycle_fragment.class_name`) "+
			`VALUES ('%s', 'lifecycle_fragment', '%s', '%s', '%s', '%s', false, '%s', 'v1', '1', 'com.test', '0.1', '%s', '%s')`,
		uuid.New().String(), sessionID, appID, teamID,
		ts.UTC().Format("2006-01-02 15:04:05.000"), uuid.New().String(), fragmentType, className)
	if err := h.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed lifecycle fragment event: %v", err)
	}
}

// SeedLifecycleViewControllerInSession inserts a lifecycle_view_controller
// event with a known session_id, view controller type & class name, feeding
// journey_mv.
func (h *TestHelper) SeedLifecycleViewControllerInSession(ctx context.Context, t *testing.T, teamID, appID, sessionID, vcType, className string, ts time.Time) {
	t.Helper()
	query := fmt.Sprintf(
		`INSERT INTO measure.events (id, type, session_id, app_id, team_id, timestamp, user_triggered, `+
			"`attribute.installation_id`, `attribute.app_version`, `attribute.app_build`, "+
			"`attribute.app_unique_id`, `attribute.measure_sdk_version`, "+
			"`lifecycle_view_controller.type`, `lifecycle_view_controller.class_name`) "+
			`VALUES ('%s', 'lifecycle_view_controller', '%s', '%s', '%s', '%s', false, '%s', 'v1', '1', 'com.test', '0.1', '%s', '%s')`,
		uuid.New().String(), sessionID, appID, teamID,
		ts.UTC().Format("2006-01-02 15:04:05.000"), uuid.New().String(), vcType, className)
	if err := h.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed lifecycle view controller event: %v", err)
	}
}

// SeedLifecycleSwiftUIInSession inserts a lifecycle_swift_ui event with a known
// session_id, SwiftUI type & class name, feeding journey_mv.
func (h *TestHelper) SeedLifecycleSwiftUIInSession(ctx context.Context, t *testing.T, teamID, appID, sessionID, swiftUIType, className string, ts time.Time) {
	t.Helper()
	query := fmt.Sprintf(
		`INSERT INTO measure.events (id, type, session_id, app_id, team_id, timestamp, user_triggered, `+
			"`attribute.installation_id`, `attribute.app_version`, `attribute.app_build`, "+
			"`attribute.app_unique_id`, `attribute.measure_sdk_version`, "+
			"`lifecycle_swift_ui.type`, `lifecycle_swift_ui.class_name`) "+
			`VALUES ('%s', 'lifecycle_swift_ui', '%s', '%s', '%s', '%s', false, '%s', 'v1', '1', 'com.test', '0.1', '%s', '%s')`,
		uuid.New().String(), sessionID, appID, teamID,
		ts.UTC().Format("2006-01-02 15:04:05.000"), uuid.New().String(), swiftUIType, className)
	if err := h.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed lifecycle swift ui event: %v", err)
	}
}

// SeedEventWithSession inserts one event with a known session_id so that
// sessions_index gets populated via the materialized view.
func (h *TestHelper) SeedEventWithSession(ctx context.Context, t *testing.T, teamID, appID, sessionID string, ts time.Time) {
	t.Helper()
	h.SeedEventRows(ctx, t, teamID, appID, 1, EventRow{SessionID: sessionID, Timestamp: ts})
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

// SeedNonfatalExceptionGroup inserts a row into nonfatal_exception_groups
// with explicit handled and is_custom values. fingerprint must be exactly 32
// characters.
func (h *TestHelper) SeedNonfatalExceptionGroup(ctx context.Context, t *testing.T, teamID, appID, fingerprint string, handled, isCustom bool) {
	t.Helper()

	query := `insert into
		nonfatal_exception_groups (
			team_id, app_id, id, app_version, type, message, method_name, file_name, line_number, handled, is_custom, os_versions, country_codes, network_providers, network_types, network_generations, device_locales, device_manufacturers, device_names, device_models, count, timestamp
		)
		select
			toUUID(?),
			toUUID(?),
			?,
			('v1', '1'),
			'java.lang.RuntimeException',
			'Test nonfatal',
			'testMethod',
			'TestFile.java',
			42,
			?,
			?,
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

	if err := h.ChConn.Exec(ctx, query, []any{teamID, appID, fingerprint, handled, isCustom}...); err != nil {
		t.Fatalf("seed nonfatal exception group: %v", err)
	}
}

// SeedFatalExceptionGroupWithCustomFlag inserts a row into
// fatal_exception_groups with explicit is_custom. fingerprint must be exactly
// 32 characters.
func (h *TestHelper) SeedFatalExceptionGroupWithCustomFlag(ctx context.Context, t *testing.T, teamID, appID, fingerprint string, isCustom bool) {
	t.Helper()

	query := `insert into
		fatal_exception_groups (
			team_id, app_id, id, app_version, type, message, method_name, file_name, line_number, handled, is_custom, os_versions, country_codes, network_providers, network_types, network_generations, device_locales, device_manufacturers, device_names, device_models, count, timestamp
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
			false,
			?,
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

	if err := h.ChConn.Exec(ctx, query, []any{teamID, appID, fingerprint, isCustom}...); err != nil {
		t.Fatalf("seed fatal exception group with custom flag: %v", err)
	}
}

// SeedIssueEventWithCustomFlag inserts an exception event with explicit
// handled and exception.is_custom flags. Use this to test custom-error
// filtering on read paths.
func (h *TestHelper) SeedIssueEventWithCustomFlag(
	ctx context.Context,
	t *testing.T,
	teamID, appID, fingerprint string,
	handled, isCustom bool,
	ts time.Time,
) {
	t.Helper()
	h.SeedEventRows(ctx, t, teamID, appID, 1, EventRow{
		Type:        "exception",
		Fingerprint: fingerprint,
		Handled:     handled,
		IsCustom:    isCustom,
		Timestamp:   ts,
	})
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
//	crash_sessions = crashCount   (type="exception", fatal: severity="fatal"
//	                 or (severity="" and exception.handled=false))
//	anr_sessions   = anrCount     (type="anr")
func (h *TestHelper) SeedAppMetrics(ctx context.Context, t *testing.T, teamID, appID string, ts time.Time, genericCount, crashCount, anrCount int) {
	t.Helper()
	if genericCount > 0 {
		h.SeedGenericEvents(ctx, t, teamID, appID, genericCount, ts)
	}
	for range crashCount {
		h.SeedIssueEvent(ctx, t, teamID, appID, "exception", "", false, ts)
	}
	for range anrCount {
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
			"`attribute.app_unique_id`, `attribute.measure_sdk_version`, "+
			"%s) "+
			`VALUES ('%s', '%s', '%s', '%s', '%s', '%s', false, '%s', 'v1', '1', 'com.test', '0.1', %d)`,
		durationCol,
		uuid.New().String(), launchType, uuid.New().String(), appID, teamID,
		ts.UTC().Format("2006-01-02 15:04:05"), uuid.New().String(), durationMs)
	if err := h.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed launch event (%s): %v", launchType, err)
	}
}

// BugReportRow describes one bug report to seed. The report is inserted as a
// bug_report event into the events table, from which bug_reports_mv derives
// the bug_reports row, the same path real ingestion takes. A zero Status is
// an open report.
//
// Zero-value fields fall back to defaults applied by (BugReportRow).filled:
//   - Timestamp:  time.Now().UTC()
//   - AppVersion: "v1", AppBuild: "b1"
//   - OSName: "Android", OSVersion: "14"
//   - EventID, SessionID: fresh per row
//
// The country, network, device and user attributes default to a Google Pixel
// on Verizon wifi 4g in the US, locale en-US, user id "u1". PatchID stays the
// nil uuid and PatchVersion an empty string unless set, as they are for a
// report filed by an app not running an OTA patch.
type BugReportRow struct {
	EventID            string
	SessionID          string
	Status             uint8
	Description        string
	Timestamp          time.Time
	AppVersion         string
	AppBuild           string
	OSName             string
	OSVersion          string
	CountryCode        string
	NetworkProvider    string
	NetworkType        string
	NetworkGeneration  string
	DeviceLocale       string
	DeviceManufacturer string
	DeviceName         string
	DeviceModel        string
	UserID             string
	PatchID            uuid.UUID
	PatchVersion       string
}

func (r BugReportRow) filled() BugReportRow {
	if r.EventID == "" {
		r.EventID = uuid.New().String()
	}
	if r.SessionID == "" {
		r.SessionID = uuid.New().String()
	}
	if r.Timestamp.IsZero() {
		r.Timestamp = time.Now().UTC()
	}
	if r.AppVersion == "" {
		r.AppVersion = "v1"
	}
	if r.AppBuild == "" {
		r.AppBuild = "b1"
	}
	if r.OSName == "" {
		r.OSName = "Android"
	}
	if r.OSVersion == "" {
		r.OSVersion = "14"
	}
	if r.CountryCode == "" {
		r.CountryCode = "US"
	}
	if r.NetworkProvider == "" {
		r.NetworkProvider = "Verizon"
	}
	if r.NetworkType == "" {
		r.NetworkType = "wifi"
	}
	if r.NetworkGeneration == "" {
		r.NetworkGeneration = "4g"
	}
	if r.DeviceLocale == "" {
		r.DeviceLocale = "en-US"
	}
	if r.DeviceManufacturer == "" {
		r.DeviceManufacturer = "Google"
	}
	if r.DeviceName == "" {
		r.DeviceName = "Pixel"
	}
	if r.DeviceModel == "" {
		r.DeviceModel = "Pixel 6"
	}
	if r.UserID == "" {
		r.UserID = "u1"
	}
	return r
}

// SeedBugReportRow seeds one bug report described by row by inserting a
// bug_report event into the events table; bug_reports_mv fires on the insert
// and writes the derived bug_reports row. The view fixes a new report's
// status to open, so for a non-zero Status the same lightweight UPDATE the
// API's status change runs is issued afterwards, with updated_at kept at the
// report's timestamp.
func (h *TestHelper) SeedBugReportRow(ctx context.Context, t *testing.T, teamID, appID string, row BugReportRow) {
	t.Helper()
	row = row.filled()
	h.SeedEventRows(ctx, t, teamID, appID, 1, EventRow{
		Type:               "bug_report",
		EventID:            row.EventID,
		SessionID:          row.SessionID,
		Timestamp:          row.Timestamp,
		AppVersion:         row.AppVersion,
		AppBuild:           row.AppBuild,
		Description:        row.Description,
		OSName:             row.OSName,
		OSVersion:          row.OSVersion,
		CountryCode:        row.CountryCode,
		NetworkProvider:    row.NetworkProvider,
		NetworkType:        row.NetworkType,
		NetworkGeneration:  row.NetworkGeneration,
		DeviceLocale:       row.DeviceLocale,
		DeviceManufacturer: row.DeviceManufacturer,
		DeviceName:         row.DeviceName,
		UserID:             row.UserID,
		DeviceModel:        row.DeviceModel,
		PatchID:            row.PatchID,
		PatchVersion:       row.PatchVersion,
	})

	if row.Status != 0 {
		query := `UPDATE measure.bug_reports SET status = ?, updated_at = ? WHERE team_id = toUUID(?) AND app_id = toUUID(?) AND event_id = toUUID(?)`
		if err := h.ChConn.Exec(ctx, query,
			row.Status, row.Timestamp.UTC(), teamID, appID, row.EventID); err != nil {
			t.Fatalf("set bug report status: %v", err)
		}
	}
}

// SeedBugReport seeds a single closed bug report with default attributes.
func (h *TestHelper) SeedBugReport(ctx context.Context, t *testing.T, teamID, appID, eventID, description string, ts time.Time) {
	t.Helper()
	h.SeedBugReportRow(ctx, t, teamID, appID, BugReportRow{
		EventID:     eventID,
		Status:      1,
		Description: description,
		Timestamp:   ts,
	})
}

// UDAttrRow describes one row to insert into the user_def_attrs table: one
// user-defined attribute of one event. Values of every type are stored as
// text in the one value column, with Type naming which of "string", "int64",
// "float64" or "bool" the text holds. BugReport marks the row as coming from
// a bug report event.
//
// Zero-value fields fall back to defaults:
//   - Type:       "string"
//   - Timestamp:  time.Now().UTC()
//   - AppVersion: "v1", AppBuild: "b1"
//   - OSName: "Android", OSVersion: "14"
//   - EventID, SessionID: fresh per row
//
// Pin EventID to attach the attribute to an event seeded with the same id.
type UDAttrRow struct {
	EventID    string
	SessionID  string
	BugReport  bool
	Key        string
	Type       string
	Value      string
	Timestamp  time.Time
	AppVersion string
	AppBuild   string
	OSName     string
	OSVersion  string
}

// SeedUDAttrRow inserts one row described by row into the user_def_attrs
// table.
func (h *TestHelper) SeedUDAttrRow(ctx context.Context, t *testing.T, teamID, appID string, row UDAttrRow) {
	t.Helper()

	if row.EventID == "" {
		row.EventID = uuid.New().String()
	}
	if row.SessionID == "" {
		row.SessionID = uuid.New().String()
	}
	if row.Type == "" {
		row.Type = "string"
	}
	if row.Timestamp.IsZero() {
		row.Timestamp = time.Now().UTC()
	}
	if row.AppVersion == "" {
		row.AppVersion = "v1"
	}
	if row.AppBuild == "" {
		row.AppBuild = "b1"
	}
	if row.OSName == "" {
		row.OSName = "Android"
	}
	if row.OSVersion == "" {
		row.OSVersion = "14"
	}

	query := `INSERT INTO measure.user_def_attrs
		(team_id, app_id, event_id, session_id, app_version, os_version, bug_report, key, type, value, timestamp)
		VALUES (?, ?, ?, ?, (?,?), (?,?), ?, ?, ?, ?, ?)`
	if err := h.ChConn.Exec(ctx, query,
		teamID, appID, row.EventID, row.SessionID,
		row.AppVersion, row.AppBuild, row.OSName, row.OSVersion,
		row.BugReport, row.Key, row.Type, row.Value,
		row.Timestamp.UTC()); err != nil {
		t.Fatalf("seed user-defined attribute (%s): %v", row.Key, err)
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
	for i := range count {
		ts := time.Now().UTC().Add(time.Duration(i) * time.Second)
		h.SeedSpan(ctx, t, teamID, appID, "test", 1, ts, ts, "v1", "1")
	}
}

// SeedAppFilters inserts one app_filters row per version. Real ingest fills
// the table through app_filters_mv, whose source query requires every device
// and network attribute to be non-empty, which SeedEventRows rows are not;
// tests that need the derived version list seed it directly.
func (h *TestHelper) SeedAppFilters(ctx context.Context, t *testing.T, teamID, appID string, at time.Time, versions [][2]string) {
	t.Helper()
	for _, v := range versions {
		query := fmt.Sprintf(
			`INSERT INTO measure.app_filters (team_id, app_id, end_of_month, app_version, os_version, `+
				`country_code, network_provider, network_type, network_generation, device_locale, `+
				`device_manufacturer, device_name, exception, anr) `+
				`VALUES ('%s', '%s', '%s', ('%s','%s'), ('Android','14'), 'US', 'carrier', 'wifi', '4g', 'en-US', 'TestCo', 'pixel', false, false)`,
			teamID, appID, at.UTC().Format("2006-01-02 15:04:05"), v[0], v[1],
		)
		if err := h.ChConn.Exec(ctx, query); err != nil {
			t.Fatalf("seed app filters: %v", err)
		}
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
	h.SeedSpanRows(ctx, t, teamID, appID, 1, SpanRow{
		SpanName:   spanName,
		TraceID:    traceID,
		SpanID:     traceID[:16],
		Status:     status,
		StartTime:  startTime,
		EndTime:    endTime,
		AppVersion: appVersion,
		AppBuild:   appBuild,
	})
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
			"`attribute.app_unique_id`, `attribute.measure_sdk_version`, "+
			"`http.url`, `http.method`, `http.status_code`, `http.start_time`, `http.end_time`, `inet.country_code`) "+
			`SELECT generateUUIDv4(), 'http', generateUUIDv4(), '%s', '%s', toDateTime64('%s', 3, 'UTC') + toIntervalMillisecond(number), '%s', false, generateUUIDv4(), 'v1', '1', 'com.test', '0.1', '%s', '%s', %d, 1000, 1100, 'US' FROM numbers(%d)`,
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
