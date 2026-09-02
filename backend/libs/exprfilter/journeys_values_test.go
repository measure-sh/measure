//go:build integration

package exprfilter

import (
	"context"
	"testing"
	"time"

	"backend/testinfra"

	"github.com/google/uuid"
)

// seedJourneyEvents writes fully attributed events, which is what the rollup
// requires to emit a row. Two events ran OTA patches; one of those names a
// patch version.
func seedJourneyEvents(ctx context.Context, t *testing.T) (teamID, appID, otherAppID uuid.UUID, patchOne, patchTwo uuid.UUID) {
	t.Helper()

	teamID = uuid.New()
	appID = uuid.New()
	otherAppID = uuid.New()
	patchOne = uuid.New()
	patchTwo = uuid.New()

	th.SeedTeam(ctx, t, teamID.String(), "journey values team")
	th.SeedApp(ctx, t, appID.String(), teamID.String(), "journey values app", 90)
	th.SeedApp(ctx, t, otherAppID.String(), teamID.String(), "another journey app", 90)

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
		AppVersion: "1.2.0", AppBuild: "120", PatchID: patchOne, PatchVersion: "1.2.0-patch.3",
	}))
	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, fullyAttributed(testinfra.EventRow{
		AppVersion: "1.1.0", AppBuild: "110", PatchID: patchTwo,
	}))
	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, fullyAttributed(testinfra.EventRow{
		AppVersion: "1.2.0", AppBuild: "120",
	}))
	th.SeedEventRows(ctx, t, teamID.String(), otherAppID.String(), 1, fullyAttributed(testinfra.EventRow{
		AppVersion: "9.0.0", AppBuild: "900", PatchID: uuid.New(), PatchVersion: "9.0.0-patch.1",
	}))

	return teamID, appID, otherAppID, patchOne, patchTwo
}

func TestJourneysValues(t *testing.T) {
	ctx := context.Background()
	teamID, appID, _, patchOne, patchTwo := seedJourneyEvents(ctx, t)

	byName := IndexKeysByName(JourneysEntity.Keys)

	list := func(t *testing.T, keyName string, valueRequest ValueRequest) ([]Value, bool) {
		t.Helper()
		valueList, err := JourneysEntity.SuggestKeyValues(ctx, pgPool, chConn, teamID, appID, byName[keyName], valueRequest)
		if err != nil {
			t.Fatalf("fetch values: %v", err)
		}
		return valueList.Values, valueList.Truncated
	}

	texts := func(values []Value) []string {
		out := make([]string, len(values))
		for i, value := range values {
			out[i] = value.Text
		}
		return out
	}

	t.Run("version names come from the rollup, once each", func(t *testing.T) {
		// Both versions appear in the same month, so the alphabetical
		// tiebreak orders them.
		values, truncated := list(t, "version_name", ValueRequest{})
		if truncated {
			t.Error("want the whole list for two version names")
		}
		if got := texts(values); len(got) != 2 || got[0] != "1.1.0" || got[1] != "1.2.0" {
			t.Errorf("want [1.1.0 1.2.0], got %v", got)
		}
	})

	t.Run("version codes are read from the version tuple", func(t *testing.T) {
		values, _ := list(t, "version_code", ValueRequest{})
		if got := texts(values); len(got) != 2 || got[0] != "110" || got[1] != "120" {
			t.Errorf("want [110 120], got %v", got)
		}
	})

	t.Run("patch ids leave out events without a patch", func(t *testing.T) {
		values, _ := list(t, "patch_id", ValueRequest{})
		got := texts(values)
		if len(got) != 2 {
			t.Fatalf("want the two patches, got %v", got)
		}
		want := []string{patchOne.String(), patchTwo.String()}
		if want[0] > want[1] {
			want[0], want[1] = want[1], want[0]
		}
		if got[0] != want[0] || got[1] != want[1] {
			t.Errorf("want %v, got %v", want, got)
		}
		for _, text := range got {
			if text == uuid.Nil.String() {
				t.Error("want the nil patch id of unpatched events left out")
			}
		}
	})

	t.Run("patch versions leave out the patch that named none", func(t *testing.T) {
		values, _ := list(t, "patch_version", ValueRequest{})
		if got := texts(values); len(got) != 1 || got[0] != "1.2.0-patch.3" {
			t.Errorf("want only the named patch version, got %v", got)
		}
	})

	t.Run("another app's events stay out", func(t *testing.T) {
		values, _ := list(t, "version_name", ValueRequest{})
		for _, text := range texts(values) {
			if text == "9.0.0" {
				t.Error("want the other app's version left out")
			}
		}
	})

	t.Run("typing narrows the list", func(t *testing.T) {
		values, _ := list(t, "version_name", ValueRequest{Search: "1.2"})
		if got := texts(values); len(got) != 1 || got[0] != "1.2.0" {
			t.Errorf("want [1.2.0], got %v", got)
		}
	})
}
