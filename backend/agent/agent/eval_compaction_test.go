//go:build eval

package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"testing"
	texttemplate "text/template"
	"time"

	"backend/libs/slack"
)

func TestEvalCompaction(t *testing.T) {
	env := newEvalEnv(t, "LLM_AGENT_MODEL_SMALL")
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	teamID, userID, _ := seedTeamUserApp(ctx, t)

	threads := compactionCases()
	cases := make([]evalCase, len(threads))
	for i, compactionCase := range threads {
		cases[i] = compactionCase.evalCase()
	}
	env.calibrateJudge(ctx, t, cases)

	started := time.Now()
	results := env.collect(t, func(t *testing.T, record func(evalResult)) {
		for _, model := range env.models {
			config := env.config(model)
			t.Run(strings.ReplaceAll(model, "/", "_"), func(t *testing.T) {
				t.Parallel()
				for i, compactionCase := range threads {
					t.Run(compactionCase.id, func(t *testing.T) {
						t.Parallel()
						for trial := range env.trials {
							t.Run(strconv.Itoa(trial+1), func(t *testing.T) {
								t.Parallel()
								conv := &conversation{UserID: userID, TeamID: teamID, Surface: slack.SurfaceAssistant}
								evalRun := runCompactionCase(ctx, t, config, env.evalCostProxy, conv, compactionCase)
								record(env.gradeEvalRun(ctx, t, model, cases[i], evalSurfaceCompaction, trial, evalRun))
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

// The last message of history is the user's newest question, which
// compaction keeps as it is; everything before it is summarized.
type compactionCase struct {
	id          string
	description string
	history     []chatMessage
	claims      []evalClaim
	fixtures    []judgeFixture
}

// transcript is the text the summarizer is given: the conversation before
// the newest question, rendered the way compaction renders it.
func (cc compactionCase) transcript() string {
	head := cc.history[:len(cc.history)-1]
	msgs := make([]loadedMessage, len(head))
	for i, message := range head {
		msgs[i] = loadedMessage{msg: message}
	}
	return renderTranscript(msgs)
}

func (cc compactionCase) evalCase() evalCase {
	transcript := cc.transcript()
	return evalCase{
		id:              cc.id,
		questions:       []string{cc.description},
		checks:          []evalCheck{shorterThan(transcript), atMostChars(maxSummaryChars)},
		claims:          append(slices.Clone(cc.claims), misattributedFigureClaim),
		textDescription: "The text is a summary of the conversation below, written so the assistant can rely on it in later turns.\n\n" + transcript,
		numberClaims:    inventedNumberClaims(transcript),
		fixtures:        cc.fixtures,
	}
}

// misattributedFigureClaim fails a summary that gives a figure or name from the
// conversation to a different fact than the one the conversation gives it,
// which inventedNumberClaims cannot see because the figure is in the conversation.
var misattributedFigureClaim = forbids("gives a figure or name from the conversation to a different fact than the one the conversation gives it")

// compactionCases are Slack threads, since only Slack conversations carry
// history from one question to the next. Tool calls and results are included
// as a real turn stores them, although compaction leaves them out of the
// transcript. Each thread is written from its data, which the claims and
// fixtures also use, so they stay in step.
func compactionCases() []compactionCase {
	return []compactionCase{crashInvestigation(), checkoutLatency()}
}

// reportedError is an error group as the thread's tool results report it.
type reportedError struct {
	Type     string `json:"type"`
	File     string `json:"file_name"`
	Method   string `json:"method_name"`
	Message  string `json:"-"`
	Count    int    `json:"count"`
	Users    int    `json:"users"`
	Sessions int    `json:"sessions"`
}

func (c reportedError) ExceptionClass() string { return exceptionClass(c.Type) }
func (c reportedError) FileStem() string       { return fileStem(c.File) }

type dayCount struct {
	Day   time.Time
	Count int
}

// crashThread is the data the crash-investigation thread is written from.
type crashThread struct {
	From, To               time.Time
	AndroidAppID, IOSAppID string
	Top, Gallery, Payment  reportedError
	Cart                   reportedError
	TopFingerprint         string
	TopVersion, TopBuild   string
	OldVersion, OldBuild   string
	OldVersionSessions     int
	AndroidSessions        int
	IOSSessions            int
	DailyCrashes           []dayCount
	GallerySpike           int
	Device                 string
	TopVersionCrashFree    float64
	OldVersionCrashFree    float64
	ANRs                   int
	BackgroundCrashes      int
	OpenBugReports         int
	BugReport, BugReportID string
	BugReportAt            time.Time
}

func (d crashThread) AndroidCrashes() int { return d.Top.Count + d.Gallery.Count + d.Payment.Count }
func (d crashThread) TopShare() float64 {
	return roundToTenth(100 * float64(d.Top.Count) / float64(d.AndroidCrashes()))
}
func (d crashThread) CrashFree() float64 {
	return roundToTenth(100 - 100*float64(d.AndroidCrashes())/float64(d.AndroidSessions))
}
func (d crashThread) ANRFree() float64 {
	return roundToTenth(100 - 100*float64(d.ANRs)/float64(d.AndroidSessions))
}
func (d crashThread) SpikeDay() time.Time { return d.DailyCrashes[len(d.DailyCrashes)-1].Day }
func (d crashThread) SpikeDayCrashes() int {
	return d.DailyCrashes[len(d.DailyCrashes)-1].Count
}
func (d crashThread) DayBeforeSpikeCrashes() int {
	return d.DailyCrashes[len(d.DailyCrashes)-2].Count
}

func crashInvestigation() compactionCase {
	from := time.Date(2026, 9, 17, 9, 0, 0, 0, time.UTC)
	crashThread := crashThread{
		From: from, To: from.AddDate(0, 0, 7),
		AndroidAppID: "3f6c2a1e-8b4d-4e2a-9c1f-5d7e8a9b0c12",
		IOSAppID:     "7a1b9c3d-2e4f-4a6b-8c0d-1e2f3a4b5c6d",
		Top: reportedError{
			Type: "java.lang.NullPointerException", File: "CheckoutActivity.kt", Method: "onPlaceOrderClicked",
			Message: "Attempt to invoke virtual method 'java.lang.String com.shopper.cart.Cart.getId()' on a null object reference",
			Count:   142, Users: 97, Sessions: 118,
		},
		Gallery: reportedError{Type: "java.lang.OutOfMemoryError", File: "ProductGalleryAdapter.kt", Method: "onBindViewHolder", Count: 96, Users: 71, Sessions: 80},
		Payment: reportedError{Type: "java.lang.IllegalStateException", File: "PaymentFragment.kt", Method: "onPaymentResult", Count: 62, Users: 40, Sessions: 51},
		Cart: reportedError{
			Type: "EXC_BAD_ACCESS", File: "CartViewController.swift", Method: "tableView(_:cellForRowAt:)",
			Message: "KERN_INVALID_ADDRESS", Count: 58, Users: 33, Sessions: 45,
		},
		TopFingerprint: "a1000000000000000000000000000001",
		TopVersion:     "2.3.1", TopBuild: "231",
		OldVersion: "2.3.0", OldBuild: "230",
		OldVersionSessions: 1500,
		AndroidSessions:    5500,
		IOSSessions:        2000,
		DailyCrashes: []dayCount{
			{from.AddDate(0, 0, 2), 48}, {from.AddDate(0, 0, 3), 47}, {from.AddDate(0, 0, 4), 43},
			{from.AddDate(0, 0, 5), 40}, {from.AddDate(0, 0, 6), 122},
		},
		GallerySpike:        90,
		Device:              "Pixel 8",
		TopVersionCrashFree: 93.1,
		OldVersionCrashFree: 98.3,
		ANRs:                12,
		BackgroundCrashes:   118,
		OpenBugReports:      9,
		BugReport:           "app closes when I press Place Order after switching to my banking app",
		BugReportID:         "5b2d7e10-4c3a-4f8e-9a1b-2c3d4e5f6a7b",
		BugReportAt:         time.Date(2026, 9, 23, 18, 42, 10, 0, time.UTC),
	}

	history := renderMessages(crashThread, []chatMessage{
		userMsg("What's the top crash in the Android app over the last 7 days?"),
		toolCallMsg("call_1", "get_errors", `{"app_id":"{{.AndroidAppID}}","from":"{{rfc .From}}","to":"{{rfc .To}}","filter_expr":"error_type:in:[Crash]"}`),
		toolResultMsg("call_1", `[{{json .Top}},{{json .Gallery}},{{json .Payment}}]`),
		assistantMsg(`The top crash in Shopper (com.shopper.android) over the last 7 days, {{day .From}} to {{day .To}}, {{.From.Year}} UTC, is a fatal {{.Top.Type}} in {{.Top.File}}, in {{.Top.Method}}, with {{.Top.Count}} crashes. That is {{number .TopShare}}% of all Android crashes in the period. The message is "{{.Top.Message}}", so the cart is null when the user taps place order. The next largest are an {{.Gallery.ExceptionClass}} in {{.Gallery.File}} with {{.Gallery.Count}} crashes and an {{.Payment.ExceptionClass}} in {{.Payment.File}} with {{.Payment.Count}}.`),
		userMsg("Which versions is the checkout crash on?"),
		toolCallMsg("call_2", "get_error_distribution", `{"app_id":"{{.AndroidAppID}}","error_id":"{{.TopFingerprint}}","from":"{{rfc .From}}","to":"{{rfc .To}}"}`),
		toolResultMsg("call_2", `{"app_version":{"{{.TopVersion}} ({{.TopBuild}})":{{.Top.Count}}}}`),
		assistantMsg(`All {{.Top.Count}} {{.Top.ExceptionClass}} crashes are on version {{.TopVersion}}, build {{.TopBuild}}. Version {{.OldVersion}}, build {{.OldBuild}}, had {{number .OldVersionSessions}} sessions in the same period and none of these crashes, so the crash was introduced in {{.TopVersion}}.`),
		userMsg("How does iOS compare?"),
		toolCallMsg("call_3", "get_errors", `{"app_id":"{{.IOSAppID}}","from":"{{rfc .From}}","to":"{{rfc .To}}","filter_expr":"error_type:in:[Crash]"}`),
		toolResultMsg("call_3", `[{{json .Cart}}]`),
		assistantMsg(`Shopper (com.shopper.ios) had {{.Cart.Count}} crashes over the same 7 days, all of them one {{.Cart.Type}} crash ({{.Cart.Message}}) in {{.Cart.File}}, in {{.Cart.Method}}. Android had {{.AndroidCrashes}} crashes in total, though iOS also has fewer sessions: {{number .IOSSessions}} against {{number .AndroidSessions}} on Android.`),
		userMsg("Did anything spike recently on Android?"),
		toolCallMsg("call_4", "get_errors_over_time", `{"app_id":"{{.AndroidAppID}}","from":"{{rfc .From}}","to":"{{rfc .To}}","filter_expr":"error_type:in:[Crash]"}`),
		toolResultMsg("call_4", `[{{range $i, $d := .DailyCrashes}}{{if $i}},{{end}}{"date":"{{iso $d.Day}}","count":{{$d.Count}}}{{end}}]`),
		assistantMsg(`Yes. The {{.Gallery.ExceptionClass}} in {{.Gallery.File}} spiked on {{day .SpikeDay}} with {{.GallerySpike}} crashes, against 1 or 2 a day before that. It accounts for most of the jump in Android crashes that day, from about {{.DayBeforeSpikeCrashes}} to {{.SpikeDayCrashes}}. The chart below shows the daily counts. The {{.Top.ExceptionClass}} in checkout is steady and slowly falling.`),
		userMsg("Is the OOM limited to particular devices?"),
		toolCallMsg("call_5", "get_filter_values", `{"app_id":"{{.AndroidAppID}}","key":"device_name","entity":"errors"}`),
		toolResultMsg("call_5", `["{{.Device}}"]`),
		assistantMsg(`I can't tell from the data I have. All of the {{.Gallery.ExceptionClass}} crashes in this period come from {{.Device}} devices, but {{.Device}} is also the only device model reporting sessions for this app, so there is nothing to compare against. If the app starts reporting from other devices I can check again, or I can look at memory usage around the crashes if that helps.`),
		userMsg("What's the crash-free session rate on Android?"),
		toolCallMsg("call_6", "get_metrics", `{"app_id":"{{.AndroidAppID}}","from":"{{rfc .From}}","to":"{{rfc .To}}"}`),
		toolResultMsg("call_6", `{"crash_free_sessions":{{number .CrashFree}},"anr_free_sessions":{{number .ANRFree}},"sessions":{{.AndroidSessions}},"crash_sessions":{{.AndroidCrashes}},"anr_sessions":{{.ANRs}}}`),
		assistantMsg(`Shopper (com.shopper.android) had a crash-free session rate of {{number .CrashFree}}% over the same 7 days: {{.AndroidCrashes}} of its {{number .AndroidSessions}} sessions ended in a crash. Version {{.TopVersion}} is at {{number .TopVersionCrashFree}}% and {{.OldVersion}} at {{number .OldVersionCrashFree}}%, which fits the checkout crash being new in {{.TopVersion}}. The ANR-free rate is {{number .ANRFree}}%, with {{.ANRs}} ANRs, all in ImageLoader.kt while decoding bitmaps on the main thread.`),
		userMsg("Which screens do users visit right before the checkout crash?"),
		toolCallMsg("call_7", "get_error_common_path", `{"app_id":"{{.AndroidAppID}}","error_id":"{{.TopFingerprint}}"}`),
		toolResultMsg("call_7", `{"path":["ProductDetailActivity","CartActivity","{{.Top.FileStem}}","app_background","app_foreground"],"sessions":{{.BackgroundCrashes}}}`),
		assistantMsg(`In most sessions that end in the {{.Top.ExceptionClass}}, users go from ProductDetailActivity to CartActivity and then {{.Top.FileStem}}. In {{.BackgroundCrashes}} of the {{.Top.Count}} crashes, the app went to the background on {{.Top.FileStem}} and came back just before the user tapped place order, which suggests the cart is lost when the app is restored from the background.`),
		userMsg("Any bug reports mentioning checkout?"),
		toolCallMsg("call_8", "get_bug_reports", `{"app_id":"{{.AndroidAppID}}","from":"{{rfc .From}}","to":"{{rfc .To}}","filter_expr":"description:contains:checkout"}`),
		toolResultMsg("call_8", `[{"status":"open","description":"{{.BugReport}}","timestamp":"{{rfc .BugReportAt}}"}]`),
		assistantMsg(`There are {{.OpenBugReports}} open bug reports from Android users in the same period that mention checkout. The most recent, from {{day .BugReportAt}}, says "{{.BugReport}}", which matches the background pattern. None of the iOS bug reports mention checkout.`),
		userMsg(`Can you mark the {{day .BugReportAt}} bug report as in progress?`),
		toolCallMsg("call_9", "update_bug_report_status", `{"app_id":"{{.AndroidAppID}}","bug_report_id":"{{.BugReportID}}","status":"in_progress"}`),
		toolResultMsg("call_9", `{"ok":true}`),
		assistantMsg(`Done. The {{day .BugReportAt}} bug report about Place Order closing the app is now marked in progress.`),
		userMsg("OK. Back to checkout: how many users did that crash affect?"),
	})

	summary := renderTemplate(crashThread, `Shopper Android (com.shopper.android) and iOS (com.shopper.ios), last 7 days, {{day .From}} to {{day .To}}, {{.From.Year}} UTC.
- Top Android crash: {{.Top.Type}} in {{.Top.File}}, {{.Top.Method}}, {{.Top.Count}} crashes. All on version {{.TopVersion}} (build {{.TopBuild}}), none on {{.OldVersion}}, so {{.TopVersion}} introduced it. In {{.BackgroundCrashes}} of the {{.Top.Count}} crashes the app returned from the background on {{.Top.FileStem}} just before the user tapped place order, so the cart is likely lost on restore.
- Android had {{.AndroidCrashes}} crashes in total. An {{.Gallery.ExceptionClass}} in {{.Gallery.File}} spiked on {{day .SpikeDay}} with {{.GallerySpike}} crashes.
- iOS had {{.Cart.Count}} crashes, all {{.Cart.Type}} in {{.Cart.File}}.
- Android crash-free session rate: {{number .CrashFree}}%.
- {{.OpenBugReports}} open Android bug reports mention checkout; the {{day .BugReportAt}} one is now marked in progress.
`)

	background := renderTemplate(crashThread, `In {{.BackgroundCrashes}} of the {{.Top.Count}} crashes the app returned from the background on {{.Top.FileStem}} just before the user tapped place order, so the cart is likely lost on restore.`)
	followsBackground := states("says the checkout crash follows the app returning from the background")
	deviceOpen := states(fmt.Sprintf("says it is still unresolved whether the %s is limited to particular devices", crashThread.Gallery.ExceptionClass()))
	openQuestion := renderTemplate(crashThread, `- Open question: whether the {{.Gallery.ExceptionClass}} is limited to particular devices is unresolved, since {{.Device}} is the only device reporting.`)

	return compactionCase{
		id:          "crash-investigation",
		description: "A thread on Android and iOS crashes: the top crash, its versions, iOS, a spike, an unresolved device question, crash-free rates, the path to the crash and bug reports.",
		history:     history,
		claims: []evalClaim{
			states(fmt.Sprintf("says the top Android crash is a %s in %s with %d crashes", crashThread.Top.ExceptionClass(), crashThread.Top.FileStem(), crashThread.Top.Count),
				nameAnchor(crashThread.Top.ExceptionClass()), nameAnchor(crashThread.Top.FileStem()), numberAnchor(crashThread.Top.Count)),
			states(fmt.Sprintf("says the checkout crash occurs only on version %s, which introduced it", crashThread.TopVersion), versionAnchor(crashThread.TopVersion)),
			states(fmt.Sprintf("says the iOS app had %d crashes, all from one %s crash", crashThread.Cart.Count, crashThread.Cart.ExceptionClass()),
				nameAnchor(crashThread.Cart.ExceptionClass()), numberAnchor(crashThread.Cart.Count)),
			states(fmt.Sprintf("says the Android app had %d crashes in total", crashThread.AndroidCrashes()), numberAnchor(crashThread.AndroidCrashes())),
			states(fmt.Sprintf("says an %s crash spiked with %d crashes in a day", crashThread.Gallery.ExceptionClass(), crashThread.GallerySpike),
				nameAnchor(crashThread.Gallery.ExceptionClass()), numberAnchor(crashThread.GallerySpike)),
			states(fmt.Sprintf("says the Android crash-free session rate was %g%%", crashThread.CrashFree()), percentAnchor(crashThread.CrashFree(), 0.051)),
			followsBackground,
			deviceOpen,
		},
		fixtures: []judgeFixture{
			{name: "complete summary", text: summary + openQuestion},
			{name: "open question closed", failsOn: deviceOpen, text: summary + renderTemplate(crashThread, `- The {{.Gallery.ExceptionClass}} is limited to {{.Device}} devices.`)},
			{name: "another cause given", failsOn: followsBackground,
				text: replaceOnce(summary, background, "The cart is cleared when the user signs out.") + openQuestion},
		},
	}
}

// latencyThread is the data the checkout-latency thread is written from.
type latencyThread struct {
	From, To               time.Time
	AndroidAppID, IOSAppID string
	Method, Endpoint       string
	IOSP95, AndroidP95     int
	AndroidP95Low          int
	AndroidP95High         int
	BaselineP95, RisenP95  int
	NewVersion, OldVersion string
	NewVersionP95          int
	OldVersionP95          int
	NewVersionP50          int
	RolloutDay             time.Time
	Unavailable, Conflict  int
	Burst, AndroidBurst    int
	BurstStart, BurstEnd   string
	ValidatePath           string
	ValidateP50            int
	NewVersionSessions     int
	OldVersionSessions     int
	Succeeded, Conflicts   int
	OtherFailures          int
	DailyP95               []dayCount
}

func (d latencyThread) DayBeforeRollout() time.Time { return d.RolloutDay.AddDate(0, 0, -1) }
func (d latencyThread) IOSSessions() int            { return d.NewVersionSessions + d.OldVersionSessions }
func (d latencyThread) NewVersionShare() int {
	return int(math.Round(100 * float64(d.NewVersionSessions) / float64(d.IOSSessions())))
}
func (d latencyThread) Requests() int { return d.Succeeded + d.Conflicts + d.Burst + d.OtherFailures }
func (d latencyThread) SuccessRate() float64 {
	return roundToTenth(100 * float64(d.Succeeded) / float64(d.Requests()))
}
func (d latencyThread) SuccessRateWithoutBurst() float64 {
	return roundToTenth(100 * float64(d.Succeeded) / float64(d.Requests()-d.Burst))
}

func checkoutLatency() compactionCase {
	from := time.Date(2026, 9, 17, 9, 0, 0, 0, time.UTC)
	rollout := time.Date(2026, 9, 22, 0, 0, 0, 0, time.UTC)
	latencyThread := latencyThread{
		From: from, To: from.AddDate(0, 0, 7),
		AndroidAppID: "3f6c2a1e-8b4d-4e2a-9c1f-5d7e8a9b0c12",
		IOSAppID:     "7a1b9c3d-2e4f-4a6b-8c0d-1e2f3a4b5c6d",
		Method:       "POST", Endpoint: "/v2/checkout",
		IOSP95: 2340, AndroidP95: 890,
		AndroidP95Low: 850, AndroidP95High: 920,
		BaselineP95: 900, RisenP95: 2000,
		NewVersion: "4.1.0", OldVersion: "4.0.2",
		NewVersionP95: 2610, OldVersionP95: 910,
		NewVersionP50: 1480,
		RolloutDay:    rollout,
		Unavailable:   503, Conflict: 409,
		Burst: 1204, AndroidBurst: 37,
		BurstStart: "14:00", BurstEnd: "16:00",
		ValidatePath:       "/v2/cart/validate",
		ValidateP50:        620,
		NewVersionSessions: 1240,
		OldVersionSessions: 760,
		Succeeded:          6840, Conflicts: 71,
		OtherFailures: 5,
		DailyP95: []dayCount{
			{rollout.AddDate(0, 0, -4), 905}, {rollout.AddDate(0, 0, -3), 890}, {rollout.AddDate(0, 0, -2), 910},
			{rollout.AddDate(0, 0, -1), 900}, {rollout, 2100}, {rollout.AddDate(0, 0, 1), 2600},
		},
	}

	history := renderMessages(latencyThread, []chatMessage{
		userMsg("Why is checkout slow on iOS this week?"),
		toolCallMsg("call_1", "get_network_metrics_trends", `{"app_id":"{{.IOSAppID}}","from":"{{rfc .From}}","to":"{{rfc .To}}"}`),
		toolResultMsg("call_1", `{"slowest":[{"method":"{{.Method}}","path":"{{.Endpoint}}","p95_ms":{{.IOSP95}},"count":{{.Requests}}}]}`),
		assistantMsg(`Over the last 7 days, {{day .From}} to {{day .To}}, {{.From.Year}} UTC, {{.Method}} {{.Endpoint}} is the slowest endpoint in Shopper (com.shopper.ios), with a p95 latency of {{number .IOSP95}} ms against {{number .AndroidP95}} ms for the same endpoint on Android. Its p95 was around {{number .BaselineP95}} ms until {{day .DayBeforeRollout}} and rose to over {{number .RisenP95}} ms from {{day .RolloutDay}}, which is when version {{.NewVersion}} started rolling out. Requests from {{.NewVersion}} have a p95 of {{number .NewVersionP95}} ms, while {{.OldVersion}} is at {{number .OldVersionP95}} ms.`),
		userMsg("Are there errors on that endpoint too?"),
		toolCallMsg("call_2", "get_network_endpoint_status_codes_over_time", `{"app_id":"{{.IOSAppID}}","method":"{{.Method}}","path":"{{.Endpoint}}","from":"{{rfc .From}}","to":"{{rfc .To}}"}`),
		toolResultMsg("call_2", `[{"date":"{{iso .RolloutDay}}","status_code":{{.Unavailable}},"count":{{.Burst}}},{"date":"{{iso .DayBeforeRollout}}","status_code":{{.Unavailable}},"count":14}]`),
		assistantMsg(`Yes. On {{day .RolloutDay}} the endpoint returned {{number .Burst}} HTTP {{.Unavailable}} responses on iOS, against fewer than 20 on each other day. Android saw {{.AndroidBurst}} {{.Unavailable}}s that day. The {{.Unavailable}}s all came between {{.BurstStart}} and {{.BurstEnd}} UTC.`),
		userMsg(`Could the {{.Unavailable}}s be from a backend deploy?`),
		assistantMsg(`I can't tell. Measure only sees the app's side of the requests, so I have no record of backend deploys. The timing, a burst on {{day .RolloutDay}} affecting both platforms, fits a backend incident better than an app change, but you would need to check your deploy history for {{.BurstStart}} to {{.BurstEnd}} UTC on {{day .RolloutDay}}.`),
		userMsg(`What changed in {{.NewVersion}} for checkout?`),
		toolCallMsg("call_3", "get_network_timeline", `{"app_id":"{{.IOSAppID}}","from":"{{rfc .RolloutDay}}","to":"{{rfc .To}}","filter_expr":"app_version:in:[{{.NewVersion}}]"}`),
		toolResultMsg("call_3", `[{"method":"GET","path":"{{.ValidatePath}}","p50_ms":{{.ValidateP50}}},{"method":"{{.Method}}","path":"{{.Endpoint}}","p50_ms":{{.NewVersionP50}}}]`),
		assistantMsg(`Measure doesn't have release notes, but the requests show a difference: in {{.NewVersion}} each checkout makes a GET {{.ValidatePath}} call before {{.Method}} {{.Endpoint}}, adding a median of {{.ValidateP50}} ms. Version {{.OldVersion}} does not make that call. That extra request accounts for most of the latency increase.`),
		userMsg(`How many users are on {{.NewVersion}} now?`),
		toolCallMsg("call_4", "get_filter_values", `{"app_id":"{{.IOSAppID}}","key":"app_version","entity":"sessions"}`),
		toolResultMsg("call_4", `[{"value":"{{.NewVersion}}","sessions":{{.NewVersionSessions}}},{"value":"{{.OldVersion}}","sessions":{{.OldVersionSessions}}}]`),
		assistantMsg(`Version {{.NewVersion}} accounts for {{.NewVersionShare}}% of iOS sessions over the last 7 days, {{number .NewVersionSessions}} of {{number .IOSSessions}}. The rest are on {{.OldVersion}}. Since {{.NewVersion}} only started rolling out on {{day .RolloutDay}}, its share of daily sessions is now well above that.`),
		userMsg("Is Android affected by the validate call too?"),
		toolCallMsg("call_5", "get_network_timeline", `{"app_id":"{{.AndroidAppID}}","from":"{{rfc .From}}","to":"{{rfc .To}}"}`),
		toolResultMsg("call_5", `[{"method":"{{.Method}}","path":"{{.Endpoint}}","p95_ms":{{.AndroidP95}}}]`),
		assistantMsg(`No. Shopper (com.shopper.android) does not call GET {{.ValidatePath}} in any version, and its {{.Method}} {{.Endpoint}} p95 has stayed between {{.AndroidP95Low}} and {{.AndroidP95High}} ms all week.`),
		userMsg("What's the success rate of checkout on iOS?"),
		toolCallMsg("call_6", "get_network_endpoint_status_codes_over_time", `{"app_id":"{{.IOSAppID}}","method":"{{.Method}}","path":"{{.Endpoint}}","from":"{{rfc .From}}","to":"{{rfc .To}}"}`),
		toolResultMsg("call_6", `{"total":{{.Requests}},"2xx":{{.Succeeded}},"{{.Conflict}}":{{.Conflicts}},"{{.Unavailable}}":{{.Burst}},"other":{{.OtherFailures}}}`),
		assistantMsg(`Including the {{.Unavailable}} burst on {{day .RolloutDay}}, {{number .SuccessRate}}% of the {{number .Requests}} {{.Method}} {{.Endpoint}} requests on iOS this week returned a 2xx response. Excluding it, the rate is {{number .SuccessRateWithoutBurst}}%. Most of the other failures are {{.Conflict}} responses, {{.Conflicts}} in total, which the app gets when the cart changed between validation and checkout.`),
		userMsg("Draw me the daily p95 for checkout on iOS."),
		toolCallMsg("call_7", "render_chart", `{"title":"iOS {{.Method}} {{.Endpoint}} p95 (ms)","kind":"line","labels":[{{range $i, $d := .DailyP95}}{{if $i}},{{end}}"{{day $d.Day}}"{{end}}],"series":[{"name":"p95","values":[{{range $i, $d := .DailyP95}}{{if $i}},{{end}}{{$d.Count}}{{end}}]}]}`),
		toolResultMsg("call_7", `Chart "iOS {{.Method}} {{.Endpoint}} p95 (ms)" rendered. It is posted below this reply: mention it as the chart below, never as an image above, and don't repeat every value from it.`),
		assistantMsg(`The chart below shows the daily p95 of {{.Method}} {{.Endpoint}} on iOS. It stays near {{number .BaselineP95}} ms until {{day .DayBeforeRollout}}, then climbs from {{day .RolloutDay}} as more users move to {{.NewVersion}}.`),
		userMsg(`Can you show me the slowest sessions from {{.NewVersion}}?`),
	})

	// The invented summary changes one figure no claim covers to a number the
	// conversation does not contain, so only the check for invented numbers
	// can fail it. The number is far from the real figure, so it cannot pass
	// as a rounding of it. The misattributed summary gives that figure a
	// number from the conversation that belongs to another fact.
	summary := `Shopper iOS (com.shopper.ios), last 7 days, {{day .From}} to {{day .To}}, {{.From.Year}} UTC.
- {{.Method}} {{.Endpoint}} is the slowest iOS endpoint with a p95 of {{number .IOSP95}} ms, against {{number .AndroidP95}} ms on Android. Its p95 rose from about {{number .BaselineP95}} ms to over {{number .RisenP95}} ms from {{day .RolloutDay}}, when version {{.NewVersion}} started rolling out ({{.NewVersion}} at {{number .NewVersionP95}} ms, {{.OldVersion}} at {{number .OldVersionP95}} ms).
- On {{day .RolloutDay}} the endpoint returned {{number .Burst}} HTTP {{.Unavailable}} responses on iOS between {{.BurstStart}} and {{.BurstEnd}} UTC; Android saw {{.AndroidBurst}}.
- Open question: whether a backend deploy caused the {{.Unavailable}}s is unresolved; Measure has no deploy records.
- {{.NewVersion}} adds a GET {{.ValidatePath}} call before checkout, adding a median of {{.ValidateP50}} ms. Android does not make this call.
- {{.NewVersion}} has {{.NewVersionShare}}% of iOS sessions, {{number .NewVersionSessions}} of {{number .IOSSessions}}.
- Success rate {{number .SuccessRate}}% including the {{.Unavailable}} burst, {{number .SuccessRateWithoutBurst}}% excluding it; {{.Conflicts}} responses were {{.Conflict}}s, returned when the cart changed between validation and checkout.
`
	deployOpen := states(fmt.Sprintf("says it is still unresolved whether a backend deploy caused the %d responses", latencyThread.Unavailable))
	compactionCase := compactionCase{
		id:          "checkout-latency",
		description: "A thread on slow checkout requests on iOS: latency by version, a burst of 503s, an unresolved deploy question, the cause, adoption of the new version, Android, success rates and a chart.",
		history:     history,
		claims: []evalClaim{
			states(fmt.Sprintf("says %s %s on iOS has a p95 latency of %d ms", latencyThread.Method, latencyThread.Endpoint, latencyThread.IOSP95),
				nameAnchor(latencyThread.Endpoint), numberAnchor(latencyThread.IOSP95)),
			states(fmt.Sprintf("says the same endpoint has a p95 latency of %d ms on Android", latencyThread.AndroidP95), numberAnchor(latencyThread.AndroidP95)),
			states(fmt.Sprintf("says the latency rose with version %s of the iOS app", latencyThread.NewVersion), versionAnchor(latencyThread.NewVersion)),
			states(fmt.Sprintf("says the endpoint returned %d HTTP %d responses on iOS in one day", latencyThread.Burst, latencyThread.Unavailable),
				numberAnchor(latencyThread.Burst), numberAnchor(latencyThread.Unavailable)),
			states(fmt.Sprintf("says version %s adds a GET %s call that adds a median of %d ms", latencyThread.NewVersion, latencyThread.ValidatePath, latencyThread.ValidateP50),
				nameAnchor(latencyThread.ValidatePath), numberAnchor(latencyThread.ValidateP50)),
			states(fmt.Sprintf("says %d responses happen when the cart changed between validation and checkout", latencyThread.Conflict), numberAnchor(latencyThread.Conflict)),
			deployOpen,
		},
	}
	invented, misattributed := latencyThread, latencyThread
	invented.AndroidBurst = numberNotIn(compactionCase.transcript(), 13*latencyThread.AndroidBurst+7)
	misattributed.AndroidBurst = latencyThread.Conflicts
	compactionCase.fixtures = []judgeFixture{
		{name: "complete summary", text: renderTemplate(latencyThread, summary)},
		{name: "invented number", failsOn: inventedNumberClaim(strconv.Itoa(invented.AndroidBurst)), text: renderTemplate(invented, summary)},
		{name: "misattributed number", failsOn: misattributedFigureClaim, text: renderTemplate(misattributed, summary)},
		{name: "open question closed", failsOn: deployOpen, text: replaceOnce(renderTemplate(latencyThread, summary),
			renderTemplate(latencyThread, "- Open question: whether a backend deploy caused the {{.Unavailable}}s is unresolved; Measure has no deploy records."),
			renderTemplate(latencyThread, "- The {{.Unavailable}}s were caused by a backend deploy."))},
	}
	return compactionCase
}

func numberNotIn(transcript string, n int) int {
	known := numbersIn(transcript)
	for slices.Contains(known, strconv.Itoa(n)) {
		n++
	}
	return n
}

var templateFuncs = texttemplate.FuncMap{
	"number": func(value any) string {
		switch value := value.(type) {
		case int:
			return withThousandsSeparators(value)
		case float64:
			return strconv.FormatFloat(value, 'f', -1, 64)
		}
		return fmt.Sprint(value)
	},
	"day": func(t time.Time) string { return t.Format("Jan 2") },
	"iso": func(t time.Time) string { return t.Format("2006-01-02") },
	"rfc": func(t time.Time) string { return t.Format(time.RFC3339) },
	"json": func(value any) (string, error) {
		b, err := json.Marshal(value)
		return string(b), err
	},
}

// renderTemplate renders text as a template over data. A template that fails to render
// is a mistake in the case, so it panics.
func renderTemplate(data any, text string) string {
	var b bytes.Buffer
	if err := texttemplate.Must(texttemplate.New("").Funcs(templateFuncs).Parse(text)).Execute(&b, data); err != nil {
		panic(err)
	}
	return b.String()
}

// replaceOnce replaces old in s with new, and panics when s does not contain
// old, since a fixture built from it would then test nothing.
func replaceOnce(s, old, new string) string {
	if !strings.Contains(s, old) {
		panic(fmt.Sprintf("%q is not in %q", old, s))
	}
	return strings.Replace(s, old, new, 1)
}

func renderMessages(data any, messages []chatMessage) []chatMessage {
	for i := range messages {
		messages[i].Content = renderTemplate(data, messages[i].Content)
		for j := range messages[i].ToolCalls {
			messages[i].ToolCalls[j].Function.Arguments = renderTemplate(data, messages[i].ToolCalls[j].Function.Arguments)
		}
	}
	return messages
}

func withThousandsSeparators(n int) string {
	digits := strconv.Itoa(n)
	for i := len(digits) - 3; i > 0; i -= 3 {
		digits = digits[:i] + "," + digits[i:]
	}
	return digits
}

func roundToTenth(value float64) float64 { return math.Round(value*10) / 10 }

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
func runCompactionCase(ctx context.Context, t *testing.T, config *Config, evalCostProxy *evalCostProxy, conv *conversation, compactionCase compactionCase) evalRun {
	t.Helper()
	if err := config.createConversation(ctx, conv, compactionCase.id); err != nil {
		t.Fatalf("createConversation: %v", err)
	}
	// Assistant messages are stored with a model and usage, as a real turn
	// stores them; appendMessages saves token counts only for those.
	stored := make([]storedMessage, len(compactionCase.history))
	lastAssistant := -1
	for i, message := range compactionCase.history {
		stored[i] = storedMessage{msg: message}
		if message.Role == "assistant" {
			stored[i].model = config.ModelMedium
			stored[i].usage = chatUsage{PromptTokens: 12000, CompletionTokens: 300}
			lastAssistant = i
		}
	}
	stored[lastAssistant].usage = chatUsage{PromptTokens: compactionThresholdTokens, CompletionTokens: 500}
	if err := config.appendMessages(ctx, conv.ID, stored); err != nil {
		t.Fatalf("appendMessages: %v", err)
	}
	history, err := config.loadMessages(ctx, conv.ID)
	if err != nil {
		t.Fatalf("loadMessages: %v", err)
	}

	// The conversation id is what the cost proxy files the call's cost under.
	ctx = withConversationID(ctx, conv.ID.String())
	start := time.Now()
	compacted, usage := config.compactIfNeeded(ctx, conv.ID, history)
	evalRun := evalRun{
		llmCalls: 1,
		tokens:   usage.prompt + usage.completion,
		cost:     evalCostProxy.conversationCost(conv.ID.String()),
		duration: time.Since(start),
	}
	if len(compacted) == 0 || !compacted[0].summary {
		evalRun.err = fmt.Errorf("no summary was produced, see the log for the compaction error")
		return evalRun
	}
	evalRun.answer = strings.TrimPrefix(compacted[0].msg.Content, "Summary of the conversation so far: ")
	return evalRun
}

var numberPattern = regexp.MustCompile(`(^|[^\p{L}\d.,])(\d+(?:[.,]\d+)*)`)

// numbersIn returns the numbers in text, without thousands separators.
// It leaves out ids and digits that follow a letter, such as p50 or v2, which
// are not numbers. A date or a time gives one number per part.
func numbersIn(text string) []string {
	var tokens []string
	for _, match := range numberPattern.FindAllStringSubmatch(uuidPattern.ReplaceAllString(text, ""), -1) {
		tokens = append(tokens, strings.ReplaceAll(match[2], ",", ""))
	}
	return tokens
}

// inventedNumberClaims passes every number in the summary that the transcript also
// contains, and every number below 10, since summaries number their points.
// The other numbers become claims for the judge, since a rounding of the
// conversation's figures is not an invention and only the judge can tell the
// two apart.
func inventedNumberClaims(transcript string) func(answer string) []evalClaim {
	known := numbersIn(transcript)
	return func(answer string) []evalClaim {
		var claims []evalClaim
		seen := map[string]bool{}
		for _, n := range numbersIn(answer) {
			if v, err := strconv.ParseFloat(n, 64); err == nil && v < 10 {
				continue
			}
			if slices.Contains(known, n) || seen[n] {
				continue
			}
			seen[n] = true
			claims = append(claims, inventedNumberClaim(n))
		}
		return claims
	}
}

// inventedNumberClaim excuses a computed value only when the summary says what it
// computed, so a number that happens to equal some sum or difference of the
// conversation's figures is not excused on its own.
func inventedNumberClaim(n string) evalClaim {
	return forbids(
		fmt.Sprintf("gives %s as a figure that is not in the conversation and is not a rounding of a figure in it; a value the summary itself describes as computed from the conversation's figures, such as a difference or ratio it names, or a number inside a date or time the conversation gives, does not count", n),
		evalAnchor{description: n, match: func(text string) bool { return slices.Contains(numbersIn(text), n) }})
}

// A summary is roughly the same length whatever it summarizes, so the cases'
// short conversations cannot show whether it shrinks a real one;
// maxSummaryChars catches a summary too long to free much context.
const maxSummaryChars = 4000

// shorterThan checks that the summary is shorter than the transcript, which
// fails a model that repeats the conversation back or adds to it.
func shorterThan(transcript string) evalCheck {
	return func(evalRun evalRun) string {
		if len(evalRun.answer) >= len(transcript) {
			return fmt.Sprintf("summary is %d characters, as long as the %d-character conversation", len(evalRun.answer), len(transcript))
		}
		return ""
	}
}

func atMostChars(n int) evalCheck {
	return func(evalRun evalRun) string {
		if len(evalRun.answer) > n {
			return fmt.Sprintf("summary is %d characters, want at most %d", len(evalRun.answer), n)
		}
		return ""
	}
}
