package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

// conversation is one question thread. It belongs to one user and one team;
// which of the team's apps a question is about is decided per turn by the
// model.
type conversation struct {
	ID      uuid.UUID
	UserID  uuid.UUID
	TeamID  uuid.UUID
	Surface string
	// Slack thread coordinates, set on Slack surfaces only.
	SlackChannelID string
	SlackThreadTS  string
	SlackUserID    string
	// SlackContextThroughTS is the timestamp of the most recent Slack message
	// already summarized into this conversation; the next mention summarizes
	// only messages after it. Empty until the first mention is summarized.
	SlackContextThroughTS string
}

// storedMessage is a chat message to persist. Assistant messages also carry
// the model and the token usage of the call that produced them.
type storedMessage struct {
	msg   chatMessage
	model string
	usage chatUsage
}

// loadedMessage is a stored message read back for a turn. summary marks
// compaction summary rows.
type loadedMessage struct {
	id               int64
	msg              chatMessage
	promptTokens     int
	completionTokens int
	summary          bool
}

// createConversation persists conv, assigning it a fresh id.
func (c *Config) createConversation(ctx context.Context, conv *conversation, title string) error {
	deps := c.Deps
	conv.ID = uuid.New()

	stmt := sqlf.PostgreSQL.
		InsertInto("agent_conversations").
		Set("id", conv.ID).
		Set("user_id", conv.UserID).
		Set("team_id", conv.TeamID).
		Set("title", title).
		Set("surface", conv.Surface)
	if conv.SlackChannelID != "" {
		stmt.
			Set("slack_channel_id", conv.SlackChannelID).
			Set("slack_thread_ts", conv.SlackThreadTS).
			Set("slack_user_id", conv.SlackUserID)
	}
	defer stmt.Close()

	if _, err := deps.PgPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
		return fmt.Errorf("failed to create conversation: %w", err)
	}
	return nil
}

const conversationColumns = "id, user_id, team_id, surface, coalesce(slack_channel_id, ''), coalesce(slack_thread_ts, ''), coalesce(slack_user_id, ''), coalesce(slack_context_through_ts, '')"

func scanConversation(row pgx.Row) (*conversation, error) {
	conv := &conversation{}
	err := row.Scan(&conv.ID, &conv.UserID, &conv.TeamID,
		&conv.Surface, &conv.SlackChannelID, &conv.SlackThreadTS, &conv.SlackUserID,
		&conv.SlackContextThroughTS)
	if err != nil {
		return nil, err
	}
	return conv, nil
}

// findSlackConversation returns the conversation rooted at a Slack thread,
// or nil when the thread has none yet.
func (c *Config) findSlackConversation(ctx context.Context, channelID, threadTS string) (*conversation, error) {
	deps := c.Deps
	stmt := sqlf.PostgreSQL.
		Select(conversationColumns).
		From("agent_conversations").
		Where("slack_channel_id = ?", channelID).
		Where("slack_thread_ts = ?", threadTS)
	defer stmt.Close()

	conv, err := scanConversation(deps.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return conv, err
}

// setSlackContextThrough advances the high-water mark for thread context to
// ts: the timestamp of the most recent Slack message summarized into this
// conversation, so a later mention only summarizes messages after it.
func (c *Config) setSlackContextThrough(ctx context.Context, conversationID uuid.UUID, ts string) error {
	deps := c.Deps
	stmt := sqlf.PostgreSQL.
		Update("agent_conversations").
		Set("slack_context_through_ts", ts).
		Where("id = ?", conversationID)
	defer stmt.Close()

	if _, err := deps.PgPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
		return fmt.Errorf("failed to update slack context marker: %w", err)
	}
	return nil
}

// loadMessages returns the messages a turn should see, oldest first: the
// newest summary row (if any) followed by everything after the messages it
// covers. Compacted messages stay stored; they are just not loaded.
func (c *Config) loadMessages(ctx context.Context, conversationID uuid.UUID) ([]loadedMessage, error) {
	deps := c.Deps
	stmt := sqlf.PostgreSQL.
		Select("id, content, coalesce(prompt_tokens, 0), coalesce(completion_tokens, 0), compacted_through is not null").
		From("agent_messages").
		Where("conversation_id = ?", conversationID).
		Where(`id > coalesce((
			select compacted_through from agent_messages
			where conversation_id = ? and compacted_through is not null
			order by id desc limit 1), 0)`, conversationID).
		OrderBy("id")
	defer stmt.Close()

	rows, err := deps.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// The summary row is written after the messages it kept, so id order puts
	// it last; the prompt needs it first.
	var summaries, messages []loadedMessage
	for rows.Next() {
		var lm loadedMessage
		var content []byte
		if err := rows.Scan(&lm.id, &content, &lm.promptTokens, &lm.completionTokens, &lm.summary); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(content, &lm.msg); err != nil {
			return nil, fmt.Errorf("failed to decode stored message: %w", err)
		}
		if lm.summary {
			summaries = append(summaries, lm)
		} else {
			messages = append(messages, lm)
		}
	}
	return append(summaries, messages...), rows.Err()
}

// insertSummary persists a compaction summary row. compactedThrough is the id
// of the newest message the summary covers.
func (c *Config) insertSummary(ctx context.Context, conversationID uuid.UUID, msg chatMessage, compactedThrough int64, model string, usage chatUsage) error {
	deps := c.Deps
	content, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	stmt := sqlf.PostgreSQL.
		InsertInto("agent_messages").
		Set("conversation_id", conversationID).
		Set("role", msg.Role).
		Set("content", string(content)).
		Set("model", model).
		Set("prompt_tokens", usage.PromptTokens).
		Set("completion_tokens", usage.CompletionTokens).
		Set("reasoning_tokens", usage.CompletionDetails.ReasoningTokens).
		Set("cache_read_tokens", usage.PromptDetails.CachedTokens).
		Set("cache_write_tokens", usage.PromptDetails.CacheWriteTokens).
		Set("compacted_through", compactedThrough)
	defer stmt.Close()

	if _, err := deps.PgPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
		return fmt.Errorf("failed to persist summary: %w", err)
	}
	return nil
}

// appendMessages saves a turn's new messages and bumps the conversation's
// updated_at, in one transaction. The touch comes first on purpose: its row
// lock queues concurrent persists for the same conversation behind each
// other, so each turn's block of messages gets contiguous ids and a loaded
// transcript can never interleave two turns.
func (c *Config) appendMessages(ctx context.Context, conversationID uuid.UUID, messages []storedMessage) error {
	deps := c.Deps
	tx, err := deps.PgPool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	touch := sqlf.PostgreSQL.
		Update("agent_conversations").
		Set("updated_at", time.Now().UTC()).
		Where("id = ?", conversationID)
	defer touch.Close()
	if _, err := tx.Exec(ctx, touch.String(), touch.Args()...); err != nil {
		return err
	}

	for _, sm := range messages {
		content, err := json.Marshal(sm.msg)
		if err != nil {
			return err
		}

		stmt := sqlf.PostgreSQL.
			InsertInto("agent_messages").
			Set("conversation_id", conversationID).
			Set("role", sm.msg.Role).
			Set("content", string(content))
		if sm.model != "" {
			stmt.Set("model", sm.model)
			stmt.Set("prompt_tokens", sm.usage.PromptTokens)
			stmt.Set("completion_tokens", sm.usage.CompletionTokens)
			stmt.Set("reasoning_tokens", sm.usage.CompletionDetails.ReasoningTokens)
			stmt.Set("cache_read_tokens", sm.usage.PromptDetails.CachedTokens)
			stmt.Set("cache_write_tokens", sm.usage.PromptDetails.CacheWriteTokens)
		}

		_, err = tx.Exec(ctx, stmt.String(), stmt.Args()...)
		stmt.Close()
		if err != nil {
			return fmt.Errorf("failed to persist message: %w", err)
		}
	}

	return tx.Commit(ctx)
}
