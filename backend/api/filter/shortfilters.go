package filter

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"backend/api/chrono"
	"backend/api/server"

	"github.com/google/uuid"
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

func (shortFilters *ShortFilters) Create() error {
	// If already exists, just return
	_, err := GetFiltersFromFilterShortCode(shortFilters.Code, shortFilters.AppId)
	if err == nil {
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
		return err
	}

	return nil
}

// Returns filters for a given short code and appId. If it doesn't exist, returns an error
func GetFiltersFromFilterShortCode(filterShortCode string, appId uuid.UUID) (*FilterList, error) {
	var filters FilterList

	stmt := sqlf.PostgreSQL.
		Select("filters").
		From("public.short_filters").
		Where("code = ?", filterShortCode).
		Where("app_id = ?", appId)
	defer stmt.Close()

	err := server.Server.PgPool.QueryRow(context.Background(), stmt.String(), stmt.Args()...).Scan(&filters)

	if err != nil {
		fmt.Printf("Error fetching filters from filter short code %v: %v\n", filterShortCode, err)
		return nil, err
	}

	return &filters, nil
}

func (shortFilters *ShortFilters) String() string {
	return fmt.Sprintf("ShortFilters - code: %s, app_id: %s, filters: %v, created_at: %v, updated_at: %v ", shortFilters.Code, shortFilters.AppId, shortFilters.Filters, shortFilters.CreatedAt, shortFilters.UpdatedAt)
}
