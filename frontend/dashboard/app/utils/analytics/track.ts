import posthog from "posthog-js";

// track captures a PostHog event with schema_version automatically added.
// Use this for every event capture — keeps schema versioning consistent so
// future renames/refactors stay analyzable.
export function track(name: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") {
    return;
  }
  posthog.capture(name, { ...(props ?? {}), schema_version: "v1" });
}
