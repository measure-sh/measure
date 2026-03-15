package measure

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"backend/api/server"
	"backend/libs/chrono"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

type NotifPref struct {
	UserId       uuid.UUID
	ErrorSpike   bool
	AppHangSpike bool
	BugReport    bool
	DailySummary bool
	UpdatedAt    time.Time
	CreatedAt    time.Time
}

type NotifPrefPayload struct {
	ErrorSpike   bool `json:"error_spike"`
	AppHangSpike bool `json:"app_hang_spike"`
	BugReport    bool `json:"bug_report"`
	DailySummary bool `json:"daily_summary"`
}

func (pref *NotifPref) MarshalJSON() ([]byte, error) {
	apiMap := map[string]any{
		"error_spike":   pref.ErrorSpike,
		"app_hang_spike": pref.AppHangSpike,
		"bug_report":    pref.BugReport,
		"daily_summary": pref.DailySummary,
		"created_at":    pref.CreatedAt.Format(chrono.ISOFormatJS),
		"updated_at":    pref.UpdatedAt.Format(chrono.ISOFormatJS),
	}
	return json.Marshal(apiMap)
}

func newNotifPref(userId uuid.UUID) *NotifPref {
	return &NotifPref{
		UserId:       userId,
		ErrorSpike:   true,
		AppHangSpike: true,
		BugReport:    true,
		DailySummary: true,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
}

func createNotifPref(userId uuid.UUID) error {
	stmt := sqlf.PostgreSQL.InsertInto("notif_prefs").
		Set("user_id", userId).
		Set("created_at", time.Now()).
		Set("updated_at", time.Now())
	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(context.Background(), stmt.String(), stmt.Args()...)
	return err
}

func (pref *NotifPref) update() error {
	stmt := sqlf.PostgreSQL.Update("notif_prefs").
		Set("error_spike", pref.ErrorSpike).
		Set("app_hang_spike", pref.AppHangSpike).
		Set("bug_report", pref.BugReport).
		Set("daily_summary", pref.DailySummary).
		Set("updated_at", pref.UpdatedAt).
		Where("user_id = ?", pref.UserId)
	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(context.Background(), stmt.String(), stmt.Args()...)
	return err
}

func getNotifPref(userId uuid.UUID) (*NotifPref, error) {
	var pref NotifPref

	stmt := sqlf.PostgreSQL.
		Select("user_id").
		Select("error_spike").
		Select("app_hang_spike").
		Select("bug_report").
		Select("daily_summary").
		Select("created_at").
		Select("updated_at").
		From("notif_prefs").
		Where("user_id = ?", userId)
	defer stmt.Close()

	err := server.Server.PgPool.QueryRow(context.Background(), stmt.String(), userId).Scan(
		&pref.UserId,
		&pref.ErrorSpike,
		&pref.AppHangSpike,
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
	return fmt.Sprintf("NotifPref - userId: %s, error_spike: %v, app_hang_spike: %v, bug_report: %v, daily_summary: %v, created_at: %v, updated_at: %v", pref.UserId, pref.ErrorSpike, pref.AppHangSpike, pref.BugReport, pref.DailySummary, pref.CreatedAt, pref.UpdatedAt)
}

func GetNotifPrefs(c *gin.Context) {
	userIdString := c.GetString("userId")

	userId, err := uuid.Parse(userIdString)
	if err != nil {
		fmt.Println("Error parsing userId:", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "user id invalid or missing",
		})
		return
	}

	notifPref, err := getNotifPref(userId)
	if err != nil {
		msg := `unable to fetch notification prefs`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, notifPref)
}

func UpdateNotifPrefs(c *gin.Context) {
	userIdString := c.GetString("userId")

	userId, err := uuid.Parse(userIdString)
	if err != nil {
		fmt.Println("Error parsing userId:", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "user id invalid or missing",
		})
		return
	}

	notifPref := newNotifPref(userId)

	var payload NotifPrefPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		msg := `failed to parse notification preferences json payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	notifPref.ErrorSpike = payload.ErrorSpike
	notifPref.AppHangSpike = payload.AppHangSpike
	notifPref.BugReport = payload.BugReport
	notifPref.DailySummary = payload.DailySummary

	if err := notifPref.update(); err != nil {
		msg := `failed to update notification preferences`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok": "done",
	})
}
