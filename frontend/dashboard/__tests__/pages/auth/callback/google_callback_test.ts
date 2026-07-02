process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
process.env.API_BASE_URL = "http://localhost:8080";
process.env.AGENT_BASE_URL = "http://localhost:8084";

import { beforeAll, beforeEach, describe, expect, it } from "@jest/globals";

const mockRedirect = jest.fn((_url: string | URL, _init?: any) => ({
  status: _init?.status ?? 307,
}));

jest.mock("next/server", () => ({
  NextResponse: {
    redirect: (...args: any[]) => mockRedirect.apply(null, args),
  },
}));

jest.mock("@/app/posthog-server", () => ({
  getPosthogServer: () => ({
    captureException: jest.fn(),
  }),
}));

const mockSetCookies = jest.fn((_at: string, _rt: string, res: any) => res);
jest.mock("@/app/auth/cookie", () => ({
  setCookiesFromJWT: (...args: any[]) => mockSetCookies.apply(null, args),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

function makeRequest(params: string, cookieHeader: string | null = null) {
  return {
    url: `http://localhost:3000/auth/callback/google${params}`,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "cookie" ? cookieHeader : null,
    },
  } as unknown as Request;
}

// Silence console.log/error from the route handler during tests
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

describe("Google Callback Route", () => {
  // Dynamic import in beforeAll so the route module loads AFTER the env
  // assignments above. Static imports would be hoisted above them.
  let GET: (req: Request) => Promise<Response>;
  beforeAll(async () => {
    GET = (await import("@/app/auth/callback/google/route")).GET;
  });

  beforeEach(() => {
    mockRedirect.mockClear();
    mockSetCookies.mockClear();
    mockFetch.mockReset();
  });

  it("missing code redirects to login with error", async () => {
    await GET(makeRequest("?state=some-state"));

    expect(mockRedirect).toHaveBeenCalledTimes(1);
    const url = mockRedirect.mock.calls[0][0] as string;
    expect(url).toContain("/auth/login?error=");
    expect(mockRedirect.mock.calls[0][1]).toEqual({ status: 302 });
  });

  it("missing state redirects to login with error", async () => {
    await GET(makeRequest("?code=some-code"));

    expect(mockRedirect).toHaveBeenCalledTimes(1);
    const url = mockRedirect.mock.calls[0][0] as string;
    expect(url).toContain("/auth/login?error=");
    expect(mockRedirect.mock.calls[0][1]).toEqual({ status: 302 });
  });

  it("MCP flow: mcp_ prefix state POSTs to /mcp/auth/callback and redirects", async () => {
    const mcpRedirectUrl =
      "https://client.example.com/callback?code=mcp-code-123";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ redirect_url: mcpRedirectUrl }),
    });

    await GET(makeRequest("?code=google-code&state=mcp_xyz789"));

    // Should POST to MCP callback with state prefix stripped
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8084/mcp/auth/callback",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ code: "google-code", state: "xyz789" }),
      }),
    );

    expect(mockRedirect).toHaveBeenCalledWith(mcpRedirectUrl, { status: 302 });
  });

  it("MCP flow: backend failure redirects to login with error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 502 });

    await GET(makeRequest("?code=google-code&state=mcp_xyz789"));

    expect(mockRedirect).toHaveBeenCalledTimes(1);
    const url = mockRedirect.mock.calls[0][0] as string;
    expect(url).toContain("/auth/login?error=");
    expect(mockRedirect.mock.calls[0][1]).toEqual({ status: 302 });
  });

  it("dashboard flow: exchanges code via backend and sets cookies", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          own_team_id: "team-xyz",
          access_token: "at.eyJ0eXAiOiJKV1QifQ.test",
          refresh_token: "rt.eyJ0eXAiOiJKV1QifQ.test",
        }),
    });

    await GET(makeRequest("?code=google-code&state=dashboard-state"));

    // Should POST to /auth/google
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/auth/google",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          type: "code",
          state: "dashboard-state",
          code: "google-code",
        }),
      }),
    );

    // Should redirect to overview with 303
    expect(mockRedirect).toHaveBeenCalledTimes(1);
    const url = mockRedirect.mock.calls[0][0] as URL;
    expect(url.pathname).toBe("/team-xyz/overview");
    expect(mockRedirect.mock.calls[0][1]).toEqual({ status: 303 });

    // Should set cookies
    expect(mockSetCookies).toHaveBeenCalledWith(
      "at.eyJ0eXAiOiJKV1QifQ.test",
      "rt.eyJ0eXAiOiJKV1QifQ.test",
      expect.anything(),
    );
  });

  it("dashboard flow: backend failure redirects to login with error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "internal_error" }),
    });

    await GET(makeRequest("?code=google-code&state=dashboard-state"));

    expect(mockRedirect).toHaveBeenCalledTimes(1);
    const url = mockRedirect.mock.calls[0][0] as string;
    expect(url).toContain("/auth/login?error=");
    expect(mockRedirect.mock.calls[0][1]).toEqual({ status: 302 });
  });

  it("dashboard flow: non-JSON error response falls back to text", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("not json")),
      text: () => Promise.resolve("plain text error"),
    });

    await GET(makeRequest("?code=google-code&state=dashboard-state"));

    expect(mockRedirect).toHaveBeenCalledTimes(1);
    const url = mockRedirect.mock.calls[0][0] as string;
    expect(url).toContain("/auth/login?error=");
    expect(mockRedirect.mock.calls[0][1]).toEqual({ status: 302 });
  });

  it("dashboard flow: appends ga_client_id and gclid query params when both cookies are set", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          own_team_id: "team-xyz",
          access_token: "at",
          refresh_token: "rt",
        }),
    });

    await GET(
      makeRequest(
        "?code=google-code&state=dashboard-state",
        "_ga=GA1.1.111.222; gclid=gclid-abc",
      ),
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/auth/google?ga_client_id=111.222&gclid=gclid-abc",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          type: "code",
          state: "dashboard-state",
          code: "google-code",
        }),
      }),
    );
  });

  it("dashboard flow: appends only ga_client_id when gclid cookie is absent", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          own_team_id: "team-xyz",
          access_token: "at",
          refresh_token: "rt",
        }),
    });

    await GET(
      makeRequest(
        "?code=google-code&state=dashboard-state",
        "_ga=GA1.1.111.222",
      ),
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/auth/google?ga_client_id=111.222",
      expect.anything(),
    );
  });

  it("dashboard flow: malformed _ga cookie does not append ga_client_id", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          own_team_id: "team-xyz",
          access_token: "at",
          refresh_token: "rt",
        }),
    });

    await GET(
      makeRequest("?code=google-code&state=dashboard-state", "_ga=garbage"),
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/auth/google",
      expect.anything(),
    );
  });

  it("MCP flow: cookies do not propagate to the MCP callback URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ redirect_url: "https://client/cb" }),
    });

    await GET(
      makeRequest(
        "?code=google-code&state=mcp_xyz789",
        "_ga=GA1.1.111.222; gclid=gclid-abc",
      ),
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8084/mcp/auth/callback",
      expect.anything(),
    );
  });
});
