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

func TestGetTeamThresholdPrefs(t *testing.T) {
	ctx := context.Background()

	t.Run("returns defaults when row missing", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/thresholdPrefs", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		GetTeamThresholdPrefs(c)
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
	})

	t.Run("returns stored values when row exists", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		th.SeedTeamThresholdPrefs(ctx, t, teamID.String(), 98.5, 91.2)

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/thresholdPrefs", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		GetTeamThresholdPrefs(c)
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
	})

	t.Run("all team roles can read", func(t *testing.T) {
		for _, role := range []string{"owner", "admin", "developer", "viewer"} {
			role := role
			t.Run(role, func(t *testing.T) {
				defer cleanupAll(ctx, t)
				userID, teamID := seedTeamAndMemberWithRole(t, ctx, role)

				c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/thresholdPrefs", nil)
				c.Set("userId", userID)
				c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

				GetTeamThresholdPrefs(c)
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
		seedUser(ctx, t, userID, "threshold-no-membership@test.com")
		seedTeam(ctx, t, teamID, "threshold-team", true)

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/thresholdPrefs", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

		GetTeamThresholdPrefs(c)
		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusInternalServerError, w.Body.String())
		}
	})

	t.Run("invalid team id returns bad request", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		c, w := newTestGinContext("GET", "/teams/not-a-uuid/thresholdPrefs", nil)
		c.Set("userId", uuid.New().String())
		c.Params = gin.Params{{Key: "id", Value: "not-a-uuid"}}

		GetTeamThresholdPrefs(c)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
		}
	})
}

func TestUpdateTeamThresholdPrefs(t *testing.T) {
	ctx := context.Background()

	t.Run("owner and admin can create and then update preferences", func(t *testing.T) {
		for _, role := range []string{"owner", "admin"} {
			role := role
			t.Run(role, func(t *testing.T) {
				defer cleanupAll(ctx, t)
				userID, teamID := seedTeamAndMemberWithRole(t, ctx, role)

				first := TeamThresholdPrefsPayload{ErrorGoodThreshold: 97, ErrorCautionThreshold: 88}
				b, _ := json.Marshal(first)
				c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/thresholdPrefs", bytes.NewReader(b))
				c.Set("userId", userID)
				c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

				UpdateTeamThresholdPrefs(c)
				if w.Code != http.StatusOK {
					t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
				}

				second := TeamThresholdPrefsPayload{ErrorGoodThreshold: 99, ErrorCautionThreshold: 94}
				b2, _ := json.Marshal(second)
				c2, w2 := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/thresholdPrefs", bytes.NewReader(b2))
				c2.Set("userId", userID)
				c2.Params = gin.Params{{Key: "id", Value: teamID.String()}}

				UpdateTeamThresholdPrefs(c2)
				if w2.Code != http.StatusOK {
					t.Fatalf("status = %d, want %d, body: %s", w2.Code, http.StatusOK, w2.Body.String())
				}

				var good, caution float64
				err := th.PgPool.QueryRow(ctx,
					`SELECT error_good_threshold, error_caution_threshold FROM measure.team_threshold_prefs WHERE team_id = $1`,
					teamID,
				).Scan(&good, &caution)
				if err != nil {
					t.Fatalf("query threshold prefs: %v", err)
				}
				if good != 99 || caution != 94 {
					t.Fatalf("stored thresholds = (%v,%v), want (99,94)", good, caution)
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

				payload := TeamThresholdPrefsPayload{ErrorGoodThreshold: 97, ErrorCautionThreshold: 88}
				b, _ := json.Marshal(payload)
				c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/thresholdPrefs", bytes.NewReader(b))
				c.Set("userId", userID)
				c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

				UpdateTeamThresholdPrefs(c)
				if w.Code != http.StatusForbidden {
					t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusForbidden, w.Body.String())
				}

				var count int
				err := th.PgPool.QueryRow(ctx,
					`SELECT COUNT(*) FROM measure.team_threshold_prefs WHERE team_id = $1`,
					teamID,
				).Scan(&count)
				if err != nil {
					t.Fatalf("query threshold prefs count: %v", err)
				}
				if count != 0 {
					t.Fatalf("forbidden update must not mutate DB, found %d rows", count)
				}
			})
		}
	})

	t.Run("missing membership returns internal server error", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, "threshold-update-no-membership@test.com")
		seedTeam(ctx, t, teamID, "threshold-team", true)

		b, _ := json.Marshal(TeamThresholdPrefsPayload{ErrorGoodThreshold: 95, ErrorCautionThreshold: 85})
		c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/thresholdPrefs", bytes.NewReader(b))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		UpdateTeamThresholdPrefs(c)
		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusInternalServerError, w.Body.String())
		}
	})

	t.Run("invalid team id returns bad request", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, _ := seedTeamAndMemberWithRole(t, ctx, "owner")

		c, w := newTestGinContext("PATCH", "/teams/not-a-uuid/thresholdPrefs", bytes.NewReader([]byte(`{"error_good_threshold":95,"error_caution_threshold":85}`)))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: "not-a-uuid"}}
		UpdateTeamThresholdPrefs(c)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
		}
	})

	t.Run("malformed JSON returns bad request", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")

		c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/thresholdPrefs", bytes.NewReader([]byte(`{`)))
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		UpdateTeamThresholdPrefs(c)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
		}
	})

	t.Run("missing required fields returns bad request", func(t *testing.T) {
		cases := []struct {
			name string
			body string
		}{
			{name: "missing both fields", body: `{}`},
			{name: "missing caution", body: `{"error_good_threshold":95}`},
			{name: "missing good", body: `{"error_caution_threshold":85}`},
		}

		for _, tc := range cases {
			tc := tc
			t.Run(tc.name, func(t *testing.T) {
				defer cleanupAll(ctx, t)
				userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")

				c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/thresholdPrefs", bytes.NewReader([]byte(tc.body)))
				c.Set("userId", userID)
				c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
				UpdateTeamThresholdPrefs(c)
				if w.Code != http.StatusBadRequest {
					t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusBadRequest, w.Body.String())
				}

				var got map[string]any
				if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
					t.Fatalf("unmarshal: %v", err)
				}
				if got["error"] != "error_good_threshold and error_caution_threshold are required" {
					t.Fatalf("error = %v, want %q", got["error"], "error_good_threshold and error_caution_threshold are required")
				}
			})
		}
	})

	t.Run("invalid JSON field types return bad request", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")

		cases := []string{
			`{"error_good_threshold":"95","error_caution_threshold":85}`,
			`{"error_good_threshold":95,"error_caution_threshold":"85"}`,
		}

		for _, body := range cases {
			c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/thresholdPrefs", bytes.NewReader([]byte(body)))
			c.Set("userId", userID)
			c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
			UpdateTeamThresholdPrefs(c)
			if w.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusBadRequest, w.Body.String())
			}
		}
	})

	t.Run("invalid threshold combinations return bad request", func(t *testing.T) {
		cases := []struct {
			name    string
			payload TeamThresholdPrefsPayload
			wantErr string
		}{
			{
				name:    "good must be greater than caution",
				payload: TeamThresholdPrefsPayload{ErrorGoodThreshold: 80, ErrorCautionThreshold: 90},
				wantErr: "error_good_threshold must be greater than error_caution_threshold",
			},
			{
				name:    "good must be greater than zero",
				payload: TeamThresholdPrefsPayload{ErrorGoodThreshold: 0, ErrorCautionThreshold: 0},
				wantErr: "error_good_threshold must be greater than error_caution_threshold",
			},
			{
				name:    "good must not exceed 100",
				payload: TeamThresholdPrefsPayload{ErrorGoodThreshold: 101, ErrorCautionThreshold: 90},
				wantErr: "error_good_threshold must be between 0 and 100",
			},
			{
				name:    "caution must be non-negative",
				payload: TeamThresholdPrefsPayload{ErrorGoodThreshold: 90, ErrorCautionThreshold: -1},
				wantErr: "error_caution_threshold must be between 0 and 100",
			},
			{
				name:    "caution must be below 100",
				payload: TeamThresholdPrefsPayload{ErrorGoodThreshold: 100, ErrorCautionThreshold: 100},
				wantErr: "error_good_threshold must be greater than error_caution_threshold",
			},
		}

		for _, tc := range cases {
			tc := tc
			t.Run(tc.name, func(t *testing.T) {
				defer cleanupAll(ctx, t)
				userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")

				b, _ := json.Marshal(tc.payload)
				c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/thresholdPrefs", bytes.NewReader(b))
				c.Set("userId", userID)
				c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
				UpdateTeamThresholdPrefs(c)
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

		cases := []struct {
			payload TeamThresholdPrefsPayload
			wantErr string
		}{
			{
				payload: TeamThresholdPrefsPayload{ErrorGoodThreshold: -1, ErrorCautionThreshold: -2},
				wantErr: "error_good_threshold must be between 0 and 100",
			},
			{
				payload: TeamThresholdPrefsPayload{ErrorGoodThreshold: 99.9, ErrorCautionThreshold: 100},
				wantErr: "error_good_threshold must be greater than error_caution_threshold",
			},
		}

		for _, tc := range cases {
			b, _ := json.Marshal(tc.payload)
			c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/thresholdPrefs", bytes.NewReader(b))
			c.Set("userId", userID)
			c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
			UpdateTeamThresholdPrefs(c)
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
}
