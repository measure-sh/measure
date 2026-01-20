package testinfra

import (
	"context"
	"fmt"
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

func (h *TestHelper) SeedSpans(ctx context.Context, t *testing.T, teamID, appID string, count int) {
	t.Helper()
	for i := 0; i < count; i++ {
		query := fmt.Sprintf(
			`INSERT INTO measure.spans (team_id, app_id, span_name, span_id, trace_id, session_id, status, `+
				"start_time, end_time, "+
				"`attribute.app_unique_id`, `attribute.installation_id`, "+
				"`attribute.measure_sdk_version`, `attribute.app_version`, `attribute.os_version`, "+
				"`attribute.platform`, `attribute.device_low_power_mode`, `attribute.device_thermal_throttling_enabled`) "+
				`VALUES ('%s', '%s', 'test', '%s', '%s', '%s', 1, now(), now(), 'com.test', '%s', '0.1', ('v1','1'), ('14','0'), 'android', false, false)`,
			teamID, appID,
			fmt.Sprintf("%016x", i), fmt.Sprintf("%032x", i),
			uuid.New().String(), uuid.New().String())
		if err := h.ChConn.Exec(ctx, query); err != nil {
			t.Fatalf("seed spans: %v", err)
		}
	}
}
