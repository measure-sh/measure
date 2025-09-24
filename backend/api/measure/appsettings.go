package measure

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"backend/api/chrono"
	"backend/api/server"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

type AppSettings struct {
	AppId           uuid.UUID
	RetentionPeriod uint32
	UpdatedAt       time.Time
	CreatedAt       time.Time
}

type AppSettingsPayload struct {
	RetentionPeriod uint32 `json:"retention_period"`
}

func (pref *AppSettings) MarshalJSON() ([]byte, error) {
	apiMap := make(map[string]any)
	apiMap["app_id"] = pref.AppId
	apiMap["retention_period"] = pref.RetentionPeriod
	apiMap["created_at"] = pref.CreatedAt.Format(chrono.ISOFormatJS)
	apiMap["updated_at"] = pref.UpdatedAt.Format(chrono.ISOFormatJS)
	return json.Marshal(apiMap)
}

func newAppSettings(appId uuid.UUID) *AppSettings {
	return &AppSettings{
		AppId:           appId,
		RetentionPeriod: 90,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
}

func (pref *AppSettings) update() error {
	stmt := sqlf.PostgreSQL.Update("app_settings").
		Set("retention_period", pref.RetentionPeriod).
		Set("updated_at", pref.UpdatedAt).
		Where("app_id = ?", pref.AppId)
	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(context.Background(), stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}

	return nil
}

// Returns app settings for a given appId. If it doesn't exist,
// a record is created with default values and then returned
func getAppSettings(appId uuid.UUID) (*AppSettings, error) {
	var pref AppSettings

	stmt := sqlf.PostgreSQL.
		Select("app_id").
		Select("retention_period").
		Select("created_at").
		Select("updated_at").
		From("app_settings").
		Where("app_id = ?", appId)
	defer stmt.Close()

	err := server.Server.PgPool.QueryRow(context.Background(), stmt.String(), appId).Scan(&pref.AppId, &pref.RetentionPeriod, &pref.CreatedAt, &pref.UpdatedAt)

	// If there is no record for given appId and userId combo, we create one
	if err != nil && err == pgx.ErrNoRows {
		pref = *newAppSettings(appId)

		stmt := sqlf.PostgreSQL.InsertInto("app_settings").
			Set("app_id", pref.AppId).
			Set("retention_period", pref.RetentionPeriod).
			Set("created_at", pref.CreatedAt).
			Set("updated_at", pref.UpdatedAt)
		defer stmt.Close()

		_, err := server.Server.PgPool.Exec(context.Background(), stmt.String(), stmt.Args()...)
		if err != nil {
			return nil, err
		}

		return &pref, nil
	}

	if err != nil {
		return nil, err
	}

	return &pref, nil
}

func (pref *AppSettings) String() string {
	return fmt.Sprintf("AppSettings - app_id: %s, retention_period: %v, created_at: %v, updated_at: %v ", pref.AppId, pref.RetentionPeriod, pref.CreatedAt, pref.UpdatedAt)
}
