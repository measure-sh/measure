import { encodeOAuthState, getSession, init, signout } from '@/utils/auth';
import { describe, expect, it } from '@jest/globals';

describe('getSession', () => {
  it('may return invalid session', () => {
    const { session, error } = getSession();

    expect(session).toBe(null);
    expect(error).toBeInstanceOf(Error);
  })

  it('retrieves valid session from storage', () => {
    const access_token = `${btoa(JSON.stringify({ header: { alg: "HS256", typ: "JWT" } }))}.${btoa(JSON.stringify({ exp: Math.round(Date.now() / 1000) + 3600, iat: Math.round(Date.now() / 1000), iss: "measure", sub: "742fdbac-7a12-4c5c-a5ce-96ca091cefbc" }))}`
    const refresh_token = `${btoa(JSON.stringify({ header: { alg: "HS256", typ: "JWT" } }))}.${btoa(JSON.stringify({ exp: Math.round(Date.now() / 1000) + 3600, jti: "a4d56258-718a-4fa7-9045-45696f99f30f" }))}`


    localStorage.setItem("msr-session", JSON.stringify({ access_token, refresh_token }));

    const { session, error } = getSession();

    expect(session).not.toBe(null);
    expect(error).toBe(null);
    expect(session!.access_token).toBeDefined();
    expect(session!.refresh_token).toBeDefined();
    expect(session!.user.id).toBeDefined();
  })
})

describe('signout', () => {
  it('signs out and clears session', async () => {
    const access_token = `${btoa(JSON.stringify({ header: { alg: "HS256", typ: "JWT" } }))}.${btoa(JSON.stringify({ exp: Math.round(Date.now() / 1000) + 3600, iat: Math.round(Date.now() / 1000), iss: "measure", sub: "742fdbac-7a12-4c5c-a5ce-96ca091cefbc" }))}`
    const refresh_token = `${btoa(JSON.stringify({ header: { alg: "HS256", typ: "JWT" } }))}.${btoa(JSON.stringify({ exp: Math.round(Date.now() / 1000) + 3600, jti: "a4d56258-718a-4fa7-9045-45696f99f30f" }))}`

    localStorage.setItem("msr-session", JSON.stringify({ access_token, refresh_token }));

    const sessionBefore = localStorage.getItem("msr-session");
    expect(sessionBefore).not.toBe(null);

    process.env.NEXT_PUBLIC_API_BASE_URL = "https://example.com";
    await signout();

    const session = localStorage.getItem("msr-session");
    expect(session).toBe(null);
  })
})

describe('encodeOAuthState', () => {
  it('encode oauth state', () => {
    let encoded = encodeOAuthState();

    expect(encoded).toBeDefined();
    expect(encoded).not.toBe("");

    encoded = encodeOAuthState("some/random/path/here");
    expect(encoded).toBeDefined();
    expect(encoded).not.toBe("");

  })
})

describe('init', () => {
  it('initializes auth', () => {
    expect(window.location.href).toBe("http://localhost/");
    window.history.pushState({}, '', 'http://localhost#access_token=foo&refresh_token=bar');

    init()

    const session = JSON.parse(localStorage.getItem('msr-session')!);
    expect(session!.access_token).toBe("foo");
    expect(session!.refresh_token).toBe("bar");

    expect(window.location.href).toBe("http://localhost/");
  })
})