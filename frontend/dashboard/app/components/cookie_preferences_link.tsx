"use client";

import { ConsentDialogLink } from "c15t/next";
import { isConsentManaged } from "./consent_manager";

/**
 * Wraps a trigger element so it opens the c15t consent dialog, letting a user
 * review or withdraw consent. Renders nothing when c15t isn't running, and
 * ConsentDialogLink renders nothing when the visitor's policy offers no
 * preferences.
 */
export function CookiePreferencesLink({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isConsentManaged()) {
    return null;
  }

  // ConsentDialogLink applies a component part's classes to its child, by
  // default the `button.secondary` part that ConsentManager styles for the
  // banner and dialog buttons. `trigger.root` is c15t's floating preferences
  // button, which isn't rendered or styled, so the child keeps its own styling.
  return (
    <ConsentDialogLink asChild slotKey="trigger.root">
      {children}
    </ConsentDialogLink>
  );
}
