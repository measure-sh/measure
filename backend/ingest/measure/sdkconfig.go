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

// Cache-Control header sent with every config response.
const (
	cacheControlHeader = "Cache-Control"
	cacheControlValue  = "max-age=600"
)

// OTel metric name & attribute values.
const (
	otelMeterName               = "measure/sdk_config"
	otelCacheRequestsMetricName = "sdkconfig.cache.requests"
	otelCacheResultAttrKey      = "cache.result"
	otelCacheHitETagAttrValue   = "hit_etag"
	otelCacheHitDataAttrValue   = "hit_data"
	otelCacheMissAttrValue      = "miss"
	otelCacheErrorAttrValue     = "error"
)

// cacheMetrics holds the SDK config cache counters.
type cacheMetrics struct {
	requests metric.Int64Counter
}

// sdkConfigCache is the process wide cache metrics recorder.
var sdkConfigCache *cacheMetrics

// init builds the SDK config cache metrics counter.
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

// RecordHitETag records a cache hit where the client's ETag matched.
func (m *cacheMetrics) RecordHitETag(ctx context.Context) {
	m.requests.Add(ctx, 1, metric.WithAttributes(
		attribute.String(otelCacheResultAttrKey, otelCacheHitETagAttrValue),
	))
}

// RecordHitData records a cache hit served from cached data.
func (m *cacheMetrics) RecordHitData(ctx context.Context) {
	m.requests.Add(ctx, 1, metric.WithAttributes(
		attribute.String(otelCacheResultAttrKey, otelCacheHitDataAttrValue),
	))
}

// RecordMiss records a cache miss.
func (m *cacheMetrics) RecordMiss(ctx context.Context) {
	m.requests.Add(ctx, 1, metric.WithAttributes(
		attribute.String(otelCacheResultAttrKey, otelCacheMissAttrValue),
	))
}

// RecordError records a request that could not consult the cache.
func (m *cacheMetrics) RecordError(ctx context.Context) {
	m.requests.Add(ctx, 1, metric.WithAttributes(
		attribute.String(otelCacheResultAttrKey, otelCacheErrorAttrValue),
	))
}

// serveConfigFromDb serves an app's config from Postgres & repopulates the cache.
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

	etag := sdkconfig.ComputeETag(jsonConfig)

	if vk != nil {
		if err := sdkconfig.SetCacheIfAbsent(ctx, vk, appId, jsonConfig); err != nil {
			fmt.Println("error populating config cache:", err)
		}
	}

	c.Header(cacheControlHeader, cacheControlValue)
	c.Header("ETag", etag)
	c.Data(http.StatusOK, "application/json", jsonConfig)
}

// GetConfigForSdk serves the SDK config, from the Valkey cache when warm, else Postgres.
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
		sdkConfigCache.RecordError(ctx)
		serveConfigFromDb(c, ctx, appId, nil)
		return
	}

	data, err := sdkconfig.GetCache(ctx, vk, appId)
	if err != nil {
		fmt.Println("sdk config cache error:", err)
		sdkConfigCache.RecordError(ctx)
		serveConfigFromDb(c, ctx, appId, vk)
		return
	}

	if data == "" {
		fmt.Println("sdk config cache miss")
		sdkConfigCache.RecordMiss(ctx)
		serveConfigFromDb(c, ctx, appId, vk)
		return
	}

	etag := sdkconfig.ComputeETag([]byte(data))
	c.Header(cacheControlHeader, cacheControlValue)
	c.Header("ETag", etag)

	if etag == clientETag {
		fmt.Println("sdk config cache hit (etag match)")
		sdkConfigCache.RecordHitETag(ctx)
		c.Status(http.StatusNotModified)
		return
	}

	fmt.Println("sdk config cache hit")
	sdkConfigCache.RecordHitData(ctx)
	c.Data(http.StatusOK, "application/json", []byte(data))
}
