//go:build integration

package exprfilter

import (
	"context"
	"testing"
	"time"

	"backend/testinfra"

	"github.com/google/uuid"
)

func seedBugReports(ctx context.Context, t *testing.T) (teamID, appID, otherAppID uuid.UUID) {
	t.Helper()

	teamID = uuid.New()
	appID = uuid.New()
	otherAppID = uuid.New()

	th.SeedTeam(ctx, t, teamID.String(), "bug report values team")
	th.SeedApp(ctx, t, appID.String(), teamID.String(), "bug report values app", 90)
	th.SeedApp(ctx, t, otherAppID.String(), teamID.String(), "another bug report app", 90)

	base := time.Now().UTC().Add(-time.Hour).Truncate(time.Millisecond)

	th.SeedBugReportRow(ctx, t, teamID.String(), appID.String(), testinfra.BugReportRow{
		Timestamp:          base,
		Status:             0,
		Description:        "checkout button does nothing",
		UserID:             "alice",
		DeviceName:         "pixel 4a",
		DeviceManufacturer: "Google",
	})
	th.SeedBugReportRow(ctx, t, teamID.String(), appID.String(), testinfra.BugReportRow{
		Timestamp:          base.Add(10 * time.Minute),
		Status:             1,
		Description:        "app freezes on login",
		UserID:             "bob",
		DeviceName:         "iPhone 15",
		DeviceManufacturer: "Apple",
		OSName:             "iOS",
		OSVersion:          "17.4",
	})
	th.SeedBugReportRow(ctx, t, teamID.String(), appID.String(), testinfra.BugReportRow{
		Timestamp:   base.Add(20 * time.Minute),
		Description: "default attributes",
	})

	// Another app's report, which must stay out of this app's lists.
	th.SeedBugReportRow(ctx, t, teamID.String(), otherAppID.String(), testinfra.BugReportRow{
		Timestamp:   base,
		Description: "other app report",
		DeviceName:  "galaxy s24",
		UserID:      "mallory",
	})

	return teamID, appID, otherAppID
}

func TestBugReportsValues(t *testing.T) {
	ctx := context.Background()
	teamID, appID, otherAppID := seedBugReports(ctx, t)

	byName := IndexKeysByName(BugReportsEntity.Keys)

	list := func(t *testing.T, keyName string, valueRequest ValueRequest) ([]Value, bool) {
		t.Helper()
		valueList, err := BugReportsEntity.SuggestKeyValues(ctx, pgPool, chConn, teamID, appID, byName[keyName], valueRequest)
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

	t.Run("device names come back most recently seen first", func(t *testing.T) {
		values, truncated := list(t, "device_name", ValueRequest{})
		if truncated {
			t.Error("want the whole list for three device names")
		}
		got := texts(values)
		if len(got) != 3 || got[0] != "Pixel" || got[1] != "iPhone 15" || got[2] != "pixel 4a" {
			t.Errorf("want [Pixel, iPhone 15, pixel 4a], got %v", got)
		}
	})

	t.Run("user ids are suggested", func(t *testing.T) {
		values, _ := list(t, "user_id", ValueRequest{})
		got := texts(values)
		if len(got) != 3 || got[0] != "u1" || got[1] != "bob" || got[2] != "alice" {
			t.Errorf("want [u1 bob alice], got %v", got)
		}
	})

	t.Run("os names are read from the version tuple", func(t *testing.T) {
		values, _ := list(t, "os_name", ValueRequest{})
		if got := texts(values); len(got) != 2 {
			t.Errorf("want [Android iOS] in some order, got %v", got)
		}
	})

	t.Run("another app's reports stay out", func(t *testing.T) {
		values, _ := list(t, "device_name", ValueRequest{})
		for _, value := range texts(values) {
			if value == "galaxy s24" {
				t.Error("want another app's device out of this app's list")
			}
		}

		otherApp, err := BugReportsEntity.SuggestKeyValues(ctx, pgPool, chConn, teamID, otherAppID, byName["device_name"], ValueRequest{})
		if err != nil {
			t.Fatalf("fetch values: %v", err)
		}
		if got := texts(otherApp.Values); len(got) != 1 || got[0] != "galaxy s24" {
			t.Errorf("want the other app to see only its own device, got %v", got)
		}
	})

	t.Run("typing narrows the list without regard to case", func(t *testing.T) {
		values, _ := list(t, "device_name", ValueRequest{Search: "PHONE"})
		if got := texts(values); len(got) != 1 || got[0] != "iPhone 15" {
			t.Errorf("want only iPhone 15, got %v", got)
		}
	})

	t.Run("a percent sign is matched as literal text", func(t *testing.T) {
		values, _ := list(t, "device_name", ValueRequest{Search: "%"})
		if len(values) != 0 {
			t.Errorf("want a literal percent sign to match nothing, got %v", texts(values))
		}
	})

	t.Run("a limit reports that more matched", func(t *testing.T) {
		values, truncated := list(t, "device_name", ValueRequest{Limit: 1})
		if len(values) != 1 {
			t.Errorf("want one value, got %v", texts(values))
		}
		if !truncated {
			t.Error("want the picker told the list is partial")
		}
	})

	t.Run("statuses are the fixed set", func(t *testing.T) {
		values, truncated := list(t, "bug_report_status", ValueRequest{})
		if truncated {
			t.Error("want a fixed list reported whole")
		}
		if got := texts(values); len(got) != 2 || got[0] != "open" || got[1] != "closed" {
			t.Errorf("want [open closed], got %v", got)
		}

		narrowed, _ := list(t, "bug_report_status", ValueRequest{Search: "clo"})
		if got := texts(narrowed); len(got) != 1 || got[0] != "closed" {
			t.Errorf("want closed, got %v", got)
		}
	})

	t.Run("the description takes typed-in values only", func(t *testing.T) {
		if _, err := BugReportsEntity.SuggestKeyValues(ctx, pgPool, chConn, teamID, appID, byName["bug_report_description"], ValueRequest{}); err == nil {
			t.Error("want the description's value list refused")
		}
	})

	t.Run("the session id takes typed-in values only", func(t *testing.T) {
		if _, err := BugReportsEntity.SuggestKeyValues(ctx, pgPool, chConn, teamID, appID, byName["session_id"], ValueRequest{}); err == nil {
			t.Error("want the session id's value list refused")
		}
	})

	t.Run("an app with no reports has no values", func(t *testing.T) {
		emptyApp, err := BugReportsEntity.SuggestKeyValues(ctx, pgPool, chConn, teamID, uuid.New(), byName["device_name"], ValueRequest{})
		if err != nil {
			t.Fatalf("fetch values: %v", err)
		}
		if len(emptyApp.Values) != 0 {
			t.Errorf("want no values, got %v", texts(emptyApp.Values))
		}
	})
}

func seedBugReportUDAttrs(ctx context.Context, t *testing.T) (teamID, appID uuid.UUID) {
	t.Helper()

	teamID = uuid.New()
	appID = uuid.New()

	th.SeedTeam(ctx, t, teamID.String(), "bug report custom keys team")
	th.SeedApp(ctx, t, appID.String(), teamID.String(), "bug report custom keys app", 90)

	base := time.Now().UTC().Add(-time.Hour).Truncate(time.Millisecond)

	th.SeedUDAttrRow(ctx, t, teamID.String(), appID.String(), testinfra.UDAttrRow{BugReport: true, Key: "plan", Value: "free", Timestamp: base})
	th.SeedUDAttrRow(ctx, t, teamID.String(), appID.String(), testinfra.UDAttrRow{BugReport: true, Key: "plan", Value: "pro", Timestamp: base.Add(10 * time.Minute)})
	th.SeedUDAttrRow(ctx, t, teamID.String(), appID.String(), testinfra.UDAttrRow{BugReport: true, Key: "retries", Type: "int64", Value: "3", Timestamp: base})

	// Attributes of other event kinds, which must stay out of the bug report
	// key and value lists.
	th.SeedUDAttrRow(ctx, t, teamID.String(), appID.String(), testinfra.UDAttrRow{BugReport: false, Key: "plan", Value: "enterprise", Timestamp: base})
	th.SeedUDAttrRow(ctx, t, teamID.String(), appID.String(), testinfra.UDAttrRow{BugReport: false, Key: "cart_size", Type: "int64", Value: "7", Timestamp: base})

	return teamID, appID
}

func TestFetchBugReportCustomKeys(t *testing.T) {
	ctx := context.Background()
	teamID, appID := seedBugReportUDAttrs(ctx, t)

	t.Run("only bug report keys come back ordered by name", func(t *testing.T) {
		keys, truncated, err := BugReportsEntity.FetchCustomKeys(ctx, pgPool, chConn, teamID, appID, CustomKeyLimit)
		if err != nil {
			t.Fatalf("fetch custom keys: %v", err)
		}
		if truncated {
			t.Error("want the whole list for two keys")
		}

		want := []string{"custom.plan", "custom.retries"}
		got := customKeyNames(keys)
		if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
			t.Fatalf("want %v, got %v", want, got)
		}
	})

	t.Run("a listing past the limit reports truncation", func(t *testing.T) {
		keys, truncated, err := BugReportsEntity.FetchCustomKeys(ctx, pgPool, chConn, teamID, appID, 1)
		if err != nil {
			t.Fatalf("fetch custom keys: %v", err)
		}
		if !truncated {
			t.Error("want the listing marked truncated")
		}
		if got := customKeyNames(keys); len(got) != 1 || got[0] != "custom.plan" {
			t.Errorf("want the first key by name, got %v", got)
		}
	})

	t.Run("only the requested names come back", func(t *testing.T) {
		keys, err := BugReportsEntity.FetchCustomKeysByName(ctx, pgPool, chConn, teamID, appID, []string{"plan", "cart_size", "nope"})
		if err != nil {
			t.Fatalf("fetch custom keys by name: %v", err)
		}
		got := customKeyNames(keys)
		if len(got) != 1 || got[0] != "custom.plan" {
			t.Errorf("want [custom.plan], a non-bug-report key left out, got %v", got)
		}
	})
}

func TestCustomBugReportKeyValues(t *testing.T) {
	ctx := context.Background()
	teamID, appID := seedBugReportUDAttrs(ctx, t)

	plan := CustomKey("plan", ValueTypeString)

	list := func(t *testing.T, valueRequest ValueRequest) []string {
		t.Helper()
		valueList, err := BugReportsEntity.SuggestKeyValues(ctx, pgPool, chConn, teamID, appID, plan, valueRequest)
		if err != nil {
			t.Fatalf("fetch values: %v", err)
		}
		texts := make([]string, len(valueList.Values))
		for i, value := range valueList.Values {
			texts[i] = value.Text
		}
		return texts
	}

	t.Run("values come back most recently written first", func(t *testing.T) {
		got := list(t, ValueRequest{})
		if len(got) != 2 || got[0] != "pro" || got[1] != "free" {
			t.Errorf("want [pro free], got %v", got)
		}
	})

	t.Run("a non-bug-report row's value stays out", func(t *testing.T) {
		got := list(t, ValueRequest{})
		for _, text := range got {
			if text == "enterprise" {
				t.Error("want the session attribute's value out of the bug report list")
			}
		}
	})

	t.Run("search narrows the list", func(t *testing.T) {
		got := list(t, ValueRequest{Search: "fr"})
		if len(got) != 1 || got[0] != "free" {
			t.Errorf("want [free], got %v", got)
		}
	})
}
