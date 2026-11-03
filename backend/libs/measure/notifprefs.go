package measure

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"backend/libs/chrono"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
)

type NotifPref struct {
	UserId          uuid.UUID
	FatalErrorSpike bool
	AnrAppHangSpike bool
	BugReport       bool
	DailySummary    bool
	UpdatedAt       time.Time
	CreatedAt       time.Time
}

type NotifPrefPayload struct {
	FatalErrorSpike bool `json:"fatal_error_spike"`
	AnrAppHangSpike bool `json:"anr_app_hang_spike"`
	BugReport       bool `json:"bug_report"`
	DailySummary    bool `json:"daily_summary"`
}

func (pref *NotifPref) MarshalJSON() ([]byte, error) {
	apiMap := map[string]any{
		"fatal_error_spike":  pref.FatalErrorSpike,
		"anr_app_hang_spike": pref.AnrAppHangSpike,
		"bug_report":         pref.BugReport,
		"daily_summary":      pref.DailySummary,
		"created_at":         pref.CreatedAt.Format(chrono.ISOFormatJS),
		"updated_at":         pref.UpdatedAt.Format(chrono.ISOFormatJS),
	}
	return json.Marshal(apiMap)
}

func NewNotifPref(userId uuid.UUID) *NotifPref {
	return &NotifPref{
		UserId:          userId,
		FatalErrorSpike: true,
		AnrAppHangSpike: true,
		BugReport:       true,
		DailySummary:    true,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
}

func CreateNotifPref(pg *pgxpool.Pool, userId uuid.UUID) error {
	stmt := sqlf.PostgreSQL.InsertInto("notif_prefs").
		Set("user_id", userId).
		Set("created_at", time.Now()).
		Set("updated_at", time.Now())
	defer stmt.Close()

	_, err := pg.Exec(context.Background(), stmt.String(), stmt.Args()...)
	return err
}

func (pref *NotifPref) Update(pg *pgxpool.Pool) error {
	stmt := sqlf.PostgreSQL.Update("notif_prefs").
		Set("fatal_error_spike", pref.FatalErrorSpike).
		Set("anr_app_hang_spike", pref.AnrAppHangSpike).
		Set("bug_report", pref.BugReport).
		Set("daily_summary", pref.DailySummary).
		Set("updated_at", pref.UpdatedAt).
		Where("user_id = ?", pref.UserId)
	defer stmt.Close()

	_, err := pg.Exec(context.Background(), stmt.String(), stmt.Args()...)
	return err
}

func GetNotifPref(pg *pgxpool.Pool, userId uuid.UUID) (*NotifPref, error) {
	var pref NotifPref

	stmt := sqlf.PostgreSQL.
		Select("user_id").
		Select("fatal_error_spike").
		Select("anr_app_hang_spike").
		Select("bug_report").
		Select("daily_summary").
		Select("created_at").
		Select("updated_at").
		From("notif_prefs").
		Where("user_id = ?", userId)
	defer stmt.Close()

	err := pg.QueryRow(context.Background(), stmt.String(), userId).Scan(
		&pref.UserId,
		&pref.FatalErrorSpike,
		&pref.AnrAppHangSpike,
		&pref.BugReport,
		&pref.DailySummary,
		&pref.CreatedAt,
		&pref.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("no notification preferences found for user %s", userId)
		}
		return nil, err
	}

	return &pref, nil
}

func (pref *NotifPref) String() string {
	return fmt.Sprintf("NotifPref - userId: %s, fatal_error_spike: %v, anr_app_hang_spike: %v, bug_report: %v, daily_summary: %v, created_at: %v, updated_at: %v", pref.UserId, pref.FatalErrorSpike, pref.AnrAppHangSpike, pref.BugReport, pref.DailySummary, pref.CreatedAt, pref.UpdatedAt)
}
