"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { isCloud } from "../utils/env_utils";

const STORAGE_KEY = "msr_cookie_consent";

export type ConsentStatus = "pending" | "granted" | "denied";

type CookieConsentValue = {
  consent: ConsentStatus;
  setConsent: (status: "granted" | "denied") => void;
  /**
   * False until the persisted consent value has been read from storage.
   * Consumers should wait for `hydrated` before reacting to the default
   * "pending" state, otherwise they may briefly act on it during the first
   * render before the stored choice is applied. (ex: cookie banner flashing
   * briefly when initial state is pending and then it's dismissed becuase
   * storage read completes and state is denied or granted.)
   */
  hydrated: boolean;
};

const CookieConsentContext = createContext<CookieConsentValue>({
  consent: "denied",
  setConsent: () => {},
  hydrated: false,
});

export function useCookieConsent() {
  return useContext(CookieConsentContext);
}

export function CookieConsentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const cloud = isCloud();
  const [consent, setConsentState] = useState<ConsentStatus>("pending");
  const [hydrated, setHydrated] = useState(!cloud);

  useEffect(() => {
    if (!cloud) {
      return;
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "granted" || stored === "denied") {
        setConsentState(stored);
      }
    } catch {
      // localStorage unavailable (private browsing, blocked storage); leave at "pending"
    }
    setHydrated(true);
  }, [cloud]);

  const setConsent = useCallback(
    (status: "granted" | "denied") => {
      if (!cloud) {
        return;
      }
      try {
        window.localStorage.setItem(STORAGE_KEY, status);
      } catch {
        // best-effort persistence; still update in-memory state below
      }
      setConsentState(status);
    },
    [cloud],
  );

  const value = useMemo<CookieConsentValue>(
    () => ({
      consent: cloud ? consent : "denied",
      setConsent,
      hydrated,
    }),
    [cloud, consent, setConsent, hydrated],
  );

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  );
}
