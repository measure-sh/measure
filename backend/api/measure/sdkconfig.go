package measure

import (
	"backend/api/server"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

const (
	cacheControlHeader = "Cache-Control"
	cacheControlValue  = "max-age=600" // 10 minutes
)

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

// getSDKConfigCacheKey returns the Redis cache key for SDK config
func getSDKConfigCacheKey(appId uuid.UUID) string {
	return fmt.Sprintf("sdk_config:%s", appId.String())
}

// getSDKConfigFromCache attempts to read SDK config from Redis cache
func getSDKConfigFromCache(ctx context.Context, appId uuid.UUID) (*SDKConfig, error) {
	key := getSDKConfigCacheKey(appId)

	data, err := server.Server.Redis.Get(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	var config SDKConfig
	if err := json.Unmarshal([]byte(data), &config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal cached config: %w", err)
	}

	fmt.Println("[SdkConfig]: Accessed SDK config from cache")
	return &config, nil
}

// setSDKConfigToCache stores SDK config in Redis cache
func setSDKConfigToCache(ctx context.Context, appId uuid.UUID, config *SDKConfig) error {
	key := getSDKConfigCacheKey(appId)

	data, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	// Set with no expiration
	if err := server.Server.Redis.Set(ctx, key, data, 0).Err(); err != nil {
		return fmt.Errorf("failed to set cache: %w", err)
	}

	fmt.Println("[SdkConfig]: Setting SDK config to cache")

	return nil
}

// InvalidateSDKConfigCache deletes the cached SDK config for an app
func InvalidateSDKConfigCache(ctx context.Context, appId uuid.UUID) error {
	key := getSDKConfigCacheKey(appId)

	if err := server.Server.Redis.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("failed to delete cache: %w", err)
	}

	fmt.Println("[SdkConfig]: Invalidate SDK config")
	return nil
}

// fetchSDKConfigFromDB fetches SDK config from database
func fetchSDKConfigFromDB(ctx context.Context, appId uuid.UUID) (*SDKConfig, error) {
	// Fetch all rule types
	eventRules, err := GetSDKEventRules(ctx, appId)
	if err != nil {
		return nil, fmt.Errorf("error fetching event rules: %w", err)
	}

	traceRules, err := GetSDKTraceRules(ctx, appId)
	if err != nil {
		return nil, fmt.Errorf("error fetching trace rules: %w", err)
	}

	sessionRules, err := GetSDKSessionRules(ctx, appId)
	if err != nil {
		return nil, fmt.Errorf("error fetching session rules: %w", err)
	}

	fmt.Println("[SdkConfig]: Accessed SDK config from DB")

	return &SDKConfig{
		EventRules:   eventRules,
		TraceRules:   traceRules,
		SessionRules: sessionRules,
	}, nil
}

// GetSDKEventRules queries event targeting rules optimized for SDK
func GetSDKEventRules(ctx context.Context, appId uuid.UUID) ([]SDKEventRule, error) {
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

// GetSDKTraceRules queries trace targeting rules optimized for SDK
func GetSDKTraceRules(ctx context.Context, appId uuid.UUID) ([]SDKTraceRule, error) {
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

// GetSDKSessionRules queries session targeting rules optimized for SDK
func GetSDKSessionRules(ctx context.Context, appId uuid.UUID) ([]SDKSessionRule, error) {
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

	// Check cache
	cachedConfig, err := getSDKConfigFromCache(c.Request.Context(), appId)
	if err == nil && cachedConfig != nil {
		// Cache hit
		c.Header(cacheControlHeader, cacheControlValue)
		c.JSON(http.StatusOK, cachedConfig)
		return
	}

	// Cache miss
	sdkConfig, err := fetchSDKConfigFromDB(c.Request.Context(), appId)
	if err != nil {
		msg := `error fetching SDK config`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	// Update cache
	if err := setSDKConfigToCache(c.Request.Context(), appId, sdkConfig); err != nil {
		fmt.Println("failed to cache SDK config:", err)
	}

	c.Header(cacheControlHeader, cacheControlValue)
	c.JSON(http.StatusOK, sdkConfig)
}
