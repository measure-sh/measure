package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

// Small hand-written client for the OpenAI-compatible chat completions API.
// OpenRouter is the default; OPENROUTER_BASE_URL can point it at any
// compatible endpoint. Hand-written so we don't depend on a vendor SDK.

type chatToolCallFunction struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type chatToolCall struct {
	ID       string               `json:"id"`
	Type     string               `json:"type"`
	Function chatToolCallFunction `json:"function"`
}

type chatMessage struct {
	Role       string         `json:"role"`
	Content    string         `json:"content"`
	ToolCalls  []chatToolCall `json:"tool_calls,omitempty"`
	ToolCallID string         `json:"tool_call_id,omitempty"`
}

type chatToolFunction struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
}

type chatTool struct {
	Type     string           `json:"type"`
	Function chatToolFunction `json:"function"`
}

type chatRequest struct {
	Model    string        `json:"model"`
	Messages []chatMessage `json:"messages"`
	Tools    []chatTool    `json:"tools,omitempty"`
	// SessionID is OpenRouter's sticky-routing key: requests sharing it route to
	// the same provider, keeping that provider's prompt cache warm across a
	// conversation's turns. We pass the conversation id.
	SessionID string `json:"session_id,omitempty"`
}

type chatUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
	// PromptDetails breaks the prompt tokens down by source. The cache counts
	// come from OpenRouter's prompt_tokens_details: CachedTokens is the prompt
	// tokens served from a cache read (a cache hit), CacheWriteTokens the prompt
	// tokens written to the cache. Both are for observability, not used in
	// billing.
	PromptDetails struct {
		CachedTokens     int `json:"cached_tokens"`
		CacheWriteTokens int `json:"cache_write_tokens"`
	} `json:"prompt_tokens_details"`
	CompletionDetails struct {
		// ReasoningTokens is a subset of CompletionTokens (the model's thinking),
		// used for observability, not used in billing.
		ReasoningTokens int `json:"reasoning_tokens"`
	} `json:"completion_tokens_details"`
}

// tokenUsage aggregates token counts across one or more LLM calls. prompt and
// completion are billed; reasoning (a subset of completion) and the cache
// read/write counts are for observability only.
type tokenUsage struct {
	prompt     int
	completion int
	reasoning  int
	cacheRead  int
	cacheWrite int
}

// addCall folds one LLM call's reported usage into the running total.
func (u *tokenUsage) addCall(c chatUsage) {
	u.prompt += c.PromptTokens
	u.completion += c.CompletionTokens
	u.reasoning += c.CompletionDetails.ReasoningTokens
	u.cacheRead += c.PromptDetails.CachedTokens
	u.cacheWrite += c.PromptDetails.CacheWriteTokens
}

// add folds another aggregate (e.g. a compaction call) into this one.
func (u *tokenUsage) add(o tokenUsage) {
	u.prompt += o.prompt
	u.completion += o.completion
	u.reasoning += o.reasoning
	u.cacheRead += o.cacheRead
	u.cacheWrite += o.cacheWrite
}

// callUsage captures a single LLM call's usage as a tokenUsage.
func callUsage(c chatUsage) tokenUsage {
	var u tokenUsage
	u.addCall(c)
	return u
}

type chatChoice struct {
	Message      chatMessage `json:"message"`
	FinishReason string      `json:"finish_reason"`
}

type chatError struct {
	Message string `json:"message"`
}

type chatResponse struct {
	Choices []chatChoice `json:"choices"`
	Usage   chatUsage    `json:"usage"`
	Error   *chatError   `json:"error,omitempty"`
}

var chatHTTPClient = &http.Client{Timeout: 180 * time.Second}

// chat makes one chat-completions call with the given model.
func (c *Config) chat(ctx context.Context, model string, messages []chatMessage, tools []chatTool) (_ *chatResponse, err error) {
	start := time.Now()
	ctx, span := tracer.Start(ctx, "agent.llm_call")
	defer span.End()
	span.SetAttributes(attribute.String("agent.model", model))
	defer func() {
		if err != nil {
			span.SetStatus(codes.Error, err.Error())
		}
	}()

	if c.APIKey == "" {
		return nil, fmt.Errorf("agent is not configured: OPENROUTER_API_KEY is not set")
	}
	if model == "" {
		return nil, fmt.Errorf("agent is not configured: the OPENROUTER_MODEL_* env var for this task is not set")
	}

	conversationID, _ := conversationIDFromContext(ctx)
	body, err := json.Marshal(chatRequest{
		Model:     model,
		Messages:  messages,
		Tools:     tools,
		SessionID: conversationID,
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := chatHTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("llm request failed: %w", err)
	}
	defer resp.Body.Close()
	span.SetAttributes(attribute.Int("http.status_code", resp.StatusCode))

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return nil, fmt.Errorf("llm response read failed: %w", err)
	}

	// The rate-limit check precedes decoding: the sentinel must fire even
	// when the 429 body isn't the JSON shape the provider usually sends.
	if resp.StatusCode == http.StatusTooManyRequests {
		msg := "rate limited"
		var parsed chatResponse
		if err := json.Unmarshal(raw, &parsed); err == nil && parsed.Error != nil {
			msg = parsed.Error.Message
		}
		return nil, fmt.Errorf("%w (status 429): %s", errLLMRateLimited, msg)
	}

	var parsed chatResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("llm response decode failed (status %d): %w", resp.StatusCode, err)
	}
	if parsed.Error != nil {
		return nil, fmt.Errorf("llm error (status %d): %s", resp.StatusCode, parsed.Error.Message)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("llm error: status %d", resp.StatusCode)
	}
	if len(parsed.Choices) == 0 {
		return nil, fmt.Errorf("llm returned no choices")
	}

	// reasoning and cache counts are logged only when present, so a call
	// without them stays terse.
	extra := ""
	if r := parsed.Usage.CompletionDetails.ReasoningTokens; r > 0 {
		extra += fmt.Sprintf(" reasoning_tokens=%d", r)
	}
	if cr := parsed.Usage.PromptDetails.CachedTokens; cr > 0 {
		extra += fmt.Sprintf(" cache_read_tokens=%d", cr)
	}
	if cw := parsed.Usage.PromptDetails.CacheWriteTokens; cw > 0 {
		extra += fmt.Sprintf(" cache_write_tokens=%d", cw)
	}
	span.SetAttributes(
		attribute.Int("agent.prompt_tokens", parsed.Usage.PromptTokens),
		attribute.Int("agent.completion_tokens", parsed.Usage.CompletionTokens),
		attribute.Int("agent.reasoning_tokens", parsed.Usage.CompletionDetails.ReasoningTokens),
		attribute.Int("agent.cache_read_tokens", parsed.Usage.PromptDetails.CachedTokens),
		attribute.Int("agent.cache_write_tokens", parsed.Usage.PromptDetails.CacheWriteTokens),
	)
	log.Printf("agent: llm call model=%s prompt_tokens=%d completion_tokens=%d%s tool_calls=%d duration=%s",
		model, parsed.Usage.PromptTokens, parsed.Usage.CompletionTokens, extra,
		len(parsed.Choices[0].Message.ToolCalls), time.Since(start).Round(time.Millisecond))

	return &parsed, nil
}
