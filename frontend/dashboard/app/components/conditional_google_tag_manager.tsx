"use client";

import { GoogleTagManager } from "@next/third-parties/google";
import { useCookieConsent } from "../context/cookie_consent";

export function ConditionalGoogleTagManager() {
  const { consent } = useCookieConsent();
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

  if (!gtmId || consent !== "granted") {
    return null;
  }

  return <GoogleTagManager gtmId={gtmId} />;
}
