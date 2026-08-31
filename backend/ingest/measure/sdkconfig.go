package measure

import (
	"backend/ingest/server"
	"backend/libs/sdkconfig"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/valkey-io/valkey-go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

const (
	cacheControlHeader = "Cache-Control"
	cacheControlValue  = "max-age=600"
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

// serveConfigFromDb fetches the SDK config from PostgreSQL,
// populates the Valkey cache if vk is available, & writes
// the JSON response.
func serveConfigFromDb(c *gin.Context, ctx context.Context, appId uuid.UUID, vk valkey.Client) {
	sdkConfig, err := sdkconfig.GetConfigFromDb(ctx, server.Server.PgPool, appId)
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

	var etag string
	if vk != nil {
		etag, err = sdkconfig.SetCacheWithETag(ctx, vk, appId, jsonConfig)
		if err != nil {
			fmt.Println("error setting cache with ETag:", err)
		}
	}

	c.Header(cacheControlHeader, cacheControlValue)
	c.Header("ETag", etag)
	c.Data(http.StatusOK, "application/json", jsonConfig)
}

// GetConfigForSdk retrieves the SDK config for the app.
// It serves from the Valkey cache when available, falling
// back to PostgreSQL on cache miss or when Valkey is
// unavailable.
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
	vk := server.Server.VK

	if vk == nil {
		fmt.Println("valkey client not available, skipping cache")
		serveConfigFromDb(c, ctx, appId, nil)
		return
	}

	cachedETag, err := sdkconfig.GetConfigETag(ctx, vk, appId)
	if err == nil && cachedETag != "" {
		if cachedETag == clientETag {
			fmt.Println("sdk config cache hit (etag match)")
			sdkConfigCache.RecordHitETag(ctx)
			c.Header(cacheControlHeader, cacheControlValue)
			c.Header("ETag", cachedETag)
			c.Status(http.StatusNotModified)
			return
		}

		data, err := sdkconfig.GetConfigData(ctx, vk, appId)
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
	serveConfigFromDb(c, ctx, appId, vk)
}
