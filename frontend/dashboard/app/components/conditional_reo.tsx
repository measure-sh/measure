"use client";

import Script from "next/script";
import { useCookieConsent } from "../context/cookie_consent";

type ReoIdentity = {
  username: string;
  type: "email" | "github" | "linkedin";
  other_identities?: Array<{
    username: string;
    type: "email" | "github" | "linkedin";
  }>;
  firstname?: string;
  lastname?: string;
  company?: string;
};

declare global {
  interface Window {
    Reo?: {
      init: (config: { clientID: string }) => void;
      identify: (identity: ReoIdentity) => void;
    };
  }
}

export function ConditionalReo() {
  const { consent } = useCookieConsent();
  const reoId = process.env.NEXT_PUBLIC_REO_ID;

  if (!reoId || consent !== "granted") {
    return null;
  }

  return (
    <Script
      id="reo-js"
      strategy="afterInteractive"
      src={`https://static.reo.dev/${reoId}/reo.js`}
      onLoad={() => {
        window.Reo?.init({ clientID: reoId });
      }}
    />
  );
}
