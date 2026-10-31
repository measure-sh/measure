"use client";

import Script from "next/script";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      appearance?: "always" | "execute" | "interaction-only";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      "before-interactive-callback"?: () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export interface TurnstileHandle {
  reset: () => void;
}

/**
 * Cloudflare Turnstile check. It usually passes without the visitor doing
 * anything, and only shows a checkbox when Cloudflare is unsure. `onToken`
 * gets a token once it passes, and null when the token expires or fails.
 * `onCheckShown` is called when the checkbox appears.
 */
const Turnstile = forwardRef<
  TurnstileHandle,
  {
    siteKey: string;
    onToken: (token: string | null) => void;
    onCheckShown?: () => void;
  }
>(function Turnstile({ siteKey, onToken, onCheckShown }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const onCheckShownRef = useRef(onCheckShown);
  onCheckShownRef.current = onCheckShown;

  // Each token works once, so the form resets the widget after every submit
  // to get a fresh one.
  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetIdRef.current && window.turnstile) {
        onTokenRef.current(null);
        window.turnstile.reset(widgetIdRef.current);
      }
    },
  }));

  const renderWidget = useCallback(() => {
    if (!window.turnstile || !containerRef.current || widgetIdRef.current) {
      return;
    }
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      appearance: "interaction-only",
      callback: (token) => onTokenRef.current(token),
      "expired-callback": () => onTokenRef.current(null),
      "error-callback": () => onTokenRef.current(null),
      "before-interactive-callback": () => onCheckShownRef.current?.(),
    });
  }, [siteKey]);

  const removeWidget = useCallback(() => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.remove(widgetIdRef.current);
    }
    widgetIdRef.current = null;
  }, []);

  const setContainer = useCallback(
    (el: HTMLDivElement | null) => {
      containerRef.current = el;
      if (el) {
        renderWidget();
      } else {
        removeWidget();
      }
    },
    [renderWidget, removeWidget],
  );

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={renderWidget}
      />
      <div ref={setContainer} />
    </>
  );
});

export default Turnstile;
