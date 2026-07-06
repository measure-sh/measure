package agent

import (
	"context"
	"strings"
	"testing"

	"backend/agent/server"
	"backend/libs/slack"

	"github.com/google/uuid"
)

func slackTestApps(names ...[2]string) []measureApp {
	apps := make([]measureApp, 0, len(names))
	for _, n := range names {
		apps = append(apps, measureApp{id: uuid.New(), name: n[0], uniqueIdentifier: n[1]})
	}
	return apps
}

func TestPickMeasureApp(t *testing.T) {
	t.Run("single app wins by default", func(t *testing.T) {
		apps := slackTestApps([2]string{"Wikipedia", "org.wikipedia"})
		app, clarify := pickMeasureApp(apps, "any crashes?")
		if clarify != "" || app.id != apps[0].id {
			t.Fatalf("expected the only app, got clarify=%q", clarify)
		}
	})

	t.Run("named app wins over everything", func(t *testing.T) {
		apps := slackTestApps(
			[2]string{"Wikipedia", "org.wikipedia"},
			[2]string{"Commons", "org.wikimedia.commons"},
		)
		app, clarify := pickMeasureApp(apps, "how is Commons doing today?")
		if clarify != "" || app.name != "Commons" {
			t.Fatalf("expected Commons, got %q clarify=%q", app.name, clarify)
		}
	})

	t.Run("unique identifier in question counts as naming", func(t *testing.T) {
		apps := slackTestApps(
			[2]string{"Wikipedia", "org.wikipedia"},
			[2]string{"Commons", "org.wikimedia.commons"},
		)
		app, clarify := pickMeasureApp(apps, "crashes in org.wikimedia.commons?")
		if clarify != "" || app.name != "Commons" {
			t.Fatalf("expected Commons, got %q clarify=%q", app.name, clarify)
		}
	})

	t.Run("longer name shadows its substring", func(t *testing.T) {
		apps := slackTestApps(
			[2]string{"Measure", "sh.measure"},
			[2]string{"Measure Pro", "sh.measure.pro"},
		)
		app, clarify := pickMeasureApp(apps, "is Measure Pro healthy?")
		if clarify != "" || app.name != "Measure Pro" {
			t.Fatalf("expected Measure Pro, got %q clarify=%q", app.name, clarify)
		}
	})

	t.Run("production app beats internal builds", func(t *testing.T) {
		apps := slackTestApps(
			[2]string{"Wikipedia", "org.wikipedia"},
			[2]string{"Wikipedia Dev", "org.wikipedia.dev"},
			[2]string{"Wikipedia Beta", "org.wikipedia.beta"},
		)
		app, clarify := pickMeasureApp(apps, "any new ANRs?")
		if clarify != "" || app.uniqueIdentifier != "org.wikipedia" {
			t.Fatalf("expected the production app, got %q clarify=%q", app.uniqueIdentifier, clarify)
		}
	})

	t.Run("several production apps ask back", func(t *testing.T) {
		apps := slackTestApps(
			[2]string{"Wikipedia", "org.wikipedia"},
			[2]string{"Commons", "org.wikimedia.commons"},
		)
		_, clarify := pickMeasureApp(apps, "any new ANRs?")
		if clarify == "" {
			t.Fatal("expected a clarifying reply when no rule decides")
		}
		if !strings.Contains(clarify, "Wikipedia") || !strings.Contains(clarify, "Commons") {
			t.Fatalf("clarifying reply should list the apps, got %q", clarify)
		}
	})

	t.Run("short names do not match by accident", func(t *testing.T) {
		// "an" appears inside "any", so two-letter names must not name-match.
		apps := slackTestApps(
			[2]string{"an", "org.example.an"},
			[2]string{"Wikipedia", "org.wikipedia"},
		)
		_, clarify := pickMeasureApp(apps, "any new crashes?")
		if clarify == "" {
			t.Fatal("expected a clarifying reply, not a short-name match")
		}
	})

	t.Run("names match whole words only", func(t *testing.T) {
		// "ace" sits inside "trace", but that is not naming the Ace app.
		apps := slackTestApps(
			[2]string{"Ace", "com.example.ace"},
			[2]string{"Wikipedia", "org.wikipedia"},
		)
		_, clarify := pickMeasureApp(apps, "show the worst stack trace today")
		if clarify == "" {
			t.Fatal("expected a clarifying reply, not a substring match inside a word")
		}
		app, clarify := pickMeasureApp(apps, "how is Ace doing today?")
		if clarify != "" || app.name != "Ace" {
			t.Fatalf("expected Ace for a whole-word mention, got %q clarify=%q", app.name, clarify)
		}
	})

	t.Run("internal markers only match as suffixes", func(t *testing.T) {
		// ".test" inside com.testdrive.app does not make it an internal build.
		apps := slackTestApps(
			[2]string{"Testdrive", "com.testdrive.app"},
			[2]string{"Testdrive Dev", "com.testdrive.app.dev"},
		)
		app, clarify := pickMeasureApp(apps, "any new crashes?")
		if clarify != "" || app.uniqueIdentifier != "com.testdrive.app" {
			t.Fatalf("expected the production app, got %q clarify=%q", app.uniqueIdentifier, clarify)
		}
	})

	t.Run("clarifying reply includes unique identifiers", func(t *testing.T) {
		// Same-named iOS and Android apps are only tellable apart by id.
		apps := slackTestApps(
			[2]string{"Wikipedia", "org.wikipedia.ios"},
			[2]string{"Wikipedia", "org.wikipedia.android"},
		)
		_, clarify := pickMeasureApp(apps, "any new crashes?")
		if clarify == "" {
			t.Fatal("expected a clarifying reply for same-named apps")
		}
		if !strings.Contains(clarify, "org.wikipedia.ios") || !strings.Contains(clarify, "org.wikipedia.android") {
			t.Fatalf("clarifying reply should list unique identifiers, got %q", clarify)
		}
	})
}

func TestClarifyLeads(t *testing.T) {
	// The leads are the friendly openers a vague mention gets; keep a healthy
	// spread so repeats in a busy channel stay fresh, and make sure each one
	// ends by asking which app, since the app list is appended right after it.
	if len(clarifyLeads) < 20 {
		t.Fatalf("expected around 25 clarify leads, got %d", len(clarifyLeads))
	}
	for i, lead := range clarifyLeads {
		if strings.TrimSpace(lead) == "" {
			t.Fatalf("clarify lead %d is empty", i)
		}
		if !strings.HasSuffix(lead, "?") {
			t.Fatalf("clarify lead %d should end by asking which app, got %q", i, lead)
		}
	}

	// clarifyApps opens with one of the leads and lists the apps below it.
	apps := slackTestApps(
		[2]string{"Wikipedia", "org.wikipedia"},
		[2]string{"Commons", "org.wikimedia.commons"},
	)
	reply := clarifyApps(apps)
	opensWithLead := false
	for _, lead := range clarifyLeads {
		if strings.HasPrefix(reply, lead) {
			opensWithLead = true
			break
		}
	}
	if !opensWithLead {
		t.Fatalf("clarifyApps should open with a known lead, got %q", reply)
	}
	if !strings.Contains(reply, "Wikipedia") || !strings.Contains(reply, "Commons") {
		t.Fatalf("clarifyApps should list the apps, got %q", reply)
	}
}

func TestNoAppsLeads(t *testing.T) {
	// The zero-apps leads greet a mention from a team with nothing set up.
	// They must point at the dashboard, the one action that unblocks the user,
	// and never ask which app, since there are none. Each lead carries exactly
	// one %s slot for the dashboard link and no stray %, so the Sprintf in
	// noAppsReply can't misfire.
	if len(noAppsLeads) < 10 {
		t.Fatalf("expected a healthy set of no-apps leads, got %d", len(noAppsLeads))
	}
	for i, lead := range noAppsLeads {
		if strings.TrimSpace(lead) == "" {
			t.Fatalf("no-apps lead %d is empty", i)
		}
		if strings.Count(lead, "%") != 1 || !strings.Contains(lead, "%s") {
			t.Fatalf("no-apps lead %d should carry exactly one dashboard %%s slot, got %q", i, lead)
		}
	}

	// A team with no apps gets one of these leads back with the dashboard
	// link spliced in.
	link := "[dashboard](https://app.example.com/9db1a316-6bb2-4bd7-9088-8f5a97966373/apps)"
	reply := noAppsReply(link)
	if !strings.Contains(reply, link) {
		t.Fatalf("noAppsReply should splice the dashboard link, got %q", reply)
	}
	if strings.Contains(reply, "%") {
		t.Fatalf("noAppsReply left format residue, got %q", reply)
	}
}

func TestDashboardLink(t *testing.T) {
	teamID := uuid.MustParse("9db1a316-6bb2-4bd7-9088-8f5a97966373")

	c := &Config{Deps: &server.Deps{Config: &server.Config{SiteOrigin: "https://app.example.com"}}}
	want := "[dashboard](https://app.example.com/9db1a316-6bb2-4bd7-9088-8f5a97966373/team)"
	if got := c.dashboardLink(teamID, "team"); got != want {
		t.Errorf("dashboardLink = %q, want %q", got, want)
	}

	// A trailing slash on the configured origin must not double up.
	c = &Config{Deps: &server.Deps{Config: &server.Config{SiteOrigin: "https://app.example.com/"}}}
	if got := c.dashboardLink(teamID, "team"); got != want {
		t.Errorf("dashboardLink with trailing slash = %q, want %q", got, want)
	}

	// Without a site origin there is nothing to point at: degrade to the
	// plain word so replies still read correctly.
	c = &Config{Deps: &server.Deps{Config: &server.Config{}}}
	if got := c.dashboardLink(teamID, "team"); got != "dashboard" {
		t.Errorf("dashboardLink without origin = %q, want plain word", got)
	}

	// The link must survive the Slack conversion as a clickable mrkdwn link.
	c = &Config{Deps: &server.Deps{Config: &server.Config{SiteOrigin: "https://app.example.com"}}}
	got := toMrkdwn(noAppsReply(c.dashboardLink(teamID, "apps")))
	wantLink := "<https://app.example.com/9db1a316-6bb2-4bd7-9088-8f5a97966373/apps|dashboard>"
	if !strings.Contains(got, wantLink) {
		t.Errorf("slack reply should carry the mrkdwn link %q, got %q", wantLink, got)
	}
}

func TestParseAppChoice(t *testing.T) {
	cases := []struct {
		reply string
		n     int
		want  int
	}{
		{"2", 3, 1},                     // plain number, 1-based to 0-based
		{"  3 ", 3, 2},                  // surrounding whitespace
		{"1", 1, 0},                     // lone app
		{"0", 3, -1},                    // the model's "no clear pick"
		{"unclear", 3, -1},              // no number at all
		{"", 3, -1},                     // empty reply
		{"5", 3, -1},                    // out of range
		{"app number 2, I think", 3, 1}, // first integer wins
	}
	for _, tc := range cases {
		if got := parseAppChoice(tc.reply, tc.n); got != tc.want {
			t.Errorf("parseAppChoice(%q, %d) = %d, want %d", tc.reply, tc.n, got, tc.want)
		}
	}
}

func TestApproximateAppFromMessages(t *testing.T) {
	apps := slackTestApps(
		[2]string{"Wikipedia", "org.wikipedia.android"},
		[2]string{"Wikipedia", "org.wikipedia.ios"},
	)
	msgs := []slack.Message{
		{User: "U1", Text: "how many crashes today?", TS: "1"},
		{User: "U2", Text: "prod android app?", TS: "2"},
	}

	t.Run("confident pick maps to that app", func(t *testing.T) {
		c := chatTestConfig(t, 200, `{"choices":[{"message":{"content":"1"}}],"usage":{"prompt_tokens":12,"completion_tokens":1}}`)
		c.ModelSmall = "test-model"
		app, usage, ok := c.approximateAppFromMessages(context.Background(), "how many crashes today?", msgs, apps)
		if !ok || app.uniqueIdentifier != "org.wikipedia.android" {
			t.Fatalf("expected the android app, got ok=%v app=%q", ok, app.uniqueIdentifier)
		}
		if usage.PromptTokens != 12 || usage.CompletionTokens != 1 {
			t.Fatalf("expected prompt=12 completion=1, got prompt=%d completion=%d", usage.PromptTokens, usage.CompletionTokens)
		}
	})

	t.Run("zero means unclear but still reports tokens", func(t *testing.T) {
		c := chatTestConfig(t, 200, `{"choices":[{"message":{"content":"0"}}],"usage":{"prompt_tokens":12,"completion_tokens":1}}`)
		c.ModelSmall = "test-model"
		_, usage, ok := c.approximateAppFromMessages(context.Background(), "how many crashes today?", msgs, apps)
		if ok {
			t.Fatal("expected unclear, got a pick")
		}
		if usage.PromptTokens != 12 || usage.CompletionTokens != 1 {
			t.Fatalf("expected tokens still reported, got prompt=%d completion=%d", usage.PromptTokens, usage.CompletionTokens)
		}
	})
}

func TestSlackMentionStripping(t *testing.T) {
	got := strings.TrimSpace(slackMentionRE.ReplaceAllString("<@U0AGENT> what crashed <@U0FRIEND|nick> today?", ""))
	if got != "what crashed  today?" {
		t.Fatalf("got %q", got)
	}
}

func TestToMrkdwn(t *testing.T) {
	in := "## Crash summary\n**12 crashes** in the last 6 hours, see [the dashboard](https://example.com/crashes) for more."
	want := "*Crash summary*\n*12 crashes* in the last 6 hours, see <https://example.com/crashes|the dashboard> for more."
	if got := toMrkdwn(in); got != want {
		t.Fatalf("got:\n%s\nwant:\n%s", got, want)
	}

	t.Run("markup characters are neutralized", func(t *testing.T) {
		// An echoed "<!channel>" must render as text, never ping anyone.
		in := "you asked me to repeat: <!channel> & sessions <30s"
		want := "you asked me to repeat: &lt;!channel&gt; &amp; sessions &lt;30s"
		if got := toMrkdwn(in); got != want {
			t.Fatalf("got %q want %q", got, want)
		}
	})

	t.Run("tables become aligned code blocks", func(t *testing.T) {
		in := "Here is the breakdown:\n" +
			"| Span | Duration |\n" +
			"|------|----------|\n" +
			"| root | 4,006 ms |\n" +
			"| http | 4,005 ms |\n" +
			"Done."
		got := toMrkdwn(in)
		if !strings.Contains(got, "```") {
			t.Fatalf("table was not wrapped in a code block:\n%s", got)
		}
		if strings.Contains(got, "|------") || strings.Contains(got, "| root |") {
			t.Fatalf("raw markdown table leaked:\n%s", got)
		}
		if !strings.Contains(got, "Span  Duration") {
			t.Fatalf("header columns not aligned:\n%s", got)
		}
		if !strings.Contains(got, "root  4,006 ms") {
			t.Fatalf("data row not aligned:\n%s", got)
		}
		if !strings.HasPrefix(got, "Here is the breakdown:") || !strings.HasSuffix(got, "Done.") {
			t.Fatalf("prose around the table was not preserved:\n%s", got)
		}
	})

	t.Run("table cells are escaped and stripped of markup", func(t *testing.T) {
		in := "| Metric | Value |\n|---|---|\n| slow | <30s & **rising** |"
		got := toMrkdwn(in)
		// Angle brackets and ampersands are escaped even inside the block.
		if !strings.Contains(got, "&lt;30s &amp;") {
			t.Fatalf("cell content not escaped:\n%s", got)
		}
		// Bold markers would show as literal asterisks in a code block, so they
		// are stripped, keeping the text.
		if strings.Contains(got, "**") {
			t.Fatalf("emphasis markers should be stripped inside the block:\n%s", got)
		}
		if !strings.Contains(got, "rising") {
			t.Fatalf("cell text was lost:\n%s", got)
		}
	})

	t.Run("wide tables stack into labeled records", func(t *testing.T) {
		in := "| Span | Duration | Details |\n" +
			"|------|----------|---------|\n" +
			"| root | 4,006 ms | The session-level parent that spans the whole trace and then some |\n" +
			"| http | 4,005 ms | An HTTP request that is virtually the entire root duration here |"
		got := toMrkdwn(in)
		// Too wide for a code block, so it must not be fenced.
		if strings.Contains(got, "```") {
			t.Fatalf("wide table should stack, not fence:\n%s", got)
		}
		// First column is a bold record title (Slack single-asterisk bold).
		if !strings.Contains(got, "*root*") || !strings.Contains(got, "*http*") {
			t.Fatalf("record titles not bold:\n%s", got)
		}
		// Remaining columns become labeled lines.
		if !strings.Contains(got, "Duration: 4,006 ms") || !strings.Contains(got, "Details: The session-level parent") {
			t.Fatalf("fields not labeled:\n%s", got)
		}
		// No raw table markup survives.
		if strings.Contains(got, "|") || strings.Contains(got, "---") {
			t.Fatalf("raw table markup leaked:\n%s", got)
		}
	})
}

func TestSlackUnescaper(t *testing.T) {
	// Slack escapes &, < and > in event text; matching and the model must
	// see what the user typed.
	in := "crash rate &gt; 2% in Food &amp; Drink?"
	want := "crash rate > 2% in Food & Drink?"
	if got := slackUnescaper.Replace(in); got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestRandomAck(t *testing.T) {
	for range 50 {
		if strings.TrimSpace(randomAck()) == "" {
			t.Fatal("acks must not be empty")
		}
	}
}

func TestSelectContextMessages(t *testing.T) {
	// Given out of order, with the bot's own answer, a system subtype, a blank
	// message and the triggering mention mixed in.
	msgs := []slack.Message{
		{TS: "1718000000.000003", User: "U_HUMAN", Text: "third"},
		{TS: "1718000000.000001", User: "U_HUMAN", Text: "first"},
		{TS: "1718000000.000002", User: "U_BOT", Text: "the agent's own answer"},
		{TS: "1718000000.000004", User: "U_HUMAN", Subtype: "channel_join", Text: "joined"},
		{TS: "1718000000.000005", User: "U_HUMAN", Text: "   "},
		{TS: "1718000000.000006", User: "U_HUMAN", Text: "the mention itself"},
	}

	got := selectContextMessages(msgs, "U_BOT", "1718000000.000006", "", 25)
	if len(got) != 2 {
		t.Fatalf("expected 2 kept (bot post, subtype, blank and the mention dropped), got %d: %+v", len(got), got)
	}
	if got[0].Text != "first" || got[1].Text != "third" {
		t.Fatalf("expected chronological order [first, third], got [%q, %q]", got[0].Text, got[1].Text)
	}

	t.Run("through drops already-seen messages", func(t *testing.T) {
		got := selectContextMessages(msgs, "U_BOT", "1718000000.000006", "1718000000.000001", 25)
		if len(got) != 1 || got[0].Text != "third" {
			t.Fatalf("expected only messages after the marker [third], got %+v", got)
		}
	})

	t.Run("limit keeps the most recent", func(t *testing.T) {
		many := []slack.Message{
			{TS: "1718000000.000001", User: "U_HUMAN", Text: "a"},
			{TS: "1718000000.000002", User: "U_HUMAN", Text: "b"},
			{TS: "1718000000.000003", User: "U_HUMAN", Text: "c"},
		}
		got := selectContextMessages(many, "U_BOT", "", "", 2)
		if len(got) != 2 || got[0].Text != "b" || got[1].Text != "c" {
			t.Fatalf("expected the most recent two [b, c], got %+v", got)
		}
	})

	t.Run("file_share counts as a real message", func(t *testing.T) {
		fs := []slack.Message{{TS: "1718000000.000001", User: "U_HUMAN", Subtype: "file_share", Text: "see this trace"}}
		if got := selectContextMessages(fs, "U_BOT", "", "", 25); len(got) != 1 {
			t.Fatalf("expected file_share kept, got %+v", got)
		}
	})
}

func TestRenderSlackContext(t *testing.T) {
	msgs := []slack.Message{
		{Text: "crash rate &gt; 2%?"},
		{Text: "   "},
		{Text: "in Food &amp; Drink"},
	}
	want := "- crash rate > 2%?\n- in Food & Drink\n"
	if got := renderSlackContext(msgs); got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}
