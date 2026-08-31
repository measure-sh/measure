//go:build integration

package handlers

import (
	"backend/api/server"
	"backend/libs/sdkconfig"
	"context"
	"encoding/json"
	"strconv"
	"strings"
	"testing"

	"github.com/google/uuid"
)

// seedSdkConfig creates a team, app & its default SDK config row,
// returning the app id & the user id to patch as.
func seedSdkConfig(ctx context.Context, t *testing.T) (appID uuid.UUID, userID string) {
	t.Helper()

	userID = uuid.NewString()
	teamID := uuid.New()
	seedUser(ctx, t, userID, "sdkconfig@test.com")
	seedTeam(ctx, t, teamID, testTeamName)

	appID = uuid.New()
	seedApp(ctx, t, appID, teamID, 30)

	tx, err := th.PgPool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	defer tx.Rollback(ctx)

	uid := uuid.MustParse(userID)
	if err := sdkconfig.CreateConfig(ctx, tx, teamID, appID, &uid); err != nil {
		t.Fatalf("create sdk config: %v", err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatalf("commit sdk config: %v", err)
	}

	return appID, userID
}

func patchMaxEvents(t *testing.T, deps *server.Deps, appID uuid.UUID, userID string, value int) error {
	t.Helper()

	body := strings.NewReader(`{"max_events_in_batch":` + strconv.Itoa(value) + `}`)
	c, _ := newTestGinContext("PATCH", "/apps/"+appID.String()+"/config", body)
	return PatchConfigForApp(c, deps, appID, userID)
}

func maxEventsInDb(ctx context.Context, t *testing.T, appID uuid.UUID) int {
	t.Helper()

	var n int
	if err := th.PgPool.QueryRow(ctx,
		`SELECT max_events_in_batch FROM sdk_config WHERE app_id = $1`, appID).Scan(&n); err != nil {
		t.Fatalf("read max_events_in_batch: %v", err)
	}
	return n
}

func cachedMaxEvents(ctx context.Context, t *testing.T, appID uuid.UUID) int {
	t.Helper()

	data, err := sdkconfig.GetCache(ctx, th.VK, appID)
	if err != nil {
		t.Fatalf("get cache: %v", err)
	}
	if data == "" {
		t.Fatal("cache empty, want a value")
	}

	var config sdkconfig.SdkConfig
	if err := json.Unmarshal([]byte(data), &config); err != nil {
		t.Fatalf("unmarshal cached config: %v", err)
	}
	return config.MaxEventsInBatch
}

// TestPatchConfigForApp_SlowReaderCannotOverwrite pins both branches of
// the reader repopulate: it must write when the key is absent, & it must
// refuse once a patch has written a fresh config, so a reader that read
// Postgres before the patch cannot pin the cache to the stale config.
func TestPatchConfigForApp_SlowReaderCannotOverwrite(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	appID, userID := seedSdkConfig(ctx, t)
	staleJSON := []byte(`{"max_events_in_batch":1111}`)

	// reader repopulating after a genuine miss
	if err := sdkconfig.SetCacheIfAbsent(ctx, th.VK, appID, staleJSON); err != nil {
		t.Fatalf("repopulate cache: %v", err)
	}

	if got := cachedMaxEvents(ctx, t, appID); got != 1111 {
		t.Fatalf("cached max_events_in_batch = %d, want 1111, absent key was not populated", got)
	}

	if err := patchMaxEvents(t, deps, appID, userID, 4242); err != nil {
		t.Fatalf("patch config: %v", err)
	}

	// slow reader arriving late with the pre-update config
	if err := sdkconfig.SetCacheIfAbsent(ctx, th.VK, appID, staleJSON); err != nil {
		t.Fatalf("repopulate cache: %v", err)
	}

	if got := cachedMaxEvents(ctx, t, appID); got != 4242 {
		t.Errorf("cached max_events_in_batch = %d, want 4242", got)
	}
}

// TestPatchConfigForApp_CacheFailureRollsBack proves the cache write is
// part of the transaction, a cache failure must leave Postgres untouched.
func TestPatchConfigForApp_CacheFailureRollsBack(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	appID, userID := seedSdkConfig(ctx, t)
	before := maxEventsInDb(ctx, t, appID)

	noCache := *deps
	noCache.VK = nil

	if err := patchMaxEvents(t, &noCache, appID, userID, 4242); err == nil {
		t.Fatal("patch config succeeded, want cache write error")
	}

	if got := maxEventsInDb(ctx, t, appID); got != before {
		t.Errorf("max_events_in_batch = %d, want %d, update was not rolled back", got, before)
	}
}

// TestGetCache_ErrorIsNotMiss proves a broken cache surfaces an error
// while a genuinely absent key does not.
func TestGetCache_ErrorIsNotMiss(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	appID := uuid.New()

	data, err := sdkconfig.GetCache(ctx, th.VK, appID)
	if err != nil || data != "" {
		t.Errorf("missing key: got (%q, %v), want (\"\", nil)", data, err)
	}

	deadCtx, cancel := context.WithCancel(ctx)
	cancel()

	if _, err := sdkconfig.GetCache(deadCtx, th.VK, appID); err == nil {
		t.Error("unusable client returned nil error, want an error")
	}
}
