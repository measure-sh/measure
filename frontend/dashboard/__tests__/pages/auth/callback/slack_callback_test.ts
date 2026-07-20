process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
process.env.API_BASE_URL = "http://localhost:8080";

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

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

function makeRequest(params: string) {
  return {
    url: `http://localhost:3000/auth/callback/slack${params}`,
  } as unknown as Request;
}

// Build a state the way the API does: base64url(JSON payload) + "." + signature.
// The dashboard only decodes the payload for its redirect, so the signature is
// irrelevant here.
function stateForTeam(teamId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ team_id: teamId, nonce: "n", exp: 9999999999 }),
  ).toString("base64url");
  return `${payload}.sig`;
}

jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

describe("Slack Callback Route", () => {
  let GET: (req: Request) => Promise<Response>;
  beforeAll(async () => {
    GET = (await import("@/app/auth/callback/slack/route")).GET;
  });

  beforeEach(() => {
    mockRedirect.mockClear();
    mockFetch.mockReset();
  });

  it("success: forwards {code, state} and redirects to the API's team", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ team_id: "team-from-api", slack_team_name: "Acme" }),
    });

    const state = stateForTeam("team-in-state");
    await GET(makeRequest(`?code=c1&state=${state}`));

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/slack/connect",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ code: "c1", state }),
      }),
    );

    // success uses the team the API actually connected, at 303
    const url = mockRedirect.mock.calls[0][0] as URL;
    expect(url.pathname).toBe("/team-from-api/team");
    expect(url.searchParams.get("success")).toContain("Acme");
    expect(mockRedirect.mock.calls[0][1]).toEqual({ status: 303 });
  });

  it("slack error with a state redirects to that team's page", async () => {
    const state = stateForTeam("team-xyz");
    await GET(makeRequest(`?error=access_denied&state=${state}`));

    expect(mockFetch).not.toHaveBeenCalled();
    const url = mockRedirect.mock.calls[0][0] as string;
    expect(url).toContain("http://localhost:3000/team-xyz/team?error=");
    expect(mockRedirect.mock.calls[0][1]).toEqual({ status: 302 });
  });

  it("slack error without a state falls back to the dashboard root", async () => {
    await GET(makeRequest(`?error=access_denied`));

    const url = mockRedirect.mock.calls[0][0] as string;
    expect(url.startsWith("http://localhost:3000?error=")).toBe(true);
    expect(url).not.toContain("/team");
  });

  it("a malformed state falls back to the dashboard root", async () => {
    // "Zm9v" decodes to "foo", which is not JSON, so the teamId is unreadable
    await GET(makeRequest(`?error=access_denied&state=Zm9v.sig`));

    const url = mockRedirect.mock.calls[0][0] as string;
    expect(url.startsWith("http://localhost:3000?error=")).toBe(true);
  });

  it("connect failure redirects to the state's team page with the error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "bad_state" }),
    });

    const state = stateForTeam("team-fail");
    await GET(makeRequest(`?code=c1&state=${state}`));

    const url = mockRedirect.mock.calls[0][0] as string;
    expect(url).toContain("http://localhost:3000/team-fail/team?error=");
    expect(url).toContain("bad_state");
    expect(mockRedirect.mock.calls[0][1]).toEqual({ status: 302 });
  });

  it("missing code (state present) redirects to the state's team page", async () => {
    const state = stateForTeam("team-nc");
    await GET(makeRequest(`?state=${state}`));

    expect(mockFetch).not.toHaveBeenCalled();
    const url = mockRedirect.mock.calls[0][0] as string;
    expect(url).toContain("http://localhost:3000/team-nc/team?error=");
  });
});
