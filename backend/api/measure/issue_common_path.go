package measure

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"backend/api/event"
	"backend/api/server"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

type CommonPathGroupType string

const (
	GroupTypeCrash     CommonPathGroupType = "crash"
	GroupTypeANR       CommonPathGroupType = "anr"
	sessionsLimit      uint8               = 50
	minEventsInSession uint8               = 2
	minConfidencePct   uint8               = 30
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

func GetCrashGroupCommonPath(c *gin.Context) {
	getCrashOrANRGroupCommonPath(c, GroupTypeCrash)
}

func GetANRGroupCommonPath(c *gin.Context) {
	getCrashOrANRGroupCommonPath(c, GroupTypeANR)
}

func getCrashOrANRGroupCommonPath(c *gin.Context, groupType CommonPathGroupType) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	// Get groupId from the appropriate param based on type
	var groupId string
	if groupType == GroupTypeCrash {
		groupId = c.Param("crashGroupId")
	} else {
		groupId = c.Param("anrGroupId")
	}

	if groupId == "" {
		msg := fmt.Sprintf(`%s group id is invalid or missing`, groupType)
		fmt.Println(msg)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	// Validate the group exists
	var group interface{}
	if groupType == "crash" {
		group, err = app.GetExceptionGroup(ctx, groupId)
	} else {
		group, err = app.GetANRGroup(ctx, groupId)
	}
	if err != nil {
		msg := fmt.Sprintf("failed to get %s group with id %q", groupType, groupId)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if group == nil {
		msg := fmt.Sprintf("no %s group found with id %q", groupType, groupId)
		fmt.Println(msg)
		c.JSON(http.StatusNotFound, gin.H{
			"error": msg,
		})
		return
	}

	// Build the WHERE clause based on type
	var fingerprintCondition string
	if groupType == "crash" {
		fingerprintCondition = "exception.fingerprint = fp"
	} else {
		fingerprintCondition = "anr.fingerprint = fp"
	}

	// Build the fingerprint condition based on type
	sessionCountQuery := sqlf.New(`
    WITH 
    fingerprint AS (
        SELECT ? as fp
    ),
    sessions_with_min_events AS (
        SELECT session_id
        FROM measure.events
        WHERE app_id = ?
        GROUP BY session_id
        HAVING count(*) >= ?
    ),
    affected_sessions AS (
        SELECT DISTINCT
            e.session_id,
            e.timestamp as crash_timestamp
        FROM measure.events e
        CROSS JOIN fingerprint
        INNER JOIN sessions_with_min_events s ON e.session_id = s.session_id
        WHERE 
            e.app_id = ?
            AND `+fingerprintCondition+`
        ORDER BY e.timestamp DESC
        LIMIT ?
    )
    SELECT count(*) as session_count
    FROM affected_sessions
`, groupId, *app.ID, minEventsInSession, *app.ID, sessionsLimit)

	var sessionsAnalyzed uint64
	err = server.Server.ChPool.QueryRow(ctx, sessionCountQuery.String(), sessionCountQuery.Args()...).Scan(&sessionsAnalyzed)
	if err != nil {
		msg := "failed to get session count"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	// Main query to get common path
	query := sqlf.New(`
		WITH 
		fingerprint AS (
			SELECT ? as fp
		),

		-- Get crash events from valid sessions
		crash_events AS (
			SELECT 
				e.session_id,
				e.timestamp as crash_timestamp
			FROM measure.events e
			CROSS JOIN fingerprint
			WHERE 
				e.app_id = ?
				AND `+fingerprintCondition+`
				AND e.session_id != toUUID('00000000-0000-0000-0000-000000000000')
				AND e.session_id IN (
					SELECT session_id
					FROM measure.events
					WHERE app_id = ?
					GROUP BY session_id
					HAVING count(*) >= ?
				)
			ORDER BY e.timestamp DESC
			LIMIT ?
		),

		-- Get all events with their crash timestamp
		all_events AS (
			SELECT 
				e.session_id,
				e.type,
				e.timestamp,
				e."attribute.thread_name" as thread_name,
				ce.crash_timestamp,
				if(e.type = 'exception', e."exception.exceptions", '') as exception_data,
				if(e.type = 'exception', e."exception.handled", false) as exception_handled,
				if(e.type = 'anr', e."anr.exceptions", '') as anr_data,
				if(e.type = 'anr', e."anr.handled", false) as anr_handled,
				multiIf(
					e.type = 'exception' OR e.type = 'anr', e.type,
					e.type = 'app_exit', concat('App exited: ', coalesce(e."app_exit.reason", 'unknown reason')),
					e.type = 'gesture_click', concat('User tapped on ', 
						coalesce(nullIf(e."gesture_click.target_id", ''), nullIf(e."gesture_click.target", ''), 'unknown view'),
						if(e."gesture_click.target_id" != '' AND e."gesture_click.target" != '', concat(' (', e."gesture_click.target", ')'), '')),
					e.type = 'gesture_long_click', concat('User long-pressed on ', 
						coalesce(nullIf(e."gesture_long_click.target_id", ''), nullIf(e."gesture_long_click.target", ''), 'unknown view'),
						if(e."gesture_long_click.target_id" != '' AND e."gesture_long_click.target" != '', concat(' (', e."gesture_long_click.target", ')'), '')),
					e.type = 'gesture_scroll', concat('User scrolled in ', 
						coalesce(nullIf(e."gesture_scroll.target_id", ''), nullIf(e."gesture_scroll.target", ''), 'unknown view'),
						if(e."gesture_scroll.target_id" != '' AND e."gesture_scroll.target" != '', concat(' (', e."gesture_scroll.target", ')'), '')),
					e.type = 'navigation', concat('Navigated to screen: ', coalesce(e."navigation.to", 'unknown')),
					e.type = 'screen_view', concat('Viewed screen: ', coalesce(e."screen_view.name", 'unknown')),
					e.type = 'lifecycle_activity' AND e."lifecycle_activity.type" = 'created', concat('Activity created: ', coalesce(e."lifecycle_activity.class_name", 'unknown')),
					e.type = 'lifecycle_activity' AND e."lifecycle_activity.type" = 'resumed', concat('Activity resumed: ', coalesce(e."lifecycle_activity.class_name", 'unknown')),
					e.type = 'lifecycle_activity' AND e."lifecycle_activity.type" = 'paused', concat('Activity paused: ', coalesce(e."lifecycle_activity.class_name", 'unknown')),
					e.type = 'lifecycle_activity' AND e."lifecycle_activity.type" = 'destroyed', concat('Activity destroyed: ', coalesce(e."lifecycle_activity.class_name", 'unknown')),
					e.type = 'lifecycle_activity', concat('Activity ', coalesce(e."lifecycle_activity.type", 'unknown'), ': ', coalesce(e."lifecycle_activity.class_name", 'unknown')),
					e.type = 'lifecycle_fragment' AND e."lifecycle_fragment.type" = 'attached', concat('Fragment attached: ', coalesce(e."lifecycle_fragment.class_name", 'unknown')),
					e.type = 'lifecycle_fragment' AND e."lifecycle_fragment.type" = 'resumed', concat('Fragment resumed: ', coalesce(e."lifecycle_fragment.class_name", 'unknown')),
					e.type = 'lifecycle_fragment' AND e."lifecycle_fragment.type" = 'paused', concat('Fragment paused: ', coalesce(e."lifecycle_fragment.class_name", 'unknown')),
					e.type = 'lifecycle_fragment' AND e."lifecycle_fragment.type" = 'detached', concat('Fragment detached: ', coalesce(e."lifecycle_fragment.class_name", 'unknown')),
					e.type = 'lifecycle_fragment', concat('Fragment ', coalesce(e."lifecycle_fragment.type", 'unknown'), ': ', coalesce(e."lifecycle_fragment.class_name", 'unknown')),
					e.type = 'lifecycle_view_controller' AND e."lifecycle_view_controller.type" = 'viewDidLoad', concat('View controller loaded: ', coalesce(e."lifecycle_view_controller.class_name", 'unknown')),
					e.type = 'lifecycle_view_controller' AND e."lifecycle_view_controller.type" = 'viewWillAppear', concat('View controller will appear: ', coalesce(e."lifecycle_view_controller.class_name", 'unknown')),
					e.type = 'lifecycle_view_controller' AND e."lifecycle_view_controller.type" = 'viewDidAppear', concat('View controller appeared: ', coalesce(e."lifecycle_view_controller.class_name", 'unknown')),
					e.type = 'lifecycle_view_controller' AND e."lifecycle_view_controller.type" = 'viewWillDisappear', concat('View controller will disappear: ', coalesce(e."lifecycle_view_controller.class_name", 'unknown')),
					e.type = 'lifecycle_view_controller' AND e."lifecycle_view_controller.type" = 'viewDidDisappear', concat('View controller disappeared: ', coalesce(e."lifecycle_view_controller.class_name", 'unknown')),
					e.type = 'lifecycle_view_controller' AND e."lifecycle_view_controller.type" = 'didReceiveMemoryWarning', concat('View controller received memory warning: ', coalesce(e."lifecycle_view_controller.class_name", 'unknown')),
					e.type = 'lifecycle_view_controller' AND e."lifecycle_view_controller.type" = 'vcDeinit', concat('View controller deallocated: ', coalesce(e."lifecycle_view_controller.class_name", 'unknown')),
					e.type = 'lifecycle_view_controller', concat('View controller ', coalesce(e."lifecycle_view_controller.type", 'unknown'), ': ', coalesce(e."lifecycle_view_controller.class_name", 'unknown')),
					e.type = 'lifecycle_swift_ui' AND e."lifecycle_swift_ui.type" = 'on_appear', concat('SwiftUI view appeared: ', coalesce(e."lifecycle_swift_ui.class_name", 'unknown')),
					e.type = 'lifecycle_swift_ui' AND e."lifecycle_swift_ui.type" = 'on_disappear', concat('SwiftUI view disappeared: ', coalesce(e."lifecycle_swift_ui.class_name", 'unknown')),
					e.type = 'lifecycle_swift_ui', concat('SwiftUI view ', coalesce(e."lifecycle_swift_ui.type", 'unknown'), ': ', coalesce(e."lifecycle_swift_ui.class_name", 'unknown')),
					e.type = 'lifecycle_app' AND e."lifecycle_app.type" = 'foreground', 'App moved to foreground',
					e.type = 'lifecycle_app' AND e."lifecycle_app.type" = 'background', 'App moved to background',
					e.type = 'lifecycle_app', concat('App lifecycle: ', coalesce(e."lifecycle_app.type", 'unknown')),
					e.type = 'cold_launch', concat('App cold launched (activity: ', coalesce(e."cold_launch.launched_activity", 'unknown'), ')'),
					e.type = 'warm_launch', concat('App warm launched (activity: ', coalesce(e."warm_launch.launched_activity", 'unknown'), ')'),
					e.type = 'hot_launch', concat('App hot launched (activity: ', coalesce(e."hot_launch.launched_activity", 'unknown'), ')'),
					e.type = 'network_change', concat('Network changed from ', 
						coalesce(e."network_change.previous_network_type", 'unknown'), 
						if(e."network_change.previous_network_generation" != '', concat(' (', e."network_change.previous_network_generation", ')'), ''),
						' to ', 
						coalesce(e."network_change.network_type", 'unknown'),
						if(e."network_change.network_generation" != '', concat(' (', e."network_change.network_generation", ')'), '')),
					e.type = 'http', concat('HTTP ', coalesce(e."http.method", 'REQUEST'), ' to ', coalesce(e."http.url", 'unknown URL'),
						if(e."http.status_code" > 0, concat(' (status: ', toString(e."http.status_code"), ')'), '')),
					e.type = 'memory_usage_absolute', 'Memory usage recorded',
					e.type = 'low_memory', 'Low memory warning received from system',
					e.type = 'trim_memory', concat('System requested memory trim (level: ', coalesce(e."trim_memory.level", 'unknown'), ')'),
					e.type = 'custom', concat('Custom event: ', coalesce(e."custom.name", 'unknown')),
					e.type = 'string', concat('Log [', coalesce(e."string.severity_text", 'INFO'), ']: ', substring(coalesce(e."string.string", ''), 1, 80)),
					e.type = 'session_start', 'Session started',
					e.type = 'bug_report', 'User submitted bug report',
					concat('Event: ', e.type)
				) as description
			FROM measure.events e
			INNER JOIN crash_events ce ON e.session_id = ce.session_id
			WHERE 
				e.app_id = ?
				AND e.timestamp <= ce.crash_timestamp
				AND e.type NOT IN ('cpu_usage', 'memory_usage')
		),

		-- Rank events by position from end
		ranked_events AS (
			SELECT 
				session_id,
				type,
				description,
				thread_name,
				exception_data,
				exception_handled,
				anr_data,
				anr_handled,
				row_number() OVER (PARTITION BY session_id ORDER BY timestamp DESC) as position_from_end
			FROM all_events
		),

		-- Keep only recent events
		recent_events AS (
			SELECT *
			FROM ranked_events
			WHERE position_from_end <= ?
		),

		-- Calculate confidence per position
		common_events_by_position AS (
			SELECT 
				position_from_end,
				type,
				description,
				count(DISTINCT session_id) as session_count,
				round((count(DISTINCT session_id) * 100.0) / (SELECT count(DISTINCT session_id) FROM crash_events), 1) as confidence_pct,
				any(thread_name) as thread_name,
				any(exception_data) as exception_data,
				any(exception_handled) as exception_handled,
				any(anr_data) as anr_data,
				any(anr_handled) as anr_handled
			FROM recent_events
			GROUP BY position_from_end, type, description
		),

		-- Pick best event per position
		best_event_per_position AS (
			SELECT 
				position_from_end,
				type,
				description,
				thread_name,
				confidence_pct,
				exception_data,
				exception_handled,
				anr_data,
				anr_handled
			FROM (
				SELECT 
					*,
					row_number() OVER (PARTITION BY position_from_end ORDER BY confidence_pct DESC) as rn
				FROM common_events_by_position
				WHERE confidence_pct >= ?
			) ranked
			WHERE rn = 1
		)

		SELECT 
			toString(type) as type,
			toString(description) as description,
			toString(thread_name) as thread_name,
			confidence_pct,
			toString(exception_data) as exception_data,
			exception_handled,
			toString(anr_data) as anr_data,
			anr_handled
		FROM best_event_per_position
		ORDER BY position_from_end DESC
`,
		groupId,
		*app.ID,
		*app.ID,
		minEventsInSession,
		sessionsLimit,
		*app.ID,
		sessionsLimit,
		minConfidencePct,
	)

	rows, err := server.Server.ChPool.Query(ctx, query.String(), query.Args()...)
	if err != nil {
		msg := "failed to execute reproduction steps query"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
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
		var anrData string
		var anrHandled bool

		if err := rows.Scan(
			&eventType,
			&rawDescription,
			&step.ThreadName,
			&step.ConfidencePct,
			&exceptionData,
			&exceptionHandled,
			&anrData,
			&anrHandled,
		); err != nil {
			msg := "failed to scan reproduction step"
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
			return
		}

		switch eventType {
		case "exception":
			var exception event.Exception
			if exceptionData != "" && json.Unmarshal([]byte(exceptionData), &exception.Exceptions) == nil {
				prefix := "Crash: "
				if exceptionHandled {
					prefix = "Handled exception: "
				}
				step.Description = fmt.Sprintf("%s%s", prefix, formatExceptionMessage(
					exception.GetType(),
					exception.GetMessage(),
					exception.GetFileName(),
					exception.GetMethodName(),
				))
			} else {
				step.Description = "Crash occurred"
				if exceptionHandled {
					step.Description = "Handled exception occurred"
				}
			}

		case "anr":
			var anr event.ANR
			if anrData != "" && json.Unmarshal([]byte(anrData), &anr.Exceptions) == nil {
				prefix := "ANR: "
				if anrHandled {
					prefix = "Handled ANR: "
				}
				step.Description = fmt.Sprintf("%s%s", prefix, formatExceptionMessage(
					anr.GetType(),
					anr.GetMessage(),
					anr.GetFileName(),
					anr.GetMethodName(),
				))
			} else {
				step.Description = "ANR (Application Not Responding) occurred"
				if anrHandled {
					step.Description = "Handled ANR (Application Not Responding) occurred"
				}
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
		msg := "error iterating over rows"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"sessions_analyzed": sessionsAnalyzed,
		"steps":             steps,
	})
}
