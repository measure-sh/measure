"use client";

import { Check, ChevronLeft, ChevronRight, Copy, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  NATIVE_TARGETS,
  PLATFORM_NAMES,
  type NativeTarget,
  type PlatformName,
  type WizardStep,
} from "../stores/onboarding_store";
import { useFiltersStore, useOnboardingStore } from "../stores/provider";
import type { CodeBlockLanguage } from "../utils/highlighter";
import {
  underlineLinkStyle,
  warningCalloutStyle,
} from "../utils/shared_styles";
import { toastNegative, toastPositive } from "../utils/use_toast";
import { Button } from "./button";
import CodeBlock from "./code_block";
import { Input } from "./input";
import { SDK_VERSIONS } from "./sdk_versions.generated";
import TabSelect from "./tab_select";

const POLL_INTERVAL_MS = 3000;

interface OnboardingProps {
  teamId: string;
  initConfig: InitConfig;
}

// The renderable essentials of a code block. The user-facing step title and
// its "1. " number live on the OnboardingStep that wraps this.
interface Snippet {
  code: string;
  language: CodeBlockLanguage;
  testId: string;
}

// One instruction shown during integration (e.g. "Add the dependency"). The
// leading number is added at render from the step's position, so authors never
// hand-number.
interface OnboardingStep {
  title: string;
  snippet: Snippet;
}

// A top-level onboarding tab. Native platforms (Android, iOS) have a single
// step list; cross-platform platforms (Flutter, React Native, Expo) carry one
// list per NativeTarget, because the API key lives on the native side and the
// prep differs between Android and iOS.
type Platform =
  | { name: PlatformName; crossPlatform: false; steps: OnboardingStep[] }
  | {
      name: PlatformName;
      crossPlatform: true;
      steps: Record<NativeTarget, OnboardingStep[]>;
    };

function androidGradleDepSnippet(testId: string): Snippet {
  return {
    testId,
    language: "kotlin",
    code: `// In your app/build.gradle.kts
dependencies {
    implementation("sh.measure:measure-android:${SDK_VERSIONS.androidSdk}")
}`,
  };
}

function androidManifestSnippet(apiKey: string, apiUrl: string): Snippet {
  return {
    testId: "snippet-manifest",
    language: "xml",
    code: `<!-- Inside the <application> tag -->
<meta-data android:name="sh.measure.android.API_KEY" android:value="${apiKey}" />
<meta-data android:name="sh.measure.android.API_URL" android:value="${apiUrl}" />`,
  };
}

function androidInitSnippet(testId: string): Snippet {
  return {
    testId,
    language: "kotlin",
    code: `// In your Application.onCreate()
import sh.measure.android.Measure
import sh.measure.android.config.MeasureConfig

Measure.init(
    this, MeasureConfig()
)`,
  };
}

function androidCrashSnippet(): Snippet {
  return {
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
  };
}

function iosSpmDepSnippet(testId: string): Snippet {
  return {
    testId,
    language: "swift",
    code: `// In Package.swift
.package(url: "https://github.com/measure-sh/measure.git", branch: "ios-v${SDK_VERSIONS.iosSdk}")`,
  };
}

function iosInitSnippet(
  apiKey: string,
  apiUrl: string,
  testId: string,
): Snippet {
  return {
    testId,
    language: "swift",
    code: `// In your AppDelegate's application(_:didFinishLaunchingWithOptions:)
import Measure

let clientInfo = ClientInfo(apiKey: "${apiKey}", apiUrl: "${apiUrl}")
let config = BaseMeasureConfig()
Measure.initialize(with: clientInfo, config: config)`,
  };
}

function iosCrashSnippet(): Snippet {
  return {
    testId: "snippet-crash",
    language: "swift",
    code: `// Add this at your app entry point, after Measure.initialize.
// The 2-second delay gives the SDK time to flush the crash event.
// Remove this code after the crash appears in your dashboard.
DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
    fatalError("Test crash from Measure onboarding")
}`,
  };
}

function flutterDepSnippet(): Snippet {
  return {
    testId: "snippet-dependency",
    language: "yaml",
    code: `# In pubspec.yaml
dependencies:
  measure_flutter: ^${SDK_VERSIONS.flutter}`,
  };
}

function flutterInitSnippet(): Snippet {
  return {
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

function flutterCrashSnippet(): Snippet {
  return {
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

// Shared between cross-platform SDKs (Flutter, React Native) — the iOS side
// always needs `measure-sh` linked statically. Only the user-visible project
// name (in the intro) and Podfile target name differ per cross-platform.
function iosPodfileSnippet(projectName: string, targetName: string): Snippet {
  return {
    testId: "snippet-ios-podfile",
    language: "ruby",
    code: `# ${projectName} projects default to use_frameworks! but measure-sh must be
# linked statically. First install the cocoapods-pod-linkage plugin:
#   gem install cocoapods-pod-linkage
#
# Then in ios/Podfile:
plugin 'cocoapods-pod-linkage'

target '${targetName}' do
  use_frameworks!
  pod 'measure-sh', :linkage => :static
  # ... your existing pods stay as-is
end`,
  };
}

function reactNativeDepSnippet(): Snippet {
  return {
    testId: "snippet-dependency",
    language: "shellscript",
    code: `# In your project root
npm install @measuresh/react-native@${SDK_VERSIONS.reactNative}`,
  };
}

function reactNativeInitSnippet(): Snippet {
  return {
    testId: "snippet-init",
    language: "typescript",
    code: `// In your app entry (e.g. App.tsx)
import { Measure, MeasureConfig } from '@measuresh/react-native';

const config = new MeasureConfig({});

await Measure.init({ config });`,
  };
}

function reactNativeCrashSnippet(): Snippet {
  return {
    testId: "snippet-crash",
    language: "typescript",
    code: `// Add this after Measure.init.
// The 2-second delay gives the SDK time to flush the crash event.
// Remove this code after the crash appears in your dashboard.
setTimeout(() => {
  throw new Error('Test crash from Measure onboarding');
}, 2000);`,
  };
}

// Expo's config plugin carries the API key/URL for the native side being
// built, so the snippet only shows the keys for the chosen target — a single
// Measure app maps to one platform, the same convention as the other
// cross-platform flows.
function expoConfigPluginSnippet(
  nativeTarget: NativeTarget,
  apiKey: string,
  apiUrl: string,
): Snippet {
  const options =
    nativeTarget === "Android"
      ? `          "androidApiKey": "${apiKey}",
          "androidApiUrl": "${apiUrl}"`
      : `          "iosApiKey": "${apiKey}",
          "iosApiUrl": "${apiUrl}"`;
  return {
    testId: "snippet-expo-config-plugin",
    language: "json",
    code: `{
  "expo": {
    "plugins": [
      [
        "@measuresh/react-native",
        {
${options}
        }
      ]
    ]
  }
}`,
  };
}

function expoPrebuildSnippet(): Snippet {
  return {
    testId: "snippet-expo-prebuild",
    language: "shellscript",
    code: `# In your project root
npx expo prebuild`,
  };
}

function kmpDepSnippet(): Snippet {
  return {
    testId: "snippet-dependency",
    language: "kotlin",
    code: `// In your shared module's build.gradle.kts
kotlin {
    sourceSets {
        commonMain.dependencies {
            implementation("sh.measure:measure-kmp:${SDK_VERSIONS.kmp}")
        }
    }
}`,
  };
}

// --- Per-platform step lists. Each factory bakes the app's API key/URL into
// its snippets. Cross-platform factories share the dep/init/crash steps across
// both native targets and only vary the middle (the part that carries the key).

function androidSteps(apiKey: string, apiUrl: string): OnboardingStep[] {
  return [
    {
      title: "Add the dependency",
      snippet: androidGradleDepSnippet("snippet-dependency"),
    },
    {
      title: "Add API key to AndroidManifest.xml",
      snippet: androidManifestSnippet(apiKey, apiUrl),
    },
    {
      title: "Initialize the SDK",
      snippet: androidInitSnippet("snippet-init"),
    },
    { title: "Trigger a test crash", snippet: androidCrashSnippet() },
  ];
}

function iosSteps(apiKey: string, apiUrl: string): OnboardingStep[] {
  return [
    {
      title: "Add the dependency",
      snippet: iosSpmDepSnippet("snippet-dependency"),
    },
    {
      title: "Initialize the SDK",
      snippet: iosInitSnippet(apiKey, apiUrl, "snippet-init"),
    },
    { title: "Trigger a test crash", snippet: iosCrashSnippet() },
  ];
}

function flutterSteps(
  apiKey: string,
  apiUrl: string,
): Record<NativeTarget, OnboardingStep[]> {
  const dep = {
    title: "Add the Flutter package",
    snippet: flutterDepSnippet(),
  };
  const init = {
    title: "Initialize the Flutter SDK",
    snippet: flutterInitSnippet(),
  };
  const crash = {
    title: "Trigger a test crash",
    snippet: flutterCrashSnippet(),
  };
  return {
    Android: [
      dep,
      {
        title: "Add API key to AndroidManifest.xml",
        snippet: androidManifestSnippet(apiKey, apiUrl),
      },
      {
        title: "Initialize the Android native SDK",
        snippet: androidInitSnippet("snippet-android-init"),
      },
      init,
      crash,
    ],
    iOS: [
      dep,
      {
        title: "Configure iOS Podfile for static linkage",
        snippet: iosPodfileSnippet("Flutter", "Runner"),
      },
      {
        title: "Initialize the iOS native SDK",
        snippet: iosInitSnippet(apiKey, apiUrl, "snippet-ios-init"),
      },
      init,
      crash,
    ],
  };
}

function reactNativeSteps(
  apiKey: string,
  apiUrl: string,
): Record<NativeTarget, OnboardingStep[]> {
  const dep = {
    title: "Add the React Native package",
    snippet: reactNativeDepSnippet(),
  };
  const init = {
    title: "Initialize the React Native SDK",
    snippet: reactNativeInitSnippet(),
  };
  const crash = {
    title: "Trigger a test crash",
    snippet: reactNativeCrashSnippet(),
  };
  return {
    Android: [
      dep,
      {
        title: "Add the Gradle dependency",
        snippet: androidGradleDepSnippet("snippet-android-gradle"),
      },
      {
        title: "Add API key to AndroidManifest.xml",
        snippet: androidManifestSnippet(apiKey, apiUrl),
      },
      {
        title: "Initialize the Android native SDK",
        snippet: androidInitSnippet("snippet-android-init"),
      },
      init,
      crash,
    ],
    iOS: [
      dep,
      {
        title: "Configure iOS Podfile for static linkage",
        snippet: iosPodfileSnippet("React Native", "<YourAppTarget>"),
      },
      {
        title: "Initialize the iOS native SDK",
        snippet: iosInitSnippet(apiKey, apiUrl, "snippet-ios-init"),
      },
      init,
      crash,
    ],
  };
}

function expoSteps(
  apiKey: string,
  apiUrl: string,
): Record<NativeTarget, OnboardingStep[]> {
  // The config plugin is target-specific (Android vs iOS API key); the package
  // install, prebuild, and JS init/crash are shared with bare React Native.
  const dep = {
    title: "Add the React Native package",
    snippet: reactNativeDepSnippet(),
  };
  const prebuild = {
    title: "Run prebuild to apply the plugin",
    snippet: expoPrebuildSnippet(),
  };
  const init = {
    title: "Initialize the SDK",
    snippet: reactNativeInitSnippet(),
  };
  const crash = {
    title: "Trigger a test crash",
    snippet: reactNativeCrashSnippet(),
  };
  const configPlugin = (nativeTarget: NativeTarget): OnboardingStep => ({
    title: "Add the config plugin to app.json or app.config.js",
    snippet: expoConfigPluginSnippet(nativeTarget, apiKey, apiUrl),
  });
  return {
    Android: [dep, configPlugin("Android"), prebuild, init, crash],
    iOS: [dep, configPlugin("iOS"), prebuild, init, crash],
  };
}

// The KMP SDK has no init API of its own, so each native SDK is initialized in
// its own target. Compose Multiplatform integrates the same way and shares
// this tab.
function kmpSteps(
  apiKey: string,
  apiUrl: string,
): Record<NativeTarget, OnboardingStep[]> {
  const dep = {
    title: "Add the KMP dependency to commonMain",
    snippet: kmpDepSnippet(),
  };
  return {
    Android: [
      dep,
      {
        title: "Add API key to AndroidManifest.xml",
        snippet: androidManifestSnippet(apiKey, apiUrl),
      },
      {
        title: "Initialize the Android native SDK",
        snippet: androidInitSnippet("snippet-android-init"),
      },
      { title: "Trigger a test crash", snippet: androidCrashSnippet() },
    ],
    iOS: [
      dep,
      {
        title: "Add the iOS dependency",
        snippet: iosSpmDepSnippet("snippet-ios-dependency"),
      },
      {
        title: "Initialize the iOS native SDK",
        snippet: iosInitSnippet(apiKey, apiUrl, "snippet-ios-init"),
      },
      { title: "Trigger a test crash", snippet: iosCrashSnippet() },
    ],
  };
}

function buildPlatforms(apiKey: string, apiUrl: string): Platform[] {
  return [
    {
      name: "Android",
      crossPlatform: false,
      steps: androidSteps(apiKey, apiUrl),
    },
    { name: "iOS", crossPlatform: false, steps: iosSteps(apiKey, apiUrl) },
    {
      name: "Flutter",
      crossPlatform: true,
      steps: flutterSteps(apiKey, apiUrl),
    },
    {
      name: "React Native",
      crossPlatform: true,
      steps: reactNativeSteps(apiKey, apiUrl),
    },
    {
      name: "React Native (Expo)",
      crossPlatform: true,
      steps: expoSteps(apiKey, apiUrl),
    },
    {
      name: "Kotlin Multiplatform",
      crossPlatform: true,
      steps: kmpSteps(apiKey, apiUrl),
    },
  ];
}

// "React Native (Expo)" -> "react-native-expo"; namespaces the native-target
// sub-selector's test ids per cross-platform tab.
function platformSlug(name: PlatformName): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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
  const step: WizardStep =
    apps.length === 0
      ? "create"
      : (persistedState?.step ?? DEFAULT_ONBOARDING_STATE.step);
  const platform: PlatformName =
    persistedState?.platform ?? DEFAULT_ONBOARDING_STATE.platform;
  const nativeTargets =
    persistedState?.nativeTargets ?? DEFAULT_ONBOARDING_STATE.nativeTargets;

  // `showStepCreate` is a UI history flag — keep showing the Step 1 header
  // (with a checkmark) once it was the user's starting point, even after
  // they've advanced. Captured at first render and never updated.
  const [showStepCreate] = useState<boolean>(() => apps.length === 0);

  const setStep = (newStep: WizardStep) => {
    if (selectedApp) {
      onboardingStore.setOnboardingStep(selectedApp.id, newStep);
    }
  };

  const setPlatform = (newPlatform: PlatformName) => {
    if (selectedApp) {
      onboardingStore.setOnboardingPlatform(selectedApp.id, newPlatform);
    }
  };

  const setNativeTarget = (newNativeTarget: NativeTarget) => {
    if (selectedApp) {
      onboardingStore.setOnboardingNativeTarget(
        selectedApp.id,
        platform,
        newNativeTarget,
      );
    }
  };

  const apiKey = selectedApp?.api_key.key ?? "YOUR_API_KEY";
  const apiUrl = resolveApiUrl();
  const platforms = buildPlatforms(apiKey, apiUrl);
  const active = platforms.find((p) => p.name === platform) ?? platforms[0];
  const nativeTarget: NativeTarget = nativeTargets[platform] ?? "Android";
  const steps: OnboardingStep[] = active.crossPlatform
    ? active.steps[nativeTarget]
    : active.steps;

  // Cross-platform tabs render an Android/iOS sub-selector; resolve its state
  // and setter up front so the sub-selector UI is platform-agnostic. It's null
  // for native tabs, which have no sub-selector.
  const crossPlatform = active.crossPlatform
    ? {
        kind: active.name,
        nativeTarget,
        setNativeTarget,
        testIdSlug: platformSlug(active.name),
      }
    : null;

  useEffect(() => {
    if (step !== "verify" || !selectedApp) {
      return;
    }

    const targetAppId = selectedApp.id;
    // A poll can still be waiting on the network when the user leaves this
    // screen. We set this in cleanup so the poll skips its update instead
    // of touching a screen that's no longer there.
    let stopped = false;

    // The onboarded flag flips as soon as the SDK reports its first event
    // of any kind but we need to make sure that filters are updated by the
    // materialised view before proceeding so that the destination page
    // does not show "No Data" when users heads there.
    const firstEventHasLanded = async (): Promise<boolean> => {
      const appsResult = await fetchAppsFromServer(teamId);
      if (appsResult.status !== AppsApiStatus.Success || !appsResult.data) {
        return false;
      }
      const refetchedApp = (appsResult.data as App[]).find(
        (app) => app.id === targetAppId,
      );
      if (!refetchedApp?.onboarded) {
        return false;
      }
      const errorsFilterResult = await fetchFiltersFromServer(
        refetchedApp,
        FilterSource.Errors,
      );
      return errorsFilterResult.status === FiltersApiStatus.Success;
    };

    const pollForFirstEvent = async () => {
      if ((await firstEventHasLanded()) && !stopped) {
        // Only show the success card. Don't update the app's onboarded
        // flag or refetch apps here: that reloads the filters, which
        // unmounts this screen before the user sees the success message.
        // The real onboarded state loads later, when they open the
        // dashboard.
        onboardingStore.markVerified(targetAppId);
      }
    };

    pollForFirstEvent();
    const interval = setInterval(pollForFirstEvent, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [step, selectedApp?.id, teamId, onboardingStore]);

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
          <WizardStepHeader
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
          <WizardStepHeader
            number={integrateStepNumber}
            title="Install the SDK and trigger a test crash"
            active={step === "integrate"}
            done={integrateDone}
          />
          {step === "integrate" && (
            <div className="ml-11 flex flex-col gap-8">
              <TabSelect
                items={[...PLATFORM_NAMES]}
                selected={platform}
                onChangeSelected={(p) => setPlatform(p as PlatformName)}
              />
              {crossPlatform && (
                <div
                  className="flex flex-col gap-2 mt-2"
                  data-testid={`onboarding-${crossPlatform.testIdSlug}-native-target-select`}
                >
                  <p className={warningCalloutStyle}>
                    Cross platform apps need to have a unique API key for each
                    platform they target. To integrate on another platform, you
                    will create a new app on Measure with a different API key.
                    <br />
                    <br />
                    Choose which platform this {crossPlatform.kind} app will run
                    on.
                  </p>
                  <div className="flex flex-row gap-6 items-center mt-8">
                    {NATIVE_TARGETS.map((p) => (
                      <button
                        key={p}
                        onClick={() => crossPlatform.setNativeTarget(p)}
                        className={`font-body cursor-pointer outline-hidden pb-0.5 border-b-2 transition-colors ${
                          crossPlatform.nativeTarget === p
                            ? "border-foreground hover:border-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                        }`}
                        data-testid={`onboarding-${crossPlatform.testIdSlug}-native-target-${p}`}
                        data-selected={crossPlatform.nativeTarget === p}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {steps.map((onboardingStep, i) => {
                const label = `${i + 1}. ${onboardingStep.title}`;
                return (
                  <SnippetBlock
                    key={onboardingStep.snippet.testId}
                    label={label}
                    code={onboardingStep.snippet.code}
                    language={onboardingStep.snippet.language}
                    onCopy={() =>
                      handleCopy(label, onboardingStep.snippet.code)
                    }
                    testId={onboardingStep.snippet.testId}
                  />
                );
              })}
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
          <WizardStepHeader
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

interface WizardStepHeaderProps {
  number: number;
  title: string;
  active: boolean;
  done: boolean;
}

function WizardStepHeader({
  number,
  title,
  active,
  done,
}: WizardStepHeaderProps) {
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
