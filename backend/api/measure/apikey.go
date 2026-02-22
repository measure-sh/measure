package measure

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"backend/api/chrono"
	"backend/api/cipher"
	"backend/api/server"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

const APIKeyPrefix = "msrsh"

type APIKey struct {
	appId     uuid.UUID
	keyPrefix string
	keyValue  string
	checksum  string
	revoked   bool
	lastSeen  time.Time
	createdAt time.Time
}

func (a APIKey) MarshalJSON() ([]byte, error) {
	apiMap := make(map[string]any)

	apiMap["key"] = a.String()
	apiMap["revoked"] = a.revoked
	apiMap["created_at"] = a.createdAt.Format(chrono.ISOFormatJS)
	if a.lastSeen.IsZero() {
		apiMap["last_seen"] = nil
	} else {
		apiMap["last_seen"] = a.lastSeen.Format(chrono.ISOFormatJS)
	}
	return json.Marshal(apiMap)
}

func NewAPIKey(appId uuid.UUID) (*APIKey, error) {
	bytes := make([]byte, 32)
	_, err := rand.Read(bytes)
	if err != nil {
		fmt.Println(err)
		return nil, err
	}

	byteString := hex.EncodeToString(bytes)

	checksum, err := cipher.ComputeChecksum([]byte(byteString))
	if err != nil {
		return nil, err
	}

	return &APIKey{
		appId:     appId,
		keyPrefix: APIKeyPrefix,
		keyValue:  byteString,
		checksum:  *checksum,
		createdAt: time.Now(),
	}, nil
}

func (a *APIKey) saveTx(tx pgx.Tx) error {
	_, err := tx.Exec(context.Background(), "insert into api_keys(app_id, key_prefix, key_value, checksum, created_at) values ($1, $2, $3, $4, $5);", a.appId, a.keyPrefix, a.keyValue, a.checksum, a.createdAt)

	if err != nil {
		return err
	}

	return nil
}

func (a *APIKey) String() string {
	return fmt.Sprintf("%s_%s_%s", a.keyPrefix, a.keyValue, a.checksum)
}

func updateLastSeenForApiKey(ctx context.Context, apiKeyId uuid.UUID) error {
	stmt := sqlf.PostgreSQL.Update("api_keys").
		Set("last_seen", time.Now()).
		Where("id = ?", apiKeyId)
	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	return err
}

func (a App) rotateAPIKey() (*APIKey, error) {
	ctx := context.Background()
	apiKey, err := NewAPIKey(*a.ID)
	if err != nil {
		return nil, err
	}

	tx, err := server.Server.PgPool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if err := apiKey.saveTx(tx); err != nil {
		return nil, err
	}

	stmt := sqlf.PostgreSQL.Update("api_keys").
		Set("revoked", true).
		Where("app_id = ?", a.ID).
		Where("key_value <> ?", apiKey.keyValue)
	defer stmt.Close()

	if _, err := tx.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return apiKey, nil
}

func DecodeAPIKey(ctx context.Context, key string) (*uuid.UUID, error) {
	defaultErr := errors.New("invalid api key")

	if len(key) < 1 {
		return nil, defaultErr
	}

	parts := strings.Split(key, "_")

	if len(parts) != 3 {
		return nil, defaultErr
	}

	prefix := parts[0]
	value := parts[1]
	checksum := parts[2]

	if prefix != APIKeyPrefix {
		return nil, defaultErr
	}

	computedChecksum, err := cipher.ComputeChecksum([]byte(value))
	if err != nil {
		return nil, err
	}

	if checksum != *computedChecksum {
		return nil, defaultErr
	}

	stmt := sqlf.PostgreSQL.
		Select("id").
		Select("app_id").
		From("api_keys").
		Where("key_value = ? and revoked = ?", nil, nil, nil).
		Limit(1)
	defer stmt.Close()

	var id uuid.UUID
	var appId uuid.UUID

	if err := server.Server.PgPool.QueryRow(ctx, stmt.String(), value, false, 1).Scan(&id, &appId); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	err = updateLastSeenForApiKey(ctx, id)
	if err != nil {
		msg := "failed to update API key last seen value"
		fmt.Println(msg, err)
	}

	return &appId, nil
}

func RotateApiKey(c *gin.Context) {
	userId := c.GetString("userId")
	appId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	app := App{
		ID: &appId,
	}

	team, err := app.getTeam(c)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	ok, err := PerformAuthz(userId, team.ID.String(), *ScopeAppAll)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to rotate app api keys in team [%s]`, team.ID.String())
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	apiKey, err := app.rotateAPIKey()
	if err != nil {
		msg := "failed to rotate app api key"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"api_key": apiKey,
		"ok":      "done",
	})
}
