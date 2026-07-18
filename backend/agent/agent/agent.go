package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"backend/agent/server"
	"backend/libs/opsys"
	"backend/libs/secret"
	"backend/libs/slack"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("agent")

// UnavailableReply is the canned reply every surface returns while the agent
// is disabled (AGENT_ENABLED is not "true").
const UnavailableReply = "Measure Agent is unavailable at the moment. Please try again later."

// userIDKey carries the authenticated user id in a context.
type userIDKey struct{}

// WithUserID returns a context carrying the authenticated user id. The
// transport that authenticated the request sets it; tools read it for
// access checks.
func WithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, userIDKey{}, userID)
}

// UserIDFromContext returns the user id set by WithUserID.
func UserIDFromContext(ctx context.Context) (string, bool) {
	v, ok := ctx.Value(userIDKey{}).(string)
	return v, ok && v != ""
}

// teamScopeKey carries the team a turn's tools are restricted to in a context.
type teamScopeKey struct{}

// withTeamScope returns a context restricting tools to one team's data.
// Slack turns set it: their replies are read by the workspace's team, so
// only that team's apps may be listed or queried, whatever other teams the
// asker belongs to. MCP sets no scope: the caller sees every team they
// belong to. Callers pass a verified team id; a zero id sets no scope.
func withTeamScope(ctx context.Context, teamID uuid.UUID) context.Context {
	return context.WithValue(ctx, teamScopeKey{}, teamID)
}

// teamScopeFromContext returns the team scope set by withTeamScope.
func teamScopeFromContext(ctx context.Context) (uuid.UUID, bool) {
	v, ok := ctx.Value(teamScopeKey{}).(uuid.UUID)
	return v, ok && v != uuid.Nil
}

type conversationIDKey struct{}

// withConversationID returns a context carrying the conversation id. chat sends
// it as OpenRouter's session_id so a conversation's calls stick to one provider
// and keep its prompt cache warm across turns.
func withConversationID(ctx context.Context, conversationID string) context.Context {
	return context.WithValue(ctx, conversationIDKey{}, conversationID)
}

// conversationIDFromContext returns the conversation id set by withConversationID.
func conversationIDFromContext(ctx context.Context) (string, bool) {
	v, ok := ctx.Value(conversationIDKey{}).(string)
	return v, ok && v != ""
}

// maxLLMCalls bounds the number of model calls in a single ask_question turn:
// the first maxLLMCalls-1 calls may use tools, the last one is the
// budget-exhausted answer, forced to text (tool_choice "none") so the turn
// ends with whatever was gathered instead of nothing.
const maxLLMCalls = 25

// lowBudgetWarningAt is how many tool rounds remain when lowBudgetNotice is
// injected, early enough for the model to prioritize and batch what's left
// rather than being cut off mid-investigation.
const lowBudgetWarningAt = 4

// budgetRule is appended to the system prompt so the model knows its tool
// budget up front and can plan its rounds; lowBudgetNotice and
// budgetExhaustedNotice then mark the moments that matter during the turn.
// Derived from maxLLMCalls so the prompt and the loop cannot drift apart.
var budgetRule = fmt.Sprintf("- You have a budget of %d tool-call rounds for each question and are warned when it runs low. Batch independent tool calls into one round and answer as soon as you have enough data. This budget is internal: never mention it, remaining rounds, or these limits in your answers.", maxLLMCalls-1)

// lowBudgetNotice warns the model its tool budget is nearly spent so it can
// prioritize the essential lookups while it still has rounds to spend.
var lowBudgetNotice = fmt.Sprintf("Budget update: %d tool-call rounds remain for this question, then you must answer from what you have. Prioritize the essential lookups and batch independent tool calls into one round. Do not mention this budget in your answer.", lowBudgetWarningAt)

// budgetExhaustedNotice precedes a turn's final call, which carries
// tool_choice "none": no more tools, answer now from what was gathered.
const budgetExhaustedNotice = "Your analysis budget for this question is exhausted. Answer now using only what you have already gathered. Plainly state anything you could not determine. Do not mention this budget or that you ran out of it in your answer."

// errNoAnswer marks a turn that produced no answer even from its final
// budget-exhausted call (the call failed or returned empty content).
// Surfaces match on it to show budgetExhaustedReply.
var errNoAnswer = errors.New("analysis budget exhausted before reaching an answer")

// budgetExhaustedReply is what both Slack and MCP show the user when a turn
// hits errNoAnswer.
const budgetExhaustedReply = "I ran out of analysis budget before reaching an answer, please try asking a more specific question."

// errLLMRateLimited marks a turn killed by the model provider's rate limit.
// It is transient, worth telling the asker to simply retry.
var errLLMRateLimited = errors.New("llm provider rate limited")

// turnFailureMarker stands in for the assistant's reply when a turn dies before
// it can answer (a rate limit or other transient model error). Persisting it
// caps the failed turn so a later "try again" reads as a clean retry of the
// question above it rather than two user turns in a row. It stays neutral on
// purpose: the only reader is the model on the next turn, which needs to know
// the attempt did not finish, not why. "temporary" is the one signal worth
// carrying, that retrying is sensible; the specific cause goes to the logs and
// to the surface-specific reply the asker actually sees.
const turnFailureMarker = "Previous attempt did not complete due to a temporary error."

// Config holds the agent's LLM configuration. The model tiers map to task
// difficulty: small handles summarization, medium answers questions, large
// is reserved for harder future tasks.
type Config struct {
	// Deps holds the process infrastructure (Postgres, ClickHouse, Valkey,
	// mail, config). The data-access methods on *Config read it directly via
	// c.Deps.
	Deps *server.Deps

	BaseURL     string
	APIKey      string
	ModelSmall  string
	ModelMedium string
	ModelLarge  string

	// The tools offered to the model and the name lookup dispatch uses for
	// the common ones: the agent's own SQL tools plus every common tool, so
	// the model picks the purpose-built tool when one fits and drops to SQL
	// when none does.
	modelTools      []chatTool
	commonToolIndex map[string]Tool
}

// NewConfig reads the agent configuration from the environment.
func NewConfig() *Config {
	apiKey, err := secret.FromEnvOrFile("LLM_AGENT_KEY")
	if err != nil {
		log.Printf("failed to read LLM_AGENT_KEY: %v", err)
	}
	if apiKey == "" {
		log.Println("LLM_AGENT_KEY env var not set, the ask_question tool will return errors")
	}

	modelSmall := os.Getenv("LLM_AGENT_MODEL_SMALL")
	if modelSmall == "" {
		log.Println("LLM_AGENT_MODEL_SMALL env var not set, conversation compaction will return errors")
	}

	modelMedium := os.Getenv("LLM_AGENT_MODEL_MEDIUM")
	if modelMedium == "" {
		log.Println("LLM_AGENT_MODEL_MEDIUM env var not set, the ask_question tool will return errors")
	}

	cfg := &Config{
		BaseURL:     "https://openrouter.ai/api/v1",
		APIKey:      apiKey,
		ModelSmall:  modelSmall,
		ModelMedium: modelMedium,
		ModelLarge:  os.Getenv("LLM_AGENT_MODEL_LARGE"),
	}

	cfg.initTools()

	return cfg
}

// initTools wires the tool catalog onto the config: the model-facing tool
// list and the name index that dispatch uses for the common tools.
func (c *Config) initTools() {
	c.modelTools = slices.Clone(builtinTools)
	c.commonToolIndex = map[string]Tool{}
	for _, t := range commonTools(c) {
		c.commonToolIndex[t.def.Name] = t
		c.modelTools = append(c.modelTools, chatTool{
			Type: "function",
			Function: chatToolFunction{
				Name:        t.def.Name,
				Description: t.def.Description,
				Parameters:  t.params,
			},
		})
	}
}

// dashboardLink returns the word "dashboard" as a markdown link to one of the
// team's dashboard pages ("team", "apps", "usage"). Slack replies convert it
// to mrkdwn via toMrkdwn; MCP clients render the markdown as is. Without a
// configured site origin there is no address to point at, so it degrades to
// the plain word.
func (c *Config) dashboardLink(teamID uuid.UUID, page string) string {
	origin := strings.TrimSuffix(c.Deps.Config.SiteOrigin, "/")
	if origin == "" {
		return "dashboard"
	}
	return fmt.Sprintf("[dashboard](%s/%s/%s)", origin, teamID, page)
}

// maxQuestionApps caps how many apps one ask_question call may name,
// rejected before any parsing or database work. The app_ids schema
// description states the limit.
const maxQuestionApps = 50

type askQuestionInput struct {
	AppIDs   []string `json:"app_ids" jsonschema:"UUIDs of the apps the question is about, at most 50; all must belong to one team"`
	Question string   `json:"question" jsonschema:"Self-contained natural-language question about the apps' telemetry; each call is independent, so include any relevant findings from earlier answers"`
}

type askQuestionOutput struct {
	Answer string `json:"answer"`
}

const systemPrompt = `You are Measure's query agent. You answer questions about the telemetry of a team's mobile apps (events, exceptions, ANRs, sessions, spans, network requests). The team's apps are listed at the end of this message; a question can be about one app, several, or all of them.

Rules:
- If the message is a greeting, thanks, or other small talk rather than a question, reply briefly and warmly without calling any tools, and offer to help with the team's apps.
- Stay on your domain: the team's apps, their telemetry, and debugging them. Advice on likely causes and fixes for issues seen in these apps is in scope. If asked for something unrelated, such as general knowledge or writing content, say that is outside what you help with instead of fulfilling the request.
- Work out from the app list which apps the question is about. If it doesn't identify any and isn't about the team's apps as a whole, ask which app is meant instead of guessing.
- When the question did not name the app(s) outright, open the answer by saying which app(s) it covers, so a wrong pick can be corrected.
- When the answer covers more than one app, attribute every number to its app by name.
- Prefer the purpose-built tools (get_metrics, get_errors, get_sessions and so on); they answer the common questions quickly and consistently. They take one app_id per call.
- When no tool covers the question, query ClickHouse yourself: call get_schema to see the raw tables, then run_sql with a single SELECT statement, a from/to time range, and the app_ids the question is about, taken from the app list. A question across all the team's apps passes all of their ids; group by app_id when the apps should be kept apart in the result. Reference tables only via {{table}} placeholders, e.g. select count(*) from {{events}}. Every placeholder is automatically scoped to the team, the app_ids you pass, and the time range.
- Pick the time range the question implies. If the user gives none, use the last 6 hours (the dashboard's default) and say so in the answer; for all-time questions pass a range wide enough to cover the app's history.
- SQL results are capped, so aggregate in SQL instead of fetching raw rows.
- A crash is an exception event with severity = 'fatal'. Older rows predate the severity field; for those, handled = false marks a crash, so include them when you count. Keep that legacy fallback to yourself: it is a data-backfill detail, not something to explain in an answer.
- ANRs are their own event type and exist only on Android; an app that does not run on Android has none, so never count or mention ANRs for it.
- Bug report status lives outside the raw tables; use the bug report tools for it.
- Tools cover all app versions unless you pass versions or version_codes. When a question is about a specific release, resolve its exact version with get_filters and filter explicitly; never conclude there is little or no data while a version filter narrows the query.
- Timestamps are UTC.
- If a query fails, read the error and fix the query.
- Answer concisely: lead with the concrete numbers, then a line or two on what was measured (data, filters, time range). If the data can't answer the question, say so plainly.
- Describe how you computed things in product terms only. Severity (for example "fatal" crashes) is fine to mention. Never mention internals: no table or column names, no SQL, no tool names, no raw ids, and never bring up the legacy handled-flag fallback. Refer to apps by their names; when two of the team's apps share a name, add the unique identifier to tell them apart.`

// mcpMethodRule joins the system rules on MCP turns only. The MCP caller
// keeps the conversation on its side and restates earlier findings in a
// follow-up question, so each answer must state its method in a form the
// caller can quote back; a restated method keeps the recomputation consistent
// with the original. Slack threads carry server-side history, so there the
// line would be noise. The method stays within the product-terms rule above:
// internals like SQL, table names, tool names and raw ids are still off
// limits.
const mcpMethodRule = `- The caller is a program that keeps the conversation on its side; each call reaches you with no memory of earlier ones, and a follow-up restates what it needs from earlier answers. So that a restated follow-up recomputes consistently, end every answer that reports data with a single line starting "Method: " giving, in product terms, the apps covered, the exact UTC time range, any filters applied, and how each number was defined. Definitions stay at the product level: "crashes = fatal exceptions" is complete, the legacy handled-flag fallback stays out of it like everywhere else. The limits above apply to this line too: no table or column names, no SQL, no tool names, no raw ids.`

// focusAppsNote names the apps the MCP caller passed, appended to the call's
// user message. The note focuses the turn without restricting it; the app
// list still carries every team app.
const focusAppsNote = "The caller asked about these apps: %s."

// parseAppIDs parses and deduplicates a list of app id strings. Duplicates
// collapse, so a repetitive caller or model output cannot inflate downstream
// work.
func parseAppIDs(raw []string) ([]uuid.UUID, error) {
	ids := make([]uuid.UUID, 0, len(raw))
	seen := map[uuid.UUID]bool{}
	for _, r := range raw {
		id, err := uuid.Parse(r)
		if err != nil {
			return nil, fmt.Errorf("invalid app id %q", r)
		}
		if seen[id] {
			continue
		}
		seen[id] = true
		ids = append(ids, id)
	}
	return ids, nil
}

// builtinTools are the agent's own tools for ad-hoc SQL over the raw tables.
var builtinTools = []chatTool{
	{
		Type: "function",
		Function: chatToolFunction{
			Name:        "get_schema",
			Description: "List the queryable ClickHouse tables and their columns. Call this before writing SQL.",
			Parameters:  json.RawMessage(`{"type":"object","properties":{}}`),
		},
	},
	{
		Type: "function",
		Function: chatToolFunction{
			Name:        "run_sql",
			Description: "Run a single read-only ClickHouse SELECT bounded to a time range and scoped to the given apps. Reference tables only via {{table}} placeholders.",
			Parameters:  json.RawMessage(`{"type":"object","properties":{"query":{"type":"string","description":"ClickHouse SELECT statement using {{table}} placeholders"},"app_ids":{"type":"array","items":{"type":"string"},"description":"UUIDs of the apps to query, from the app list; a question across all the team's apps passes all of them"},"from":{"type":"string","description":"Start of time range (RFC3339)"},"to":{"type":"string","description":"End of time range (RFC3339)"}},"required":["query","app_ids","from","to"]}`),
		},
	},
}

// resolveAppsAccess verifies every app exists, all belong to one team, and
// the user is a member of that team. It returns the team's id and Autumn
// customer id, read off the team row in the same query since the billing
// gate needs it next.
func (c *Config) resolveAppsAccess(ctx context.Context, userID uuid.UUID, appIDs []uuid.UUID) (teamID uuid.UUID, customerID string, err error) {
	if len(appIDs) == 0 {
		return uuid.Nil, "", fmt.Errorf("no apps given")
	}

	deps := c.Deps
	// pgx has no encode plan for []uuid.UUID; pass strings and cast.
	ids := uuid.UUIDs(appIDs).Strings()
	stmt := sqlf.PostgreSQL.
		Select("a.id, t.id, t.autumn_customer_id").
		From("apps a").
		Join("teams t", "a.team_id = t.id").
		Join("team_membership tm", "tm.team_id = t.id").
		Where("a.id = any(?::uuid[])", ids).
		Where("tm.user_id = ?", userID)
	defer stmt.Close()

	rows, err := deps.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return uuid.Nil, "", err
	}
	defer rows.Close()

	found := map[uuid.UUID]bool{}
	teams := map[uuid.UUID]bool{}
	for rows.Next() {
		var appID, appTeamID uuid.UUID
		var autumnCustomerID *string
		if err := rows.Scan(&appID, &appTeamID, &autumnCustomerID); err != nil {
			return uuid.Nil, "", err
		}
		found[appID] = true
		teams[appTeamID] = true
		teamID = appTeamID
		if autumnCustomerID != nil {
			customerID = *autumnCustomerID
		}
	}
	if err := rows.Err(); err != nil {
		return uuid.Nil, "", err
	}

	for _, appID := range appIDs {
		if !found[appID] {
			return uuid.Nil, "", fmt.Errorf("app not found or access denied")
		}
	}
	if len(teams) > 1 {
		return uuid.Nil, "", fmt.Errorf("all apps must belong to one team")
	}
	return teamID, customerID, nil
}

// askQuestion answers one MCP question: authenticate, check access and
// billing, then run the turn. Each call is independent: the MCP client holds
// the conversational context and restates what a follow-up needs.
func (c *Config) askQuestion(ctx context.Context, in askQuestionInput) (out askQuestionOutput, err error) {
	ctx, span := tracer.Start(ctx, "agent.ask_question")
	defer span.End()
	turnRan := false
	defer func() {
		if err == nil {
			return
		}
		span.SetStatus(codes.Error, err.Error())
		// Failures inside the turn already produced runTurn's log line.
		if !turnRan {
			log.Printf("agent: ask_question rejected err=%v", err)
		}
	}()

	userIDStr, ok := UserIDFromContext(ctx)
	if !ok {
		return out, fmt.Errorf("unauthenticated")
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return out, fmt.Errorf("unauthenticated")
	}

	question := strings.TrimSpace(in.Question)
	if question == "" {
		return out, fmt.Errorf("question is required")
	}
	if len(in.AppIDs) == 0 {
		return out, fmt.Errorf("app_ids is required")
	}
	if len(in.AppIDs) > maxQuestionApps {
		return out, fmt.Errorf("app_ids has %d entries, the limit is %d apps", len(in.AppIDs), maxQuestionApps)
	}
	appIDs, err := parseAppIDs(in.AppIDs)
	if err != nil {
		return out, err
	}

	teamID, customerID, err := c.resolveAppsAccess(ctx, userID, appIDs)
	if err != nil {
		return out, err
	}
	// Stamp the ids now so spans of pre-turn rejections (billing, missing
	// conversation) still say who they were about.
	span.SetAttributes(
		attribute.String("agent.app_ids", strings.Join(uuid.UUIDs(appIDs).Strings(), ",")),
		attribute.String("agent.team_id", teamID.String()),
	)

	if err := c.checkAgentAllowed(ctx, customerID); err != nil {
		return out, errors.New(agentNotAllowedReply(c.dashboardLink(teamID, "usage")))
	}

	// Every call runs as its own conversation. The row exists for the
	// transcript and token metering, not for continuation: follow-up context
	// is the caller's to carry in the question.
	conv := &conversation{UserID: userID, TeamID: teamID, Surface: "mcp"}
	if err := c.createConversation(ctx, conv, conversationTitle(question)); err != nil {
		return out, err
	}

	turnRan = true
	// MCP turns are not offered the chart tool, so no charts come back.
	answer, _, err := c.runTurn(ctx, turn{
		userID:     userID,
		teamID:     teamID,
		customerID: customerID,
		conv:       conv,
		question:   question,
		entryPoint: "mcp",
		appIDs:     appIDs,
	})
	if err != nil {
		if errors.Is(err, errNoAnswer) {
			return out, errors.New(budgetExhaustedReply)
		}
		return out, err
	}

	out.Answer = answer
	return out, nil
}

// conversationTitle derives a conversation's title from its first question,
// truncating on a rune boundary, because a byte slice could cut a multi-byte
// character in half and produce text Postgres rejects as invalid UTF-8.
func conversationTitle(question string) string {
	const maxRunes = 120
	if utf8.RuneCountInString(question) <= maxRunes {
		return question
	}
	return string([]rune(question)[:maxRunes])
}

// turn is one resolved question: who is asking, on which team, in which
// conversation, from which surface. Callers establish identity, access and
// billing before building one. The model decides which apps the question is
// about, from the app list in the system message.
type turn struct {
	userID     uuid.UUID
	teamID     uuid.UUID
	customerID string
	conv       *conversation
	continued  bool
	question   string
	entryPoint string
	// appIDs is the set of apps the MCP caller named in the call, sent to the
	// model as focusAppsNote; empty on Slack.
	appIDs []uuid.UUID
}

// getTeamApps returns the team's apps in creation order. The list is
// re-read every turn on purpose: apps appear and platforms become known as
// telemetry arrives.
func (c *Config) getTeamApps(ctx context.Context, teamID uuid.UUID) ([]measureApp, error) {
	stmt := sqlf.PostgreSQL.
		Select("id, coalesce(app_name, ''), coalesce(unique_identifier, ''), os_names").
		From("apps").
		Where("team_id = ?", teamID).
		OrderBy("created_at, id")
	defer stmt.Close()

	rows, err := c.Deps.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var apps []measureApp
	for rows.Next() {
		var a measureApp
		if err := rows.Scan(&a.id, &a.name, &a.uniqueIdentifier, &a.osNames); err != nil {
			return nil, err
		}
		apps = append(apps, a)
	}
	return apps, rows.Err()
}

// runTurn executes one question in a resolved conversation: load the
// history, run the LLM/tool loop, save the transcript, report usage and
// analytics. charts are the images the turn rendered for delivery alongside
// the answer; only Slack turns can produce them, since only that surface
// offers the render_chart tool.
func (c *Config) runTurn(ctx context.Context, t turn) (answer string, chartsOut []renderedChart, err error) {
	start := time.Now()
	llmCalls := 0
	// budgetExhaustedAnswer marks an answer produced by the final forced call
	// rather than by the model stopping on its own; its rate is the signal
	// for whether maxLLMCalls is sized right.
	budgetExhaustedAnswer := false
	// Token usage split by the model that produced it: compaction runs on the
	// small model, the turn's own calls on the medium model. Reported together
	// for observability, billed per model. Reasoning tokens (a subset of
	// completion) and cache read/write tokens are aggregated the same way, used
	// for observability, not used in billing; we don't assume which tier reasons
	// or caches, since models can be swapped.
	var comp, turn tokenUsage
	convID := t.conv.ID.String()

	// The common tools authorize through the user id in the context. Set it
	// from the turn so every surface provides it, since only some transports
	// set it in their middleware.
	ctx = WithUserID(ctx, t.userID.String())
	// Stick this conversation's calls to one provider so its prompt cache stays
	// warm across turns; chat sends this as OpenRouter's session_id.
	ctx = withConversationID(ctx, convID)

	span := trace.SpanFromContext(ctx)
	span.SetAttributes(
		attribute.String("agent.team_id", t.teamID.String()),
		attribute.String("agent.conversation_id", convID),
		attribute.Bool("agent.conversation_continued", t.continued),
		attribute.String("agent.entry_point", t.entryPoint),
	)
	defer func() {
		total := comp
		total.add(turn)
		// reasoning and cache counts are logged only when present.
		extra := ""
		if total.reasoning > 0 {
			extra += fmt.Sprintf(" reasoning_tokens=%d", total.reasoning)
		}
		if total.cacheRead > 0 {
			extra += fmt.Sprintf(" cache_read_tokens=%d", total.cacheRead)
		}
		if total.cacheWrite > 0 {
			extra += fmt.Sprintf(" cache_write_tokens=%d", total.cacheWrite)
		}
		if budgetExhaustedAnswer {
			extra += " budget_exhausted_answer=true"
		}
		span.SetAttributes(
			attribute.Int("agent.llm_calls", llmCalls),
			attribute.Int("agent.prompt_tokens", total.prompt),
			attribute.Int("agent.completion_tokens", total.completion),
			attribute.Int("agent.reasoning_tokens", total.reasoning),
			attribute.Int("agent.cache_read_tokens", total.cacheRead),
			attribute.Int("agent.cache_write_tokens", total.cacheWrite),
			attribute.Bool("agent.budget_exhausted_answer", budgetExhaustedAnswer),
		)
		if err != nil {
			span.SetStatus(codes.Error, err.Error())
		}
		log.Printf("agent: turn entry_point=%s conversation=%q llm_calls=%d prompt_tokens=%d completion_tokens=%d%s duration=%s err=%v",
			t.entryPoint, convID, llmCalls, total.prompt, total.completion, extra, time.Since(start).Round(time.Millisecond), err)
		fireAgentQueryEvent(t.userID.String(), agentQueryEvent{
			appIDs:                strings.Join(uuid.UUIDs(t.appIDs).Strings(), ","),
			teamID:                t.teamID.String(),
			conversationID:        convID,
			continued:             t.continued,
			entryPoint:            t.entryPoint,
			llmCalls:              llmCalls,
			promptTokens:          total.prompt,
			completionTokens:      total.completion,
			reasoningTokens:       total.reasoning,
			cacheReadTokens:       total.cacheRead,
			cacheWriteTokens:      total.cacheWrite,
			budgetExhaustedAnswer: budgetExhaustedAnswer,
			duration:              time.Since(start),
			success:               err == nil,
		})
	}()

	history, err := c.loadMessages(ctx, t.conv.ID)
	if err != nil {
		return "", nil, fmt.Errorf("failed to load conversation: %w", err)
	}
	elideOldToolResults(history)
	history, comp = c.compactIfNeeded(ctx, t.conv.ID, history)
	// Compaction runs a small-model call, so meter it on that model, a no-op
	// when no compaction happened.
	trackAgentTokens(c.Deps, t.customerID, c.ModelSmall, comp)

	messages := make([]chatMessage, 0, len(history)+2)
	// The app list is what the prompt shows the model and what run_sql
	// validates app ids against, so a fetch error fails the turn rather than
	// telling the model the team has no apps. MCP clients receive the error
	// as the tool result, so it stays plain; the cause goes to the log.
	apps, err := c.getTeamApps(ctx, t.teamID)
	if err != nil {
		log.Printf("agent: failed to fetch team apps for team %s: %v", t.teamID, err)
		return "", nil, errors.New("could not load the team's apps, please try again")
	}
	// One line per team app: label, app_id, platforms. An app with no
	// telemetry yet gets no platform claim.
	appList := "The team has no apps in Measure yet."
	if len(apps) > 0 {
		var b strings.Builder
		b.WriteString("The team's apps; pass the right app_id to tools that take one:")
		for _, a := range apps {
			b.WriteString("\n- ")
			b.WriteString(a.label())
			b.WriteString(", app_id ")
			b.WriteString(a.id.String())
			if len(a.osNames) == 0 {
				b.WriteString(", platform unknown (no telemetry yet)")
				continue
			}
			b.WriteString(", runs on ")
			b.WriteString(strings.Join(a.osNames, ", "))
			if opsys.ToFamily(a.osNames[0]) != opsys.Android {
				b.WriteString(" (no ANRs)")
			}
		}
		appList = b.String()
	}
	rules := systemPrompt
	if t.entryPoint == "mcp" {
		rules += "\n" + mcpMethodRule
	}
	sysMsg := fmt.Sprintf("%s\n%s\n\n%s", rules, budgetRule, appList)
	messages = append(messages, chatMessage{Role: "system", Content: sysMsg})
	for _, m := range history {
		messages = append(messages, m.msg)
	}

	var newMessages []storedMessage
	// The caller's focus is part of the user message, like the current time
	// below: per-call metadata the model treats as past context once the
	// turn is history. Apps are written with their list labels; an app
	// deleted since validation falls back to its id.
	focus := ""
	if len(t.appIDs) > 0 {
		labels := make([]string, 0, len(t.appIDs))
		for _, id := range t.appIDs {
			label := id.String()
			for _, a := range apps {
				if a.id == id {
					label = a.label()
					break
				}
			}
			labels = append(labels, label)
		}
		focus = "\n" + fmt.Sprintf(focusAppsNote, strings.Join(labels, ", "))
	}

	// The common tools need absolute time ranges, so the model is told the
	// current time on the user turn. It is stored exactly as sent, so once this
	// turn becomes history the cached prefix still matches on the next turn.
	userMsg := chatMessage{Role: "user", Content: fmt.Sprintf("%s\n\ncurrent UTC time: %s%s", t.question, time.Now().UTC().Format(time.RFC3339), focus)}
	messages = append(messages, userMsg)
	newMessages = append(newMessages, storedMessage{msg: userMsg})

	// Charts can only be delivered on Slack, uploaded into the thread, so
	// only Slack turns offer the tool; MCP output stays text. A conversation
	// is bound to one surface, so the tool list is stable across its turns
	// and the cached prompt prefix holds.
	tools := c.modelTools
	if t.entryPoint == slack.SurfaceMention || t.entryPoint == slack.SurfaceAssistant {
		tools = append(slices.Clone(c.modelTools), renderChartTool)
	}
	var charts []renderedChart

	for i := range maxLLMCalls {
		// The last call is the budget-exhausted answer: the model is told the
		// budget is spent and, via tool_choice "none", can only answer in
		// text. The warning lands a few rounds earlier so the model can wind
		// the investigation down instead of being cut off mid-plan. Both
		// notices are persisted like everything else, keeping the stored
		// transcript identical to what the model saw.
		final := i == maxLLMCalls-1
		notice := ""
		switch {
		case final:
			notice = budgetExhaustedNotice
		case maxLLMCalls-1-i == lowBudgetWarningAt:
			notice = lowBudgetNotice
		}
		if notice != "" {
			msg := chatMessage{Role: "system", Content: notice}
			messages = append(messages, msg)
			newMessages = append(newMessages, storedMessage{msg: msg})
		}
		toolChoice := ""
		if final {
			toolChoice = "none"
		}

		llmCalls++
		resp, err := c.chat(ctx, c.ModelMedium, messages, tools, toolChoice)
		if err != nil {
			// Cap the failed turn with a neutral assistant note so a later
			// retry has a well-formed turn to answer against. The question is
			// already in newMessages, so it survives for the retry too.
			newMessages = append(newMessages, storedMessage{
				msg: chatMessage{Role: "assistant", Content: turnFailureMarker},
			})
			c.persistTurn(ctx, t.conv.ID, newMessages)
			trackAgentTokens(c.Deps, t.customerID, c.ModelMedium, turn)
			return "", nil, err
		}

		usage := resp.Usage
		turn.addCall(usage)

		assistant := resp.Choices[0].Message
		assistant.Role = "assistant"
		messages = append(messages, assistant)
		newMessages = append(newMessages, storedMessage{
			msg:   assistant,
			model: c.ModelMedium,
			usage: usage,
		})

		if len(assistant.ToolCalls) == 0 {
			answer = assistant.Content
			budgetExhaustedAnswer = final && answer != ""
			break
		}
		if final {
			// tool_choice "none" makes tool calls here unexpected, but a
			// provider may ignore it. Execute nothing, no later call would
			// read the results, and salvage any text sent alongside.
			answer = assistant.Content
			budgetExhaustedAnswer = answer != ""
			break
		}

		for _, tc := range assistant.ToolCalls {
			var result string
			if tc.Function.Name == renderChartToolName {
				// Chart rendering is turn state, not a data tool: the image
				// stays with the turn for delivery, the model only hears
				// whether it worked.
				chart, errText := renderChartCall(tc.Function.Arguments, len(charts))
				if errText != "" {
					result = errText
				} else {
					charts = append(charts, chart)
					result = fmt.Sprintf("Chart %q rendered. It is posted below this reply: mention it as the chart below, never as an image above, and don't repeat every value from it.", chart.title)
				}
			} else {
				result = c.dispatchTool(ctx, tc, t.teamID, apps)
			}
			toolMsg := chatMessage{
				Role:       "tool",
				Content:    result,
				ToolCallID: tc.ID,
			}
			messages = append(messages, toolMsg)
			newMessages = append(newMessages, storedMessage{msg: toolMsg})
		}
	}

	c.persistTurn(ctx, t.conv.ID, newMessages)
	trackAgentTokens(c.Deps, t.customerID, c.ModelMedium, turn)

	if answer == "" {
		return "", nil, errNoAnswer
	}
	return answer, charts, nil
}

// dispatchTool wraps runTool with a span and a log line per tool call.
func (c *Config) dispatchTool(ctx context.Context, tc chatToolCall, teamID uuid.UUID, apps []measureApp) string {
	start := time.Now()
	ctx, span := tracer.Start(ctx, "agent.tool "+tc.Function.Name)
	defer span.End()

	result := c.runTool(ctx, tc, teamID, apps)

	failed := strings.HasPrefix(result, "error:")
	if failed {
		span.SetStatus(codes.Error, result)
	}
	span.SetAttributes(attribute.Int("agent.tool.result_chars", len(result)))
	log.Printf("agent: tool %s duration=%s result_chars=%d failed=%v",
		tc.Function.Name, time.Since(start).Round(time.Millisecond), len(result), failed)
	return result
}

// runTool executes one tool call. Errors go back as tool output so the
// model can read them and fix its query.
func (c *Config) runTool(ctx context.Context, tc chatToolCall, teamID uuid.UUID, apps []measureApp) string {
	switch tc.Function.Name {
	case "get_schema":
		schema, err := c.getSchema(ctx)
		if err != nil {
			return "error: " + err.Error()
		}
		return schema
	case "run_sql":
		var args struct {
			Query  string   `json:"query"`
			AppIDs []string `json:"app_ids"`
			From   string   `json:"from"`
			To     string   `json:"to"`
		}
		if err := json.Unmarshal([]byte(tc.Function.Arguments), &args); err != nil {
			return "error: invalid tool arguments: " + err.Error()
		}
		if len(args.AppIDs) == 0 {
			return "error: app_ids is required; pass the ids of the apps to query, from the app list"
		}
		appIDs, err := parseAppIDs(args.AppIDs)
		if err != nil {
			return "error: " + err.Error()
		}
		// Only the team's apps may scope a query; anything else is another
		// team's id or a stale one.
		for _, id := range appIDs {
			if !slices.ContainsFunc(apps, func(a measureApp) bool { return a.id == id }) {
				return "error: app id " + id.String() + " is not in the app list"
			}
		}
		from, err := time.Parse(time.RFC3339, args.From)
		if err != nil {
			return "error: invalid from, want RFC3339: " + err.Error()
		}
		to, err := time.Parse(time.RFC3339, args.To)
		if err != nil {
			return "error: invalid to, want RFC3339: " + err.Error()
		}
		if !to.After(from) {
			return "error: from must be before to"
		}
		result, err := c.runSQL(ctx, args.Query, teamID, appIDs, from, to)
		if err != nil {
			return "error: " + err.Error()
		}
		return result
	default:
		if t, ok := c.commonToolIndex[tc.Function.Name]; ok {
			result, err := t.call(ctx, json.RawMessage(tc.Function.Arguments))
			if err != nil {
				return "error: " + err.Error()
			}
			return result
		}
		return "error: unknown tool " + tc.Function.Name
	}
}

// persistTurn saves the turn's messages on its own deadline, detached from
// the turn's context, so a timed-out turn still gets its transcript saved.
// If saving fails we log it and the user still gets their answer.
func (c *Config) persistTurn(ctx context.Context, conversationID uuid.UUID, messages []storedMessage) {
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 10*time.Second)
	defer cancel()

	if err := c.appendMessages(ctx, conversationID, messages); err != nil {
		log.Printf("agent: failed to persist conversation %s: %v", conversationID, err)
	}
}
