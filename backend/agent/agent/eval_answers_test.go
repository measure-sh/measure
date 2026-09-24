//go:build eval

package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"

	"backend/libs/slack"
	"backend/testinfra"

	"github.com/google/uuid"
)

func TestEvalAnswers(t *testing.T) {
	env := newEvalEnv(t, "LLM_AGENT_MODEL_MEDIUM")
	surfaces := envList("EVAL_SURFACES")
	if len(surfaces) == 0 {
		surfaces = []string{evalSurfaceMCP, evalSurfaceSlack}
	}
	for _, s := range surfaces {
		if s != evalSurfaceMCP && s != evalSurfaceSlack {
			t.Fatalf("EVAL_SURFACES has %q, want mcp or slack", s)
		}
	}

	ctx := context.Background()
	defer cleanupAll(ctx, t)
	w := seedEvalWorld(ctx, t)
	cases := evalCases(w)
	// Answers are also held to the system prompt's rule against showing
	// internals. Compaction summaries are not, since the compaction prompt
	// asks for app ids.
	for i := range cases {
		cases[i].checks = append([]evalCheck{hidesInternals()}, cases[i].checks...)
	}

	started := time.Now()
	results := env.collect(t, func(t *testing.T, record func(evalResult)) {
		for _, model := range env.models {
			c := env.config(model)
			// Every level is parallel: a subtest's t.Run waits for the whole
			// subtest to finish, so a sequential level would run its children
			// one group at a time.
			t.Run(strings.ReplaceAll(model, "/", "_"), func(t *testing.T) {
				t.Parallel()
				for _, ec := range cases {
					t.Run(ec.id, func(t *testing.T) {
						t.Parallel()
						for _, surface := range ec.surfaces(surfaces) {
							t.Run(surface, func(t *testing.T) {
								t.Parallel()
								for trial := range env.trials {
									t.Run(strconv.Itoa(trial+1), func(t *testing.T) {
										t.Parallel()
										r := runEvalCase(ctx, t, c, env.evalCostProxy, w, ec, surface)
										record(gradeEvalRun(t, model, ec, surface, trial, r))
									})
								}
							})
						}
					})
				}
			})
		}
	})
	env.report(t, "answers", started, surfaces, cases, results)
}

func runEvalCase(ctx context.Context, t *testing.T, c *Config, evalCostProxy *evalCostProxy, w evalWorld, ec evalCase, surface string) evalRun {
	t.Helper()
	entryPoint, appIDs := "mcp", ec.mcpApps
	if surface == evalSurfaceSlack {
		entryPoint, appIDs = slack.SurfaceMention, nil
	} else if len(appIDs) == 0 {
		appIDs = []uuid.UUID{w.android, w.ios}
	}
	conv := &conversation{UserID: w.userID, TeamID: w.teamID, Surface: entryPoint}
	if err := c.createConversation(ctx, conv, conversationTitle(ec.questions[0])); err != nil {
		t.Fatalf("createConversation: %v", err)
	}

	var r evalRun
	start := time.Now()
	for i, q := range ec.questions {
		r.answer, _, r.err = c.runTurn(ctx, turn{
			userID: w.userID, teamID: w.teamID,
			conv: conv, continued: i > 0, question: q, entryPoint: entryPoint, appIDs: appIDs,
		})
		if r.err != nil {
			break
		}
	}
	r.duration = time.Since(start)
	r.cost = evalCostProxy.conversationCost(conv.ID.String())

	history, err := c.loadMessages(ctx, conv.ID)
	if err != nil {
		t.Fatalf("loadMessages: %v", err)
	}
	for _, m := range history {
		r.tokens += m.promptTokens + m.completionTokens
		switch m.msg.Role {
		case "user":
			r.llmCalls = 0
			r.toolCalls = nil
			r.toolResults = map[string]string{}
		case "assistant":
			r.llmCalls++
			r.toolCalls = append(r.toolCalls, m.msg.ToolCalls...)
		case "tool":
			r.toolResults[m.msg.ToolCallID] = m.msg.Content
		}
	}
	return r
}

// evalWorld is the team, user and apps that every eval case asks about. The
// cases' expected answers are the counts seeded by seedEvalWorld, so a change
// to a count here must be made to the cases that check it.
type evalWorld struct {
	teamID         uuid.UUID
	userID         uuid.UUID
	android        uuid.UUID
	ios            uuid.UUID
	busiestCartDay time.Time
}

type evalDevice struct {
	appVersion, appBuild                            string
	osName, osVersion                               string
	networkProvider, networkType, networkGeneration string
	manufacturer, deviceName                        string
}

var (
	evalAndroidDevice = evalDevice{"2.3.1", "231", "android", "34", "Verizon", "wifi", "unknown", "Google", "Pixel 8"}
	// evalAndroidOldDevice runs the release before evalAndroidDevice's.
	evalAndroidOldDevice = evalDevice{"2.3.0", "230", "android", "34", "Verizon", "wifi", "unknown", "Google", "Pixel 8"}
	evalIOSDevice        = evalDevice{"4.1.0", "410", "ios", "17.5", "AT&T", "cellular", "5g", "Apple", "iPhone15,2"}
)

// evalError is one error group and the events seeded for it. perDay[i] events
// are written i+1 days before the seeding time, so every event falls inside a
// "last 7 days" window whenever the eval runs.
type evalError struct {
	table       string
	eventType   string
	fingerprint string
	errType     string
	message     string
	methodName  string
	fileName    string
	handled     bool
	perDay      []int
	// users spreads the events over this many distinct user ids; zero leaves
	// the user id unset.
	users int
}

func seedEvalWorld(ctx context.Context, t *testing.T) evalWorld {
	t.Helper()
	w := evalWorld{teamID: uuid.New(), userID: uuid.New(), android: uuid.New(), ios: uuid.New()}
	th.SeedTeam(ctx, t, w.teamID.String(), "Shopper")
	th.SeedUser(ctx, t, w.userID.String(), "eval@shopper.dev")
	th.SeedTeamMembership(ctx, t, w.teamID.String(), w.userID.String(), "owner")
	seedEvalApp(ctx, t, w.teamID, w.android, "Shopper", "com.shopper.android", "android")
	seedEvalApp(ctx, t, w.teamID, w.ios, "Shopper", "com.shopper.ios", "ios")

	// Events are placed relative to the real current time, because the
	// agent's tools and ClickHouse's now() read the real clock.
	now := time.Now().UTC()

	// Android has 300 crashes in 2.3.1 and 2.3.0 together, plus 12 ANRs. Its
	// handled SocketTimeoutException outnumbers every crash, so an answer
	// that treats errors as crashes names the wrong top crash. The
	// OutOfMemoryError spiked a day ago, and the NullPointerException exists
	// only in 2.3.1.
	seedEvalErrors(ctx, t, w.teamID, w.android, evalAndroidDevice, now, []evalError{
		{
			table: "fatal_exception_groups", eventType: "exception",
			fingerprint: "a1000000000000000000000000000001",
			errType:     "java.lang.NullPointerException",
			message:     "Attempt to invoke virtual method 'java.lang.String com.shopper.cart.Cart.getId()' on a null object reference",
			methodName:  "onPlaceOrderClicked", fileName: "CheckoutActivity.kt",
			perDay: []int{20, 25, 30, 32, 35}, // 142
			users:  37,
		},
		{
			table: "fatal_exception_groups", eventType: "exception",
			fingerprint: "a1000000000000000000000000000002",
			errType:     "java.lang.IllegalStateException",
			message:     "Fragment PaymentFragment not attached to a context.",
			methodName:  "onPaymentResult", fileName: "PaymentFragment.kt",
			perDay: []int{7, 8, 7, 8, 7}, // 37
		},
		{
			table: "nonfatal_exception_groups", eventType: "exception", handled: true,
			fingerprint: "a1000000000000000000000000000003",
			errType:     "java.net.SocketTimeoutException",
			message:     "timeout",
			methodName:  "fetchRecommendations", fileName: "RecommendationsRepository.kt",
			perDay: []int{64, 64, 64, 64, 64}, // 320
		},
		{
			table: "anr_groups", eventType: "anr",
			fingerprint: "a1000000000000000000000000000004",
			errType:     "com.shopper.ANR",
			message:     "Application Not Responding for at least 5000 ms",
			methodName:  "decodeBitmap", fileName: "ImageLoader.kt",
			perDay: []int{2, 3, 2, 3, 2}, // 12
		},
		{
			table: "fatal_exception_groups", eventType: "exception",
			fingerprint: "a1000000000000000000000000000005",
			errType:     "java.lang.OutOfMemoryError",
			message:     "Failed to allocate a 33177612 byte allocation with 4194304 free bytes",
			methodName:  "onBindViewHolder", fileName: "ProductGalleryAdapter.kt",
			perDay: []int{90, 2, 1, 2, 1}, // 96
		},
	})
	seedEvalErrors(ctx, t, w.teamID, w.android, evalAndroidOldDevice, now, []evalError{
		{
			table: "fatal_exception_groups", eventType: "exception",
			fingerprint: "a1000000000000000000000000000002",
			errType:     "java.lang.IllegalStateException",
			message:     "Fragment PaymentFragment not attached to a context.",
			methodName:  "onPaymentResult", fileName: "PaymentFragment.kt",
			perDay: []int{5, 5, 5, 5, 5}, // 25
		},
	})
	seedEvalErrors(ctx, t, w.teamID, w.ios, evalIOSDevice, now, []evalError{
		{
			table: "fatal_exception_groups", eventType: "exception",
			fingerprint: "b1000000000000000000000000000001",
			errType:     "EXC_BAD_ACCESS",
			message:     "KERN_INVALID_ADDRESS at 0x0000000000000010",
			methodName:  "tableView(_:cellForRowAt:)", fileName: "CartViewController.swift",
			perDay: []int{10, 12, 11, 13, 12}, // 58
		},
	})

	// Sessions without errors, so crash-free rates are realistic.
	for day := range 5 {
		seedEvalEvents(ctx, t, w.teamID, w.android, evalAndroidDevice, 800, testinfra.EventRow{Timestamp: now.Add(-time.Duration(day+1) * 24 * time.Hour)})
		seedEvalEvents(ctx, t, w.teamID, w.android, evalAndroidOldDevice, 300, testinfra.EventRow{Timestamp: now.Add(-time.Duration(day+1) * 24 * time.Hour)})
		seedEvalEvents(ctx, t, w.teamID, w.ios, evalIOSDevice, 400, testinfra.EventRow{Timestamp: now.Add(-time.Duration(day+1) * 24 * time.Hour)})
	}

	// No purpose-built tool counts custom events or searches log lines, so
	// questions about them need SQL. Each session holds several add_to_cart
	// events, so an answer that counts sessions gets the event count wrong.
	seedEvalCustomEvents(ctx, t, w.teamID, w.android, evalAndroidDevice, now, "add_to_cart", []int{100, 110, 160, 140, 130}, 4) // 640
	seedEvalCustomEvents(ctx, t, w.teamID, w.ios, evalIOSDevice, now, "add_to_cart", []int{40, 45, 42, 41, 42}, 3)              // 210
	seedEvalCustomEvents(ctx, t, w.teamID, w.android, evalAndroidDevice, now, "checkout_started", []int{60, 60, 60, 60, 60}, 2) // 300
	w.busiestCartDay = now.Add(-3 * 24 * time.Hour)
	for day := range 5 {
		ts := now.Add(-time.Duration(day+1) * 24 * time.Hour)
		seedEvalEvents(ctx, t, w.teamID, w.android, evalAndroidDevice, 9, testinfra.EventRow{Type: "log", LogBody: "payment gateway timeout", Timestamp: ts}) // 45
		seedEvalEvents(ctx, t, w.teamID, w.android, evalAndroidDevice, 100, testinfra.EventRow{Type: "log", LogBody: "cart synced", Timestamp: ts})
	}
	return w
}

// seedEvalCustomEvents writes perDay[i] custom events named name i+1 days
// before now, perSession of them to each session.
func seedEvalCustomEvents(ctx context.Context, t *testing.T, teamID, appID uuid.UUID, d evalDevice, now time.Time, name string, perDay []int, perSession int) {
	t.Helper()
	for day, n := range perDay {
		ts := now.Add(-time.Duration(day+1) * 24 * time.Hour)
		for n > 0 {
			k := min(perSession, n)
			seedEvalEvents(ctx, t, teamID, appID, d, k, testinfra.EventRow{Type: "custom", CustomName: name, SessionID: uuid.NewString(), Timestamp: ts})
			n -= k
		}
	}
}

// seedEvalApp creates an app with its real platform and bundle identifier,
// which the agent's app list shows the model.
func seedEvalApp(ctx context.Context, t *testing.T, teamID, appID uuid.UUID, name, uniqueIdentifier, osName string) {
	t.Helper()
	th.SeedApp(ctx, t, appID.String(), teamID.String(), name, 90)
	if _, err := th.PgPool.Exec(ctx, `update apps set unique_identifier = $1, os_names = $2 where id = $3`,
		uniqueIdentifier, []string{osName}, appID); err != nil {
		t.Fatalf("update eval app: %v", err)
	}
}

func seedEvalErrors(ctx context.Context, t *testing.T, teamID, appID uuid.UUID, d evalDevice, now time.Time, errs []evalError) {
	t.Helper()
	for _, e := range errs {
		th.SeedGroupRow(ctx, t, teamID.String(), appID.String(), testinfra.GroupRow{
			Table:       e.table,
			Fingerprint: e.fingerprint,
			AppVersion:  d.appVersion,
			AppBuild:    d.appBuild,
			Type:        e.errType,
			Message:     e.message,
			MethodName:  e.methodName,
			FileName:    e.fileName,
			Handled:     e.handled,
		})
		next := 0
		for day, n := range e.perDay {
			row := testinfra.EventRow{
				Type:        e.eventType,
				Fingerprint: e.fingerprint,
				Handled:     e.handled,
				Timestamp:   now.Add(-time.Duration(day+1) * 24 * time.Hour),
			}
			if e.users == 0 {
				seedEvalEvents(ctx, t, teamID, appID, d, n, row)
				continue
			}
			// An insert gives every row the same user id, so the day's events
			// are written once per user.
			perUser := map[int]int{}
			for range n {
				perUser[next%e.users]++
				next++
			}
			for u, k := range perUser {
				row.UserID = fmt.Sprintf("user-%03d", u)
				seedEvalEvents(ctx, t, teamID, appID, d, k, row)
			}
		}
	}
}

// seedEvalEvents fills in the device attributes, which app_filters_mv needs
// all of before it records a filter row for the events.
func seedEvalEvents(ctx context.Context, t *testing.T, teamID, appID uuid.UUID, d evalDevice, count int, row testinfra.EventRow) {
	t.Helper()
	row.AppVersion, row.AppBuild = d.appVersion, d.appBuild
	row.OSName, row.OSVersion = d.osName, d.osVersion
	row.CountryCode = "US"
	row.NetworkProvider, row.NetworkType, row.NetworkGeneration = d.networkProvider, d.networkType, d.networkGeneration
	row.DeviceLocale = "en-US"
	row.DeviceManufacturer, row.DeviceName = d.manufacturer, d.deviceName
	th.SeedEventRows(ctx, t, teamID.String(), appID.String(), count, row)
}

func evalCases(w evalWorld) []evalCase {
	return []evalCase{
		{
			id:        "greeting",
			questions: []string{"hi there!"},
			checks:    []evalCheck{usesNoTools(), atMostLLMCalls(1)},
		},
		{
			id:        "top-crash-android",
			questions: []string{"What's the top crash in the Android app over the last 7 days?"},
			mcpApps:   []uuid.UUID{w.android},
			checks: []evalCheck{
				mentions("NullPointerException", "CheckoutActivity"),
				mentionsNumber(142),
				staysWithinApps(w.android),
				avoidsTools("update_bug_report_status"),
				atMostLLMCalls(8),
			},
		},
		{
			id:        "crash-count-ios",
			questions: []string{"How many crashes did the iOS app have in the last 7 days?"},
			mcpApps:   []uuid.UUID{w.ios},
			checks: []evalCheck{
				mentionsNumber(58),
				staysWithinApps(w.ios),
				avoidsTools("update_bug_report_status"),
				atMostLLMCalls(8),
			},
		},
		{
			id:        "anr-count-android",
			questions: []string{"How many ANRs did the Android app have in the last 7 days?"},
			mcpApps:   []uuid.UUID{w.android},
			checks: []evalCheck{
				mentionsNumber(12),
				staysWithinApps(w.android),
				avoidsTools("update_bug_report_status"),
				atMostLLMCalls(8),
			},
		},
		{
			id:        "top-error-android",
			questions: []string{"What's the most frequent error in the Android app over the last 7 days, handled exceptions included?"},
			mcpApps:   []uuid.UUID{w.android},
			checks: []evalCheck{
				mentions("SocketTimeoutException"),
				mentionsNumber(320),
				staysWithinApps(w.android),
				atMostLLMCalls(8),
			},
		},
		{
			id:        "crash-spike-android",
			questions: []string{"Has any crash in the Android app spiked over the last 7 days?"},
			mcpApps:   []uuid.UUID{w.android},
			checks: []evalCheck{
				mentions("OutOfMemoryError"),
				staysWithinApps(w.android),
				atMostLLMCalls(12),
			},
		},
		{
			id:        "crashes-in-version-android",
			questions: []string{"How many crashes did version 2.3.0 of the Android app have in the last 7 days?"},
			mcpApps:   []uuid.UUID{w.android},
			checks: []evalCheck{
				mentionsNumber(25),
				staysWithinApps(w.android),
				atMostLLMCalls(10),
			},
		},
		{
			id:        "version-introduced-crash",
			questions: []string{"Which version of the Android app introduced the NullPointerException crash in checkout?"},
			mcpApps:   []uuid.UUID{w.android},
			checks: []evalCheck{
				mentions("2.3.1"),
				staysWithinApps(w.android),
				atMostLLMCalls(12),
			},
		},
		{
			id:        "compare-platforms",
			questions: []string{"Compare crash counts between the Android and iOS apps over the last 7 days."},
			checks: []evalCheck{
				// ANRs are crashes to some readers, so the Android count may
				// include them.
				mentionsNumber(300, 312),
				mentionsNumber(58),
				atMostLLMCalls(12),
			},
		},
		{
			id:        "no-app-named",
			questions: []string{"How many crashes did we have in the last 7 days?"},
			checks: []evalCheck{
				mentionsNumber(300, 312),
				mentionsNumber(58),
				atMostLLMCalls(12),
			},
		},
		{
			id:        "no-launch-data",
			questions: []string{"What's the p95 cold launch time of the iOS app over the last 7 days?"},
			mcpApps:   []uuid.UUID{w.ios},
			checks: []evalCheck{
				statesNoDuration(),
				staysWithinApps(w.ios),
				atMostLLMCalls(10),
			},
		},
		{
			id:        "sql-custom-event-count",
			questions: []string{"How many add_to_cart custom events did the Android app record in the last 7 days?"},
			mcpApps:   []uuid.UUID{w.android},
			checks: []evalCheck{
				mentionsNumber(640),
				usesTool("run_sql"),
				lastSQLSucceeds(),
				staysWithinApps(w.android),
				atMostLLMCalls(10),
			},
		},
		{
			id:        "sql-custom-event-by-app",
			questions: []string{"Compare the number of add_to_cart custom events between the Android and iOS apps over the last 7 days."},
			checks: []evalCheck{
				mentionsNumber(640),
				mentionsNumber(210),
				usesTool("run_sql"),
				lastSQLSucceeds(),
				atMostLLMCalls(10),
			},
		},
		{
			id:        "sql-event-ratio",
			questions: []string{"In the Android app, what's the ratio of checkout_started to add_to_cart custom events over the last 7 days, as a percentage?"},
			mcpApps:   []uuid.UUID{w.android},
			checks: []evalCheck{
				// 300 checkout_started to 640 add_to_cart events.
				mentionsPercent(46.875, 0.2),
				usesTool("run_sql"),
				lastSQLSucceeds(),
				staysWithinApps(w.android),
				atMostLLMCalls(10),
			},
		},
		{
			id:        "sql-busiest-day",
			questions: []string{"On which day in the last 7 days did the Android app record the most add_to_cart custom events, and how many?"},
			mcpApps:   []uuid.UUID{w.android},
			checks: []evalCheck{
				mentionsAny(
					w.busiestCartDay.Format("2006-01-02"),
					w.busiestCartDay.Format("Jan 2"),
					w.busiestCartDay.Format("January 2"),
					w.busiestCartDay.Format("2 Jan"),
				),
				mentionsNumber(160),
				usesTool("run_sql"),
				lastSQLSucceeds(),
				staysWithinApps(w.android),
				atMostLLMCalls(10),
			},
		},
		{
			id:        "sql-log-search",
			questions: []string{"How many log lines containing \"payment gateway timeout\" did the Android app record in the last 7 days?"},
			mcpApps:   []uuid.UUID{w.android},
			checks: []evalCheck{
				mentionsNumber(45),
				usesTool("run_sql"),
				lastSQLSucceeds(),
				staysWithinApps(w.android),
				atMostLLMCalls(10),
			},
		},
		{
			// A model can also count users by paging through the crash's
			// events, so this case does not require SQL.
			id:        "sql-users-affected",
			questions: []string{"How many distinct users were affected by the NullPointerException crash in the Android app over the last 7 days?"},
			mcpApps:   []uuid.UUID{w.android},
			checks: []evalCheck{
				mentionsNumber(37),
				lastSQLSucceeds(),
				staysWithinApps(w.android),
				atMostLLMCalls(12),
			},
		},
		{
			id: "follow-up-location",
			questions: []string{
				"What's the top crash in the Android app over the last 7 days?",
				"Which file and method does it happen in?",
			},
			checks: []evalCheck{
				mentions("CheckoutActivity", "onPlaceOrderClicked"),
				staysWithinApps(w.android),
				atMostLLMCalls(6),
			},
		},
		{
			id: "follow-up-other-app",
			questions: []string{
				"How many crashes did the Android app have in the last 7 days?",
				"And the iOS app?",
			},
			checks: []evalCheck{
				mentionsNumber(58),
				staysWithinApps(w.ios),
				atMostLLMCalls(8),
			},
		},
	}
}

var internalsRe = regexp.MustCompile(uuidRe.String() + `|\bget_[a-z_]+\b|\brun_sql\b|\{\{`)

// hidesInternals checks the answer for raw ids, tool names and table
// placeholders, which the system prompt forbids.
func hidesInternals() evalCheck {
	return func(r evalRun) string {
		if m := internalsRe.FindString(r.answer); m != "" {
			return fmt.Sprintf("answer shows internals: %q", m)
		}
		return ""
	}
}

var durationRe = regexp.MustCompile(`(?i)\d+(\.\d+)?\s*(ms|milliseconds?|s|secs?|seconds?)\b`)

// statesNoDuration checks that the answer gives no duration, for questions
// about timings the seeded data does not have.
func statesNoDuration() evalCheck {
	return func(r evalRun) string {
		if m := durationRe.FindString(r.answer); m != "" {
			return fmt.Sprintf("answer states a duration the data does not have: %q", m)
		}
		return ""
	}
}

func usesNoTools() evalCheck {
	return func(r evalRun) string {
		if len(r.toolCalls) > 0 {
			return fmt.Sprintf("called %d tools, want none", len(r.toolCalls))
		}
		return ""
	}
}

func avoidsTools(names ...string) evalCheck {
	return func(r evalRun) string {
		for _, tc := range r.toolCalls {
			if slices.Contains(names, tc.Function.Name) {
				return "called " + tc.Function.Name
			}
		}
		return ""
	}
}

// staysWithinApps checks that every tool call scoped to apps, through app_id or
// app_ids, names only the given apps.
func staysWithinApps(apps ...uuid.UUID) evalCheck {
	return func(r evalRun) string {
		for _, tc := range r.toolCalls {
			var args struct {
				AppID  string   `json:"app_id"`
				AppIDs []string `json:"app_ids"`
			}
			if json.Unmarshal([]byte(tc.Function.Arguments), &args) != nil {
				continue
			}
			ids := args.AppIDs
			if args.AppID != "" {
				ids = append(ids, args.AppID)
			}
			for _, id := range ids {
				if !slices.ContainsFunc(apps, func(a uuid.UUID) bool { return a.String() == id }) {
					return fmt.Sprintf("%s queried app %s", tc.Function.Name, id)
				}
			}
		}
		return ""
	}
}

func atMostLLMCalls(n int) evalCheck {
	return func(r evalRun) string {
		if r.llmCalls > n {
			return fmt.Sprintf("made %d llm calls, want at most %d", r.llmCalls, n)
		}
		return ""
	}
}

func usesTool(name string) evalCheck {
	return func(r evalRun) string {
		if !slices.ContainsFunc(r.toolCalls, func(tc chatToolCall) bool { return tc.Function.Name == name }) {
			return "never called " + name
		}
		return ""
	}
}

// lastSQLSucceeds checks that the last run_sql call did not fail. The model
// is told to fix a failed query, and an answer given after a final failed
// query cannot rest on data.
func lastSQLSucceeds() evalCheck {
	return func(r evalRun) string {
		for _, tc := range slices.Backward(r.toolCalls) {
			if tc.Function.Name != "run_sql" {
				continue
			}
			if result := r.toolResults[tc.ID]; strings.HasPrefix(result, "error:") {
				return "last run_sql failed: " + result
			}
			return ""
		}
		return ""
	}
}

// mentionsAny passes an answer containing any one of the strings, for a fact
// such as a date that can be written several ways.
func mentionsAny(want ...string) evalCheck {
	return func(r evalRun) string {
		for _, s := range want {
			if strings.Contains(strings.ToLower(r.answer), strings.ToLower(s)) {
				return ""
			}
		}
		return fmt.Sprintf("answer mentions none of %q", want)
	}
}

var percentRe = regexp.MustCompile(`(\d+(?:\.\d+)?)\s*%`)

// mentionsPercent checks that the answer states a percentage within
// tolerance of want, so any sensible rounding passes.
func mentionsPercent(want, tolerance float64) evalCheck {
	return func(r evalRun) string {
		for _, m := range percentRe.FindAllStringSubmatch(r.answer, -1) {
			if v, err := strconv.ParseFloat(m[1], 64); err == nil && math.Abs(v-want) <= tolerance {
				return ""
			}
		}
		return fmt.Sprintf("answer states no percentage within %.2f of %.3f%%", tolerance, want)
	}
}
