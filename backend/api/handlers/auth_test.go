//go:build integration

package handlers

import (
	"backend/libs/authsession"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
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

func TestRefreshToken(t *testing.T) {
	ctx := context.Background()

	cfg := *deps.Config
	cfg.AccessTokenSecret = []byte("test-access-secret")
	cfg.RefreshTokenSecret = []byte("test-refresh-secret")
	authDeps := *deps
	authDeps.Config = &cfg
	authH := New(&authDeps)

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/auth/refresh", authH.ValidateRefreshToken(), authH.RefreshToken)
	r.DELETE("/auth/signout", authH.ValidateRefreshToken(), authH.Signout)

	send := func(method, path, refreshToken string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, nil)
		req.Header.Set("Authorization", "Bearer "+refreshToken)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}
	refresh := func(refreshToken string) *httptest.ResponseRecorder {
		return send(http.MethodPost, "/auth/refresh", refreshToken)
	}
	refreshTokenOf := func(t *testing.T, w *httptest.ResponseRecorder) string {
		t.Helper()
		var resp map[string]string
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("decode refresh response: %v", err)
		}
		return resp["refresh_token"]
	}
	startSession := func(t *testing.T) authsession.AuthSession {
		t.Helper()
		cleanupAll(ctx, t)
		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "refresh@example.com")
		session, err := authsession.NewAuthSession(cfg.AccessTokenSecret, cfg.RefreshTokenSecret, userID, "github", []byte(`{}`))
		if err != nil {
			t.Fatalf("new session: %v", err)
		}
		if err := session.Save(ctx, deps.PgPool, nil); err != nil {
			t.Fatalf("save session: %v", err)
		}
		return session
	}
	sessionExists := func(t *testing.T, id uuid.UUID) bool {
		t.Helper()
		_, err := authsession.GetAuthSession(ctx, deps.PgPool, id)
		return err == nil
	}
	ageRotation := func(t *testing.T, id uuid.UUID) {
		t.Helper()
		if _, err := deps.PgPool.Exec(ctx,
			`UPDATE measure.auth_sessions SET rt_rotated_at = now() - interval '1 minute' WHERE id = $1`, id); err != nil {
			t.Fatalf("age rotation: %v", err)
		}
	}

	t.Run("valid refresh rotates the refresh token on the same session", func(t *testing.T) {
		session := startSession(t)

		w := refresh(session.RefreshToken)
		if w.Code != http.StatusOK {
			t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
		}
		if refreshTokenOf(t, w) == session.RefreshToken {
			t.Error("refresh should issue a different refresh token")
		}
		row, err := authsession.GetAuthSession(ctx, deps.PgPool, session.ID)
		if err != nil {
			t.Fatalf("the session should outlive a refresh: %v", err)
		}
		if row.RefreshTokenID == session.RefreshTokenID {
			t.Error("the row should record the new refresh token")
		}
	})

	t.Run("a refresh token presented twice within the reuse window returns the current pair", func(t *testing.T) {
		session := startSession(t)

		w := refresh(session.RefreshToken)
		if w.Code != http.StatusOK {
			t.Fatalf("first refresh: want 200, got %d: %s", w.Code, w.Body.String())
		}
		current := refreshTokenOf(t, w)

		w = refresh(session.RefreshToken)
		if w.Code != http.StatusOK {
			t.Fatalf("second use: want 200, got %d: %s", w.Code, w.Body.String())
		}
		if refreshTokenOf(t, w) != current {
			t.Error("a repeat within the window should return the current refresh token")
		}
	})

	t.Run("a refresh token presented twice after the reuse window removes the session", func(t *testing.T) {
		session := startSession(t)

		if w := refresh(session.RefreshToken); w.Code != http.StatusOK {
			t.Fatalf("first refresh: want 200, got %d: %s", w.Code, w.Body.String())
		}
		ageRotation(t, session.ID)

		if w := refresh(session.RefreshToken); w.Code != http.StatusUnauthorized {
			t.Fatalf("second use: want 401, got %d: %s", w.Code, w.Body.String())
		}
		if sessionExists(t, session.ID) {
			t.Error("reusing a refresh token should remove the session")
		}
	})

	t.Run("a refresh token older than the last rotation removes the session within the reuse window", func(t *testing.T) {
		session := startSession(t)

		w := refresh(session.RefreshToken)
		if w.Code != http.StatusOK {
			t.Fatalf("first refresh: want 200, got %d: %s", w.Code, w.Body.String())
		}
		if w := refresh(refreshTokenOf(t, w)); w.Code != http.StatusOK {
			t.Fatalf("second refresh: want 200, got %d: %s", w.Code, w.Body.String())
		}

		if w := refresh(session.RefreshToken); w.Code != http.StatusUnauthorized {
			t.Fatalf("oldest token: want 401, got %d: %s", w.Code, w.Body.String())
		}
		if sessionExists(t, session.ID) {
			t.Error("a token older than the last rotation should remove the session")
		}
	})

	t.Run("a refresh token the session never issued removes it", func(t *testing.T) {
		session := startSession(t)

		stray, err := authsession.CreateRefreshToken(cfg.RefreshTokenSecret, uuid.New(), session.ID, session.RefreshTokenExpiryAt, "")
		if err != nil {
			t.Fatalf("sign refresh token: %v", err)
		}
		if w := refresh(stray); w.Code != http.StatusUnauthorized {
			t.Fatalf("want 401, got %d: %s", w.Code, w.Body.String())
		}
		if sessionExists(t, session.ID) {
			t.Error("a refresh token the session never issued should remove it")
		}
	})

	t.Run("concurrent refreshes with one token all get the same pair", func(t *testing.T) {
		session := startSession(t)

		const n = 8
		results := make([]*httptest.ResponseRecorder, n)
		var wg sync.WaitGroup
		for i := range n {
			wg.Add(1)
			go func() {
				defer wg.Done()
				results[i] = refresh(session.RefreshToken)
			}()
		}
		wg.Wait()

		want := ""
		for i, w := range results {
			if w.Code != http.StatusOK {
				t.Fatalf("refresh %d: want 200, got %d: %s", i, w.Code, w.Body.String())
			}
			got := refreshTokenOf(t, w)
			if want == "" {
				want = got
			}
			if got != want {
				t.Errorf("refresh %d returned a different refresh token", i)
			}
		}
		if !sessionExists(t, session.ID) {
			t.Error("concurrent refreshes should keep the session")
		}
	})

	t.Run("a refresh token without a sid claim is rejected", func(t *testing.T) {
		session := startSession(t)
		legacy, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"jti": session.ID.String(),
			"exp": time.Now().Add(time.Hour).Unix(),
		}).SignedString(cfg.RefreshTokenSecret)
		if err != nil {
			t.Fatalf("sign legacy refresh token: %v", err)
		}

		if w := refresh(legacy); w.Code != http.StatusUnauthorized {
			t.Fatalf("want 401, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("signout with a rotated refresh token removes the session", func(t *testing.T) {
		session := startSession(t)

		w := refresh(session.RefreshToken)
		if w.Code != http.StatusOK {
			t.Fatalf("refresh: want 200, got %d: %s", w.Code, w.Body.String())
		}
		if w := send(http.MethodDelete, "/auth/signout", refreshTokenOf(t, w)); w.Code != http.StatusOK {
			t.Fatalf("signout: want 200, got %d: %s", w.Code, w.Body.String())
		}
		if sessionExists(t, session.ID) {
			t.Error("signout should remove the session")
		}
	})
}
