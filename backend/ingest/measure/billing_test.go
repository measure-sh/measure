//go:build integration

package measure

import (
	"context"
	"errors"
	"testing"

	"backend/autumn"
	autumntest "backend/autumn/testhelpers"
	"backend/ingest/server"

	"github.com/google/uuid"
)

func TestCheckIngestAllowedForApp(t *testing.T) {
	ctx := context.Background()

	t.Run("billing disabled → allowed", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		orig := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = false
		t.Cleanup(func() { server.Server.Config.BillingEnabled = orig })

		if err := CheckIngestAllowedForApp(ctx, uuid.New()); err != nil {
			t.Errorf("want nil, got %v", err)
		}
	})

	t.Run("team without autumn customer → fail open", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "test-team")
		seedApp(ctx, t, appID, teamID, 30)

		if err := CheckIngestAllowedForApp(ctx, appID); err != nil {
			t.Errorf("want nil (fail-open), got %v", err)
		}
	})

	t.Run("autumn allowed → nil", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "test-team")
		seedApp(ctx, t, appID, teamID, 30)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockCheck(t, func(_ context.Context, cid, feat string) (*autumn.CheckResponse, error) {
			if cid != custID || feat != "bytes" {
				t.Errorf("unexpected args: cid=%q feat=%q", cid, feat)
			}
			return &autumn.CheckResponse{Allowed: true}, nil
		})

		if err := CheckIngestAllowedForApp(ctx, appID); err != nil {
			t.Errorf("want nil, got %v", err)
		}
	})

	t.Run("autumn denied → error", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "test-team")
		seedApp(ctx, t, appID, teamID, 30)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockCheck(t, func(_ context.Context, _, _ string) (*autumn.CheckResponse, error) {
			return &autumn.CheckResponse{Allowed: false}, nil
		})

		if err := CheckIngestAllowedForApp(ctx, appID); err == nil {
			t.Error("want error, got nil")
		}
	})

	t.Run("autumn error → fail open", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "test-team")
		seedApp(ctx, t, appID, teamID, 30)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockCheck(t, func(_ context.Context, _, _ string) (*autumn.CheckResponse, error) {
			return nil, errors.New("autumn timeout")
		})

		if err := CheckIngestAllowedForApp(ctx, appID); err != nil {
			t.Errorf("want nil (fail-open on autumn error), got %v", err)
		}
	})

	t.Run("app not found → error", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		if err := CheckIngestAllowedForApp(ctx, uuid.New()); err == nil {
			t.Error("want error for unknown app, got nil")
		}
	})

	t.Run("cache hit (allowed) → no autumn.Check call", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "test-team")
		seedApp(ctx, t, appID, teamID, 30)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		setCachedAutumnCheck(ctx, server.Server.VK, custID, true)

		autumntest.MockCheck(t, func(_ context.Context, _, _ string) (*autumn.CheckResponse, error) {
			t.Errorf("autumn.Check must not be called on cache hit")
			return nil, errors.New("unexpected")
		})

		if err := CheckIngestAllowedForApp(ctx, appID); err != nil {
			t.Errorf("want nil, got %v", err)
		}
	})

	t.Run("cache hit (blocked) → returns blocked, no autumn.Check call", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "test-team")
		seedApp(ctx, t, appID, teamID, 30)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		setCachedAutumnCheck(ctx, server.Server.VK, custID, false)

		autumntest.MockCheck(t, func(_ context.Context, _, _ string) (*autumn.CheckResponse, error) {
			t.Errorf("autumn.Check must not be called on cache hit")
			return nil, errors.New("unexpected")
		})

		if err := CheckIngestAllowedForApp(ctx, appID); err == nil {
			t.Error("want error from cached blocked verdict, got nil")
		}
	})

	t.Run("cache miss → calls autumn.Check, populates cache", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "test-team")
		seedApp(ctx, t, appID, teamID, 30)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		var checkCalls int
		autumntest.MockCheck(t, func(_ context.Context, _, _ string) (*autumn.CheckResponse, error) {
			checkCalls++
			return &autumn.CheckResponse{Allowed: true}, nil
		})

		if err := CheckIngestAllowedForApp(ctx, appID); err != nil {
			t.Fatalf("first call: want nil, got %v", err)
		}
		if err := CheckIngestAllowedForApp(ctx, appID); err != nil {
			t.Fatalf("second call: want nil, got %v", err)
		}
		if checkCalls != 1 {
			t.Errorf("autumn.Check called %d times, want 1 (second call should hit cache)", checkCalls)
		}

		allowed, ok := getCachedAutumnCheck(ctx, server.Server.VK, custID)
		if !ok || !allowed {
			t.Errorf("cache state after miss: ok=%v allowed=%v, want ok=true allowed=true", ok, allowed)
		}
	})

	t.Run("autumn error on miss → fail open, cache not populated", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "test-team")
		seedApp(ctx, t, appID, teamID, 30)
		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockCheck(t, func(_ context.Context, _, _ string) (*autumn.CheckResponse, error) {
			return nil, errors.New("autumn timeout")
		})

		if err := CheckIngestAllowedForApp(ctx, appID); err != nil {
			t.Errorf("want nil (fail-open), got %v", err)
		}
		if _, ok := getCachedAutumnCheck(ctx, server.Server.VK, custID); ok {
			t.Error("cache should be empty after autumn error; got hit")
		}
	})
}
