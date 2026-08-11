"use client";

import { useConsentManager } from "@c15t/nextjs";
import { useEffect } from "react";
import { captureGCLIDFromURL } from "@/app/utils/analytics/attribution";
import { captureUTMsFromURL } from "@/app/utils/analytics/utm";

// Both writes persist to the device, localStorage for the UTMs & a 90 day cookie
// for the gclid, to attribute signups. That is a marketing purpose with no
// strictly necessary exemption, so they wait for marketing consent.
function capture() {
  captureUTMsFromURL();
  captureGCLIDFromURL();
}

// For deployments running no consent manager. There is no banner & no
// jurisdiction to resolve, so there is nothing to gate on.
export function AttributionCapture() {
  useEffect(capture, []);
  return null;
}

// Must render inside ConsentManagerProvider: useConsentManager throws without
// it. c15t auto grants marketing outside opt-in jurisdictions, so this only
// withholds the writes where a banner is actually shown.
export function ConsentedAttributionCapture() {
  const { has } = useConsentManager();
  const granted = has("marketing");

  useEffect(() => {
    if (!granted) {
      return;
    }
    capture();
  }, [granted]);

  return null;
}
