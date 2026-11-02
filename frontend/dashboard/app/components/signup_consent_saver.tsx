"use client";

import { newsletterListId } from "@/app/api/api_calls";
import {
  useMailingListPrefsQuery,
  useSaveMailingListPrefsMutation,
} from "@/app/query/hooks";
import { isSandboxTeamId } from "@/app/utils/sandbox";
import { useEffect, useRef, useState } from "react";

// Set by the login page when the mailing list box is ticked.
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
  const [pending] = useState(() => {
    try {
      return window.sessionStorage.getItem(signupConsentKey) === "1";
    } catch {
      return false;
    }
  });
  const prefsQuery = useMailingListPrefsQuery(
    pending && !isSandboxTeamId(teamId),
  );
  const saveMutation = useSaveMailingListPrefsMutation();
  const sent = useRef(false);

  const prefs = prefsQuery.data;

  // Cleared even when saving fails, so it is never retried without asking.
  useEffect(() => {
    if (!pending || !prefs?.enabled || sent.current) {
      return;
    }
    sent.current = true;
    const newsletter = prefs.lists.find((l) => l.list_id === newsletterListId);
    if (!newsletter || newsletter.subscribed) {
      removeStorage(signupConsentKey);
      return;
    }
    saveMutation.mutate(
      { listId: newsletterListId, subscribed: true, attribution: "signup" },
      { onSettled: () => removeStorage(signupConsentKey) },
    );
  }, [prefs, saveMutation]);

  return null;
}
