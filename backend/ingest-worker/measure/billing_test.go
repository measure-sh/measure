//go:build integration

package measure

import (
	"context"
	"errors"
	"testing"
	"time"

	"backend/autumn"
	autumntest "backend/autumn/testhelpers"
	"backend/ingest-worker/server"

	"github.com/google/uuid"
)

type trackCall struct {
	customerID string
	featureID  string
	value      float64
}

// captureTrack swaps autumn.Track for a stub that pushes each call to a
// buffered channel. Lets a caller assert with a timeout whether Track did
// or didn't fire — needed because trackBatchBytes is fire-and-forget.
func captureTrack(t *testing.T) <-chan trackCall {
	t.Helper()
	ch := make(chan trackCall, 4)
	autumntest.MockTrack(t, func(_ context.Context, customerID, featureID string, value float64) error {
		ch <- trackCall{customerID: customerID, featureID: featureID, value: value}
		return nil
	})
	return ch
}

func TestTrackBatchBytes(t *testing.T) {
	ctx := context.Background()

	t.Run("billing disabled → no autumn.Track call", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		orig := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = false
		t.Cleanup(func() { server.Server.Config.BillingEnabled = orig })

		ch := captureTrack(t)
		trackBatchBytes(uuid.New(), 1024)

		select {
		case call := <-ch:
			t.Errorf("autumn.Track should not be called when billing disabled, got %+v", call)
		case <-time.After(200 * time.Millisecond):
		}
	})

	t.Run("size 0 → no autumn.Track call", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		ch := captureTrack(t)
		trackBatchBytes(uuid.New(), 0)

		select {
		case call := <-ch:
			t.Errorf("autumn.Track should not be called for size 0, got %+v", call)
		case <-time.After(200 * time.Millisecond):
		}
	})

	t.Run("team without autumn customer → no autumn.Track call", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "test-team")

		ch := captureTrack(t)
		trackBatchBytes(teamID, 1024)

		select {
		case call := <-ch:
			t.Errorf("autumn.Track should not be called for unprovisioned team, got %+v", call)
		case <-time.After(500 * time.Millisecond):
		}
	})

	t.Run("happy path → autumn.Track called with team's customer id and bytes feature", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "test-team")
		seedTeamAutumnCustomer(ctx, t, teamID, "cust_happy")

		ch := captureTrack(t)
		trackBatchBytes(teamID, 4096)

		select {
		case call := <-ch:
			if call.customerID != "cust_happy" {
				t.Errorf("customerID = %q, want cust_happy", call.customerID)
			}
			if call.featureID != autumn.FeatureBytes {
				t.Errorf("featureID = %q, want %q", call.featureID, autumn.FeatureBytes)
			}
			if call.value != 4096 {
				t.Errorf("value = %v, want 4096", call.value)
			}
		case <-time.After(2 * time.Second):
			t.Fatal("autumn.Track was never called")
		}
	})

	t.Run("autumn error → swallowed, no panic", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "test-team")
		seedTeamAutumnCustomer(ctx, t, teamID, "cust_err")

		called := make(chan struct{}, 1)
		autumntest.MockTrack(t, func(_ context.Context, _, _ string, _ float64) error {
			called <- struct{}{}
			return errors.New("autumn unreachable")
		})

		trackBatchBytes(teamID, 512)

		select {
		case <-called:
		case <-time.After(2 * time.Second):
			t.Fatal("autumn.Track was never attempted")
		}
		// Brief sleep so the goroutine's log+exit has time to run; without
		// it a panic in the goroutine would race the test exit and could
		// be missed.
		time.Sleep(50 * time.Millisecond)
	})
}

func TestGetAutumnCustomerIDForTeam(t *testing.T) {
	ctx := context.Background()

	t.Run("team without customer → empty string", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "test-team")

		got, err := getAutumnCustomerIDForTeam(ctx, teamID)
		if err != nil {
			t.Fatalf("unexpected err: %v", err)
		}
		if got != "" {
			t.Errorf("want empty, got %q", got)
		}
	})

	t.Run("team with customer → id", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "test-team")
		seedTeamAutumnCustomer(ctx, t, teamID, "cust_lookup")

		got, err := getAutumnCustomerIDForTeam(ctx, teamID)
		if err != nil {
			t.Fatalf("unexpected err: %v", err)
		}
		if got != "cust_lookup" {
			t.Errorf("want cust_lookup, got %q", got)
		}
	})

	t.Run("nonexistent team → returns error", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		_, err := getAutumnCustomerIDForTeam(ctx, uuid.New())
		if err == nil {
			t.Error("want error for unknown team, got nil")
		}
	})
}
