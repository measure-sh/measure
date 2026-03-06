package measure

import (
	"backend/billing"
	"backend/ingest/server"
	"context"

	"github.com/google/uuid"
)

func CheckIngestAllowedForApp(ctx context.Context, appId uuid.UUID) error {
	if !server.Server.Config.IsBillingEnabled() {
		return nil
	}
	return billing.IsIngestAllowed(ctx, server.Server.PgPool, server.Server.VK, appId)
}
