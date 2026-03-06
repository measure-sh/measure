package measure

import (
	"backend/ingest/server"
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
	"github.com/valkey-io/valkey-go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

const (
	configCacheKeyPrefix = "sdk_config:"
	cacheControlHeader   = "Cache-Control"
	cacheControlValue    = "max-age=600"
)

// OTel metric constants
const (
	otelMeterName               = "measure/sdk_config"
	otelCacheRequestsMetricName = "sdkconfig.cache.requests"
	otelCacheResultAttrKey      = "cache.result"
	otelCacheHitETagAttrValue   = "hit_etag"
	otelCacheHitDataAttrValue   = "hit_data"
	otelCacheMissAttrValue      = "miss"
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
	CPUUsageInterval          int                 `json:"cpu_usage_interval"`
	MemoryUsageInterval       int                 `json:"memory_usage_interval"`
	CrashTakeScreenshot       bool                `json:"crash_take_screenshot"`
	ANRTakeScreenshot         bool                `json:"anr_take_screenshot"`
	LaunchSamplingRate        float64             `json:"launch_sampling_rate"`
	GestureClickTakeSnapshot  bool                `json:"gesture_click_take_snapshot"`
	HTTPDisableEventForURLs   []string            `json:"http_disable_event_for_urls"`
	HTTPTrackRequestForURLs   []string            `json:"http_track_request_for_urls"`
	HTTPTrackResponseForURLs  []string            `json:"http_track_response_for_urls"`
	HTTPBlockedHeaders        []string            `json:"http_blocked_headers"`
	UpdatedAt                 *time.Time          `json:"-"`
	UpdatedBy                 *uuid.UUID          `json:"-"`
}

// cacheMetrics encapsulates SDK config cache metrics
type cacheMetrics struct {
	requests metric.Int64Counter
}

var sdkConfigCache *cacheMetrics

func init() {
	meter := otel.Meter(otelMeterName)
	counter, err := meter.Int64Counter(
		otelCacheRequestsMetricName,
		metric.WithDescription("SDK config cache requests"),
	)
	if err != nil {
		panic(err)
	}
	sdkConfigCache = &cacheMetrics{requests: counter}
}

// RecordHitETag records a cache hit
// where client's ETag matched
func (m *cacheMetrics) RecordHitETag(ctx context.Context) {
	m.requests.Add(ctx, 1, metric.WithAttributes(
		attribute.String(otelCacheResultAttrKey, otelCacheHitETagAttrValue),
	))
}

// RecordHitData records a cache hit
// where data was served from cache
func (m *cacheMetrics) RecordHitData(ctx context.Context) {
	m.requests.Add(ctx, 1, metric.WithAttributes(
		attribute.String(otelCacheResultAttrKey, otelCacheHitDataAttrValue),
	))
}

// RecordMiss records a cache miss
func (m *cacheMetrics) RecordMiss(ctx context.Context) {
	m.requests.Add(ctx, 1, metric.WithAttributes(
		attribute.String(otelCacheResultAttrKey, otelCacheMissAttrValue),
	))
}

func createDefaultConfig() SdkConfig {
	return SdkConfig{
		MaxEventsInBatch:          10000,
		CrashTimelineDuration:     300,
		ANRTimelineDuration:       300,
		BugReportTimelineDuration: 300,
		TraceSamplingRate:         0.01,
		JourneySamplingRate:       0.01,
		ScreenshotMaskLevel:       ScreenshotMaskLevelAllTextAndMedia,
		CPUUsageInterval:          5,
		MemoryUsageInterval:       5,
		CrashTakeScreenshot:       true,
		ANRTakeScreenshot:         true,
		LaunchSamplingRate:        0.01,
		GestureClickTakeSnapshot:  true,
		HTTPDisableEventForURLs:   []string{},
		HTTPTrackRequestForURLs:   []string{},
		HTTPTrackResponseForURLs:  []string{},
		HTTPBlockedHeaders:        []string{},
	}
}

func configCacheKey(appID uuid.UUID) string {
	return fmt.Sprintf("%s{%s}", configCacheKeyPrefix, appID.String())
}

func computeETag(data []byte) string {
	h := fnv.New64a()
	_, _ = h.Write(data)
	return hex.EncodeToString(h.Sum(nil))
}

func getConfigETag(ctx context.Context, vk valkey.Client, appID uuid.UUID) (string, error) {
	key := configCacheKey(appID)
	cmd := vk.B().Hget().Key(key).Field("etag").Build()
	result := vk.Do(ctx, cmd)

	str, err := result.ToString()
	if err != nil {
		return "", nil
	}
	return str, nil
}

func getConfigData(ctx context.Context, vk valkey.Client, appID uuid.UUID) (string, error) {
	key := configCacheKey(appID)
	cmd := vk.B().Hget().Key(key).Field("data").Build()
	result := vk.Do(ctx, cmd)

	str, err := result.ToString()
	if err != nil {
		return "", nil
	}
	return str, nil
}

func setCacheWithETag(ctx context.Context, vk valkey.Client, appID uuid.UUID, jsonConfig []byte) (string, error) {
	key := configCacheKey(appID)
	etag := computeETag(jsonConfig)

	cmd := vk.B().Hset().Key(key).FieldValue().
		FieldValue("etag", etag).
		FieldValue("data", string(jsonConfig)).
		Build()

	if err := vk.Do(ctx, cmd).Error(); err != nil {
		return "", fmt.Errorf("failed to store config hash: %w", err)
	}

	return etag, nil
}

func getConfigFromDb(ctx context.Context, appID uuid.UUID) (*SdkConfig, error) {
	q := sqlf.PostgreSQL.
		Select("max_events_in_batch").
		Select("crash_timeline_duration").
		Select("anr_timeline_duration").
		Select("bug_report_timeline_duration").
		Select("trace_sampling_rate").
		Select("journey_sampling_rate").
		Select("screenshot_mask_level").
		Select("cpu_usage_interval").
		Select("memory_usage_interval").
		Select("crash_take_screenshot").
		Select("anr_take_screenshot").
		Select("launch_sampling_rate").
		Select("gesture_click_take_snapshot").
		Select("http_disable_event_for_urls").
		Select("http_track_request_for_urls").
		Select("http_track_response_for_urls").
		Select("http_blocked_headers").
		Select("updated_at").
		Select("updated_by").
		From("measure.sdk_config").
		Where("app_id = ?", appID)

	defer q.Close()

	var sdkConfig SdkConfig

	err := server.Server.PgPool.QueryRow(ctx, q.String(), q.Args()...).Scan(
		&sdkConfig.MaxEventsInBatch,
		&sdkConfig.CrashTimelineDuration,
		&sdkConfig.ANRTimelineDuration,
		&sdkConfig.BugReportTimelineDuration,
		&sdkConfig.TraceSamplingRate,
		&sdkConfig.JourneySamplingRate,
		&sdkConfig.ScreenshotMaskLevel,
		&sdkConfig.CPUUsageInterval,
		&sdkConfig.MemoryUsageInterval,
		&sdkConfig.CrashTakeScreenshot,
		&sdkConfig.ANRTakeScreenshot,
		&sdkConfig.LaunchSamplingRate,
		&sdkConfig.GestureClickTakeSnapshot,
		&sdkConfig.HTTPDisableEventForURLs,
		&sdkConfig.HTTPTrackRequestForURLs,
		&sdkConfig.HTTPTrackResponseForURLs,
		&sdkConfig.HTTPBlockedHeaders,
		&sdkConfig.UpdatedAt,
		&sdkConfig.UpdatedBy,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get config: %w", err)
	}

	return &sdkConfig, nil
}

func invalidateCache(ctx context.Context, vk valkey.Client, appID uuid.UUID) error {
	if vk == nil {
		return nil
	}

	cacheKey := configCacheKey(appID)
	cmd := vk.B().Del().Key(cacheKey).Build()
	result := vk.Do(ctx, cmd)

	return result.Error()
}

// GetConfigForSdk retrieves the SDK
// config for the app.
// It uses the redis cache and falls back
// to the database if needed.
func GetConfigForSdk(c *gin.Context) {
	appId, err := uuid.Parse(c.GetString("appId"))
	if err != nil {
		msg := `error parsing app's uuid`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	ctx := c.Request.Context()

	app, err := SelectApp(ctx, appId)
	if app == nil || err != nil {
		msg := `failed to lookup app`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	clientETag := c.GetHeader("If-None-Match")

	cachedETag, err := getConfigETag(ctx, server.Server.VK, appId)
	if err == nil && cachedETag != "" {
		if cachedETag == clientETag {
			fmt.Println("sdk config cache hit (etag match)")
			sdkConfigCache.RecordHitETag(ctx)
			c.Header(cacheControlHeader, cacheControlValue)
			c.Header("ETag", cachedETag)
			c.Status(http.StatusNotModified)
			return
		}

		data, err := getConfigData(ctx, server.Server.VK, appId)
		if err == nil && data != "" {
			fmt.Println("sdk config cache hit")
			sdkConfigCache.RecordHitData(ctx)
			c.Header(cacheControlHeader, cacheControlValue)
			c.Header("ETag", cachedETag)
			c.Data(http.StatusOK, "application/json", []byte(data))
			return
		}
	}

	fmt.Println("sdk config cache miss")
	sdkConfigCache.RecordMiss(ctx)

	sdkConfig, err := getConfigFromDb(ctx, appId)
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

	etag, err := setCacheWithETag(ctx, server.Server.VK, appId, jsonConfig)
	if err != nil {
		fmt.Println("error setting cache with ETag:", err)
	}

	c.Header(cacheControlHeader, cacheControlValue)
	c.Header("ETag", etag)
	c.Data(http.StatusOK, "application/json", jsonConfig)
}
