"use client";

import { Check, ChevronLeft, ChevronRight, Copy, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  App,
  AppsApiStatus,
  fetchAppsFromServer,
  fetchFiltersFromServer,
  FiltersApiStatus,
  FilterSource,
} from "../api/api_calls";
import {
  useAppsQuery,
  useAuthzAndMembersQuery,
  useCreateAppMutation,
} from "../query/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { type InitConfig } from "../stores/filters_store";
import {
  DEFAULT_ONBOARDING_STATE,
  type OnboardingFlutterPlatform,
  type OnboardingPlatform,
  type OnboardingStep,
} from "../stores/onboarding_store";
import { useFiltersStore, useOnboardingStore } from "../stores/provider";
import type { CodeBlockLanguage } from "../utils/highlighter";
import { underlineLinkStyle } from "../utils/shared_styles";
import { toastNegative, toastPositive } from "../utils/use_toast";
import { Button } from "./button";
import CodeBlock from "./code_block";
import { Input } from "./input";
import { SDK_VERSIONS } from "./sdk_versions.generated";
import TabSelect from "./tab_select";

type Platform = OnboardingPlatform;
type FlutterPlatform = OnboardingFlutterPlatform;
type Step = OnboardingStep;

const PLATFORMS: Platform[] = ["Android", "iOS", "Flutter"];
const FLUTTER_PLATFORMS: FlutterPlatform[] = ["Android", "iOS"];
const POLL_INTERVAL_MS = 3000;

interface OnboardingProps {
  teamId: string;
  initConfig: InitConfig;
}

interface Snippet {
  label: string;
  code: string;
  testId: string;
  language: CodeBlockLanguage;
}

function androidGradleDepSnippet(label: string): Snippet {
  return {
    label,
    testId: "snippet-dependency",
    language: "kotlin",
    code: `// In your app/build.gradle.kts
dependencies {
    implementation("sh.measure:measure-android:${SDK_VERSIONS.androidSdk}")
}`,
  };
}

function androidManifestSnippet(
  apiKey: string,
  apiUrl: string,
  label: string,
): Snippet {
  return {
    label,
    testId: "snippet-manifest",
    language: "xml",
    code: `<!-- Inside the <application> tag -->
<meta-data android:name="sh.measure.android.API_KEY" android:value="${apiKey}" />
<meta-data android:name="sh.measure.android.API_URL" android:value="${apiUrl}" />`,
  };
}

function androidInitSnippet(label: string, testId: string): Snippet {
  return {
    label,
    testId,
    language: "kotlin",
    code: `// In your Application.onCreate()
import sh.measure.android.Measure
import sh.measure.android.config.MeasureConfig

Measure.init(
    this, MeasureConfig(
        // Collect all data without sampling. You can adjust sample rates later if you choose to.
        enableFullCollectionMode = true,
    )
)`,
  };
}

function iosSpmDepSnippet(label: string): Snippet {
  return {
    label,
    testId: "snippet-dependency",
    language: "swift",
    code: `// In Package.swift
.package(url: "https://github.com/measure-sh/measure.git", branch: "ios-v${SDK_VERSIONS.iosSdk}")`,
  };
}

function iosInitSnippet(
  apiKey: string,
  apiUrl: string,
  label: string,
  testId: string,
): Snippet {
  return {
    label,
    testId,
    language: "swift",
    code: `// In your AppDelegate's application(_:didFinishLaunchingWithOptions:)
import Measure

let clientInfo = ClientInfo(apiKey: "${apiKey}", apiUrl: "${apiUrl}")
let config = BaseMeasureConfig(
    // Collect all data without sampling. You can adjust sample rates later if you choose to.
    enableFullCollectionMode: true
)
Measure.initialize(with: clientInfo, config: config)`,
  };
}

function flutterDepSnippet(label: string): Snippet {
  return {
    label,
    testId: "snippet-dependency",
    language: "yaml",
    code: `# In pubspec.yaml
dependencies:
  measure_flutter: ^${SDK_VERSIONS.flutter}`,
  };
}

function flutterInitSnippet(label: string): Snippet {
  return {
    label,
    testId: "snippet-init",
    language: "dart",
    code: `// In main()
import 'package:measure_flutter/measure_flutter.dart';

Future<void> main() async {
  await Measure.instance.init(
    () => runApp(MeasureWidget(child: MyApp())),
    config: const MeasureConfig(),
  );
}`,
  };
}

function flutterCrashSnippet(label: string): Snippet {
  return {
    label,
    testId: "snippet-crash",
    language: "dart",
    code: `// Add this in main() after Measure.instance.init.
// The 2-second delay gives the SDK time to flush the crash event.
// Remove this code after the crash appears in your dashboard.
Future.delayed(const Duration(seconds: 2), () {
  throw Exception('Test crash from Measure onboarding');
});`,
  };
}

function iosPodfileSnippet(label: string): Snippet {
  return {
    label,
    testId: "snippet-ios-podfile",
    language: "ruby",
    code: `# Flutter projects default to use_frameworks! but measure-sh must be
# linked statically. First install the cocoapods-pod-linkage plugin:
#   gem install cocoapods-pod-linkage
#
# Then in ios/Podfile:
plugin 'cocoapods-pod-linkage'

target 'Runner' do
  use_frameworks!
  pod 'measure-sh', :linkage => :static
  # ... your existing pods stay as-is
end`,
  };
}

function buildSnippets(
  platform: Platform,
  flutterPlatform: FlutterPlatform,
  apiKey: string,
  apiUrl: string,
): Snippet[] {
  switch (platform) {
    case "Android":
      return [
        androidGradleDepSnippet("1. Add the dependency"),
        androidManifestSnippet(
          apiKey,
          apiUrl,
          "2. Add API key to AndroidManifest.xml",
        ),
        androidInitSnippet("3. Initialize the SDK", "snippet-init"),
        {
          label: "4. Trigger a test crash",
          testId: "snippet-crash",
          language: "kotlin",
          code: `import android.os.Handler
import android.os.Looper

// Add this in Application.onCreate(), after Measure.init().
// The 2-second delay gives the SDK time to flush the crash event.
// Remove this code after the crash appears in your dashboard.
Handler(Looper.getMainLooper()).postDelayed({
    throw RuntimeException("Test crash from Measure onboarding")
}, 2000)`,
        },
      ];
    case "iOS":
      return [
        iosSpmDepSnippet("1. Add the dependency"),
        iosInitSnippet(apiKey, apiUrl, "2. Initialize the SDK", "snippet-init"),
        {
          label: "3. Trigger a test crash",
          testId: "snippet-crash",
          language: "swift",
          code: `// Add this at your app entry point, after Measure.initialize.
// The 2-second delay gives the SDK time to flush the crash event.
// Remove this code after the crash appears in your dashboard.
DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
    fatalError("Test crash from Measure onboarding")
}`,
        },
      ];
    case "Flutter":
      // A Measure app targets one native platform; the Flutter codebase may
      // ship to both, so the user picks which native side to integrate now.
      if (flutterPlatform === "Android") {
        return [
          flutterDepSnippet("1. Add the Flutter package"),
          androidManifestSnippet(
            apiKey,
            apiUrl,
            "2. Add API key to AndroidManifest.xml",
          ),
          androidInitSnippet(
            "3. Initialize the Android native SDK",
            "snippet-android-init",
          ),
          flutterInitSnippet("4. Initialize the Flutter SDK"),
          flutterCrashSnippet("5. Trigger a test crash"),
        ];
      }
      return [
        flutterDepSnippet("1. Add the Flutter package"),
        iosPodfileSnippet("2. Configure iOS Podfile for static linkage"),
        iosInitSnippet(
          apiKey,
          apiUrl,
          "3. Initialize the iOS native SDK",
          "snippet-ios-init",
        ),
        flutterInitSnippet("4. Initialize the Flutter SDK"),
        flutterCrashSnippet("5. Trigger a test crash"),
      ];
  }
}

function resolveApiUrl(): string {
  return (
    process.env.NEXT_PUBLIC_INGEST_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  );
}

export default function Onboarding({ teamId, initConfig }: OnboardingProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const filtersStore = useFiltersStore();
  const onboardingStore = useOnboardingStore();
  const selectedApp = useFiltersStore((state) => state.selectedApp);

  const appsQuery = useAppsQuery(teamId);
  const apps: App[] =
    appsQuery.data?.status === AppsApiStatus.Success ? appsQuery.data.data : [];

  const createApp = useCreateAppMutation();
  const { data: authzAndMembers } = useAuthzAndMembersQuery(teamId);
  const canCreateApp = authzAndMembers?.can_create_app === true;

  const persistedState = useOnboardingStore((s) =>
    selectedApp ? s.onboarding[selectedApp.id] : undefined,
  );

  const [appName, setAppName] = useState("");

  // 'create' is a transient step that only applies before any app exists.
  // Once an app is selected, the onboarding store (or default) drives the UI.
  const step: Step =
    apps.length === 0
      ? "create"
      : (persistedState?.step ?? DEFAULT_ONBOARDING_STATE.step);
  const platform: Platform =
    persistedState?.platform ?? DEFAULT_ONBOARDING_STATE.platform;
  const flutterPlatform: FlutterPlatform =
    persistedState?.flutterPlatform ?? DEFAULT_ONBOARDING_STATE.flutterPlatform;

  // `showStepCreate` is a UI history flag — keep showing the Step 1 header
  // (with a checkmark) once it was the user's starting point, even after
  // they've advanced. Captured at first render and never updated.
  const showStepCreateRef = useRef<boolean>(apps.length === 0);
  const showStepCreate = showStepCreateRef.current;

  const setStep = (newStep: Step) => {
    if (selectedApp) {
      onboardingStore.setOnboardingStep(selectedApp.id, newStep);
    }
  };

  const setPlatform = (newPlatform: Platform) => {
    if (selectedApp) {
      onboardingStore.setOnboardingPlatform(selectedApp.id, newPlatform);
    }
  };

  const setFlutterPlatform = (newFlutterPlatform: FlutterPlatform) => {
    if (selectedApp) {
      onboardingStore.setOnboardingFlutterPlatform(
        selectedApp.id,
        newFlutterPlatform,
      );
    }
  };

  useEffect(() => {
    if (step !== "verify") {
      return;
    }
    if (!selectedApp) {
      return;
    }

    let active = true;
    const targetAppId = selectedApp.id;

    const tick = async () => {
      const appsResult = await fetchAppsFromServer(teamId);
      if (!active) {
        return;
      }
      if (appsResult.status !== AppsApiStatus.Success || !appsResult.data) {
        return;
      }
      const fresh = (appsResult.data as App[]).find(
        (a) => a.id === targetAppId,
      );
      if (!fresh?.onboarded) {
        return;
      }
      // The apps endpoint flips `onboarded` as soon as the SDK reports a
      // crash, but the filters aggregation pipeline runs separately and
      // may still be catching up. Probe the Crashes filter endpoint and
      // only advance the wizard once it returns Success — otherwise the
      // destination /crashes page would land on a NoData state until the
      // user refreshes.
      const filtersResult = await fetchFiltersFromServer(
        fresh,
        FilterSource.Crashes,
      );
      if (!active) {
        return;
      }
      if (filtersResult.status !== FiltersApiStatus.Success) {
        return;
      }
      // Mark the wizard verified so the success card renders. We
      // deliberately don't flip selectedApp.onboarded or refetch the apps
      // query here — that would change the filter-options query key,
      // which refetches successfully, which flips filtersApiStatus to
      // Success, which unmounts Onboarding before the user gets to see
      // the "Crash received" celebration. Fresh onboarded state lands
      // naturally when the user clicks View Dashboard and the destination
      // page mounts its own Filters.
      onboardingStore.markVerified(targetAppId);
    };

    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [step, selectedApp?.id, teamId, filtersStore, onboardingStore]);

  const handleCreateApp = async () => {
    const trimmed = appName.trim();
    if (!trimmed) {
      return;
    }
    try {
      const app = await createApp.mutateAsync({ teamId, appName: trimmed });
      if (app) {
        await queryClient.refetchQueries({
          queryKey: ["filterApps", teamId],
        });
        filtersStore.setSelectedApp(app);
        onboardingStore.setOnboardingStep(app.id, "integrate");
      }
      setAppName("");
      toastPositive(`App ${app?.name} has been created`);
    } catch (err) {
      toastNegative(
        `Error creating app: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  };

  const handleCopy = (label: string, content: string) => {
    navigator.clipboard.writeText(content);
    toastPositive(`${label} copied to clipboard`);
  };

  const handleViewDashboard = () => {
    if (!selectedApp) {
      router.push(`/${teamId}/crashes`);
      return;
    }
    // Pin the app id and a fresh "Last 6 Hours" date range. Without the
    // date range, the destination page inherits whatever startDate/
    // endDate the filters store last computed — possibly long before the
    // test crash arrived — which would render the just-onboarded crash
    // outside the window. Filters.tsx detects the URL dateRange and
    // recomputes the actual timestamps from now on mount.
    const params = new URLSearchParams({
      a: selectedApp.id,
      d: "Last 6 Hours",
    });
    router.push(`/${teamId}/crashes?${params.toString()}`);
  };

  const apiKey = selectedApp?.api_key.key ?? "YOUR_API_KEY";
  const apiUrl = resolveApiUrl();
  const snippets = buildSnippets(platform, flutterPlatform, apiKey, apiUrl);

  const integrateStepNumber = showStepCreate ? 2 : 1;
  const verifyStepNumber = showStepCreate ? 3 : 2;

  const createDone = step !== "create";
  const integrateDone = step === "verify" || step === "verified";
  const verifyDone = step === "verified";

  return (
    <div
      className="flex flex-col w-full max-w-4xl gap-8 py-4"
      data-testid="onboarding"
    >
      <div>
        <p className="font-body text-3xl">Get started with Measure</p>
        <p className="font-body text-sm text-muted-foreground mt-1">
          Send your first crash in just a few steps.
        </p>
      </div>

      {showStepCreate && (
        <section
          className="flex flex-col gap-3"
          data-testid="onboarding-step-create"
        >
          <StepHeader
            number={1}
            title="Create your app"
            active={step === "create"}
            done={createDone}
          />
          {step === "create" && (
            <div className="ml-11 flex flex-col gap-3">
              <p className="font-body text-sm text-muted-foreground">
                Name your app. You can rename it later from app settings.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!canCreateApp) {
                    return;
                  }
                  handleCreateApp();
                }}
                className="flex flex-row gap-2 items-center"
              >
                <Input
                  type="text"
                  placeholder="Enter app name"
                  className="w-96 font-body"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  disabled={!canCreateApp}
                  data-testid="onboarding-app-name-input"
                />
                <Button
                  type="submit"
                  variant="outline"
                  loading={createApp.isPending}
                  disabled={
                    !canCreateApp ||
                    createApp.isPending ||
                    appName.trim().length === 0
                  }
                  data-testid="onboarding-create-app-button"
                >
                  Create app
                </Button>
              </form>
              {!canCreateApp && (
                <p
                  className="font-body text-sm text-muted-foreground py-2"
                  data-testid="onboarding-create-no-permission"
                >
                  You don&apos;t have permission to create apps in this team.
                  Ask a team admin to add an app, then refresh this page.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {step !== "create" && (
        <section
          className="flex flex-col gap-3"
          data-testid="onboarding-step-integrate"
        >
          <StepHeader
            number={integrateStepNumber}
            title="Install the SDK and trigger a test crash"
            active={step === "integrate"}
            done={integrateDone}
          />
          {step === "integrate" && (
            <div className="ml-11 flex flex-col gap-8">
              <TabSelect
                items={PLATFORMS as unknown as string[]}
                selected={platform}
                onChangeSelected={(p) => setPlatform(p as Platform)}
              />
              {platform === "Flutter" && (
                <div
                  className="flex flex-col gap-2 mt-2"
                  data-testid="onboarding-flutter-platform-select"
                >
                  <p className="font-body bg-green-50 dark:bg-green-100 text-green-900 border border-green-300 p-4 rounded-md">
                    Cross platform apps need to have a unique API key for each
                    platform they target. To integrate on another platform, you
                    will create a new app on Measure with a different API key.
                    <br />
                    <br />
                    Choose which platform this Flutter app will run on.
                  </p>
                  <div className="flex flex-row gap-6 items-center mt-8">
                    {FLUTTER_PLATFORMS.map((p) => (
                      <button
                        key={p}
                        onClick={() => setFlutterPlatform(p)}
                        className={`font-body cursor-pointer outline-hidden pb-0.5 border-b-2 transition-colors ${
                          flutterPlatform === p
                            ? "border-foreground hover:border-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                        }`}
                        data-testid={`onboarding-flutter-platform-${p}`}
                        data-selected={flutterPlatform === p}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {snippets.map((snippet) => (
                <SnippetBlock
                  key={snippet.testId}
                  label={snippet.label}
                  code={snippet.code}
                  language={snippet.language}
                  onCopy={() => handleCopy(snippet.label, snippet.code)}
                  testId={snippet.testId}
                />
              ))}
              <div className="flex flex-row flex-wrap gap-4 mt-2 items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => setStep("verify")}
                  data-testid="onboarding-next-button"
                >
                  Verify <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
                <Link
                  href="/docs/sdk-integration-guide"
                  target="_blank"
                  className={`${underlineLinkStyle} font-body text-sm`}
                >
                  See full integration guide
                </Link>
              </div>
            </div>
          )}
        </section>
      )}

      {(step === "verify" || step === "verified") && (
        <section
          className="flex flex-col gap-3"
          data-testid="onboarding-step-verify"
        >
          <StepHeader
            number={verifyStepNumber}
            title="Verify the first crash"
            active={step === "verify"}
            done={verifyDone}
          />
          <div className="ml-11">
            {step === "verify" && (
              <div
                className="flex flex-col gap-4"
                data-testid="onboarding-waiting"
              >
                <div className="flex flex-row items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <p className="font-body text-sm text-muted-foreground">
                    Waiting for your first crash to arrive…
                  </p>
                </div>
                <div>
                  <Button
                    variant="outline"
                    onClick={() => setStep("integrate")}
                    data-testid="onboarding-back-to-integrate-button"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back to integration
                    steps
                  </Button>
                </div>
              </div>
            )}
            {step === "verified" && (
              <div
                className="flex flex-col gap-3"
                data-testid="onboarding-success"
              >
                <p className="font-display text-xl">Crash received.</p>
                <p className="font-body text-sm text-muted-foreground">
                  Your first crash made it to Measure.
                </p>
                <div>
                  <Button
                    variant="outline"
                    onClick={handleViewDashboard}
                    data-testid="onboarding-view-dashboard-button"
                  >
                    View on dashboard
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

interface StepHeaderProps {
  number: number;
  title: string;
  active: boolean;
  done: boolean;
}

function StepHeader({ number, title, active, done }: StepHeaderProps) {
  const indicatorClass = done
    ? "bg-green-600 text-white"
    : active
      ? "bg-foreground text-background"
      : "bg-muted text-muted-foreground";

  return (
    <div className="flex flex-row items-center gap-3">
      <div
        className={`flex items-center justify-center w-8 h-8 rounded-full font-display text-sm ${indicatorClass}`}
        data-testid={`step-${number}-indicator`}
      >
        {done ? <Check className="w-4 h-4" /> : number}
      </div>
      <p className="font-display text-xl">{title}</p>
    </div>
  );
}

interface SnippetBlockProps {
  label: string;
  code: string;
  language: CodeBlockLanguage;
  onCopy: () => void;
  testId: string;
}

function SnippetBlock({
  label,
  code,
  language,
  onCopy,
  testId,
}: SnippetBlockProps) {
  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      <div className="flex flex-row items-center justify-between">
        <p className="font-display">{label}</p>
        <Button
          variant="outline"
          onClick={onCopy}
          data-testid={`${testId}-copy`}
        >
          <Copy className="w-4 h-4 mr-1" /> Copy
        </Button>
      </div>
      <CodeBlock
        code={code}
        language={language}
        className="font-code text-sm rounded-sm overflow-hidden [&_pre]:p-4 [&_pre]:overflow-x-auto"
      />
    </div>
  );
}
