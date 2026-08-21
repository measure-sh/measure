//go:build integration

package handlers

import (
	"context"
	"net/http"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestValidateAPIKey(t *testing.T) {
	ctx := context.Background()

	t.Run("malformed key returns unauthorized", func(t *testing.T) {
		c, w := newTestGinContext(http.MethodGet, "/apps", nil)
		c.Request.Header.Set("Authorization", "Bearer not-a-valid-key")

		h.ValidateAPIKey()(c)

		if w.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusUnauthorized)
		}
		wantJSON(t, w, "error", "invalid api key")
	})

	t.Run("lookup failure returns internal server error", func(t *testing.T) {
		cfg := deps.PgPool.Config().Copy()
		broken, err := pgxpool.NewWithConfig(ctx, cfg)
		if err != nil {
			t.Fatalf("failed to create pool: %v", err)
		}
		broken.Close()

		brokenDeps := *deps
		brokenDeps.PgPool = broken
		brokenH := New(&brokenDeps)

		raw := mustRawAPIKey(t, "some-value")
		c, w := newTestGinContext(http.MethodGet, "/apps", nil)
		c.Request.Header.Set("Authorization", "Bearer "+raw)

		brokenH.ValidateAPIKey()(c)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusInternalServerError)
		}
		wantJSON(t, w, "error", "failed to validate api key")
	})
}
