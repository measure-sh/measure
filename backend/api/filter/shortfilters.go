package filter

import (
	"context"
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
	Filters FilterList `json:"filters"`
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

func NewShortFilters(appId uuid.UUID, filters FilterList) (*ShortFilters, error) {
	hash, err := filters.Hash()
	if err != nil {
		return nil, err
	}

	return &ShortFilters{
		Code:      hash,
		AppId:     appId,
		Filters:   filters,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
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

	_, err = server.Server.PgPool.Exec(context.Background(), stmt.String(), stmt.Args()...)
	if err != nil {
		// ignorel, if a short filter already exists
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
