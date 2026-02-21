package alerts

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"backend/alerts/server"
	"backend/alerts/slack"
	"backend/email"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

type Team struct {
	ID uuid.UUID
}

type App struct {
	ID     uuid.UUID
	TeamID uuid.UUID
}

type Alert struct {
	ID       uuid.UUID
	TeamID   uuid.UUID
	AppID    uuid.UUID
	EntityID string
	Type     string
}

type AlertType string

const (
	AlertTypeCrashSpike AlertType = "crash_spike"
	AlertTypeAnrSpike   AlertType = "anr_spike"
	AlertTypeBugReport  AlertType = "bug_report"
)

type DailySummaryRow struct {
	AppID                uuid.UUID
	Date                 time.Time
	SessionsValue        string
	SessionsLabel        string
	SessionsSubtitle     string
	SessionsHasWarning   bool
	SessionsHasError     bool
	CrashFreeValue       string
	CrashFreeLabel       string
	CrashFreeSubtitle    string
	CrashFreeHasWarning  bool
	CrashFreeHasError    bool
	ANRFreeValue         string
	ANRFreeLabel         string
	ANRFreeSubtitle      string
	ANRFreeHasWarning    bool
	ANRFreeHasError      bool
	ColdLaunchValue      string
	ColdLaunchLabel      string
	ColdLaunchSubtitle   string
	ColdLaunchHasWarning bool
	ColdLaunchHasError   bool
	WarmLaunchValue      string
	WarmLaunchLabel      string
	WarmLaunchSubtitle   string
	WarmLaunchHasWarning bool
	WarmLaunchHasError   bool
	HotLaunchValue       string
	HotLaunchLabel       string
	HotLaunchSubtitle    string
	HotLaunchHasWarning  bool
	HotLaunchHasError    bool
}

const crashOrAnrSpikeTimePeriod = time.Hour
const minCrashOrAnrCountThreshold = 100
const crashOrAnrSpikeThreshold = 0.5               // percent
const cooldownPeriodForEntity = 7 * 24 * time.Hour // 1 week
const bugReportTimePeriod = 15 * time.Minute

func CreateCrashAndAnrAlerts(ctx context.Context) {
	fmt.Println("Checking for Crash and ANR alerts...")
	teams, err := getTeams(ctx)
	if err != nil {
		fmt.Printf("Error fetching teams: %v\n", err)
		return
	}

	for _, team := range teams {
		apps, err := getAppsForTeam(ctx, team.ID)
		if err != nil {
			fmt.Printf("Error fetching apps for team %v: %v\n", team.ID, err)
			continue
		}

		for _, app := range apps {
			from := time.Now().UTC().Add(-crashOrAnrSpikeTimePeriod)
			to := time.Now().UTC()

			var sessionCount uint64
			sessionCountStmt := sqlf.From("events final").
				Select("count(distinct session_id) as session_count").
				Where("team_id = toUUID(?)", app.TeamID).
				Where("app_id = toUUID(?)", app.ID).
				Where("timestamp >= ? and timestamp <= ?", from, to)

			defer sessionCountStmt.Close()

			sessionCountRows, err := server.Server.RchPool.Query(ctx, sessionCountStmt.String(), sessionCountStmt.Args()...)
			if err == nil && sessionCountRows.Next() {
				if err := sessionCountRows.Scan(&sessionCount); err != nil {
					fmt.Printf("Error scanning session count for app %q: %v\n", app.ID, err)
					continue
				}
			} else if err != nil {
				fmt.Printf("Error querying session count for app %q: %v\n", app.ID, err)
				continue
			}
			if sessionCountRows != nil {
				if err := sessionCountRows.Close(); err != nil {
					fmt.Printf("Error closing session count rows for app %q: %v\n", app.ID, err)
				}
			}

			createCrashAlertsForApp(ctx, team, app, from, to, sessionCount)
			createAnrAlertsForApp(ctx, team, app, from, to, sessionCount)
		}
	}
}

func CreateBugReportAlerts(ctx context.Context) {
	fmt.Println("Checking for new Bug Report alerts...")
	teams, err := getTeams(ctx)
	if err != nil {
		fmt.Printf("Error fetching teams: %v\n", err)
		return
	}

	for _, team := range teams {
		apps, err := getAppsForTeam(ctx, team.ID)
		if err != nil {
			fmt.Printf("Error fetching apps for team %v: %v\n", team.ID, err)
			continue
		}

		for _, app := range apps {
			from := time.Now().UTC().Add(-bugReportTimePeriod)
			to := time.Now().UTC()

			bugReportStmt := sqlf.From("bug_reports final").
				Select("event_id, description").
				Where("team_id = toUUID(?)", app.TeamID).
				Where("app_id = toUUID(?)", app.ID).
				Where("timestamp >= ? and timestamp <= ?", from, to)

			defer bugReportStmt.Close()

			bugReportRows, err := server.Server.RchPool.Query(ctx, bugReportStmt.String(), bugReportStmt.Args()...)
			if err != nil {
				fmt.Printf("Error fetching bug reports for app %v: %v\n", app.ID, err)
				continue
			}

			appName, err := getAppNameByID(ctx, app.ID)
			if err != nil {
				fmt.Printf("Error fetching app name for app %v: %v\n", app.ID, err)
				continue
			}

			for bugReportRows.Next() {
				var bugReportId string
				var description string
				if err := bugReportRows.Scan(&bugReportId, &description); err != nil {
					fmt.Printf("Error scanning bug report row: %v\n", err)
					continue
				}

				// Check if we already alerted for this specific bug report
				alertExistsStmt := sqlf.PostgreSQL.
					Select("id").
					From("alerts").
					Where("team_id = ?", team.ID).
					Where("app_id = ?", app.ID).
					Where("entity_id = ?", bugReportId).
					Where("type = ?", string(AlertTypeBugReport)).
					Limit(1)

				defer alertExistsStmt.Close()

				var existingAlertId uuid.UUID
				err = server.Server.PgPool.QueryRow(ctx, alertExistsStmt.String(), alertExistsStmt.Args()...).Scan(&existingAlertId)
				if err == nil {
					// Alert already exists for this bug report, skip
					continue
				} else if err != pgx.ErrNoRows {
					fmt.Printf("Error checking existing alert for bug report %s: %v\n", bugReportId, err)
					continue
				}

				alertMsg := email.BugReportAlertMessage(description)
				alertUrl := email.BugReportAlertURL(server.Server.Config.SiteOrigin, team.ID.String(), app.ID.String(), bugReportId)

				fmt.Printf("Inserting alert for bug report %s\n", bugReportId)

				alertID := uuid.New()
				alertInsert := sqlf.PostgreSQL.InsertInto("alerts").
					Set("id", alertID).
					Set("team_id", team.ID).
					Set("app_id", app.ID).
					Set("entity_id", bugReportId).
					Set("type", string(AlertTypeBugReport)).
					Set("message", alertMsg).
					Set("url", alertUrl).
					Set("created_at", time.Now()).
					Set("updated_at", time.Now())

				defer alertInsert.Close()

				_, err = server.Server.PgPool.Exec(ctx, alertInsert.String(), alertInsert.Args()...)
				if err != nil {
					fmt.Printf("Error inserting alert for bug report %s: %v\n", bugReportId, err)
					continue
				}

				alert := Alert{
					ID:       alertID,
					TeamID:   team.ID,
					AppID:    app.ID,
					EntityID: bugReportId,
					Type:     string(AlertTypeBugReport),
				}

				scheduleEmailAlertsForteamMembers(ctx, alert, alertMsg, alertUrl, appName)
				scheduleSlackAlertsForTeamChannels(ctx, alert, alertMsg, alertUrl, appName)
			}

			if bugReportRows != nil {
				bugReportRows.Close()
			}
		}
	}
}

func CreateDailySummary(ctx context.Context) {
	fmt.Println("Creating daily summary...")

	date := time.Now().UTC()

	teams, err := getTeams(ctx)
	if err != nil {
		fmt.Printf("Error fetching teams: %v\n", err)
		return
	}

	for _, team := range teams {
		apps, err := getAppsForTeam(ctx, team.ID)
		if err != nil {
			fmt.Printf("Error fetching apps for team %v: %v\n", team.ID, err)
			continue
		}

		for _, app := range apps {
			appName, err := getAppNameByID(ctx, app.ID)
			if err != nil {
				fmt.Printf("Error fetching app name for app %v: %v\n", app.ID, err)
				continue
			}

			metrics, err := getDailySummaryMetrics(ctx, date, &app)
			if err != nil {
				fmt.Printf("Error fetching daily summary data for app %v: %v\n", app.ID, err)
				continue
			}

			_, dailySummaryEmailBody := email.DailySummaryEmail(appName, date, metrics, server.Server.Config.SiteOrigin, team.ID.String(), app.ID.String())
			scheduleDailySummaryEmailForteamMembers(ctx, team.ID, app.ID, dailySummaryEmailBody, appName)
			dashboardURL := fmt.Sprintf("%s/%s/overview?a=%s", server.Server.Config.SiteOrigin, team.ID, app.ID)
			scheduleDailySummarySlackMessageForTeamChannels(ctx, team.ID, app.ID, dashboardURL, appName, date, metrics)
		}
	}
}

func getTeams(ctx context.Context) ([]Team, error) {
	teams := []Team{}
	stmt := sqlf.PostgreSQL.
		Select("id").
		From("teams")

	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(ctx, stmt.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var t Team
		if err := rows.Scan(&t.ID); err != nil {
			return nil, err
		}
		teams = append(teams, t)
	}
	return teams, nil
}

func getAppsForTeam(ctx context.Context, teamID uuid.UUID) ([]App, error) {
	apps := []App{}
	stmt := sqlf.PostgreSQL.
		Select("id").
		Select("team_id").
		From("apps").
		Where("team_id = ?", teamID)

	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var a App
		if err := rows.Scan(&a.ID, &a.TeamID); err != nil {
			return nil, err
		}
		apps = append(apps, a)
	}
	return apps, nil
}

func getAppNameByID(ctx context.Context, appID uuid.UUID) (string, error) {
	appNameStmt := sqlf.PostgreSQL.
		Select("app_name").
		From("apps").
		Where("id = ?", appID)

	defer appNameStmt.Close()

	var appName string
	err := server.Server.PgPool.QueryRow(ctx, appNameStmt.String(), appNameStmt.Args()...).Scan(&appName)
	if err != nil {
		return "", err
	}
	return appName, nil
}

func getDailySummaryMetrics(ctx context.Context, date time.Time, app *App) ([]email.MetricData, error) {
	query := `
		WITH
            toDate(?) AS target_date,

            daily_metrics AS (
                SELECT
                    app_id,
                    toDate(timestamp) AS date,
                    uniqMerge(unique_sessions) AS total_sessions,
                    uniqMerge(crash_sessions) AS crash_sessions,
                    uniqMerge(perceived_crash_sessions) AS perceived_crash_sessions,
                    uniqMerge(anr_sessions) AS anr_sessions,
                    uniqMerge(perceived_anr_sessions) AS perceived_anr_sessions,
                    quantileMerge(0.95)(cold_launch_p95) AS cold_launch_p95_ms,
                    quantileMerge(0.95)(warm_launch_p95) AS warm_launch_p95_ms,
                    quantileMerge(0.95)(hot_launch_p95) AS hot_launch_p95_ms
                FROM app_metrics
                WHERE timestamp >= target_date - INTERVAL 1 DAY
                    AND timestamp < target_date + INTERVAL 1 DAY
                    AND team_id = toUUID(?)
                    AND app_id = toUUID(?)
                GROUP BY app_id, date
            ),

            current_day AS (
                SELECT * FROM daily_metrics WHERE date = target_date
            ),
            previous_day AS (
                SELECT * FROM daily_metrics WHERE date = target_date - 1
            )

        SELECT
            cd.app_id,
            cd.date,

            -- Sessions
            toString(cd.total_sessions) AS sessions_value,
            'Sessions' AS sessions_label,
            CASE
                WHEN pd.total_sessions IS NULL OR pd.total_sessions = 0 THEN 'No previous day data'
                WHEN cd.total_sessions > pd.total_sessions THEN concat(toString(cd.total_sessions - pd.total_sessions), ' greater than yesterday')
                WHEN cd.total_sessions < pd.total_sessions THEN concat(toString(pd.total_sessions - cd.total_sessions), ' less than yesterday')
                ELSE 'No change from yesterday'
            END AS sessions_subtitle,
            0 AS sessions_has_warning,
            0 AS sessions_has_error,

            -- Crash-free sessions
            CASE
                WHEN cd.total_sessions = 0 THEN '0%'
                ELSE concat(toString(round((cd.total_sessions - cd.crash_sessions) * 100.0 / cd.total_sessions, 2)), '%')
            END AS crash_free_value,
            'Crash free sessions' AS crash_free_label,
            CASE
                WHEN pd.total_sessions = 0 OR pd.total_sessions IS NULL THEN 'No previous day data'
                WHEN (cd.crash_sessions * 1.0 / nullIf(cd.total_sessions, 0)) < (pd.crash_sessions * 1.0 / nullIf(pd.total_sessions, 0)) THEN concat(toString(if(isNaN(round(
                    ((cd.total_sessions - cd.crash_sessions) * 1.0 / nullIf(cd.total_sessions, 0)) /
                    nullIf((pd.total_sessions - pd.crash_sessions) * 1.0 / nullIf(pd.total_sessions, 0), 0), 2)), 0, round(
                    ((cd.total_sessions - cd.crash_sessions) * 1.0 / nullIf(cd.total_sessions, 0)) /
                    nullIf((pd.total_sessions - pd.crash_sessions) * 1.0 / nullIf(pd.total_sessions, 0), 0), 2))), 'x better than yesterday')
                WHEN (cd.crash_sessions * 1.0 / nullIf(cd.total_sessions, 0)) > (pd.crash_sessions * 1.0 / nullIf(pd.total_sessions, 0)) THEN concat(toString(if(isNaN(round(
                    ((cd.total_sessions - cd.crash_sessions) * 1.0 / nullIf(cd.total_sessions, 0)) /
                    nullIf((pd.total_sessions - pd.crash_sessions) * 1.0 / nullIf(pd.total_sessions, 0), 0), 2)), 0, round(
                    ((cd.total_sessions - cd.crash_sessions) * 1.0 / nullIf(cd.total_sessions, 0)) /
                    nullIf((pd.total_sessions - pd.crash_sessions) * 1.0 / nullIf(pd.total_sessions, 0), 0), 2))), 'x worse than yesterday')
                ELSE 'No change from yesterday'
            END AS crash_free_subtitle,
            (cd.total_sessions != 0 AND (cd.total_sessions - cd.crash_sessions) * 100.0 / cd.total_sessions < 95) AS crash_free_has_warning,
            (cd.total_sessions != 0 AND (cd.total_sessions - cd.crash_sessions) * 100.0 / cd.total_sessions < 90) AS crash_free_has_error,

            -- ANR-free sessions
            CASE
                WHEN cd.total_sessions = 0 THEN '0%'
                ELSE concat(toString(round((cd.total_sessions - cd.anr_sessions) * 100.0 / cd.total_sessions, 2)), '%')
            END AS anr_free_value,
            'ANR free sessions' AS anr_free_label,
            CASE
                WHEN pd.total_sessions = 0 OR pd.total_sessions IS NULL THEN 'No previous day data'
                WHEN (cd.anr_sessions * 1.0 / nullIf(cd.total_sessions, 0)) < (pd.anr_sessions * 1.0 / nullIf(pd.total_sessions, 0)) THEN concat(toString(if(isNaN(round(
                    ((cd.total_sessions - cd.anr_sessions) * 1.0 / nullIf(cd.total_sessions, 0)) /
                    nullIf((pd.total_sessions - pd.anr_sessions) * 1.0 / nullIf(pd.total_sessions, 0), 0), 2)), 0, round(
                    ((cd.total_sessions - cd.anr_sessions) * 1.0 / nullIf(cd.total_sessions, 0)) /
                    nullIf((pd.total_sessions - pd.anr_sessions) * 1.0 / nullIf(pd.total_sessions, 0), 0), 2))), 'x better than yesterday')
                WHEN (cd.anr_sessions * 1.0 / nullIf(cd.total_sessions, 0)) > (pd.anr_sessions * 1.0 / nullIf(pd.total_sessions, 0)) THEN concat(toString(if(isNaN(round(
                    ((cd.total_sessions - cd.anr_sessions) * 1.0 / nullIf(cd.total_sessions, 0)) /
                    nullIf((pd.total_sessions - pd.anr_sessions) * 1.0 / nullIf(pd.total_sessions, 0), 0), 2)), 0, round(
                    ((cd.total_sessions - cd.anr_sessions) * 1.0 / nullIf(cd.total_sessions, 0)) /
                    nullIf((pd.total_sessions - pd.anr_sessions) * 1.0 / nullIf(pd.total_sessions, 0), 0), 2))), 'x worse than yesterday')
                ELSE 'No change from yesterday'
            END AS anr_free_subtitle,
            (cd.total_sessions != 0 AND (cd.total_sessions - cd.anr_sessions) * 100.0 / cd.total_sessions < 98) AS anr_free_has_warning,
            (cd.total_sessions != 0 AND (cd.total_sessions - cd.anr_sessions) * 100.0 / cd.total_sessions < 95) AS anr_free_has_error,

            -- Cold Launch
            CASE
                WHEN isNaN(cd.cold_launch_p95_ms) OR cd.cold_launch_p95_ms = 0 THEN '0ms'
                ELSE concat(toString(round(cd.cold_launch_p95_ms, 2)), 'ms')
            END AS cold_launch_value,
            'Cold launch time' AS cold_launch_label,
            CASE
                WHEN pd.cold_launch_p95_ms IS NULL OR pd.cold_launch_p95_ms = 0 THEN 'No previous day data'
                WHEN cd.cold_launch_p95_ms < pd.cold_launch_p95_ms THEN concat(toString(round(cd.cold_launch_p95_ms / pd.cold_launch_p95_ms, 2)), 'x better than yesterday')
                WHEN cd.cold_launch_p95_ms > pd.cold_launch_p95_ms THEN concat(toString(round(cd.cold_launch_p95_ms / pd.cold_launch_p95_ms, 2)), 'x worse than yesterday')
                ELSE 'No change from yesterday'
            END AS cold_launch_subtitle,
            0 AS cold_launch_has_warning,
            0 AS cold_launch_has_error,

            -- Warm Launch
            CASE
                WHEN isNaN(cd.warm_launch_p95_ms) OR cd.warm_launch_p95_ms = 0 THEN '0ms'
                ELSE concat(toString(round(cd.warm_launch_p95_ms, 2)), 'ms')
            END AS warm_launch_value,
            'Warm launch time' AS warm_launch_label,
            CASE
                WHEN pd.warm_launch_p95_ms IS NULL OR pd.warm_launch_p95_ms = 0 THEN 'No previous day data'
                WHEN cd.warm_launch_p95_ms < pd.warm_launch_p95_ms THEN concat(toString(round(cd.warm_launch_p95_ms / pd.warm_launch_p95_ms, 2)), 'x better than yesterday')
                WHEN cd.warm_launch_p95_ms > pd.warm_launch_p95_ms THEN concat(toString(round(cd.warm_launch_p95_ms / pd.warm_launch_p95_ms, 2)), 'x worse than yesterday')
                ELSE 'No change from yesterday'
            END AS warm_launch_subtitle,
            0 AS warm_launch_has_warning,
            0 AS warm_launch_has_error,

            -- Hot Launch
            CASE
                WHEN isNaN(cd.hot_launch_p95_ms) OR cd.hot_launch_p95_ms = 0 THEN '0ms'
                ELSE concat(toString(round(cd.hot_launch_p95_ms, 2)), 'ms')
            END AS hot_launch_value,
            'Hot launch time' AS hot_launch_label,
            CASE
                WHEN pd.hot_launch_p95_ms IS NULL OR pd.hot_launch_p95_ms = 0 THEN 'No previous day data'
                WHEN cd.hot_launch_p95_ms < pd.hot_launch_p95_ms THEN concat(toString(round(cd.hot_launch_p95_ms / pd.hot_launch_p95_ms, 2)), 'x better than yesterday')
                WHEN cd.hot_launch_p95_ms > pd.hot_launch_p95_ms THEN concat(toString(round(cd.hot_launch_p95_ms / pd.hot_launch_p95_ms, 2)), 'x worse than yesterday')
                ELSE 'No change from yesterday'
            END AS hot_launch_subtitle,
            0 AS hot_launch_has_warning,
            0 AS hot_launch_has_error


        FROM current_day cd
        LEFT JOIN previous_day pd ON cd.app_id = pd.app_id
        ORDER BY cd.app_id
	`
	row := server.Server.ChPool.QueryRow(ctx, query, date, app.TeamID, app.ID)

	var summary DailySummaryRow
	err := row.Scan(
		&summary.AppID,
		&summary.Date,
		&summary.SessionsValue,
		&summary.SessionsLabel,
		&summary.SessionsSubtitle,
		&summary.SessionsHasWarning,
		&summary.SessionsHasError,
		&summary.CrashFreeValue,
		&summary.CrashFreeLabel,
		&summary.CrashFreeSubtitle,
		&summary.CrashFreeHasWarning,
		&summary.CrashFreeHasError,
		&summary.ANRFreeValue,
		&summary.ANRFreeLabel,
		&summary.ANRFreeSubtitle,
		&summary.ANRFreeHasWarning,
		&summary.ANRFreeHasError,
		&summary.ColdLaunchValue,
		&summary.ColdLaunchLabel,
		&summary.ColdLaunchSubtitle,
		&summary.ColdLaunchHasWarning,
		&summary.ColdLaunchHasError,
		&summary.WarmLaunchValue,
		&summary.WarmLaunchLabel,
		&summary.WarmLaunchSubtitle,
		&summary.WarmLaunchHasWarning,
		&summary.WarmLaunchHasError,
		&summary.HotLaunchValue,
		&summary.HotLaunchLabel,
		&summary.HotLaunchSubtitle,
		&summary.HotLaunchHasWarning,
		&summary.HotLaunchHasError,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to scan daily summary: %w", err)
	}

	metrics := []email.MetricData{
		{
			Value:      summary.SessionsValue,
			Label:      summary.SessionsLabel,
			HasWarning: summary.SessionsHasWarning,
			HasError:   summary.SessionsHasError,
			Subtitle:   summary.SessionsSubtitle,
		},
		{
			Value:      summary.CrashFreeValue,
			Label:      summary.CrashFreeLabel,
			HasWarning: summary.CrashFreeHasWarning,
			HasError:   summary.CrashFreeHasError,
			Subtitle:   summary.CrashFreeSubtitle,
		},
		{
			Value:      summary.ANRFreeValue,
			Label:      summary.ANRFreeLabel,
			HasWarning: summary.ANRFreeHasWarning,
			HasError:   summary.ANRFreeHasError,
			Subtitle:   summary.ANRFreeSubtitle,
		},
		{
			Value:      summary.ColdLaunchValue,
			Label:      summary.ColdLaunchLabel,
			HasWarning: summary.ColdLaunchHasWarning,
			HasError:   summary.ColdLaunchHasError,
			Subtitle:   summary.ColdLaunchSubtitle,
		},
		{
			Value:      summary.WarmLaunchValue,
			Label:      summary.WarmLaunchLabel,
			HasWarning: summary.WarmLaunchHasWarning,
			HasError:   summary.WarmLaunchHasError,
			Subtitle:   summary.WarmLaunchSubtitle,
		},
		{
			Value:      summary.HotLaunchValue,
			Label:      summary.HotLaunchLabel,
			HasWarning: summary.HotLaunchHasWarning,
			HasError:   summary.HotLaunchHasError,
			Subtitle:   summary.HotLaunchSubtitle,
		},
	}

	bugReportCountQuery := `
		WITH toDate(?) AS target_date
		SELECT
			countIf(toDate(timestamp) = target_date)     AS today_count,
			countIf(toDate(timestamp) = target_date - 1) AS yesterday_count
		FROM bug_reports
		WHERE app_id = toUUID(?)
		  AND toDate(timestamp) >= target_date - 1
		  AND toDate(timestamp) <= target_date
	`
	var todayBugReportCount, yesterdayBugReportCount uint64
	bugCountRow := server.Server.ChPool.QueryRow(ctx, bugReportCountQuery, date, app.ID)
	if err := bugCountRow.Scan(&todayBugReportCount, &yesterdayBugReportCount); err != nil {
		return nil, fmt.Errorf("failed to scan bug report count: %w", err)
	}
	if todayBugReportCount > 0 {
		bugSubtitle := "No previous day data"
		if yesterdayBugReportCount > 0 {
			switch {
			case todayBugReportCount > yesterdayBugReportCount:
				bugSubtitle = fmt.Sprintf("%d greater than yesterday", todayBugReportCount-yesterdayBugReportCount)
			case todayBugReportCount < yesterdayBugReportCount:
				bugSubtitle = fmt.Sprintf("%d less than yesterday", yesterdayBugReportCount-todayBugReportCount)
			default:
				bugSubtitle = "No change from yesterday"
			}
		}
		metrics = append(metrics, email.MetricData{
			Value:    fmt.Sprintf("%d", todayBugReportCount),
			Label:    "Bug reports",
			Subtitle: bugSubtitle,
		})
	}

	return metrics, nil
}

func isInCooldown(ctx context.Context, teamID, appID uuid.UUID, entityID, alertType string, cooldown time.Duration) (bool, error) {
	stmt := sqlf.PostgreSQL.
		Select("created_at").
		From("alerts").
		Where("team_id = ?", teamID).
		Where("app_id = ?", appID).
		Where("entity_id = ?", entityID).
		Where("type = ?", alertType).
		OrderBy("created_at DESC").
		Limit(1)

	defer stmt.Close()

	var createdAt time.Time
	row := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...)
	err := row.Scan(&createdAt)
	if err != nil {
		return false, nil // no previous alert
	}
	if time.Since(createdAt) < cooldown {
		return true, nil
	}
	return false, nil
}

func scheduleEmailAlertsForteamMembers(ctx context.Context, alert Alert, message, url, appName string) {
	var subject, body string
	if alert.Type == string(AlertTypeCrashSpike) {
		subject, body = email.CrashSpikeAlertEmail(appName, message, url)
	} else if alert.Type == string(AlertTypeAnrSpike) {
		subject, body = email.AnrSpikeAlertEmail(appName, message, url)
	} else if alert.Type == string(AlertTypeBugReport) {
		subject, body = email.BugReportAlertEmail(appName, message, url)
	} else {
		subject = appName + " - Alert"
		body = email.RenderEmailBody(subject, email.MessageContent(message), "View in Dashboard", url)
	}

	pendingEmail := email.EmailInfo{
		From:        server.Server.Config.TxEmailAddress,
		Subject:     subject,
		ContentType: "text/html",
		Body:        body,
	}
	if err := email.QueueEmailForTeam(ctx, server.Server.PgPool, alert.TeamID, alert.AppID, pendingEmail); err != nil {
		fmt.Printf("Error queueing alert emails for team %v: %v\n", alert.TeamID, err)
	}
}

func scheduleSlackAlertsForTeamChannels(ctx context.Context, alert Alert, message, url, appName string) {
	teamSlackStmt := `
    SELECT bot_token, channel_ids, is_active
    FROM team_slack
    WHERE team_id = $1 AND is_active = true
`
	var botToken string
	var channelIds []string
	var isActive bool

	err := server.Server.PgPool.QueryRow(ctx, teamSlackStmt, alert.TeamID).Scan(&botToken, &channelIds, &isActive)
	if err != nil {
		if err == pgx.ErrNoRows {
			fmt.Printf("No active Slack integration found for team %v\n", alert.TeamID)
		} else {
			fmt.Printf("Error fetching Slack integration for team %v: %v\n", alert.TeamID, err)
		}
		return
	}

	if !isActive || len(channelIds) == 0 {
		fmt.Printf("Slack integration not active or no channels configured for team %v\n", alert.TeamID)
		return
	}

	title := appName + " - Alert"
	if alert.Type == string(AlertTypeCrashSpike) {
		title = appName + " - Crash Spike Alert"
	} else if alert.Type == string(AlertTypeAnrSpike) {
		title = appName + " - ANR Spike Alert"
	} else if alert.Type == string(AlertTypeBugReport) {
		title = appName + " - New Bug Report"
	}

	slackMessage := formatSlackAlertMessage(title, message, url)

	for _, channelId := range channelIds {
		slackData := slack.SlackMessageData{
			Channel:  channelId,
			Blocks:   slackMessage.Blocks,
			BotToken: botToken,
		}

		dataJson, err := json.Marshal(slackData)
		if err != nil {
			fmt.Printf("Error marshaling Slack data for channel %v: %v\n", channelId, err)
			continue
		}

		insertStmt := sqlf.PostgreSQL.
			InsertInto("pending_alert_messages").
			Set("id", uuid.New()).
			Set("team_id", alert.TeamID).
			Set("app_id", alert.AppID).
			Set("channel", "slack").
			SetExpr("data", "?::jsonb", string(dataJson)).
			Set("created_at", time.Now()).
			Set("updated_at", time.Now())

		defer insertStmt.Close()

		_, err = server.Server.PgPool.Exec(ctx, insertStmt.String(), insertStmt.Args()...)
		if err != nil {
			fmt.Printf("Error inserting pending Slack alert message for channel %v: %v\n", channelId, err)
			continue
		}
	}
}

func scheduleDailySummaryEmailForteamMembers(ctx context.Context, teamId uuid.UUID, appId uuid.UUID, emailBody, appName string) {
	pendingEmail := email.EmailInfo{
		From:        server.Server.Config.TxEmailAddress,
		Subject:     appName + " Daily Summary",
		ContentType: "text/html",
		Body:        emailBody,
	}
	if err := email.QueueEmailForTeam(ctx, server.Server.PgPool, teamId, appId, pendingEmail); err != nil {
		fmt.Printf("Error queueing daily summary emails for team %v: %v\n", teamId, err)
	}
}

func scheduleDailySummarySlackMessageForTeamChannels(ctx context.Context, teamId uuid.UUID, appId uuid.UUID, dashboardURL, appName string, date time.Time, metrics []email.MetricData) {
	teamSlackStmt := `
    SELECT bot_token, channel_ids, is_active
    FROM team_slack
    WHERE team_id = $1 AND is_active = true
`
	var botToken string
	var channelIds []string
	var isActive bool

	err := server.Server.PgPool.QueryRow(ctx, teamSlackStmt, teamId).Scan(&botToken, &channelIds, &isActive)
	if err != nil {
		if err == pgx.ErrNoRows {
			fmt.Printf("No active Slack integration found for team %v\n", teamId)
		} else {
			fmt.Printf("Error fetching Slack integration for team %v: %v\n", teamId, err)
		}
		return
	}

	if !isActive || len(channelIds) == 0 {
		fmt.Printf("Slack integration not active or no channels configured for team %v\n", teamId)
		return
	}

	slackMessage := formatDailySummarySlackMessage(appName, dashboardURL, date, metrics)

	for _, channelId := range channelIds {
		slackData := slack.SlackMessageData{
			Channel:  channelId,
			Blocks:   slackMessage.Blocks,
			BotToken: botToken,
		}

		dataJson, err := json.Marshal(slackData)
		if err != nil {
			fmt.Printf("Error marshaling Slack data for channel %v: %v\n", channelId, err)
			continue
		}

		insertStmt := sqlf.PostgreSQL.
			InsertInto("pending_alert_messages").
			Set("id", uuid.New()).
			Set("team_id", teamId).
			Set("app_id", appId).
			Set("channel", "slack").
			SetExpr("data", "?::jsonb", string(dataJson)).
			Set("created_at", time.Now()).
			Set("updated_at", time.Now())

		defer insertStmt.Close()

		_, err = server.Server.PgPool.Exec(ctx, insertStmt.String(), insertStmt.Args()...)
		if err != nil {
			fmt.Printf("Error inserting pending Slack message for channel %v: %v\n", channelId, err)
			continue
		}
	}
}

func formatSlackAlertMessage(title, message, url string) slack.SlackMessage {
	blocks := []slack.SlackBlock{
		slack.SlackHeaderBlock{
			Type: "header",
			Text: &slack.SlackText{
				Type: "plain_text",
				Text: fmt.Sprintf("🚨 %s", title),
			},
		},
	}

	blocks = append(blocks, slack.SlackSectionBlock{
		Type: "section",
		Text: &slack.SlackText{
			Type: "mrkdwn",
			Text: message,
		},
	})

	blocks = append(blocks,
		slack.SlackDividerBlock{
			Type: "divider",
		},
		slack.SlackContextBlock{
			Type: "context",
			Elements: []slack.SlackText{
				{
					Type: "mrkdwn",
					Text: fmt.Sprintf("Alert triggered at <!date^%d^{date_short} {time}|%s>", time.Now().Unix(), time.Now().Format("2006-01-02 15:04:05")),
				},
			},
		},
		slack.SlackActionsBlock{
			Type: "actions",
			Elements: []slack.SlackElement{
				{
					Type: "button",
					Text: &slack.SlackText{
						Type: "plain_text",
						Text: "View Dashboard",
					},
					URL: url,
				},
			},
		},
	)

	return slack.SlackMessage{
		Blocks: blocks,
	}
}

func formatDailySummarySlackMessage(appName, dashboardURL string, date time.Time, metrics []email.MetricData) slack.SlackMessage {
	formattedDate := date.Format("January 2, 2006")

	blocks := []slack.SlackBlock{
		// Title
		slack.SlackHeaderBlock{
			Type: "header",
			Text: &slack.SlackText{
				Type: "plain_text",
				Text: fmt.Sprintf("%s — Daily Summary", appName),
			},
		},

		// Date subtitle
		slack.SlackSectionBlock{
			Type: "section",
			Text: &slack.SlackText{
				Type: "mrkdwn",
				Text: fmt.Sprintf("*%s*  _(last 24 hours)_", formattedDate),
			},
		},

		slack.SlackDividerBlock{Type: "divider"},
	}

	for _, metric := range metrics {
		status := "🟢"
		if metric.HasError {
			status = "🔴"
		} else if metric.HasWarning {
			status = "🟡"
		}

		blocks = append(blocks,
			slack.SlackSectionBlock{
				Type: "section",
				Fields: []slack.SlackText{
					{
						Type: "mrkdwn",
						Text: fmt.Sprintf("*%s*", metric.Label),
					},
					{
						Type: "mrkdwn",
						Text: fmt.Sprintf("%s *%s*\n_%s_", status, metric.Value, metric.Subtitle),
					},
				},
			},
			// Spacer between rows
			slack.SlackContextBlock{
				Type: "context",
				Elements: []slack.SlackText{
					{Type: "mrkdwn", Text: " "},
				},
			},
		)
	}

	// Divider before button
	blocks = append(blocks, slack.SlackDividerBlock{Type: "divider"})

	// Button
	blocks = append(blocks, slack.SlackActionsBlock{
		Type: "actions",
		Elements: []slack.SlackElement{
			{
				Type: "button",
				Text: &slack.SlackText{
					Type: "plain_text",
					Text: "View Dashboard",
				},
				URL: dashboardURL,
			},
		},
	})

	return slack.SlackMessage{
		Blocks: blocks,
	}
}

func createCrashAlertsForApp(ctx context.Context, team Team, app App, from, to time.Time, sessionCount uint64) {
	crashGroupStmt := sqlf.
		From("events final").
		Select("exception.fingerprint, count() as crash_count").
		Where("team_id = toUUID(?)", team.ID).
		Where("app_id = toUUID(?)", app.ID).
		Where("type = 'exception'").
		Where("exception.handled = false").
		Where("timestamp >= ? and timestamp <= ?", from, to).
		GroupBy("exception.fingerprint")

	defer crashGroupStmt.Close()

	crashGroupRows, err := server.Server.RchPool.Query(ctx, crashGroupStmt.String(), crashGroupStmt.Args()...)
	if err != nil {
		fmt.Printf("Error fetching crash group stats for app %v: %v\n", app.ID, err)
		return
	}
	for crashGroupRows.Next() {
		var fingerprint string
		var crashGroupCount uint64
		if err := crashGroupRows.Scan(&fingerprint, &crashGroupCount); err != nil {
			fmt.Printf("Error scanning crash group row: %v\n", err)
			continue
		}

		inCooldown, err := isInCooldown(ctx, team.ID, app.ID, fingerprint, string(AlertTypeCrashSpike), cooldownPeriodForEntity)
		if err != nil {
			fmt.Printf("Error checking cooldown for crash group %s: %v\n", fingerprint, err)
			continue
		}

		if inCooldown {
			continue
		}

		if crashGroupCount < uint64(minCrashOrAnrCountThreshold) {
			continue
		}

		var crashGroupRate float64 = 0
		if sessionCount > 0 {
			crashGroupRate = float64(crashGroupCount) / float64(sessionCount) * 100
		}

		if crashGroupRate >= crashOrAnrSpikeThreshold {
			var crashType, fileName, methodName, message string
			groupInfoStmt := sqlf.
				From("unhandled_exception_groups final").
				Select("argMax(type, timestamp)").
				Select("argMax(file_name, timestamp)").
				Select("argMax(method_name, timestamp)").
				Select("argMax(message, timestamp)").
				Where("team_id = toUUID(?)", team.ID).
				Where("app_id = toUUID(?)", app.ID).
				Where("id = ?", fingerprint)

			defer groupInfoStmt.Close()

			groupInfoRow := server.Server.RchPool.QueryRow(ctx, groupInfoStmt.String(), groupInfoStmt.Args()...)
			err := groupInfoRow.Scan(&crashType, &fileName, &methodName, &message)
			if err != nil {
				fmt.Printf("Error fetching group info for %s: %v\n", fingerprint, err)
				continue
			}

			file := fileName
			if file == "" {
				file = "unknown_file"
			}
			method := methodName
			if method == "" {
				method = "unknown_method"
			}
			alertMsg := email.CrashAlertMessage(file, method, message)
			alertUrl := email.CrashAlertURL(server.Server.Config.SiteOrigin, team.ID.String(), app.ID.String(), fingerprint, crashType, fileName)

			fmt.Printf("Inserting alert for crash group %s\n", fingerprint)

			alertID := uuid.New()
			alertInsert := sqlf.PostgreSQL.InsertInto("alerts").
				Set("id", alertID).
				Set("team_id", team.ID).
				Set("app_id", app.ID).
				Set("entity_id", fingerprint).
				Set("type", string(AlertTypeCrashSpike)).
				Set("message", alertMsg).
				Set("url", alertUrl).
				Set("created_at", time.Now()).
				Set("updated_at", time.Now())

			defer alertInsert.Close()

			_, err = server.Server.PgPool.Exec(ctx, alertInsert.String(), alertInsert.Args()...)
			if err != nil {
				fmt.Printf("Error inserting alert for crash group %s: %v\n", fingerprint, err)
				continue
			}

			appName, err := getAppNameByID(ctx, app.ID)
			if err != nil {
				fmt.Printf("Error fetching app name for app %v: %v\n", app.ID, err)
				continue
			}

			alert := Alert{
				ID:       alertID,
				TeamID:   team.ID,
				AppID:    app.ID,
				EntityID: fingerprint,
				Type:     string(AlertTypeCrashSpike),
			}

			scheduleEmailAlertsForteamMembers(ctx, alert, alertMsg, alertUrl, appName)
			scheduleSlackAlertsForTeamChannels(ctx, alert, alertMsg, alertUrl, appName)
		}
	}

	if crashGroupRows != nil {
		crashGroupRows.Close()
	}
}

func createAnrAlertsForApp(ctx context.Context, team Team, app App, from, to time.Time, sessionCount uint64) {
	anrGroupStmt := sqlf.From("events final").
		Select("anr.fingerprint, count() as anr_count").
		Where("team_id = toUUID(?)", team.ID).
		Where("app_id = toUUID(?)", app.ID).
		Where("type = 'anr'").
		Where("timestamp >= ? and timestamp <= ?", from, to).
		GroupBy("anr.fingerprint")

	defer anrGroupStmt.Close()

	anrGroupRows, err := server.Server.RchPool.Query(ctx, anrGroupStmt.String(), anrGroupStmt.Args()...)
	if err != nil {
		fmt.Printf("Error fetching crash group stats for app %v: %v\n", app.ID, err)
		return
	}
	for anrGroupRows.Next() {
		var fingerprint string
		var anrGroupCount uint64
		if err := anrGroupRows.Scan(&fingerprint, &anrGroupCount); err != nil {
			fmt.Printf("Error scanning crash group row: %v\n", err)
			continue
		}

		inCooldown, err := isInCooldown(ctx, team.ID, app.ID, fingerprint, string(AlertTypeAnrSpike), cooldownPeriodForEntity)
		if err != nil {
			fmt.Printf("Error checking cooldown for anr group %s: %v\n", fingerprint, err)
			continue
		}

		if inCooldown {
			continue
		}

		if anrGroupCount < uint64(minCrashOrAnrCountThreshold) {
			continue
		}

		var anrGroupRate float64 = 0
		if sessionCount > 0 {
			anrGroupRate = float64(anrGroupCount) / float64(sessionCount) * 100
		}

		if anrGroupRate >= crashOrAnrSpikeThreshold {
			var crashType, fileName, methodName, message string
			groupInfoStmt := sqlf.From("anr_groups final").
				Select("argMax(type, timestamp)").
				Select("argMax(file_name, timestamp)").
				Select("argMax(method_name, timestamp)").
				Select("argMax(message, timestamp)").
				Where("team_id = toUUID(?)", team.ID).
				Where("app_id = toUUID(?)", app.ID).
				Where("id = ?", fingerprint)

			defer groupInfoStmt.Close()

			groupInfoRow := server.Server.RchPool.QueryRow(ctx, groupInfoStmt.String(), groupInfoStmt.Args()...)
			err := groupInfoRow.Scan(&crashType, &fileName, &methodName, &message)
			if err != nil {
				fmt.Printf("Error fetching group info for %s: %v\n", fingerprint, err)
				continue
			}

			file := fileName
			if file == "" {
				file = "unknown_file"
			}
			method := methodName
			if method == "" {
				method = "unknown_method"
			}
			alertMsg := email.AnrAlertMessage(file, method, message)
			alertUrl := email.AnrAlertURL(server.Server.Config.SiteOrigin, team.ID.String(), app.ID.String(), fingerprint, crashType, fileName)

			fmt.Printf("Inserting alert for anr group %s\n", fingerprint)

			alertID := uuid.New()
			alertInsert := sqlf.PostgreSQL.InsertInto("alerts").
				Set("id", alertID).
				Set("team_id", team.ID).
				Set("app_id", app.ID).
				Set("entity_id", fingerprint).
				Set("type", string(AlertTypeAnrSpike)).
				Set("message", alertMsg).
				Set("url", alertUrl).
				Set("created_at", time.Now()).
				Set("updated_at", time.Now())

			defer alertInsert.Close()

			_, err = server.Server.PgPool.Exec(ctx, alertInsert.String(), alertInsert.Args()...)
			if err != nil {
				fmt.Printf("Error inserting alert for anr group %s: %v\n", fingerprint, err)
				continue
			}

			appName, err := getAppNameByID(ctx, app.ID)
			if err != nil {
				fmt.Printf("Error fetching app name for app %v: %v\n", app.ID, err)
				continue
			}

			alert := Alert{
				ID:       alertID,
				TeamID:   team.ID,
				AppID:    app.ID,
				EntityID: fingerprint,
				Type:     string(AlertTypeAnrSpike),
			}

			scheduleEmailAlertsForteamMembers(ctx, alert, alertMsg, alertUrl, appName)
			scheduleSlackAlertsForTeamChannels(ctx, alert, alertMsg, alertUrl, appName)
		}
	}

	if anrGroupRows != nil {
		anrGroupRows.Close()
	}
}

// SendPendingAlertEmails checks the pending alert messages in the database and sends them as emails.
// It processes up to 250 messages at a time, sending each email with a 1 second delay and deleting
// the message from the database after a successful send. If an error occurs while sending an email,
// it logs the error but continues processing the next messages.
func SendPendingAlertEmails(ctx context.Context) error {
	fmt.Println("Checking pending alert emails...")
	stmt := sqlf.From("pending_alert_messages").
		Select("id, data").
		Where("channel = ?", "email").
		OrderBy("created_at ASC").
		Limit(250)
	rows, err := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return fmt.Errorf("failed to query pending alert messages: %w", err)
	}
	defer rows.Close()

	type pendingMsg struct {
		ID   string
		Data []byte
	}

	var msgs []pendingMsg
	for rows.Next() {
		var m pendingMsg
		if err := rows.Scan(&m.ID, &m.Data); err != nil {
			fmt.Printf("failed to scan row: %s\n", err)
			continue
		}
		msgs = append(msgs, m)
	}
	if rows.Err() != nil {
		return fmt.Errorf("row error: %w", rows.Err())
	}

	for _, msg := range msgs {
		fmt.Printf("Sending email for msg Id: %v\n", msg.ID)
		var info email.EmailInfo
		if err := json.Unmarshal(msg.Data, &info); err != nil {
			fmt.Printf("failed to unmarshal email data for id %s: %s\n", msg.ID, err)
			continue
		}
		if err := email.SendEmail(server.Server.Mail, info); err != nil {
			fmt.Printf("failed to send email for id %s: %s\n", msg.ID, err)
			continue
		}

		// Delete after successful send
		delStmt := sqlf.DeleteFrom("pending_alert_messages").Where("id = ?", msg.ID)
		if _, err := server.Server.PgPool.Exec(ctx, delStmt.String(), delStmt.Args()...); err != nil {
			fmt.Printf("failed to delete pending alert message id %s: %s\n", msg.ID, err)
		}
		time.Sleep(1 * time.Second)
	}

	return nil
}
