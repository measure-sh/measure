"use client";

import { useConsent } from "c15t/next";
import { useEffect } from "react";
import { captureGCLIDFromURL } from "@/app/utils/analytics/attribution";
import { captureUTMsFromURL } from "@/app/utils/analytics/utm";

// Both writes persist to the device. The login page reads them back to label a
// signup's acquisition source in PostHog. That is a marketing purpose with no
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

// Must render inside ConsentProvider: useConsent throws without it.
export function ConsentedAttributionCapture() {
  const granted = useConsent("marketing");

  useEffect(() => {
    if (!granted) {
      return;
    }
    capture();
  }, [granted]);

  return null;
}
