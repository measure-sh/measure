package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type APIKey struct {
	ID        uuid.UUID
	AppID     uuid.UUID
	keyPrefix string
	keyValue  string
	checksum  string
	revoked   bool
	lastSeen  time.Time
	createdAt time.Time
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
		keyPrefix: "msrsh",
		keyValue:  byteString,
		checksum:  checksum,
	}, nil
}

func (a *APIKey) saveTx(tx pgx.Tx, app *App) error {
	_, err := tx.Exec(context.Background(), "insert into public.api_keys(app_id, key_prefix, key_value, checksum) values ($1, $2, $3, $4);", app.ID, a.keyPrefix, a.keyValue, a.checksum)

	if err != nil {
		return err
	}

	return nil
}

func (a *APIKey) String() string {
	return fmt.Sprintf("%s_%s_%s", a.keyPrefix, a.keyValue, a.checksum)
}
