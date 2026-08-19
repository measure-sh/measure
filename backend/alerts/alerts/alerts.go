package alerts

import (
	"cmp"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"slices"
	"strconv"
	"strings"
	"time"

	"backend/alerts/server"
	"backend/alerts/slack"
	"backend/libs/autumn"
	"backend/libs/config"
	"backend/libs/email"
	"backend/libs/numeric"
	libslack "backend/libs/slack"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

type Team struct {
	ID               uuid.UUID
	Name             string
	AutumnCustomerID *string
}

type App struct {
	ID     uuid.UUID
	TeamID uuid.UUID
	Name   string
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
	AppID uuid.UUID
	Date  time.Time

	SessionsToday     uint64
	SessionsYesterday uint64

	CrashSessionsToday     uint64
	CrashSessionsYesterday uint64

	ANRSessionsToday     uint64
	ANRSessionsYesterday uint64

	ColdLaunchTodayMs     float64
	ColdLaunchYesterdayMs float64

	WarmLaunchTodayMs     float64
	WarmLaunchYesterdayMs float64

	HotLaunchTodayMs     float64
	HotLaunchYesterdayMs float64
}

const errorSpikeTimePeriod = time.Hour
const errorAlertCooldownPeriod = 7 * 24 * time.Hour // 1 week
const bugReportTimePeriod = 15 * time.Minute
const defaultErrorGoodThreshold = 95.0
const defaultErrorCautionThreshold = 85.0
const defaultErrorSpikeMinCountThreshold = 100
const defaultErrorSpikeMinRateThreshold = 0.5 // percent

type AppThresholdPrefs struct {
	ErrorGoodThreshold          float64
	ErrorCautionThreshold       float64
	ErrorSpikeMinCountThreshold int
	ErrorSpikeMinRateThreshold  float64
}

func CreateCrashAndAnrAlerts(ctx context.Context) {
	fmt.Println("Checking for Crash and ANR alerts...")
	teams, err := getActiveTeams(ctx)
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
			from := time.Now().UTC().Add(-errorSpikeTimePeriod)
			to := time.Now().UTC()

			prefs, err := getAppThresholdPrefs(ctx, app.ID)
			if err != nil {
				fmt.Printf("Error fetching app threshold prefs for app %v, using defaults: %v\n", app.ID, err)
				prefs = AppThresholdPrefs{
					ErrorGoodThreshold:          defaultErrorGoodThreshold,
					ErrorCautionThreshold:       defaultErrorCautionThreshold,
					ErrorSpikeMinCountThreshold: defaultErrorSpikeMinCountThreshold,
					ErrorSpikeMinRateThreshold:  defaultErrorSpikeMinRateThreshold,
				}
			}

			var sessionCount uint64
			sessionCountStmt := sqlf.From("events final").
				Select("count(distinct session_id) as session_count").
				Where("team_id = toUUID(?)", app.TeamID).
				Where("app_id = toUUID(?)", app.ID).
				Where("timestamp >= ? and timestamp <= ?", from, to)

			defer sessionCountStmt.Close()

			sessionCountRows, err := server.Server.ChPool.Query(ctx, sessionCountStmt.String(), sessionCountStmt.Args()...)
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

			createCrashAlertsForApp(ctx, team, app, from, to, sessionCount, prefs)
			createAnrAlertsForApp(ctx, team, app, from, to, sessionCount, prefs)
		}
	}
}

func CreateBugReportAlerts(ctx context.Context) {
	fmt.Println("Checking for new Bug Report alerts...")
	teams, err := getActiveTeams(ctx)
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

			bugReportRows, err := server.Server.ChPool.Query(ctx, bugReportStmt.String(), bugReportStmt.Args()...)
			if err != nil {
				fmt.Printf("Error fetching bug reports for app %v: %v\n", app.ID, err)
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

				scheduleEmailAlertsForteamMembers(ctx, alert, alertMsg, alertUrl, app.Name)
				scheduleSlackAlertsForTeamChannels(ctx, alert, alertMsg, alertUrl, app.Name)
			}

			if bugReportRows != nil {
				bugReportRows.Close()
			}
		}
	}
}

func CreateDailySummary(ctx context.Context) {
	fmt.Println("Creating daily summary...")

	// Daily summary runs at 06:00 UTC and reports the previous UTC calendar day.
	date := time.Now().UTC().AddDate(0, 0, -1)

	teams, err := getActiveTeams(ctx)
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

		entries := []appSummaryWithSessions{}
		for _, app := range apps {
			metrics, sessionsToday, err := getDailySummaryMetrics(ctx, date, &app)
			if err != nil {
				fmt.Printf("Error fetching daily summary data for app %v: %v\n", app.ID, err)
				continue
			}

			entries = append(entries, appSummaryWithSessions{
				Summary:       email.AppDailySummary{AppName: app.Name, Metrics: metrics},
				SessionsToday: sessionsToday,
			})
		}

		// An app whose metrics query returns no rows is left out. Teams with all apps in this
		// state don't get email or slack message
		if len(entries) == 0 {
			continue
		}

		appSummaries := sortedAppSummaries(entries)

		subject, body := email.TeamDailySummaryEmail(team.Name, date, appSummaries, server.Server.Config.SiteOrigin, team.ID.String())
		scheduleDailySummaryEmailForTeamMembers(ctx, team.ID, subject, body)

		dashboardURL := fmt.Sprintf("%s/%s/overview", server.Server.Config.SiteOrigin, team.ID)
		scheduleDailySummarySlackMessageForTeamChannels(ctx, team.ID, team.Name, dashboardURL, date, appSummaries)
	}
}

type appSummaryWithSessions struct {
	Summary       email.AppDailySummary
	SessionsToday uint64
}

func sortedAppSummaries(entries []appSummaryWithSessions) []email.AppDailySummary {
	slices.SortStableFunc(entries, func(a, b appSummaryWithSessions) int {
		if a.SessionsToday != b.SessionsToday {
			return cmp.Compare(b.SessionsToday, a.SessionsToday)
		}
		return cmp.Compare(a.Summary.AppName, b.Summary.AppName)
	})

	summaries := make([]email.AppDailySummary, 0, len(entries))
	for _, entry := range entries {
		summaries = append(summaries, entry.Summary)
	}
	return summaries
}

func getActiveTeams(ctx context.Context) ([]Team, error) {
	teams := []Team{}
	stmt := sqlf.PostgreSQL.
		Select("id").
		Select("name").
		Select("autumn_customer_id").
		From("teams")

	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(ctx, stmt.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var t Team
		if err := rows.Scan(&t.ID, &t.Name, &t.AutumnCustomerID); err != nil {
			return nil, err
		}
		teams = append(teams, t)
	}

	if !server.Server.Config.IsBillingEnabled() {
		return teams, nil
	}

	// Drop teams Autumn has blocked from ingesting (bytes limit reached). The
	// cached check (autumn.CheckCached) avoids an Autumn call per team on every
	// run. Fail-open on any Autumn error so an outage doesn't drop alerts.
	filtered := make([]Team, 0, len(teams))
	for _, t := range teams {
		if t.AutumnCustomerID == nil || *t.AutumnCustomerID == "" {
			filtered = append(filtered, t)
			continue
		}
		allowed, err := autumn.CheckCached(ctx, server.Server.VK, *t.AutumnCustomerID, autumn.FeatureBytes)
		if err != nil {
			if autumn.IsServerOrNetworkError(err) {
				log.Printf("alerts: autumn unavailable, keeping team %s (customer=%s): %v", t.ID, *t.AutumnCustomerID, err)
			} else {
				log.Printf("ERROR alerts: autumn client error — check config (team=%s, customer=%s): %v", t.ID, *t.AutumnCustomerID, err)
			}
			filtered = append(filtered, t)
			continue
		}
		if allowed {
			filtered = append(filtered, t)
		}
	}
	return filtered, nil
}

func getAppsForTeam(ctx context.Context, teamID uuid.UUID) ([]App, error) {
	apps := []App{}
	stmt := sqlf.PostgreSQL.
		Select("id").
		Select("team_id").
		Select("app_name").
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
		if err := rows.Scan(&a.ID, &a.TeamID, &a.Name); err != nil {
			return nil, err
		}
		apps = append(apps, a)
	}
	return apps, nil
}

// formatUnit rounds a measured value to two decimal places, drops trailing
// zeros, and appends the unit, so a rate reads as 99.5% and a duration as
// 892.35ms.
func formatUnit(x float64, unit string) string {
	return strconv.FormatFloat(math.Round(x*100)/100, 'f', -1, 64) + unit
}

// freeRate returns the share of sessions that saw no crash (or no ANR) as a
// percentage. affected must not exceed total.
func freeRate(total, affected uint64) float64 {
	if total == 0 {
		return 0
	}
	return float64(total-affected) * 100.0 / float64(total)
}

// comparison renders the line printed under a metric value, specifying yesterday's
// figure. Callers pass both days already formatted, so a change too small to survive
// rounding reads as no change rather than pairing "Up from" with a number identical
// to the one on the card above it.
func comparison(todayText, yesterdayText string, up bool) string {
	if todayText == yesterdayText {
		return "No change from yesterday"
	}
	if up {
		return fmt.Sprintf("Up from %s yesterday", yesterdayText)
	}
	return fmt.Sprintf("Down from %s yesterday", yesterdayText)
}

// launchMetric builds one of the three launch cards. A day with no launch
// events of that kind leaves the merged quantile as NaN, which is an absent
// measurement, so the card says "No Data" and just writes yesterday's
// duration without "Up" or "Down"
func launchMetric(label string, todayMs, yesterdayMs float64) email.MetricData {
	hasYesterday := !math.IsNaN(yesterdayMs) && yesterdayMs != 0

	if math.IsNaN(todayMs) || todayMs == 0 {
		subtitle := "No previous day data"
		if hasYesterday {
			subtitle = fmt.Sprintf("Was %s yesterday", formatUnit(yesterdayMs, "ms"))
		}
		return email.MetricData{Value: "No Data", Label: label, Subtitle: subtitle}
	}

	value := formatUnit(todayMs, "ms")
	subtitle := "No previous day data"
	if hasYesterday {
		subtitle = comparison(value, formatUnit(yesterdayMs, "ms"), todayMs > yesterdayMs)
	}

	return email.MetricData{Value: value, Label: label, Subtitle: subtitle}
}

func getDailySummaryMetrics(ctx context.Context, date time.Time, app *App) (metrics []email.MetricData, sessionsToday uint64, err error) {
	appThresholdPrefs, err := getAppThresholdPrefs(ctx, app.ID)
	if err != nil {
		fmt.Printf("Error fetching app threshold prefs for app %v, using defaults: %v\n", app.ID, err)
		appThresholdPrefs = AppThresholdPrefs{
			ErrorGoodThreshold:    defaultErrorGoodThreshold,
			ErrorCautionThreshold: defaultErrorCautionThreshold,
		}
	}

	query := `
		WITH
            toDate(?) AS target_date,

            daily_metrics AS (
                SELECT
                    app_id,
                    toDate(timestamp) AS date,
                    uniqMerge(unique_sessions) AS total_sessions,
                    uniqMerge(crash_sessions) AS crash_sessions,
                    uniqMerge(anr_sessions) AS anr_sessions,
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

            cd.total_sessions,
            pd.total_sessions,

            cd.crash_sessions,
            pd.crash_sessions,

            cd.anr_sessions,
            pd.anr_sessions,

            cd.cold_launch_p95_ms,
            pd.cold_launch_p95_ms,

            cd.warm_launch_p95_ms,
            pd.warm_launch_p95_ms,

            cd.hot_launch_p95_ms,
            pd.hot_launch_p95_ms

        FROM current_day cd
        LEFT JOIN previous_day pd ON cd.app_id = pd.app_id
        ORDER BY cd.app_id
	`
	row := server.Server.ChPool.QueryRow(ctx, query, date, app.TeamID, app.ID)

	var summary DailySummaryRow
	err = row.Scan(
		&summary.AppID,
		&summary.Date,
		&summary.SessionsToday,
		&summary.SessionsYesterday,
		&summary.CrashSessionsToday,
		&summary.CrashSessionsYesterday,
		&summary.ANRSessionsToday,
		&summary.ANRSessionsYesterday,
		&summary.ColdLaunchTodayMs,
		&summary.ColdLaunchYesterdayMs,
		&summary.WarmLaunchTodayMs,
		&summary.WarmLaunchYesterdayMs,
		&summary.HotLaunchTodayMs,
		&summary.HotLaunchYesterdayMs,
	)

	if err != nil {
		return nil, 0, fmt.Errorf("failed to scan daily summary: %w", err)
	}

	// A previous day with no sessions at all is what a missing row from the
	// LEFT JOIN looks like, so the session-based cards have nothing to compare
	// against.
	hasYesterday := summary.SessionsYesterday > 0

	sessionsValue := numeric.FormatKMB(int64(summary.SessionsToday))
	sessionsSubtitle := "No previous day data"
	if hasYesterday {
		sessionsSubtitle = comparison(sessionsValue, numeric.FormatKMB(int64(summary.SessionsYesterday)), summary.SessionsToday > summary.SessionsYesterday)
	}

	crashFreeToday := freeRate(summary.SessionsToday, summary.CrashSessionsToday)
	crashFreeValue := formatUnit(crashFreeToday, "%")
	crashFreeSubtitle := "No previous day data"
	if hasYesterday {
		crashFreeYesterday := freeRate(summary.SessionsYesterday, summary.CrashSessionsYesterday)
		crashFreeSubtitle = comparison(crashFreeValue, formatUnit(crashFreeYesterday, "%"), crashFreeToday > crashFreeYesterday)
	}

	metrics = []email.MetricData{
		{
			Value:    sessionsValue,
			Label:    "Sessions",
			Subtitle: sessionsSubtitle,
		},
		{
			Value:      crashFreeValue,
			Label:      "Crash free sessions",
			Subtitle:   crashFreeSubtitle,
			HasWarning: summary.SessionsToday != 0 && crashFreeToday <= appThresholdPrefs.ErrorGoodThreshold,
			HasError:   summary.SessionsToday != 0 && crashFreeToday <= appThresholdPrefs.ErrorCautionThreshold,
		},
	}

	// ANR card is only shown if once an ANR has
	// been recorded on either day to prevent permanent ANR card with no data in iOS.
	if summary.ANRSessionsToday > 0 || summary.ANRSessionsYesterday > 0 {
		anrFreeToday := freeRate(summary.SessionsToday, summary.ANRSessionsToday)
		anrFreeValue := formatUnit(anrFreeToday, "%")
		anrFreeSubtitle := "No previous day data"
		if hasYesterday {
			anrFreeYesterday := freeRate(summary.SessionsYesterday, summary.ANRSessionsYesterday)
			anrFreeSubtitle = comparison(anrFreeValue, formatUnit(anrFreeYesterday, "%"), anrFreeToday > anrFreeYesterday)
		}

		metrics = append(metrics, email.MetricData{
			Value:      anrFreeValue,
			Label:      "ANR free sessions",
			Subtitle:   anrFreeSubtitle,
			HasWarning: summary.SessionsToday != 0 && anrFreeToday <= appThresholdPrefs.ErrorGoodThreshold,
			HasError:   summary.SessionsToday != 0 && anrFreeToday <= appThresholdPrefs.ErrorCautionThreshold,
		})
	}

	metrics = append(metrics,
		launchMetric("Cold launch p95", summary.ColdLaunchTodayMs, summary.ColdLaunchYesterdayMs),
		launchMetric("Warm launch p95", summary.WarmLaunchTodayMs, summary.WarmLaunchYesterdayMs),
		launchMetric("Hot launch p95", summary.HotLaunchTodayMs, summary.HotLaunchYesterdayMs),
	)

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
		return nil, 0, fmt.Errorf("failed to scan bug report count: %w", err)
	}
	if todayBugReportCount > 0 {
		bugValue := numeric.FormatKMB(int64(todayBugReportCount))
		bugSubtitle := "No previous day data"
		if yesterdayBugReportCount > 0 {
			bugSubtitle = comparison(bugValue, numeric.FormatKMB(int64(yesterdayBugReportCount)), todayBugReportCount > yesterdayBugReportCount)
		}
		metrics = append(metrics, email.MetricData{
			Value:    bugValue,
			Label:    "Bug reports",
			Subtitle: bugSubtitle,
		})
	}

	return metrics, summary.SessionsToday, nil
}

func getAppThresholdPrefs(ctx context.Context, appID uuid.UUID) (AppThresholdPrefs, error) {
	stmt := sqlf.PostgreSQL.
		From("measure.app_threshold_prefs").
		Select("error_good_threshold").
		Select("error_caution_threshold").
		Select("error_spike_min_count_threshold").
		Select("error_spike_min_rate_threshold").
		Where("app_id = ?", appID)
	defer stmt.Close()

	var prefs AppThresholdPrefs
	err := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&prefs.ErrorGoodThreshold, &prefs.ErrorCautionThreshold, &prefs.ErrorSpikeMinCountThreshold, &prefs.ErrorSpikeMinRateThreshold)
	if err != nil {
		if err == pgx.ErrNoRows {
			return AppThresholdPrefs{
				ErrorGoodThreshold:          defaultErrorGoodThreshold,
				ErrorCautionThreshold:       defaultErrorCautionThreshold,
				ErrorSpikeMinCountThreshold: defaultErrorSpikeMinCountThreshold,
				ErrorSpikeMinRateThreshold:  defaultErrorSpikeMinRateThreshold,
			}, nil
		}
		return AppThresholdPrefs{}, err
	}

	return prefs, nil
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
		AlertType:   alert.Type,
	}
	if err := email.QueueEmailForTeam(ctx, server.Server.PgPool, nil, alert.TeamID, alert.AppID, pendingEmail); err != nil {
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

func scheduleDailySummaryEmailForTeamMembers(ctx context.Context, teamId uuid.UUID, subject, body string) {
	pendingEmail := email.EmailInfo{
		From:        server.Server.Config.TxEmailAddress,
		Subject:     subject,
		ContentType: "text/html",
		Body:        body,
		AlertType:   "daily_summary",
	}
	if err := email.QueueEmailForTeam(ctx, server.Server.PgPool, nil, teamId, nil, pendingEmail); err != nil {
		fmt.Printf("Error queueing daily summary emails for team %v: %v\n", teamId, err)
	}
}

func scheduleDailySummarySlackMessageForTeamChannels(ctx context.Context, teamId uuid.UUID, teamName, dashboardURL string, date time.Time, apps []email.AppDailySummary) {
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

	slackMessage := formatTeamDailySummarySlackMessage(teamName, dashboardURL, date, apps)

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
			Set("app_id", nil).
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
				Text: truncateSlackHeader(fmt.Sprintf("🚨 %s", title)),
			},
		},
	}

	// The message is shared with the email path and arrives formatted for
	// HTML, with <br> marking line breaks and app-generated text (a crash
	// message like "<init>", a user-typed bug report description) left as is.
	// Rewrite the breaks as newlines, then escape the characters Slack parses
	// as markup so the text renders literally.
	message = strings.ReplaceAll(message, "<br>", "\n")
	message = libslack.EscapeMrkdwn(message)

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

// slackHeaderTextLimit is the maximum number of characters Slack accepts in
// a header block's text.
const slackHeaderTextLimit = 150

func truncateSlackHeader(text string) string {
	runes := []rune(text)
	if len(runes) <= slackHeaderTextLimit {
		return text
	}
	return string(runes[:slackHeaderTextLimit-1]) + "…"
}

// slackBlockLimit is the maximum number of blocks Slack accepts in a single
// chat.postMessage call; longer messages are rejected outright.
const slackBlockLimit = 50

// slackBlocksPerApp is the number of blocks each app adds to the team daily
// summary message: a section naming the app, a section with its metric lines,
// and a trailing divider.
const slackBlocksPerApp = 3

// formatTeamDailySummarySlackMessage builds one Slack message summarizing the
// day's metrics for every app in apps, in the given order. When the apps do
// not all fit under Slack's block limit, the trailing apps are dropped and a
// context line reports how many were left out.
func formatTeamDailySummarySlackMessage(teamName, dashboardURL string, date time.Time, apps []email.AppDailySummary) slack.SlackMessage {
	formattedDate := date.Format("January 2, 2006")

	// The header, date section, and leading divider open the message and the
	// actions block closes it, so four blocks are always present. When apps
	// are dropped, the context line reporting the omission takes a fifth,
	// leaving less room for app blocks.
	shownApps := len(apps)
	if shownApps > (slackBlockLimit-4)/slackBlocksPerApp {
		shownApps = (slackBlockLimit - 5) / slackBlocksPerApp
	}
	omitted := len(apps) - shownApps

	blocks := []slack.SlackBlock{
		slack.SlackHeaderBlock{
			Type: "header",
			Text: &slack.SlackText{
				Type: "plain_text",
				Text: truncateSlackHeader(fmt.Sprintf("%s — Daily Summary", teamName)),
			},
		},

		slack.SlackSectionBlock{
			Type: "section",
			Text: &slack.SlackText{
				Type: "mrkdwn",
				Text: fmt.Sprintf("*%s*  _(last 24 hours)_", formattedDate),
			},
		},

		slack.SlackDividerBlock{Type: "divider"},
	}

	for _, app := range apps[:shownApps] {
		lines := make([]string, 0, len(app.Metrics))
		for _, metric := range app.Metrics {
			line := fmt.Sprintf("• *%s*  %s · _%s_", metric.Label, metric.Value, metric.Subtitle)
			if metric.HasError {
				line += " `poor`"
			} else if metric.HasWarning {
				line += " `caution`"
			}
			lines = append(lines, line)
		}

		blocks = append(blocks,
			slack.SlackSectionBlock{
				Type: "section",
				Text: &slack.SlackText{
					Type: "mrkdwn",
					Text: fmt.Sprintf("*%s*", libslack.EscapeMrkdwn(app.AppName)),
				},
			},
			slack.SlackSectionBlock{
				Type: "section",
				Text: &slack.SlackText{
					Type: "mrkdwn",
					Text: strings.Join(lines, "\n"),
				},
			},
			slack.SlackDividerBlock{Type: "divider"},
		)
	}

	if omitted > 0 {
		noun := "apps"
		if omitted == 1 {
			noun = "app"
		}
		blocks = append(blocks, slack.SlackContextBlock{
			Type: "context",
			Elements: []slack.SlackText{
				{Type: "mrkdwn", Text: fmt.Sprintf("+%d more %s not shown", omitted, noun)},
			},
		})
	}

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

func createCrashAlertsForApp(ctx context.Context, team Team, app App, from, to time.Time, sessionCount uint64, prefs AppThresholdPrefs) {
	crashGroupStmt := sqlf.
		From("events final").
		Select("`exception.fingerprint`, count() as crash_count").
		Where("team_id = toUUID(?)", team.ID).
		Where("app_id = toUUID(?)", app.ID).
		Where("type = 'exception'").
		Where(config.FatalExceptionExpr).
		Where("timestamp >= ? and timestamp <= ?", from, to).
		GroupBy("`exception.fingerprint`")

	defer crashGroupStmt.Close()

	crashGroupRows, err := server.Server.ChPool.Query(ctx, crashGroupStmt.String(), crashGroupStmt.Args()...)
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

		inCooldown, err := isInCooldown(ctx, team.ID, app.ID, fingerprint, string(AlertTypeCrashSpike), errorAlertCooldownPeriod)
		if err != nil {
			fmt.Printf("Error checking cooldown for crash group %s: %v\n", fingerprint, err)
			continue
		}

		if inCooldown {
			continue
		}

		if crashGroupCount < uint64(prefs.ErrorSpikeMinCountThreshold) {
			continue
		}

		var crashGroupRate float64 = 0
		if sessionCount > 0 {
			crashGroupRate = float64(crashGroupCount) / float64(sessionCount) * 100
		}

		if crashGroupRate >= prefs.ErrorSpikeMinRateThreshold {
			var crashType, fileName, methodName, message string
			groupInfoStmt := sqlf.
				From("fatal_exception_groups final").
				Select("argMax(type, timestamp)").
				Select("argMax(file_name, timestamp)").
				Select("argMax(method_name, timestamp)").
				Select("argMax(message, timestamp)").
				Where("team_id = toUUID(?)", team.ID).
				Where("app_id = toUUID(?)", app.ID).
				Where("id = ?", fingerprint)

			defer groupInfoStmt.Close()

			groupInfoRow := server.Server.ChPool.QueryRow(ctx, groupInfoStmt.String(), groupInfoStmt.Args()...)
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

			alert := Alert{
				ID:       alertID,
				TeamID:   team.ID,
				AppID:    app.ID,
				EntityID: fingerprint,
				Type:     string(AlertTypeCrashSpike),
			}

			scheduleEmailAlertsForteamMembers(ctx, alert, alertMsg, alertUrl, app.Name)
			scheduleSlackAlertsForTeamChannels(ctx, alert, alertMsg, alertUrl, app.Name)
		}
	}

	if crashGroupRows != nil {
		crashGroupRows.Close()
	}
}

func createAnrAlertsForApp(ctx context.Context, team Team, app App, from, to time.Time, sessionCount uint64, prefs AppThresholdPrefs) {
	anrGroupStmt := sqlf.From("events final").
		Select("`anr.fingerprint`, count() as anr_count").
		Where("team_id = toUUID(?)", team.ID).
		Where("app_id = toUUID(?)", app.ID).
		Where("type = 'anr'").
		Where("timestamp >= ? and timestamp <= ?", from, to).
		GroupBy("`anr.fingerprint`")

	defer anrGroupStmt.Close()

	anrGroupRows, err := server.Server.ChPool.Query(ctx, anrGroupStmt.String(), anrGroupStmt.Args()...)
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

		inCooldown, err := isInCooldown(ctx, team.ID, app.ID, fingerprint, string(AlertTypeAnrSpike), errorAlertCooldownPeriod)
		if err != nil {
			fmt.Printf("Error checking cooldown for anr group %s: %v\n", fingerprint, err)
			continue
		}

		if inCooldown {
			continue
		}

		if anrGroupCount < uint64(prefs.ErrorSpikeMinCountThreshold) {
			continue
		}

		var anrGroupRate float64 = 0
		if sessionCount > 0 {
			anrGroupRate = float64(anrGroupCount) / float64(sessionCount) * 100
		}

		if anrGroupRate >= prefs.ErrorSpikeMinRateThreshold {
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

			groupInfoRow := server.Server.ChPool.QueryRow(ctx, groupInfoStmt.String(), groupInfoStmt.Args()...)
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

			alert := Alert{
				ID:       alertID,
				TeamID:   team.ID,
				AppID:    app.ID,
				EntityID: fingerprint,
				Type:     string(AlertTypeAnrSpike),
			}

			scheduleEmailAlertsForteamMembers(ctx, alert, alertMsg, alertUrl, app.Name)
			scheduleSlackAlertsForTeamChannels(ctx, alert, alertMsg, alertUrl, app.Name)
		}
	}

	if anrGroupRows != nil {
		anrGroupRows.Close()
	}
}

// getNotifPrefByEmail looks up a user's notification preferences by email.
// Returns all-true defaults if user or prefs not found.
func getNotifPrefByEmail(ctx context.Context, userEmail string) (errorSpike, appHangSpike, bugReport, dailySummary bool) {
	stmt := sqlf.PostgreSQL.
		Select("np.error_spike").
		Select("np.app_hang_spike").
		Select("np.bug_report").
		Select("np.daily_summary").
		From("notif_prefs np").
		Join("users u", "np.user_id = u.id").
		Where("u.email = ?", userEmail)
	defer stmt.Close()

	err := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).
		Scan(&errorSpike, &appHangSpike, &bugReport, &dailySummary)
	if err != nil {
		fmt.Printf("No notif prefs found for email %s, defaulting to all-true: %v\n", userEmail, err)
		return true, true, true, true
	}
	return
}

// shouldSendEmail checks user's notif prefs against the email's alert type
// to determine whether the email should be sent. Returns false if the user
// has opted out of that notification type.
func shouldSendEmail(ctx context.Context, info email.EmailInfo) bool {
	if info.AlertType == "" {
		// Not a notification email (e.g. usage limit) — send by default
		return true
	}

	errorSpike, appHangSpike, bugReport, dailySummary := getNotifPrefByEmail(ctx, info.To)

	switch info.AlertType {
	case string(AlertTypeCrashSpike):
		return errorSpike
	case string(AlertTypeAnrSpike):
		return appHangSpike
	case string(AlertTypeBugReport):
		return bugReport
	case "daily_summary":
		return dailySummary
	default:
		return true
	}
}

// deletePendingMessage removes a pending alert message by ID.
func deletePendingMessage(ctx context.Context, msgID string) {
	delStmt := sqlf.DeleteFrom("pending_alert_messages").Where("id = ?", msgID)
	if _, err := server.Server.PgPool.Exec(ctx, delStmt.String(), delStmt.Args()...); err != nil {
		fmt.Printf("failed to delete pending alert message id %s: %s\n", msgID, err)
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

		// Check user's notification preferences before sending
		if !shouldSendEmail(ctx, info) {
			fmt.Printf("Skipping email id %s to %s: user has opted out\n", msg.ID, info.To)
			deletePendingMessage(ctx, msg.ID)
			continue
		}

		if err := email.SendEmail(server.Server.Mail, info); err != nil {
			fmt.Printf("failed to send email for id %s: %s\n", msg.ID, err)
			continue
		}

		// Delete after successful send
		deletePendingMessage(ctx, msg.ID)
		time.Sleep(1 * time.Second)
	}

	return nil
}
