//go:build integration

package billing

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v84"
)

// ==========================================================================
// Merge usage across data sources
// ==========================================================================

func TestMergeUsage(t *testing.T) {
	t.Run("union of team keys", func(t *testing.T) {
		events := map[string]uint64{"team-a": 10, "team-b": 20}
		spans := map[string]uint64{"team-b": 5, "team-c": 15}
		metrics := map[string]uint64{"team-a": 3}

		result := mergeUsage(events, spans, metrics)

		if len(result) != 3 {
			t.Fatalf("got %d teams, want 3", len(result))
		}

		a := result["team-a"]
		if a.Events != 10 || a.Spans != 0 || a.Metrics != 3 {
			t.Errorf("team-a = %+v", a)
		}

		b := result["team-b"]
		if b.Events != 20 || b.Spans != 5 || b.Metrics != 0 {
			t.Errorf("team-b = %+v", b)
		}

		c := result["team-c"]
		if c.Events != 0 || c.Spans != 15 || c.Metrics != 0 {
			t.Errorf("team-c = %+v", c)
		}
	})

	t.Run("empty maps", func(t *testing.T) {
		result := mergeUsage(
			map[string]uint64{},
			map[string]uint64{},
			map[string]uint64{},
		)
		if len(result) != 0 {
			t.Errorf("got %d teams, want 0", len(result))
		}
	})
}

// ==========================================================================
// Snapshot existence check
// ==========================================================================

func TestSnapshotExists(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New().String()
	date := time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)

	seedTeamWithBilling(ctx, t, teamID, "SnapTeam", "free", true)

	if snapshotExists(ctx, th.PgPool, date) {
		t.Error("expected false when no snapshot exists")
	}

	seedBillingMetricsReporting(ctx, t, teamID, date, 100, 50, 10, false)

	if !snapshotExists(ctx, th.PgPool, date) {
		t.Error("expected true after inserting snapshot")
	}
}

// ==========================================================================
// Event counting from ClickHouse
// ==========================================================================

func TestCountAllEvents(t *testing.T) {
	ctx := context.Background()

	t.Run("no data", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		counts, err := countAllEvents(ctx, th.ChConn)
		if err != nil {
			t.Fatalf("countAllEvents: %v", err)
		}
		if len(counts) != 0 {
			t.Errorf("got %d teams, want 0", len(counts))
		}
	})

	t.Run("multiple teams", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		teamA := uuid.New().String()
		teamB := uuid.New().String()
		appID := uuid.New().String()

		seedEvents(ctx, t, teamA, appID, 3)
		seedEvents(ctx, t, teamB, appID, 7)

		counts, err := countAllEvents(ctx, th.ChConn)
		if err != nil {
			t.Fatalf("countAllEvents: %v", err)
		}

		if counts[teamA] != 3 {
			t.Errorf("teamA events = %d, want 3", counts[teamA])
		}
		if counts[teamB] != 7 {
			t.Errorf("teamB events = %d, want 7", counts[teamB])
		}
	})
}

// ==========================================================================
// Span counting from ClickHouse
// ==========================================================================

func TestCountAllSpans(t *testing.T) {
	ctx := context.Background()

	t.Run("no data", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		counts, err := countAllSpans(ctx, th.ChConn)
		if err != nil {
			t.Fatalf("countAllSpans: %v", err)
		}
		if len(counts) != 0 {
			t.Errorf("got %d teams, want 0", len(counts))
		}
	})

	t.Run("multiple teams", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		teamA := uuid.New().String()
		teamB := uuid.New().String()
		appID := uuid.New().String()

		seedSpans(ctx, t, teamA, appID, 2)
		seedSpans(ctx, t, teamB, appID, 5)

		counts, err := countAllSpans(ctx, th.ChConn)
		if err != nil {
			t.Fatalf("countAllSpans: %v", err)
		}

		if counts[teamA] != 2 {
			t.Errorf("teamA spans = %d, want 2", counts[teamA])
		}
		if counts[teamB] != 5 {
			t.Errorf("teamB spans = %d, want 5", counts[teamB])
		}
	})
}

// ==========================================================================
// Persist daily usage snapshots
// ==========================================================================

func TestSaveSnapshotBatch(t *testing.T) {
	ctx := context.Background()

	t.Run("insert and upsert", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		teamID := uuid.New().String()
		seedTeamWithBilling(ctx, t, teamID, "SnapTeam", "free", true)

		date := time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)
		usage := map[string]DailyUsage{
			teamID: {TeamID: teamID, Events: 100, Spans: 50, Metrics: 10},
		}

		if err := saveSnapshotBatch(ctx, th.PgPool, date, usage); err != nil {
			t.Fatalf("saveSnapshotBatch (insert): %v", err)
		}

		var events, spans, metrics uint64
		err := th.PgPool.QueryRow(ctx,
			"SELECT events, spans, metrics FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
			teamID, date).Scan(&events, &spans, &metrics)
		if err != nil {
			t.Fatalf("query: %v", err)
		}
		if events != 100 || spans != 50 || metrics != 10 {
			t.Errorf("got events=%d spans=%d metrics=%d, want 100/50/10", events, spans, metrics)
		}

		// Upsert with new values
		usage[teamID] = DailyUsage{TeamID: teamID, Events: 200, Spans: 100, Metrics: 20}
		if err := saveSnapshotBatch(ctx, th.PgPool, date, usage); err != nil {
			t.Fatalf("saveSnapshotBatch (upsert): %v", err)
		}

		err = th.PgPool.QueryRow(ctx,
			"SELECT events, spans, metrics FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
			teamID, date).Scan(&events, &spans, &metrics)
		if err != nil {
			t.Fatalf("query after upsert: %v", err)
		}
		if events != 200 || spans != 100 || metrics != 20 {
			t.Errorf("after upsert got events=%d spans=%d metrics=%d, want 200/100/20", events, spans, metrics)
		}
	})

	t.Run("multiple teams", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		team1 := uuid.New().String()
		team2 := uuid.New().String()
		seedTeamWithBilling(ctx, t, team1, "Team1", "free", true)
		seedTeamWithBilling(ctx, t, team2, "Team2", "free", true)

		date := time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)
		usage := map[string]DailyUsage{
			team1: {TeamID: team1, Events: 10, Spans: 5, Metrics: 1},
			team2: {TeamID: team2, Events: 20, Spans: 10, Metrics: 2},
		}

		if err := saveSnapshotBatch(ctx, th.PgPool, date, usage); err != nil {
			t.Fatalf("saveSnapshotBatch: %v", err)
		}

		var count int
		err := th.PgPool.QueryRow(ctx,
			"SELECT COUNT(*) FROM billing_metrics_reporting WHERE report_date = $1", date).Scan(&count)
		if err != nil {
			t.Fatalf("count query: %v", err)
		}
		if count != 2 {
			t.Errorf("got %d rows, want 2", count)
		}
	})

	t.Run("empty map", func(t *testing.T) {
		if err := saveSnapshotBatch(ctx, th.PgPool, time.Now(), map[string]DailyUsage{}); err != nil {
			t.Fatalf("saveSnapshotBatch with empty map: %v", err)
		}
	})
}

// ==========================================================================
// Fetch unreported usage for Stripe
// ==========================================================================

func TestGetUnreportedUsage(t *testing.T) {
	ctx := context.Background()

	t.Run("filters correctly", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		date := time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)

		// pro + stripe_customer_id + unreported -> should appear
		proTeam := uuid.New().String()
		seedTeamWithBilling(ctx, t, proTeam, "ProTeam", "pro", true)
		setStripeCustomerID(ctx, t, proTeam, "cus_pro123")
		seedBillingMetricsReporting(ctx, t, proTeam, date, 100, 50, 10, false)

		// free plan -> should NOT appear
		freeTeam := uuid.New().String()
		seedTeamWithBilling(ctx, t, freeTeam, "FreeTeam", "free", true)
		setStripeCustomerID(ctx, t, freeTeam, "cus_free456")
		seedBillingMetricsReporting(ctx, t, freeTeam, date, 200, 100, 20, false)

		// pro but no stripe_customer_id -> should NOT appear
		noStripeTeam := uuid.New().String()
		seedTeamWithBilling(ctx, t, noStripeTeam, "NoStripeTeam", "pro", true)
		seedBillingMetricsReporting(ctx, t, noStripeTeam, date, 50, 25, 5, false)

		// pro + stripe_customer_id + already reported -> should NOT appear
		reportedTeam := uuid.New().String()
		seedTeamWithBilling(ctx, t, reportedTeam, "ReportedTeam", "pro", true)
		setStripeCustomerID(ctx, t, reportedTeam, "cus_reported789")
		seedBillingMetricsReporting(ctx, t, reportedTeam, date, 300, 150, 30, true)

		unreported, err := getUnreportedUsage(ctx, th.PgPool)
		if err != nil {
			t.Fatalf("getUnreportedUsage: %v", err)
		}

		if len(unreported) != 1 {
			t.Fatalf("got %d records, want 1", len(unreported))
		}

		u := unreported[0]
		if u.TeamID != proTeam {
			t.Errorf("TeamID = %q, want %q", u.TeamID, proTeam)
		}
		if u.Events != 100 || u.Spans != 50 || u.Metrics != 10 {
			t.Errorf("usage = events=%d spans=%d metrics=%d, want 100/50/10", u.Events, u.Spans, u.Metrics)
		}
		if u.StripeCustomerID == nil || *u.StripeCustomerID != "cus_pro123" {
			t.Errorf("StripeCustomerID = %v, want cus_pro123", u.StripeCustomerID)
		}
	})

	t.Run("ordered by date", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		teamID := uuid.New().String()
		seedTeamWithBilling(ctx, t, teamID, "ProTeam", "pro", true)
		setStripeCustomerID(ctx, t, teamID, "cus_order123")

		date1 := time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)
		date2 := time.Date(2026, 1, 14, 0, 0, 0, 0, time.UTC)
		seedBillingMetricsReporting(ctx, t, teamID, date1, 100, 50, 10, false)
		seedBillingMetricsReporting(ctx, t, teamID, date2, 200, 100, 20, false)

		unreported, err := getUnreportedUsage(ctx, th.PgPool)
		if err != nil {
			t.Fatalf("getUnreportedUsage: %v", err)
		}

		if len(unreported) != 2 {
			t.Fatalf("got %d records, want 2", len(unreported))
		}

		// date2 (Jan 14) should come before date1 (Jan 15)
		if !unreported[0].ReportDate.Equal(date2) {
			t.Errorf("first record date = %v, want %v", unreported[0].ReportDate, date2)
		}
		if !unreported[1].ReportDate.Equal(date1) {
			t.Errorf("second record date = %v, want %v", unreported[1].ReportDate, date1)
		}
	})
}

// ==========================================================================
// Mark usage as reported
// ==========================================================================

func TestMarkAsReported(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	team1 := uuid.New().String()
	team2 := uuid.New().String()
	date := time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)

	seedTeamWithBilling(ctx, t, team1, "Team1", "pro", true)
	seedTeamWithBilling(ctx, t, team2, "Team2", "pro", true)
	seedBillingMetricsReporting(ctx, t, team1, date, 100, 50, 10, false)
	seedBillingMetricsReporting(ctx, t, team2, date, 200, 100, 20, false)

	if err := markAsReported(ctx, th.PgPool, team1, date); err != nil {
		t.Fatalf("markAsReported: %v", err)
	}

	// team1 should be reported
	var reportedAt *time.Time
	err := th.PgPool.QueryRow(ctx,
		"SELECT reported_at FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
		team1, date).Scan(&reportedAt)
	if err != nil {
		t.Fatalf("query team1: %v", err)
	}
	if reportedAt == nil {
		t.Error("team1 reported_at should not be nil")
	}

	// team2 should remain unreported
	err = th.PgPool.QueryRow(ctx,
		"SELECT reported_at FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
		team2, date).Scan(&reportedAt)
	if err != nil {
		t.Fatalf("query team2: %v", err)
	}
	if reportedAt != nil {
		t.Error("team2 reported_at should be nil")
	}
}

// ==========================================================================
// Stripe meter event reporting
// ==========================================================================

func TestReportToStripe(t *testing.T) {
	t.Run("correct params", func(t *testing.T) {
		var captured *stripe.BillingMeterEventParams
		deps := testDeps()
		deps.ReportToStripe = func(params *stripe.BillingMeterEventParams) (*stripe.BillingMeterEvent, error) {
			captured = params
			return &stripe.BillingMeterEvent{}, nil
		}

		date := time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)
		err := reportToStripe(deps, "cus_test123", 42, date)
		if err != nil {
			t.Fatalf("reportToStripe: %v", err)
		}

		if captured == nil {
			t.Fatal("stripe was not called")
		}
		if *captured.EventName != "test_unit_days" {
			t.Errorf("EventName = %q, want %q", *captured.EventName, "test_unit_days")
		}
		if captured.Payload["stripe_customer_id"] != "cus_test123" {
			t.Errorf("Payload[stripe_customer_id] = %q, want %q", captured.Payload["stripe_customer_id"], "cus_test123")
		}
		if captured.Payload["value"] != "42" {
			t.Errorf("Payload[value] = %q, want %q", captured.Payload["value"], "42")
		}
		if *captured.Timestamp != date.Unix() {
			t.Errorf("Timestamp = %d, want %d", *captured.Timestamp, date.Unix())
		}

		expectedKey := fmt.Sprintf("cus_test123:%s", date.Format("2006-01-02"))
		if *captured.IdempotencyKey != expectedKey {
			t.Errorf("IdempotencyKey = %q, want %q", *captured.IdempotencyKey, expectedKey)
		}
	})

	t.Run("error propagation", func(t *testing.T) {
		deps := testDeps()
		deps.ReportToStripe = func(params *stripe.BillingMeterEventParams) (*stripe.BillingMeterEvent, error) {
			return nil, errors.New("stripe down")
		}

		err := reportToStripe(deps, "cus_test", 10, time.Now())
		if err == nil {
			t.Error("expected error, got nil")
		}
	})
}

// ==========================================================================
// Daily storage snapshot
// ==========================================================================

func TestTakeStorageSnapshot(t *testing.T) {
	ctx := context.Background()

	t.Run("skips if snapshot exists", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		teamID := uuid.New().String()
		seedTeamWithBilling(ctx, t, teamID, "SnapTeam", "free", true)

		yesterday := time.Now().UTC().Truncate(24*time.Hour).AddDate(0, 0, -1)
		seedBillingMetricsReporting(ctx, t, teamID, yesterday, 999, 888, 777, false)

		deps := testDeps()
		// Snapshot already exists, so takeStorageSnapshot should skip.
		err := takeStorageSnapshot(ctx, deps)
		if err != nil {
			t.Fatalf("takeStorageSnapshot: %v", err)
		}

		// Values should remain unchanged (not overwritten).
		var events, spans, metrics uint64
		err = th.PgPool.QueryRow(ctx,
			"SELECT events, spans, metrics FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
			teamID, yesterday).Scan(&events, &spans, &metrics)
		if err != nil {
			t.Fatalf("query: %v", err)
		}
		if events != 999 || spans != 888 || metrics != 777 {
			t.Errorf("snapshot was overwritten: events=%d spans=%d metrics=%d", events, spans, metrics)
		}
	})

	t.Run("creates snapshot from clickhouse data", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		teamID := uuid.New().String()
		appID := uuid.New().String()
		seedTeamWithBilling(ctx, t, teamID, "SnapTeam", "free", true)

		seedEvents(ctx, t, teamID, appID, 5)
		seedSpans(ctx, t, teamID, appID, 3)

		deps := testDeps()
		err := takeStorageSnapshot(ctx, deps)
		if err != nil {
			t.Fatalf("takeStorageSnapshot: %v", err)
		}

		yesterday := time.Now().UTC().Truncate(24*time.Hour).AddDate(0, 0, -1)
		var events, spans uint64
		err = th.PgPool.QueryRow(ctx,
			"SELECT events, spans FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
			teamID, yesterday).Scan(&events, &spans)
		if err != nil {
			t.Fatalf("query: %v", err)
		}
		if events != 5 {
			t.Errorf("events = %d, want 5", events)
		}
		if spans != 3 {
			t.Errorf("spans = %d, want 3", spans)
		}
	})
}

// ==========================================================================
// Report unreported usage to Stripe
// ==========================================================================

func TestReportUnreportedToStripe(t *testing.T) {
	ctx := context.Background()

	t.Run("no unreported records", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		called := false
		deps := testDeps()
		deps.ReportToStripe = func(params *stripe.BillingMeterEventParams) (*stripe.BillingMeterEvent, error) {
			called = true
			return &stripe.BillingMeterEvent{}, nil
		}

		err := ReportUnreportedToStripe(ctx, deps)
		if err != nil {
			t.Fatalf("ReportUnreportedToStripe: %v", err)
		}
		if called {
			t.Error("stripe should not have been called")
		}
	})

	t.Run("reports and marks", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		teamID := uuid.New().String()
		date := time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)

		seedTeamWithBilling(ctx, t, teamID, "ProTeam", "pro", true)
		setStripeCustomerID(ctx, t, teamID, "cus_report123")
		seedBillingMetricsReporting(ctx, t, teamID, date, 100, 50, 10, false)

		var capturedParams *stripe.BillingMeterEventParams
		deps := testDeps()
		deps.ReportToStripe = func(params *stripe.BillingMeterEventParams) (*stripe.BillingMeterEvent, error) {
			capturedParams = params
			return &stripe.BillingMeterEvent{}, nil
		}

		err := ReportUnreportedToStripe(ctx, deps)
		if err != nil {
			t.Fatalf("ReportUnreportedToStripe: %v", err)
		}

		if capturedParams == nil {
			t.Fatal("stripe was not called")
		}
		// Total units = 100 + 50 + 10 = 160
		if capturedParams.Payload["value"] != "160" {
			t.Errorf("Payload[value] = %q, want %q", capturedParams.Payload["value"], "160")
		}

		// Verify marked as reported
		var reportedAt *time.Time
		err = th.PgPool.QueryRow(ctx,
			"SELECT reported_at FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
			teamID, date).Scan(&reportedAt)
		if err != nil {
			t.Fatalf("query: %v", err)
		}
		if reportedAt == nil {
			t.Error("reported_at should be set")
		}
	})

	t.Run("skips zero-unit rows", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		teamID := uuid.New().String()
		date := time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)

		seedTeamWithBilling(ctx, t, teamID, "ProTeam", "pro", true)
		setStripeCustomerID(ctx, t, teamID, "cus_zero123")
		seedBillingMetricsReporting(ctx, t, teamID, date, 0, 0, 0, false)

		called := false
		deps := testDeps()
		deps.ReportToStripe = func(params *stripe.BillingMeterEventParams) (*stripe.BillingMeterEvent, error) {
			called = true
			return &stripe.BillingMeterEvent{}, nil
		}

		err := ReportUnreportedToStripe(ctx, deps)
		if err != nil {
			t.Fatalf("ReportUnreportedToStripe: %v", err)
		}
		if called {
			t.Error("stripe should not be called for zero units")
		}

		// Should still be marked as reported
		var reportedAt *time.Time
		err = th.PgPool.QueryRow(ctx,
			"SELECT reported_at FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
			teamID, date).Scan(&reportedAt)
		if err != nil {
			t.Fatalf("query: %v", err)
		}
		if reportedAt == nil {
			t.Error("reported_at should be set even for zero units")
		}
	})

	t.Run("stripe error continues to next record", func(t *testing.T) {
		t.Cleanup(func() { cleanupAll(ctx, t) })

		team1 := uuid.New().String()
		team2 := uuid.New().String()
		date := time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)

		seedTeamWithBilling(ctx, t, team1, "Team1", "pro", true)
		setStripeCustomerID(ctx, t, team1, "cus_fail1")
		seedBillingMetricsReporting(ctx, t, team1, date, 100, 50, 10, false)

		seedTeamWithBilling(ctx, t, team2, "Team2", "pro", true)
		setStripeCustomerID(ctx, t, team2, "cus_ok2")
		seedBillingMetricsReporting(ctx, t, team2, date, 200, 100, 20, false)

		callCount := 0
		deps := testDeps()
		deps.ReportToStripe = func(params *stripe.BillingMeterEventParams) (*stripe.BillingMeterEvent, error) {
			callCount++
			if params.Payload["stripe_customer_id"] == "cus_fail1" {
				return nil, errors.New("stripe error")
			}
			return &stripe.BillingMeterEvent{}, nil
		}

		err := ReportUnreportedToStripe(ctx, deps)
		if err != nil {
			t.Fatalf("ReportUnreportedToStripe: %v", err)
		}

		if callCount != 2 {
			t.Errorf("stripe called %d times, want 2", callCount)
		}

		// team1 should NOT be marked (stripe failed, and continue skips markAsReported)
		var t1ReportedAt *time.Time
		err = th.PgPool.QueryRow(ctx,
			"SELECT reported_at FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
			team1, date).Scan(&t1ReportedAt)
		if err != nil {
			t.Fatalf("query team1: %v", err)
		}
		if t1ReportedAt != nil {
			t.Error("team1 should not be marked as reported after stripe error")
		}

		// team2 should be marked
		var t2ReportedAt *time.Time
		err = th.PgPool.QueryRow(ctx,
			"SELECT reported_at FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
			team2, date).Scan(&t2ReportedAt)
		if err != nil {
			t.Fatalf("query team2: %v", err)
		}
		if t2ReportedAt == nil {
			t.Error("team2 should be marked as reported")
		}
	})
}

// ==========================================================================
// Daily metering job (end-to-end)
// ==========================================================================

func TestRunDailyMetering(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New().String()
	appID := uuid.New().String()

	seedTeamWithBilling(ctx, t, teamID, "E2ETeam", "pro", true)
	setStripeCustomerID(ctx, t, teamID, "cus_e2e123")

	seedEvents(ctx, t, teamID, appID, 4)
	seedSpans(ctx, t, teamID, appID, 6)

	var capturedParams *stripe.BillingMeterEventParams
	deps := testDeps()
	deps.ReportToStripe = func(params *stripe.BillingMeterEventParams) (*stripe.BillingMeterEvent, error) {
		capturedParams = params
		return &stripe.BillingMeterEvent{}, nil
	}

	// First call: snapshot + report
	RunDailyMetering(ctx, deps)

	yesterday := time.Now().UTC().Truncate(24*time.Hour).AddDate(0, 0, -1)

	// Verify snapshot was created
	var events, spans uint64
	err := th.PgPool.QueryRow(ctx,
		"SELECT events, spans FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
		teamID, yesterday).Scan(&events, &spans)
	if err != nil {
		t.Fatalf("query snapshot: %v", err)
	}
	if events != 4 {
		t.Errorf("events = %d, want 4", events)
	}
	if spans != 6 {
		t.Errorf("spans = %d, want 6", spans)
	}

	// Verify reported to stripe
	if capturedParams == nil {
		t.Fatal("stripe was not called")
	}
	if capturedParams.Payload["value"] != "10" {
		t.Errorf("Payload[value] = %q, want %q", capturedParams.Payload["value"], "10")
	}

	// Verify marked as reported
	var reportedAt *time.Time
	err = th.PgPool.QueryRow(ctx,
		"SELECT reported_at FROM billing_metrics_reporting WHERE team_id = $1 AND report_date = $2",
		teamID, yesterday).Scan(&reportedAt)
	if err != nil {
		t.Fatalf("query reported_at: %v", err)
	}
	if reportedAt == nil {
		t.Error("reported_at should be set after RunDailyMetering")
	}
}
