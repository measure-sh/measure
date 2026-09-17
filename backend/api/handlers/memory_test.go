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
			available := uint64(kbPerGB)
			anonRSS := uint64(3 * kbPerGB)
			backgroundAnonRSS := uint64(4 * kbPerGB)
			noSwap := uint64(0)
			row := testinfra.EventRow{
				Type: "memory_usage_absolute", SessionID: sessionID.String(), Timestamp: base,
				OSName: osName, MemoryUsed: 3 * kbPerGB, MemoryMax: 5 * kbPerGB, MemoryAvailable: &available,
			}
			if osName == "android" {
				row.Type = "memory_usage"
				row.MemoryAnonRSS = &anonRSS
				row.MemorySwap = &noSwap
				row.DeviceTotalMemory = 5 * kbPerGB
				row.MemoryAppImportance = "foreground"
			}
			seedEventRows(ctx, t, teamID.String(), appID.String(), 1, row)

			if osName == "android" {
				background := row
				background.SessionID = uuid.NewString()
				background.MemoryAppImportance = "background"
				background.MemoryAnonRSS = &backgroundAnonRSS
				seedEventRows(ctx, t, teamID.String(), appID.String(), 1, background)
			}

			// An omitted or empty Android filter must exclude the background sample,
			// exactly as an explicit foreground filter does, on all four endpoints.
			for _, request := range []struct {
				name   string
				params url.Values
			}{
				{name: "omitted importance"},
				{name: "empty importance", params: url.Values{"app_importance": {""}}},
				{name: "foreground", params: url.Values{"app_importance": {"foreground"}}},
				{name: "session filter", params: url.Values{"filter_expr": {"version_name:not_in:v2 AND os_name:in:" + osName}}},
			} {
				params := url.Values{
					"from":     {base.Add(-time.Minute).Format("2006-01-02T15:04:05.000Z")},
					"to":       {base.Add(time.Minute).Format("2006-01-02T15:04:05.000Z")},
					"timezone": {"UTC"},
				}
				for key, values := range request.params {
					params[key] = values
				}
				for _, endpoint := range []struct {
					path   string
					handle gin.HandlerFunc
				}{
					{"plots/usage", h.GetMemoryUsagePlot},
					{"plots/distribution", h.GetMemoryUsageDistribution},
					{"plots/breakdown", h.GetMemoryUsageBreakdown},
					{"sessions/high-usage", h.GetHighMemoryUsageSessions},
				} {
					t.Run(endpoint.path+"/"+request.name, func(t *testing.T) {
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
							if len(points) != 1 || points[0].SampleCount != 1 || points[0].Version != "v1 (1)" || points[0].P90 == nil || *points[0].P90 != 3*kbPerGB {
								t.Fatalf("unexpected plot: %s", w.Body.String())
							}
						case "plots/breakdown":
							var points []measure.MemoryUsageBreakdownRow
							if err := json.Unmarshal(w.Body.Bytes(), &points); err != nil {
								t.Fatal(err)
							}
							if len(points) != 1 || points[0].SampleCount != 1 || points[0].SessionCount != 1 || points[0].DeviceTotalMemoryTier != "5-6gb" || points[0].P90 == nil || *points[0].P90 != 3*kbPerGB {
								t.Fatalf("unexpected breakdown: %s", w.Body.String())
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
							if len(result.Results) != 1 || result.Results[0].SessionID != sessionID {
								t.Fatalf("unexpected sessions: %s", w.Body.String())
							}
							session := result.Results[0]
							if osName == "android" {
								if session.TargetMemoryKB == nil {
									t.Fatal("missing Android memory target")
								}
								if got := *session.TargetMemoryKB; got != 9*kbPerGB/4 {
									t.Errorf("Android target = %d KiB, want %d", got, 9*kbPerGB/4)
								}
								if session.P90MemoryLimitUtilization != nil {
									t.Errorf("Android process-limit utilization = %v, want omitted", *session.P90MemoryLimitUtilization)
								}
							} else {
								if session.P90MemoryLimitUtilization == nil {
									t.Fatal("missing iOS process-limit utilization")
								}
								if got := *session.P90MemoryLimitUtilization; got != 0.75 {
									t.Errorf("iOS process-limit utilization = %v, want 0.75", got)
								}
								if session.TargetMemoryKB != nil {
									t.Errorf("iOS target_memory_kb = %d, want omitted", *session.TargetMemoryKB)
								}
								if session.PercentOfTarget != nil {
									t.Errorf("iOS percent_of_target = %v, want omitted", *session.PercentOfTarget)
								}
							}
						}
					})
				}
			}
		})
	}
}
