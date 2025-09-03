package measure

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"backend/api/chrono"
	"backend/api/cipher"
	"backend/api/server"

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

func DecodeAPIKey(key string) (*uuid.UUID, error) {
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

	stmt := sqlf.PostgreSQL.Select("app_id").
		From("api_keys").
		Where("key_value = ? and revoked = ?", nil, nil, nil).
		Limit(1)
	defer stmt.Close()

	var appId uuid.UUID

	if err := server.Server.PgPool.QueryRow(context.Background(), stmt.String(), value, false, 1).Scan(&appId); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return &appId, nil
}
