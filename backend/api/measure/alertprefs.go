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

type AlertPref struct {
	AppId                uuid.UUID
	UserId               uuid.UUID
	CrashRateSpikeEmail  bool
	AnrRateSpikeEmail    bool
	LaunchTimeSpikeEmail bool
	UpdatedAt            time.Time
	CreatedAt            time.Time
}

type AlertPrefPayload struct {
	CrashRateSpike struct {
		Email bool `json:"email"`
	} `json:"crash_rate_spike"`
	AnrRateSpike struct {
		Email bool `json:"email"`
	} `json:"anr_rate_spike"`
	LaunchTimeSpike struct {
		Email bool `json:"email"`
	} `json:"launch_time_spike"`
}

func (pref *AlertPref) MarshalJSON() ([]byte, error) {
	apiMap := make(map[string]any)

	crashRateSpikeMap := make(map[string]bool)
	crashRateSpikeMap["email"] = pref.CrashRateSpikeEmail

	anrRateSpikeMap := make(map[string]bool)
	anrRateSpikeMap["email"] = pref.AnrRateSpikeEmail

	launchTimeSpikeMap := make(map[string]bool)
	launchTimeSpikeMap["email"] = pref.LaunchTimeSpikeEmail

	apiMap["crash_rate_spike"] = crashRateSpikeMap
	apiMap["anr_rate_spike"] = anrRateSpikeMap
	apiMap["launch_time_spike"] = launchTimeSpikeMap
	apiMap["created_at"] = pref.CreatedAt.Format(chrono.ISOFormatJS)
	apiMap["updated_at"] = pref.UpdatedAt.Format(chrono.ISOFormatJS)
	return json.Marshal(apiMap)
}

func newAlertPref(appId uuid.UUID, userId uuid.UUID) *AlertPref {
	return &AlertPref{
		AppId:                appId,
		UserId:               userId,
		CrashRateSpikeEmail:  true,
		AnrRateSpikeEmail:    true,
		LaunchTimeSpikeEmail: true,
		CreatedAt:            time.Now(),
		UpdatedAt:            time.Now(),
	}
}

func (pref *AlertPref) update() error {
	stmt := sqlf.PostgreSQL.Update("alert_prefs").
		Set("crash_rate_spike_email", pref.CrashRateSpikeEmail).
		Set("anr_rate_spike_email", pref.AnrRateSpikeEmail).
		Set("launch_time_spike_email", pref.LaunchTimeSpikeEmail).
		Set("updated_at", pref.UpdatedAt).
		Where("app_id = ?", pref.AppId)
	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(context.Background(), stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}

	return nil
}

// Returns alert prefs for a given appId and userId combo. If it doesn't exist,
// a record is created with default values and then returned
func getAlertPref(appId uuid.UUID, userId uuid.UUID) (*AlertPref, error) {
	var pref AlertPref

	stmt := sqlf.PostgreSQL.
		Select("app_id").
		Select("user_id").
		Select("crash_rate_spike_email").
		Select("anr_rate_spike_email").
		Select("launch_time_spike_email").
		Select("created_at").
		Select("updated_at").
		From("alert_prefs").
		Where("app_id = ?", appId).
		Where("user_id = ?", userId)
	defer stmt.Close()

	err := server.Server.PgPool.QueryRow(context.Background(), stmt.String(), appId, userId).Scan(&pref.AppId, &pref.UserId, &pref.CrashRateSpikeEmail, &pref.AnrRateSpikeEmail, &pref.LaunchTimeSpikeEmail, &pref.CreatedAt, &pref.UpdatedAt)

	// If there is no record for given appId and userId combo, we create one
	if err != nil && err == pgx.ErrNoRows {
		pref = *newAlertPref(appId, userId)

		stmt := sqlf.PostgreSQL.InsertInto("alert_prefs").
			Set("app_id", pref.AppId).
			Set("user_id", pref.UserId).
			Set("crash_rate_spike_email", pref.CrashRateSpikeEmail).
			Set("anr_rate_spike_email", pref.AnrRateSpikeEmail).
			Set("launch_time_spike_email", pref.LaunchTimeSpikeEmail).
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

func (pref *AlertPref) String() string {
	return fmt.Sprintf("AlertPref - appId: %s, userId: %s, crash_rate_spike_email: %v, anr_rate_spike_email: %v, launch_time_spike_email: %v, created_at: %v, updated_at: %v ", pref.AppId, pref.UserId, pref.CrashRateSpikeEmail, pref.AnrRateSpikeEmail, pref.LaunchTimeSpikeEmail, pref.CreatedAt, pref.UpdatedAt)
}
