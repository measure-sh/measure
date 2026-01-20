package measure

import (
	"backend/api/server"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

type AppUsage struct {
	AppId           string            `json:"app_id"`
	AppName         string            `json:"app_name"`
	MonthlyAppUsage []MonthlyAppUsage `json:"monthly_app_usage"`
}

type MonthlyAppUsage struct {
	MonthName string `json:"month_year"`
	Sessions  uint64 `json:"sessions"`
	Events    uint64 `json:"events"`
	Spans     uint64 `json:"spans"`
}

func GetUsage(c *gin.Context) {
	ctx := c.Request.Context()
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if ok, err := PerformAuthz(userId, teamId.String(), *ScopeTeamRead); err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := fmt.Sprintf(`you don't have permissions for team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	if ok, err := PerformAuthz(userId, teamId.String(), *ScopeAppRead); err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := fmt.Sprintf(`you don't have permissions to read apps in team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	var team = new(Team)
	team.ID = &teamId

	apps, err := team.getApps(ctx)
	if err != nil {
		msg := fmt.Sprintf("error occurred while querying apps list for team: %s", teamId)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if len(apps) < 1 {
		msg := fmt.Sprintf("no apps exists under team: %s", teamId)
		c.JSON(http.StatusNotFound, gin.H{"error": msg})
		return
	}

	var appIds []uuid.UUID
	for _, app := range apps {
		appIds = append(appIds, *app.ID)
	}

	// we want the API server to be the source-of-truth and
	// arbiter of providing time. makes dealing with system
	// clock skews easier, which is a horrendous problem to
	// deal with honestly.
	now := time.Now()

	// Query usage metrics for all apps in team
	metricsStmt := sqlf.
		From(`ingestion_metrics`).
		Select("app_id").
		Select("formatDateTime(toStartOfMonth(timestamp), '%b %Y') AS month_year").
		Select("sumMerge(sessions) AS sessions").
		Select("sumMerge(events) AS events").
		Select("sumMerge(spans) AS spans").
		Where("`app_id` in ?", appIds).
		Where("timestamp >= addMonths(toStartOfMonth(?), -2) AND timestamp < toStartOfMonth(addMonths(?, 1))", now, now).
		GroupBy("app_id, toStartOfMonth(timestamp)").
		OrderBy("app_id, toStartOfMonth(timestamp) DESC")

	defer metricsStmt.Close()

	metricsRows, err := server.Server.ChPool.Query(ctx, metricsStmt.String(), metricsStmt.Args()...)
	if err != nil {
		msg := fmt.Sprintf("error occurred while querying usage metrics for team: %s", teamId)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	appUsageMap := make(map[string]*AppUsage)

	// Initialize appUsageMap with all apps
	for _, app := range apps {
		appUsageMap[app.ID.String()] = &AppUsage{
			AppId:           app.ID.String(),
			AppName:         app.AppName,
			MonthlyAppUsage: make([]MonthlyAppUsage, 0, 3),
		}
	}

	// Get the last three month names
	monthYearFormat := "Jan 2006"
	monthNames := []string{
		now.AddDate(0, -2, 0).Format(monthYearFormat),
		now.AddDate(0, -1, 0).Format(monthYearFormat),
		now.Format(monthYearFormat),
	}

	// Populate appUsageMap with metrics rows from DB
	for metricsRows.Next() {
		var appId, monthYear string
		var sessions, events, spans uint64

		if err := metricsRows.Scan(&appId, &monthYear, &sessions, &events, &spans); err != nil {
			msg := fmt.Sprintf("error occurred while scanning usage metrics row for team: %s", teamId)
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
			return
		}

		if appUsage, exists := appUsageMap[appId]; exists {
			appUsage.MonthlyAppUsage = append(appUsage.MonthlyAppUsage, MonthlyAppUsage{
				MonthName: monthYear,
				Sessions:  sessions,
				Events:    events,
				Spans:     spans,
			})
		}
	}

	if err := metricsRows.Err(); err != nil {
		msg := fmt.Sprintf("error occurred while iterating usage metrics rows for team: %s", teamId)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	// Ensure all apps have entries for all three months by adding 0 values for missing months
	for _, appUsage := range appUsageMap {
		monthDataMap := make(map[string]MonthlyAppUsage)
		for _, usage := range appUsage.MonthlyAppUsage {
			monthDataMap[usage.MonthName] = usage
		}

		newMonthlyAppUsage := make([]MonthlyAppUsage, 0, 3)
		for _, monthName := range monthNames {
			if usage, exists := monthDataMap[monthName]; exists {
				newMonthlyAppUsage = append(newMonthlyAppUsage, usage)
			} else {
				newMonthlyAppUsage = append(newMonthlyAppUsage, MonthlyAppUsage{
					MonthName: monthName,
					Sessions:  0,
					Events:    0,
					Spans:     0,
				})
			}
		}
		appUsage.MonthlyAppUsage = newMonthlyAppUsage
	}

	// Convert map to slice for JSON response
	var result []AppUsage
	for _, appUsage := range appUsageMap {
		result = append(result, *appUsage)
	}

	c.JSON(http.StatusOK, result)
}
