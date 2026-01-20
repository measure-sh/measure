//go:build integration

package billing

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v84"
)

// ==========================================================================
// Hourly billing check
// ==========================================================================

func TestRunHourlyBillingCheck_FreePlanBlocked(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New().String()
	appID := uuid.New().String()
	now := time.Now().UTC()

	seedTeamWithBilling(ctx, t, teamID, "TestTeam", "free", true)
	seedIngestionUsage(ctx, t, teamID, appID, now, 500001, 500000, 0) // 1,000,001 total > 1M free limit

	deps := testDeps()
	RunHourlyBillingCheck(ctx, deps)

	var allowIngest bool
	err := th.PgPool.QueryRow(ctx,
		"SELECT allow_ingest FROM teams WHERE id = $1", teamID).
		Scan(&allowIngest)
	if err != nil {
		t.Fatalf("query: %v", err)
	}

	if allowIngest {
		t.Error("expected allow_ingest=false after billing check")
	}
}

func TestRunHourlyBillingCheck_ProPlanBlocked(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	deps := testDeps()
	deps.GetSubscription = func(id string, params *stripe.SubscriptionParams) (*stripe.Subscription, error) {
		return &stripe.Subscription{Status: stripe.SubscriptionStatusCanceled}, nil
	}

	teamID := uuid.New().String()
	appID := uuid.New().String()
	now := time.Now().UTC()
	seedTeamWithBilling(ctx, t, teamID, "ProTeam", "pro", true)
	seedIngestionUsage(ctx, t, teamID, appID, now, 500001, 500000, 0)

	_, err := th.PgPool.Exec(ctx,
		"UPDATE team_billing SET stripe_subscription_id = $1 WHERE team_id = $2",
		"sub_canceled_123", teamID)
	if err != nil {
		t.Fatalf("update team_billing: %v", err)
	}

	RunHourlyBillingCheck(ctx, deps)

	var allowIngest bool
	var blockedReason *string
	err = th.PgPool.QueryRow(ctx,
		"SELECT allow_ingest, ingest_blocked_reason FROM teams WHERE id = $1", teamID).
		Scan(&allowIngest, &blockedReason)
	if err != nil {
		t.Fatalf("query: %v", err)
	}

	if allowIngest {
		t.Error("expected allow_ingest=false for canceled pro subscription")
	}
	if blockedReason == nil || *blockedReason != ReasonPlanLimitExceeded {
		t.Errorf("ingest_blocked_reason = %v, want %q", blockedReason, ReasonPlanLimitExceeded)
	}
}

func TestRunHourlyBillingCheck_ProPlanUnblocked(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	deps := testDeps()
	deps.GetSubscription = func(id string, params *stripe.SubscriptionParams) (*stripe.Subscription, error) {
		return &stripe.Subscription{Status: stripe.SubscriptionStatusActive}, nil
	}

	teamID := uuid.New().String()
	// Start blocked, verify billing check unblocks it.
	seedTeamWithBilling(ctx, t, teamID, "ProTeam", "pro", false)
	_, err := th.PgPool.Exec(ctx,
		"UPDATE teams SET ingest_blocked_reason = $1 WHERE id = $2",
		string(stripe.SubscriptionStatusCanceled), teamID)
	if err != nil {
		t.Fatalf("setup blocked team: %v", err)
	}
	_, err = th.PgPool.Exec(ctx,
		"UPDATE team_billing SET stripe_subscription_id = $1 WHERE team_id = $2",
		"sub_active_456", teamID)
	if err != nil {
		t.Fatalf("update team_billing: %v", err)
	}

	RunHourlyBillingCheck(ctx, deps)

	var allowIngest bool
	var blockedReason *string
	err = th.PgPool.QueryRow(ctx,
		"SELECT allow_ingest, ingest_blocked_reason FROM teams WHERE id = $1", teamID).
		Scan(&allowIngest, &blockedReason)
	if err != nil {
		t.Fatalf("query: %v", err)
	}

	if !allowIngest {
		t.Error("expected allow_ingest=true for active pro subscription")
	}
	if blockedReason != nil {
		t.Errorf("expected ingest_blocked_reason=nil, got %q", *blockedReason)
	}
}

// ==========================================================================
// Fetch teams with billing config
// ==========================================================================

func TestFetchTeamsWithTeamBilling(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	team1ID := uuid.New().String()
	team2ID := uuid.New().String()

	seedTeamWithBilling(ctx, t, team1ID, "Team1", "free", true)
	seedTeamWithBilling(ctx, t, team2ID, "Team2", "pro", true)

	teams, err := fetchTeamsWithTeamBilling(ctx, th.PgPool)
	if err != nil {
		t.Fatalf("fetchTeamsWithTeamBilling: %v", err)
	}

	if len(teams) != 2 {
		t.Fatalf("got %d teams, want 2", len(teams))
	}

	teamMap := make(map[string]TeamBillingInfo)
	for _, team := range teams {
		teamMap[team.TeamID] = team
	}

	t1, ok := teamMap[team1ID]
	if !ok {
		t.Fatal("team1 not found")
	}
	if t1.Plan != "free" || t1.TeamName != "Team1" {
		t.Errorf("team1 data mismatch: %+v", t1)
	}
	if !t1.AllowIngest {
		t.Error("team1 should have AllowIngest=true")
	}

	t2, ok := teamMap[team2ID]
	if !ok {
		t.Fatal("team2 not found")
	}
	if t2.Plan != "pro" || t2.TeamName != "Team2" {
		t.Errorf("team2 data mismatch: %+v", t2)
	}
}

// ==========================================================================
// Team billing check
// ==========================================================================

func TestCheckTeamBilling_UnknownPlan(t *testing.T) {
	team := TeamBillingInfo{Plan: "enterprise"}
	deps := testDeps()

	allow, reason := checkTeamBilling(context.Background(), deps, team)
	if !allow {
		t.Error("expected allow=true for unknown plan")
	}
	if reason != nil {
		t.Errorf("expected reason=nil, got %v", *reason)
	}
}

// ==========================================================================
// Team ingest status updates
// ==========================================================================

func TestUpdateTeamIngestStatus(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New().String()
	seedTeamWithBilling(ctx, t, teamID, "TestTeam", "free", true)

	reason := ReasonPlanLimitExceeded
	if err := updateTeamIngestStatus(ctx, th.PgPool, teamID, false, &reason); err != nil {
		t.Fatalf("updateTeamIngestStatus: %v", err)
	}

	var allowIngest bool
	var blockedReason *string
	err := th.PgPool.QueryRow(ctx,
		"SELECT allow_ingest, ingest_blocked_reason FROM teams WHERE id = $1", teamID).
		Scan(&allowIngest, &blockedReason)
	if err != nil {
		t.Fatalf("query: %v", err)
	}

	if allowIngest {
		t.Error("allow_ingest should be false")
	}
	if blockedReason == nil || *blockedReason != ReasonPlanLimitExceeded {
		t.Errorf("ingest_blocked_reason = %v, want %q", blockedReason, ReasonPlanLimitExceeded)
	}
}

// ==========================================================================
// Free plan
// ==========================================================================

func TestCheckFreePlan_UnderLimit(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New().String()
	appID := uuid.New().String()
	now := time.Now().UTC()

	seedTeamWithBilling(ctx, t, teamID, "TestTeam", "free", true)
	seedIngestionUsage(ctx, t, teamID, appID, now, 100, 50, 25) // 175 total, well under 1M

	team := TeamBillingInfo{
		TeamID:   teamID,
		TeamName: "TestTeam",
		Plan:     "free",
	}

	deps := testDeps()
	allow, reason := checkFreePlan(ctx, deps, team)
	if !allow {
		t.Error("expected allow=true")
	}
	if reason != nil {
		t.Errorf("expected reason=nil, got %v", *reason)
	}
}

func TestCheckFreePlan_OverLimit(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New().String()
	appID := uuid.New().String()
	now := time.Now().UTC()

	seedTeamWithBilling(ctx, t, teamID, "TestTeam", "free", true)
	seedIngestionUsage(ctx, t, teamID, appID, now, 500001, 500000, 0) // 1,000,001 total > 1M free limit

	team := TeamBillingInfo{
		TeamID:   teamID,
		TeamName: "TestTeam",
		Plan:     "free",
	}

	deps := testDeps()
	allow, reason := checkFreePlan(ctx, deps, team)
	if allow {
		t.Error("expected allow=false")
	}
	if reason == nil || *reason != ReasonPlanLimitExceeded {
		t.Errorf("expected reason=%q, got %v", ReasonPlanLimitExceeded, reason)
	}
}


func TestGetCalendarMonthCycle(t *testing.T) {
	start, end, cycle := getCalendarMonthCycle()

	now := time.Now().UTC()
	expectedStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	expectedEnd := expectedStart.AddDate(0, 1, 0)
	expectedCycle := now.Format("2006-01")

	if !start.Equal(expectedStart) {
		t.Errorf("start = %v, want %v", start, expectedStart)
	}
	if !end.Equal(expectedEnd) {
		t.Errorf("end = %v, want %v", end, expectedEnd)
	}
	if cycle != expectedCycle {
		t.Errorf("cycle = %q, want %q", cycle, expectedCycle)
	}
}

func TestGetIngestionUsage(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New().String()
	appID := uuid.New().String()
	now := time.Now().UTC()
	cycleStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	cycleEnd := cycleStart.AddDate(0, 1, 0)

	seedIngestionUsage(ctx, t, teamID, appID, now, 100, 50, 25)

	usage, err := getIngestionUsage(ctx, th.ChConn, teamID, cycleStart, cycleEnd)
	if err != nil {
		t.Fatalf("getIngestionUsage: %v", err)
	}

	// Total = events + spans + metrics = 175
	if usage != 175 {
		t.Errorf("usage = %d, want 175", usage)
	}
}

func TestGetIngestionUsageNoData(t *testing.T) {
	ctx := context.Background()

	teamID := uuid.New().String()
	cycleStart := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	cycleEnd := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)

	usage, err := getIngestionUsage(ctx, th.ChConn, teamID, cycleStart, cycleEnd)
	if err != nil {
		t.Fatalf("getIngestionUsage: %v", err)
	}

	if usage != 0 {
		t.Errorf("usage = %d, want 0", usage)
	}
}

// ==========================================================================
// Pro plan
// ==========================================================================

func TestCheckProPlan_NoSubscriptionID(t *testing.T) {
	tests := []struct {
		name       string
		totalUnits uint64
		wantAllow  bool
		wantReason *string
	}{
		{
			name:       "over free limit",
			totalUnits: uint64(FreePlanMaxUnits) + 1,
			wantAllow:  false,
			wantReason: strPtr(ReasonPlanLimitExceeded),
		},
		{
			name:       "within free limit",
			totalUnits: 0,
			wantAllow:  true,
			wantReason: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			t.Cleanup(func() { cleanupAll(ctx, t) })

			teamID := uuid.New().String()
			userID := uuid.New().String()

			seedTeamWithBilling(ctx, t, teamID, "ProTeam", "pro", true)
			seedUser(ctx, t, userID, "pro@example.com")
			seedTeamMembership(ctx, t, teamID, userID, "owner")

			if tt.totalUnits > 0 {
				appID := uuid.New().String()
				events := uint32(tt.totalUnits / 2)
				spans := uint32(tt.totalUnits - uint64(events))
				seedIngestionUsage(ctx, t, teamID, appID, time.Now().UTC(), events, spans, 0)
			}

			team := TeamBillingInfo{
				TeamID:               teamID,
				TeamName:             "ProTeam",
				Plan:                 "pro",
				StripeSubscriptionID: nil,
			}

			deps := testDeps()
			allow, reason := checkProPlan(ctx, deps, team)
			if allow != tt.wantAllow {
				t.Errorf("allow = %v, want %v", allow, tt.wantAllow)
			}
			if !stringPtrEqual(reason, tt.wantReason) {
				t.Errorf("reason = %v, want %v", reason, tt.wantReason)
			}

			// Verify team was downgraded — nil subscription on pro is treated as terminal.
			bc := getTeamBilling(ctx, t, uuid.MustParse(teamID))
			if bc.Plan != "free" {
				t.Errorf("plan = %q, want %q (should be downgraded)", bc.Plan, "free")
			}

			// Verify notification email was queued.
			var emailCount int
			err := th.PgPool.QueryRow(ctx,
				"SELECT COUNT(*) FROM pending_alert_messages WHERE team_id = $1", teamID).
				Scan(&emailCount)
			if err != nil {
				t.Fatalf("query: %v", err)
			}
			if emailCount != 1 {
				t.Errorf("expected 1 notification email, got %d", emailCount)
			}
		})
	}
}

func TestCheckProPlan_StripeError(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	deps := testDeps()
	deps.GetSubscription = func(id string, params *stripe.SubscriptionParams) (*stripe.Subscription, error) {
		return nil, errors.New("stripe unavailable")
	}

	teamID := uuid.New().String()
	seedTeamWithBilling(ctx, t, teamID, "ProTeam", "pro", true)

	subID := "sub_test_123"
	team := TeamBillingInfo{
		TeamID:               teamID,
		TeamName:             "ProTeam",
		Plan:                 "pro",
		StripeSubscriptionID: &subID,
	}

	allow, reason := checkProPlan(ctx, deps, team)
	if allow {
		t.Error("expected allow=false on Stripe API error")
	}
	if reason == nil || *reason != ReasonSubscriptionError {
		t.Errorf("reason = %v, want %q", reason, ReasonSubscriptionError)
	}

	// Verify team was NOT downgraded — Stripe error is transient, not terminal.
	bc := getTeamBilling(ctx, t, uuid.MustParse(teamID))
	if bc.Plan != "pro" {
		t.Errorf("plan = %q, want %q (should remain pro)", bc.Plan, "pro")
	}
}

func TestCheckProPlan_ActiveSubscription(t *testing.T) {
	ctx := context.Background()

	deps := testDeps()
	deps.GetSubscription = func(id string, params *stripe.SubscriptionParams) (*stripe.Subscription, error) {
		return &stripe.Subscription{Status: stripe.SubscriptionStatusActive}, nil
	}

	subID := "sub_active"
	team := TeamBillingInfo{
		TeamID:               uuid.New().String(),
		TeamName:             "ProTeam",
		Plan:                 "pro",
		StripeSubscriptionID: &subID,
	}

	allow, reason := checkProPlan(ctx, deps, team)
	if !allow {
		t.Error("expected allow=true for active subscription")
	}
	if reason != nil {
		t.Errorf("expected reason=nil, got %v", *reason)
	}
}

func TestCheckProPlan_PastDueSubscription(t *testing.T) {
	ctx := context.Background()

	deps := testDeps()
	deps.GetSubscription = func(id string, params *stripe.SubscriptionParams) (*stripe.Subscription, error) {
		return &stripe.Subscription{Status: stripe.SubscriptionStatusPastDue}, nil
	}

	subID := "sub_past_due"
	team := TeamBillingInfo{
		TeamID:               uuid.New().String(),
		TeamName:             "ProTeam",
		Plan:                 "pro",
		StripeSubscriptionID: &subID,
	}

	allow, reason := checkProPlan(ctx, deps, team)
	if !allow {
		t.Error("expected allow=true for past_due subscription")
	}
	if reason != nil {
		t.Errorf("expected reason=nil, got %v", *reason)
	}
}

func TestCheckProPlan_CanceledSubscription(t *testing.T) {
	tests := []struct {
		name       string
		totalUnits uint64
		wantAllow  bool
		wantReason *string
	}{
		{
			name:       "over free limit",
			totalUnits: uint64(FreePlanMaxUnits) + 1,
			wantAllow:  false,
			wantReason: strPtr(ReasonPlanLimitExceeded),
		},
		{
			name:       "within free limit",
			totalUnits: uint64(FreePlanMaxUnits) - 1,
			wantAllow:  true,
			wantReason: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			t.Cleanup(func() { cleanupAll(ctx, t) })

			deps := testDeps()
			deps.GetSubscription = func(id string, params *stripe.SubscriptionParams) (*stripe.Subscription, error) {
				return &stripe.Subscription{Status: stripe.SubscriptionStatusCanceled}, nil
			}

			teamID := uuid.New().String()
			appID := uuid.New().String()
			userID := uuid.New().String()
			now := time.Now().UTC()

			events := uint32(tt.totalUnits / 2)
			spans := uint32(tt.totalUnits - uint64(events))

			seedTeamWithBilling(ctx, t, teamID, "ProTeam", "pro", true)
			seedUser(ctx, t, userID, "pro@example.com")
			seedTeamMembership(ctx, t, teamID, userID, "owner")
			seedIngestionUsage(ctx, t, teamID, appID, now, events, spans, 0)

			subID := "sub_canceled"
			team := TeamBillingInfo{
				TeamID:               teamID,
				TeamName:             "ProTeam",
				Plan:                 "pro",
				StripeSubscriptionID: &subID,
			}

			allow, reason := checkProPlan(ctx, deps, team)
			if allow != tt.wantAllow {
				t.Errorf("allow = %v, want %v", allow, tt.wantAllow)
			}
			if !stringPtrEqual(reason, tt.wantReason) {
				t.Errorf("reason = %v, want %v", reason, tt.wantReason)
			}

			// Verify team was downgraded to free.
			bc := getTeamBilling(ctx, t, uuid.MustParse(teamID))
			if bc.Plan != "free" {
				t.Errorf("plan = %q, want %q (should be downgraded)", bc.Plan, "free")
			}

			// Verify notification email was queued for the canceled sub.
			var emailCount int
			err := th.PgPool.QueryRow(ctx,
				"SELECT COUNT(*) FROM pending_alert_messages WHERE team_id = $1", teamID).
				Scan(&emailCount)
			if err != nil {
				t.Fatalf("query: %v", err)
			}
			if emailCount != 1 {
				t.Errorf("expected 1 notification email, got %d", emailCount)
			}
		})
	}
}

func TestCheckSubscriptionStatus(t *testing.T) {
	tests := []struct {
		name       string
		status     stripe.SubscriptionStatus
		wantAllow  bool
		wantReason *string
	}{
		{"active", stripe.SubscriptionStatusActive, true, nil},
		{"past_due", stripe.SubscriptionStatusPastDue, true, nil},
		{"canceled", stripe.SubscriptionStatusCanceled, false, strPtr(string(stripe.SubscriptionStatusCanceled))},
		{"unpaid", stripe.SubscriptionStatusUnpaid, false, strPtr(string(stripe.SubscriptionStatusUnpaid))},
		{"incomplete", stripe.SubscriptionStatusIncomplete, false, strPtr(string(stripe.SubscriptionStatusIncomplete))},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sub := &stripe.Subscription{Status: tt.status}
			allow, reason := checkSubscriptionStatus(sub)

			if allow != tt.wantAllow {
				t.Errorf("allow = %v, want %v", allow, tt.wantAllow)
			}
			if !stringPtrEqual(reason, tt.wantReason) {
				t.Errorf("reason = %v, want %v", reason, tt.wantReason)
			}
		})
	}
}
