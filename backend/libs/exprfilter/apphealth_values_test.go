//go:build integration

package exprfilter

import (
	"context"
	"testing"
	"time"

	"backend/testinfra"

	"github.com/google/uuid"
)

// seedAppHealthEvents writes fully attributed events, which is what the
// rollup requires to emit a row.
func seedAppHealthEvents(ctx context.Context, t *testing.T) (teamID, appID uuid.UUID) {
	t.Helper()

	teamID = uuid.New()
	appID = uuid.New()
	otherAppID := uuid.New()

	th.SeedTeam(ctx, t, teamID.String(), "app health values team")
	th.SeedApp(ctx, t, appID.String(), teamID.String(), "app health values app", 90)
	th.SeedApp(ctx, t, otherAppID.String(), teamID.String(), "another app health app", 90)

	base := time.Now().UTC().Add(-time.Hour).Truncate(time.Millisecond)

	fullyAttributed := func(row testinfra.EventRow) testinfra.EventRow {
		row.Timestamp = base
		row.OSName = "Android"
		row.OSVersion = "14"
		row.CountryCode = "US"
		row.NetworkProvider = "carrier"
		row.NetworkType = "wifi"
		row.NetworkGeneration = "4g"
		row.DeviceLocale = "en-US"
		row.DeviceManufacturer = "TestCo"
		row.DeviceName = "pixel"
		return row
	}

	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, fullyAttributed(testinfra.EventRow{
		AppVersion: "1.2.0", AppBuild: "120",
	}))
	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, fullyAttributed(testinfra.EventRow{
		AppVersion: "1.1.0", AppBuild: "110",
	}))
	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, fullyAttributed(testinfra.EventRow{
		AppVersion: "1.2.0", AppBuild: "120",
	}))
	th.SeedEventRows(ctx, t, teamID.String(), otherAppID.String(), 1, fullyAttributed(testinfra.EventRow{
		AppVersion: "9.0.0", AppBuild: "900",
	}))

	return teamID, appID
}

func TestAppHealthValues(t *testing.T) {
	ctx := context.Background()
	teamID, appID := seedAppHealthEvents(ctx, t)

	byName := IndexKeysByName(AppHealthEntity.Keys)

	list := func(t *testing.T, keyName string, valueRequest ValueRequest) []string {
		t.Helper()
		valueList, err := AppHealthEntity.SuggestKeyValues(ctx, pgPool, chConn, teamID, appID, byName[keyName], valueRequest)
		if err != nil {
			t.Fatalf("fetch values: %v", err)
		}
		out := make([]string, len(valueList.Values))
		for i, value := range valueList.Values {
			out[i] = value.Text
		}
		return out
	}

	t.Run("version names come from the rollup, once each", func(t *testing.T) {
		// Both versions appear in the same month, so the alphabetical
		// tiebreak orders them.
		if got := list(t, "version_name", ValueRequest{}); len(got) != 2 || got[0] != "1.1.0" || got[1] != "1.2.0" {
			t.Errorf("want [1.1.0 1.2.0], got %v", got)
		}
	})

	t.Run("version codes are read from the version tuple", func(t *testing.T) {
		if got := list(t, "version_code", ValueRequest{}); len(got) != 2 || got[0] != "110" || got[1] != "120" {
			t.Errorf("want [110 120], got %v", got)
		}
	})

	t.Run("another app's events stay out", func(t *testing.T) {
		for _, text := range list(t, "version_name", ValueRequest{}) {
			if text == "9.0.0" {
				t.Error("want the other app's version left out")
			}
		}
	})

	t.Run("typing narrows the list", func(t *testing.T) {
		if got := list(t, "version_name", ValueRequest{Search: "1.2"}); len(got) != 1 || got[0] != "1.2.0" {
			t.Errorf("want [1.2.0], got %v", got)
		}
	})
}
