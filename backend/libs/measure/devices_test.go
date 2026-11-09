//go:build integration

package measure

import (
	"fmt"
	"slices"
	"testing"
	"time"

	"backend/libs/filter"
	"backend/libs/opsys"
	"backend/testinfra"

	"github.com/google/uuid"
)

func (f plotFixture) devicesFilter(t *testing.T, from, to time.Time, filterExpr string) *filter.Filter {
	t.Helper()
	flt := &filter.Filter{
		AppID:      f.appID,
		TeamID:     f.teamID,
		Entity:     filter.DevicesEntity,
		From:       from,
		To:         to,
		FilterExpr: filterExpr,
		Limit:      filter.DefaultPaginationLimit,
		Timezone:   "UTC",
	}
	if err := flt.BuildExprTree(); err != nil {
		t.Fatalf("build %q: %v", filterExpr, err)
	}
	return flt
}

func deviceEventRow(row testinfra.EventRow, manufacturer, model string) testinfra.EventRow {
	row.OSName = "android"
	row.OSVersion = "14"
	row.DeviceManufacturer = manufacturer
	row.DeviceModel = model
	row.DeviceName = "codename " + model
	return row
}

func TestGetDevicesSessions(t *testing.T) {
	f := newPlotFixture(t)
	base := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	seed := func(sessions int, manufacturer, model string) {
		for range sessions {
			// Multiple events in one session count as a single session.
			th.SeedEventRows(f.ctx, t, f.teamID.String(), f.appID.String(), 3,
				deviceEventRow(testinfra.EventRow{SessionID: uuid.NewString(), Timestamp: base}, manufacturer, model))
		}
	}
	seed(3, "Google", "Pixel 8")
	seed(2, "Google", "Pixel 7")
	seed(1, "Samsung", "Galaxy S24")
	seed(2, "Google", "")
	th.SeedEventRows(f.ctx, t, f.teamID.String(), f.appID.String(), 1,
		deviceEventRow(testinfra.EventRow{Timestamp: base.Add(-2 * time.Hour)}, "Samsung", "Galaxy S24"))
	devicesFilter := func(filterExpr string) *filter.Filter {
		return f.devicesFilter(t, base.Add(-time.Hour), base.Add(time.Hour), filterExpr)
	}
	models := func(rows []DeviceSessionsRow) []string {
		var models []string
		for _, row := range rows {
			models = append(models, row.DeviceModel)
		}
		return models
	}

	t.Run("ranks devices by sessions", func(t *testing.T) {
		rows, _, _, err := f.app.GetDevicesSessions(f.ctx, deps.RchPool, devicesFilter(""), DevicesPage{})
		if err != nil {
			t.Fatal(err)
		}
		if got := models(rows); !slices.Equal(got, []string{"Pixel 8", "Pixel 7", "Galaxy S24"}) {
			t.Fatalf("models = %v, want Pixel 8, Pixel 7 and Galaxy S24; exclude an empty model and sessions out of range", got)
		}
		if rows[0].DeviceName != "codename Pixel 8" || rows[0].SessionCount != 3 || rows[0].PercentOfSessions != 50 {
			t.Errorf("first row = %#v, want codename Pixel 8 with 3 sessions and 50%%", rows[0])
		}
	})

	t.Run("filters by device", func(t *testing.T) {
		rows, _, _, err := f.app.GetDevicesSessions(f.ctx, deps.RchPool, devicesFilter("device_manufacturer:in:Samsung"), DevicesPage{})
		if err != nil {
			t.Fatal(err)
		}
		if len(rows) != 1 || rows[0].DeviceModel != "Galaxy S24" || rows[0].PercentOfSessions != 100 {
			t.Errorf("rows = %#v, want only Galaxy S24 at 100%%", rows)
		}
	})

	t.Run("pages in either order", func(t *testing.T) {
		flt := devicesFilter("")
		flt.Limit = 2
		rows, next, previous, err := f.app.GetDevicesSessions(f.ctx, deps.RchPool, flt, DevicesPage{})
		if err != nil {
			t.Fatal(err)
		}
		if got := models(rows); !slices.Equal(got, []string{"Pixel 8", "Pixel 7"}) || !next || previous {
			t.Fatalf("first page = %v next=%v previous=%v, want Pixel 8, Pixel 7 and a next page", got, next, previous)
		}

		flt.Offset = 2
		rows, next, previous, err = f.app.GetDevicesSessions(f.ctx, deps.RchPool, flt, DevicesPage{})
		if err != nil {
			t.Fatal(err)
		}
		if got := models(rows); !slices.Equal(got, []string{"Galaxy S24"}) || next || !previous {
			t.Fatalf("second page = %v next=%v previous=%v, want only Galaxy S24 and a previous page", got, next, previous)
		}
		if rows[0].PercentOfSessions != 100.0/6 {
			t.Errorf("Galaxy S24 share = %v, want its share of every device's sessions", rows[0].PercentOfSessions)
		}

		flt.Offset = 0
		rows, _, _, err = f.app.GetDevicesSessions(f.ctx, deps.RchPool, flt, DevicesPage{Ascending: true})
		if err != nil {
			t.Fatal(err)
		}
		if got := models(rows); !slices.Equal(got, []string{"Galaxy S24", "Pixel 7"}) {
			t.Errorf("ascending page = %v, want Galaxy S24 then Pixel 7", got)
		}
	})

	// This subtest seeds a session and must run last.
	t.Run("reads the cache", func(t *testing.T) {
		flt := devicesFilter("device_model:in:\"Galaxy S24\"")
		sessions := func(page DevicesPage) uint64 {
			t.Helper()
			rows, _, _, err := f.app.GetDevicesSessionsCached(f.ctx, th.VK, deps.RchPool, flt, page)
			if err != nil {
				t.Fatal(err)
			}
			if len(rows) != 1 {
				t.Fatalf("rows = %#v, want Galaxy S24", rows)
			}
			return rows[0].SessionCount
		}
		if got := sessions(DevicesPage{}); got != 1 {
			t.Fatalf("sessions = %d, want 1", got)
		}
		seed(1, "Samsung", "Galaxy S24")
		if got := sessions(DevicesPage{}); got != 1 {
			t.Errorf("sessions = %d, want the cached 1", got)
		}
		if got := sessions(DevicesPage{Ascending: true}); got != 2 {
			t.Errorf("ascending sessions = %d, want 2 from a separate cache entry", got)
		}
	})
}

func TestGetDevicesErrorsCountsEachErrorType(t *testing.T) {
	f := newPlotFixture(t)
	base := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	session := uuid.NewString()
	seed := func(count int, row testinfra.EventRow, model string) {
		row.Timestamp = base
		th.SeedEventRows(f.ctx, t, f.teamID.String(), f.appID.String(), count, deviceEventRow(row, "Google", model))
	}
	seed(2, testinfra.EventRow{Type: "exception", Severity: "fatal", SessionID: session}, "Pixel 8")
	seed(1, testinfra.EventRow{Type: "exception", Handled: false, SessionID: session}, "Pixel 8")
	seed(1, testinfra.EventRow{Type: "exception", Severity: "handled"}, "Pixel 8")
	seed(1, testinfra.EventRow{Type: "exception", Severity: "unhandled"}, "Pixel 8")
	seed(1, testinfra.EventRow{Type: "anr"}, "Pixel 8")
	seed(1, testinfra.EventRow{Type: "app_hang"}, "Pixel 8")
	seed(5, testinfra.EventRow{Type: "test"}, "Pixel 8")
	seed(1, testinfra.EventRow{Type: "exception", Severity: "fatal"}, "Pixel 7")

	rows, _, _, err := f.app.GetDevicesErrors(f.ctx, deps.RchPool, f.devicesFilter(t, base.Add(-time.Hour), base.Add(time.Hour), ""), DevicesPage{})
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 2 || rows[0].DeviceModel != "Pixel 8" || rows[1].DeviceModel != "Pixel 7" {
		t.Fatalf("rows = %#v, want Pixel 8 then Pixel 7", rows)
	}
	got := rows[0]
	if got.CrashCount != 3 || got.NonFatalCount != 2 || got.ANRCount != 1 || got.AppHangCount != 1 || got.ErrorCount != 7 {
		t.Errorf("Pixel 8 counts = %#v, want 3 crashes, 2 non-fatal, 1 ANR, 1 app hang, 7 errors", got)
	}
	if got.SessionCount != 5 {
		t.Errorf("Pixel 8 sessions = %d, want 5", got.SessionCount)
	}
}

func TestGetDevicesLaunchesRanksByP95(t *testing.T) {
	f := newPlotFixture(t)
	base := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	seed := func(model, launchType string, duration uint32) {
		th.SeedEventRows(f.ctx, t, f.teamID.String(), f.appID.String(), 1,
			deviceEventRow(testinfra.EventRow{Type: launchType, Timestamp: base, LaunchDuration: duration}, "Apple", model))
	}
	for _, duration := range []uint32{100, 200, 300} {
		seed("iPhone 15", "cold_launch", duration)
		seed("iPhone 12", "cold_launch", duration*10)
	}
	seed("iPhone 15", "warm_launch", 50)
	seed("iPhone SE", "cold_launch", 0)

	rows, _, _, err := f.app.GetDevicesLaunches(f.ctx, deps.RchPool, f.devicesFilter(t, base.Add(-time.Hour), base.Add(time.Hour), ""), DevicesPage{}, "cold_launch")
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 2 || rows[0].DeviceModel != "iPhone 12" || rows[1].DeviceModel != "iPhone 15" {
		t.Fatalf("rows = %#v, want iPhone 12 then iPhone 15; exclude zero durations", rows)
	}
	if rows[1].Count != 3 || rows[1].P50 == nil || *rows[1].P50 != 200 {
		t.Errorf("iPhone 15 = %#v, want 3 launches with p50 200", rows[1])
	}

	if _, _, _, err := f.app.GetDevicesLaunches(f.ctx, deps.RchPool, f.devicesFilter(t, base.Add(-time.Hour), base.Add(time.Hour), ""), DevicesPage{}, "lukewarm"); err == nil {
		t.Error("want an unknown launch type refused")
	}
}

func TestGetDevicesSpansReadsOneSpanName(t *testing.T) {
	f := newPlotFixture(t)
	base := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	seed := func(count int, spanName, model string, duration time.Duration) {
		th.SeedSpanRows(f.ctx, t, f.teamID.String(), f.appID.String(), count, testinfra.SpanRow{
			SpanName: spanName, StartTime: base, Duration: duration,
			DeviceManufacturer: "Google", DeviceModel: model,
		})
	}
	seed(4, "checkout", "Pixel 8", 100*time.Millisecond)
	seed(4, "checkout", "Pixel 6", 900*time.Millisecond)
	seed(4, "search", "Pixel 8", 5*time.Second)

	flt := f.devicesFilter(t, base.Add(-time.Hour), base.Add(time.Hour), "")
	rows, _, _, err := f.app.GetDevicesSpans(f.ctx, deps.RchPool, flt, DevicesPage{}, "checkout")
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 2 || rows[0].DeviceModel != "Pixel 6" || rows[1].DeviceModel != "Pixel 8" {
		t.Fatalf("rows = %#v, want Pixel 6 then Pixel 8", rows)
	}
	if rows[0].Count != 4 || rows[0].P95 == nil || *rows[0].P95 != 900 {
		t.Errorf("Pixel 6 = %#v, want 4 spans with p95 900", rows[0])
	}

	flt = f.devicesFilter(t, base.Add(-time.Hour), base.Add(time.Hour), "device_model:in:\"Pixel 8\"")
	rows, _, _, err = f.app.GetDevicesSpans(f.ctx, deps.RchPool, flt, DevicesPage{}, "checkout")
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 1 || rows[0].DeviceModel != "Pixel 8" {
		t.Errorf("filtered rows = %#v, want only Pixel 8", rows)
	}
}

func TestGetDevicesMemoryRanksByPercentile(t *testing.T) {
	f := newPlotFixture(t)
	f.app.OSNames = []string{opsys.Android}
	base := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	seed := func(model, importance string, kbs ...uint64) {
		for _, kb := range kbs {
			th.SeedEventRows(f.ctx, t, f.teamID.String(), f.appID.String(), 1, deviceEventRow(testinfra.EventRow{
				Type: "memory_usage", Timestamp: base, MemoryAppImportance: importance,
				MemoryAnonRSS: memoryKB(kb), MemorySwap: memoryKB(0),
			}, "Google", model))
		}
	}
	// The Pixel 8's high sample is from the background. It ranks first at p95
	// only when samples from all app states are included.
	seed("Pixel 8", "foreground", 1000, 1000, 1000)
	seed("Pixel 8", "background", 900000)
	seed("Pixel 6", "foreground", 2000, 2000, 2000, 2000)
	flt := f.devicesFilter(t, base.Add(-time.Hour), base.Add(time.Hour), "")

	for _, tc := range []struct {
		percentile string
		want       string
	}{
		{"", "Pixel 8"},
		{"p95", "Pixel 8"},
		{"p50", "Pixel 6"},
	} {
		rows, _, _, err := f.app.GetDevicesMemory(f.ctx, deps.RchPool, flt, DevicesPage{Percentile: tc.percentile})
		if err != nil {
			t.Fatal(err)
		}
		if len(rows) != 2 || rows[0].DeviceModel != tc.want {
			t.Fatalf("percentile %q: rows = %#v, want %s first", tc.percentile, rows, tc.want)
		}
		for _, row := range rows {
			if row.SampleCount != 4 {
				t.Errorf("%s samples = %d, want 4", row.DeviceModel, row.SampleCount)
			}
		}
	}
}

func TestGetDevicesSessionsPlotDrawsTheMostUsedDevices(t *testing.T) {
	f := newPlotFixture(t)
	day := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	seed := func(sessions int, model string, at time.Time) {
		for range sessions {
			th.SeedEventRows(f.ctx, t, f.teamID.String(), f.appID.String(), 1,
				deviceEventRow(testinfra.EventRow{SessionID: uuid.NewString(), Timestamp: at}, "Google", model))
		}
	}
	for i := range DevicesPlotLimit {
		seed(2, fmt.Sprintf("Pixel %d", i), day)
	}
	seed(1, "Pixel 0", day.Add(24*time.Hour))
	seed(1, "Nexus 5", day)

	flt := f.devicesFilter(t, day.Add(-time.Hour), day.Add(48*time.Hour), "")
	flt.PlotTimeGroup = filter.PlotTimeGroupDays
	points, err := f.app.GetDevicesSessionsPlot(f.ctx, deps.RchPool, flt)
	if err != nil {
		t.Fatal(err)
	}
	if len(points) != DevicesPlotLimit+1 {
		t.Fatalf("points = %#v, want one per device per day and no Nexus 5", points)
	}
	for _, point := range points {
		if point.DeviceModel == "Nexus 5" {
			t.Errorf("plot draws Nexus 5, which has the fewest sessions")
		}
	}
	last := points[len(points)-1]
	if last.DeviceModel != "Pixel 0" || last.DateTime != "2026-01-06" || last.SessionCount != 1 {
		t.Errorf("last point = %#v, want Pixel 0 with 1 session on 2026-01-06", last)
	}
}
