// Package slack holds the pieces both sides of the Slack integration share:
// a minimal Slack Web API client covering the calls the query agent needs,
// and the bus contract between the api service (producer) and the agent
// service (consumer) for Slack-originated questions.
package slack

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

const apiBaseURL = "https://slack.com/api/"

var tracer = otel.Tracer("slack-client")

var httpClient = &http.Client{Timeout: 30 * time.Second}

// apiEnvelope is the part of every Slack Web API response that reports
// success or failure.
type apiEnvelope struct {
	OK    bool   `json:"ok"`
	Error string `json:"error"`
}

// postJSON invokes a Slack Web API method with a JSON body and a bot token,
// decoding the response into out when out is non-nil.
func postJSON(ctx context.Context, token, method string, payload, out any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("slack %s: failed to marshal payload: %w", method, err)
	}
	return do(ctx, token, method, func() (*http.Request, error) {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiBaseURL+method, bytes.NewReader(body))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json; charset=utf-8")
		return req, nil
	}, out)
}

// getJSON invokes a Slack Web API method with query parameters and a bot
// token, decoding the response into out when out is non-nil.
func getJSON(ctx context.Context, token, method string, query url.Values, out any) error {
	return do(ctx, token, method, func() (*http.Request, error) {
		return http.NewRequestWithContext(ctx, http.MethodGet, apiBaseURL+method+"?"+query.Encode(), nil)
	}, out)
}

// do sends one Slack Web API call and decodes the ok/error envelope. Slack
// rate-limits per method and channel; a rate-limited call is retried once
// after the wait the response names. newReq builds a fresh request per
// attempt, since a sent request's body cannot be replayed. Each call is one
// span named for the method, so Slack API latency shows up in traces
// alongside a terse duration log for when a trace view isn't at hand.
func do(ctx context.Context, token, method string, newReq func() (*http.Request, error), out any) (err error) {
	ctx, span := tracer.Start(ctx, "slack."+method)
	defer span.End()
	span.SetAttributes(attribute.String("slack.method", method))
	start := time.Now()
	attempts := 0
	defer func() {
		span.SetAttributes(attribute.Int("slack.attempts", attempts))
		if err != nil {
			span.SetStatus(codes.Error, err.Error())
		}
		log.Printf("slack %s: duration=%s attempts=%d", method,
			time.Since(start).Round(time.Millisecond), attempts)
	}()

	const maxAttempts = 2
	for attempt := 1; ; attempt++ {
		attempts = attempt
		req, err := newReq()
		if err != nil {
			return fmt.Errorf("slack %s: %w", method, err)
		}
		req.Header.Set("Authorization", "Bearer "+token)

		resp, err := httpClient.Do(req)
		if err != nil {
			return fmt.Errorf("slack %s: %w", method, err)
		}
		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return fmt.Errorf("slack %s: failed to read response: %w", method, err)
		}
		span.SetAttributes(attribute.Int("http.status_code", resp.StatusCode))

		if resp.StatusCode == http.StatusTooManyRequests && attempt < maxAttempts {
			wait := retryAfterDelay(resp.Header.Get("Retry-After"))
			log.Printf("slack %s: rate limited, retrying in %s", method, wait)
			select {
			case <-ctx.Done():
				// Out of time; report the rate limit below.
			case <-time.After(wait):
				continue
			}
		}
		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("slack %s: status %d: %s", method, resp.StatusCode, body)
		}

		var envelope apiEnvelope
		if err := json.Unmarshal(body, &envelope); err != nil {
			return fmt.Errorf("slack %s: failed to decode response: %w", method, err)
		}
		if !envelope.OK {
			return fmt.Errorf("slack %s: %s", method, envelope.Error)
		}
		if out != nil {
			if err := json.Unmarshal(body, out); err != nil {
				return fmt.Errorf("slack %s: failed to decode response: %w", method, err)
			}
		}
		return nil
	}
}

// retryAfterDelay reads the number of seconds a rate-limited response's
// Retry-After header names, clamped to [1s, 30s].
func retryAfterDelay(header string) time.Duration {
	seconds, err := strconv.Atoi(header)
	if err != nil || seconds < 1 {
		seconds = 1
	}
	if seconds > 30 {
		seconds = 30
	}
	return time.Duration(seconds) * time.Second
}

// ----------------------------------------------------------------------------
// Exported function variables. Replace in tests to stub out Slack API calls.
// ----------------------------------------------------------------------------

var (
	PostMessage                  = postMessage
	UpdateMessage                = updateMessage
	DeleteMessage                = deleteMessage
	UserEmail                    = userEmail
	ConversationReplies          = conversationReplies
	ConversationHistory          = conversationHistory
	ThreadMessageExists          = threadMessageExists
	SetAssistantStatus           = setAssistantStatus
	SetAssistantTitle            = setAssistantTitle
	SetAssistantSuggestedPrompts = setAssistantSuggestedPrompts
	UploadFile                   = uploadFile
)

// PostMessage posts text to a channel, inside a thread when threadTS is
// non-empty, and returns the new message's timestamp.
func postMessage(ctx context.Context, token, channel, threadTS, text string) (string, error) {
	payload := map[string]any{
		"channel": channel,
		"text":    text,
	}
	if threadTS != "" {
		payload["thread_ts"] = threadTS
	}
	var resp struct {
		TS string `json:"ts"`
	}
	if err := postJSON(ctx, token, "chat.postMessage", payload, &resp); err != nil {
		return "", err
	}
	return resp.TS, nil
}

// UpdateMessage replaces the text of a previously posted message.
func updateMessage(ctx context.Context, token, channel, ts, text string) error {
	payload := map[string]any{
		"channel": channel,
		"ts":      ts,
		"text":    text,
	}
	return postJSON(ctx, token, "chat.update", payload, nil)
}

// DeleteMessage removes a previously posted message.
func deleteMessage(ctx context.Context, token, channel, ts string) error {
	payload := map[string]any{
		"channel": channel,
		"ts":      ts,
	}
	return postJSON(ctx, token, "chat.delete", payload, nil)
}

// UserEmail returns the email on a Slack user's profile. Workspaces can hide
// emails, in which case the email comes back empty with a nil error.
func userEmail(ctx context.Context, token, slackUserID string) (string, error) {
	query := url.Values{}
	query.Set("user", slackUserID)
	var resp struct {
		User struct {
			Profile struct {
				Email string `json:"email"`
			} `json:"profile"`
		} `json:"user"`
	}
	if err := getJSON(ctx, token, "users.info", query, &resp); err != nil {
		return "", err
	}
	return resp.User.Profile.Email, nil
}

// Message is one message from a channel or thread, with the fields the agent
// needs to build conversation context: who sent it, when, and the text. BotID
// is set when a bot or app posted it; for the agent's own posts User is the
// bot's own user id.
type Message struct {
	Type    string `json:"type"`
	Subtype string `json:"subtype"`
	User    string `json:"user"`
	BotID   string `json:"bot_id"`
	Text    string `json:"text"`
	TS      string `json:"ts"`
}

// repliesMaxPages bounds the thread pagination loop, so a response that never
// reports the end cannot spin forever.
const repliesMaxPages = 50

// ConversationReplies returns up to the most recent limit messages of a thread,
// in chronological order. When oldest is non-empty Slack considers only
// messages at or after that timestamp. Slack returns thread replies oldest
// first and splits long threads across pages, so this follows the cursor to the
// end while keeping a sliding tail of limit messages: the newest ones, at
// bounded memory, whatever the thread's length.
func conversationReplies(ctx context.Context, token, channel, threadTS, oldest string, limit int) ([]Message, error) {
	var (
		tail   []Message
		cursor string
	)
	for range repliesMaxPages {
		query := url.Values{}
		query.Set("channel", channel)
		query.Set("ts", threadTS)
		query.Set("limit", strconv.Itoa(limit))
		if oldest != "" {
			query.Set("oldest", oldest)
		}
		if cursor != "" {
			query.Set("cursor", cursor)
		}
		var resp struct {
			Messages         []Message `json:"messages"`
			HasMore          bool      `json:"has_more"`
			ResponseMetadata struct {
				NextCursor string `json:"next_cursor"`
			} `json:"response_metadata"`
		}
		if err := getJSON(ctx, token, "conversations.replies", query, &resp); err != nil {
			return nil, err
		}
		tail = append(tail, resp.Messages...)
		if len(tail) > limit {
			tail = tail[len(tail)-limit:]
		}
		cursor = resp.ResponseMetadata.NextCursor
		if !resp.HasMore || cursor == "" {
			break
		}
	}
	return tail, nil
}

// ThreadMessageExists reports whether the message with timestamp messageTS,
// in the thread whose root message has timestamp threadRootTS, still exists.
// For a message outside any thread the two timestamps are the same. Callers
// use it to detect a question that was deleted while its answer was being
// prepared; only the message is checked, so a thread whose root was
// deleted still reports true for a surviving reply in it. Slack replaces a
// deleted root that has replies with a tombstone message, which counts as
// deleted here. The error is non-nil only when the check itself failed, in
// which case the boolean is meaningless.
func threadMessageExists(ctx context.Context, token, channel, threadRootTS, messageTS string) (bool, error) {
	query := url.Values{}
	query.Set("channel", channel)
	query.Set("ts", threadRootTS)
	query.Set("oldest", messageTS)
	query.Set("inclusive", "true")
	// Replies are returned oldest first, so a live message is the first one
	// at or after its own timestamp, except that Slack can include the
	// thread's root in front of it even when the oldest filter excludes the
	// root. A limit of 2 covers both positions; the root's inclusion is
	// observed rather than documented behavior, and a limit that is too
	// small reports a live message as deleted, so one extra slot guards a
	// miscount there.
	query.Set("limit", "3")
	var resp struct {
		Messages []Message `json:"messages"`
	}
	if err := getJSON(ctx, token, "conversations.replies", query, &resp); err != nil {
		if strings.Contains(err.Error(), "thread_not_found") {
			return false, nil
		}
		return false, err
	}
	// Matched by timestamp rather than by position, so it does not matter
	// whether the root was included.
	for _, m := range resp.Messages {
		if m.TS == messageTS {
			return m.Subtype != "tombstone", nil
		}
	}
	return false, nil
}

// ConversationHistory returns a channel's most recent messages. Slack returns
// them newest first; limit caps how many come back.
func conversationHistory(ctx context.Context, token, channel string, limit int) ([]Message, error) {
	query := url.Values{}
	query.Set("channel", channel)
	query.Set("limit", strconv.Itoa(limit))
	var resp struct {
		Messages []Message `json:"messages"`
	}
	if err := getJSON(ctx, token, "conversations.history", query, &resp); err != nil {
		return nil, err
	}
	return resp.Messages, nil
}

// UploadFile shares a file into a channel, inside a thread when threadTS is
// non-empty, via Slack's external upload flow: reserve an upload URL, send
// the bytes, then complete the upload against the channel. Needs the
// files:write scope.
func uploadFile(ctx context.Context, token, channel, threadTS, filename, title string, content []byte) error {
	query := url.Values{}
	query.Set("filename", filename)
	query.Set("length", strconv.Itoa(len(content)))
	var reserve struct {
		UploadURL string `json:"upload_url"`
		FileID    string `json:"file_id"`
	}
	if err := getJSON(ctx, token, "files.getUploadURLExternal", query, &reserve); err != nil {
		return err
	}

	// The reserved URL is pre-authorized, so this POST carries no token; the
	// bytes go up as the raw request body.
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reserve.UploadURL, bytes.NewReader(content))
	if err != nil {
		return fmt.Errorf("slack file upload: %w", err)
	}
	req.Header.Set("Content-Type", "application/octet-stream")
	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("slack file upload: %w", err)
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("slack file upload: status %d: %s", resp.StatusCode, body)
	}

	payload := map[string]any{
		"files":      []map[string]string{{"id": reserve.FileID, "title": title}},
		"channel_id": channel,
	}
	if threadTS != "" {
		payload["thread_ts"] = threadTS
	}
	return postJSON(ctx, token, "files.completeUploadExternal", payload, nil)
}

// SetAssistantStatus shows a transient status line (e.g. "is thinking...")
// in an AI assistant thread. Slack clears it when the app posts a message.
func setAssistantStatus(ctx context.Context, token, channelID, threadTS, status string) error {
	payload := map[string]any{
		"channel_id": channelID,
		"thread_ts":  threadTS,
		"status":     status,
	}
	return postJSON(ctx, token, "assistant.threads.setStatus", payload, nil)
}

// SetAssistantTitle names an AI assistant thread in the user's thread list.
func setAssistantTitle(ctx context.Context, token, channelID, threadTS, title string) error {
	payload := map[string]any{
		"channel_id": channelID,
		"thread_ts":  threadTS,
		"title":      title,
	}
	return postJSON(ctx, token, "assistant.threads.setTitle", payload, nil)
}

// SuggestedPrompt is one tappable prompt shown when an AI assistant thread
// opens. Title is what the user sees; Message is sent when tapped.
type SuggestedPrompt struct {
	Title   string `json:"title"`
	Message string `json:"message"`
}

// SetAssistantSuggestedPrompts offers tappable starter prompts at the top of the
// agent's DM (the Messages tab).
func setAssistantSuggestedPrompts(ctx context.Context, token, channelID string, prompts []SuggestedPrompt) error {
	payload := map[string]any{
		"channel_id": channelID,
		"prompts":    prompts,
	}
	return postJSON(ctx, token, "assistant.threads.setSuggestedPrompts", payload, nil)
}
