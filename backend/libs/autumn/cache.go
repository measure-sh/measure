package autumn

import (
	"context"
	"fmt"
	"log"

	valkey "github.com/valkey-io/valkey-go"
)

// CheckCacheTTLSeconds bounds how long a cached Check verdict is trusted. Short
// enough that a plan change surfaces within about a minute with no explicit
// invalidation.
const CheckCacheTTLSeconds = 60

// CheckCacheKey is the Valkey key holding a customer's cached Check verdict for
// featureID. The customer id is brace-wrapped so all of a customer's keys hash
// to one cluster slot.
func CheckCacheKey(customerID, featureID string) string {
	return fmt.Sprintf("autumn:check:%s:{%s}", featureID, customerID)
}

// CheckCached reports whether customerID is allowed to use featureID, reading
// Valkey first and calling the Autumn API only on a miss. Caching is
// best-effort, so a nil client or any Valkey trouble falls back to a direct
// Check. The error is the underlying Check's and is never cached; callers
// decide whether to fail open or closed.
func CheckCached(ctx context.Context, vk valkey.Client, customerID, featureID string) (bool, error) {
	if allowed, ok := GetCachedCheck(ctx, vk, customerID, featureID); ok {
		return allowed, nil
	}
	resp, err := Check(ctx, customerID, featureID)
	if err != nil {
		return false, err
	}
	SetCachedCheck(ctx, vk, customerID, featureID, resp.Allowed)
	return resp.Allowed, nil
}

// GetCachedCheck returns a cached verdict and whether there was one. Valkey
// trouble is logged and reported as a miss.
func GetCachedCheck(ctx context.Context, vk valkey.Client, customerID, featureID string) (bool, bool) {
	if vk == nil {
		return false, false
	}
	cmd := vk.B().Get().Key(CheckCacheKey(customerID, featureID)).Build()
	result := vk.Do(ctx, cmd)
	if err := result.Error(); err != nil {
		// A missing key is expected; log anything else.
		if !valkey.IsValkeyNil(err) {
			log.Printf("autumn cache: valkey get failed (customer=%s feature=%s): %v", customerID, featureID, err)
		}
		return false, false
	}
	str, err := result.ToString()
	if err != nil {
		log.Printf("autumn cache: valkey decode failed (customer=%s feature=%s): %v", customerID, featureID, err)
		return false, false
	}
	return str == "1", true
}

// SetCachedCheck caches allowed for customerID and featureID.
func SetCachedCheck(ctx context.Context, vk valkey.Client, customerID, featureID string, allowed bool) {
	if vk == nil {
		return
	}
	value := "0"
	if allowed {
		value = "1"
	}
	cmd := vk.B().Set().Key(CheckCacheKey(customerID, featureID)).Value(value).ExSeconds(CheckCacheTTLSeconds).Build()
	if err := vk.Do(ctx, cmd).Error(); err != nil {
		log.Printf("autumn cache: valkey set failed (customer=%s feature=%s): %v", customerID, featureID, err)
	}
}
