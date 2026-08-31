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
