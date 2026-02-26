//go:build integration

package measure

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func TestGetAppThresholdPrefs(t *testing.T) {
	ctx := context.Background()

	t.Run("returns defaults when row missing", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/thresholdPrefs", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}

		GetAppThresholdPrefs(c)
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
		}

		var got map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if got["error_good_threshold"] != float64(95) {
			t.Fatalf("error_good_threshold = %v, want 95", got["error_good_threshold"])
		}
		if got["error_caution_threshold"] != float64(85) {
			t.Fatalf("error_caution_threshold = %v, want 85", got["error_caution_threshold"])
		}
		if got["error_spike_min_count_threshold"] != float64(100) {
			t.Fatalf("error_spike_min_count_threshold = %v, want 100", got["error_spike_min_count_threshold"])
		}
		if got["error_spike_min_rate_threshold"] != float64(0.5) {
			t.Fatalf("error_spike_min_rate_threshold = %v, want 0.5", got["error_spike_min_rate_threshold"])
		}
	})

	t.Run("returns stored values when row exists", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)
		th.SeedAppThresholdPrefs(ctx, t, appID.String(), 98.5, 91.2, 50, 1.5)

		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/thresholdPrefs", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}

		GetAppThresholdPrefs(c)
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
		}

		var got map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if got["error_good_threshold"] != 98.5 {
			t.Fatalf("error_good_threshold = %v, want 98.5", got["error_good_threshold"])
		}
		if got["error_caution_threshold"] != 91.2 {
			t.Fatalf("error_caution_threshold = %v, want 91.2", got["error_caution_threshold"])
		}
		if got["error_spike_min_count_threshold"] != float64(50) {
			t.Fatalf("error_spike_min_count_threshold = %v, want 50", got["error_spike_min_count_threshold"])
		}
		if got["error_spike_min_rate_threshold"] != 1.5 {
			t.Fatalf("error_spike_min_rate_threshold = %v, want 1.5", got["error_spike_min_rate_threshold"])
		}
	})

	t.Run("all team roles can read", func(t *testing.T) {
		for _, role := range []string{"owner", "admin", "developer", "viewer"} {
			role := role
			t.Run(role, func(t *testing.T) {
				defer cleanupAll(ctx, t)
				userID, teamID := seedTeamAndMemberWithRole(t, ctx, role)
				appID := uuid.New()
				seedApp(ctx, t, appID, teamID, 30)

				c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/thresholdPrefs", nil)
				c.Set("userId", userID)
				c.Params = gin.Params{{Key: "id", Value: appID.String()}}

				GetAppThresholdPrefs(c)
				if w.Code != http.StatusOK {
					t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
				}
			})
		}
	})

	t.Run("missing membership returns internal server error", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID := uuid.New().String()
		teamID := uuid.New()
		appID := uuid.New()
		seedUser(ctx, t, userID, "threshold-no-membership@test.com")
		seedTeam(ctx, t, teamID, "threshold-team", true)
		seedApp(ctx, t, appID, teamID, 30)

		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/thresholdPrefs", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}

		GetAppThresholdPrefs(c)
		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusInternalServerError, w.Body.String())
		}
	})

	t.Run("invalid app id returns bad request", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		c, w := newTestGinContext("GET", "/apps/not-a-uuid/thresholdPrefs", nil)
		c.Set("userId", uuid.New().String())
		c.Params = gin.Params{{Key: "id", Value: "not-a-uuid"}}

		GetAppThresholdPrefs(c)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
		}
	})

	t.Run("app not found returns bad request", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		nonExistentAppID := uuid.New()
		c, w := newTestGinContext("GET", "/apps/"+nonExistentAppID.String()+"/thresholdPrefs", nil)
		c.Set("userId", uuid.New().String())
		c.Params = gin.Params{{Key: "id", Value: nonExistentAppID.String()}}

		GetAppThresholdPrefs(c)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusBadRequest, w.Body.String())
		}
	})
}

func TestUpdateAppThresholdPrefs(t *testing.T) {
	ctx := context.Background()

	t.Run("owner and admin can create and then update preferences", func(t *testing.T) {
		for _, role := range []string{"owner", "admin"} {
			role := role
			t.Run(role, func(t *testing.T) {
				defer cleanupAll(ctx, t)
				userID, teamID := seedTeamAndMemberWithRole(t, ctx, role)
				appID := uuid.New()
				seedApp(ctx, t, appID, teamID, 30)

				first := AppThresholdPrefsPayload{ErrorGoodThreshold: 97, ErrorCautionThreshold: 88, ErrorSpikeMinCountThreshold: 50, ErrorSpikeMinRateThreshold: 1.0}
				b, _ := json.Marshal(first)
				c, w := newTestGinContext("PATCH", "/apps/"+appID.String()+"/thresholdPrefs", bytes.NewReader(b))
				c.Set("userId", userID)
				c.Params = gin.Params{{Key: "id", Value: appID.String()}}

				UpdateAppThresholdPrefs(c)
				if w.Code != http.StatusOK {
					t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
				}

				second := AppThresholdPrefsPayload{ErrorGoodThreshold: 99, ErrorCautionThreshold: 94, ErrorSpikeMinCountThreshold: 200, ErrorSpikeMinRateThreshold: 2.5}
				b2, _ := json.Marshal(second)
				c2, w2 := newTestGinContext("PATCH", "/apps/"+appID.String()+"/thresholdPrefs", bytes.NewReader(b2))
				c2.Set("userId", userID)
				c2.Params = gin.Params{{Key: "id", Value: appID.String()}}

				UpdateAppThresholdPrefs(c2)
				if w2.Code != http.StatusOK {
					t.Fatalf("status = %d, want %d, body: %s", w2.Code, http.StatusOK, w2.Body.String())
				}

				var good, caution, spikeThreshold float64
				var minCount int
				err := th.PgPool.QueryRow(ctx,
					`SELECT error_good_threshold, error_caution_threshold, error_spike_min_count_threshold, error_spike_min_rate_threshold FROM measure.app_threshold_prefs WHERE app_id = $1`,
					appID,
				).Scan(&good, &caution, &minCount, &spikeThreshold)
				if err != nil {
					t.Fatalf("query threshold prefs: %v", err)
				}
				if good != 99 || caution != 94 {
					t.Fatalf("stored error thresholds = (%v,%v), want (99,94)", good, caution)
				}
				if minCount != 200 || spikeThreshold != 2.5 {
					t.Fatalf("stored alert thresholds = (%v,%v), want (200,2.5)", minCount, spikeThreshold)
				}
			})
		}
	})

	t.Run("developer and viewer cannot update", func(t *testing.T) {
		for _, role := range []string{"developer", "viewer"} {
			role := role
			t.Run(role, func(t *testing.T) {
				defer cleanupAll(ctx, t)
				userID, teamID := seedTeamAndMemberWithRole(t, ctx, role)
				appID := uuid.New()
				seedApp(ctx, t, appID, teamID, 30)

				payload := AppThresholdPrefsPayload{ErrorGoodThreshold: 97, ErrorCautionThreshold: 88, ErrorSpikeMinCountThreshold: 100, ErrorSpikeMinRateThreshold: 0.5}
				b, _ := json.Marshal(payload)
				c, w := newTestGinContext("PATCH", "/apps/"+appID.String()+"/thresholdPrefs", bytes.NewReader(b))
				c.Set("userId", userID)
				c.Params = gin.Params{{Key: "id", Value: appID.String()}}

				UpdateAppThresholdPrefs(c)
				if w.Code != http.StatusForbidden {
					t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusForbidden, w.Body.String())
				}
			})
		}
	})

	t.Run("missing membership returns internal server error", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID := uuid.New().String()
		teamID := uuid.New()
		appID := uuid.New()
		seedUser(ctx, t, userID, "threshold-update-no-membership@test.com")
		seedTeam(ctx, t, teamID, "threshold-team", true)
		seedApp(ctx, t, appID, teamID, 30)

		b, _ := json.Marshal(AppThresholdPrefsPayload{ErrorGoodThreshold: 95, ErrorCautionThreshold: 85, ErrorSpikeMinCountThreshold: 100, ErrorSpikeMinRateThreshold: 0.5})
		c, w := newTestGinContext("PATCH", "/apps/"+appID.String()+"/thresholdPrefs", bytes.NewReader(b))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}
		UpdateAppThresholdPrefs(c)
		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusInternalServerError, w.Body.String())
		}
	})

	t.Run("invalid app id returns bad request", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		c, w := newTestGinContext("PATCH", "/apps/not-a-uuid/thresholdPrefs", bytes.NewReader([]byte(`{"error_good_threshold":95,"error_caution_threshold":85,"error_spike_min_count_threshold":100,"error_spike_min_rate_threshold":0.5}`)))
		c.Set("userId", uuid.New().String())
		c.Params = gin.Params{{Key: "id", Value: "not-a-uuid"}}
		UpdateAppThresholdPrefs(c)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
		}
	})

	t.Run("app not found returns bad request", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		nonExistentAppID := uuid.New()
		b, _ := json.Marshal(AppThresholdPrefsPayload{ErrorGoodThreshold: 95, ErrorCautionThreshold: 85, ErrorSpikeMinCountThreshold: 100, ErrorSpikeMinRateThreshold: 0.5})
		c, w := newTestGinContext("PATCH", "/apps/"+nonExistentAppID.String()+"/thresholdPrefs", bytes.NewReader(b))
		c.Set("userId", uuid.New().String())
		c.Params = gin.Params{{Key: "id", Value: nonExistentAppID.String()}}
		UpdateAppThresholdPrefs(c)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusBadRequest, w.Body.String())
		}
	})

	t.Run("malformed JSON returns bad request", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		c, w := newTestGinContext("PATCH", "/apps/"+appID.String()+"/thresholdPrefs", bytes.NewReader([]byte(`{`)))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}
		UpdateAppThresholdPrefs(c)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
		}
	})

	t.Run("missing required fields returns bad request", func(t *testing.T) {
		cases := []struct {
			name string
			body string
		}{
			{name: "missing all fields", body: `{}`},
			{name: "missing caution", body: `{"error_good_threshold":95}`},
			{name: "missing good", body: `{"error_caution_threshold":85}`},
			{name: "missing error_spike_min_count_threshold", body: `{"error_good_threshold":95,"error_caution_threshold":85,"error_spike_min_rate_threshold":0.5}`},
			{name: "missing error_spike_min_rate_threshold", body: `{"error_good_threshold":95,"error_caution_threshold":85,"error_spike_min_count_threshold":100}`},
		}

		for _, tc := range cases {
			tc := tc
			t.Run(tc.name, func(t *testing.T) {
				defer cleanupAll(ctx, t)
				userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
				appID := uuid.New()
				seedApp(ctx, t, appID, teamID, 30)

				c, w := newTestGinContext("PATCH", "/apps/"+appID.String()+"/thresholdPrefs", bytes.NewReader([]byte(tc.body)))
				c.Set("userId", userID)
				c.Params = gin.Params{{Key: "id", Value: appID.String()}}
				UpdateAppThresholdPrefs(c)
				if w.Code != http.StatusBadRequest {
					t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusBadRequest, w.Body.String())
				}

				var got map[string]any
				if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
					t.Fatalf("unmarshal: %v", err)
				}
				wantErr := "error_good_threshold, error_caution_threshold, error_spike_min_count_threshold, and error_spike_min_rate_threshold are required"
				if got["error"] != wantErr {
					t.Fatalf("error = %v, want %q", got["error"], wantErr)
				}
			})
		}
	})

	t.Run("invalid JSON field types return bad request", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		cases := []string{
			`{"error_good_threshold":"95","error_caution_threshold":85,"error_spike_min_count_threshold":100,"error_spike_min_rate_threshold":0.5}`,
			`{"error_good_threshold":95,"error_caution_threshold":"85","error_spike_min_count_threshold":100,"error_spike_min_rate_threshold":0.5}`,
			`{"error_good_threshold":95,"error_caution_threshold":85,"error_spike_min_count_threshold":"100","error_spike_min_rate_threshold":0.5}`,
			`{"error_good_threshold":95,"error_caution_threshold":85,"error_spike_min_count_threshold":100,"error_spike_min_rate_threshold":"0.5"}`,
		}

		for _, body := range cases {
			c, w := newTestGinContext("PATCH", "/apps/"+appID.String()+"/thresholdPrefs", bytes.NewReader([]byte(body)))
			c.Set("userId", userID)
			c.Params = gin.Params{{Key: "id", Value: appID.String()}}
			UpdateAppThresholdPrefs(c)
			if w.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusBadRequest, w.Body.String())
			}
		}
	})

	t.Run("invalid threshold combinations return bad request", func(t *testing.T) {
		cases := []struct {
			name    string
			payload AppThresholdPrefsPayload
			wantErr string
		}{
			{
				name:    "good must be greater than caution",
				payload: AppThresholdPrefsPayload{ErrorGoodThreshold: 80, ErrorCautionThreshold: 90, ErrorSpikeMinCountThreshold: 100, ErrorSpikeMinRateThreshold: 0.5},
				wantErr: "error_good_threshold must be greater than error_caution_threshold",
			},
			{
				name:    "good must be greater than zero",
				payload: AppThresholdPrefsPayload{ErrorGoodThreshold: 0, ErrorCautionThreshold: 0, ErrorSpikeMinCountThreshold: 100, ErrorSpikeMinRateThreshold: 0.5},
				wantErr: "error_good_threshold must be greater than error_caution_threshold",
			},
			{
				name:    "good must not exceed 100",
				payload: AppThresholdPrefsPayload{ErrorGoodThreshold: 101, ErrorCautionThreshold: 90, ErrorSpikeMinCountThreshold: 100, ErrorSpikeMinRateThreshold: 0.5},
				wantErr: "error_good_threshold must be between 0 and 100",
			},
			{
				name:    "caution must be non-negative",
				payload: AppThresholdPrefsPayload{ErrorGoodThreshold: 90, ErrorCautionThreshold: -1, ErrorSpikeMinCountThreshold: 100, ErrorSpikeMinRateThreshold: 0.5},
				wantErr: "error_caution_threshold must be between 0 and 100",
			},
			{
				name:    "caution must be below 100",
				payload: AppThresholdPrefsPayload{ErrorGoodThreshold: 100, ErrorCautionThreshold: 100, ErrorSpikeMinCountThreshold: 100, ErrorSpikeMinRateThreshold: 0.5},
				wantErr: "error_good_threshold must be greater than error_caution_threshold",
			},
			{
				name:    "error_spike_min_count_threshold must be at least 1",
				payload: AppThresholdPrefsPayload{ErrorGoodThreshold: 95, ErrorCautionThreshold: 85, ErrorSpikeMinCountThreshold: 0, ErrorSpikeMinRateThreshold: 0.5},
				wantErr: "error_spike_min_count_threshold must be at least 1",
			},
			{
				name:    "error_spike_min_rate_threshold must be greater than zero",
				payload: AppThresholdPrefsPayload{ErrorGoodThreshold: 95, ErrorCautionThreshold: 85, ErrorSpikeMinCountThreshold: 100, ErrorSpikeMinRateThreshold: 0},
				wantErr: "error_spike_min_rate_threshold must be between 0 (exclusive) and 100",
			},
			{
				name:    "error_spike_min_rate_threshold must not exceed 100",
				payload: AppThresholdPrefsPayload{ErrorGoodThreshold: 95, ErrorCautionThreshold: 85, ErrorSpikeMinCountThreshold: 100, ErrorSpikeMinRateThreshold: 101},
				wantErr: "error_spike_min_rate_threshold must be between 0 (exclusive) and 100",
			},
		}

		for _, tc := range cases {
			tc := tc
			t.Run(tc.name, func(t *testing.T) {
				defer cleanupAll(ctx, t)
				userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
				appID := uuid.New()
				seedApp(ctx, t, appID, teamID, 30)

				b, _ := json.Marshal(tc.payload)
				c, w := newTestGinContext("PATCH", "/apps/"+appID.String()+"/thresholdPrefs", bytes.NewReader(b))
				c.Set("userId", userID)
				c.Params = gin.Params{{Key: "id", Value: appID.String()}}
				UpdateAppThresholdPrefs(c)
				if w.Code != http.StatusBadRequest {
					t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
				}

				var got map[string]any
				if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
					t.Fatalf("unmarshal: %v", err)
				}
				if got["error"] != tc.wantErr {
					t.Fatalf("error = %v, want %q", got["error"], tc.wantErr)
				}
			})
		}
	})

	t.Run("out of range but ordered values return bound errors", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		cases := []struct {
			payload AppThresholdPrefsPayload
			wantErr string
		}{
			{
				payload: AppThresholdPrefsPayload{ErrorGoodThreshold: -1, ErrorCautionThreshold: -2, ErrorSpikeMinCountThreshold: 100, ErrorSpikeMinRateThreshold: 0.5},
				wantErr: "error_good_threshold must be between 0 and 100",
			},
			{
				payload: AppThresholdPrefsPayload{ErrorGoodThreshold: 99.9, ErrorCautionThreshold: 100, ErrorSpikeMinCountThreshold: 100, ErrorSpikeMinRateThreshold: 0.5},
				wantErr: "error_good_threshold must be greater than error_caution_threshold",
			},
		}

		for _, tc := range cases {
			b, _ := json.Marshal(tc.payload)
			c, w := newTestGinContext("PATCH", "/apps/"+appID.String()+"/thresholdPrefs", bytes.NewReader(b))
			c.Set("userId", userID)
			c.Params = gin.Params{{Key: "id", Value: appID.String()}}
			UpdateAppThresholdPrefs(c)
			if w.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
			}

			var got map[string]any
			if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if got["error"] != tc.wantErr {
				t.Fatalf("error = %v, want %q", got["error"], tc.wantErr)
			}
		}
	})

	t.Run("boundary values are accepted", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		// error_spike_min_count_threshold = 1 (minimum), error_spike_min_rate_threshold = 100 (maximum)
		payload := AppThresholdPrefsPayload{ErrorGoodThreshold: 95, ErrorCautionThreshold: 85, ErrorSpikeMinCountThreshold: 1, ErrorSpikeMinRateThreshold: 100}
		b, _ := json.Marshal(payload)
		c, w := newTestGinContext("PATCH", "/apps/"+appID.String()+"/thresholdPrefs", bytes.NewReader(b))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}
		UpdateAppThresholdPrefs(c)
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
		}
	})
}
