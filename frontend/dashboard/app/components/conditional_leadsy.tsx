"use client";

import Script from "next/script";
import { useCookieConsent } from "../context/cookie_consent";

export function ConditionalLeadsy() {
  const { consent } = useCookieConsent();
  const leadsyId = process.env.NEXT_PUBLIC_LEADSY_ID;

  if (!leadsyId || consent !== "granted") {
    return null;
  }

  return (
    <Script
      id="vtag-ai-js"
      strategy="afterInteractive"
      src="https://r2.leadsy.ai/tag.js"
      data-pid={leadsyId}
      data-version="062024"
    />
  );
}
