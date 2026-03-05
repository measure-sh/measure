package ambient

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

// teamIdKey is an unexported context key for
// storing team id
type teamIdKey struct{}

// WithTeamId stores the team id in context
func WithTeamId(ctx context.Context, teamId uuid.UUID) context.Context {
	return context.WithValue(ctx, teamIdKey{}, teamId)
}

// TeamId retrieves the team id from context
func TeamId(ctx context.Context) (teamId uuid.UUID, err error) {
	val := ctx.Value(teamIdKey{})
	if val == nil {
		err = errors.New("team id not found in context")
		return
	}

	teamId, ok := val.(uuid.UUID)
	if !ok {
		err = errors.New("team id is not a valid uuid")
		return
	}

	return
}
