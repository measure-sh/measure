//go:build integration

package measure

import (
	"slices"
	"testing"
	"time"

	"backend/libs/filter"
	"backend/testinfra"

	"github.com/google/uuid"
)

func seedProfile(t *testing.T, f plotFixture, trigger string, timestamp time.Time) {
	t.Helper()
	th.SeedEventRows(f.ctx, t, f.teamIDStr(), f.appIDStr(), 1, testinfra.EventRow{
		Type: "profile", SessionID: uuid.NewString(), Timestamp: timestamp,
		ProfileTrigger: trigger, ProfileFormat: "perfetto_trace",
	})
}

func profileTriggers(t *testing.T, f plotFixture, flt *filter.Filter) []string {
	t.Helper()
	profiles, _, _, err := f.app.GetProfilesWithFilter(f.ctx, deps.RchPool, flt)
	if err != nil {
		t.Fatalf("GetProfilesWithFilter: %v", err)
	}
	triggers := make([]string, len(profiles))
	for i, profile := range profiles {
		triggers[i] = profile.Trigger
	}
	return triggers
}

func TestGetProfilesWithFilter(t *testing.T) {
	f := newPlotFixture(t)
	base := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	from, to := base, base.Add(5*time.Minute)

	seedProfile(t, f, "anr", base.Add(2*time.Minute))
	seedProfile(t, f, "app_fully_drawn", base.Add(time.Minute))
	seedProfile(t, f, "anr", base.Add(-time.Hour))

	t.Run("lists the profiles in range, newest first", func(t *testing.T) {
		got := profileTriggers(t, f, f.profileFilter(from, to))
		if !slices.Equal(got, []string{"anr", "app_fully_drawn"}) {
			t.Fatalf("want [anr app_fully_drawn], got %v", got)
		}
	})

	t.Run("filters by profile trigger", func(t *testing.T) {
		flt := f.profileFilter(from, to)
		exprTree := leaf("profile_trigger", filter.OperatorIn, "anr")
		flt.ExprTree = &exprTree
		got := profileTriggers(t, f, flt)
		if !slices.Equal(got, []string{"anr"}) {
			t.Fatalf("want [anr], got %v", got)
		}
	})

	t.Run("pages through the profiles", func(t *testing.T) {
		flt := f.profileFilter(from, to)
		flt.Limit = 1
		for offset, want := range []string{"anr", "app_fully_drawn"} {
			flt.Offset = offset
			profiles, next, previous, err := f.app.GetProfilesWithFilter(f.ctx, deps.RchPool, flt)
			if err != nil {
				t.Fatal(err)
			}
			if len(profiles) != 1 || profiles[0].Trigger != want || next != (offset == 0) || previous != (offset > 0) {
				t.Fatalf("offset %d: profiles = %v, next/previous = %v/%v", offset, profiles, next, previous)
			}
		}
	})
}
