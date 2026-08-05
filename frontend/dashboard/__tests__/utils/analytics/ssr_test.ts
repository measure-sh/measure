/**
 * @jest-environment node
 *
 * The analytics helpers guard on `typeof window === "undefined"` so server
 * rendering never touches storage or PostHog. jsdom no longer allows
 * deleting the window global to fake that condition, so these tests run in
 * the node environment, where window genuinely does not exist.
 */

import { getUTMState } from "@/app/utils/analytics/utm";
import { describe, expect, it, jest } from "@jest/globals";
import posthog from "posthog-js";

describe("analytics in SSR (no window)", () => {
  it("track is a no-op", async () => {
    const captureSpy = jest.spyOn(posthog, "capture").mockImplementation(() => {
      return undefined as unknown as ReturnType<typeof posthog.capture>;
    });
    const { track } = await import("@/app/utils/analytics/track");
    track("ssr_event", { foo: "bar" });
    expect(captureSpy).not.toHaveBeenCalled();
    captureSpy.mockRestore();
  });

  it("captureUTMsFromURL does not throw", async () => {
    const { captureUTMsFromURL } = await import("@/app/utils/analytics/utm");
    expect(() => captureUTMsFromURL()).not.toThrow();
  });

  it("getUTMState returns null", () => {
    expect(getUTMState()).toBeNull();
  });
});
