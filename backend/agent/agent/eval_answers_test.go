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
	for _, surface := range surfaces {
		if surface != evalSurfaceMCP && surface != evalSurfaceSlack {
			t.Fatalf("EVAL_SURFACES has %q, want mcp or slack", surface)
		}
	}

	ctx := context.Background()
	defer cleanupAll(ctx, t)
	checkSeedPremises(t)
	evalWorld := seedEvalWorld(ctx, t)
	cases := evalCases(evalWorld)
	checkExpectedCounts(t, cases)
	// Answers are also held to the system prompt's rule against showing
	// internals. Compaction summaries are not, since the compaction prompt
	// asks for app ids.
	internals := hidesInternals(internalsPattern(ctx, t, env.config(env.models[0])))
	for i := range cases {
		cases[i].checks = append([]evalCheck{internals}, cases[i].checks...)
		cases[i].claims = append(cases[i].claims, evalShowsInternals)
		// Answers often name an app only by its bundle identifier, which the
		// judge cannot tie to "the Android app" or "the iOS app" on its own.
		cases[i].textDescription = cases[i].describeText() + "\nThe team's apps are Shopper for Android (com.shopper.android) and Shopper for iOS (com.shopper.ios).\n"
	}
	env.calibrateJudge(ctx, t, cases)

	started := time.Now()
	results := env.collect(t, func(t *testing.T, record func(evalResult)) {
		for _, model := range env.models {
			config := env.config(model)
			// Every level is parallel: a subtest's t.Run waits for the whole
			// subtest to finish, so a sequential level would run its children
			// one group at a time.
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
	env.report(t, "answers", started, surfaces, cases, results)
}

// Every count a case expects is computed from the seeded data below, so a
// change to the data reaches the cases' claims and fixtures.

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

// evalDays covers every calendar day of a "last 7 days" window but the
// current one, so no error group looks as if it appeared partway through the
// window.
const evalDays = 7

type evalErrorKind int

const (
	evalCrash evalErrorKind = iota
	evalHandledError
	evalANR
)

// evalError is one error group on one release.
type evalError struct {
	kind        evalErrorKind
	device      evalDevice
	fingerprint string
	errType     string
	message     string
	methodName  string
	fileName    string
	perDay      []int
	// users spreads the events over this many distinct users, each with its
	// own user id and installation id, since Measure counts an error's users
	// by installation; zero leaves both to the seed's defaults.
	users int
}

func (e evalError) total() int { return sum(e.perDay) }

func (e evalError) exceptionClass() string { return exceptionClass(e.errType) }
func (e evalError) fileStem() string       { return fileStem(e.fileName) }

func (e evalError) onRelease(release evalDevice, perDay ...int) evalError {
	e.device, e.perDay, e.users = release, perDay, 0
	return e
}

// The Android app's handled SocketTimeoutException outnumbers every crash, so
// an answer that treats errors as crashes names the wrong top crash. The
// OutOfMemoryError spiked a day ago, and the NullPointerException exists only
// in 2.3.1.
var (
	evalCheckoutCrash = evalError{
		kind: evalCrash, device: evalAndroidDevice,
		fingerprint: "a1000000000000000000000000000001",
		errType:     "java.lang.NullPointerException",
		message:     "Attempt to invoke virtual method 'java.lang.String com.shopper.cart.Cart.getId()' on a null object reference",
		methodName:  "onPlaceOrderClicked", fileName: "CheckoutActivity.kt",
		perDay: []int{64, 70, 76, 82, 88, 92, 96},
		users:  113,
	}
	evalPaymentCrash = evalError{
		kind: evalCrash, device: evalAndroidDevice,
		fingerprint: "a1000000000000000000000000000002",
		errType:     "java.lang.IllegalStateException",
		message:     "Fragment PaymentFragment not attached to a context.",
		methodName:  "onPaymentResult", fileName: "PaymentFragment.kt",
		perDay: []int{8, 9, 8, 8, 8, 9, 8},
	}
	evalPaymentCrashOld        = evalPaymentCrash.onRelease(evalAndroidOldDevice, 25, 25, 25, 25, 25, 25, 25)
	evalRecommendationsTimeout = evalError{
		kind: evalHandledError, device: evalAndroidDevice,
		fingerprint: "a1000000000000000000000000000003",
		errType:     "java.net.SocketTimeoutException",
		message:     "timeout",
		methodName:  "fetchRecommendations", fileName: "RecommendationsRepository.kt",
		perDay: []int{106, 106, 106, 106, 106, 106, 106},
	}
	evalImageANR = evalError{
		kind: evalANR, device: evalAndroidDevice,
		fingerprint: "a1000000000000000000000000000004",
		errType:     "com.shopper.ANR",
		message:     "Application Not Responding for at least 5000 ms",
		methodName:  "decodeBitmap", fileName: "ImageLoader.kt",
		perDay: []int{26, 27, 26, 26, 26, 27, 26},
	}
	evalGalleryCrash = evalError{
		kind: evalCrash, device: evalAndroidDevice,
		fingerprint: "a1000000000000000000000000000005",
		errType:     "java.lang.OutOfMemoryError",
		message:     "Failed to allocate a 33177612 byte allocation with 4194304 free bytes",
		methodName:  "onBindViewHolder", fileName: "ProductGalleryAdapter.kt",
		perDay: []int{180, 2, 1, 2, 1, 2, 1},
	}
	evalCartCrash = evalError{
		kind: evalCrash, device: evalIOSDevice,
		fingerprint: "b1000000000000000000000000000001",
		errType:     "EXC_BAD_ACCESS",
		message:     "KERN_INVALID_ADDRESS at 0x0000000000000010",
		methodName:  "tableView(_:cellForRowAt:)", fileName: "CartViewController.swift",
		perDay: []int{30, 32, 31, 33, 32, 31, 30},
	}
	evalErrors = []evalError{
		evalCheckoutCrash, evalPaymentCrash, evalPaymentCrashOld, evalRecommendationsTimeout,
		evalImageANR, evalGalleryCrash, evalCartCrash,
	}
)

func evalErrorCount(kind evalErrorKind, matches func(evalDevice) bool) int {
	count := 0
	for _, evalError := range evalErrors {
		if evalError.kind == kind && matches(evalError.device) {
			count += evalError.total()
		}
	}
	return count
}

func evalCrashes(osName string) int {
	return evalErrorCount(evalCrash, func(evalDevice evalDevice) bool { return evalDevice.osName == osName })
}

func evalCrashesIn(appVersion string) int {
	return evalErrorCount(evalCrash, func(evalDevice evalDevice) bool { return evalDevice.appVersion == appVersion })
}

func evalANRs(osName string) int {
	return evalErrorCount(evalANR, func(evalDevice evalDevice) bool { return evalDevice.osName == osName })
}

// evalCustomEvent is a custom event seeded perSession to a session, so an
// answer that counts sessions gets the event count wrong. No purpose-built
// tool counts custom events, so questions about them need SQL.
type evalCustomEvent struct {
	device     evalDevice
	name       string
	perDay     []int
	perSession int
}

func (c evalCustomEvent) total() int { return sum(c.perDay) }

func (c evalCustomEvent) sessionsOn(day int) int {
	return (c.perDay[day] + c.perSession - 1) / c.perSession
}

func (c evalCustomEvent) busiestDay() int {
	return slices.Index(c.perDay, slices.Max(c.perDay))
}

var (
	evalAndroidAddToCart = evalCustomEvent{evalAndroidDevice, "add_to_cart", []int{130, 140, 190, 150, 130, 120, 125}, 4}
	evalIOSAddToCart     = evalCustomEvent{evalIOSDevice, "add_to_cart", []int{54, 54, 54, 54, 54, 54, 54}, 3}
	evalCheckoutStarted  = evalCustomEvent{evalAndroidDevice, "checkout_started", []int{66, 67, 66, 67, 67, 66, 66}, 2}
	evalCustomEvents     = []evalCustomEvent{evalAndroidAddToCart, evalIOSAddToCart, evalCheckoutStarted}
)

// evalLogLine is a log line seeded perDay times a day. No purpose-built tool
// searches logs, so questions about them need SQL.
type evalLogLine struct {
	device evalDevice
	body   string
	perDay []int
}

func (l evalLogLine) total() int { return sum(l.perDay) }

var (
	evalGatewayTimeoutLogs = evalLogLine{evalAndroidDevice, "payment gateway timeout", []int{21, 21, 21, 21, 21, 21, 21}}
	evalCartSyncedLogs     = evalLogLine{evalAndroidDevice, "cart synced", []int{100, 100, 100, 100, 100, 100, 100}}
	evalLogLines           = []evalLogLine{evalGatewayTimeoutLogs, evalCartSyncedLogs}
)

// evalErrorFreeSessions are sessions without errors, seeded perDay a day, so
// crash-free rates are realistic.
var evalErrorFreeSessions = []struct {
	device evalDevice
	perDay int
}{
	{evalAndroidDevice, 800},
	{evalAndroidOldDevice, 300},
	{evalIOSDevice, 400},
}

func sum(counts []int) int {
	total := 0
	for _, n := range counts {
		total += n
	}
	return total
}

// checkSeedPremises fails the test when the seeded data no longer holds the
// premises the cases rely on.
func checkSeedPremises(t *testing.T) {
	t.Helper()
	var perDay [][]int
	for _, evalError := range evalErrors {
		perDay = append(perDay, evalError.perDay)
	}
	for _, customEvent := range evalCustomEvents {
		perDay = append(perDay, customEvent.perDay)
	}
	for _, logLine := range evalLogLines {
		perDay = append(perDay, logLine.perDay)
	}
	for _, counts := range perDay {
		if len(counts) != evalDays {
			t.Fatalf("seeded counts %v have %d days, want %d", counts, len(counts), evalDays)
		}
	}

	if largestAndroidErrorGroup(func(evalError evalError) bool { return evalError.kind == evalCrash }) != evalCheckoutCrash.fingerprint {
		t.Fatal("evalCheckoutCrash must be the Android app's only largest crash")
	}
	if largestAndroidErrorGroup(func(evalError) bool { return true }) != evalRecommendationsTimeout.fingerprint {
		t.Fatal("evalRecommendationsTimeout must be the Android app's only largest error")
	}
	releases := 0
	for _, evalError := range evalErrors {
		if evalError.fingerprint == evalCheckoutCrash.fingerprint {
			releases++
		}
	}
	if releases != 1 {
		t.Fatal("evalCheckoutCrash must be seeded on one release only")
	}
	// A crash spiked when its most recent day has more than three times the
	// events of any other day.
	for _, evalError := range evalErrors {
		spiked := evalError.perDay[0] > 3*slices.Max(evalError.perDay[1:])
		if evalError.kind == evalCrash && evalError.device.osName == "android" && spiked != (evalError.fingerprint == evalGalleryCrash.fingerprint) {
			t.Fatalf("evalGalleryCrash must be the Android app's only spiked crash, and %s is not", evalError.errType)
		}
	}
	busiestCount := slices.Max(evalAndroidAddToCart.perDay)
	days := 0
	for _, n := range evalAndroidAddToCart.perDay {
		if n == busiestCount {
			days++
		}
	}
	if days != 1 {
		t.Fatal("evalAndroidAddToCart must have one busiest day")
	}
}

// largestAndroidErrorGroup adds up each group's releases, and returns "" when
// two groups tie.
func largestAndroidErrorGroup(keep func(evalError) bool) string {
	groups := map[string]int{}
	for _, evalError := range evalErrors {
		if evalError.device.osName == "android" && keep(evalError) {
			groups[evalError.fingerprint] += evalError.total()
		}
	}
	largest, tied := "", false
	for fingerprint, n := range groups {
		switch {
		case largest == "" || n > groups[largest]:
			largest, tied = fingerprint, false
		case n == groups[largest]:
			tied = true
		}
	}
	if tied {
		return ""
	}
	return largest
}

// checkExpectedCounts fails the test when a count the cases expect could be
// read as something else in an answer: another expected count, a seeded
// count for one day, user or session, a day of the month, a minute or a
// year. Such a count would let a wrong answer carry the right number.
func checkExpectedCounts(t *testing.T, cases []evalCase) {
	t.Helper()
	expected := map[int]string{}
	for _, evalCase := range cases {
		for _, evalClaim := range evalCase.claims {
			if evalClaim.forbidden {
				continue
			}
			for _, evalAnchor := range evalClaim.anchors {
				for _, n := range evalAnchor.numbers {
					if other, ok := expected[n]; ok && other != evalClaim.claim {
						t.Fatalf("%d is expected by two claims: %q and %q", n, other, evalClaim.claim)
					}
					expected[n] = evalClaim.claim
				}
			}
		}
	}

	seededCounts := []int{}
	for _, evalError := range evalErrors {
		seededCounts = append(seededCounts, evalError.perDay...)
		if evalError.users > 0 {
			seededCounts = append(seededCounts, evalError.total()/evalError.users, evalError.total()/evalError.users+1)
		}
	}
	for _, customEvent := range evalCustomEvents {
		for day, n := range customEvent.perDay {
			// The busiest day's count of Android add_to_cart events is what
			// the sql-busiest-day case expects, not another quantity.
			if customEvent.name != evalAndroidAddToCart.name || customEvent.device != evalAndroidAddToCart.device || day != customEvent.busiestDay() {
				seededCounts = append(seededCounts, n)
			}
		}
		sessions := 0
		for day := range customEvent.perDay {
			seededCounts = append(seededCounts, customEvent.sessionsOn(day))
			sessions += customEvent.sessionsOn(day)
		}
		seededCounts = append(seededCounts, sessions)
	}
	for _, logLine := range evalLogLines {
		seededCounts = append(seededCounts, logLine.perDay...)
	}
	for _, errorFreeSessions := range evalErrorFreeSessions {
		seededCounts = append(seededCounts, errorFreeSessions.perDay, errorFreeSessions.perDay*evalDays)
	}

	for n, claim := range expected {
		switch {
		case n < 100:
			t.Fatalf("%d, expected by %q, is below 100 and could be a day of the month or a minute", n, claim)
		case n >= 2000 && n < 2100:
			t.Fatalf("%d, expected by %q, could be a year", n, claim)
		case slices.Contains(seededCounts, n):
			t.Fatalf("%d, expected by %q, is also a seeded count for one day, user or session", n, claim)
		}
	}
}

type evalWorld struct {
	teamID   uuid.UUID
	userID   uuid.UUID
	android  uuid.UUID
	ios      uuid.UUID
	seededAt time.Time
}

func (w evalWorld) appFor(d evalDevice) uuid.UUID {
	if d.osName == "ios" {
		return w.ios
	}
	return w.android
}

// seededDay puts a day's events at noon, except on the oldest day, which is
// only partly inside the 7-day window; its events go halfway between the
// window's start and that day's end.
func (w evalWorld) seededDay(day int) time.Time {
	today := w.seededAt.Truncate(24 * time.Hour)
	if day < evalDays-1 {
		return today.AddDate(0, 0, -(day + 1)).Add(12 * time.Hour)
	}
	windowStart := w.seededAt.AddDate(0, 0, -7)
	dayEnd := today.AddDate(0, 0, -day)
	return windowStart.Add(dayEnd.Sub(windowStart) / 2)
}

func seedEvalWorld(ctx context.Context, t *testing.T) evalWorld {
	t.Helper()
	// Events are placed relative to the real current time, because the
	// agent's tools and ClickHouse's now() read the real clock.
	evalWorld := evalWorld{teamID: uuid.New(), userID: uuid.New(), android: uuid.New(), ios: uuid.New(), seededAt: time.Now().UTC()}
	th.SeedTeam(ctx, t, evalWorld.teamID.String(), "Shopper")
	th.SeedUser(ctx, t, evalWorld.userID.String(), "eval@shopper.dev")
	th.SeedTeamMembership(ctx, t, evalWorld.teamID.String(), evalWorld.userID.String(), "owner")
	seedEvalApp(ctx, t, evalWorld.teamID, evalWorld.android, "Shopper", "com.shopper.android", "android")
	seedEvalApp(ctx, t, evalWorld.teamID, evalWorld.ios, "Shopper", "com.shopper.ios", "ios")

	for _, evalError := range evalErrors {
		seedEvalError(ctx, t, evalWorld, evalError)
	}
	for _, customEvent := range evalCustomEvents {
		for day, n := range customEvent.perDay {
			for n > 0 {
				count := min(customEvent.perSession, n)
				seedEvalEvents(ctx, t, evalWorld, customEvent.device, count, testinfra.EventRow{Type: "custom", CustomName: customEvent.name, SessionID: uuid.NewString(), Timestamp: evalWorld.seededDay(day)})
				n -= count
			}
		}
	}
	for _, logLine := range evalLogLines {
		for day, n := range logLine.perDay {
			seedEvalEvents(ctx, t, evalWorld, logLine.device, n, testinfra.EventRow{Type: "log", LogBody: logLine.body, Timestamp: evalWorld.seededDay(day)})
		}
	}
	for _, errorFreeSessions := range evalErrorFreeSessions {
		for day := range evalDays {
			seedEvalEvents(ctx, t, evalWorld, errorFreeSessions.device, errorFreeSessions.perDay, testinfra.EventRow{Timestamp: evalWorld.seededDay(day)})
		}
	}
	return evalWorld
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

func seedEvalError(ctx context.Context, t *testing.T, evalWorld evalWorld, evalError evalError) {
	t.Helper()
	table, eventType, handled := "fatal_exception_groups", "exception", false
	switch evalError.kind {
	case evalHandledError:
		table, handled = "nonfatal_exception_groups", true
	case evalANR:
		table, eventType = "anr_groups", "anr"
	}
	th.SeedGroupRow(ctx, t, evalWorld.teamID.String(), evalWorld.appFor(evalError.device).String(), testinfra.GroupRow{
		Table:       table,
		Fingerprint: evalError.fingerprint,
		AppVersion:  evalError.device.appVersion,
		AppBuild:    evalError.device.appBuild,
		Type:        evalError.errType,
		Message:     evalError.message,
		MethodName:  evalError.methodName,
		FileName:    evalError.fileName,
		Handled:     handled,
	})
	next := 0
	for day, n := range evalError.perDay {
		row := testinfra.EventRow{Type: eventType, Fingerprint: evalError.fingerprint, Handled: handled, Timestamp: evalWorld.seededDay(day)}
		if evalError.users == 0 {
			seedEvalEvents(ctx, t, evalWorld, evalError.device, n, row)
			continue
		}
		// An insert gives every row the same user, so the day's events are
		// written once per user.
		perUser := map[int]int{}
		for range n {
			perUser[next%evalError.users]++
			next++
		}
		for user, count := range perUser {
			row.UserID = fmt.Sprintf("user-%03d", user)
			row.InstallationID = uuid.NewSHA1(uuid.NameSpaceOID, []byte(row.UserID)).String()
			seedEvalEvents(ctx, t, evalWorld, evalError.device, count, row)
		}
	}
}

// seedEvalEvents fills in every device attribute, since ClickHouse records
// filter values only for events that carry all of them.
func seedEvalEvents(ctx context.Context, t *testing.T, evalWorld evalWorld, evalDevice evalDevice, count int, row testinfra.EventRow) {
	t.Helper()
	row.AppVersion, row.AppBuild = evalDevice.appVersion, evalDevice.appBuild
	row.OSName, row.OSVersion = evalDevice.osName, evalDevice.osVersion
	row.CountryCode = "US"
	row.NetworkProvider, row.NetworkType, row.NetworkGeneration = evalDevice.networkProvider, evalDevice.networkType, evalDevice.networkGeneration
	row.DeviceLocale = "en-US"
	row.DeviceManufacturer, row.DeviceName = evalDevice.manufacturer, evalDevice.deviceName
	th.SeedEventRows(ctx, t, evalWorld.teamID.String(), evalWorld.appFor(evalDevice).String(), count, row)
}

// evalShowsInternals covers the internals in the system prompt's rule that
// hidesInternals cannot match, because they are ordinary words or free text.
var evalShowsInternals = forbids("shows SQL, gives a raw database table or column name, or mentions a legacy handled-flag fallback")

// The fixtures include answers that name the right crash, number or version
// in a wrong claim.
func evalCases(evalWorld evalWorld) []evalCase {
	checkout, timeout, gallery, cart := evalCheckoutCrash, evalRecommendationsTimeout, evalGalleryCrash, evalCartCrash
	androidCrashes, androidCrashesAndANRs := evalCrashes("android"), evalCrashes("android")+evalANRs("android")
	iosCrashes := evalCrashes("ios")
	newVersion, oldVersion := evalAndroidDevice, evalAndroidOldDevice
	addToCart, iosAddToCart, checkoutStarted := evalAndroidAddToCart, evalIOSAddToCart, evalCheckoutStarted
	busiestDayIndex := addToCart.busiestDay()
	busiestDate := evalWorld.seededDay(busiestDayIndex)
	ratio := 100 * float64(checkoutStarted.total()) / float64(addToCart.total())

	// Claims that a fixture breaks, or that more than one case makes.
	iosCrashesClaim := states(fmt.Sprintf("says the iOS app had %d crashes", iosCrashes), numberAnchor(iosCrashes))
	androidCrashesClaim := states(fmt.Sprintf("says the Android app had %d crashes, or %d counting ANRs", androidCrashes, androidCrashesAndANRs),
		numberAnchor(androidCrashes, androidCrashesAndANRs))
	topCrash := states(fmt.Sprintf("names the %s in %s as the top crash, with %d crashes", checkout.exceptionClass(), checkout.fileStem(), checkout.total()),
		nameAnchor(checkout.exceptionClass()), nameAnchor(checkout.fileStem()), numberAnchor(checkout.total()))
	timeoutIsCrash := forbids(fmt.Sprintf("calls the %s a crash", timeout.exceptionClass()))
	gallerySpiked := states(fmt.Sprintf("says the %s crash spiked", gallery.exceptionClass()), nameAnchor(gallery.exceptionClass()))
	otherCrashSpiked := forbids(fmt.Sprintf("says a crash other than the %s spiked", gallery.exceptionClass()))
	introducedInNew := states(fmt.Sprintf("says version %s introduced the crash", newVersion.appVersion), versionAnchor(newVersion.appVersion))
	noLaunchData := states("says there is no launch time data for the iOS app in the period")
	givesLaunchTime := forbids("gives a launch time for the iOS app")
	addToCartCount := states(fmt.Sprintf("says the Android app recorded %d %s events", addToCart.total(), addToCart.name), numberAnchor(addToCart.total()))
	addToCartAsSessions := forbids(fmt.Sprintf("gives %d as a count of sessions or users", addToCart.total()), numberAnchor(addToCart.total()))
	busiestDayClaim := states(fmt.Sprintf("names %s as the day with the most %s events, with %d", busiestDate.Format("January 2"), addToCart.name, addToCart.perDay[busiestDayIndex]),
		dateAnchor(busiestDate), numberAnchor(addToCart.perDay[busiestDayIndex]))
	usersAsCrashes := forbids(fmt.Sprintf("gives %d as a count of crashes, events or sessions", checkout.users), numberAnchor(checkout.users))

	return []evalCase{
		{
			id:        "greeting",
			questions: []string{"hi there!"},
			checks:    []evalCheck{usesNoTools(), atMostLLMCalls(1)},
		},
		{
			id:        "top-crash-android",
			questions: []string{"What's the top crash in the Android app over the last 7 days?"},
			mcpApps:   []uuid.UUID{evalWorld.android},
			checks: []evalCheck{
				staysWithinApps(evalWorld.android),
				avoidsTools("update_bug_report_status"),
				atMostLLMCalls(8),
			},
			claims: []evalClaim{topCrash, timeoutIsCrash},
			fixtures: []judgeFixture{
				{name: "top crash named", text: fmt.Sprintf(
					"The top crash in Shopper (Android) over the last 7 days is a **%s** in %s, in %s, with %d crashes affecting %d users.",
					checkout.errType, checkout.fileName, checkout.methodName, checkout.total(), checkout.users)},
				{name: "handled error called the top crash", failsOn: timeoutIsCrash, text: fmt.Sprintf(
					"The top crash is %s in %s with %d crashes. Next is the %s in %s with %d.",
					timeout.errType, timeout.fileName, timeout.total(), checkout.exceptionClass(), checkout.fileName, checkout.total())},
				{name: "top crash's count given to another crash", failsOn: topCrash, text: fmt.Sprintf(
					"The top crash is the %s with %d crashes. The %s in %s had %d crashes.",
					gallery.exceptionClass(), gallery.total(), checkout.exceptionClass(), checkout.fileName, checkout.total())},
			},
		},
		{
			id:        "crash-count-ios",
			questions: []string{"How many crashes did the iOS app have in the last 7 days?"},
			mcpApps:   []uuid.UUID{evalWorld.ios},
			checks: []evalCheck{
				staysWithinApps(evalWorld.ios),
				avoidsTools("update_bug_report_status"),
				atMostLLMCalls(8),
			},
			claims: []evalClaim{iosCrashesClaim},
			fixtures: []judgeFixture{
				{name: "count with method line", text: fmt.Sprintf(
					"The iOS app had %d crashes in the last 7 days, all of them one %s crash in %s.\n\nMethod: Shopper (com.shopper.ios), last 7 days UTC, crashes = fatal exceptions.",
					iosCrashes, cart.errType, cart.fileName)},
				{name: "sql shown", failsOn: evalShowsInternals, text: fmt.Sprintf(
					"The iOS app had %d crashes. I counted them with select count() from events where exception.handled = false.", iosCrashes)},
			},
		},
		{
			id:        "anr-count-android",
			questions: []string{"How many ANRs did the Android app have in the last 7 days?"},
			mcpApps:   []uuid.UUID{evalWorld.android},
			checks: []evalCheck{
				staysWithinApps(evalWorld.android),
				avoidsTools("update_bug_report_status"),
				atMostLLMCalls(8),
			},
			claims: []evalClaim{
				states(fmt.Sprintf("says the Android app had %d ANRs", evalANRs("android")), numberAnchor(evalANRs("android"))),
			},
		},
		{
			id:        "top-error-android",
			questions: []string{"What's the most frequent error in the Android app over the last 7 days, handled exceptions included?"},
			mcpApps:   []uuid.UUID{evalWorld.android},
			checks: []evalCheck{
				staysWithinApps(evalWorld.android),
				atMostLLMCalls(8),
			},
			claims: []evalClaim{
				states(fmt.Sprintf("names the %s as the most frequent error, with %d occurrences", timeout.exceptionClass(), timeout.total()),
					nameAnchor(timeout.exceptionClass()), numberAnchor(timeout.total())),
			},
		},
		{
			id:        "crash-spike-android",
			questions: []string{"Has any crash in the Android app spiked over the last 7 days?"},
			mcpApps:   []uuid.UUID{evalWorld.android},
			checks: []evalCheck{
				staysWithinApps(evalWorld.android),
				atMostLLMCalls(12),
			},
			claims: []evalClaim{gallerySpiked, otherCrashSpiked},
			fixtures: []judgeFixture{
				{name: "spike named", text: fmt.Sprintf(
					"Yes. The %s in %s jumped to %d crashes yesterday, from a few a day before that.",
					gallery.errType, gallery.fileName, gallery.perDay[0])},
				{name: "spike denied", failsOn: gallerySpiked, text: fmt.Sprintf(
					"No crash spiked. The %s and the %s both stayed steady over the week.", gallery.exceptionClass(), checkout.exceptionClass())},
				{name: "another crash named as the spike", failsOn: otherCrashSpiked, text: fmt.Sprintf(
					"Yes. The %s in %s spiked yesterday.", checkout.exceptionClass(), checkout.fileName)},
			},
		},
		{
			id:        "crashes-in-version-android",
			questions: []string{fmt.Sprintf("How many crashes did version %s of the Android app have in the last 7 days?", oldVersion.appVersion)},
			mcpApps:   []uuid.UUID{evalWorld.android},
			checks: []evalCheck{
				staysWithinApps(evalWorld.android),
				atMostLLMCalls(10),
			},
			claims: []evalClaim{
				states(fmt.Sprintf("says version %s had %d crashes", oldVersion.appVersion, evalCrashesIn(oldVersion.appVersion)),
					versionAnchor(oldVersion.appVersion), numberAnchor(evalCrashesIn(oldVersion.appVersion))),
			},
		},
		{
			id:        "version-introduced-crash",
			questions: []string{fmt.Sprintf("Which version of the Android app introduced the %s crash in checkout?", checkout.exceptionClass())},
			mcpApps:   []uuid.UUID{evalWorld.android},
			checks: []evalCheck{
				staysWithinApps(evalWorld.android),
				atMostLLMCalls(12),
			},
			claims: []evalClaim{
				introducedInNew,
				forbids(fmt.Sprintf("says the crash was introduced in, or occurs in, version %s", oldVersion.appVersion)),
			},
			fixtures: []judgeFixture{
				{name: "version named", text: fmt.Sprintf(
					"The %s in %s first appears in version %s (build %s). Version %s has no occurrences, so %s introduced it.",
					checkout.exceptionClass(), checkout.fileStem(), newVersion.appVersion, newVersion.appBuild, oldVersion.appVersion, newVersion.appVersion)},
				{name: "older version blamed", failsOn: introducedInNew, text: fmt.Sprintf(
					"The crash was introduced in version %s and is still present in %s.", oldVersion.appVersion, newVersion.appVersion)},
			},
		},
		{
			id:        "compare-platforms",
			questions: []string{"Compare crash counts between the Android and iOS apps over the last 7 days."},
			checks:    []evalCheck{atMostLLMCalls(12)},
			// ANRs are crashes to some readers, so the Android count may
			// include them.
			claims: []evalClaim{androidCrashesClaim, iosCrashesClaim},
			fixtures: []judgeFixture{
				{name: "platforms compared", text: fmt.Sprintf(
					"Over the last 7 days the Android app had %d crashes and the iOS app had %d.", androidCrashes, iosCrashes)},
				{name: "platform counts swapped", failsOn: iosCrashesClaim, text: fmt.Sprintf(
					"The Android app had %d crashes and the iOS app had %d.", iosCrashes, androidCrashes)},
			},
		},
		{
			id:        "no-app-named",
			questions: []string{"How many crashes did we have in the last 7 days?"},
			checks:    []evalCheck{atMostLLMCalls(12)},
			claims:    []evalClaim{androidCrashesClaim, iosCrashesClaim},
		},
		{
			id:        "no-launch-data",
			questions: []string{"What's the p95 cold launch time of the iOS app over the last 7 days?"},
			mcpApps:   []uuid.UUID{evalWorld.ios},
			checks: []evalCheck{
				staysWithinApps(evalWorld.ios),
				atMostLLMCalls(10),
			},
			claims: []evalClaim{noLaunchData, givesLaunchTime},
			fixtures: []judgeFixture{
				{name: "missing launch data stated",
					text: "Measure has no cold launch data for the iOS app in the last 7 days, so I can't give a p95 cold launch time."},
				{name: "launch time in minutes", failsOn: givesLaunchTime,
					text: "The p95 cold launch time of the iOS app over the last 7 days was about 1.2 minutes."},
				{name: "launch time from another app", failsOn: givesLaunchTime,
					text: "The iOS app has no launch data of its own, but its p95 cold launch time is likely about 850 ms, based on the Android app."},
			},
		},
		{
			id:        "sql-custom-event-count",
			questions: []string{fmt.Sprintf("How many %s custom events did the Android app record in the last 7 days?", addToCart.name)},
			mcpApps:   []uuid.UUID{evalWorld.android},
			checks: []evalCheck{
				usesTool("run_sql"),
				lastSQLSucceeds(),
				staysWithinApps(evalWorld.android),
				atMostLLMCalls(10),
			},
			claims: []evalClaim{addToCartCount, addToCartAsSessions},
			fixtures: []judgeFixture{
				{name: "event count with its name", text: fmt.Sprintf(
					"The Android app recorded %d %s custom events in the last 7 days.", addToCart.total(), addToCart.name)},
				{name: "events given as sessions", failsOn: addToCartAsSessions, text: fmt.Sprintf(
					"%d sessions added items to their cart in the last 7 days.", addToCart.total())},
			},
		},
		{
			id:        "sql-custom-event-by-app",
			questions: []string{fmt.Sprintf("Compare the number of %s custom events between the Android and iOS apps over the last 7 days.", addToCart.name)},
			checks: []evalCheck{
				usesTool("run_sql"),
				lastSQLSucceeds(),
				atMostLLMCalls(10),
			},
			claims: []evalClaim{
				addToCartCount,
				states(fmt.Sprintf("says the iOS app recorded %d %s events", iosAddToCart.total(), iosAddToCart.name), numberAnchor(iosAddToCart.total())),
			},
		},
		{
			id: "sql-event-ratio",
			questions: []string{fmt.Sprintf("In the Android app, what's the ratio of %s to %s custom events over the last 7 days, as a percentage?",
				checkoutStarted.name, addToCart.name)},
			mcpApps: []uuid.UUID{evalWorld.android},
			checks: []evalCheck{
				usesTool("run_sql"),
				lastSQLSucceeds(),
				staysWithinApps(evalWorld.android),
				atMostLLMCalls(10),
			},
			claims: []evalClaim{
				states(fmt.Sprintf("gives the ratio of %s to %s events as %.1f%%, or a rounding of it", checkoutStarted.name, addToCart.name, ratio),
					percentAnchor(ratio, 0.2)),
			},
		},
		{
			id:        "sql-busiest-day",
			questions: []string{fmt.Sprintf("On which day in the last 7 days did the Android app record the most %s custom events, and how many?", addToCart.name)},
			mcpApps:   []uuid.UUID{evalWorld.android},
			checks: []evalCheck{
				usesTool("run_sql"),
				lastSQLSucceeds(),
				staysWithinApps(evalWorld.android),
				atMostLLMCalls(10),
			},
			claims: []evalClaim{busiestDayClaim},
			fixtures: []judgeFixture{
				{name: "busiest day named", text: fmt.Sprintf(
					"The busiest day was %s, with %d %s events.", busiestDate.Format("January 2"), addToCart.perDay[busiestDayIndex], addToCart.name)},
				{name: "daily table with the wrong day named", failsOn: busiestDayClaim, text: wrongBusiestDayAnswer(evalWorld, addToCart)},
			},
		},
		{
			id:        "sql-log-search",
			questions: []string{fmt.Sprintf("How many log lines containing %q did the Android app record in the last 7 days?", evalGatewayTimeoutLogs.body)},
			mcpApps:   []uuid.UUID{evalWorld.android},
			checks: []evalCheck{
				usesTool("run_sql"),
				lastSQLSucceeds(),
				staysWithinApps(evalWorld.android),
				atMostLLMCalls(10),
			},
			claims: []evalClaim{
				states(fmt.Sprintf("says %d log lines contained the text", evalGatewayTimeoutLogs.total()), numberAnchor(evalGatewayTimeoutLogs.total())),
			},
		},
		{
			// A model can also count users by paging through the crash's
			// events, so this case does not require SQL.
			id:        "sql-users-affected",
			questions: []string{fmt.Sprintf("How many distinct users were affected by the %s crash in the Android app over the last 7 days?", checkout.exceptionClass())},
			mcpApps:   []uuid.UUID{evalWorld.android},
			checks: []evalCheck{
				lastSQLSucceeds(),
				staysWithinApps(evalWorld.android),
				atMostLLMCalls(12),
			},
			claims: []evalClaim{
				states(fmt.Sprintf("says %d distinct users were affected", checkout.users), numberAnchor(checkout.users)),
				usersAsCrashes,
			},
			fixtures: []judgeFixture{
				{name: "users counted", text: fmt.Sprintf(
					"%d distinct users hit the %s crash in the last 7 days.", checkout.users, checkout.exceptionClass())},
				{name: "users given as crashes", failsOn: usersAsCrashes, text: fmt.Sprintf(
					"The %s crash happened %d times in the last 7 days.", checkout.exceptionClass(), checkout.users)},
			},
		},
		{
			id: "follow-up-location",
			questions: []string{
				"What's the top crash in the Android app over the last 7 days?",
				"Which file and method does it happen in?",
			},
			checks: []evalCheck{
				staysWithinApps(evalWorld.android),
				atMostLLMCalls(6),
			},
			claims: []evalClaim{
				states(fmt.Sprintf("says the crash happens in %s, in the method %s", checkout.fileStem(), checkout.methodName),
					nameAnchor(checkout.fileStem()), nameAnchor(checkout.methodName)),
			},
		},
		{
			id: "follow-up-other-app",
			questions: []string{
				"How many crashes did the Android app have in the last 7 days?",
				"And the iOS app?",
			},
			checks: []evalCheck{
				staysWithinApps(evalWorld.ios),
				atMostLLMCalls(8),
			},
			claims: []evalClaim{iosCrashesClaim},
		},
	}
}

// wrongBusiestDayAnswer lists every day's events correctly and then names the
// second busiest day as the busiest, so it holds the right date and count
// without claiming them.
func wrongBusiestDayAnswer(evalWorld evalWorld, customEvent evalCustomEvent) string {
	var answer strings.Builder
	fmt.Fprintf(&answer, "Daily %s events:\n", customEvent.name)
	for day, n := range customEvent.perDay {
		fmt.Fprintf(&answer, "- %s: %d\n", evalWorld.seededDay(day).Format("January 2"), n)
	}
	secondBusiestDay := -1
	for day, n := range customEvent.perDay {
		if day != customEvent.busiestDay() && (secondBusiestDay < 0 || n > customEvent.perDay[secondBusiestDay]) {
			secondBusiestDay = day
		}
	}
	fmt.Fprintf(&answer, "\nThe busiest day was %s, with %d events.", evalWorld.seededDay(secondBusiestDay).Format("January 2"), customEvent.perDay[secondBusiestDay])
	return answer.String()
}

func runEvalCase(ctx context.Context, t *testing.T, config *Config, evalCostProxy *evalCostProxy, evalWorld evalWorld, evalCase evalCase, surface string) evalRun {
	t.Helper()
	entryPoint, appIDs := "mcp", evalCase.mcpApps
	if surface == evalSurfaceSlack {
		entryPoint, appIDs = slack.SurfaceMention, nil
	} else if len(appIDs) == 0 {
		appIDs = []uuid.UUID{evalWorld.android, evalWorld.ios}
	}
	conv := &conversation{UserID: evalWorld.userID, TeamID: evalWorld.teamID, Surface: entryPoint}
	if err := config.createConversation(ctx, conv, conversationTitle(evalCase.questions[0])); err != nil {
		t.Fatalf("createConversation: %v", err)
	}

	var evalRun evalRun
	start := time.Now()
	for i, question := range evalCase.questions {
		evalRun.answer, _, evalRun.err = config.runTurn(ctx, turn{
			userID: evalWorld.userID, teamID: evalWorld.teamID,
			conv: conv, continued: i > 0, question: question, entryPoint: entryPoint, appIDs: appIDs,
		})
		if evalRun.err != nil {
			break
		}
	}
	evalRun.duration = time.Since(start)
	evalRun.cost = evalCostProxy.conversationCost(conv.ID.String())

	history, err := config.loadMessages(ctx, conv.ID)
	if err != nil {
		t.Fatalf("loadMessages: %v", err)
	}
	for _, loadedMessage := range history {
		evalRun.tokens += loadedMessage.promptTokens + loadedMessage.completionTokens
		switch loadedMessage.msg.Role {
		case "user":
			evalRun.llmCalls = 0
			evalRun.toolCalls = nil
			evalRun.toolResults = map[string]string{}
		case "assistant":
			evalRun.llmCalls++
			evalRun.toolCalls = append(evalRun.toolCalls, loadedMessage.msg.ToolCalls...)
		case "tool":
			evalRun.toolResults[loadedMessage.msg.ToolCallID] = loadedMessage.msg.Content
		}
	}
	return evalRun
}

// internalsPattern matches only internals that have no other meaning in an
// answer. Table names without an underscore, such as events, are ordinary
// words, so the judge grades those.
func internalsPattern(ctx context.Context, t *testing.T, c *Config) *regexp.Regexp {
	t.Helper()
	names := []string{regexp.QuoteMeta(renderChartToolName)}
	for _, tool := range c.modelTools {
		names = append(names, regexp.QuoteMeta(tool.Function.Name))
	}
	sets, err := c.loadTableSets(ctx)
	if err != nil {
		t.Fatalf("loadTableSets: %v", err)
	}
	for table := range sets.all {
		if strings.Contains(table, "_") && !strings.HasPrefix(table, ".") {
			names = append(names, regexp.QuoteMeta(table))
		}
	}
	return regexp.MustCompile(`\b(` + strings.Join(names, "|") + `)\b|` + uuidPattern.String() + `|(?i)\b[0-9a-f]{32}\b|\{\{`)
}

func hidesInternals(pattern *regexp.Regexp) evalCheck {
	return func(evalRun evalRun) string {
		if match := pattern.FindString(evalRun.answer); match != "" {
			return fmt.Sprintf("answer shows internals: %q", match)
		}
		return ""
	}
}

func usesNoTools() evalCheck {
	return func(evalRun evalRun) string {
		if len(evalRun.toolCalls) > 0 {
			return fmt.Sprintf("called %d tools, want none", len(evalRun.toolCalls))
		}
		return ""
	}
}

func avoidsTools(names ...string) evalCheck {
	return func(evalRun evalRun) string {
		for _, toolCall := range evalRun.toolCalls {
			if slices.Contains(names, toolCall.Function.Name) {
				return "called " + toolCall.Function.Name
			}
		}
		return ""
	}
}

func staysWithinApps(apps ...uuid.UUID) evalCheck {
	return func(evalRun evalRun) string {
		for _, toolCall := range evalRun.toolCalls {
			var args struct {
				AppID  string   `json:"app_id"`
				AppIDs []string `json:"app_ids"`
			}
			if json.Unmarshal([]byte(toolCall.Function.Arguments), &args) != nil {
				continue
			}
			ids := args.AppIDs
			if args.AppID != "" {
				ids = append(ids, args.AppID)
			}
			for _, id := range ids {
				if !slices.ContainsFunc(apps, func(a uuid.UUID) bool { return a.String() == id }) {
					return fmt.Sprintf("%s queried app %s", toolCall.Function.Name, id)
				}
			}
		}
		return ""
	}
}

func atMostLLMCalls(n int) evalCheck {
	return func(evalRun evalRun) string {
		if evalRun.llmCalls > n {
			return fmt.Sprintf("made %d llm calls, want at most %d", evalRun.llmCalls, n)
		}
		return ""
	}
}

func usesTool(name string) evalCheck {
	return func(evalRun evalRun) string {
		if !slices.ContainsFunc(evalRun.toolCalls, func(toolCall chatToolCall) bool { return toolCall.Function.Name == name }) {
			return "never called " + name
		}
		return ""
	}
}

// lastSQLSucceeds checks that the last run_sql call did not fail. The model
// is told to fix a failed query, and an answer given after a final failed
// query cannot rest on data.
func lastSQLSucceeds() evalCheck {
	return func(evalRun evalRun) string {
		for _, toolCall := range slices.Backward(evalRun.toolCalls) {
			if toolCall.Function.Name != "run_sql" {
				continue
			}
			if result := evalRun.toolResults[toolCall.ID]; strings.HasPrefix(result, "error:") {
				return "last run_sql failed: " + result
			}
			return ""
		}
		return ""
	}
}
