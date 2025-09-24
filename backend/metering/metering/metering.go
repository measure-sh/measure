package metering

import (
	"backend/metering/server"
	"context"
	"fmt"
	"log"
	"time"

	"github.com/leporo/sqlf"
)

type UsageMetrics struct {
	TeamID          string
	Sessions        uint64
	Events          uint64
	Spans           uint64
	Traces          uint64
	Attachments     uint64
	SessionsDays    uint64
	EventsDays      uint64
	SpansDays       uint64
	TracesDays      uint64
	AttachmentsDays uint64
}

func CalculateUsage(ctx context.Context) {
	fmt.Println("Calculating daily usage metrics...")

	// Get all teams from postgres
	teamsQuery := sqlf.From("teams").
		Select("id").
		Select("name")
	defer teamsQuery.Close()

	teamRows, err := server.Server.RpgPool.Query(ctx, teamsQuery.String())
	if err != nil {
		log.Printf("failed to query teams: %v", err)
		return
	}
	defer teamRows.Close()

	var teams []struct {
		ID   string
		Name string
	}
	for teamRows.Next() {
		var team struct {
			ID   string
			Name string
		}
		if err := teamRows.Scan(&team.ID, &team.Name); err != nil {
			log.Printf("failed to scan team: %v", err)
			return
		}
		teams = append(teams, team)
	}

	today := time.Now().UTC().Truncate(24 * time.Hour)

	// For each team, find unreported dates
	for _, team := range teams {
		// Get last reported date for this team (or start from today if never reported)
		lastReportedQuery := sqlf.From("metrics_reporting").
			Select("MAX(report_date)").
			Where("team_id = ?", team.ID)
		defer lastReportedQuery.Close()

		var lastReported *time.Time
		err := server.Server.RpgPool.QueryRow(ctx, lastReportedQuery.String(), lastReportedQuery.Args()...).Scan(&lastReported)
		if err != nil {
			log.Printf("failed to get last reported date for team %s (%s): %v", team.ID, team.Name, err)
			continue
		}

		var unreportedDates []time.Time
		if lastReported == nil {
			// Never reported before, just process today
			unreportedDates = []time.Time{today}
		} else {
			// Generate all dates from day after last reported to today
			for d := lastReported.AddDate(0, 0, 1); d.Before(today) || d.Equal(today); d = d.AddDate(0, 0, 1) {
				unreportedDates = append(unreportedDates, d)
			}
		}

		// Process each unreported date for this team
		for _, date := range unreportedDates {
			metrics, err := fetchClickhouseMetricsForTeam(ctx, team.ID, date)
			if err != nil {
				log.Printf("failed to fetch metrics for team %s (%s) on %s: %v", team.ID, team.Name, date, err)
				continue
			}

			if len(metrics) > 0 {
				m := metrics[0] // Should only be one result per team per date
				log.Printf("Daily usage metrics for date = %s and team = %s : sessions = %d events = %d spans = %d traces = %d attachments = %d session_days = %d event_days = %d span_days = %d trace_days = %d attachment_days = %d",
					date.Format("2006-01-02"),
					m.TeamID,
					m.Sessions, m.Events, m.Spans, m.Traces, m.Attachments,
					m.SessionsDays, m.EventsDays, m.SpansDays, m.TracesDays, m.AttachmentsDays,
				)
			} else {
				log.Printf("No metrics found for team %s (%s) on %s", team.ID, team.Name, date.Format("2006-01-02"))
			}

			// Mark as reported for this team and date
			insertMetricReportingStmt := sqlf.InsertInto("metrics_reporting").
				Set("team_id", team.ID).
				Set("report_date", date).
				Set("reported_at", time.Now()).
				Clause("ON CONFLICT (team_id, report_date) DO UPDATE SET reported_at = EXCLUDED.reported_at")
			defer insertMetricReportingStmt.Close()

			_, err = server.Server.PgPool.Exec(ctx, insertMetricReportingStmt.String(), insertMetricReportingStmt.Args()...)
			if err != nil {
				log.Printf("failed to mark reported for team %s (%s) on %s: %v", team.ID, team.Name, date, err)
				return
			}
		}
	}

	fmt.Println("Daily usage metrics processed.")
}

func fetchClickhouseMetricsForTeam(ctx context.Context, teamID string, day time.Time) ([]UsageMetrics, error) {
	start := day
	end := day.Add(24 * time.Hour)

	query := sqlf.
		Select("team_id").
		Select("coalesce(sumMerge(session_count), 0) as sessions").
		Select("coalesce(sumMerge(event_count), 0) as events").
		Select("coalesce(sumMerge(span_count), 0) as spans").
		Select("coalesce(sumMerge(trace_count), 0) as traces").
		Select("coalesce(sumMerge(attachment_count), 0) as attachments").
		Select("coalesce(sumMerge(session_count_days), 0) as sessions_days").
		Select("coalesce(sumMerge(event_count_days), 0) as events_days").
		Select("coalesce(sumMerge(span_count_days), 0) as spans_days").
		Select("coalesce(sumMerge(trace_count_days), 0) as traces_days").
		Select("coalesce(sumMerge(attachment_count_days), 0) as attachments_days").
		From("ingestion_metrics").
		Where("team_id = ?", teamID).
		Where("timestamp >= ?", start).
		Where("timestamp < ?", end).
		GroupBy("team_id")
	defer query.Close()

	rows, err := server.Server.RchPool.Query(ctx, query.String(), query.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []UsageMetrics
	for rows.Next() {
		var m UsageMetrics
		if err := rows.Scan(
			&m.TeamID,
			&m.Sessions,
			&m.Events,
			&m.Spans,
			&m.Traces,
			&m.Attachments,
			&m.SessionsDays,
			&m.EventsDays,
			&m.SpansDays,
			&m.TracesDays,
			&m.AttachmentsDays,
		); err != nil {
			return nil, err
		}
		results = append(results, m)
	}

	return results, nil
}
