//go:build integration

package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"backend/testinfra"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func TestGetDevices(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
	appID := uuid.New()
	seedApp(ctx, t, appID, teamID, 90)
	base := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	seedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{
		Type: "exception", Severity: "fatal", Timestamp: base, OSName: "android",
		DeviceManufacturer: "Google", DeviceModel: "Pixel 8", DeviceName: "shiba",
	})
	const layout = "2006-01-02T15:04:05.000Z"
	timeRange := "from=" + base.Add(-time.Hour).Format(layout) + "&to=" + base.Add(time.Hour).Format(layout)
	get := func(handle gin.HandlerFunc, path, rawQuery string) (int, []byte) {
		t.Helper()
		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/devices/"+path+"?"+timeRange+rawQuery, nil)
		c.Set("userId", ownerID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}
		handle(c)
		return w.Code, w.Body.Bytes()
	}

	t.Run("lists errors by device", func(t *testing.T) {
		code, body := get(h.GetDevicesErrors, "errors", "&limit=1")
		if code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", code, body)
		}
		var page struct {
			Results []struct {
				DeviceModel string `json:"device_model"`
				CrashCount  int    `json:"crash_count"`
			} `json:"results"`
			Meta struct {
				Next     bool `json:"next"`
				Previous bool `json:"previous"`
			} `json:"meta"`
		}
		if err := json.Unmarshal(body, &page); err != nil {
			t.Fatalf("unmarshal response: %v", err)
		}
		if len(page.Results) != 1 || page.Results[0].DeviceModel != "Pixel 8" || page.Results[0].CrashCount != 1 || page.Meta.Next || page.Meta.Previous {
			t.Errorf("page = %+v, want one Pixel 8 row with 1 crash and no other pages", page)
		}
	})

	t.Run("rejects invalid parameters", func(t *testing.T) {
		for _, tc := range []struct {
			handle   gin.HandlerFunc
			path     string
			rawQuery string
			wantErr  string
		}{
			{h.GetDevicesSessions, "sessions", "&order=sideways", "order"},
			{h.GetDevicesMemory, "memory", "&percentile=p99", "percentile"},
			{h.GetDevicesLaunches, "launches", "&launch_type=lukewarm", "launch_type"},
			{h.GetDevicesSpans, "spans", "", "span_name"},
			{h.GetDevicesSessionsPlot, "plots/sessions", "", "timezone"},
		} {
			code, body := get(tc.handle, tc.path, tc.rawQuery)
			if code != http.StatusBadRequest || !strings.Contains(string(body), tc.wantErr) {
				t.Errorf("%s%s: status = %d, body: %s, want 400 about %s", tc.path, tc.rawQuery, code, body, tc.wantErr)
			}
		}
	})
}
