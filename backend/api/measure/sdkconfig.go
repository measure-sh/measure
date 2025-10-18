package measure

import (
	"backend/api/server"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

const (
	cacheControlHeader = "Cache-Control"
	cacheControlValue  = "max-age=600" // 10 minutes
)

// Session targeting rule
type sessionTargetingRule struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	Status       int       `json:"status"`
	SamplingRate float64   `json:"sampling_rate"`
	Rule         string    `json:"rule"`
}

// SDK config contains session targeting
// rules and will have more configurations
// in future.
type SDKConfig struct {
	SessionTargetingConfig []sessionTargetingRule `json:"session_targeting"`
}

// GetConfig returns the SDK config
// for session targeting
func GetConfig(c *gin.Context) {
	appId, err := uuid.Parse(c.GetString("appId"))
	if err != nil {
		msg := `error parsing app's uuid`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	// session targeting config
	stmt := sqlf.PostgreSQL.From("session_targeting_rules").
		Select("id").
		Select("name").
		Select("status").
		Select("sampling_rate").
		Select("rule").
		Where("app_id = ?", appId).
		Where("status = 1").
		OrderBy("updated_at DESC")

	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(c.Request.Context(), stmt.String(), stmt.Args()...)
	if err != nil {
		msg := "failed to fetch session targeting config"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}
	defer rows.Close()

	sessionTargetingConfigs := make([]sessionTargetingRule, 0)

	for rows.Next() {
		var stConfig sessionTargetingRule
		if err := rows.Scan(
			&stConfig.ID,
			&stConfig.Name,
			&stConfig.Status,
			&stConfig.SamplingRate,
			&stConfig.Rule,
		); err != nil {
			msg := "failed to scan session targeting config"
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
		sessionTargetingConfigs = append(sessionTargetingConfigs, stConfig)
	}

	if err := rows.Err(); err != nil {
		msg := "error iterating session targeting config"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	sdkConfig := SDKConfig{
		SessionTargetingConfig: sessionTargetingConfigs,
	}

	c.Header(cacheControlHeader, cacheControlValue)
	c.JSON(http.StatusOK, sdkConfig)
}
