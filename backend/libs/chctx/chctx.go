// Package chctx provides helpers to inject ClickHouse per-query settings
// from Go context. The primary use is the team_isolation row policy: every
// reader-pool query must carry the team_id as a ClickHouse session setting
// so the row policy enforced on the reader role can filter rows by team.
package chctx

import (
	"context"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/google/uuid"
)

// WithReaderTeamScope returns a context that injects the team_id for the
// team_isolation row policy enforced on the reader role. Every RchPool read
// must be wrapped with this; a missing setting makes the row policy match
// zero rows (fail-closed).
func WithReaderTeamScope(ctx context.Context, teamID uuid.UUID) context.Context {
	return clickhouse.Context(ctx, clickhouse.WithSettings(clickhouse.Settings{
		// CustomSetting sets the native-protocol custom flag (0x02) so the
		// server honors the SQL_ prefix; a plain string is rejected as unknown.
		"SQL_reader_team_id": clickhouse.CustomSetting{Value: teamID.String()},
	}))
}
