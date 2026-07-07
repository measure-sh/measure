//go:build integration

package agent

import (
	"context"
	"slices"
	"strings"
	"testing"
	"time"

	"backend/testinfra"

	"github.com/google/uuid"
)

// TestGetSchemaIntegration checks getSchema introspects the real ClickHouse and
// returns the scoped tables and their columns.
func TestGetSchemaIntegration(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	c := &Config{Deps: deps}

	schema, err := c.getSchema(ctx)
	if err != nil {
		t.Fatalf("getSchema: %v", err)
	}
	for _, want := range []string{"events", "spans", "timestamp"} {
		if !strings.Contains(schema, want) {
			t.Errorf("schema missing %q; got:\n%s", want, schema)
		}
	}
}

// TestRunSQLIntegration checks run_sql executes a placeholder query against
// ClickHouse, scopes it to the team/app/time range, and rejects raw table names.
func TestRunSQLIntegration(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, _, appID := seedTeamUserApp(ctx, t)
	c := &Config{Deps: deps}

	now := time.Now().UTC()
	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 3, testinfra.EventRow{Timestamp: now})
	from, to := now.Add(-time.Hour), now.Add(time.Hour)

	t.Run("counts scoped events", func(t *testing.T) {
		out, err := c.runSQL(ctx, `select count(*) as n from {{events}}`, teamID, []uuid.UUID{appID}, from, to)
		if err != nil {
			t.Fatalf("runSQL: %v", err)
		}
		if !strings.Contains(out, "3") {
			t.Errorf("expected count 3 in output, got:\n%s", out)
		}
	})

	t.Run("does not see another team's events", func(t *testing.T) {
		otherTeam, _, otherApp := seedTeamUserApp(ctx, t)
		th.SeedEventRows(ctx, t, otherTeam.String(), otherApp.String(), 5, testinfra.EventRow{Timestamp: now})
		// Our scope still counts only our 3, never the other team's 5 (or 8 total).
		out, err := c.runSQL(ctx, `select count(*) as n from {{events}}`, teamID, []uuid.UUID{appID}, from, to)
		if err != nil {
			t.Fatalf("runSQL: %v", err)
		}
		if !strings.Contains(out, "3") || strings.Contains(out, "8") {
			t.Errorf("scope leak: expected only our 3 events, got:\n%s", out)
		}
	})

	t.Run("excludes events outside the time range", func(t *testing.T) {
		out, err := c.runSQL(ctx, `select count(*) as n from {{events}}`, teamID, []uuid.UUID{appID}, now.Add(time.Hour), now.Add(2*time.Hour))
		if err != nil {
			t.Fatalf("runSQL: %v", err)
		}
		if !strings.Contains(out, "0") {
			t.Errorf("expected count 0 outside range, got:\n%s", out)
		}
	})

	t.Run("rejects a raw (non-placeholder) table name", func(t *testing.T) {
		if _, err := c.runSQL(ctx, `select count(*) from events`, teamID, []uuid.UUID{appID}, from, to); err == nil {
			t.Error("expected error for raw table name, got nil")
		}
	})

	t.Run("multi-app team splits counts per app", func(t *testing.T) {
		secondApp := uuid.New()
		seedApp(ctx, t, secondApp, teamID, "second", 30)
		th.SeedEventRows(ctx, t, teamID.String(), secondApp.String(), 5, testinfra.EventRow{Timestamp: now})

		// Grouped by app_id it runs and keeps the apps' counts apart. Rows
		// render as tab-separated columns, so each app id must appear in the
		// same row as its own count; a digit-only check would match inside
		// the UUIDs.
		out, err := c.runSQL(ctx, `select app_id, count(*) as n from {{events}} group by app_id order by n`, teamID, []uuid.UUID{appID, secondApp}, from, to)
		if err != nil {
			t.Fatalf("runSQL: %v", err)
		}
		for _, want := range []string{appID.String() + "\t3", secondApp.String() + "\t5"} {
			if !strings.Contains(out, want) {
				t.Errorf("grouped output missing row %q, got:\n%s", want, out)
			}
		}

		// Scoped to one app, a plain count needs no app_id in the query text
		// and returns only that app's rows: the scope is in the subquery.
		out, err = c.runSQL(ctx, `select count(*) as n from {{events}}`, teamID, []uuid.UUID{secondApp}, from, to)
		if err != nil {
			t.Fatalf("runSQL: %v", err)
		}
		if !strings.Contains(out, "5") || strings.Contains(out, "8") {
			t.Errorf("app-scoped count should be 5, not 8 across apps, got:\n%s", out)
		}
	})
}

// TestMCPBuildAppFilterCoversAllVersions checks the version default: with no
// version filter the query covers every version seen in the requested range
// rather than narrowing to the latest one, which made turns report "no data"
// for questions spanning versions.
func TestMCPBuildAppFilterCoversAllVersions(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, _, appID := seedTeamUserApp(ctx, t)
	now := time.Now().UTC()
	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1,
		testinfra.EventRow{Timestamp: now.Add(-2 * time.Hour), AppVersion: "1.0.1", AppBuild: "1"})
	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1,
		testinfra.EventRow{Timestamp: now.Add(-time.Hour), AppVersion: "1.0.2", AppBuild: "2"})
	th.SeedAppFilters(ctx, t, teamID.String(), appID.String(), now, [][2]string{{"1.0.1", "1"}, {"1.0.2", "2"}})

	c, _ := newTestAgent(t)
	af, err := c.mcpBuildAppFilter(ctx, appID, mcpCommonFilters{
		From: now.Add(-24 * time.Hour).Format(time.RFC3339),
		To:   now.Format(time.RFC3339),
	})
	if err != nil {
		t.Fatalf("mcpBuildAppFilter: %v", err)
	}
	for _, v := range []string{"1.0.1", "1.0.2"} {
		if !slices.Contains(af.Versions, v) {
			t.Errorf("versions %v missing %s", af.Versions, v)
		}
	}
	if len(af.VersionCodes) < 2 {
		t.Errorf("version codes %v, want both builds", af.VersionCodes)
	}
}
