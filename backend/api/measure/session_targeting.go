package measure

import (
	"backend/api/filter"
	"backend/api/opsys"
	"backend/api/server"
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// Represents a session targting rule.
type SessionTargetingRule struct {
	Id             uuid.UUID `json:"id"`
	TeamId         uuid.UUID `json:"team_id"`
	AppId          uuid.UUID `json:"app_id"`
	Name           string    `json:"name"`
	Status         int       `json:"status"`
	SamplingRate   float64   `json:"sampling_rate"`
	Rule           string    `json:"rule"`
	CreatedAt      time.Time `json:"created_at"`
	CreatedBy      uuid.UUID `json:"-"`
	CreatedByEmail string    `json:"created_by"`
	UpdatedAt      time.Time `json:"updated_at"`
	UpdatedBy      uuid.UUID `json:"-"`
	UpdatedByEmail string    `json:"updated_by"`
}

// Payload for creating a new
// session targeting rule.
type CreateSTRulePayload struct {
	Name         string  `json:"name" binding:"required"`
	Status       int     `json:"status" binding:"min=0,max=1"`
	SamplingRate float64 `json:"sampling_rate" binding:"required"`
	Rule         string  `json:"rule" binding:"required"`
}

// Payload to update an existing
// session targeting rule.
type UpdateSTRulePayload struct {
	Name         *string  `json:"name,omitempty"`
	Status       *int     `json:"status,omitempty" binding:"omitempty"`
	SamplingRate *float64 `json:"sampling_rate,omitempty" binding:"omitempty"`
	Rule         *string  `json:"rule,omitempty"`
}

// EventConfig part of the session
// targeting dashboard config.
type EventConfig struct {
	Type       string       `json:"type"`
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

// Session targeting config used
// by the dashboard.
type STDashboardConfig struct {
	Events        []EventConfig `json:"events"`
	SessionAttrs  []AttrConfig  `json:"session_attrs"`
	EventUdAttrs  []AttrConfig  `json:"event_ud_attrs"`
	OperatorTypes OperatorTypes `json:"operator_types"`
}

func CreateDefaultSTRules(ctx context.Context, teamId string, appId string, userId string) (err error) {
	now := time.Now()

	defaultRules := []CreateSTRulePayload{
		{
			Name:         "Sessions with crashes",
			Rule:         "(event_type == \"exception\" && exception.handled == false)",
			SamplingRate: 100.0,
			Status:       1,
		},
		{
			Name:         "Sessions with ANRs",
			Rule:         "(event_type == \"anr\")",
			SamplingRate: 100.0,
			Status:       1,
		},
		{
			Name:         "Sessions with bug reports",
			Rule:         "(event_type == \"bug_report\")",
			SamplingRate: 100.0,
			Status:       1,
		},
	}

	stmt := sqlf.PostgreSQL.InsertInto("session_targeting_rules")

	for _, payload := range defaultRules {
		ruleId := uuid.New()
		stmt.NewRow().
			Set("id", ruleId).
			Set("team_id", teamId).
			Set("app_id", appId).
			Set("name", payload.Name).
			Set("status", payload.Status).
			Set("sampling_rate", payload.SamplingRate).
			Set("rule", payload.Rule).
			Set("created_at", now).
			Set("created_by", userId).
			Set("updated_at", now).
			Set("updated_by", userId)
	}

	defer stmt.Close()

	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}

	return nil
}

// GetSTRules provides session targeting rules
// that matches various filter criteria
// in a paginated fashion.
func GetSTRules(ctx context.Context, af *filter.AppFilter) (rules []SessionTargetingRule, next, previous bool, err error) {
	stmt := sqlf.PostgreSQL.From("session_targeting_rules").
		Select("id").
		Select("team_id").
		Select("app_id").
		Select("name").
		Select("status").
		Select("sampling_rate").
		Select("rule").
		Select("created_at").
		Select("created_by").
		Select("updated_at").
		Select("updated_by").
		Where("app_id = ?", af.AppID)

	if af.Limit > 0 {
		stmt.Limit(uint64(af.Limit) + 1)
	}

	if af.Offset >= 0 {
		stmt.Offset(uint64(af.Offset))
	}

	stmt.OrderBy("updated_at DESC")

	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, false, false, err
	}
	defer rows.Close()

	for rows.Next() {
		var rule SessionTargetingRule
		if err := rows.Scan(
			&rule.Id,
			&rule.TeamId,
			&rule.AppId,
			&rule.Name,
			&rule.Status,
			&rule.SamplingRate,
			&rule.Rule,
			&rule.CreatedAt,
			&rule.CreatedBy,
			&rule.UpdatedAt,
			&rule.UpdatedBy,
		); err != nil {
			return nil, false, false, err
		}
		rules = append(rules, rule)
	}

	resultLen := len(rules)

	if len(rules) == 0 {
		return nil, false, false, nil
	}

	// Set pagination next & previous flags
	if resultLen > af.Limit {
		rules = rules[:resultLen-1]
		next = true
	}
	if af.Offset > 0 {
		previous = true
	}

	// Populate user emails for all rules
	if err := populateUserEmails(ctx, rules); err != nil {
		return nil, false, false, err
	}

	return rules, next, previous, nil
}

// GetSTRuleById fetches a session targeting
// rule by its ruleId.
func GetSTRuleById(ctx context.Context, ruleId string) (rule SessionTargetingRule, err error) {
	stmt := sqlf.PostgreSQL.From("session_targeting_rules").
		Select("id").
		Select("team_id").
		Select("app_id").
		Select("name").
		Select("status").
		Select("sampling_rate").
		Select("rule").
		Select("created_at").
		Select("created_by").
		Select("updated_at").
		Select("updated_by").
		Where("id = ?", ruleId)

	defer stmt.Close()

	row := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...)

	if err := row.Scan(
		&rule.Id,
		&rule.TeamId,
		&rule.AppId,
		&rule.Name,
		&rule.Status,
		&rule.SamplingRate,
		&rule.Rule,
		&rule.CreatedAt,
		&rule.CreatedBy,
		&rule.UpdatedAt,
		&rule.UpdatedBy,
	); err != nil {
		return rule, err
	}

	// Populate user emails
	emailLUT, err := GetEmails(ctx, []uuid.UUID{rule.CreatedBy, rule.UpdatedBy})
	if err != nil {
		return rule, err
	}
	rule.CreatedByEmail = emailLUT[rule.CreatedBy]
	rule.UpdatedByEmail = emailLUT[rule.UpdatedBy]

	return rule, nil
}

// CreateSTRule validates and creates
// a new session targeting rule for
// an app.
func CreateSTRule(ctx context.Context, teamId string, appId string, userId string, payload CreateSTRulePayload) (rule SessionTargetingRule, err error) {
	if payload.Name == "" {
		return rule, errors.New("name is empty")
	}

	if payload.Status != 0 && payload.Status != 1 {
		return rule, errors.New("status must be 0 or 1")
	}

	if payload.SamplingRate < 0 || payload.SamplingRate > 100 {
		return rule, errors.New("sampling_rate must be between 0 and 100")
	}

	if payload.Rule == "" {
		return rule, errors.New("rule is empty")
	}

	now := time.Now()
	ruleId := uuid.New()

	stmt := sqlf.PostgreSQL.
		InsertInto("session_targeting_rules").
		Set("id", ruleId).
		Set("team_id", teamId).
		Set("app_id", appId).
		Set("name", payload.Name).
		Set("status", payload.Status).
		Set("sampling_rate", payload.SamplingRate).
		Set("rule", payload.Rule).
		Set("created_at", now).
		Set("created_by", userId).
		Set("updated_at", now).
		Set("updated_by", userId).
		Returning("id").
		Returning("team_id").
		Returning("app_id").
		Returning("name").
		Returning("status").
		Returning("sampling_rate").
		Returning("rule").
		Returning("created_at").
		Returning("created_by").
		Returning("updated_at").
		Returning("updated_by")

	defer stmt.Close()

	row := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...)

	if err := row.Scan(
		&rule.Id,
		&rule.TeamId,
		&rule.AppId,
		&rule.Name,
		&rule.Status,
		&rule.SamplingRate,
		&rule.Rule,
		&rule.CreatedAt,
		&rule.CreatedBy,
		&rule.UpdatedAt,
		&rule.UpdatedBy,
	); err != nil {
		return rule, err
	}

	return rule, nil
}

// UpdateSTRule updates an existing
// session targeting rule.
func UpdateSTRule(ctx context.Context, teamId string, appId string, userId string, ruleId string, payload UpdateSTRulePayload) error {
	now := time.Now()

	stmt := sqlf.PostgreSQL.
		Update("session_targeting_rules").
		Set("updated_at", now).
		Set("updated_by", userId).
		Where("id = ?", ruleId).
		Where("team_id = ?", teamId).
		Where("app_id = ?", appId)

	// Only update fields that are provided
	if payload.Name != nil && *payload.Name != "" {
		stmt = stmt.Set("name", *payload.Name)
	}

	if payload.Status != nil && (*payload.Status == 0 || *payload.Status == 1) {
		stmt = stmt.Set("status", *payload.Status)
	}

	if payload.SamplingRate != nil && (*payload.SamplingRate >= 0 && *payload.SamplingRate <= 100) {
		stmt = stmt.Set("sampling_rate", *payload.SamplingRate)
	}

	if payload.Rule != nil && *payload.Rule != "" {
		stmt = stmt.Set("rule", *payload.Rule)
	}

	defer stmt.Close()

	result, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return fmt.Errorf("failed to update rule: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("rule not found: id=%s, team_id=%s, app_id=%s", ruleId, teamId, appId)
	}

	return nil
}

// GetSTDashboardConfig creates and returns
// the config required to render session
// targeting rule creation page.
func GetSTDashboardConfig(ctx context.Context, appId uuid.UUID, osName string) (STDashboardConfig, error) {
	eventUdAttrs, err := getUDAttrKeys(ctx, appId)
	if err != nil {
		return STDashboardConfig{}, err
	}

	return STDashboardConfig{
		Events:        newEventsConfig(osName),
		SessionAttrs:  newSessionConfig(osName),
		EventUdAttrs:  eventUdAttrs,
		OperatorTypes: newOperatorTypes(),
	}, nil
}

func getUDAttrKeys(ctx context.Context, appId uuid.UUID) (attributes []AttrConfig, err error) {
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

// populateUserEmails fetches and
// populates email addresses for
// one or more rules
func populateUserEmails(ctx context.Context, rules []SessionTargetingRule) error {
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
