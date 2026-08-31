//go:build integration

package sdkconfig

import (
	"context"
	"os"
	"testing"

	"backend/testinfra"

	"github.com/google/uuid"
	valkey "github.com/valkey-io/valkey-go"
)

var vk valkey.Client

func TestMain(m *testing.M) {
	ctx := context.Background()

	client, vkCleanup := testinfra.SetupValkey(ctx)
	vk = client

	code := m.Run()

	vkCleanup()
	os.Exit(code)
}

func ttlOf(t *testing.T, ctx context.Context, key string) int64 {
	t.Helper()
	ttl, err := vk.Do(ctx, vk.B().Ttl().Key(key).Build()).AsInt64()
	if err != nil {
		t.Fatalf("read ttl: %v", err)
	}
	return ttl
}

func assertTTLInJitterWindow(t *testing.T, ttl int64) {
	t.Helper()
	const lo, hi = int64(21.6 * 3600), int64(26.4 * 3600)
	if ttl <= lo || ttl > hi {
		t.Fatalf("expected ttl in (%d, %d], got %d", lo, hi, ttl)
	}
}

func TestSetCacheSetsTTL(t *testing.T) {
	ctx := context.Background()
	appID := uuid.New()

	if err := SetCache(ctx, vk, appID, []byte(`{"max_events_in_batch":10000}`)); err != nil {
		t.Fatalf("SetCache: %v", err)
	}

	assertTTLInJitterWindow(t, ttlOf(t, ctx, configCacheKey(appID)))
}

func TestSetCacheIfAbsentSetsTTL(t *testing.T) {
	ctx := context.Background()
	appID := uuid.New()

	if err := SetCacheIfAbsent(ctx, vk, appID, []byte(`{"max_events_in_batch":10000}`)); err != nil {
		t.Fatalf("SetCacheIfAbsent: %v", err)
	}

	assertTTLInJitterWindow(t, ttlOf(t, ctx, configCacheKey(appID)))
}

func TestSetCacheIfAbsentCannotExtendLiveTTL(t *testing.T) {
	ctx := context.Background()
	appID := uuid.New()
	key := configCacheKey(appID)

	if err := SetCache(ctx, vk, appID, []byte(`{"max_events_in_batch":10000}`)); err != nil {
		t.Fatalf("SetCache: %v", err)
	}
	if err := vk.Do(ctx, vk.B().Expire().Key(key).Seconds(60).Build()).Error(); err != nil {
		t.Fatalf("shorten ttl: %v", err)
	}

	if err := SetCacheIfAbsent(ctx, vk, appID, []byte(`{"max_events_in_batch":42}`)); err != nil {
		t.Fatalf("SetCacheIfAbsent: %v", err)
	}

	ttl := ttlOf(t, ctx, key)
	if ttl <= 0 || ttl > 60 {
		t.Fatalf("expected ttl to stay near 60s, got %d", ttl)
	}
}

func TestSetCacheIfAbsentGivesLegacyKeyTTL(t *testing.T) {
	ctx := context.Background()
	appID := uuid.New()
	key := configCacheKey(appID)

	legacyJSON := `{"max_events_in_batch":10000}`
	legacy := vk.B().Hset().Key(key).FieldValue().
		FieldValue("etag", ComputeETag([]byte(legacyJSON))).
		FieldValue("data", legacyJSON).
		Build()

	if err := vk.Do(ctx, legacy).Error(); err != nil {
		t.Fatalf("seed legacy entry: %v", err)
	}
	if ttl := ttlOf(t, ctx, key); ttl != -1 {
		t.Fatalf("expected legacy key to have no ttl, got %d", ttl)
	}

	if err := SetCacheIfAbsent(ctx, vk, appID, []byte(legacyJSON)); err != nil {
		t.Fatalf("SetCacheIfAbsent: %v", err)
	}

	if ttl := ttlOf(t, ctx, key); ttl <= 0 {
		t.Fatalf("expected legacy key to gain a ttl, got %d", ttl)
	}
}

func TestGetCacheLegacyFieldMisses(t *testing.T) {
	ctx := context.Background()
	appID := uuid.New()
	key := configCacheKey(appID)

	legacyJSON := `{"max_events_in_batch":10000,"trace_sampling_rate":100}`
	legacy := vk.B().Hset().Key(key).FieldValue().
		FieldValue("etag", ComputeETag([]byte(legacyJSON))).
		FieldValue("data", legacyJSON).
		Build()

	if err := vk.Do(ctx, legacy).Error(); err != nil {
		t.Fatalf("seed legacy entry: %v", err)
	}

	data, err := GetCache(ctx, vk, appID)
	if err != nil {
		t.Fatalf("GetCache: %v", err)
	}
	if data != "" {
		t.Fatalf("expected legacy entry to miss, got %q", data)
	}

	freshJSON := []byte(`{"max_events_in_batch":10000,"http_sampling_rate":42}`)
	if err := SetCacheIfAbsent(ctx, vk, appID, freshJSON); err != nil {
		t.Fatalf("SetCacheIfAbsent: %v", err)
	}

	data, err = GetCache(ctx, vk, appID)
	if err != nil {
		t.Fatalf("GetCache after repopulate: %v", err)
	}
	if data != string(freshJSON) {
		t.Fatalf("expected %q, got %q", freshJSON, data)
	}
}
