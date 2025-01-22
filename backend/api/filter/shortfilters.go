package filter

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"backend/api/chrono"
	"backend/api/server"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/leporo/sqlf"
)

type ShortFilters struct {
	Code      string
	AppId     uuid.UUID
	Filters   FilterList
	UpdatedAt time.Time
	CreatedAt time.Time
}

type ShortFiltersPayload struct {
	AppID   uuid.UUID
	Filters FilterList `json:"filters"`
}

// Hash generates an MD5 hash of the FilterList struct.
func (p *ShortFiltersPayload) Hash() (string, error) {
	data, err := json.Marshal(p)
	if err != nil {
		return "", err
	}

	// Compute MD5 hash
	md5Hash := md5.Sum(data)

	// Convert hash to hex string
	return hex.EncodeToString(md5Hash[:]), nil
}

func (shortFilters *ShortFilters) MarshalJSON() ([]byte, error) {
	apiMap := make(map[string]any)
	apiMap["code"] = shortFilters.Code
	apiMap["app_id"] = shortFilters.AppId
	apiMap["filters"] = shortFilters.Filters
	apiMap["created_at"] = shortFilters.CreatedAt.Format(chrono.ISOFormatJS)
	apiMap["updated_at"] = shortFilters.UpdatedAt.Format(chrono.ISOFormatJS)
	return json.Marshal(apiMap)
}

func NewShortFilters(payload ShortFiltersPayload) (*ShortFilters, error) {
	hash, err := payload.Hash()
	if err != nil {
		return nil, err
	}

	now := time.Now()

	return &ShortFilters{
		Code:      hash,
		AppId:     payload.AppID,
		Filters:   payload.Filters,
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

// Create persists the filter shortcode in database
// if it does not exist.
func (shortFilters *ShortFilters) Create(ctx context.Context) error {
	// If already exists, just return
	filters, err := GetFiltersFromCode(ctx, shortFilters.Code, shortFilters.AppId)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		fmt.Printf("Error fetching filters from filter short code %v: %v\n", shortFilters.Code, err)
		return err
	}

	if filters != nil {
		return nil
	}

	stmt := sqlf.PostgreSQL.InsertInto("public.short_filters").
		Set("code", shortFilters.Code).
		Set("app_id", shortFilters.AppId).
		Set("filters", shortFilters.Filters).
		Set("created_at", shortFilters.CreatedAt).
		Set("updated_at", shortFilters.UpdatedAt)
	defer stmt.Close()

	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		// ignore, if a short filter already exists
		// and a primary key violation occurs
		if pgErr, ok := err.(*pgconn.PgError); ok && pgErr.Code == "23505" {
			return nil
		}
		return err
	}

	return nil
}

// GetFiltersFromCode returns filters for a given short
// code and app id. Return an error, if a filter doesn't
// exist.
func GetFiltersFromCode(ctx context.Context, filterShortCode string, appId uuid.UUID) (*FilterList, error) {
	var filters FilterList

	stmt := sqlf.PostgreSQL.
		Select("filters").
		From("public.short_filters").
		Where("code = ?", filterShortCode).
		Where("app_id = ?", appId)

	defer stmt.Close()

	if err := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&filters); err != nil {
		return nil, err
	}

	return &filters, nil
}

func (shortFilters *ShortFilters) String() string {
	return fmt.Sprintf("ShortFilters - code: %s, app_id: %s, filters: %v, created_at: %v, updated_at: %v ", shortFilters.Code, shortFilters.AppId, shortFilters.Filters, shortFilters.CreatedAt, shortFilters.UpdatedAt)
}
