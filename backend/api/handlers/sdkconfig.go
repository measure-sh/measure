package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

	"backend/api/server"
	"backend/libs/measure"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

func PatchConfigForApp(c *gin.Context, deps *server.Deps, appID uuid.UUID, userID string) error {
	var patch measure.ConfigPatch
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

	defer stmt.Close()

	result, err := deps.PgPool.Exec(c.Request.Context(), stmt.String(), stmt.Args()...)
	if err != nil {
		return fmt.Errorf("failed to exec update: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("config not found for app_id: %s", appID)
	}

	measure.InvalidateCache(c.Request.Context(), deps.VK, appID)

	return nil
}

// GetConfigForSdk retrieves the SDK
// config for the app.
// It uses the redis cache and falls back
// to the database if needed.
func (h Handlers) GetConfigForSdk(c *gin.Context) {
	deps := h.Deps
	// Proxy to ingest service
	//
	// Proxy to ingest service for non-Cloud
	// environments so that SDKS using API endpoint
	// continue to work. This is temporary & will be
	// eventually removed.
	//
	// SDK consumers are encouraged to migrate to the
	// ingest endpoint.
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

// GetConfigForDashboard retrieves the SDK
// config for dashboard use. It always
// fetches the config from database.
func GetConfigForDashboard(c *gin.Context, deps *server.Deps, appID uuid.UUID) {
	sdkConfig, err := measure.GetConfigFromDb(c.Request.Context(), deps.PgPool, appID)
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
