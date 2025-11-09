package measure

import (
	"backend/api/filter"
	"backend/api/opsys"
	"backend/api/server"
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// Represents a event targting rule.
type EventTargetingRule struct {
	Id                 uuid.UUID `json:"id"`
	TeamId             uuid.UUID `json:"team_id"`
	AppId              uuid.UUID `json:"app_id"`
	Condition          string    `json:"condition"`
	CollectionMode     string    `json:"collection_mode"`
	TakeScreenshot     bool      `json:"take_screenshot"`
	TakeLayoutSnapshot bool      `json:"take_layout_snapshot"`
	SamplingRate       float32   `json:"sampling_rate"`
	CreatedAt          time.Time `json:"created_at"`
	CreatedBy          uuid.UUID `json:"-"`
	CreatedByEmail     string    `json:"created_by"`
	UpdatedAt          time.Time `json:"updated_at"`
	UpdatedBy          uuid.UUID `json:"-"`
	UpdatedByEmail     string    `json:"updated_by"`
}

// Represents a trace targting rule.
type TraceTargetingRule struct {
	Id             uuid.UUID `json:"id"`
	TeamId         uuid.UUID `json:"team_id"`
	AppId          uuid.UUID `json:"app_id"`
	Condition      string    `json:"condition"`
	CollectionMode string    `json:"collection_mode"`
	SamplingRate   float32   `json:"sampling_rate"`
	CreatedAt      time.Time `json:"created_at"`
	CreatedBy      uuid.UUID `json:"-"`
	CreatedByEmail string    `json:"created_by"`
	UpdatedAt      time.Time `json:"updated_at"`
	UpdatedBy      uuid.UUID `json:"-"`
	UpdatedByEmail string    `json:"updated_by"`
}

// Represents a session targting rule.
type SessionTargetingRule struct {
	Id             uuid.UUID `json:"id"`
	TeamId         uuid.UUID `json:"team_id"`
	AppId          uuid.UUID `json:"app_id"`
	SamplingRate   float32   `json:"sampling_rate"`
	Condition      string    `json:"condition"`
	CreatedAt      time.Time `json:"created_at"`
	CreatedBy      uuid.UUID `json:"-"`
	CreatedByEmail string    `json:"created_by"`
	UpdatedAt      time.Time `json:"updated_at"`
	UpdatedBy      uuid.UUID `json:"-"`
	UpdatedByEmail string    `json:"updated_by"`
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
	Key  string `json:"key"`
	Type string `json:"type"`
	Hint string `json:"hint"`
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
	Traces            []TraceConfig `json:"trace_config"`
	SessionAttrs      []AttrConfig  `json:"session_attrs"`
	TraceUDAttributes []AttrConfig  `json:"trace_ud_attrs"`
	OperatorTypes     OperatorTypes `json:"operator_types"`
}

// Session targeting config used
// by the dashboard.
type SessionTargetingConfig struct {
	Events            []EventConfig `json:"events"`
	Traces            []TraceConfig `json:"trace_config"`
	EventUdAttrs      []AttrConfig  `json:"event_ud_attrs"`
	TraceUDAttributes []AttrConfig  `json:"trace_ud_attrs"`
	SessionAttrs      []AttrConfig  `json:"session_attrs"`
	OperatorTypes     OperatorTypes `json:"operator_types"`
}

type EventTargetingRulePayload struct {
	Condition          string  `json:"condition"`
	CollectionMode     string  `json:"collection_mode"`
	TakeScreenshot     bool    `json:"take_screenshot"`
	TakeLayoutSnapshot bool    `json:"take_layout_snapshot"`
	SamplingRate       float32 `json:"sampling_rate"`
}

type TraceTargetingRulePayload struct {
	Condition      string  `json:"condition"`
	CollectionMode string  `json:"collection_mode"`
	SamplingRate   float32 `json:"sampling_rate"`
}

type SessionTargetingRulePayload struct {
	Condition    string  `json:"condition"`
	SamplingRate float32 `json:"sampling_rate"`
}

// GetEventTargetingRules provides all
// event targeting rules.
func GetEventTargetingRulesWithFilter(ctx context.Context, af *filter.AppFilter) (rules []EventTargetingRule, err error) {
	stmt := sqlf.PostgreSQL.From("event_targeting_rules").
		Select("id").
		Select("team_id").
		Select("app_id").
		Select("condition").
		Select("collection_mode").
		Select("take_screenshot").
		Select("take_layout_snapshot").
		Select("created_at").
		Select("created_by").
		Select("updated_at").
		Select("updated_by").
		Where("app_id = ?", af.AppID)

	stmt.OrderBy("updated_at DESC")

	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var rule EventTargetingRule
		if err := rows.Scan(
			&rule.Id,
			&rule.TeamId,
			&rule.AppId,
			&rule.Condition,
			&rule.CollectionMode,
			&rule.TakeScreenshot,
			&rule.TakeLayoutSnapshot,
			&rule.CreatedAt,
			&rule.CreatedBy,
			&rule.UpdatedAt,
			&rule.UpdatedBy,
		); err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}

	// Populate user emails for all rules
	if err := populateUserEmailsForEventRules(ctx, rules); err != nil {
		return nil, err
	}

	return rules, nil
}

// GetTraceTargetingRulesWithFilter provides all
// trace targeting rules.
func GetTraceTargetingRulesWithFilter(ctx context.Context, af *filter.AppFilter) (rules []TraceTargetingRule, err error) {
	stmt := sqlf.PostgreSQL.From("trace_targeting_rules").
		Select("id").
		Select("team_id").
		Select("app_id").
		Select("condition").
		Select("collection_mode").
		Select("created_at").
		Select("created_by").
		Select("updated_at").
		Select("updated_by").
		Where("app_id = ?", af.AppID)

	stmt.OrderBy("updated_at DESC")

	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var rule TraceTargetingRule
		if err := rows.Scan(
			&rule.Id,
			&rule.TeamId,
			&rule.AppId,
			&rule.Condition,
			&rule.CollectionMode,
			&rule.CreatedAt,
			&rule.CreatedBy,
			&rule.UpdatedAt,
			&rule.UpdatedBy,
		); err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}

	// Populate user emails for all rules
	if err := populateUserEmailsForTraceRules(ctx, rules); err != nil {
		return nil, err
	}

	return rules, nil
}

// GetSessionTargetingRulesWithFilter provides all
// session targeting rules.
func GetSessionTargetingRulesWithFilter(ctx context.Context, af *filter.AppFilter) (rules []SessionTargetingRule, err error) {
	stmt := sqlf.PostgreSQL.From("session_targeting_rules").
		Select("id").
		Select("team_id").
		Select("app_id").
		Select("sampling_rate").
		Select("condition").
		Select("created_at").
		Select("created_by").
		Select("updated_at").
		Select("updated_by").
		Where("app_id = ?", af.AppID)

	stmt.OrderBy("updated_at DESC")

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
			&rule.SamplingRate,
			&rule.Condition,
			&rule.CreatedAt,
			&rule.CreatedBy,
			&rule.UpdatedAt,
			&rule.UpdatedBy,
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
	stmt := sqlf.PostgreSQL.From("event_targeting_rules").
		Select("id").
		Select("team_id").
		Select("app_id").
		Select("condition").
		Select("collection_mode").
		Select("take_screenshot").
		Select("take_layout_snapshot").
		Select("sampling_rate").
		Select("created_at").
		Select("created_by").
		Select("updated_at").
		Select("updated_by").
		Where("app_id = ?", appId).
		Where("id = toUUID(?)", ruleId)

	defer stmt.Close()

	row := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...)

	var r EventTargetingRule
	if err := row.Scan(
		&r.Id,
		&r.TeamId,
		&r.AppId,
		&r.Condition,
		&r.CollectionMode,
		&r.TakeScreenshot,
		&r.TakeLayoutSnapshot,
		&r.SamplingRate,
		&r.CreatedAt,
		&r.CreatedBy,
		&r.UpdatedAt,
		&r.UpdatedBy,
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
	stmt := sqlf.PostgreSQL.From("trace_targeting_rules").
		Select("id").
		Select("team_id").
		Select("app_id").
		Select("condition").
		Select("collection_mode").
		Select("sampling_rate").
		Select("created_at").
		Select("created_by").
		Select("updated_at").
		Select("updated_by").
		Where("app_id = ?", appId).
		Where("id = toUUID(?)", ruleId)

	defer stmt.Close()

	row := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...)

	var r TraceTargetingRule
	if err := row.Scan(
		&r.Id,
		&r.TeamId,
		&r.AppId,
		&r.Condition,
		&r.CollectionMode,
		&r.SamplingRate,
		&r.CreatedAt,
		&r.CreatedBy,
		&r.UpdatedAt,
		&r.UpdatedBy,
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
	stmt := sqlf.PostgreSQL.From("session_targeting_rules").
		Select("id").
		Select("team_id").
		Select("app_id").
		Select("condition").
		Select("sampling_rate").
		Select("created_at").
		Select("created_by").
		Select("updated_at").
		Select("updated_by").
		Where("app_id = ?", appId).
		Where("id = toUUID(?)", ruleId)

	defer stmt.Close()

	row := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...)

	var r SessionTargetingRule
	if err := row.Scan(
		&r.Id,
		&r.TeamId,
		&r.AppId,
		&r.Condition,
		&r.SamplingRate,
		&r.CreatedAt,
		&r.CreatedBy,
		&r.UpdatedAt,
		&r.UpdatedBy,
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
func GetEventTargetingConfig(ctx context.Context, appId uuid.UUID, osName string) (EventTargetingConfig, error) {
	eventUdAttrs, err := getEventUDAttrKeys(ctx, appId)
	if err != nil {
		return EventTargetingConfig{}, err
	}

	return EventTargetingConfig{
		Events:        newEventsConfig(osName),
		SessionAttrs:  newSessionConfig(osName),
		EventUdAttrs:  eventUdAttrs,
		OperatorTypes: newOperatorTypes(),
	}, nil
}

// GetTraceTargetingConfig creates and returns
// the config required to render trace
// targeting rule creation page.
func GetTraceTargetingConfig(ctx context.Context, appId uuid.UUID, osName string) (TraceTargetingConfig, error) {
	traceUdAttrs, err := getTraceUDAttrKeys(ctx, appId)
	if err != nil {
		return TraceTargetingConfig{}, err
	}

	traces, err := getTraceNames(ctx, appId)
	if err != nil {
		return TraceTargetingConfig{}, err
	}

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
		SessionAttrs:      newSessionConfig(osName),
		TraceUDAttributes: traceUdAttrs,
		OperatorTypes:     newOperatorTypes(),
	}, nil
}

// GetSessionTargetingConfig creates and returns
// the config required to render session
// targeting rule creation page.
func GetSessionTargetingConfig(ctx context.Context, appId uuid.UUID, osName string) (SessionTargetingConfig, error) {
	eventUdAttrs, err := getEventUDAttrKeys(ctx, appId)
	if err != nil {
		return SessionTargetingConfig{}, err
	}
	traceUdAttrs, err := getTraceUDAttrKeys(ctx, appId)
	if err != nil {
		return SessionTargetingConfig{}, err
	}
	traces, err := getTraceNames(ctx, appId)
	if err != nil {
		return SessionTargetingConfig{}, err
	}
	traceConfigs := make([]TraceConfig, 0, len(traces))
	for _, traceName := range traces {
		traceConfigs = append(traceConfigs, TraceConfig{
			Name:       traceName,
			Attrs:      []AttrConfig{},
			HasUdAttrs: true,
		})
	}
	return SessionTargetingConfig{
		Events:            newEventsConfig(osName),
		Traces:            traceConfigs,
		EventUdAttrs:      eventUdAttrs,
		TraceUDAttributes: traceUdAttrs,
		SessionAttrs:      newSessionConfig(osName),
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

	if payload.CollectionMode != "session_timeline" && payload.CollectionMode != "disabled" && payload.CollectionMode != "sampled" {
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

	stmt := sqlf.PostgreSQL.InsertInto("event_targeting_rules").
		Set("id", ruleId).
		Set("team_id", teamId).
		Set("app_id", appId).
		Set("condition", payload.Condition).
		Set("collection_mode", payload.CollectionMode).
		Set("take_screenshot", payload.TakeScreenshot).
		Set("take_layout_snapshot", payload.TakeLayoutSnapshot).
		Set("sampling_rate", payload.SamplingRate).
		Set("created_at", now).
		Set("created_by", createdByUUID).
		Set("updated_at", now).
		Set("updated_by", createdByUUID)

	defer stmt.Close()

	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return uuid.Nil, err
	}
	return ruleId, nil
}

func UpdateEventTargetingRuleForApp(ctx context.Context, appId uuid.UUID, ruleId string, payload EventTargetingRulePayload, updatedBy string) error {
	updatedByUUID, err := uuid.Parse(updatedBy)
	if err != nil {
		return fmt.Errorf("invalid updatedBy UUID: %w", err)
	}

	stmt := sqlf.PostgreSQL.Update("event_targeting_rules").
		Set("condition", payload.Condition).
		Set("collection_mode", payload.CollectionMode).
		Set("take_screenshot", payload.TakeScreenshot).
		Set("take_layout_snapshot", payload.TakeLayoutSnapshot).
		Set("sampling_rate", payload.SamplingRate).
		Set("updated_at", time.Now()).
		Set("updated_by", updatedByUUID).
		Where("app_id = ?", appId).
		Where("id = toUUID(?)", ruleId)

	defer stmt.Close()

	result, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("event targeting rule not found")
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

	if payload.CollectionMode != "session_timeline" && payload.CollectionMode != "disabled" && payload.CollectionMode != "sampled" {
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
		Set("condition", payload.Condition).
		Set("collection_mode", payload.CollectionMode).
		Set("sampling_rate", payload.SamplingRate).
		Set("created_at", now).
		Set("created_by", createdByUUID).
		Set("updated_at", now).
		Set("updated_by", createdByUUID)
	defer stmt.Close()
	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return uuid.Nil, err
	}
	return ruleId, nil
}

func UpdateTraceTargetingRuleForApp(ctx context.Context, appId uuid.UUID, ruleId string, payload TraceTargetingRulePayload, updatedBy string) error {
	updatedByUUID, err := uuid.Parse(updatedBy)
	if err != nil {
		return fmt.Errorf("invalid updatedBy UUID: %w", err)
	}

	stmt := sqlf.PostgreSQL.Update("trace_targeting_rules").
		Set("condition", payload.Condition).
		Set("collection_mode", payload.CollectionMode).
		Set("sampling_rate", payload.SamplingRate).
		Set("updated_at", time.Now()).
		Set("updated_by", updatedByUUID).
		Where("app_id = ?", appId).
		Where("id = toUUID(?)", ruleId)

	defer stmt.Close()

	result, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("trace targeting rule not found")
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
		Set("condition", payload.Condition).
		Set("sampling_rate", payload.SamplingRate).
		Set("created_at", now).
		Set("created_by", createdByUUID).
		Set("updated_at", now).
		Set("updated_by", createdByUUID)
	defer stmt.Close()
	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return uuid.Nil, err
	}
	return ruleId, nil
}

func UpdateSessionTargetingRuleForApp(ctx context.Context, appId uuid.UUID, ruleId string, payload SessionTargetingRulePayload, updatedBy string) error {
	updatedByUUID, err := uuid.Parse(updatedBy)
	if err != nil {
		return fmt.Errorf("invalid updatedBy UUID: %w", err)
	}

	stmt := sqlf.PostgreSQL.Update("session_targeting_rules").
		Set("condition", payload.Condition).
		Set("sampling_rate", payload.SamplingRate).
		Set("updated_at", time.Now()).
		Set("updated_by", updatedByUUID).
		Where("app_id = ?", appId).
		Where("id = toUUID(?)", ruleId)

	defer stmt.Close()

	result, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("session targeting rule not found")
	}

	return nil
}

func DeleteEventTargetingRuleForApp(ctx context.Context, appId uuid.UUID, ruleId string) error {
	stmt := sqlf.PostgreSQL.DeleteFrom("event_targeting_rules").
		Where("app_id = ?", appId).
		Where("id = toUUID(?)", ruleId)
	defer stmt.Close()
	result, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("event targeting rule not found")
	}
	return nil
}

func DeleteTraceTargetingRuleForApp(ctx context.Context, appId uuid.UUID, ruleId string) error {
	stmt := sqlf.PostgreSQL.DeleteFrom("trace_targeting_rules").
		Where("app_id = ?", appId).
		Where("id = toUUID(?)", ruleId)
	defer stmt.Close()
	result, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("trace targeting rule not found")
	}
	return nil
}

func DeleteSessionTargetingRuleForApp(ctx context.Context, appId uuid.UUID, ruleId string) error {
	stmt := sqlf.PostgreSQL.DeleteFrom("session_targeting_rules").
		Where("app_id = ?", appId).
		Where("id = toUUID(?)", ruleId)
	defer stmt.Close()
	result, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("session targeting rule not found")
	}
	return nil
}

// getTraceNames returns list of root span names for a given app id
func getTraceNames(ctx context.Context, appId uuid.UUID) (traceNames []string, err error) {
	stmt := sqlf.
		Select("distinct toString(span_name)").
		From("spans").
		Where("app_id = ?", appId).
		Where("parent_id = ''").
		OrderBy("start_time desc")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var traceName string

		if err = rows.Scan(&traceName); err != nil {
			fmt.Println(err)
			return
		}

		if err = rows.Err(); err != nil {
			return
		}

		traceNames = append(traceNames, traceName)
	}

	err = rows.Err()
	return

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
				{Key: "status_code", Type: "int64", Hint: "Enter HTTP status code"},
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

// newEventsConfig creates OS-specific
// session attributes configuration.
func newSessionConfig(osName string) []AttrConfig {
	switch opsys.ToFamily(osName) {
	case opsys.Android:
		return []AttrConfig{
			{Key: "app_build", Type: "string", Hint: "Enter your app's build number"},
			{Key: "app_version", Type: "string", Hint: "Enter your app's version"},
			{Key: "device_is_foldable", Type: "bool"},
			{Key: "device_is_physical", Type: "bool"},
			{Key: "device_locale", Type: "string", Hint: "Enter a locale like en_US, fr_FR"},
			{Key: "device_low_power_mode", Type: "bool"},
			{Key: "device_manufacturer", Type: "string", Hint: "E.g. Apple, Samsung, Google"},
			{Key: "device_model", Type: "string", Hint: "E.g. Redmi Go, Pixel 4a "},
			{Key: "device_name", Type: "string", Hint: "E.g. sunfish, tiare"},
			{Key: "device_thermal_throttling_enabled", Type: "bool"},
			{Key: "device_type", Type: "string", Hint: "E.g. phone or tablet"},
			{Key: "installation_id", Type: "string", Hint: "Enter an installation ID"},
			{Key: "user_id", Type: "string", Hint: "Enter a user ID"},
			{Key: "os_version", Type: "string", Hint: "Enter API level like 21, 36"},
		}
	case opsys.AppleFamily:
		return []AttrConfig{
			{Key: "app_build", Type: "string", Hint: "Enter your app's build ID"},
			{Key: "app_version", Type: "string", Hint: "Enter your app's version"},
			{Key: "device_is_foldable", Type: "bool"},
			{Key: "device_is_physical", Type: "bool"},
			{Key: "device_locale", Type: "string", Hint: "Enter a locale like en_US, fr_FR"},
			{Key: "device_low_power_mode", Type: "bool"},
			{Key: "device_model", Type: "string", Hint: "E.g. iPhone 17"},
			{Key: "device_thermal_throttling_enabled", Type: "bool"},
			{Key: "device_type", Type: "string", Hint: "E.g. phone or tablet"},
			{Key: "installation_id", Type: "string", Hint: "Enter an installation Id"},
			{Key: "os_version", Type: "string", Hint: "E.g. 18.3.1, 18.4.1"},
			{Key: "user_id", Type: "string", Hint: "Enter a user ID"},
		}
	default:
		return []AttrConfig{}
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
