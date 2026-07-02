//go:build integration

package autumn

import (
	"context"
	"errors"
	"testing"

	"backend/testinfra"
)

// TestCacheIntegration exercises the cache primitives and CheckCached against a
// real Valkey container: round-trip, hit/miss, and error-not-cached.
func TestCacheIntegration(t *testing.T) {
	ctx := context.Background()
	vk, cleanup := testinfra.SetupValkey(ctx)
	defer cleanup()

	origCheck := Check
	t.Cleanup(func() { Check = origCheck })

	t.Run("get on empty cache is a miss", func(t *testing.T) {
		if _, ok := GetCachedCheck(ctx, vk, "cus_empty", FeatureBytes); ok {
			t.Error("ok = true on empty cache, want false")
		}
	})

	t.Run("set then get round-trips both verdicts", func(t *testing.T) {
		for _, allowed := range []bool{true, false} {
			cust := "cus_rt_true"
			if !allowed {
				cust = "cus_rt_false"
			}
			SetCachedCheck(ctx, vk, cust, FeatureBytes, allowed)
			got, ok := GetCachedCheck(ctx, vk, cust, FeatureBytes)
			if !ok {
				t.Fatalf("ok = false after set (allowed=%v), want true", allowed)
			}
			if got != allowed {
				t.Errorf("got %v, want %v", got, allowed)
			}
		}
	})

	t.Run("CheckCached miss populates then hits, calling Check once", func(t *testing.T) {
		calls := 0
		Check = func(_ context.Context, _, _ string) (*CheckResponse, error) {
			calls++
			return &CheckResponse{Allowed: true}, nil
		}

		for i := 0; i < 2; i++ {
			allowed, err := CheckCached(ctx, vk, "cus_miss_then_hit", FeatureBytes)
			if err != nil || !allowed {
				t.Fatalf("call %d: CheckCached = (%v, %v), want (true, nil)", i+1, allowed, err)
			}
		}
		if calls != 1 {
			t.Errorf("Check called %d times, want 1 (second call must hit cache)", calls)
		}
	})

	t.Run("CheckCached error is not cached", func(t *testing.T) {
		Check = func(_ context.Context, _, _ string) (*CheckResponse, error) {
			return nil, errors.New("autumn down")
		}

		if _, err := CheckCached(ctx, vk, "cus_err", FeatureBytes); err == nil {
			t.Fatal("err = nil, want error")
		}
		if _, ok := GetCachedCheck(ctx, vk, "cus_err", FeatureBytes); ok {
			t.Error("verdict cached after error, want no cache entry")
		}
	})

	t.Run("cache hit short-circuits Check", func(t *testing.T) {
		SetCachedCheck(ctx, vk, "cus_hit", FeatureBytes, false)
		Check = func(_ context.Context, _, _ string) (*CheckResponse, error) {
			t.Error("Check must not be called on a cache hit")
			return nil, errors.New("unexpected")
		}

		allowed, err := CheckCached(ctx, vk, "cus_hit", FeatureBytes)
		if err != nil {
			t.Fatalf("err = %v, want nil", err)
		}
		if allowed {
			t.Error("allowed = true, want false (cached blocked verdict)")
		}
	})
}
