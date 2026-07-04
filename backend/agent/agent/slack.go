package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/rand/v2"
	"regexp"
	"runtime/debug"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"backend/libs/concur"
	"backend/libs/slack"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
	valkey "github.com/valkey-io/valkey-go"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
)

// slackTurnTimeout bounds one Slack-originated turn. Generous because a
// turn can chain a dozen LLM calls plus tool work.
const slackTurnTimeout = 15 * time.Minute

// somethingWentWrong is the reply for failures the asker can't act on.
const somethingWentWrong = "Something went wrong on my side. Please try again."

// fileAttachmentsReply is the reply when the triggering message carries file
// attachments. The agent can't read files yet, so asking for the contents as
// text beats answering with the attachment silently ignored.
const fileAttachmentsReply = "I can't read file attachments yet. Please paste the relevant contents directly as text in your message and ask again."

// slackDisabledNotice is the reply when a team has paused its Slack
// integration: the agent stops answering and points the asker at the switch.
// dashboard is the word "dashboard", linked to the team page holding the
// switch (dashboardLink).
func slackDisabledNotice(dashboard string) string {
	return fmt.Sprintf("Slack integration is disabled for this workspace. An admin can re-enable it under Team settings in the Measure %s.", dashboard)
}

// HandleSlackEvent consumes one normalized Slack event from the bus.
// Questions run inline: the event is acked only when its turn has fully run
// (the nil return), so a crash or shutdown mid-turn leaves it on the bus to
// re-run after restart. The consumer sets the concurrency: Iggy delivers
// strictly one at a time, Pub/Sub a bounded handful. Events are published
// with a per-thread ordering key, so what runs concurrently is always
// different threads; one thread's events arrive one at a time, in order. A
// turn that ran but failed answers with an error message in the thread
// rather than nacking; redelivery would only repeat the failure.
func (c *Config) HandleSlackEvent(ctx context.Context, data []byte) error {
	var ev slack.AgentEvent
	if err := json.Unmarshal(data, &ev); err != nil {
		log.Printf("agent: dropping undecodable slack event: %v", err)
		return nil
	}

	log.Printf("agent: slack event received id=%s kind=%s surface=%s", ev.EventID, ev.Kind, ev.Surface)

	switch ev.Kind {
	case slack.KindGreeting:
		// Greeting is cheap and touches no transcript; keep the queue
		// moving while it runs.
		concur.GlobalWg.Go(func() {
			c.greetAssistantThread(context.Background(), ev)
		})
	case slack.KindQuestion:
		c.answerSlackQuestion(ctx, ev)
		// Shutdown mid-turn: the turn delivered nothing, so leave the
		// event unacked for redelivery.
		return ctx.Err()
	default:
		log.Printf("agent: dropping slack event with unknown kind %q", ev.Kind)
	}
	return nil
}

// slackEventContext returns ctx carrying the trace context the api edge
// stamped on the event, so spans here join the trace that began at the
// Slack HTTP request.
func slackEventContext(ctx context.Context, ev slack.AgentEvent) context.Context {
	if ev.Traceparent == "" {
		return ctx
	}
	return propagation.TraceContext{}.Extract(ctx, propagation.MapCarrier{"traceparent": ev.Traceparent})
}

// recoverSlackPanic keeps a panicking Slack goroutine from killing the whole
// process. The MCP surface gets the same protection from gin's recovery
// middleware; bus-spawned goroutines have only this.
func recoverSlackPanic(during string) {
	if r := recover(); r != nil {
		log.Printf("agent: panic during slack %s: %v\n%s", during, r, debug.Stack())
	}
}

// greetAssistantThread offers starter prompts when a user opens the agent's DM
// (the Messages tab in Agent view).
func (c *Config) greetAssistantThread(ctx context.Context, ev slack.AgentEvent) {
	defer recoverSlackPanic("greeting")
	ctx, cancel := context.WithTimeout(ctx, time.Minute)
	defer cancel()

	ctx, span := tracer.Start(slackEventContext(ctx, ev), "agent.slack_greet")
	defer span.End()
	span.SetAttributes(attribute.String("agent.team_id", ev.TeamID))

	teamID, err := uuid.Parse(ev.TeamID)
	if err != nil {
		log.Printf("agent: slack event with invalid team id %q", ev.TeamID)
		return
	}
	token, _, active, err := c.getSlackIntegration(ctx, teamID)
	if err != nil || token == "" {
		log.Printf("agent: no usable slack integration for team %s: %v", teamID, err)
		return
	}
	if !active {
		// Slack is paused for this team; don't offer assistant prompts.
		return
	}

	prompts := []slack.SuggestedPrompt{
		{Title: "App health summary today", Message: "How is the app doing on sessions and error rates today?"},
		{Title: "Latest release summary", Message: "How are the metrics doing for the latest release?"},
		{Title: "Network problems today", Message: "Are any network endpoints failing more or slower than usual today?"},
		{Title: "Top issues this week", Message: "What are the most common errors this week?"},
	}
	if err := slack.SetAssistantSuggestedPrompts(ctx, token, ev.Channel, prompts); err != nil {
		log.Printf("agent: failed to set suggested prompts: %v", err)
	}
}

// answerSlackQuestion runs one Slack question end to end: skip it if a
// previous delivery already answered it, acknowledge instantly, work out
// the reply, deliver it to the thread, mark it answered.
func (c *Config) answerSlackQuestion(ctx context.Context, ev slack.AgentEvent) {
	defer recoverSlackPanic("turn")
	start := time.Now()
	outcome := "answered"

	ctx, cancel := context.WithTimeout(ctx, slackTurnTimeout)
	defer cancel()

	ctx, span := tracer.Start(slackEventContext(ctx, ev), "agent.slack_question")
	defer span.End()
	span.SetAttributes(
		attribute.String("agent.surface", ev.Surface),
		attribute.String("agent.team_id", ev.TeamID),
		attribute.String("slack.event_id", ev.EventID),
		attribute.String("slack.channel", ev.Channel),
	)
	defer func() {
		span.SetAttributes(attribute.String("agent.outcome", outcome))
		log.Printf("agent: slack question event=%s surface=%s outcome=%s duration=%s",
			ev.EventID, ev.Surface, outcome, time.Since(start).Round(time.Millisecond))
	}()

	teamID, err := uuid.Parse(ev.TeamID)
	if err != nil {
		outcome = "invalid_team_id"
		log.Printf("agent: slack event with invalid team id %q", ev.TeamID)
		return
	}

	// A redelivery of an event whose reply already went out (the crash beat
	// the offset commit, or a Slack retry slipped past the api edge).
	if c.slackEventAnswered(ctx, ev.EventID) {
		outcome = "already_answered"
		return
	}

	token, botUserID, active, err := c.getSlackIntegration(ctx, teamID)
	if err != nil || token == "" {
		outcome = "no_integration"
		log.Printf("agent: no usable slack integration for team %s: %v", teamID, err)
		return
	}
	if !active {
		// Slack is paused for this team: don't run the turn, but tell the asker
		// why and how to re-enable it. Mark it answered so Slack retries don't
		// repost the notice.
		outcome = "integration_disabled"
		notice := toMrkdwn(slackDisabledNotice(c.dashboardLink(teamID, "team")))
		if _, err := slack.PostMessage(ctx, token, ev.Channel, ev.ThreadTS, notice); err != nil {
			log.Printf("agent: failed to post slack disabled notice: %v", err)
		}
		c.markSlackEventAnswered(ctx, ev.EventID)
		return
	}

	// Acknowledge before the slow part: mentions get a placeholder message
	// the answer later replaces, assistant threads get a status line.
	ackTS := ""
	if ev.Surface == slack.SurfaceMention {
		ackTS, err = slack.PostMessage(ctx, token, ev.Channel, ev.ThreadTS, randomAck())
		if err != nil {
			if channelUnreachable(err) {
				// The answer could not be delivered either; don't burn a
				// dozen LLM calls computing it.
				outcome = "channel_unreachable"
				span.SetStatus(codes.Error, err.Error())
				log.Printf("agent: slack channel unreachable, skipping turn: %v", err)
				return
			}
			log.Printf("agent: failed to post slack ack: %v", err)
		}
	} else {
		// In Agent view, setStatus also opens the DM thread so the conversation
		// continues in it. Keep this call for that reason too, not only status.
		if err := slack.SetAssistantStatus(ctx, token, ev.Channel, ev.ThreadTS, "is digging through the telemetry..."); err != nil {
			log.Printf("agent: failed to set assistant status: %v", err)
		}
	}

	replyText, charts := c.slackReply(ctx, ev, teamID, token, botUserID)
	reply := toMrkdwn(replyText)

	if errors.Is(ctx.Err(), context.Canceled) {
		// Shutdown interrupted the turn. Deliver nothing and leave the
		// event unmarked: it stays on the bus and re-runs after restart.
		outcome = "interrupted_by_shutdown"
		return
	}

	// Deliver on a fresh context: when the turn died because ctx hit the
	// turn deadline, the failure reply still has to reach the thread.
	deliverCtx, deliverCancel := context.WithTimeout(context.WithoutCancel(ctx), time.Minute)
	defer deliverCancel()

	if err := c.deliverSlackReply(deliverCtx, token, ev, ackTS, reply); err != nil {
		outcome = "delivery_failed"
		span.SetStatus(codes.Error, err.Error())
	} else {
		// Charts follow the text they illustrate; without the text they
		// would be context-free images, so an undelivered reply skips them.
		uploadSlackCharts(deliverCtx, token, ev, charts)
	}
	c.markSlackEventAnswered(deliverCtx, ev.EventID)
}

// uploadSlackCharts shares a turn's rendered charts into the thread after the
// reply text. Best-effort: the answer already landed, so a failed upload only
// logs and the text stands on its own.
func uploadSlackCharts(ctx context.Context, token string, ev slack.AgentEvent, charts []renderedChart) {
	for _, chart := range charts {
		if err := slack.UploadFile(ctx, token, ev.Channel, ev.ThreadTS, chart.filename, chart.title, chart.png); err != nil {
			log.Printf("agent: failed to upload chart %q: %v", chart.filename, err)
		}
	}
}

// deliverSlackReply replaces the ack placeholder with the reply, or posts
// the reply fresh when there is no placeholder to edit.
func (c *Config) deliverSlackReply(ctx context.Context, token string, ev slack.AgentEvent, ackTS, reply string) error {
	if ackTS != "" {
		err := slack.UpdateMessage(ctx, token, ev.Channel, ackTS, reply)
		if err == nil {
			return nil
		}
		log.Printf("agent: failed to update slack ack, posting fresh: %v", err)
	}
	if _, err := slack.PostMessage(ctx, token, ev.Channel, ev.ThreadTS, reply); err != nil {
		log.Printf("agent: failed to post slack answer: %v", err)
		return err
	}
	return nil
}

// channelUnreachable reports a Slack error meaning nothing can be posted to
// the channel at all: the bot isn't there, the channel is gone, or posting
// is restricted.
func channelUnreachable(err error) bool {
	msg := err.Error()
	for _, code := range []string{"channel_not_found", "not_in_channel", "is_archived", "restricted_action"} {
		if strings.Contains(msg, code) {
			return true
		}
	}
	return false
}

// slackReply resolves who is asking about which app in which conversation,
// runs the turn, and returns the text to post, the answer or a message the
// asker can act on, plus any charts the turn rendered for upload after the
// text.
func (c *Config) slackReply(ctx context.Context, ev slack.AgentEvent, teamID uuid.UUID, botToken, botUserID string) (string, []renderedChart) {
	// Attachments never make it past the edge, only the typed text does, so
	// answering the text alone could silently miss the point of the question.
	// Checked before the empty-question greeting: a bare file drop should ask
	// for its contents, not say hello.
	if ev.HasFiles {
		log.Printf("agent: slack question rejected event=%s reason=file_attachments", ev.EventID)
		return fileAttachmentsReply, nil
	}

	question := strings.TrimSpace(slackMentionRE.ReplaceAllString(ev.Text, ""))
	question = slackUnescaper.Replace(question)
	if question == "" {
		return "Hey! I can help you debug your app, from crashes and errors to slow sessions and network issues. What are you looking into?", nil
	}

	userID, email, err := c.resolveSlackUser(ctx, botToken, ev.SlackTeamID, ev.SlackUserID, teamID)
	if err != nil {
		log.Printf("agent: slack identity resolution failed: %v", err)
		return somethingWentWrong, nil
	}
	if email == "" {
		log.Printf("agent: slack question rejected event=%s reason=email_hidden", ev.EventID)
		return "I couldn't read an email from your Slack profile, so I can't match you to a Measure account.", nil
	}
	if userID == uuid.Nil {
		log.Printf("agent: slack question rejected event=%s reason=not_team_member", ev.EventID)
		dashboard := c.dashboardLink(teamID, "team")
		// Name the email only in the user's own assistant pane; in a channel
		// it would disclose a possibly hidden profile email to everyone.
		if ev.Surface == slack.SurfaceAssistant {
			return fmt.Sprintf("I couldn't find a Measure team member with the email %s. Please ask your Measure admin to add you to the team in the %s with that email and try again.", email, dashboard), nil
		}
		return fmt.Sprintf("I couldn't find a Measure team member matching your Slack profile email. Please ask your Measure admin to add you to the team in the %s with your Slack profile email and try again.", dashboard), nil
	}

	conv, err := c.findSlackConversation(ctx, ev.Channel, ev.ThreadTS)
	if err != nil {
		log.Printf("agent: failed to look up slack conversation: %v", err)
		return somethingWentWrong, nil
	}

	continued := conv != nil
	var appID uuid.UUID
	var resolveUsage chatUsage
	if continued {
		// Assistant threads stay private to whoever started them. Channel
		// threads are open to the whole team; resolveSlackUser already
		// required team membership.
		if conv.Surface == slack.SurfaceAssistant && conv.UserID != userID {
			log.Printf("agent: slack question rejected event=%s reason=foreign_assistant_thread", ev.EventID)
			return "This chat belongs to another user, please start another thread with me.", nil
		}
		appID = conv.AppID
	} else {
		apps, err := c.getTeamApps(ctx, teamID)
		if err != nil {
			log.Printf("agent: failed to list team apps: %v", err)
			return somethingWentWrong, nil
		}
		if len(apps) == 0 {
			log.Printf("agent: slack question from team with no apps event=%s", ev.EventID)
			return noAppsReply(c.dashboardLink(teamID, "apps")), nil
		}
		app, clarify := pickMeasureApp(apps, question)
		if clarify != "" {
			// The current message names no app on its own. The surrounding
			// discussion often does, so read it and try to resolve from there,
			// by exact name or by approximation, before asking which app.
			resolved, usage, ok := c.resolveAppFromContext(ctx, botToken, botUserID, ev, apps)
			if !ok {
				log.Printf("agent: slack question needs clarification event=%s apps=%d", ev.EventID, len(apps))
				return clarify, nil
			}
			log.Printf("agent: slack app resolved from context event=%s app=%s", ev.EventID, resolved.id)
			app = resolved
			resolveUsage = usage
		}
		appID = app.id
	}

	// Re-verifies team membership and fetches the billing customer. The
	// returned team is the app's owning team, the one the turn must scope
	// queries and metering to.
	turnTeamID, customerID, err := c.resolveAppAccess(ctx, userID, appID)
	if err != nil {
		log.Printf("agent: slack app access check failed: %v", err)
		return somethingWentWrong, nil
	}
	// Meter any model call the app resolution above made. No-ops on zero.
	trackAgentTokens(c.Deps, customerID, c.ModelSmall, callUsage(resolveUsage))
	if err := c.checkAgentAllowed(ctx, customerID); err != nil {
		log.Printf("agent: slack question rejected event=%s reason=usage_blocked", ev.EventID)
		return agentNotAllowedReply(c.dashboardLink(turnTeamID, "usage")), nil
	}

	if !continued {
		conv = &conversation{
			UserID:         userID,
			AppID:          appID,
			TeamID:         turnTeamID,
			Surface:        ev.Surface,
			SlackChannelID: ev.Channel,
			SlackThreadTS:  ev.ThreadTS,
			SlackUserID:    ev.SlackUserID,
		}
		if err := c.createConversation(ctx, conv, conversationTitle(question)); err != nil {
			log.Printf("agent: failed to create slack conversation: %v", err)
			return somethingWentWrong, nil
		}
		if ev.Surface == slack.SurfaceAssistant {
			if err := slack.SetAssistantTitle(ctx, botToken, ev.Channel, ev.ThreadTS, conversationTitle(question)); err != nil {
				log.Printf("agent: failed to set assistant thread title: %v", err)
			}
		}
	}

	// On a channel mention, fold the surrounding Slack discussion into the
	// conversation as context before answering: a fresh thread or channel
	// contributes its recent messages, a thread the bot is already in only
	// what was said since its last mention. Best-effort and already
	// acknowledged, so a slow or failed fetch never blocks the answer.
	if ev.Surface == slack.SurfaceMention {
		c.ingestSlackContext(ctx, conv, ev, botToken, botUserID, customerID)
	}

	answer, charts, err := c.runTurn(ctx, turn{
		userID:     userID,
		appID:      appID,
		teamID:     turnTeamID,
		customerID: customerID,
		conv:       conv,
		continued:  continued,
		question:   question,
		entryPoint: ev.Surface,
	})
	if err != nil {
		if errors.Is(err, errNoAnswer) {
			return budgetExhaustedReply, nil
		}
		if errors.Is(err, errLLMRateLimited) {
			return "We seem to have hit model provider rate-limits. Please try again in some time.", nil
		}
		return somethingWentWrong, nil
	}
	return answer, charts
}

// resolveSlackUser maps a Slack user to a Measure team member via the email
// on their Slack profile. The Slack-side lookup is cached in Valkey. An
// empty email means the profile hides it; a nil user id with an email means
// no team member carries that email.
func (c *Config) resolveSlackUser(ctx context.Context, botToken, slackTeamID, slackUserID string, teamID uuid.UUID) (uuid.UUID, string, error) {
	deps := c.Deps
	email, err := c.slackUserEmail(ctx, botToken, slackTeamID, slackUserID)
	if err != nil {
		return uuid.Nil, "", err
	}
	if email == "" {
		return uuid.Nil, "", nil
	}

	stmt := sqlf.PostgreSQL.
		Select("u.id").
		From("users u").
		Join("team_membership tm", "tm.user_id = u.id").
		Where("lower(u.email) = lower(?)", email).
		Where("tm.team_id = ?", teamID)
	defer stmt.Close()

	var userID uuid.UUID
	err = deps.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, email, nil
	}
	if err != nil {
		return uuid.Nil, "", err
	}
	return userID, email, nil
}

// slackUserEmailTTLSeconds bounds the slack-user-to-email cache: long
// enough to spare the Slack API on every follow-up, short enough that a
// changed profile email surfaces within the hour.
const slackUserEmailTTLSeconds = 3600

// slackUserEmail returns the email on a Slack user's profile, reading
// Valkey first and asking Slack only on a miss. Caching is best-effort.
func (c *Config) slackUserEmail(ctx context.Context, botToken, slackTeamID, slackUserID string) (string, error) {
	deps := c.Deps
	vk := deps.VK
	key := fmt.Sprintf("slack:email:%s:%s", slackTeamID, slackUserID)

	if vk != nil {
		result := vk.Do(ctx, vk.B().Get().Key(key).Build())
		if err := result.Error(); err == nil {
			if email, err := result.ToString(); err == nil {
				return email, nil
			}
		} else if !valkey.IsValkeyNil(err) {
			log.Printf("agent: slack email cache get failed: %v", err)
		}
	}

	email, err := slack.UserEmail(ctx, botToken, slackUserID)
	if err != nil {
		return "", err
	}

	if vk != nil && email != "" {
		cmd := vk.B().Set().Key(key).Value(email).ExSeconds(slackUserEmailTTLSeconds).Build()
		if err := vk.Do(ctx, cmd).Error(); err != nil {
			log.Printf("agent: slack email cache set failed: %v", err)
		}
	}
	return email, nil
}

// slackAnsweredTTL bounds the answered marker: long enough to cover any
// plausible redelivery delay, finite so the keys don't pile up.
const slackAnsweredTTL = 2 * time.Hour

func slackAnsweredKey(eventID string) string {
	return "slack:answered:" + eventID
}

// slackEventAnswered reports whether this event's reply already went out.
// On Valkey trouble it says no, re-answering beats silence.
func (c *Config) slackEventAnswered(ctx context.Context, eventID string) bool {
	deps := c.Deps
	vk := deps.VK
	if vk == nil || eventID == "" {
		return false
	}
	n, err := vk.Do(ctx, vk.B().Exists().Key(slackAnsweredKey(eventID)).Build()).AsInt64()
	return err == nil && n > 0
}

// markSlackEventAnswered records a delivered reply. The mark comes after
// delivery, not before: a crash in between means the redelivered event
// answers again, and a duplicate answer beats a lost one.
func (c *Config) markSlackEventAnswered(ctx context.Context, eventID string) {
	deps := c.Deps
	vk := deps.VK
	if vk == nil || eventID == "" {
		return
	}
	cmd := vk.B().Set().Key(slackAnsweredKey(eventID)).Value("1").
		ExSeconds(int64(slackAnsweredTTL.Seconds())).Build()
	if err := vk.Do(ctx, cmd).Error(); err != nil {
		log.Printf("agent: failed to mark slack event answered: %v", err)
	}
}

// getSlackIntegration returns the bot token, bot user id and active flag of a
// team's Slack connection, or an empty token when the team has none. An
// inactive integration still returns its token so the caller can post a notice
// that Slack is disabled. The bot user id lets the agent recognize its own
// messages when reading history.
func (c *Config) getSlackIntegration(ctx context.Context, teamID uuid.UUID) (token, botUserID string, active bool, err error) {
	deps := c.Deps
	stmt := sqlf.PostgreSQL.
		Select("bot_token, bot_user_id, is_active").
		From("team_slack").
		Where("team_id = ?", teamID)
	defer stmt.Close()

	err = deps.PgPool.
		QueryRow(ctx, stmt.String(), stmt.Args()...).
		Scan(&token, &botUserID, &active)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", false, nil
	}
	return token, botUserID, active, err
}

// slackApp is one of a team's apps, as app selection sees it.
type slackApp struct {
	id               uuid.UUID
	name             string
	uniqueIdentifier string
}

func (c *Config) getTeamApps(ctx context.Context, teamID uuid.UUID) ([]slackApp, error) {
	deps := c.Deps
	stmt := sqlf.PostgreSQL.
		Select("id, coalesce(app_name, ''), coalesce(unique_identifier, '')").
		From("apps").
		Where("team_id = ?", teamID).
		OrderBy("created_at")
	defer stmt.Close()

	rows, err := deps.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var apps []slackApp
	for rows.Next() {
		var app slackApp
		if err := rows.Scan(&app.id, &app.name, &app.uniqueIdentifier); err != nil {
			return nil, err
		}
		apps = append(apps, app)
	}
	return apps, rows.Err()
}

// internalBuildMarkers tag internal builds by unique-identifier suffix, so
// the production app wins when a team tracks both. Suffix only: ".test"
// must not catch a production id like com.testdrive.app.
var internalBuildMarkers = []string{".dev", ".debug", ".staging", ".qa", ".test", ".beta"}

// pickMeasureApp chooses which of a team's apps a question is about: an app
// named in the question wins, a lone app is it, and internal builds lose to
// the production one. When it can't choose, it returns a clarifying reply
// instead. Callers guarantee apps is non-empty; a team with no apps at all is
// answered with noAppsReply before app picking begins.
func pickMeasureApp(apps []slackApp, question string) (slackApp, string) {
	q := strings.ToLower(question)
	var named []slackApp
	for _, app := range apps {
		if questionNamesApp(q, app) {
			named = append(named, app)
		}
	}
	named = mostSpecificNames(named)
	if len(named) == 1 {
		return named[0], ""
	}
	if len(named) > 1 {
		return slackApp{}, clarifyApps(named)
	}

	if len(apps) == 1 {
		return apps[0], ""
	}

	var production []slackApp
	for _, app := range apps {
		uid := strings.ToLower(app.uniqueIdentifier)
		internal := false
		for _, marker := range internalBuildMarkers {
			if strings.HasSuffix(uid, marker) {
				internal = true
				break
			}
		}
		if !internal {
			production = append(production, app)
		}
	}
	if len(production) == 1 {
		return production[0], ""
	}

	return slackApp{}, clarifyApps(apps)
}

// resolveAppFromContext picks the app a mention is about when the mention text
// itself names none. It reads the surrounding discussion, the same recent
// channel or thread messages the bot summarizes for context, then resolves in
// two steps. First an exact match on the text, the way the mention itself is
// matched: a user may have answered an earlier clarification with "Wikipedia"
// or "org.wikipedia.android". If that is still ambiguous, an approximate match,
// where the small model maps a loose description like "prod android app" onto
// one of the team's apps. ok is false when the discussion can't be read or
// neither step settles on a single app, leaving the caller to ask which one.
// promptTokens and completionTokens are the model usage to meter once the
// chosen app's customer is known, and are zero when no model call was made.
func (c *Config) resolveAppFromContext(ctx context.Context, botToken, botUserID string, ev slack.AgentEvent, apps []slackApp) (app slackApp, usage chatUsage, ok bool) {
	// With fewer than two apps there is nothing to disambiguate: a lone app is
	// already chosen on the current message, and no apps has its own reply.
	if len(apps) < 2 {
		return slackApp{}, chatUsage{}, false
	}

	// The fetch and the possible approximation LLM call both cost time on the
	// clarify path, so group them under one span with a duration log.
	ctx, span := tracer.Start(ctx, "agent.slack_app_resolve")
	defer span.End()
	start := time.Now()
	outcome := "unclear"
	defer func() {
		span.SetAttributes(attribute.String("agent.outcome", outcome))
		log.Printf("agent: slack app resolve event=%s outcome=%s duration=%s",
			ev.EventID, outcome, time.Since(start).Round(time.Millisecond))
	}()

	msgs, err := c.fetchSlackContext(ctx, ev, botToken, "")
	if err != nil {
		outcome = "fetch_failed"
		span.SetStatus(codes.Error, err.Error())
		log.Printf("agent: slack context app scan failed event=%s: %v", ev.EventID, err)
		return slackApp{}, chatUsage{}, false
	}
	picked := selectContextMessages(msgs, botUserID, ev.EventTS, "", slackContextMessageLimit)
	if len(picked) == 0 {
		outcome = "no_messages"
		return slackApp{}, chatUsage{}, false
	}

	// Exact: the discussion may name an app outright. pickMeasureApp's "single
	// app" and "sole production app" fallbacks already failed on the current
	// message, so over this text it can succeed only by finding a name.
	var b strings.Builder
	for _, m := range picked {
		b.WriteString(slackUnescaper.Replace(m.Text))
		b.WriteByte(' ')
	}
	if exact, clarify := pickMeasureApp(apps, b.String()); clarify == "" {
		outcome = "exact"
		return exact, chatUsage{}, true
	}

	// Approximate: let the small model read the discussion and choose.
	app, usage, ok = c.approximateAppFromMessages(ctx, picked, apps)
	if ok {
		outcome = "approximated"
	}
	return app, usage, ok
}

// appResolutionPrompt steers the small model to map a Slack discussion onto one
// of a team's apps when none was named outright.
const appResolutionPrompt = `You match a Slack discussion to one app from a list. People are asking a telemetry agent about one of their apps but may describe it loosely, like "the android app", "our prod build", or "the iOS one". Each app is listed as "<number>. <name> (<unique identifier>)". The unique identifier often signals the platform (for example .android or .ios) and whether a build is internal (.dev, .debug, .staging, .qa, .test, .beta) rather than production. Decide which single app the discussion is about and reply with only that app's number. If it does not point clearly to one app, reply with only 0.`

// approximateAppFromMessages asks the small model which app a discussion is
// about when nothing named one outright. It returns the chosen app with ok true
// only on a confident single pick, along with the call's token usage to meter.
func (c *Config) approximateAppFromMessages(ctx context.Context, msgs []slack.Message, apps []slackApp) (app slackApp, usage chatUsage, ok bool) {
	var list strings.Builder
	for i, app := range apps {
		label := app.name
		if app.uniqueIdentifier != "" {
			label = fmt.Sprintf("%s (%s)", app.name, app.uniqueIdentifier)
		}
		fmt.Fprintf(&list, "%d. %s\n", i+1, label)
	}
	prompt := fmt.Sprintf("Apps:\n%sDiscussion:\n%s", list.String(), renderSlackContext(msgs))

	resp, err := c.chat(ctx, c.ModelSmall, []chatMessage{
		{Role: "system", Content: appResolutionPrompt},
		{Role: "user", Content: prompt},
	}, nil, "")
	if err != nil {
		log.Printf("agent: slack app approximation failed: %v", err)
		return slackApp{}, chatUsage{}, false
	}
	if len(resp.Choices) == 0 {
		return slackApp{}, resp.Usage, false
	}
	idx := parseAppChoice(resp.Choices[0].Message.Content, len(apps))
	if idx < 0 {
		return slackApp{}, resp.Usage, false
	}
	return apps[idx], resp.Usage, true
}

// appChoiceDigits grabs the first run of digits in the model's reply.
var appChoiceDigits = regexp.MustCompile(`\d+`)

// parseAppChoice reads the app-resolution reply: the 1-based number of the
// chosen app, or 0 (or anything without a usable number) for "no clear pick".
// It returns a 0-based index, or -1 when unclear. Scanning for the first run of
// digits tolerates a stray word around the number.
func parseAppChoice(reply string, n int) int {
	digits := appChoiceDigits.FindString(reply)
	if digits == "" {
		return -1
	}
	num, err := strconv.Atoi(digits)
	if err != nil || num < 1 || num > n {
		return -1
	}
	return num - 1
}

// questionNamesApp reports whether the lowercased question mentions the app
// by name or unique identifier. Names match on word boundaries (an app
// called "Ace" is not named by the word "trace"), and names under three
// characters never match; they would catch ordinary words constantly.
func questionNamesApp(q string, app slackApp) bool {
	name := strings.ToLower(app.name)
	if len(name) >= 3 && containsWord(q, name) {
		return true
	}
	uid := strings.ToLower(app.uniqueIdentifier)
	return uid != "" && strings.Contains(q, uid)
}

// containsWord reports whether sub occurs in s with no letter or digit
// directly before or after it.
func containsWord(s, sub string) bool {
	for start := 0; ; start++ {
		i := strings.Index(s[start:], sub)
		if i < 0 {
			return false
		}
		start += i
		before, _ := utf8.DecodeLastRuneInString(s[:start])
		after, _ := utf8.DecodeRuneInString(s[start+len(sub):])
		if !isWordRune(before) && !isWordRune(after) {
			return true
		}
	}
}

// isWordRune treats utf8.RuneError (returned at the edges of the string) as
// a non-word rune, so matches at the start or end of the text count.
func isWordRune(r rune) bool {
	return unicode.IsLetter(r) || unicode.IsDigit(r)
}

// mostSpecificNames removes matches whose name sits inside another match's
// name: a question naming "Measure Pro" unavoidably also matches "Measure",
// and the longer, more specific name is the one the question meant.
func mostSpecificNames(matches []slackApp) []slackApp {
	var kept []slackApp
	for _, m := range matches {
		insideAnother := false
		for _, other := range matches {
			if m.id != other.id && len(m.name) < len(other.name) &&
				strings.Contains(strings.ToLower(other.name), strings.ToLower(m.name)) {
				insideAnother = true
				break
			}
		}
		if !insideAnother {
			kept = append(kept, m)
		}
	}
	return kept
}

// clarifyLeads open the reply a mention gets when the team has apps but the
// message does not pin down a single one. Each introduces what the bot does,
// helping you debug an app using its telemetry, and ends by asking which app;
// one is picked at random so repeats in a busy channel stay fresh. The leads
// stay neutral on purpose: a mention can be a greeting, a real question, or
// something off-topic like "who is the president of Rwanda?", so none of them
// presume the message was a request the bot agreed to. The matching app list
// is appended below the chosen lead.
var clarifyLeads = []string{
	"Hi! I can help you debug your app's crashes, errors, sessions and more. Which app would you like to look at?",
	"Hey there! I can dig into your app's health with you. Which app should I focus on?",
	"Hello! I can tell you how your apps are doing, from crashes to slow sessions. Which one are you curious about?",
	"Hi! I'm here to help you debug your app. Which app would you like to talk about?",
	"Hey! I can look into crashes, errors, sessions and other telemetry for your apps. Which app do you have in mind?",
	"I'm the Measure bot, here to help you debug your apps. Which app should I look at?",
	"Hi there! I can pull up crashes, errors, sessions and trends for your apps. Which one would you like to explore?",
	"Hello! Tell me what you're debugging and I'll dig in. First, which app are we talking about?",
	"Hey! I'm here to help with your app telemetry. Which of your apps would you like to look into?",
	"Hi! I can help you debug crashes, errors, slow sessions and more across your apps. Which app should I start with?",
	"Hey! I cover crashes, errors, sessions and other telemetry for your apps. Which app do you want to know about?",
	"Hey there! Tell me what you'd like to know about your app's health. Which app would you like to ask about?",
	"Hello! I can surface crashes, slow sessions and other signals from your apps. Which one would you like to check?",
	"Hi! I'm your Measure helper for debugging your apps. Which app should I dig into?",
	"Hey! I can walk through crashes, errors and session trends with you. Which app would you like to look at?",
	"Hello! I can dig into how your apps are doing. Which app are you interested in?",
	"Hi there! I can help you understand your app's crashes, errors and sessions. Which app should I focus on?",
	"Hello! Point me at an issue and I'll take a look. Which app do you want to investigate?",
	"Hey! I can report on errors, crashes, sessions and more for your apps. Which one would you like to explore?",
	"Hi! I can look into your app's health with you. Which app should I check?",
	"Hi there! I help you debug your apps. Which app would you like to talk about?",
	"Hey! I can pull crashes, errors and session data for any of your apps. Which one are you curious about?",
	"Hello! I'm here to help you debug, big issues or small. Which app should I look at?",
	"Hi! I can help you keep an eye on crashes, errors and sessions. Which app would you like to start with?",
	"Hey there! Tell me what's on your mind about your app's health. Which app are you asking about?",
}

// noAppsLeads open the reply a mention gets when the team has no apps in
// Measure at all. Like clarifyLeads they stay neutral so any mention, greeting
// or off-topic, reads correctly, but instead of asking which app they point at
// the dashboard to set one up; one is picked at random. No app list follows.
// Each lead carries exactly one %s slot where noAppsReply splices the word
// "dashboard", linked to the team's apps page.
var noAppsLeads = []string{
	"Hi! I can help you debug your app's crashes, errors and sessions. Your team doesn't have any apps in Measure yet, so set one up in the %s and I'll be ready to help.",
	"Hey there! I'm the Measure bot, here to help you debug your app's crashes, errors and slow sessions. There are no apps set up for your team yet. Add one in the %s and mention me again.",
	"Hello! I help you dig into how your apps are doing. It looks like your team hasn't set up an app in Measure yet. Create one in the %s and I can take it from there.",
	"Hi there! I help you debug your app, from crashes to slow sessions. Your team has no apps in Measure so far. Set one up in the %s whenever you're ready.",
	"Hey! I'm your Measure helper for app telemetry. There aren't any apps under your team yet, so head to the %s to add one and I'll be glad to dig in.",
	"Hi! I can look into errors, crashes and sessions for your apps. Your team doesn't have any apps in Measure yet. Set one up in the %s and mention me again.",
	"Hello! I'm here to help you debug your app. It seems your team hasn't added an app to Measure yet. Create one in the %s and I'll be ready.",
	"Hey there! I can tell you how your apps are doing once they're in Measure. Your team has no apps set up yet, so add one in the %s to get started.",
	"Hi! I can help you debug app crashes, errors and sessions. There are no apps under your team in Measure yet. Set one up in the %s and I'll dig in.",
	"Hello! I'm the Measure bot for debugging your apps. Your team hasn't set up an app yet. Add one in the %s and I can start helping.",
	"Hey! I can help you keep an eye on crashes, errors and session trends. Your team doesn't have any apps in Measure yet, so set one up in the %s first.",
	"Hi there! I cover crashes, errors and sessions for your apps. It looks like there are no apps set up for your team yet. Create one in the %s and mention me again.",
	"Hello! I'm here to help with your app's health. Your team has no apps in Measure at the moment. Set one up in the %s and I'll be ready to dig in.",
	"Hey there! I help you debug your apps. There aren't any apps under your team yet, so add one in the %s to begin.",
	"Hi! I can dig into crashes, errors and sessions for your apps. Your team hasn't set up an app in Measure yet. Create one in the %s whenever you're ready.",
}

// noAppsReply picks a no-apps lead and fills its slot with dashboard, the
// word "dashboard" linked to the team's apps page (dashboardLink), where an
// app can be created.
func noAppsReply(dashboard string) string {
	return fmt.Sprintf(noAppsLeads[rand.IntN(len(noAppsLeads))], dashboard)
}

// clarifyApps asks which app the question meant, opening with a random
// friendly lead so a greeting or vague mention gets a welcoming reply rather
// than a blunt prompt. Each app is listed with its unique identifier, since
// teams often name the iOS and Android builds identically, and the identifier
// is then the only usable handle.
func clarifyApps(apps []slackApp) string {
	var b strings.Builder
	b.WriteString(clarifyLeads[rand.IntN(len(clarifyLeads))])
	for _, app := range apps {
		name := app.name
		if app.uniqueIdentifier != "" {
			name = fmt.Sprintf("%s (%s)", app.name, app.uniqueIdentifier)
		}
		b.WriteString("\n• ")
		b.WriteString(name)
	}
	return b.String()
}

// slackMentionRE matches user mentions like <@U12345> in message text.
var slackMentionRE = regexp.MustCompile(`<@[^>]+>`)

// slackUnescaper undoes the HTML escaping Slack applies to message text on
// the way in. Without it an app named "Food & Drink" never matches the
// question text, and the model reads "&gt;" where the user typed ">".
var slackUnescaper = strings.NewReplacer("&lt;", "<", "&gt;", ">", "&amp;", "&")

// slackEscaper escapes the three characters Slack parses as markup. Replies
// pass through it so text the model echoes (a "<!channel>" planted in the
// question, a literal "<30s") renders as text instead of executing with
// the bot's authority or breaking the message.
var slackEscaper = strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;")

var (
	mdHeading = regexp.MustCompile(`(?m)^#{1,6}\s+(.+)$`)
	mdBold    = regexp.MustCompile(`\*\*(.+?)\*\*`)
	mdLink    = regexp.MustCompile(`\[([^\]]+)\]\(([^)\s]+)\)`)

	// For stripping inline markup from cells rendered inside a code fence, where
	// Slack shows the markers as literal punctuation instead of formatting.
	mdBoldUnderscore = regexp.MustCompile(`__(.+?)__`)
	mdInlineCode     = regexp.MustCompile("`([^`]+)`")
)

// stripCellMarkup removes the inline markdown a Slack code fence would render as
// stray punctuation rather than formatting: bold, inline code, and link markers
// mean nothing inside a fence, so drop them, keeping a link's text. Single
// asterisks and underscores are left alone; they are too often real content.
func stripCellMarkup(s string) string {
	s = mdLink.ReplaceAllString(s, "$1")
	s = mdBold.ReplaceAllString(s, "$1")
	s = mdBoldUnderscore.ReplaceAllString(s, "$1")
	s = mdInlineCode.ReplaceAllString(s, "$1")
	return s
}

// toMrkdwn converts the markdown the model writes into Slack mrkdwn: markup
// characters are neutralized, double bold markers collapse to single, links
// become <url|text>, headings become bold lines. Tables, which Slack cannot
// render, are handled by width: a narrow one is pulled out and rewritten as
// column-aligned text in a code block (protected from the prose rewrites, then
// escaped on its own when spliced back), while a wide one, which would wrap in a
// code block and lose its alignment, is rewritten inline as a stack of labeled
// records that flow and wrap like ordinary prose. Escaping the prose happens
// first, so the angle brackets the link rewrite emits survive it.
func toMrkdwn(text string) string {
	text, tables := extractTables(text)
	text = slackEscaper.Replace(text)
	text = mdHeading.ReplaceAllString(text, "*$1*")
	text = mdBold.ReplaceAllString(text, "*$1*")
	text = mdLink.ReplaceAllString(text, "<$2|$1>")
	for i, tbl := range tables {
		fenced := "```\n" + slackEscaper.Replace(tbl) + "\n```"
		text = strings.Replace(text, tablePlaceholder(i), fenced, 1)
	}
	return text
}

// tablePlaceholder is the stand-in left where a table was pulled out. The NUL
// bytes cannot occur in model output and survive every prose rewrite untouched.
func tablePlaceholder(i int) string {
	return "\x00msrtbl" + strconv.Itoa(i) + "\x00"
}

// slackTableMaxWidth is the widest a monospace table may be before Slack, which
// does not scroll code blocks horizontally, wraps its lines and breaks the
// alignment. It is a heuristic tuned for a desktop code block; anything wider is
// stacked into labeled records instead, which wrap as prose without misaligning.
const slackTableMaxWidth = 72

// extractTables rewrites each GitHub-flavored markdown table (a header row, a
// dashes separator, then data rows). A table that fits slackTableMaxWidth is
// replaced with a placeholder and its column-aligned grid returned for splicing
// back inside a code block; a wider one is rewritten inline as stacked records
// that ride through the prose rewrites. The returned slice holds the grids in
// placeholder order.
func extractTables(text string) (string, []string) {
	lines := strings.Split(text, "\n")
	out := make([]string, 0, len(lines))
	var blocks []string
	for i := 0; i < len(lines); {
		if i+1 < len(lines) && strings.Contains(lines[i], "|") && isTableSeparator(lines[i+1]) {
			header := lines[i]
			j := i + 2
			var body []string
			for j < len(lines) && strings.Contains(lines[j], "|") && strings.TrimSpace(lines[j]) != "" {
				body = append(body, lines[j])
				j++
			}
			if grid, width := renderTable(header, body); width <= slackTableMaxWidth {
				out = append(out, tablePlaceholder(len(blocks)))
				blocks = append(blocks, grid)
			} else {
				out = append(out, stackTable(header, body))
			}
			i = j
			continue
		}
		out = append(out, lines[i])
		i++
	}
	return strings.Join(out, "\n"), blocks
}

// stackTable rewrites a wide table as one labeled record per data row: the first
// column becomes a bold title, the rest become "Header: value" lines. This is
// markdown left in the prose stream on purpose, so the later rewrites turn the
// title bold and process any markup in the values, and it wraps cleanly at any
// width where a grid would not. Empty cells are dropped.
func stackTable(header string, body []string) string {
	headers := splitTableRow(header)
	records := make([]string, 0, len(body))
	for _, line := range body {
		cells := splitTableRow(line)
		var recLines []string
		if len(cells) > 0 && cells[0] != "" {
			recLines = append(recLines, "**"+cells[0]+"**")
		}
		for c := 1; c < len(cells); c++ {
			val := cells[c]
			if val == "" {
				continue
			}
			if c < len(headers) && headers[c] != "" {
				recLines = append(recLines, headers[c]+": "+val)
			} else {
				recLines = append(recLines, val)
			}
		}
		if len(recLines) > 0 {
			records = append(records, strings.Join(recLines, "\n"))
		}
	}
	return strings.Join(records, "\n\n")
}

// splitTableRow splits a markdown table row into trimmed cells, dropping the
// empty segments produced by the optional outer pipes.
func splitTableRow(line string) []string {
	line = strings.TrimSpace(line)
	line = strings.TrimPrefix(line, "|")
	line = strings.TrimSuffix(line, "|")
	cells := strings.Split(line, "|")
	for i := range cells {
		cells[i] = strings.TrimSpace(cells[i])
	}
	return cells
}

// isTableSeparator reports whether a line is a table's header underline, made
// only of dashes and optional alignment colons, e.g. |------|:---:|.
func isTableSeparator(line string) bool {
	if !strings.Contains(line, "-") {
		return false
	}
	for _, c := range splitTableRow(line) {
		if c == "" || !strings.Contains(c, "-") || strings.Trim(c, ":-") != "" {
			return false
		}
	}
	return true
}

// renderTable lays a markdown table out as column-aligned monospace text (no
// fence; the caller adds one) and returns it with its widest line's width, so
// the caller can fall back to stacked records when a grid would be too wide for
// Slack. Widths are measured on the raw cells so the alignment is right once
// Slack renders the escaped content back.
func renderTable(header string, body []string) (string, int) {
	rows := [][]string{splitTableRow(header)}
	for _, line := range body {
		rows = append(rows, splitTableRow(line))
	}
	// Inside the code fence Slack renders text literally, so clear any inline
	// markdown the model put in the cells (for example **bold**) that would
	// otherwise show as stray asterisks or backticks.
	for _, r := range rows {
		for c := range r {
			r[c] = stripCellMarkup(r[c])
		}
	}

	cols := 0
	for _, r := range rows {
		cols = max(cols, len(r))
	}
	widths := make([]int, cols)
	for _, r := range rows {
		for c, cell := range r {
			widths[c] = max(widths[c], utf8.RuneCountInString(cell))
		}
	}
	// The separator spans every column plus the two-space gaps, so it is the
	// widest line; that sum is the table's rendered width.
	width := 0
	for _, w := range widths {
		width += w
	}
	if cols > 1 {
		width += 2 * (cols - 1)
	}

	cellAt := func(r []string, c int) string {
		if c < len(r) {
			return r[c]
		}
		return ""
	}
	var b strings.Builder
	writeRow := func(r []string) {
		for c := range cols {
			if c > 0 {
				b.WriteString("  ")
			}
			s := cellAt(r, c)
			b.WriteString(s)
			if c < cols-1 {
				b.WriteString(strings.Repeat(" ", widths[c]-utf8.RuneCountInString(s)))
			}
		}
		b.WriteByte('\n')
	}

	writeRow(rows[0])
	for c := range cols {
		if c > 0 {
			b.WriteString("  ")
		}
		b.WriteString(strings.Repeat("-", widths[c]))
	}
	b.WriteByte('\n')
	for _, r := range rows[1:] {
		writeRow(r)
	}
	return strings.TrimRight(b.String(), "\n"), width
}

// slackAcks are the instant "working on it" placeholders a mention gets
// while the real answer is computed; one is picked at random.
var slackAcks = []string{
	"Checking…",
	"Investigating…",
	"Researching…",
	"Spelunking…",
	"Analyzing…",
	"Exploring…",
	"Perusing…",
	"Delving…",
	"Inquiring…",
	"Probing…",
	"Scanning…",
	"Studying…",
	"Sifting…",
	"Inspecting…",
	"Surveying…",
	"Dissecting…",
	"Fetching…",
	"Grokking…",
	"Querying…",
	"Auditing…",
	"Scrutinizing…",
	"Computing…",
	"Assessing…",
	"Sleuthing…",
	"Digging…",
}

func randomAck() string {
	return slackAcks[rand.IntN(len(slackAcks))]
}

// slackContextMessageLimit caps how many recent Slack messages the agent folds
// into a conversation as context on a mention: the last N for a fresh thread
// or channel, or the messages since the last mention for a thread it is
// already in.
const slackContextMessageLimit = 25

// slackThreadScanLimit is how many of a thread's most recent messages are
// pulled (paginating to reach them) before trimming to the most recent
// slackContextMessageLimit. The headroom over that limit absorbs the bot's own
// posts and other messages dropped during selection.
const slackThreadScanLimit = 200

// slackContextPrefix marks a stored summary of Slack discussion so the model
// reads it as background rather than the user's own words.
const slackContextPrefix = "Background from the Slack conversation (summarized). Use it only if it helps answer the question:\n"

// slackContextSummaryPrompt steers the small model that condenses Slack
// discussion into one context note.
const slackContextSummaryPrompt = `You are summarizing recent Slack messages so a telemetry query agent has context for a question it was just asked. Write a brief, factual summary of what was discussed, keeping concrete details: app names, versions, error messages, numbers and time ranges, and what people are trying to find out. No preamble or commentary. If nothing in the messages is relevant to app telemetry, reply with one short line saying so.`

// ingestSlackContext folds the Slack discussion around a mention into the
// conversation. A fresh thread or channel contributes its recent messages, a
// thread the bot is already in only what was said since its last mention; the
// messages are summarized into one stored context message and the high-water
// mark advances. Best-effort: on any failure the marker stays put so the next
// mention retries, and the turn runs without the extra context.
func (c *Config) ingestSlackContext(ctx context.Context, conv *conversation, ev slack.AgentEvent, botToken, botUserID, customerID string) {
	ctx, span := tracer.Start(ctx, "agent.slack_context")
	defer span.End()

	// The Slack fetch and the summarization LLM call both sit on the answer's
	// critical path (behind the ack), so record how long the whole ingest took
	// and how many messages it summarized, for when a trace view isn't at hand.
	start := time.Now()
	outcome := "no_new_messages"
	pickedCount := 0
	defer func() {
		span.SetAttributes(
			attribute.String("agent.outcome", outcome),
			attribute.Int("slack.context_messages", pickedCount),
		)
		log.Printf("agent: slack context event=%s outcome=%s messages=%d duration=%s",
			ev.EventID, outcome, pickedCount, time.Since(start).Round(time.Millisecond))
	}()

	msgs, err := c.fetchSlackContext(ctx, ev, botToken, conv.SlackContextThroughTS)
	if err != nil {
		outcome = "fetch_failed"
		span.SetStatus(codes.Error, err.Error())
		log.Printf("agent: slack context fetch failed event=%s: %v", ev.EventID, err)
		return
	}

	picked := selectContextMessages(msgs, botUserID, ev.EventTS, conv.SlackContextThroughTS, slackContextMessageLimit)
	pickedCount = len(picked)
	if len(picked) > 0 {
		summary, model, usage, err := c.summarizeSlackContext(ctx, picked)
		if err != nil {
			outcome = "summary_failed"
			span.SetStatus(codes.Error, err.Error())
			log.Printf("agent: slack context summary failed event=%s: %v", ev.EventID, err)
			return
		}
		// Meter the summarization. trackAgentTokens no-ops on zero.
		trackAgentTokens(c.Deps, customerID, model, callUsage(usage))
		if summary != "" {
			stored := storedMessage{
				msg:   chatMessage{Role: "system", Content: slackContextPrefix + summary},
				model: model,
				usage: usage,
			}
			if err := c.appendMessages(ctx, conv.ID, []storedMessage{stored}); err != nil {
				outcome = "store_failed"
				log.Printf("agent: failed to store slack context event=%s: %v", ev.EventID, err)
				return
			}
			outcome = "stored"
		} else {
			outcome = "summary_empty"
		}
	}

	// Nothing failed, so advance the marker past this mention; the next one
	// starts after it.
	if err := c.setSlackContextThrough(ctx, conv.ID, ev.EventTS); err != nil {
		log.Printf("agent: failed to advance slack context marker event=%s: %v", ev.EventID, err)
	}
}

// fetchSlackContext reads the recent Slack messages around a mention: a
// top-level mention pulls the channel's recent history, a threaded mention the
// thread replies after the given high-water mark (empty for all recent ones).
// Both app resolution and context summarization read the same window this way.
func (c *Config) fetchSlackContext(ctx context.Context, ev slack.AgentEvent, botToken, through string) ([]slack.Message, error) {
	// A top-level mention roots its own thread, so thread_ts equals the
	// message ts; anything else sits inside an existing thread.
	if ev.ThreadTS == ev.EventTS {
		return slack.ConversationHistory(ctx, botToken, ev.Channel, slackContextMessageLimit)
	}
	return slack.ConversationReplies(ctx, botToken, ev.Channel, ev.ThreadTS, through, slackThreadScanLimit)
}

// selectContextMessages narrows fetched messages to the ones worth
// summarizing: it drops the agent's own posts (already in the transcript), the
// triggering mention, system subtypes and empty messages, and anything at or
// before the high-water mark. The rest are returned oldest first, capped to
// the most recent limit.
func selectContextMessages(msgs []slack.Message, botUserID, mentionTS, through string, limit int) []slack.Message {
	var kept []slack.Message
	for _, m := range msgs {
		if m.TS == mentionTS {
			continue
		}
		if through != "" && m.TS <= through {
			continue
		}
		if botUserID != "" && m.User == botUserID {
			continue
		}
		if m.Subtype != "" && m.Subtype != "file_share" {
			continue
		}
		if strings.TrimSpace(m.Text) == "" {
			continue
		}
		kept = append(kept, m)
	}
	// Sort by the raw ts string instead of parsing each one to a number. A
	// Slack ts is "<seconds>.<fraction>" like "1718000000.000100", and Unix
	// seconds are 10 digits for every date from 2001 to 2286, so all
	// timestamps have the same digit width. That equal width is the key: as
	// strings "9" sorts after "10" because the first character decides it, but
	// at equal width ("09" vs "10") string order matches numeric order. So
	// comparing these fixed-width strings orders the messages chronologically.
	sort.Slice(kept, func(i, j int) bool { return kept[i].TS < kept[j].TS })
	if len(kept) > limit {
		kept = kept[len(kept)-limit:]
	}
	return kept
}

// renderSlackContext flattens messages into a plain bullet list for the
// summarizer, unescaping Slack's entity encoding so the model reads what was
// typed.
func renderSlackContext(msgs []slack.Message) string {
	var b strings.Builder
	for _, m := range msgs {
		text := strings.TrimSpace(slackUnescaper.Replace(m.Text))
		if text == "" {
			continue
		}
		fmt.Fprintf(&b, "- %s\n", text)
	}
	return b.String()
}

// summarizeSlackContext condenses the picked messages into one short note with
// the small model, returning the summary plus the call's model and token usage
// for the stored record.
func (c *Config) summarizeSlackContext(ctx context.Context, msgs []slack.Message) (summary, model string, usage chatUsage, err error) {
	rendered := renderSlackContext(msgs)
	if strings.TrimSpace(rendered) == "" {
		return "", "", chatUsage{}, nil
	}
	resp, err := c.chat(ctx, c.ModelSmall, []chatMessage{
		{Role: "system", Content: slackContextSummaryPrompt},
		{Role: "user", Content: rendered},
	}, nil, "")
	if err != nil {
		return "", "", chatUsage{}, err
	}
	if len(resp.Choices) == 0 {
		return "", "", chatUsage{}, nil
	}
	return strings.TrimSpace(resp.Choices[0].Message.Content), c.ModelSmall, resp.Usage, nil
}
