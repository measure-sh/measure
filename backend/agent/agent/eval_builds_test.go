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

	"github.com/google/uuid"
)

func TestEvalBuilds(t *testing.T) {
	env := newEvalEnv(t, "LLM_AGENT_MODEL_MEDIUM")
	surfaces := evalSurfaces(t)
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	// get_builds returns a dashboard_url only when the site origin is set.
	siteOrigin := deps.Config.SiteOrigin
	deps.Config.SiteOrigin = evalSiteOrigin
	t.Cleanup(func() { deps.Config.SiteOrigin = siteOrigin })

	config := env.config(env.models[0])
	evalWorld := seedJourneyWorld(ctx, t)
	seedEvalBuilds(ctx, t, evalWorld)
	checkEvalBuilds(ctx, t, config, evalWorld)

	internals := hidesInternals(internalsPattern(ctx, t, config))
	cases := buildEvalCases(evalWorld)
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
	env.report(t, "builds", started, surfaces, cases, results)
}

const evalSiteOrigin = "https://dashboard.shopper.test"

// linksBuildFiles checks that the answer links to the dashboard_url
// returned by get_builds for the release. The URL opens the release's
// files on the Builds page.
func linksBuildFiles(release evalDevice) evalCheck {
	return func(evalRun evalRun) string {
		var urls []string
		for _, toolCall := range evalRun.toolCalls {
			if toolCall.Function.Name != "get_builds" {
				continue
			}
			var builds []struct {
				VersionName  string `json:"version_name"`
				VersionCode  string `json:"version_code"`
				DashboardURL string `json:"dashboard_url"`
			}
			if json.Unmarshal([]byte(evalRun.toolResults[toolCall.ID]), &builds) != nil {
				continue
			}
			for _, build := range builds {
				if build.VersionName == release.appVersion && build.VersionCode == release.appBuild && build.DashboardURL != "" {
					urls = append(urls, build.DashboardURL)
				}
			}
		}
		if len(urls) == 0 {
			return "no get_builds call returned a dashboard_url for " + release.appVersion
		}
		return linksInSentence(evalRun.answer, urls, "the dashboard_url of "+release.appVersion)
	}
}

// linksInSentence checks that the answer contains a markdown link to one of
// the URLs and that the link appears inside a sentence, not after a colon or
// on its own line.
func linksInSentence(answer string, urls []string, description string) string {
	for _, url := range urls {
		link := strings.Index(answer, "]("+url+")")
		if link < 0 {
			continue
		}
		label := strings.LastIndex(answer[:link], "[")
		before := strings.TrimRight(answer[:max(label, 0)], " ")
		if before == "" || strings.HasSuffix(before, ":") || strings.HasSuffix(before, "\n") {
			return "answer puts the link after a colon or on its own line instead of inside a sentence"
		}
		return ""
	}
	return "answer does not link " + description + ": " + urls[0]
}

// evalBuildUpload is a mapping file uploaded for an Android release on a
// seeded day.
type evalBuildUpload struct {
	device      evalDevice
	mappingType string
	day         int
}

// The new release has only native debug symbols, so it has no ProGuard
// mapping. The old release has both.
var evalBuildUploads = []evalBuildUpload{
	{evalAndroidDevice, "elf_debug", 0},
	{evalAndroidOldDevice, "proguard", 2},
	{evalAndroidOldDevice, "elf_debug", 2},
}

func seedEvalBuilds(ctx context.Context, t *testing.T, evalWorld evalWorld) {
	t.Helper()
	for _, upload := range evalBuildUploads {
		mappingID := uuid.NewString()
		th.SeedBuildMappingRow(ctx, t, mappingID, evalWorld.android.String(), upload.device.appVersion, upload.device.appBuild,
			upload.mappingType, "mappings/"+mappingID, uuid.Nil.String(), "", evalWorld.seededDay(upload.day))
	}
}

// checkEvalBuilds fails the eval before the model runs if get_builds returns
// a different number of files for a release than evalBuildUploads seeds.
func checkEvalBuilds(ctx context.Context, t *testing.T, config *Config, evalWorld evalWorld) {
	t.Helper()
	ctx = WithUserID(ctx, evalWorld.userID.String())
	raw, _ := json.Marshal(map[string]any{"app_id": evalWorld.android.String()})
	result, err := config.commonToolIndex["get_builds"].call(ctx, raw)
	if err != nil {
		t.Fatalf("get_builds: %v", err)
	}
	var builds []struct {
		VersionName string            `json:"version_name"`
		Files       []json.RawMessage `json:"files"`
	}
	if err := json.Unmarshal([]byte(result), &builds); err != nil {
		t.Fatalf("get_builds returned %q: %v", result, err)
	}
	got := map[string]int{}
	for _, build := range builds {
		got[build.VersionName] = len(build.Files)
	}
	want := map[string]int{}
	for _, upload := range evalBuildUploads {
		want[upload.device.appVersion]++
	}
	if !maps.Equal(got, want) {
		t.Fatalf("get_builds returned files per release %v, want %v", got, want)
	}
}

func buildEvalCases(evalWorld evalWorld) []evalCase {
	newVersion, oldVersion := evalAndroidDevice, evalAndroidOldDevice
	missingProguard := states(fmt.Sprintf("says version %s has no ProGuard mapping uploaded", newVersion.appVersion), versionAnchor(newVersion.appVersion))
	oldMissingProguard := forbids(fmt.Sprintf("says version %s has no ProGuard mapping uploaded", oldVersion.appVersion))
	buildsPage := fmt.Sprintf("%s/%s/builds?a=%s&d=Custom+Range", evalSiteOrigin, evalWorld.teamID, evalWorld.android)
	sendsToDashboard := states("links the user to the dashboard to download the mapping file")
	givesMappingFile := forbids("claims to have downloaded the mapping file, provides a non-dashboard download URL, or gives the file contents")

	return []evalCase{
		{
			id:        "builds-missing-proguard",
			questions: []string{"Which Android app builds had mapping files uploaded in the last 7 days, and is any missing a ProGuard mapping?"},
			mcpApps:   []uuid.UUID{evalWorld.android},
			checks:    []evalCheck{usesTool("get_builds"), atMostLLMCalls(8)},
			claims:    []evalClaim{missingProguard, oldMissingProguard},
			fixtures: []judgeFixture{
				{name: "new build named", text: fmt.Sprintf(
					"Two builds had mapping files uploaded: %s (%s) with native debug symbols only, and %s (%s) with a ProGuard mapping and native debug symbols. %s has no ProGuard mapping.",
					newVersion.appVersion, newVersion.appBuild, oldVersion.appVersion, oldVersion.appBuild, newVersion.appVersion)},
				{name: "builds swapped", failsOn: missingProguard, text: fmt.Sprintf(
					"Two builds had mapping files uploaded: %s with a ProGuard mapping and native debug symbols, and %s with native debug symbols only. %s has no ProGuard mapping.",
					newVersion.appVersion, oldVersion.appVersion, oldVersion.appVersion)},
			},
		},
		{
			id:        "builds-download-mapping",
			questions: []string{fmt.Sprintf("Can you download the ProGuard mapping file for version %s of the Android app?", oldVersion.appVersion)},
			mcpApps:   []uuid.UUID{evalWorld.android},
			checks:    []evalCheck{usesTool("get_builds"), linksBuildFiles(oldVersion), atMostLLMCalls(6)},
			claims:    []evalClaim{sendsToDashboard, givesMappingFile},
			fixtures: []judgeFixture{
				{name: "sends to dashboard", text: fmt.Sprintf(
					"I can't download mapping files. Download the ProGuard mapping for version %s from the app's Builds page in the Measure [dashboard](%s).", oldVersion.appVersion, buildsPage)},
				{name: "gives storage URL", failsOn: givesMappingFile, text: fmt.Sprintf(
					"Here is the ProGuard mapping for version %s: https://storage.example.com/mappings/mapping.txt", oldVersion.appVersion)},
			},
		},
	}
}
