package slack

// AgentEventsTopic is the bus topic carrying normalized Slack events from
// the api service to the agent service.
const AgentEventsTopic = "agent-slack"

// AgentEvent kinds.
const (
	// KindQuestion is a user message the agent should answer.
	KindQuestion = "question"
	// KindGreeting is a user opening the agent's DM, which the agent greets
	// with suggested prompts.
	KindGreeting = "greeting"
)

// AgentEvent surfaces.
const (
	// SurfaceMention is an @mention of the bot in a channel.
	SurfaceMention = "slack_mention"
	// SurfaceAssistant is Slack's native AI assistant pane (a DM thread
	// with the bot).
	SurfaceAssistant = "slack_assistant"
)

// AgentEvent is one normalized Slack event for the query agent. The api
// service verifies, filters and maps the raw Events API callback, then
// publishes this; the agent service consumes it. The bot token deliberately
// stays off the bus; the agent reads it from team_slack by TeamID.
type AgentEvent struct {
	Kind        string `json:"kind"`
	Surface     string `json:"surface"`
	TeamID      string `json:"team_id"`
	SlackTeamID string `json:"slack_team_id"`
	Channel     string `json:"channel"`
	// ThreadTS is the thread root timestamp replies should target: the
	// enclosing thread when the message is already in one, else the
	// message's own timestamp.
	ThreadTS string `json:"thread_ts"`
	// EventTS is the timestamp of the triggering message itself.
	EventTS     string `json:"event_ts"`
	SlackUserID string `json:"slack_user_id"`
	Text        string `json:"text"`
	EventID     string `json:"event_id"`
	// HasFiles marks a message that carried file attachments. Only the typed
	// text rides on the event; the files themselves are never fetched.
	HasFiles bool `json:"has_files,omitempty"`
	// Traceparent carries the W3C trace context of the HTTP request that
	// received the event, so the consumer's spans join the same trace.
	Traceparent string `json:"traceparent,omitempty"`
}
