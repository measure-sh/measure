//go:build eval

package agent

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"

	"backend/libs/slack"
)

// TestEvalCompaction stores each compaction case's conversation, runs the
// production compaction on it with each model and grades the summary.
func TestEvalCompaction(t *testing.T) {
	env := newEvalEnv(t, "LLM_AGENT_MODEL_SMALL")
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, userID, _ := seedTeamUserApp(ctx, t)

	ccs := compactionCases()
	cases := make([]evalCase, len(ccs))
	for i, cc := range ccs {
		cases[i] = cc.evalCase()
	}

	started := time.Now()
	results := env.collect(t, func(t *testing.T, record func(evalResult)) {
		for _, model := range env.models {
			c := env.config(model)
			t.Run(strings.ReplaceAll(model, "/", "_"), func(t *testing.T) {
				t.Parallel()
				for i, cc := range ccs {
					t.Run(cc.id, func(t *testing.T) {
						t.Parallel()
						for trial := range env.trials {
							t.Run(strconv.Itoa(trial+1), func(t *testing.T) {
								t.Parallel()
								conv := &conversation{UserID: userID, TeamID: teamID, Surface: slack.SurfaceAssistant}
								r := runCompactionCase(ctx, t, c, env.evalCostProxy, conv, cc)
								record(gradeEvalRun(t, model, cases[i], evalSurfaceCompaction, trial, r))
							})
						}
					})
				}
			})
		}
	})
	env.report(t, "compaction", started, []string{evalSurfaceCompaction}, cases, results)
}

// evalSurfaceCompaction labels compaction trials in the report, which groups
// trials by surface.
const evalSurfaceCompaction = "compaction"

// compactionCase is a conversation to be summarized. The last message of
// history is the user's newest question, which compaction keeps as it is;
// everything before it is summarized. facts and numbers must survive into the
// summary, and openItem names something the conversation left unresolved.
type compactionCase struct {
	id       string
	about    string
	history  []chatMessage
	facts    []string
	numbers  []int
	openItem string
}

// transcript is the text the summarizer is given: the conversation before
// the newest question, rendered the way compaction renders it.
func (cc compactionCase) transcript() string {
	head := cc.history[:len(cc.history)-1]
	msgs := make([]loadedMessage, len(head))
	for i, m := range head {
		msgs[i] = loadedMessage{msg: m}
	}
	return renderTranscript(msgs)
}

func (cc compactionCase) evalCase() evalCase {
	transcript := cc.transcript()
	checks := []evalCheck{mentions(cc.facts...)}
	for _, n := range cc.numbers {
		checks = append(checks, mentionsNumber(n))
	}
	checks = append(checks,
		mentions(cc.openItem),
		inventsNoNumbers(transcript),
		shorterThan(transcript),
		atMostChars(maxSummaryChars),
	)
	return evalCase{id: cc.id, questions: []string{cc.about}, checks: checks}
}

// compactionCases are Slack threads long enough to be compacted. Only Slack
// conversations carry history from one question to the next, so only they
// are ever compacted. Tool calls and results are included as a real turn
// stores them, although compaction leaves them out of the transcript.
func compactionCases() []compactionCase {
	return []compactionCase{
		{
			id:    "crash-investigation",
			about: "A thread on Android and iOS crashes: the top crash, its versions, iOS, a spike, an unresolved device question, crash-free rates, the path to the crash and bug reports.",
			history: []chatMessage{
				userMsg("What's the top crash in the Android app over the last 7 days?"),
				toolCallMsg("call_1", "get_errors", `{"app_id":"3f6c2a1e-8b4d-4e2a-9c1f-5d7e8a9b0c12","from":"2026-09-17T09:00:00Z","to":"2026-09-24T09:00:00Z","filter_expr":"error_type:in:[Crash]"}`),
				toolResultMsg("call_1", `[{"type":"java.lang.NullPointerException","file_name":"CheckoutActivity.kt","method_name":"onPlaceOrderClicked","count":142,"percentage_contribution":47.33},{"type":"java.lang.OutOfMemoryError","file_name":"ProductGalleryAdapter.kt","method_name":"onBindViewHolder","count":96,"percentage_contribution":32},{"type":"java.lang.IllegalStateException","file_name":"PaymentFragment.kt","method_name":"onPaymentResult","count":62,"percentage_contribution":20.67}]`),
				assistantMsg("The top crash in Shopper (com.shopper.android) over the last 7 days, Sep 17 to Sep 24, 2026 UTC, is a fatal java.lang.NullPointerException in CheckoutActivity.kt, in onPlaceOrderClicked, with 142 crashes. That is 47.3% of all Android crashes in the period. The message is \"Attempt to invoke virtual method 'java.lang.String com.shopper.cart.Cart.getId()' on a null object reference\", so the cart is null when the user taps place order. The next largest are an OutOfMemoryError in ProductGalleryAdapter.kt with 96 crashes and an IllegalStateException in PaymentFragment.kt with 62."),
				userMsg("Which versions is the checkout crash on?"),
				toolCallMsg("call_2", "get_error_distribution", `{"app_id":"3f6c2a1e-8b4d-4e2a-9c1f-5d7e8a9b0c12","error_id":"a1000000000000000000000000000001","from":"2026-09-17T09:00:00Z","to":"2026-09-24T09:00:00Z"}`),
				toolResultMsg("call_2", `{"app_version":{"2.3.1 (231)":142}}`),
				assistantMsg("All 142 NullPointerException crashes are on version 2.3.1, build 231. Version 2.3.0, build 230, had 1,500 sessions in the same period and none of these crashes, so the crash was introduced in 2.3.1."),
				userMsg("How does iOS compare?"),
				toolCallMsg("call_3", "get_errors", `{"app_id":"7a1b9c3d-2e4f-4a6b-8c0d-1e2f3a4b5c6d","from":"2026-09-17T09:00:00Z","to":"2026-09-24T09:00:00Z","filter_expr":"error_type:in:[Crash]"}`),
				toolResultMsg("call_3", `[{"type":"EXC_BAD_ACCESS","file_name":"CartViewController.swift","method_name":"tableView(_:cellForRowAt:)","count":58,"percentage_contribution":100}]`),
				assistantMsg("Shopper (com.shopper.ios) had 58 crashes over the same 7 days, all of them one EXC_BAD_ACCESS crash (KERN_INVALID_ADDRESS) in CartViewController.swift, in tableView(_:cellForRowAt:). Android had 300 crashes in total, so iOS has about a fifth as many, though iOS also has fewer sessions: 2,000 against 5,500 on Android."),
				userMsg("Did anything spike recently on Android?"),
				toolCallMsg("call_4", "get_errors_over_time", `{"app_id":"3f6c2a1e-8b4d-4e2a-9c1f-5d7e8a9b0c12","from":"2026-09-17T09:00:00Z","to":"2026-09-24T09:00:00Z","filter_expr":"error_type:in:[Crash]"}`),
				toolResultMsg("call_4", `[{"date":"2026-09-19","count":48},{"date":"2026-09-20","count":47},{"date":"2026-09-21","count":43},{"date":"2026-09-22","count":40},{"date":"2026-09-23","count":122}]`),
				assistantMsg("Yes. The OutOfMemoryError in ProductGalleryAdapter.kt spiked on Sep 23 with 90 crashes, against 1 or 2 a day before that. It accounts for most of the jump in Android crashes that day, from about 40 to 122. The chart below shows the daily counts. The NullPointerException in checkout is steady at 20 to 35 a day and slowly falling."),
				userMsg("Is the OOM limited to particular devices?"),
				toolCallMsg("call_5", "get_filter_values", `{"app_id":"3f6c2a1e-8b4d-4e2a-9c1f-5d7e8a9b0c12","key":"device_name","entity":"errors"}`),
				toolResultMsg("call_5", `["Pixel 8"]`),
				assistantMsg("I can't tell from the data I have. All of the OutOfMemoryError crashes in this period come from Pixel 8 devices, but Pixel 8 is also the only device model reporting sessions for this app, so there is nothing to compare against. If the app starts reporting from other devices I can check again, or I can look at memory usage around the crashes if that helps."),
				userMsg("What's the crash-free session rate on Android?"),
				toolCallMsg("call_6", "get_metrics", `{"app_id":"3f6c2a1e-8b4d-4e2a-9c1f-5d7e8a9b0c12","from":"2026-09-17T09:00:00Z","to":"2026-09-24T09:00:00Z"}`),
				toolResultMsg("call_6", `{"crash_free_sessions":94.55,"anr_free_sessions":99.78,"sessions":5500,"crash_sessions":300,"anr_sessions":12}`),
				assistantMsg("Shopper (com.shopper.android) had a crash-free session rate of 94.5% over the same 7 days: 300 of its 5,500 sessions ended in a crash. Version 2.3.1 is at 93.1% and 2.3.0 at 98.3%, which fits the checkout crash being new in 2.3.1. The ANR-free rate is 99.8%, with 12 ANRs, all in ImageLoader.kt while decoding bitmaps on the main thread."),
				userMsg("Which screens do users visit right before the checkout crash?"),
				toolCallMsg("call_7", "get_error_common_path", `{"app_id":"3f6c2a1e-8b4d-4e2a-9c1f-5d7e8a9b0c12","error_id":"a1000000000000000000000000000001"}`),
				toolResultMsg("call_7", `{"path":["ProductDetailActivity","CartActivity","CheckoutActivity","app_background","app_foreground"],"sessions":118}`),
				assistantMsg("In most sessions that end in the NullPointerException, users go from ProductDetailActivity to CartActivity and then CheckoutActivity. In 118 of the 142 crashes, the app went to the background on CheckoutActivity and came back just before the user tapped place order, which suggests the cart is lost when the app is restored from the background."),
				userMsg("Any bug reports mentioning checkout?"),
				toolCallMsg("call_8", "get_bug_reports", `{"app_id":"3f6c2a1e-8b4d-4e2a-9c1f-5d7e8a9b0c12","from":"2026-09-17T09:00:00Z","to":"2026-09-24T09:00:00Z","filter_expr":"description:contains:checkout"}`),
				toolResultMsg("call_8", `[{"status":"open","description":"app closes when I press Place Order after switching to my banking app","timestamp":"2026-09-23T18:42:10Z"}]`),
				assistantMsg("There are 9 open bug reports from Android users in the same period that mention checkout. The most recent, from Sep 23, says \"app closes when I press Place Order after switching to my banking app\", which matches the background pattern. None of the iOS bug reports mention checkout."),
				userMsg("Can you mark the Sep 23 bug report as in progress?"),
				toolCallMsg("call_9", "update_bug_report_status", `{"app_id":"3f6c2a1e-8b4d-4e2a-9c1f-5d7e8a9b0c12","bug_report_id":"5b2d7e10-4c3a-4f8e-9a1b-2c3d4e5f6a7b","status":"in_progress"}`),
				toolResultMsg("call_9", `{"ok":true}`),
				assistantMsg("Done. The Sep 23 bug report about Place Order closing the app is now marked in progress."),
				userMsg("OK. Back to checkout: how many users did that crash affect?"),
			},
			facts:    []string{"NullPointerException", "CheckoutActivity", "2.3.1", "EXC_BAD_ACCESS", "OutOfMemoryError", "94.5", "background"},
			numbers:  []int{142, 58, 90, 300},
			openItem: "device",
		},
		{
			id:    "checkout-latency",
			about: "A thread on slow checkout requests on iOS: latency by version, a burst of 503s, an unresolved deploy question, the cause, adoption of the new version, Android, success rates and a chart.",
			history: []chatMessage{
				userMsg("Why is checkout slow on iOS this week?"),
				toolCallMsg("call_1", "get_network_metrics_trends", `{"app_id":"7a1b9c3d-2e4f-4a6b-8c0d-1e2f3a4b5c6d","from":"2026-09-17T09:00:00Z","to":"2026-09-24T09:00:00Z"}`),
				toolResultMsg("call_1", `{"slowest":[{"method":"POST","path":"/v2/checkout","p95_ms":2340,"count":8120}]}`),
				assistantMsg("Over the last 7 days, Sep 17 to Sep 24, 2026 UTC, POST /v2/checkout is the slowest endpoint in Shopper (com.shopper.ios), with a p95 latency of 2,340 ms against 890 ms for the same endpoint on Android. Its p95 was around 900 ms until Sep 21 and rose to over 2,000 ms from Sep 22, which is when version 4.1.0 started rolling out. Requests from 4.1.0 have a p95 of 2,610 ms, while 4.0.2 is at 910 ms."),
				userMsg("Are there errors on that endpoint too?"),
				toolCallMsg("call_2", "get_network_endpoint_status_codes_over_time", `{"app_id":"7a1b9c3d-2e4f-4a6b-8c0d-1e2f3a4b5c6d","method":"POST","path":"/v2/checkout","from":"2026-09-17T09:00:00Z","to":"2026-09-24T09:00:00Z"}`),
				toolResultMsg("call_2", `[{"date":"2026-09-22","status_code":503,"count":1204},{"date":"2026-09-21","status_code":503,"count":14}]`),
				assistantMsg("Yes. On Sep 22 the endpoint returned 1,204 HTTP 503 responses on iOS, against fewer than 20 on each other day. Android saw 37 503s that day. The 503s all came between 14:00 and 16:00 UTC."),
				userMsg("Could the 503s be from a backend deploy?"),
				assistantMsg("I can't tell. Measure only sees the app's side of the requests, so I have no record of backend deploys. The timing, a two-hour burst on Sep 22 affecting both platforms, fits a backend incident better than an app change, but you would need to check your deploy history for 14:00 to 16:00 UTC on Sep 22."),
				userMsg("What changed in 4.1.0 for checkout?"),
				toolCallMsg("call_3", "get_network_timeline", `{"app_id":"7a1b9c3d-2e4f-4a6b-8c0d-1e2f3a4b5c6d","from":"2026-09-22T00:00:00Z","to":"2026-09-24T09:00:00Z","filter_expr":"app_version:in:[4.1.0]"}`),
				toolResultMsg("call_3", `[{"method":"GET","path":"/v2/cart/validate","p50_ms":620},{"method":"POST","path":"/v2/checkout","p50_ms":1480}]`),
				assistantMsg("Measure doesn't have release notes, but the requests show a difference: in 4.1.0 each checkout makes a GET /v2/cart/validate call before POST /v2/checkout, adding a median of 620 ms. Version 4.0.2 does not make that call. That extra request accounts for most of the latency increase."),
				userMsg("How many users are on 4.1.0 now?"),
				toolCallMsg("call_4", "get_filter_values", `{"app_id":"7a1b9c3d-2e4f-4a6b-8c0d-1e2f3a4b5c6d","key":"app_version","entity":"sessions"}`),
				toolResultMsg("call_4", `[{"value":"4.1.0","sessions":1240},{"value":"4.0.2","sessions":760}]`),
				assistantMsg("Version 4.1.0 accounts for 62% of iOS sessions over the last 7 days, 1,240 of 2,000. The rest are on 4.0.2. Since 4.1.0 only started rolling out on Sep 22, its share of daily sessions is now well above that."),
				userMsg("Is Android affected by the validate call too?"),
				toolCallMsg("call_5", "get_network_timeline", `{"app_id":"3f6c2a1e-8b4d-4e2a-9c1f-5d7e8a9b0c12","from":"2026-09-17T09:00:00Z","to":"2026-09-24T09:00:00Z"}`),
				toolResultMsg("call_5", `[{"method":"POST","path":"/v2/checkout","p95_ms":890}]`),
				assistantMsg("No. Shopper (com.shopper.android) does not call GET /v2/cart/validate in any version, and its POST /v2/checkout p95 has stayed between 850 and 920 ms all week."),
				userMsg("What's the success rate of checkout on iOS?"),
				toolCallMsg("call_6", "get_network_endpoint_status_codes_over_time", `{"app_id":"7a1b9c3d-2e4f-4a6b-8c0d-1e2f3a4b5c6d","method":"POST","path":"/v2/checkout","from":"2026-09-17T09:00:00Z","to":"2026-09-24T09:00:00Z"}`),
				toolResultMsg("call_6", `{"total":8120,"2xx":6840,"409":71,"503":1204,"other":5}`),
				assistantMsg("Including the 503 burst on Sep 22, 84.2% of the 8,120 POST /v2/checkout requests on iOS this week returned a 2xx response. Excluding it, the rate is 98.9%. Most of the other failures are 409 responses, 71 in total, which the app gets when the cart changed between validation and checkout."),
				userMsg("Draw me the daily p95 for checkout on iOS."),
				toolCallMsg("call_7", "render_chart", `{"title":"iOS POST /v2/checkout p95 (ms)","kind":"line","labels":["Sep 18","Sep 19","Sep 20","Sep 21","Sep 22","Sep 23"],"series":[{"name":"p95","values":[905,890,910,900,2100,2600]}]}`),
				toolResultMsg("call_7", `Chart "iOS POST /v2/checkout p95 (ms)" rendered. It is posted below this reply: mention it as the chart below, never as an image above, and don't repeat every value from it.`),
				assistantMsg("The chart below shows the daily p95 of POST /v2/checkout on iOS. It stays near 900 ms until Sep 21, then climbs to 2,100 ms on Sep 22 and about 2,600 ms from Sep 23 as more users move to 4.1.0."),
				userMsg("Can you show me the slowest sessions from 4.1.0?"),
			},
			facts:    []string{"/v2/checkout", "4.1.0", "503", "/v2/cart/validate", "409"},
			numbers:  []int{2340, 890, 1204, 620},
			openItem: "deploy",
		},
	}
}

func userMsg(content string) chatMessage { return chatMessage{Role: "user", Content: content} }

func assistantMsg(content string) chatMessage {
	return chatMessage{Role: "assistant", Content: content}
}

func toolCallMsg(id, name, arguments string) chatMessage {
	return chatMessage{Role: "assistant", ToolCalls: []chatToolCall{{
		ID: id, Type: "function", Function: chatToolCallFunction{Name: name, Arguments: arguments},
	}}}
}

func toolResultMsg(id, content string) chatMessage {
	return chatMessage{Role: "tool", Content: content, ToolCallID: id}
}

// runCompactionCase stores the case's conversation and runs compactIfNeeded
// on it. The last assistant message is stored with a context size over
// compactionThresholdTokens, which is what makes compactIfNeeded summarize.
func runCompactionCase(ctx context.Context, t *testing.T, c *Config, evalCostProxy *evalCostProxy, conv *conversation, cc compactionCase) evalRun {
	t.Helper()
	if err := c.createConversation(ctx, conv, cc.id); err != nil {
		t.Fatalf("createConversation: %v", err)
	}
	// Assistant messages are stored with a model and usage, as a real turn
	// stores them; appendMessages saves token counts only for those.
	stored := make([]storedMessage, len(cc.history))
	lastAssistant := -1
	for i, m := range cc.history {
		stored[i] = storedMessage{msg: m}
		if m.Role == "assistant" {
			stored[i].model = c.ModelMedium
			stored[i].usage = chatUsage{PromptTokens: 12000, CompletionTokens: 300}
			lastAssistant = i
		}
	}
	stored[lastAssistant].usage = chatUsage{PromptTokens: compactionThresholdTokens, CompletionTokens: 500}
	if err := c.appendMessages(ctx, conv.ID, stored); err != nil {
		t.Fatalf("appendMessages: %v", err)
	}
	history, err := c.loadMessages(ctx, conv.ID)
	if err != nil {
		t.Fatalf("loadMessages: %v", err)
	}

	// The conversation id is what the cost proxy files the call's cost under.
	ctx = withConversationID(ctx, conv.ID.String())
	start := time.Now()
	compacted, usage := c.compactIfNeeded(ctx, conv.ID, history)
	r := evalRun{
		llmCalls: 1,
		tokens:   usage.prompt + usage.completion,
		cost:     evalCostProxy.conversationCost(conv.ID.String()),
		duration: time.Since(start),
	}
	if len(compacted) == 0 || !compacted[0].summary {
		r.err = fmt.Errorf("no summary was produced, see the log for the compaction error")
		return r
	}
	r.answer = strings.TrimPrefix(compacted[0].msg.Content, "Summary of the conversation so far: ")
	return r
}

var numberRe = regexp.MustCompile(`\d+(?:[.,]\d+)*`)

// inventsNoNumbers checks that every number in the summary appears in the
// transcript. Numbers below 10 are skipped, since summaries number their
// points and count things in words the transcript need not contain, and ids
// are removed first, since their digits are not numbers.
func inventsNoNumbers(transcript string) evalCheck {
	known := strings.ReplaceAll(uuidRe.ReplaceAllString(transcript, ""), ",", "")
	return func(r evalRun) string {
		summary := uuidRe.ReplaceAllString(r.answer, "")
		for _, n := range numberRe.FindAllString(summary, -1) {
			n = strings.ReplaceAll(n, ",", "")
			if v, err := strconv.ParseFloat(n, 64); err == nil && v < 10 {
				continue
			}
			if !strings.Contains(known, n) {
				return fmt.Sprintf("summary states %s, which is not in the conversation", n)
			}
		}
		return ""
	}
}

// maxSummaryChars is about 1,000 tokens, 3% of compactionThresholdTokens. A
// summary is roughly the same length whatever it summarizes, so the cases'
// short conversations cannot show whether it shrinks a real one; this limit
// catches a summary too long to free much context.
const maxSummaryChars = 4000

// shorterThan checks that the summary is shorter than the transcript, which
// fails a model that repeats the conversation back or adds to it.
func shorterThan(transcript string) evalCheck {
	return func(r evalRun) string {
		if len(r.answer) >= len(transcript) {
			return fmt.Sprintf("summary is %d characters, as long as the %d-character conversation", len(r.answer), len(transcript))
		}
		return ""
	}
}

func atMostChars(n int) evalCheck {
	return func(r evalRun) string {
		if len(r.answer) > n {
			return fmt.Sprintf("summary is %d characters, want at most %d", len(r.answer), n)
		}
		return ""
	}
}
