//go:build integration

package exprfilter

import (
	"context"
	"slices"
	"testing"
	"time"

	"backend/testinfra"

	"github.com/google/uuid"
)

func seedErrorEvents(ctx context.Context, t *testing.T) (teamID, appID, patchID uuid.UUID) {
	t.Helper()

	teamID = uuid.New()
	appID = uuid.New()
	otherAppID := uuid.New()
	patchID = uuid.New()

	th.SeedTeam(ctx, t, teamID.String(), "error values team")
	th.SeedApp(ctx, t, appID.String(), teamID.String(), "error values app", 90)
	th.SeedApp(ctx, t, otherAppID.String(), teamID.String(), "another error app", 90)

	base := time.Now().UTC().Add(-time.Hour).Truncate(time.Millisecond)

	// app_filters_mv only emits a row when all nine attributes are set.
	attributed := func(row testinfra.EventRow) testinfra.EventRow {
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

	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, attributed(testinfra.EventRow{
		Type: "exception", Fingerprint: "values-fatal-fp", Severity: "fatal",
		AppVersion: "1.1.0", AppBuild: "110", UserID: "ana", Timestamp: base,
	}))
	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, attributed(testinfra.EventRow{
		Type: "anr", Fingerprint: "values-anr-fp",
		AppVersion: "1.2.0", AppBuild: "120", UserID: "zoe", Timestamp: base.Add(10 * time.Minute),
		PatchID: patchID, PatchVersion: "1.2.0-patch.3",
	}))
	// A user seen only outside an error keeps its version in the rollup but
	// must not be suggested as an error's user id.
	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, attributed(testinfra.EventRow{
		Type: "test", AppVersion: "1.0.0", AppBuild: "100", UserID: "browsing", Timestamp: base.Add(20 * time.Minute),
	}))
	th.SeedEventRows(ctx, t, teamID.String(), otherAppID.String(), 1, attributed(testinfra.EventRow{
		Type: "exception", Fingerprint: "values-other-fp", Severity: "fatal",
		AppVersion: "9.0.0", AppBuild: "900", UserID: "other", Timestamp: base,
	}))

	return teamID, appID, patchID
}

func TestErrorValues(t *testing.T) {
	ctx := context.Background()
	teamID, appID, patchID := seedErrorEvents(ctx, t)

	byName := IndexKeysByName(ErrorsEntity.Keys)

	list := func(t *testing.T, keyName string, valueRequest ValueRequest) []string {
		t.Helper()
		valueList, err := ErrorsEntity.SuggestKeyValues(ctx, pgPool, chConn, teamID, appID, byName[keyName], valueRequest)
		if err != nil {
			t.Fatalf("fetch values: %v", err)
		}
		texts := make([]string, len(valueList.Values))
		for i, value := range valueList.Values {
			texts[i] = value.Text
		}
		return texts
	}

	t.Run("version names come from the rollup, once each", func(t *testing.T) {
		got := list(t, "version_name", ValueRequest{})
		slices.Sort(got)
		if !slices.Equal(got, []string{"1.0.0", "1.1.0", "1.2.0"}) {
			t.Errorf("want the app's three versions, got %v", got)
		}
	})

	t.Run("device attributes come from the rollup", func(t *testing.T) {
		if got := list(t, "device_name", ValueRequest{}); !slices.Equal(got, []string{"pixel"}) {
			t.Errorf("want [pixel], got %v", got)
		}
		if got := list(t, "country", ValueRequest{}); !slices.Equal(got, []string{"US"}) {
			t.Errorf("want [US], got %v", got)
		}
	})

	t.Run("patch values leave out the errors without a patch", func(t *testing.T) {
		if got := list(t, "patch_id", ValueRequest{}); !slices.Equal(got, []string{patchID.String()}) {
			t.Errorf("want the one patch id, got %v", got)
		}
		if got := list(t, "patch_version", ValueRequest{}); !slices.Equal(got, []string{"1.2.0-patch.3"}) {
			t.Errorf("want the one patch version, got %v", got)
		}
	})

	t.Run("user ids come from the error events, most recent first", func(t *testing.T) {
		if got := list(t, "user_id", ValueRequest{}); !slices.Equal(got, []string{"zoe", "ana"}) {
			t.Errorf("want [zoe ana], got %v", got)
		}
	})

	t.Run("a user id seen only outside an error is not suggested", func(t *testing.T) {
		if got := list(t, "user_id", ValueRequest{Search: "browsing"}); len(got) != 0 {
			t.Errorf("want no user ids, got %v", got)
		}
	})

	t.Run("typing narrows the user ids", func(t *testing.T) {
		if got := list(t, "user_id", ValueRequest{Search: "an"}); !slices.Equal(got, []string{"ana"}) {
			t.Errorf("want [ana], got %v", got)
		}
	})

	t.Run("another app's errors stay out", func(t *testing.T) {
		if got := list(t, "user_id", ValueRequest{}); slices.Contains(got, "other") {
			t.Errorf("want the other app's user id left out, got %v", got)
		}
	})

	t.Run("the error type is the key's own value list, with no table read", func(t *testing.T) {
		valueList, err := ErrorsEntity.SuggestKeyValues(ctx, nil, nil, teamID, appID, byName["error_type"], ValueRequest{})
		if err != nil {
			t.Fatalf("fetch error_type values: %v", err)
		}
		texts := make([]string, len(valueList.Values))
		for i, value := range valueList.Values {
			texts[i] = value.Text
		}
		want := []string{ErrorTypeCrash, ErrorTypeANR, ErrorTypeHandledError, ErrorTypeUnhandledError}
		if !slices.Equal(texts, want) {
			t.Errorf("want %v, got %v", want, texts)
		}
	})
}
