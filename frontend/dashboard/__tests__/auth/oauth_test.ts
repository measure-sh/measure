import { beforeEach, describe, expect, it } from "@jest/globals";

import { encodeOAuthState, signInWithGitHub } from "@/app/auth/oauth";

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

function base64UrlDecode(input: string): string {
  const padded =
    input.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (input.length % 4)) % 4);
  return atob(padded);
}

describe("encodeOAuthState", () => {
  it("encodes a JSON object with random + path as base64url", () => {
    const encoded = encodeOAuthState("/some/path");
    const decoded = JSON.parse(base64UrlDecode(encoded));

    expect(typeof decoded.random).toBe("string");
    expect(decoded.random).toHaveLength(64); // 32 bytes hex-encoded
    expect(decoded.path).toBe("/some/path");
  });

  it("defaults path to empty string", () => {
    const encoded = encodeOAuthState();
    const decoded = JSON.parse(base64UrlDecode(encoded));

    expect(decoded.path).toBe("");
  });

  it("produces a different random value on each call", () => {
    const a = encodeOAuthState();
    const b = encodeOAuthState();
    expect(a).not.toBe(b);
  });

  it("returns base64url (no +/= chars)", () => {
    const encoded = encodeOAuthState("/x");
    expect(encoded).not.toMatch(/[+/=]/);
  });
});

describe("signInWithGitHub", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("throws when clientId is missing", async () => {
    await expect(
      signInWithGitHub({
        clientId: undefined,
        options: { redirectTo: "http://x/cb", next: "" },
      }),
    ).rejects.toThrow("`clientId` is required");
  });

  it("POSTs init to /api/auth/github and returns a GitHub OAuth url on success", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({}),
    });

    const result = await signInWithGitHub({
      clientId: "gh-client",
      options: {
        redirectTo: "https://app.example/auth/callback/github",
        next: "/after-login",
      },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/auth/github",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.any(String),
      }),
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.type).toBe("init");
    expect(typeof body.state).toBe("string");
    expect(body.state.length).toBeGreaterThan(0);

    expect(result.error).toBeUndefined();
    expect(result.url).toBeInstanceOf(URL);
    const url = result.url!;
    expect(url.origin + url.pathname).toBe(
      "https://github.com/login/oauth/authorize",
    );
    expect(url.searchParams.get("scope")).toBe("user:email read:user");
    expect(url.searchParams.get("client_id")).toBe("gh-client");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.example/auth/callback/github",
    );
    expect(url.searchParams.get("state")).toBe(body.state);
  });

  it("returns a 400 error without a url", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 400,
      json: async () => ({ error: "invalid scope" }),
    });

    const result = await signInWithGitHub({
      clientId: "gh-client",
      options: { redirectTo: "http://x/cb", next: "" },
    });

    expect(result.url).toBeUndefined();
    expect(result.error?.message).toBe("Bad request: invalid scope");
  });

  it("returns a 401 error without a url", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 401,
      json: async () => ({ error: "denied" }),
    });

    const result = await signInWithGitHub({
      clientId: "gh-client",
      options: { redirectTo: "http://x/cb", next: "" },
    });

    expect(result.url).toBeUndefined();
    expect(result.error?.message).toBe("Unauthorized: denied");
  });

  it("embeds the `next` path inside the OAuth state", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({}),
    });

    await signInWithGitHub({
      clientId: "gh-client",
      options: {
        redirectTo: "http://x/cb",
        next: "/team/abc/overview",
      },
    });

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const padded =
      sentBody.state.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (sentBody.state.length % 4)) % 4);
    const decoded = JSON.parse(atob(padded));
    expect(decoded.path).toBe("/team/abc/overview");
  });
});
