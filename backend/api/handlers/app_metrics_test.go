//go:build integration

package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"backend/testinfra"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// appMetricsResp mirrors the parts of the metrics response these tests read.
type appMetricsResp struct {
	Adoption struct {
		AllVersions     uint64  `json:"all_versions"`
		SelectedVersion uint64  `json:"selected_version"`
		Adoption        float64 `json:"adoption"`
	} `json:"adoption"`
	Sizes *struct {
		AverageAppSize  float64 `json:"average_app_size"`
		SelectedAppSize uint64  `json:"selected_app_size"`
		Delta           float64 `json:"delta"`
	} `json:"sizes"`
	CrashFreeSessions struct {
		CrashFreeSessions float64 `json:"crash_free_sessions"`
		UnselectedNoData  bool    `json:"unselected_no_data"`
	} `json:"crash_free_sessions"`
}

func newAppMetricsContext(callerID string, appID uuid.UUID, rawQuery string) (*gin.Context, *httptest.ResponseRecorder) {
	path := "/apps/" + appID.String() + "/metrics"
	if rawQuery != "" {
		path += "?" + rawQuery
	}
	c, w := newTestGinContext("GET", path, nil)
	c.Set("userId", callerID)
	c.Params = gin.Params{{Key: "id", Value: appID.String()}}
	return c, w
}

func TestGetAppMetrics(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
	appID := uuid.New()
	seedApp(ctx, t, appID, teamID, 90)

	// Three sessions on v1 of which one crashed, and one session on v2.
	ts := time.Now().UTC().Add(-time.Hour)
	seedEventRows(ctx, t, teamID.String(), appID.String(), 2, testinfra.EventRow{AppVersion: "v1", AppBuild: "1", Timestamp: ts})
	seedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{Type: "exception", AppVersion: "v1", AppBuild: "1", Severity: "fatal", Timestamp: ts})
	seedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{AppVersion: "v2", AppBuild: "2", Timestamp: ts})

	seedBuildSize(ctx, t, appID, "v1", "1", 1000)
	seedBuildSize(ctx, t, appID, "v2", "2", 3000)

	read := func(t *testing.T, rawQuery string) appMetricsResp {
		t.Helper()
		c, w := newAppMetricsContext(ownerID, appID, rawQuery)
		h.GetAppMetrics(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}

		var body appMetricsResp
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatalf("unmarshal response: %v; body=%s", err, w.Body.String())
		}
		return body
	}

	versionFilter := func(name, code string) string {
		return "filter_expr=" + url.QueryEscape("version_name:in:"+name+" AND version_code:in:"+code)
	}

	t.Run("a single selected version carries its size", func(t *testing.T) {
		body := read(t, versionFilter("v1", "1"))

		if body.Sizes == nil {
			t.Fatal("want a size for a single selected version")
		}
		if body.Sizes.SelectedAppSize != 1000 || body.Sizes.AverageAppSize != 3000 {
			t.Errorf("sizes = %+v, want 1000 against an average of 3000", body.Sizes)
		}
		if body.Adoption.SelectedVersion != 3 || body.Adoption.AllVersions != 4 || body.Adoption.Adoption != 75 {
			t.Errorf("adoption = %+v, want 3 of 4 at 75%%", body.Adoption)
		}
		if want := 66.67; body.CrashFreeSessions.CrashFreeSessions != want {
			t.Errorf("crash free sessions = %v, want %v", body.CrashFreeSessions.CrashFreeSessions, want)
		}
	})

	t.Run("more than one selected version name has no size", func(t *testing.T) {
		body := read(t, "filter_expr="+url.QueryEscape("version_name:in:[v1,v2]"))

		if body.Sizes != nil {
			t.Errorf("sizes = %+v, want none for two selected version names", body.Sizes)
		}
	})

	t.Run("a selected version name alone carries the size of its build", func(t *testing.T) {
		body := read(t, "filter_expr="+url.QueryEscape("version_name:in:v1"))

		if body.Sizes == nil {
			t.Fatal("want a size for a single selected version name")
		}
		if body.Sizes.SelectedAppSize != 1000 || body.Sizes.AverageAppSize != 3000 {
			t.Errorf("sizes = %+v, want 1000 against an average of 3000", body.Sizes)
		}
	})

	t.Run("no filter expression covers the app and leaves nothing unselected", func(t *testing.T) {
		body := read(t, "")

		if body.Sizes != nil {
			t.Errorf("sizes = %+v, want none without a filter expression", body.Sizes)
		}
		if body.Adoption.Adoption != 100 {
			t.Errorf("adoption = %+v, want 100%%", body.Adoption)
		}
		if !body.CrashFreeSessions.UnselectedNoData {
			t.Error("unselected_no_data = false, want true")
		}
	})

	t.Run("a filter expression on a key the entity does not have is refused", func(t *testing.T) {
		c, w := newAppMetricsContext(ownerID, appID, "filter_expr=os_name:in:android")
		h.GetAppMetrics(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}

		var body struct {
			Error  string `json:"error"`
			Issues []struct {
				Message string `json:"message"`
			} `json:"filter_expr_issues"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatalf("unmarshal response: %v", err)
		}
		if body.Error != "invalid_filter_expr" || len(body.Issues) != 1 {
			t.Fatalf("want one filter expression issue, got %s", w.Body.String())
		}
		if !strings.Contains(body.Issues[0].Message, "os_name") {
			t.Errorf("want the unknown key named, got %q", body.Issues[0].Message)
		}
	})
}
