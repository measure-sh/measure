//go:build eval

package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"testing"
	"time"

	"backend/testinfra"

	"github.com/google/uuid"
)

func TestEvalDevices(t *testing.T) {
	env := newEvalEnv(t, "LLM_AGENT_MODEL_MEDIUM")
	surfaces := evalSurfaces(t)
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	config := env.config(env.models[0])
	evalWorld := seedJourneyWorld(ctx, t)
	seedDeviceTelemetry(ctx, t, evalWorld)
	checkDeviceTelemetry(ctx, t, config, evalWorld)
	deviceCases := deviceEvalCases(evalWorld)
	checkDeviceToolCoverage(t, config, deviceCases)

	internals := hidesInternals(internalsPattern(ctx, t, config))
	cases := make([]evalCase, len(deviceCases))
	for i, deviceCase := range deviceCases {
		evalCase := deviceCase.evalCase
		for _, tools := range deviceCase.tools {
			evalCase.checks = append(evalCase.checks, usesAnyTool(tools...))
		}
		evalCase.checks = append([]evalCheck{internals, staysWithinApps(evalWorld.android)}, evalCase.checks...)
		evalCase.claims = append(evalCase.claims, evalShowsInternals)
		evalCase.textDescription = evalCase.describeText() + "\nThe team's apps are Shopper for Android (com.shopper.android) and Shopper for iOS (com.shopper.ios).\n"
		cases[i] = evalCase
	}
	checkExpectedCounts(t, cases, deviceSeededCounts())
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
	env.report(t, "devices", started, surfaces, cases, results)
}

// deviceCase pairs an evalCase with groups of required tools. The run must call
// at least one tool from each group.
type deviceCase struct {
	evalCase
	tools [][]string
}

// checkDeviceToolCoverage fails if any device tool is missing from all eval
// cases.
func checkDeviceToolCoverage(t *testing.T, config *Config, deviceCases []deviceCase) {
	t.Helper()
	covered := map[string]bool{}
	for _, deviceCase := range deviceCases {
		for _, tools := range deviceCase.tools {
			for _, tool := range tools {
				covered[tool] = true
			}
		}
	}
	for name := range config.commonToolIndex {
		if strings.HasPrefix(name, "get_device") && !covered[name] {
			t.Fatalf("no device eval case calls %s", name)
		}
	}
}

const deviceSpan = "checkout_load"

// evalDeviceModel holds an Android device model and its telemetry. sessions
// lists daily session counts from most recent to oldest. For every four
// launches, slowLaunches take slowLaunchMs and the rest take launchMs.
type evalDeviceModel struct {
	manufacturer, model, name string
	sessions                  []int
	crashesPerDay             int
	launchMs, slowLaunchMs    uint32
	slowLaunches              int
	spanMs                    int
	memoryKB                  uint64
}

func (d evalDeviceModel) totalSessions() int { return sum(d.sessions) }
func (d evalDeviceModel) totalCrashes() int  { return d.crashesPerDay * evalDays }

func (d evalDeviceModel) p95LaunchMs() uint32 {
	if d.slowLaunches > 0 {
		return d.slowLaunchMs
	}
	return d.launchMs
}

// The Pixel 8 has the most sessions and slowest p95 cold launch; one quarter of
// its launches are slow. The Samsung has the most crashes. The Xiaomi has the
// slowest median cold launch and checkout_load span, the highest memory usage,
// and the only rising session count.
var (
	evalPixel   = evalDeviceModel{"Google", "Pixel 8", "shiba", []int{30, 30, 30, 30, 30, 30, 30}, 2, 450, 2600, 1, 300, 210_000}
	evalSamsung = evalDeviceModel{"samsung", "SM-S918B", "dm3q", []int{20, 20, 20, 20, 20, 20, 20}, 18, 900, 0, 0, 500, 260_000}
	evalXiaomi  = evalDeviceModel{"Xiaomi", "23021RAA2Y", "topaz", []int{40, 30, 22, 15, 10, 6, 4}, 1, 1400, 0, 0, 1200, 420_000}

	evalDeviceModels = []evalDeviceModel{evalPixel, evalSamsung, evalXiaomi}
)

// seedDeviceTelemetry gives each session one cold launch. For each device and
// day, it keeps that day's crashes, memory samples, and checkout_load spans in
// one session, since each event or span with a new session ID adds a session
// and changes the seeded session counts.
func seedDeviceTelemetry(ctx context.Context, t *testing.T, evalWorld evalWorld) {
	t.Helper()
	for _, device := range evalDeviceModels {
		for day, sessions := range device.sessions {
			at := evalWorld.seededDay(day)
			event := func(count int, row testinfra.EventRow) {
				row.Timestamp = at
				row.AppVersion, row.AppBuild = evalAndroidDevice.appVersion, evalAndroidDevice.appBuild
				row.OSName, row.OSVersion = evalAndroidDevice.osName, evalAndroidDevice.osVersion
				row.CountryCode, row.DeviceLocale = "US", "en-US"
				row.NetworkProvider, row.NetworkType, row.NetworkGeneration = evalAndroidDevice.networkProvider, evalAndroidDevice.networkType, evalAndroidDevice.networkGeneration
				row.DeviceManufacturer, row.DeviceModel, row.DeviceName = device.manufacturer, device.model, device.name
				th.SeedEventRows(ctx, t, evalWorld.teamID.String(), evalWorld.android.String(), count, row)
			}
			sessionID := uuid.NewString()
			slow := sessions * device.slowLaunches / 4
			event(1, testinfra.EventRow{Type: "cold_launch", LaunchDuration: device.launchMs, SessionID: sessionID})
			event(sessions-1-slow, testinfra.EventRow{Type: "cold_launch", LaunchDuration: device.launchMs})
			event(slow, testinfra.EventRow{Type: "cold_launch", LaunchDuration: device.slowLaunchMs})
			event(device.crashesPerDay, testinfra.EventRow{Type: "exception", Severity: "fatal", SessionID: sessionID})
			anonRSS, swap := device.memoryKB, uint64(0)
			event(10, testinfra.EventRow{Type: "memory_usage", MemoryAnonRSS: &anonRSS, MemorySwap: &swap, MemoryAppImportance: "foreground", SessionID: sessionID})
			th.SeedSpanRows(ctx, t, evalWorld.teamID.String(), evalWorld.android.String(), 5, testinfra.SpanRow{
				SpanName: deviceSpan, Status: 1, SessionID: sessionID, StartTime: at, Duration: time.Duration(device.spanMs) * time.Millisecond,
				AppVersion: evalAndroidDevice.appVersion, AppBuild: evalAndroidDevice.appBuild,
				OSName: evalAndroidDevice.osName, OSVersion: evalAndroidDevice.osVersion,
				DeviceManufacturer: device.manufacturer, DeviceModel: device.model, DeviceName: device.name,
			})
		}
	}
}

// deviceSeededCounts returns counts that eval cases should not expect.
func deviceSeededCounts() []int {
	counts := []int{}
	for _, device := range evalDeviceModels {
		counts = append(counts, device.sessions...)
		counts = append(counts, device.crashesPerDay)
		if device.model != evalPixel.model {
			counts = append(counts, device.totalSessions())
		}
		if device.model != evalSamsung.model {
			counts = append(counts, device.totalCrashes())
		}
	}
	return counts
}

type evalDeviceRow struct {
	DeviceManufacturer string   `json:"device_manufacturer"`
	DeviceModel        string   `json:"device_model"`
	SessionCount       int      `json:"session_count"`
	CrashCount         int      `json:"crash_count"`
	P50                *float64 `json:"p50"`
	P95                *float64 `json:"p95"`
}

// checkDeviceTelemetry catches seed or tool ranking mismatches before any model
// calls. Without this check, a seed or tool mismatch shows up as every model
// failing its cases.
func checkDeviceTelemetry(ctx context.Context, t *testing.T, config *Config, evalWorld evalWorld) {
	t.Helper()
	ctx = WithUserID(ctx, evalWorld.userID.String())
	call := func(tool string, args map[string]any, out any) {
		t.Helper()
		args["app_id"] = evalWorld.android.String()
		raw, _ := json.Marshal(args)
		result, err := config.commonToolIndex[tool].call(ctx, raw)
		if err != nil {
			t.Fatalf("%s: %v", tool, err)
		}
		if err := json.Unmarshal([]byte(result), out); err != nil {
			t.Fatalf("%s returned %q: %v", tool, result, err)
		}
	}
	top := func(tool string, args map[string]any) evalDeviceRow {
		t.Helper()
		var page struct {
			Results []evalDeviceRow `json:"results"`
		}
		call(tool, args, &page)
		if len(page.Results) != len(evalDeviceModels) {
			t.Fatalf("%s %v = %+v, want %d devices", tool, args, page.Results, len(evalDeviceModels))
		}
		return page.Results[0]
	}
	expect := func(what string, got evalDeviceRow, device evalDeviceModel, gotValue, want float64) {
		t.Helper()
		if got.DeviceModel != device.model || math.Round(gotValue) != want {
			t.Fatalf("%s: top device %s with %v, want %s with %v", what, got.DeviceModel, gotValue, device.model, want)
		}
	}

	sessions := top("get_devices_by_sessions", map[string]any{})
	expect("sessions", sessions, evalPixel, float64(sessions.SessionCount), float64(evalPixel.totalSessions()))
	crashes := top("get_devices_by_errors", map[string]any{})
	expect("crashes", crashes, evalSamsung, float64(crashes.CrashCount), float64(evalSamsung.totalCrashes()))
	p95 := top("get_devices_by_launch_time", map[string]any{})
	expect("p95 launch", p95, evalPixel, *p95.P95, float64(evalPixel.p95LaunchMs()))
	p50 := top("get_devices_by_launch_time", map[string]any{"percentile": "p50"})
	expect("p50 launch", p50, evalXiaomi, *p50.P50, float64(evalXiaomi.launchMs))
	span := top("get_devices_by_span_duration", map[string]any{"root_span_name": deviceSpan})
	expect("span", span, evalXiaomi, *span.P95, float64(evalXiaomi.spanMs))
	memory := top("get_devices_by_memory_usage", map[string]any{})
	expect("memory", memory, evalXiaomi, *memory.P95, float64(evalXiaomi.memoryKB))

	var points []struct {
		DeviceModel  string `json:"device_model"`
		SessionCount int    `json:"session_count"`
	}
	call("get_device_sessions_over_time", map[string]any{"timezone": "UTC"}, &points)
	sums := map[string]int{}
	for _, point := range points {
		sums[point.DeviceModel] += point.SessionCount
	}
	for _, device := range evalDeviceModels {
		if sums[device.model] != device.totalSessions() {
			t.Fatalf("get_device_sessions_over_time has %d sessions for %s, want %d: %+v", sums[device.model], device.model, device.totalSessions(), points)
		}
	}
}

func deviceEvalCases(evalWorld evalWorld) []deviceCase {
	pixel, samsung, xiaomi := evalPixel, evalSamsung, evalXiaomi
	device := func(d evalDeviceModel) string { return d.manufacturer + " " + d.model }
	mostSessions := states(fmt.Sprintf("names the %s as the device with the most sessions, with %d", device(pixel), pixel.totalSessions()),
		nameAnchor(pixel.model), numberAnchor(pixel.totalSessions()))
	mostCrashes := states(fmt.Sprintf("names the %s as the device with the most crashes, with %d", device(samsung), samsung.totalCrashes()),
		nameAnchor(samsung.model), numberAnchor(samsung.totalCrashes()))
	slowestP95 := states(fmt.Sprintf("names the %s as the device with the slowest p95 cold launch, at about %d ms", device(pixel), pixel.p95LaunchMs()),
		nameAnchor(pixel.model))
	slowestMedian := states(fmt.Sprintf("names the %s as the device with the slowest median cold launch, at about %d ms", device(xiaomi), xiaomi.launchMs),
		nameAnchor(xiaomi.model))
	medianFromP95 := forbids(fmt.Sprintf("names the %s as the device with the slowest median cold launch", device(pixel)))
	slowestSpan := states(fmt.Sprintf("names the %s as the device where %s is slowest, at about %d ms", device(xiaomi), deviceSpan, xiaomi.spanMs),
		nameAnchor(xiaomi.model))
	mostMemory := states(fmt.Sprintf("names the %s as the device with the highest memory usage", device(xiaomi)), nameAnchor(xiaomi.model))
	rising := states(fmt.Sprintf("names the %s as the device whose sessions grew the most", device(xiaomi)), nameAnchor(xiaomi.model))

	return []deviceCase{
		{
			evalCase: evalCase{
				id:        "devices-most-sessions",
				questions: []string{"Which device model had the most sessions in the Android app over the last 7 days?"},
				mcpApps:   []uuid.UUID{evalWorld.android},
				checks:    []evalCheck{atMostLLMCalls(6)},
				claims:    []evalClaim{mostSessions},
			},
			tools: [][]string{{"get_devices_by_sessions", "get_device_sessions_over_time"}},
		},
		{
			evalCase: evalCase{
				id:        "devices-most-crashes",
				questions: []string{"Which device crashes the most in the Android app over the last 7 days?"},
				mcpApps:   []uuid.UUID{evalWorld.android},
				checks:    []evalCheck{atMostLLMCalls(6)},
				claims:    []evalClaim{mostCrashes},
			},
			tools: [][]string{{"get_devices_by_errors"}},
		},
		{
			evalCase: evalCase{
				id:        "devices-slowest-p95-launch",
				questions: []string{"Which device has the slowest p95 cold launch time in the Android app over the last 7 days?"},
				mcpApps:   []uuid.UUID{evalWorld.android},
				checks:    []evalCheck{atMostLLMCalls(6)},
				claims:    []evalClaim{slowestP95},
			},
			tools: [][]string{{"get_devices_by_launch_time"}},
		},
		{
			evalCase: evalCase{
				id:        "devices-slowest-median-launch",
				questions: []string{"Which device has the slowest median cold launch time in the Android app over the last 7 days?"},
				mcpApps:   []uuid.UUID{evalWorld.android},
				checks:    []evalCheck{atMostLLMCalls(6)},
				claims:    []evalClaim{slowestMedian, medianFromP95},
				fixtures: []judgeFixture{
					{name: "median device named", text: fmt.Sprintf(
						"The %s has the slowest median cold launch, at %d ms. The %s is slower at p95, at %d ms.",
						device(xiaomi), xiaomi.launchMs, device(pixel), pixel.p95LaunchMs())},
					{name: "p95 device given as the median", failsOn: medianFromP95, text: fmt.Sprintf(
						"The %s has the slowest median cold launch, at %d ms.", device(pixel), pixel.p95LaunchMs())},
				},
			},
			tools: [][]string{{"get_devices_by_launch_time"}},
		},
		{
			evalCase: evalCase{
				id:        "devices-slowest-span",
				questions: []string{fmt.Sprintf("On which device is the %s trace slowest in the Android app over the last 7 days?", deviceSpan)},
				mcpApps:   []uuid.UUID{evalWorld.android},
				checks:    []evalCheck{atMostLLMCalls(6)},
				claims:    []evalClaim{slowestSpan},
			},
			tools: [][]string{{"get_devices_by_span_duration"}},
		},
		{
			evalCase: evalCase{
				id:        "devices-most-memory",
				questions: []string{"Which device uses the most memory in the Android app over the last 7 days?"},
				mcpApps:   []uuid.UUID{evalWorld.android},
				checks:    []evalCheck{atMostLLMCalls(6)},
				claims:    []evalClaim{mostMemory},
			},
			tools: [][]string{{"get_devices_by_memory_usage"}},
		},
		{
			evalCase: evalCase{
				id:        "devices-rising-sessions",
				questions: []string{"Which device model's sessions grew the most over the last 7 days in the Android app?"},
				mcpApps:   []uuid.UUID{evalWorld.android},
				checks:    []evalCheck{atMostLLMCalls(6)},
				claims:    []evalClaim{rising},
			},
			tools: [][]string{{"get_device_sessions_over_time"}},
		},
	}
}
