"use client";

import { ConsentDialogLink, useConsentManager } from "@c15t/nextjs";
import { isConsentManaged } from "./consent_manager";

/**
 * Wraps a trigger element so it opens the c15t consent dialog, letting a user
 * review or withdraw consent. Renders nothing unless c15t is running and has
 * resolved a jurisdiction that actually requires consent handling — there is
 * no dialog to open otherwise.
 */
export function CookiePreferencesLink({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isConsentManaged()) {
    return null;
  }

  return <JurisdictionGatedLink>{children}</JurisdictionGatedLink>;
}

function JurisdictionGatedLink({ children }: { children: React.ReactNode }) {
  // Render only once c15t has resolved the jurisdiction (`hasFetchedBanner`)
  // and that jurisdiction needs consent handling (`model` non-null; null
  // where there is no cookie law). A failed resolution leaves `hasFetchedBanner`
  // false with `model` at its "opt-in" default — without that guard a dead
  // link would linger with no banner behind it.
  const { hasFetchedBanner, model } = useConsentManager();

  if (!hasFetchedBanner || model == null) {
    return null;
  }

  return <ConsentDialogLink asChild>{children}</ConsentDialogLink>;
}
