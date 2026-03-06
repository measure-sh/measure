//go:build integration

package measure

import (
	"backend/ingest/server"
	"context"
	"testing"

	"github.com/google/uuid"
)

// --------------------------------------------------------------------------
// CheckIngestAllowedForApp
// --------------------------------------------------------------------------

func TestCheckIngestAllowedForApp(t *testing.T) {
	t.Run("billing disabled", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		orig := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = false
		defer func() { server.Server.Config.BillingEnabled = orig }()

		if err := CheckIngestAllowedForApp(ctx, uuid.New()); err != nil {
			t.Errorf("expected nil, got %v", err)
		}
	})

	t.Run("ingest allowed", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "allowed-team", true)
		seedApp(ctx, t, appID, teamID, 30)

		if err := CheckIngestAllowedForApp(ctx, appID); err != nil {
			t.Errorf("expected nil, got %v", err)
		}
	})

	t.Run("ingest blocked", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "blocked-team", true)
		seedApp(ctx, t, appID, teamID, 30)
		seedTeamIngestBlocked(ctx, t, teamID, "usage exceeded")

		err := CheckIngestAllowedForApp(ctx, appID)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if got := err.Error(); got != "ingestion blocked: usage exceeded" {
			t.Errorf("error = %q, want %q", got, "ingestion blocked: usage exceeded")
		}
	})

	t.Run("app not found", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		err := CheckIngestAllowedForApp(ctx, uuid.New())
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("serves from cache on second call", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "cache-team", true)
		seedApp(ctx, t, appID, teamID, 30)

		// First call populates cache.
		if err := CheckIngestAllowedForApp(ctx, appID); err != nil {
			t.Fatalf("first call: %v", err)
		}

		// Block ingest in DB — cached result should still allow.
		seedTeamIngestBlocked(ctx, t, teamID, "usage exceeded")

		if err := CheckIngestAllowedForApp(ctx, appID); err != nil {
			t.Errorf("cached call should allow, got: %v", err)
		}
	})

	t.Run("serves blocked from cache", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "cache-blocked-team", true)
		seedApp(ctx, t, appID, teamID, 30)
		seedTeamIngestBlocked(ctx, t, teamID, "usage exceeded")

		// First call populates cache with blocked status.
		err := CheckIngestAllowedForApp(ctx, appID)
		if err == nil {
			t.Fatal("first call: expected error, got nil")
		}

		// Unblock in DB — cached result should still block.
		_, dbErr := server.Server.PgPool.Exec(ctx,
			"UPDATE teams SET allow_ingest = true, ingest_blocked_reason = NULL WHERE id = $1", teamID)
		if dbErr != nil {
			t.Fatalf("unblock team: %v", dbErr)
		}

		err = CheckIngestAllowedForApp(ctx, appID)
		if err == nil {
			t.Fatal("cached call should block, got nil")
		}
		if got := err.Error(); got != "ingestion blocked: usage exceeded" {
			t.Errorf("error = %q, want %q", got, "ingestion blocked: usage exceeded")
		}
	})
}
