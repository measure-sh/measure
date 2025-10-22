package slack

import (
	"backend/alerts/server"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

type SlackMessageData struct {
	Channel  string       `json:"channel"`
	Text     string       `json:"text"`
	Blocks   []SlackBlock `json:"blocks,omitempty"`
	BotToken string       `json:"bot_token"`
}

// Base interface for all block types
type SlackBlock interface{}

// Specific block types
type SlackHeaderBlock struct {
	Type string     `json:"type"`
	Text *SlackText `json:"text"`
}

type SlackSectionBlock struct {
	Type      string          `json:"type"`
	Text      *SlackText      `json:"text,omitempty"`
	Fields    []SlackText     `json:"fields,omitempty"`
	Accessory *SlackAccessory `json:"accessory,omitempty"`
}

type SlackContextBlock struct {
	Type     string      `json:"type"`
	Elements []SlackText `json:"elements"`
}

type SlackActionsBlock struct {
	Type     string         `json:"type"`
	Elements []SlackElement `json:"elements"`
}

type SlackDividerBlock struct {
	Type string `json:"type"`
}

type SlackText struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type SlackElement struct {
	Type string     `json:"type"`
	Text *SlackText `json:"text,omitempty"`
	URL  string     `json:"url,omitempty"`
}

type SlackAccessory struct {
	Type string     `json:"type"`
	Text *SlackText `json:"text,omitempty"`
	URL  string     `json:"url,omitempty"`
}

type SlackMessage struct {
	Blocks []SlackBlock `json:"blocks"`
}

// List of errors that require channel removal
var errorsToRemoveMessageAndChannel = map[string]bool{
	"access_denied":     true,
	"channel_not_found": true,
	"is_archived":       true,
	"no_permission":     true,
	"ekm_access_denied": true,
	"account_inactive":  true,
}

// SendPendingAlertSlackMessages checks the pending alert messages in the database and sends them as Slack messages.
// It processes up to 250 messages at a time, sending each message with a 1 second delay and deleting
// the message from the database after a successful send. If an error occurs while sending a message,
// it logs the error but continues processing the next messages.
func SendPendingAlertSlackMessages(ctx context.Context) error {
	fmt.Println("Checking pending alert Slack messages...")
	stmt := sqlf.From("pending_alert_messages").
		Select("id, team_id, data").
		Where("channel = ?", "slack").
		OrderBy("created_at ASC").
		Limit(250)
	rows, err := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return fmt.Errorf("failed to query pending alert messages: %w", err)
	}
	defer rows.Close()

	type pendingMsg struct {
		ID     uuid.UUID
		TeamID uuid.UUID
		Data   []byte
	}

	var msgs []pendingMsg
	for rows.Next() {
		var m pendingMsg
		if err := rows.Scan(&m.ID, &m.TeamID, &m.Data); err != nil {
			fmt.Printf("failed to scan row: %s\n", err)
			continue
		}
		msgs = append(msgs, m)
	}
	if rows.Err() != nil {
		return fmt.Errorf("row error: %w", rows.Err())
	}

	for _, msg := range msgs {
		fmt.Printf("Sending Slack message for msg Id: %v\n", msg.ID)
		var slackMsgData SlackMessageData
		if err := json.Unmarshal(msg.Data, &slackMsgData); err != nil {
			fmt.Printf("failed to unmarshal Slack message info for id %s: %s\n", msg.ID, err)
			continue
		}

		if err := SendSlackMessage(ctx, msg.ID, msg.TeamID, slackMsgData); err != nil {
			fmt.Printf("failed to send Slack message for id %s: %s\n", msg.ID, err)
			continue
		}

		delStmt := sqlf.DeleteFrom("pending_alert_messages").Where("id = ?", msg.ID)
		if _, err := server.Server.PgPool.Exec(ctx, delStmt.String(), delStmt.Args()...); err != nil {
			fmt.Printf("failed to delete pending alert message id %s: %s\n", msg.ID, err)
		}
		time.Sleep(1 * time.Second)
	}

	return nil
}

func SendSlackMessage(ctx context.Context, msgID uuid.UUID, teamID uuid.UUID, slackMsgData SlackMessageData) error {
	url := "https://slack.com/api/chat.postMessage"

	payload := map[string]any{
		"channel": slackMsgData.Channel,
		"text":    slackMsgData.Text,
	}

	if len(slackMsgData.Blocks) > 0 {
		payload["blocks"] = slackMsgData.Blocks
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		fmt.Printf("failed to marshal Slack message payload: %s\n", err)
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(payloadBytes))
	if err != nil {
		fmt.Printf("failed to create HTTP request: %s\n", err)
		return err
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", slackMsgData.BotToken))

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("failed to send Slack message: %s\n", err)
		return err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to send slack message, slack response status: %d", resp.StatusCode)
	}

	// Slack API call succeeded, but check if Slack returned an error in the response body
	var slackResponse struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
	}
	if err := json.Unmarshal(body, &slackResponse); err != nil {
		fmt.Printf("failed to decode Slack API response: %s\n", err)
		return fmt.Errorf("failed to decode Slack API response")
	}

	if !slackResponse.OK {

		if errorsToRemoveMessageAndChannel[slackResponse.Error] {
			fmt.Printf("Removing pending alert %s due to error: %s\n", msgID, slackResponse.Error)
			if err := removePendingAlert(ctx, msgID); err != nil {
				fmt.Printf("failed to remove pending alert %s: %s\n", msgID, err)
			}

			fmt.Printf("Removing channel %s from channel list due to error: %s\n", slackMsgData.Channel, slackResponse.Error)
			if err := removeChannelFromList(ctx, teamID, slackMsgData.Channel); err != nil {
				fmt.Printf("failed to remove channel %s from team %s: %s\n", slackMsgData.Channel, teamID, err)
			}
		}

		return fmt.Errorf("slack API error: %s", slackResponse.Error)
	}

	return nil
}

func removePendingAlert(ctx context.Context, alertId uuid.UUID) error {
	stmt := sqlf.DeleteFrom("pending_alert_messages").Where("id = ?", alertId)
	_, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return fmt.Errorf("failed to delete pending alert message: %w", err)
	}
	return nil
}

func removeChannelFromList(ctx context.Context, teamID uuid.UUID, channel string) error {
	stmt := "UPDATE team_slack SET channel_ids = array_remove(channel_ids, $1) WHERE team_id = $2"
	_, err := server.Server.PgPool.Exec(ctx, stmt, channel, teamID)
	if err != nil {
		return fmt.Errorf("failed to update channel_ids: %w", err)
	}
	return nil
}
