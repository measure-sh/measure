//go:build eval

package agent

import (
	"cmp"
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"

	"backend/libs/measure"
	"backend/testinfra"

	"github.com/google/uuid"
)

func TestEvalFunnels(t *testing.T) {
	env := newEvalEnv(t, "LLM_AGENT_MODEL_MEDIUM")
	surfaces := evalSurfaces(t)
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	config := env.config(env.models[0])
	funnelWorld := seedFunnelWorld(ctx, t)
	seedCheckoutTelemetry(ctx, t, funnelWorld)
	checkCheckoutTelemetry(ctx, t, config, funnelWorld)
	funnelCases := funnelEvalCases(funnelWorld)
	checkFunnelToolCoverage(t, config, funnelCases)

	internals := hidesInternals(internalsPattern(ctx, t, config))
	cases := make([]evalCase, len(funnelCases))
	for i, funnelCase := range funnelCases {
		evalCase := funnelCase.evalCase
		for _, tools := range funnelCase.tools {
			evalCase.checks = append(evalCase.checks, usesAnyTool(tools...))
		}
		evalCase.checks = append([]evalCheck{internals}, evalCase.checks...)
		evalCase.claims = append(evalCase.claims, evalShowsInternals)
		evalCase.textDescription = evalCase.describeText() + "\nThe team's apps are Shopper for Android (com.shopper.android) and Shopper for iOS (com.shopper.ios).\n"
		cases[i] = evalCase
	}
	checkExpectedCounts(t, cases, checkoutSeededCounts(funnelWorld))
	env.calibrateJudge(ctx, t, cases)

	started := time.Now()
	results := env.collect(t, func(t *testing.T, record func(evalResult)) {
		for _, model := range env.models {
			config := env.config(model)
			t.Run(strings.ReplaceAll(model, "/", "_"), func(t *testing.T) {
				t.Parallel()
				for i, evalCase := range cases {
					t.Run(evalCase.id, func(t *testing.T) {
						t.Parallel()
						for _, surface := range evalCase.surfaces(surfaces) {
							t.Run(surface, func(t *testing.T) {
								t.Parallel()
								for trial := range env.trials {
									t.Run(strconv.Itoa(trial+1), func(t *testing.T) {
										t.Parallel()
										evalRun := runFunnelCase(ctx, t, config, env.evalCostProxy, funnelWorld, funnelCases[i], evalCase, surface)
										record(env.gradeEvalRun(ctx, t, model, evalCase, surface, trial, evalRun))
									})
								}
							})
						}
					})
				}
			})
		}
	})
	env.report(t, "funnels", started, surfaces, cases, results)
}

// funnelCase is an evalCase with the funnel tools it must call: for each
// entry in tools, the run must call at least one of its tools. A case that
// changesFunnels runs every trial in a world of its own, so its changes stay
// out of the funnels the other cases and trials read, and its checks read
// the funnels as the trial left them.
type funnelCase struct {
	evalCase
	tools          [][]string
	changesFunnels bool
}

func runFunnelCase(ctx context.Context, t *testing.T, config *Config, evalCostProxy *evalCostProxy, funnelWorld funnelWorld, funnelCase funnelCase, evalCase evalCase, surface string) evalRun {
	t.Helper()
	if !funnelCase.changesFunnels {
		return runEvalCase(ctx, t, config, evalCostProxy, funnelWorld.evalWorld, evalCase, surface)
	}
	funnelWorld = seedFunnelWorld(ctx, t)
	seedFunnelEventNames(ctx, t, funnelWorld)
	evalRun := runEvalCase(ctx, t, config, evalCostProxy, funnelWorld.evalWorld, evalCase, surface)
	funnels, _, _, err := measure.GetFunnels(ctx, th.PgPool, funnelWorld.android, "", 30, 0)
	if err != nil {
		t.Fatalf("load funnels: %v", err)
	}
	evalRun.funnels = funnels
	return evalRun
}

// checkFunnelToolCoverage fails the test when a funnel tool is in no case's
// tools, so a new funnel tool comes with a case.
func checkFunnelToolCoverage(t *testing.T, config *Config, funnelCases []funnelCase) {
	t.Helper()
	covered := map[string]bool{}
	for _, funnelCase := range funnelCases {
		for _, tools := range funnelCase.tools {
			for _, tool := range tools {
				covered[tool] = true
			}
		}
	}
	for name := range config.commonToolIndex {
		if strings.Contains(name, "funnel") && !covered[name] {
			t.Fatalf("no funnel eval case calls %s", name)
		}
	}
}

type funnelDefinition struct {
	name   string
	steps  []string
	window time.Duration
}

var (
	onboardingFunnel = funnelDefinition{"Onboarding", []string{"app_opened", "signup_completed"}, 24 * time.Hour}
	checkoutFunnel   = funnelDefinition{"Checkout", []string{"product_viewed", "cart_item_added", "order_completed"}, time.Hour}
	searchFunnel     = funnelDefinition{"Search", []string{"search_started", "search_result_opened"}, 30 * time.Minute}
	// wishlistFunnel is the iOS app's, so an answer about the Android app's
	// funnels must leave it out.
	wishlistFunnel = funnelDefinition{"Wishlist", []string{"wishlist_opened", "wishlist_item_added"}, time.Hour}
)

// funnelCreatorEmail is the address of the teammate who created the Checkout
// funnel. Every other funnel is created by the user asking the questions.
const funnelCreatorEmail = "maya@shopper.dev"

type funnelWorld struct {
	evalWorld
	checkoutID uuid.UUID
}

// seedFunnelWorld creates the team, its two apps and their funnels. The
// Android app pins Onboarding first and Checkout second, and leaves Search
// unpinned.
func seedFunnelWorld(ctx context.Context, t *testing.T) funnelWorld {
	t.Helper()
	funnelWorld := funnelWorld{evalWorld: evalWorld{teamID: uuid.New(), userID: uuid.New(), android: uuid.New(), ios: uuid.New(), seededAt: time.Now().UTC()}}
	creatorID := uuid.New()
	th.SeedTeam(ctx, t, funnelWorld.teamID.String(), "Shopper")
	th.SeedUser(ctx, t, funnelWorld.userID.String(), "eval@shopper.dev")
	th.SeedUser(ctx, t, creatorID.String(), funnelCreatorEmail)
	th.SeedTeamMembership(ctx, t, funnelWorld.teamID.String(), funnelWorld.userID.String(), "owner")
	th.SeedTeamMembership(ctx, t, funnelWorld.teamID.String(), creatorID.String(), "developer")
	seedEvalApp(ctx, t, funnelWorld.teamID, funnelWorld.android, "Shopper", "com.shopper.android", "android")
	seedEvalApp(ctx, t, funnelWorld.teamID, funnelWorld.ios, "Shopper", "com.shopper.ios", "ios")

	createFunnel := func(appID, userID uuid.UUID, funnelDefinition funnelDefinition) measure.Funnel {
		draft := measure.FunnelDraft{Name: funnelDefinition.name, ConversionWindowSeconds: int(funnelDefinition.window.Seconds())}
		for _, step := range funnelDefinition.steps {
			draft.Steps = append(draft.Steps, measure.FunnelStep{EventName: step})
		}
		funnel, err := measure.CreateFunnel(ctx, th.PgPool, appID, userID.String(), draft)
		if err != nil {
			t.Fatalf("create funnel %s: %v", funnelDefinition.name, err)
		}
		return funnel
	}
	onboarding := createFunnel(funnelWorld.android, funnelWorld.userID, onboardingFunnel)
	checkout := createFunnel(funnelWorld.android, creatorID, checkoutFunnel)
	createFunnel(funnelWorld.android, funnelWorld.userID, searchFunnel)
	createFunnel(funnelWorld.ios, funnelWorld.userID, wishlistFunnel)
	for _, funnel := range []measure.Funnel{onboarding, checkout} {
		if _, err := measure.SetFunnelPinned(ctx, th.PgPool, funnelWorld.android, funnel.ID, true); err != nil {
			t.Fatalf("pin funnel %s: %v", funnel.Name, err)
		}
	}
	funnelWorld.checkoutID = checkout.ID
	return funnelWorld
}

// funnelDistractorEvents are custom event names close to the ones the create
// case asks for, so the model has to pick the right ones.
var funnelDistractorEvents = []string{"search_cleared", "order_cancelled", "checkout_abandoned"}

// seedFunnelEventNames sends each custom event name the Android app's funnels
// use once, along with funnelDistractorEvents, so the event names a model
// looks up before creating a funnel include them.
func seedFunnelEventNames(ctx context.Context, t *testing.T, funnelWorld funnelWorld) {
	t.Helper()
	names := slices.Clone(funnelDistractorEvents)
	for _, funnelDefinition := range []funnelDefinition{onboardingFunnel, checkoutFunnel, searchFunnel} {
		names = append(names, funnelDefinition.steps...)
	}
	for _, name := range names {
		seedEvalEvents(ctx, t, funnelWorld.evalWorld, evalAndroidDevice, 1, testinfra.EventRow{Type: "custom", CustomName: name, Timestamp: funnelWorld.seededDay(0)})
	}
}

// checkoutCohort is users who enter the Checkout funnel together, one every
// 20 seconds from start. The first carted of them add the product to the
// cart a minute after viewing it, and the first ordered of those complete the
// order a minute after that. Only a cohort with telemetry records the errors,
// spans and requests the step cases ask about.
type checkoutCohort struct {
	start                    time.Time
	entered, carted, ordered int
	telemetry                bool
}

// The users who drop off between the cart and the order are the cohort's
// later users, so the most recent drop-offs are the last users who carted.
// The first two of them leave without the crash, so the count of users who
// hit it differs from the count of users who dropped off.
func (c checkoutCohort) crashed(user int) bool  { return user >= c.ordered+2 && user < c.carted }
func (c checkoutCohort) timedOut(user int) bool { return user < c.ordered && user%2 == 0 }

// checkoutWorstDay is the day in the last 7 days whose cohort converts worst,
// the day checkoutRelease was uploaded.
const checkoutWorstDay = 3

const checkoutRelease, checkoutReleaseCode = "2.4.0", "240"

// The cohorts of the last 7 days enter each day at noon. The cadence cohorts
// enter on Tuesdays at 19:00 UTC, two to five weeks before the current week,
// so that none of them is in the last 7 days, and the cadence over the last
// 4 weeks has more users at that hour than at any other.
func checkoutCohorts(funnelWorld funnelWorld) []checkoutCohort {
	var cohorts []checkoutCohort
	for day := range evalDays {
		ordered := 25
		if day == checkoutWorstDay {
			ordered = 5
		}
		cohorts = append(cohorts, checkoutCohort{start: funnelWorld.seededDay(day), entered: 60, carted: 50, ordered: ordered, telemetry: true})
	}
	today := funnelWorld.seededAt.Truncate(24 * time.Hour)
	monday := today.AddDate(0, 0, -((int(today.Weekday()) + 6) % 7))
	for weeksAgo := 2; weeksAgo <= 5; weeksAgo++ {
		cohorts = append(cohorts, checkoutCohort{start: monday.AddDate(0, 0, 1-7*weeksAgo).Add(19 * time.Hour), entered: 50, carted: 40, ordered: 20})
	}
	return cohorts
}

func checkoutUserID(number int) string { return fmt.Sprintf("cust-%d", 1000+number) }

const (
	checkoutHomeSpan         = "home_feed_load"
	checkoutHomeMs           = 300
	checkoutProductSpan      = "product_detail_load"
	checkoutProductDroppedMs = 4200
	checkoutProductCartedMs  = 600
	checkoutDomain           = "api.shopper.dev"
	checkoutCartPath         = "/v1/cart"
	checkoutCartMs           = 200
	checkoutPaymentsPath     = "/v1/payments"
	checkoutPaymentDroppedMs = 9000
	checkoutPaymentOrderedMs = 450
)

// The users who drop off between the cart and the order hit evalPaymentCrash,
// and the users who complete the order hit evalRecommendationsTimeout, so
// the timeout is unrelated to the drop-off. product_detail_load is
// slow only for the users who drop off before the cart, and /v1/payments only
// for those who drop off before the order; home_feed_load and /v1/cart take
// as long for everyone.
func seedCheckoutTelemetry(ctx context.Context, t *testing.T, funnelWorld funnelWorld) {
	t.Helper()
	seedEvalErrorGroup(ctx, t, funnelWorld.evalWorld, evalPaymentCrash)
	seedEvalErrorGroup(ctx, t, funnelWorld.evalWorld, evalRecommendationsTimeout)
	for _, path := range []string{checkoutCartPath, checkoutPaymentsPath} {
		th.SeedUrlPattern(ctx, t, funnelWorld.teamID.String(), funnelWorld.android.String(), checkoutDomain, path)
	}
	releasedAt := funnelWorld.seededDay(checkoutWorstDay).Add(-4 * time.Hour)
	th.SeedBuildMappingRow(ctx, t, uuid.NewString(), funnelWorld.android.String(), checkoutRelease, checkoutReleaseCode, "proguard", "mapping-"+checkoutReleaseCode+".txt", uuid.Nil.String(), "", releasedAt)

	number := 0
	for _, cohort := range checkoutCohorts(funnelWorld) {
		for user := range cohort.entered {
			installationID, sessionID, userID := uuid.NewString(), uuid.NewString(), checkoutUserID(number)
			number++
			viewed := cohort.start.Add(time.Duration(user) * 20 * time.Second)
			event := func(row testinfra.EventRow, after time.Duration) {
				row.InstallationID, row.SessionID, row.UserID, row.Timestamp = installationID, sessionID, userID, viewed.Add(after)
				seedEvalEvents(ctx, t, funnelWorld.evalWorld, evalAndroidDevice, 1, row)
			}
			span := func(name string, after time.Duration, durationMs int) {
				th.SeedSpanRows(ctx, t, funnelWorld.teamID.String(), funnelWorld.android.String(), 1, testinfra.SpanRow{
					SpanName: name, InstallationID: installationID, SessionID: sessionID,
					StartTime: viewed.Add(after), Duration: time.Duration(durationMs) * time.Millisecond,
					AppVersion: evalAndroidDevice.appVersion, AppBuild: evalAndroidDevice.appBuild,
					OSName: evalAndroidDevice.osName, OSVersion: evalAndroidDevice.osVersion,
				})
			}
			request := func(path string, after time.Duration, latencyMs int) {
				event(testinfra.EventRow{Type: "http", HttpURL: "https://" + checkoutDomain + path, HttpMethod: "post", HttpStatusCode: 200,
					HttpStartTime: 1000, HttpEndTime: 1000 + uint64(latencyMs)}, after)
			}
			errorEvent := func(evalError evalError) {
				event(testinfra.EventRow{Type: evalError.eventType(), Fingerprint: evalError.fingerprint, Handled: evalError.handled()}, 90*time.Second)
			}
			carted, ordered := user < cohort.carted, user < cohort.ordered

			event(testinfra.EventRow{Type: "custom", CustomName: checkoutFunnel.steps[0]}, 0)
			if carted {
				event(testinfra.EventRow{Type: "custom", CustomName: checkoutFunnel.steps[1]}, time.Minute)
			}
			if ordered {
				event(testinfra.EventRow{Type: "custom", CustomName: checkoutFunnel.steps[2]}, 2*time.Minute)
			}
			if !cohort.telemetry {
				continue
			}
			productMs, paymentMs := checkoutProductDroppedMs, checkoutPaymentDroppedMs
			if carted {
				productMs = checkoutProductCartedMs
			}
			if ordered {
				paymentMs = checkoutPaymentOrderedMs
			}
			span(checkoutHomeSpan, 10*time.Second, checkoutHomeMs)
			span(checkoutProductSpan, 15*time.Second, productMs)
			if !carted {
				continue
			}
			request(checkoutCartPath, 65*time.Second, checkoutCartMs)
			request(checkoutPaymentsPath, 70*time.Second, paymentMs)
			if cohort.crashed(user) {
				errorEvent(evalPaymentCrash)
			}
			if cohort.timedOut(user) {
				errorEvent(evalRecommendationsTimeout)
			}
		}
	}
}

// checkoutExpected is what the Checkout funnel's tools report for the last
// 7 days.
type checkoutExpected struct {
	entered, carted, ordered int
	crashedDropped           int
	timedOutOrdered          int
	worstDate                time.Time
	worstConversion          float64
	// latestDropped are the user ids of the three users who most recently
	// dropped off between the cart and the order, newest first, and
	// latestOrdered is the user id of the user who most recently completed
	// the order.
	latestDropped []string
	latestOrdered string
}

func (e checkoutExpected) conversion() float64 { return 100 * float64(e.ordered) / float64(e.entered) }

func expectCheckout(funnelWorld funnelWorld) checkoutExpected {
	checkoutExpected := checkoutExpected{worstDate: funnelWorld.seededDay(checkoutWorstDay)}
	number := 0
	for i, cohort := range checkoutCohorts(funnelWorld) {
		first := number
		number += cohort.entered
		if !cohort.telemetry {
			continue
		}
		checkoutExpected.entered += cohort.entered
		checkoutExpected.carted += cohort.carted
		checkoutExpected.ordered += cohort.ordered
		for user := range cohort.entered {
			if cohort.crashed(user) {
				checkoutExpected.crashedDropped++
			}
			if cohort.timedOut(user) {
				checkoutExpected.timedOutOrdered++
			}
		}
		if i == checkoutWorstDay {
			checkoutExpected.worstConversion = 100 * float64(cohort.ordered) / float64(cohort.entered)
		}
		// The first cohort is the most recent one.
		if i == 0 {
			for user := cohort.carted - 1; user >= cohort.carted-3; user-- {
				checkoutExpected.latestDropped = append(checkoutExpected.latestDropped, checkoutUserID(first+user))
			}
			checkoutExpected.latestOrdered = checkoutUserID(first + cohort.ordered - 1)
		}
	}
	return checkoutExpected
}

// checkoutSeededCounts are the Checkout funnel's counts that no case
// expects, which an expected count must differ from.
func checkoutSeededCounts(funnelWorld funnelWorld) []int {
	checkoutExpected := expectCheckout(funnelWorld)
	counts := []int{
		checkoutExpected.carted, checkoutExpected.ordered, checkoutExpected.timedOutOrdered,
		checkoutExpected.entered - checkoutExpected.carted, checkoutExpected.carted - checkoutExpected.ordered,
	}
	for _, cohort := range checkoutCohorts(funnelWorld) {
		counts = append(counts, cohort.entered, cohort.carted, cohort.ordered)
	}
	return counts
}

// checkCheckoutTelemetry fails the test when the funnel tools do not report
// what the cases expect of the seeded telemetry, which would otherwise fail
// every model.
func checkCheckoutTelemetry(ctx context.Context, t *testing.T, config *Config, funnelWorld funnelWorld) {
	t.Helper()
	ctx = WithUserID(ctx, funnelWorld.userID.String())
	call := func(tool string, args map[string]any, out any) {
		t.Helper()
		args["app_id"], args["funnel_id"] = funnelWorld.android.String(), funnelWorld.checkoutID.String()
		raw, _ := json.Marshal(args)
		result, err := config.commonToolIndex[tool].call(ctx, raw)
		if err != nil {
			t.Fatalf("%s: %v", tool, err)
		}
		if err := json.Unmarshal([]byte(result), out); err != nil {
			t.Fatalf("%s returned %q: %v", tool, result, err)
		}
	}
	checkoutExpected := expectCheckout(funnelWorld)

	var conversion struct {
		Steps []measure.FunnelStepConversion `json:"steps"`
	}
	call("get_funnel_conversion", map[string]any{}, &conversion)
	var users []int
	for _, step := range conversion.Steps {
		users = append(users, int(step.Users))
	}
	if want := []int{checkoutExpected.entered, checkoutExpected.carted, checkoutExpected.ordered}; !slices.Equal(users, want) {
		t.Fatalf("get_funnel_conversion counts %v users at each step, want %v", users, want)
	}

	var trend measure.FunnelTrend
	call("get_funnel_trend", map[string]any{"period": "day", "timezone": "UTC", "include_builds": true}, &trend)
	worstDay := checkoutExpected.worstDate.Format("2006-01-02")
	point := slices.IndexFunc(trend.Points, func(point measure.FunnelTrendPoint) bool { return strings.HasPrefix(point.Datetime, worstDay) })
	worstOrdered := checkoutCohorts(funnelWorld)[checkoutWorstDay].ordered
	if point < 0 || len(trend.Points[point].Steps) != 3 || int(trend.Points[point].Steps[2].Users) != worstOrdered {
		t.Fatalf("get_funnel_trend has no point for %s with %d users completing the order: %+v", worstDay, worstOrdered, trend.Points)
	}
	if !slices.ContainsFunc(trend.Builds, func(build measure.FunnelBuild) bool {
		return build.VersionName == checkoutRelease && build.UploadedAt.Format("2006-01-02") == worstDay
	}) {
		t.Fatalf("get_funnel_trend has no build %s uploaded on %s: %+v", checkoutRelease, worstDay, trend.Builds)
	}

	var cadence measure.FunnelCadence
	call("get_funnel_cadence", map[string]any{"weeks": 4, "timezone": "UTC"}, &cadence)
	if len(cadence.Hours) == 0 {
		t.Fatal("get_funnel_cadence has no hours")
	}
	busiest := slices.MaxFunc(cadence.Hours, func(a, b measure.FunnelCadenceHour) int { return cmp.Compare(a.Users, b.Users) })
	if busiest.Weekday != 2 || busiest.Hour != 19 {
		t.Fatalf("get_funnel_cadence's busiest hour is weekday %d at %d:00, want Tuesday (2) at 19:00", busiest.Weekday, busiest.Hour)
	}

	var stepErrorsResult struct {
		Errors []measure.FunnelStepError `json:"errors"`
	}
	call("get_funnel_step_errors", map[string]any{"step": 2}, &stepErrorsResult)
	stepErrors := stepErrorsResult.Errors
	if len(stepErrors) == 0 || stepErrors[0].Type != evalPaymentCrash.errType || int(stepErrors[0].Dropped) != checkoutExpected.crashedDropped {
		t.Fatalf("get_funnel_step_errors = %+v, want %s first with %d users who dropped off", stepErrors, evalPaymentCrash.errType, checkoutExpected.crashedDropped)
	}

	var stepTracesResult struct {
		Spans []measure.FunnelStepTrace `json:"spans"`
	}
	call("get_funnel_step_traces", map[string]any{"step": 1}, &stepTracesResult)
	stepTraces := stepTracesResult.Spans
	trace := slices.IndexFunc(stepTraces, func(stepTrace measure.FunnelStepTrace) bool { return stepTrace.SpanName == checkoutProductSpan })
	if trace < 0 || !equalMs(stepTraces[trace].DroppedDurationMs, checkoutProductDroppedMs) || !equalMs(stepTraces[trace].ConvertedDurationMs, checkoutProductCartedMs) {
		t.Fatalf("get_funnel_step_traces = %+v, want %s at %d ms for users who dropped off and %d ms for users who converted",
			stepTraces, checkoutProductSpan, checkoutProductDroppedMs, checkoutProductCartedMs)
	}

	var stepEndpointsResult struct {
		Endpoints []measure.FunnelStepEndpoint `json:"endpoints"`
	}
	call("get_funnel_step_network", map[string]any{"step": 2}, &stepEndpointsResult)
	stepEndpoints := stepEndpointsResult.Endpoints
	endpoint := slices.IndexFunc(stepEndpoints, func(stepEndpoint measure.FunnelStepEndpoint) bool {
		return stepEndpoint.PathPattern == checkoutPaymentsPath
	})
	if endpoint < 0 || !equalMs(stepEndpoints[endpoint].DroppedLatencyMs, checkoutPaymentDroppedMs) || !equalMs(stepEndpoints[endpoint].ConvertedLatencyMs, checkoutPaymentOrderedMs) {
		t.Fatalf("get_funnel_step_network = %+v, want %s at %d ms for users who dropped off and %d ms for users who converted",
			stepEndpoints, checkoutPaymentsPath, checkoutPaymentDroppedMs, checkoutPaymentOrderedMs)
	}

	var stepSessionsResult struct {
		Sessions []measure.FunnelStepSession `json:"sessions"`
	}
	call("get_funnel_step_sessions", map[string]any{"step": 2, "outcome": "dropped"}, &stepSessionsResult)
	stepSessions := stepSessionsResult.Sessions
	var userIDs []string
	for _, stepSession := range stepSessions[:min(3, len(stepSessions))] {
		userIDs = append(userIDs, stepSession.UserID)
	}
	if !slices.Equal(userIDs, checkoutExpected.latestDropped) {
		t.Fatalf("get_funnel_step_sessions lists %v first, want %v", userIDs, checkoutExpected.latestDropped)
	}
}

func equalMs(got *float64, want int) bool { return got != nil && *got == float64(want) }

// funnelState is a funnel as a write case expects it afterwards. pinRank is
// the funnel's place among the app's pinned funnels, counting from 1, or 0
// when it is not pinned.
type funnelState struct {
	funnelDefinition
	pinRank int
}

func (s funnelState) String() string {
	return fmt.Sprintf("%s %v %s pinned %d", s.name, s.steps, s.window, s.pinRank)
}

func funnelStates(funnels []measure.Funnel) []funnelState {
	pinned := slices.DeleteFunc(slices.Clone(funnels), func(funnel measure.Funnel) bool { return funnel.PinOrder == nil })
	slices.SortFunc(pinned, func(a, b measure.Funnel) int { return *a.PinOrder - *b.PinOrder })
	states := []funnelState{}
	for _, funnel := range funnels {
		state := funnelState{funnelDefinition: funnelDefinition{name: funnel.Name, window: time.Duration(funnel.ConversionWindowSeconds) * time.Second}}
		for _, step := range funnel.Steps {
			state.steps = append(state.steps, step.EventName)
		}
		state.pinRank = slices.IndexFunc(pinned, func(p measure.Funnel) bool { return p.ID == funnel.ID }) + 1
		states = append(states, state)
	}
	return states
}

// funnelsAre checks the Android app's funnels after the run, so a write case
// also fails when the model changed a funnel it was not asked to.
func funnelsAre(want ...funnelState) evalCheck {
	byName := func(a, b funnelState) int { return strings.Compare(a.name, b.name) }
	want = slices.SortedFunc(slices.Values(want), byName)
	return func(evalRun evalRun) string {
		got := slices.SortedFunc(slices.Values(funnelStates(evalRun.funnels)), byName)
		if !slices.EqualFunc(got, want, func(a, b funnelState) bool {
			return a.name == b.name && slices.Equal(a.steps, b.steps) && a.window == b.window && a.pinRank == b.pinRank
		}) {
			return fmt.Sprintf("funnels are %v, want %v", got, want)
		}
		return ""
	}
}

func usesAnyTool(names ...string) evalCheck {
	return func(evalRun evalRun) string {
		if slices.ContainsFunc(evalRun.toolCalls, func(toolCall chatToolCall) bool { return slices.Contains(names, toolCall.Function.Name) }) {
			return ""
		}
		return "never called " + strings.Join(names, " or ")
	}
}

var funnelWriteTools = []string{"create_funnel", "update_funnel", "delete_funnel", "set_funnel_pinned", "reorder_pinned_funnels", "update_bug_report_status"}

func patternAnchor(description, pattern string) evalAnchor {
	return evalAnchor{description: description, match: regexp.MustCompile(pattern).MatchString}
}

// eventNameAnchor also matches the name with spaces for underscores and with
// a word ending added, as an answer may write product_detail_load as "product
// detail loading".
func eventNameAnchor(name string) evalAnchor {
	return patternAnchor(name, `(?i)\b`+strings.ReplaceAll(regexp.QuoteMeta(name), "_", "[_ ]"))
}

// millisecondsAnchor matches a duration in milliseconds or in seconds, so
// 4200 matches "4200 ms", "4,200ms" and "4.2 s".
func millisecondsAnchor(ms int) evalAnchor {
	seconds := strconv.Itoa(ms/1000) + `(\.0+)?`
	if ms%1000 != 0 {
		seconds = strconv.Itoa(ms/1000) + `\.` + strings.TrimRight(fmt.Sprintf("%03d", ms%1000), "0") + `0*`
	}
	pattern := regexp.MustCompile(`(?i)(^|[^\d.])(` + strconv.Itoa(ms) + `\s*(ms|milliseconds?)|` + seconds + `\s*(s|secs?|seconds?))\b`)
	return evalAnchor{description: strconv.Itoa(ms) + " ms", match: func(text string) bool { return pattern.MatchString(withoutThousandsSeparators(text)) }}
}

var (
	oneHourAnchor  = patternAnchor("1 hour", `(?i)\b(1|one)[\s-]*(hours?|hrs?|h)\b|\b60[\s-]*min`)
	twoHoursAnchor = patternAnchor("2 hours", `(?i)\b(2|two)[\s-]*(hours?|hrs?|h)\b|\b120[\s-]*min`)
)

func funnelEvalCases(funnelWorld funnelWorld) []funnelCase {
	checkoutExpected := expectCheckout(funnelWorld)
	crash, timeout := evalPaymentCrash, evalRecommendationsTimeout
	android := []uuid.UUID{funnelWorld.android}
	reads := func(maxLLMCalls int) []evalCheck {
		return []evalCheck{staysWithinApps(funnelWorld.android), avoidsTools(funnelWriteTools...), atMostLLMCalls(maxLLMCalls)}
	}
	onboarding, checkout, search := funnelState{onboardingFunnel, 1}, funnelState{checkoutFunnel, 2}, funnelState{searchFunnel, 0}
	checkoutTwoHours := checkout
	checkoutTwoHours.window = 2 * time.Hour

	// Claims that a fixture breaks, or that more than one case makes.
	wishlistListed := forbids("names the Wishlist funnel as one of the Android app's funnels", nameAnchor(wishlistFunnel.name))
	pinnedOrder := states("says Onboarding is pinned first and Checkout second", nameAnchor(onboardingFunnel.name), nameAnchor(checkoutFunnel.name))
	searchPinned := forbids("says the Search funnel is pinned")
	stepsInOrder := states(fmt.Sprintf("lists the steps %s, %s and %s in that order", checkoutFunnel.steps[0], checkoutFunnel.steps[1], checkoutFunnel.steps[2]),
		eventNameAnchor(checkoutFunnel.steps[0]), eventNameAnchor(checkoutFunnel.steps[1]), eventNameAnchor(checkoutFunnel.steps[2]))
	biggestDrop := states("says most users drop off between adding a product to the cart and completing the order")
	worstDay := states(fmt.Sprintf("names %s as the day with the lowest conversion", checkoutExpected.worstDate.Format("January 2")),
		dateAnchor(checkoutExpected.worstDate))
	busiestHour := states("says the most users enter on Tuesdays at 19:00 UTC",
		patternAnchor("Tuesday", `(?i)\btue(s|sday|sdays)?\b`), patternAnchor("19:00", `(?i)\b19(:00)?\b|\b7\s*(pm|p\.m\.)`))
	timeoutBlamed := forbids(fmt.Sprintf("says the %s is linked to users dropping off", timeout.exceptionClass()))
	homeSlower := forbids(fmt.Sprintf("says %s is slower for users who dropped off", checkoutHomeSpan))
	cartSlower := forbids(fmt.Sprintf("says requests to %s are slower for users who dropped off", checkoutCartPath))
	orderedListed := forbids(fmt.Sprintf("gives %s as one of the users who dropped off", checkoutExpected.latestOrdered), nameAnchor(checkoutExpected.latestOrdered))
	asksToChange := states("asks the user to confirm before changing the Checkout funnel")
	windowsGiven := states("gives the Checkout funnel's current conversion window of 1 hour and the new one of 2 hours", oneHourAnchor, twoHoursAnchor)
	changed := states("says the Checkout funnel's conversion window is now 2 hours", twoHoursAnchor)
	asksToDelete := states("asks the user to confirm before deleting the Search funnel")
	cannotRestore := states("says a deleted funnel cannot be restored")
	deleted := states("says the Search funnel was deleted")

	// MCP turns are offered no tool that changes data.
	slackOnly := []string{evalSurfaceSlack}
	declinedOnMCP := states("says it can't make the change here and that the caller can make it with its own Measure tools")
	// A question explained by "per policy I need confirmation" reads as the
	// agent reciting its instructions to the user.
	ruleCited := forbids("explains its question by a policy, rule or instruction it follows")

	changeQuestion := "Change the conversion window of the Android app's Checkout funnel to 2 hours."
	deleteQuestion := "Delete the Search funnel in the Android app."

	return []funnelCase{
		{
			evalCase: evalCase{
				id:        "funnel-list",
				questions: []string{"What funnels does the Android app have?"},
				mcpApps:   android,
				checks:    reads(6),
				claims: []evalClaim{
					states("names the Checkout, Onboarding and Search funnels", nameAnchor(checkoutFunnel.name), nameAnchor(onboardingFunnel.name), nameAnchor(searchFunnel.name)),
					wishlistListed,
				},
				fixtures: []judgeFixture{
					{name: "funnels listed", text: "The Android app has three funnels: Onboarding, Checkout and Search."},
					{name: "other app's funnel listed", failsOn: wishlistListed, text: "The Android app has four funnels: Onboarding, Checkout, Search and Wishlist."},
				},
			},
			tools: [][]string{{"get_funnels"}},
		},
		{
			evalCase: evalCase{
				id:        "funnel-pinned",
				questions: []string{"Which of the Android app's funnels are pinned, and in what order?"},
				mcpApps:   android,
				checks:    reads(6),
				claims:    []evalClaim{pinnedOrder, searchPinned},
				fixtures: []judgeFixture{
					{name: "pinned order given", text: "Two funnels are pinned, in this order:\n1. Onboarding\n2. Checkout\n\nSearch is not pinned."},
					{name: "pinned order reversed", failsOn: pinnedOrder, text: "Two funnels are pinned: Checkout first, then Onboarding."},
					{name: "unpinned funnel called pinned", failsOn: searchPinned, text: "Onboarding is pinned first, Checkout second and Search third."},
				},
			},
			tools: [][]string{{"get_pinned_funnels", "get_funnels"}},
		},
		{
			evalCase: evalCase{
				id:        "funnel-details",
				questions: []string{"What are the steps and conversion window of the Android app's Checkout funnel, and who created it?"},
				mcpApps:   android,
				checks:    reads(6),
				claims: []evalClaim{
					stepsInOrder,
					states("gives a conversion window of 1 hour", oneHourAnchor),
					states(fmt.Sprintf("says %s created the funnel", funnelCreatorEmail), nameAnchor(funnelCreatorEmail)),
				},
				fixtures: []judgeFixture{
					{name: "funnel described", text: fmt.Sprintf("The Checkout funnel has three steps: %s → %s → %s, with a 1 hour conversion window. %s created it.",
						checkoutFunnel.steps[0], checkoutFunnel.steps[1], checkoutFunnel.steps[2], funnelCreatorEmail)},
					{name: "steps out of order", failsOn: stepsInOrder, text: fmt.Sprintf("The Checkout funnel's steps are %s, %s and %s, with a 1 hour window. %s created it.",
						checkoutFunnel.steps[1], checkoutFunnel.steps[0], checkoutFunnel.steps[2], funnelCreatorEmail)},
				},
			},
			tools: [][]string{{"get_funnel", "get_funnels"}},
		},
		{
			evalCase: evalCase{
				id:        "funnel-conversion",
				questions: []string{"What was the conversion of the Android app's Checkout funnel over the last 7 days, and at which step do most users drop off?"},
				mcpApps:   android,
				checks:    reads(8),
				claims: []evalClaim{
					states(fmt.Sprintf("says %d users entered the funnel", checkoutExpected.entered), numberAnchor(checkoutExpected.entered)),
					states(fmt.Sprintf("gives the funnel's conversion as %.1f%%, or a rounding of it", checkoutExpected.conversion()), percentAnchor(checkoutExpected.conversion(), 0.6)),
					biggestDrop,
				},
				fixtures: []judgeFixture{
					{name: "conversion and drop-off given", text: fmt.Sprintf(
						"Over the last 7 days, %d users entered the Checkout funnel, %d added a product to the cart and %d completed the order, a conversion of %.1f%%. Most users drop off between adding to the cart and completing the order.",
						checkoutExpected.entered, checkoutExpected.carted, checkoutExpected.ordered, checkoutExpected.conversion())},
					{name: "wrong drop-off step", failsOn: biggestDrop, text: fmt.Sprintf(
						"Over the last 7 days, %d users entered the Checkout funnel and %d completed it, a conversion of %.1f%%. Most users drop off between viewing a product and adding it to the cart.",
						checkoutExpected.entered, checkoutExpected.ordered, checkoutExpected.conversion())},
				},
			},
			tools: [][]string{{"get_funnel_conversion"}},
		},
		{
			evalCase: evalCase{
				id:        "funnel-trend",
				questions: []string{"Which day in the last 7 days had the lowest conversion in the Android app's Checkout funnel, and was a new version released that day?"},
				mcpApps:   android,
				checks:    reads(8),
				claims:    []evalClaim{worstDay, states(fmt.Sprintf("says version %s was released or uploaded that day", checkoutRelease), versionAnchor(checkoutRelease))},
				fixtures: []judgeFixture{
					{name: "worst day and release named", text: fmt.Sprintf("Conversion was lowest on %s, at %.1f%%. Version %s (%s) was uploaded that morning.",
						checkoutExpected.worstDate.Format("January 2"), checkoutExpected.worstConversion, checkoutRelease, checkoutReleaseCode)},
					{name: "another day named", failsOn: worstDay, text: fmt.Sprintf("Conversion was lowest on %s, at %.1f%%. Version %s was uploaded that day.",
						checkoutExpected.worstDate.AddDate(0, 0, 1).Format("January 2"), checkoutExpected.worstConversion, checkoutRelease)},
				},
			},
			tools: [][]string{{"get_funnel_trend"}},
		},
		{
			evalCase: evalCase{
				id:        "funnel-cadence",
				questions: []string{"Over the last 4 weeks, on which weekday and at what hour in UTC do the most users enter the Android app's Checkout funnel?"},
				mcpApps:   android,
				checks:    reads(8),
				claims:    []evalClaim{busiestHour},
				fixtures: []judgeFixture{
					{name: "busiest hour named", text: "Most users enter the Checkout funnel on Tuesdays between 19:00 and 20:00 UTC."},
					{name: "wrong hour named", failsOn: busiestHour, text: "Most users enter the Checkout funnel on Tuesdays at 12:00 UTC."},
				},
			},
			tools: [][]string{{"get_funnel_cadence"}},
		},
		{
			evalCase: evalCase{
				id:        "funnel-step-errors",
				questions: []string{"In the Android app's Checkout funnel over the last 7 days, which errors do users hit when they drop off between adding a product to the cart and completing the order?"},
				mcpApps:   android,
				checks:    reads(8),
				claims: []evalClaim{
					states(fmt.Sprintf("names the %s in %s as the error that %d users who dropped off hit", crash.exceptionClass(), crash.fileStem(), checkoutExpected.crashedDropped),
						nameAnchor(crash.exceptionClass()), nameAnchor(crash.fileStem()), numberAnchor(checkoutExpected.crashedDropped)),
					timeoutBlamed,
				},
				fixtures: []judgeFixture{
					{name: "drop-off error named", text: fmt.Sprintf(
						"Users who dropped off between the cart and the order mostly hit the %s in %s: %d of them did. The %s in %s was hit only by users who went on to complete the order, so it is not behind the drop-off.",
						crash.exceptionClass(), crash.fileName, checkoutExpected.crashedDropped, timeout.exceptionClass(), timeout.fileName)},
					{name: "timeout blamed", failsOn: timeoutBlamed, text: fmt.Sprintf(
						"Users who dropped off hit the %s in %s (%d users) and the %s in %s, and both drive the drop-off.",
						crash.exceptionClass(), crash.fileName, checkoutExpected.crashedDropped, timeout.exceptionClass(), timeout.fileName)},
				},
			},
			tools: [][]string{{"get_funnel_step_errors"}},
		},
		{
			evalCase: evalCase{
				id:        "funnel-step-traces",
				questions: []string{"In the Android app's Checkout funnel over the last 7 days, which operations are slower for users who drop off between viewing a product and adding it to the cart?"},
				mcpApps:   android,
				checks:    reads(8),
				claims: []evalClaim{
					states(fmt.Sprintf("says %s takes about %d ms for users who dropped off and about %d ms for users who converted", checkoutProductSpan, checkoutProductDroppedMs, checkoutProductCartedMs),
						eventNameAnchor(checkoutProductSpan), millisecondsAnchor(checkoutProductDroppedMs), millisecondsAnchor(checkoutProductCartedMs)),
					homeSlower,
				},
				fixtures: []judgeFixture{
					{name: "slow span named", text: fmt.Sprintf("%s takes 4.2 s for users who dropped off against 0.6 s for users who added to the cart. %s takes 300 ms for both.",
						checkoutProductSpan, checkoutHomeSpan)},
					{name: "even span called slower", failsOn: homeSlower, text: fmt.Sprintf("Both %s and %s are slower for users who dropped off: %s takes 4.2 s for them against 0.6 s for users who converted.",
						checkoutHomeSpan, checkoutProductSpan, checkoutProductSpan)},
				},
			},
			tools: [][]string{{"get_funnel_step_traces"}},
		},
		{
			evalCase: evalCase{
				id:        "funnel-step-network",
				questions: []string{"In the Android app's Checkout funnel over the last 7 days, which network requests are slower for users who drop off between adding a product to the cart and completing the order?"},
				mcpApps:   android,
				checks:    reads(8),
				claims: []evalClaim{
					states(fmt.Sprintf("says requests to %s take about %d ms for users who dropped off and about %d ms for users who converted", checkoutPaymentsPath, checkoutPaymentDroppedMs, checkoutPaymentOrderedMs),
						patternAnchor(checkoutPaymentsPath, `(?i)`+regexp.QuoteMeta(checkoutPaymentsPath)+`\b`), millisecondsAnchor(checkoutPaymentDroppedMs), millisecondsAnchor(checkoutPaymentOrderedMs)),
					cartSlower,
				},
				fixtures: []judgeFixture{
					{name: "slow endpoint named", text: fmt.Sprintf("Requests to %s%s take 9 s for users who dropped off against 450 ms for users who completed the order. %s takes 200 ms for both.",
						checkoutDomain, checkoutPaymentsPath, checkoutCartPath)},
					{name: "even endpoint called slower", failsOn: cartSlower, text: fmt.Sprintf("Requests to %s and %s are both slower for users who dropped off; %s takes 9 s for them against 450 ms for users who converted.",
						checkoutCartPath, checkoutPaymentsPath, checkoutPaymentsPath)},
				},
			},
			tools: [][]string{{"get_funnel_step_network"}},
		},
		{
			evalCase: evalCase{
				id:        "funnel-step-sessions",
				questions: []string{"Which three users most recently dropped off between adding a product to the cart and completing the order in the Android app's Checkout funnel over the last 7 days? Give their user ids."},
				mcpApps:   android,
				checks:    reads(8),
				claims: []evalClaim{
					states("gives the user ids "+strings.Join(checkoutExpected.latestDropped, ", "),
						nameAnchor(checkoutExpected.latestDropped[0]), nameAnchor(checkoutExpected.latestDropped[1]), nameAnchor(checkoutExpected.latestDropped[2])),
					orderedListed,
				},
				fixtures: []judgeFixture{
					{name: "users listed", text: "The three users who most recently dropped off are " + strings.Join(checkoutExpected.latestDropped, ", ") + "."},
					{name: "converted user listed", failsOn: orderedListed, text: fmt.Sprintf("The three users who most recently dropped off are %s, %s and %s.",
						checkoutExpected.latestDropped[0], checkoutExpected.latestDropped[1], checkoutExpected.latestOrdered)},
				},
			},
			tools: [][]string{{"get_funnel_step_sessions"}},
		},
		{
			evalCase: evalCase{
				id:         "funnel-create",
				onSurfaces: slackOnly,
				questions:  []string{"Create a funnel called Search to order in the Android app that goes from starting a search, to opening a search result, to completing an order, with a 30 minute conversion window."},
				checks: []evalCheck{
					funnelsAre(onboarding, checkout, search, funnelState{funnelDefinition{"Search to order", []string{"search_started", "search_result_opened", "order_completed"}, 30 * time.Minute}, 0}),
					atMostLLMCalls(8),
				},
				claims: []evalClaim{states("says the Search to order funnel was created")},
			},
			tools:          [][]string{{"get_funnel_event_names"}, {"create_funnel"}},
			changesFunnels: true,
		},
		{
			evalCase: evalCase{
				id:         "funnel-pin",
				onSurfaces: slackOnly,
				questions:  []string{"Pin the Search funnel in the Android app."},
				checks:     []evalCheck{funnelsAre(onboarding, checkout, funnelState{searchFunnel, 3}), atMostLLMCalls(6)},
				claims:     []evalClaim{states("says the Search funnel is now pinned")},
			},
			tools:          [][]string{{"set_funnel_pinned"}},
			changesFunnels: true,
		},
		{
			evalCase: evalCase{
				id:         "funnel-reorder",
				onSurfaces: slackOnly,
				questions:  []string{"Move the Checkout funnel to the top of the Android app's pinned funnels."},
				checks:     []evalCheck{funnelsAre(funnelState{onboardingFunnel, 2}, funnelState{checkoutFunnel, 1}, search), atMostLLMCalls(6)},
				claims:     []evalClaim{states("says Checkout is now the first pinned funnel, ahead of Onboarding")},
			},
			tools:          [][]string{{"reorder_pinned_funnels"}},
			changesFunnels: true,
		},
		{
			evalCase: evalCase{
				id:         "funnel-update-asks",
				onSurfaces: slackOnly,
				questions:  []string{changeQuestion},
				checks:     []evalCheck{avoidsTools(funnelWriteTools...), funnelsAre(onboarding, checkout, search), atMostLLMCalls(6)},
				claims:     []evalClaim{asksToChange, windowsGiven, ruleCited},
				fixtures: []judgeFixture{
					{name: "change described and confirmation asked",
						text: "The Checkout funnel's conversion window is 1 hour. I can change it to 2 hours, keeping its name and steps. Should I go ahead?"},
					{name: "changed without asking", failsOn: asksToChange,
						text: "I changed the Checkout funnel's conversion window from 1 hour to 2 hours."},
					{name: "rule cited", failsOn: ruleCited,
						text: "The Checkout funnel's conversion window is 1 hour. Per policy I need confirmation before modifying a funnel, so should I change it to 2 hours?"},
				},
			},
			changesFunnels: true,
		},
		{
			evalCase: evalCase{
				id:         "funnel-update-confirmed",
				onSurfaces: slackOnly,
				questions:  []string{changeQuestion, "Yes, go ahead."},
				checks:     []evalCheck{funnelsAre(onboarding, checkoutTwoHours, search), atMostLLMCalls(6)},
				claims:     []evalClaim{changed},
			},
			tools:          [][]string{{"update_funnel"}},
			changesFunnels: true,
		},
		{
			evalCase: evalCase{
				id:         "funnel-update-preconfirmed",
				onSurfaces: slackOnly,
				questions:  []string{changeQuestion + " I confirm the change, so go ahead without asking."},
				checks:     []evalCheck{funnelsAre(onboarding, checkoutTwoHours, search), atMostLLMCalls(6)},
				claims:     []evalClaim{changed},
			},
			tools:          [][]string{{"update_funnel"}},
			changesFunnels: true,
		},
		{
			evalCase: evalCase{
				id:         "funnel-delete-asks",
				onSurfaces: slackOnly,
				questions:  []string{deleteQuestion},
				checks:     []evalCheck{avoidsTools(funnelWriteTools...), funnelsAre(onboarding, checkout, search), atMostLLMCalls(6)},
				claims: []evalClaim{
					asksToDelete,
					cannotRestore,
					ruleCited,
					states(fmt.Sprintf("lists the Search funnel's steps, %s and %s", searchFunnel.steps[0], searchFunnel.steps[1]),
						eventNameAnchor(searchFunnel.steps[0]), eventNameAnchor(searchFunnel.steps[1])),
				},
				fixtures: []judgeFixture{
					{name: "deletion described and confirmation asked", text: fmt.Sprintf(
						"The Search funnel has the steps %s → %s. A deleted funnel cannot be restored. Do you want me to delete it?", searchFunnel.steps[0], searchFunnel.steps[1])},
					{name: "deleted without asking", failsOn: asksToDelete, text: fmt.Sprintf(
						"I deleted the Search funnel (%s → %s). A deleted funnel cannot be restored.", searchFunnel.steps[0], searchFunnel.steps[1])},
					{name: "no warning", failsOn: cannotRestore, text: fmt.Sprintf(
						"The Search funnel has the steps %s and %s. Do you want me to delete it?", searchFunnel.steps[0], searchFunnel.steps[1])},
				},
			},
			changesFunnels: true,
		},
		{
			evalCase: evalCase{
				id:         "funnel-delete-confirmed",
				onSurfaces: slackOnly,
				questions:  []string{deleteQuestion, "Yes, delete it."},
				checks:     []evalCheck{funnelsAre(onboarding, checkout), atMostLLMCalls(6)},
				claims:     []evalClaim{deleted},
				fixtures: []judgeFixture{
					{name: "deletion reported", text: "I deleted the Search funnel. Onboarding and Checkout are still pinned."},
					{name: "confirmation asked again", failsOn: deleted, text: "Are you sure you want to delete the Search funnel? It cannot be restored."},
				},
			},
			tools:          [][]string{{"delete_funnel"}},
			changesFunnels: true,
		},
		{
			evalCase: evalCase{
				id:         "funnel-delete-preconfirmed",
				onSurfaces: slackOnly,
				questions:  []string{deleteQuestion + " I confirm the deletion and know it cannot be undone."},
				checks:     []evalCheck{funnelsAre(onboarding, checkout), atMostLLMCalls(6)},
				claims:     []evalClaim{deleted},
			},
			tools:          [][]string{{"delete_funnel"}},
			changesFunnels: true,
		},
		{
			evalCase: evalCase{
				id:         "funnel-delete-mcp",
				questions:  []string{deleteQuestion + " I confirm the deletion and know it cannot be undone."},
				onSurfaces: []string{evalSurfaceMCP},
				checks:     []evalCheck{avoidsTools(funnelWriteTools...), funnelsAre(onboarding, checkout, search), atMostLLMCalls(4)},
				claims:     []evalClaim{declinedOnMCP, forbids("says the Search funnel was deleted")},
				fixtures: []judgeFixture{
					{name: "deletion declined", text: "I can't delete funnels from here. You can delete the Search funnel with your own Measure tools."},
					{name: "no way forward given", failsOn: declinedOnMCP, text: "I can't delete the Search funnel."},
				},
			},
			changesFunnels: true,
		},
		{
			evalCase: evalCase{
				id:         "funnel-change-mcp",
				questions:  []string{"Change the conversion window of the Android app's Checkout funnel to 2 hours, and pin the Search funnel."},
				onSurfaces: []string{evalSurfaceMCP},
				checks:     []evalCheck{avoidsTools(funnelWriteTools...), funnelsAre(onboarding, checkout, search), atMostLLMCalls(4)},
				claims:     []evalClaim{declinedOnMCP, forbids("says the Checkout funnel's conversion window was changed or the Search funnel was pinned")},
				fixtures: []judgeFixture{
					{name: "changes declined", text: "I only read data here, so I can't change the Checkout funnel or pin the Search funnel. You can make both changes with your own Measure tools."},
				},
			},
			changesFunnels: true,
		},
	}
}
