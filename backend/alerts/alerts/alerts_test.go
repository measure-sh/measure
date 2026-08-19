//go:build integration

package alerts

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"backend/alerts/server"
	"backend/alerts/slack"
	"backend/libs/autumn"
	autumntest "backend/libs/autumn/testhelpers"
	"backend/libs/email"

	"github.com/google/uuid"
)

// testCrashFingerprint and testAnrFingerprint are exactly 32 characters to
// match the FixedString(32) column type used in exception/ANR group tables.
const (
	testCrashFingerprint = "aabbccdd11223344aabbccdd11223344"
	testAnrFingerprint   = "bbccddee22334455bbccddee22334455"
)

// --------------------------------------------------------------------------
// Tests — Crash and ANR Spike Alerts
// --------------------------------------------------------------------------

// seedCrashSpike seeds enough events to trigger a crash spike alert.
// It creates sessionCount generic sessions and crashCount exception events
// all sharing testCrashFingerprint, then seeds the corresponding group-info row.
func seedCrashSpike(ctx context.Context, t *testing.T, teamID, appID string, sessionCount, crashCount int) {
	t.Helper()
	now := time.Now().UTC()
	th.SeedGenericEvents(ctx, t, teamID, appID, sessionCount, now.Add(-30*time.Minute))
	for i := 0; i < crashCount; i++ {
		th.SeedIssueEvent(ctx, t, teamID, appID, "exception", testCrashFingerprint, false, now.Add(-5*time.Minute))
	}
	th.SeedExceptionGroup(ctx, t, teamID, appID, testCrashFingerprint)
}

// seedAnrSpike seeds enough events to trigger an ANR spike alert.
func seedAnrSpike(ctx context.Context, t *testing.T, teamID, appID string, sessionCount, anrCount int) {
	t.Helper()
	now := time.Now().UTC()
	th.SeedGenericEvents(ctx, t, teamID, appID, sessionCount, now.Add(-30*time.Minute))
	for i := 0; i < anrCount; i++ {
		th.SeedIssueEvent(ctx, t, teamID, appID, "anr", testAnrFingerprint, false, now.Add(-5*time.Minute))
	}
	th.SeedAnrGroup(ctx, t, teamID, appID, testAnrFingerprint)
}

func TestCreateCrashAndAnrAlerts(t *testing.T) {
	t.Run("no events creates no alerts", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Empty Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Empty App", 30)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlerts(ctx, t); got != 0 {
			t.Errorf("want 0 alerts with no events, got %d", got)
		}
	})

	t.Run("crash group count below minimum threshold creates no alert", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		now := time.Now().UTC()
		th.SeedGenericEvents(ctx, t, teamID, appID, 200, now.Add(-30*time.Minute))
		// Seed 50 crashes — below minCrashOrAnrCountThreshold (100)
		for i := 0; i < 50; i++ {
			th.SeedIssueEvent(ctx, t, teamID, appID, "exception", testCrashFingerprint, false, now.Add(-5*time.Minute))
		}
		th.SeedExceptionGroup(ctx, t, teamID, appID, testCrashFingerprint)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 0 {
			t.Errorf("want 0 crash alerts (count below threshold), got %d", got)
		}
	})

	t.Run("crash spike fires when count and rate thresholds are both met", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Crash Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Crash App", 30)

		// 110 crashes / 200 sessions = 55% rate (>> 0.5% threshold)
		seedCrashSpike(ctx, t, teamID, appID, 200, 110)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 1 {
			t.Errorf("want 1 crash spike alert, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "email"); got != 1 {
			t.Errorf("want 1 pending email for crash spike, got %d", got)
		}
	})

	t.Run("handled exceptions do not trigger a crash spike alert", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Handled Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Handled App", 30)

		now := time.Now().UTC()
		th.SeedGenericEvents(ctx, t, teamID, appID, 200, now.Add(-30*time.Minute))
		// 110 realistic new-SDK handled (non-fatal) exceptions, past both the
		// count & rate thresholds. crash_count must exclude them.
		for i := 0; i < 110; i++ {
			th.SeedIssueEventWithSeverity(ctx, t, teamID, appID, testCrashFingerprint, "handled", now.Add(-5*time.Minute))
		}
		th.SeedExceptionGroup(ctx, t, teamID, appID, testCrashFingerprint)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 0 {
			t.Errorf("want 0 crash spike alerts for handled exceptions, got %d", got)
		}
	})

	t.Run("anr spike fires when count and rate thresholds are both met", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "ANR Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "ANR App", 30)

		// 110 ANRs / 200 sessions = 55% rate (>> 0.5% threshold)
		seedAnrSpike(ctx, t, teamID, appID, 200, 110)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeAnrSpike)); got != 1 {
			t.Errorf("want 1 ANR spike alert, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "email"); got != 1 {
			t.Errorf("want 1 pending email for ANR spike, got %d", got)
		}
	})

	t.Run("crash and anr spikes both fire in the same run", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Spike Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Spike App", 30)

		now := time.Now().UTC()
		th.SeedGenericEvents(ctx, t, teamID, appID, 200, now.Add(-30*time.Minute))
		for i := 0; i < 110; i++ {
			th.SeedIssueEvent(ctx, t, teamID, appID, "exception", testCrashFingerprint, false, now.Add(-5*time.Minute))
		}
		for i := 0; i < 110; i++ {
			th.SeedIssueEvent(ctx, t, teamID, appID, "anr", testAnrFingerprint, false, now.Add(-5*time.Minute))
		}
		th.SeedExceptionGroup(ctx, t, teamID, appID, testCrashFingerprint)
		th.SeedAnrGroup(ctx, t, teamID, appID, testAnrFingerprint)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 1 {
			t.Errorf("want 1 crash spike alert, got %d", got)
		}
		if got := countAlertsOfType(ctx, t, string(AlertTypeAnrSpike)); got != 1 {
			t.Errorf("want 1 ANR spike alert, got %d", got)
		}
	})

	t.Run("cooldown prevents duplicate crash alert within one week", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Cooldown Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Cooldown App", 30)
		seedCrashSpike(ctx, t, teamID, appID, 200, 110)

		// First run — alert created
		CreateCrashAndAnrAlerts(ctx)
		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 1 {
			t.Fatalf("first run: want 1 crash alert, got %d", got)
		}

		// Second run — suppressed by cooldown (errorAlertCooldownPeriod = 1 week)
		CreateCrashAndAnrAlerts(ctx)
		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 1 {
			t.Errorf("cooldown failed: want 1 crash alert after second run, got %d", got)
		}
	})

	t.Run("cooldown prevents duplicate anr alert within one week", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "ANR Cooldown Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "ANR Cooldown App", 30)
		seedAnrSpike(ctx, t, teamID, appID, 200, 110)

		// First run — alert created
		CreateCrashAndAnrAlerts(ctx)
		if got := countAlertsOfType(ctx, t, string(AlertTypeAnrSpike)); got != 1 {
			t.Fatalf("first run: want 1 ANR alert, got %d", got)
		}

		// Second run — suppressed by cooldown
		CreateCrashAndAnrAlerts(ctx)
		if got := countAlertsOfType(ctx, t, string(AlertTypeAnrSpike)); got != 1 {
			t.Errorf("cooldown failed: want 1 ANR alert after second run, got %d", got)
		}
	})

	t.Run("crash spike with slack integration also queues a slack message", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Slack Crash Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Slack Crash App", 30)
		th.SeedTeamSlack(ctx, t, teamID, []string{"C0CRASHCHAN"})
		seedCrashSpike(ctx, t, teamID, appID, 200, 110)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 1 {
			t.Errorf("want 1 crash alert, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "slack"); got != 1 {
			t.Errorf("want 1 slack message for crash spike, got %d", got)
		}
	})

	t.Run("multiple apps checked independently: spike in one does not affect other", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		app1 := uuid.New().String()
		app2 := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Multi App Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, app1, teamID, "App With Spike", 30)
		th.SeedApp(ctx, t, app2, teamID, "App Without Spike", 30)

		// Only app1 has a spike; app2 has no events at all
		seedCrashSpike(ctx, t, teamID, app1, 200, 110)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 1 {
			t.Errorf("want 1 crash alert (for app1 only), got %d", got)
		}
	})

	t.Run("each app uses its own threshold prefs for spike alerts", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		app1 := uuid.New().String()
		app2 := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Multi Prefs Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, app1, teamID, "High Threshold App", 30)
		th.SeedApp(ctx, t, app2, teamID, "Default Threshold App", 30)

		// app1 has a very high minimum count threshold — 110 crashes won't meet it
		th.SeedAppThresholdPrefs(ctx, t, app1, 95.0, 85.0, 500, 0.5)
		// app2 has no prefs row — uses defaults (minCount=100, rate=0.5%)

		// Both apps have 110 crashes / 200 sessions (55% rate)
		seedCrashSpike(ctx, t, teamID, app1, 200, 110)
		seedCrashSpike(ctx, t, teamID, app2, 200, 110)

		CreateCrashAndAnrAlerts(ctx)

		// Only app2 fires — app1 requires 500 crashes but only 110 occurred
		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 1 {
			t.Errorf("want 1 crash alert (app2 only, app1 suppressed by high count threshold), got %d", got)
		}
	})

	t.Run("team with no apps creates no alerts", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "No Apps Team")

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlerts(ctx, t); got != 0 {
			t.Errorf("want 0 alerts, got %d", got)
		}
	})

	t.Run("anr group count below minimum threshold creates no alert", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		// 50 ANRs < minCrashOrAnrCountThreshold (100) — no alert should fire
		now := time.Now().UTC()
		th.SeedGenericEvents(ctx, t, teamID, appID, 200, now.Add(-30*time.Minute))
		for i := 0; i < 50; i++ {
			th.SeedIssueEvent(ctx, t, teamID, appID, "anr", testAnrFingerprint, false, now.Add(-5*time.Minute))
		}
		th.SeedAnrGroup(ctx, t, teamID, appID, testAnrFingerprint)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeAnrSpike)); got != 0 {
			t.Errorf("want 0 ANR alerts when count < threshold, got %d", got)
		}
	})

	t.Run("crash spike does not fire when rate is below 0.5% threshold", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		// 100 crashes / 20 101 total sessions ≈ 0.497% < 0.5% threshold
		now := time.Now().UTC()
		for i := 0; i < 100; i++ {
			th.SeedIssueEvent(ctx, t, teamID, appID, "exception", testCrashFingerprint, false, now.Add(-5*time.Minute))
		}
		th.SeedGenericEvents(ctx, t, teamID, appID, 20001, now.Add(-30*time.Minute))
		th.SeedExceptionGroup(ctx, t, teamID, appID, testCrashFingerprint)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 0 {
			t.Errorf("want 0 crash alerts when rate < threshold, got %d", got)
		}
	})

	t.Run("anr spike does not fire when rate is below 0.5% threshold", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		// 100 ANRs / 20 101 total sessions ≈ 0.497% < 0.5% threshold
		now := time.Now().UTC()
		for i := 0; i < 100; i++ {
			th.SeedIssueEvent(ctx, t, teamID, appID, "anr", testAnrFingerprint, false, now.Add(-5*time.Minute))
		}
		th.SeedGenericEvents(ctx, t, teamID, appID, 20001, now.Add(-30*time.Minute))
		th.SeedAnrGroup(ctx, t, teamID, appID, testAnrFingerprint)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeAnrSpike)); got != 0 {
			t.Errorf("want 0 ANR alerts when rate < threshold, got %d", got)
		}
	})

	t.Run("multiple crash fingerprints each trigger a separate alert", func(t *testing.T) {
		const testCrashFingerprint2 = "ccddee0033445566ccddee0033445566"

		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		now := time.Now().UTC()
		th.SeedGenericEvents(ctx, t, teamID, appID, 200, now.Add(-30*time.Minute))
		for i := 0; i < 110; i++ {
			th.SeedIssueEvent(ctx, t, teamID, appID, "exception", testCrashFingerprint, false, now.Add(-5*time.Minute))
			th.SeedIssueEvent(ctx, t, teamID, appID, "exception", testCrashFingerprint2, false, now.Add(-5*time.Minute))
		}
		th.SeedExceptionGroup(ctx, t, teamID, appID, testCrashFingerprint)
		th.SeedExceptionGroup(ctx, t, teamID, appID, testCrashFingerprint2)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 2 {
			t.Errorf("want 2 crash alerts (one per fingerprint), got %d", got)
		}
	})

	t.Run("handled exceptions are not counted toward crash count", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		now := time.Now().UTC()
		th.SeedGenericEvents(ctx, t, teamID, appID, 200, now.Add(-30*time.Minute))
		// 150 handled exceptions — these must NOT count toward the crash threshold
		for i := 0; i < 150; i++ {
			th.SeedIssueEvent(ctx, t, teamID, appID, "exception", "", true, now.Add(-5*time.Minute))
		}

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 0 {
			t.Errorf("want 0 crash alerts for handled exceptions, got %d", got)
		}
	})

	t.Run("crash alert fires again after cooldown period has expired", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		// Insert a stale alert (8 days ago) so isInCooldown returns false
		staleTime := time.Now().UTC().Add(-8 * 24 * time.Hour)
		_, err := th.PgPool.Exec(ctx,
			`INSERT INTO alerts (id, team_id, app_id, entity_id, type, message, url, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, 'old alert', 'http://example.com', $6, $6)`,
			uuid.New(), teamID, appID, testCrashFingerprint, string(AlertTypeCrashSpike), staleTime)
		if err != nil {
			t.Fatalf("insert stale alert: %v", err)
		}

		seedCrashSpike(ctx, t, teamID, appID, 200, 110)

		CreateCrashAndAnrAlerts(ctx)

		// Expect 2 total crash alerts: the stale one + the new one
		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 2 {
			t.Errorf("want 2 crash alerts (stale + new after cooldown expiry), got %d", got)
		}
	})

	t.Run("crash spike with two slack channels queues one message per channel", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)
		th.SeedTeamSlack(ctx, t, teamID, []string{"C0CHAN1", "C0CHAN2"})

		seedCrashSpike(ctx, t, teamID, appID, 200, 110)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 1 {
			t.Errorf("want 1 crash alert, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "slack"); got != 2 {
			t.Errorf("want 2 pending slack messages (one per channel), got %d", got)
		}
	})

	t.Run("crash spike with active slack but empty channel list queues no slack messages", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)
		th.SeedTeamSlack(ctx, t, teamID, []string{})

		seedCrashSpike(ctx, t, teamID, appID, 200, 110)

		CreateCrashAndAnrAlerts(ctx)

		if got := countPendingByChannel(ctx, t, "slack"); got != 0 {
			t.Errorf("want 0 slack messages when channel list is empty, got %d", got)
		}
	})
}

// --------------------------------------------------------------------------
// Tests — Bug Report Alerts
// --------------------------------------------------------------------------

func TestCreateBugReportAlerts(t *testing.T) {
	t.Run("single recent bug report creates one alert and one email", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)
		th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), "Button crash", time.Now().UTC().Add(-5*time.Minute))

		CreateBugReportAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeBugReport)); got != 1 {
			t.Errorf("want 1 bug report alert, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "email"); got != 1 {
			t.Errorf("want 1 pending email, got %d", got)
		}
	})

	t.Run("bug report outside time window is not alerted", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)
		// bugReportTimePeriod = 15 minutes; seed report 20 minutes ago
		th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), "Old crash", time.Now().UTC().Add(-20*time.Minute))

		CreateBugReportAlerts(ctx)

		if got := countAlerts(ctx, t); got != 0 {
			t.Errorf("want 0 alerts for out-of-window report, got %d", got)
		}
	})

	t.Run("recent and old bug reports in same app: only recent is alerted", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		now := time.Now().UTC()
		th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), "Recent crash", now.Add(-5*time.Minute))
		th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), "Old crash", now.Add(-20*time.Minute))

		CreateBugReportAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeBugReport)); got != 1 {
			t.Errorf("want 1 alert (only recent report), got %d", got)
		}
	})

	t.Run("multiple recent bug reports each create a separate alert", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		now := time.Now().UTC()
		for i := 0; i < 3; i++ {
			th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), fmt.Sprintf("Crash %d", i), now.Add(-time.Duration(i+1)*time.Minute))
		}

		CreateBugReportAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeBugReport)); got != 3 {
			t.Errorf("want 3 alerts, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "email"); got != 3 {
			t.Errorf("want 3 pending emails, got %d", got)
		}
	})

	t.Run("second run deduplicates already-alerted bug reports", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()
		reportID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)
		th.SeedBugReport(ctx, t, teamID, appID, reportID, "Crash", time.Now().UTC().Add(-5*time.Minute))

		CreateBugReportAlerts(ctx)
		CreateBugReportAlerts(ctx) // second run

		if got := countAlertsOfType(ctx, t, string(AlertTypeBugReport)); got != 1 {
			t.Errorf("deduplication failed: want 1 alert after second run, got %d", got)
		}
	})

	t.Run("two team members each receive a separate email", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		user1 := uuid.New().String()
		user2 := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, user1, "owner@example.com")
		th.SeedUser(ctx, t, user2, "member@example.com")
		th.SeedTeamMembership(ctx, t, teamID, user1, "owner")
		th.SeedTeamMembership(ctx, t, teamID, user2, "viewer")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)
		th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), "Crash", time.Now().UTC().Add(-5*time.Minute))

		CreateBugReportAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeBugReport)); got != 1 {
			t.Errorf("want 1 alert, got %d", got)
		}
		// QueueEmailForTeam sends one email per team member
		if got := countPendingByChannel(ctx, t, "email"); got != 2 {
			t.Errorf("want 2 pending emails (one per team member), got %d", got)
		}
	})

	t.Run("team with slack integration also creates a pending slack message", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Slack Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Slack App", 30)
		th.SeedTeamSlack(ctx, t, teamID, []string{"C0TESTCHAN"})
		th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), "Slack crash", time.Now().UTC().Add(-5*time.Minute))

		CreateBugReportAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeBugReport)); got != 1 {
			t.Errorf("want 1 alert, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "email"); got != 1 {
			t.Errorf("want 1 pending email, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "slack"); got != 1 {
			t.Errorf("want 1 pending slack message, got %d", got)
		}
	})

	t.Run("multiple apps each produce their own alerts", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		app1 := uuid.New().String()
		app2 := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Multi App Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, app1, teamID, "App One", 30)
		th.SeedApp(ctx, t, app2, teamID, "App Two", 30)

		now := time.Now().UTC()
		th.SeedBugReport(ctx, t, teamID, app1, uuid.New().String(), "App1 crash", now.Add(-5*time.Minute))
		th.SeedBugReport(ctx, t, teamID, app2, uuid.New().String(), "App2 crash", now.Add(-5*time.Minute))

		CreateBugReportAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeBugReport)); got != 2 {
			t.Errorf("want 2 alerts (one per app), got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "email"); got != 2 {
			t.Errorf("want 2 pending emails, got %d", got)
		}
	})

	t.Run("team with no apps creates no alerts", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "No Apps Team")

		CreateBugReportAlerts(ctx)

		if got := countAlerts(ctx, t); got != 0 {
			t.Errorf("want 0 alerts, got %d", got)
		}
	})

	t.Run("no teams creates no alerts", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		CreateBugReportAlerts(ctx)

		if got := countAlerts(ctx, t); got != 0 {
			t.Errorf("want 0 alerts, got %d", got)
		}
	})

	t.Run("bug report with two slack channels queues one message per channel", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)
		th.SeedTeamSlack(ctx, t, teamID, []string{"C0BUG1", "C0BUG2"})
		th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), "Two-channel bug", time.Now().UTC().Add(-5*time.Minute))

		CreateBugReportAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeBugReport)); got != 1 {
			t.Errorf("want 1 bug report alert, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "slack"); got != 2 {
			t.Errorf("want 2 pending slack messages (one per channel), got %d", got)
		}
	})

	t.Run("bug report with active slack but empty channel list queues no slack messages", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)
		th.SeedTeamSlack(ctx, t, teamID, []string{})
		th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), "Empty channel bug", time.Now().UTC().Add(-5*time.Minute))

		CreateBugReportAlerts(ctx)

		if got := countPendingByChannel(ctx, t, "slack"); got != 0 {
			t.Errorf("want 0 slack messages when channel list is empty, got %d", got)
		}
	})
}

// --------------------------------------------------------------------------
// Tests — getDailySummaryMetrics SQL logic
// --------------------------------------------------------------------------

// TestGetDailySummaryMetrics exercises every branch of the getDailySummaryMetrics
// SQL query directly. The function is package-private, so we can call it from
// the same package test.
//
// Metric slice layout returned by getDailySummaryMetrics:
//
//	[0] Sessions
//	[1] Crash-free sessions
//	[2] ANR-free sessions
//	[3] Cold launch p95
//	[4] Warm launch p95
//	[5] Hot launch p95
//	[6] Bug reports (only present when count > 0)
//
// card returns the summary card carrying the given label. Cards for ANR free
// sessions and bug reports are only included on days that have something to
// report, so a card's position in the slice is not fixed and the label is the
// only reliable way to find it.
func card(t *testing.T, metrics []email.MetricData, label string) email.MetricData {
	t.Helper()
	for _, metric := range metrics {
		if metric.Label == label {
			return metric
		}
	}
	t.Fatalf("no card labelled %q among %v", label, cardLabels(metrics))
	return email.MetricData{}
}

func cardLabels(metrics []email.MetricData) []string {
	labels := make([]string, 0, len(metrics))
	for _, metric := range metrics {
		labels = append(labels, metric.Label)
	}
	return labels
}

func hasCard(metrics []email.MetricData, label string) bool {
	for _, metric := range metrics {
		if metric.Label == label {
			return true
		}
	}
	return false
}

func TestGetDailySummaryMetrics(t *testing.T) {
	// makeApp builds an App value from pre-seeded string IDs.
	makeApp := func(teamID, appID string) App {
		return App{
			ID:     uuid.MustParse(appID),
			TeamID: uuid.MustParse(teamID),
		}
	}

	// ---------- error when no data ----------

	t.Run("returns error when no today events exist", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		app := makeApp(teamID, appID)
		_, _, err := getDailySummaryMetrics(ctx, time.Now().UTC(), &app)
		if err == nil {
			t.Error("expected error when no data, got nil")
		}
	})

	// ---------- Sessions ----------

	t.Run("sessions: value equals seeded session count", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 5, 0, 0)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "Sessions").Value != "5" {
			t.Errorf("sessions value: want %q, got %q", "5", card(t, metrics, "Sessions").Value)
		}
		if card(t, metrics, "Sessions").Label != "Sessions" {
			t.Errorf("sessions label: want %q, got %q", "Sessions", card(t, metrics, "Sessions").Label)
		}
		if card(t, metrics, "Sessions").HasWarning {
			t.Error("sessions should never have warning")
		}
		if card(t, metrics, "Sessions").HasError {
			t.Error("sessions should never have error")
		}
	})

	t.Run("sessions: subtitle is no previous day data when no yesterday events", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 5, 0, 0)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "Sessions").Subtitle != "No previous day data" {
			t.Errorf("sessions subtitle: want %q, got %q", "No previous day data", card(t, metrics, "Sessions").Subtitle)
		}
	})

	t.Run("sessions: subtitle shows greater when today exceeds yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 7, 0, 0)       // today: 7
		th.SeedAppMetrics(ctx, t, teamID, appID, yesterday, 5, 0, 0) // yesterday: 5

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "Sessions").Subtitle != "Up from 5 yesterday" {
			t.Errorf("sessions subtitle: want %q, got %q", "Up from 5 yesterday", card(t, metrics, "Sessions").Subtitle)
		}
	})

	t.Run("sessions: subtitle shows less when today is below yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 3, 0, 0)       // today: 3
		th.SeedAppMetrics(ctx, t, teamID, appID, yesterday, 5, 0, 0) // yesterday: 5

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "Sessions").Subtitle != "Down from 5 yesterday" {
			t.Errorf("sessions subtitle: want %q, got %q", "Down from 5 yesterday", card(t, metrics, "Sessions").Subtitle)
		}
	})

	t.Run("sessions: subtitle shows no change when today equals yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 5, 0, 0)
		th.SeedAppMetrics(ctx, t, teamID, appID, yesterday, 5, 0, 0)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "Sessions").Subtitle != "No change from yesterday" {
			t.Errorf("sessions subtitle: want %q, got %q", "No change from yesterday", card(t, metrics, "Sessions").Subtitle)
		}
	})

	t.Run("sessions: counts above a thousand are abbreviated the way the dashboard abbreviates them", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		th.SeedAppMetrics(ctx, t, teamID, appID, yesterday, 1000, 0, 0)
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 2500, 0, 0)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "Sessions").Value != "2.5K" {
			t.Errorf("sessions value: want %q, got %q", "2.5K", card(t, metrics, "Sessions").Value)
		}
		if card(t, metrics, "Sessions").Subtitle != "Up from 1K yesterday" {
			t.Errorf("sessions subtitle: want %q, got %q", "Up from 1K yesterday", card(t, metrics, "Sessions").Subtitle)
		}
	})

	// ---------- Crash-free sessions ----------

	t.Run("crash-free: 100% with no crashes, no warning or error", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 10, 0, 0)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "Crash free sessions").Value != "100%" {
			t.Errorf("crash-free value: want %q, got %q", "100%", card(t, metrics, "Crash free sessions").Value)
		}
		if card(t, metrics, "Crash free sessions").HasWarning {
			t.Error("crash-free should have no warning at 100%")
		}
		if card(t, metrics, "Crash free sessions").HasError {
			t.Error("crash-free should have no error at 100%")
		}
	})

	t.Run("crash-free: warning but no error when rate is 90-95%", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		// 9 generic + 1 crash = 10 total, 1 crash → 90% crash-free
		// 90 < 95 → warning; 90 >= 90 → no error
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 9, 1, 0)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "Crash free sessions").Value != "90%" {
			t.Errorf("crash-free value: want %q, got %q", "90%", card(t, metrics, "Crash free sessions").Value)
		}
		if !card(t, metrics, "Crash free sessions").HasWarning {
			t.Error("crash-free should have warning at 90%")
		}
		if card(t, metrics, "Crash free sessions").HasError {
			t.Error("crash-free should not have error at 90%")
		}
	})

	t.Run("crash-free: warning and error when rate is below 90%", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		// 8 generic + 2 crash = 10 total, 2 crash → 80% crash-free
		// 80 < 95 → warning; 80 < 90 → error
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 8, 2, 0)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "Crash free sessions").Value != "80%" {
			t.Errorf("crash-free value: want %q, got %q", "80%", card(t, metrics, "Crash free sessions").Value)
		}
		if !card(t, metrics, "Crash free sessions").HasWarning {
			t.Error("crash-free should have warning at 80%")
		}
		if !card(t, metrics, "Crash free sessions").HasError {
			t.Error("crash-free should have error at 80%")
		}
	})

	t.Run("crash-free: subtitle is no previous day data when no yesterday events", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 9, 1, 0)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "Crash free sessions").Subtitle != "No previous day data" {
			t.Errorf("crash-free subtitle: want %q, got %q", "No previous day data", card(t, metrics, "Crash free sessions").Subtitle)
		}
	})

	t.Run("crash-free: subtitle shows better when crash rate improved from yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		// Yesterday: 4 sessions, 2 crashes → 50% crash-free
		th.SeedAppMetrics(ctx, t, teamID, appID, yesterday, 2, 2, 0)
		// Today: 4 sessions, 0 crashes → crash rate 0, a 100% drop
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 4, 0, 0)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "Crash free sessions").Subtitle != "Up from 50% yesterday" {
			t.Errorf("crash-free subtitle: want %q, got %q", "Up from 50% yesterday", card(t, metrics, "Crash free sessions").Subtitle)
		}
	})

	t.Run("crash-free: subtitle shows worse when crash rate degraded from yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		// Yesterday: 4 sessions, 1 crash → crash rate 0.25
		th.SeedAppMetrics(ctx, t, teamID, appID, yesterday, 3, 1, 0)
		// Today: 4 sessions, 2 crashes → crash rate 0.5, a 100% rise
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 2, 2, 0)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "Crash free sessions").Subtitle != "Down from 75% yesterday" {
			t.Errorf("crash-free subtitle: want %q, got %q", "Down from 75% yesterday", card(t, metrics, "Crash free sessions").Subtitle)
		}
	})

	t.Run("crash-free: subtitle shows no change when crash rate unchanged from yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		// Both days: 10 sessions, 1 crash → 90% crash-free (identical rate)
		th.SeedAppMetrics(ctx, t, teamID, appID, yesterday, 9, 1, 0)
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 9, 1, 0)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "Crash free sessions").Subtitle != "No change from yesterday" {
			t.Errorf("crash-free subtitle: want %q, got %q", "No change from yesterday", card(t, metrics, "Crash free sessions").Subtitle)
		}
	})

	t.Run("crash-free: subtitle compares against a yesterday that had no crashes", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		// Yesterday: 4 sessions, 0 crashes → 100% crash-free
		th.SeedAppMetrics(ctx, t, teamID, appID, yesterday, 4, 0, 0)
		// Today: 4 sessions, 2 crashes → crash rate 0.5
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 2, 2, 0)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "Crash free sessions").Subtitle != "Down from 100% yesterday" {
			t.Errorf("crash-free subtitle: want %q, got %q", "Down from 100% yesterday", card(t, metrics, "Crash free sessions").Subtitle)
		}
	})

	t.Run("crash-free: subtitle reports real movement when both days are near 100% crash-free", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		// Yesterday: 400 sessions, 1 crash → 99.75% crash-free
		th.SeedAppMetrics(ctx, t, teamID, appID, yesterday, 399, 1, 0)
		// Today: 400 sessions, 2 crashes → 99.5% crash-free. The crash rate
		// doubled, but the two crash-free rates differ by a quarter of a
		// percentage point, which is what an earlier crash-free ratio rounded
		// away into "1x worse than yesterday".
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 398, 2, 0)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "Crash free sessions").Value != "99.5%" {
			t.Errorf("crash-free value: want %q, got %q", "99.5%", card(t, metrics, "Crash free sessions").Value)
		}
		if card(t, metrics, "Crash free sessions").Subtitle != "Down from 99.75% yesterday" {
			t.Errorf("crash-free subtitle: want %q, got %q", "Down from 99.75% yesterday", card(t, metrics, "Crash free sessions").Subtitle)
		}
	})

	// ---------- ANR-free sessions ----------

	t.Run("anr-free: card is absent when neither day recorded an ANR", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.AddDate(0, 0, -1)
		th.SeedAppMetrics(ctx, t, teamID, appID, yesterday, 10, 0, 0)
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 10, 0, 0)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if hasCard(metrics, "ANR free sessions") {
			t.Errorf("anr-free card should be absent, got cards %v", cardLabels(metrics))
		}
	})

	t.Run("anr-free: card is present at 100% when only yesterday recorded an ANR", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.AddDate(0, 0, -1)
		th.SeedAppMetrics(ctx, t, teamID, appID, yesterday, 9, 0, 1)
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 10, 0, 0)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "ANR free sessions").Value != "100%" {
			t.Errorf("anr-free value: want %q, got %q", "100%", card(t, metrics, "ANR free sessions").Value)
		}
		if card(t, metrics, "ANR free sessions").HasWarning {
			t.Error("anr-free should have no warning at 100%")
		}
		if card(t, metrics, "ANR free sessions").HasError {
			t.Error("anr-free should have no error at 100%")
		}
	})

	t.Run("anr-free: warning but no error when rate is 85-95%", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		// 90 generic + 10 ANR = 100 total, 10 ANR → 90% ANR-free
		// 90 <= 95 → warning; 90 > 85 → no error
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 90, 0, 10)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "ANR free sessions").Value != "90%" {
			t.Errorf("anr-free value: want %q, got %q", "90%", card(t, metrics, "ANR free sessions").Value)
		}
		if !card(t, metrics, "ANR free sessions").HasWarning {
			t.Error("anr-free should have warning at 90%")
		}
		if card(t, metrics, "ANR free sessions").HasError {
			t.Error("anr-free should not have error at 90%")
		}
	})

	t.Run("anr-free: warning and error when rate is 85% or below", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		// 8 generic + 2 ANR = 10 total, 2 ANR → 80% ANR-free
		// 80 <= 95 → warning; 80 <= 85 → error
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 8, 0, 2)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "ANR free sessions").Value != "80%" {
			t.Errorf("anr-free value: want %q, got %q", "80%", card(t, metrics, "ANR free sessions").Value)
		}
		if !card(t, metrics, "ANR free sessions").HasWarning {
			t.Error("anr-free should have warning at 80%")
		}
		if !card(t, metrics, "ANR free sessions").HasError {
			t.Error("anr-free should have error at 80%")
		}
	})

	t.Run("anr-free: subtitle shows better when ANR rate improved from yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		// Yesterday: 4 sessions, 2 ANRs → 50% ANR-free
		th.SeedAppMetrics(ctx, t, teamID, appID, yesterday, 2, 0, 2)
		// Today: 4 sessions, 0 ANRs → ANR rate 0, a 100% drop
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 4, 0, 0)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "ANR free sessions").Subtitle != "Up from 50% yesterday" {
			t.Errorf("anr-free subtitle: want %q, got %q", "Up from 50% yesterday", card(t, metrics, "ANR free sessions").Subtitle)
		}
	})

	t.Run("anr-free: subtitle shows worse when ANR rate degraded from yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		// Yesterday: 4 sessions, 1 ANR → ANR rate 0.25
		th.SeedAppMetrics(ctx, t, teamID, appID, yesterday, 3, 0, 1)
		// Today: 4 sessions, 2 ANRs → ANR rate 0.5, a 100% rise
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 2, 0, 2)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "ANR free sessions").Subtitle != "Down from 75% yesterday" {
			t.Errorf("anr-free subtitle: want %q, got %q", "Down from 75% yesterday", card(t, metrics, "ANR free sessions").Subtitle)
		}
	})

	t.Run("anr-free: subtitle compares against a yesterday that had no ANRs", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		// Yesterday: 4 sessions, 0 ANRs → 100% ANR-free
		th.SeedAppMetrics(ctx, t, teamID, appID, yesterday, 4, 0, 0)
		// Today: 4 sessions, 2 ANRs → ANR rate 0.5
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 2, 0, 2)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "ANR free sessions").Subtitle != "Down from 100% yesterday" {
			t.Errorf("anr-free subtitle: want %q, got %q", "Down from 100% yesterday", card(t, metrics, "ANR free sessions").Subtitle)
		}
	})

	t.Run("anr-free: subtitle is no previous day data when no yesterday events", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		// Seed today with an ANR; no yesterday data at all
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 9, 0, 1)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "ANR free sessions").Subtitle != "No previous day data" {
			t.Errorf("anr-free subtitle: want %q, got %q", "No previous day data", card(t, metrics, "ANR free sessions").Subtitle)
		}
	})

	t.Run("anr-free: subtitle shows no change when ANR rate unchanged from yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		// Both days: 10 sessions, 1 ANR → 90% ANR-free (identical rate)
		th.SeedAppMetrics(ctx, t, teamID, appID, yesterday, 9, 0, 1)
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 9, 0, 1)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "ANR free sessions").Subtitle != "No change from yesterday" {
			t.Errorf("anr-free subtitle: want %q, got %q", "No change from yesterday", card(t, metrics, "ANR free sessions").Subtitle)
		}
	})

	t.Run("spike uses default thresholds when no prefs row exists for app", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Default Prefs Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "No Prefs App", 30)
		// Deliberately no SeedAppThresholdPrefs — getAppThresholdPrefs returns ErrNoRows and falls back to defaults

		// 110 crashes / 200 sessions = 55% — meets default minCount=100 and rate=0.5%
		seedCrashSpike(ctx, t, teamID, appID, 200, 110)

		CreateCrashAndAnrAlerts(ctx)

		if got := countAlertsOfType(ctx, t, string(AlertTypeCrashSpike)); got != 1 {
			t.Errorf("want 1 crash alert using default thresholds (no prefs row seeded), got %d", got)
		}
	})

	t.Run("team threshold prefs override default warning/error thresholds", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		th.SeedAppThresholdPrefs(ctx, t, appID, 99.0, 97.0, 100, 0.5)

		now := time.Now().UTC()
		// total=50 => generic=48, crash=1, anr=1
		// crash-free=(48+1)/50=98%, anr-free=(48+1)/50=98%
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 48, 1, 1)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// With custom thresholds good=99, caution=97, 98% should be warning and not error.
		if !card(t, metrics, "Crash free sessions").HasWarning || card(t, metrics, "Crash free sessions").HasError {
			t.Fatalf("crash-free flags = (warning=%v, error=%v), want (true,false)", card(t, metrics, "Crash free sessions").HasWarning, card(t, metrics, "Crash free sessions").HasError)
		}
		if !card(t, metrics, "ANR free sessions").HasWarning || card(t, metrics, "ANR free sessions").HasError {
			t.Fatalf("anr-free flags = (warning=%v, error=%v), want (true,false)", card(t, metrics, "ANR free sessions").HasWarning, card(t, metrics, "ANR free sessions").HasError)
		}
	})

	t.Run("custom thresholds: value below good threshold is warning", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)
		th.SeedAppThresholdPrefs(ctx, t, appID, 98.5, 95.0, 100, 0.5)

		now := time.Now().UTC()
		// total=100 => generic=96, crash=2, anr=2
		// crash-free=(100-2)/100=98%, anr-free=(100-2)/100=98%
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 96, 2, 2)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if !card(t, metrics, "Crash free sessions").HasWarning || card(t, metrics, "Crash free sessions").HasError {
			t.Fatalf("crash-free flags = (warning=%v, error=%v), want (true,false)", card(t, metrics, "Crash free sessions").HasWarning, card(t, metrics, "Crash free sessions").HasError)
		}
		if !card(t, metrics, "ANR free sessions").HasWarning || card(t, metrics, "ANR free sessions").HasError {
			t.Fatalf("anr-free flags = (warning=%v, error=%v), want (true,false)", card(t, metrics, "ANR free sessions").HasWarning, card(t, metrics, "ANR free sessions").HasError)
		}
	})

	t.Run("custom thresholds: clearly poor values are warning and error", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)
		th.SeedAppThresholdPrefs(ctx, t, appID, 99.0, 97.0, 100, 0.5)

		now := time.Now().UTC()
		// total=30 => generic=10, crash=10, anr=10
		// crash-free=(30-10)/30=66.6%, anr-free=(30-10)/30=66.6%
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 10, 10, 10)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if !card(t, metrics, "Crash free sessions").HasWarning || !card(t, metrics, "Crash free sessions").HasError {
			t.Fatalf("crash-free flags = (warning=%v, error=%v), want (true,true)", card(t, metrics, "Crash free sessions").HasWarning, card(t, metrics, "Crash free sessions").HasError)
		}
		if !card(t, metrics, "ANR free sessions").HasWarning || !card(t, metrics, "ANR free sessions").HasError {
			t.Fatalf("anr-free flags = (warning=%v, error=%v), want (true,true)", card(t, metrics, "ANR free sessions").HasWarning, card(t, metrics, "ANR free sessions").HasError)
		}
	})

	t.Run("custom thresholds: value equal to good threshold is warning and not error", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)
		th.SeedAppThresholdPrefs(ctx, t, appID, 98.0, 95.0, 100, 0.5)

		now := time.Now().UTC()
		// total=100 => generic=96, crash=2, anr=2
		// crash-free/anr-free=(100-2)/100=98% (exactly good threshold)
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 96, 2, 2)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if !card(t, metrics, "Crash free sessions").HasWarning || card(t, metrics, "Crash free sessions").HasError {
			t.Fatalf("crash-free flags = (warning=%v, error=%v), want (true,false)", card(t, metrics, "Crash free sessions").HasWarning, card(t, metrics, "Crash free sessions").HasError)
		}
		if !card(t, metrics, "ANR free sessions").HasWarning || card(t, metrics, "ANR free sessions").HasError {
			t.Fatalf("anr-free flags = (warning=%v, error=%v), want (true,false)", card(t, metrics, "ANR free sessions").HasWarning, card(t, metrics, "ANR free sessions").HasError)
		}
	})

	t.Run("custom thresholds: value equal to caution threshold is warning and error", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)
		th.SeedAppThresholdPrefs(ctx, t, appID, 98.0, 95.0, 100, 0.5)

		now := time.Now().UTC()
		// total=100 => generic=90, crash=5, anr=5
		// crash-free/anr-free=(100-5)/100=95% (exactly caution threshold)
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 90, 5, 5)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if !card(t, metrics, "Crash free sessions").HasWarning || !card(t, metrics, "Crash free sessions").HasError {
			t.Fatalf("crash-free flags = (warning=%v, error=%v), want (true,true)", card(t, metrics, "Crash free sessions").HasWarning, card(t, metrics, "Crash free sessions").HasError)
		}
		if !card(t, metrics, "ANR free sessions").HasWarning || !card(t, metrics, "ANR free sessions").HasError {
			t.Fatalf("anr-free flags = (warning=%v, error=%v), want (true,true)", card(t, metrics, "ANR free sessions").HasWarning, card(t, metrics, "ANR free sessions").HasError)
		}
	})

	// ---------- Launch times ----------

	t.Run("launch: values are No Data when no launch events seeded", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 5, 0, 0) // generic only, no launch events

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		for _, label := range []string{"Cold launch p95", "Warm launch p95", "Hot launch p95"} {
			if card(t, metrics, label).Value != "No Data" {
				t.Errorf("%s launch value: want %q, got %q", label, "No Data", card(t, metrics, label).Value)
			}
			if card(t, metrics, label).Subtitle != "No previous day data" {
				t.Errorf("%s launch subtitle: want %q, got %q", label, "No previous day data", card(t, metrics, label).Subtitle)
			}
		}
	})

	t.Run("launch: unmeasured today names yesterday's duration without a direction", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		// Yesterday recorded a cold launch, today recorded none, so today has no
		// duration to compare against yesterday's.
		th.SeedLaunchEvent(ctx, t, teamID, appID, "cold_launch", 900, yesterday)
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 5, 0, 0)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "Cold launch p95").Value != "No Data" {
			t.Errorf("cold launch value: want %q, got %q", "No Data", card(t, metrics, "Cold launch p95").Value)
		}
		if card(t, metrics, "Cold launch p95").Subtitle != "Was 900ms yesterday" {
			t.Errorf("cold launch subtitle: want %q, got %q", "Was 900ms yesterday", card(t, metrics, "Cold launch p95").Subtitle)
		}
	})

	t.Run("launch: values show p95 duration when launch events are present", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		th.SeedLaunchEvent(ctx, t, teamID, appID, "cold_launch", 500, now)
		th.SeedLaunchEvent(ctx, t, teamID, appID, "warm_launch", 200, now)
		th.SeedLaunchEvent(ctx, t, teamID, appID, "hot_launch", 100, now)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "Cold launch p95").Value != "500ms" {
			t.Errorf("cold launch value: want %q, got %q", "500ms", card(t, metrics, "Cold launch p95").Value)
		}
		if card(t, metrics, "Warm launch p95").Value != "200ms" {
			t.Errorf("warm launch value: want %q, got %q", "200ms", card(t, metrics, "Warm launch p95").Value)
		}
		if card(t, metrics, "Hot launch p95").Value != "100ms" {
			t.Errorf("hot launch value: want %q, got %q", "100ms", card(t, metrics, "Hot launch p95").Value)
		}
	})

	t.Run("launch: subtitles are no previous day data when no yesterday events", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		th.SeedLaunchEvent(ctx, t, teamID, appID, "cold_launch", 500, now)
		th.SeedLaunchEvent(ctx, t, teamID, appID, "warm_launch", 200, now)
		th.SeedLaunchEvent(ctx, t, teamID, appID, "hot_launch", 100, now)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		for _, label := range []string{"Cold launch p95", "Warm launch p95", "Hot launch p95"} {
			if card(t, metrics, label).Subtitle != "No previous day data" {
				t.Errorf("%s launch subtitle: want %q, got %q", label, "No previous day data", card(t, metrics, label).Subtitle)
			}
		}
	})

	t.Run("launch: subtitle shows better when today is faster than yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		// Yesterday: cold_launch 1000ms; today: 500ms → 500ms faster
		th.SeedLaunchEvent(ctx, t, teamID, appID, "cold_launch", 1000, yesterday)
		th.SeedLaunchEvent(ctx, t, teamID, appID, "cold_launch", 500, now)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "Cold launch p95").Subtitle != "Down from 1000ms yesterday" {
			t.Errorf("cold launch subtitle: want %q, got %q", "Down from 1000ms yesterday", card(t, metrics, "Cold launch p95").Subtitle)
		}
	})

	t.Run("launch: subtitle shows worse when today is slower than yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		// Yesterday: cold_launch 500ms; today: 1000ms → 500ms slower
		th.SeedLaunchEvent(ctx, t, teamID, appID, "cold_launch", 500, yesterday)
		th.SeedLaunchEvent(ctx, t, teamID, appID, "cold_launch", 1000, now)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "Cold launch p95").Subtitle != "Up from 500ms yesterday" {
			t.Errorf("cold launch subtitle: want %q, got %q", "Up from 500ms yesterday", card(t, metrics, "Cold launch p95").Subtitle)
		}
	})

	t.Run("launch: subtitle shows no change when today equals yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		// Same cold_launch duration both days: 500ms → no change
		th.SeedLaunchEvent(ctx, t, teamID, appID, "cold_launch", 500, yesterday)
		th.SeedLaunchEvent(ctx, t, teamID, appID, "cold_launch", 500, now)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if card(t, metrics, "Cold launch p95").Subtitle != "No change from yesterday" {
			t.Errorf("cold launch subtitle: want %q, got %q", "No change from yesterday", card(t, metrics, "Cold launch p95").Subtitle)
		}
	})

	t.Run("launch: never has warning or error regardless of duration", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		th.SeedLaunchEvent(ctx, t, teamID, appID, "cold_launch", 5000, now)
		th.SeedLaunchEvent(ctx, t, teamID, appID, "warm_launch", 5000, now)
		th.SeedLaunchEvent(ctx, t, teamID, appID, "hot_launch", 5000, now)

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		for _, label := range []string{"Cold launch p95", "Warm launch p95", "Hot launch p95"} {
			if card(t, metrics, label).HasWarning {
				t.Errorf("%s should never have warning", label)
			}
			if card(t, metrics, label).HasError {
				t.Errorf("%s should never have error", label)
			}
		}
	})

	// ---------- Bug reports ----------

	t.Run("bug report metric is included when reports exist today", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 5, 0, 0)
		// Seed 3 bug reports today, none yesterday → subtitle is "No previous day data"
		for i := 0; i < 3; i++ {
			th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), fmt.Sprintf("Bug %d", i), now.Add(-time.Duration(i+1)*time.Minute))
		}

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !hasCard(metrics, "Bug reports") {
			t.Fatalf("bug reports card should be present, got cards %v", cardLabels(metrics))
		}
		if card(t, metrics, "Bug reports").Value != "3" {
			t.Errorf("bug report count: want %q, got %q", "3", card(t, metrics, "Bug reports").Value)
		}
		if card(t, metrics, "Bug reports").Label != "Bug reports" {
			t.Errorf("bug report label: want %q, got %q", "Bug reports", card(t, metrics, "Bug reports").Label)
		}
		if card(t, metrics, "Bug reports").Subtitle != "No previous day data" {
			t.Errorf("bug report subtitle: want %q, got %q", "No previous day data", card(t, metrics, "Bug reports").Subtitle)
		}
		if card(t, metrics, "Bug reports").HasWarning {
			t.Error("bug report metric should not have warning")
		}
		if card(t, metrics, "Bug reports").HasError {
			t.Error("bug report metric should not have error")
		}
	})

	t.Run("bug report metric is absent when no reports today", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 5, 0, 0)
		// No bug reports seeded

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if hasCard(metrics, "Bug reports") {
			t.Errorf("bug reports card should be absent, got cards %v", cardLabels(metrics))
		}
	})

	t.Run("bug report: subtitle shows greater when today exceeds yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 5, 0, 0)
		// Today: 5 reports, yesterday: 3 reports → "2 greater than yesterday"
		for i := 0; i < 5; i++ {
			th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), fmt.Sprintf("Today bug %d", i), now.Add(-time.Duration(i+1)*time.Minute))
		}
		for i := 0; i < 3; i++ {
			th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), fmt.Sprintf("Yesterday bug %d", i), yesterday.Add(-time.Duration(i+1)*time.Minute))
		}

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !hasCard(metrics, "Bug reports") {
			t.Fatalf("bug reports card should be present, got cards %v", cardLabels(metrics))
		}
		if card(t, metrics, "Bug reports").Subtitle != "Up from 3 yesterday" {
			t.Errorf("bug report subtitle: want %q, got %q", "Up from 3 yesterday", card(t, metrics, "Bug reports").Subtitle)
		}
	})

	t.Run("bug report: subtitle shows less when today is below yesterday", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 5, 0, 0)
		// Today: 3 reports, yesterday: 5 reports → "2 less than yesterday"
		for i := 0; i < 3; i++ {
			th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), fmt.Sprintf("Today bug %d", i), now.Add(-time.Duration(i+1)*time.Minute))
		}
		for i := 0; i < 5; i++ {
			th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), fmt.Sprintf("Yesterday bug %d", i), yesterday.Add(-time.Duration(i+1)*time.Minute))
		}

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !hasCard(metrics, "Bug reports") {
			t.Fatalf("bug reports card should be present, got cards %v", cardLabels(metrics))
		}
		if card(t, metrics, "Bug reports").Subtitle != "Down from 5 yesterday" {
			t.Errorf("bug report subtitle: want %q, got %q", "Down from 5 yesterday", card(t, metrics, "Bug reports").Subtitle)
		}
	})

	t.Run("bug report: subtitle shows no change when counts are equal", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "T")
		th.SeedApp(ctx, t, appID, teamID, "A", 30)

		now := time.Now().UTC()
		yesterday := now.Add(-25 * time.Hour)
		th.SeedAppMetrics(ctx, t, teamID, appID, now, 5, 0, 0)
		// Today: 4 reports, yesterday: 4 reports → "No change from yesterday"
		for i := 0; i < 4; i++ {
			th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), fmt.Sprintf("Today bug %d", i), now.Add(-time.Duration(i+1)*time.Minute))
		}
		for i := 0; i < 4; i++ {
			th.SeedBugReport(ctx, t, teamID, appID, uuid.New().String(), fmt.Sprintf("Yesterday bug %d", i), yesterday.Add(-time.Duration(i+1)*time.Minute))
		}

		app := makeApp(teamID, appID)
		metrics, _, err := getDailySummaryMetrics(ctx, now, &app)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !hasCard(metrics, "Bug reports") {
			t.Fatalf("bug reports card should be present, got cards %v", cardLabels(metrics))
		}
		if card(t, metrics, "Bug reports").Subtitle != "No change from yesterday" {
			t.Errorf("bug report subtitle: want %q, got %q", "No change from yesterday", card(t, metrics, "Bug reports").Subtitle)
		}
	})
}

// --------------------------------------------------------------------------
// Tests — Daily Summary
// --------------------------------------------------------------------------

func TestCreateDailySummary(t *testing.T) {
	t.Run("no app metrics data creates no pending messages", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Summary Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Summary App", 30)
		// No events seeded → app_metrics empty → getDailySummaryMetrics returns error

		CreateDailySummary(ctx)

		if got := countPending(ctx, t); got != 0 {
			t.Errorf("want 0 pending messages when no data, got %d", got)
		}
	})

	t.Run("events yesterday populate metrics and produce a summary email", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Summary Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Summary App", 30)

		// Seed events for the previous UTC day; CreateDailySummary reports yesterday.
		summaryDate := time.Now().UTC().AddDate(0, 0, -1)
		th.SeedGenericEvents(ctx, t, teamID, appID, 5, summaryDate)

		CreateDailySummary(ctx)

		if got := countPendingByChannel(ctx, t, "email"); got != 1 {
			t.Errorf("want 1 daily summary email, got %d", got)
		}
	})

	t.Run("team with slack integration also receives a slack summary message", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Slack Summary Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Slack Summary App", 30)
		th.SeedTeamSlack(ctx, t, teamID, []string{"C0SUMMARY"})

		summaryDate := time.Now().UTC().AddDate(0, 0, -1)
		th.SeedGenericEvents(ctx, t, teamID, appID, 5, summaryDate)

		CreateDailySummary(ctx)

		if got := countPendingByChannel(ctx, t, "email"); got != 1 {
			t.Errorf("want 1 daily summary email, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "slack"); got != 1 {
			t.Errorf("want 1 daily summary slack message, got %d", got)
		}
	})

	t.Run("team with no apps creates no pending messages", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "No Apps Team")

		CreateDailySummary(ctx)

		if got := countPending(ctx, t); got != 0 {
			t.Errorf("want 0 pending messages, got %d", got)
		}
	})

	t.Run("multiple apps are combined into one team summary email", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		app1 := uuid.New().String()
		app2 := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Multi App Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, app1, teamID, "App One", 30)
		th.SeedApp(ctx, t, app2, teamID, "App Two", 30)

		summaryDate := time.Now().UTC().AddDate(0, 0, -1)
		th.SeedGenericEvents(ctx, t, teamID, app1, 5, summaryDate)
		th.SeedGenericEvents(ctx, t, teamID, app2, 5, summaryDate)

		CreateDailySummary(ctx)

		if got := countPendingByChannel(ctx, t, "email"); got != 1 {
			t.Fatalf("want 1 team daily summary email covering both apps, got %d", got)
		}

		var data []byte
		if err := th.PgPool.QueryRow(ctx,
			"SELECT data FROM pending_alert_messages WHERE channel = 'email'").Scan(&data); err != nil {
			t.Fatalf("read queued email: %v", err)
		}
		var info email.EmailInfo
		if err := json.Unmarshal(data, &info); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if info.Subject != "Multi App Team Daily Summary" {
			t.Errorf("Subject = %q, want %q", info.Subject, "Multi App Team Daily Summary")
		}
		for _, appName := range []string{"App One", "App Two"} {
			if !strings.Contains(info.Body, appName) {
				t.Errorf("email body does not mention %q", appName)
			}
		}
	})

	t.Run("apps without data are left out and busier apps come first", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		busyApp := uuid.New().String()
		quietApp := uuid.New().String()
		emptyApp := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Ordered Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		// Seeded so alphabetical order disagrees with session order: the app
		// named last has the most sessions and must still come first.
		th.SeedApp(ctx, t, busyApp, teamID, "Zebra App", 30)
		th.SeedApp(ctx, t, quietApp, teamID, "Alpha App", 30)
		th.SeedApp(ctx, t, emptyApp, teamID, "Empty App", 30)

		summaryDate := time.Now().UTC().AddDate(0, 0, -1)
		th.SeedGenericEvents(ctx, t, teamID, busyApp, 8, summaryDate)
		th.SeedGenericEvents(ctx, t, teamID, quietApp, 3, summaryDate)

		CreateDailySummary(ctx)

		if got := countPendingByChannel(ctx, t, "email"); got != 1 {
			t.Fatalf("want 1 team daily summary email, got %d", got)
		}

		var data []byte
		if err := th.PgPool.QueryRow(ctx,
			"SELECT data FROM pending_alert_messages WHERE channel = 'email'").Scan(&data); err != nil {
			t.Fatalf("read queued email: %v", err)
		}
		var info email.EmailInfo
		if err := json.Unmarshal(data, &info); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}

		if strings.Contains(info.Body, "Empty App") {
			t.Error("email body mentions the app with no data")
		}
		zebraAt := strings.Index(info.Body, "Zebra App")
		alphaAt := strings.Index(info.Body, "Alpha App")
		if zebraAt < 0 || alphaAt < 0 {
			t.Fatalf("email body is missing an app section: zebra=%d alpha=%d", zebraAt, alphaAt)
		}
		if zebraAt > alphaAt {
			t.Error("app with more sessions should appear before the quieter app")
		}
	})

	t.Run("daily summary with two slack channels queues one message per channel", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Summary Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Summary App", 30)
		th.SeedTeamSlack(ctx, t, teamID, []string{"C0SUM1", "C0SUM2"})

		summaryDate := time.Now().UTC().AddDate(0, 0, -1)
		th.SeedGenericEvents(ctx, t, teamID, appID, 5, summaryDate)

		CreateDailySummary(ctx)

		if got := countPendingByChannel(ctx, t, "slack"); got != 2 {
			t.Errorf("want 2 pending slack summary messages (one per channel), got %d", got)
		}
	})

	t.Run("daily summary with active slack but empty channel list queues no slack messages", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Summary Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Summary App", 30)
		th.SeedTeamSlack(ctx, t, teamID, []string{})

		summaryDate := time.Now().UTC().AddDate(0, 0, -1)
		th.SeedGenericEvents(ctx, t, teamID, appID, 5, summaryDate)

		CreateDailySummary(ctx)

		if got := countPendingByChannel(ctx, t, "slack"); got != 0 {
			t.Errorf("want 0 slack messages when channel list is empty, got %d", got)
		}
	})

	t.Run("custom threshold prefs are reflected in queued daily summary email and slack status icons", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Summary Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Summary App", 30)
		th.SeedTeamSlack(ctx, t, teamID, []string{"C0SUMMARY"})
		th.SeedAppThresholdPrefs(ctx, t, appID, 99.0, 97.0, 100, 0.5)

		summaryDate := time.Now().UTC().AddDate(0, 0, -1)
		// total=100 => generic=96, crash=2, anr=2 => 98% for both error-rate metrics
		// Under custom thresholds (good=99, caution=97), this should be warning.
		th.SeedAppMetrics(ctx, t, teamID, appID, summaryDate, 96, 2, 2)

		CreateDailySummary(ctx)

		if got := countPendingByChannel(ctx, t, "email"); got != 1 {
			t.Fatalf("want 1 daily summary email, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "slack"); got != 1 {
			t.Fatalf("want 1 daily summary slack message, got %d", got)
		}

		var emailBody string
		err := th.PgPool.QueryRow(ctx, `
			SELECT data->>'body'
			FROM pending_alert_messages
			WHERE team_id = $1::uuid AND app_id IS NULL AND channel = 'email'
			ORDER BY created_at DESC
			LIMIT 1
		`, teamID).Scan(&emailBody)
		if err != nil {
			t.Fatalf("query daily summary email body: %v", err)
		}
		if !strings.Contains(emailBody, "#d08700") {
			t.Fatalf("expected daily summary email body to include warning icon color for custom thresholds")
		}

		var slackRaw string
		err = th.PgPool.QueryRow(ctx, `
			SELECT data::text
			FROM pending_alert_messages
			WHERE team_id = $1::uuid AND app_id IS NULL AND channel = 'slack'
			ORDER BY created_at DESC
			LIMIT 1
		`, teamID).Scan(&slackRaw)
		if err != nil {
			t.Fatalf("query daily summary slack payload: %v", err)
		}

		var payload map[string]any
		if err := json.Unmarshal([]byte(slackRaw), &payload); err != nil {
			t.Fatalf("unmarshal slack payload: %v", err)
		}
		payloadJSON, _ := json.Marshal(payload)
		if !strings.Contains(string(payloadJSON), "`caution`") {
			t.Fatalf("expected slack payload to include the caution status tag for custom thresholds")
		}
	})

	t.Run("custom threshold prefs are reflected as error in queued daily summary email and slack status icons", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Summary Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Summary App", 30)
		th.SeedTeamSlack(ctx, t, teamID, []string{"C0SUMMARY"})
		th.SeedAppThresholdPrefs(ctx, t, appID, 99.0, 97.0, 100, 0.5)

		summaryDate := time.Now().UTC().AddDate(0, 0, -1)
		// total=100 => generic=90, crash=5, anr=5 => 95% for both error-rate metrics
		// Under custom thresholds (good=99, caution=97), this should be error.
		th.SeedAppMetrics(ctx, t, teamID, appID, summaryDate, 90, 5, 5)

		CreateDailySummary(ctx)

		if got := countPendingByChannel(ctx, t, "email"); got != 1 {
			t.Fatalf("want 1 daily summary email, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "slack"); got != 1 {
			t.Fatalf("want 1 daily summary slack message, got %d", got)
		}

		var emailBody string
		err := th.PgPool.QueryRow(ctx, `
			SELECT data->>'body'
			FROM pending_alert_messages
			WHERE team_id = $1::uuid AND app_id IS NULL AND channel = 'email'
			ORDER BY created_at DESC
			LIMIT 1
		`, teamID).Scan(&emailBody)
		if err != nil {
			t.Fatalf("query daily summary email body: %v", err)
		}
		if !strings.Contains(emailBody, "#e7000b") {
			t.Fatalf("expected daily summary email body to include error icon color for custom thresholds")
		}

		var slackRaw string
		err = th.PgPool.QueryRow(ctx, `
			SELECT data::text
			FROM pending_alert_messages
			WHERE team_id = $1::uuid AND app_id IS NULL AND channel = 'slack'
			ORDER BY created_at DESC
			LIMIT 1
		`, teamID).Scan(&slackRaw)
		if err != nil {
			t.Fatalf("query daily summary slack payload: %v", err)
		}

		var payload map[string]any
		if err := json.Unmarshal([]byte(slackRaw), &payload); err != nil {
			t.Fatalf("unmarshal slack payload: %v", err)
		}
		payloadJSON, _ := json.Marshal(payload)
		if !strings.Contains(string(payloadJSON), "`poor`") {
			t.Fatalf("expected slack payload to include the poor status tag for custom thresholds")
		}
	})

	t.Run("team blocked by autumn produces no summary notifications", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		origBilling := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = true
		t.Cleanup(func() { server.Server.Config.BillingEnabled = origBilling })

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()
		customerID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Blocked Team")
		th.SeedTeamAutumnCustomer(ctx, t, teamID, customerID)
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Blocked App", 30)
		th.SeedTeamSlack(ctx, t, teamID, []string{"C0BLOCKED"})

		autumntest.MockCheck(t, func(_ context.Context, cid, feature string) (*autumn.CheckResponse, error) {
			if cid == customerID && feature == "bytes" {
				return &autumn.CheckResponse{Allowed: false}, nil
			}
			return &autumn.CheckResponse{Allowed: true}, nil
		})

		summaryDate := time.Now().UTC().AddDate(0, 0, -1)
		th.SeedGenericEvents(ctx, t, teamID, appID, 5, summaryDate)

		CreateDailySummary(ctx)

		if got := countPendingByChannel(ctx, t, "email"); got != 0 {
			t.Errorf("want 0 emails for blocked team, got %d", got)
		}
		if got := countPendingByChannel(ctx, t, "slack"); got != 0 {
			t.Errorf("want 0 slack messages for blocked team, got %d", got)
		}
	})

	t.Run("autumn.Check error → team still receives summary (fail-open)", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		origBilling := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = true
		t.Cleanup(func() { server.Server.Config.BillingEnabled = origBilling })

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()
		customerID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Outage Team")
		th.SeedTeamAutumnCustomer(ctx, t, teamID, customerID)
		th.SeedUser(ctx, t, userID, "owner-err@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Outage App", 30)

		autumntest.MockCheck(t, func(_ context.Context, _, _ string) (*autumn.CheckResponse, error) {
			return nil, fmt.Errorf("autumn unreachable")
		})

		summaryDate := time.Now().UTC().AddDate(0, 0, -1)
		th.SeedGenericEvents(ctx, t, teamID, appID, 5, summaryDate)

		CreateDailySummary(ctx)

		if got := countPendingByChannel(ctx, t, "email"); got == 0 {
			t.Errorf("want >=1 email when autumn errors (fail-open), got 0")
		}
	})

	t.Run("team without autumn_customer_id passes through filter", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		origBilling := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = true
		t.Cleanup(func() { server.Server.Config.BillingEnabled = origBilling })

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		// No SeedTeamAutumnCustomer call — autumn_customer_id is NULL.
		th.SeedTeam(ctx, t, teamID, "Unprovisioned Team")
		th.SeedUser(ctx, t, userID, "owner-unprov@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Unprovisioned App", 30)

		// autumn.Check should never be called for a team without a customer_id.
		autumntest.MockCheck(t, func(_ context.Context, _, _ string) (*autumn.CheckResponse, error) {
			t.Errorf("autumn.Check should not be called for team without autumn_customer_id")
			return &autumn.CheckResponse{Allowed: false}, nil
		})

		summaryDate := time.Now().UTC().AddDate(0, 0, -1)
		th.SeedGenericEvents(ctx, t, teamID, appID, 5, summaryDate)

		CreateDailySummary(ctx)

		if got := countPendingByChannel(ctx, t, "email"); got == 0 {
			t.Errorf("want >=1 email for unprovisioned team, got 0")
		}
	})

	t.Run("billing disabled → filter short-circuits (no autumn calls)", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		// Default BillingEnabled is false; assert explicitly.
		if server.Server.Config.BillingEnabled {
			t.Fatal("precondition: BillingEnabled should be false by default")
		}

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Self-hosted Team")
		custID := uuid.New().String()
		th.SeedTeamAutumnCustomer(ctx, t, teamID, custID)
		th.SeedUser(ctx, t, userID, "owner-self@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Self-hosted App", 30)

		autumntest.MockCheck(t, func(_ context.Context, _, _ string) (*autumn.CheckResponse, error) {
			t.Errorf("autumn.Check should not be called when BillingEnabled is false")
			return &autumn.CheckResponse{Allowed: false}, nil
		})

		summaryDate := time.Now().UTC().AddDate(0, 0, -1)
		th.SeedGenericEvents(ctx, t, teamID, appID, 5, summaryDate)

		CreateDailySummary(ctx)

		if got := countPendingByChannel(ctx, t, "email"); got == 0 {
			t.Errorf("want >=1 email when billing disabled, got 0")
		}
	})

	// Guards that getActiveTeams goes through the cache: a second pass over the
	// same customer is served from Valkey instead of re-hitting Autumn.
	t.Run("getActiveTeams caches the verdict — second call skips autumn.Check", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		origBilling := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = true
		t.Cleanup(func() { server.Server.Config.BillingEnabled = origBilling })

		teamID := uuid.New().String()
		customerID := uuid.New().String()
		th.SeedTeam(ctx, t, teamID, "Cached Team")
		th.SeedTeamAutumnCustomer(ctx, t, teamID, customerID)

		var checkCalls int
		autumntest.MockCheck(t, func(_ context.Context, _, _ string) (*autumn.CheckResponse, error) {
			checkCalls++
			return &autumn.CheckResponse{Allowed: true}, nil
		})

		if _, err := getActiveTeams(ctx); err != nil {
			t.Fatalf("first getActiveTeams: %v", err)
		}
		if _, err := getActiveTeams(ctx); err != nil {
			t.Fatalf("second getActiveTeams: %v", err)
		}
		if checkCalls != 1 {
			t.Errorf("autumn.Check called %d times, want 1 (second call should hit the shared Valkey cache)", checkCalls)
		}
	})
}

// --------------------------------------------------------------------------
// Tests — team daily summary Slack formatting and app ordering
// --------------------------------------------------------------------------

// slackBlockType reads the type string out of any of the concrete Slack block
// structs, which share no interface beyond the empty one.
func slackBlockType(t *testing.T, block slack.SlackBlock) string {
	t.Helper()
	switch b := block.(type) {
	case slack.SlackHeaderBlock:
		return b.Type
	case slack.SlackSectionBlock:
		return b.Type
	case slack.SlackDividerBlock:
		return b.Type
	case slack.SlackContextBlock:
		return b.Type
	case slack.SlackActionsBlock:
		return b.Type
	default:
		t.Fatalf("unexpected block type %T", block)
		return ""
	}
}

// sectionText returns the mrkdwn text of a section block, failing the test if
// the block is not a section or carries no text.
func sectionText(t *testing.T, block slack.SlackBlock) string {
	t.Helper()
	section, ok := block.(slack.SlackSectionBlock)
	if !ok {
		t.Fatalf("block is %T, want a section", block)
	}
	if section.Text == nil {
		t.Fatal("section block has no text")
	}
	return section.Text.Text
}

// summaryApps builds n app summaries, each with one healthy metric, named so
// their order in the message is easy to assert on.
func summaryApps(n int) []email.AppDailySummary {
	apps := make([]email.AppDailySummary, 0, n)
	for i := range n {
		apps = append(apps, email.AppDailySummary{
			AppName: fmt.Sprintf("App %03d", i+1),
			Metrics: []email.MetricData{{Label: "Sessions", Value: "10", Subtitle: "No previous day data"}},
		})
	}
	return apps
}

func TestFormatTeamDailySummarySlackMessage(t *testing.T) {
	date := time.Date(2026, 8, 18, 0, 0, 0, 0, time.UTC)

	t.Run("multi-app input produces the expected block sequence", func(t *testing.T) {
		apps := []email.AppDailySummary{
			{
				AppName: "Checkout",
				Metrics: []email.MetricData{
					{Label: "Sessions", Value: "1.2K", Subtitle: "Up from 1K yesterday"},
					{Label: "Crash free sessions", Value: "97%", Subtitle: "Down from 99% yesterday", HasWarning: true},
					{Label: "ANR free sessions", Value: "80%", Subtitle: "Down from 95% yesterday", HasWarning: true, HasError: true},
				},
			},
			{
				AppName: "Storefront",
				Metrics: []email.MetricData{
					{Label: "Sessions", Value: "300", Subtitle: "No change from yesterday"},
				},
			},
		}

		msg := formatTeamDailySummarySlackMessage("Acme", "https://test.measure.sh/team-1/overview", date, apps)

		wantTypes := []string{
			"header", "section", "divider",
			"section", "section", "divider",
			"section", "section", "divider",
			"actions",
		}
		if len(msg.Blocks) != len(wantTypes) {
			t.Fatalf("got %d blocks, want %d", len(msg.Blocks), len(wantTypes))
		}
		for i, want := range wantTypes {
			if got := slackBlockType(t, msg.Blocks[i]); got != want {
				t.Errorf("block %d type = %q, want %q", i, got, want)
			}
		}

		header := msg.Blocks[0].(slack.SlackHeaderBlock)
		if header.Text.Text != "Acme — Daily Summary" {
			t.Errorf("header = %q, want %q", header.Text.Text, "Acme — Daily Summary")
		}
		if got := sectionText(t, msg.Blocks[1]); got != "*August 18, 2026*  _(last 24 hours)_" {
			t.Errorf("date section = %q", got)
		}

		if got := sectionText(t, msg.Blocks[3]); got != "*Checkout*" {
			t.Errorf("first app name section = %q, want %q", got, "*Checkout*")
		}
		checkoutLines := strings.Split(sectionText(t, msg.Blocks[4]), "\n")
		if len(checkoutLines) != 3 {
			t.Fatalf("got %d metric lines for Checkout, want 3", len(checkoutLines))
		}
		if checkoutLines[0] != "• *Sessions*  1.2K · _Up from 1K yesterday_" {
			t.Errorf("healthy metric line = %q, want no status tag", checkoutLines[0])
		}
		if !strings.HasSuffix(checkoutLines[1], " `caution`") {
			t.Errorf("warning metric line = %q, want a trailing `caution` tag", checkoutLines[1])
		}
		if !strings.HasSuffix(checkoutLines[2], " `poor`") {
			t.Errorf("error metric line = %q, want a trailing `poor` tag (error outranks warning)", checkoutLines[2])
		}

		if got := sectionText(t, msg.Blocks[6]); got != "*Storefront*" {
			t.Errorf("second app name section = %q, want %q", got, "*Storefront*")
		}

		actions := msg.Blocks[len(msg.Blocks)-1].(slack.SlackActionsBlock)
		if len(actions.Elements) != 1 || actions.Elements[0].URL != "https://test.measure.sh/team-1/overview" {
			t.Errorf("actions block = %+v, want one button pointing at the team overview", actions)
		}
	})

	t.Run("app names with mrkdwn control characters are escaped", func(t *testing.T) {
		apps := []email.AppDailySummary{
			{
				AppName: "<Foo & Bar>",
				Metrics: []email.MetricData{{Label: "Sessions", Value: "10", Subtitle: "No previous day data"}},
			},
		}

		msg := formatTeamDailySummarySlackMessage("Team <A&B>", "https://test.measure.sh/team-1/overview", date, apps)

		if got := sectionText(t, msg.Blocks[3]); got != "*&lt;Foo &amp; Bar&gt;*" {
			t.Errorf("app name section = %q, want %q", got, "*&lt;Foo &amp; Bar&gt;*")
		}
		// The header is plain_text, which Slack renders verbatim, so the team
		// name must stay unescaped there.
		header := msg.Blocks[0].(slack.SlackHeaderBlock)
		if header.Text.Text != "Team <A&B> — Daily Summary" {
			t.Errorf("header = %q, want the unescaped team name", header.Text.Text)
		}
	})

	t.Run("a team whose apps all fit gets no omission context block", func(t *testing.T) {
		msg := formatTeamDailySummarySlackMessage("Acme", "https://test.measure.sh/team-1/overview", date, summaryApps(15))

		// 3 leading blocks + 15 apps * 3 blocks + 1 actions block.
		if len(msg.Blocks) != 49 {
			t.Errorf("got %d blocks, want 49", len(msg.Blocks))
		}
		for i, block := range msg.Blocks {
			if slackBlockType(t, block) == "context" {
				t.Errorf("block %d is a context block, want none when every app fits", i)
			}
		}
	})

	t.Run("more apps than fit are capped at 50 blocks with an omission context block", func(t *testing.T) {
		msg := formatTeamDailySummarySlackMessage("Acme", "https://test.measure.sh/team-1/overview", date, summaryApps(20))

		if len(msg.Blocks) > 50 {
			t.Fatalf("got %d blocks, slack rejects more than 50", len(msg.Blocks))
		}
		if len(msg.Blocks) != 50 {
			t.Errorf("got %d blocks, want exactly 50 (15 apps shown plus overhead)", len(msg.Blocks))
		}

		var joined strings.Builder
		for _, block := range msg.Blocks {
			if section, ok := block.(slack.SlackSectionBlock); ok && section.Text != nil {
				joined.WriteString(section.Text.Text)
				joined.WriteString("\n")
			}
		}
		if !strings.Contains(joined.String(), "*App 015*") {
			t.Error("fifteenth app should still be shown")
		}
		if strings.Contains(joined.String(), "*App 016*") {
			t.Error("sixteenth app should be dropped")
		}

		contextBlock, ok := msg.Blocks[len(msg.Blocks)-2].(slack.SlackContextBlock)
		if !ok {
			t.Fatalf("second-to-last block is %T, want the omission context block", msg.Blocks[len(msg.Blocks)-2])
		}
		if len(contextBlock.Elements) != 1 || contextBlock.Elements[0].Text != "+5 more apps not shown" {
			t.Errorf("context block = %+v, want a single \"+5 more apps not shown\" line", contextBlock)
		}
		if got := slackBlockType(t, msg.Blocks[len(msg.Blocks)-1]); got != "actions" {
			t.Errorf("last block type = %q, want actions after the context block", got)
		}
	})

	t.Run("a team name over Slack's header limit is truncated with an ellipsis", func(t *testing.T) {
		longName := strings.Repeat("x", 256)
		apps := []email.AppDailySummary{
			{AppName: "Checkout", Metrics: []email.MetricData{{Label: "Sessions", Value: "1", Subtitle: "No previous day data"}}},
		}

		msg := formatTeamDailySummarySlackMessage(longName, "https://test.measure.sh/team-1/overview", date, apps)

		header := msg.Blocks[0].(slack.SlackHeaderBlock)
		headerRunes := []rune(header.Text.Text)
		if len(headerRunes) != slackHeaderTextLimit {
			t.Errorf("header length = %d runes, want %d", len(headerRunes), slackHeaderTextLimit)
		}
		if headerRunes[len(headerRunes)-1] != '…' {
			t.Errorf("header = %q, want an ellipsis at the end", header.Text.Text)
		}
		if !strings.HasPrefix(header.Text.Text, "xxx") {
			t.Errorf("header = %q, want it to start with the team name", header.Text.Text)
		}
	})

	t.Run("a team name within Slack's header limit is kept whole", func(t *testing.T) {
		apps := []email.AppDailySummary{
			{AppName: "Checkout", Metrics: []email.MetricData{{Label: "Sessions", Value: "1", Subtitle: "No previous day data"}}},
		}

		msg := formatTeamDailySummarySlackMessage("Acme", "https://test.measure.sh/team-1/overview", date, apps)

		header := msg.Blocks[0].(slack.SlackHeaderBlock)
		if header.Text.Text != "Acme — Daily Summary" {
			t.Errorf("header = %q, want %q", header.Text.Text, "Acme — Daily Summary")
		}
	})
}

func TestFormatSlackAlertMessage(t *testing.T) {
	// The message comes from the shared email builders: <br> marks line
	// breaks and app-generated text carries raw mrkdwn control characters.
	msg := formatSlackAlertMessage(
		"Checkout - Crash Spike Alert",
		"Crashes are spiking at:<br><br>Foo.kt: <init>() - x < 1",
		"https://test.measure.sh/dashboard",
	)

	got := sectionText(t, msg.Blocks[1])
	want := "Crashes are spiking at:\n\n" +
		"Foo.kt: &lt;init&gt;() - x &lt; 1"
	if got != want {
		t.Errorf("section text = %q, want %q", got, want)
	}
	if strings.Contains(got, "<br>") {
		t.Errorf("section text = %q, want no <br> remnants", got)
	}

	// The header is plain_text, which Slack renders verbatim, so the title
	// must stay unescaped there.
	header := msg.Blocks[0].(slack.SlackHeaderBlock)
	if header.Text.Text != "🚨 Checkout - Crash Spike Alert" {
		t.Errorf("header = %q, want the unescaped title", header.Text.Text)
	}
}

func TestSortedAppSummaries(t *testing.T) {
	entries := []appSummaryWithSessions{
		{Summary: email.AppDailySummary{AppName: "Bravo"}, SessionsToday: 5},
		{Summary: email.AppDailySummary{AppName: "Alpha"}, SessionsToday: 5},
		{Summary: email.AppDailySummary{AppName: "Zulu"}, SessionsToday: 50},
		{Summary: email.AppDailySummary{AppName: "Quiet"}, SessionsToday: 0},
	}

	got := sortedAppSummaries(entries)

	want := []string{"Zulu", "Alpha", "Bravo", "Quiet"}
	if len(got) != len(want) {
		t.Fatalf("got %d summaries, want %d", len(got), len(want))
	}
	for i, name := range want {
		if got[i].AppName != name {
			t.Errorf("position %d = %q, want %q (sessions descending, name ascending on ties)", i, got[i].AppName, name)
		}
	}
}

// --------------------------------------------------------------------------
// Tests — internal helper coverage
// --------------------------------------------------------------------------

// TestScheduleInternalHelpers exercises code paths that are unreachable from
// the public API but accessible within the same package.
func TestScheduleInternalHelpers(t *testing.T) {
	t.Run("scheduleEmailAlertsForteamMembers uses generic subject for unknown alert type", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		alert := Alert{
			ID:       uuid.New(),
			TeamID:   uuid.MustParse(teamID),
			AppID:    uuid.MustParse(appID),
			EntityID: uuid.New().String(),
			Type:     "custom_unknown_type",
		}

		scheduleEmailAlertsForteamMembers(ctx, alert, "Something happened", "https://test.measure.sh/dashboard", "Test App")

		if got := countPendingByChannel(ctx, t, "email"); got != 1 {
			t.Errorf("want 1 pending email for unknown alert type, got %d", got)
		}
	})

	t.Run("scheduleEmailAlertsForteamMembers sets AlertType in queued email", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		alert := Alert{
			ID:       uuid.New(),
			TeamID:   uuid.MustParse(teamID),
			AppID:    uuid.MustParse(appID),
			EntityID: uuid.New().String(),
			Type:     string(AlertTypeCrashSpike),
		}

		scheduleEmailAlertsForteamMembers(ctx, alert, "Crash detected", "https://test.measure.sh", "Test App")

		var data []byte
		err := th.PgPool.QueryRow(ctx,
			"SELECT data FROM pending_alert_messages WHERE channel = 'email'").Scan(&data)
		if err != nil {
			t.Fatalf("read queued email: %v", err)
		}

		var info email.EmailInfo
		if err := json.Unmarshal(data, &info); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if info.AlertType != string(AlertTypeCrashSpike) {
			t.Errorf("AlertType = %q, want %q", info.AlertType, string(AlertTypeCrashSpike))
		}
	})

	t.Run("scheduleDailySummaryEmailForTeamMembers sets daily_summary AlertType and passes the subject through", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, userID, "owner@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")

		scheduleDailySummaryEmailForTeamMembers(ctx, uuid.MustParse(teamID), "Test Team Daily Summary", "<p>Summary</p>")

		var data []byte
		err := th.PgPool.QueryRow(ctx,
			"SELECT data FROM pending_alert_messages WHERE channel = 'email' AND app_id IS NULL").Scan(&data)
		if err != nil {
			t.Fatalf("read queued email: %v", err)
		}

		var info email.EmailInfo
		if err := json.Unmarshal(data, &info); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if info.AlertType != "daily_summary" {
			t.Errorf("AlertType = %q, want %q", info.AlertType, "daily_summary")
		}
		if info.Subject != "Test Team Daily Summary" {
			t.Errorf("Subject = %q, want %q", info.Subject, "Test Team Daily Summary")
		}
	})
}

// TestNotifPrefFiltering tests the notification preference lookup and
// filtering logic used by SendPendingAlertEmails.
func TestNotifPrefFiltering(t *testing.T) {
	t.Run("getNotifPrefByEmail returns all-true defaults when user has no prefs", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		th.SeedUser(ctx, t, userID, "noprofs@example.com")

		errorSpike, appHangSpike, bugReport, dailySummary := getNotifPrefByEmail(ctx, "noprofs@example.com")

		if !errorSpike || !appHangSpike || !bugReport || !dailySummary {
			t.Errorf("expected all-true defaults, got error_spike=%v, app_hang_spike=%v, bug_report=%v, daily_summary=%v",
				errorSpike, appHangSpike, bugReport, dailySummary)
		}
	})

	t.Run("getNotifPrefByEmail returns all-true defaults for unknown email", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		errorSpike, appHangSpike, bugReport, dailySummary := getNotifPrefByEmail(ctx, "unknown@example.com")

		if !errorSpike || !appHangSpike || !bugReport || !dailySummary {
			t.Errorf("expected all-true defaults for unknown email, got error_spike=%v, app_hang_spike=%v, bug_report=%v, daily_summary=%v",
				errorSpike, appHangSpike, bugReport, dailySummary)
		}
	})

	t.Run("getNotifPrefByEmail returns saved preferences", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		th.SeedUser(ctx, t, userID, "prefs@example.com")

		// Insert notif prefs with some disabled
		_, err := th.PgPool.Exec(ctx,
			"INSERT INTO notif_prefs (user_id, error_spike, app_hang_spike, bug_report, daily_summary) VALUES ($1, false, true, false, true)",
			userID)
		if err != nil {
			t.Fatalf("insert notif_prefs: %v", err)
		}

		errorSpike, appHangSpike, bugReport, dailySummary := getNotifPrefByEmail(ctx, "prefs@example.com")

		if errorSpike {
			t.Error("error_spike should be false")
		}
		if !appHangSpike {
			t.Error("app_hang_spike should be true")
		}
		if bugReport {
			t.Error("bug_report should be false")
		}
		if !dailySummary {
			t.Error("daily_summary should be true")
		}
	})

	t.Run("shouldSendEmail allows email when AlertType is empty", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		info := email.EmailInfo{To: "anyone@example.com", AlertType: ""}
		if !shouldSendEmail(ctx, info) {
			t.Error("should send email when AlertType is empty")
		}
	})

	t.Run("shouldSendEmail respects crash_spike preference", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		th.SeedUser(ctx, t, userID, "crash@example.com")
		_, err := th.PgPool.Exec(ctx,
			"INSERT INTO notif_prefs (user_id, error_spike, app_hang_spike, bug_report, daily_summary) VALUES ($1, false, true, true, true)",
			userID)
		if err != nil {
			t.Fatalf("insert notif_prefs: %v", err)
		}

		info := email.EmailInfo{To: "crash@example.com", AlertType: string(AlertTypeCrashSpike)}
		if shouldSendEmail(ctx, info) {
			t.Error("should NOT send crash spike email when error_spike is false")
		}
	})

	t.Run("shouldSendEmail respects app_hang_spike preference", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		th.SeedUser(ctx, t, userID, "anr@example.com")
		_, err := th.PgPool.Exec(ctx,
			"INSERT INTO notif_prefs (user_id, error_spike, app_hang_spike, bug_report, daily_summary) VALUES ($1, true, false, true, true)",
			userID)
		if err != nil {
			t.Fatalf("insert notif_prefs: %v", err)
		}

		info := email.EmailInfo{To: "anr@example.com", AlertType: string(AlertTypeAnrSpike)}
		if shouldSendEmail(ctx, info) {
			t.Error("should NOT send app_hang_spike email when app_hang_spike is false")
		}
	})

	t.Run("shouldSendEmail respects bug_report preference", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		th.SeedUser(ctx, t, userID, "bug@example.com")
		_, err := th.PgPool.Exec(ctx,
			"INSERT INTO notif_prefs (user_id, error_spike, app_hang_spike, bug_report, daily_summary) VALUES ($1, true, true, false, true)",
			userID)
		if err != nil {
			t.Fatalf("insert notif_prefs: %v", err)
		}

		info := email.EmailInfo{To: "bug@example.com", AlertType: string(AlertTypeBugReport)}
		if shouldSendEmail(ctx, info) {
			t.Error("should NOT send bug report email when bug_report is false")
		}
	})

	t.Run("shouldSendEmail respects daily_summary preference", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		th.SeedUser(ctx, t, userID, "daily@example.com")
		_, err := th.PgPool.Exec(ctx,
			"INSERT INTO notif_prefs (user_id, error_spike, app_hang_spike, bug_report, daily_summary) VALUES ($1, true, true, true, false)",
			userID)
		if err != nil {
			t.Fatalf("insert notif_prefs: %v", err)
		}

		info := email.EmailInfo{To: "daily@example.com", AlertType: "daily_summary"}
		if shouldSendEmail(ctx, info) {
			t.Error("should NOT send daily summary email when daily_summary is false")
		}
	})

	t.Run("shouldSendEmail allows unknown alert type", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		info := email.EmailInfo{To: "anyone@example.com", AlertType: "some_future_type"}
		if !shouldSendEmail(ctx, info) {
			t.Error("should send email for unknown alert type")
		}
	})

	t.Run("shouldSendEmail allows when user has all prefs enabled", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		th.SeedUser(ctx, t, userID, "allon@example.com")
		_, err := th.PgPool.Exec(ctx,
			"INSERT INTO notif_prefs (user_id, error_spike, app_hang_spike, bug_report, daily_summary) VALUES ($1, true, true, true, true)",
			userID)
		if err != nil {
			t.Fatalf("insert notif_prefs: %v", err)
		}

		for _, alertType := range []string{string(AlertTypeCrashSpike), string(AlertTypeAnrSpike), string(AlertTypeBugReport), "daily_summary"} {
			info := email.EmailInfo{To: "allon@example.com", AlertType: alertType}
			if !shouldSendEmail(ctx, info) {
				t.Errorf("should send email for alert type %q when all prefs enabled", alertType)
			}
		}
	})
}

// TestDeletePendingMessage tests that deletePendingMessage removes
// a message from the pending_alert_messages table.
func TestDeletePendingMessage(t *testing.T) {
	ctx := context.Background()
	setupAlertsTest(ctx, t)
	defer cleanupAll(ctx, t)

	teamID := uuid.New().String()
	th.SeedTeam(ctx, t, teamID, "Test Team")

	// Queue a message
	info := email.EmailInfo{
		From:    "test@example.com",
		To:      "user@example.com",
		Subject: "Test",
		Body:    "<p>test</p>",
	}
	if err := email.QueueEmail(ctx, th.PgPool, nil, teamID, nil, info); err != nil {
		t.Fatalf("QueueEmail: %v", err)
	}

	// Get the message ID
	var msgID string
	if err := th.PgPool.QueryRow(ctx, "SELECT id FROM pending_alert_messages").Scan(&msgID); err != nil {
		t.Fatalf("get msg id: %v", err)
	}

	if got := countPending(ctx, t); got != 1 {
		t.Fatalf("want 1 pending, got %d", got)
	}

	deletePendingMessage(ctx, msgID)

	if got := countPending(ctx, t); got != 0 {
		t.Errorf("want 0 pending after delete, got %d", got)
	}
}

// TestSendPendingAlertEmailsRespectsNotifPrefs tests that
// SendPendingAlertEmails skips and deletes messages when the
// recipient has opted out via notification preferences.
func TestSendPendingAlertEmailsRespectsNotifPrefs(t *testing.T) {
	t.Run("skips and deletes email when user has opted out of crash spike", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, userID, "optout@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		// User opts out of crash spike emails
		_, err := th.PgPool.Exec(ctx,
			"INSERT INTO notif_prefs (user_id, error_spike, app_hang_spike, bug_report, daily_summary) VALUES ($1, false, true, true, true)",
			userID)
		if err != nil {
			t.Fatalf("insert notif_prefs: %v", err)
		}

		// Queue a crash spike email for the user
		info := email.EmailInfo{
			From:        "noreply@measure.sh",
			To:          "optout@example.com",
			Subject:     "Test App - Crash Spike Alert",
			ContentType: "text/html",
			Body:        "<p>Crash spike</p>",
			AlertType:   string(AlertTypeCrashSpike),
		}
		if err := email.QueueEmail(ctx, th.PgPool, nil, teamID, appID, info); err != nil {
			t.Fatalf("QueueEmail: %v", err)
		}

		if got := countPendingByChannel(ctx, t, "email"); got != 1 {
			t.Fatalf("want 1 pending email, got %d", got)
		}

		// SendPendingAlertEmails should skip and delete it
		// (will fail on actual send since no mail server, but the pref check happens first)
		SendPendingAlertEmails(ctx)

		if got := countPendingByChannel(ctx, t, "email"); got != 0 {
			t.Errorf("want 0 pending emails after opt-out skip, got %d", got)
		}
	})

	t.Run("skips daily summary when user has opted out", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, userID, "nodaily@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		// User opts out of daily summary
		_, err := th.PgPool.Exec(ctx,
			"INSERT INTO notif_prefs (user_id, error_spike, app_hang_spike, bug_report, daily_summary) VALUES ($1, true, true, true, false)",
			userID)
		if err != nil {
			t.Fatalf("insert notif_prefs: %v", err)
		}

		info := email.EmailInfo{
			From:        "noreply@measure.sh",
			To:          "nodaily@example.com",
			Subject:     "Test App Daily Summary",
			ContentType: "text/html",
			Body:        "<p>Summary</p>",
			AlertType:   "daily_summary",
		}
		if err := email.QueueEmail(ctx, th.PgPool, nil, teamID, appID, info); err != nil {
			t.Fatalf("QueueEmail: %v", err)
		}

		SendPendingAlertEmails(ctx)

		if got := countPendingByChannel(ctx, t, "email"); got != 0 {
			t.Errorf("want 0 pending emails after daily summary opt-out, got %d", got)
		}
	})

	t.Run("emails without AlertType are not filtered", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, userID, "usage@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")

		// User has all prefs off — but usage emails have no AlertType
		_, err := th.PgPool.Exec(ctx,
			"INSERT INTO notif_prefs (user_id, error_spike, app_hang_spike, bug_report, daily_summary) VALUES ($1, false, false, false, false)",
			userID)
		if err != nil {
			t.Fatalf("insert notif_prefs: %v", err)
		}

		info := email.EmailInfo{
			From:        "noreply@measure.sh",
			To:          "usage@example.com",
			Subject:     "Usage Limit Warning",
			ContentType: "text/html",
			Body:        "<p>Usage limit</p>",
		}
		if err := email.QueueEmail(ctx, th.PgPool, nil, teamID, nil, info); err != nil {
			t.Fatalf("QueueEmail: %v", err)
		}

		// SendPendingAlertEmails will try to send (and fail since no mail server),
		// but the message should NOT be deleted by the pref check
		SendPendingAlertEmails(ctx)

		// Message should still be pending (send failed, not filtered)
		if got := countPendingByChannel(ctx, t, "email"); got != 1 {
			t.Errorf("want 1 pending email (non-alert should not be filtered), got %d", got)
		}
	})

	t.Run("selectively filters when two users have different prefs", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userOptedOut := uuid.New().String()
		userOptedIn := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, userOptedOut, "optout@example.com")
		th.SeedUser(ctx, t, userOptedIn, "optin@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userOptedOut, "owner")
		th.SeedTeamMembership(ctx, t, teamID, userOptedIn, "viewer")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		// User 1 opts out of crash spike
		_, err := th.PgPool.Exec(ctx,
			"INSERT INTO notif_prefs (user_id, error_spike, app_hang_spike, bug_report, daily_summary) VALUES ($1, false, true, true, true)",
			userOptedOut)
		if err != nil {
			t.Fatalf("insert notif_prefs: %v", err)
		}

		// User 2 keeps all defaults (opted in)
		_, err = th.PgPool.Exec(ctx,
			"INSERT INTO notif_prefs (user_id, error_spike, app_hang_spike, bug_report, daily_summary) VALUES ($1, true, true, true, true)",
			userOptedIn)
		if err != nil {
			t.Fatalf("insert notif_prefs: %v", err)
		}

		// Queue same crash spike alert for both users
		for _, to := range []string{"optout@example.com", "optin@example.com"} {
			info := email.EmailInfo{
				From:        "noreply@measure.sh",
				To:          to,
				Subject:     "Test App - Crash Spike Alert",
				ContentType: "text/html",
				Body:        "<p>Crash spike</p>",
				AlertType:   string(AlertTypeCrashSpike),
			}
			if err := email.QueueEmail(ctx, th.PgPool, nil, teamID, appID, info); err != nil {
				t.Fatalf("QueueEmail for %s: %v", to, err)
			}
		}

		if got := countPendingByChannel(ctx, t, "email"); got != 2 {
			t.Fatalf("want 2 pending emails before send, got %d", got)
		}

		SendPendingAlertEmails(ctx)

		// Opted-out user's email should be deleted.
		// Opted-in user's email should remain (send fails without mail server).
		if got := countPendingByChannel(ctx, t, "email"); got != 1 {
			t.Errorf("want 1 pending email (opted-in user only), got %d", got)
		}

		// Verify the remaining message is for the opted-in user
		var remainingTo string
		err = th.PgPool.QueryRow(ctx,
			"SELECT data->>'to' FROM pending_alert_messages WHERE channel = 'email'").Scan(&remainingTo)
		if err != nil {
			t.Fatalf("read remaining email: %v", err)
		}
		if remainingTo != "optin@example.com" {
			t.Errorf("remaining email to = %q, want %q", remainingTo, "optin@example.com")
		}
	})

	t.Run("filters per alert type when user opts out of some but not others", func(t *testing.T) {
		ctx := context.Background()
		setupAlertsTest(ctx, t)
		defer cleanupAll(ctx, t)

		teamID := uuid.New().String()
		appID := uuid.New().String()
		userID := uuid.New().String()

		th.SeedTeam(ctx, t, teamID, "Test Team")
		th.SeedUser(ctx, t, userID, "partial@example.com")
		th.SeedTeamMembership(ctx, t, teamID, userID, "owner")
		th.SeedApp(ctx, t, appID, teamID, "Test App", 30)

		// User opts out of crash spike and daily summary, keeps app_hang_spike and bug_report
		_, err := th.PgPool.Exec(ctx,
			"INSERT INTO notif_prefs (user_id, error_spike, app_hang_spike, bug_report, daily_summary) VALUES ($1, false, true, true, false)",
			userID)
		if err != nil {
			t.Fatalf("insert notif_prefs: %v", err)
		}

		// Queue four different alert types
		alertTypes := []struct {
			alertType string
			subject   string
		}{
			{string(AlertTypeCrashSpike), "Crash Spike Alert"},
			{string(AlertTypeAnrSpike), "App Hang Spike Alert"},
			{string(AlertTypeBugReport), "New Bug Report"},
			{"daily_summary", "Daily Summary"},
		}
		for _, at := range alertTypes {
			info := email.EmailInfo{
				From:        "noreply@measure.sh",
				To:          "partial@example.com",
				Subject:     at.subject,
				ContentType: "text/html",
				Body:        "<p>Alert</p>",
				AlertType:   at.alertType,
			}
			if err := email.QueueEmail(ctx, th.PgPool, nil, teamID, appID, info); err != nil {
				t.Fatalf("QueueEmail for %s: %v", at.alertType, err)
			}
		}

		if got := countPendingByChannel(ctx, t, "email"); got != 4 {
			t.Fatalf("want 4 pending emails before send, got %d", got)
		}

		SendPendingAlertEmails(ctx)

		// crash_spike and daily_summary should be deleted (opted out).
		// app_hang_spike and bug_report should remain (opted in, send fails without mail server).
		if got := countPendingByChannel(ctx, t, "email"); got != 2 {
			t.Errorf("want 2 pending emails (app_hang_spike + bug_report), got %d", got)
		}
	})
}
