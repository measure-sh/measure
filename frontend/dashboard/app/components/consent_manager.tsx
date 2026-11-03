"use client";

import { googleTagManager } from "@c15t/integrations/google-tag-manager";
import {
  ConsentBanner,
  ConsentDialog,
  ConsentProvider,
  ConsentTheme,
  type ConsentProviderOptions,
  type Theme,
} from "c15t/next";
import { hosted, offline, policyRulePresets } from "c15t/react";
import { PostHogProvider } from "../context/posthog";
import { GCLID_COOKIE_NAME } from "../utils/analytics/attribution";
import { UTM_STORAGE_KEY } from "../utils/analytics/utm";
import { isCloud } from "../utils/env_utils";
import { work_sans } from "../utils/fonts";
import {
  AttributionCapture,
  ConsentedAttributionCapture,
} from "./analytics/attribution_capture";
import { buttonVariants } from "./button_variants";

// Flip to true to run c15t offline (no backend) for local testing — the
// jurisdiction then comes from the `overrides` set below. Keep false on
// committed builds.
export const offlineMode = false;

// c15t runs in offline mode, or in cloud with a backend URL configured.
// Otherwise (self-host, or a cloud build with no backend URL) it is not run.
export function isConsentManaged(): boolean {
  return (
    offlineMode ||
    (isCloud() && Boolean(process.env.NEXT_PUBLIC_C15T_BACKEND_URL))
  );
}

// Measure's design tokens for the c15t consent UI. Every value is a CSS
// variable from globals.css; those are already redefined under `.dark`, so the
// same set drives both schemes. Passing `dark` explicitly stops c15t falling
// back to its own dark palette; only the switch thumb needs a distinct dark
// value so it stays light against the dark track.
const measureColors = {
  primary: "var(--primary)",
  primaryHover: "var(--primary)",
  textOnPrimary: "var(--primary-foreground)",
  surface: "var(--popover)",
  surfaceHover: "var(--muted)",
  border: "var(--border)",
  borderHover: "var(--border)",
  text: "var(--popover-foreground)",
  textMuted: "var(--muted-foreground)",
  switchTrack: "var(--input)",
  switchTrackActive: "var(--primary)",
  switchThumb: "var(--background)",
};

// Styles the c15t legal-link anchors so only the underline sets them apart:
// `[font:inherit]` + `text-inherit` make them match the surrounding text's
// type, size and colour; the underline is `underlineLinkStyle`
// (shared_styles.tsx). `[&_a]`-scoped — the anchors share the description slot.
const legalLinkClasses =
  "[&_a]:[font:inherit] [&_a]:text-inherit [&_a]:underline [&_a]:decoration-2 [&_a]:underline-offset-2 [&_a]:decoration-amber-300 [&_a:hover]:decoration-amber-400";

const measureTheme = {
  colors: measureColors,
  dark: { ...measureColors, switchThumb: "var(--foreground)" },
  radius: {
    sm: "calc(var(--radius) - 4px)",
    md: "calc(var(--radius) - 2px)",
    lg: "var(--radius)",
  },
  // ConsentTheme declares the tokens on :root, but next/font defines
  // --font-work-sans on <body>, so a var() reference resolves to nothing there.
  typography: { fontFamily: work_sans.style.fontFamily },
} satisfies Theme;

const measureComponents = {
  banner: { title: { className: "font-display" } },
  dialog: { title: { className: "font-display" } },
  // c15t renders the legal links inside the description, so legalLinkClasses
  // scopes the underline to the `<a>`s only.
  description: {
    banner: { className: legalLinkClasses },
    dialog: { className: legalLinkClasses },
  },
  // c15t keeps its own button classes alongside these, but they sit in
  // `@layer components`, so the app's utility classes win. The border overrides
  // cancel c15t's base border and its default stroke-mode inset shadow.
  button: {
    primary: {
      className: `${buttonVariants({ variant: "default" })} border-0 shadow-none`,
    },
    secondary: {
      className: `${buttonVariants({ variant: "secondary" })} border-0.5 shadow-none`,
    },
  },
  // c15t sizes its switch from CSS variables on the switch root, set here to
  // match the dashboard switch.
  switch: {
    root: {
      style: {
        "--switch-height": "1.15rem",
        "--switch-width": "2rem",
        "--switch-thumb-size": "1rem",
        "--switch-padding": "0.075rem",
      } as React.CSSProperties,
    },
  },
} satisfies ConsentProviderOptions["components"];

// These presets carry the jurisdiction rules so the `overrides` country/region
// resolves to a real policy (GDPR / CCPA / …) in offline mode. In production
// the hosted backend handles this resolution instead.
const offlinePolicyRules = [
  policyRulePresets.europeOptIn(),
  policyRulePresets.californiaOptOut(),
  policyRulePresets.quebecOptIn(),
  policyRulePresets.worldOptOutNoPrompt(),
];

export function ConsentManager({ children }: { children: React.ReactNode }) {
  const backendURL = process.env.NEXT_PUBLIC_C15T_BACKEND_URL;
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

  // How c15t initialises. Offline mode runs it with no backend and a fixed
  // jurisdiction (from `overrides`); otherwise it runs hosted, but only in
  // cloud with a backend URL. Anything else — self-host, or a cloud build not
  // pointed at a backend — gets no c15t at all: no banner, no link, no trackers.
  let init: Pick<ConsentProviderOptions, "mode" | "overrides">;
  if (offlineMode) {
    // Jurisdiction to test: { country: "DE" } → GDPR (opt-in),
    // { country: "US", region: "CA" } → CCPA (opt-out), { country: "GB" } → UK.
    init = {
      mode: offline({ policyRules: offlinePolicyRules }),
      overrides: { country: "DE" },
    };
  } else if (isCloud() && backendURL) {
    init = { mode: hosted({ backendURL }) };
  } else {
    return (
      <>
        <AttributionCapture />
        {children}
      </>
    );
  }

  return (
    <ConsentProvider
      options={{
        ...init,
        consentCategories: ["necessary", "measurement", "marketing"],
        theme: measureTheme,
        components: measureComponents,
        // The attribution data may only be kept while marketing consent
        // stands, so c15t deletes it whenever marketing ends up denied,
        // whether by a visitor's save, an expired choice or a privacy signal.
        clearOnRevocation: {
          marketing: {
            cookies: [GCLID_COOKIE_NAME],
            localStorage: [UTM_STORAGE_KEY],
          },
        },
        legalLinks: {
          privacyPolicy: { href: "/privacy-policy", target: "_self" },
        },
        // GTM runs only in cloud and only if its container ID is set; c15t's
        // Consent Mode v2 then gates its tags on marketing consent. Must be an
        // array even when empty — c15t's script loader iterates it unguarded.
        scripts: isCloud() && gtmId ? [googleTagManager({ id: gtmId })] : [],
      }}
    >
      {/* ConsentProvider doesn't turn measureTheme's tokens into CSS.
          ConsentTheme writes them as CSS variables, and without it the banner
          and dialog use c15t's default colours, fonts and radii. */}
      <ConsentTheme theme={measureTheme} />
      <ConsentBanner hideBranding legalLinks={["privacyPolicy"]} />
      <ConsentDialog hideBranding legalLinks={["privacyPolicy"]} />
      <ConsentedAttributionCapture />
      <PostHogProvider proxyPath="/yrtmlt">{children}</PostHogProvider>
    </ConsentProvider>
  );
}
