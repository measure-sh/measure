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
)

// CheckIngestAllowedForApp asks Autumn whether the team owning the given app is
// allowed to ingest. Returns nil if allowed; fail-open on any dependency error
// so a transient Autumn or DB outage does not block customers. The verdict is
// cached (autumn.CheckCached).
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

	allowed, err := autumn.CheckCached(ctx, server.Server.VK, customerID, autumn.FeatureBytes)
	if err != nil {
		if autumn.IsServerOrNetworkError(err) {
			log.Printf("ingest check: autumn unavailable, failing open (customer=%s): %v", customerID, err)
		} else {
			log.Printf("ERROR ingest check: autumn client error — check config (customer=%s): %v", customerID, err)
		}
		return nil // still fail open on 4xx — config bug shouldn't block ingestion for users
	}
	if !allowed {
		return fmt.Errorf("ingestion blocked: plan limit reached")
	}
	return nil
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
