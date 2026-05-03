"use client";

import Link from "next/link";
import { useCookieConsent } from "../context/cookie_consent";
import { underlineLinkStyle } from "../utils/shared_styles";
import { Button } from "./button";

export function CookieBanner() {
  const { consent, setConsent, hydrated } = useCookieConsent();

  if (!hydrated || consent !== "pending") {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-start">
      <div className="mx-4 w-full max-w-xl flex flex-col border border-border items-start bg-accent text-accent-foreground font-display rounded-md p-4 shadow-lg">
        <p>
          We use cookies to understand how you use the product and help us
          improve it. To learn more, please see our{" "}
          <Link
            target="_blank"
            className={underlineLinkStyle}
            href="/privacy-policy"
          >
            privacy policy
          </Link>
          .
        </p>
        <div className="flex flex-row gap-2 mt-4">
          <Button variant="default" onClick={() => setConsent("granted")}>
            Accept All
          </Button>
          <Button
            variant="ghost"
            className={"text-accent-foreground/50"}
            onClick={() => setConsent("denied")}
          >
            Accept Essential
          </Button>
        </div>
      </div>
    </div>
  );
}
