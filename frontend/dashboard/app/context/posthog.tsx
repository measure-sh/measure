"use client";

import { useEffect, useMemo, useState } from "react";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { isCloud } from "../utils/env_utils";
import { useCookieConsent } from "./cookie_consent";

const createNoopPostHog = () =>
  ({
    opt_in_capturing: () => {},
    opt_out_capturing: () => {},
    init: () => {},
    capture: () => {},
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
  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
  const { consent, hydrated } = useCookieConsent();

  const shouldInit = isCloud() && !!apiKey;
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (shouldInit && !initialized) {
      posthog.init(apiKey as string, {
        api_host: proxyPath ?? host,
        ...(proxyPath && { ui_host: "https://us.posthog.com" }),
        person_profiles: "identified_only",
        defaults: "2025-05-24",
        cookieless_mode: "on_reject",
      });
      setInitialized(true);
    }
  }, [shouldInit, initialized, apiKey, host, proxyPath]);

  useEffect(() => {
    if (!shouldInit || !initialized || !hydrated) {
      return;
    }
    if (consent === "granted") {
      posthog.opt_in_capturing();
    } else {
      posthog.opt_out_capturing();
    }
  }, [shouldInit, initialized, hydrated, consent]);

  const client = useMemo(
    () => (shouldInit ? posthog : createNoopPostHog()),
    [shouldInit],
  );

  return <PHProvider client={client}>{children}</PHProvider>;
}
