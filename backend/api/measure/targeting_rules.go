package measure

import (
	"backend/api/filter"
	"backend/api/opsys"
	"backend/api/server"
	"backend/api/span"
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

// Represents a event targting rule.
type EventTargetingRule struct {
	Id                 uuid.UUID  `json:"id"`
	TeamId             uuid.UUID  `json:"team_id"`
	AppId              uuid.UUID  `json:"app_id"`
	Name               string     `json:"name"`
	Condition          string     `json:"condition"`
	CollectionMode     string     `json:"collection_mode"`
	TakeScreenshot     bool       `json:"take_screenshot"`
	TakeLayoutSnapshot bool       `json:"take_layout_snapshot"`
	SamplingRate       float32    `json:"sampling_rate"`
	IsDefaultBehaviour bool       `json:"is_default_behaviour"`
	CreatedAt          time.Time  `json:"created_at"`
	CreatedBy          uuid.UUID  `json:"-"`
	CreatedByEmail     string     `json:"created_by"`
	UpdatedAt          *time.Time `json:"updated_at"`
	UpdatedBy          uuid.UUID  `json:"-"`
	UpdatedByEmail     string     `json:"updated_by"`
	AutoCreated        bool       `json:"auto_created"`
}

// Represents a trace targting rule.
type TraceTargetingRule struct {
	Id                 uuid.UUID  `json:"id"`
	TeamId             uuid.UUID  `json:"team_id"`
	AppId              uuid.UUID  `json:"app_id"`
	Name               string     `json:"name"`
	Condition          string     `json:"condition"`
	CollectionMode     string     `json:"collection_mode"`
	SamplingRate       float32    `json:"sampling_rate"`
	IsDefaultBehaviour bool       `json:"is_default_behaviour"`
	CreatedAt          time.Time  `json:"created_at"`
	CreatedBy          uuid.UUID  `json:"-"`
	CreatedByEmail     string     `json:"created_by"`
	UpdatedAt          *time.Time `json:"updated_at"`
	UpdatedBy          uuid.UUID  `json:"-"`
	UpdatedByEmail     string     `json:"updated_by"`
	AutoCreated        bool       `json:"auto_created"`
}

// Represents a session targting rule.
type SessionTargetingRule struct {
	Id             uuid.UUID  `json:"id"`
	TeamId         uuid.UUID  `json:"team_id"`
	AppId          uuid.UUID  `json:"app_id"`
	Name           string     `json:"name"`
	SamplingRate   float32    `json:"sampling_rate"`
	Condition      string     `json:"condition"`
	CreatedAt      time.Time  `json:"created_at"`
	CreatedBy      uuid.UUID  `json:"-"`
	CreatedByEmail string     `json:"created_by"`
	UpdatedAt      *time.Time `json:"updated_at"`
	UpdatedBy      uuid.UUID  `json:"-"`
	UpdatedByEmail string     `json:"updated_by"`
	AutoCreated    bool       `json:"auto_created"`
}

type EventTargetingRulesResponse struct {
	Rules       []EventTargetingRule `json:"rules"`
	DefaultRule EventTargetingRule   `json:"default_rule"`
}

type TraceTargetingRulesResponse struct {
	Rules       []TraceTargetingRule `json:"rules"`
	DefaultRule TraceTargetingRule   `json:"default_rule"`
}

// EventConfig part of the
// targeting dashboard config.
type EventConfig struct {
	Type       string       `json:"type"`
	Attrs      []AttrConfig `json:"attrs"`
	HasUdAttrs bool         `json:"has_ud_attrs"`
}

// TraceConfig part of the
// targeting dashboard config.
type TraceConfig struct {
	Name       string       `json:"name"`
	Attrs      []AttrConfig `json:"attrs"`
	HasUdAttrs bool         `json:"has_ud_attrs"`
}

// AttrConfig part of the session
// targeting dashboard config.
type AttrConfig struct {
	Key         string    `json:"key"`
	Type        string    `json:"type"`
	Hint        string    `json:"hint"`
	Suggestions *[]string `json:"suggestions"`
}

// OperatorTypes part of the session
// targeting dashboard config.
type OperatorTypes struct {
	Bool    []string `json:"bool"`
	Float64 []string `json:"float64"`
	Int64   []string `json:"int64"`
	String  []string `json:"string"`
}

// Event targeting config used
// by the dashboard.
type EventTargetingConfig struct {
	Events        []EventConfig `json:"events"`
	SessionAttrs  []AttrConfig  `json:"session_attrs"`
	EventUdAttrs  []AttrConfig  `json:"event_ud_attrs"`
	OperatorTypes OperatorTypes `json:"operator_types"`
}

// Trace targeting config used
// by the dashboard.
type TraceTargetingConfig struct {
	Traces            []TraceConfig `json:"traces"`
	SessionAttrs      []AttrConfig  `json:"session_attrs"`
	TraceUDAttributes []AttrConfig  `json:"trace_ud_attrs"`
	OperatorTypes     OperatorTypes `json:"operator_types"`
}

// Session targeting config used
// by the dashboard.
type SessionTargetingConfig struct {
	Events            []EventConfig `json:"events"`
	Traces            []TraceConfig `json:"traces"`
	EventUdAttrs      []AttrConfig  `json:"event_ud_attrs"`
	TraceUDAttributes []AttrConfig  `json:"trace_ud_attrs"`
	SessionAttrs      []AttrConfig  `json:"session_attrs"`
	OperatorTypes     OperatorTypes `json:"operator_types"`
}

type EventTargetingRulePayload struct {
	Name               string  `json:"name"`
	Condition          string  `json:"condition"`
	CollectionMode     string  `json:"collection_mode"`
	TakeScreenshot     bool    `json:"take_screenshot"`
	TakeLayoutSnapshot bool    `json:"take_layout_snapshot"`
	SamplingRate       float32 `json:"sampling_rate"`
	IsDefaultBehaviour bool    `json:"is_default_behaviour"`
}

type TraceTargetingRulePayload struct {
	Name               string  `json:"name"`
	Condition          string  `json:"condition"`
	CollectionMode     string  `json:"collection_mode"`
	SamplingRate       float32 `json:"sampling_rate"`
	IsDefaultBehaviour bool    `json:"is_default_behaviour"`
}

type SessionTargetingRulePayload struct {
	Name         string  `json:"name"`
	Condition    string  `json:"condition"`
	SamplingRate float32 `json:"sampling_rate"`
}

// GetEventTargetingRules provides all
// event targeting rules.
func GetEventTargetingRulesWithFilter(ctx context.Context, af *filter.AppFilter) (response EventTargetingRulesResponse, err error) {
	stmt := sqlf.PostgreSQL.From("event_targeting_rules").
		Select("id").
		Select("team_id").
		Select("app_id").
		Select("name").
		Select("condition").
		Select("collection_mode").
		Select("take_screenshot").
		Select("take_layout_snapshot").
		Select("sampling_rate").
		Select("is_default_behaviour").
		Select("created_at").
		Select("created_by").
		Select("updated_at").
		Select("updated_by").
		Select("auto_created").
		Where("app_id = ?", af.AppID)

	stmt.OrderBy("COALESCE(updated_at, created_at) DESC")

	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return response, err
	}
	defer rows.Close()

	var allRules []EventTargetingRule
	for rows.Next() {
		var rule EventTargetingRule
		if err := rows.Scan(
			&rule.Id,
			&rule.TeamId,
			&rule.AppId,
			&rule.Name,
			&rule.Condition,
			&rule.CollectionMode,
			&rule.TakeScreenshot,
			&rule.TakeLayoutSnapshot,
			&rule.SamplingRate,
			&rule.IsDefaultBehaviour,
			&rule.CreatedAt,
			&rule.CreatedBy,
			&rule.UpdatedAt,
			&rule.UpdatedBy,
			&rule.AutoCreated,
		); err != nil {
			return response, err
		}
		allRules = append(allRules, rule)
	}

	// Populate user emails for all rules
	if err := populateUserEmailsForEventRules(ctx, allRules); err != nil {
		return response, err
	}

	// Separate default rule from override rules
	var rules []EventTargetingRule
	var defaultRule EventTargetingRule
	for _, rule := range allRules {
		if rule.IsDefaultBehaviour {
			defaultRule = rule
		} else {
			rules = append(rules, rule)
		}
	}

	response.Rules = rules
	response.DefaultRule = defaultRule

	return response, nil
}

// GetTraceTargetingRulesWithFilter provides all
// trace targeting rules.
func GetTraceTargetingRulesWithFilter(ctx context.Context, af *filter.AppFilter) (response TraceTargetingRulesResponse, err error) {
	stmt := sqlf.PostgreSQL.From("trace_targeting_rules").
		Select("id").
		Select("team_id").
		Select("app_id").
		Select("name").
		Select("condition").
		Select("collection_mode").
		Select("sampling_rate").
		Select("is_default_behaviour").
		Select("created_at").
		Select("created_by").
		Select("updated_at").
		Select("updated_by").
		Select("auto_created").
		Where("app_id = ?", af.AppID)

	stmt.OrderBy("COALESCE(updated_at, created_at) DESC")

	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return response, err
	}
	defer rows.Close()

	var allRules []TraceTargetingRule
	for rows.Next() {
		var rule TraceTargetingRule
		if err := rows.Scan(
			&rule.Id,
			&rule.TeamId,
			&rule.AppId,
			&rule.Name,
			&rule.Condition,
			&rule.CollectionMode,
			&rule.SamplingRate,
			&rule.IsDefaultBehaviour,
			&rule.CreatedAt,
			&rule.CreatedBy,
			&rule.UpdatedAt,
			&rule.UpdatedBy,
			&rule.AutoCreated,
		); err != nil {
			return response, err
		}
		allRules = append(allRules, rule)
	}

	// Populate user emails for all rules
	if err := populateUserEmailsForTraceRules(ctx, allRules); err != nil {
		return response, err
	}

	// Separate default rule from override rules
	var rules []TraceTargetingRule
	var defaultRule TraceTargetingRule
	for _, rule := range allRules {
		if rule.IsDefaultBehaviour {
			defaultRule = rule
		} else {
			rules = append(rules, rule)
		}
	}

	response.Rules = rules
	response.DefaultRule = defaultRule

	return response, nil
}

// GetSessionTargetingRulesWithFilter provides all
// session targeting rules.
func GetSessionTargetingRulesWithFilter(ctx context.Context, af *filter.AppFilter) (rules []SessionTargetingRule, err error) {
	stmt := sqlf.PostgreSQL.From("session_targeting_rules").
		Select("id").
		Select("team_id").
		Select("app_id").
		Select("name").
		Select("sampling_rate").
		Select("condition").
		Select("created_at").
		Select("created_by").
		Select("updated_at").
		Select("updated_by").
		Select("auto_created").
		Where("app_id = ?", af.AppID)

	stmt.OrderBy("COALESCE(updated_at, created_at) DESC")

	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var rule SessionTargetingRule
		if err := rows.Scan(
			&rule.Id,
			&rule.TeamId,
			&rule.AppId,
			&rule.Name,
			&rule.SamplingRate,
			&rule.Condition,
			&rule.CreatedAt,
			&rule.CreatedBy,
			&rule.UpdatedAt,
			&rule.UpdatedBy,
			&rule.AutoCreated,
		); err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}

	// Populate user emails for all rules
	if err := populateUserEmailsForSessionRules(ctx, rules); err != nil {
		return nil, err
	}

	return rules, nil
}

// GetEventTargetingRuleWithFilter queries a single
// event targeting rule by its id.
func GetEventTargetingRuleById(ctx context.Context, appId *uuid.UUID, ruleId string) (rule *EventTargetingRule, err error) {
	ruleUUID, err := uuid.Parse(ruleId)
	if err != nil {
		return nil, fmt.Errorf("invalid ruleId UUID: %w", err)
	}

	stmt := sqlf.PostgreSQL.From("event_targeting_rules").
		Select("id").
		Select("team_id").
		Select("app_id").
		Select("name").
		Select("condition").
		Select("collection_mode").
		Select("take_screenshot").
		Select("take_layout_snapshot").
		Select("sampling_rate").
		Select("is_default_behaviour").
		Select("created_at").
		Select("created_by").
		Select("updated_at").
		Select("updated_by").
		Select("auto_created").
		Where("app_id = ?", appId).
		Where("id = ?", ruleUUID)

	defer stmt.Close()

	row := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...)

	var r EventTargetingRule
	if err := row.Scan(
		&r.Id,
		&r.TeamId,
		&r.AppId,
		&r.Name,
		&r.Condition,
		&r.CollectionMode,
		&r.TakeScreenshot,
		&r.TakeLayoutSnapshot,
		&r.SamplingRate,
		&r.IsDefaultBehaviour,
		&r.CreatedAt,
		&r.CreatedBy,
		&r.UpdatedAt,
		&r.UpdatedBy,
		&r.AutoCreated,
	); err != nil {
		return nil, err
	}

	// Populate user emails
	rules := []EventTargetingRule{r}
	if err := populateUserEmailsForEventRules(ctx, rules); err != nil {
		return nil, err
	}

	return &rules[0], nil
}

// GetTraceTargetingRuleById queries a single
// trace targeting rule by its id.
func GetTraceTargetingRuleById(ctx context.Context, appId *uuid.UUID, ruleId string) (rule *TraceTargetingRule, err error) {
	ruleUUID, err := uuid.Parse(ruleId)
	if err != nil {
		return nil, fmt.Errorf("invalid ruleId UUID: %w", err)
	}

	stmt := sqlf.PostgreSQL.From("trace_targeting_rules").
		Select("id").
		Select("team_id").
		Select("app_id").
		Select("name").
		Select("condition").
		Select("collection_mode").
		Select("sampling_rate").
		Select("is_default_behaviour").
		Select("created_at").
		Select("created_by").
		Select("updated_at").
		Select("updated_by").
		Select("auto_created").
		Where("app_id = ?", appId).
		Where("id = ?", ruleUUID)

	defer stmt.Close()

	row := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...)

	var r TraceTargetingRule
	if err := row.Scan(
		&r.Id,
		&r.TeamId,
		&r.AppId,
		&r.Name,
		&r.Condition,
		&r.CollectionMode,
		&r.SamplingRate,
		&r.IsDefaultBehaviour,
		&r.CreatedAt,
		&r.CreatedBy,
		&r.UpdatedAt,
		&r.UpdatedBy,
		&r.AutoCreated,
	); err != nil {
		return nil, err
	}

	// Populate user emails
	rules := []TraceTargetingRule{r}
	if err := populateUserEmailsForTraceRules(ctx, rules); err != nil {
		return nil, err
	}

	return &rules[0], nil
}

// GetSessionTargetingRuleById queries a single
// trace targeting rule by its id.
func GetSessionTargetingRuleById(ctx context.Context, appId *uuid.UUID, ruleId string) (rule *SessionTargetingRule, err error) {
	ruleUUID, err := uuid.Parse(ruleId)
	if err != nil {
		return nil, fmt.Errorf("invalid ruleId UUID: %w", err)
	}

	stmt := sqlf.PostgreSQL.From("session_targeting_rules").
		Select("id").
		Select("team_id").
		Select("app_id").
		Select("name").
		Select("condition").
		Select("sampling_rate").
		Select("created_at").
		Select("created_by").
		Select("updated_at").
		Select("updated_by").
		Select("auto_created").
		Where("app_id = ?", appId).
		Where("id = ?", ruleUUID)

	defer stmt.Close()

	row := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...)

	var r SessionTargetingRule
	if err := row.Scan(
		&r.Id,
		&r.TeamId,
		&r.AppId,
		&r.Name,
		&r.Condition,
		&r.SamplingRate,
		&r.CreatedAt,
		&r.CreatedBy,
		&r.UpdatedAt,
		&r.UpdatedBy,
		&r.AutoCreated,
	); err != nil {
		return nil, err
	}

	// Populate user emails
	rules := []SessionTargetingRule{r}
	if err := populateUserEmailsForSessionRules(ctx, rules); err != nil {
		return nil, err
	}

	return &rules[0], nil
}

// GetEventTargetingConfig creates and returns
// the config required to render event
// targeting rule creation page.
func GetEventTargetingConfig(ctx context.Context, af *filter.AppFilter) (EventTargetingConfig, error) {
	eventUdAttrs, err := getEventUDAttrKeys(ctx, af.AppID)
	if err != nil {
		return EventTargetingConfig{}, err
	}

	// Fetch filter values
	var filterList filter.FilterList
	if err := af.GetGenericFilters(ctx, &filterList); err != nil {
		return EventTargetingConfig{}, err
	}

	sessionAttrs := newSessionConfig(af.AppOSName)
	populateSessionConfigValues(sessionAttrs, &filterList)

	return EventTargetingConfig{
		Events:        newEventsConfig(af.AppOSName),
		SessionAttrs:  sessionAttrs,
		EventUdAttrs:  eventUdAttrs,
		OperatorTypes: newOperatorTypes(),
	}, nil
}

// GetTraceTargetingConfig creates and returns
// the config required to render trace
// targeting rule creation page.
func GetTraceTargetingConfig(ctx context.Context, af *filter.AppFilter) (TraceTargetingConfig, error) {
	traceUdAttrs, err := getTraceUDAttrKeys(ctx, af.AppID)
	if err != nil {
		return TraceTargetingConfig{}, err
	}

	traces, err := span.FetchRootSpanNames(ctx, af.AppID)
	if err != nil {
		return TraceTargetingConfig{}, err
	}

	// Fetch filter values
	var filterList filter.FilterList
	if err := af.GetGenericFilters(ctx, &filterList); err != nil {
		return TraceTargetingConfig{}, err
	}

	sessionAttrs := newSessionConfig(af.AppOSName)
	populateSessionConfigValues(sessionAttrs, &filterList)

	traceConfigs := make([]TraceConfig, 0, len(traces))
	for _, traceName := range traces {
		traceConfigs = append(traceConfigs, TraceConfig{
			Name:       traceName,
			Attrs:      []AttrConfig{},
			HasUdAttrs: true,
		})
	}
	return TraceTargetingConfig{
		Traces:            traceConfigs,
		SessionAttrs:      sessionAttrs,
		TraceUDAttributes: traceUdAttrs,
		OperatorTypes:     newOperatorTypes(),
	}, nil
}

// GetSessionTargetingConfig creates and returns
// the config required to render session
// targeting rule creation page.
func GetSessionTargetingConfig(ctx context.Context, af *filter.AppFilter) (SessionTargetingConfig, error) {
	eventUdAttrs, err := getEventUDAttrKeys(ctx, af.AppID)
	if err != nil {
		return SessionTargetingConfig{}, err
	}
	traceUdAttrs, err := getTraceUDAttrKeys(ctx, af.AppID)
	if err != nil {
		return SessionTargetingConfig{}, err
	}
	traces, err := span.FetchRootSpanNames(ctx, af.AppID)
	if err != nil {
		return SessionTargetingConfig{}, err
	}

	// Fetch filter values
	var filterList filter.FilterList
	if err := af.GetGenericFilters(ctx, &filterList); err != nil {
		return SessionTargetingConfig{}, err
	}

	sessionAttrs := newSessionConfig(af.AppOSName)
	populateSessionConfigValues(sessionAttrs, &filterList)

	traceConfigs := make([]TraceConfig, 0, len(traces))
	for _, traceName := range traces {
		traceConfigs = append(traceConfigs, TraceConfig{
			Name:       traceName,
			Attrs:      []AttrConfig{},
			HasUdAttrs: true,
		})
	}
	return SessionTargetingConfig{
		Events:            newEventsConfig(af.AppOSName),
		Traces:            traceConfigs,
		EventUdAttrs:      eventUdAttrs,
		TraceUDAttributes: traceUdAttrs,
		SessionAttrs:      sessionAttrs,
		OperatorTypes:     newOperatorTypes(),
	}, nil
}

func CreateEventTargetingRuleForApp(ctx context.Context, appId uuid.UUID, teamId uuid.UUID, payload EventTargetingRulePayload, createdBy string) (ruleId uuid.UUID, err error) {
	now := time.Now()
	createdByUUID, err := uuid.Parse(createdBy)
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid createdBy UUID: %w", err)
	}

	ruleId = uuid.New()

	if (appId == uuid.Nil) || (teamId == uuid.Nil) {
		return uuid.Nil, fmt.Errorf("appId and teamId cannot be nil")
	}

	if createdByUUID == uuid.Nil {
		return uuid.Nil, fmt.Errorf("createdBy UUID cannot be nil")
	}

	if payload.Condition == "" {
		return uuid.Nil, fmt.Errorf("condition cannot be empty")
	}

	if payload.CollectionMode != "timeline" && payload.CollectionMode != "disabled" && payload.CollectionMode != "sampled" {
		return uuid.Nil, fmt.Errorf("invalid collection mode: %s", payload.CollectionMode)
	}

	if payload.CollectionMode == "sampled" {
		if payload.SamplingRate < 0 || payload.SamplingRate > 100 {
			return uuid.Nil, fmt.Errorf("sampling rate must be between 0 and 100")
		}
	}

	if payload.TakeScreenshot && payload.TakeLayoutSnapshot {
		return uuid.Nil, fmt.Errorf("only one of take_screenshot and take_layout_snapshot can be true")
	}

	if payload.IsDefaultBehaviour {
		if payload.TakeScreenshot {
			return uuid.Nil, fmt.Errorf("take_screenshot must be false for default rule")
		}

		if payload.TakeLayoutSnapshot {
			return uuid.Nil, fmt.Errorf("take_layout_snapshot must be false for default rule")
		}
	}

	stmt := sqlf.PostgreSQL.InsertInto("event_targeting_rules").
		Set("id", ruleId).
		Set("team_id", teamId).
		Set("app_id", appId).
		Set("name", payload.Name).
		Set("condition", payload.Condition).
		Set("collection_mode", payload.CollectionMode).
		Set("take_screenshot", payload.TakeScreenshot).
		Set("take_layout_snapshot", payload.TakeLayoutSnapshot).
		Set("sampling_rate", payload.SamplingRate).
		Set("created_at", now).
		Set("created_by", createdByUUID).
		Set("auto_created", false)
	defer stmt.Close()

	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return uuid.Nil, err
	}

	if err := InvalidateSDKConfigCache(ctx, appId); err != nil {
		fmt.Println("failed to invalidate SDK config cache:", err)
	}

	return ruleId, nil
}

func UpdateEventTargetingRuleForApp(ctx context.Context, appId uuid.UUID, ruleId string, payload EventTargetingRulePayload, updatedBy string) error {
	if appId == uuid.Nil {
		return fmt.Errorf("appId cannot be nil")
	}

	updatedByUUID, err := uuid.Parse(updatedBy)
	if err != nil {
		return fmt.Errorf("invalid updatedBy UUID: %w", err)
	}

	ruleUUID, err := uuid.Parse(ruleId)
	if err != nil {
		return fmt.Errorf("invalid ruleId UUID: %w", err)
	}

	stmt := sqlf.PostgreSQL.Update("event_targeting_rules").
		Set("name", payload.Name).
		Set("condition", payload.Condition).
		Set("collection_mode", payload.CollectionMode).
		Set("take_screenshot", payload.TakeScreenshot).
		Set("take_layout_snapshot", payload.TakeLayoutSnapshot).
		Set("sampling_rate", payload.SamplingRate).
		Set("updated_at", time.Now()).
		Set("updated_by", updatedByUUID).
		Where("app_id = ?", appId).
		Where("id = ?", ruleUUID)

	defer stmt.Close()

	result, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("event targeting rule not found")
	}

	if err := InvalidateSDKConfigCache(ctx, appId); err != nil {
		fmt.Println("failed to invalidate SDK config cache:", err)
	}

	return nil
}

func CreateTraceTargetingRuleForApp(ctx context.Context, appId uuid.UUID, teamId uuid.UUID, payload TraceTargetingRulePayload, createdBy string) (ruleId uuid.UUID, err error) {
	now := time.Now()
	createdByUUID, err := uuid.Parse(createdBy)
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid createdBy UUID: %w", err)
	}

	ruleId = uuid.New()

	if (appId == uuid.Nil) || (teamId == uuid.Nil) {
		return uuid.Nil, fmt.Errorf("appId and teamId cannot be nil")
	}

	if createdByUUID == uuid.Nil {
		return uuid.Nil, fmt.Errorf("createdBy UUID cannot be nil")
	}

	if payload.Condition == "" {
		return uuid.Nil, fmt.Errorf("condition cannot be empty")
	}

	if payload.CollectionMode != "timeline" && payload.CollectionMode != "disabled" && payload.CollectionMode != "sampled" {
		return uuid.Nil, fmt.Errorf("invalid collection mode: %s", payload.CollectionMode)
	}

	if payload.CollectionMode == "sampled" {
		if payload.SamplingRate < 0 || payload.SamplingRate > 100 {
			return uuid.Nil, fmt.Errorf("sampling rate must be between 0 and 100")
		}
	}

	stmt := sqlf.PostgreSQL.InsertInto("trace_targeting_rules").
		Set("id", ruleId).
		Set("team_id", teamId).
		Set("app_id", appId).
		Set("name", payload.Name).
		Set("condition", payload.Condition).
		Set("collection_mode", payload.CollectionMode).
		Set("sampling_rate", payload.SamplingRate).
		Set("created_at", now).
		Set("created_by", createdByUUID).
		Set("auto_created", false)
	defer stmt.Close()
	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return uuid.Nil, err
	}

	if err := InvalidateSDKConfigCache(ctx, appId); err != nil {
		fmt.Println("failed to invalidate SDK config cache:", err)
	}

	return ruleId, nil
}

func UpdateTraceTargetingRuleForApp(ctx context.Context, appId uuid.UUID, ruleId string, payload TraceTargetingRulePayload, updatedBy string) error {
	if appId == uuid.Nil {
		return fmt.Errorf("appId cannot be nil")
	}

	updatedByUUID, err := uuid.Parse(updatedBy)
	if err != nil {
		return fmt.Errorf("invalid updatedBy UUID: %w", err)
	}

	ruleUUID, err := uuid.Parse(ruleId)
	if err != nil {
		return fmt.Errorf("invalid ruleId UUID: %w", err)
	}

	stmt := sqlf.PostgreSQL.Update("trace_targeting_rules").
		Set("name", payload.Name).
		Set("condition", payload.Condition).
		Set("collection_mode", payload.CollectionMode).
		Set("sampling_rate", payload.SamplingRate).
		Set("updated_at", time.Now()).
		Set("updated_by", updatedByUUID).
		Where("app_id = ?", appId).
		Where("id = ?", ruleUUID)

	defer stmt.Close()

	result, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("trace targeting rule not found")
	}

	if err := InvalidateSDKConfigCache(ctx, appId); err != nil {
		fmt.Println("failed to invalidate SDK config cache:", err)
	}

	return nil
}

func CreateSessionTargetingRuleForApp(ctx context.Context, appId uuid.UUID, teamId uuid.UUID, payload SessionTargetingRulePayload, createdBy string) (ruleId uuid.UUID, err error) {
	now := time.Now()
	createdByUUID, err := uuid.Parse(createdBy)
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid createdBy UUID: %w", err)
	}

	ruleId = uuid.New()

	if (appId == uuid.Nil) || (teamId == uuid.Nil) {
		return uuid.Nil, fmt.Errorf("appId and teamId cannot be nil")
	}

	if createdByUUID == uuid.Nil {
		return uuid.Nil, fmt.Errorf("createdBy UUID cannot be nil")
	}

	if payload.Condition == "" {
		return uuid.Nil, fmt.Errorf("condition cannot be empty")
	}

	stmt := sqlf.PostgreSQL.InsertInto("session_targeting_rules").
		Set("id", ruleId).
		Set("team_id", teamId).
		Set("app_id", appId).
		Set("name", payload.Name).
		Set("condition", payload.Condition).
		Set("sampling_rate", payload.SamplingRate).
		Set("created_at", now).
		Set("created_by", createdByUUID).
		Set("auto_created", false)
	defer stmt.Close()
	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return uuid.Nil, err
	}

	if err := InvalidateSDKConfigCache(ctx, appId); err != nil {
		fmt.Println("failed to invalidate SDK config cache:", err)
	}

	return ruleId, nil
}

func UpdateSessionTargetingRuleForApp(ctx context.Context, appId uuid.UUID, ruleId string, payload SessionTargetingRulePayload, updatedBy string) error {
	updatedByUUID, err := uuid.Parse(updatedBy)
	if err != nil {
		return fmt.Errorf("invalid updatedBy UUID: %w", err)
	}

	ruleUUID, err := uuid.Parse(ruleId)
	if err != nil {
		return fmt.Errorf("invalid ruleId UUID: %w", err)
	}

	stmt := sqlf.PostgreSQL.Update("session_targeting_rules").
		Set("name", payload.Name).
		Set("condition", payload.Condition).
		Set("sampling_rate", payload.SamplingRate).
		Set("updated_at", time.Now()).
		Set("updated_by", updatedByUUID).
		Where("app_id = ?", appId).
		Where("id = ?", ruleUUID)

	defer stmt.Close()

	result, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("session targeting rule not found")
	}

	if err := InvalidateSDKConfigCache(ctx, appId); err != nil {
		fmt.Println("failed to invalidate SDK config cache:", err)
	}

	return nil
}

func DeleteEventTargetingRuleForApp(ctx context.Context, appId uuid.UUID, ruleId string) error {
	ruleUUID, err := uuid.Parse(ruleId)
	if err != nil {
		return fmt.Errorf("invalid ruleId UUID: %w", err)
	}

	stmt := sqlf.PostgreSQL.DeleteFrom("event_targeting_rules").
		Where("app_id = ?", appId).
		Where("id = ?", ruleUUID)
	defer stmt.Close()
	result, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("event targeting rule not found")
	}

	if err := InvalidateSDKConfigCache(ctx, appId); err != nil {
		fmt.Println("failed to invalidate SDK config cache:", err)
	}

	return nil
}

func DeleteTraceTargetingRuleForApp(ctx context.Context, appId uuid.UUID, ruleId string) error {
	ruleUUID, err := uuid.Parse(ruleId)
	if err != nil {
		return fmt.Errorf("invalid ruleId UUID: %w", err)
	}

	stmt := sqlf.PostgreSQL.DeleteFrom("trace_targeting_rules").
		Where("app_id = ?", appId).
		Where("id = ?", ruleUUID)
	defer stmt.Close()
	result, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("trace targeting rule not found")
	}

	if err := InvalidateSDKConfigCache(ctx, appId); err != nil {
		fmt.Println("failed to invalidate SDK config cache:", err)
	}

	return nil
}

func DeleteSessionTargetingRuleForApp(ctx context.Context, appId uuid.UUID, ruleId string) error {
	ruleUUID, err := uuid.Parse(ruleId)
	if err != nil {
		return fmt.Errorf("invalid ruleId UUID: %w", err)
	}

	stmt := sqlf.PostgreSQL.DeleteFrom("session_targeting_rules").
		Where("app_id = ?", appId).
		Where("id = ?", ruleUUID)
	defer stmt.Close()
	result, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("session targeting rule not found")
	}

	if err := InvalidateSDKConfigCache(ctx, appId); err != nil {
		fmt.Println("failed to invalidate SDK config cache:", err)
	}

	return nil
}

func CreateDefaultTargetingRules(ctx context.Context, tx pgx.Tx, teamId string, appId string, createdBy string) error {
	teamUUID, err := uuid.Parse(teamId)
	if err != nil {
		return fmt.Errorf("invalid teamId")
	}

	appUUID, err := uuid.Parse(appId)
	if err != nil {
		return fmt.Errorf("invalid appId")
	}

	createdByUUID, err := uuid.Parse(createdBy)
	if err != nil {
		return fmt.Errorf("invalid createdBy UUID: %w", err)
	}

	now := time.Now()

	// Insert all event targeting rules in one query
	eventRules := []EventTargetingRulePayload{
		{
			Name:               "Collect all events",
			Condition:          "event_type == \"*\"",
			CollectionMode:     "timeline",
			TakeScreenshot:     false,
			TakeLayoutSnapshot: false,
			SamplingRate:       0,
			IsDefaultBehaviour: true,
		},
		{
			Name:               "Collect all crashes",
			Condition:          "(event_type==\"exception\" && exception.handled==false)",
			CollectionMode:     "sampled",
			TakeScreenshot:     true,
			TakeLayoutSnapshot: false,
			SamplingRate:       100,
			IsDefaultBehaviour: false,
		},
		{
			Name:               "Collect all ANRs",
			Condition:          "(event_type==\"anr\")",
			CollectionMode:     "sampled",
			TakeScreenshot:     true,
			TakeLayoutSnapshot: false,
			SamplingRate:       100,
			IsDefaultBehaviour: false,
		},
		{
			Name:               "Collect all bug reports",
			Condition:          "(event_type==\"bug_report\")",
			CollectionMode:     "sampled",
			TakeScreenshot:     false,
			TakeLayoutSnapshot: false,
			SamplingRate:       100,
			IsDefaultBehaviour: false,
		},
		{
			Name:               "Collect sampled cold launch events",
			Condition:          "(event_type==\"cold_launch\")",
			CollectionMode:     "sampled",
			TakeScreenshot:     false,
			TakeLayoutSnapshot: false,
			SamplingRate:       1,
			IsDefaultBehaviour: false,
		},
		{
			Name:               "Collect sampled hot launch events",
			Condition:          "(event_type==\"hot_launch\")",
			CollectionMode:     "sampled",
			TakeScreenshot:     false,
			TakeLayoutSnapshot: false,
			SamplingRate:       1,
			IsDefaultBehaviour: false,
		},
		{
			Name:               "Collect sampled warm launch events",
			Condition:          "(event_type==\"warm_launch\")",
			CollectionMode:     "sampled",
			TakeScreenshot:     false,
			TakeLayoutSnapshot: false,
			SamplingRate:       1,
			IsDefaultBehaviour: false,
		},
		{
			Name:               "Collect layout snapshots with clicks",
			Condition:          "(event_type==\"gesture_click\")",
			CollectionMode:     "timeline",
			TakeScreenshot:     false,
			TakeLayoutSnapshot: true,
			SamplingRate:       0,
			IsDefaultBehaviour: false,
		},
	}

	eventStmt := sqlf.PostgreSQL.InsertInto("event_targeting_rules")
	for _, payload := range eventRules {
		eventStmt.NewRow().
			Set("id", uuid.New()).
			Set("team_id", teamUUID).
			Set("app_id", appUUID).
			Set("name", payload.Name).
			Set("condition", payload.Condition).
			Set("collection_mode", payload.CollectionMode).
			Set("take_screenshot", payload.TakeScreenshot).
			Set("take_layout_snapshot", payload.TakeLayoutSnapshot).
			Set("sampling_rate", payload.SamplingRate).
			Set("is_default_behaviour", payload.IsDefaultBehaviour).
			Set("created_at", now).
			Set("created_by", createdByUUID).
			Set("updated_at", now).
			Set("updated_by", createdByUUID).
			Set("auto_created", true)
	}
	defer eventStmt.Close()

	_, err = tx.Exec(context.Background(), eventStmt.String(), eventStmt.Args()...)
	if err != nil {
		return fmt.Errorf("failed to create event targeting rules: %w", err)
	}

	// Insert all session targeting rules in one query
	sessionRules := []SessionTargetingRulePayload{
		{
			Name:         "Sessions with a Crash",
			Condition:    "(event_type==\"exception\" && exception.handled==false)",
			SamplingRate: 100,
		},
		{
			Name:         "Sessions with an ANR",
			Condition:    "(event_type==\"anr\")",
			SamplingRate: 100,
		},
		{
			Name:         "Sessions with a Bug Report",
			Condition:    "(event_type==\"bug_report\")",
			SamplingRate: 100,
		},
	}

	sessionStmt := sqlf.PostgreSQL.InsertInto("session_targeting_rules")
	for _, payload := range sessionRules {
		sessionStmt.NewRow().
			Set("id", uuid.New()).
			Set("team_id", teamUUID).
			Set("app_id", appUUID).
			Set("name", payload.Name).
			Set("condition", payload.Condition).
			Set("sampling_rate", payload.SamplingRate).
			Set("created_at", now).
			Set("created_by", createdByUUID).
			Set("updated_at", now).
			Set("updated_by", createdByUUID).
			Set("auto_created", true)
	}
	defer sessionStmt.Close()

	_, err = tx.Exec(context.Background(), sessionStmt.String(), sessionStmt.Args()...)
	if err != nil {
		return fmt.Errorf("failed to create session targeting rules: %w", err)
	}

	// Insert trace targeting rule
	traceStmt := sqlf.PostgreSQL.InsertInto("trace_targeting_rules").
		Set("id", uuid.New()).
		Set("team_id", teamUUID).
		Set("app_id", appUUID).
		Set("name", "Collect all traces at 0.1 percent sampling rate").
		Set("condition", "span.name == \"*\"").
		Set("collection_mode", "sampled").
		Set("sampling_rate", 0.1).
		Set("is_default_behaviour", true).
		Set("created_at", now).
		Set("created_by", createdByUUID).
		Set("updated_at", now).
		Set("updated_by", createdByUUID).
		Set("auto_created", true)
	defer traceStmt.Close()

	_, err = tx.Exec(context.Background(), traceStmt.String(), traceStmt.Args()...)
	if err != nil {
		return fmt.Errorf("failed to create trace targeting rule: %w", err)
	}

	if err := InvalidateSDKConfigCache(ctx, appUUID); err != nil {
		fmt.Println("failed to invalidate SDK config cache:", err)
	}

	return nil
}

func getEventUDAttrKeys(ctx context.Context, appId uuid.UUID) (attributes []AttrConfig, err error) {
	var table string = "user_def_attrs"
	substmt := sqlf.From(table).
		Select("distinct key").
		Select("argMax(type, ver) last_inserted_type").
		Clause("final prewhere app_id = toUUID(?)", appId).
		GroupBy("key")

	stmt := sqlf.With("last_type", substmt).
		Select("distinct t.key, t.type").
		From(table+" t").
		Join("last_type lt", "t.key = lt.key").
		Where("t.type = lt.last_inserted_type").
		OrderBy("key")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var attribute AttrConfig
		if err = rows.Scan(&attribute.Key, &attribute.Type); err != nil {
			return
		}

		attributes = append(attributes, attribute)
	}

	err = rows.Err()

	return
}

func getTraceUDAttrKeys(ctx context.Context, appId uuid.UUID) (attributes []AttrConfig, err error) {
	var table string = "span_user_def_attrs"
	substmt := sqlf.From(table).
		Select("distinct key").
		Select("argMax(type, ver) last_inserted_type").
		Clause("final prewhere app_id = toUUID(?)", appId).
		GroupBy("key")

	stmt := sqlf.With("last_type", substmt).
		Select("distinct t.key, t.type").
		From(table+" t").
		Join("last_type lt", "t.key = lt.key").
		Where("t.type = lt.last_inserted_type").
		OrderBy("key")
	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var attribute AttrConfig
		if err = rows.Scan(&attribute.Key, &attribute.Type); err != nil {
			return
		}

		attributes = append(attributes, attribute)
	}

	err = rows.Err()
	return
}

// newEventsConfig creates OS-specific
// events configuration
func newEventsConfig(osName string) []EventConfig {
	// Common events for both iOS and Android
	events := []EventConfig{
		{
			Type:       "exception",
			HasUdAttrs: false,
			Attrs: []AttrConfig{
				{Key: "handled", Type: "bool"},
			},
		},
		{
			Type:       "bug_report",
			HasUdAttrs: true,
			Attrs:      []AttrConfig{},
		},
		{
			Type:       "custom",
			HasUdAttrs: true,
			Attrs: []AttrConfig{
				{Key: "name", Type: "string", Hint: "Enter custom event name"},
			},
		},
		{
			Type:       "screen_view",
			HasUdAttrs: true,
			Attrs: []AttrConfig{
				{Key: "name", Type: "string", Hint: "Enter screen name"},
			},
		},
		{
			Type:       "http",
			HasUdAttrs: false,
			Attrs: []AttrConfig{
				{Key: "url", Type: "string", Hint: "Enter a HTTP URL"},
				{Key: "status_code", Type: "int64", Hint: "Enter HTTP status code 500, 200, etc."},
			},
		},
		{
			Type:       "gesture_click",
			HasUdAttrs: false,
			Attrs: []AttrConfig{
				{Key: "target", Type: "string", Hint: "Enter a class name like UIButtonLabel"},
				{Key: "target_id", Type: "string", Hint: "Enter a view identifier"},
			},
		},
	}

	// Define platform-specific events
	androidEvents := []EventConfig{
		{
			Type:       "anr",
			HasUdAttrs: false,
			Attrs:      []AttrConfig{},
		},
		{
			Type:       "lifecycle_activity",
			HasUdAttrs: false,
			Attrs: []AttrConfig{
				{Key: "class_name", Type: "string", Hint: "Enter Activity class name"},
			},
		},
		{
			Type:       "lifecycle_fragment",
			HasUdAttrs: false,
			Attrs: []AttrConfig{
				{Key: "class_name", Type: "string", Hint: "Enter Fragment class name"},
			},
		},
	}

	iosEvents := []EventConfig{
		{
			Type:       "lifecycle_view_controller",
			HasUdAttrs: false,
			Attrs: []AttrConfig{
				{Key: "class_name", Type: "string", Hint: "Enter View Controller class name"},
			},
		},
		{
			Type:       "lifecycle_swift_ui",
			HasUdAttrs: false,
			Attrs: []AttrConfig{
				{Key: "class_name", Type: "string", Hint: "Enter Swift View class name"},
			},
		},
	}

	switch opsys.ToFamily(osName) {
	case opsys.Android:
		events = append(events, androidEvents...)
	case opsys.AppleFamily:
		events = append(events, iosEvents...)
	default:
		// Unknown OS - include both Android and iOS events
		events = append(events, androidEvents...)
		events = append(events, iosEvents...)
	}

	// sort values by event type
	sort.Slice(events, func(i, j int) bool {
		return events[i].Type < events[j].Type
	})

	return events
}

// newSessionConfig creates OS-specific
// session attributes configuration.
func newSessionConfig(osName string) []AttrConfig {
	switch opsys.ToFamily(osName) {
	case opsys.Android:
		return []AttrConfig{
			{Key: "app_build", Type: "string", Hint: "Enter your app's build number"},
			{Key: "app_version", Type: "string", Hint: "Enter your app's version"},
			{Key: "device_is_foldable", Type: "bool"},
			{Key: "device_locale", Type: "string", Hint: "Enter a locale like en_US, fr_FR"},
			{Key: "device_low_power_mode", Type: "bool"},
			{Key: "device_manufacturer", Type: "string", Hint: "E.g. Samsung, Google"},
			{Key: "device_thermal_throttling_enabled", Type: "bool"},
			{Key: "device_type", Type: "string", Hint: "E.g. phone or tablet", Suggestions: &[]string{"phone", "tablet"}},
			{Key: "installation_id", Type: "string", Hint: "Enter an installation ID"},
			{Key: "os_version", Type: "string", Hint: "Enter API level like 21, 36"},
			{Key: "user_id", Type: "string", Hint: "Enter a user ID"},
		}
	case opsys.AppleFamily:
		return []AttrConfig{
			{Key: "app_build", Type: "string", Hint: "Enter your app's build ID"},
			{Key: "app_version", Type: "string", Hint: "Enter your app's version"},
			{Key: "device_is_foldable", Type: "bool"},
			{Key: "device_locale", Type: "string", Hint: "Enter a locale like en_US, fr_FR"},
			{Key: "device_low_power_mode", Type: "bool"},
			{Key: "device_thermal_throttling_enabled", Type: "bool"},
			{Key: "device_type", Type: "string", Hint: "E.g. phone or tablet", Suggestions: &[]string{"phone", "tablet"}},
			{Key: "installation_id", Type: "string", Hint: "Enter an installation Id"},
			{Key: "os_version", Type: "string", Hint: "E.g. 18.3.1, 18.4.1"},
			{Key: "user_id", Type: "string", Hint: "Enter a user ID"},
		}
	default:
		return []AttrConfig{
			{Key: "app_build", Type: "string", Hint: "Enter your app's build number"},
			{Key: "app_version", Type: "string", Hint: "Enter your app's version"},
			{Key: "device_is_foldable", Type: "bool"},
			{Key: "device_locale", Type: "string", Hint: "Enter a locale like en_US, fr_FR"},
			{Key: "device_low_power_mode", Type: "bool"},
			{Key: "device_manufacturer", Type: "string", Hint: "E.g. Apple, Samsung, Google"},
			{Key: "device_thermal_throttling_enabled", Type: "bool"},
			{Key: "device_type", Type: "string", Hint: "E.g. phone or tablet", Suggestions: &[]string{"phone", "tablet"}},
			{Key: "installation_id", Type: "string", Hint: "Enter an installation ID"},
			{Key: "os_version", Type: "string", Hint: "Enter API level or iOS version"},
			{Key: "user_id", Type: "string", Hint: "Enter a user ID"},
		}
	}
}

// populateSessionConfigValues maps FilterList data to AttrConfig values.
func populateSessionConfigValues(configs []AttrConfig, fl *filter.FilterList) {
	valueMap := map[string][]string{
		"app_version":         fl.Versions,
		"app_build":           fl.VersionCodes,
		"os_version":          fl.OsVersions,
		"device_locale":       fl.DeviceLocales,
		"device_manufacturer": fl.DeviceManufacturers,
	}

	for i := range configs {
		if values, exists := valueMap[configs[i].Key]; exists && len(values) > 0 {
			configs[i].Suggestions = &values
		}
	}
}

func newOperatorTypes() OperatorTypes {
	return OperatorTypes{
		Bool:    []string{"eq", "neq"},
		Float64: []string{"eq", "neq", "gt", "lt", "gte", "lte"},
		Int64:   []string{"eq", "neq", "gt", "lt", "gte", "lte"},
		String:  []string{"eq", "neq", "contains", "startsWith"},
	}
}

// populateUserEmailsForEventRules fetches and
// populates email addresses
func populateUserEmailsForEventRules(ctx context.Context, rules []EventTargetingRule) error {
	if len(rules) == 0 {
		return nil
	}

	// Extract unique user IDs from all rules
	idLUT := make(map[uuid.UUID]bool)
	for _, rule := range rules {
		idLUT[rule.CreatedBy] = true
		idLUT[rule.UpdatedBy] = true
	}

	if len(idLUT) > 0 {
		ids := make([]uuid.UUID, 0, len(idLUT))
		for id := range idLUT {
			ids = append(ids, id)
		}

		emailLUT, err := GetEmails(ctx, ids)
		if err != nil {
			return fmt.Errorf("failed to fetch user emails: %w", err)
		}

		// Populate emails for all rules
		for i := range rules {
			rules[i].CreatedByEmail = emailLUT[rules[i].CreatedBy]
			rules[i].UpdatedByEmail = emailLUT[rules[i].UpdatedBy]
		}
	}

	return nil
}

// populateUserEmailsForTraceRules fetches and
// populates email addresses
func populateUserEmailsForTraceRules(ctx context.Context, rules []TraceTargetingRule) error {
	if len(rules) == 0 {
		return nil
	}

	// Extract unique user IDs from all rules
	idLUT := make(map[uuid.UUID]bool)
	for _, rule := range rules {
		idLUT[rule.CreatedBy] = true
		idLUT[rule.UpdatedBy] = true
	}

	if len(idLUT) > 0 {
		ids := make([]uuid.UUID, 0, len(idLUT))
		for id := range idLUT {
			ids = append(ids, id)
		}

		emailLUT, err := GetEmails(ctx, ids)
		if err != nil {
			return fmt.Errorf("failed to fetch user emails: %w", err)
		}

		// Populate emails for all rules
		for i := range rules {
			rules[i].CreatedByEmail = emailLUT[rules[i].CreatedBy]
			rules[i].UpdatedByEmail = emailLUT[rules[i].UpdatedBy]
		}
	}

	return nil
}

// populateUserEmailsForSessionRules fetches and
// populates email addresses for
// one or more session rules
func populateUserEmailsForSessionRules(ctx context.Context, rules []SessionTargetingRule) error {
	if len(rules) == 0 {
		return nil
	}

	// Extract unique user IDs from all rules
	idLUT := make(map[uuid.UUID]bool)
	for _, rule := range rules {
		idLUT[rule.CreatedBy] = true
		idLUT[rule.UpdatedBy] = true
	}

	if len(idLUT) > 0 {
		ids := make([]uuid.UUID, 0, len(idLUT))
		for id := range idLUT {
			ids = append(ids, id)
		}

		emailLUT, err := GetEmails(ctx, ids)
		if err != nil {
			return fmt.Errorf("failed to fetch user emails: %w", err)
		}

		// Populate emails for all rules
		for i := range rules {
			rules[i].CreatedByEmail = emailLUT[rules[i].CreatedBy]
			rules[i].UpdatedByEmail = emailLUT[rules[i].UpdatedBy]
		}
	}

	return nil
}
