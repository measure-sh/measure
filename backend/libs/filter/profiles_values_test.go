//go:build integration

package filter

import (
	"context"
	"slices"
	"testing"
	"time"

	"backend/testinfra"

	"github.com/google/uuid"
)

func seedProfileEvents(ctx context.Context, t *testing.T) (teamID, appID uuid.UUID) {
	t.Helper()

	teamID = uuid.New()
	appID = uuid.New()
	otherAppID := uuid.New()

	th.SeedTeam(ctx, t, teamID.String(), "profile values team")
	th.SeedApp(ctx, t, appID.String(), teamID.String(), "profile values app", 90)
	th.SeedApp(ctx, t, otherAppID.String(), teamID.String(), "another profile app", 90)

	base := time.Now().UTC().Add(-time.Hour).Truncate(time.Millisecond)

	// app_filters_mv only emits a row when all nine attributes are set.
	attributed := func(row testinfra.EventRow) testinfra.EventRow {
		row.OSName = "Android"
		row.OSVersion = "16"
		row.CountryCode = "US"
		row.NetworkProvider = "carrier"
		row.NetworkType = "wifi"
		row.NetworkGeneration = "4g"
		row.DeviceLocale = "en-US"
		row.DeviceManufacturer = "TestCo"
		row.DeviceName = "pixel"
		return row
	}

	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, attributed(testinfra.EventRow{
		Type: "profile", ProfileTrigger: "app_fully_drawn",
		AppVersion: "1.1.0", AppBuild: "110", UserID: "ana", Timestamp: base,
	}))
	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, attributed(testinfra.EventRow{
		Type: "profile", ProfileTrigger: "anr",
		AppVersion: "1.2.0", AppBuild: "120", UserID: "zoe", Timestamp: base.Add(10 * time.Minute),
	}))
	// A user seen only outside a profile keeps its version in the rollup but
	// must not be suggested as a profile's user id.
	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, attributed(testinfra.EventRow{
		Type: "test", AppVersion: "1.0.0", AppBuild: "100", UserID: "browsing", Timestamp: base.Add(20 * time.Minute),
	}))
	th.SeedEventRows(ctx, t, teamID.String(), otherAppID.String(), 1, attributed(testinfra.EventRow{
		Type: "profile", ProfileTrigger: "other_trigger",
		AppVersion: "9.0.0", AppBuild: "900", UserID: "other", Timestamp: base,
	}))

	return teamID, appID
}

func TestProfileValues(t *testing.T) {
	ctx := context.Background()
	teamID, appID := seedProfileEvents(ctx, t)

	byName := IndexKeysByName(ProfilesEntity.Keys)

	list := func(t *testing.T, keyName string, valueRequest ValueRequest) []string {
		t.Helper()
		valueList, err := ProfilesEntity.SuggestKeyValues(ctx, pgPool, chConn, teamID, appID, byName[keyName], valueRequest)
		if err != nil {
			t.Fatalf("fetch values: %v", err)
		}
		texts := make([]string, len(valueList.Values))
		for i, value := range valueList.Values {
			texts[i] = value.Text
		}
		return texts
	}

	t.Run("profile triggers come from the profile events, most recent first", func(t *testing.T) {
		if got := list(t, "profile_trigger", ValueRequest{}); !slices.Equal(got, []string{"anr", "app_fully_drawn"}) {
			t.Errorf("want [anr app_fully_drawn], got %v", got)
		}
	})

	t.Run("typing narrows the profile triggers", func(t *testing.T) {
		if got := list(t, "profile_trigger", ValueRequest{Search: "drawn"}); !slices.Equal(got, []string{"app_fully_drawn"}) {
			t.Errorf("want [app_fully_drawn], got %v", got)
		}
	})

	t.Run("version names come from the rollup", func(t *testing.T) {
		got := list(t, "version_name", ValueRequest{})
		slices.Sort(got)
		if !slices.Equal(got, []string{"1.0.0", "1.1.0", "1.2.0"}) {
			t.Errorf("want the app's three versions, got %v", got)
		}
	})

	t.Run("user ids come from the profile events, most recent first", func(t *testing.T) {
		if got := list(t, "user_id", ValueRequest{}); !slices.Equal(got, []string{"zoe", "ana"}) {
			t.Errorf("want [zoe ana], got %v", got)
		}
	})

	t.Run("another app's profiles stay out", func(t *testing.T) {
		if got := list(t, "profile_trigger", ValueRequest{}); slices.Contains(got, "other_trigger") {
			t.Errorf("want the other app's trigger left out, got %v", got)
		}
	})
}
