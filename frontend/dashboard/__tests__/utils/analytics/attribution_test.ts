/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://measure.sh/"}
 */

import {
  captureGCLIDFromURL,
  clearStoredGCLID,
  getStoredGCLID,
} from "@/app/utils/analytics/attribution";
import { afterEach, describe, expect, it } from "@jest/globals";

// --- helpers ---

function clearCookies() {
  // Wipe every cookie currently set on the document.
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0].trim();
    if (name) {
      document.cookie = `${name}=; Max-Age=0; Path=/`;
    }
  }
}

function setLocation(url: string) {
  // jsdom marks window.location unforgeable, so tests change the URL the
  // way a browser would: through the history API. Works because the URL
  // stays on the origin the environment options pin above.
  window.history.replaceState(null, "", url);
}

afterEach(() => {
  clearCookies();
});

// --------------------------------------------------------------------------
// captureGCLIDFromURL — writes a cookie
// --------------------------------------------------------------------------

describe("captureGCLIDFromURL", () => {
  it("is a no-op when no gclid query param is present", () => {
    setLocation("https://measure.sh/landing");
    captureGCLIDFromURL();
    expect(document.cookie).not.toMatch(/gclid=/);
  });

  it("writes a gclid cookie when the query param is present", () => {
    setLocation("https://measure.sh/landing?gclid=abc123");
    captureGCLIDFromURL();
    expect(document.cookie).toMatch(/gclid=abc123/);
  });

  it("URL-encodes special chars in the gclid value when writing", () => {
    setLocation("https://measure.sh/landing?gclid=a%26b");
    captureGCLIDFromURL();
    // URLSearchParams decodes %26 → &, then captureGCLIDFromURL re-encodes via encodeURIComponent → %26
    expect(document.cookie).toMatch(/gclid=a%26b/);
  });
});

// --------------------------------------------------------------------------
// getStoredGCLID — reads document.cookie
// --------------------------------------------------------------------------

describe("getStoredGCLID", () => {
  it("returns null when no gclid cookie is set", () => {
    expect(getStoredGCLID()).toBeNull();
  });

  it("returns the value when the gclid cookie is set", () => {
    document.cookie = "gclid=xyz789; Path=/";
    expect(getStoredGCLID()).toBe("xyz789");
  });

  it("decodes URL-encoded values", () => {
    document.cookie = "gclid=a%26b; Path=/";
    expect(getStoredGCLID()).toBe("a&b");
  });

  it("returns null for empty cookie value", () => {
    document.cookie = "gclid=; Path=/";
    // Cookie with empty value isn't actually set by browsers; the regex won't match.
    expect(getStoredGCLID()).toBeNull();
  });

  it("does not falsely match a cookie named differently", () => {
    document.cookie = "_gclid=nope; Path=/";
    expect(getStoredGCLID()).toBeNull();
  });

  it("captureGCLIDFromURL → getStoredGCLID round-trip", () => {
    setLocation("https://measure.sh/landing?gclid=hello-world");
    captureGCLIDFromURL();
    expect(getStoredGCLID()).toBe("hello-world");
  });
});

// --------------------------------------------------------------------------
// clearStoredGCLID — expires the cookie on consent withdrawal
// --------------------------------------------------------------------------

describe("clearStoredGCLID", () => {
  it("removes a stored gclid", () => {
    setLocation("https://measure.sh/landing?gclid=abc123");
    captureGCLIDFromURL();
    expect(getStoredGCLID()).toBe("abc123");

    clearStoredGCLID();

    expect(getStoredGCLID()).toBeNull();
    expect(document.cookie).not.toMatch(/gclid=abc123/);
  });

  it("is a no-op when no gclid is stored", () => {
    clearStoredGCLID();
    expect(getStoredGCLID()).toBeNull();
  });
});
