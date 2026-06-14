/**
 * @jest-environment jsdom
 */

import { track } from "@/app/utils/analytics/track";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import posthog from "posthog-js";

// We don't want a real PostHog network connection — just spy on capture().
const captureSpy = jest.spyOn(posthog, "capture").mockImplementation(() => {
  return undefined as unknown as ReturnType<typeof posthog.capture>;
});

beforeEach(() => {
  captureSpy.mockClear();
});

afterEach(() => {
  captureSpy.mockClear();
});

describe("track", () => {
  it("calls posthog.capture with the event name and adds schema_version", () => {
    track("test_event");
    expect(captureSpy).toHaveBeenCalledTimes(1);
    expect(captureSpy).toHaveBeenCalledWith("test_event", {
      schema_version: "v1",
    });
  });

  it("merges supplied props with schema_version", () => {
    track("clicked_button", { button: "signup", plan: "team" });
    expect(captureSpy).toHaveBeenCalledTimes(1);
    expect(captureSpy).toHaveBeenCalledWith("clicked_button", {
      button: "signup",
      plan: "team",
      schema_version: "v1",
    });
  });

  it("schema_version overrides any caller-provided value", () => {
    // schema_version: "v1" is appended LAST in the spread, so it wins over a
    // caller-provided value. This is intentional — schema versioning is
    // owned by the wrapper.
    track("evt", { schema_version: "v9", other: 1 });
    expect(captureSpy).toHaveBeenCalledWith("evt", {
      schema_version: "v1",
      other: 1,
    });
  });

  it("handles missing props object", () => {
    track("no_props_event", undefined);
    expect(captureSpy).toHaveBeenCalledWith("no_props_event", {
      schema_version: "v1",
    });
  });

  it("is a no-op when window is undefined (SSR)", () => {
    const originalWindow = global.window;
    // Force the SSR branch by removing window.
    delete (global as any).window;
    try {
      track("ssr_event", { foo: "bar" });
      expect(captureSpy).not.toHaveBeenCalled();
    } finally {
      (global as any).window = originalWindow;
    }
  });
});
