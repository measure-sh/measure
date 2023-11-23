package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const ISOFormatJS = "2006-01-02T15:04:05Z"

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
	apiMap := make(map[string]string)

	apiMap["key"] = a.String()
	apiMap["created_at"] = a.createdAt.Format(ISOFormatJS)
	apiMap["last_seen"] = a.lastSeen.Format(ISOFormatJS)
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

	hash := sha256.New()
	hash.Write([]byte(byteString))
	checksum := hex.EncodeToString(hash.Sum(nil))[:8]

	return &APIKey{
		appId:     appId,
		keyPrefix: "msrsh",
		keyValue:  byteString,
		checksum:  checksum,
		createdAt: time.Now(),
	}, nil
}

func (a *APIKey) saveTx(tx pgx.Tx, app *App) error {
	_, err := tx.Exec(context.Background(), "insert into public.api_keys(app_id, key_prefix, key_value, checksum, created_at) values ($1, $2, $3, $4, $5);", a.appId, a.keyPrefix, a.keyValue, a.checksum, a.createdAt)

	if err != nil {
		return err
	}

	return nil
}

func (a *APIKey) String() string {
	return fmt.Sprintf("%s_%s_%s", a.keyPrefix, a.keyValue, a.checksum)
}
