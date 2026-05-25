/**
 * @jest-environment jsdom
 */

import {
  appendAttributionToURL,
  captureGCLIDFromURL,
  getGAClientID,
  getStoredGCLID,
  parseGAClientID,
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
  // jsdom lets us reassign window.location via a fresh URL.
  Object.defineProperty(window, "location", {
    value: new URL(url),
    writable: true,
  });
}

afterEach(() => {
  clearCookies();
});

// --------------------------------------------------------------------------
// parseGAClientID — pure
// --------------------------------------------------------------------------

describe("parseGAClientID", () => {
  it("extracts the client_id from a standard GA1.1 cookie value", () => {
    expect(parseGAClientID("GA1.1.1234567890.1699999999")).toBe(
      "1234567890.1699999999",
    );
  });

  it("works for GA1.2 (different ga.js cookie version)", () => {
    expect(parseGAClientID("GA1.2.111.222")).toBe("111.222");
  });

  it("preserves multi-segment client_id beyond the standard two", () => {
    expect(parseGAClientID("GA1.1.123.456.789")).toBe("123.456.789");
  });

  it("returns null when too few segments", () => {
    expect(parseGAClientID("GA1.1.123")).toBeNull();
  });

  it("returns null when the prefix is not GA1", () => {
    expect(parseGAClientID("FOO.1.123.456")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseGAClientID("")).toBeNull();
  });

  it("returns null for null", () => {
    expect(parseGAClientID(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseGAClientID(undefined)).toBeNull();
  });
});

// --------------------------------------------------------------------------
// appendAttributionToURL — pure
// --------------------------------------------------------------------------

describe("appendAttributionToURL", () => {
  it("returns the URL unchanged when both values are null", () => {
    expect(appendAttributionToURL("https://x/y", null, null)).toBe(
      "https://x/y",
    );
  });

  it("appends only ga_client_id when gclid is null", () => {
    expect(appendAttributionToURL("https://x/y", "client-1", null)).toBe(
      "https://x/y?ga_client_id=client-1",
    );
  });

  it("appends only gclid when gaClientId is null", () => {
    expect(appendAttributionToURL("https://x/y", null, "gclid-abc")).toBe(
      "https://x/y?gclid=gclid-abc",
    );
  });

  it("appends both when both are present", () => {
    expect(appendAttributionToURL("https://x/y", "c-1", "g-1")).toBe(
      "https://x/y?ga_client_id=c-1&gclid=g-1",
    );
  });

  it("uses & separator when the URL already has a query string", () => {
    expect(appendAttributionToURL("https://x/y?foo=bar", "c-1", null)).toBe(
      "https://x/y?foo=bar&ga_client_id=c-1",
    );
  });

  it("URL-encodes special chars in values", () => {
    const got = appendAttributionToURL("https://x/y", "c id", "g/clid");
    // URLSearchParams encodes space as +, / as %2F
    expect(got).toBe("https://x/y?ga_client_id=c+id&gclid=g%2Fclid");
  });

  it("handles relative URLs", () => {
    expect(appendAttributionToURL("/api/auth/google", "c-1", null)).toBe(
      "/api/auth/google?ga_client_id=c-1",
    );
  });
});

// --------------------------------------------------------------------------
// getGAClientID — reads document.cookie
// --------------------------------------------------------------------------

describe("getGAClientID", () => {
  it("returns null when no _ga cookie is set", () => {
    expect(getGAClientID()).toBeNull();
  });

  it("parses _ga when it is the only cookie", () => {
    document.cookie = "_ga=GA1.1.111.222; Path=/";
    expect(getGAClientID()).toBe("111.222");
  });

  it("finds _ga among multiple cookies", () => {
    document.cookie = "theme=dark; Path=/";
    document.cookie = "_ga=GA1.1.111.222; Path=/";
    document.cookie = "session=abc; Path=/";
    expect(getGAClientID()).toBe("111.222");
  });

  it("does not falsely match _gat (similar prefix)", () => {
    document.cookie = "_gat=1; Path=/";
    expect(getGAClientID()).toBeNull();
  });

  it("does not falsely match __ga (extra underscore)", () => {
    document.cookie = "__ga=GA1.1.999.999; Path=/";
    expect(getGAClientID()).toBeNull();
  });

  it("returns null when _ga value is malformed", () => {
    document.cookie = "_ga=garbage; Path=/";
    expect(getGAClientID()).toBeNull();
  });
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
    // http (not https) so jsdom doesn't reject the Secure flag the helper adds.
    setLocation("http://measure.sh/landing?gclid=abc123");
    captureGCLIDFromURL();
    expect(document.cookie).toMatch(/gclid=abc123/);
  });

  it("URL-encodes special chars in the gclid value when writing", () => {
    setLocation("http://measure.sh/landing?gclid=a%26b");
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
    setLocation("http://measure.sh/landing?gclid=hello-world");
    captureGCLIDFromURL();
    expect(getStoredGCLID()).toBe("hello-world");
  });
});
