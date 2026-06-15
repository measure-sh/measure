import { createStore } from "zustand/vanilla";

// Where the user is in the onboarding flow.
export type WizardStep = "create" | "integrate" | "verify" | "verified";

// The top-level onboarding tabs.
export const PLATFORM_NAMES = [
  "Android",
  "iOS",
  "Flutter",
  "React Native",
  "React Native (Expo)",
] as const;
export type PlatformName = (typeof PLATFORM_NAMES)[number];

// The Android/iOS side a cross-platform app compiles down to. A Measure app is
// bound to a single native platform, so cross-platform codebases (Flutter,
// React Native, Expo) onboard one app per native target. Only cross-platform
// Platforms have a NativeTarget; native tabs (Android, iOS) do not.
export const NATIVE_TARGETS = ["Android", "iOS"] as const;
export type NativeTarget = (typeof NATIVE_TARGETS)[number];

export interface OnboardingAppState {
  step: WizardStep;
  platform: PlatformName;
  // The chosen native target per cross-platform tab, keyed by platform name.
  // A missing key means the user hasn't chosen yet — treated as "Android".
  // Each tab keeps its own entry so switching tabs doesn't overwrite the others.
  nativeTargets: Partial<Record<PlatformName, NativeTarget>>;
}

export const DEFAULT_ONBOARDING_STATE: OnboardingAppState = {
  step: "integrate",
  platform: "Android",
  nativeTargets: {},
};

const ONBOARDING_STORAGE_PREFIX = "measure_onboarding_";
const VALID_WIZARD_STEPS: WizardStep[] = [
  "create",
  "integrate",
  "verify",
  "verified",
];

function onboardingStorageKey(appId: string): string {
  return `${ONBOARDING_STORAGE_PREFIX}${appId}`;
}

function isNativeTarget(value: unknown): value is NativeTarget {
  return value === "Android" || value === "iOS";
}

function isNativeTargetMap(
  value: unknown,
): value is Partial<Record<PlatformName, NativeTarget>> {
  if (!value || typeof value !== "object") {
    return false;
  }
  // Keys are platform names (not constrained here); only the values matter.
  return Object.values(value).every(isNativeTarget);
}

function isOnboardingAppState(parsed: unknown): parsed is OnboardingAppState {
  if (!parsed || typeof parsed !== "object") {
    return false;
  }
  const candidate = parsed as Record<string, unknown>;
  return (
    VALID_WIZARD_STEPS.includes(candidate.step as WizardStep) &&
    (PLATFORM_NAMES as readonly string[]).includes(
      candidate.platform as string,
    ) &&
    isNativeTargetMap(candidate.nativeTargets)
  );
}

function readOnboardingFromStorage(): Record<string, OnboardingAppState> {
  const result: Record<string, OnboardingAppState> = {};
  if (typeof window === "undefined") {
    return result;
  }
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(ONBOARDING_STORAGE_PREFIX)) {
        continue;
      }
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        continue;
      }
      try {
        const parsed = JSON.parse(raw);
        if (isOnboardingAppState(parsed)) {
          const appId = key.slice(ONBOARDING_STORAGE_PREFIX.length);
          result[appId] = parsed;
        }
      } catch {
        // skip malformed entries
      }
    }
  } catch {
    // localStorage may throw in private mode; degrade to empty state
  }
  return result;
}

function writeOnboardingToStorage(
  appId: string,
  state: OnboardingAppState,
): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      onboardingStorageKey(appId),
      JSON.stringify(state),
    );
  } catch {
    // best-effort: quota exceeded or private mode
  }
}

function removeOnboardingFromStorage(appId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(onboardingStorageKey(appId));
  } catch {
    // best-effort
  }
}

interface OnboardingStoreState {
  onboarding: Record<string, OnboardingAppState>;
}

interface OnboardingStoreActions {
  setOnboardingStep: (appId: string, step: WizardStep) => void;
  setOnboardingPlatform: (appId: string, platform: PlatformName) => void;
  setOnboardingNativeTarget: (
    appId: string,
    platform: PlatformName,
    nativeTarget: NativeTarget,
  ) => void;
  clearOnboarding: (appId: string) => void;
  // Advances the wizard to 'verified' for the given app id and clears any
  // persisted state. 'verified' is terminal so there's nothing to resume
  // from on a refresh.
  markVerified: (appId: string) => void;
  reset: () => void;
}

export type OnboardingStore = OnboardingStoreState & OnboardingStoreActions;

export function createOnboardingStore() {
  return createStore<OnboardingStore>()((set, get) => ({
    // Synchronous hydration: every render past this point — including the
    // very first — already sees persisted onboarding state.
    onboarding: readOnboardingFromStorage(),

    setOnboardingStep: (appId, step) => {
      const current = get().onboarding[appId] ?? DEFAULT_ONBOARDING_STATE;
      const next: OnboardingAppState = { ...current, step };
      set((state) => ({
        onboarding: { ...state.onboarding, [appId]: next },
      }));
      // 'verified' is terminal; 'create' never has a real app id; in
      // both cases there's nothing meaningful to resume from on a refresh.
      if (step === "verified" || step === "create") {
        removeOnboardingFromStorage(appId);
      } else {
        writeOnboardingToStorage(appId, next);
      }
    },

    setOnboardingPlatform: (appId, platform) => {
      const current = get().onboarding[appId] ?? DEFAULT_ONBOARDING_STATE;
      const next: OnboardingAppState = { ...current, platform };
      set((state) => ({
        onboarding: { ...state.onboarding, [appId]: next },
      }));
      if (next.step === "verified" || next.step === "create") {
        removeOnboardingFromStorage(appId);
      } else {
        writeOnboardingToStorage(appId, next);
      }
    },

    setOnboardingNativeTarget: (appId, platform, nativeTarget) => {
      const current = get().onboarding[appId] ?? DEFAULT_ONBOARDING_STATE;
      const next: OnboardingAppState = {
        ...current,
        nativeTargets: { ...current.nativeTargets, [platform]: nativeTarget },
      };
      set((state) => ({
        onboarding: { ...state.onboarding, [appId]: next },
      }));
      if (next.step === "verified" || next.step === "create") {
        removeOnboardingFromStorage(appId);
      } else {
        writeOnboardingToStorage(appId, next);
      }
    },

    clearOnboarding: (appId) => {
      removeOnboardingFromStorage(appId);
      set((state) => {
        if (!(appId in state.onboarding)) {
          return state;
        }
        const { [appId]: _, ...rest } = state.onboarding;
        return { onboarding: rest };
      });
    },

    markVerified: (appId) => {
      removeOnboardingFromStorage(appId);
      set((state) => {
        const current = state.onboarding[appId] ?? DEFAULT_ONBOARDING_STATE;
        return {
          onboarding: {
            ...state.onboarding,
            [appId]: { ...current, step: "verified" as WizardStep },
          },
        };
      });
    },

    // Onboarding state is keyed by app id (globally unique), so it shouldn't
    // be dropped on team change or filter reset. Logout still wipes via
    // resetAllStores.
    reset: () => {
      set({ onboarding: {} });
    },
  }));
}
