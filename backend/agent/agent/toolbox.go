package agent

import (
	"backend/agent/server"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"reflect"
	"sort"
	"strings"
	"sync"
	"time"

	"backend/libs/ambient"
	"backend/libs/chquery"
	"backend/libs/event"
	"backend/libs/filter"
	"backend/libs/group"
	"backend/libs/measure"
	"backend/libs/network"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/gin-gonic/gin"
	"github.com/google/jsonschema-go/jsonschema"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"
	"go.opentelemetry.io/otel/codes"
)

const (
	// maxResultRows is where ClickHouse stops returning rows (it truncates
	// rather than erroring, via result_overflow_mode=break).
	maxResultRows = 500
	// maxFormattedRows is the most rows we render into the tool result.
	maxFormattedRows = 200
	// maxResultChars is the most characters of result text the LLM gets back.
	maxResultChars = 16000
	// maxQuerySeconds is the most seconds one query may run.
	maxQuerySeconds = 30
	// maxQueryMemoryBytes is the most server memory one query may use.
	maxQueryMemoryBytes = 500 << 20
)

// agentTables are the tables the agent may query via {{table}} placeholders,
// each with the time column the run_sql from/to range is enforced on.
// events and spans are the immutable source tables everything else in
// ClickHouse derives from; the derived tables back the purpose-built tools
// and would only duplicate them here.
var agentTables = map[string]string{"events": "timestamp", "spans": "start_time"}

// tableSets lists the ClickHouse tables the agent may query. scoped holds the
// queryable tables (agentTables keys). all holds every table in the database
// and is used to spot raw table names written without a placeholder.
type tableSets struct {
	scoped map[string]bool
	all    map[string]bool
}

var (
	tableSetsMu     sync.Mutex
	cachedTableSets *tableSets
)

// loadTableSets reads the table lists from ClickHouse once and caches them
// for the life of the process. Tables only change via migrations, and
// migrations come with a redeploy.
func (c *Config) loadTableSets(ctx context.Context) (*tableSets, error) {
	deps := c.Deps
	tableSetsMu.Lock()
	defer tableSetsMu.Unlock()
	if cachedTableSets != nil {
		return cachedTableSets, nil
	}

	sets := &tableSets{scoped: map[string]bool{}, all: map[string]bool{}}
	for t := range agentTables {
		sets.scoped[t] = true
	}

	stmt := sqlf.
		Select("name").
		From("system.tables").
		Where("database = currentDatabase()")
	defer stmt.Close()

	// system.* introspection carries no team scope; use the operator pool
	// so it is not subject to the reader team_isolation guard.
	allRows, err := deps.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, fmt.Errorf("schema introspection failed: %w", err)
	}
	defer allRows.Close()
	for allRows.Next() {
		var t string
		if err := allRows.Scan(&t); err != nil {
			return nil, err
		}
		sets.all[t] = true
	}
	if err := allRows.Err(); err != nil {
		return nil, err
	}

	cachedTableSets = sets
	return sets, nil
}

// schemaPrimer tells the LLM how the raw tables are organized before it
// writes SQL against them.
const schemaPrimer = `events and spans are the raw source tables; everything else derives from them.
- events: one row per SDK event. The type column says which kind (exception, anr, http, cold_launch, gesture_click, screen_view, ...); each kind fills its own prefixed columns (exception.*, http.*, ...) and leaves the rest at defaults. attribute.* columns (app version, os, device, country) are on every row.
- sessions: count distinct session_id on events; attribute.session_start_time is on every event of the session.
- crashes: type = 'exception' and (exception.severity = 'fatal' or, on legacy rows with empty severity, exception.handled = false). ANRs: type = 'anr'.
- launch performance: cold_launch.duration, warm_launch.duration and hot_launch.duration on their event types.
- network: type = 'http' with the http.* columns.
- spans: one row per trace span; trace_id and parent_id link a trace, a root span has an empty parent_id.
- bug report status is not in these tables; use the bug report tools.

`

// getSchema returns each queryable table and its columns with their comments,
// formatted for the LLM.
func (c *Config) getSchema(ctx context.Context) (string, error) {
	deps := c.Deps
	sets, err := c.loadTableSets(ctx)
	if err != nil {
		return "", err
	}
	if len(sets.scoped) == 0 {
		return "", fmt.Errorf("no queryable tables found")
	}

	names := make([]string, 0, len(sets.scoped))
	for t := range sets.scoped {
		names = append(names, fmt.Sprintf("'%s'", t))
	}
	sort.Strings(names)

	stmt := sqlf.
		Select("table, name, type, comment").
		From("system.columns").
		Where("database = currentDatabase()").
		Where(fmt.Sprintf("table in (%s)", strings.Join(names, ","))).
		OrderBy("table, position")
	defer stmt.Close()

	// system.* introspection carries no team scope; use the operator pool
	// so it is not subject to the reader team_isolation guard.
	rows, err := deps.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	var b strings.Builder
	b.WriteString(schemaPrimer)
	current := ""
	for rows.Next() {
		var table, name, typ, comment string
		if err := rows.Scan(&table, &name, &typ, &comment); err != nil {
			return "", err
		}
		if table != current {
			if current != "" {
				b.WriteString("\n")
			}
			fmt.Fprintf(&b, "table {{%s}}:\n", table)
			current = table
		}
		if comment != "" {
			fmt.Fprintf(&b, "  %s %s -- %s\n", name, typ, comment)
		} else {
			fmt.Fprintf(&b, "  %s %s\n", name, typ)
		}
	}
	if err := rows.Err(); err != nil {
		return "", err
	}
	return b.String(), nil
}

// runSQL validates the query, scopes it to the team, the given apps and the
// time range, runs it read-only and renders the rows as text for the LLM.
// Callers validate appIDs against the team's apps.
func (c *Config) runSQL(ctx context.Context, query string, teamID uuid.UUID, appIDs []uuid.UUID, from, to time.Time) (string, error) {
	// Fail closed on an incomplete scope: a nil team or empty app set would
	// expand into a wider subquery than any caller may run. Upstream derives
	// both from access checks and the team's app list; this guards a future caller
	// that forgets to.
	if teamID == uuid.Nil || len(appIDs) == 0 {
		log.Printf("ERROR agent: run_sql refused, incomplete scope (team=%s apps=%d)", teamID, len(appIDs))
		return "", fmt.Errorf("internal error: query scope is incomplete")
	}

	deps := c.Deps
	start := time.Now()
	sets, err := c.loadTableSets(ctx)
	if err != nil {
		return "", err
	}
	subst, refs, err := validateAgentSQL(query, sets)
	if err != nil {
		return "", err
	}

	expanded := expandPlaceholders(subst, refs, teamID, appIDs, from, to)

	chCtx := chquery.WithSettings(ctx, clickhouse.Settings{
		"readonly":             1,
		chquery.AgentScopeKey:  clickhouse.CustomSetting{Value: teamID.String()},
		"max_execution_time":   maxQuerySeconds,
		"max_memory_usage":     maxQueryMemoryBytes,
		"max_result_rows":      maxResultRows,
		"result_overflow_mode": "break",
	})

	rows, err := deps.RAChPool.Query(chCtx, expanded)
	if err != nil {
		return "", fmt.Errorf("query failed: %v", err)
	}
	defer rows.Close()

	cols := rows.Columns()
	colTypes := rows.ColumnTypes()

	var b strings.Builder
	b.WriteString(strings.Join(cols, "\t"))
	b.WriteString("\n")

	count := 0
	truncated := false
	for rows.Next() {
		if count >= maxFormattedRows || b.Len() > maxResultChars {
			truncated = true
			break
		}
		vals := make([]any, len(colTypes))
		for i, ct := range colTypes {
			vals[i] = reflect.New(ct.ScanType()).Interface()
		}
		if err := rows.Scan(vals...); err != nil {
			return "", fmt.Errorf("scan failed: %v", err)
		}
		parts := make([]string, len(vals))
		for i, v := range vals {
			parts[i] = fmt.Sprintf("%v", reflect.ValueOf(v).Elem().Interface())
		}
		b.WriteString(strings.Join(parts, "\t"))
		b.WriteString("\n")
		count++
	}
	if err := rows.Err(); err != nil {
		return "", fmt.Errorf("query failed: %v", err)
	}

	if count == 0 {
		b.WriteString("(no rows)\n")
	}
	if truncated {
		fmt.Fprintf(&b, "(truncated at %d rows)\n", count)
	}

	log.Printf("agent: run_sql rows=%d duration=%s from=%s to=%s query=%q",
		count, time.Since(start).Round(time.Millisecond),
		from.UTC().Format(time.RFC3339), to.UTC().Format(time.RFC3339), query)
	return b.String(), nil
}

// --------------------------------------------------------------------------
// Tool catalog
// --------------------------------------------------------------------------

// Tool is one capability of the agent service, in the two forms it is
// consumed in: typed registration on the MCP server and an erased JSON-in,
// text-out call for the agent's LLM loop.
type Tool struct {
	def      *mcpsdk.Tool
	params   json.RawMessage
	register func(s *mcpsdk.Server, obs ToolObserver)
	call     func(ctx context.Context, args json.RawMessage) (string, error)
}

// ToolObserver is called after every tool invocation made through the MCP
// server, with success reporting whether the handler returned without error;
// the transport uses it to instrument usage.
type ToolObserver func(ctx context.Context, toolName string, duration time.Duration, success bool)

// Register adds the tool to an MCP server. obs may be nil.
func (t Tool) Register(s *mcpsdk.Server, obs ToolObserver) {
	t.register(s, obs)
}

// newTool builds a Tool from an MCP tool definition and its typed handler.
func newTool[I, O any](
	def *mcpsdk.Tool,
	handler func(context.Context, *mcpsdk.CallToolRequest, I) (*mcpsdk.CallToolResult, O, error),
) Tool {
	params, err := json.Marshal(def.InputSchema)
	if def.InputSchema == nil || err != nil {
		params = json.RawMessage(`{"type":"object","properties":{}}`)
	}

	register := func(s *mcpsdk.Server, obs ToolObserver) {
		wrapped := func(ctx context.Context, req *mcpsdk.CallToolRequest, in I) (*mcpsdk.CallToolResult, O, error) {
			ctx, span := tracer.Start(ctx, "mcp.tool "+def.Name)
			defer span.End()
			start := time.Now()
			result, out, err := handler(ctx, req, in)
			if err != nil {
				span.SetStatus(codes.Error, err.Error())
			}
			log.Printf("mcp: tool %s duration=%s err=%v",
				def.Name, time.Since(start).Round(time.Millisecond), err)
			if obs != nil {
				obs(ctx, def.Name, time.Since(start), err == nil)
			}
			return result, out, err
		}
		mcpsdk.AddTool(s, def, wrapped)
	}

	call := func(ctx context.Context, args json.RawMessage) (string, error) {
		var in I
		if len(args) > 0 {
			if err := json.Unmarshal(args, &in); err != nil {
				return "", fmt.Errorf("invalid arguments: %v", err)
			}
		}
		// Tool handlers ignore the request parameter, so a zero one is fine.
		result, out, err := handler(ctx, &mcpsdk.CallToolRequest{}, in)
		if err != nil {
			return "", err
		}
		// Prefer explicit text content (it also carries handler-reported
		// errors); otherwise return the structured output as JSON.
		if result != nil && len(result.Content) > 0 {
			parts := make([]string, 0, len(result.Content))
			for _, c := range result.Content {
				if t, ok := c.(*mcpsdk.TextContent); ok {
					parts = append(parts, t.Text)
				}
			}
			if len(parts) > 0 {
				return strings.Join(parts, "\n"), nil
			}
		}
		data, err := json.Marshal(out)
		if err != nil {
			return "", fmt.Errorf("failed to encode result: %v", err)
		}
		return string(data), nil
	}

	return Tool{def: def, params: params, register: register, call: call}
}

// MCPTools returns every tool the agent service serves over MCP: the common
// tools plus ask_question.
func MCPTools(cfg *Config) []Tool {
	return append(commonTools(cfg), askQuestionTool(cfg))
}

// askQuestionTool wraps the brain as an MCP tool. It is deliberately not in
// commonTools: the agent's loop must not call itself.
func askQuestionTool(cfg *Config) Tool {
	return newTool(&mcpsdk.Tool{
		Name: "ask_question",
		Description: "Ask a natural-language question about the telemetry of one or more apps (crashes, ANRs, errors, " +
			"sessions, spans, network) that the other Measure tools don't cover. The agent picks the right tool or explores " +
			"the raw data with read-only SQL and answers with concrete numbers, including comparisons across apps. " +
			"Pass the app_ids the question is about - all must belong to one team. Use list_apps to discover app ids " +
			"and each app's team. " +
			"Each call is independent: make the question self-contained, and when asking a follow-up include the " +
			"relevant findings and numbers from earlier answers in the question, along with the answer's Method " +
			"line so the recomputation stays consistent. " +
			"The agent only reads data; use the other Measure tools to change funnels or bug reports.",
		InputSchema: mcpMustInferSchema[askQuestionInput](),
		Annotations: readOnlyTool,
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in askQuestionInput) (*mcpsdk.CallToolResult, any, error) {
		// The one agent-backed tool: while the agent is disabled it returns
		// the unavailability notice. The plain data tools are not
		// agent-dependent and keep working.
		if !cfg.Deps.Config.IsAgentEnabled() {
			return mcpTextResult(UnavailableReply), nil, nil
		}
		out, err := cfg.askQuestion(ctx, in)
		if err != nil {
			return nil, nil, err
		}
		return nil, out, nil
	})
}

// readOnlyTool marks a tool that changes no data, so an MCP client can run it
// without asking its user.
var readOnlyTool = &mcpsdk.ToolAnnotations{ReadOnlyHint: true}

// commonTools returns the tools served on both surfaces: to MCP clients and
// to the agent's own loop. Purpose-built, one per dashboard question. The
// render_chart tool is not one of them: it produces an artifact for the turn
// rather than a result for the model, and only Slack can deliver it, so it
// lives in graph.go and the turn loop offers and dispatches it itself.
func commonTools(cfg *Config) []Tool {
	return []Tool{
		// list_apps
		newTool(&mcpsdk.Tool{
			Name:        "list_apps",
			Description: "List all apps the authenticated user has access to, each with the team it belongs to",
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpListAppsInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpListApps(ctx, in)
		}),

		// get_filter_keys
		newTool(&mcpsdk.Tool{
			Name:        "get_filter_keys",
			Description: "List the filter keys of an entity (spans, bug_reports, sessions, errors, error_group_events, journeys, network, app_health, memory, funnels or builds), the vocabulary a filter_expr is written with: each key's name, label, description, key_group, value_type, operators and value_suggestion_mode, plus the key groups present. Call this before writing a filter_expr; get_filter_values lists a key's suggested values.",
			InputSchema: mcpMustInferSchema[mcpGetFilterKeysInput](),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetFilterKeysInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetFilterKeys(ctx, in)
		}),

		// get_filter_values
		newTool(&mcpsdk.Tool{
			Name:        "get_filter_values",
			Description: "List the values a filter key can be set to for an app, for use in a filter_expr, optionally narrowed by a search string. truncated in the result says more values matched. get_filter_keys lists the keys; a key whose value_suggestion_mode is none takes typed values and has no list.",
			InputSchema: mcpMustInferSchema[mcpGetFilterValuesInput](),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetFilterValuesInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetFilterValues(ctx, in)
		}),

		// get_metrics
		newTool(&mcpsdk.Tool{
			Name:        "get_metrics",
			Description: "Get app metrics including adoption, crash-free/ANR-free sessions, launch performance (cold/warm/hot p95) and app size. Covers every app version unless filter_expr narrows it; each metric is reported for the selected versions and for the rest, and adoption is only meaningful against a specific version, so narrow to one with its version_code when reading it. App size is reported only when the versions with data in the range share a single version name, as the size of that version's most recent build; otherwise sizes has multiple_versions or no_data set. " + mcpFilterExprToolsHint(filter.AppHealthEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetMetricsInput](mcpAppHealthFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetMetricsInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetMetrics(ctx, in)
		}),

		// get_app_health_over_time
		newTool(&mcpsdk.Tool{
			Name:        "get_app_health_over_time",
			Description: "Get the app health timeline: sessions, crashes (fatal exceptions) and ANRs bucketed over time. This is the overview health plot. Covers every app version unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.AppHealthEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetAppHealthOverTimeInput](mcpAppHealthFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetAppHealthOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetAppHealthOverTime(ctx, in)
		}),

		// get_errors
		newTool(&mcpsdk.Tool{
			Name:        "get_errors",
			Description: "Get error groups (crashes, non-fatal errors and ANRs) for an app, sorted by instance count. Each group has its instance count, unique users and sessions affected and the time it was last seen, all within the requested time range and filter. include_trend adds each group's instances per time bucket. Covers every error unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.ErrorsEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetErrorsInput](mcpErrorsFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetErrorsInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetErrors(ctx, in)
		}),

		// get_error
		newTool(&mcpsdk.Tool{
			Name:        "get_error",
			Description: "Get individual error events (exception or ANR) for a specific error group. Covers every event of the group unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.ErrorGroupEventsEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetErrorInput](mcpErrorGroupEventsFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetErrorInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetError(ctx, in)
		}),

		// get_errors_over_time
		newTool(&mcpsdk.Tool{
			Name:        "get_errors_over_time",
			Description: "Get time-series of error occurrences across all error groups. Covers every error unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.ErrorsEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetErrorsOverTimeInput](mcpErrorsFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetErrorsOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetErrorsOverTime(ctx, in)
		}),

		// get_error_over_time
		newTool(&mcpsdk.Tool{
			Name:        "get_error_over_time",
			Description: "Get time-series of occurrences for a specific error group. Covers every event of the group unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.ErrorGroupEventsEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetErrorOverTimeInput](mcpErrorGroupEventsFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetErrorOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetErrorOverTime(ctx, in)
		}),

		// get_error_distribution
		newTool(&mcpsdk.Tool{
			Name:        "get_error_distribution",
			Description: "Get attribute distribution (app version, OS, country, network type, locale, device) for a specific error group: the 5 most frequent values of each attribute, the count of instances with any other value, and the number of distinct values. Pass attribute to list up to 25 values of one attribute. Covers every event of the group unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.ErrorGroupEventsEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetErrorDistributionInput](mcpErrorGroupEventsFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetErrorDistributionInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetErrorDistribution(ctx, in)
		}),

		// get_error_common_path
		newTool(&mcpsdk.Tool{
			Name:        "get_error_common_path",
			Description: "Get the most common user navigation path leading to a specific error group (crash, exception or ANR)",
			InputSchema: mcpMustInferSchema[mcpGetErrorCommonPathInput](),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetErrorCommonPathInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetErrorCommonPath(ctx, in)
		}),

		// get_sessions
		newTool(&mcpsdk.Tool{
			Name:        "get_sessions",
			Description: "Get sessions for an app, ordered by most recent first. Covers every session unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.SessionsEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetSessionsInput](mcpSessionsFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetSessionsInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetSessions(ctx, in)
		}),

		// get_sessions_over_time
		newTool(&mcpsdk.Tool{
			Name:        "get_sessions_over_time",
			Description: "Get time-series of session counts. Covers every session unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.SessionsEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetSessionsOverTimeInput](mcpSessionsFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetSessionsOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetSessionsOverTime(ctx, in)
		}),

		// get_session
		newTool(&mcpsdk.Tool{
			Name:        "get_session",
			Description: "Get full session with all events",
			InputSchema: mcpMustInferSchema[mcpGetSessionInput](),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetSessionInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetSession(ctx, in)
		}),

		// get_memory_usage_over_time
		newTool(&mcpsdk.Tool{
			Name:        "get_memory_usage_over_time",
			Description: "Get aggregate memory usage over time. Use it to compare shifts in app's memory profile. Returns p50/p90/p95/p99 in KiB by app version/build and time bucket. " + mcpFilterExprToolsHint(filter.MemoryEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetMemoryUsageOverTimeInput](mcpMemoryFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetMemoryUsageOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetMemoryUsageOverTime(ctx, in)
		}),

		// get_memory_usage_by_device_tier
		newTool(&mcpsdk.Tool{
			Name:        "get_memory_usage_by_device_tier",
			Description: "Get a breakdown of memory usage by different device memory tiers. Returns p50/p90/p95 in KiB along with sampled-session and sample counts. " + mcpFilterExprToolsHint(filter.MemoryEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetMemoryUsageByDeviceTierInput](mcpMemoryFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetMemoryUsageByDeviceTierInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetMemoryUsageByDeviceTier(ctx, in)
		}),

		// get_high_memory_sessions
		newTool(&mcpsdk.Tool{
			Name:        "get_high_memory_sessions",
			Description: "Get a paginated list of sessions with high memory usage. Use get_session to connect a returned session_id to user actions, screens, and errors. " + mcpFilterExprToolsHint(filter.MemoryEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetHighMemorySessionsInput](mcpMemoryFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetHighMemorySessionsInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetHighMemorySessions(ctx, in)
		}),

		// get_bug_reports
		newTool(&mcpsdk.Tool{
			Name:        "get_bug_reports",
			Description: "Get bug reports for an app, ordered by most recent first. Covers every bug report unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.BugReportsEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetBugReportsInput](mcpBugReportsFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetBugReportsInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetBugReports(ctx, in)
		}),

		// get_bug_reports_over_time
		newTool(&mcpsdk.Tool{
			Name:        "get_bug_reports_over_time",
			Description: "Get time-series of bug report counts. Covers every bug report unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.BugReportsEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetBugReportsOverTimeInput](mcpBugReportsFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetBugReportsOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetBugReportsOverTime(ctx, in)
		}),

		// get_bug_report
		newTool(&mcpsdk.Tool{
			Name:        "get_bug_report",
			Description: "Get a single bug report with full details",
			InputSchema: mcpMustInferSchema[mcpGetBugReportInput](),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetBugReportInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetBugReport(ctx, in)
		}),

		// update_bug_report_status
		newTool(&mcpsdk.Tool{
			Name:        "update_bug_report_status",
			Description: "Update the status of a bug report (open or closed)",
			InputSchema: mcpMustInferSchema[mcpUpdateBugReportStatusInput](),
			Annotations: &mcpsdk.ToolAnnotations{DestructiveHint: new(false), IdempotentHint: true},
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpUpdateBugReportStatusInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpUpdateBugReportStatus(ctx, in)
		}),

		// get_root_span_names
		newTool(&mcpsdk.Tool{
			Name:        "get_root_span_names",
			Description: "Get all root span names for an app",
			InputSchema: mcpMustInferSchema[mcpGetRootSpanNamesInput](),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetRootSpanNamesInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetRootSpanNames(ctx, in)
		}),

		// get_span_instances
		newTool(&mcpsdk.Tool{
			Name:        "get_span_instances",
			Description: "Get span instances for a root span name. Covers every span unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.SpansEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetSpanInstancesInput](mcpSpansFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetSpanInstancesInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetSpanInstances(ctx, in)
		}),

		// get_span_metrics_over_time
		newTool(&mcpsdk.Tool{
			Name:        "get_span_metrics_over_time",
			Description: "Get p50/p90/p95/p99 duration metrics over time for a span name. Covers every span unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.SpansEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetSpanMetricsOverTimeInput](mcpSpansFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetSpanMetricsOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetSpanMetricsOverTime(ctx, in)
		}),

		// get_trace
		newTool(&mcpsdk.Tool{
			Name:        "get_trace",
			Description: "Get full trace with all child spans",
			InputSchema: mcpMustInferSchema[mcpGetTraceInput](),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetTraceInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetTrace(ctx, in)
		}),

		// get_alerts
		newTool(&mcpsdk.Tool{
			Name:        "get_alerts",
			Description: "Get alerts for an app, ordered by most recent first",
			InputSchema: mcpMustInferSchema[mcpGetAlertsInput](),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetAlertsInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetAlerts(ctx, in)
		}),

		// get_journey
		newTool(&mcpsdk.Tool{
			Name:        "get_journey",
			Description: "Get an app's journey as a graph of screens. Each link is a transition between consecutive screens within a session, valued by the number of sessions that made that transition. Covers every session unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.JourneysEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetJourneyInput](mcpJourneysFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetJourneyInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetJourney(ctx, in)
		}),

		// get_network_metrics_trends
		newTool(&mcpsdk.Tool{
			Name:        "get_network_metrics_trends",
			Description: "Get top network endpoints by latency, error rate, and frequency for domain and path pattern. Covers every request unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.NetworkEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetNetworkTrendsInput](mcpNetworkFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetNetworkTrendsInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetNetworkTrends(ctx, in)
		}),

		// get_network_status_codes_over_time
		newTool(&mcpsdk.Tool{
			Name:        "get_network_status_codes_over_time",
			Description: "Get HTTP status-class counts over time for the whole app or a selected endpoint. Covers every request unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.NetworkEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetAppHttpStatusCodesOverTimeInput](mcpNetworkFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetAppHttpStatusCodesOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetAppStatusCodesOverTime(ctx, in)
		}),

		// get_network_endpoint_status_codes_over_time
		newTool(&mcpsdk.Tool{
			Name:        "get_network_endpoint_status_codes_over_time",
			Description: "Get exact HTTP status-code counts over time for a selected endpoint. Covers every request unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.NetworkEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetHttpEndpointStatusCodesOverTimeInput](mcpNetworkFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetHttpEndpointStatusCodesOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetHttpEndpointStatusCodesOverTime(ctx, in)
		}),

		// get_network_latency_over_time
		newTool(&mcpsdk.Tool{
			Name:        "get_network_latency_over_time",
			Description: "Get latency percentiles over time for the whole app or a selected endpoint. Covers every request unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.NetworkEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetNetworkLatencyOverTimeInput](mcpNetworkFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetNetworkLatencyOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetNetworkLatencyOverTime(ctx, in)
		}),

		// get_network_timeline
		newTool(&mcpsdk.Tool{
			Name:        "get_network_timeline",
			Description: "Get the per-session HTTP request timeline for the whole app or a selected endpoint. Covers every request unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.NetworkEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetNetworkTimelineInput](mcpNetworkFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetNetworkTimelineInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetNetworkTimeline(ctx, in)
		}),

		// get_funnels
		newTool(&mcpsdk.Tool{
			Name:        "get_funnels",
			Description: "List an app's funnels, most recently updated first, each with its name, steps, conversion window and pin. A funnel is an ordered list of custom event names, its steps, with a conversion window: a user enters the funnel by sending the first step's event, and reaches each later step by sending that step's event, in order, within the conversion window measured from the first step. get_pinned_funnels lists the pinned funnels in their pinned order.",
			InputSchema: mcpMustInferSchema[mcpGetFunnelsInput](),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetFunnelsInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetFunnels(ctx, in)
		}),

		// get_pinned_funnels
		newTool(&mcpsdk.Tool{
			Name:        "get_pinned_funnels",
			Description: "List an app's pinned funnels in their pinned order, which is the order the funnels page and the app's overview show them in.",
			InputSchema: mcpMustInferSchema[mcpGetPinnedFunnelsInput](),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetPinnedFunnelsInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetPinnedFunnels(ctx, in)
		}),

		// get_funnel
		newTool(&mcpsdk.Tool{
			Name:        "get_funnel",
			Description: "Get one funnel: its name, steps, conversion window, pin and who created it.",
			InputSchema: mcpMustInferSchema[mcpGetFunnelInput](),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetFunnelInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetFunnel(ctx, in)
		}),

		// get_funnel_event_names
		newTool(&mcpsdk.Tool{
			Name:        "get_funnel_event_names",
			Description: fmt.Sprintf("List the custom event names an app's sessions sent in the last 30 days, most recently seen first, at most %d, optionally narrowed by a search string. A funnel's steps are custom event names, so use this to find them before create_funnel or update_funnel.", measure.MaxSuggestFunnelEventNames),
			InputSchema: mcpMustInferSchema[mcpGetFunnelEventNamesInput](),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetFunnelEventNamesInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetFunnelEventNames(ctx, in)
		}),

		// get_funnel_conversion
		newTool(&mcpsdk.Tool{
			Name:        "get_funnel_conversion",
			Description: "Get a funnel's conversion over a time range: for each step, the users that reached it and the median seconds they took to get there from the previous step. A user is counted when they did the first step within the range; their later steps can come after the range ends, within the conversion window. " + mcpFunnelRange + " " + mcpFunnelUsers + " Covers every user unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.FunnelsEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetFunnelConversionInput](mcpFunnelsFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetFunnelConversionInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetFunnelConversion(ctx, in)
		}),

		// get_funnel_trend
		newTool(&mcpsdk.Tool{
			Name:        "get_funnel_trend",
			Description: "Get a funnel's conversion in each of the last 30 days, 12 weeks or 12 months, ending with the current one, in the given timezone; weeks start on Monday. Each point has the users that reached each step, the median seconds to convert, and complete, which is false while users that entered the funnel in that period can still convert. include_builds adds the builds and patches first uploaded during the trend, to line changes in conversion up with releases. " + mcpFunnelUsers + " Covers every user unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.FunnelsEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetFunnelTrendInput](mcpFunnelsFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetFunnelTrendInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetFunnelTrend(ctx, in)
		}),

		// get_funnel_cadence
		newTool(&mcpsdk.Tool{
			Name:        "get_funnel_cadence",
			Description: "Get when users enter a funnel and how well they convert by hour of the week: for each weekday (1 for Monday to 7 for Sunday) and hour in the given timezone, the users that entered the funnel in it and how many of them converted. The weeks end at the latest week whose users have all had a full conversion window, and the result's from and to give the span they cover. " + mcpFunnelUsers + " Covers every user unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.FunnelsEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetFunnelCadenceInput](mcpFunnelsFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetFunnelCadenceInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetFunnelCadence(ctx, in)
		}),

		// get_funnel_step_errors
		newTool(&mcpsdk.Tool{
			Name:        "get_funnel_step_errors",
			Description: "List the error groups (crashes, ANRs, app hangs and handled errors) that users hit while trying to get from one funnel step to the next, or through the whole funnel when step is omitted. " + mcpFunnelAttempt + " " + mcpFunnelRange + " " + mcpFunnelUsers + " Each group has its error count, the users that hit it, and how many of them converted and how many dropped off; the groups with the most drop-offs come first. get_error takes a group's id to show its events. Covers every user unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.FunnelsEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetFunnelStepErrorsInput](mcpFunnelsFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetFunnelStepErrorsInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetFunnelStepErrors(ctx, in)
		}),

		// get_funnel_step_traces
		newTool(&mcpsdk.Tool{
			Name:        "get_funnel_step_traces",
			Description: "List the root spans that started while users were trying to get from one funnel step to the next, or through the whole funnel when step is omitted. " + mcpFunnelAttempt + " " + mcpFunnelRange + " " + mcpFunnelUsers + " Each span name has its span count, how many of the users that recorded it converted and how many dropped off, and the quantile of its duration in milliseconds for each of the two groups, null when no user of the group recorded it. The span names recorded by the most users that dropped off come first. Covers every user unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.FunnelsEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetFunnelStepTracesInput](mcpFunnelsFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetFunnelStepTracesInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetFunnelStepTraces(ctx, in)
		}),

		// get_funnel_step_network
		newTool(&mcpsdk.Tool{
			Name:        "get_funnel_step_network",
			Description: "List the URL patterns of the network requests that users made while trying to get from one funnel step to the next, or through the whole funnel when step is omitted. " + mcpFunnelAttempt + " " + mcpFunnelRange + " " + mcpFunnelUsers + " Each pattern has its request count, how many of the users that requested it converted and how many dropped off, and the quantile of its latency in milliseconds for each of the two groups, null when no user of the group requested it. The patterns requested by the most users that dropped off come first. Covers every user unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.FunnelsEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetFunnelStepNetworkInput](mcpFunnelsFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetFunnelStepNetworkInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetFunnelStepNetwork(ctx, in)
		}),

		// get_funnel_step_sessions
		newTool(&mcpsdk.Tool{
			Name:        "get_funnel_step_sessions",
			Description: "List the sessions of the users that converted, or of those that dropped off, while trying to get from one funnel step to the next, or through the whole funnel when step is omitted. " + mcpFunnelAttempt + " " + mcpFunnelRange + " " + mcpFunnelUsers + " A session is listed when it has an event during its user's attempt. installation_id identifies the user the funnel counted; user_id is the id the app set on the session, empty when none was set. The users that started their attempt most recently come first, each with their sessions from oldest to newest. get_session takes a session's id to show what happened in it. Covers every user unless filter_expr narrows it; " + mcpFilterExprToolsHint(filter.FunnelsEntity) + ".",
			InputSchema: mcpMustInferFilterExprSchema[mcpGetFunnelStepSessionsInput](mcpFunnelsFilterExprGrammar),
			Annotations: readOnlyTool,
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetFunnelStepSessionsInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetFunnelStepSessions(ctx, in)
		}),

		// create_funnel
		newTool(&mcpsdk.Tool{
			Name:        "create_funnel",
			Description: "Create a funnel for an app and return it. " + mcpFunnelDraftRules,
			InputSchema: mcpMustInferSchema[mcpCreateFunnelInput](),
			Annotations: &mcpsdk.ToolAnnotations{DestructiveHint: new(false)},
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpCreateFunnelInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpCreateFunnel(ctx, in)
		}),

		// update_funnel
		newTool(&mcpsdk.Tool{
			Name:        "update_funnel",
			Description: "Change a funnel's name, steps or conversion window and return it. Whatever is not given keeps its current value. " + mcpFunnelDraftRules,
			InputSchema: mcpMustInferSchema[mcpUpdateFunnelInput](),
			Annotations: &mcpsdk.ToolAnnotations{DestructiveHint: new(true), IdempotentHint: true},
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpUpdateFunnelInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpUpdateFunnel(ctx, in)
		}),

		// delete_funnel
		newTool(&mcpsdk.Tool{
			Name:        "delete_funnel",
			Description: "Delete a funnel. A deleted funnel cannot be restored.",
			InputSchema: mcpMustInferSchema[mcpDeleteFunnelInput](),
			Annotations: &mcpsdk.ToolAnnotations{DestructiveHint: new(true), IdempotentHint: true},
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpDeleteFunnelInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpDeleteFunnel(ctx, in)
		}),

		// set_funnel_pinned
		newTool(&mcpsdk.Tool{
			Name:        "set_funnel_pinned",
			Description: fmt.Sprintf("Pin a funnel after the app's other pinned funnels, or unpin it, and return it. Pinned funnels are shown first on the funnels page and on the app's overview. An app can have at most %d pinned funnels.", measure.MaxPinnedFunnels),
			InputSchema: mcpMustInferSchema[mcpSetFunnelPinnedInput](),
			Annotations: &mcpsdk.ToolAnnotations{DestructiveHint: new(false), IdempotentHint: true},
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpSetFunnelPinnedInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpSetFunnelPinned(ctx, in)
		}),

		// reorder_pinned_funnels
		newTool(&mcpsdk.Tool{
			Name:        "reorder_pinned_funnels",
			Description: "Put an app's pinned funnels in a new order and return them in it. funnel_ids must hold every pinned funnel of the app once; get_pinned_funnels lists them.",
			InputSchema: mcpMustInferSchema[mcpReorderPinnedFunnelsInput](),
			Annotations: &mcpsdk.ToolAnnotations{DestructiveHint: new(false), IdempotentHint: true},
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpReorderPinnedFunnelsInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpReorderPinnedFunnels(ctx, in)
		}),
	}
}

// mcpFilterExprToolsHint tells the client where the vocabulary of a
// filter_expr comes from, naming the entity whose keys get_filter_keys is
// called with. It is shared by every tool that takes a filter_expr.
func mcpFilterExprToolsHint(entity filter.Entity) string {
	return "get_filter_keys with entity " + entity.Name + " lists the keys and operators a filter_expr may use, get_filter_values lists a key's suggested values"
}

// mcpFilterExprGrammar is the filter_expr grammar, condensed from
// backend/libs/filter/parse.go, shared as the filter_expr property's
// schema description by every tool that takes one. The prose names the
// entity being narrowed and the example is written in that entity's keys.
// Custom keys are mentioned only for an entity that stores user-defined
// attributes, since any other entity rejects the custom. prefix as unknown.
func mcpFilterExprGrammar(entity filter.Entity, example string) string {
	noun := strings.ReplaceAll(entity.Name, "_", " ")
	grammar := "Filter expression narrowing the " + noun + ". A condition is key:operator:value or key:operator:[v1,v2]; a no-value operator like is_set is written key:operator. Conditions join with AND / OR, parentheses group, and AND binds tighter than OR. A value holding a space, comma, bracket, colon or quote is written in double quotes. Example: " + example + ". "
	if entity.CustomKeySource != nil {
		grammar += "User-defined attribute keys appear under the Custom key group and carry the custom. prefix, as in custom.is_premium:eq:true. "
	}
	return grammar + mcpFilterExprToolsHint(entity)
}

// The grammar text each entity's tools advertise, built from the shared
// template with an example in that entity's keys.
var (
	mcpSpansFilterExprGrammar            = mcpFilterExprGrammar(filter.SpansEntity, "version_name:in:[1.2.0,1.1.9] AND span_status:in:error")
	mcpBugReportsFilterExprGrammar       = mcpFilterExprGrammar(filter.BugReportsEntity, "version_name:in:[1.2.0] AND bug_report_status:in:open")
	mcpJourneysFilterExprGrammar         = mcpFilterExprGrammar(filter.JourneysEntity, "version_name:in:[1.2.0] AND version_code:in:[120]")
	mcpNetworkFilterExprGrammar          = mcpFilterExprGrammar(filter.NetworkEntity, "version_name:in:[1.2.0] AND http_method:in:get")
	mcpSessionsFilterExprGrammar         = mcpFilterExprGrammar(filter.SessionsEntity, "session_events:in:[fatal_error, anr] AND session_foreground_background:in:[foreground]")
	mcpErrorsFilterExprGrammar           = mcpFilterExprGrammar(filter.ErrorsEntity, `error_type:in:[Crash, ANR] AND os_name:in:[android]`)
	mcpErrorGroupEventsFilterExprGrammar = mcpFilterExprGrammar(filter.ErrorGroupEventsEntity, "version_name:in:[1.2.0] AND os_name:in:[android]")
	mcpAppHealthFilterExprGrammar        = mcpFilterExprGrammar(filter.AppHealthEntity, "version_name:in:[1.2.0] AND version_code:in:[120]")
	mcpMemoryFilterExprGrammar           = mcpFilterExprGrammar(filter.MemoryEntity, "version_name:in:[1.2.0] AND app_state:eq:foreground")
	mcpFunnelsFilterExprGrammar          = mcpFilterExprGrammar(filter.FunnelsEntity, "version_name:in:[1.2.0] AND country:in:[US]")
)

const mcpFunnelUsers = "Users are counted by installation id: each install of the app is one user, whatever user id the app has set."

const mcpFunnelRange = "A from or to with seconds is rounded down to the minute, or to ten minutes when the range is a day or more; a from or to on a whole minute is used as sent."

const mcpFunnelAttempt = "A user's attempt starts when they reach the earlier step and ends when they reach the next one or, if they never do, when their conversion window runs out. The result names the two steps as from_step and to_step."

const mcpFunnelDraftRules = "The name is required and at most 256 characters. The steps are 2 to 30 custom event names in the order users do them, which get_funnel_event_names lists; a name can appear in more than one step. The conversion window is how long a user has from the first step to reach the last one, given in seconds: a whole number of minutes from 1 minute to 30 days."

// mcpMustInferFilterExprSchema infers a JSON schema from a Go type and sets
// the given entity grammar text as the description of its "filter_expr"
// property. A struct tag cannot hold the entity-specific text, so the
// description is set here. Used by tools whose input carries a filter_expr
// field.
func mcpMustInferFilterExprSchema[T any](grammar string) json.RawMessage {
	schema, err := jsonschema.For[T](nil)
	if err != nil {
		panic("mcp: failed to infer schema: " + err.Error())
	}
	p, ok := schema.Properties["filter_expr"]
	if !ok {
		panic("mcp: schema has no filter_expr property")
	}
	p.Description = grammar
	data, err := schema.MarshalJSON()
	if err != nil {
		panic("mcp: failed to marshal schema: " + err.Error())
	}
	return json.RawMessage(data)
}

// mcpMustInferSchema infers a JSON schema from a Go type.
func mcpMustInferSchema[T any]() json.RawMessage {
	schema, err := jsonschema.For[T](nil)
	if err != nil {
		panic("mcp: failed to infer schema: " + err.Error())
	}
	data, err := schema.MarshalJSON()
	if err != nil {
		panic("mcp: failed to marshal schema: " + err.Error())
	}
	return json.RawMessage(data)
}

// --------------------------------------------------------------------------
// Tool input structs
// --------------------------------------------------------------------------

type mcpListAppsInput struct{}
type mcpGetFilterKeysInput struct {
	AppID  string   `json:"app_id" jsonschema:"UUID of the app to query"`
	Entity string   `json:"entity" jsonschema:"The entity the filter is written against: spans, bug_reports, sessions, errors, error_group_events, journeys, network, app_health, memory, funnels or builds"`
	Keys   []string `json:"keys,omitempty" jsonschema:"Key names you already know, for example from the user's request, to include in the result even when the listing is truncated"`
}
type mcpGetFilterValuesInput struct {
	AppID   string `json:"app_id" jsonschema:"UUID of the app to query"`
	Entity  string `json:"entity" jsonschema:"The entity the filter is written against: spans, bug_reports, sessions, errors, error_group_events, journeys, network, app_health, memory, funnels or builds"`
	KeyName string `json:"key_name" jsonschema:"Name of the filter key to list values for, as get_filter_keys returns it"`
	Search  string `json:"search,omitempty" jsonschema:"Return only values containing this text"`
	Limit   int    `json:"limit,omitempty" jsonschema:"Maximum number of values to return (default: 50, max: 200)"`
}
type mcpGetMetricsInput struct {
	AppID      string `json:"app_id" jsonschema:"UUID of the app to query"`
	From       string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To         string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr string `json:"filter_expr,omitempty"`
}
type mcpGetAppHealthOverTimeInput struct {
	AppID      string `json:"app_id" jsonschema:"UUID of the app to query"`
	From       string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To         string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr string `json:"filter_expr,omitempty"`
	Timezone   string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetErrorsInput struct {
	AppID        string `json:"app_id" jsonschema:"UUID of the app to query"`
	From         string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To           string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr   string `json:"filter_expr,omitempty"`
	Limit        int    `json:"limit,omitempty" jsonschema:"Maximum number of groups to return (default: 10, max: 30)"`
	Offset       int    `json:"offset,omitempty" jsonschema:"Number of groups to skip for pagination (default: 0)"`
	IncludeTrend bool   `json:"include_trend,omitempty" jsonschema:"Add each group's instances per time bucket (default: false). Use it to compare how several groups change over time, such as spotting new or rising errors. The bucket size follows the time range: hourly up to 48 hours, daily up to 180 days and monthly beyond that, so a group can carry up to 181 points. Set limit to 5 or fewer with it, and use get_error_over_time to look at one group's trend"`
}
type mcpGetErrorInput struct {
	AppID        string `json:"app_id" jsonschema:"UUID of the app to query"`
	From         string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To           string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr   string `json:"filter_expr,omitempty"`
	ErrorGroupID string `json:"error_group_id" jsonschema:"Fingerprint/ID of the error group"`
	Limit        int    `json:"limit,omitempty" jsonschema:"Maximum number of events to return (default: 1, max: 5)"`
	Offset       int    `json:"offset,omitempty" jsonschema:"Number of events to skip for pagination (default: 0)"`
}
type mcpGetErrorsOverTimeInput struct {
	AppID      string `json:"app_id" jsonschema:"UUID of the app to query"`
	From       string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To         string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr string `json:"filter_expr,omitempty"`
	Timezone   string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetErrorOverTimeInput struct {
	AppID        string `json:"app_id" jsonschema:"UUID of the app to query"`
	From         string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To           string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr   string `json:"filter_expr,omitempty"`
	ErrorGroupID string `json:"error_group_id" jsonschema:"Fingerprint/ID of the error group"`
	Timezone     string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetErrorDistributionInput struct {
	AppID        string `json:"app_id" jsonschema:"UUID of the app to query"`
	From         string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To           string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr   string `json:"filter_expr,omitempty"`
	ErrorGroupID string `json:"error_group_id" jsonschema:"Fingerprint/ID of the error group"`
	Attribute    string `json:"attribute,omitempty" jsonschema:"Attribute to list up to 25 values of: app_version, os_version, country, network_type, locale or device (default: the 5 most frequent values of every attribute)"`
}
type mcpGetSessionsInput struct {
	AppID      string `json:"app_id" jsonschema:"UUID of the app to query"`
	From       string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To         string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr string `json:"filter_expr,omitempty"`
	Limit      int    `json:"limit,omitempty" jsonschema:"Maximum number of sessions to return (default: 10)"`
	Offset     int    `json:"offset,omitempty" jsonschema:"Number of sessions to skip for pagination (default: 0)"`
}
type mcpGetSessionsOverTimeInput struct {
	AppID      string `json:"app_id" jsonschema:"UUID of the app to query"`
	From       string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To         string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr string `json:"filter_expr,omitempty"`
	Timezone   string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetSessionInput struct {
	AppID     string `json:"app_id" jsonschema:"UUID of the app"`
	SessionID string `json:"session_id" jsonschema:"UUID of the session"`
}
type mcpGetMemoryUsageOverTimeInput struct {
	AppID         string `json:"app_id" jsonschema:"UUID of the app to query"`
	From          string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To            string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr    string `json:"filter_expr,omitempty"`
	Timezone      string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
	PlotTimeGroup string `json:"plot_time_group,omitempty" jsonschema:"Time bucket: minutes, hours, days or months (default: days)"`
}
type mcpGetMemoryUsageByDeviceTierInput struct {
	AppID      string `json:"app_id" jsonschema:"UUID of the app to query"`
	From       string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To         string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr string `json:"filter_expr,omitempty"`
}
type mcpGetHighMemorySessionsInput struct {
	AppID      string `json:"app_id" jsonschema:"UUID of the app to query"`
	From       string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To         string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr string `json:"filter_expr,omitempty"`
	Limit      int    `json:"limit,omitempty" jsonschema:"Maximum sessions to return (default: 10, max: 30)"`
	Offset     int    `json:"offset,omitempty" jsonschema:"Number of sessions to skip for pagination (default: 0)"`
}
type mcpGetBugReportsInput struct {
	AppID      string `json:"app_id" jsonschema:"UUID of the app to query"`
	From       string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To         string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr string `json:"filter_expr,omitempty"`
	Limit      int    `json:"limit,omitempty" jsonschema:"Maximum number of bug reports to return (default: 10)"`
	Offset     int    `json:"offset,omitempty" jsonschema:"Number of bug reports to skip for pagination (default: 0)"`
}
type mcpGetBugReportsOverTimeInput struct {
	AppID      string `json:"app_id" jsonschema:"UUID of the app to query"`
	From       string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To         string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr string `json:"filter_expr,omitempty"`
	Timezone   string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetBugReportInput struct {
	AppID       string `json:"app_id" jsonschema:"UUID of the app"`
	BugReportID string `json:"bug_report_id" jsonschema:"ID of the bug report"`
}
type mcpGetRootSpanNamesInput struct {
	AppID string `json:"app_id" jsonschema:"UUID of the app"`
}
type mcpGetSpanInstancesInput struct {
	AppID        string `json:"app_id" jsonschema:"UUID of the app to query"`
	RootSpanName string `json:"root_span_name" jsonschema:"Name of the root span to query"`
	From         string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To           string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr   string `json:"filter_expr,omitempty"`
	Limit        int    `json:"limit,omitempty" jsonschema:"Maximum number of spans to return (default: 10)"`
	Offset       int    `json:"offset,omitempty" jsonschema:"Number of spans to skip for pagination (default: 0)"`
}
type mcpGetSpanMetricsOverTimeInput struct {
	AppID        string `json:"app_id" jsonschema:"UUID of the app to query"`
	RootSpanName string `json:"root_span_name" jsonschema:"Name of the root span to query"`
	From         string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To           string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr   string `json:"filter_expr,omitempty"`
	Timezone     string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetTraceInput struct {
	AppID   string `json:"app_id" jsonschema:"UUID of the app"`
	TraceID string `json:"trace_id" jsonschema:"ID of the trace"`
}
type mcpGetAlertsInput struct {
	AppID  string `json:"app_id" jsonschema:"UUID of the app to query"`
	From   string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To     string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	Limit  int    `json:"limit,omitempty" jsonschema:"Maximum number of alerts to return (default: 10)"`
	Offset int    `json:"offset,omitempty" jsonschema:"Number of alerts to skip for pagination (default: 0)"`
}
type mcpGetJourneyInput struct {
	AppID      string `json:"app_id" jsonschema:"UUID of the app to query"`
	From       string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To         string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr string `json:"filter_expr,omitempty"`
}
type mcpGetErrorCommonPathInput struct {
	AppID        string `json:"app_id" jsonschema:"UUID of the app to query"`
	ErrorGroupID string `json:"error_group_id" jsonschema:"Fingerprint/ID of the error group"`
}
type mcpUpdateBugReportStatusInput struct {
	AppID       string `json:"app_id" jsonschema:"UUID of the app"`
	BugReportID string `json:"bug_report_id" jsonschema:"ID of the bug report"`
	Status      *int   `json:"status" jsonschema:"New status: 0 (open) or 1 (closed)"`
}

// Network tool input structs.
type mcpGetNetworkTrendsInput struct {
	AppID      string `json:"app_id" jsonschema:"UUID of the app to query"`
	From       string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To         string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr string `json:"filter_expr,omitempty"`
	Limit      int    `json:"limit,omitempty" jsonschema:"Maximum number of endpoints to return per category (1-50, default 10)"`
}
type mcpGetAppHttpStatusCodesOverTimeInput struct {
	AppID      string `json:"app_id" jsonschema:"UUID of the app to query"`
	From       string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To         string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr string `json:"filter_expr,omitempty"`
	Domain     string `json:"domain,omitempty" jsonschema:"Restrict to an exact domain or * wildcard pattern (e.g. api.example.com or *.example.com)"`
	Path       string `json:"path,omitempty" jsonschema:"Restrict to an exact, * or ** path pattern across all domains when domain is omitted (e.g. /v1/users or /v1/*)"`
	Timezone   string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetNetworkLatencyOverTimeInput struct {
	AppID      string `json:"app_id" jsonschema:"UUID of the app to query"`
	From       string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To         string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr string `json:"filter_expr,omitempty"`
	Domain     string `json:"domain,omitempty" jsonschema:"Restrict to an exact domain or * wildcard pattern (e.g. api.example.com or *.example.com)"`
	Path       string `json:"path,omitempty" jsonschema:"Restrict to an exact, * or ** path pattern across all domains when domain is omitted (e.g. /v1/users or /v1/*)"`
	Timezone   string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetHttpEndpointStatusCodesOverTimeInput struct {
	AppID      string `json:"app_id" jsonschema:"UUID of the app to query"`
	From       string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To         string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr string `json:"filter_expr,omitempty"`
	Domain     string `json:"domain,omitempty" jsonschema:"Restrict to a domain (e.g. api.example.com)"`
	Path       string `json:"path,omitempty" jsonschema:"Restrict to a path across all domains when domain is omitted (e.g. /v1/users)"`
	Timezone   string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetNetworkTimelineInput struct {
	AppID      string `json:"app_id" jsonschema:"UUID of the app to query"`
	From       string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To         string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr string `json:"filter_expr,omitempty"`
	Domain     string `json:"domain,omitempty" jsonschema:"Restrict to an exact domain or * wildcard pattern (e.g. api.example.com or *.example.com)"`
	Path       string `json:"path,omitempty" jsonschema:"Restrict to an exact, * or ** path pattern across all domains when domain is omitted (e.g. /v1/users or /v1/*)"`
}

// Funnel tool input structs.
type mcpGetFunnelsInput struct {
	AppID  string `json:"app_id" jsonschema:"UUID of the app to query"`
	Search string `json:"search,omitempty" jsonschema:"Return only funnels whose name contains this text"`
	Limit  int    `json:"limit,omitempty" jsonschema:"Maximum number of funnels to return (default: 10, max: 30)"`
	Offset int    `json:"offset,omitempty" jsonschema:"Number of funnels to skip for pagination (default: 0)"`
}
type mcpGetPinnedFunnelsInput struct {
	AppID string `json:"app_id" jsonschema:"UUID of the app to query"`
}
type mcpGetFunnelInput struct {
	AppID    string `json:"app_id" jsonschema:"UUID of the app"`
	FunnelID string `json:"funnel_id" jsonschema:"UUID of the funnel"`
}
type mcpGetFunnelEventNamesInput struct {
	AppID  string `json:"app_id" jsonschema:"UUID of the app to query"`
	Search string `json:"search,omitempty" jsonschema:"Return only event names containing this text"`
}
type mcpGetFunnelConversionInput struct {
	AppID      string `json:"app_id" jsonschema:"UUID of the app to query"`
	FunnelID   string `json:"funnel_id" jsonschema:"UUID of the funnel"`
	From       string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To         string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr string `json:"filter_expr,omitempty"`
}
type mcpGetFunnelTrendInput struct {
	AppID         string `json:"app_id" jsonschema:"UUID of the app to query"`
	FunnelID      string `json:"funnel_id" jsonschema:"UUID of the funnel"`
	Period        string `json:"period" jsonschema:"Length of each point: day, week or month"`
	Timezone      string `json:"timezone" jsonschema:"Timezone the periods start in (e.g. America/New_York)"`
	FilterExpr    string `json:"filter_expr,omitempty"`
	IncludeBuilds bool   `json:"include_builds,omitempty" jsonschema:"Add the builds and patches first uploaded during the trend (default: false)"`
}
type mcpGetFunnelCadenceInput struct {
	AppID      string `json:"app_id" jsonschema:"UUID of the app to query"`
	FunnelID   string `json:"funnel_id" jsonschema:"UUID of the funnel"`
	Weeks      int    `json:"weeks" jsonschema:"Number of weeks to count, from 1 to 12"`
	Timezone   string `json:"timezone" jsonschema:"Timezone of the weekdays and hours (e.g. America/New_York)"`
	FilterExpr string `json:"filter_expr,omitempty"`
}
type mcpGetFunnelStepErrorsInput struct {
	AppID      string `json:"app_id" jsonschema:"UUID of the app to query"`
	FunnelID   string `json:"funnel_id" jsonschema:"UUID of the funnel"`
	Step       *int   `json:"step,omitempty" jsonschema:"Index of the later of the two steps, the one users try to reach, counting the first step as 0: for a funnel with steps A, B and C, 1 looks at users getting from A to B, and 2 at users getting from B to C. From 1 to the number of steps minus 1 (default: the whole funnel)"`
	From       string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To         string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr string `json:"filter_expr,omitempty"`
	Limit      int    `json:"limit,omitempty" jsonschema:"Maximum number of error groups to return (default: 10, max: 30)"`
	Offset     int    `json:"offset,omitempty" jsonschema:"Number of error groups to skip for pagination (default: 0)"`
}
type mcpGetFunnelStepTracesInput struct {
	AppID      string `json:"app_id" jsonschema:"UUID of the app to query"`
	FunnelID   string `json:"funnel_id" jsonschema:"UUID of the funnel"`
	Step       *int   `json:"step,omitempty" jsonschema:"Index of the later of the two steps, the one users try to reach, counting the first step as 0: for a funnel with steps A, B and C, 1 looks at users getting from A to B, and 2 at users getting from B to C. From 1 to the number of steps minus 1 (default: the whole funnel)"`
	Quantile   string `json:"quantile,omitempty" jsonschema:"Quantile of the durations: p50, p90, p95 or p99 (default: p50)"`
	From       string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To         string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr string `json:"filter_expr,omitempty"`
	Limit      int    `json:"limit,omitempty" jsonschema:"Maximum number of span names to return (default: 10, max: 30)"`
	Offset     int    `json:"offset,omitempty" jsonschema:"Number of span names to skip for pagination (default: 0)"`
}
type mcpGetFunnelStepNetworkInput struct {
	AppID      string `json:"app_id" jsonschema:"UUID of the app to query"`
	FunnelID   string `json:"funnel_id" jsonschema:"UUID of the funnel"`
	Step       *int   `json:"step,omitempty" jsonschema:"Index of the later of the two steps, the one users try to reach, counting the first step as 0: for a funnel with steps A, B and C, 1 looks at users getting from A to B, and 2 at users getting from B to C. From 1 to the number of steps minus 1 (default: the whole funnel)"`
	Quantile   string `json:"quantile,omitempty" jsonschema:"Quantile of the latencies: p50, p90, p95 or p99 (default: p50)"`
	From       string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To         string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr string `json:"filter_expr,omitempty"`
	Limit      int    `json:"limit,omitempty" jsonschema:"Maximum number of URL patterns to return (default: 10, max: 30)"`
	Offset     int    `json:"offset,omitempty" jsonschema:"Number of URL patterns to skip for pagination (default: 0)"`
}
type mcpGetFunnelStepSessionsInput struct {
	AppID      string `json:"app_id" jsonschema:"UUID of the app to query"`
	FunnelID   string `json:"funnel_id" jsonschema:"UUID of the funnel"`
	Step       *int   `json:"step,omitempty" jsonschema:"Index of the later of the two steps, the one users try to reach, counting the first step as 0: for a funnel with steps A, B and C, 1 looks at users getting from A to B, and 2 at users getting from B to C. From 1 to the number of steps minus 1 (default: the whole funnel)"`
	Outcome    string `json:"outcome" jsonschema:"Whose sessions to list: dropped or converted"`
	From       string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To         string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	FilterExpr string `json:"filter_expr,omitempty"`
	Limit      int    `json:"limit,omitempty" jsonschema:"Maximum number of sessions to return (default: 10, max: 30)"`
	Offset     int    `json:"offset,omitempty" jsonschema:"Number of sessions to skip for pagination (default: 0)"`
}
type mcpCreateFunnelInput struct {
	AppID                   string   `json:"app_id" jsonschema:"UUID of the app"`
	Name                    string   `json:"name" jsonschema:"Name of the funnel"`
	Steps                   []string `json:"steps" jsonschema:"Custom event names of the steps, in order"`
	ConversionWindowSeconds int      `json:"conversion_window_seconds" jsonschema:"Conversion window in seconds, a whole number of minutes from 60 to 2592000"`
}
type mcpUpdateFunnelInput struct {
	AppID                   string   `json:"app_id" jsonschema:"UUID of the app"`
	FunnelID                string   `json:"funnel_id" jsonschema:"UUID of the funnel"`
	Name                    *string  `json:"name,omitempty" jsonschema:"New name of the funnel"`
	Steps                   []string `json:"steps,omitempty" jsonschema:"New custom event names of the steps, in order, replacing every current step"`
	ConversionWindowSeconds *int     `json:"conversion_window_seconds,omitempty" jsonschema:"New conversion window in seconds, a whole number of minutes from 60 to 2592000"`
}
type mcpDeleteFunnelInput struct {
	AppID    string `json:"app_id" jsonschema:"UUID of the app"`
	FunnelID string `json:"funnel_id" jsonschema:"UUID of the funnel"`
}
type mcpSetFunnelPinnedInput struct {
	AppID    string `json:"app_id" jsonschema:"UUID of the app"`
	FunnelID string `json:"funnel_id" jsonschema:"UUID of the funnel"`
	Pinned   *bool  `json:"pinned" jsonschema:"true to pin the funnel, false to unpin it"`
}
type mcpReorderPinnedFunnelsInput struct {
	AppID     string   `json:"app_id" jsonschema:"UUID of the app"`
	FunnelIDs []string `json:"funnel_ids" jsonschema:"UUIDs of every pinned funnel of the app, in the new order"`
}

// --------------------------------------------------------------------------
// Tool helpers
// --------------------------------------------------------------------------

func mcpTextResult(text string) *mcpsdk.CallToolResult {
	return &mcpsdk.CallToolResult{
		Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: text}},
	}
}

// mcpResolveAppAccess validates app_id, checks user access, and returns appID + teamID.
func (c *Config) mcpResolveAppAccess(ctx context.Context, rawAppID string) (uuid.UUID, uuid.UUID, error) {
	deps := c.Deps
	userID, ok := UserIDFromContext(ctx)
	if !ok {
		return uuid.UUID{}, uuid.UUID{}, fmt.Errorf("unauthorized: no user in context")
	}

	if rawAppID == "" {
		return uuid.UUID{}, uuid.UUID{}, fmt.Errorf("app_id is required")
	}

	appID, err := uuid.Parse(rawAppID)
	if err != nil {
		return uuid.UUID{}, uuid.UUID{}, fmt.Errorf("app_id is not a valid UUID")
	}

	pgPool := deps.PgPool
	stmt := sqlf.PostgreSQL.
		Select("count(*)").
		From("apps a").
		Join("team_membership tm", "a.team_id = tm.team_id").
		Where("a.id = ?", appID).
		Where("tm.user_id = ?", userID)
	defer stmt.Close()

	var count int
	err = pgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&count)
	if err != nil {
		return uuid.UUID{}, uuid.UUID{}, fmt.Errorf("failed to check app access: %w", err)
	}
	if count == 0 {
		return uuid.UUID{}, uuid.UUID{}, fmt.Errorf("app not found or access denied")
	}

	app := &measure.App{ID: &appID}
	team, err := app.GetTeam(ctx, deps.PgPool)
	if err != nil {
		return uuid.UUID{}, uuid.UUID{}, fmt.Errorf("failed to get app team: %v", err)
	}
	if team == nil {
		return uuid.UUID{}, uuid.UUID{}, fmt.Errorf("no team exists for app %s", appID)
	}

	// A team-scoped turn may only touch the scoped team's apps, even when
	// the asker belongs to the app's team: the reply is read by the scoped
	// team's channel.
	if scopeTeamID, ok := teamScopeFromContext(ctx); ok && *team.ID != scopeTeamID {
		return uuid.UUID{}, uuid.UUID{}, fmt.Errorf("app not found or access denied")
	}

	return appID, *team.ID, nil
}

// mcpFilter builds the filter.Filter a query tool passes to the
// given entity's queries, parsing the tool's filter_expr input into the
// filter tree. The caller still sets Limit, Offset and Timezone, then runs
// Validate.
func mcpFilter(entity filter.Entity, appID, teamID uuid.UUID, fromStr, toStr, filterExpr string) (*filter.Filter, error) {
	from, to, err := mcpParseTimeRangeStrings(fromStr, toStr)
	if err != nil {
		return nil, err
	}

	flt := &filter.Filter{
		AppID:      appID,
		TeamID:     teamID,
		Entity:     entity,
		From:       from,
		To:         to,
		Limit:      filter.DefaultPaginationLimit,
		FilterExpr: filterExpr,
	}

	if err := flt.BuildExprTree(); err != nil {
		return nil, mcpFilterExprError(err)
	}

	return flt, nil
}

// mcpPrepareFilter runs the request prologue shared by the tools that
// query with a filter.Filter: it resolves the caller's access to the
// app, builds the filter from the tool's time range and filter_expr inputs,
// lets the tool set its pagination and timezone fields through apply, then
// resolves the filter's custom keys and validates it.
func (c *Config) mcpPrepareFilter(ctx context.Context, entity filter.Entity, rawAppID, from, to, filterExpr string, apply func(*filter.Filter)) (appID, teamID uuid.UUID, flt *filter.Filter, err error) {
	appID, teamID, err = c.mcpResolveAppAccess(ctx, rawAppID)
	if err != nil {
		return uuid.UUID{}, uuid.UUID{}, nil, err
	}

	flt, err = mcpFilter(entity, appID, teamID, from, to, filterExpr)
	if err != nil {
		return uuid.UUID{}, uuid.UUID{}, nil, err
	}

	if apply != nil {
		apply(flt)
	}

	if err := flt.ResolveCustomKeys(ctx, c.Deps.RchPool); err != nil {
		return uuid.UUID{}, uuid.UUID{}, nil, fmt.Errorf("failed to read the filter's custom keys: %v", err)
	}

	if err := flt.Validate(); err != nil {
		return uuid.UUID{}, uuid.UUID{}, nil, mcpFilterExprError(err)
	}

	return appID, teamID, flt, nil
}

// mcpFilterExprError renders a filter_expr parse or validation failure as one
// error whose text names each problem and where in the expression it is, so
// the model can correct the expression and call again. Other errors pass
// through unchanged.
func mcpFilterExprError(err error) error {
	var parseErr *filter.ParseError
	var invalid *filter.ValidationError
	switch {
	case errors.As(err, &parseErr):
		return fmt.Errorf("filter_expr could not be parsed: %s at position %d", parseErr.Message, parseErr.Position)
	case errors.As(err, &invalid):
		messages := make([]string, len(invalid.Issues))
		for i, issue := range invalid.Issues {
			if issue.Span != nil {
				messages[i] = fmt.Sprintf("%s (characters %d-%d)", issue.Message, issue.Span.Start, issue.Span.End)
			} else {
				messages[i] = issue.Message
			}
		}
		return fmt.Errorf("filter_expr is invalid: %s", strings.Join(messages, "; "))
	}
	return err
}

// mcpParseTimeRangeStrings parses optional RFC3339 from/to strings.
// Defaults: from = 7 days ago, to = now.
func mcpParseTimeRangeStrings(fromStr, toStr string) (from, to time.Time, err error) {
	now := time.Now().UTC()
	from = now.AddDate(0, 0, -7)
	to = now

	if fromStr != "" {
		t, parseErr := time.Parse(time.RFC3339, fromStr)
		if parseErr != nil {
			return time.Time{}, time.Time{}, fmt.Errorf("from is not a valid RFC3339 time: %v", parseErr)
		}
		from = t
	}
	if toStr != "" {
		t, parseErr := time.Parse(time.RFC3339, toStr)
		if parseErr != nil {
			return time.Time{}, time.Time{}, fmt.Errorf("to is not a valid RFC3339 time: %v", parseErr)
		}
		to = t
	}
	return
}

// --------------------------------------------------------------------------
// Tool handlers
// --------------------------------------------------------------------------

func (c *Config) mcpListApps(ctx context.Context, _ mcpListAppsInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	userID, ok := UserIDFromContext(ctx)
	if !ok {
		return nil, nil, fmt.Errorf("unauthorized: no user in context")
	}

	pgPool := deps.PgPool
	// The team fields let a caller spanning several teams tell which apps
	// share one, which ask_question requires of its app_ids.
	type appRow struct {
		ID               string   `json:"id"`
		Name             string   `json:"name"`
		OsNames          []string `json:"os_names"`
		UniqueIdentifier string   `json:"unique_identifier"`
		TeamID           string   `json:"team_id"`
		TeamName         string   `json:"team_name"`
	}
	stmt := sqlf.PostgreSQL.
		Select("a.id, coalesce(a.app_name, ''), a.os_names, coalesce(a.unique_identifier, ''), a.team_id, coalesce(t.name, '')").
		From("apps a").
		Join("teams t", "a.team_id = t.id").
		Join("team_membership tm", "a.team_id = tm.team_id").
		Where("tm.user_id = ?", userID).
		OrderBy("t.name, a.created_at desc")
	defer stmt.Close()
	// A team-scoped turn (Slack) lists only that team's apps; without a
	// scope (MCP) the user sees apps of every team they are a member of.
	if teamID, ok := teamScopeFromContext(ctx); ok {
		stmt.Where("a.team_id = ?", teamID)
	}
	rows, err := pgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to query apps: %v", err)
	}
	defer rows.Close()

	var apps []appRow
	for rows.Next() {
		var row appRow
		if err := rows.Scan(&row.ID, &row.Name, &row.OsNames, &row.UniqueIdentifier, &row.TeamID, &row.TeamName); err != nil {
			return nil, nil, fmt.Errorf("failed to query apps: %w", err)
		}
		apps = append(apps, row)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}
	if apps == nil {
		apps = []appRow{}
	}
	data, _ := json.Marshal(apps)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetFilterKeys(ctx context.Context, in mcpGetFilterKeysInput) (*mcpsdk.CallToolResult, any, error) {
	entity, err := filter.FindByName(in.Entity)
	if err != nil {
		return nil, nil, err
	}

	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	ctx = filter.WithFilterQuerySettings(ctx, gin.Mode() == gin.ReleaseMode, gin.Mode() == gin.DebugMode, "filter_keys")
	keys, keysTruncated, err := entity.ListKeys(ctx, c.Deps.RchPool, teamID, appID, in.Keys)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get filter keys: %v", err)
	}

	result := map[string]any{
		"keys":           keys,
		"key_groups":     filter.ListKeyGroups(keys),
		"keys_truncated": keysTruncated,
	}
	data, _ := json.Marshal(result)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetFilterValues(ctx context.Context, in mcpGetFilterValuesInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	entity, err := filter.FindByName(in.Entity)
	if err != nil {
		return nil, nil, err
	}
	if in.KeyName == "" {
		return nil, nil, fmt.Errorf("key_name is required")
	}

	limit := in.Limit
	if limit <= 0 {
		limit = filter.DefaultValueLimit
	}
	if limit > filter.MaxValueLimit {
		return nil, nil, fmt.Errorf("limit cannot be more than %d", filter.MaxValueLimit)
	}

	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	ctx = filter.WithFilterQuerySettings(ctx, gin.Mode() == gin.ReleaseMode, gin.Mode() == gin.DebugMode, "filter_values")
	key, found, err := entity.FindKey(ctx, deps.RchPool, teamID, appID, in.KeyName)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get filter values: %v", err)
	}
	if !found {
		return nil, nil, fmt.Errorf("entity %q has no key %q", entity.Name, in.KeyName)
	}
	if key.ValueSuggestionMode == filter.ValueSuggestionModeNone {
		return nil, nil, fmt.Errorf("key %q takes typed values only and has no value list", key.Name)
	}

	valueList, err := entity.SuggestKeyValues(ctx, deps.PgPool, deps.RchPool, teamID, appID, key, filter.ValueRequest{
		Search: in.Search,
		Limit:  limit,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get filter values: %v", err)
	}

	result := map[string]any{
		"values":    valueList.Values,
		"truncated": valueList.Truncated,
	}
	data, _ := json.Marshal(result)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetMetrics(ctx context.Context, in mcpGetMetricsInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	appID, teamID, flt, err := c.mcpPrepareFilter(ctx, filter.AppHealthEntity, in.AppID, in.From, in.To, in.FilterExpr, nil)
	if err != nil {
		return nil, nil, err
	}

	// Which metrics are read depends on the app's OS family and onboarded
	// state, which only the app row carries.
	app := &measure.App{ID: &appID, TeamId: teamID}
	if err := app.Populate(ctx, deps.PgPool); err != nil {
		return nil, nil, err
	}

	adoption, err := app.GetAdoptionMetrics(ctx, deps.RchPool, flt)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch adoption metrics: %w", err)
	}

	crashFree, perceivedCrashFree, anrFree, perceivedANRFree, err := app.GetIssueFreeMetrics(ctx, deps.RchPool, flt)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch issue free metrics: %w", err)
	}

	launch, err := app.GetLaunchMetrics(ctx, deps.RchPool, flt)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch launch metrics: %w", err)
	}

	adoptionResult := map[string]any{"no_data": true}
	if !adoption.NoData {
		adoptionResult = map[string]any{
			"all_versions":     adoption.AllVersions,
			"selected_version": adoption.SelectedVersion,
			"adoption":         adoption.Adoption,
		}
	}
	result := map[string]any{
		"adoption": adoptionResult,
		"crash_free_sessions": metricResult("crash_free_sessions", crashFree.CrashFreeSessions, crashFree.NoData,
			crashFree.UnselectedCrashFreeSessions, crashFree.UnselectedNoData),
		"perceived_crash_free_sessions": metricResult("perceived_crash_free_sessions", perceivedCrashFree.CrashFreeSessions, perceivedCrashFree.NoData,
			perceivedCrashFree.UnselectedCrashFreeSessions, perceivedCrashFree.UnselectedNoData),
		"cold_launch": metricResult("p95", launch.ColdLaunchP95, launch.ColdNoData, launch.UnselectedColdLaunchP95, launch.UnselectedColdNoData),
		"warm_launch": metricResult("p95", launch.WarmLaunchP95, launch.WarmNoData, launch.UnselectedWarmLaunchP95, launch.UnselectedWarmNoData),
		"hot_launch":  metricResult("p95", launch.HotLaunchP95, launch.HotNoData, launch.UnselectedHotLaunchP95, launch.UnselectedHotNoData),
	}
	// Apps that do not run on Android have no ANR metrics.
	if anrFree != nil {
		result["anr_free_sessions"] = metricResult("anr_free_sessions", anrFree.ANRFreeSessions, anrFree.NoData,
			anrFree.UnselectedANRFreeSessions, anrFree.UnselectedNoData)
		result["perceived_anr_free_sessions"] = metricResult("perceived_anr_free_sessions", perceivedANRFree.ANRFreeSessions, perceivedANRFree.NoData,
			perceivedANRFree.UnselectedANRFreeSessions, perceivedANRFree.UnselectedNoData)
	}

	sizes, err := app.GetSizeMetrics(ctx, deps.PgPool, deps.RchPool, flt)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch size metrics: %w", err)
	}
	switch {
	case sizes.NoData:
		result["sizes"] = map[string]any{"no_data": true}
	case sizes.MultipleVersions:
		result["sizes"] = map[string]any{"multiple_versions": true}
	default:
		result["sizes"] = sizes
	}

	data, _ := json.Marshal(result)
	return mcpTextResult(string(data)), nil, nil
}

// metricResult leaves out a value with no data behind it, which is a
// placeholder zero the model would otherwise report as a real value. The
// unselected value is the metric for the app versions the filter leaves out.
func metricResult(name string, value float64, noData bool, unselectedValue float64, unselectedNoData bool) map[string]any {
	if noData {
		return map[string]any{"no_data": true}
	}
	result := map[string]any{name: value}
	if unselectedNoData {
		result["unselected_no_data"] = true
	} else {
		result["unselected_"+name] = unselectedValue
	}
	return result
}

func (c *Config) mcpGetAppHealthOverTime(ctx context.Context, in mcpGetAppHealthOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	if in.Timezone == "" {
		return nil, nil, fmt.Errorf("timezone is required for over time tools")
	}

	appID, teamID, flt, err := c.mcpPrepareFilter(ctx, filter.AppHealthEntity, in.AppID, in.From, in.To, in.FilterExpr, func(flt *filter.Filter) {
		flt.Timezone = in.Timezone
	})
	if err != nil {
		return nil, nil, err
	}

	app := &measure.App{ID: &appID, TeamId: teamID}
	sessions, crashes, anrs, plotErr := app.GetHealthPlotInstances(ctx, deps.RchPool, flt)
	if plotErr != nil {
		return nil, nil, fmt.Errorf("failed to get app health plot: %v", plotErr)
	}

	build := func(points []measure.HealthInstance) []map[string]any {
		series := make([]map[string]any, 0, len(points))
		for i := range points {
			series = append(series, map[string]any{
				"datetime":  points[i].DateTime,
				"instances": points[i].Instances,
			})
		}
		return series
	}

	result := map[string]any{
		"sessions": build(sessions),
		"crashes":  build(crashes),
		"anrs":     build(anrs),
	}

	data, _ := json.Marshal(result)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetErrors(ctx context.Context, in mcpGetErrorsInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	appID, teamID, flt, err := c.mcpPrepareFilter(ctx, filter.ErrorsEntity, in.AppID, in.From, in.To, in.FilterExpr, func(flt *filter.Filter) {
		limit := in.Limit
		if limit <= 0 {
			limit = 10
		}
		if limit > 30 {
			limit = 30
		}
		flt.Limit = limit
		flt.Offset = in.Offset
	})
	if err != nil {
		return nil, nil, err
	}

	app := &measure.App{ID: &appID, TeamId: teamID}
	groups, _, _, groupErr := app.GetErrorGroupsWithFilter(ctx, deps.RchPool, flt)
	if groupErr != nil {
		return nil, nil, fmt.Errorf("failed to get error groups: %v", groupErr)
	}
	if in.IncludeTrend {
		if err := app.FillErrorGroupTrends(ctx, deps.RchPool, flt, groups); err != nil {
			return nil, nil, fmt.Errorf("failed to get error group trends: %v", err)
		}
	}
	data, _ := json.Marshal(groups)

	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetError(ctx context.Context, in mcpGetErrorInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	if in.ErrorGroupID == "" {
		return nil, nil, fmt.Errorf("error_group_id is required")
	}

	appID, teamID, flt, err := c.mcpPrepareFilter(ctx, filter.ErrorGroupEventsEntity, in.AppID, in.From, in.To, in.FilterExpr, func(flt *filter.Filter) {
		limit := in.Limit
		if limit <= 0 {
			limit = 1
		}
		if limit > 5 {
			limit = 5
		}
		flt.Limit = limit
		flt.Offset = in.Offset
	})
	if err != nil {
		return nil, nil, err
	}

	app := &measure.App{ID: &appID, TeamId: teamID}
	events, _, _, evErr := app.GetErrorsWithFilter(ctx, deps.RchPool, in.ErrorGroupID, flt)
	if evErr != nil {
		return nil, nil, fmt.Errorf("failed to get error details: %v", evErr)
	}
	data, _ := json.Marshal(events)

	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetErrorsOverTime(ctx context.Context, in mcpGetErrorsOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	if in.Timezone == "" {
		return nil, nil, fmt.Errorf("timezone is required for over time tools")
	}

	appID, teamID, flt, err := c.mcpPrepareFilter(ctx, filter.ErrorsEntity, in.AppID, in.From, in.To, in.FilterExpr, func(flt *filter.Filter) {
		flt.Timezone = in.Timezone
	})
	if err != nil {
		return nil, nil, err
	}

	app := &measure.App{ID: &appID, TeamId: teamID}
	plotCtx := ambient.WithTeamId(ctx, teamID)
	instances, plotErr := app.GetErrorPlotInstances(plotCtx, deps.RchPool, flt)
	if plotErr != nil {
		return nil, nil, fmt.Errorf("failed to get error overview plot: %v", plotErr)
	}
	data, _ := json.Marshal(instances)

	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetErrorOverTime(ctx context.Context, in mcpGetErrorOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	if in.ErrorGroupID == "" {
		return nil, nil, fmt.Errorf("error_group_id is required")
	}
	if in.Timezone == "" {
		return nil, nil, fmt.Errorf("timezone is required for over time tools")
	}

	appID, teamID, flt, err := c.mcpPrepareFilter(ctx, filter.ErrorGroupEventsEntity, in.AppID, in.From, in.To, in.FilterExpr, func(flt *filter.Filter) {
		flt.Timezone = in.Timezone
	})
	if err != nil {
		return nil, nil, err
	}

	app := &measure.App{ID: &appID, TeamId: teamID}
	plotCtx := ambient.WithTeamId(ctx, teamID)
	instances, plotErr := app.GetErrorGroupPlotInstances(plotCtx, deps.RchPool, in.ErrorGroupID, flt)
	if plotErr != nil {
		return nil, nil, fmt.Errorf("failed to get error detail plot: %v", plotErr)
	}
	data, _ := json.Marshal(instances)

	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetErrorDistribution(ctx context.Context, in mcpGetErrorDistributionInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	if in.ErrorGroupID == "" {
		return nil, nil, fmt.Errorf("error_group_id is required")
	}

	appID, teamID, flt, err := c.mcpPrepareFilter(ctx, filter.ErrorGroupEventsEntity, in.AppID, in.From, in.To, in.FilterExpr, nil)
	if err != nil {
		return nil, nil, err
	}

	app := &measure.App{ID: &appID, TeamId: teamID}
	distCtx := ambient.WithTeamId(ctx, teamID)

	if in.Attribute != "" {
		if !measure.IsErrorDistributionAttribute(in.Attribute) {
			return nil, nil, fmt.Errorf("attribute must be one of app_version, os_version, country, network_type, locale or device")
		}
		distribution, distErr := app.GetErrorGroupSingleAttributeDistribution(distCtx, deps.RchPool, in.ErrorGroupID, in.Attribute, flt)
		if distErr != nil {
			return nil, nil, fmt.Errorf("failed to get error distribution: %v", distErr)
		}
		data, _ := json.Marshal(distribution)

		return mcpTextResult(string(data)), nil, nil
	}

	distribution, distErr := app.GetErrorGroupAttributesDistribution(distCtx, deps.RchPool, in.ErrorGroupID, flt)
	if distErr != nil {
		return nil, nil, fmt.Errorf("failed to get error distribution: %v", distErr)
	}
	data, _ := json.Marshal(distribution)

	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetSessions(ctx context.Context, in mcpGetSessionsInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	appID, teamID, flt, err := c.mcpPrepareFilter(ctx, filter.SessionsEntity, in.AppID, in.From, in.To, in.FilterExpr, func(flt *filter.Filter) {
		limit := in.Limit
		if limit <= 0 {
			limit = 10
		}
		if limit > 30 {
			limit = 30
		}
		flt.Limit = limit
		flt.Offset = in.Offset
	})
	if err != nil {
		return nil, nil, err
	}

	app := &measure.App{ID: &appID, TeamId: teamID}
	sessCtx := ambient.WithTeamId(ctx, teamID)
	sessions, _, _, sessErr := app.GetSessionsWithFilter(sessCtx, deps.RchPool, flt)
	if sessErr != nil {
		return nil, nil, fmt.Errorf("failed to get session timelines: %v", sessErr)
	}
	data, _ := json.Marshal(sessions)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetSessionsOverTime(ctx context.Context, in mcpGetSessionsOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	if in.Timezone == "" {
		return nil, nil, fmt.Errorf("timezone is required for over time tools")
	}

	appID, teamID, flt, err := c.mcpPrepareFilter(ctx, filter.SessionsEntity, in.AppID, in.From, in.To, in.FilterExpr, func(flt *filter.Filter) {
		flt.Timezone = in.Timezone
	})
	if err != nil {
		return nil, nil, err
	}

	app := &measure.App{ID: &appID, TeamId: teamID}
	plotCtx := ambient.WithTeamId(ctx, teamID)
	instances, plotErr := app.GetSessionsInstancesPlot(plotCtx, deps.RchPool, flt)
	if plotErr != nil {
		return nil, nil, fmt.Errorf("failed to get session timelines plot: %v", plotErr)
	}
	data, _ := json.Marshal(instances)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetSession(ctx context.Context, in mcpGetSessionInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	if in.SessionID == "" {
		return nil, nil, fmt.Errorf("session_id is required")
	}

	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	sessionUUID, parseErr := uuid.Parse(in.SessionID)
	if parseErr != nil {
		return nil, nil, fmt.Errorf("session_id is not a valid UUID")
	}
	app := &measure.App{ID: &appID, TeamId: teamID}
	session, sessErr := app.GetSessionEvents(ctx, deps.RchPool, sessionUUID)
	if sessErr != nil {
		return nil, nil, fmt.Errorf("failed to get session details: %v", sessErr)
	}
	data, _ := json.Marshal(session)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetMemoryUsageOverTime(ctx context.Context, in mcpGetMemoryUsageOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
	if in.Timezone == "" {
		return nil, nil, fmt.Errorf("timezone is required for over time tools")
	}

	appID, teamID, flt, err := c.mcpPrepareFilter(ctx, filter.MemoryEntity, in.AppID, in.From, in.To, in.FilterExpr, func(flt *filter.Filter) {
		flt.Timezone = in.Timezone
		flt.PlotTimeGroup = in.PlotTimeGroup
	})
	if err != nil {
		return nil, nil, err
	}

	app := &measure.App{ID: &appID, TeamId: teamID}
	if err := app.Populate(ctx, c.Deps.PgPool); err != nil {
		return nil, nil, fmt.Errorf("failed to populate app: %w", err)
	}
	points, err := app.GetMemoryUsagePlot(ctx, c.Deps.RchPool, flt)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch memory usage over time: %w", err)
	}
	data, _ := json.Marshal(points)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetMemoryUsageByDeviceTier(ctx context.Context, in mcpGetMemoryUsageByDeviceTierInput) (*mcpsdk.CallToolResult, any, error) {
	appID, teamID, flt, err := c.mcpPrepareFilter(ctx, filter.MemoryEntity, in.AppID, in.From, in.To, in.FilterExpr, nil)
	if err != nil {
		return nil, nil, err
	}

	app := &measure.App{ID: &appID, TeamId: teamID}
	if err := app.Populate(ctx, c.Deps.PgPool); err != nil {
		return nil, nil, fmt.Errorf("failed to populate app: %w", err)
	}
	breakdown, err := app.GetMemoryUsageBreakdown(ctx, c.Deps.RchPool, flt)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch memory usage by device tier: %w", err)
	}
	data, _ := json.Marshal(breakdown)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetHighMemorySessions(ctx context.Context, in mcpGetHighMemorySessionsInput) (*mcpsdk.CallToolResult, any, error) {
	appID, teamID, flt, err := c.mcpPrepareFilter(ctx, filter.MemoryEntity, in.AppID, in.From, in.To, in.FilterExpr, func(flt *filter.Filter) {
		limit := in.Limit
		if limit <= 0 {
			limit = 10
		}
		if limit > 30 {
			limit = 30
		}
		flt.Limit = limit
		flt.Offset = in.Offset
	})
	if err != nil {
		return nil, nil, err
	}

	app := &measure.App{ID: &appID, TeamId: teamID}
	if err := app.Populate(ctx, c.Deps.PgPool); err != nil {
		return nil, nil, fmt.Errorf("failed to populate app: %w", err)
	}
	sessions, next, previous, err := app.GetHighMemoryUsageSessions(ctx, c.Deps.RchPool, flt)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch high memory sessions: %w", err)
	}
	result := map[string]any{
		"results": sessions,
		"meta": map[string]bool{
			"next":     next,
			"previous": previous,
		},
	}
	data, _ := json.Marshal(result)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetBugReports(ctx context.Context, in mcpGetBugReportsInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	appID, teamID, flt, err := c.mcpPrepareFilter(ctx, filter.BugReportsEntity, in.AppID, in.From, in.To, in.FilterExpr, func(flt *filter.Filter) {
		limit := in.Limit
		if limit <= 0 {
			limit = 10
		}
		if limit > 30 {
			limit = 30
		}
		flt.Limit = limit
		flt.Offset = in.Offset
	})
	if err != nil {
		return nil, nil, err
	}

	app := &measure.App{ID: &appID, TeamId: teamID}
	bugCtx := ambient.WithTeamId(ctx, teamID)
	bugReports, _, _, bugErr := app.GetBugReportsWithFilter(bugCtx, deps.RchPool, flt)
	if bugErr != nil {
		return nil, nil, fmt.Errorf("failed to get bug reports: %v", bugErr)
	}
	data, _ := json.Marshal(bugReports)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetBugReportsOverTime(ctx context.Context, in mcpGetBugReportsOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	if in.Timezone == "" {
		return nil, nil, fmt.Errorf("timezone is required for over time tools")
	}

	appID, teamID, flt, err := c.mcpPrepareFilter(ctx, filter.BugReportsEntity, in.AppID, in.From, in.To, in.FilterExpr, func(flt *filter.Filter) {
		flt.Timezone = in.Timezone
	})
	if err != nil {
		return nil, nil, err
	}

	app := &measure.App{ID: &appID, TeamId: teamID}
	plotCtx := ambient.WithTeamId(ctx, teamID)
	instances, plotErr := app.GetBugReportInstancesPlot(plotCtx, deps.RchPool, flt)
	if plotErr != nil {
		return nil, nil, fmt.Errorf("failed to get bug reports plot: %v", plotErr)
	}
	data, _ := json.Marshal(instances)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetBugReport(ctx context.Context, in mcpGetBugReportInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	if in.BugReportID == "" {
		return nil, nil, fmt.Errorf("bug_report_id is required")
	}

	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	app := &measure.App{ID: &appID, TeamId: teamID}
	bugReport, bugErr := app.GetBugReportById(ctx, deps.RchPool, presignConfig(deps), in.BugReportID)
	if bugErr != nil {
		return nil, nil, fmt.Errorf("failed to get bug report details: %v", bugErr)
	}
	data, _ := json.Marshal(bugReport)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetRootSpanNames(ctx context.Context, in mcpGetRootSpanNamesInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	app := &measure.App{ID: &appID, TeamId: teamID}
	names, spanErr := app.FetchRootSpanNames(ctx, deps.RchPool)
	if spanErr != nil {
		return nil, nil, fmt.Errorf("failed to get root span names: %v", spanErr)
	}
	if names == nil {
		names = []string{}
	}
	data, _ := json.Marshal(names)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetSpanInstances(ctx context.Context, in mcpGetSpanInstancesInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	if in.RootSpanName == "" {
		return nil, nil, fmt.Errorf("root_span_name is required")
	}

	appID, teamID, flt, err := c.mcpPrepareFilter(ctx, filter.SpansEntity, in.AppID, in.From, in.To, in.FilterExpr, func(flt *filter.Filter) {
		limit := in.Limit
		if limit <= 0 {
			limit = 10
		}
		if limit > 30 {
			limit = 30
		}
		flt.Limit = limit
		flt.Offset = in.Offset
	})
	if err != nil {
		return nil, nil, err
	}

	app := &measure.App{ID: &appID, TeamId: teamID}
	spanCtx := ambient.WithTeamId(ctx, teamID)
	spans, _, _, spanErr := app.GetSpansForSpanNameWithFilter(spanCtx, deps.RchPool, in.RootSpanName, flt)
	if spanErr != nil {
		return nil, nil, fmt.Errorf("failed to get span instances: %v", spanErr)
	}
	data, _ := json.Marshal(spans)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetSpanMetricsOverTime(ctx context.Context, in mcpGetSpanMetricsOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	if in.RootSpanName == "" {
		return nil, nil, fmt.Errorf("root_span_name is required")
	}
	if in.Timezone == "" {
		return nil, nil, fmt.Errorf("timezone is required for over time tools")
	}

	appID, teamID, flt, err := c.mcpPrepareFilter(ctx, filter.SpansEntity, in.AppID, in.From, in.To, in.FilterExpr, func(flt *filter.Filter) {
		flt.Timezone = in.Timezone
	})
	if err != nil {
		return nil, nil, err
	}

	app := &measure.App{ID: &appID, TeamId: teamID}
	plotCtx := ambient.WithTeamId(ctx, teamID)
	instances, plotErr := app.GetMetricsPlotForSpanNameWithFilter(plotCtx, deps.RchPool, in.RootSpanName, flt)
	if plotErr != nil {
		return nil, nil, fmt.Errorf("failed to get span metrics plot: %v", plotErr)
	}
	data, _ := json.Marshal(instances)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetTrace(ctx context.Context, in mcpGetTraceInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	if in.TraceID == "" {
		return nil, nil, fmt.Errorf("trace_id is required")
	}

	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	app := &measure.App{ID: &appID, TeamId: teamID}
	trace, traceErr := app.GetTrace(ctx, deps.RchPool, in.TraceID)
	if traceErr != nil {
		return nil, nil, fmt.Errorf("failed to get trace details: %v", traceErr)
	}
	data, _ := json.Marshal(trace)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetAlerts(ctx context.Context, in mcpGetAlertsInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	_, _, flt, err := c.mcpPrepareFilter(ctx, filter.AlertsEntity, in.AppID, in.From, in.To, "", func(flt *filter.Filter) {
		limit := in.Limit
		if limit <= 0 {
			limit = 10
		}
		if limit > 30 {
			limit = 30
		}
		flt.Limit = limit
		flt.Offset = in.Offset
	})
	if err != nil {
		return nil, nil, err
	}

	alerts, _, _, alertErr := measure.GetAlertsWithFilter(ctx, deps.PgPool, flt)
	if alertErr != nil {
		return nil, nil, fmt.Errorf("failed to get alerts: %v", alertErr)
	}
	data, _ := json.Marshal(alerts)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetJourney(ctx context.Context, in mcpGetJourneyInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	appID, teamID, flt, err := c.mcpPrepareFilter(ctx, filter.JourneysEntity, in.AppID, in.From, in.To, in.FilterExpr, nil)
	if err != nil {
		return nil, nil, err
	}

	app := &measure.App{ID: &appID, TeamId: teamID}
	if err := app.Populate(ctx, deps.PgPool); err != nil {
		return nil, nil, err
	}
	journeyCtx := ambient.WithTeamId(ctx, teamID)

	g, journeyErr := app.GetJourneyGraph(journeyCtx, deps.RchPool, flt)
	if journeyErr != nil {
		return nil, nil, fmt.Errorf("failed to get journey: %v", journeyErr)
	}

	type journeyNode struct {
		Source string `json:"source"`
		Target string `json:"target"`
		Value  uint64 `json:"value"`
	}

	type result struct {
		Nodes []string      `json:"nodes"`
		Links []journeyNode `json:"links"`
	}

	var links []journeyNode
	for _, edge := range g.Edges {
		links = append(links, journeyNode{Source: edge.Source, Target: edge.Target, Value: edge.Sessions})
	}

	data, _ := json.Marshal(result{Nodes: g.Nodes, Links: links})
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetErrorCommonPath(ctx context.Context, in mcpGetErrorCommonPathInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	if in.ErrorGroupID == "" {
		return nil, nil, fmt.Errorf("error_group_id is required")
	}

	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	data, pathErr := measure.GetIssueGroupCommonPath(ctx, deps.RchPool, teamID, appID, group.GroupTypeError, in.ErrorGroupID)
	if pathErr != nil {
		return nil, nil, fmt.Errorf("failed to get error common path: %v", pathErr)
	}

	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpUpdateBugReportStatus(ctx context.Context, in mcpUpdateBugReportStatusInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	if in.BugReportID == "" {
		return nil, nil, fmt.Errorf("bug_report_id is required")
	}
	if in.Status == nil {
		return nil, nil, fmt.Errorf("status is required (0 for open, 1 for closed)")
	}
	status := *in.Status
	if status != 0 && status != 1 {
		return nil, nil, fmt.Errorf("status must be 0 (open) or 1 (closed)")
	}

	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	// Updating a bug report is a write; membership alone is not enough.
	userID, _ := UserIDFromContext(ctx)
	allowed, err := measure.PerformAuthz(deps.PgPool, userID, teamID.String(), *measure.ScopeBugReportAll)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to perform authorization: %v", err)
	}
	if !allowed {
		return nil, nil, fmt.Errorf("you are not authorized to update bug reports; ask a team admin for access")
	}

	app := &measure.App{ID: &appID, TeamId: teamID}
	if err := app.UpdateBugReportStatusById(ctx, deps.ChPool, in.BugReportID, uint8(status)); err != nil {
		return nil, nil, fmt.Errorf("failed to update bug report status: %v", err)
	}

	return mcpTextResult(`{"ok":"done"}`), nil, nil
}

// --------------------------------------------------------------------------
// Network tool helpers & handlers
// --------------------------------------------------------------------------

func (c *Config) mcpGetNetworkTrends(ctx context.Context, in mcpGetNetworkTrendsInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	limit := in.Limit
	if limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}

	appID, teamID, flt, err := c.mcpPrepareFilter(ctx, filter.NetworkEntity, in.AppID, in.From, in.To, in.FilterExpr, nil)
	if err != nil {
		return nil, nil, err
	}

	result, err := network.FetchTrends(ctx, deps.RchPool, appID, teamID, flt, limit)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get network trends: %v", err)
	}
	data, _ := json.Marshal(result)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetAppStatusCodesOverTime(ctx context.Context, in mcpGetAppHttpStatusCodesOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	if in.Timezone == "" {
		return nil, nil, fmt.Errorf("timezone is required for over time tools")
	}

	appID, teamID, flt, err := c.mcpPrepareFilter(ctx, filter.NetworkEntity, in.AppID, in.From, in.To, in.FilterExpr, func(flt *filter.Filter) {
		flt.Timezone = in.Timezone
		flt.SetDefaultPlotTimeGroupIfUnset()
	})
	if err != nil {
		return nil, nil, err
	}

	groupExpr, err := measure.GetPlotTimeGroupExpr("timestamp", flt.PlotTimeGroup)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to compute time group expression: %v", err)
	}

	result, err := network.GetStatusCodesPlot(ctx, deps.RchPool, appID, teamID, in.Domain, in.Path, flt, groupExpr.BucketExpr, groupExpr.DatetimeFormat)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get network status overview over time: %v", err)
	}
	data, _ := json.Marshal(result)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetNetworkLatencyOverTime(ctx context.Context, in mcpGetNetworkLatencyOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	if in.Timezone == "" {
		return nil, nil, fmt.Errorf("timezone is required for over time tools")
	}

	appID, teamID, flt, err := c.mcpPrepareFilter(ctx, filter.NetworkEntity, in.AppID, in.From, in.To, in.FilterExpr, func(flt *filter.Filter) {
		flt.Timezone = in.Timezone
		flt.SetDefaultPlotTimeGroupIfUnset()
	})
	if err != nil {
		return nil, nil, err
	}

	groupExpr, err := measure.GetPlotTimeGroupExpr("timestamp", flt.PlotTimeGroup)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to compute time group expression: %v", err)
	}

	result, err := network.GetLatencyPlot(ctx, deps.RchPool, appID, teamID, in.Domain, in.Path, flt, groupExpr.BucketExpr, groupExpr.DatetimeFormat)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get network latency over time: %v", err)
	}
	data, _ := json.Marshal(result)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetHttpEndpointStatusCodesOverTime(ctx context.Context, in mcpGetHttpEndpointStatusCodesOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	if in.Domain == "" && in.Path == "" {
		return nil, nil, fmt.Errorf("domain or path is required")
	}
	if in.Timezone == "" {
		return nil, nil, fmt.Errorf("timezone is required for over time tools")
	}

	appID, teamID, flt, err := c.mcpPrepareFilter(ctx, filter.NetworkEntity, in.AppID, in.From, in.To, in.FilterExpr, func(flt *filter.Filter) {
		flt.Timezone = in.Timezone
		flt.SetDefaultPlotTimeGroupIfUnset()
	})
	if err != nil {
		return nil, nil, err
	}

	groupExpr, err := measure.GetPlotTimeGroupExpr("timestamp", flt.PlotTimeGroup)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to compute time group expression: %v", err)
	}

	result, err := network.GetEndpointStatusCodesPlot(ctx, deps.RchPool, appID, teamID, in.Domain, in.Path, flt, groupExpr.BucketExpr, groupExpr.DatetimeFormat)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get network endpoint status codes over time: %v", err)
	}
	data, _ := json.Marshal(result)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetNetworkTimeline(ctx context.Context, in mcpGetNetworkTimelineInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	appID, teamID, flt, err := c.mcpPrepareFilter(ctx, filter.NetworkEntity, in.AppID, in.From, in.To, in.FilterExpr, nil)
	if err != nil {
		return nil, nil, err
	}

	result, err := network.FetchTimelinePlot(ctx, deps.RchPool, appID, teamID, in.Domain, in.Path, flt)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get network request timeline: %v", err)
	}
	data, _ := json.Marshal(result)
	return mcpTextResult(string(data)), nil, nil
}

// --------------------------------------------------------------------------
// Funnel tool helpers & handlers
// --------------------------------------------------------------------------

// mcpFunnelLimit caps how many rows a funnel list tool returns, so one
// result stays small enough for the model to read.
func mcpFunnelLimit(limit int) int {
	if limit <= 0 {
		return 10
	}
	return min(limit, 30)
}

func mcpParseFunnelID(rawFunnelID string) (uuid.UUID, error) {
	if rawFunnelID == "" {
		return uuid.UUID{}, fmt.Errorf("funnel_id is required")
	}
	funnelID, err := uuid.Parse(rawFunnelID)
	if err != nil {
		return uuid.UUID{}, fmt.Errorf("funnel_id is not a valid UUID")
	}
	return funnelID, nil
}

func (c *Config) mcpLoadFunnel(ctx context.Context, appID uuid.UUID, rawFunnelID string) (measure.Funnel, error) {
	funnelID, err := mcpParseFunnelID(rawFunnelID)
	if err != nil {
		return measure.Funnel{}, err
	}
	funnel, err := measure.GetFunnel(ctx, c.Deps.PgPool, appID, funnelID)
	if errors.Is(err, measure.ErrFunnelNotFound) {
		return measure.Funnel{}, err
	}
	if err != nil {
		return measure.Funnel{}, fmt.Errorf("failed to get funnel: %v", err)
	}
	return funnel, nil
}

// Every member of an app's team can read its funnels, but only some roles can
// change them.
func (c *Config) mcpResolveFunnelWriteAccess(ctx context.Context, rawAppID string) (uuid.UUID, error) {
	appID, teamID, err := c.mcpResolveAppAccess(ctx, rawAppID)
	if err != nil {
		return uuid.UUID{}, err
	}
	userID, _ := UserIDFromContext(ctx)
	allowed, err := measure.PerformAuthz(c.Deps.PgPool, userID, teamID.String(), *measure.ScopeFunnelAll)
	if err != nil {
		return uuid.UUID{}, fmt.Errorf("failed to perform authorization: %v", err)
	}
	if !allowed {
		return uuid.UUID{}, fmt.Errorf("you are not authorized to change funnels; ask a team admin for access")
	}
	return appID, nil
}

// mcpFunnelStepResult names the two steps a step tool covered next to its
// list, so a caller that passed the wrong step can tell from the result.
func mcpFunnelStepResult(funnel measure.Funnel, stepRange measure.FunnelStepRange, key string, list any) *mcpsdk.CallToolResult {
	data, _ := json.Marshal(map[string]any{
		"from_step": funnel.Steps[stepRange.From].EventName,
		"to_step":   funnel.Steps[stepRange.To].EventName,
		key:         list,
	})
	return mcpTextResult(string(data))
}

func (c *Config) mcpPrepareFunnelStep(ctx context.Context, rawAppID, rawFunnelID string, step *int, from, to, filterExpr string, limit, offset int) (measure.Funnel, *filter.Filter, measure.FunnelStepRange, error) {
	appID, _, flt, err := c.mcpPrepareFilter(ctx, filter.FunnelsEntity, rawAppID, from, to, filterExpr, func(flt *filter.Filter) {
		flt.Limit = mcpFunnelLimit(limit)
		flt.Offset = offset
	})
	if err != nil {
		return measure.Funnel{}, nil, measure.FunnelStepRange{}, err
	}
	funnel, err := c.mcpLoadFunnel(ctx, appID, rawFunnelID)
	if err != nil {
		return measure.Funnel{}, nil, measure.FunnelStepRange{}, err
	}
	if step == nil {
		return funnel, flt, measure.FunnelStepRange{From: 0, To: len(funnel.Steps) - 1}, nil
	}
	if *step < 1 || *step >= len(funnel.Steps) {
		return measure.Funnel{}, nil, measure.FunnelStepRange{}, fmt.Errorf("step must be between 1 and %d", len(funnel.Steps)-1)
	}
	return funnel, flt, measure.FunnelStepRange{From: *step - 1, To: *step}, nil
}

func mcpFunnelQuantile(quantile string) (float64, error) {
	if quantile == "" {
		quantile = "p50"
	}
	q, ok := measure.FunnelQuantiles[quantile]
	if !ok {
		return 0, fmt.Errorf("quantile must be one of p50, p90, p95 or p99")
	}
	return q, nil
}

func mcpFunnelSteps(eventNames []string) []measure.FunnelStep {
	steps := make([]measure.FunnelStep, len(eventNames))
	for i, name := range eventNames {
		steps[i] = measure.FunnelStep{EventName: name}
	}
	return steps
}

func (c *Config) mcpGetFunnels(ctx context.Context, in mcpGetFunnelsInput) (*mcpsdk.CallToolResult, any, error) {
	if in.Offset < 0 {
		return nil, nil, fmt.Errorf("offset cannot be negative")
	}
	appID, _, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}
	funnels, _, _, err := measure.GetFunnels(ctx, c.Deps.PgPool, appID, in.Search, mcpFunnelLimit(in.Limit), in.Offset)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get funnels: %v", err)
	}
	data, _ := json.Marshal(funnels)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetPinnedFunnels(ctx context.Context, in mcpGetPinnedFunnelsInput) (*mcpsdk.CallToolResult, any, error) {
	appID, _, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}
	funnels, err := measure.GetPinnedFunnels(ctx, c.Deps.PgPool, appID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get pinned funnels: %v", err)
	}
	data, _ := json.Marshal(funnels)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetFunnel(ctx context.Context, in mcpGetFunnelInput) (*mcpsdk.CallToolResult, any, error) {
	appID, _, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}
	funnel, err := c.mcpLoadFunnel(ctx, appID, in.FunnelID)
	if err != nil {
		return nil, nil, err
	}
	data, _ := json.Marshal(funnel)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetFunnelEventNames(ctx context.Context, in mcpGetFunnelEventNamesInput) (*mcpsdk.CallToolResult, any, error) {
	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}
	names, err := measure.SuggestFunnelEventNames(ctx, c.Deps.RchPool, teamID, appID, in.Search)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get funnel event names: %v", err)
	}
	data, _ := json.Marshal(names)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetFunnelConversion(ctx context.Context, in mcpGetFunnelConversionInput) (*mcpsdk.CallToolResult, any, error) {
	appID, _, flt, err := c.mcpPrepareFilter(ctx, filter.FunnelsEntity, in.AppID, in.From, in.To, in.FilterExpr, nil)
	if err != nil {
		return nil, nil, err
	}
	funnel, err := c.mcpLoadFunnel(ctx, appID, in.FunnelID)
	if err != nil {
		return nil, nil, err
	}
	steps, err := measure.GetFunnelConversionCached(ctx, c.Deps.VK, c.Deps.RchPool, funnel, flt)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get funnel conversion: %v", err)
	}
	data, _ := json.Marshal(map[string]any{"steps": steps})
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetFunnelTrend(ctx context.Context, in mcpGetFunnelTrendInput) (*mcpsdk.CallToolResult, any, error) {
	if in.Timezone == "" {
		return nil, nil, fmt.Errorf("timezone is required")
	}
	period := measure.FunnelTrendPeriod(in.Period)
	if !period.Valid() {
		return nil, nil, fmt.Errorf("period must be one of day, week or month")
	}

	// The trend's periods end with the current one, so the tool takes no
	// time range.
	appID, _, flt, err := c.mcpPrepareFilter(ctx, filter.FunnelsEntity, in.AppID, "", "", in.FilterExpr, func(flt *filter.Filter) {
		flt.Timezone = in.Timezone
	})
	if err != nil {
		return nil, nil, err
	}
	funnel, err := c.mcpLoadFunnel(ctx, appID, in.FunnelID)
	if err != nil {
		return nil, nil, err
	}
	trend, err := measure.GetFunnelTrendCached(ctx, c.Deps.VK, c.Deps.PgPool, c.Deps.RchPool, funnel, flt, period, in.IncludeBuilds)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get funnel trend: %v", err)
	}
	data, _ := json.Marshal(trend)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetFunnelCadence(ctx context.Context, in mcpGetFunnelCadenceInput) (*mcpsdk.CallToolResult, any, error) {
	if in.Timezone == "" {
		return nil, nil, fmt.Errorf("timezone is required")
	}
	if in.Weeks < 1 || in.Weeks > measure.FunnelCadenceMaxWeeks {
		return nil, nil, fmt.Errorf("weeks must be between 1 and %d", measure.FunnelCadenceMaxWeeks)
	}

	// The weeks are counted back from the latest one with a full conversion
	// window, so the tool takes no time range.
	appID, _, flt, err := c.mcpPrepareFilter(ctx, filter.FunnelsEntity, in.AppID, "", "", in.FilterExpr, func(flt *filter.Filter) {
		flt.Timezone = in.Timezone
	})
	if err != nil {
		return nil, nil, err
	}
	funnel, err := c.mcpLoadFunnel(ctx, appID, in.FunnelID)
	if err != nil {
		return nil, nil, err
	}
	cadence, err := measure.GetFunnelCadenceCached(ctx, c.Deps.VK, c.Deps.RchPool, funnel, flt, in.Weeks)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get funnel cadence: %v", err)
	}
	data, _ := json.Marshal(cadence)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetFunnelStepErrors(ctx context.Context, in mcpGetFunnelStepErrorsInput) (*mcpsdk.CallToolResult, any, error) {
	funnel, flt, stepRange, err := c.mcpPrepareFunnelStep(ctx, in.AppID, in.FunnelID, in.Step, in.From, in.To, in.FilterExpr, in.Limit, in.Offset)
	if err != nil {
		return nil, nil, err
	}
	stepErrors, _, _, err := measure.GetFunnelStepErrorsCached(ctx, c.Deps.VK, c.Deps.RchPool, funnel, flt, stepRange)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get funnel step errors: %v", err)
	}
	return mcpFunnelStepResult(funnel, stepRange, "errors", stepErrors), nil, nil
}

func (c *Config) mcpGetFunnelStepTraces(ctx context.Context, in mcpGetFunnelStepTracesInput) (*mcpsdk.CallToolResult, any, error) {
	quantile, err := mcpFunnelQuantile(in.Quantile)
	if err != nil {
		return nil, nil, err
	}
	funnel, flt, stepRange, err := c.mcpPrepareFunnelStep(ctx, in.AppID, in.FunnelID, in.Step, in.From, in.To, in.FilterExpr, in.Limit, in.Offset)
	if err != nil {
		return nil, nil, err
	}
	stepTraces, _, _, err := measure.GetFunnelStepTracesCached(ctx, c.Deps.VK, c.Deps.RchPool, funnel, flt, stepRange, quantile)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get funnel step traces: %v", err)
	}
	return mcpFunnelStepResult(funnel, stepRange, "spans", stepTraces), nil, nil
}

func (c *Config) mcpGetFunnelStepNetwork(ctx context.Context, in mcpGetFunnelStepNetworkInput) (*mcpsdk.CallToolResult, any, error) {
	quantile, err := mcpFunnelQuantile(in.Quantile)
	if err != nil {
		return nil, nil, err
	}
	funnel, flt, stepRange, err := c.mcpPrepareFunnelStep(ctx, in.AppID, in.FunnelID, in.Step, in.From, in.To, in.FilterExpr, in.Limit, in.Offset)
	if err != nil {
		return nil, nil, err
	}
	stepEndpoints, _, _, err := measure.GetFunnelStepNetworkCached(ctx, c.Deps.VK, c.Deps.RchPool, funnel, flt, stepRange, quantile)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get funnel step network requests: %v", err)
	}
	return mcpFunnelStepResult(funnel, stepRange, "endpoints", stepEndpoints), nil, nil
}

func (c *Config) mcpGetFunnelStepSessions(ctx context.Context, in mcpGetFunnelStepSessionsInput) (*mcpsdk.CallToolResult, any, error) {
	var converted bool
	switch in.Outcome {
	case "dropped":
	case "converted":
		converted = true
	default:
		return nil, nil, fmt.Errorf("outcome must be one of dropped or converted")
	}
	funnel, flt, stepRange, err := c.mcpPrepareFunnelStep(ctx, in.AppID, in.FunnelID, in.Step, in.From, in.To, in.FilterExpr, in.Limit, in.Offset)
	if err != nil {
		return nil, nil, err
	}
	stepSessions, _, _, err := measure.GetFunnelStepSessionsCached(ctx, c.Deps.VK, c.Deps.RchPool, funnel, flt, stepRange, converted)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get funnel step sessions: %v", err)
	}
	return mcpFunnelStepResult(funnel, stepRange, "sessions", stepSessions), nil, nil
}

func (c *Config) mcpCreateFunnel(ctx context.Context, in mcpCreateFunnelInput) (*mcpsdk.CallToolResult, any, error) {
	appID, err := c.mcpResolveFunnelWriteAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}
	draft := measure.FunnelDraft{
		Name:                    in.Name,
		Steps:                   mcpFunnelSteps(in.Steps),
		ConversionWindowSeconds: in.ConversionWindowSeconds,
	}
	if err := draft.Validate(); err != nil {
		return nil, nil, err
	}
	userID, _ := UserIDFromContext(ctx)
	funnel, err := measure.CreateFunnel(ctx, c.Deps.PgPool, appID, userID, draft)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create funnel: %v", err)
	}
	data, _ := json.Marshal(funnel)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpUpdateFunnel(ctx context.Context, in mcpUpdateFunnelInput) (*mcpsdk.CallToolResult, any, error) {
	if in.Name == nil && in.Steps == nil && in.ConversionWindowSeconds == nil {
		return nil, nil, fmt.Errorf("give at least one of name, steps or conversion_window_seconds to change")
	}
	appID, err := c.mcpResolveFunnelWriteAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}
	funnel, err := c.mcpLoadFunnel(ctx, appID, in.FunnelID)
	if err != nil {
		return nil, nil, err
	}

	draft := measure.FunnelDraft{
		Name:                    funnel.Name,
		Steps:                   funnel.Steps,
		ConversionWindowSeconds: funnel.ConversionWindowSeconds,
	}
	if in.Name != nil {
		draft.Name = *in.Name
	}
	if in.Steps != nil {
		draft.Steps = mcpFunnelSteps(in.Steps)
	}
	if in.ConversionWindowSeconds != nil {
		draft.ConversionWindowSeconds = *in.ConversionWindowSeconds
	}
	if err := draft.Validate(); err != nil {
		return nil, nil, err
	}

	funnel, err = measure.UpdateFunnel(ctx, c.Deps.PgPool, appID, funnel.ID, draft)
	if errors.Is(err, measure.ErrFunnelNotFound) {
		return nil, nil, err
	}
	if err != nil {
		return nil, nil, fmt.Errorf("failed to update funnel: %v", err)
	}
	data, _ := json.Marshal(funnel)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpDeleteFunnel(ctx context.Context, in mcpDeleteFunnelInput) (*mcpsdk.CallToolResult, any, error) {
	funnelID, err := mcpParseFunnelID(in.FunnelID)
	if err != nil {
		return nil, nil, err
	}
	appID, err := c.mcpResolveFunnelWriteAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}
	err = measure.DeleteFunnel(ctx, c.Deps.PgPool, appID, funnelID)
	if errors.Is(err, measure.ErrFunnelNotFound) {
		return nil, nil, err
	}
	if err != nil {
		return nil, nil, fmt.Errorf("failed to delete funnel: %v", err)
	}
	return mcpTextResult(`{"ok":"done"}`), nil, nil
}

func (c *Config) mcpSetFunnelPinned(ctx context.Context, in mcpSetFunnelPinnedInput) (*mcpsdk.CallToolResult, any, error) {
	if in.Pinned == nil {
		return nil, nil, fmt.Errorf("pinned is required (true to pin, false to unpin)")
	}
	funnelID, err := mcpParseFunnelID(in.FunnelID)
	if err != nil {
		return nil, nil, err
	}
	appID, err := c.mcpResolveFunnelWriteAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}
	funnel, err := measure.SetFunnelPinned(ctx, c.Deps.PgPool, appID, funnelID, *in.Pinned)
	switch {
	case errors.Is(err, measure.ErrPinnedFunnelsFull):
		return nil, nil, fmt.Errorf("an app can have at most %d pinned funnels, unpin one to pin another", measure.MaxPinnedFunnels)
	case errors.Is(err, measure.ErrFunnelNotFound):
		return nil, nil, err
	case err != nil:
		return nil, nil, fmt.Errorf("failed to change funnel pin: %v", err)
	}
	data, _ := json.Marshal(funnel)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpReorderPinnedFunnels(ctx context.Context, in mcpReorderPinnedFunnelsInput) (*mcpsdk.CallToolResult, any, error) {
	if in.FunnelIDs == nil {
		return nil, nil, fmt.Errorf("funnel_ids is required")
	}
	funnelIDs := make([]uuid.UUID, len(in.FunnelIDs))
	for i, raw := range in.FunnelIDs {
		id, err := uuid.Parse(raw)
		if err != nil {
			return nil, nil, fmt.Errorf("funnel_ids has %q, which is not a valid UUID", raw)
		}
		funnelIDs[i] = id
	}
	appID, err := c.mcpResolveFunnelWriteAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}
	funnels, err := measure.ReorderPinnedFunnels(ctx, c.Deps.PgPool, appID, funnelIDs)
	if errors.Is(err, measure.ErrPinnedFunnelsChanged) {
		return nil, nil, fmt.Errorf("funnel_ids must hold every pinned funnel of the app once; get_pinned_funnels lists them")
	}
	if err != nil {
		return nil, nil, fmt.Errorf("failed to reorder pinned funnels: %v", err)
	}
	data, _ := json.Marshal(funnels)
	return mcpTextResult(string(data)), nil, nil
}

// presignConfig builds the storage config event.PreSignURL needs from the
// process config.
func presignConfig(deps *server.Deps) event.PreSignConfig {
	return event.PreSignConfig{
		IsCloud:                    deps.Config.IsCloud(),
		AWSEndpoint:                deps.Config.AWSEndpoint,
		AttachmentsBucket:          deps.Config.AttachmentsBucket,
		AttachmentsBucketRegion:    deps.Config.AttachmentsBucketRegion,
		AttachmentsAccessKey:       deps.Config.AttachmentsAccessKey,
		AttachmentsSecretAccessKey: deps.Config.AttachmentsSecretAccessKey,
		AttachmentOrigin:           deps.Config.AttachmentOrigin,
		Origin:                     deps.Config.AgentOrigin,
	}
}
