//go:build integration

package filter

import (
	"context"
	"testing"
	"time"

	"backend/testinfra"

	"github.com/google/uuid"
)

func seedNetworkEvents(ctx context.Context, t *testing.T) (teamID, appID uuid.UUID, patchID uuid.UUID) {
	t.Helper()

	teamID = uuid.New()
	appID = uuid.New()
	otherAppID := uuid.New()
	patchID = uuid.New()

	th.SeedTeam(ctx, t, teamID.String(), "network values team")
	th.SeedApp(ctx, t, appID.String(), teamID.String(), "network values app", 90)
	th.SeedApp(ctx, t, otherAppID.String(), teamID.String(), "another network app", 90)

	base := time.Now().UTC().Add(-time.Hour).Truncate(time.Millisecond)

	request := func(row testinfra.EventRow) testinfra.EventRow {
		row.Type = "http"
		row.Timestamp = base
		row.HttpURL = "https://api.example.com/v1/users"
		row.HttpMethod = "GET"
		row.HttpStatusCode = 200
		row.HttpStartTime = 1000
		row.HttpEndTime = 1100
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

	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, request(testinfra.EventRow{
		AppVersion: "1.2.0", AppBuild: "120", PatchID: patchID, PatchVersion: "1.2.0-patch.3",
	}))
	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), 1, request(testinfra.EventRow{
		AppVersion: "1.1.0", AppBuild: "110",
	}))
	th.SeedEventRows(ctx, t, teamID.String(), otherAppID.String(), 1, request(testinfra.EventRow{
		AppVersion: "9.0.0", AppBuild: "900",
	}))

	return teamID, appID, patchID
}

func TestNetworkValues(t *testing.T) {
	ctx := context.Background()
	teamID, appID, patchID := seedNetworkEvents(ctx, t)

	byName := IndexKeysByName(NetworkEntity.Keys)

	list := func(t *testing.T, keyName string, valueRequest ValueRequest) []string {
		t.Helper()
		valueList, err := NetworkEntity.SuggestKeyValues(ctx, pgPool, chConn, teamID, appID, byName[keyName], valueRequest)
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
		if got := list(t, "version_name", ValueRequest{}); len(got) != 2 || got[0] != "1.1.0" || got[1] != "1.2.0" {
			t.Errorf("want [1.1.0 1.2.0], got %v", got)
		}
	})

	t.Run("device attributes come from the rollup", func(t *testing.T) {
		if got := list(t, "device_name", ValueRequest{}); len(got) != 1 || got[0] != "pixel" {
			t.Errorf("want [pixel], got %v", got)
		}
		if got := list(t, "country", ValueRequest{}); len(got) != 1 || got[0] != "US" {
			t.Errorf("want [US], got %v", got)
		}
	})

	t.Run("patch values leave out the requests without a patch", func(t *testing.T) {
		if got := list(t, "patch_id", ValueRequest{}); len(got) != 1 || got[0] != patchID.String() {
			t.Errorf("want the one patch id, got %v", got)
		}
		if got := list(t, "patch_version", ValueRequest{}); len(got) != 1 || got[0] != "1.2.0-patch.3" {
			t.Errorf("want the one patch version, got %v", got)
		}
	})

	t.Run("http methods are the key's own values, with no table read", func(t *testing.T) {
		valueList, err := NetworkEntity.SuggestKeyValues(ctx, nil, nil, teamID, appID, byName["http_method"], ValueRequest{})
		if err != nil {
			t.Fatalf("fetch http methods: %v", err)
		}
		if len(valueList.Values) != 5 || valueList.Values[0].Text != "get" {
			t.Errorf("want the five method names, got %v", valueList.Values)
		}
	})

	t.Run("another app's requests stay out", func(t *testing.T) {
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
