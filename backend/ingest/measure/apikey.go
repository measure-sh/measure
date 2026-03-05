package measure

import (
	"backend/ingest/server"
	"backend/libs/chrono"
	"backend/libs/cipher"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

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
