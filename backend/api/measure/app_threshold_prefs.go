package measure

import (
	"backend/api/server"
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

const (
	defaultErrorGoodThreshold          = 95.0
	defaultErrorCautionThreshold       = 85.0
	defaultErrorSpikeMinCountThreshold = 100
	defaultErrorSpikeMinRateThreshold  = 0.5
)

type AppThresholdPrefs struct {
	AppID                       uuid.UUID `json:"app_id"`
	ErrorGoodThreshold          float64   `json:"error_good_threshold"`
	ErrorCautionThreshold       float64   `json:"error_caution_threshold"`
	ErrorSpikeMinCountThreshold int       `json:"error_spike_min_count_threshold"`
	ErrorSpikeMinRateThreshold  float64   `json:"error_spike_min_rate_threshold"`
	CreatedAt                   time.Time `json:"created_at"`
	UpdatedAt                   time.Time `json:"updated_at"`
}

type AppThresholdPrefsPayload struct {
	ErrorGoodThreshold          float64 `json:"error_good_threshold"`
	ErrorCautionThreshold       float64 `json:"error_caution_threshold"`
	ErrorSpikeMinCountThreshold int     `json:"error_spike_min_count_threshold"`
	ErrorSpikeMinRateThreshold  float64 `json:"error_spike_min_rate_threshold"`
}

type appThresholdPrefsRequest struct {
	ErrorGoodThreshold          *float64 `json:"error_good_threshold"`
	ErrorCautionThreshold       *float64 `json:"error_caution_threshold"`
	ErrorSpikeMinCountThreshold *int     `json:"error_spike_min_count_threshold"`
	ErrorSpikeMinRateThreshold  *float64 `json:"error_spike_min_rate_threshold"`
}

func defaultAppThresholdPrefs(appID uuid.UUID) AppThresholdPrefs {
	now := time.Now().UTC()
	return AppThresholdPrefs{
		AppID:                       appID,
		ErrorGoodThreshold:          defaultErrorGoodThreshold,
		ErrorCautionThreshold:       defaultErrorCautionThreshold,
		ErrorSpikeMinCountThreshold: defaultErrorSpikeMinCountThreshold,
		ErrorSpikeMinRateThreshold:  defaultErrorSpikeMinRateThreshold,
		CreatedAt:                   now,
		UpdatedAt:                   now,
	}
}

func validateAppThresholdPrefs(good, caution float64, minCount int, spikeThreshold float64) error {
	if good <= caution {
		return fmt.Errorf("error_good_threshold must be greater than error_caution_threshold")
	}
	if good <= 0 || good > 100 {
		return fmt.Errorf("error_good_threshold must be between 0 and 100")
	}
	if caution < 0 || caution >= 100 {
		return fmt.Errorf("error_caution_threshold must be between 0 and 100")
	}
	if minCount < 1 {
		return fmt.Errorf("error_spike_min_count_threshold must be at least 1")
	}
	if spikeThreshold <= 0 || spikeThreshold > 100 {
		return fmt.Errorf("error_spike_min_rate_threshold must be between 0 (exclusive) and 100")
	}
	return nil
}

func getAppThresholdPrefsByAppID(ctx context.Context, appID uuid.UUID) (AppThresholdPrefs, error) {
	prefs := AppThresholdPrefs{}
	stmt := sqlf.PostgreSQL.
		From("measure.app_threshold_prefs").
		Select("app_id").
		Select("error_good_threshold").
		Select("error_caution_threshold").
		Select("error_spike_min_count_threshold").
		Select("error_spike_min_rate_threshold").
		Select("created_at").
		Select("updated_at").
		Where("app_id = ?", appID)
	defer stmt.Close()

	err := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(
		&prefs.AppID,
		&prefs.ErrorGoodThreshold,
		&prefs.ErrorCautionThreshold,
		&prefs.ErrorSpikeMinCountThreshold,
		&prefs.ErrorSpikeMinRateThreshold,
		&prefs.CreatedAt,
		&prefs.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return defaultAppThresholdPrefs(appID), nil
		}
		return AppThresholdPrefs{}, err
	}

	return prefs, nil
}

func upsertAppThresholdPrefs(ctx context.Context, appID uuid.UUID, payload AppThresholdPrefsPayload) error {
	stmt := sqlf.PostgreSQL.
		InsertInto("measure.app_threshold_prefs").
		Set("app_id", appID).
		Set("error_good_threshold", payload.ErrorGoodThreshold).
		Set("error_caution_threshold", payload.ErrorCautionThreshold).
		Set("error_spike_min_count_threshold", payload.ErrorSpikeMinCountThreshold).
		Set("error_spike_min_rate_threshold", payload.ErrorSpikeMinRateThreshold).
		Set("created_at", time.Now().UTC()).
		Set("updated_at", time.Now().UTC())
	defer stmt.Close()

	query := stmt.String() + ` ON CONFLICT (app_id) DO UPDATE SET
		error_good_threshold = EXCLUDED.error_good_threshold,
		error_caution_threshold = EXCLUDED.error_caution_threshold,
		error_spike_min_count_threshold = EXCLUDED.error_spike_min_count_threshold,
		error_spike_min_rate_threshold = EXCLUDED.error_spike_min_rate_threshold,
		updated_at = NOW()`

	_, err := server.Server.PgPool.Exec(ctx, query, stmt.Args()...)
	return err
}

func GetAppThresholdPrefs(c *gin.Context) {
	ctx := c.Request.Context()
	userID := c.GetString("userId")
	appID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	app := App{ID: &appID}
	team, err := app.getTeam(c)
	if err != nil {
		msg := `couldn't retrieve team for app`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", appID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if ok, err := PerformAuthz(userID, team.ID.String(), *ScopeAppRead); err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := fmt.Sprintf(`you don't have permissions for app [%s]`, appID)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	prefs, err := getAppThresholdPrefsByAppID(ctx, appID)
	if err != nil {
		msg := fmt.Sprintf("error occurred while querying app threshold prefs: %s", appID)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, prefs)
}

func UpdateAppThresholdPrefs(c *gin.Context) {
	ctx := c.Request.Context()
	userID := c.GetString("userId")
	appID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	app := App{ID: &appID}
	team, err := app.getTeam(c)
	if err != nil {
		msg := `couldn't retrieve team for app`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", appID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if ok, err := PerformAuthz(userID, team.ID.String(), *ScopeAppAll); err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := fmt.Sprintf(`you don't have permissions for app [%s]`, appID)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	var req appThresholdPrefsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		msg := `invalid request payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if req.ErrorGoodThreshold == nil || req.ErrorCautionThreshold == nil || req.ErrorSpikeMinCountThreshold == nil || req.ErrorSpikeMinRateThreshold == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "error_good_threshold, error_caution_threshold, error_spike_min_count_threshold, and error_spike_min_rate_threshold are required"})
		return
	}

	payload := AppThresholdPrefsPayload{
		ErrorGoodThreshold:          *req.ErrorGoodThreshold,
		ErrorCautionThreshold:       *req.ErrorCautionThreshold,
		ErrorSpikeMinCountThreshold: *req.ErrorSpikeMinCountThreshold,
		ErrorSpikeMinRateThreshold:  *req.ErrorSpikeMinRateThreshold,
	}

	if err := validateAppThresholdPrefs(payload.ErrorGoodThreshold, payload.ErrorCautionThreshold, payload.ErrorSpikeMinCountThreshold, payload.ErrorSpikeMinRateThreshold); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := upsertAppThresholdPrefs(ctx, appID, payload); err != nil {
		msg := fmt.Sprintf("error occurred while updating app threshold prefs: %s", appID)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": "done"})
}
