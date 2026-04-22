package measure

import (
	"context"
	"errors"
	"fmt"
	"log"

	"backend/autumn"
	"backend/ingest/server"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
	valkey "github.com/valkey-io/valkey-go"
)

// autumnCheckCacheTTL bounds how long we trust a cached autumn.Check verdict.
// Short enough that a plan transition (upgrade, downgrade, limit-reached)
// surfaces within roughly a minute even without explicit invalidation.
const autumnCheckCacheTTLSeconds = 60

// autumnCheckCacheKey is the Valkey key for a customer's cached ingest
// verdict. Namespaced with the feature so future per-feature caches don't
// collide.
func autumnCheckCacheKey(customerID string) string {
	return fmt.Sprintf("autumn:check:bytes:{%s}", customerID)
}

// CheckIngestAllowedForApp asks Autumn whether the team owning the given app
// is allowed to ingest. Returns nil if allowed. Fail-open on any dependency
// error so a transient Autumn or DB outage does not block customers.
//
// Caches the autumn.Check verdict in Valkey for autumnCheckCacheTTLSeconds.
// Cache misses fall through to autumn.Check and populate the cache.
// Valkey errors fall back to a direct autumn.Check (don't fail).
func CheckIngestAllowedForApp(ctx context.Context, appId uuid.UUID) error {
	if !server.Server.Config.IsBillingEnabled() {
		return nil
	}

	customerID, err := getAutumnCustomerIDForApp(ctx, appId)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("app not found: %s", appId)
		}
		log.Printf("ingest check: pg lookup failed for app %s: %v", appId, err)
		return nil // fail open
	}
	if customerID == "" {
		return nil // team not yet provisioned
	}

	if allowed, ok := getCachedAutumnCheck(ctx, server.Server.VK, customerID); ok {
		if !allowed {
			return fmt.Errorf("ingestion blocked: plan limit reached")
		}
		return nil
	}

	resp, err := autumn.Check(ctx, customerID, autumn.FeatureBytes)
	if err != nil {
		if autumn.IsServerOrNetworkError(err) {
			log.Printf("ingest check: autumn unavailable, failing open (customer=%s): %v", customerID, err)
		} else {
			log.Printf("ERROR ingest check: autumn client error — check config (customer=%s): %v", customerID, err)
		}
		return nil // still fail open on 4xx — config bug shouldn't block ingestion for users
	}

	setCachedAutumnCheck(ctx, server.Server.VK, customerID, resp.Allowed)

	if !resp.Allowed {
		return fmt.Errorf("ingestion blocked: plan limit reached")
	}
	return nil
}

// getCachedAutumnCheck returns (allowed, true) on cache hit, (_, false) on
// miss or any Valkey error. Errors are logged but never surfaced — the caller
// falls back to autumn.Check.
func getCachedAutumnCheck(ctx context.Context, vk valkey.Client, customerID string) (bool, bool) {
	if vk == nil {
		return false, false
	}
	cmd := vk.B().Get().Key(autumnCheckCacheKey(customerID)).Build()
	result := vk.Do(ctx, cmd)
	if err := result.Error(); err != nil {
		// If it's the no-key-exists error, that's expected and no need to log.
		// If it's anything else (connection refused, malformed response, network glitch), log it.
		if !valkey.IsValkeyNil(err) {
			log.Printf("ingest check: valkey get failed (customer=%s): %v", customerID, err)
		}
		return false, false
	}
	str, err := result.ToString()
	if err != nil {
		log.Printf("ingest check: valkey decode failed (customer=%s): %v", customerID, err)
		return false, false
	}
	return str == "1", true
}

// setCachedAutumnCheck stores the verdict in Valkey with a short TTL.
// Errors are logged but never surfaced — the caller already has the verdict.
func setCachedAutumnCheck(ctx context.Context, vk valkey.Client, customerID string, allowed bool) {
	if vk == nil {
		return
	}
	value := "0"
	if allowed {
		value = "1"
	}
	cmd := vk.B().Set().Key(autumnCheckCacheKey(customerID)).Value(value).ExSeconds(autumnCheckCacheTTLSeconds).Build()
	if err := vk.Do(ctx, cmd).Error(); err != nil {
		log.Printf("ingest check: valkey set failed (customer=%s): %v", customerID, err)
	}
}

func getAutumnCustomerIDForApp(ctx context.Context, appID uuid.UUID) (string, error) {
	stmt := sqlf.PostgreSQL.
		Select("t.autumn_customer_id").
		From("apps a").
		Join("teams t", "a.team_id = t.id").
		Where("a.id = ?", appID)
	defer stmt.Close()

	var customerID *string
	err := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&customerID)
	if err != nil {
		return "", err
	}
	if customerID == nil {
		return "", nil
	}
	return *customerID, nil
}
