import { createStore } from "zustand/vanilla";

export type OnboardingStep = "create" | "integrate" | "verify" | "verified";
export type OnboardingPlatform = "Android" | "iOS" | "Flutter";
// A Measure app is bound to a single native platform, but a Flutter codebase
// often ships to both. The sub-selection picks which native side the user is
// integrating against right now — they may onboard a second Measure app later
// for the other side.
export type OnboardingFlutterPlatform = "Android" | "iOS";

export interface OnboardingAppState {
  step: OnboardingStep;
  platform: OnboardingPlatform;
  flutterPlatform: OnboardingFlutterPlatform;
}

export const DEFAULT_ONBOARDING_STATE: OnboardingAppState = {
  step: "integrate",
  platform: "Android",
  flutterPlatform: "Android",
};

const ONBOARDING_STORAGE_PREFIX = "measure_onboarding_";
const VALID_ONBOARDING_STEPS: OnboardingStep[] = [
  "create",
  "integrate",
  "verify",
  "verified",
];
const VALID_ONBOARDING_PLATFORMS: OnboardingPlatform[] = [
  "Android",
  "iOS",
  "Flutter",
];
const VALID_ONBOARDING_FLUTTER_PLATFORMS: OnboardingFlutterPlatform[] = [
  "Android",
  "iOS",
];

function onboardingStorageKey(appId: string): string {
  return `${ONBOARDING_STORAGE_PREFIX}${appId}`;
}

function isOnboardingAppState(parsed: unknown): parsed is OnboardingAppState {
  if (!parsed || typeof parsed !== "object") {
    return false;
  }
  const candidate = parsed as Record<string, unknown>;
  return (
    VALID_ONBOARDING_STEPS.includes(candidate.step as OnboardingStep) &&
    VALID_ONBOARDING_PLATFORMS.includes(
      candidate.platform as OnboardingPlatform,
    ) &&
    VALID_ONBOARDING_FLUTTER_PLATFORMS.includes(
      candidate.flutterPlatform as OnboardingFlutterPlatform,
    )
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
  setOnboardingStep: (appId: string, step: OnboardingStep) => void;
  setOnboardingPlatform: (appId: string, platform: OnboardingPlatform) => void;
  setOnboardingFlutterPlatform: (
    appId: string,
    flutterPlatform: OnboardingFlutterPlatform,
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

    setOnboardingFlutterPlatform: (appId, flutterPlatform) => {
      const current = get().onboarding[appId] ?? DEFAULT_ONBOARDING_STATE;
      const next: OnboardingAppState = { ...current, flutterPlatform };
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
            [appId]: { ...current, step: "verified" as OnboardingStep },
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
