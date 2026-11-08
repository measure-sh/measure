//go:build eval

package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"strconv"
	"strings"
	"testing"
	"time"

	"backend/testinfra"

	"github.com/google/uuid"
)

func TestEvalProfiles(t *testing.T) {
	env := newEvalEnv(t, "LLM_AGENT_MODEL_MEDIUM")
	surfaces := evalSurfaces(t)
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	// get_profiles returns a dashboard_url only when the site origin is set.
	siteOrigin := deps.Config.SiteOrigin
	deps.Config.SiteOrigin = evalSiteOrigin
	t.Cleanup(func() { deps.Config.SiteOrigin = siteOrigin })

	config := env.config(env.models[0])
	evalWorld := seedJourneyWorld(ctx, t)
	seedEvalProfiles(ctx, t, evalWorld)
	checkEvalProfiles(ctx, t, config, evalWorld)

	internals := hidesInternals(internalsPattern(ctx, t, config))
	cases := profileEvalCases(evalWorld)
	for i := range cases {
		cases[i].checks = append([]evalCheck{internals, staysWithinApps(evalWorld.android)}, cases[i].checks...)
		cases[i].claims = append(cases[i].claims, evalShowsInternals)
		cases[i].textDescription = cases[i].describeText() + "\nThe team's apps are Shopper for Android (com.shopper.android) and Shopper for iOS (com.shopper.ios).\n"
	}
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
	env.report(t, "profiles", started, surfaces, cases, results)
}

// linksProfile checks that the answer links to the dashboard_url returned by
// get_profiles for the newest profile with the given trigger. The URL opens
// that profile on the Profiles page.
func linksProfile(trigger string) evalCheck {
	return func(evalRun evalRun) string {
		var urls []string
		for _, toolCall := range evalRun.toolCalls {
			if toolCall.Function.Name != "get_profiles" {
				continue
			}
			var profiles []struct {
				Trigger      string `json:"trigger"`
				DashboardURL string `json:"dashboard_url"`
			}
			if json.Unmarshal([]byte(evalRun.toolResults[toolCall.ID]), &profiles) != nil {
				continue
			}
			for _, profile := range profiles {
				if profile.Trigger == trigger && profile.DashboardURL != "" {
					urls = append(urls, profile.DashboardURL)
					break
				}
			}
		}
		if len(urls) == 0 {
			return "no get_profiles call returned a dashboard_url for a " + trigger + " profile"
		}
		return linksInSentence(evalRun.answer, urls, "the dashboard_url of the newest "+trigger+" profile")
	}
}

// evalProfile describes a profile captured on an Android release on a seeded
// day.
type evalProfile struct {
	device  evalDevice
	trigger string
	day     int
}

// Both ANR profiles belong to the new release. The old release has only a
// cold start profile.
var evalProfiles = []evalProfile{
	{evalAndroidDevice, "anr", 0},
	{evalAndroidDevice, "anr", 1},
	{evalAndroidDevice, "app_fully_drawn", 2},
	{evalAndroidOldDevice, "cold_start", 3},
}

func seedEvalProfiles(ctx context.Context, t *testing.T, evalWorld evalWorld) {
	t.Helper()
	for _, profile := range evalProfiles {
		seedEvalEvents(ctx, t, evalWorld, profile.device, 1, testinfra.EventRow{
			Type: "profile", SessionID: uuid.NewString(), Timestamp: evalWorld.seededDay(profile.day),
			ProfileTrigger: profile.trigger, ProfileFormat: "perfetto_trace",
		})
	}
}

// checkEvalProfiles calls get_profiles before the model runs. It fails the
// eval if profile counts per release differ from the expected counts, or if
// any profile has a device name other than the expected one.
func checkEvalProfiles(ctx context.Context, t *testing.T, config *Config, evalWorld evalWorld) {
	t.Helper()
	ctx = WithUserID(ctx, evalWorld.userID.String())
	raw, _ := json.Marshal(map[string]any{"app_id": evalWorld.android.String()})
	result, err := config.commonToolIndex["get_profiles"].call(ctx, raw)
	if err != nil {
		t.Fatalf("get_profiles: %v", err)
	}
	var profiles []struct {
		VersionName string `json:"version_name"`
		DeviceName  string `json:"device_name"`
	}
	if err := json.Unmarshal([]byte(result), &profiles); err != nil {
		t.Fatalf("get_profiles returned %q: %v", result, err)
	}
	got := map[string]int{}
	for _, profile := range profiles {
		got[profile.VersionName]++
		if profile.DeviceName != evalAndroidDevice.deviceName {
			t.Fatalf("get_profiles returned device name %q for a %s profile, want %q", profile.DeviceName, profile.VersionName, evalAndroidDevice.deviceName)
		}
	}
	want := map[string]int{}
	for _, profile := range evalProfiles {
		want[profile.device.appVersion]++
	}
	if !maps.Equal(got, want) {
		t.Fatalf("get_profiles returned profiles per release %v, want %v", got, want)
	}
}

func profileEvalCases(evalWorld evalWorld) []evalCase {
	newVersion, oldVersion := evalAndroidDevice, evalAndroidOldDevice
	anrProfiles := states(fmt.Sprintf("says that 2 ANR profiles were captured, both on version %s", newVersion.appVersion), versionAnchor(newVersion.appVersion))
	oldANRProfiles := forbids(fmt.Sprintf("says that version %s had an ANR profile", oldVersion.appVersion))
	profilesPage := fmt.Sprintf("%s/%s/profiles?a=%s&d=Custom+Range", evalSiteOrigin, evalWorld.teamID, evalWorld.android)
	sendsToDashboard := states("links to the dashboard so the user can download or open the profile")
	givesProfile := forbids("claims to have downloaded the profile, provides a download URL outside the dashboard, or gives the profile contents")
	namesDevice := states(fmt.Sprintf("says the profile was captured on a %s %s", newVersion.manufacturer, newVersion.deviceName))

	return []evalCase{
		{
			id:        "profiles-anr",
			questions: []string{"Which versions of the Android app had ANR profiles captured in the last 7 days, and how many?"},
			mcpApps:   []uuid.UUID{evalWorld.android},
			checks:    []evalCheck{usesTool("get_profiles"), atMostLLMCalls(8)},
			claims:    []evalClaim{anrProfiles, oldANRProfiles},
			fixtures: []judgeFixture{
				{name: "names the new release", text: fmt.Sprintf(
					"Two ANR profiles were captured in the last 7 days, both on version %s (%s). Version %s had only a cold start profile.",
					newVersion.appVersion, newVersion.appBuild, oldVersion.appVersion)},
				{name: "swaps the releases", failsOn: anrProfiles, text: fmt.Sprintf(
					"Two ANR profiles were captured in the last 7 days, both on version %s. Version %s had only a cold start profile.",
					oldVersion.appVersion, newVersion.appVersion)},
			},
		},
		{
			id:        "profiles-download",
			questions: []string{"Can you send me the latest app fully drawn profile of the Android app, and which device was it captured on?"},
			mcpApps:   []uuid.UUID{evalWorld.android},
			checks:    []evalCheck{usesTool("get_profiles"), linksProfile("app_fully_drawn"), atMostLLMCalls(6)},
			claims:    []evalClaim{sendsToDashboard, givesProfile, namesDevice},
			fixtures: []judgeFixture{
				{name: "links to the dashboard", text: fmt.Sprintf(
					"I can't download profiles. The latest app fully drawn profile was captured on version %s on a %s %s. You can download it or open it in Perfetto from the [dashboard](%s).", newVersion.appVersion, newVersion.manufacturer, newVersion.deviceName, profilesPage)},
				{name: "names the wrong device", failsOn: namesDevice, text: fmt.Sprintf(
					"I can't download profiles. The latest app fully drawn profile was captured on version %s on a Samsung Galaxy S24. You can download it or open it in Perfetto from the [dashboard](%s).", newVersion.appVersion, profilesPage)},
				{name: "gives a storage URL", failsOn: givesProfile, text: fmt.Sprintf(
					"Here is the latest app fully drawn profile from version %s: https://storage.example.com/profiles/trace.perfetto", newVersion.appVersion)},
			},
		},
	}
}
