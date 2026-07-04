package slackwebhook

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend/api/server"
	"backend/libs/bus"
	"backend/libs/slack"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

// Webhook serves api's /slack/events endpoint: it verifies Slack requests,
// answers slash commands, and publishes Events API messages to the bus for the
// agent service. The bus producer lives here, in api; it is not part of the
// shared infra, since api is the only service that publishes.
type Webhook struct {
	deps     *server.Deps
	producer bus.Producer
}

// New builds a Slack webhook bound to the app's deps and the bus producer that
// carries normalized events to the agent service.
func New(deps *server.Deps, producer bus.Producer) *Webhook {
	return &Webhook{deps: deps, producer: producer}
}

// slackSignatureVersion is the version Slack prepends to the signature base
// string and to the signature itself.
const slackSignatureVersion = "v0"

// slackRequestMaxAge is the maximum age of an incoming Slack request we accept.
// Slack recommends rejecting requests older than five minutes to guard against
// replay attacks.
const slackRequestMaxAge = 5 * time.Minute

// computeSlackSignature builds the value Slack puts in the X-Slack-Signature
// header: the HMAC-SHA256 of the "v0:{timestamp}:{body}" base string, keyed with
// the signing secret, hex-encoded and prefixed with "v0=".
func computeSlackSignature(signingSecret, timestamp string, body []byte) string {
	baseString := fmt.Sprintf("%s:%s:%s", slackSignatureVersion, timestamp, body)
	mac := hmac.New(sha256.New, []byte(signingSecret))
	mac.Write([]byte(baseString))
	return slackSignatureVersion + "=" + hex.EncodeToString(mac.Sum(nil))
}

// verifySlackSignature verifies that a request body genuinely came from Slack
// using the app's signing secret, following the scheme described at
// https://api.slack.com/authentication/verifying-requests-from-slack. It
// recomputes the HMAC-SHA256 of "v0:{timestamp}:{body}" keyed with the signing
// secret and compares it against the X-Slack-Signature header in constant time.
// Requests whose timestamp falls outside the allowed window are rejected.
func verifySlackSignature(header http.Header, body []byte, signingSecret string) error {
	timestamp := header.Get("X-Slack-Request-Timestamp")
	if timestamp == "" {
		return fmt.Errorf("missing X-Slack-Request-Timestamp header")
	}

	signature := header.Get("X-Slack-Signature")
	if signature == "" {
		return fmt.Errorf("missing X-Slack-Signature header")
	}

	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid X-Slack-Request-Timestamp header: %w", err)
	}

	if age := time.Since(time.Unix(ts, 0)); age > slackRequestMaxAge || age < -slackRequestMaxAge {
		return fmt.Errorf("stale X-Slack-Request-Timestamp header")
	}

	expected := computeSlackSignature(signingSecret, timestamp, body)

	if !hmac.Equal([]byte(expected), []byte(signature)) {
		return fmt.Errorf("signature mismatch")
	}

	return nil
}

func (s *Webhook) HandleSlackEvents(c *gin.Context) {
	deps := s.deps
	signingSecret := deps.Config.SlackSigningSecret
	if signingSecret == "" {
		fmt.Println("SLACK_SIGNING_SECRET is not configured, rejecting Slack request")
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Slack signing secret not configured"})
		return
	}

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		msg := `failed to read request body`
		fmt.Println(msg, err)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if err := verifySlackSignature(c.Request.Header, body, signingSecret); err != nil {
		fmt.Println("Slack request verification failed:", err)
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid Slack signature"})
		return
	}

	// The Events API delivers JSON; slash commands arrive form-encoded.
	if c.ContentType() == "application/json" {
		s.handleSlackEventsAPI(c, body)
		return
	}

	// Restore the body that the verification step consumed so the form binding
	// below can read it again.
	c.Request.Body = io.NopCloser(bytes.NewReader(body))

	var payload struct {
		Command     string `form:"command"`
		SlackTeamID string `form:"team_id"`
		ChannelID   string `form:"channel_id"`
		Text        string `form:"text"`
		UserID      string `form:"user_id"`
		SSLCheck    string `form:"ssl_check"`
	}

	if err := c.ShouldBind(&payload); err != nil {
		msg := `invalid request payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	// Handle SSL check requests from Slack
	if payload.SSLCheck == "1" {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
		return
	}

	// Log the received command
	fmt.Printf("Received Slack command [%s] for team [%s] in channel [%s] from user [%s]\n",
		payload.Command, payload.SlackTeamID, payload.ChannelID, payload.UserID)

	// Route to appropriate handler based on command
	switch payload.Command {
	case "/subscribe-alerts":
		handleSubscribeAlerts(c, deps, payload.SlackTeamID, payload.ChannelID)
	case "/stop-alerts":
		handleStopAlerts(c, deps, payload.SlackTeamID, payload.ChannelID)
	case "/list-alert-channels":
		handleGetActiveAlertChannels(c, deps, payload.SlackTeamID)
	default:
		c.JSON(http.StatusOK, gin.H{
			"response_type": "in_channel",
			"text":          fmt.Sprintf("Unknown command: %s\nAvailable commands:\n• `/get-alerts` - List active alert channels\n• `/register-alerts` - Register this channel for alerts\n• `/stop-alerts` - Stop alerts for this channel", payload.Command),
		})
	}
}

// slackEventEnvelope is the outer body of an Events API callback.
type slackEventEnvelope struct {
	Type      string          `json:"type"`
	Challenge string          `json:"challenge"`
	EventID   string          `json:"event_id"`
	TeamID    string          `json:"team_id"`
	Event     json.RawMessage `json:"event"`
}

// slackInnerEvent is the event object inside an event_callback envelope,
// covering the fields of the event types the query agent handles.
type slackInnerEvent struct {
	Type        string `json:"type"`
	Subtype     string `json:"subtype"`
	User        string `json:"user"`
	BotID       string `json:"bot_id"`
	Text        string `json:"text"`
	TS          string `json:"ts"`
	ThreadTS    string `json:"thread_ts"`
	Channel     string `json:"channel"`
	ChannelType string `json:"channel_type"`
	// Files is the message's file attachments. Only their presence matters
	// here, so the entries stay unparsed.
	Files []json.RawMessage `json:"files"`
	// Tab is set on app_home_opened: "messages" when the user opens the
	// agent's DM (the greeting trigger in Agent view), or "home" for the App
	// Home tab, which we ignore.
	Tab string `json:"tab"`
}

// handleSlackEventsAPI handles Events API callbacks: the URL verification
// handshake and event deliveries. Events the query agent cares about are
// mapped to a team and published to the bus. Everything else is acked with
// 200 so Slack doesn't retry; non-2xx is reserved for failures where the
// retry is genuinely useful.
func (s *Webhook) handleSlackEventsAPI(c *gin.Context, body []byte) {
	deps := s.deps
	ctx := c.Request.Context()

	var envelope slackEventEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		msg := "invalid request payload"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	switch envelope.Type {
	case "url_verification":
		// One-time handshake when the events URL is saved in the Slack app
		// config; worth a log line since it is how setups get debugged.
		fmt.Println("slack events: url verification handshake answered")
		c.JSON(http.StatusOK, gin.H{"challenge": envelope.Challenge})
		return
	case "event_callback":
	default:
		c.JSON(http.StatusOK, gin.H{})
		return
	}

	var inner slackInnerEvent
	if err := json.Unmarshal(envelope.Event, &inner); err != nil {
		msg := "invalid event payload"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	event, ok := normalizeSlackAgentEvent(envelope, inner)
	if !ok {
		c.JSON(http.StatusOK, gin.H{})
		return
	}

	// From here the event is one the agent wants; annotate the request span
	// (text stays out of telemetry, ids only).
	span := trace.SpanFromContext(ctx)
	span.SetAttributes(
		attribute.String("slack.event_id", event.EventID),
		attribute.String("slack.kind", event.Kind),
		attribute.String("slack.surface", event.Surface),
	)

	// Nil means no bus is configured at all; check it before spending
	// Valkey and Postgres round-trips on an event that can only be dropped.
	if s.producer == nil {
		fmt.Println("slack events: bus producer is not configured, dropping event", event.EventID)
		c.JSON(http.StatusOK, gin.H{})
		return
	}

	// Slack redelivers events it thinks we missed; drop ones already handled.
	if slackEventSeen(ctx, deps, event.EventID) {
		fmt.Printf("slack events: dropping redelivery of %s\n", event.EventID)
		c.JSON(http.StatusOK, gin.H{})
		return
	}

	teamID, err := getTeamIDForSlackTeam(ctx, deps, envelope.TeamID)
	if err != nil {
		fmt.Println("slack events: failed to look up workspace mapping:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process event"})
		return
	}
	if teamID == "" {
		// No team has connected this workspace; nothing to route the event to.
		fmt.Printf("slack events: no connected team for workspace %s, dropping %s\n", envelope.TeamID, event.EventID)
		c.JSON(http.StatusOK, gin.H{})
		return
	}
	event.TeamID = teamID
	span.SetAttributes(attribute.String("slack.team_id", teamID))

	// Carry this request's trace context so the agent's turn spans join it.
	carrier := propagation.MapCarrier{}
	propagation.TraceContext{}.Inject(ctx, carrier)
	event.Traceparent = carrier["traceparent"]

	data, err := json.Marshal(event)
	if err != nil {
		fmt.Println("slack events: failed to marshal agent event:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process event"})
		return
	}

	if err := s.producer.Publish(ctx, data); err != nil {
		fmt.Println("slack events: failed to publish agent event:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process event"})
		return
	}

	markSlackEventSeen(ctx, deps, event.EventID)
	fmt.Printf("slack events: published %s kind=%s surface=%s team=%s\n",
		event.EventID, event.Kind, event.Surface, teamID)
	c.JSON(http.StatusOK, gin.H{})
}

// normalizeSlackAgentEvent turns a raw Events API event into the bus event
// the agent service consumes. ok is false for events the agent ignores: bot
// messages (its own answers included), edits and other message subtypes,
// non-DM plain messages, and event types we aren't subscribed to.
func normalizeSlackAgentEvent(envelope slackEventEnvelope, inner slackInnerEvent) (event slack.AgentEvent, ok bool) {
	// file_share is the one subtype that is still a plain user message;
	// it marks a message with a file attached, typed text included.
	if inner.BotID != "" || (inner.Subtype != "" && inner.Subtype != "file_share") {
		return event, false
	}

	event = slack.AgentEvent{
		SlackTeamID: envelope.TeamID,
		EventID:     envelope.EventID,
		SlackUserID: inner.User,
		Text:        inner.Text,
		Channel:     inner.Channel,
		EventTS:     inner.TS,
		ThreadTS:    inner.ThreadTS,
		// The files array and the file_share subtype both mark attachments;
		// DM messages carry both, mentions only the array.
		HasFiles: len(inner.Files) > 0 || inner.Subtype == "file_share",
	}
	if event.ThreadTS == "" {
		// A message outside a thread roots its own; replies target it.
		event.ThreadTS = inner.TS
	}

	switch {
	case inner.Type == "app_mention":
		// A mention inside a DM also arrives as a message.im event with its
		// own event id; let that delivery answer so the user gets one reply.
		if strings.HasPrefix(inner.Channel, "D") {
			return event, false
		}
		event.Kind, event.Surface = slack.KindQuestion, slack.SurfaceMention
	case inner.Type == "message" && inner.ChannelType == "im":
		event.Kind, event.Surface = slack.KindQuestion, slack.SurfaceAssistant
	case inner.Type == "app_home_opened" && inner.Tab == "messages":
		// Agent view greets when the user opens the DM's Messages tab. The
		// user and channel are the event's top-level fields (already set
		// above), and the prompts sit at the top of the tab, so no thread.
		event.Kind, event.Surface = slack.KindGreeting, slack.SurfaceAssistant
	default:
		return event, false
	}

	// A question needs text to answer, so textless messages are dropped,
	// except ones carrying files: those get a reply asking for the contents
	// as text, where silence would read as the agent ignoring the file.
	if event.Kind == slack.KindQuestion && strings.TrimSpace(event.Text) == "" && !event.HasFiles {
		return event, false
	}
	return event, true
}

// slackEventSeen reports whether this Slack event was already handled. On
// Valkey trouble it says no, a duplicate answer beats a dropped question.
func slackEventSeen(ctx context.Context, deps *server.Deps, eventID string) bool {
	vk := deps.VK
	if vk == nil || eventID == "" {
		return false
	}
	cmd := vk.B().Exists().Key("slack:event:" + eventID).Build()
	n, err := vk.Do(ctx, cmd).AsInt64()
	if err != nil {
		return false
	}
	return n > 0
}

// markSlackEventSeen records a handled Slack event. The TTL comfortably
// outlives Slack's retry window (immediate, 1 minute, 5 minutes).
func markSlackEventSeen(ctx context.Context, deps *server.Deps, eventID string) {
	vk := deps.VK
	if vk == nil || eventID == "" {
		return
	}
	cmd := vk.B().Set().Key("slack:event:" + eventID).Value("1").ExSeconds(600).Build()
	if err := vk.Do(ctx, cmd).Error(); err != nil {
		fmt.Println("failed to mark Slack event as seen:", err)
	}
}

// getTeamIDForSlackTeam returns the Measure team connected to a Slack
// workspace, or empty when none is connected. A paused integration still
// resolves: the edge forwards the event and the agent decides what to do after
// re-checking is_active (post a disabled notice, or skip a greeting).
func getTeamIDForSlackTeam(ctx context.Context, deps *server.Deps, slackTeamID string) (string, error) {
	stmt := sqlf.PostgreSQL.
		Select("team_id").
		From("team_slack").
		Where("slack_team_id = ?", slackTeamID)
	defer stmt.Close()

	var teamID string
	err := deps.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&teamID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return teamID, nil
}

func handleSubscribeAlerts(c *gin.Context, deps *server.Deps, slackTeamID, channelID string) {
	ctx := c.Request.Context()

	// First check if channel already exists
	var exists int
	checkSQL := "SELECT 1 FROM team_slack WHERE slack_team_id = $1 AND $2 = ANY(channel_ids)"
	err := deps.PgPool.QueryRow(ctx, checkSQL, slackTeamID, channelID).Scan(&exists)
	if err == nil {
		c.JSON(http.StatusOK, gin.H{
			"response_type": "in_channel",
			"text":          "Channel is already registered for alert notifications!",
		})
		return
	}

	updateSQL := "UPDATE team_slack SET channel_ids = array_append(channel_ids, $1) WHERE slack_team_id = $2"
	commandTag, err := deps.PgPool.Exec(ctx, updateSQL, channelID, slackTeamID)
	if err != nil {
		msg := fmt.Sprintf("error occurred while updating Slack team channels: %s", slackTeamID)
		fmt.Println(msg, err)
		c.JSON(http.StatusOK, gin.H{
			"response_type": "in_channel",
			"text":          "Failed to register channel for alert notifications. Please check your slack integration in the Measure dashboard.",
		})
		return
	}

	if commandTag.RowsAffected() == 0 {
		c.JSON(http.StatusOK, gin.H{
			"response_type": "in_channel",
			"text":          "Failed to register channel for alert notifications. Please check your slack integration in the Measure dashboard.",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"response_type": "in_channel",
		"text":          "Channel successfully registered to receive alert notifications!",
	})
}

func handleStopAlerts(c *gin.Context, deps *server.Deps, slackTeamID, channelID string) {
	ctx := c.Request.Context()

	updateSQL := "UPDATE team_slack SET channel_ids = array_remove(channel_ids, $1) WHERE slack_team_id = $2"
	commandTag, err := deps.PgPool.Exec(ctx, updateSQL, channelID, slackTeamID)
	if err != nil {
		msg := fmt.Sprintf("error occurred while updating Slack team channels: %s", slackTeamID)
		fmt.Println(msg, err)
		c.JSON(http.StatusOK, gin.H{
			"response_type": "in_channel",
			"text":          "Failed to unregister channel for alert notifications. Please check your slack integration in the Measure dashboard.",
		})
		return
	}

	if commandTag.RowsAffected() == 0 {
		c.JSON(http.StatusOK, gin.H{
			"response_type": "in_channel",
			"text":          "Failed to unregister channel for alert notifications. Please check your slack integration in the Measure dashboard.",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"response_type": "in_channel",
		"text":          "Channel successfully unregistered from alert notifications!",
	})
}

func handleGetActiveAlertChannels(c *gin.Context, deps *server.Deps, slackTeamID string) {
	ctx := c.Request.Context()

	selectSQL := "SELECT channel_ids FROM team_slack WHERE slack_team_id = $1"
	var channelIDs []string
	err := deps.PgPool.QueryRow(ctx, selectSQL, slackTeamID).Scan(&channelIDs)
	if err != nil {
		msg := fmt.Sprintf("error occurred while fetching Slack team channels: %s", slackTeamID)
		fmt.Println(msg, err)
		c.JSON(http.StatusOK, gin.H{
			"response_type": "in_channel",
			"text":          "Failed to fetch channels. Please check your slack integration in the Measure dashboard.",
		})
		return
	}

	if len(channelIDs) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"response_type": "in_channel",
			"text":          "No channels are currently registered for alert notifications.",
		})
		return
	}

	formattedChannels := "<#" + strings.Join(channelIDs, ">, <#") + ">"

	c.JSON(http.StatusOK, gin.H{
		"response_type": "in_channel",
		"text":          fmt.Sprintf("Active alert channels: %s", formattedChannels),
	})
}
