package measure

import (
	"backend/api/server"
	"context"
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

	// Fetch all rule types
	eventRules, err := GetSDKEventRules(c, appId)
	if err != nil {
		msg := `error fetching event rules`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	traceRules, err := GetSDKTraceRules(c, appId)
	if err != nil {
		msg := `error fetching trace rules`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	sessionRules, err := GetSDKSessionRules(c, appId)
	if err != nil {
		msg := `error fetching session rules`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	sdkConfig := SDKConfig{
		EventRules:   eventRules,
		TraceRules:   traceRules,
		SessionRules: sessionRules,
	}

	c.Header(cacheControlHeader, cacheControlValue)
	c.JSON(http.StatusOK, sdkConfig)
}
