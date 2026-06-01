//go:build integration

package measure

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// healthSeriesResp mirrors one element of the handler's JSON response array.
type healthSeriesResp struct {
	ID   string `json:"id"`
	Data []struct {
		Datetime  string `json:"datetime"`
		Instances uint64 `json:"instances"`
	} `json:"data"`
}

func decodeHealthSeries(t *testing.T, w *httptest.ResponseRecorder) []healthSeriesResp {
	t.Helper()
	var got []healthSeriesResp
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal response: %v; body=%s", err, w.Body.String())
	}
	return got
}

func sumSeries(series []healthSeriesResp, id string) uint64 {
	for _, s := range series {
		if s.ID != id {
			continue
		}
		var total uint64
		for _, d := range s.Data {
			total += d.Instances
		}
		return total
	}
	return 0
}

func TestGetHealthOverviewPlotInstancesHandler(t *testing.T) {
	ctx := context.Background()

	t.Run("invalid app id returns 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		c, w := newTestGinContext("GET", "/apps/not-a-uuid/health/plots/instances?timezone=UTC", nil)
		c.Set("userId", uuid.New().String())
		c.Params = gin.Params{{Key: "id", Value: "not-a-uuid"}}

		GetHealthOverviewPlotInstances(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
		wantJSONContains(t, w, "error", "id invalid or missing")
	})

	t.Run("missing timezone returns 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		appID := uuid.New()
		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/health/plots/instances", nil)
		c.Set("userId", uuid.New().String())
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}

		GetHealthOverviewPlotInstances(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
		wantJSONContains(t, w, "error", "timezone")
	})

	t.Run("versions without version_codes returns 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		appID := uuid.New()
		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/health/plots/instances?timezone=UTC&versions=v1", nil)
		c.Set("userId", uuid.New().String())
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}

		GetHealthOverviewPlotInstances(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
		wantJSONContains(t, w, "details", "version_codes")
	})

	t.Run("app with no team returns 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		appID := uuid.New() // never seeded, so it has no team
		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/health/plots/instances?timezone=UTC", nil)
		c.Set("userId", uuid.New().String())
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}

		GetHealthOverviewPlotInstances(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
		wantJSONContains(t, w, "error", "no team exists for app")
	})

	t.Run("user without membership returns 500", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		appID := uuid.New()
		seedUser(ctx, t, userID, "health-no-membership@test.com")
		seedTeam(ctx, t, teamID, "health-team")
		seedApp(ctx, t, appID, teamID, 30)

		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/health/plots/instances?timezone=UTC", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}

		GetHealthOverviewPlotInstances(c)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want 500, body: %s", w.Code, w.Body.String())
		}
		wantJSONContains(t, w, "error", "authoriz")
	})

	t.Run("missing userId returns 500", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "health-team")
		seedApp(ctx, t, appID, teamID, 30)

		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/health/plots/instances?timezone=UTC", nil)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}} // no userId set

		GetHealthOverviewPlotInstances(c)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want 500, body: %s", w.Code, w.Body.String())
		}
		wantJSONContains(t, w, "error", "authoriz")
	})

	// This is a read endpoint guarded by ScopeTeamRead + ScopeAppRead, which
	// every role holds — so all roles get 200 (there is no forbidden role).
	t.Run("all team roles can read", func(t *testing.T) {
		for _, role := range []string{"owner", "admin", "developer", "viewer"} {
			role := role
			t.Run(role, func(t *testing.T) {
				defer cleanupAll(ctx, t)

				userID, teamID := seedTeamAndMemberWithRole(t, ctx, role)
				appID := uuid.New()
				seedApp(ctx, t, appID, teamID, 30)

				c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/health/plots/instances?timezone=UTC", nil)
				c.Set("userId", userID)
				c.Params = gin.Params{{Key: "id", Value: appID.String()}}

				GetHealthOverviewPlotInstances(c)

				if w.Code != http.StatusOK {
					t.Fatalf("%s: status = %d, want 200, body: %s", role, w.Code, w.Body.String())
				}

				// Always three series, in order, even with no data.
				series := decodeHealthSeries(t, w)
				wantIDs := []string{"sessions", "crashes", "anrs"}
				if len(series) != len(wantIDs) {
					t.Fatalf("%s: got %d series, want 3: %s", role, len(series), w.Body.String())
				}
				for i, want := range wantIDs {
					if series[i].ID != want {
						t.Errorf("%s: series[%d].id = %q, want %q", role, i, series[i].ID, want)
					}
				}
			})
		}
	})

	t.Run("returns sessions, crashes and ANRs counts", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		// within the default last-7-days window
		ts := time.Now().UTC().Add(-1 * time.Hour)
		seedAppMetrics(ctx, t, teamID.String(), appID.String(), ts, 10, 2, 1)

		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/health/plots/instances?timezone=UTC", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}

		GetHealthOverviewPlotInstances(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		series := decodeHealthSeries(t, w)
		if got := sumSeries(series, "sessions"); got != 13 {
			t.Errorf("sessions = %d, want 13", got)
		}
		if got := sumSeries(series, "crashes"); got != 2 {
			t.Errorf("crashes = %d, want 2", got)
		}
		if got := sumSeries(series, "anrs"); got != 1 {
			t.Errorf("anrs = %d, want 1", got)
		}
	})
}
