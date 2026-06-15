import { describe, expect, it, beforeEach } from "@jest/globals";

import {
  createOnboardingStore,
  DEFAULT_ONBOARDING_STATE,
} from "@/app/stores/onboarding_store";

const STORAGE_PREFIX = "measure_onboarding_";

function key(appId: string) {
  return `${STORAGE_PREFIX}${appId}`;
}

describe("onboarding_store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe("hydration", () => {
    it("starts with empty onboarding when localStorage is empty", () => {
      const store = createOnboardingStore();
      expect(store.getState().onboarding).toEqual({});
    });

    it("hydrates valid persisted entries from localStorage", () => {
      window.localStorage.setItem(
        key("app-1"),
        JSON.stringify({
          step: "integrate",
          platform: "Android",
          flutterPlatform: "Android",
          reactNativePlatform: "Android",
          reactNativeExpoPlatform: "Android",
        }),
      );
      window.localStorage.setItem(
        key("app-2"),
        JSON.stringify({
          step: "verify",
          platform: "iOS",
          flutterPlatform: "iOS",
          reactNativePlatform: "iOS",
          reactNativeExpoPlatform: "iOS",
        }),
      );

      const store = createOnboardingStore();
      expect(store.getState().onboarding).toEqual({
        "app-1": {
          step: "integrate",
          platform: "Android",
          flutterPlatform: "Android",
          reactNativePlatform: "Android",
          reactNativeExpoPlatform: "Android",
        },
        "app-2": {
          step: "verify",
          platform: "iOS",
          flutterPlatform: "iOS",
          reactNativePlatform: "iOS",
          reactNativeExpoPlatform: "iOS",
        },
      });
    });

    it("skips malformed JSON entries", () => {
      window.localStorage.setItem(key("app-bad"), "{not-json");
      window.localStorage.setItem(
        key("app-good"),
        JSON.stringify({
          step: "integrate",
          platform: "Android",
          flutterPlatform: "Android",
          reactNativePlatform: "Android",
          reactNativeExpoPlatform: "Android",
        }),
      );

      const store = createOnboardingStore();
      const state = store.getState().onboarding;
      expect(state["app-bad"]).toBeUndefined();
      expect(state["app-good"]).toBeDefined();
    });

    it("skips entries with invalid step/platform values", () => {
      window.localStorage.setItem(
        key("app-bad"),
        JSON.stringify({
          step: "not-a-step",
          platform: "Android",
          flutterPlatform: "Android",
          reactNativePlatform: "Android",
          reactNativeExpoPlatform: "Android",
        }),
      );

      const store = createOnboardingStore();
      expect(store.getState().onboarding["app-bad"]).toBeUndefined();
    });

    it("skips entries predating the reactNativeExpoPlatform field", () => {
      window.localStorage.setItem(
        key("app-old"),
        JSON.stringify({
          step: "integrate",
          platform: "Android",
          flutterPlatform: "Android",
          reactNativePlatform: "Android",
        }),
      );

      const store = createOnboardingStore();
      expect(store.getState().onboarding["app-old"]).toBeUndefined();
    });

    it("ignores keys without the onboarding prefix", () => {
      window.localStorage.setItem("unrelated", "value");
      const store = createOnboardingStore();
      expect(store.getState().onboarding).toEqual({});
    });
  });

  describe("setOnboardingStep", () => {
    it("writes to state and localStorage for in-flight steps", () => {
      const store = createOnboardingStore();
      store.getState().setOnboardingStep("app-1", "verify");

      expect(store.getState().onboarding["app-1"]).toEqual({
        ...DEFAULT_ONBOARDING_STATE,
        step: "verify",
      });
      expect(JSON.parse(window.localStorage.getItem(key("app-1"))!)).toEqual({
        ...DEFAULT_ONBOARDING_STATE,
        step: "verify",
      });
    });

    it("clears localStorage when step is verified (terminal)", () => {
      const store = createOnboardingStore();
      store.getState().setOnboardingStep("app-1", "integrate");
      expect(window.localStorage.getItem(key("app-1"))).not.toBeNull();

      store.getState().setOnboardingStep("app-1", "verified");
      expect(window.localStorage.getItem(key("app-1"))).toBeNull();
      // In-memory state still reflects the terminal step.
      expect(store.getState().onboarding["app-1"].step).toBe("verified");
    });

    it("clears localStorage when step is create (no real app id yet)", () => {
      const store = createOnboardingStore();
      store.getState().setOnboardingStep("app-1", "integrate");
      store.getState().setOnboardingStep("app-1", "create");
      expect(window.localStorage.getItem(key("app-1"))).toBeNull();
      expect(store.getState().onboarding["app-1"].step).toBe("create");
    });

    it("preserves other fields when changing step", () => {
      const store = createOnboardingStore();
      store.getState().setOnboardingPlatform("app-1", "iOS");
      store.getState().setOnboardingStep("app-1", "verify");

      expect(store.getState().onboarding["app-1"]).toEqual({
        step: "verify",
        platform: "iOS",
        flutterPlatform: DEFAULT_ONBOARDING_STATE.flutterPlatform,
        reactNativePlatform: DEFAULT_ONBOARDING_STATE.reactNativePlatform,
        reactNativeExpoPlatform:
          DEFAULT_ONBOARDING_STATE.reactNativeExpoPlatform,
      });
    });
  });

  describe("setOnboardingPlatform", () => {
    it("updates the platform without changing other fields", () => {
      const store = createOnboardingStore();
      store.getState().setOnboardingStep("app-1", "integrate");
      store.getState().setOnboardingPlatform("app-1", "Flutter");

      expect(store.getState().onboarding["app-1"]).toEqual({
        step: "integrate",
        platform: "Flutter",
        flutterPlatform: DEFAULT_ONBOARDING_STATE.flutterPlatform,
        reactNativePlatform: DEFAULT_ONBOARDING_STATE.reactNativePlatform,
        reactNativeExpoPlatform:
          DEFAULT_ONBOARDING_STATE.reactNativeExpoPlatform,
      });
    });

    it("persists to localStorage", () => {
      const store = createOnboardingStore();
      store.getState().setOnboardingPlatform("app-1", "iOS");
      expect(
        JSON.parse(window.localStorage.getItem(key("app-1"))!).platform,
      ).toBe("iOS");
    });
  });

  describe("setOnboardingFlutterPlatform", () => {
    it("updates flutterPlatform without changing other fields", () => {
      const store = createOnboardingStore();
      store.getState().setOnboardingPlatform("app-1", "Flutter");
      store.getState().setOnboardingFlutterPlatform("app-1", "iOS");

      expect(store.getState().onboarding["app-1"]).toEqual({
        step: DEFAULT_ONBOARDING_STATE.step,
        platform: "Flutter",
        flutterPlatform: "iOS",
        reactNativePlatform: DEFAULT_ONBOARDING_STATE.reactNativePlatform,
        reactNativeExpoPlatform:
          DEFAULT_ONBOARDING_STATE.reactNativeExpoPlatform,
      });
    });
  });

  describe("setOnboardingReactNativePlatform", () => {
    it("updates reactNativePlatform without changing other fields", () => {
      const store = createOnboardingStore();
      store.getState().setOnboardingPlatform("app-1", "React Native");
      store.getState().setOnboardingReactNativePlatform("app-1", "iOS");

      expect(store.getState().onboarding["app-1"]).toEqual({
        step: DEFAULT_ONBOARDING_STATE.step,
        platform: "React Native",
        flutterPlatform: DEFAULT_ONBOARDING_STATE.flutterPlatform,
        reactNativePlatform: "iOS",
        reactNativeExpoPlatform:
          DEFAULT_ONBOARDING_STATE.reactNativeExpoPlatform,
      });
    });

    it("persists to localStorage for in-flight steps", () => {
      const store = createOnboardingStore();
      store.getState().setOnboardingPlatform("app-1", "React Native");
      store.getState().setOnboardingReactNativePlatform("app-1", "iOS");
      expect(
        JSON.parse(window.localStorage.getItem(key("app-1"))!)
          .reactNativePlatform,
      ).toBe("iOS");
    });
  });

  describe("setOnboardingReactNativeExpoPlatform", () => {
    it("updates reactNativeExpoPlatform without changing other fields", () => {
      const store = createOnboardingStore();
      store.getState().setOnboardingPlatform("app-1", "React Native (Expo)");
      store.getState().setOnboardingReactNativeExpoPlatform("app-1", "iOS");

      expect(store.getState().onboarding["app-1"]).toEqual({
        step: DEFAULT_ONBOARDING_STATE.step,
        platform: "React Native (Expo)",
        flutterPlatform: DEFAULT_ONBOARDING_STATE.flutterPlatform,
        reactNativePlatform: DEFAULT_ONBOARDING_STATE.reactNativePlatform,
        reactNativeExpoPlatform: "iOS",
      });
    });

    it("persists to localStorage for in-flight steps", () => {
      const store = createOnboardingStore();
      store.getState().setOnboardingPlatform("app-1", "React Native (Expo)");
      store.getState().setOnboardingReactNativeExpoPlatform("app-1", "iOS");
      expect(
        JSON.parse(window.localStorage.getItem(key("app-1"))!)
          .reactNativeExpoPlatform,
      ).toBe("iOS");
    });
  });

  describe("clearOnboarding", () => {
    it("removes the entry from state and localStorage", () => {
      const store = createOnboardingStore();
      store.getState().setOnboardingStep("app-1", "integrate");
      store.getState().setOnboardingStep("app-2", "verify");

      store.getState().clearOnboarding("app-1");

      expect(store.getState().onboarding["app-1"]).toBeUndefined();
      expect(store.getState().onboarding["app-2"]).toBeDefined();
      expect(window.localStorage.getItem(key("app-1"))).toBeNull();
    });

    it("is a no-op when the entry doesn't exist", () => {
      const store = createOnboardingStore();
      const before = store.getState().onboarding;
      store.getState().clearOnboarding("missing");
      expect(store.getState().onboarding).toBe(before);
    });
  });

  describe("markVerified", () => {
    it("sets the step to verified and clears localStorage", () => {
      const store = createOnboardingStore();
      store.getState().setOnboardingStep("app-1", "integrate");
      store.getState().markVerified("app-1");

      expect(store.getState().onboarding["app-1"].step).toBe("verified");
      expect(window.localStorage.getItem(key("app-1"))).toBeNull();
    });

    it("creates the entry if absent before marking verified", () => {
      const store = createOnboardingStore();
      store.getState().markVerified("app-1");

      expect(store.getState().onboarding["app-1"]).toEqual({
        ...DEFAULT_ONBOARDING_STATE,
        step: "verified",
      });
    });

    it("preserves platform / sub-platform selections when marking verified", () => {
      const store = createOnboardingStore();
      store.getState().setOnboardingPlatform("app-1", "Flutter");
      store.getState().setOnboardingFlutterPlatform("app-1", "iOS");
      store.getState().setOnboardingReactNativePlatform("app-1", "iOS");
      store.getState().setOnboardingReactNativeExpoPlatform("app-1", "iOS");

      store.getState().markVerified("app-1");

      expect(store.getState().onboarding["app-1"]).toEqual({
        step: "verified",
        platform: "Flutter",
        flutterPlatform: "iOS",
        reactNativePlatform: "iOS",
        reactNativeExpoPlatform: "iOS",
      });
    });
  });

  describe("reset", () => {
    it("wipes all in-memory onboarding entries", () => {
      const store = createOnboardingStore();
      store.getState().setOnboardingStep("app-1", "integrate");
      store.getState().setOnboardingStep("app-2", "verify");

      store.getState().reset();

      expect(store.getState().onboarding).toEqual({});
    });
  });
});
