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

func seedSessionEvents(ctx context.Context, t *testing.T) (teamID, appID, patchID uuid.UUID) {
	t.Helper()

	teamID = uuid.New()
	appID = uuid.New()
	otherAppID := uuid.New()
	patchID = uuid.New()

	th.SeedTeam(ctx, t, teamID.String(), "session values team")
	th.SeedApp(ctx, t, appID.String(), teamID.String(), "session values app", 90)
	th.SeedApp(ctx, t, otherAppID.String(), teamID.String(), "another session app", 90)

	base := time.Now().UTC().Add(-time.Hour).Truncate(time.Millisecond)

	// app_filters_mv only emits a row when all nine attributes are set.
	attributed := func(row testinfra.EventRow) testinfra.EventRow {
		row.Type = "test"
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
		AppVersion: "1.1.0", AppBuild: "110", UserID: "ana", Timestamp: base,
	}))
	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, attributed(testinfra.EventRow{
		AppVersion: "1.2.0", AppBuild: "120", UserID: "zoe", Timestamp: base.Add(10 * time.Minute),
		PatchID: patchID, PatchVersion: "1.2.0-patch.3",
	}))
	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{
		Type: "custom", CustomName: "checkout_completed", Timestamp: base.Add(20 * time.Minute),
	})
	th.SeedScreenViewInSession(ctx, t, teamID.String(), appID.String(), uuid.NewString(), "CheckoutScreen", base.Add(30*time.Minute))
	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, attributed(testinfra.EventRow{
		AppVersion: "1.0.0", AppBuild: "100", UserID: "ana-of-old", Timestamp: base.Add(-40 * 24 * time.Hour),
	}))
	th.SeedEventRows(ctx, t, teamID.String(), otherAppID.String(), 1, attributed(testinfra.EventRow{
		AppVersion: "9.0.0", AppBuild: "900", UserID: "other", Timestamp: base,
	}))

	return teamID, appID, patchID
}

func TestSessionValues(t *testing.T) {
	ctx := context.Background()
	teamID, appID, patchID := seedSessionEvents(ctx, t)

	// The reads carry the release mode query settings, so a statement that
	// ClickHouse refuses to cache fails here the same way it fails in production.
	ctx = WithFilterQuerySettings(ctx, true, false, "session_values")

	byName := IndexKeysByName(SessionsEntity.Keys)

	list := func(t *testing.T, keyName string, valueRequest ValueRequest) []string {
		t.Helper()
		valueList, err := SessionsEntity.SuggestKeyValues(ctx, pgPool, chConn, teamID, appID, byName[keyName], valueRequest)
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
		if got := list(t, "version_name", ValueRequest{}); !slices.Equal(got, []string{"1.1.0", "1.2.0", "1.0.0"}) {
			t.Errorf("want [1.1.0 1.2.0 1.0.0], got %v", got)
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

	t.Run("patch values leave out the sessions without a patch", func(t *testing.T) {
		if got := list(t, "patch_id", ValueRequest{}); !slices.Equal(got, []string{patchID.String()}) {
			t.Errorf("want the one patch id, got %v", got)
		}
		if got := list(t, "patch_version", ValueRequest{}); !slices.Equal(got, []string{"1.2.0-patch.3"}) {
			t.Errorf("want the one patch version, got %v", got)
		}
	})

	t.Run("user ids come from the sessions table, most recent first", func(t *testing.T) {
		if got := list(t, "user_id", ValueRequest{}); !slices.Equal(got, []string{"zoe", "ana"}) {
			t.Errorf("want [zoe ana], got %v", got)
		}
	})

	t.Run("a user id last seen more than 30 days ago is not suggested, though its version still is", func(t *testing.T) {
		if got := list(t, "user_id", ValueRequest{Search: "old"}); len(got) != 0 {
			t.Errorf("want no user ids, got %v", got)
		}
		if got := list(t, "version_name", ValueRequest{Search: "1.0.0"}); !slices.Equal(got, []string{"1.0.0"}) {
			t.Errorf("want [1.0.0] from the rollup, got %v", got)
		}
	})

	t.Run("typing narrows the user ids", func(t *testing.T) {
		if got := list(t, "user_id", ValueRequest{Search: "an"}); !slices.Equal(got, []string{"ana"}) {
			t.Errorf("want [ana], got %v", got)
		}
	})

	t.Run("another app's sessions stay out", func(t *testing.T) {
		if got := list(t, "user_id", ValueRequest{}); slices.Contains(got, "other") {
			t.Errorf("want the other app's user id left out, got %v", got)
		}
	})

	t.Run("custom events and screens come from the session arrays", func(t *testing.T) {
		if got := list(t, "session_custom_event", ValueRequest{}); !slices.Equal(got, []string{"checkout_completed"}) {
			t.Errorf("want [checkout_completed], got %v", got)
		}
		if got := list(t, "session_screen", ValueRequest{}); !slices.Equal(got, []string{"CheckoutScreen"}) {
			t.Errorf("want [CheckoutScreen], got %v", got)
		}
		if got := list(t, "session_screen", ValueRequest{Search: "nowhere"}); len(got) != 0 {
			t.Errorf("want no screens matching the search, got %v", got)
		}
	})

	t.Run("logs and error text are typed in, not listed", func(t *testing.T) {
		for _, keyName := range []string{"session_log", "session_error_text"} {
			if _, err := SessionsEntity.SuggestKeyValues(ctx, pgPool, chConn, teamID, appID, byName[keyName], ValueRequest{}); err == nil {
				t.Errorf("want %s values refused", keyName)
			}
		}
	})

	t.Run("event kinds and lifecycle are the keys' own values, with no table read", func(t *testing.T) {
		for _, keyName := range []string{"session_events", "session_foreground_background"} {
			valueList, err := SessionsEntity.SuggestKeyValues(ctx, nil, nil, teamID, appID, byName[keyName], ValueRequest{})
			if err != nil {
				t.Fatalf("fetch %s values: %v", keyName, err)
			}
			texts := make([]string, len(valueList.Values))
			for i, value := range valueList.Values {
				texts[i] = value.Text
			}
			if !slices.Equal(texts, byName[keyName].EnumValues) {
				t.Errorf("want the %s values %v, got %v", keyName, byName[keyName].EnumValues, texts)
			}
		}
	})

	t.Run("session ids are typed in, not listed", func(t *testing.T) {
		if _, err := SessionsEntity.SuggestKeyValues(ctx, pgPool, chConn, teamID, appID, byName["session_id"], ValueRequest{}); err == nil {
			t.Error("want session_id values refused")
		}
	})
}
