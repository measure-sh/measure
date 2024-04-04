package measure

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"measure-backend/measure-go/chrono"
	"measure-backend/measure-go/server"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

type AlertPref struct {
	AppId                uuid.UUID
	CrashRateSpikeEmail  bool
	CrashRateSpikeSlack  bool
	AnrRateSpikeEmail    bool
	AnrRateSpikeSlack    bool
	LaunchTimeSpikeEmail bool
	LaunchTimeSpikeSlack bool
	UpdatedAt            time.Time
	CreatedAt            time.Time
}

type AlertPrefPayload struct {
	CrashRateSpike struct {
		Email bool `json:"email"`
		Slack bool `json:"slack"`
	} `json:"crash_rate_spike"`
	AnrRateSpike struct {
		Email bool `json:"email"`
		Slack bool `json:"slack"`
	} `json:"anr_rate_spike"`
	LaunchTimeSpike struct {
		Email bool `json:"email"`
		Slack bool `json:"slack"`
	} `json:"launch_time_spike"`
}

func (pref *AlertPref) MarshalJSON() ([]byte, error) {
	apiMap := make(map[string]any)

	crashRateSpikeMap := make(map[string]bool)
	crashRateSpikeMap["email"] = pref.CrashRateSpikeEmail
	crashRateSpikeMap["slack"] = pref.CrashRateSpikeSlack

	anrRateSpikeMap := make(map[string]bool)
	anrRateSpikeMap["email"] = pref.AnrRateSpikeEmail
	anrRateSpikeMap["slack"] = pref.AnrRateSpikeSlack

	launchTimeSpikeMap := make(map[string]bool)
	launchTimeSpikeMap["email"] = pref.LaunchTimeSpikeEmail
	launchTimeSpikeMap["slack"] = pref.LaunchTimeSpikeSlack

	apiMap["crash_rate_spike"] = crashRateSpikeMap
	apiMap["anr_rate_spike"] = anrRateSpikeMap
	apiMap["launch_time_spike"] = launchTimeSpikeMap
	apiMap["created_at"] = pref.CreatedAt.Format(chrono.ISOFormatJS)
	apiMap["updated_at"] = pref.UpdatedAt.Format(chrono.ISOFormatJS)
	return json.Marshal(apiMap)
}

func newAlertPref(appId uuid.UUID) (*AlertPref, error) {
	return &AlertPref{
		AppId:                appId,
		CrashRateSpikeEmail:  true,
		CrashRateSpikeSlack:  false,
		AnrRateSpikeEmail:    true,
		AnrRateSpikeSlack:    false,
		LaunchTimeSpikeEmail: true,
		LaunchTimeSpikeSlack: false,
		CreatedAt:            time.Now(),
		UpdatedAt:            time.Now(),
	}, nil
}

func (pref *AlertPref) insertTx(tx pgx.Tx) error {
	stmt := sqlf.PostgreSQL.InsertInto("public.alert_prefs").
		Set("app_id", pref.AppId).
		Set("crash_rate_spike_email", pref.CrashRateSpikeEmail).
		Set("crash_rate_spike_slack", pref.CrashRateSpikeSlack).
		Set("anr_rate_spike_email", pref.AnrRateSpikeEmail).
		Set("anr_rate_spike_slack", pref.AnrRateSpikeSlack).
		Set("launch_time_spike_email", pref.LaunchTimeSpikeEmail).
		Set("launch_time_spike_slack", pref.LaunchTimeSpikeSlack).
		Set("created_at", pref.CreatedAt).
		Set("updated_at", pref.UpdatedAt)

	_, err := tx.Exec(context.Background(), stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}

	return nil
}

func (pref *AlertPref) update() error {
	stmt := sqlf.PostgreSQL.Update("public.alert_prefs").
		Set("crash_rate_spike_email", pref.CrashRateSpikeEmail).
		Set("crash_rate_spike_slack", pref.CrashRateSpikeSlack).
		Set("anr_rate_spike_email", pref.AnrRateSpikeEmail).
		Set("anr_rate_spike_slack", pref.AnrRateSpikeSlack).
		Set("launch_time_spike_email", pref.LaunchTimeSpikeEmail).
		Set("launch_time_spike_slack", pref.LaunchTimeSpikeSlack).
		Set("updated_at", pref.UpdatedAt).
		Where("app_id = ?", pref.AppId)

	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(context.Background(), stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}

	return nil
}

func getAlertPref(appId uuid.UUID) (*AlertPref, error) {
	var pref AlertPref

	stmt := sqlf.PostgreSQL.
		Select("app_id").
		Select("crash_rate_spike_email").
		Select("crash_rate_spike_slack").
		Select("anr_rate_spike_email").
		Select("anr_rate_spike_slack").
		Select("launch_time_spike_email").
		Select("launch_time_spike_slack").
		Select("created_at").
		Select("updated_at").
		From("public.alert_prefs").
		Where("app_id = ?", appId)
	defer stmt.Close()

	err := server.Server.PgPool.QueryRow(context.Background(), stmt.String(), appId).Scan(&pref.AppId, &pref.CrashRateSpikeEmail, &pref.CrashRateSpikeSlack, &pref.AnrRateSpikeEmail, &pref.AnrRateSpikeSlack, &pref.LaunchTimeSpikeEmail, &pref.LaunchTimeSpikeSlack, &pref.CreatedAt, &pref.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return &pref, nil
}

func (pref *AlertPref) String() string {
	return fmt.Sprintf("AlertPref - appId: %s, crash_rate_spike_email: %v, crash_rate_spike_slack: %v, anr_rate_spike_email: %v, anr_rate_spike_slack: %v, launch_time_spike_email: %v, launch_time_spike_slack: %v, created_at: %v, updated_at: %v ", pref.AppId, pref.CrashRateSpikeEmail, pref.CrashRateSpikeSlack, pref.AnrRateSpikeEmail, pref.AnrRateSpikeSlack, pref.LaunchTimeSpikeEmail, pref.LaunchTimeSpikeSlack, pref.CreatedAt, pref.UpdatedAt)
}
