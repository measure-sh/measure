//go:build integration

package measure

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"testing"

	"backend/api/server"
	"backend/autumn"
	autumntest "backend/autumn/testhelpers"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// retentionPayload is the JSON body shape accepted by UpdateAppRetention.
func retentionPayload(days int) []byte {
	return []byte(fmt.Sprintf(`{"retention":%d}`, days))
}

// --------------------------------------------------------------------------
// UpdateAppRetention handler
// --------------------------------------------------------------------------

func TestUpdateAppRetention(t *testing.T) {
	ctx := context.Background()

	t.Run("billing enabled → 403 with plan-driven message", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		// BillingEnabled is already true via TestMain.
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, MIN_RETENTION_DAYS)

		c, w := newTestGinContext("PATCH", "/apps/"+appID.String()+"/retention", bytes.NewReader(retentionPayload(90)))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}

		UpdateAppRetention(c)

		if w.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusForbidden, w.Body.String())
		}

		if got := getAppRetention(ctx, t, appID); got != MIN_RETENTION_DAYS {
			t.Errorf("retention changed despite 403: got %d, want %d", got, MIN_RETENTION_DAYS)
		}
	})

	t.Run("self-hosted (billing disabled) → updates retention", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		orig := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = false
		t.Cleanup(func() { server.Server.Config.BillingEnabled = orig })

		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, MIN_RETENTION_DAYS)

		c, w := newTestGinContext("PATCH", "/apps/"+appID.String()+"/retention", bytes.NewReader(retentionPayload(180)))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}

		UpdateAppRetention(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		if got := getAppRetention(ctx, t, appID); got != 180 {
			t.Errorf("retention = %d, want 180", got)
		}
	})

	t.Run("self-hosted, retention below min → 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		orig := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = false
		t.Cleanup(func() { server.Server.Config.BillingEnabled = orig })

		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, MIN_RETENTION_DAYS)

		c, w := newTestGinContext("PATCH", "/apps/"+appID.String()+"/retention", bytes.NewReader(retentionPayload(7)))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}

		UpdateAppRetention(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
		if got := getAppRetention(ctx, t, appID); got != MIN_RETENTION_DAYS {
			t.Errorf("retention unexpectedly changed: got %d", got)
		}
	})

	t.Run("self-hosted, retention above max → 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		orig := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = false
		t.Cleanup(func() { server.Server.Config.BillingEnabled = orig })

		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, MIN_RETENTION_DAYS)

		c, w := newTestGinContext("PATCH", "/apps/"+appID.String()+"/retention", bytes.NewReader(retentionPayload(MAX_RETENTION_DAYS+1)))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}

		UpdateAppRetention(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("self-hosted, roles without permission → 403", func(t *testing.T) {
		orig := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = false
		t.Cleanup(func() { server.Server.Config.BillingEnabled = orig })

		for _, role := range []string{"developer", "viewer"} {
			t.Run(role, func(t *testing.T) {
				defer cleanupAll(ctx, t)
				userID, teamID := seedTeamAndMemberWithRole(t, ctx, role)
				appID := uuid.New()
				seedApp(ctx, t, appID, teamID, MIN_RETENTION_DAYS)

				c, w := newTestGinContext("PATCH", "/apps/"+appID.String()+"/retention", bytes.NewReader(retentionPayload(90)))
				c.Set("userId", userID)
				c.Params = gin.Params{{Key: "id", Value: appID.String()}}

				UpdateAppRetention(c)

				if w.Code != http.StatusForbidden {
					t.Fatalf("%s: status = %d, want 403", role, w.Code)
				}
			})
		}
	})

}

// --------------------------------------------------------------------------
// CreateApp retention assignment
// --------------------------------------------------------------------------

func TestCreateAppRetention(t *testing.T) {
	ctx := context.Background()

	createAppPayload := []byte(`{"name":"test-app","retention":365}`)

	createApp := func(userID string, teamID uuid.UUID) (*gin.Context, int, string, uuid.UUID) {
		c, w := newTestGinContext("POST", "/teams/"+teamID.String()+"/apps", bytes.NewReader(createAppPayload))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		CreateApp(c)
		return c, w.Code, w.Body.String(), getFirstAppID(ctx, t, teamID)
	}

	t.Run("self-hosted → retention taken from payload", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		orig := server.Server.Config.BillingEnabled
		server.Server.Config.BillingEnabled = false
		t.Cleanup(func() { server.Server.Config.BillingEnabled = orig })

		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		_, code, body, appID := createApp(userID, teamID)
		if code != http.StatusCreated {
			t.Fatalf("status = %d, body: %s", code, body)
		}
		if got := getAppRetention(ctx, t, appID); got != 365 {
			t.Errorf("self-hosted retention = %d, want 365 (from payload)", got)
		}
	})

	t.Run("billing enabled + free plan → retention is 30d regardless of payload", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		seedTeamAutumnCustomer(ctx, t, teamID, "cust_free_create")

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID:       "cust_free_create",
				Products: []autumn.CustomerProduct{{ID: autumnPlanFree}},
				Balances: map[string]autumn.Balance{
					autumn.FeatureRetentionDays: {FeatureID: autumn.FeatureRetentionDays, Granted: 30},
				},
			}, nil
		})

		_, code, body, appID := createApp(userID, teamID)
		if code != http.StatusCreated {
			t.Fatalf("status = %d, body: %s", code, body)
		}
		if got := getAppRetention(ctx, t, appID); got != MIN_RETENTION_DAYS {
			t.Errorf("retention = %d, want %d", got, MIN_RETENTION_DAYS)
		}
	})

	t.Run("billing enabled + pro plan → retention is 90d regardless of payload", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		seedTeamAutumnCustomer(ctx, t, teamID, "cust_pro_create")

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID:       "cust_pro_create",
				Products: []autumn.CustomerProduct{{ID: autumnPlanPro}},
				Balances: map[string]autumn.Balance{
					autumn.FeatureRetentionDays: {FeatureID: autumn.FeatureRetentionDays, Granted: 90},
				},
			}, nil
		})

		_, code, body, appID := createApp(userID, teamID)
		if code != http.StatusCreated {
			t.Fatalf("status = %d, body: %s", code, body)
		}
		if got := getAppRetention(ctx, t, appID); got != 90 {
			t.Errorf("retention = %d, want 90", got)
		}
	})

	t.Run("billing enabled + enterprise plan → retention from feature entitlement", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		seedTeamAutumnCustomer(ctx, t, teamID, "cust_ent_create")

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{
				ID:       "cust_ent_create",
				Products: []autumn.CustomerProduct{{ID: "plan_ent_foo"}},
				Balances: map[string]autumn.Balance{
					autumn.FeatureRetentionDays: {FeatureID: autumn.FeatureRetentionDays, Granted: 240},
				},
			}, nil
		})

		_, code, body, appID := createApp(userID, teamID)
		if code != http.StatusCreated {
			t.Fatalf("status = %d, body: %s", code, body)
		}
		if got := getAppRetention(ctx, t, appID); got != 240 {
			t.Errorf("retention = %d, want 240", got)
		}
	})

	t.Run("billing enabled but no autumn customer → retention falls back to free default", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		// No seedTeamAutumnCustomer — team hasn't been provisioned.
		_, code, body, appID := createApp(userID, teamID)
		if code != http.StatusCreated {
			t.Fatalf("status = %d, body: %s", code, body)
		}
		if got := getAppRetention(ctx, t, appID); got != MIN_RETENTION_DAYS {
			t.Errorf("retention = %d, want %d", got, MIN_RETENTION_DAYS)
		}
	})

	t.Run("billing enabled and autumn.GetCustomer fails → 503, no app created", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		seedTeamAutumnCustomer(ctx, t, teamID, "cust_err_create")

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return nil, fmt.Errorf("autumn unreachable")
		})

		c, w := newTestGinContext("POST", "/teams/"+teamID.String()+"/apps", bytes.NewReader(createAppPayload))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		CreateApp(c)

		if w.Code != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusServiceUnavailable, w.Body.String())
		}
		var count int
		if err := th.PgPool.QueryRow(ctx, `SELECT COUNT(*) FROM apps WHERE team_id = $1`, teamID).Scan(&count); err != nil {
			t.Fatalf("count apps: %v", err)
		}
		if count != 0 {
			t.Errorf("apps created despite autumn failure: count = %d, want 0", count)
		}
	})

}
