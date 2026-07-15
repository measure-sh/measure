// Package chquery composes ClickHouse per-query settings on a context. Its one
// mutating primitive, WithSettings, merges into the settings already carried by
// the context instead of replacing them, so a global setting (team scope) & local
// per-query settings (log_comment, cache flags) compose without clobbering.
//
// It is the only place application code sets ClickHouse settings; callers never
// invoke clickhouse.WithSettings directly. The reader pool wrapper reads the
// carried settings back to fail loud when a required scope is missing.
package chquery

import (
	"context"
	"fmt"
	"maps"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/google/uuid"
)

const (
	// ReaderScopeKey scopes reader role queries to a team via the
	// team_isolation row policy.
	ReaderScopeKey = "SQL_reader_team_id"
	// AgentScopeKey scopes agent_sql role queries to a team via the
	// agent_team_isolation row policy.
	AgentScopeKey = "SQL_agent_team_id"
)

// settingsKey is the private carrier for the merged settings map. Unlike the
// clickhouse-go context, we can read this back, which is what makes merge work.
type settingsKey struct{}

// WithSettings merges s into the query settings carried by ctx & applies the
// full set to ClickHouse. It never replaces prior settings. Each call derives a
// fresh map, so sequential calls compose & concurrent calls do not race.
func WithSettings(ctx context.Context, s clickhouse.Settings) context.Context {
	merged := clickhouse.Settings{}
	if prev, ok := ctx.Value(settingsKey{}).(clickhouse.Settings); ok {
		maps.Copy(merged, prev)
	}
	maps.Copy(merged, s)

	ctx = context.WithValue(ctx, settingsKey{}, merged)
	return clickhouse.Context(ctx, clickhouse.WithSettings(merged))
}

// WithTeamScope merges the reader row policy team scope. Set it wherever a
// reader query is issued, from the trusted team id.
func WithTeamScope(ctx context.Context, teamID uuid.UUID) context.Context {
	return WithSettings(ctx, clickhouse.Settings{
		ReaderScopeKey: clickhouse.CustomSetting{Value: teamID.String()},
	})
}

// WithAgentScope merges the agent_sql row policy team scope for the run_sql path.
func WithAgentScope(ctx context.Context, teamID uuid.UUID) context.Context {
	return WithSettings(ctx, clickhouse.Settings{
		AgentScopeKey: clickhouse.CustomSetting{Value: teamID.String()},
	})
}

// RequireScope returns an error if the named scope setting is not carried by
// ctx. The reader pool wrapper uses it to fail loud rather than return zero rows.
func RequireScope(ctx context.Context, key string) (err error) {
	s, ok := ctx.Value(settingsKey{}).(clickhouse.Settings)
	if !ok {
		return fmt.Errorf("clickhouse query missing scope %q", key)
	}
	if _, ok := s[key]; !ok {
		return fmt.Errorf("clickhouse query missing scope %q", key)
	}
	return nil
}
