package agent

import (
	"backend/agent/server"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"reflect"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"backend/libs/ambient"
	"backend/libs/event"
	"backend/libs/filter"
	"backend/libs/group"
	"backend/libs/measure"
	"backend/libs/network"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/gin-gonic/gin"
	"github.com/google/jsonschema-go/jsonschema"
	"github.com/google/uuid"
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

	allRows, err := deps.RchPool.Query(ctx,
		`select name from system.tables where database = currentDatabase()`)
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

	query := fmt.Sprintf(
		`select table, name, type, comment from system.columns where database = currentDatabase() and table in (%s) order by table, position`,
		strings.Join(names, ","))

	rows, err := deps.RchPool.Query(ctx, query)
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

var (
	placeholderRe = regexp.MustCompile(`\{\{\s*([A-Za-z0-9_]+)\s*\}\}`)
	forbiddenRe   = regexp.MustCompile(`(?i)\b(insert|update|delete|alter|drop|create|truncate|rename|optimize|grant|revoke|attach|detach|kill|exchange|move)\b`)
	fromJoinRe    = regexp.MustCompile(`(?i)\b(?:from|join)\b`)
	identRe       = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_.]*`)
)

// validateAgentSQL checks that a query is a single SELECT using only
// {{table}} placeholders. If something slips past it, the read-only
// connection and the readonly=1 query setting still stop writes.
func validateAgentSQL(query string, sets *tableSets) error {
	if strings.Contains(query, ";") {
		return fmt.Errorf("only a single statement is allowed (no ';')")
	}

	trimmed := strings.TrimSpace(query)
	lower := strings.ToLower(trimmed)
	if !strings.HasPrefix(lower, "select") && !strings.HasPrefix(lower, "with") {
		return fmt.Errorf("only SELECT queries are allowed")
	}

	if m := forbiddenRe.FindString(query); m != "" {
		return fmt.Errorf("forbidden keyword %q in query", m)
	}

	placeholders := placeholderRe.FindAllStringSubmatch(query, -1)
	if len(placeholders) == 0 {
		return fmt.Errorf("reference tables only via {{table}} placeholders; call get_schema for the available tables")
	}
	for _, p := range placeholders {
		if !sets.scoped[p[1]] {
			return fmt.Errorf("unknown table placeholder {{%s}}; call get_schema for the available tables", p[1])
		}
	}

	// Catch raw table names that dodge placeholder scoping ("from events"
	// instead of "from {{events}}"). Replace placeholders with "(__scoped__)"
	// first; then any FROM/JOIN target not starting with "(" is suspect.
	neutral := placeholderRe.ReplaceAllString(query, "(__scoped__)")
	for _, loc := range fromJoinRe.FindAllStringIndex(neutral, -1) {
		if err := checkFromTargets(neutral, loc[1], sets); err != nil {
			return err
		}
	}

	return nil
}

// A table can be followed by an alias ("from {{events}} e"). If the word
// after a table is in this list, it isn't an alias; it starts the next
// part of the query.
var aliasStopWords = map[string]bool{
	"where": true, "group": true, "order": true, "limit": true, "settings": true,
	"union": true, "having": true, "prewhere": true, "join": true, "inner": true,
	"left": true, "right": true, "full": true, "cross": true, "on": true,
	"using": true, "asof": true, "any": true, "all": true, "global": true,
	"array": true, "final": true, "sample": true, "format": true, "with": true,
	"window": true, "qualify": true, "except": true, "intersect": true,
	"offset": true, "select": true, "paste": true, "semi": true, "anti": true,
}

// checkFromTargets walks the comma-separated tables after one FROM or JOIN.
// Each must be parenthesized (a placeholder or a subquery), or a plain word
// that is not a real table, not a function call, and not dotted, meaning
// it can only be a CTE name.
func checkFromTargets(s string, pos int, sets *tableSets) error {
	i := pos
	for {
		i = skipSpace(s, i)
		if i >= len(s) {
			return nil
		}
		if s[i] == '(' {
			i = skipParens(s, i)
		} else {
			ident := identRe.FindString(s[i:])
			if ident == "" {
				return nil
			}
			j := skipSpace(s, i+len(ident))
			if j < len(s) && s[j] == '(' {
				return fmt.Errorf("table functions are not allowed (%s)", ident)
			}
			if strings.Contains(ident, ".") {
				return fmt.Errorf("cross-database references are not allowed (%s)", ident)
			}
			if sets.all[ident] {
				if sets.scoped[ident] {
					return fmt.Errorf("reference table %s via the {{%s}} placeholder", ident, ident)
				}
				return fmt.Errorf("table %s is not queryable; query {{events}} or {{spans}} instead", ident)
			}
			// Anything else can only be a CTE name; ClickHouse errors if not.
			i += len(ident)
		}

		// Skip an optional alias ("as x" or just "x"), then continue on ','.
		i = skipAlias(s, i)
		i = skipSpace(s, i)
		if i < len(s) && s[i] == ',' {
			i++
			continue
		}
		return nil
	}
}

func skipSpace(s string, i int) int {
	for i < len(s) && (s[i] == ' ' || s[i] == '\t' || s[i] == '\r' || s[i] == '\n') {
		i++
	}
	return i
}

// skipParens returns the index just after the ')' matching the '(' at i.
// Parens inside 'string literals' don't count.
func skipParens(s string, i int) int {
	depth := 0
	for ; i < len(s); i++ {
		switch s[i] {
		case '\'':
			for i++; i < len(s); i++ {
				if s[i] == '\\' {
					i++
				} else if s[i] == '\'' {
					break
				}
			}
		case '(':
			depth++
		case ')':
			depth--
			if depth == 0 {
				return i + 1
			}
		}
	}
	return i
}

// skipAlias moves past a table's alias ("as x" or just "x"), if there is one.
func skipAlias(s string, i int) int {
	j := skipSpace(s, i)
	word := identRe.FindString(s[j:])
	if word == "" {
		return i
	}
	if strings.EqualFold(word, "as") {
		j = skipSpace(s, j+len(word))
		alias := identRe.FindString(s[j:])
		return j + len(alias)
	}
	if aliasStopWords[strings.ToLower(word)] || strings.Contains(word, ".") {
		return i
	}
	return j + len(word)
}

// expandPlaceholders rewrites {{table}} into a subquery scoped to the team
// and app pair and bounded to the from/to range on the table's time column,
// so a query can never scan outside its time range.
func expandPlaceholders(query string, teamID, appID uuid.UUID, from, to time.Time) string {
	return placeholderRe.ReplaceAllStringFunc(query, func(m string) string {
		name := placeholderRe.FindStringSubmatch(m)[1]
		timeCol := agentTables[name]
		return fmt.Sprintf(
			"(select * from %s where team_id = toUUID('%s') and app_id = toUUID('%s') and %s >= %s and %s <= %s)",
			name, teamID, appID, timeCol, chTime(from), timeCol, chTime(to))
	})
}

// chTime renders a time as a ClickHouse DateTime64(3, 'UTC') literal.
func chTime(t time.Time) string {
	return fmt.Sprintf("toDateTime64('%s', 3, 'UTC')", t.UTC().Format("2006-01-02 15:04:05.000"))
}

// runSQL validates the query, scopes it to the team, app and time range,
// runs it read-only and renders the rows as text for the LLM.
func (c *Config) runSQL(ctx context.Context, query string, teamID, appID uuid.UUID, from, to time.Time) (string, error) {
	// Fail closed on an incomplete scope: a nil team or app id would expand
	// into an unscoped or wrong-team subquery and could cross team boundaries.
	// resolveAppAccess derives both from the app upstream, so this should never
	// fire; it guards against a future caller that forgets to.
	if teamID == uuid.Nil || appID == uuid.Nil {
		log.Printf("ERROR agent: run_sql refused, incomplete scope (team=%s app=%s)", teamID, appID)
		return "", fmt.Errorf("internal error: query scope is incomplete")
	}

	deps := c.Deps
	start := time.Now()
	sets, err := c.loadTableSets(ctx)
	if err != nil {
		return "", err
	}
	if err := validateAgentSQL(query, sets); err != nil {
		return "", err
	}

	expanded := expandPlaceholders(query, teamID, appID, from, to)

	chCtx := clickhouse.Context(ctx, clickhouse.WithSettings(clickhouse.Settings{
		"readonly":             1,
		"max_execution_time":   maxQuerySeconds,
		"max_result_rows":      maxResultRows,
		"result_overflow_mode": "break",
	}))

	rows, err := deps.RchPool.Query(chCtx, expanded)
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
		Description: "Ask a natural-language question about an app's telemetry (crashes, ANRs, errors, sessions, " +
			"spans, network) that the other Measure tools don't cover. The agent picks the right tool or explores " +
			"the raw data with read-only SQL and answers with concrete numbers. " +
			"Use list_apps to discover app ids. Pass conversation_id from a previous answer to continue that conversation.",
		InputSchema: mcpMustInferSchema[askQuestionInput](),
	}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in askQuestionInput) (*mcpsdk.CallToolResult, any, error) {
		out, err := cfg.askQuestion(ctx, in)
		if err != nil {
			return nil, nil, err
		}
		return nil, out, nil
	})
}

// commonTools returns the tools served on both surfaces: to MCP clients and
// to the agent's own loop. Purpose-built, one per dashboard question.
func commonTools(cfg *Config) []Tool {
	return []Tool{
		// list_apps
		newTool(&mcpsdk.Tool{
			Name:        "list_apps",
			Description: "List all apps the authenticated user has access to",
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpListAppsInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpListApps(ctx, in)
		}),

		// get_filters
		newTool(&mcpsdk.Tool{
			Name:        "get_filters",
			Description: "Get available filter options (versions, OS, countries, devices, etc.) for an app. Optionally scope to errors (error_types) or spans (span).",
			InputSchema: mcpMustInferErrorFilterSchema[mcpGetFiltersInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetFiltersInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetFilters(ctx, in)
		}),

		// get_metrics
		newTool(&mcpsdk.Tool{
			Name:        "get_metrics",
			Description: "Get app metrics including adoption, crash-free/ANR-free sessions, and launch performance (cold/warm/hot p95). Covers all app versions unless versions/version_codes narrow it; adoption is only meaningful against a specific version, so pass one when reading it. get_filters lists the versions.",
			InputSchema: mcpMustInferSchema[mcpGetMetricsInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetMetricsInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetMetrics(ctx, in)
		}),

		// get_app_health_over_time
		newTool(&mcpsdk.Tool{
			Name:        "get_app_health_over_time",
			Description: "Get the app health timeline: sessions, crashes (fatal exceptions) and ANRs bucketed over time. This is the overview health plot. Covers all app versions unless versions/version_codes narrow it; get_filters lists the versions.",
			InputSchema: mcpMustInferSchema[mcpGetAppHealthOverTimeInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetAppHealthOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetAppHealthOverTime(ctx, in)
		}),

		// get_errors
		newTool(&mcpsdk.Tool{
			Name:        "get_errors",
			Description: "Get error groups (crashes, non-fatal exceptions and ANRs) for an app. Filter by error_types and severities (e.g. error_types=[\"error\"]+severities=[\"fatal\"] for crashes, error_types=[\"anr\"] for ANRs). Covers all app versions unless versions/version_codes narrow it; get_filters lists the versions.",
			InputSchema: mcpMustInferErrorFilterSchema[mcpGetErrorsInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetErrorsInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetErrors(ctx, in)
		}),

		// get_error
		newTool(&mcpsdk.Tool{
			Name:        "get_error",
			Description: "Get individual error events (exception or ANR) for a specific error group. Covers all app versions unless versions/version_codes narrow it; get_filters lists the versions.",
			InputSchema: mcpMustInferSchema[mcpGetErrorInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetErrorInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetError(ctx, in)
		}),

		// get_errors_over_time
		newTool(&mcpsdk.Tool{
			Name:        "get_errors_over_time",
			Description: "Get time-series of error occurrences across all error groups. Filter by error_types and severities. Covers all app versions unless versions/version_codes narrow it; get_filters lists the versions.",
			InputSchema: mcpMustInferErrorFilterSchema[mcpGetErrorsOverTimeInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetErrorsOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetErrorsOverTime(ctx, in)
		}),

		// get_error_over_time
		newTool(&mcpsdk.Tool{
			Name:        "get_error_over_time",
			Description: "Get time-series of occurrences for a specific error group. Covers all app versions unless versions/version_codes narrow it; get_filters lists the versions.",
			InputSchema: mcpMustInferSchema[mcpGetErrorOverTimeInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetErrorOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetErrorOverTime(ctx, in)
		}),

		// get_error_distribution
		newTool(&mcpsdk.Tool{
			Name:        "get_error_distribution",
			Description: "Get attribute distribution (OS, device, version, country) for a specific error group. Covers all app versions unless versions/version_codes narrow it; get_filters lists the versions.",
			InputSchema: mcpMustInferSchema[mcpGetErrorDistributionInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetErrorDistributionInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetErrorDistribution(ctx, in)
		}),

		// get_sessions
		newTool(&mcpsdk.Tool{
			Name:        "get_sessions",
			Description: "Get sessions for an app, ordered by most recent first. Filter to sessions containing errors via error_types and severities. Covers all app versions unless versions/version_codes narrow it; get_filters lists the versions.",
			InputSchema: mcpMustInferErrorFilterSchema[mcpGetSessionsInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetSessionsInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetSessions(ctx, in)
		}),

		// get_sessions_over_time
		newTool(&mcpsdk.Tool{
			Name:        "get_sessions_over_time",
			Description: "Get time-series of session counts. Filter to sessions containing errors via error_types and severities. Covers all app versions unless versions/version_codes narrow it; get_filters lists the versions.",
			InputSchema: mcpMustInferErrorFilterSchema[mcpGetSessionsOverTimeInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetSessionsOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetSessionsOverTime(ctx, in)
		}),

		// get_session
		newTool(&mcpsdk.Tool{
			Name:        "get_session",
			Description: "Get full session with all events",
			InputSchema: mcpMustInferSchema[mcpGetSessionInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetSessionInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetSession(ctx, in)
		}),

		// get_bug_reports
		newTool(&mcpsdk.Tool{
			Name:        "get_bug_reports",
			Description: "Get bug reports for an app, ordered by most recent first. Covers all app versions unless versions/version_codes narrow it; get_filters lists the versions.",
			InputSchema: mcpMustInferSchema[mcpGetBugReportsInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetBugReportsInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetBugReports(ctx, in)
		}),

		// get_bug_reports_over_time
		newTool(&mcpsdk.Tool{
			Name:        "get_bug_reports_over_time",
			Description: "Get time-series of bug report counts. Covers all app versions unless versions/version_codes narrow it; get_filters lists the versions.",
			InputSchema: mcpMustInferSchema[mcpGetBugReportsOverTimeInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetBugReportsOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetBugReportsOverTime(ctx, in)
		}),

		// get_bug_report
		newTool(&mcpsdk.Tool{
			Name:        "get_bug_report",
			Description: "Get a single bug report with full details",
			InputSchema: mcpMustInferSchema[mcpGetBugReportInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetBugReportInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetBugReport(ctx, in)
		}),

		// update_bug_report_status
		newTool(&mcpsdk.Tool{
			Name:        "update_bug_report_status",
			Description: "Update the status of a bug report (open or closed)",
			InputSchema: mcpMustInferSchema[mcpUpdateBugReportStatusInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpUpdateBugReportStatusInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpUpdateBugReportStatus(ctx, in)
		}),

		// get_root_span_names
		newTool(&mcpsdk.Tool{
			Name:        "get_root_span_names",
			Description: "Get all root span names for an app",
			InputSchema: mcpMustInferSchema[mcpGetRootSpanNamesInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetRootSpanNamesInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetRootSpanNames(ctx, in)
		}),

		// get_span_instances
		newTool(&mcpsdk.Tool{
			Name:        "get_span_instances",
			Description: "Get span instances for a root span name. Covers all app versions unless versions/version_codes narrow it; get_filters lists the versions.",
			InputSchema: mcpMustInferSchema[mcpGetSpanInstancesInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetSpanInstancesInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetSpanInstances(ctx, in)
		}),

		// get_span_metrics_over_time
		newTool(&mcpsdk.Tool{
			Name:        "get_span_metrics_over_time",
			Description: "Get p50/p90/p95/p99 duration metrics over time for a span name. Covers all app versions unless versions/version_codes narrow it; get_filters lists the versions.",
			InputSchema: mcpMustInferSchema[mcpGetSpanMetricsOverTimeInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetSpanMetricsOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetSpanMetricsOverTime(ctx, in)
		}),

		// get_trace
		newTool(&mcpsdk.Tool{
			Name:        "get_trace",
			Description: "Get full trace with all child spans",
			InputSchema: mcpMustInferSchema[mcpGetTraceInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetTraceInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetTrace(ctx, in)
		}),

		// get_alerts
		newTool(&mcpsdk.Tool{
			Name:        "get_alerts",
			Description: "Get alerts for an app, ordered by most recent first",
			InputSchema: mcpMustInferSchema[mcpGetAlertsInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetAlertsInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetAlerts(ctx, in)
		}),

		// get_journey
		newTool(&mcpsdk.Tool{
			Name:        "get_journey",
			Description: "Get user navigation journey graph with session counts between screens. Covers all app versions unless versions/version_codes narrow it; get_filters lists the versions.",
			InputSchema: mcpMustInferSchema[mcpGetJourneyInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetJourneyInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetJourney(ctx, in)
		}),

		// get_error_common_path
		newTool(&mcpsdk.Tool{
			Name:        "get_error_common_path",
			Description: "Get the most common user navigation path leading to a specific error group (crash, exception or ANR)",
			InputSchema: mcpMustInferSchema[mcpGetErrorCommonPathInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetErrorCommonPathInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetErrorCommonPath(ctx, in)
		}),

		// get_network_unique_domains
		newTool(&mcpsdk.Tool{
			Name:        "get_network_unique_domains",
			Description: "Get all unique domains observed in HTTP requests for an app",
			InputSchema: mcpMustInferSchema[mcpGetUniqueDomainsInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetUniqueDomainsInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetUniqueDomains(ctx, in)
		}),

		// get_network_paths_for_domain
		newTool(&mcpsdk.Tool{
			Name:        "get_network_paths_for_domain",
			Description: "Get all unique URL paths for a domain from HTTP requests, with optional search query",
			InputSchema: mcpMustInferSchema[mcpGetPathsForDomainInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetPathsForDomainInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetPathsForDomain(ctx, in)
		}),

		// get_network_metrics_trends
		newTool(&mcpsdk.Tool{
			Name:        "get_network_metrics_trends",
			Description: "Get top network endpoints by latency, error rate, and frequency for domain and path pattern",
			InputSchema: mcpMustInferSchema[mcpGetNetworkTrendsInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetNetworkTrendsInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetNetworkTrends(ctx, in)
		}),

		// get_network_status_codes_over_time
		newTool(&mcpsdk.Tool{
			Name:        "get_network_status_codes_over_time",
			Description: "Get HTTP status code distribution over time across all network requests",
			InputSchema: mcpMustInferSchema[mcpGetAppHttpStatusCodesOverTimeInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetAppHttpStatusCodesOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetAppStatusCodesOverTime(ctx, in)
		}),

		// get_network_endpoint_latency_over_time
		newTool(&mcpsdk.Tool{
			Name:        "get_network_endpoint_latency_over_time",
			Description: "Get latency percentiles (p50/p90/p95/p99) over time for a specific endpoint",
			InputSchema: mcpMustInferSchema[mcpGetHttpEndpointLatencyOverTimeInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetHttpEndpointLatencyOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetHttpEndpointLatencyOverTime(ctx, in)
		}),

		// get_network_endpoint_status_codes_over_time
		newTool(&mcpsdk.Tool{
			Name:        "get_network_endpoint_status_codes_over_time",
			Description: "Get HTTP status code distribution over time for a specific endpoint ",
			InputSchema: mcpMustInferSchema[mcpGetHttpEndpointStatusCodesOverTimeInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetHttpEndpointStatusCodesOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetHttpEndpointStatusCodesOverTime(ctx, in)
		}),

		// get_network_requests_timeline
		newTool(&mcpsdk.Tool{
			Name:        "get_network_requests_timeline",
			Description: "Get HTTP requests timeline showing when top endpoints are typically called during a session",
			InputSchema: mcpMustInferSchema[mcpGetNetworkTimelineInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetNetworkTimelineInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetNetworkTimeline(ctx, in)
		}),

		// get_network_endpoint_timeline
		newTool(&mcpsdk.Tool{
			Name:        "get_network_endpoint_timeline",
			Description: "Get HTTP requests timeline for a specific endpoint showing when it is typically called during a session. Only works for known path patterns.",
			InputSchema: mcpMustInferSchema[mcpGetNetworkEndpointTimelineInput](),
		}, func(ctx context.Context, req *mcpsdk.CallToolRequest, in mcpGetNetworkEndpointTimelineInput) (*mcpsdk.CallToolResult, any, error) {
			return cfg.mcpGetNetworkEndpointTimeline(ctx, in)
		}),
	}
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

// mcpMustInferErrorFilterSchema infers a JSON schema from a Go type and adds
// enum constraints to the items of the "error_types" (error | anr) and
// "severities" (fatal | unhandled | handled) array properties when present.
// Used by tools that embed mcpErrorFilters (or otherwise expose those fields).
func mcpMustInferErrorFilterSchema[T any]() json.RawMessage {
	schema, err := jsonschema.For[T](nil)
	if err != nil {
		panic("mcp: failed to infer schema: " + err.Error())
	}
	if p, ok := schema.Properties["error_types"]; ok && p.Items != nil {
		p.Items.Enum = []any{string(event.ErrorTypeError), string(event.ErrorTypeANR)}
	}
	if p, ok := schema.Properties["severities"]; ok && p.Items != nil {
		p.Items.Enum = []any{string(event.SeverityFatal), string(event.SeverityUnhandled), string(event.SeverityHandled)}
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

// mcpCommonFilters contains filter fields shared across most tools.
type mcpCommonFilters struct {
	AppID               string   `json:"app_id" jsonschema:"UUID of the app to query"`
	From                string   `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To                  string   `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	Versions            []string `json:"versions,omitempty" jsonschema:"Filter by app version strings"`
	VersionCodes        []string `json:"version_codes,omitempty" jsonschema:"Filter by app version codes"`
	OsNames             []string `json:"os_names,omitempty" jsonschema:"Filter by OS names (e.g. android, ios)"`
	OsVersions          []string `json:"os_versions,omitempty" jsonschema:"Filter by OS versions"`
	Countries           []string `json:"countries,omitempty" jsonschema:"Filter by country codes (e.g. US, IN)"`
	NetworkProviders    []string `json:"network_providers,omitempty" jsonschema:"Filter by network providers"`
	NetworkTypes        []string `json:"network_types,omitempty" jsonschema:"Filter by network types (e.g. wifi, cellular)"`
	NetworkGenerations  []string `json:"network_generations,omitempty" jsonschema:"Filter by network generations (e.g. 4g, 5g)"`
	Locales             []string `json:"locales,omitempty" jsonschema:"Filter by device locales (e.g. en_US)"`
	DeviceManufacturers []string `json:"device_manufacturers,omitempty" jsonschema:"Filter by device manufacturers"`
	DeviceNames         []string `json:"device_names,omitempty" jsonschema:"Filter by device names"`
}

// mcpErrorFilters contains the error-scoping filters shared by the errors
// tools and the session tools, mirroring the dashboard's type/severity query
// params. A crash is error_types=["error"] with severities=["fatal"]; an ANR
// is error_types=["anr"]. Leaving these empty matches every error source.
type mcpErrorFilters struct {
	ErrorTypes       []string `json:"error_types,omitempty" jsonschema:"Filter by error source: 'error' (exceptions) and/or 'anr'. Default: both"`
	Severities       []string `json:"severities,omitempty" jsonschema:"Filter exceptions by severity: 'fatal' (crashes), 'unhandled' (uncaught non-fatal), 'handled' (caught & reported). Applies to the 'error' type only, not 'anr'. Default: all"`
	CustomErrorsOnly bool     `json:"custom_errors_only,omitempty" jsonschema:"Restrict exceptions to custom (developer-reported) ones only. ANRs are never custom and are not filtered by this. No Measure SDK emits custom errors yet, so there are currently no custom exceptions."`
}

type mcpListAppsInput struct{}
type mcpGetFiltersInput struct {
	AppID      string   `json:"app_id" jsonschema:"UUID of the app to query"`
	ErrorTypes []string `json:"error_types,omitempty" jsonschema:"Scope filter options to errors of these types: 'error' (exceptions) and/or 'anr'. Mutually exclusive with span. Omit for all data."`
	Span       bool     `json:"span,omitempty" jsonschema:"Scope filter options to spans"`
}
type mcpGetMetricsInput struct {
	mcpCommonFilters
	Limit  int `json:"limit,omitempty" jsonschema:"Maximum number of items to return (default: 10)"`
	Offset int `json:"offset,omitempty" jsonschema:"Number of items to skip for pagination (default: 0)"`
}
type mcpGetAppHealthOverTimeInput struct {
	mcpCommonFilters
	Timezone string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetErrorsInput struct {
	mcpCommonFilters
	mcpErrorFilters
	Limit  int `json:"limit,omitempty" jsonschema:"Maximum number of groups to return (default: 25, max: 100)"`
	Offset int `json:"offset,omitempty" jsonschema:"Number of groups to skip for pagination (default: 0)"`
}
type mcpGetErrorInput struct {
	mcpCommonFilters
	ErrorGroupID string `json:"error_group_id" jsonschema:"Fingerprint/ID of the error group"`
	Limit        int    `json:"limit,omitempty" jsonschema:"Maximum number of events to return (default: 1)"`
	Offset       int    `json:"offset,omitempty" jsonschema:"Number of events to skip for pagination (default: 0)"`
}
type mcpGetErrorsOverTimeInput struct {
	mcpCommonFilters
	mcpErrorFilters
	Timezone string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetErrorOverTimeInput struct {
	mcpCommonFilters
	ErrorGroupID string `json:"error_group_id" jsonschema:"Fingerprint/ID of the error group"`
	Timezone     string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetErrorDistributionInput struct {
	mcpCommonFilters
	ErrorGroupID string `json:"error_group_id" jsonschema:"Fingerprint/ID of the error group"`
}
type mcpGetSessionsInput struct {
	mcpCommonFilters
	mcpErrorFilters
	FreeText        string `json:"free_text,omitempty" jsonschema:"Free text search filter"`
	Foreground      *bool  `json:"foreground,omitempty" jsonschema:"Filter for foreground sessions"`
	Background      *bool  `json:"background,omitempty" jsonschema:"Filter for background sessions"`
	UserInteraction *bool  `json:"user_interaction,omitempty" jsonschema:"Filter for sessions with user interaction"`
	Limit           int    `json:"limit,omitempty" jsonschema:"Maximum number of sessions to return (default: 10)"`
	Offset          int    `json:"offset,omitempty" jsonschema:"Number of sessions to skip for pagination (default: 0)"`
}
type mcpGetSessionsOverTimeInput struct {
	mcpCommonFilters
	mcpErrorFilters
	FreeText        string `json:"free_text,omitempty" jsonschema:"Free text search filter"`
	Foreground      *bool  `json:"foreground,omitempty" jsonschema:"Filter for foreground sessions"`
	Background      *bool  `json:"background,omitempty" jsonschema:"Filter for background sessions"`
	UserInteraction *bool  `json:"user_interaction,omitempty" jsonschema:"Filter for sessions with user interaction"`
	Timezone        string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetSessionInput struct {
	AppID     string `json:"app_id" jsonschema:"UUID of the app"`
	SessionID string `json:"session_id" jsonschema:"UUID of the session"`
}
type mcpGetBugReportsInput struct {
	mcpCommonFilters
	BugReportStatuses []int  `json:"bug_report_statuses,omitempty" jsonschema:"Filter by status: 0=OPEN, 1=CLOSED"`
	FreeText          string `json:"free_text,omitempty" jsonschema:"Free text search filter"`
	Limit             int    `json:"limit,omitempty" jsonschema:"Maximum number of bug reports to return (default: 10)"`
	Offset            int    `json:"offset,omitempty" jsonschema:"Number of bug reports to skip for pagination (default: 0)"`
}
type mcpGetBugReportsOverTimeInput struct {
	mcpCommonFilters
	BugReportStatuses []int  `json:"bug_report_statuses,omitempty" jsonschema:"Filter by status: 0=OPEN, 1=CLOSED"`
	Timezone          string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetBugReportInput struct {
	AppID       string `json:"app_id" jsonschema:"UUID of the app"`
	BugReportID string `json:"bug_report_id" jsonschema:"ID of the bug report"`
}
type mcpGetRootSpanNamesInput struct {
	AppID string `json:"app_id" jsonschema:"UUID of the app"`
}
type mcpGetSpanInstancesInput struct {
	mcpCommonFilters
	RootSpanName string `json:"root_span_name" jsonschema:"Name of the root span to query"`
	SpanStatuses []int  `json:"span_statuses,omitempty" jsonschema:"Filter by span status: 0=Unset, 1=Ok, 2=Error"`
	Limit        int    `json:"limit,omitempty" jsonschema:"Maximum number of spans to return (default: 10)"`
	Offset       int    `json:"offset,omitempty" jsonschema:"Number of spans to skip for pagination (default: 0)"`
}
type mcpGetSpanMetricsOverTimeInput struct {
	mcpCommonFilters
	RootSpanName string `json:"root_span_name" jsonschema:"Name of the root span to query"`
	SpanStatuses []int  `json:"span_statuses,omitempty" jsonschema:"Filter by span status: 0=Unset, 1=Ok, 2=Error"`
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
	Limit  int    `json:"limit,omitempty" jsonschema:"Maximum number of alerts to return (default: 25)"`
	Offset int    `json:"offset,omitempty" jsonschema:"Number of alerts to skip for pagination (default: 0)"`
}
type mcpGetJourneyInput struct {
	AppID        string   `json:"app_id" jsonschema:"UUID of the app to query"`
	From         string   `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To           string   `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
	Versions     []string `json:"versions,omitempty" jsonschema:"Filter by app version strings"`
	VersionCodes []string `json:"version_codes,omitempty" jsonschema:"Filter by app version codes"`
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
type mcpNetworkFilters struct {
	mcpCommonFilters
	HttpMethods []string `json:"http_methods,omitempty" jsonschema:"Filter by HTTP methods (e.g. get, post)"`
}
type mcpGetUniqueDomainsInput struct {
	AppID string `json:"app_id" jsonschema:"UUID of the app"`
	From  string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To    string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
}
type mcpGetPathsForDomainInput struct {
	AppID  string `json:"app_id" jsonschema:"UUID of the app"`
	Domain string `json:"domain" jsonschema:"Domain to fetch paths for"`
	Search string `json:"search,omitempty" jsonschema:"Search term to filter paths"`
	From   string `json:"from,omitempty" jsonschema:"Start of time range (RFC3339, default: 7 days ago)"`
	To     string `json:"to,omitempty" jsonschema:"End of time range (RFC3339, default: now)"`
}
type mcpGetNetworkTrendsInput struct {
	mcpNetworkFilters
	Limit int `json:"limit,omitempty" jsonschema:"Maximum number of endpoints to return per category (1-50, default 10)"`
}
type mcpGetAppHttpStatusCodesOverTimeInput struct {
	mcpNetworkFilters
	Timezone string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetHttpEndpointLatencyOverTimeInput struct {
	mcpNetworkFilters
	Domain   string `json:"domain" jsonschema:"Domain to query (e.g. api.example.com)"`
	Path     string `json:"path" jsonschema:"Path to query (e.g. /v1/users)"`
	Timezone string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetHttpEndpointStatusCodesOverTimeInput struct {
	mcpNetworkFilters
	Domain   string `json:"domain" jsonschema:"Domain to query (e.g. api.example.com)"`
	Path     string `json:"path" jsonschema:"Path to query (e.g. /v1/users)"`
	Timezone string `json:"timezone" jsonschema:"Timezone for time bucketing (e.g. America/New_York)"`
}
type mcpGetNetworkTimelineInput struct {
	mcpNetworkFilters
}
type mcpGetNetworkEndpointTimelineInput struct {
	mcpNetworkFilters
	Domain string `json:"domain" jsonschema:"Domain to query (e.g. api.example.com)"`
	Path   string `json:"path" jsonschema:"Path to query (e.g. /v1/users)"`
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
	var count int
	err = pgPool.QueryRow(ctx,
		`SELECT count(*)
		 FROM measure.apps a
		 JOIN measure.team_membership tm ON a.team_id = tm.team_id
		 WHERE a.id = $1 AND tm.user_id = $2`,
		appID, userID).Scan(&count)
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

	return appID, *team.ID, nil
}

// mcpBuildAppFilter populates a filter.AppFilter from mcpCommonFilters.
// When no versions/version_codes are provided, the query covers every app
// version: the underlying queries want an explicit version list, so the
// versions seen in the requested time range are fetched and all of them are
// passed through. Narrowing silently (for example to the latest version)
// makes the model report "no data" for questions that span versions.
func (c *Config) mcpBuildAppFilter(ctx context.Context, appID uuid.UUID, cf mcpCommonFilters) (*filter.AppFilter, error) {
	deps := c.Deps
	af := &filter.AppFilter{AppID: appID}

	from, to, err := mcpParseTimeRangeStrings(cf.From, cf.To)
	if err != nil {
		return nil, err
	}
	af.From, af.To = from, to

	if len(cf.Versions) > 0 {
		af.Versions = cf.Versions
	}
	if len(cf.VersionCodes) > 0 {
		af.VersionCodes = cf.VersionCodes
	}
	if len(cf.OsNames) > 0 {
		af.OsNames = cf.OsNames
	}
	if len(cf.OsVersions) > 0 {
		af.OsVersions = cf.OsVersions
	}
	if len(cf.Countries) > 0 {
		af.Countries = cf.Countries
	}
	if len(cf.NetworkProviders) > 0 {
		af.NetworkProviders = cf.NetworkProviders
	}
	if len(cf.NetworkTypes) > 0 {
		af.NetworkTypes = cf.NetworkTypes
	}
	if len(cf.NetworkGenerations) > 0 {
		af.NetworkGenerations = cf.NetworkGenerations
	}
	if len(cf.Locales) > 0 {
		af.Locales = cf.Locales
	}
	if len(cf.DeviceManufacturers) > 0 {
		af.DeviceManufacturers = cf.DeviceManufacturers
	}
	if len(cf.DeviceNames) > 0 {
		af.DeviceNames = cf.DeviceNames
	}

	if len(af.Versions) == 0 && len(af.VersionCodes) == 0 {
		app, selectErr := measure.SelectApp(ctx, deps.PgPool, appID)
		if selectErr != nil {
			return nil, fmt.Errorf("failed to fetch versions: %v", selectErr)
		}
		// The version list comes from the query's own time range, so versions
		// only seen outside some default window still count.
		filtersAF := &filter.AppFilter{AppID: appID, From: af.From, To: af.To}
		filterCtx := ambient.WithTeamId(ctx, app.TeamId)

		var fl filter.FilterList
		if err := filtersAF.GetGenericFilters(filterCtx, deps.RchPool, &fl, gin.Mode() == gin.ReleaseMode, gin.Mode() == gin.DebugMode); err != nil {
			return nil, fmt.Errorf("failed to fetch versions: %v", err)
		}
		af.Versions = fl.Versions
		af.VersionCodes = fl.VersionCodes
	}

	return af, nil
}

// mcpApplyErrorFilters validates and applies the error-scoping filters onto an
// AppFilter. Empty fields leave the filter unscoped (all error sources).
func mcpApplyErrorFilters(af *filter.AppFilter, ef mcpErrorFilters) error {
	for _, t := range ef.ErrorTypes {
		et := event.ErrorType(t)
		if !et.IsValid() {
			return fmt.Errorf("error_types values must be any combination of: %s, %s", event.ErrorTypeError, event.ErrorTypeANR)
		}
		af.ErrorTypes = append(af.ErrorTypes, et)
	}
	for _, s := range ef.Severities {
		sv := event.Severity(s)
		if !sv.IsValid() {
			return fmt.Errorf("severities values must be any combination of: %s, %s, %s", event.SeverityFatal, event.SeverityUnhandled, event.SeverityHandled)
		}
		af.Severities = append(af.Severities, sv)
	}
	af.CustomError = ef.CustomErrorsOnly
	return nil
}

// mcpApplySessionFilters sets session-specific filter fields on an AppFilter.
func mcpApplySessionFilters(af *filter.AppFilter, freeText string, foreground, background, userInteraction *bool) {
	if freeText != "" {
		af.FreeText = freeText
	}
	if foreground != nil && *foreground {
		af.Foreground = true
	}
	if background != nil && *background {
		af.Background = true
	}
	if userInteraction != nil && *userInteraction {
		af.UserInteraction = true
	}
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
	type appRow struct {
		ID               string   `json:"id"`
		Name             string   `json:"name"`
		OsNames          []string `json:"os_names"`
		UniqueIdentifier string   `json:"unique_identifier"`
	}
	rows, err := pgPool.Query(ctx,
		`SELECT a.id, coalesce(a.app_name, ''), a.os_names, coalesce(a.unique_identifier, '')
		 FROM measure.apps a
		 JOIN measure.team_membership tm ON a.team_id = tm.team_id
		 WHERE tm.user_id = $1
		 ORDER BY a.created_at DESC`,
		userID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to query apps: %v", err)
	}
	defer rows.Close()

	var apps []appRow
	for rows.Next() {
		var row appRow
		if err := rows.Scan(&row.ID, &row.Name, &row.OsNames, &row.UniqueIdentifier); err != nil {
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

func (c *Config) mcpGetFilters(ctx context.Context, in mcpGetFiltersInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	appID, _, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af := &filter.AppFilter{
		AppID: appID,
		Limit: filter.DefaultPaginationLimit,
	}
	af.SetDefaultTimeRange()

	if in.Span && len(in.ErrorTypes) > 0 {
		return nil, nil, fmt.Errorf("span and error_types are mutually exclusive")
	}
	if in.Span {
		af.Span = true
	}
	if err := mcpApplyErrorFilters(af, mcpErrorFilters{ErrorTypes: in.ErrorTypes}); err != nil {
		return nil, nil, err
	}

	app, err := measure.SelectApp(ctx, deps.PgPool, appID)
	if err != nil {
		return nil, nil, err
	}
	filterCtx := ambient.WithTeamId(ctx, app.TeamId)

	var fl filter.FilterList
	if err := af.GetGenericFilters(filterCtx, deps.RchPool, &fl, gin.Mode() == gin.ReleaseMode, gin.Mode() == gin.DebugMode); err != nil {
		return nil, nil, fmt.Errorf("failed to get filters: %v", err)
	}
	data, _ := json.Marshal(fl)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetMetrics(ctx context.Context, in mcpGetMetricsInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := c.mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}

	limit := in.Limit
	if limit <= 0 {
		limit = 10
	}
	if limit > 30 {
		limit = 30
	}
	af.Limit = limit
	af.Offset = in.Offset

	app := &measure.App{ID: &appID, TeamId: teamID}
	if err := app.Populate(ctx, deps.PgPool); err != nil {
		return nil, nil, err
	}
	metricsCtx := ambient.WithTeamId(ctx, teamID)

	adoption, err := app.GetAdoptionMetrics(metricsCtx, deps.RchPool, af)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch adoption metrics: %w", err)
	}

	excludedVersions, err := af.GetExcludedVersions(metricsCtx, deps.RchPool)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch excluded versions: %w", err)
	}

	crashFree, perceivedCrashFree, anrFree, perceivedANRFree, err := app.GetIssueFreeMetrics(metricsCtx, deps.RchPool, af, excludedVersions)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch issue free metrics: %w", err)
	}

	launch, err := app.GetLaunchMetrics(metricsCtx, deps.RchPool, af)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch launch metrics: %w", err)
	}

	result := map[string]any{
		"adoption":                      adoption,
		"crash_free_sessions":           crashFree,
		"perceived_crash_free_sessions": perceivedCrashFree,
		"anr_free_sessions":             anrFree,
		"perceived_anr_free_sessions":   perceivedANRFree,
		"cold_launch": map[string]any{
			"p95":       launch.ColdLaunchP95,
			"delta":     launch.ColdDelta,
			"nan":       launch.ColdNaN,
			"delta_nan": launch.ColdDeltaNaN,
		},
		"warm_launch": map[string]any{
			"p95":       launch.WarmLaunchP95,
			"delta":     launch.WarmDelta,
			"nan":       launch.WarmNaN,
			"delta_nan": launch.WarmDeltaNaN,
		},
		"hot_launch": map[string]any{
			"p95":       launch.HotLaunchP95,
			"delta":     launch.HotDelta,
			"nan":       launch.HotNaN,
			"delta_nan": launch.HotDeltaNaN,
		},
	}

	if len(af.Versions) > 0 && !af.HasMultiVersions() {
		sizes, err := app.GetSizeMetrics(metricsCtx, deps.PgPool, af, excludedVersions)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to fetch size metrics: %w", err)
		}
		result["sizes"] = sizes
	}

	data, _ := json.Marshal(result)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetAppHealthOverTime(ctx context.Context, in mcpGetAppHealthOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	if in.Timezone == "" {
		return nil, nil, fmt.Errorf("timezone is required for over time tools")
	}

	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := c.mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}
	af.Timezone = in.Timezone
	af.Limit = filter.DefaultPaginationLimit

	app := &measure.App{ID: &appID, TeamId: teamID}
	plotCtx := ambient.WithTeamId(ctx, teamID)

	sessions, crashes, anrs, plotErr := app.GetHealthPlotInstances(plotCtx, deps.RchPool, af)
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
	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := c.mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}
	if err := mcpApplyErrorFilters(af, in.mcpErrorFilters); err != nil {
		return nil, nil, err
	}

	limit := in.Limit
	if limit <= 0 {
		limit = 10
	}
	if limit > 30 {
		limit = 30
	}
	af.Limit = limit
	af.Offset = in.Offset

	app := &measure.App{ID: &appID, TeamId: teamID}
	groups, _, _, groupErr := app.GetErrorGroupsWithFilter(ctx, deps.RchPool, af)
	if groupErr != nil {
		return nil, nil, fmt.Errorf("failed to get error groups: %v", groupErr)
	}
	data, _ := json.Marshal(groups)

	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetError(ctx context.Context, in mcpGetErrorInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	if in.ErrorGroupID == "" {
		return nil, nil, fmt.Errorf("error_group_id is required")
	}

	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := c.mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}

	limit := in.Limit
	if limit <= 0 {
		limit = 1
	}
	if limit > 5 {
		limit = 5
	}
	af.Limit = limit
	af.Offset = in.Offset

	app := &measure.App{ID: &appID, TeamId: teamID}
	events, _, _, evErr := app.GetErrorsWithFilter(ctx, deps.RchPool, in.ErrorGroupID, af)
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

	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := c.mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}
	if err := mcpApplyErrorFilters(af, in.mcpErrorFilters); err != nil {
		return nil, nil, err
	}
	af.Timezone = in.Timezone
	af.Limit = filter.DefaultPaginationLimit

	app := &measure.App{ID: &appID, TeamId: teamID}
	plotCtx := ambient.WithTeamId(ctx, teamID)
	instances, plotErr := app.GetErrorPlotInstances(plotCtx, deps.RchPool, af)
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

	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := c.mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}
	af.Timezone = in.Timezone
	af.Limit = filter.DefaultPaginationLimit

	app := &measure.App{ID: &appID, TeamId: teamID}
	plotCtx := ambient.WithTeamId(ctx, teamID)
	instances, plotErr := app.GetErrorGroupPlotInstances(plotCtx, deps.RchPool, in.ErrorGroupID, af)
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

	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := c.mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}
	af.Limit = filter.DefaultPaginationLimit

	app := &measure.App{ID: &appID, TeamId: teamID}
	distCtx := ambient.WithTeamId(ctx, teamID)
	distribution, distErr := app.GetErrorGroupAttributesDistribution(distCtx, deps.RchPool, in.ErrorGroupID, af)
	if distErr != nil {
		return nil, nil, fmt.Errorf("failed to get error distribution: %v", distErr)
	}
	data, _ := json.Marshal(distribution)

	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetSessions(ctx context.Context, in mcpGetSessionsInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := c.mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}

	limit := in.Limit
	if limit <= 0 {
		limit = 10
	}
	if limit > 30 {
		limit = 30
	}
	af.Limit = limit
	af.Offset = in.Offset

	if err := mcpApplyErrorFilters(af, in.mcpErrorFilters); err != nil {
		return nil, nil, err
	}
	mcpApplySessionFilters(af, in.FreeText, in.Foreground, in.Background, in.UserInteraction)

	app := &measure.App{ID: &appID, TeamId: teamID}
	sessCtx := ambient.WithTeamId(ctx, teamID)
	sessions, _, _, sessErr := app.GetSessionsWithFilter(sessCtx, deps.RchPool, af)
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

	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := c.mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}
	af.Timezone = in.Timezone
	af.Limit = filter.DefaultPaginationLimit

	if err := mcpApplyErrorFilters(af, in.mcpErrorFilters); err != nil {
		return nil, nil, err
	}
	mcpApplySessionFilters(af, in.FreeText, in.Foreground, in.Background, in.UserInteraction)

	app := &measure.App{ID: &appID, TeamId: teamID}
	plotCtx := ambient.WithTeamId(ctx, teamID)
	instances, plotErr := app.GetSessionsInstancesPlot(plotCtx, deps.RchPool, af)
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

func (c *Config) mcpGetBugReports(ctx context.Context, in mcpGetBugReportsInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := c.mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}

	limit := in.Limit
	if limit <= 0 {
		limit = 10
	}
	if limit > 30 {
		limit = 30
	}
	af.Limit = limit
	af.Offset = in.Offset
	af.BugReport = true

	if in.FreeText != "" {
		af.FreeText = in.FreeText
	}
	if len(in.BugReportStatuses) > 0 {
		statuses := make([]int8, len(in.BugReportStatuses))
		for i, s := range in.BugReportStatuses {
			statuses[i] = int8(s)
		}
		af.BugReportStatuses = statuses
	}

	app := &measure.App{ID: &appID, TeamId: teamID}
	bugCtx := ambient.WithTeamId(ctx, teamID)
	bugReports, _, _, bugErr := app.GetBugReportsWithFilter(bugCtx, deps.RchPool, af)
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

	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := c.mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}
	af.Timezone = in.Timezone
	af.Limit = filter.DefaultPaginationLimit
	af.BugReport = true

	if len(in.BugReportStatuses) > 0 {
		statuses := make([]int8, len(in.BugReportStatuses))
		for i, s := range in.BugReportStatuses {
			statuses[i] = int8(s)
		}
		af.BugReportStatuses = statuses
	}

	app := &measure.App{ID: &appID, TeamId: teamID}
	plotCtx := ambient.WithTeamId(ctx, teamID)
	instances, plotErr := app.GetBugReportInstancesPlot(plotCtx, deps.RchPool, af)
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

	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := c.mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}

	limit := in.Limit
	if limit <= 0 {
		limit = 10
	}
	if limit > 30 {
		limit = 30
	}
	af.Limit = limit
	af.Offset = in.Offset
	af.Span = true

	if len(in.SpanStatuses) > 0 {
		statuses := make([]int8, len(in.SpanStatuses))
		for i, s := range in.SpanStatuses {
			statuses[i] = int8(s)
		}
		af.SpanStatuses = statuses
	}

	app := &measure.App{ID: &appID, TeamId: teamID}
	spanCtx := ambient.WithTeamId(ctx, teamID)
	spans, _, _, spanErr := app.GetSpansForSpanNameWithFilter(spanCtx, deps.RchPool, in.RootSpanName, af)
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

	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := c.mcpBuildAppFilter(ctx, appID, in.mcpCommonFilters)
	if err != nil {
		return nil, nil, err
	}
	af.Timezone = in.Timezone
	af.Limit = filter.DefaultPaginationLimit
	af.Span = true

	if len(in.SpanStatuses) > 0 {
		statuses := make([]int8, len(in.SpanStatuses))
		for i, s := range in.SpanStatuses {
			statuses[i] = int8(s)
		}
		af.SpanStatuses = statuses
	}

	app := &measure.App{ID: &appID, TeamId: teamID}
	plotCtx := ambient.WithTeamId(ctx, teamID)
	instances, plotErr := app.GetMetricsPlotForSpanNameWithFilter(plotCtx, deps.RchPool, in.RootSpanName, af)
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
	appID, _, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af := &filter.AppFilter{AppID: appID}

	from, to, parseErr := mcpParseTimeRangeStrings(in.From, in.To)
	if parseErr != nil {
		return nil, nil, parseErr
	}
	af.From, af.To = from, to

	limit := in.Limit
	if limit <= 0 {
		limit = 10
	}
	if limit > 30 {
		limit = 30
	}
	af.Limit = limit
	af.Offset = in.Offset

	alerts, _, _, alertErr := measure.GetAlertsWithFilter(ctx, deps.PgPool, af)
	if alertErr != nil {
		return nil, nil, fmt.Errorf("failed to get alerts: %v", alertErr)
	}
	data, _ := json.Marshal(alerts)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetJourney(ctx context.Context, in mcpGetJourneyInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	cf := mcpCommonFilters{
		AppID:        in.AppID,
		From:         in.From,
		To:           in.To,
		Versions:     in.Versions,
		VersionCodes: in.VersionCodes,
	}
	af, err := c.mcpBuildAppFilter(ctx, appID, cf)
	if err != nil {
		return nil, nil, err
	}
	af.Limit = filter.DefaultPaginationLimit

	app := &measure.App{ID: &appID, TeamId: teamID}
	if err := app.Populate(ctx, deps.PgPool); err != nil {
		return nil, nil, err
	}
	journeyCtx := ambient.WithTeamId(ctx, teamID)

	opts := filter.JourneyOpts{All: true}
	journeyEvents, journeyErr := app.GetJourneyEvents(journeyCtx, deps.RchPool, af, opts)
	if journeyErr != nil {
		return nil, nil, fmt.Errorf("failed to get journey: %v", journeyErr)
	}

	type journeyNode struct {
		Source string `json:"source"`
		Target string `json:"target"`
		Value  int    `json:"value"`
	}

	type result struct {
		Nodes []string      `json:"nodes"`
		Links []journeyNode `json:"links"`
	}

	nodeSet := make(map[string]bool)
	var links []journeyNode

	for i := 1; i < len(journeyEvents); i++ {
		src := journeyEvents[i-1].Type
		tgt := journeyEvents[i].Type
		nodeSet[src] = true
		nodeSet[tgt] = true
		links = append(links, journeyNode{Source: src, Target: tgt, Value: 1})
	}

	var nodes []string
	for n := range nodeSet {
		nodes = append(nodes, n)
	}

	data, _ := json.Marshal(result{Nodes: nodes, Links: links})
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

func (c *Config) mcpBuildNetworkFilter(ctx context.Context, appID uuid.UUID, nf mcpNetworkFilters) (*filter.AppFilter, error) {
	af, err := c.mcpBuildAppFilter(ctx, appID, nf.mcpCommonFilters)
	if err != nil {
		return nil, err
	}
	if len(nf.HttpMethods) > 0 {
		af.HttpMethods = nf.HttpMethods
	}
	return af, nil
}

func (c *Config) mcpGetUniqueDomains(ctx context.Context, in mcpGetUniqueDomainsInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	from, to, err := mcpParseTimeRangeStrings(in.From, in.To)
	if err != nil {
		return nil, nil, err
	}

	domains, err := network.FetchDomains(ctx, deps.ChPool, appID, teamID, from, to)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get network domains: %v", err)
	}
	if domains == nil {
		domains = []string{}
	}
	data, _ := json.Marshal(domains)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetPathsForDomain(ctx context.Context, in mcpGetPathsForDomainInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	if in.Domain == "" {
		return nil, nil, fmt.Errorf("domain is required")
	}

	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	from, to, err := mcpParseTimeRangeStrings(in.From, in.To)
	if err != nil {
		return nil, nil, err
	}

	paths, err := network.FetchPaths(ctx, deps.ChPool, appID, teamID, in.Domain, in.Search, from, to)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get network paths: %v", err)
	}
	if paths == nil {
		paths = []string{}
	}
	data, _ := json.Marshal(paths)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetNetworkTrends(ctx context.Context, in mcpGetNetworkTrendsInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := c.mcpBuildNetworkFilter(ctx, appID, in.mcpNetworkFilters)
	if err != nil {
		return nil, nil, err
	}

	limit := in.Limit
	if limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}

	result, err := network.FetchTrends(ctx, deps.ChPool, appID, teamID, af, limit)
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

	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := c.mcpBuildNetworkFilter(ctx, appID, in.mcpNetworkFilters)
	if err != nil {
		return nil, nil, err
	}
	af.Timezone = in.Timezone
	af.SetDefaultPlotTimeGroup()

	groupExpr, err := measure.GetPlotTimeGroupExpr("timestamp", af.PlotTimeGroup)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to compute time group expression: %v", err)
	}

	result, err := network.GetNetworkOverviewStatusCodesPlot(ctx, deps.ChPool, appID, teamID, af, groupExpr.BucketExpr, groupExpr.DatetimeFormat)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get network status overview over time: %v", err)
	}
	data, _ := json.Marshal(result)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetHttpEndpointLatencyOverTime(ctx context.Context, in mcpGetHttpEndpointLatencyOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	if in.Domain == "" {
		return nil, nil, fmt.Errorf("domain is required")
	}
	if in.Path == "" {
		return nil, nil, fmt.Errorf("path is required")
	}
	if in.Timezone == "" {
		return nil, nil, fmt.Errorf("timezone is required for over time tools")
	}

	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	domain := in.Domain
	path := in.Path

	af, err := c.mcpBuildNetworkFilter(ctx, appID, in.mcpNetworkFilters)
	if err != nil {
		return nil, nil, err
	}
	af.Timezone = in.Timezone
	af.SetDefaultPlotTimeGroup()

	groupExpr, err := measure.GetPlotTimeGroupExpr("timestamp", af.PlotTimeGroup)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to compute time group expression: %v", err)
	}

	result, err := network.GetEndpointLatencyPlot(ctx, deps.ChPool, appID, teamID, domain, path, af, groupExpr.BucketExpr, groupExpr.DatetimeFormat)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get network latency over time: %v", err)
	}
	data, _ := json.Marshal(result)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetHttpEndpointStatusCodesOverTime(ctx context.Context, in mcpGetHttpEndpointStatusCodesOverTimeInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	if in.Domain == "" {
		return nil, nil, fmt.Errorf("domain is required")
	}
	if in.Path == "" {
		return nil, nil, fmt.Errorf("path is required")
	}
	if in.Timezone == "" {
		return nil, nil, fmt.Errorf("timezone is required for over time tools")
	}

	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	domain := in.Domain
	path := in.Path

	af, err := c.mcpBuildNetworkFilter(ctx, appID, in.mcpNetworkFilters)
	if err != nil {
		return nil, nil, err
	}
	af.Timezone = in.Timezone
	af.SetDefaultPlotTimeGroup()

	groupExpr, err := measure.GetPlotTimeGroupExpr("timestamp", af.PlotTimeGroup)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to compute time group expression: %v", err)
	}

	result, err := network.GetEndpointStatusCodesPlot(ctx, deps.ChPool, appID, teamID, domain, path, af, groupExpr.BucketExpr, groupExpr.DatetimeFormat)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get network status distribution over time: %v", err)
	}
	data, _ := json.Marshal(result)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetNetworkTimeline(ctx context.Context, in mcpGetNetworkTimelineInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	af, err := c.mcpBuildNetworkFilter(ctx, appID, in.mcpNetworkFilters)
	if err != nil {
		return nil, nil, err
	}

	result, err := network.FetchOverviewTimelinePlot(ctx, deps.ChPool, appID, teamID, af, 0)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get network request timeline: %v", err)
	}
	data, _ := json.Marshal(result)
	return mcpTextResult(string(data)), nil, nil
}

func (c *Config) mcpGetNetworkEndpointTimeline(ctx context.Context, in mcpGetNetworkEndpointTimelineInput) (*mcpsdk.CallToolResult, any, error) {
	deps := c.Deps
	appID, teamID, err := c.mcpResolveAppAccess(ctx, in.AppID)
	if err != nil {
		return nil, nil, err
	}

	if in.Domain == "" {
		return nil, nil, fmt.Errorf("domain is required")
	}
	if in.Path == "" {
		return nil, nil, fmt.Errorf("path is required")
	}

	domain := in.Domain
	path := in.Path

	af, err := c.mcpBuildNetworkFilter(ctx, appID, in.mcpNetworkFilters)
	if err != nil {
		return nil, nil, err
	}

	result, err := network.FetchEndpointTimelinePlot(ctx, deps.ChPool, appID, teamID, domain, path, af)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get network endpoint timeline: %v", err)
	}
	data, _ := json.Marshal(result)
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
