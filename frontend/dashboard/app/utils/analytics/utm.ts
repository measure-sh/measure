// Persistent marketing attribution UTMs in localStorage with first-touch /
// last-touch semantics and a 90-day rolling expiry. Mirrors the SSR-safety
// pattern used in attribution.ts: every public function bails when
// `window` is not defined.

const STORAGE_KEY = "measure_utm_v1";
const EXPIRY_MS = 90 * 24 * 60 * 60 * 1000;

export interface UTMState {
  // first_touch keys remain whatever was written first (set_once semantics)
  first_touch_utm_source?: string;
  first_touch_utm_medium?: string;
  first_touch_utm_campaign?: string;
  referrer_domain?: string; // first-touch
  // last_touch keys overwrite on every page load
  last_touch_utm_source?: string;
  last_touch_utm_medium?: string;
}

interface StoredUTM extends UTMState {
  expires_at: number;
}

// readStored returns the raw persisted record (including expires_at).
// Returns null when missing, unparseable, or expired (and clears the key on
// expiry).
function readStored(): StoredUTM | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredUTM;
    if (
      typeof parsed.expires_at !== "number" ||
      Date.now() > parsed.expires_at
    ) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(value: StoredUTM): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore quota / disabled-storage failures
  }
}

// stripWww removes a single leading "www." from a hostname, if present.
function stripWww(hostname: string): string {
  if (hostname.startsWith("www.")) {
    return hostname.slice(4);
  }
  return hostname;
}

// deriveReferrerDomain returns the hostname of document.referrer (with any
// leading "www." stripped) — or null when the referrer is empty,
// unparseable, or on the same origin as the current page.
function deriveReferrerDomain(): string | null {
  const referrer = document.referrer;
  if (!referrer) {
    return null;
  }
  try {
    const url = new URL(referrer);
    if (url.origin === window.location.origin) {
      return null;
    }
    const host = stripWww(url.hostname);
    return host || null;
  } catch {
    return null;
  }
}

// captureUTMsFromURL inspects window.location for utm_* params and
// document.referrer.
// On every call:
//   - first_touch_* and referrer_domain are written ONLY IF not already set (set_once)
//   - last_touch_* are always written (overwrite)
//   - Expiry is refreshed to "now + 90 days" on each call
// No-op in SSR.
export function captureUTMsFromURL(): void {
  if (typeof window === "undefined") {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get("utm_source") || undefined;
  const utmMedium = params.get("utm_medium") || undefined;
  const utmCampaign = params.get("utm_campaign") || undefined;
  const referrerDomain = deriveReferrerDomain() ?? undefined;

  const existing = readStored();
  const next: StoredUTM = {
    ...(existing ?? {}),
    expires_at: Date.now() + EXPIRY_MS,
  };

  // first-touch: set_once
  if (next.first_touch_utm_source === undefined && utmSource !== undefined) {
    next.first_touch_utm_source = utmSource;
  }
  if (next.first_touch_utm_medium === undefined && utmMedium !== undefined) {
    next.first_touch_utm_medium = utmMedium;
  }
  if (
    next.first_touch_utm_campaign === undefined &&
    utmCampaign !== undefined
  ) {
    next.first_touch_utm_campaign = utmCampaign;
  }
  if (next.referrer_domain === undefined && referrerDomain !== undefined) {
    next.referrer_domain = referrerDomain;
  }

  // last-touch: overwrite when a new value is supplied. If the URL has no
  // utm_* on this visit, leave whatever was there.
  if (utmSource !== undefined) {
    next.last_touch_utm_source = utmSource;
  }
  if (utmMedium !== undefined) {
    next.last_touch_utm_medium = utmMedium;
  }

  writeStored(next);
}

// getUTMState returns the persisted attribution state, or null if none.
// Returns null if expired (clears localStorage in that case).
// No-op in SSR (returns null).
export function getUTMState(): UTMState | null {
  if (typeof window === "undefined") {
    return null;
  }
  const stored = readStored();
  if (!stored) {
    return null;
  }
  // Strip expires_at from the returned shape.
  const { expires_at: _expires, ...state } = stored;
  // If nothing meaningful is persisted, treat as null so callers can short-circuit.
  if (Object.keys(state).length === 0) {
    return null;
  }
  return state;
}

// Exported storage key so tests and tooling can clear or inspect it.
export const UTM_STORAGE_KEY = STORAGE_KEY;
