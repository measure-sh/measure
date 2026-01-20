//go:build integration

package billing

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestBillingCycle_FreeSuccess_OneMonthProcessed_NoStripeReporting(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	deps := testDeps()
	teamID := uuid.New().String()
	th.SeedTeam(ctx, t, teamID, "FreeTeamSuccess", true)
	th.SeedTeamBilling(ctx, t, teamID, "free", nil, nil)

	seedMonthForReporting(ctx, t, teamID, 2026, time.January, 500, 500)
	before := countReportedRows(ctx, t, teamID)
	if err := ReportUnreportedToStripe(ctx, deps); err != nil {
		t.Fatalf("ReportUnreportedToStripe: %v", err)
	}
	after := countReportedRows(ctx, t, teamID)
	if after != before {
		t.Fatalf("reported rows changed for free plan: before=%d after=%d", before, after)
	}

	seedCurrentMonthIngestionUsage(ctx, t, teamID, uint64(FreePlanMaxUnits)-1000)
	RunHourlyBillingCheck(ctx, deps)

	allow, reason := getTeamIngestStatus(ctx, t, teamID)
	if !allow || reason != nil {
		t.Fatalf("allow_ingest=%v reason=%v, want true,nil", allow, safeDeref(reason))
	}
}

func TestBillingCycle_FreeFailure_OneMonthProcessed_NoStripeReporting(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	deps := testDeps()
	teamID := uuid.New().String()
	th.SeedTeam(ctx, t, teamID, "FreeTeamFailure", true)
	th.SeedTeamBilling(ctx, t, teamID, "free", nil, nil)

	seedMonthForReporting(ctx, t, teamID, 2026, time.February, 500, 500)
	before := countReportedRows(ctx, t, teamID)
	if err := ReportUnreportedToStripe(ctx, deps); err != nil {
		t.Fatalf("ReportUnreportedToStripe: %v", err)
	}
	after := countReportedRows(ctx, t, teamID)
	if after != before {
		t.Fatalf("reported rows changed for free plan: before=%d after=%d", before, after)
	}

	seedCurrentMonthIngestionUsage(ctx, t, teamID, uint64(FreePlanMaxUnits)+1000)
	RunHourlyBillingCheck(ctx, deps)

	allow, reason := getTeamIngestStatus(ctx, t, teamID)
	if allow {
		t.Fatalf("allow_ingest=%v, want false", allow)
	}
	if reason == nil || *reason != ReasonPlanLimitExceeded {
		t.Fatalf("reason=%v, want %q", safeDeref(reason), ReasonPlanLimitExceeded)
	}
}
