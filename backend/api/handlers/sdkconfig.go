package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

	"backend/api/server"
	"backend/libs/sdkconfig"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

// configColumns must stay ordered to match the scan in PatchConfigForApp.
const configColumns = `max_events_in_batch, error_replay_duration, anr_timeline_duration,
	bug_report_timeline_duration, trace_sampling_rate, journey_sampling_rate,
	screenshot_mask_level, log_autocollect_enabled, log_min_severity,
	log_ignore_patterns, cpu_usage_interval, memory_usage_interval,
	error_fatal_take_screenshot, error_fatal_replay_enabled,
	error_unhandled_replay_enabled, error_handled_replay_enabled,
	error_fatal_sampling_rate, error_unhandled_sampling_rate, error_handled_sampling_rate,
	anr_take_screenshot, launch_sampling_rate,
	gesture_click_take_snapshot, http_sampling_rate, http_disable_event_for_urls,
	http_track_request_for_urls, http_track_response_for_urls, http_blocked_headers,
	profile_sampling_rate, updated_at, updated_by`

// PatchConfigForApp applies a patch to an app's SDK config in Postgres, then refreshes the cache.
func PatchConfigForApp(c *gin.Context, deps *server.Deps, appID uuid.UUID, userID string) error {
	var patch sdkconfig.ConfigPatch
	if err := c.ShouldBindJSON(&patch); err != nil {
		return fmt.Errorf("failed to bind JSON: %w", err)
	}

	userIdUUID, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("invalid user ID: %w", err)
	}

	stmt := sqlf.PostgreSQL.Update("measure.sdk_config")

	if patch.MaxEventsInBatch != nil {
		stmt.Set("max_events_in_batch", *patch.MaxEventsInBatch)
	}
	if patch.ErrorReplayDuration != nil {
		stmt.Set("error_replay_duration", *patch.ErrorReplayDuration)
	}
	if patch.ANRTimelineDuration != nil {
		stmt.Set("anr_timeline_duration", *patch.ANRTimelineDuration)
	}
	if patch.BugReportTimelineDuration != nil {
		stmt.Set("bug_report_timeline_duration", *patch.BugReportTimelineDuration)
	}
	if patch.TraceSamplingRate != nil {
		if *patch.TraceSamplingRate < 0 || *patch.TraceSamplingRate > 100 {
			return fmt.Errorf("trace_sampling_rate must be between 0-100")
		}
		stmt.Set("trace_sampling_rate", *patch.TraceSamplingRate)
	}
	if patch.JourneySamplingRate != nil {
		if *patch.JourneySamplingRate < 0 || *patch.JourneySamplingRate > 100 {
			return fmt.Errorf("journey_sampling_rate must be between 0-100")
		}
		stmt.Set("journey_sampling_rate", *patch.JourneySamplingRate)
	}
	if patch.ScreenshotMaskLevel != nil {
		if !patch.ScreenshotMaskLevel.IsValid() {
			return fmt.Errorf("invalid screenshot mask level: %s", *patch.ScreenshotMaskLevel)
		}
		stmt.Set("screenshot_mask_level", string(*patch.ScreenshotMaskLevel))
	}
	if patch.LogAutocollectEnabled != nil {
		stmt.Set("log_autocollect_enabled", *patch.LogAutocollectEnabled)
	}
	if patch.LogMinSeverity != nil {
		stmt.Set("log_min_severity", *patch.LogMinSeverity)
	}
	if patch.LogIgnorePatterns != nil {
		stmt.Set("log_ignore_patterns", *patch.LogIgnorePatterns)
	}
	if patch.CPUUsageInterval != nil {
		stmt.Set("cpu_usage_interval", *patch.CPUUsageInterval)
	}
	if patch.MemoryUsageInterval != nil {
		stmt.Set("memory_usage_interval", *patch.MemoryUsageInterval)
	}
	if patch.ErrorFatalTakeScreenshot != nil {
		stmt.Set("error_fatal_take_screenshot", *patch.ErrorFatalTakeScreenshot)
	}
	if patch.ErrorFatalReplayEnabled != nil {
		stmt.Set("error_fatal_replay_enabled", *patch.ErrorFatalReplayEnabled)
	}
	if patch.ErrorUnhandledReplayEnabled != nil {
		stmt.Set("error_unhandled_replay_enabled", *patch.ErrorUnhandledReplayEnabled)
	}
	if patch.ErrorHandledReplayEnabled != nil {
		stmt.Set("error_handled_replay_enabled", *patch.ErrorHandledReplayEnabled)
	}
	if patch.ErrorFatalSamplingRate != nil {
		if *patch.ErrorFatalSamplingRate < 0 || *patch.ErrorFatalSamplingRate > 100 {
			return fmt.Errorf("error_fatal_sampling_rate must be between 0-100")
		}
		stmt.Set("error_fatal_sampling_rate", *patch.ErrorFatalSamplingRate)
	}
	if patch.ErrorUnhandledSamplingRate != nil {
		if *patch.ErrorUnhandledSamplingRate < 0 || *patch.ErrorUnhandledSamplingRate > 100 {
			return fmt.Errorf("error_unhandled_sampling_rate must be between 0-100")
		}
		stmt.Set("error_unhandled_sampling_rate", *patch.ErrorUnhandledSamplingRate)
	}
	if patch.ErrorHandledSamplingRate != nil {
		if *patch.ErrorHandledSamplingRate < 0 || *patch.ErrorHandledSamplingRate > 100 {
			return fmt.Errorf("error_handled_sampling_rate must be between 0-100")
		}
		stmt.Set("error_handled_sampling_rate", *patch.ErrorHandledSamplingRate)
	}
	if patch.ANRTakeScreenshot != nil {
		stmt.Set("anr_take_screenshot", *patch.ANRTakeScreenshot)
	}
	if patch.LaunchSamplingRate != nil {
		if *patch.LaunchSamplingRate < 0 || *patch.LaunchSamplingRate > 100 {
			return fmt.Errorf("launch_sampling_rate must be between 0-100")
		}
		stmt.Set("launch_sampling_rate", *patch.LaunchSamplingRate)
	}
	if patch.GestureClickSnapshot != nil {
		stmt.Set("gesture_click_take_snapshot", *patch.GestureClickSnapshot)
	}
	if patch.HTTPSamplingRate != nil {
		if *patch.HTTPSamplingRate < 0 || *patch.HTTPSamplingRate > 100 {
			return fmt.Errorf("http_sampling_rate must be between 0-100")
		}
		stmt.Set("http_sampling_rate", *patch.HTTPSamplingRate)
	}
	if patch.HTTPDisableEventForURLs != nil {
		stmt.Set("http_disable_event_for_urls", *patch.HTTPDisableEventForURLs)
	}
	if patch.HTTPTrackRequestForURLs != nil {
		stmt.Set("http_track_request_for_urls", *patch.HTTPTrackRequestForURLs)
	}
	if patch.HTTPTrackResponseForURLs != nil {
		stmt.Set("http_track_response_for_urls", *patch.HTTPTrackResponseForURLs)
	}
	if patch.HTTPBlockedHeaders != nil {
		stmt.Set("http_blocked_headers", *patch.HTTPBlockedHeaders)
	}
	if patch.ProfileSamplingRate != nil {
		if *patch.ProfileSamplingRate < 0 || *patch.ProfileSamplingRate > 100 {
			return fmt.Errorf("profile_sampling_rate must be between 0-100")
		}
		stmt.Set("profile_sampling_rate", *patch.ProfileSamplingRate)
	}
	// the database clock, evaluated after the row lock, orders concurrent patches
	stmt.SetExpr("updated_at", "clock_timestamp()")
	stmt.Set("updated_by", &userIdUUID)
	stmt.Where("app_id = ?", appID)

	stmt.Returning(configColumns)

	defer stmt.Close()

	ctx := c.Request.Context()

	var config sdkconfig.SdkConfig
	if err := deps.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(
		&config.MaxEventsInBatch,
		&config.ErrorReplayDuration,
		&config.ANRTimelineDuration,
		&config.BugReportTimelineDuration,
		&config.TraceSamplingRate,
		&config.JourneySamplingRate,
		&config.ScreenshotMaskLevel,
		&config.LogAutocollectEnabled,
		&config.LogMinSeverity,
		&config.LogIgnorePatterns,
		&config.CPUUsageInterval,
		&config.MemoryUsageInterval,
		&config.ErrorFatalTakeScreenshot,
		&config.ErrorFatalReplayEnabled,
		&config.ErrorUnhandledReplayEnabled,
		&config.ErrorHandledReplayEnabled,
		&config.ErrorFatalSamplingRate,
		&config.ErrorUnhandledSamplingRate,
		&config.ErrorHandledSamplingRate,
		&config.ANRTakeScreenshot,
		&config.LaunchSamplingRate,
		&config.GestureClickTakeSnapshot,
		&config.HTTPSamplingRate,
		&config.HTTPDisableEventForURLs,
		&config.HTTPTrackRequestForURLs,
		&config.HTTPTrackResponseForURLs,
		&config.HTTPBlockedHeaders,
		&config.ProfileSamplingRate,
		&config.UpdatedAt,
		&config.UpdatedBy,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("config not found for app_id: %s", appID)
		}
		return fmt.Errorf("failed to exec update: %w", err)
	}

	jsonConfig, err := json.Marshal(&config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	// the cache guard fences on this, a nil means RETURNING dropped a column we set
	if config.UpdatedAt == nil {
		return fmt.Errorf("update returned no updated_at for app_id: %s", appID)
	}

	// postgres is already updated & is the source of truth, the cache is best effort
	cacheCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()

	if err := sdkconfig.SetCache(cacheCtx, deps.VK, appID, jsonConfig, *config.UpdatedAt); err != nil {
		fmt.Println("failed to write config cache, app_id:", appID, err)
		// a fresh deadline, cacheCtx may be exhausted by the write that just failed
		dropCtx, dropCancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer dropCancel()
		if err := sdkconfig.InvalidateCache(dropCtx, deps.VK, appID); err != nil {
			fmt.Println("failed to drop config cache, app_id:", appID, err)
		}
	}

	return nil
}

// GetConfigForSdk proxies to the ingest service, or returns 410 on Cloud.
func (h Handlers) GetConfigForSdk(c *gin.Context) {
	deps := h.Deps
	// temporary, remove once SDKs move to the ingest endpoint
	if !deps.Config.IsCloud() {
		ingestOrigin := "http://ingest:8085"
		target, err := url.Parse(ingestOrigin)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to parse ingest origin",
			})
			return
		}
		proxy := httputil.NewSingleHostReverseProxy(target)
		proxy.ServeHTTP(c.Writer, c.Request)
		return
	}

	c.Status(http.StatusGone)
}

// GetConfigForDashboard returns the SDK config for the dashboard, always from Postgres.
func GetConfigForDashboard(c *gin.Context, deps *server.Deps, appID uuid.UUID) {
	sdkConfig, err := sdkconfig.GetConfigFromDb(c.Request.Context(), deps.PgPool, appID)
	if err != nil {
		msg := `error fetching SDK config`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	jsonConfig, err := json.Marshal(sdkConfig)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error marshaling config"})
		return
	}
	c.Data(http.StatusOK, "application/json", jsonConfig)
}
