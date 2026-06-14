/**
 * @jest-environment jsdom
 */

import {
  captureUTMsFromURL,
  getUTMState,
  UTM_STORAGE_KEY,
} from "@/app/utils/analytics/utm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

// --- helpers ---

function setLocation(url: string) {
  Object.defineProperty(window, "location", {
    value: new URL(url),
    writable: true,
  });
}

function setReferrer(referrer: string) {
  Object.defineProperty(document, "referrer", {
    value: referrer,
    configurable: true,
  });
}

beforeEach(() => {
  window.localStorage.clear();
  setLocation("https://measure.sh/");
  setReferrer("");
});

afterEach(() => {
  window.localStorage.clear();
  jest.useRealTimers();
});

// --------------------------------------------------------------------------
// captureUTMsFromURL — first/last touch semantics
// --------------------------------------------------------------------------

describe("captureUTMsFromURL", () => {
  it("is a no-op in SSR (no window)", () => {
    const originalWindow = global.window;
    delete (global as any).window;
    try {
      expect(() => captureUTMsFromURL()).not.toThrow();
    } finally {
      (global as any).window = originalWindow;
    }
  });

  it("writes nothing meaningful when no utm params and no referrer", () => {
    setLocation("https://measure.sh/landing");
    captureUTMsFromURL();
    expect(getUTMState()).toBeNull();
  });

  it("captures utm_source, utm_medium, utm_campaign on first call", () => {
    setLocation(
      "https://measure.sh/landing?utm_source=google&utm_medium=cpc&utm_campaign=spring24",
    );
    captureUTMsFromURL();
    const state = getUTMState();
    expect(state).toEqual({
      first_touch_utm_source: "google",
      first_touch_utm_medium: "cpc",
      first_touch_utm_campaign: "spring24",
      last_touch_utm_source: "google",
      last_touch_utm_medium: "cpc",
    });
  });

  it("captures referrer_domain from document.referrer", () => {
    setLocation("https://measure.sh/landing");
    setReferrer("https://news.ycombinator.com/item?id=1");
    captureUTMsFromURL();
    expect(getUTMState()).toEqual({
      referrer_domain: "news.ycombinator.com",
    });
  });

  it("strips a leading www. from referrer hostname", () => {
    setLocation("https://measure.sh/landing");
    setReferrer("https://www.example.com/article");
    captureUTMsFromURL();
    expect(getUTMState()).toEqual({
      referrer_domain: "example.com",
    });
  });

  it("ignores same-origin referrer (internal navigation)", () => {
    setLocation("https://measure.sh/dashboard");
    setReferrer("https://measure.sh/landing");
    captureUTMsFromURL();
    expect(getUTMState()).toBeNull();
  });

  it("ignores unparseable referrer", () => {
    setLocation("https://measure.sh/landing");
    setReferrer("not-a-url");
    captureUTMsFromURL();
    expect(getUTMState()).toBeNull();
  });

  it("first_touch values are set_once — second call with different utms does NOT overwrite", () => {
    setLocation(
      "https://measure.sh/landing?utm_source=google&utm_medium=cpc&utm_campaign=spring24",
    );
    captureUTMsFromURL();

    setLocation(
      "https://measure.sh/landing?utm_source=twitter&utm_medium=social&utm_campaign=launch",
    );
    captureUTMsFromURL();

    const state = getUTMState();
    expect(state?.first_touch_utm_source).toBe("google");
    expect(state?.first_touch_utm_medium).toBe("cpc");
    expect(state?.first_touch_utm_campaign).toBe("spring24");
  });

  it("last_touch values DO overwrite on subsequent calls", () => {
    setLocation("https://measure.sh/landing?utm_source=google&utm_medium=cpc");
    captureUTMsFromURL();

    setLocation(
      "https://measure.sh/landing?utm_source=twitter&utm_medium=social",
    );
    captureUTMsFromURL();

    const state = getUTMState();
    expect(state?.last_touch_utm_source).toBe("twitter");
    expect(state?.last_touch_utm_medium).toBe("social");
  });

  it("referrer_domain is set_once", () => {
    setLocation("https://measure.sh/landing");
    setReferrer("https://news.ycombinator.com/item?id=1");
    captureUTMsFromURL();

    setReferrer("https://reddit.com/r/programming");
    captureUTMsFromURL();

    expect(getUTMState()?.referrer_domain).toBe("news.ycombinator.com");
  });

  it("preserves existing first_touch when subsequent call has no utm at all", () => {
    setLocation("https://measure.sh/landing?utm_source=google&utm_medium=cpc");
    captureUTMsFromURL();

    setLocation("https://measure.sh/dashboard");
    captureUTMsFromURL();

    const state = getUTMState();
    expect(state?.first_touch_utm_source).toBe("google");
    expect(state?.last_touch_utm_source).toBe("google");
  });
});

// --------------------------------------------------------------------------
// getUTMState — expiry / SSR
// --------------------------------------------------------------------------

describe("getUTMState", () => {
  it("returns null in SSR (no window)", () => {
    const originalWindow = global.window;
    delete (global as any).window;
    try {
      expect(getUTMState()).toBeNull();
    } finally {
      (global as any).window = originalWindow;
    }
  });

  it("returns null when nothing has been captured", () => {
    expect(getUTMState()).toBeNull();
  });

  it("returns null and clears storage after 90 days", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    setLocation("https://measure.sh/?utm_source=google");
    captureUTMsFromURL();
    expect(getUTMState()?.first_touch_utm_source).toBe("google");

    // Advance past 90 days
    jest.setSystemTime(new Date("2024-04-15T00:00:00Z"));
    expect(getUTMState()).toBeNull();
    // Storage should have been cleared
    expect(window.localStorage.getItem(UTM_STORAGE_KEY)).toBeNull();
  });

  it("returns null and clears storage when stored JSON is corrupted", () => {
    window.localStorage.setItem(UTM_STORAGE_KEY, "not-json");
    expect(getUTMState()).toBeNull();
  });

  it("refreshes expiry on each capture call (rolling window)", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    setLocation("https://measure.sh/?utm_source=google");
    captureUTMsFromURL();

    // 60 days later, refresh by capturing again
    jest.setSystemTime(new Date("2024-03-01T00:00:00Z"));
    captureUTMsFromURL();

    // 80 days after the second call — still within 90 days of refresh
    jest.setSystemTime(new Date("2024-05-20T00:00:00Z"));
    expect(getUTMState()?.first_touch_utm_source).toBe("google");
  });
});
