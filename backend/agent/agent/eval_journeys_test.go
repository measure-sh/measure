//go:build eval

package agent

import (
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

func TestEvalJourneys(t *testing.T) {
	env := newEvalEnv(t, "LLM_AGENT_MODEL_MEDIUM")
	surfaces := evalSurfaces(t)
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	config := env.config(env.models[0])
	evalWorld := seedJourneyWorld(ctx, t)
	sessions := seedJourneyTelemetry(ctx, t, evalWorld)
	checkJourneyTelemetry(ctx, t, config, evalWorld, sessions)
	journeyCases := journeyEvalCases(evalWorld, sessions)
	checkJourneyToolCoverage(t, config, journeyCases)

	checks := []evalCheck{
		hidesInternals(internalsPattern(ctx, t, config)),
		hidesJourneyNodeIDs,
		passesSamplePercent("get_journey", "get_journey_path_users", "get_journey_errors", "get_journey_traces", "get_journey_network", "get_journey_sessions"),
	}
	cases := make([]evalCase, len(journeyCases))
	for i, journeyCase := range journeyCases {
		evalCase := journeyCase.evalCase
		for _, tools := range journeyCase.tools {
			evalCase.checks = append(evalCase.checks, usesAnyTool(tools...))
		}
		evalCase.checks = append(slices.Clone(checks), evalCase.checks...)
		evalCase.claims = append(evalCase.claims, evalShowsInternals)
		evalCase.textDescription = evalCase.describeText() + "\nThe team's apps are Shopper for Android (com.shopper.android) and Shopper for iOS (com.shopper.ios).\n"
		cases[i] = evalCase
	}
	checkExpectedCounts(t, cases, journeySeededCounts())
	env.calibrateJudge(ctx, t, cases)

	started := time.Now()
	results := env.collect(t, func(t *testing.T, record func(evalResult)) {
		for _, model := range env.models {
			config := env.config(model)
			t.Run(strings.ReplaceAll(model, "/", "_"), func(t *testing.T) {
				t.Parallel()
				for _, evalCase := range cases {
					t.Run(evalCase.id, func(t *testing.T) {
						t.Parallel()
						for _, surface := range evalCase.surfaces(surfaces) {
							t.Run(surface, func(t *testing.T) {
								t.Parallel()
								for trial := range env.trials {
									t.Run(strconv.Itoa(trial+1), func(t *testing.T) {
										t.Parallel()
										evalRun := runEvalCase(ctx, t, config, env.evalCostProxy, evalWorld, evalCase, surface)
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
	env.report(t, "journeys", started, surfaces, cases, results)
}

// journeyCase is an evalCase with the journey tools it must call: for each
// entry in tools, the run must call at least one of its tools.
type journeyCase struct {
	evalCase
	tools [][]string
}

// checkJourneyToolCoverage fails the test when a journey tool is in no case's
// tools, so a new journey tool comes with a case.
func checkJourneyToolCoverage(t *testing.T, config *Config, journeyCases []journeyCase) {
	t.Helper()
	covered := map[string]bool{}
	for _, journeyCase := range journeyCases {
		for _, tools := range journeyCase.tools {
			for _, tool := range tools {
				covered[tool] = true
			}
		}
	}
	for name := range config.commonToolIndex {
		if strings.Contains(name, "journey") && !covered[name] {
			t.Fatalf("no journey eval case calls %s", name)
		}
	}
}

// journeyNodeIDPattern matches a journey node id, which the system prompt
// asks answers to give as a screen or event name.
var journeyNodeIDPattern = regexp.MustCompile(`\b(screen|event):\S`)

func hidesJourneyNodeIDs(evalRun evalRun) string {
	if match := journeyNodeIDPattern.FindString(evalRun.answer); match != "" {
		return fmt.Sprintf("answer shows a journey node id: %q", match)
	}
	return ""
}

func seedJourneyWorld(ctx context.Context, t *testing.T) evalWorld {
	t.Helper()
	evalWorld := evalWorld{teamID: uuid.New(), userID: uuid.New(), android: uuid.New(), ios: uuid.New(), seededAt: time.Now().UTC()}
	th.SeedTeam(ctx, t, evalWorld.teamID.String(), "Shopper")
	th.SeedUser(ctx, t, evalWorld.userID.String(), "eval@shopper.dev")
	th.SeedTeamMembership(ctx, t, evalWorld.teamID.String(), evalWorld.userID.String(), "owner")
	seedEvalApp(ctx, t, evalWorld.teamID, evalWorld.android, "Shopper", "com.shopper.android", "android")
	seedEvalApp(ctx, t, evalWorld.teamID, evalWorld.ios, "Shopper", "com.shopper.ios", "ios")
	return evalWorld
}

const (
	journeyHome         = "HomeActivity"
	journeySearch       = "SearchActivity"
	journeyProduct      = "ProductDetailActivity"
	journeyCart         = "CartActivity"
	journeyCheckout     = "CheckoutActivity"
	journeyConfirmation = "OrderConfirmationActivity"

	journeyHomeSpan     = "home_feed_load"
	journeyHomeMs       = 300
	journeyProductSpan  = "product_detail_load"
	journeyProductMs    = 850
	journeyDomain       = "api.shopper.dev"
	journeyCartPath     = "/v1/cart"
	journeyCartMs       = 240
	journeyPaymentsPath = "/v1/payments"
	journeyPaymentsMs   = 900
	journeyStepGap      = 10 * time.Second
)

// journeyCohort is users who each go through the same screens in one
// session. ending is the error that ends the session after its last screen,
// or nil when the session ends without one.
type journeyCohort struct {
	users   int
	screens []string
	ending  *evalError
}

// Every session starts on HomeActivity, and more users go from it to
// ProductDetailActivity than to SearchActivity. The users who reach
// ProductDetailActivity from SearchActivity also go on to CartActivity, so the
// link from ProductDetailActivity to CartActivity has more users than the path
// from HomeActivity through ProductDetailActivity to CartActivity. The
// sessions that reach OrderConfirmationActivity hit the handled
// SocketTimeoutException on CheckoutActivity and outnumber the sessions that
// end in the crash there, so CheckoutActivity's errors list the timeout first
// while the path from it to the fatal error has only the crash.
var journeyCohorts = []journeyCohort{
	{users: 150, screens: []string{journeyHome, journeyProduct, journeyCart, journeyCheckout, journeyConfirmation}},
	{users: 120, screens: []string{journeyHome, journeyProduct, journeyCart, journeyCheckout}, ending: &evalPaymentCrash},
	{users: 130, screens: []string{journeyHome, journeyProduct, journeyHome}},
	{users: 40, screens: []string{journeyHome, journeyProduct}, ending: &evalImageANR},
	{users: 110, screens: []string{journeyHome, journeySearch, journeyProduct, journeyCart, journeyCheckout, journeyConfirmation}},
	{users: 60, screens: []string{journeyHome, journeySearch}},
}

func journeyUserID(number int) string { return fmt.Sprintf("shopper-%d", 1000+number) }

// journeySession is one seeded session. ended is when its last screen was
// reached.
type journeySession struct {
	userID string
	cohort int
	ended  time.Time
}

// seedJourneyTelemetry gives each user one session, spread over the last 7
// days, with a step every journeyStepGap. HomeActivity runs
// home_feed_load, ProductDetailActivity runs product_detail_load,
// CartActivity requests /v1/cart and CheckoutActivity requests /v1/payments.
func seedJourneyTelemetry(ctx context.Context, t *testing.T, evalWorld evalWorld) []journeySession {
	t.Helper()
	for _, evalError := range []evalError{evalPaymentCrash, evalImageANR, evalRecommendationsTimeout} {
		seedEvalErrorGroup(ctx, t, evalWorld, evalError)
	}
	for _, path := range []string{journeyCartPath, journeyPaymentsPath} {
		th.SeedUrlPattern(ctx, t, evalWorld.teamID.String(), evalWorld.android.String(), journeyDomain, path)
	}

	sessions := []journeySession{}
	number := 0
	for c, cohort := range journeyCohorts {
		for range cohort.users {
			installationID, sessionID, userID := uuid.NewString(), uuid.NewString(), journeyUserID(number)
			start := evalWorld.seededDay(number % evalDays).Add(time.Duration(number/evalDays) * time.Minute)
			number++
			event := func(row testinfra.EventRow, at time.Time) {
				row.InstallationID, row.SessionID, row.UserID, row.Timestamp = installationID, sessionID, userID, at
				seedEvalEvents(ctx, t, evalWorld, evalAndroidDevice, 1, row)
			}
			span := func(name string, at time.Time, durationMs int) {
				th.SeedSpanRows(ctx, t, evalWorld.teamID.String(), evalWorld.android.String(), 1, testinfra.SpanRow{
					SpanName: name, InstallationID: installationID, SessionID: sessionID,
					StartTime: at, Duration: time.Duration(durationMs) * time.Millisecond,
					AppVersion: evalAndroidDevice.appVersion, AppBuild: evalAndroidDevice.appBuild,
					OSName: evalAndroidDevice.osName, OSVersion: evalAndroidDevice.osVersion,
				})
			}
			request := func(path string, at time.Time, latencyMs int) {
				event(testinfra.EventRow{Type: "http", HttpURL: "https://" + journeyDomain + path, HttpMethod: "post", HttpStatusCode: 200,
					HttpStartTime: 1000, HttpEndTime: 1000 + uint64(latencyMs)}, at)
			}
			errorEvent := func(evalError evalError, at time.Time) {
				event(testinfra.EventRow{Type: evalError.eventType(), Fingerprint: evalError.fingerprint, Handled: evalError.handled()}, at)
			}

			var at time.Time
			for i, screen := range cohort.screens {
				at = start.Add(time.Duration(i) * journeyStepGap)
				event(testinfra.EventRow{Type: "lifecycle_activity", LifecycleActivityType: "resumed", LifecycleActivityClassName: screen}, at)
				switch screen {
				case journeyHome:
					span(journeyHomeSpan, at.Add(time.Second), journeyHomeMs)
				case journeyProduct:
					span(journeyProductSpan, at.Add(time.Second), journeyProductMs)
				case journeyCart:
					request(journeyCartPath, at.Add(2*time.Second), journeyCartMs)
				case journeyCheckout:
					request(journeyPaymentsPath, at.Add(2*time.Second), journeyPaymentsMs)
					if slices.Contains(cohort.screens, journeyConfirmation) {
						errorEvent(evalRecommendationsTimeout, at.Add(3*time.Second))
					}
				}
			}
			if cohort.ending != nil {
				errorEvent(*cohort.ending, at.Add(5*time.Second))
			}
			sessions = append(sessions, journeySession{userID: userID, cohort: c, ended: at})
		}
	}
	return sessions
}

// journeyExpected is what the journey tools report for the last 7 days.
type journeyExpected struct {
	homeToProduct, homeToSearch, productToCart int
	checkoutToFatal, productToFatal            int
	homeProductCart                            int
	// latestCrashed are the user ids of the three users whose sessions most
	// recently ended in the crash on CheckoutActivity, newest first, and
	// latestANR is the user id of the user whose session most recently ended
	// in the ANR on ProductDetailActivity.
	latestCrashed []string
	latestANR     string
}

func expectJourney(sessions []journeySession) journeyExpected {
	var journeyExpected journeyExpected
	for _, cohort := range journeyCohorts {
		for i := 1; i < len(cohort.screens); i++ {
			from, to := cohort.screens[i-1], cohort.screens[i]
			switch {
			case from == journeyHome && to == journeyProduct:
				journeyExpected.homeToProduct += cohort.users
			case from == journeyHome && to == journeySearch:
				journeyExpected.homeToSearch += cohort.users
			case from == journeyProduct && to == journeyCart:
				journeyExpected.productToCart += cohort.users
			}
		}
		if slices.Equal(cohort.screens[:min(3, len(cohort.screens))], []string{journeyHome, journeyProduct, journeyCart}) {
			journeyExpected.homeProductCart += cohort.users
		}
		switch cohort.ending {
		case &evalPaymentCrash:
			journeyExpected.checkoutToFatal += cohort.users
		case &evalImageANR:
			journeyExpected.productToFatal += cohort.users
		}
	}

	newestFirst := slices.SortedFunc(slices.Values(sessions), func(a, b journeySession) int { return b.ended.Compare(a.ended) })
	for _, session := range newestFirst {
		switch ending := journeyCohorts[session.cohort].ending; {
		case ending == &evalPaymentCrash && len(journeyExpected.latestCrashed) < 3:
			journeyExpected.latestCrashed = append(journeyExpected.latestCrashed, session.userID)
		case ending == &evalImageANR && journeyExpected.latestANR == "":
			journeyExpected.latestANR = session.userID
		}
	}
	return journeyExpected
}

// journeySeededCounts are the journey's counts that no case expects, which an
// expected count must differ from.
func journeySeededCounts() []int {
	journeyExpected := expectJourney(nil)
	counts := []int{journeyExpected.homeToSearch, journeyExpected.productToCart}
	users := 0
	for _, cohort := range journeyCohorts {
		users += cohort.users
		if cohort.ending != &evalPaymentCrash {
			counts = append(counts, cohort.users)
		}
	}
	return append(counts, users)
}

// checkJourneyTelemetry fails the test when the journey tools do not report
// what the cases expect of the seeded telemetry, which would otherwise fail
// every model.
func checkJourneyTelemetry(ctx context.Context, t *testing.T, config *Config, evalWorld evalWorld, sessions []journeySession) {
	t.Helper()
	ctx = WithUserID(ctx, evalWorld.userID.String())
	call := func(tool string, args map[string]any, out any) {
		t.Helper()
		if args["app_id"] == nil {
			args["app_id"] = evalWorld.android.String()
		}
		raw, _ := json.Marshal(args)
		result, err := config.commonToolIndex[tool].call(ctx, raw)
		if err != nil {
			t.Fatalf("%s: %v", tool, err)
		}
		if err := json.Unmarshal([]byte(result), out); err != nil {
			t.Fatalf("%s returned %q: %v", tool, result, err)
		}
	}
	screen := func(name string) string { return "screen:" + name }
	journeyExpected := expectJourney(sessions)

	var journey measure.Journey
	call("get_journey", map[string]any{}, &journey)
	if journey.SamplePercent == nil || *journey.SamplePercent != 100 {
		t.Fatalf("get_journey sample percent = %v, want 100", journey.SamplePercent)
	}
	links := map[string]int{}
	for _, link := range journey.Links {
		links[link.Source+">"+link.Target] = int(link.Users)
	}
	for link, want := range map[string]int{
		screen(journeyHome) + ">" + screen(journeyProduct): journeyExpected.homeToProduct,
		screen(journeyHome) + ">" + screen(journeySearch):  journeyExpected.homeToSearch,
		screen(journeyProduct) + ">" + screen(journeyCart): journeyExpected.productToCart,
		screen(journeyCheckout) + ">fatal":                 journeyExpected.checkoutToFatal,
		screen(journeyProduct) + ">fatal":                  journeyExpected.productToFatal,
	} {
		if links[link] != want {
			t.Fatalf("get_journey has %d users on %s, want %d: %+v", links[link], link, want, journey.Links)
		}
	}

	var iosJourney measure.Journey
	call("get_journey", map[string]any{"app_id": evalWorld.ios.String()}, &iosJourney)
	if len(iosJourney.Nodes) != 0 || iosJourney.SamplePercent != nil {
		t.Fatalf("get_journey for the iOS app = %+v, want no nodes and a null sample percent", iosJourney)
	}

	var pathUsers measure.JourneyPathUsers
	call("get_journey_path_users", map[string]any{"path": []string{screen(journeyHome), screen(journeyProduct), screen(journeyCart)}}, &pathUsers)
	if int(pathUsers.Users) != journeyExpected.homeProductCart {
		t.Fatalf("get_journey_path_users = %d, want %d", pathUsers.Users, journeyExpected.homeProductCart)
	}

	errorTypes := func(args map[string]any) []string {
		t.Helper()
		var result struct {
			Errors []measure.JourneyError `json:"errors"`
		}
		call("get_journey_errors", args, &result)
		types := []string{}
		for _, journeyError := range result.Errors {
			types = append(types, journeyError.Type)
		}
		return types
	}
	if got := errorTypes(map[string]any{"path": []string{screen(journeyCheckout), "fatal"}}); !slices.Equal(got, []string{evalPaymentCrash.errType}) {
		t.Fatalf("get_journey_errors on the path from %s to the fatal error = %v, want only %s", journeyCheckout, got, evalPaymentCrash.errType)
	}
	if got := errorTypes(map[string]any{"node_id": screen(journeyCheckout)}); len(got) == 0 || got[0] != evalRecommendationsTimeout.errType {
		t.Fatalf("get_journey_errors on %s = %v, want %s first", journeyCheckout, got, evalRecommendationsTimeout.errType)
	}
	var searchErrors struct {
		Errors        []measure.JourneyError `json:"errors"`
		SamplePercent *float64               `json:"sample_percent"`
	}
	call("get_journey_errors", map[string]any{"node_id": screen(journeySearch)}, &searchErrors)
	if len(searchErrors.Errors) != 0 || searchErrors.SamplePercent != nil {
		t.Fatalf("get_journey_errors on %s = %+v, want no errors and a null sample percent", journeySearch, searchErrors)
	}

	var traces struct {
		Spans []measure.JourneyTrace `json:"spans"`
	}
	call("get_journey_traces", map[string]any{"node_id": screen(journeyProduct)}, &traces)
	if len(traces.Spans) != 1 || traces.Spans[0].SpanName != journeyProductSpan || traces.Spans[0].DurationMs != journeyProductMs {
		t.Fatalf("get_journey_traces on %s = %+v, want only %s at %d ms", journeyProduct, traces.Spans, journeyProductSpan, journeyProductMs)
	}

	var network struct {
		Endpoints []measure.JourneyEndpoint `json:"endpoints"`
	}
	call("get_journey_network", map[string]any{"node_id": screen(journeyCart)}, &network)
	if len(network.Endpoints) != 1 || network.Endpoints[0].PathPattern != journeyCartPath || network.Endpoints[0].LatencyMs != journeyCartMs {
		t.Fatalf("get_journey_network on %s = %+v, want only %s at %d ms", journeyCart, network.Endpoints, journeyCartPath, journeyCartMs)
	}

	var journeySessions struct {
		Sessions []measure.FunnelStepSession `json:"sessions"`
	}
	call("get_journey_sessions", map[string]any{"path": []string{screen(journeyCheckout), "fatal"}}, &journeySessions)
	var userIDs []string
	for _, session := range journeySessions.Sessions[:min(3, len(journeySessions.Sessions))] {
		userIDs = append(userIDs, session.UserID)
	}
	if !slices.Equal(userIDs, journeyExpected.latestCrashed) {
		t.Fatalf("get_journey_sessions lists %v first, want %v", userIDs, journeyExpected.latestCrashed)
	}
}

func journeyEvalCases(evalWorld evalWorld, sessions []journeySession) []journeyCase {
	journeyExpected := expectJourney(sessions)
	crash, timeout := evalPaymentCrash, evalRecommendationsTimeout
	android := []uuid.UUID{evalWorld.android}
	reads := []evalCheck{staysWithinApps(evalWorld.android), avoidsTools(funnelWriteTools...), atMostLLMCalls(8)}

	// Claims that a fixture breaks, or that more than one case makes. The
	// seeded journey is small enough that the sample has every user, so an
	// answer that calls its counts estimates misreads the sample.
	estimated := forbids("calls the counts estimates")
	searchNext := forbids(fmt.Sprintf("says %s is the screen most users go to after %s", journeySearch, journeyHome))
	productFatal := forbids(fmt.Sprintf("says %s is the screen most sessions end in a fatal error from", journeyProduct))
	timeoutBeforeFatal := forbids(fmt.Sprintf("says users hit the %s on %s before their session ends in a fatal error", timeout.exceptionClass(), journeyCheckout))
	homeSpanOnProduct := forbids(fmt.Sprintf("says %s runs while users are on %s", journeyHomeSpan, journeyProduct))
	paymentsOnCart := forbids(fmt.Sprintf("says users request %s while on %s", journeyPaymentsPath, journeyCart))
	anrListed := forbids(fmt.Sprintf("gives %s as one of the users whose session ended in a fatal error right after %s", journeyExpected.latestANR, journeyCheckout), nameAnchor(journeyExpected.latestANR))
	errorNamed := forbids(fmt.Sprintf("names an error that users hit while on %s", journeySearch))
	crashBeforeFatal := states(fmt.Sprintf("names the %s in %s", crash.exceptionClass(), crash.fileStem()), nameAnchor(crash.exceptionClass()), nameAnchor(crash.fileStem()))
	iosScreenNamed := forbids("names a screen of the iOS app")

	return []journeyCase{
		{
			evalCase: evalCase{
				id:        "journey-next-screen",
				questions: []string{fmt.Sprintf("In the Android app over the last 7 days, which screen do users most often go to right after %s, and how many users did?", journeyHome)},
				mcpApps:   android,
				checks:    reads,
				claims: []evalClaim{
					states(fmt.Sprintf("names %s as the screen most users go to after %s, with %d users", journeyProduct, journeyHome, journeyExpected.homeToProduct),
						nameAnchor(journeyProduct), numberAnchor(journeyExpected.homeToProduct)),
					searchNext,
					estimated,
				},
				fixtures: []judgeFixture{
					{name: "next screen named", text: fmt.Sprintf("After %s, most users go to %s: %d users did over the last 7 days. %d went to %s.",
						journeyHome, journeyProduct, journeyExpected.homeToProduct, journeyExpected.homeToSearch, journeySearch)},
					{name: "less common screen named", failsOn: searchNext, text: fmt.Sprintf("After %s, most users go to %s, with %d users. %d went to %s.",
						journeyHome, journeySearch, journeyExpected.homeToSearch, journeyExpected.homeToProduct, journeyProduct)},
					{name: "counts called estimates", failsOn: estimated, text: fmt.Sprintf("After %s, most users go to %s: an estimated %d users, from a sample of users.",
						journeyHome, journeyProduct, journeyExpected.homeToProduct)},
				},
			},
			tools: [][]string{{"get_journey", "get_journey_nodes"}},
		},
		{
			evalCase: evalCase{
				id:        "journey-fatal-screen",
				questions: []string{"In the Android app over the last 7 days, from which screen do the most sessions end in a fatal error, and for how many users did that happen?"},
				mcpApps:   android,
				checks:    reads,
				claims: []evalClaim{
					states(fmt.Sprintf("names %s as the screen most sessions end in a fatal error from, for %d users", journeyCheckout, journeyExpected.checkoutToFatal),
						nameAnchor(journeyCheckout), numberAnchor(journeyExpected.checkoutToFatal)),
					productFatal,
					estimated,
				},
				fixtures: []judgeFixture{
					{name: "fatal screen named", text: fmt.Sprintf("Most sessions that end in a fatal error end on %s: %d users. %d more ended on %s.",
						journeyCheckout, journeyExpected.checkoutToFatal, journeyExpected.productToFatal, journeyProduct)},
					{name: "other screen named", failsOn: productFatal, text: fmt.Sprintf("Most fatal errors happen on %s. %d users' sessions ended in a fatal error after %s.",
						journeyProduct, journeyExpected.checkoutToFatal, journeyCheckout)},
				},
			},
			tools: [][]string{{"get_journey"}},
		},
		{
			evalCase: evalCase{
				id: "journey-path-users",
				questions: []string{fmt.Sprintf("How many users of the Android app went from %s to %s and then to %s, one screen right after the other in the same session, over the last 7 days?",
					journeyHome, journeyProduct, journeyCart)},
				mcpApps: android,
				checks:  reads,
				claims: []evalClaim{
					states(fmt.Sprintf("says %d users went along that path", journeyExpected.homeProductCart), numberAnchor(journeyExpected.homeProductCart)),
					estimated,
				},
				fixtures: []judgeFixture{
					{name: "path users given", text: fmt.Sprintf("%d users went from %s to %s to %s in one session over the last 7 days.",
						journeyExpected.homeProductCart, journeyHome, journeyProduct, journeyCart)},
				},
			},
			tools: [][]string{{"get_journey_path_users"}},
		},
		{
			evalCase: evalCase{
				id:        "journey-errors-before-fatal",
				questions: []string{fmt.Sprintf("In the Android app over the last 7 days, which errors do users hit on %s right before their session ends in a fatal error?", journeyCheckout)},
				mcpApps:   android,
				checks:    reads,
				claims:    []evalClaim{crashBeforeFatal, timeoutBeforeFatal},
				fixtures: []judgeFixture{
					{name: "crash named", text: fmt.Sprintf("Sessions that end in a fatal error on %s hit the %s in %s, which is the fatal error itself. The %s on that screen only happens in sessions that go on to %s.",
						journeyCheckout, crash.exceptionClass(), crash.fileName, timeout.exceptionClass(), journeyConfirmation)},
					{name: "timeout listed", failsOn: timeoutBeforeFatal, text: fmt.Sprintf("Before the fatal error on %s, users hit the %s in %s and the %s in %s.",
						journeyCheckout, timeout.exceptionClass(), timeout.fileName, crash.exceptionClass(), crash.fileName)},
				},
			},
			tools: [][]string{{"get_journey_errors"}},
		},
		{
			// The question doesn't give the screen, so the model reads the
			// journey first, and the errors list then gets its sample percent.
			evalCase: evalCase{
				id:        "journey-fatal-screen-errors",
				questions: []string{"In the Android app over the last 7 days, from which screen do the most sessions end in a fatal error, and which errors do users hit on that screen right before it?"},
				mcpApps:   android,
				checks:    reads,
				claims: []evalClaim{
					states(fmt.Sprintf("names %s as the screen most sessions end in a fatal error from", journeyCheckout), nameAnchor(journeyCheckout)),
					crashBeforeFatal,
					timeoutBeforeFatal,
				},
				fixtures: []judgeFixture{
					{name: "screen and crash named", text: fmt.Sprintf("Most sessions that end in a fatal error end on %s. Right before it, users hit the %s in %s, which is the fatal error itself.",
						journeyCheckout, crash.exceptionClass(), crash.fileName)},
				},
			},
			tools: [][]string{{"get_journey"}, {"get_journey_errors"}},
		},
		{
			evalCase: evalCase{
				id:        "journey-traces",
				questions: []string{fmt.Sprintf("In the Android app over the last 7 days, which operations run while users are on %s, and how long do they take at the median?", journeyProduct)},
				mcpApps:   android,
				checks:    reads,
				claims: []evalClaim{
					states(fmt.Sprintf("says %s takes about %d ms", journeyProductSpan, journeyProductMs), eventNameAnchor(journeyProductSpan), millisecondsAnchor(journeyProductMs)),
					homeSpanOnProduct,
				},
				fixtures: []judgeFixture{
					{name: "span named", text: fmt.Sprintf("While users are on %s, %s runs, with a median of 850 ms.", journeyProduct, journeyProductSpan)},
					{name: "other screen's span listed", failsOn: homeSpanOnProduct, text: fmt.Sprintf("While users are on %s, %s takes 850 ms and %s takes 300 ms.",
						journeyProduct, journeyProductSpan, journeyHomeSpan)},
				},
			},
			tools: [][]string{{"get_journey_traces"}},
		},
		{
			evalCase: evalCase{
				id:        "journey-network",
				questions: []string{fmt.Sprintf("In the Android app over the last 7 days, which network requests do users make while on %s, and what is their median latency?", journeyCart)},
				mcpApps:   android,
				checks:    reads,
				claims: []evalClaim{
					states(fmt.Sprintf("says requests to %s take about %d ms", journeyCartPath, journeyCartMs),
						patternAnchor(journeyCartPath, `(?i)`+regexp.QuoteMeta(journeyCartPath)+`\b`), millisecondsAnchor(journeyCartMs)),
					paymentsOnCart,
				},
				fixtures: []judgeFixture{
					{name: "request named", text: fmt.Sprintf("On %s, users request %s%s, with a median latency of 240 ms.", journeyCart, journeyDomain, journeyCartPath)},
					{name: "other screen's request listed", failsOn: paymentsOnCart, text: fmt.Sprintf("On %s, users request %s (240 ms) and %s (900 ms).",
						journeyCart, journeyCartPath, journeyPaymentsPath)},
				},
			},
			tools: [][]string{{"get_journey_network"}},
		},
		{
			evalCase: evalCase{
				id:        "journey-sessions",
				questions: []string{fmt.Sprintf("Give the user ids of the three users whose sessions most recently ended in a fatal error right after %s in the Android app over the last 7 days.", journeyCheckout)},
				mcpApps:   android,
				checks:    reads,
				claims: []evalClaim{
					states("gives the user ids "+strings.Join(journeyExpected.latestCrashed, ", "),
						nameAnchor(journeyExpected.latestCrashed[0]), nameAnchor(journeyExpected.latestCrashed[1]), nameAnchor(journeyExpected.latestCrashed[2])),
					anrListed,
				},
				fixtures: []judgeFixture{
					{name: "users listed", text: "The three most recent are " + strings.Join(journeyExpected.latestCrashed, ", ") + "."},
					{name: "other screen's user listed", failsOn: anrListed, text: fmt.Sprintf("The three most recent are %s, %s and %s.",
						journeyExpected.latestCrashed[0], journeyExpected.latestCrashed[1], journeyExpected.latestANR)},
				},
			},
			tools: [][]string{{"get_journey_sessions"}},
		},
		{
			evalCase: evalCase{
				id:        "journey-no-errors",
				questions: []string{fmt.Sprintf("Which errors do users of the Android app hit while on %s over the last 7 days?", journeySearch)},
				mcpApps:   android,
				checks:    reads,
				claims: []evalClaim{
					states(fmt.Sprintf("says no errors were found for users on %s", journeySearch)),
					errorNamed,
				},
				fixtures: []judgeFixture{
					{name: "no errors found", text: fmt.Sprintf("No errors were found while users were on %s over the last 7 days.", journeySearch)},
					{name: "sample had no matching users", text: fmt.Sprintf("The sample had no users who hit an error while on %s over the last 7 days.", journeySearch)},
					{name: "error named", failsOn: errorNamed, text: fmt.Sprintf("Users on %s hit the %s in %s.", journeySearch, timeout.exceptionClass(), timeout.fileName)},
				},
			},
			tools: [][]string{{"get_journey_errors"}},
		},
		{
			// The follow-up only gives the screen as "that screen", so the
			// model has to carry it over from the first answer. A run keeps
			// only the last question's tool calls, so tools lists only the
			// follow-up's.
			evalCase: evalCase{
				id: "journey-follow-up",
				questions: []string{
					"In the Android app over the last 7 days, from which screen do the most sessions end in a fatal error?",
					"Which errors do users hit on that screen right before the fatal error?",
				},
				checks: reads,
				claims: []evalClaim{crashBeforeFatal, timeoutBeforeFatal},
			},
			tools: [][]string{{"get_journey_errors"}},
		},
		{
			evalCase: evalCase{
				id:        "journey-no-data",
				questions: []string{"Which screens do users of the iOS app visit the most over the last 7 days?"},
				mcpApps:   []uuid.UUID{evalWorld.ios},
				checks:    []evalCheck{staysWithinApps(evalWorld.ios), avoidsTools(funnelWriteTools...), atMostLLMCalls(8)},
				claims: []evalClaim{
					states("says no screen visits were found for the iOS app in the last 7 days"),
					iosScreenNamed,
				},
				fixtures: []judgeFixture{
					{name: "no data found", text: "The iOS app has no journey data for the last 7 days, so there are no screen visits to rank."},
					{name: "screen named", failsOn: iosScreenNamed, text: fmt.Sprintf("On iOS, %s is the most visited screen.", journeyHome)},
				},
			},
			tools: [][]string{{"get_journey", "get_journey_nodes"}},
		},
	}
}
