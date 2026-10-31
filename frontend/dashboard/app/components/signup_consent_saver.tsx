"use client";

import {
  useMailingListPrefsQuery,
  useSaveMailingListPrefsMutation,
} from "@/app/query/hooks";
import { isCloud } from "@/app/utils/env_utils";
import { isSandboxTeamId } from "@/app/utils/sandbox";
import { useEffect, useRef, useState } from "react";

// Set by the login page when the mailing list box is ticked. Session storage
// keeps it across the sign-in redirect.
export const signupConsentKey = "measure_mailing_list_signup_consent";

function removeStorage(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {}
}

/**
 * Saves the mailing list consent given on the login page once sign-in lands
 * in the dashboard. Renders nothing.
 */
export default function SignupConsentSaver({ teamId }: { teamId: string }) {
  // Prefs are only fetched when there is consent to save, since reading them
  // can call Resend.
  const [pending] = useState(() => {
    try {
      return window.sessionStorage.getItem(signupConsentKey) === "1";
    } catch {
      return false;
    }
  });
  const prefsQuery = useMailingListPrefsQuery(
    pending && isCloud() && !isSandboxTeamId(teamId),
  );
  const saveMutation = useSaveMailingListPrefsMutation();
  const sent = useRef(false);

  const prefs = prefsQuery.data;

  // Cleared even when saving fails, so it is never retried without asking.
  // Prefs can arrive without consent when another page loads them, since the
  // query cache is shared.
  useEffect(() => {
    if (!pending || !prefs?.enabled || sent.current) {
      return;
    }
    sent.current = true;
    if (prefs.subscribed) {
      removeStorage(signupConsentKey);
      return;
    }
    saveMutation.mutate(
      { subscribed: true, attribution: "signup" },
      { onSettled: () => removeStorage(signupConsentKey) },
    );
  }, [prefs, saveMutation]);

  return null;
}
