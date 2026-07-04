package agent

import (
	"context"
	"fmt"
	"log"
	"slices"
	"strings"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel/codes"
)

// Long conversations are kept affordable in two steps, applied to the loaded
// history before each turn. First, tool results from turns before the last
// one are elided from the prompt, since the assistant's answer after each one
// already states what the data showed. Second, if the context has still grown
// past compactionThresholdTokens, everything before the last turn is
// summarized into one stored summary message, and loadMessages skips the
// summarized rows from then on. Stored history is never deleted.

// compactionThresholdTokens triggers compaction: when the previous turn's
// context grew past this many tokens, older turns are summarized before this
// turn runs.
const compactionThresholdTokens = 32000

const elidedToolResult = "(tool result elided)"

const compactionPrompt = `Summarize the conversation so far between a user and Measure's telemetry query agent. Keep every concrete fact: app ids, numbers, time ranges, table and column names, and each answer's conclusion. Note open questions. Write a compact briefing the agent can rely on in later turns; no commentary.`

// lastUserIndex returns the index of the newest user message, or -1 if there
// is none.
func lastUserIndex(history []loadedMessage) int {
	for i, m := range slices.Backward(history) {
		if m.msg.Role == "user" {
			return i
		}
	}
	return -1
}

// elideOldToolResults stubs out tool results from turns before the last one.
// Only the prompt is affected; the stored rows keep the full content.
func elideOldToolResults(history []loadedMessage) {
	// range over a negative count runs zero times, so last == -1 is safe.
	last := lastUserIndex(history)
	for i := range last {
		if history[i].msg.Role == "tool" {
			history[i].msg.Content = elidedToolResult
		}
	}
}

// contextTokens reports the conversation's size as of its newest assistant
// message: the prompt plus completion tokens of the call that produced it.
func contextTokens(history []loadedMessage) int {
	for _, m := range slices.Backward(history) {
		if m.msg.Role == "assistant" {
			return m.promptTokens + m.completionTokens
		}
	}
	return 0
}

// renderTranscript flattens messages into plain text for the summarizer.
// Tool results are skipped, since the assistant's answers already state what they
// showed, as are tool-call-only assistant messages with no text.
func renderTranscript(history []loadedMessage) string {
	var b strings.Builder
	for _, m := range history {
		if m.msg.Role == "tool" || m.msg.Content == "" {
			continue
		}
		fmt.Fprintf(&b, "%s: %s\n\n", m.msg.Role, m.msg.Content)
	}
	return b.String()
}

// compactIfNeeded folds everything before the last turn into one stored
// summary message once the conversation outgrows the threshold. Best-effort:
// on any failure the turn proceeds with the unshortened history. Returns the
// history to use and the summarization call's token usage.
func (c *Config) compactIfNeeded(ctx context.Context, conversationID uuid.UUID, history []loadedMessage) ([]loadedMessage, tokenUsage) {
	size := contextTokens(history)
	if size < compactionThresholdTokens {
		return history, tokenUsage{}
	}
	last := lastUserIndex(history)
	if last <= 0 {
		return history, tokenUsage{}
	}
	head, tail := history[:last], history[last:]

	// Nothing new to fold: the head is just a previous summary.
	hasContent := false
	for _, m := range head {
		if !m.summary {
			hasContent = true
			break
		}
	}
	if !hasContent {
		return history, tokenUsage{}
	}

	ctx, span := tracer.Start(ctx, "agent.compaction")
	defer span.End()
	log.Printf("agent: compacting conversation %s context_tokens=%d head_messages=%d",
		conversationID, size, len(head))

	resp, err := c.chat(ctx, c.ModelSmall, []chatMessage{
		{Role: "system", Content: compactionPrompt},
		{Role: "user", Content: renderTranscript(head)},
	}, nil, "")
	if err != nil {
		span.SetStatus(codes.Error, err.Error())
		log.Printf("agent: compaction failed for conversation %s: %v", conversationID, err)
		return history, tokenUsage{}
	}
	summary := loadedMessage{
		msg: chatMessage{
			Role:    "system",
			Content: "Summary of the conversation so far: " + strings.TrimSpace(resp.Choices[0].Message.Content),
		},
		summary: true,
	}

	through := head[0].id
	for _, m := range head {
		if m.id > through {
			through = m.id
		}
	}
	var usage tokenUsage
	usage.addCall(resp.Usage)
	if err := c.insertSummary(ctx, conversationID, summary.msg, through, c.ModelSmall, resp.Usage); err != nil {
		span.SetStatus(codes.Error, err.Error())
		log.Printf("agent: failed to persist summary for conversation %s: %v", conversationID, err)
		return history, usage
	}

	log.Printf("agent: compacted conversation %s through=%d summary_tokens=%d",
		conversationID, through, resp.Usage.CompletionTokens)
	return append([]loadedMessage{summary}, tail...), usage
}
