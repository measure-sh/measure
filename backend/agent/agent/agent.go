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
	baseURL := os.Getenv("OPENROUTER_BASE_URL")
	if baseURL == "" {
		baseURL = "https://openrouter.ai/api/v1"
	}
	baseURL = strings.TrimSuffix(baseURL, "/")

	apiKey, err := secret.FromEnvOrFile("OPENROUTER_API_KEY")
	if err != nil {
		log.Printf("failed to read OPENROUTER_API_KEY: %v", err)
	}
	if apiKey == "" {
		log.Println("OPENROUTER_API_KEY env var not set, the ask_question tool will return errors")
	}

	modelSmall := os.Getenv("OPENROUTER_MODEL_SMALL")
	if modelSmall == "" {
		log.Println("OPENROUTER_MODEL_SMALL env var not set, conversation compaction will return errors")
	}

	modelMedium := os.Getenv("OPENROUTER_MODEL_MEDIUM")
	if modelMedium == "" {
		log.Println("OPENROUTER_MODEL_MEDIUM env var not set, the ask_question tool will return errors")
	}

	cfg := &Config{
		BaseURL:     baseURL,
		APIKey:      apiKey,
		ModelSmall:  modelSmall,
		ModelMedium: modelMedium,
		ModelLarge:  os.Getenv("OPENROUTER_MODEL_LARGE"),
	}

	cfg.modelTools = slices.Clone(builtinTools)
	cfg.commonToolIndex = map[string]Tool{}
	for _, t := range commonTools(cfg) {
		cfg.commonToolIndex[t.def.Name] = t
		cfg.modelTools = append(cfg.modelTools, chatTool{
			Type: "function",
			Function: chatToolFunction{
				Name:        t.def.Name,
				Description: t.def.Description,
				Parameters:  t.params,
			},
		})
	}

	return cfg
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

type askQuestionInput struct {
	AppID          string `json:"app_id" jsonschema:"UUID of the app to query"`
	Question       string `json:"question" jsonschema:"Natural-language question about the app's telemetry"`
	ConversationID string `json:"conversation_id,omitempty" jsonschema:"Conversation id from a previous answer; pass it to continue that conversation"`
}

type askQuestionOutput struct {
	Answer         string `json:"answer"`
	ConversationID string `json:"conversation_id"`
}

const systemPrompt = `You are Measure's query agent. You answer questions about a mobile app's telemetry (events, exceptions, ANRs, sessions, spans, network requests).

Rules:
- Prefer the purpose-built tools (get_metrics, get_errors, get_sessions and so on); they answer the common questions quickly and consistently.
- When no tool covers the question, query ClickHouse yourself: call get_schema to see the raw tables, then run_sql with a single SELECT statement and a from/to time range. Reference tables only via {{table}} placeholders, e.g. select count(*) from {{events}}. Every placeholder is automatically scoped to the team, app and time range in question.
- Pick the time range the question implies. If the user gives none, use the last 6 hours (the dashboard's default) and say so in the answer; for all-time questions pass a range wide enough to cover the app's history.
- SQL results are capped, so aggregate in SQL instead of fetching raw rows.
- A crash is an exception event with severity = 'fatal'. Older rows predate the severity field; for those, handled = false marks a crash, so include them when you count. Keep that legacy fallback to yourself: it is a data-backfill detail, not something to explain in an answer.
- ANRs are their own event type and exist only on Android; an app that does not run on Android has none, so never count or mention ANRs for it.
- Bug report status lives outside the raw tables; use the bug report tools for it.
- Tools cover all app versions unless you pass versions or version_codes. When a question is about a specific release, resolve its exact version with get_filters and filter explicitly; never conclude there is little or no data while a version filter narrows the query.
- Timestamps are UTC.
- If a query fails, read the error and fix the query.
- Answer concisely: lead with the concrete numbers, then a line or two on what was measured (data, filters, time range). If the data can't answer the question, say so plainly.
- Describe how you computed things in product terms only. Severity (for example "fatal" crashes) is fine to mention. Never mention internals: no table or column names, no SQL, no tool names, no raw ids, and never bring up the legacy handled-flag fallback. Refer to the app by its name, or as "this app".`

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
			Description: "Run a single read-only ClickHouse SELECT bounded to a time range. Reference tables only via {{table}} placeholders.",
			Parameters:  json.RawMessage(`{"type":"object","properties":{"query":{"type":"string","description":"ClickHouse SELECT statement using {{table}} placeholders"},"from":{"type":"string","description":"Start of time range (RFC3339)"},"to":{"type":"string","description":"End of time range (RFC3339)"}},"required":["query","from","to"]}`),
		},
	},
}

// appOSNames returns the operating systems an app reports telemetry for. It
// tells the model which platform the app is, so platform-specific concepts are
// applied correctly, notably that ANRs exist only on Android.
func (c *Config) appOSNames(ctx context.Context, appID uuid.UUID) ([]string, error) {
	stmt := sqlf.PostgreSQL.
		Select("os_names").
		From("apps").
		Where("id = ?", appID)
	defer stmt.Close()

	var osNames []string
	if err := c.Deps.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&osNames); err != nil {
		return nil, err
	}
	return osNames, nil
}

// platformNote is the line appended to the system message naming the app's
// operating systems, and, for a non-Android app, stating it has no ANRs. It is
// empty when the app has reported no telemetry yet, so we make no claim about a
// platform we can't see.
func platformNote(osNames []string) string {
	if len(osNames) == 0 {
		return ""
	}
	note := fmt.Sprintf("\nThis app runs on %s.", strings.Join(osNames, ", "))
	if opsys.ToFamily(osNames[0]) != opsys.Android {
		note += " ANRs are an Android-only concept, so this app has none; do not count or mention ANRs for it."
	}
	return note
}

// askQuestion answers one MCP question: authenticate, check access and
// billing, resolve the conversation, then run the turn.
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
	appID, err := uuid.Parse(in.AppID)
	if err != nil {
		return out, fmt.Errorf("invalid app_id")
	}

	teamID, customerID, err := c.resolveAppAccess(ctx, userID, appID)
	if err != nil {
		return out, err
	}
	// Stamp the ids now so spans of pre-turn rejections (billing, missing
	// conversation) still say who they were about.
	span.SetAttributes(
		attribute.String("agent.app_id", appID.String()),
		attribute.String("agent.team_id", teamID.String()),
	)

	if err := c.checkAgentAllowed(ctx, customerID); err != nil {
		return out, errors.New(agentNotAllowedReply(c.dashboardLink(teamID, "usage")))
	}

	var conv *conversation
	if in.ConversationID != "" {
		cid, err := uuid.Parse(in.ConversationID)
		if err != nil {
			return out, fmt.Errorf("invalid conversation_id")
		}
		conv, err = c.getConversation(ctx, cid)
		if err != nil || conv.UserID != userID || conv.AppID != appID {
			return out, fmt.Errorf("conversation not found")
		}
	} else {
		conv = &conversation{UserID: userID, AppID: appID, TeamID: teamID, Surface: "mcp"}
		if err := c.createConversation(ctx, conv, conversationTitle(question)); err != nil {
			return out, err
		}
	}

	turnRan = true
	// MCP turns are not offered the chart tool, so no charts come back.
	answer, _, err := c.runTurn(ctx, turn{
		userID:     userID,
		appID:      appID,
		teamID:     teamID,
		customerID: customerID,
		conv:       conv,
		continued:  in.ConversationID != "",
		question:   question,
		entryPoint: "mcp",
	})
	if err != nil {
		if errors.Is(err, errNoAnswer) {
			return out, errors.New(budgetExhaustedReply)
		}
		return out, err
	}

	out.Answer = answer
	out.ConversationID = conv.ID.String()
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

// turn is one resolved question: who is asking, about which app, in which
// conversation, from which surface. Callers establish identity, access and
// billing before building one.
type turn struct {
	userID     uuid.UUID
	appID      uuid.UUID
	teamID     uuid.UUID
	customerID string
	conv       *conversation
	continued  bool
	question   string
	entryPoint string
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
		attribute.String("agent.app_id", t.appID.String()),
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
			appID:                 t.appID.String(),
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
	// The system message holds the app_id and the app's platform; the current time
	// changes every turn, so it rides on the user message below rather than here,
	// keeping this prefix cacheable turn to turn. os_names is re-read every turn on
	// purpose: a conversation can begin before an app has any telemetry (platform
	// unknown) and continue once data arrives, and the next turn must pick that up.
	// The one empty-to-known flip changes the prefix and costs a single cache miss
	// that re-establishes it; from then on it is stable again.
	platform := ""
	if osNames, err := c.appOSNames(ctx, t.appID); err != nil {
		// Best-effort: without the platform the turn still runs, it just can't
		// tell the model which platform-specific concepts apply.
		log.Printf("agent: failed to fetch os_names for app %s: %v", t.appID, err)
	} else {
		platform = platformNote(osNames)
	}
	sysMsg := fmt.Sprintf("%s\n%s\n\nThe question is about the app with app_id %s; pass it to tools that take an app_id.%s",
		systemPrompt, budgetRule, t.appID, platform)
	messages = append(messages, chatMessage{Role: "system", Content: sysMsg})
	for _, m := range history {
		messages = append(messages, m.msg)
	}

	// The common tools need absolute time ranges, so the model is told the
	// current time on the user turn. It is stored exactly as sent, so once this
	// turn becomes history the cached prefix still matches on the next turn.
	userMsg := chatMessage{Role: "user", Content: fmt.Sprintf("%s\n\ncurrent UTC time: %s", t.question, time.Now().UTC().Format(time.RFC3339))}
	messages = append(messages, userMsg)
	newMessages := []storedMessage{{msg: userMsg}}

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
				result = c.dispatchTool(ctx, tc, t.teamID, t.appID)
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
func (c *Config) dispatchTool(ctx context.Context, tc chatToolCall, teamID, appID uuid.UUID) string {
	start := time.Now()
	ctx, span := tracer.Start(ctx, "agent.tool "+tc.Function.Name)
	defer span.End()

	result := c.runTool(ctx, tc, teamID, appID)

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
func (c *Config) runTool(ctx context.Context, tc chatToolCall, teamID, appID uuid.UUID) string {
	switch tc.Function.Name {
	case "get_schema":
		schema, err := c.getSchema(ctx)
		if err != nil {
			return "error: " + err.Error()
		}
		return schema
	case "run_sql":
		var args struct {
			Query string `json:"query"`
			From  string `json:"from"`
			To    string `json:"to"`
		}
		if err := json.Unmarshal([]byte(tc.Function.Arguments), &args); err != nil {
			return "error: invalid tool arguments: " + err.Error()
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
		result, err := c.runSQL(ctx, args.Query, teamID, appID, from, to)
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
