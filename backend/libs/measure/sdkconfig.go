package measure

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
	"github.com/valkey-io/valkey-go"
)

const (
	configCacheKeyPrefix = "sdk_config:"
)

const (
	ScreenshotMaskLevelAllTextAndMedia        ScreenshotMaskLevel = "all_text_and_media"
	ScreenshotMaskLevelAllText                ScreenshotMaskLevel = "all_text"
	ScreenshotMaskLevelAllTextExceptClickable ScreenshotMaskLevel = "all_text_except_clickable"
	ScreenshotMaskLevelSensitiveFieldsOnly    ScreenshotMaskLevel = "sensitive_fields_only"
)

type ScreenshotMaskLevel string

type SdkConfig struct {
	MaxEventsInBatch          int                 `json:"max_events_in_batch"`
	CrashTimelineDuration     int                 `json:"crash_timeline_duration"`
	ANRTimelineDuration       int                 `json:"anr_timeline_duration"`
	BugReportTimelineDuration int                 `json:"bug_report_timeline_duration"`
	TraceSamplingRate         float64             `json:"trace_sampling_rate"`
	JourneySamplingRate       float64             `json:"journey_sampling_rate"`
	ScreenshotMaskLevel       ScreenshotMaskLevel `json:"screenshot_mask_level"`
	LogAutocollectEnabled     bool                `json:"log_autocollect_enabled"`
	LogMinSeverity            int                 `json:"log_min_severity"`
	LogIgnorePatterns         []string            `json:"log_ignore_patterns"`
	CPUUsageInterval          int                 `json:"cpu_usage_interval"`
	MemoryUsageInterval       int                 `json:"memory_usage_interval"`
	CrashTakeScreenshot       bool                `json:"crash_take_screenshot"`
	ANRTakeScreenshot         bool                `json:"anr_take_screenshot"`
	LaunchSamplingRate        float64             `json:"launch_sampling_rate"`
	GestureClickTakeSnapshot  bool                `json:"gesture_click_take_snapshot"`
	HTTPSamplingRate          float64             `json:"http_sampling_rate"`
	HTTPDisableEventForURLs   []string            `json:"http_disable_event_for_urls"`
	HTTPTrackRequestForURLs   []string            `json:"http_track_request_for_urls"`
	HTTPTrackResponseForURLs  []string            `json:"http_track_response_for_urls"`
	HTTPBlockedHeaders        []string            `json:"http_blocked_headers"`
	ProfileSamplingRate       float64             `json:"profile_sampling_rate"`
	UpdatedAt                 *time.Time          `json:"-"`
	UpdatedBy                 *uuid.UUID          `json:"-"`
}

type ConfigPatch struct {
	MaxEventsInBatch          *int                 `json:"max_events_in_batch,omitempty"`
	CrashTimelineDuration     *int                 `json:"crash_timeline_duration,omitempty"`
	ANRTimelineDuration       *int                 `json:"anr_timeline_duration,omitempty"`
	BugReportTimelineDuration *int                 `json:"bug_report_timeline_duration,omitempty"`
	TraceSamplingRate         *float64             `json:"trace_sampling_rate,omitempty"`
	JourneySamplingRate       *float64             `json:"journey_sampling_rate,omitempty"`
	ScreenshotMaskLevel       *ScreenshotMaskLevel `json:"screenshot_mask_level,omitempty"`
	LogAutocollectEnabled     *bool                `json:"log_autocollect_enabled,omitempty"`
	LogMinSeverity            *int                 `json:"log_min_severity,omitempty"`
	LogIgnorePatterns         *[]string            `json:"log_ignore_patterns,omitempty"`
	CPUUsageInterval          *int                 `json:"cpu_usage_interval,omitempty"`
	MemoryUsageInterval       *int                 `json:"memory_usage_interval,omitempty"`
	CrashTakeScreenshot       *bool                `json:"crash_take_screenshot,omitempty"`
	ANRTakeScreenshot         *bool                `json:"anr_take_screenshot,omitempty"`
	LaunchSamplingRate        *float64             `json:"launch_sampling_rate,omitempty"`
	GestureClickSnapshot      *bool                `json:"gesture_click_take_snapshot,omitempty"`
	HTTPSamplingRate          *float64             `json:"http_sampling_rate,omitempty"`
	HTTPDisableEventForURLs   *[]string            `json:"http_disable_event_for_urls,omitempty"`
	HTTPTrackRequestForURLs   *[]string            `json:"http_track_request_for_urls,omitempty"`
	HTTPTrackResponseForURLs  *[]string            `json:"http_track_response_for_urls,omitempty"`
	HTTPBlockedHeaders        *[]string            `json:"http_blocked_headers,omitempty"`
	ProfileSamplingRate       *float64             `json:"profile_sampling_rate,omitempty"`
}

func (s ScreenshotMaskLevel) IsValid() bool {
	switch s {
	case ScreenshotMaskLevelAllText,
		ScreenshotMaskLevelAllTextExceptClickable,
		ScreenshotMaskLevelAllTextAndMedia,
		ScreenshotMaskLevelSensitiveFieldsOnly:
		return true
	}
	return false
}

func createDefaultConfig() SdkConfig {
	return SdkConfig{
		MaxEventsInBatch:          10000,
		CrashTimelineDuration:     300,
		ANRTimelineDuration:       300,
		BugReportTimelineDuration: 300,
		TraceSamplingRate:         100,
		JourneySamplingRate:       100,
		ScreenshotMaskLevel:       ScreenshotMaskLevelAllTextAndMedia,
		LogAutocollectEnabled:     false,
		LogMinSeverity:            16,
		LogIgnorePatterns:         []string{},
		CPUUsageInterval:          5,
		MemoryUsageInterval:       5,
		CrashTakeScreenshot:       true,
		ANRTakeScreenshot:         true,
		LaunchSamplingRate:        100,
		GestureClickTakeSnapshot:  true,
		HTTPSamplingRate:          100,
		HTTPDisableEventForURLs:   []string{},
		HTTPTrackRequestForURLs:   []string{},
		HTTPTrackResponseForURLs:  []string{},
		HTTPBlockedHeaders:        []string{},
		ProfileSamplingRate:       100,
	}
}

func configCacheKey(appID uuid.UUID) string {
	return fmt.Sprintf("%s{%s}", configCacheKeyPrefix, appID.String())
}

func GetConfigFromDb(ctx context.Context, pg *pgxpool.Pool, appID uuid.UUID) (*SdkConfig, error) {
	q := sqlf.PostgreSQL.
		Select("max_events_in_batch").
		Select("crash_timeline_duration").
		Select("anr_timeline_duration").
		Select("bug_report_timeline_duration").
		Select("trace_sampling_rate").
		Select("journey_sampling_rate").
		Select("screenshot_mask_level").
		Select("log_autocollect_enabled").
		Select("log_min_severity").
		Select("log_ignore_patterns").
		Select("cpu_usage_interval").
		Select("memory_usage_interval").
		Select("crash_take_screenshot").
		Select("anr_take_screenshot").
		Select("launch_sampling_rate").
		Select("gesture_click_take_snapshot").
		Select("http_sampling_rate").
		Select("http_disable_event_for_urls").
		Select("http_track_request_for_urls").
		Select("http_track_response_for_urls").
		Select("http_blocked_headers").
		Select("profile_sampling_rate").
		Select("updated_at").
		Select("updated_by").
		From("measure.sdk_config").
		Where("app_id = ?", appID)

	defer q.Close()

	var sdkConfig SdkConfig

	err := pg.QueryRow(ctx, q.String(), q.Args()...).Scan(
		&sdkConfig.MaxEventsInBatch,
		&sdkConfig.CrashTimelineDuration,
		&sdkConfig.ANRTimelineDuration,
		&sdkConfig.BugReportTimelineDuration,
		&sdkConfig.TraceSamplingRate,
		&sdkConfig.JourneySamplingRate,
		&sdkConfig.ScreenshotMaskLevel,
		&sdkConfig.LogAutocollectEnabled,
		&sdkConfig.LogMinSeverity,
		&sdkConfig.LogIgnorePatterns,
		&sdkConfig.CPUUsageInterval,
		&sdkConfig.MemoryUsageInterval,
		&sdkConfig.CrashTakeScreenshot,
		&sdkConfig.ANRTakeScreenshot,
		&sdkConfig.LaunchSamplingRate,
		&sdkConfig.GestureClickTakeSnapshot,
		&sdkConfig.HTTPSamplingRate,
		&sdkConfig.HTTPDisableEventForURLs,
		&sdkConfig.HTTPTrackRequestForURLs,
		&sdkConfig.HTTPTrackResponseForURLs,
		&sdkConfig.HTTPBlockedHeaders,
		&sdkConfig.ProfileSamplingRate,
		&sdkConfig.UpdatedAt,
		&sdkConfig.UpdatedBy,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get config: %w", err)
	}

	return &sdkConfig, nil
}

func InvalidateCache(ctx context.Context, vk valkey.Client, appID uuid.UUID) error {
	if vk == nil {
		return nil
	}

	cacheKey := configCacheKey(appID)
	cmd := vk.B().Del().Key(cacheKey).Build()
	result := vk.Do(ctx, cmd)

	return result.Error()
}

// CreateConfig creates a default
// SDK config for the given app.
func CreateConfig(ctx context.Context, tx pgx.Tx, teamID, appID uuid.UUID, createdBy *uuid.UUID) error {
	config := createDefaultConfig()

	stmt := sqlf.PostgreSQL.
		InsertInto("measure.sdk_config").
		Set("team_id", teamID).
		Set("app_id", appID).
		Set("max_events_in_batch", config.MaxEventsInBatch).
		Set("crash_timeline_duration", config.CrashTimelineDuration).
		Set("anr_timeline_duration", config.ANRTimelineDuration).
		Set("bug_report_timeline_duration", config.BugReportTimelineDuration).
		Set("trace_sampling_rate", config.TraceSamplingRate).
		Set("journey_sampling_rate", config.JourneySamplingRate).
		Set("screenshot_mask_level", config.ScreenshotMaskLevel).
		Set("log_autocollect_enabled", config.LogAutocollectEnabled).
		Set("log_min_severity", config.LogMinSeverity).
		Set("log_ignore_patterns", config.LogIgnorePatterns).
		Set("cpu_usage_interval", config.CPUUsageInterval).
		Set("memory_usage_interval", config.MemoryUsageInterval).
		Set("crash_take_screenshot", config.CrashTakeScreenshot).
		Set("anr_take_screenshot", config.ANRTakeScreenshot).
		Set("launch_sampling_rate", config.LaunchSamplingRate).
		Set("gesture_click_take_snapshot", config.GestureClickTakeSnapshot).
		Set("http_sampling_rate", config.HTTPSamplingRate).
		Set("http_disable_event_for_urls", config.HTTPDisableEventForURLs).
		Set("http_track_request_for_urls", config.HTTPTrackRequestForURLs).
		Set("http_track_response_for_urls", config.HTTPTrackResponseForURLs).
		Set("http_blocked_headers", config.HTTPBlockedHeaders).
		Set("profile_sampling_rate", config.ProfileSamplingRate).
		Set("updated_at", time.Now()).
		Set("updated_by", createdBy)

	defer stmt.Close()

	_, err := tx.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return fmt.Errorf("failed to create config: %w", err)
	}

	return nil
}

// PatchConfigForApp applies the
// given patch to the SDK config.
