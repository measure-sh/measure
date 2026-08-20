package measure

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"backend/libs/chquery"
	"backend/libs/config"
	"backend/libs/event"
	"backend/libs/group"
	"backend/libs/logcomment"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

const (
	sessionsLimit      uint8 = 50
	minEventsInSession uint8 = 2
	minConfidencePct   uint8 = 30
)

func formatExceptionMessage(exType, message, fileName, methodName string) string {
	// Try type and message first
	if exType != "" && message != "" {
		return fmt.Sprintf("%s - %s", exType, message)
	}
	if exType != "" {
		return exType
	}
	if message != "" {
		return message
	}

	// Fallback to file and method
	if fileName != "" && methodName != "" {
		return fmt.Sprintf("%s:%s()", fileName, methodName)
	}
	if fileName != "" {
		return fileName
	}
	if methodName != "" {
		return fmt.Sprintf("%s()", methodName)
	}

	return "Unknown error"
}

func cleanNullBytes(s string) string {
	s = strings.TrimRight(s, "\x00")
	s = strings.ReplaceAll(s, "\u0000", "")
	return s
}

// GetIssueGroupCommonPath computes the most common user navigation path leading
// to a specific crash or ANR group. It validates the group exists, queries
// ClickHouse for session data, and returns JSON with sessions_analyzed and steps.
func GetIssueGroupCommonPath(ctx context.Context, rch driver.Conn, teamID, appID uuid.UUID, groupType group.GroupType, fingerprint string) (json.RawMessage, error) {
	app := App{
		ID:     &appID,
		TeamId: teamID,
	}
	ctx = chquery.WithTeamScope(ctx, app.TeamId)

	var err error

	// Validate the group exists. Skip for the unified error type since
	// the fingerprint may live in any of fatal/nonfatal/anr tables and
	// IssueGroupExists isn't a clean fit; a bogus fingerprint will
	// surface as zero sessions analyzed.
	if groupType != group.GroupTypeError {
		var exists bool
		exists, err = app.IssueGroupExists(ctx, rch, groupType, fingerprint)
		{
			msg := fmt.Sprintf("no %s group found with id %q", groupType, fingerprint)
			if !exists || errors.Is(err, sql.ErrNoRows) {
				return nil, fmt.Errorf("%s", msg)
			}
		}
		if err != nil {
			return nil, fmt.Errorf("failed to get %s group with id %q: %v", groupType, fingerprint, err)
		}
	}

	// Build the WHERE clause condition based on type
	var fingerprintCondition string
	var lcRootValue string
	switch groupType {
	case group.GroupTypeCrash:
		fingerprintCondition = "exception.fingerprint = fp"
		lcRootValue = logcomment.Crashes
	case group.GroupTypeANR:
		fingerprintCondition = "anr.fingerprint = fp"
		lcRootValue = logcomment.ANRs
	case group.GroupTypeError:
		fingerprintCondition = "(exception.fingerprint = fp OR anr.fingerprint = fp)"
		lcRootValue = logcomment.Errors
	}

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment":     lc.MustPut(logcomment.Root, lcRootValue),
		"use_query_cache": true,
		"query_cache_ttl": int(config.DefaultQueryCacheTTL.Seconds()),
	}

	ctx = chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "session_count"))

	// The events table ORDER BY key is:
	//
	//   (team_id, app_id, app_version, app_build, timestamp, session_id, id)
	//       1        2         3           4          5           6       7
	//
	// A scan can skip data only when the WHERE clause fills this key from
	// the left. This query knows positions 1 and 2. It also knows session
	// ids, but session_id is at position 6, behind columns it does not
	// know, so session ids alone cannot narrow a scan. sessions_index
	// maps a session id to its app versions and its time range. The
	// bounds scalar fills positions 3, 4 and 5 with those values. The
	// table is partitioned by month of timestamp, so the time range also
	// skips whole partitions. The bounds range still contains every event
	// of the matched sessions, so the result does not change.
	//
	// The bloom filter indexes on the fingerprint columns prune the
	// issue_pairs scan. ClickHouse computes a scalar once, so one bounds
	// tuple is cheaper than separate subqueries. affected_sessions uses a
	// join, not "session_id IN (...)", because an IN set in the key
	// condition splits the key ranges and disables the skip indexes.
	countStmt := sqlf.New(`
    WITH
      ? AS fp,
    issue_pairs AS (
      SELECT session_id, timestamp
      FROM `+config.EventsTable+`
      WHERE
        team_id = toUUID(?)
        AND app_id = toUUID(?)
        AND `+fingerprintCondition+`
      GROUP BY session_id, timestamp
    ),
    si AS (
      SELECT
        app_version,
        first_event_timestamp,
        last_event_timestamp
      FROM sessions_index
      WHERE
        team_id = toUUID(?)
        AND app_id = toUUID(?)
        AND session_id IN (SELECT session_id FROM issue_pairs)
    ),
    (
      SELECT (
        min(first_event_timestamp),
        max(last_event_timestamp),
        groupUniqArray((app_version.1, app_version.2))
      )
      FROM si
    ) AS bounds,
    eligible AS (
      SELECT session_id
      FROM `+config.EventsTable+`
      WHERE
        team_id = toUUID(?)
        AND app_id = toUUID(?)
        AND timestamp >= bounds.1
        AND timestamp <= bounds.2
        AND (attribute.app_version, attribute.app_build) IN bounds.3
      GROUP BY session_id
      HAVING count(*) >= ?
    ),
    affected_sessions AS (
      SELECT
        ip.session_id,
        ip.timestamp
      FROM issue_pairs ip
      INNER JOIN eligible el ON ip.session_id = el.session_id
      ORDER BY ip.timestamp DESC
      LIMIT ?
    )
    SELECT count(*) AS session_count
    FROM affected_sessions
`,
		fingerprint,
		app.TeamId,
		*app.ID,
		app.TeamId,
		*app.ID,
		app.TeamId,
		*app.ID,
		minEventsInSession,
		sessionsLimit,
	)

	defer countStmt.Close()

	var sessionsAnalyzed uint64
	if err = rch.QueryRow(ctx, countStmt.String(), countStmt.Args()...).Scan(&sessionsAnalyzed); err != nil {
		return nil, fmt.Errorf("failed to get session count: %v", err)
	}

	// This query fills the ORDER BY key the same way as countStmt: the
	// bounds scalar from sessions_index narrows the session_counts and
	// recent_events scans without a change to the result. total_cnt
	// counts the distinct sessions in recent_events. Each session has its
	// fingerprint event at position one, so total_cnt equals the number
	// of sessions in analyzed_sessions and serves as the confidence
	// divisor.
	stmt := sqlf.New(`
		WITH
          ? AS fp,
        issue_sessions AS (
          SELECT
            session_id,
            max(timestamp) AS issue_timestamp
          FROM `+config.EventsTable+`
          WHERE
            team_id = toUUID(?)
            AND app_id = toUUID(?)
            AND `+fingerprintCondition+`
          GROUP BY session_id
        ),
        si AS (
          SELECT
            app_version,
            first_event_timestamp,
            last_event_timestamp
          FROM sessions_index
          WHERE
            team_id = toUUID(?)
            AND app_id = toUUID(?)
            AND session_id IN (SELECT session_id FROM issue_sessions)
        ),
        (
          SELECT (
            min(first_event_timestamp),
            max(last_event_timestamp),
            groupUniqArray((app_version.1, app_version.2))
          )
          FROM si
        ) AS bounds,
        session_counts AS (
          SELECT
            session_id,
            count(*) AS event_count
          FROM `+config.EventsTable+`
          WHERE
            team_id = toUUID(?)
            AND app_id = toUUID(?)
            AND timestamp >= bounds.1
            AND timestamp <= bounds.2
            AND (attribute.app_version, attribute.app_build) IN bounds.3
          GROUP BY session_id
        ),
        analyzed_sessions AS (
          SELECT
            iss.session_id,
            iss.issue_timestamp
          FROM issue_sessions iss
          INNER JOIN session_counts sc ON iss.session_id = sc.session_id
          WHERE sc.event_count >= ?
          ORDER BY iss.issue_timestamp DESC
          LIMIT ?
        ),
        recent_events AS (
          SELECT
            session_id,
            type,
            description,
            thread_name,
            exception_data,
            exception_handled,
            exception_severity,
            anr_data,
            anr_subject,
            position_from_end,
            uniqExact(session_id) OVER () AS total_cnt
          FROM (
            SELECT
              e.session_id,
              e.type,
              e.timestamp,
              e.attribute.thread_name AS thread_name,
              if(e.type = 'exception', e.exception.exceptions, '') AS exception_data,
              if(e.type = 'exception', e.exception.handled, false) AS exception_handled,
              if(e.type = 'exception', e.exception.severity, '') AS exception_severity,
              if(e.type = 'anr', e.anr.exceptions, '') AS anr_data,
              if(e.type = 'anr', e.anr.subject, '') AS anr_subject,
              multiIf(
                (e.type = 'exception') OR (e.type = 'anr'), e.type,
                e.type = 'app_exit', concat('App exited: ', coalesce(e.app_exit.reason, 'unknown reason')),
                e.type = 'gesture_click', concat('User tapped on ', coalesce(nullIf(e.gesture_click.target_id, ''), nullIf(e.gesture_click.target, ''), 'unknown view'), if((e.gesture_click.target_id != '') AND (e.gesture_click.target != ''), concat(' (', e.gesture_click.target, ')'), '')),
                e.type = 'gesture_long_click', concat('User long-pressed on ', coalesce(nullIf(e.gesture_long_click.target_id, ''), nullIf(e.gesture_long_click.target, ''), 'unknown view'), if((e.gesture_long_click.target_id != '') AND (e.gesture_long_click.target != ''), concat(' (', e.gesture_long_click.target, ')'), '')),
                e.type = 'gesture_scroll', concat('User scrolled in ', coalesce(nullIf(e.gesture_scroll.target_id, ''), nullIf(e.gesture_scroll.target, ''), 'unknown view'), if((e.gesture_scroll.target_id != '') AND (e.gesture_scroll.target != ''), concat(' (', e.gesture_scroll.target, ')'), '')),
                e.type = 'navigation', concat('Navigated to screen: ', coalesce(e.navigation.to, 'unknown')),
                e.type = 'screen_view', concat('Viewed screen: ', coalesce(e.screen_view.name, 'unknown')),
                (e.type = 'lifecycle_activity') AND (e.lifecycle_activity.type = 'created'), concat('Activity created: ', coalesce(e.lifecycle_activity.class_name, 'unknown')),
                (e.type = 'lifecycle_activity') AND (e.lifecycle_activity.type = 'resumed'), concat('Activity resumed: ', coalesce(e.lifecycle_activity.class_name, 'unknown')),
                (e.type = 'lifecycle_activity') AND (e.lifecycle_activity.type = 'paused'), concat('Activity paused: ', coalesce(e.lifecycle_activity.class_name, 'unknown')),
                (e.type = 'lifecycle_activity') AND (e.lifecycle_activity.type = 'destroyed'), concat('Activity destroyed: ', coalesce(e.lifecycle_activity.class_name, 'unknown')),
                e.type = 'lifecycle_activity', concat('Activity ', coalesce(e.lifecycle_activity.type, 'unknown'), ': ', coalesce(e.lifecycle_activity.class_name, 'unknown')),
                (e.type = 'lifecycle_fragment') AND (e.lifecycle_fragment.type = 'attached'), concat('Fragment attached: ', coalesce(e.lifecycle_fragment.class_name, 'unknown')),
                (e.type = 'lifecycle_fragment') AND (e.lifecycle_fragment.type = 'resumed'), concat('Fragment resumed: ', coalesce(e.lifecycle_fragment.class_name, 'unknown')),
                (e.type = 'lifecycle_fragment') AND (e.lifecycle_fragment.type = 'paused'), concat('Fragment paused: ', coalesce(e.lifecycle_fragment.class_name, 'unknown')),
                (e.type = 'lifecycle_fragment') AND (e.lifecycle_fragment.type = 'detached'), concat('Fragment detached: ', coalesce(e.lifecycle_fragment.class_name, 'unknown')),
                e.type = 'lifecycle_fragment', concat('Fragment ', coalesce(e.lifecycle_fragment.type, 'unknown'), ': ', coalesce(e.lifecycle_fragment.class_name, 'unknown')),
                (e.type = 'lifecycle_view_controller') AND (e.lifecycle_view_controller.type = 'viewDidLoad'), concat('View controller loaded: ', coalesce(e.lifecycle_view_controller.class_name, 'unknown')),
                (e.type = 'lifecycle_view_controller') AND (e.lifecycle_view_controller.type = 'viewWillAppear'), concat('View controller will appear: ', coalesce(e.lifecycle_view_controller.class_name, 'unknown')),
                (e.type = 'lifecycle_view_controller') AND (e.lifecycle_view_controller.type = 'viewDidAppear'), concat('View controller appeared: ', coalesce(e.lifecycle_view_controller.class_name, 'unknown')),
                (e.type = 'lifecycle_view_controller') AND (e.lifecycle_view_controller.type = 'viewWillDisappear'), concat('View controller will disappear: ', coalesce(e.lifecycle_view_controller.class_name, 'unknown')),
                (e.type = 'lifecycle_view_controller') AND (e.lifecycle_view_controller.type = 'viewDidDisappear'), concat('View controller disappeared: ', coalesce(e.lifecycle_view_controller.class_name, 'unknown')),
                (e.type = 'lifecycle_view_controller') AND (e.lifecycle_view_controller.type = 'didReceiveMemoryWarning'), concat('View controller received memory warning: ', coalesce(e.lifecycle_view_controller.class_name, 'unknown')),
                (e.type = 'lifecycle_view_controller') AND (e.lifecycle_view_controller.type = 'vcDeinit'), concat('View controller deallocated: ', coalesce(e.lifecycle_view_controller.class_name, 'unknown')),
                e.type = 'lifecycle_view_controller', concat('View controller ', coalesce(e.lifecycle_view_controller.type, 'unknown'), ': ', coalesce(e.lifecycle_view_controller.class_name, 'unknown')),
                (e.type = 'lifecycle_swift_ui') AND (e.lifecycle_swift_ui.type = 'on_appear'), concat('SwiftUI view appeared: ', coalesce(e.lifecycle_swift_ui.class_name, 'unknown')),
                (e.type = 'lifecycle_swift_ui') AND (e.lifecycle_swift_ui.type = 'on_disappear'), concat('SwiftUI view disappeared: ', coalesce(e.lifecycle_swift_ui.class_name, 'unknown')),
                e.type = 'lifecycle_swift_ui', concat('SwiftUI view ', coalesce(e.lifecycle_swift_ui.type, 'unknown'), ': ', coalesce(e.lifecycle_swift_ui.class_name, 'unknown')),
                (e.type = 'lifecycle_app') AND (e.lifecycle_app.type = 'foreground'), 'App moved to foreground',
                (e.type = 'lifecycle_app') AND (e.lifecycle_app.type = 'background'), 'App moved to background',
                e.type = 'lifecycle_app', concat('App lifecycle: ', coalesce(e.lifecycle_app.type, 'unknown')),
                e.type = 'cold_launch', concat('App cold launched (activity: ', coalesce(e.cold_launch.launched_activity, 'unknown'), ')'),
                e.type = 'warm_launch', concat('App warm launched (activity: ', coalesce(e.warm_launch.launched_activity, 'unknown'), ')'),
                e.type = 'hot_launch', concat('App hot launched (activity: ', coalesce(e.hot_launch.launched_activity, 'unknown'), ')'),
                e.type = 'network_change', concat('Network changed from ', coalesce(e.network_change.previous_network_type, 'unknown'), if(e.network_change.previous_network_generation != '', concat(' (', e.network_change.previous_network_generation, ')'), ''), ' to ', coalesce(e.network_change.network_type, 'unknown'), if(e.network_change.network_generation != '', concat(' (', e.network_change.network_generation, ')'), '')),
                e.type = 'http', concat('HTTP ', coalesce(e.http.method, 'REQUEST'), ' to ', coalesce(e.http.url, 'unknown URL'), if(e.http.status_code > 0, concat(' (status: ', toString(e.http.status_code), ')'), '')),
                e.type = 'memory_usage_absolute', 'Memory usage recorded',
                e.type = 'low_memory', 'Low memory warning received from system',
                e.type = 'trim_memory', concat('System requested memory trim (level: ', coalesce(e.trim_memory.level, 'unknown'), ')'),
                e.type = 'custom', concat('Custom event: ', coalesce(e.custom.name, 'unknown')),
                e.type = 'string', concat('Log [', coalesce(e.string.severity_text, 'INFO'), ']: ', substring(coalesce(e.string.string, ''), 1, 80)),
                e.type = 'log', concat('Log [', coalesce(e.log.severity_text, 'INFO'), ']: ', substring(coalesce(e.log.body, ''), 1, 80)),
                e.type = 'session_start', 'Session started',
                e.type = 'bug_report', 'User submitted bug report',
                concat('Event: ', e.type)
            ) AS description,
                row_number() OVER (PARTITION BY e.session_id ORDER BY e.timestamp DESC) AS position_from_end
            FROM `+config.EventsTable+` AS e
            INNER JOIN analyzed_sessions AS a ON e.session_id = a.session_id
            WHERE
              e.team_id = toUUID(?)
              AND e.app_id = toUUID(?)
              AND e.timestamp >= bounds.1
              AND e.timestamp <= bounds.2
              AND (e.attribute.app_version, e.attribute.app_build) IN bounds.3
              AND e.timestamp <= a.issue_timestamp
              AND e.type NOT IN ('cpu_usage', 'memory_usage')
          )
          WHERE position_from_end <= ?
        ),
        common_events_by_position AS (
          SELECT
            position_from_end,
            type,
            description,
            countDistinct(session_id) AS session_count,
            round((countDistinct(session_id) * 100.) / any(total_cnt), 1) AS confidence_pct,
            any(thread_name) AS thread_name,
            any(exception_data) AS exception_data,
            any(exception_handled) AS exception_handled,
            any(exception_severity) AS exception_severity,
            any(anr_data) AS anr_data,
            any(anr_subject) AS anr_subject
          FROM recent_events
          GROUP BY
            position_from_end,
            type,
            description
        ),
        best_event_per_position AS (
          SELECT
            position_from_end,
            type,
            description,
            thread_name,
            confidence_pct,
            exception_data,
            exception_handled,
            exception_severity,
            anr_data,
            anr_subject
          FROM (
            SELECT
              *,
              row_number() OVER (PARTITION BY position_from_end ORDER BY confidence_pct DESC) AS rn
            FROM common_events_by_position
            WHERE confidence_pct >= ?
          )
          WHERE rn = 1
        )
      SELECT
        type,
        description,
        thread_name,
        confidence_pct,
        exception_data,
        exception_handled,
        exception_severity,
        anr_data,
        anr_subject
      FROM best_event_per_position
      ORDER BY position_from_end DESC
      `,
		fingerprint,
		app.TeamId,
		*app.ID,
		app.TeamId,
		*app.ID,
		app.TeamId,
		*app.ID,
		minEventsInSession,
		sessionsLimit,
		app.TeamId,
		*app.ID,
		sessionsLimit,
		minConfidencePct,
	)

	defer stmt.Close()

	ctx = chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, "common_path"))

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, fmt.Errorf("failed to execute reproduction steps query: %v", err)
	}

	defer rows.Close()

	type ReproStep struct {
		Description   string  `json:"description"`
		ThreadName    string  `json:"thread_name"`
		ConfidencePct float64 `json:"confidence_pct"`
	}

	steps := []ReproStep{}
	seenDescriptions := make(map[string]bool)

	for rows.Next() {
		var step ReproStep
		var eventType string
		var rawDescription string
		var exceptionData string
		var exceptionHandled bool
		var exceptionSeverity string
		var anrData string
		var anrSubject string

		if err := rows.Scan(
			&eventType,
			&rawDescription,
			&step.ThreadName,
			&step.ConfidencePct,
			&exceptionData,
			&exceptionHandled,
			&exceptionSeverity,
			&anrData,
			&anrSubject,
		); err != nil {
			return nil, fmt.Errorf("failed to scan reproduction step: %v", err)
		}

		switch eventType {
		case "exception":
			var exception event.Exception
			exception.Handled = exceptionHandled
			exception.Severity = event.Severity(exceptionSeverity)

			prefix, noPayloadDescription := "Crash: ", "Crash occurred"
			switch exception.GetSeverity() {
			case event.SeverityUnhandled:
				prefix, noPayloadDescription = "Unhandled error: ", "Unhandled error occurred"
			case event.SeverityHandled:
				prefix, noPayloadDescription = "Handled error: ", "Handled error occurred"
			}

			if exceptionData != "" && json.Unmarshal([]byte(exceptionData), &exception.Exceptions) == nil {
				step.Description = fmt.Sprintf("%s%s", prefix, formatExceptionMessage(
					exception.GetType(),
					exception.GetMessage(),
					exception.GetFileName(),
					exception.GetMethodName(),
				))
			} else {
				step.Description = noPayloadDescription
			}

		case "anr":
			var anr event.ANR
			if anrData != "" {
				_ = json.Unmarshal([]byte(anrData), &anr.Exceptions)
			}
			category := event.ANRSubjectCategory(anrSubject)

			switch {
			case len(anr.Exceptions) > 0:
				step.Description = fmt.Sprintf("ANR: %s", formatExceptionMessage(
					anr.GetType(),
					anr.GetMessage(),
					anr.GetFileName(),
					anr.GetMethodName(),
				))
			case category != "":
				step.Description = fmt.Sprintf("ANR: %s", category)
			default:
				step.Description = "ANR (Application Not Responding) occurred"
			}
		default:
			step.Description = rawDescription
		}

		// Clean null bytes from final values
		step.Description = cleanNullBytes(step.Description)
		step.ThreadName = cleanNullBytes(step.ThreadName)

		// Skip duplicate descriptions
		if seenDescriptions[step.Description] {
			continue
		}
		seenDescriptions[step.Description] = true

		steps = append(steps, step)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating over rows: %v", err)
	}

	type result struct {
		SessionsAnalyzed uint64      `json:"sessions_analyzed"`
		Steps            []ReproStep `json:"steps"`
	}

	return json.Marshal(result{
		SessionsAnalyzed: sessionsAnalyzed,
		Steps:            steps,
	})
}
