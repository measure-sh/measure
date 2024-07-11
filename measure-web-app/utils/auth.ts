import { createMeasureClient } from "./measure-client";

export interface Auth {
  init(): void;
  getSession(): { session: null, error: Error } | { session: MSRSessionFull, error: null };
  signout(): Promise<void>;
}

type MSRSession = {
  access_token: string,
  refresh_token: string,
  expiry_at: string,
}

type MSRSessionFull = MSRSession & {
  user: {
    id: string
  }
}

type OAuthState = {
  random: string,
  path: string,
}

/**
 * Key used when getting or setting
 * measure session.
 */
const sessionKey = "msr-session";

const apiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * Stores a session to local storage
 * 
 * @param session measure session object
 */
const storeSession = (session: MSRSession) => {
  if (!globalThis.localStorage) {
    throw new Error("localStorage is not available");
  }

  localStorage.setItem(sessionKey, JSON.stringify(session));
}

/**
 * Load measure session from storage
 * 
 * @param key storage item key
 * @returns MSRSession | undefined
 */
const loadSession = (key: string): MSRSession | undefined => {
  if (!globalThis.localStorage) {
    throw new Error("localStorage is not available")
  }

  const value = localStorage.getItem(key);
  if (!value) {
    return
  }

  return JSON.parse(value);
}

/**
 * Decode a URL safe base64 string.
 * 
 * See: https://en.wikipedia.org/wiki/Base64#URL_applications
 */
const base64UrlDecode = (input: string) => {
  let base64 = input
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  switch (base64.length % 4) {
    case 2:
      base64 += '==';
      break;
    case 4:
      base64 += '=';
      break;
  }

  return atob(base64);
}

/**
 * Decode encoded OAuth value
 * 
 * @param input encoded oauth state string
 * @returns OAuthState
 */
const decodeOAuthState = (input: string): OAuthState => {
  return JSON.parse(base64UrlDecode(input));
}

/**
 * Probe, extract and store session info from a URL.
 * 
 * @param currURL URL to extract session from
 */
const storeSessionFromURL = (currURL: string) => {
  const url = new URL(currURL);
  let hash = url.hash;

  if (!hash.includes("access_token") && !hash.includes("refresh_token") && !hash.includes("expiry_at")) {
    return
  }

  hash = hash.substring(1);

  const params = new URLSearchParams(hash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  const expiry_at = params.get('expiry_at');
  const state = params.get('state');

  if (!access_token || !refresh_token || !expiry_at) {
    return
  }

  if (state) {
    const { path } = decodeOAuthState(state);
    if (path != "") {
      url.pathname = path
    }
  }

  storeSession({ access_token, refresh_token, expiry_at });
  url.hash = '';
  history.replaceState(null, '', url);
}

/**
 * Encode a string into URL safe base64.
 * 
 * See: https://en.wikipedia.org/wiki/Base64#URL_applications
 */
const base64UrlEncode = (input: string) => {
  let base64 = btoa(input);
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate a random string of len bytes.
 * 
 * @param len size of bytes to generate
 * @returns string
 */
const getRandomValues = (len: number) => {
  const arr = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(arr, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Decode a JWT token
 * 
 * @param token access or refresh token string
 * @returns object
 */
const decodeJWT = (token: string) => {
  const [encodedHeader, encodedPayload] = token.split('.');
  const header = JSON.parse(atob(encodedHeader));
  const payload = JSON.parse(atob(encodedPayload));

  return { header, payload }
}

/**
 * Validate JWT header and expiration
 * 
 * @param token JWT string
 * @returns bool
 */
const validateJWT = (token: string) => {
  const { header, payload } = decodeJWT(token);
  const now = Math.round(Date.now() / 1000);
  return header.alg === 'HS256' && header.typ === 'JWT' && now <= payload.exp;
}

/**
 * Checks if a token should be refreshed
 * if token is going to expire within 5 mins.
 * 
 * @param token JWT token string
 * @returns bool
 */
const needsRefresh = (token: string) => {
  const { payload: { exp } } = decodeJWT(token);
  const now = Math.round(Date.now() / 1000);
  return exp < now + 5 * 60;
}

/**
 * Get existing stored session.
 * 
 * @returns { MSRSessionFull, Error | null }
 */
export const getSession = () => {
  let error = null;

  if (!globalThis.localStorage) {
    error = new Error("localStorage is not available");
    return { session: null, error };
  }

  let serialized = localStorage.getItem(sessionKey)
  if (!serialized) {
    error = new Error("session not available");
    return { session: null, error };
  }

  let session: MSRSessionFull;

  try {
    session = JSON.parse(serialized);
  } catch (e) {
    throw new Error("failed to parse session");
  }

  const { payload } = decodeJWT(session.access_token);
  session.user = {
    id: payload["sub"]
  };

  return { session, error: null };
}

/**
 * Remove session from browser
 * storage.
 * 
 * @returns void
 */
const clearSession = () => {
  if (!globalThis.localStorage) {
    return
  }

  localStorage.removeItem(sessionKey);
}

/**
 * Sign out active session from
 * backend and clear local session.
 * 
 * @returns Promise
 */
export const signout = async () => {
  const session = loadSession(sessionKey);
  if (!session) {
    return
  }

  if (validateJWT(session.refresh_token)) {
    const client = createMeasureClient(process.env.NEXT_PUBLIC_API_BASE_URL);
    await client.signout(session.refresh_token);
  }

  clearSession();
}

/**
 * Refresh active session.
 * 
 * @returns Promise
 */
const refreshSession = async (): Promise<MSRSession> => {
  const session = loadSession(sessionKey);
  if (!session) {
    throw new Error("couldn't retrive session");
  }

  const res = await fetch(`${apiOrigin}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.refresh_token}`
    }
  });

  if (!res.ok) {
    throw new Error("failed to refresh session");
  }

  const data = await res.json();
  storeSession(data);
  return data;
}

/**
 * Initialize auth module
 */
export const init = () => {
  if (globalThis.window) {
    storeSessionFromURL(window.location.href);
  }
}

/**
 * Creates a random state string to protect against cross-
 * site request forgery attacks. The optional path is
 * encoded into the generated string for redirecting
 * to after successful authentication.
 * 
 * See: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
 * 
 * @param path Optional next path to encode in the state
 */
export const encodeOAuthState = (path: URL | string = "") => {
  const state = {
    random: getRandomValues(32),
    path
  };

  const json = JSON.stringify(state);
  return base64UrlEncode(json);
}

/**
 * Proxied fetch to automatically refresh sessions
 * if expired.
 */
export const fetchAuth = new Proxy(fetch.bind(globalThis), {
  async apply(target, thisArg, argArray) {
    let session = loadSession(sessionKey);
    if (!session) {
      throw new Error("couldn't retrieve session");
    }
    if (needsRefresh(session.access_token)) {
      try {
        session = await refreshSession();
      } catch (e) {
        console.error("Session refresh failed:", e);
        clearSession();
        if (window && 'location' in window) {
          window.location.assign("/auth/login");
        }
      }
    }

    const [resource, config] = argArray;
    const newConfig = {
      ...config,
      headers: {
        ...config?.headers,
        'Authorization': `Bearer ${session.access_token}`
      }
    };

    return target.call(thisArg, resource, newConfig);
  }
})

export const auth: Auth = { getSession, signout, init };