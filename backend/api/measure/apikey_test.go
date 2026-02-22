//go:build integration

package measure

import (
	"backend/api/cipher"
	"backend/api/server"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func mustRawAPIKey(t *testing.T, value string) string {
	t.Helper()
	checksum, err := cipher.ComputeChecksum([]byte(value))
	if err != nil {
		t.Fatalf("compute checksum: %v", err)
	}
	return fmt.Sprintf("%s_%s_%s", APIKeyPrefix, value, *checksum)
}

func TestAPIKeyString(t *testing.T) {
	k := &APIKey{keyPrefix: APIKeyPrefix, keyValue: "abc", checksum: "def"}
	if got, want := k.String(), "msrsh_abc_def"; got != want {
		t.Fatalf("String() = %q, want %q", got, want)
	}
}

func TestAPIKeyMarshalJSON(t *testing.T) {
	t.Run("without last seen", func(t *testing.T) {
		createdAt := time.Now().UTC().Truncate(time.Second)
		k := APIKey{keyPrefix: APIKeyPrefix, keyValue: "abc", checksum: "def", revoked: false, createdAt: createdAt}

		b, err := k.MarshalJSON()
		if err != nil {
			t.Fatalf("MarshalJSON: %v", err)
		}

		var m map[string]any
		if err := json.Unmarshal(b, &m); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}

		if m["key"] != "msrsh_abc_def" {
			t.Fatalf("key = %v, want %q", m["key"], "msrsh_abc_def")
		}
		if m["revoked"] != false {
			t.Fatalf("revoked = %v, want false", m["revoked"])
		}
		if m["last_seen"] != nil {
			t.Fatalf("last_seen = %v, want nil", m["last_seen"])
		}
	})

	t.Run("with last seen", func(t *testing.T) {
		now := time.Now().UTC().Truncate(time.Second)
		k := APIKey{keyPrefix: APIKeyPrefix, keyValue: "abc", checksum: "def", revoked: true, createdAt: now, lastSeen: now}

		b, err := k.MarshalJSON()
		if err != nil {
			t.Fatalf("MarshalJSON: %v", err)
		}

		var m map[string]any
		if err := json.Unmarshal(b, &m); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}

		if m["revoked"] != true {
			t.Fatalf("revoked = %v, want true", m["revoked"])
		}
		if m["last_seen"] == nil {
			t.Fatalf("last_seen = nil, want value")
		}
	})
}

func TestNewAPIKey(t *testing.T) {
	appID := uuid.New()
	k, err := NewAPIKey(appID)
	if err != nil {
		t.Fatalf("NewAPIKey: %v", err)
	}
	if k.appId != appID {
		t.Fatalf("appId = %s, want %s", k.appId, appID)
	}
	if k.keyPrefix != APIKeyPrefix {
		t.Fatalf("keyPrefix = %q, want %q", k.keyPrefix, APIKeyPrefix)
	}
	if len(k.keyValue) != 64 {
		t.Fatalf("keyValue len = %d, want 64", len(k.keyValue))
	}
	if len(k.checksum) == 0 {
		t.Fatalf("checksum empty")
	}
	if k.createdAt.IsZero() {
		t.Fatalf("createdAt is zero")
	}
}

func TestAPIKeyDBOps(t *testing.T) {
	ctx := context.Background()

	t.Run("saveTx inserts api key", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "team", true)
		seedApp(ctx, t, appID, teamID, 30)

		tx, err := server.Server.PgPool.Begin(ctx)
		if err != nil {
			t.Fatalf("begin tx: %v", err)
		}
		defer tx.Rollback(ctx)

		k, err := NewAPIKey(appID)
		if err != nil {
			t.Fatalf("NewAPIKey: %v", err)
		}
		if err := k.saveTx(tx); err != nil {
			t.Fatalf("saveTx: %v", err)
		}
		if err := tx.Commit(ctx); err != nil {
			t.Fatalf("commit: %v", err)
		}

		row := getAPIKeyByValue(ctx, t, k.keyValue)
		if row == nil {
			t.Fatalf("api key row not found")
		}
		if row.AppID != appID {
			t.Fatalf("app_id = %s, want %s", row.AppID, appID)
		}
	})

	t.Run("updateLastSeenForApiKey updates timestamp", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "team", true)
		seedApp(ctx, t, appID, teamID, 30)

		k := "value-last-seen"
		raw := mustRawAPIKey(t, k)
		parts := raw[len(APIKeyPrefix)+1:]
		checksum := parts[len(k)+1:]
		seedAPIKey(ctx, t, appID, APIKeyPrefix, k, checksum, false, nil, time.Now().UTC())

		row := getAPIKeyByValue(ctx, t, k)
		if row == nil {
			t.Fatalf("seeded row missing")
		}

		if err := updateLastSeenForApiKey(ctx, row.ID); err != nil {
			t.Fatalf("updateLastSeenForApiKey: %v", err)
		}

		updated := getAPIKeyByValue(ctx, t, k)
		if updated == nil || updated.LastSeen == nil {
			t.Fatalf("last_seen not set")
		}
	})

	t.Run("saveTx fails for non-existent app id", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		tx, err := server.Server.PgPool.Begin(ctx)
		if err != nil {
			t.Fatalf("begin tx: %v", err)
		}
		defer tx.Rollback(ctx)

		k := &APIKey{
			appId:     uuid.New(),
			keyPrefix: APIKeyPrefix,
			keyValue:  "fk-violation-value",
			checksum:  "checksum1",
			createdAt: time.Now().UTC(),
		}

		if err := k.saveTx(tx); err == nil {
			t.Fatalf("expected saveTx error for non-existent app id")
		}
	})
}

func TestDecodeAPIKey(t *testing.T) {
	ctx := context.Background()

	t.Run("invalid key formats", func(t *testing.T) {
		cases := []string{"", "abc", "bad_prefix_x_y", "msrsh_only_two_parts", "msrsh_value_badchecksum"}
		for _, tc := range cases {
			_, err := DecodeAPIKey(ctx, tc)
			if err == nil {
				t.Fatalf("DecodeAPIKey(%q) expected error", tc)
			}
		}
	})

	t.Run("valid format but unknown key returns nil app", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		raw := mustRawAPIKey(t, "unknownvalue")
		appID, err := DecodeAPIKey(ctx, raw)
		if err != nil {
			t.Fatalf("DecodeAPIKey: %v", err)
		}
		if appID != nil {
			t.Fatalf("appID = %v, want nil", appID)
		}
	})

	t.Run("revoked key returns nil app", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "team", true)
		seedApp(ctx, t, appID, teamID, 30)

		value := "revoked-value"
		raw := mustRawAPIKey(t, value)
		parts := raw[len(APIKeyPrefix)+1:]
		checksum := parts[len(value)+1:]
		seedAPIKey(ctx, t, appID, APIKeyPrefix, value, checksum, true, nil, time.Now().UTC())

		decoded, err := DecodeAPIKey(ctx, raw)
		if err != nil {
			t.Fatalf("DecodeAPIKey: %v", err)
		}
		if decoded != nil {
			t.Fatalf("decoded appID = %v, want nil", decoded)
		}

		row := getAPIKeyByValue(ctx, t, value)
		if row == nil {
			t.Fatalf("row missing")
		}
		if row.LastSeen != nil {
			t.Fatalf("revoked key last_seen = %v, want nil", row.LastSeen)
		}
	})

	t.Run("active key returns app and updates last_seen", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "team", true)
		seedApp(ctx, t, appID, teamID, 30)

		value := "active-value"
		raw := mustRawAPIKey(t, value)
		parts := raw[len(APIKeyPrefix)+1:]
		checksum := parts[len(value)+1:]
		seedAPIKey(ctx, t, appID, APIKeyPrefix, value, checksum, false, nil, time.Now().UTC())

		decoded, err := DecodeAPIKey(ctx, raw)
		if err != nil {
			t.Fatalf("DecodeAPIKey: %v", err)
		}
		if decoded == nil || *decoded != appID {
			t.Fatalf("decoded appID = %v, want %s", decoded, appID)
		}

		row := getAPIKeyByValue(ctx, t, value)
		if row == nil || row.LastSeen == nil {
			t.Fatalf("last_seen not updated")
		}
	})

	t.Run("wrong prefix but valid checksum format is invalid", func(t *testing.T) {
		_, err := DecodeAPIKey(ctx, "badprefix_value_12345678")
		if err == nil {
			t.Fatalf("expected error for wrong prefix")
		}
	})
}

func TestRotateAPIKeyMethod(t *testing.T) {
	ctx := context.Background()

	t.Run("creates first key when no existing keys", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "team", true)
		seedApp(ctx, t, appID, teamID, 30)

		app := App{ID: &appID}
		newKey, err := app.rotateAPIKey()
		if err != nil {
			t.Fatalf("rotateAPIKey: %v", err)
		}
		if newKey == nil {
			t.Fatalf("new key is nil")
		}

		rows := getAPIKeysByAppID(ctx, t, appID)
		if len(rows) != 1 {
			t.Fatalf("api key count = %d, want 1", len(rows))
		}
		if rows[0].Revoked {
			t.Fatalf("new key is revoked, want active")
		}
	})

	t.Run("revokes all previous keys and keeps only new key active", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "team", true)
		seedApp(ctx, t, appID, teamID, 30)

		oldValue := "old-active"
		oldRaw := mustRawAPIKey(t, oldValue)
		oldChecksum := oldRaw[len(APIKeyPrefix)+1+len(oldValue)+1:]
		seedAPIKey(ctx, t, appID, APIKeyPrefix, oldValue, oldChecksum, false, nil, time.Now().UTC().Add(-2*time.Hour))

		revokedValue := "old-revoked"
		revokedRaw := mustRawAPIKey(t, revokedValue)
		revokedChecksum := revokedRaw[len(APIKeyPrefix)+1+len(revokedValue)+1:]
		seedAPIKey(ctx, t, appID, APIKeyPrefix, revokedValue, revokedChecksum, true, nil, time.Now().UTC().Add(-time.Hour))

		app := App{ID: &appID}
		newKey, err := app.rotateAPIKey()
		if err != nil {
			t.Fatalf("rotateAPIKey: %v", err)
		}
		if newKey == nil {
			t.Fatalf("new key is nil")
		}

		rows := getAPIKeysByAppID(ctx, t, appID)
		if len(rows) != 3 {
			t.Fatalf("api key count = %d, want 3", len(rows))
		}

		activeCount := 0
		for _, r := range rows {
			if !r.Revoked {
				activeCount++
				if r.KeyValue != newKey.keyValue {
					t.Fatalf("unexpected active key value = %s, want %s", r.KeyValue, newKey.keyValue)
				}
			}
		}
		if activeCount != 1 {
			t.Fatalf("active key count = %d, want 1", activeCount)
		}
	})

	t.Run("handles multiple active keys and leaves one active", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "team", true)
		seedApp(ctx, t, appID, teamID, 30)

		for _, value := range []string{"active-a", "active-b", "active-c"} {
			raw := mustRawAPIKey(t, value)
			checksum := raw[len(APIKeyPrefix)+1+len(value)+1:]
			seedAPIKey(ctx, t, appID, APIKeyPrefix, value, checksum, false, nil, time.Now().UTC())
		}

		app := App{ID: &appID}
		newKey, err := app.rotateAPIKey()
		if err != nil {
			t.Fatalf("rotateAPIKey: %v", err)
		}

		rows := getAPIKeysByAppID(ctx, t, appID)
		if len(rows) != 4 {
			t.Fatalf("api key count = %d, want 4", len(rows))
		}

		activeCount := 0
		for _, r := range rows {
			if !r.Revoked {
				activeCount++
				if r.KeyValue != newKey.keyValue {
					t.Fatalf("unexpected active key value = %s, want %s", r.KeyValue, newKey.keyValue)
				}
			}
		}
		if activeCount != 1 {
			t.Fatalf("active key count = %d, want 1", activeCount)
		}
	})

	t.Run("fails when app does not exist", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		missingAppID := uuid.New()
		app := App{ID: &missingAppID}
		if _, err := app.rotateAPIKey(); err == nil {
			t.Fatalf("expected rotateAPIKey error for non-existent app")
		}
	})
}

func TestRotateApiKeyHandler(t *testing.T) {
	ctx := context.Background()

	t.Run("invalid app id", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		c, w := newTestGinContext(http.MethodPatch, "/apps/invalid/apiKey", nil)
		c.Set("userId", uuid.New().String())
		c.Params = gin.Params{{Key: "id", Value: "invalid"}}

		RotateApiKey(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
		}
		wantJSONContains(t, w, "error", "app id invalid or missing")
	})

	t.Run("app has no team", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		appID := uuid.New()
		c, w := newTestGinContext(http.MethodPatch, "/apps/"+appID.String()+"/apiKey", nil)
		c.Set("userId", uuid.New().String())
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}

		RotateApiKey(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
		}
		wantJSONContains(t, w, "error", "no team exists for app")
	})

	t.Run("no membership returns auth error", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		appID := uuid.New()
		seedUser(ctx, t, userID, "noauth-apikey@test.com")
		seedTeam(ctx, t, teamID, "team", true)
		seedApp(ctx, t, appID, teamID, 30)

		c, w := newTestGinContext(http.MethodPatch, "/apps/"+appID.String()+"/apiKey", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}

		RotateApiKey(c)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusInternalServerError)
		}
		wantJSONContains(t, w, "error", "couldn't perform authorization checks")
	})

	t.Run("all roles authz behavior", func(t *testing.T) {
		testCases := []struct {
			name       string
			role       string
			wantStatus int
		}{
			{name: "viewer forbidden", role: "viewer", wantStatus: http.StatusForbidden},
			{name: "developer forbidden", role: "developer", wantStatus: http.StatusForbidden},
			{name: "admin can rotate", role: "admin", wantStatus: http.StatusOK},
			{name: "owner can rotate", role: "owner", wantStatus: http.StatusOK},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				defer cleanupAll(ctx, t)

				userID := uuid.New().String()
				teamID := uuid.New()
				appID := uuid.New()
				seedUser(ctx, t, userID, fmt.Sprintf("%s-apikey@test.com", tc.role))
				seedTeam(ctx, t, teamID, "team", true)
				seedTeamMembership(ctx, t, teamID, userID, tc.role)
				seedApp(ctx, t, appID, teamID, 30)

				oldValue := "handler-old-active"
				oldRaw := mustRawAPIKey(t, oldValue)
				oldChecksum := oldRaw[len(APIKeyPrefix)+1+len(oldValue)+1:]
				seedAPIKey(ctx, t, appID, APIKeyPrefix, oldValue, oldChecksum, false, nil, time.Now().UTC().Add(-time.Hour))

				c, w := newTestGinContext(http.MethodPatch, "/apps/"+appID.String()+"/apiKey", nil)
				c.Set("userId", userID)
				c.Params = gin.Params{{Key: "id", Value: appID.String()}}

				RotateApiKey(c)

				if w.Code != tc.wantStatus {
					t.Fatalf("status = %d, want %d, body: %s", w.Code, tc.wantStatus, w.Body.String())
				}

				if tc.wantStatus == http.StatusForbidden {
					wantJSONContains(t, w, "error", "don't have permissions")
					return
				}

				wantJSON(t, w, "ok", "done")

				var resp map[string]any
				if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
					t.Fatalf("unmarshal resp: %v", err)
				}
				apiKeyObj, ok := resp["api_key"].(map[string]any)
				if !ok {
					t.Fatalf("api_key missing in response")
				}
				if _, ok := apiKeyObj["key"].(string); !ok {
					t.Fatalf("api_key.key missing in response")
				}
				if gotRevoked, ok := apiKeyObj["revoked"].(bool); !ok || gotRevoked {
					t.Fatalf("api_key.revoked = %v, want false", apiKeyObj["revoked"])
				}
				if _, ok := apiKeyObj["created_at"].(string); !ok {
					t.Fatalf("api_key.created_at missing in response")
				}

				rows := getAPIKeysByAppID(ctx, t, appID)
				activeCount := 0
				for _, r := range rows {
					if !r.Revoked {
						activeCount++
					}
				}
				if activeCount != 1 {
					t.Fatalf("active key count = %d, want 1", activeCount)
				}
			})
		}
	})

	t.Run("missing user id in context returns auth error", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "team", true)
		seedApp(ctx, t, appID, teamID, 30)

		c, w := newTestGinContext(http.MethodPatch, "/apps/"+appID.String()+"/apiKey", nil)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}

		RotateApiKey(c)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusInternalServerError)
		}
		wantJSONContains(t, w, "error", "couldn't perform authorization checks")
	})
}
