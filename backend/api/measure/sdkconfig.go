package measure

import (
	"backend/api/server"
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

const (
	cacheControlHeader = "Cache-Control"
	cacheControlValue  = "max-age=600" // 10 minutes
)

type CachedSDKConfig struct {
	Config string `json:"config"`
	ETag   string `json:"etag"`
}

// SDK-specific rule types
type SDKEventRule struct {
	Id                 uuid.UUID `json:"id"`
	Name               string    `json:"name"`
	Condition          string    `json:"condition"`
	CollectionMode     string    `json:"collection_mode"`
	TakeScreenshot     bool      `json:"take_screenshot"`
	TakeLayoutSnapshot bool      `json:"take_layout_snapshot"`
	SamplingRate       float32   `json:"sampling_rate"`
	IsDefaultBehaviour bool      `json:"is_default_behaviour"`
}

type SDKTraceRule struct {
	Id                 uuid.UUID `json:"id"`
	Name               string    `json:"name"`
	Condition          string    `json:"condition"`
	CollectionMode     string    `json:"collection_mode"`
	SamplingRate       float32   `json:"sampling_rate"`
	IsDefaultBehaviour bool      `json:"is_default_behaviour"`
}

type SDKSessionRule struct {
	Id           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	Condition    string    `json:"condition"`
	SamplingRate float32   `json:"sampling_rate"`
}

// SDK config contains session targeting
// rules and will have more configurations
// in future.
type SDKConfig struct {
	EventRules   []SDKEventRule   `json:"event_rules"`
	TraceRules   []SDKTraceRule   `json:"trace_rules"`
	SessionRules []SDKSessionRule `json:"session_rules"`
}

// computeETag returns a hex-encoded
// FNV-1a hash of the given data.
func computeETag(data []byte) string {
	h := fnv.New64a()
	_, _ = h.Write(data)
	return hex.EncodeToString(h.Sum(nil))
}

// getSDKConfigETag retrieves the
// ETag value for the given app
// ID from Valkey.
func getSDKConfigETag(ctx context.Context, appId uuid.UUID) (string, error) {
	key := getSDKConfigCacheKey(appId)
	return server.Server.Valkey.HGet(ctx, key, "etag").Result()
}

// getSDKConfigData retrieves the
// config payload for the given
// app ID from Valkey.
func getSDKConfigData(ctx context.Context, appId uuid.UUID) (string, error) {
	key := getSDKConfigCacheKey(appId)
	return server.Server.Valkey.HGet(ctx, key, "data").Result()
}

// getSDKConfigCacheKey returns the Redis cache key for SDK config
func getSDKConfigCacheKey(appId uuid.UUID) string {
	return fmt.Sprintf("{%s}:sdk_config", appId.String())
}

// setSDKConfigToCache stores config JSON & ETag
func setSDKConfigToCache(ctx context.Context, appId uuid.UUID, jsonConfig []byte) (string, error) {
	key := getSDKConfigCacheKey(appId)

	etag := computeETag(jsonConfig)

	pipe := server.Server.Valkey.TxPipeline()
	pipe.HSet(ctx, key, "etag", etag)
	pipe.HSet(ctx, key, "data", string(jsonConfig))
	_, err := pipe.Exec(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to store config hash: %w", err)
	}

	return etag, nil
}

// InvalidateSDKConfigCache deletes the cached SDK config for an app
func InvalidateSDKConfigCache(ctx context.Context, appId uuid.UUID) error {
	key := getSDKConfigCacheKey(appId)

	if err := server.Server.Valkey.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("failed to delete cache: %w", err)
	}

	return nil
}

// fetchSDKConfigFromDB fetches SDK config from database
func fetchSDKConfigFromDB(ctx context.Context, appId uuid.UUID) (*SDKConfig, error) {
	eventRules, err := getSDKEventRules(ctx, appId)
	if err != nil {
		return nil, fmt.Errorf("error fetching event rules: %w", err)
	}

	traceRules, err := getSDKTraceRules(ctx, appId)
	if err != nil {
		return nil, fmt.Errorf("error fetching trace rules: %w", err)
	}

	sessionRules, err := getSDKSessionRules(ctx, appId)
	if err != nil {
		return nil, fmt.Errorf("error fetching session rules: %w", err)
	}

	return &SDKConfig{
		EventRules:   eventRules,
		TraceRules:   traceRules,
		SessionRules: sessionRules,
	}, nil
}

// getSDKEventRules queries event targeting rules optimized for SDK
func getSDKEventRules(ctx context.Context, appId uuid.UUID) ([]SDKEventRule, error) {
	stmt := sqlf.PostgreSQL.From("event_targeting_rules").
		Select("id").
		Select("name").
		Select("condition").
		Select("collection_mode").
		Select("take_screenshot").
		Select("take_layout_snapshot").
		Select("sampling_rate").
		Select("is_default_behaviour").
		Where("app_id = ?", appId)

	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []SDKEventRule
	for rows.Next() {
		var rule SDKEventRule
		if err := rows.Scan(
			&rule.Id,
			&rule.Name,
			&rule.Condition,
			&rule.CollectionMode,
			&rule.TakeScreenshot,
			&rule.TakeLayoutSnapshot,
			&rule.SamplingRate,
			&rule.IsDefaultBehaviour,
		); err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}

	return rules, rows.Err()
}

// getSDKTraceRules queries trace targeting rules optimized for SDK
func getSDKTraceRules(ctx context.Context, appId uuid.UUID) ([]SDKTraceRule, error) {
	stmt := sqlf.PostgreSQL.From("trace_targeting_rules").
		Select("id").
		Select("name").
		Select("condition").
		Select("collection_mode").
		Select("sampling_rate").
		Select("is_default_behaviour").
		Where("app_id = ?", appId)

	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []SDKTraceRule
	for rows.Next() {
		var rule SDKTraceRule
		if err := rows.Scan(
			&rule.Id,
			&rule.Name,
			&rule.Condition,
			&rule.CollectionMode,
			&rule.SamplingRate,
			&rule.IsDefaultBehaviour,
		); err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}

	return rules, rows.Err()
}

// getSDKSessionRules queries session targeting rules optimized for SDK
func getSDKSessionRules(ctx context.Context, appId uuid.UUID) ([]SDKSessionRule, error) {
	stmt := sqlf.PostgreSQL.From("session_targeting_rules").
		Select("id").
		Select("name").
		Select("condition").
		Select("sampling_rate").
		Where("app_id = ?", appId)

	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []SDKSessionRule
	for rows.Next() {
		var rule SDKSessionRule
		if err := rows.Scan(
			&rule.Id,
			&rule.Name,
			&rule.Condition,
			&rule.SamplingRate,
		); err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}

	return rules, rows.Err()
}

// GetConfig returns the SDK config
// for session targeting
func GetConfig(c *gin.Context) {
	appId, err := uuid.Parse(c.GetString("appId"))
	if err != nil {
		msg := `error parsing app's uuid`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	clientETag := c.GetHeader("If-None-Match")

	cachedETag, err := getSDKConfigETag(c.Request.Context(), appId)
	if err == nil && cachedETag != "" {
		// Same ETag
		if cachedETag == clientETag {
			c.Header(cacheControlHeader, cacheControlValue)
			c.Header("ETag", cachedETag)
			c.Status(http.StatusNotModified)
			return
		}

		// Different ETag
		data, err := getSDKConfigData(c.Request.Context(), appId)
		if err == nil && data != "" {
			c.Header(cacheControlHeader, cacheControlValue)
			c.Header("ETag", cachedETag)
			c.Data(http.StatusOK, "application/json", []byte(data))
			return
		}
	}

	// Cache miss
	sdkConfig, err := fetchSDKConfigFromDB(c.Request.Context(), appId)
	if err != nil {
		msg := `error fetching SDK config`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	jsonConfig, _ := json.Marshal(sdkConfig)
	etag, _ := setSDKConfigToCache(c.Request.Context(), appId, jsonConfig)

	c.Header(cacheControlHeader, cacheControlValue)
	c.Header("ETag", etag)
	c.Data(http.StatusOK, "application/json", jsonConfig)
}
