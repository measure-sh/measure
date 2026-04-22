package measure

import (
	"context"
	"log"

	"backend/autumn"
	"backend/ingest-worker/server"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// trackBatchBytes reports a successfully-persisted batch's size to Autumn.
// Must be called as the last step of batch processing — anything that runs
// after this would be replayed on retry, but Track happens after remember()
// so the next delivery is dropped by checkSeen and we don't double-bill.
//
// Best-effort: errors are logged and swallowed. Bare context.Background() so
// the call survives the worker's per-batch context cancellation.
func trackBatchBytes(teamID uuid.UUID, size uint64) {
	if !server.Server.Config.IsBillingEnabled() || size == 0 {
		return
	}
	go func() {
		ctx := context.Background()
		customerID, err := getAutumnCustomerIDForTeam(ctx, teamID)
		if err != nil {
			log.Printf("autumn track: pg lookup failed (team=%s): %v", teamID, err)
			return
		}
		if customerID == "" {
			return // team not yet provisioned in Autumn — skip silently
		}
		if err := autumn.Track(ctx, customerID, autumn.FeatureBytes, float64(size)); err != nil {
			if autumn.IsServerOrNetworkError(err) {
				log.Printf("autumn track: Autumn unavailable, dropping (team=%s): %v", teamID, err)
			} else {
				log.Printf("ERROR autumn track: client error — check config (team=%s): %v", teamID, err)
			}
		}
	}()
}

func getAutumnCustomerIDForTeam(ctx context.Context, teamID uuid.UUID) (string, error) {
	stmt := sqlf.PostgreSQL.
		Select("autumn_customer_id").
		From("teams").
		Where("id = ?", teamID)
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
