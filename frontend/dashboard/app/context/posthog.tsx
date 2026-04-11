"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

const PostHogLoadedContext = createContext(false);

export function usePostHogLoaded() {
  return useContext(PostHogLoadedContext);
}

// Returns 'denied' so the cookie banner doesn't show when PostHog is unavailable
const createNoopPostHog = () =>
  ({
    get_explicit_consent_status: () => "denied",
    opt_in_capturing: () => { },
    opt_out_capturing: () => { },
    init: () => { },
    capture: () => { },
  }) as unknown as typeof posthog;

export function PostHogProvider({
  children,
  proxyPath,
}: {
  children: React.ReactNode;
  /**
   * Optional reverse-proxy path (e.g. "/yrtmlt") that routes PostHog traffic
   * through your own domain, bypassing ad-blockers. When set, it is used as
   * `api_host` and `ui_host` is set to "https://us.posthog.com" so the PostHog
   * UI still resolves correctly. When omitted, `api_host` falls back to the
   * `NEXT_PUBLIC_POSTHOG_HOST` env var (or the default PostHog ingestion URL).
   */
  proxyPath?: string;
}) {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_API_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

  const [phLoaded, setPhLoaded] = useState(false);

  const shouldInit = !!apiKey;

  useEffect(() => {
    if (shouldInit) {
      posthog.init(apiKey as string, {
        api_host: proxyPath ?? host,
        ...(proxyPath && { ui_host: "https://us.posthog.com" }),
        person_profiles: "identified_only",
        defaults: "2025-05-24",
        cookieless_mode: "on_reject",
        loaded: () => setPhLoaded(true),
      });
    }
  }, [shouldInit, apiKey, host, proxyPath]);

  const client = useMemo(() => (shouldInit ? posthog : createNoopPostHog()), [shouldInit]);

  // When there's no API key the noop client is used immediately — treat as loaded.
  const phLoadedValue = phLoaded || !shouldInit;

  return (
    <PHProvider client={client}>
      <PostHogLoadedContext.Provider value={phLoadedValue}>
        {children}
      </PostHogLoadedContext.Provider>
    </PHProvider>
  );
}
