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
const configColumns = `max_events_in_batch, crash_timeline_duration, anr_timeline_duration,
	bug_report_timeline_duration, trace_sampling_rate, journey_sampling_rate,
	screenshot_mask_level, log_autocollect_enabled, log_min_severity,
	log_ignore_patterns, cpu_usage_interval, memory_usage_interval,
	crash_take_screenshot, anr_take_screenshot, launch_sampling_rate,
	gesture_click_take_snapshot, http_sampling_rate, http_disable_event_for_urls,
	http_track_request_for_urls, http_track_response_for_urls, http_blocked_headers,
	profile_sampling_rate, updated_at, updated_by`

// PatchConfigForApp applies a patch to an app's SDK config, updating Postgres & the cache together.
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
	if patch.CrashTimelineDuration != nil {
		stmt.Set("crash_timeline_duration", *patch.CrashTimelineDuration)
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
	if patch.CrashTakeScreenshot != nil {
		stmt.Set("crash_take_screenshot", *patch.CrashTakeScreenshot)
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
	stmt.Set("updated_at", time.Now())
	stmt.Set("updated_by", &userIdUUID)
	stmt.Where("app_id = ?", appID)

	stmt.Returning(configColumns)

	defer stmt.Close()

	ctx := c.Request.Context()

	tx, err := deps.PgPool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	defer tx.Rollback(ctx)

	var config sdkconfig.SdkConfig
	if err := tx.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(
		&config.MaxEventsInBatch,
		&config.CrashTimelineDuration,
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
		&config.CrashTakeScreenshot,
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

	// inside the txn, a cache failure must roll the row back
	if err := sdkconfig.SetCache(ctx, deps.VK, appID, jsonConfig); err != nil {
		return fmt.Errorf("failed to write config cache: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		// ctx may be why the commit failed, so don't inherit its cancellation
		cleanupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		if err := sdkconfig.InvalidateCache(cleanupCtx, deps.VK, appID); err != nil {
			fmt.Println("failed to invalidate config cache after commit failure, app_id:", appID, err)
		}
		return fmt.Errorf("failed to commit transaction: %w", err)
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
