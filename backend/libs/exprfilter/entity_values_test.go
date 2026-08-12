//go:build integration

package exprfilter

import (
	"context"
	"log"
	"os"
	"testing"
	"time"

	"backend/testinfra"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	pgPool *pgxpool.Pool
	th     *testinfra.TestHelper
)

func TestMain(m *testing.M) {
	ctx := context.Background()

	pool, cleanup := testinfra.SetupPostgres(ctx)
	pgPool = pool
	th = testinfra.NewTestHelper(pool, nil, nil)

	code := m.Run()
	cleanup()
	os.Exit(code)
}

func seedBuilds(ctx context.Context, t *testing.T) (appID, otherAppID uuid.UUID, patchOne, patchTwo uuid.UUID) {
	t.Helper()

	teamID := uuid.New()
	appID = uuid.New()
	otherAppID = uuid.New()
	patchOne = uuid.New()
	patchTwo = uuid.New()

	th.SeedTeam(ctx, t, teamID.String(), "filter values team")
	th.SeedApp(ctx, t, appID.String(), teamID.String(), "filter values app", 90)
	th.SeedApp(ctx, t, otherAppID.String(), teamID.String(), "another app", 90)

	base := time.Now().UTC().Add(-time.Hour).Truncate(time.Millisecond)
	noPatch := uuid.Nil.String()

	// Regular builds have version columns filled and no patch.
	th.SeedBuildMappingRow(ctx, t, uuid.NewString(), appID.String(), "1.1.0", "1100", "proguard", "k1", noPatch, "", base)
	th.SeedBuildMappingRow(ctx, t, uuid.NewString(), appID.String(), "1.2.0", "1200", "proguard", "k2", noPatch, "", base.Add(10*time.Minute))
	th.SeedBuildMappingRow(ctx, t, uuid.NewString(), appID.String(), "1.2.0", "1200", "dsym", "k3", noPatch, "", base.Add(20*time.Minute))

	// OTA patches have patch columns filled and no version. One named its
	// patch version, one did not.
	th.SeedBuildMappingRow(ctx, t, uuid.NewString(), appID.String(), "", "", "jsbundle", "k4", patchOne.String(), "1.2.0-patch.3", base.Add(30*time.Minute))
	th.SeedBuildMappingRow(ctx, t, uuid.NewString(), appID.String(), "", "", "jsbundle", "k5", patchTwo.String(), "", base.Add(40*time.Minute))

	// Another app's build, which must stay out of this app's lists.
	th.SeedBuildMappingRow(ctx, t, uuid.NewString(), otherAppID.String(), "9.9.9", "9999", "proguard", "k6", noPatch, "", base)

	return appID, otherAppID, patchOne, patchTwo
}

func TestBuildsValues(t *testing.T) {
	ctx := context.Background()
	appID, otherAppID, patchOne, patchTwo := seedBuilds(ctx, t)

	byName := IndexKeysByName(BuildsEntity.Keys)

	list := func(t *testing.T, keyName string, valueRequest ValueRequest) ([]Value, bool) {
		t.Helper()
		valueList, err := BuildsEntity.SuggestKeyValues(ctx, pgPool, nil, appID, byName[keyName], valueRequest)
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

	t.Run("versions come back newest upload first", func(t *testing.T) {
		values, truncated := list(t, "version_name", ValueRequest{})
		if truncated {
			t.Error("want the whole list for five rows")
		}
		got := texts(values)
		if len(got) != 2 || got[0] != "1.2.0" || got[1] != "1.1.0" {
			t.Errorf("want [1.2.0 1.1.0], got %v", got)
		}
	})

	t.Run("a patch upload contributes no version", func(t *testing.T) {
		values, _ := list(t, "version_code", ValueRequest{})
		for _, value := range texts(values) {
			if value == "" {
				t.Error("want empty version columns left out of the list")
			}
		}
	})

	t.Run("another app's builds stay out", func(t *testing.T) {
		values, _ := list(t, "version_name", ValueRequest{})
		for _, value := range texts(values) {
			if value == "9.9.9" {
				t.Error("want another app's version out of this app's list")
			}
		}

		otherApp, err := BuildsEntity.SuggestKeyValues(ctx, pgPool, nil, otherAppID, byName["version_name"], ValueRequest{})
		if err != nil {
			t.Fatalf("fetch values: %v", err)
		}
		if got := texts(otherApp.Values); len(got) != 1 || got[0] != "9.9.9" {
			t.Errorf("want the other app to see only its own build, got %v", got)
		}
	})

	t.Run("typing narrows the list", func(t *testing.T) {
		values, _ := list(t, "version_name", ValueRequest{Search: "1.2"})
		if got := texts(values); len(got) != 1 || got[0] != "1.2.0" {
			t.Errorf("want only 1.2.0, got %v", got)
		}
	})

	t.Run("a search matching nothing", func(t *testing.T) {
		values, _ := list(t, "version_name", ValueRequest{Search: "7.0"})
		if len(values) != 0 {
			t.Errorf("want no values, got %v", texts(values))
		}
	})

	t.Run("a wildcard is searched for rather than obeyed", func(t *testing.T) {
		values, _ := list(t, "version_name", ValueRequest{Search: "%"})
		if len(values) != 0 {
			t.Errorf("want a literal percent sign to match nothing, got %v", texts(values))
		}
	})

	t.Run("a limit reports that more matched", func(t *testing.T) {
		values, truncated := list(t, "version_name", ValueRequest{Limit: 1})
		if len(values) != 1 {
			t.Errorf("want one value, got %v", texts(values))
		}
		if !truncated {
			t.Error("want the picker told the list is partial")
		}
	})

	t.Run("patch ids leave out regular builds", func(t *testing.T) {
		values, _ := list(t, "patch_id", ValueRequest{})

		got := texts(values)
		if len(got) != 2 {
			t.Fatalf("want the two patches, got %v", got)
		}
		if got[0] != patchTwo.String() || got[1] != patchOne.String() {
			t.Errorf("want the newest patch first, got %v", got)
		}
		for _, value := range got {
			if value == uuid.Nil.String() {
				t.Error("want the nil patch id of regular builds left out")
			}
		}
	})

	t.Run("patch versions leave out the patch that named none", func(t *testing.T) {
		values, _ := list(t, "patch_version", ValueRequest{})
		if got := texts(values); len(got) != 1 || got[0] != "1.2.0-patch.3" {
			t.Errorf("want only the named patch version, got %v", got)
		}
	})

	t.Run("mapping types are the platform's fixed set", func(t *testing.T) {
		values, truncated := list(t, "mapping_type", ValueRequest{})
		if truncated {
			t.Error("want a fixed list reported whole")
		}
		if got := texts(values); len(got) != 4 {
			t.Errorf("want the four mapping types, got %v", got)
		}

		narrowed, _ := list(t, "mapping_type", ValueRequest{Search: "gu"})
		if got := texts(narrowed); len(got) != 1 || got[0] != "proguard" {
			t.Errorf("want proguard, got %v", got)
		}
	})

	t.Run("an app with no builds has no values", func(t *testing.T) {
		emptyApp, err := BuildsEntity.SuggestKeyValues(ctx, pgPool, nil, uuid.New(), byName["version_name"], ValueRequest{})
		if err != nil {
			t.Fatalf("fetch values: %v", err)
		}
		if len(emptyApp.Values) != 0 {
			t.Errorf("want no values, got %v", texts(emptyApp.Values))
		}
	})
}

func init() {
	log.SetOutput(os.Stdout)
}
