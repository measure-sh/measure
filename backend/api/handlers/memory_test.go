//go:build integration

package handlers

import (
	"encoding/json"
	"net/http"
	"net/url"
	"testing"
	"time"

	"backend/libs/measure"
	"backend/testinfra"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func TestMemoryHandlers(t *testing.T) {
	ctx := t.Context()
	defer cleanupAll(ctx, t)
	ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
	base := time.Now().UTC().Add(-time.Hour)
	for _, osName := range []string{"android", "ios", "ipados"} {
		t.Run(osName, func(t *testing.T) {
			appID, sessionID := uuid.New(), uuid.New()
			seedApp(ctx, t, appID, teamID, 90)
			if _, err := h.Deps.PgPool.Exec(ctx, "UPDATE apps SET os_names = $1 WHERE id = $2", []string{osName}, appID); err != nil {
				t.Fatal(err)
			}
			const kbPerGB = 1024 * 1024
			row := testinfra.EventRow{
				Type: "memory_usage_absolute", SessionID: sessionID.String(), Timestamp: base,
				OSName: osName, MemoryUsed: 3 * kbPerGB, MemoryMax: 5 * kbPerGB,
			}
			if osName == "android" {
				row.Type = "memory_usage"
				row.MemoryAnonRSS = 3 * kbPerGB
				row.DeviceTotalMemory = 5 * kbPerGB
				row.MemoryAppImportance = "foreground"
			}
			seedEventRows(ctx, t, teamID.String(), appID.String(), 1, row)

			for _, expr := range []string{"", "version_name:not_in:v2 AND os_name:in:" + osName} {
				params := url.Values{
					"from":     {base.Add(-time.Minute).Format("2006-01-02T15:04:05.000Z")},
					"to":       {base.Add(time.Minute).Format("2006-01-02T15:04:05.000Z")},
					"timezone": {"UTC"},
				}
				if expr != "" {
					params.Set("filter_expr", expr)
				}
				for _, endpoint := range []struct {
					path   string
					handle gin.HandlerFunc
				}{
					{"plots/usage", h.GetMemoryUsagePlot},
					{"plots/distribution", h.GetMemoryUsageDistribution},
					{"sessions/high-usage", h.GetHighMemoryUsageSessions},
				} {
					t.Run(endpoint.path+"/"+expr, func(t *testing.T) {
						c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/memory/"+endpoint.path+"?"+params.Encode(), nil)
						c.Set("userId", ownerID)
						c.Params = gin.Params{{Key: "id", Value: appID.String()}}
						endpoint.handle(c)
						if w.Code != http.StatusOK {
							t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
						}
						switch endpoint.path {
						case "plots/usage":
							var points []measure.MemoryUsagePlotPoint
							if err := json.Unmarshal(w.Body.Bytes(), &points); err != nil {
								t.Fatal(err)
							}
							if len(points) != 1 || points[0].SampleCount != 1 || points[0].DeviceTotalMemoryTier != "5-6gb" || points[0].P90 == nil || *points[0].P90 != 3*kbPerGB {
								t.Fatalf("unexpected plot: %s", w.Body.String())
							}
						case "plots/distribution":
							var points []measure.MemoryUsageDistributionPoint
							if err := json.Unmarshal(w.Body.Bytes(), &points); err != nil {
								t.Fatal(err)
							}
							if len(points) != 1 || points[0].SampleCount != 1 || points[0].Percentage != 100 {
								t.Fatalf("unexpected distribution: %s", w.Body.String())
							}
						case "sessions/high-usage":
							var result struct {
								Results []measure.HighMemoryUsageSession `json:"results"`
							}
							if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
								t.Fatal(err)
							}
							if len(result.Results) != 1 || result.Results[0].SessionID != sessionID || result.Results[0].TargetMemoryKB != 9*kbPerGB/4 {
								t.Fatalf("unexpected sessions: %s", w.Body.String())
							}
						}
					})
				}
			}
		})
	}
}
