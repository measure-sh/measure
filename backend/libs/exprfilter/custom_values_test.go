//go:build integration

package exprfilter

import (
	"context"
	"testing"
	"time"

	"backend/testinfra"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func seedSpanUDAttrs(ctx context.Context, t *testing.T) (teamID, appID, otherAppID uuid.UUID) {
	t.Helper()

	teamID = uuid.New()
	appID = uuid.New()
	otherAppID = uuid.New()

	th.SeedTeam(ctx, t, teamID.String(), "custom keys team")
	th.SeedApp(ctx, t, appID.String(), teamID.String(), "custom keys app", 90)
	th.SeedApp(ctx, t, otherAppID.String(), teamID.String(), "another app", 90)

	base := time.Now().UTC().Add(-time.Hour).Truncate(time.Millisecond)

	th.SeedSpanUDAttrRow(ctx, t, teamID.String(), appID.String(), testinfra.SpanUDAttrRow{Key: "plan", Value: "free", Timestamp: base})
	th.SeedSpanUDAttrRow(ctx, t, teamID.String(), appID.String(), testinfra.SpanUDAttrRow{Key: "plan", Value: "pro", Timestamp: base.Add(10 * time.Minute)})
	th.SeedSpanUDAttrRow(ctx, t, teamID.String(), appID.String(), testinfra.SpanUDAttrRow{Key: "plan", Value: "", Timestamp: base.Add(20 * time.Minute)})
	th.SeedSpanUDAttrRow(ctx, t, teamID.String(), appID.String(), testinfra.SpanUDAttrRow{Key: "is_premium", Type: "bool", Value: "true", Timestamp: base})
	th.SeedSpanUDAttrRow(ctx, t, teamID.String(), appID.String(), testinfra.SpanUDAttrRow{Key: "retries", Type: "int64", Value: "3", Timestamp: base})
	th.SeedSpanUDAttrRow(ctx, t, teamID.String(), appID.String(), testinfra.SpanUDAttrRow{Key: "ratio", Type: "float64", Value: "0.5", Timestamp: base})

	// One key written under two types, the bool row last.
	th.SeedSpanUDAttrRow(ctx, t, teamID.String(), appID.String(), testinfra.SpanUDAttrRow{Key: "flag", Type: "string", Value: "yes", Timestamp: base})
	th.SeedSpanUDAttrRow(ctx, t, teamID.String(), appID.String(), testinfra.SpanUDAttrRow{Key: "flag", Type: "bool", Value: "true", Timestamp: base.Add(10 * time.Minute)})

	th.SeedSpanUDAttrRow(ctx, t, teamID.String(), otherAppID.String(), testinfra.SpanUDAttrRow{Key: "plan", Value: "enterprise", Timestamp: base})

	return teamID, appID, otherAppID
}

func customKeyNames(keys []Key) []string {
	names := make([]string, len(keys))
	for i, key := range keys {
		names[i] = key.Name
	}
	return names
}

func TestFetchSpanCustomKeys(t *testing.T) {
	ctx := context.Background()
	teamID, appID, _ := seedSpanUDAttrs(ctx, t)

	t.Run("every key comes back ordered by name", func(t *testing.T) {
		keys, truncated, err := SpansEntity.FetchCustomKeys(ctx, pgPool, chConn, teamID, appID, CustomKeyLimit)
		if err != nil {
			t.Fatalf("fetch custom keys: %v", err)
		}
		if truncated {
			t.Error("want the whole list for five keys")
		}

		want := []string{"custom.flag", "custom.is_premium", "custom.plan", "custom.ratio", "custom.retries"}
		got := customKeyNames(keys)
		if len(got) != len(want) {
			t.Fatalf("want %v, got %v", want, got)
		}
		for i, name := range want {
			if got[i] != name {
				t.Fatalf("want %v, got %v", want, got)
			}
		}
	})

	t.Run("a listing past the limit reports truncation", func(t *testing.T) {
		keys, truncated, err := SpansEntity.FetchCustomKeys(ctx, pgPool, chConn, teamID, appID, 2)
		if err != nil {
			t.Fatalf("fetch custom keys: %v", err)
		}
		if !truncated {
			t.Error("want the listing marked truncated")
		}
		got := customKeyNames(keys)
		if len(got) != 2 || got[0] != "custom.flag" || got[1] != "custom.is_premium" {
			t.Errorf("want the first two keys by name, got %v", got)
		}
	})

	t.Run("each key carries its stored type", func(t *testing.T) {
		keys, _, err := SpansEntity.FetchCustomKeys(ctx, pgPool, chConn, teamID, appID, CustomKeyLimit)
		if err != nil {
			t.Fatalf("fetch custom keys: %v", err)
		}

		byName := IndexKeysByName(keys)
		wantTypes := map[string]ValueType{
			"custom.plan":       ValueTypeString,
			"custom.is_premium": ValueTypeBool,
			"custom.retries":    ValueTypeInt64,
			"custom.ratio":      ValueTypeFloat64,
		}
		for name, want := range wantTypes {
			if got := byName[name].ValueType; got != want {
				t.Errorf("key %q: want type %q, got %q", name, want, got)
			}
		}
	})
}

func TestListKeysResolvesRequestedNames(t *testing.T) {
	ctx := context.Background()
	teamID, appID, _ := seedSpanUDAttrs(ctx, t)

	// The listing is held to the first two custom keys by name, flag and
	// is_premium, so the other seeded keys stand in for keys past
	// CustomKeyLimit.
	entity := SpansEntity
	entity.FetchCustomKeys = func(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, limit int) ([]Key, bool, error) {
		return SpansEntity.FetchCustomKeys(ctx, pgPool, chPool, teamID, appID, 2)
	}

	baseKeys, _, err := entity.ListKeys(ctx, pgPool, chConn, teamID, appID, nil)
	if err != nil {
		t.Fatalf("list keys: %v", err)
	}
	if _, listed := IndexKeysByName(baseKeys)["custom.retries"]; listed {
		t.Fatal("want custom.retries beyond the truncated listing")
	}

	t.Run("a requested name beyond the listing is appended with its type", func(t *testing.T) {
		keys, truncated, err := entity.ListKeys(ctx, pgPool, chConn, teamID, appID, []string{"custom.retries"})
		if err != nil {
			t.Fatalf("list keys: %v", err)
		}
		if !truncated {
			t.Error("want the listing still marked truncated")
		}
		key, found := IndexKeysByName(keys)["custom.retries"]
		if !found {
			t.Fatal("want the requested key appended")
		}
		if key.ValueType != ValueTypeInt64 {
			t.Errorf("want type %q, got %q", ValueTypeInt64, key.ValueType)
		}
	})

	t.Run("a requested name the app never reported is ignored", func(t *testing.T) {
		keys, _, err := entity.ListKeys(ctx, pgPool, chConn, teamID, appID, []string{"custom.nope"})
		if err != nil {
			t.Fatalf("list keys: %v", err)
		}
		if len(keys) != len(baseKeys) {
			t.Errorf("want %d keys, got %d", len(baseKeys), len(keys))
		}
	})

	t.Run("a requested name already listed is not duplicated", func(t *testing.T) {
		keys, _, err := entity.ListKeys(ctx, pgPool, chConn, teamID, appID, []string{"custom.flag"})
		if err != nil {
			t.Fatalf("list keys: %v", err)
		}
		count := 0
		for _, key := range keys {
			if key.Name == "custom.flag" {
				count++
			}
		}
		if count != 1 {
			t.Errorf("want custom.flag once, got it %d times", count)
		}
		if len(keys) != len(baseKeys) {
			t.Errorf("want %d keys, got %d", len(baseKeys), len(keys))
		}
	})

	t.Run("a name without the custom prefix is ignored", func(t *testing.T) {
		keys, _, err := entity.ListKeys(ctx, pgPool, chConn, teamID, appID, []string{"retries"})
		if err != nil {
			t.Fatalf("list keys: %v", err)
		}
		if len(keys) != len(baseKeys) {
			t.Errorf("want %d keys, got %d", len(baseKeys), len(keys))
		}
	})
}

func TestFetchSpanCustomKeysByName(t *testing.T) {
	ctx := context.Background()
	teamID, appID, _ := seedSpanUDAttrs(ctx, t)

	t.Run("only the requested names come back", func(t *testing.T) {
		keys, err := SpansEntity.FetchCustomKeysByName(ctx, pgPool, chConn, teamID, appID, []string{"plan", "retries", "nope"})
		if err != nil {
			t.Fatalf("fetch custom keys by name: %v", err)
		}
		got := customKeyNames(keys)
		if len(got) != 2 || got[0] != "custom.plan" || got[1] != "custom.retries" {
			t.Errorf("want [custom.plan custom.retries], got %v", got)
		}
	})

	t.Run("no names read nothing", func(t *testing.T) {
		keys, err := SpansEntity.FetchCustomKeysByName(ctx, pgPool, chConn, teamID, appID, nil)
		if err != nil {
			t.Fatalf("fetch custom keys by name: %v", err)
		}
		if len(keys) != 0 {
			t.Errorf("want no keys, got %v", customKeyNames(keys))
		}
	})

	t.Run("a key written under two types offers the last one", func(t *testing.T) {
		keys, err := SpansEntity.FetchCustomKeysByName(ctx, pgPool, chConn, teamID, appID, []string{"flag"})
		if err != nil {
			t.Fatalf("fetch custom keys by name: %v", err)
		}
		if len(keys) != 1 || keys[0].ValueType != ValueTypeBool {
			t.Errorf("want one bool key, got %v", keys)
		}
	})
}

func TestCustomSpanKeyValues(t *testing.T) {
	ctx := context.Background()
	teamID, appID, otherAppID := seedSpanUDAttrs(ctx, t)

	list := func(t *testing.T, key Key, valueRequest ValueRequest) ([]string, bool) {
		t.Helper()
		valueList, err := SpansEntity.SuggestKeyValues(ctx, pgPool, chConn, teamID, appID, key, valueRequest)
		if err != nil {
			t.Fatalf("fetch values: %v", err)
		}
		texts := make([]string, len(valueList.Values))
		for i, value := range valueList.Values {
			texts[i] = value.Text
		}
		return texts, valueList.Truncated
	}

	plan := CustomKey("plan", ValueTypeString)

	t.Run("string values come back most recently written first", func(t *testing.T) {
		got, truncated := list(t, plan, ValueRequest{})
		if truncated {
			t.Error("want the whole list for two values")
		}
		if len(got) != 2 || got[0] != "pro" || got[1] != "free" {
			t.Errorf("want [pro free], got %v", got)
		}
	})

	t.Run("an empty stored value stays out", func(t *testing.T) {
		got, _ := list(t, plan, ValueRequest{})
		for _, text := range got {
			if text == "" {
				t.Error("want empty values left out of the list")
			}
		}
	})

	t.Run("search narrows the list", func(t *testing.T) {
		got, _ := list(t, plan, ValueRequest{Search: "fr"})
		if len(got) != 1 || got[0] != "free" {
			t.Errorf("want [free], got %v", got)
		}
	})

	t.Run("a list past the limit reports truncation", func(t *testing.T) {
		got, truncated := list(t, plan, ValueRequest{Limit: 1})
		if !truncated {
			t.Error("want the list marked truncated")
		}
		if len(got) != 1 || got[0] != "pro" {
			t.Errorf("want [pro], got %v", got)
		}
	})

	t.Run("another app's values stay out", func(t *testing.T) {
		got, _ := list(t, plan, ValueRequest{})
		for _, text := range got {
			if text == "enterprise" {
				t.Error("want another app's value out of this app's list")
			}
		}
		valueList, err := SpansEntity.SuggestKeyValues(ctx, pgPool, chConn, teamID, otherAppID, plan, ValueRequest{})
		if err != nil {
			t.Fatalf("fetch values: %v", err)
		}
		if len(valueList.Values) != 1 || valueList.Values[0].Text != "enterprise" {
			t.Errorf("want [enterprise] for the other app, got %v", valueList.Values)
		}
	})

	t.Run("a bool key lists its fixed set", func(t *testing.T) {
		got, _ := list(t, CustomKey("is_premium", ValueTypeBool), ValueRequest{})
		if len(got) != 2 || got[0] != "true" || got[1] != "false" {
			t.Errorf("want [true false], got %v", got)
		}
	})

	t.Run("a number key takes typed-in values only", func(t *testing.T) {
		_, err := SpansEntity.SuggestKeyValues(ctx, pgPool, chConn, teamID, appID, CustomKey("retries", ValueTypeInt64), ValueRequest{})
		if err == nil {
			t.Error("want a number key's value list refused")
		}
	})
}
