package autumn

import (
	"context"
	"errors"
	"testing"
)

// TestCheckCacheKey locks the cache key format so it stays stable for the
// shared cache.
func TestCheckCacheKey(t *testing.T) {
	got := CheckCacheKey("cus_abc123", FeatureBytes)
	want := "autumn:check:bytes:{cus_abc123}"
	if got != want {
		t.Errorf("CheckCacheKey = %q, want %q", got, want)
	}
}

// TestCheckCachedNilClient verifies that with no Valkey client the cache is
// bypassed and the verdict comes straight from Check, for both verdicts.
func TestCheckCachedNilClient(t *testing.T) {
	orig := Check
	t.Cleanup(func() { Check = orig })

	for _, tc := range []struct {
		name    string
		allowed bool
	}{
		{"allowed", true},
		{"blocked", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			Check = func(_ context.Context, customerID, featureID string) (*CheckResponse, error) {
				calls++
				if customerID != "cus_1" || featureID != FeatureBytes {
					t.Errorf("Check args = (%q, %q), want (cus_1, bytes)", customerID, featureID)
				}
				return &CheckResponse{Allowed: tc.allowed}, nil
			}

			allowed, err := CheckCached(context.Background(), nil, "cus_1", FeatureBytes)
			if err != nil {
				t.Fatalf("CheckCached err = %v, want nil", err)
			}
			if allowed != tc.allowed {
				t.Errorf("allowed = %v, want %v", allowed, tc.allowed)
			}
			if calls != 1 {
				t.Errorf("Check called %d times, want 1 (nil client must bypass cache)", calls)
			}
		})
	}
}

// TestCheckCachedError verifies a Check failure is surfaced rather than
// swallowed, so callers can choose to fail open or closed.
func TestCheckCachedError(t *testing.T) {
	orig := Check
	t.Cleanup(func() { Check = orig })

	wantErr := errors.New("autumn down")
	Check = func(_ context.Context, _, _ string) (*CheckResponse, error) {
		return nil, wantErr
	}

	allowed, err := CheckCached(context.Background(), nil, "cus_1", FeatureBytes)
	if !errors.Is(err, wantErr) {
		t.Errorf("err = %v, want %v", err, wantErr)
	}
	if allowed {
		t.Error("allowed = true, want false on error")
	}
}

// TestCachedCheckNilClientGuards covers the nil-client guards on the cache
// primitives: a get is always a miss and a set is a no-op (must not panic).
func TestCachedCheckNilClientGuards(t *testing.T) {
	if _, ok := GetCachedCheck(context.Background(), nil, "cus_1", FeatureBytes); ok {
		t.Error("GetCachedCheck with nil client: ok = true, want false")
	}
	SetCachedCheck(context.Background(), nil, "cus_1", FeatureBytes, true)
}
