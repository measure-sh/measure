const GCLID_COOKIE_NAME = "gclid";
const GCLID_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

// parseCookieValue extracts a single cookie value by name from a raw cookie
// header string ("a=1; b=2; c=3"). Returns null when not present or empty.
// Value is URL-decoded.
function parseCookieValue(
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

// clearStoredGCLID expires the cookie. Called when marketing consent is
// withdrawn: the gclid may only be kept while that consent stands. Path must
// match the one captureGCLIDFromURL wrote or the browser keeps the cookie.
// No-op in SSR.
export function clearStoredGCLID(): void {
  if (typeof window === "undefined") {
    return;
  }
  document.cookie = `${GCLID_COOKIE_NAME}=; Max-Age=0; Path=/`;
}
