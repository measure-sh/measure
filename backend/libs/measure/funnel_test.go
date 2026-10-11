//go:build integration

package measure

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"testing"
	"time"

	"backend/libs/filter"

	"github.com/google/uuid"
	"github.com/valkey-io/valkey-go"
)

// These dates have no midnight. America/Santiago's clocks went from 00:00 to
// 01:00 on 2026-09-06, America/Havana's on 2026-03-08, and Africa/Monrovia's
// from 00:00 to 00:44:30 on 1972-01-07.
func TestFunnelTrendPeriodsWhereMidnightIsSkipped(t *testing.T) {
	for _, tc := range []struct {
		zone      string
		skipped   string
		wantStart string
	}{
		{"America/Santiago", "2026-09-06", "2026-09-06T01:00:00-03:00"},
		{"America/Havana", "2026-03-08", "2026-03-08T01:00:00-04:00"},
		{"Africa/Monrovia", "1972-01-07", "1972-01-07T00:44:30Z"},
	} {
		t.Run(tc.zone, func(t *testing.T) {
			loc, err := time.LoadLocation(tc.zone)
			if err != nil {
				t.Fatal(err)
			}
			noon, err := time.ParseInLocation(time.DateTime, tc.skipped+" 12:00:00", loc)
			if err != nil {
				t.Fatal(err)
			}

			if got := FunnelTrendDay.start(noon).Format(time.RFC3339); got != tc.wantStart {
				t.Fatalf("start of %s = %s, want %s", tc.skipped, got, tc.wantStart)
			}

			// Each day in the week around the skipped midnight gets its own
			// period, starting at its midnight or, on the skipped date, at
			// the first instant it has.
			first := FunnelTrendDay.add(FunnelTrendDay.start(noon), -3)
			for i := range 7 {
				got := FunnelTrendDay.add(first, i)
				wantDate := time.Date(first.Year(), first.Month(), first.Day()+i, 0, 0, 0, 0, time.UTC).Format(time.DateOnly)
				if wantDate == tc.skipped {
					if got.Format(time.RFC3339) != tc.wantStart {
						t.Fatalf("period %d starts at %s, want %s", i, got.Format(time.RFC3339), tc.wantStart)
					}
					continue
				}
				if got.Format(time.DateOnly) != wantDate || got.Hour() != 0 || got.Minute() != 0 {
					t.Fatalf("period %d starts at %s, want midnight on %s", i, got.Format(time.RFC3339), wantDate)
				}
			}
		})
	}
}

func TestFunnelTrendBoundaries(t *testing.T) {
	now := time.Date(2026, 10, 21, 12, 0, 0, 0, time.UTC)
	for _, tc := range []struct {
		period FunnelTrendPeriod
		first  string
		last   string
	}{
		{FunnelTrendDay, "2026-09-22", "2026-10-22"},
		{FunnelTrendWeek, "2026-08-03", "2026-10-26"},
		{FunnelTrendMonth, "2025-11-01", "2026-11-01"},
	} {
		t.Run(string(tc.period), func(t *testing.T) {
			boundaries := funnelTrendBoundaries(tc.period, now)
			if len(boundaries) != funnelTrendLengths[tc.period]+1 {
				t.Fatalf("boundaries = %d, want %d", len(boundaries), funnelTrendLengths[tc.period]+1)
			}
			first, last := boundaries[0].Format(time.RFC3339), boundaries[len(boundaries)-1].Format(time.RFC3339)
			if first != tc.first+"T00:00:00Z" || last != tc.last+"T00:00:00Z" {
				t.Fatalf("boundaries run from %s to %s, want %s to %s", first, last, tc.first, tc.last)
			}
		})
	}
}

func TestFunnelCadenceWeeks(t *testing.T) {
	kolkata, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		t.Fatal(err)
	}
	newYork, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Fatal(err)
	}
	day := 24 * time.Hour
	for _, tc := range []struct {
		name   string
		now    time.Time
		window time.Duration
		weeks  int
		from   string
		to     string
	}{
		{"ends at the start of the current week", time.Date(2026, 10, 21, 12, 0, 0, 0, time.UTC), time.Hour, 1, "2026-10-12T00:00:00Z", "2026-10-19T00:00:00Z"},
		{"ends a week earlier while last week's window is still open", time.Date(2026, 10, 19, 0, 30, 0, 0, time.UTC), time.Hour, 1, "2026-10-05T00:00:00Z", "2026-10-12T00:00:00Z"},
		{"ends a week earlier until a day window has passed", time.Date(2026, 10, 19, 23, 0, 0, 0, time.UTC), day, 1, "2026-10-05T00:00:00Z", "2026-10-12T00:00:00Z"},
		{"includes last week once a day window has passed", time.Date(2026, 10, 20, 0, 0, 0, 0, time.UTC), day, 1, "2026-10-12T00:00:00Z", "2026-10-19T00:00:00Z"},
		{"ends at the start of last week with a 7 day window", time.Date(2026, 10, 25, 23, 0, 0, 0, time.UTC), 7 * day, 1, "2026-10-05T00:00:00Z", "2026-10-12T00:00:00Z"},
		{"counts back the requested weeks", time.Date(2026, 10, 21, 12, 0, 0, 0, time.UTC), time.Hour, 4, "2026-09-21T00:00:00Z", "2026-10-19T00:00:00Z"},
		{"starts weeks in the time zone", time.Date(2026, 10, 19, 3, 0, 0, 0, kolkata), time.Hour, 1, "2026-10-12T00:00:00+05:30", "2026-10-19T00:00:00+05:30"},
		{"starts each week at midnight across a daylight saving change", time.Date(2026, 11, 4, 12, 0, 0, 0, newYork), time.Hour, 2, "2026-10-19T00:00:00-04:00", "2026-11-02T00:00:00-05:00"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			from, to := FunnelCadenceWeeks(tc.now, tc.window, tc.weeks)
			if from.Format(time.RFC3339) != tc.from || to.Format(time.RFC3339) != tc.to {
				t.Fatalf("weeks = %s to %s, want %s to %s", from.Format(time.RFC3339), to.Format(time.RFC3339), tc.from, tc.to)
			}
		})
	}
}

func cacheTestFunnel() Funnel {
	return Funnel{
		ID:                      uuid.New(),
		Name:                    "Checkout",
		Steps:                   []FunnelStep{{EventName: "app_open"}, {EventName: "add_to_cart"}},
		ConversionWindowSeconds: 3600,
	}
}

func cacheTestFilter() *filter.Filter {
	return &filter.Filter{
		AppID:      uuid.MustParse("6f1a3c9e-8a43-4c1e-9a55-1f3f0d2b7c10"),
		From:       time.Date(2026, 10, 12, 10, 3, 0, 0, time.UTC),
		To:         time.Date(2026, 10, 19, 10, 3, 0, 0, time.UTC),
		Timezone:   "Asia/Kolkata",
		FilterExpr: `os_name == "android"`,
		Limit:      10,
	}
}

func TestAlignFunnelRange(t *testing.T) {
	day := func(hour, min, sec, ms int) time.Time {
		return time.Date(2026, 10, 19, hour, min, sec, ms*int(time.Millisecond), time.UTC)
	}
	align := func(from, to time.Time) *filter.Filter {
		flt := cacheTestFilter()
		flt.From, flt.To = from, to
		return alignFunnelRange(flt)
	}
	expectRange := func(t *testing.T, flt *filter.Filter, from, to time.Time) {
		t.Helper()
		if !flt.From.Equal(from) || !flt.To.Equal(to) {
			t.Fatalf("range = %s to %s, want %s to %s", flt.From, flt.To, from, to)
		}
	}

	t.Run("rounds a range of a day or more down to ten minutes", func(t *testing.T) {
		expectRange(t, align(day(10, 9, 59, 999).AddDate(0, 0, -7), day(10, 9, 59, 999)),
			day(10, 0, 0, 0).AddDate(0, 0, -7), day(10, 0, 0, 0))
		expectRange(t, align(day(10, 5, 30, 0).Add(-24*time.Hour), day(10, 5, 30, 0)),
			day(10, 0, 0, 0).Add(-24*time.Hour), day(10, 0, 0, 0))
	})

	t.Run("keeps bounds on a whole minute as sent", func(t *testing.T) {
		expectRange(t, align(day(0, 0, 0, 0).AddDate(0, 0, -6), day(14, 37, 0, 0)), day(0, 0, 0, 0).AddDate(0, 0, -6), day(14, 37, 0, 0))
		kathmandu, err := time.LoadLocation("Asia/Kathmandu")
		if err != nil {
			t.Fatal(err)
		}
		midnight := time.Date(2026, 10, 19, 0, 0, 0, 0, kathmandu)
		expectRange(t, align(midnight, midnight.AddDate(0, 0, 1)), midnight, midnight.AddDate(0, 0, 1))
	})

	t.Run("rounds only the bound taken from the clock", func(t *testing.T) {
		start := day(18, 15, 0, 0).AddDate(0, 0, -2)
		expectRange(t, align(start, day(10, 7, 42, 123)), start, day(10, 0, 0, 0))
	})

	t.Run("rounds a range shorter than a day down to minutes", func(t *testing.T) {
		expectRange(t, align(day(9, 45, 30, 0), day(10, 0, 30, 0)), day(9, 45, 0, 0), day(10, 0, 0, 0))
		expectRange(t, align(day(10, 5, 0, 0).Add(-24*time.Hour+time.Second), day(10, 5, 0, 0)),
			day(10, 5, 0, 0).Add(-24*time.Hour), day(10, 5, 0, 0))
	})

	t.Run("keeps a range already on its boundaries", func(t *testing.T) {
		expectRange(t, align(day(0, 0, 0, 0).AddDate(0, 0, -1), day(0, 0, 0, 0)), day(0, 0, 0, 0).AddDate(0, 0, -1), day(0, 0, 0, 0))
		expectRange(t, align(day(10, 2, 0, 0), day(10, 9, 0, 0)), day(10, 2, 0, 0), day(10, 9, 0, 0))
	})

	t.Run("relative ranges asked for within the same step run the same range", func(t *testing.T) {
		first := align(day(10, 0, 0, 0).AddDate(0, 0, -7), day(10, 0, 0, 0))
		last := align(day(10, 9, 59, 999).AddDate(0, 0, -7), day(10, 9, 59, 999))
		expectRange(t, last, first.From, first.To)
		first = align(day(9, 45, 0, 0), day(10, 0, 0, 0))
		last = align(day(9, 45, 59, 999), day(10, 0, 59, 999))
		expectRange(t, last, first.From, first.To)
	})

	t.Run("a relative range asked for in the next step runs a new range", func(t *testing.T) {
		expectRange(t, align(day(10, 10, 0, 0).AddDate(0, 0, -7), day(10, 10, 0, 0)), day(10, 10, 0, 0).AddDate(0, 0, -7), day(10, 10, 0, 0))
		expectRange(t, align(day(9, 46, 0, 0), day(10, 1, 0, 0)), day(9, 46, 0, 0), day(10, 1, 0, 0))
	})

	t.Run("rounds by UTC instant whatever the time's location", func(t *testing.T) {
		kolkata, err := time.LoadLocation("Asia/Kolkata")
		if err != nil {
			t.Fatal(err)
		}
		utc := align(day(10, 3, 30, 0).AddDate(0, 0, -7), day(10, 3, 30, 0))
		local := align(day(10, 3, 30, 0).AddDate(0, 0, -7).In(kolkata), day(10, 3, 30, 0).In(kolkata))
		expectRange(t, local, utc.From, utc.To)
	})

	t.Run("keeps a range that rounding would empty", func(t *testing.T) {
		expectRange(t, align(day(10, 0, 10, 0), day(10, 0, 40, 0)), day(10, 0, 10, 0), day(10, 0, 40, 0))
	})

	t.Run("leaves the filter it was given unchanged", func(t *testing.T) {
		flt := cacheTestFilter()
		from, to := flt.From.Add(time.Second), flt.To.Add(time.Second)
		flt.From, flt.To = from, to
		alignFunnelRange(flt)
		expectRange(t, flt, from, to)
	})
}

func TestFunnelTrendCacheKey(t *testing.T) {
	funnel := cacheTestFunnel()
	kolkata, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		t.Fatal(err)
	}
	at := func(period FunnelTrendPeriod, now time.Time) funnelCacheKey {
		return newFunnelTrendCacheKey(funnel, cacheTestFilter(), period, false, now, kolkata)
	}
	local := func(year int, month time.Month, day, hour, min int) time.Time {
		return time.Date(year, month, day, hour, min, 0, 0, kolkata)
	}

	t.Run("requests within one period share a key once its window has passed", func(t *testing.T) {
		if first, last := at(FunnelTrendDay, local(2026, 10, 19, 1, 0)), at(FunnelTrendDay, local(2026, 10, 19, 23, 59)); !reflect.DeepEqual(first, last) {
			t.Fatalf("keys differ: %+v and %+v", first, last)
		}
	})

	t.Run("a new period in the filter's timezone gets a new key", func(t *testing.T) {
		cases := map[FunnelTrendPeriod][2]time.Time{
			FunnelTrendDay:   {local(2026, 10, 19, 23, 59), local(2026, 10, 20, 0, 0)},
			FunnelTrendWeek:  {local(2026, 10, 18, 23, 59), local(2026, 10, 19, 0, 0)},
			FunnelTrendMonth: {local(2026, 10, 31, 23, 59), local(2026, 11, 1, 0, 0)},
		}
		for period, times := range cases {
			if reflect.DeepEqual(at(period, times[0]), at(period, times[1])) {
				t.Errorf("%s: keys are equal across the start of a period", period)
			}
		}
	})

	t.Run("the end of the conversion window after a period gets a new key", func(t *testing.T) {
		// The funnel's window is one hour, so the day before becomes
		// complete at 01:00.
		if reflect.DeepEqual(at(FunnelTrendDay, local(2026, 10, 20, 0, 59)), at(FunnelTrendDay, local(2026, 10, 20, 1, 0))) {
			t.Fatal("keys are equal across the end of the conversion window")
		}
	})

	t.Run("uses the filter's timezone for period starts", func(t *testing.T) {
		utc := func(day, hour, min int) time.Time {
			return time.Date(2026, 10, day, hour, min, 0, 0, time.UTC)
		}
		// 18:00 and 19:00 UTC on the 19th are 23:30 on the 19th and 00:30 on
		// the 20th in Kolkata.
		if reflect.DeepEqual(at(FunnelTrendDay, utc(19, 18, 0)), at(FunnelTrendDay, utc(19, 19, 0))) {
			t.Error("keys are equal for different days in the filter's timezone")
		}
		// 23:00 UTC on the 19th and 01:00 UTC on the 20th are 04:30 and 06:30
		// on the 20th in Kolkata.
		if first, last := at(FunnelTrendDay, utc(19, 23, 0)), at(FunnelTrendDay, utc(20, 1, 0)); !reflect.DeepEqual(first, last) {
			t.Errorf("keys differ for the same day in the filter's timezone: %+v and %+v", first, last)
		}
	})
}

func TestFunnelCadenceCacheKey(t *testing.T) {
	funnel := cacheTestFunnel()
	at := func(now time.Time) funnelCacheKey {
		return newFunnelCadenceCacheKey(funnel, cacheTestFilter(), 4, now, time.UTC)
	}

	t.Run("requests within one week share a key", func(t *testing.T) {
		if first, last := at(time.Date(2026, 10, 19, 1, 0, 0, 0, time.UTC)), at(time.Date(2026, 10, 25, 23, 59, 0, 0, time.UTC)); !reflect.DeepEqual(first, last) {
			t.Fatalf("keys differ: %+v and %+v", first, last)
		}
	})

	t.Run("another week finishing its conversion window gets a new key", func(t *testing.T) {
		// The funnel's window is one hour, so the week up to Monday the 19th
		// is counted from 01:00 that day.
		if reflect.DeepEqual(at(time.Date(2026, 10, 19, 0, 59, 0, 0, time.UTC)), at(time.Date(2026, 10, 19, 1, 0, 0, 0, time.UTC))) {
			t.Fatal("keys are equal across the end of a week's conversion window")
		}
	})
}

func TestFunnelCacheKey(t *testing.T) {
	base := func() (Funnel, *filter.Filter) { return cacheTestFunnel(), cacheTestFilter() }
	baseKey := func() funnelCacheKey {
		funnel, flt := base()
		return newFunnelPageCacheKey("errors", funnel, flt, FunnelStepRange{From: 0, To: 1})
	}

	t.Run("each input the result depends on changes the key", func(t *testing.T) {
		changes := map[string]func(funnel *Funnel, flt *filter.Filter, query *string, params *[]any){
			"query": func(_ *Funnel, _ *filter.Filter, query *string, _ *[]any) { *query = "traces" },
			"app":   func(_ *Funnel, flt *filter.Filter, _ *string, _ *[]any) { flt.AppID = uuid.New() },
			"team":  func(_ *Funnel, flt *filter.Filter, _ *string, _ *[]any) { flt.TeamID = uuid.New() },
			"steps": func(funnel *Funnel, _ *filter.Filter, _ *string, _ *[]any) {
				funnel.Steps = append(funnel.Steps, FunnelStep{EventName: "purchase"})
			},
			"step order": func(funnel *Funnel, _ *filter.Filter, _ *string, _ *[]any) {
				funnel.Steps = []FunnelStep{funnel.Steps[1], funnel.Steps[0]}
			},
			"conversion window": func(funnel *Funnel, _ *filter.Filter, _ *string, _ *[]any) { funnel.ConversionWindowSeconds = 7200 },
			"start":             func(_ *Funnel, flt *filter.Filter, _ *string, _ *[]any) { flt.From = flt.From.Add(-time.Hour) },
			"end":               func(_ *Funnel, flt *filter.Filter, _ *string, _ *[]any) { flt.To = flt.To.Add(time.Hour) },
			"filter":            func(_ *Funnel, flt *filter.Filter, _ *string, _ *[]any) { flt.FilterExpr = `os_name == "ios"` },
			"limit":             func(_ *Funnel, flt *filter.Filter, _ *string, _ *[]any) { flt.Limit = 20 },
			"offset":            func(_ *Funnel, flt *filter.Filter, _ *string, _ *[]any) { flt.Offset = 10 },
			"step range": func(_ *Funnel, _ *filter.Filter, _ *string, params *[]any) {
				*params = []any{FunnelStepRange{From: 1, To: 2}}
			},
		}
		for name, change := range changes {
			t.Run(name, func(t *testing.T) {
				funnel, flt := base()
				query, params := "errors", []any{FunnelStepRange{From: 0, To: 1}}
				change(&funnel, flt, &query, &params)
				if funnelCacheKey := newFunnelPageCacheKey(query, funnel, flt, params...); reflect.DeepEqual(funnelCacheKey, baseKey()) {
					t.Fatalf("key did not change: %+v", funnelCacheKey)
				}
			})
		}
	})

	t.Run("funnels with the same steps and window share a key", func(t *testing.T) {
		funnel, flt := base()
		funnel.ID = uuid.New()
		funnel.Name = "Another checkout"
		funnel.Pinned = true
		funnel.UpdatedAt = time.Now()
		if funnelCacheKey := newFunnelPageCacheKey("errors", funnel, flt, FunnelStepRange{From: 0, To: 1}); !reflect.DeepEqual(funnelCacheKey, baseKey()) {
			t.Fatalf("keys differ: %+v and %+v", funnelCacheKey, baseKey())
		}
	})

	t.Run("queries over a date range share a key across timezones", func(t *testing.T) {
		funnel, flt := base()
		flt.Timezone = "UTC"
		if funnelCacheKey := newFunnelPageCacheKey("errors", funnel, flt, FunnelStepRange{From: 0, To: 1}); !reflect.DeepEqual(funnelCacheKey, baseKey()) {
			t.Fatalf("keys differ: %+v and %+v", funnelCacheKey, baseKey())
		}
	})

	t.Run("queries that do not paginate share a key across pages", func(t *testing.T) {
		funnel, flt := base()
		funnelCacheKey := newFunnelRangeCacheKey("conversion", funnel, flt)
		flt.Limit, flt.Offset = 20, 10
		if other := newFunnelRangeCacheKey("conversion", funnel, flt); !reflect.DeepEqual(funnelCacheKey, other) {
			t.Fatalf("keys differ: %+v and %+v", funnelCacheKey, other)
		}
	})

	t.Run("queries that cover their own periods leave out the date range", func(t *testing.T) {
		funnel, flt := base()
		funnelCacheKey := newFunnelCacheKey("trend", funnel, flt, FunnelTrendDay, false)
		flt.From, flt.To = flt.From.Add(-time.Hour), flt.To.Add(time.Hour)
		if other := newFunnelCacheKey("trend", funnel, flt, FunnelTrendDay, false); !reflect.DeepEqual(funnelCacheKey, other) {
			t.Fatalf("keys differ: %+v and %+v", funnelCacheKey, other)
		}
	})
}

func TestFunnelTrendCacheTTLs(t *testing.T) {
	for period := range funnelTrendLengths {
		if funnelTrendCacheTTLs[period] < time.Second {
			t.Errorf("period %s has no cache ttl", period)
		}
	}
}

func TestCachedFunnelResult(t *testing.T) {
	ctx := context.Background()
	funnelCacheKey := newFunnelRangeCacheKey("conversion", cacheTestFunnel(), cacheTestFilter())

	counting := func(result []FunnelStepConversion) (func() ([]FunnelStepConversion, error), *int) {
		runs := 0
		return func() ([]FunnelStepConversion, error) {
			runs++
			return result, nil
		}, &runs
	}
	median := 90.0
	steps := []FunnelStepConversion{
		{EventName: "app_open", FunnelStepUsers: FunnelStepUsers{Users: 5}},
		{EventName: "add_to_cart", FunnelStepUsers: FunnelStepUsers{Users: 2, MedianSecondsFromPrevious: &median}},
	}

	t.Run("runs the query on a miss and returns the cached result after", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		query, runs := counting(steps)

		for range 2 {
			got, err := cachedFunnelResult(ctx, th.VK, funnelCacheKey, time.Minute, query)
			if err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(got, steps) {
				t.Fatalf("result = %+v, want %+v", got, steps)
			}
		}
		if *runs != 1 {
			t.Fatalf("query ran %d times, want 1", *runs)
		}
	})

	t.Run("stores the result for the ttl", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		query, _ := counting(steps)
		if _, err := cachedFunnelResult(ctx, th.VK, funnelCacheKey, 10*time.Minute, query); err != nil {
			t.Fatal(err)
		}

		keys, err := th.VK.Do(ctx, th.VK.B().Keys().Pattern(fmt.Sprintf("funnel:v%d:*", funnelCacheVersion)).Build()).AsStrSlice()
		if err != nil || len(keys) != 1 {
			t.Fatalf("funnel keys = %v (%v), want 1", keys, err)
		}
		ttl, err := th.VK.Do(ctx, th.VK.B().Ttl().Key(keys[0]).Build()).AsInt64()
		if err != nil {
			t.Fatal(err)
		}
		if ttl <= 590 || ttl > 600 {
			t.Fatalf("ttl = %ds, want about 600s", ttl)
		}
	})

	t.Run("different keys do not share results", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		query, runs := counting(steps)
		otherFlt := cacheTestFilter()
		otherFlt.AppID = uuid.New()
		otherFunnelCacheKey := newFunnelRangeCacheKey("conversion", cacheTestFunnel(), otherFlt)

		if _, err := cachedFunnelResult(ctx, th.VK, funnelCacheKey, time.Minute, query); err != nil {
			t.Fatal(err)
		}
		if _, err := cachedFunnelResult(ctx, th.VK, otherFunnelCacheKey, time.Minute, query); err != nil {
			t.Fatal(err)
		}
		if *runs != 2 {
			t.Fatalf("query ran %d times, want 2", *runs)
		}
	})

	t.Run("a failed query is not cached", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		errQuery := errors.New("clickhouse is down")
		runs := 0
		failing := func() ([]FunnelStepConversion, error) {
			runs++
			return nil, errQuery
		}

		for range 2 {
			if _, err := cachedFunnelResult(ctx, th.VK, funnelCacheKey, time.Minute, failing); !errors.Is(err, errQuery) {
				t.Fatalf("err = %v, want %v", err, errQuery)
			}
		}
		if runs != 2 {
			t.Fatalf("query ran %d times, want 2", runs)
		}
		query, okRuns := counting(steps)
		if _, err := cachedFunnelResult(ctx, th.VK, funnelCacheKey, time.Minute, query); err != nil || *okRuns != 1 {
			t.Fatalf("query after a failure ran %d times (%v), want 1", *okRuns, err)
		}
	})

	t.Run("runs the query every time without a valkey client", func(t *testing.T) {
		query, runs := counting(steps)
		for range 2 {
			if _, err := cachedFunnelResult(ctx, nil, funnelCacheKey, time.Minute, query); err != nil {
				t.Fatal(err)
			}
		}
		if *runs != 2 {
			t.Fatalf("query ran %d times, want 2", *runs)
		}
	})

	t.Run("runs the query every time when valkey cannot be reached", func(t *testing.T) {
		var addresses []string
		for address := range th.VK.Nodes() {
			addresses = append(addresses, address)
		}
		closedVK, err := valkey.NewClient(valkey.ClientOption{InitAddress: addresses})
		if err != nil {
			t.Fatal(err)
		}
		closedVK.Close()

		query, runs := counting(steps)
		for range 2 {
			got, err := cachedFunnelResult(ctx, closedVK, funnelCacheKey, time.Minute, query)
			if err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(got, steps) {
				t.Fatalf("result = %+v, want %+v", got, steps)
			}
		}
		if *runs != 2 {
			t.Fatalf("query ran %d times, want 2", *runs)
		}
	})

	t.Run("replaces an entry that cannot be decoded", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		query, runs := counting(steps)
		if _, err := cachedFunnelResult(ctx, th.VK, funnelCacheKey, time.Minute, query); err != nil {
			t.Fatal(err)
		}
		keys, err := th.VK.Do(ctx, th.VK.B().Keys().Pattern("funnel:*").Build()).AsStrSlice()
		if err != nil || len(keys) != 1 {
			t.Fatalf("funnel keys = %v (%v), want 1", keys, err)
		}
		if err := th.VK.Do(ctx, th.VK.B().Set().Key(keys[0]).Value("{not json").Build()).Error(); err != nil {
			t.Fatal(err)
		}

		for range 2 {
			got, err := cachedFunnelResult(ctx, th.VK, funnelCacheKey, time.Minute, query)
			if err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(got, steps) {
				t.Fatalf("result = %+v, want %+v", got, steps)
			}
		}
		if *runs != 2 {
			t.Fatalf("query ran %d times, want 2", *runs)
		}
	})

	t.Run("a cached page keeps its results and whether there are pages before and after", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		wantFunnelPage := funnelPage[FunnelStepError]{
			Results:  []FunnelStepError{{ID: "abc", Type: "exception", Count: 3, Users: 2, Dropped: 1, Converted: 1}},
			Next:     true,
			Previous: true,
		}
		runs := 0
		query := func() (funnelPage[FunnelStepError], error) {
			runs++
			return wantFunnelPage, nil
		}

		for range 2 {
			got, err := cachedFunnelResult(ctx, th.VK, funnelCacheKey, time.Minute, query)
			if err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(got, wantFunnelPage) {
				t.Fatalf("page = %+v, want %+v", got, wantFunnelPage)
			}
		}
		if runs != 1 {
			t.Fatalf("query ran %d times, want 1", runs)
		}
	})
}
