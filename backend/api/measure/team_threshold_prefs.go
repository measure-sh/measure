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
	defaultErrorGoodThreshold    = 95.0
	defaultErrorCautionThreshold = 85.0
)

type TeamThresholdPrefs struct {
	TeamID                uuid.UUID `json:"team_id"`
	ErrorGoodThreshold    float64   `json:"error_good_threshold"`
	ErrorCautionThreshold float64   `json:"error_caution_threshold"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

type TeamThresholdPrefsPayload struct {
	ErrorGoodThreshold    float64 `json:"error_good_threshold"`
	ErrorCautionThreshold float64 `json:"error_caution_threshold"`
}

type teamThresholdPrefsRequest struct {
	ErrorGoodThreshold    *float64 `json:"error_good_threshold"`
	ErrorCautionThreshold *float64 `json:"error_caution_threshold"`
}

func defaultTeamThresholdPrefs(teamID uuid.UUID) TeamThresholdPrefs {
	now := time.Now().UTC()
	return TeamThresholdPrefs{
		TeamID:                teamID,
		ErrorGoodThreshold:    defaultErrorGoodThreshold,
		ErrorCautionThreshold: defaultErrorCautionThreshold,
		CreatedAt:             now,
		UpdatedAt:             now,
	}
}

func validateTeamThresholdPrefs(good, caution float64) error {
	if good <= caution {
		return fmt.Errorf("error_good_threshold must be greater than error_caution_threshold")
	}
	if good <= 0 || good > 100 {
		return fmt.Errorf("error_good_threshold must be between 0 and 100")
	}
	if caution < 0 || caution >= 100 {
		return fmt.Errorf("error_caution_threshold must be between 0 and 100")
	}
	return nil
}

func getTeamThresholdPrefsByTeamID(ctx context.Context, teamID uuid.UUID) (TeamThresholdPrefs, error) {
	prefs := TeamThresholdPrefs{}
	stmt := sqlf.PostgreSQL.
		From("measure.team_threshold_prefs").
		Select("team_id").
		Select("error_good_threshold").
		Select("error_caution_threshold").
		Select("created_at").
		Select("updated_at").
		Where("team_id = ?", teamID)
	defer stmt.Close()

	err := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(
		&prefs.TeamID,
		&prefs.ErrorGoodThreshold,
		&prefs.ErrorCautionThreshold,
		&prefs.CreatedAt,
		&prefs.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return defaultTeamThresholdPrefs(teamID), nil
		}
		return TeamThresholdPrefs{}, err
	}

	return prefs, nil
}

func upsertTeamThresholdPrefs(ctx context.Context, teamID uuid.UUID, payload TeamThresholdPrefsPayload) error {
	stmt := sqlf.PostgreSQL.
		InsertInto("measure.team_threshold_prefs").
		Set("team_id", teamID).
		Set("error_good_threshold", payload.ErrorGoodThreshold).
		Set("error_caution_threshold", payload.ErrorCautionThreshold).
		Set("created_at", time.Now().UTC()).
		Set("updated_at", time.Now().UTC())
	defer stmt.Close()

	query := stmt.String() + ` ON CONFLICT (team_id) DO UPDATE SET
		error_good_threshold = EXCLUDED.error_good_threshold,
		error_caution_threshold = EXCLUDED.error_caution_threshold,
		updated_at = NOW()`

	_, err := server.Server.PgPool.Exec(ctx, query, stmt.Args()...)
	return err
}

func GetTeamThresholdPrefs(c *gin.Context) {
	ctx := c.Request.Context()
	userID := c.GetString("userId")
	teamID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if ok, err := PerformAuthz(userID, teamID.String(), *ScopeTeamThresholdPrefsRead); err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := fmt.Sprintf(`you don't have permissions for team [%s]`, teamID)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	prefs, err := getTeamThresholdPrefsByTeamID(ctx, teamID)
	if err != nil {
		msg := fmt.Sprintf("error occurred while querying team threshold prefs: %s", teamID)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, prefs)
}

func UpdateTeamThresholdPrefs(c *gin.Context) {
	ctx := c.Request.Context()
	userID := c.GetString("userId")
	teamID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if ok, err := PerformAuthz(userID, teamID.String(), *ScopeTeamThresholdPrefsAll); err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := fmt.Sprintf(`you don't have permissions for team [%s]`, teamID)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	var req teamThresholdPrefsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		msg := `invalid request payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if req.ErrorGoodThreshold == nil || req.ErrorCautionThreshold == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "error_good_threshold and error_caution_threshold are required"})
		return
	}

	payload := TeamThresholdPrefsPayload{
		ErrorGoodThreshold:    *req.ErrorGoodThreshold,
		ErrorCautionThreshold: *req.ErrorCautionThreshold,
	}

	if err := validateTeamThresholdPrefs(payload.ErrorGoodThreshold, payload.ErrorCautionThreshold); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := upsertTeamThresholdPrefs(ctx, teamID, payload); err != nil {
		msg := fmt.Sprintf("error occurred while updating team threshold prefs: %s", teamID)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": "done"})
}
