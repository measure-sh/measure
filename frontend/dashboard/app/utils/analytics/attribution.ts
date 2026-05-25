const GCLID_COOKIE_NAME = "gclid";
const GCLID_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

// appendAttributionToURL returns url with ga_client_id and gclid added as
// query params when non-null. Pure: no cookie reads. Used by both the
// client-side signin buttons and the server-side OAuth callback routes.
export function appendAttributionToURL(
  url: string,
  gaClientId: string | null,
  gclid: string | null,
): string {
  if (!gaClientId && !gclid) {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  const extra = new URLSearchParams();
  if (gaClientId) {
    extra.set("ga_client_id", gaClientId);
  }
  if (gclid) {
    extra.set("gclid", gclid);
  }
  return `${url}${separator}${extra.toString()}`;
}

// parseCookieValue extracts a single cookie value by name from a raw cookie
// header string ("a=1; b=2; c=3"). Returns null when not present or empty.
// Value is URL-decoded. Pure: usable on either side of the network boundary.
export function parseCookieValue(
  cookieString: string | null | undefined,
  name: string,
): string | null {
  if (!cookieString) {
    return null;
  }
  const match = cookieString.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  if (!match) {
    return null;
  }
  const value = decodeURIComponent(match[1]);
  return value || null;
}

// parseGAClientID extracts the GA4 client_id from a raw _ga cookie value
// (e.g. "GA1.1.1234567890.1699999999" -> "1234567890.1699999999").
// Returns null when the value is missing or doesn't match the GA1 format.
// Pure function so server-side code (Next.js route handlers) can reuse it.
export function parseGAClientID(
  rawCookieValue: string | null | undefined,
): string | null {
  if (!rawCookieValue) {
    return null;
  }
  const parts = rawCookieValue.split(".");
  if (parts.length < 4 || parts[0] !== "GA1") {
    return null;
  }
  const clientId = parts.slice(2).join(".");
  return clientId || null;
}

export function getGAClientID(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return parseGAClientID(parseCookieValue(document.cookie, "_ga"));
}

export function captureGCLIDFromURL(): void {
  if (typeof window === "undefined") {
    return;
  }

  const gclid = new URLSearchParams(window.location.search).get("gclid");
  if (!gclid) {
    return;
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${GCLID_COOKIE_NAME}=${encodeURIComponent(gclid)}; Max-Age=${GCLID_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

export function getStoredGCLID(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return parseCookieValue(document.cookie, GCLID_COOKIE_NAME);
}
