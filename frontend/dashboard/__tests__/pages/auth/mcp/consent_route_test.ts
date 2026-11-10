/** @jest-environment node */
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
process.env.AGENT_BASE_URL = "http://localhost:8084";

import type { NextResponse } from "next/server";
import { beforeAll, beforeEach, describe, expect, it } from "@jest/globals";

const mockFetch = jest.fn();
global.fetch = mockFetch as any;
jest.spyOn(console, "error").mockImplementation(() => {});

const params = {
  response_type: "code",
  client_id: "https://client.example.com/meta.json",
  redirect_uri: "http://localhost:9999/cb",
  state: "client-state",
  code_challenge: "challenge",
  resource: "https://agent.example.com/mcp",
};

function makeRequest(
  fields: Record<string, string>,
  origin: string | null = "http://localhost:3000",
) {
  const headers: Record<string, string> = {};
  if (origin !== null) {
    headers.origin = origin;
  }
  return new Request("http://localhost:3000/auth/mcp/consent", {
    method: "POST",
    headers,
    body: new URLSearchParams({ ...params, ...fields }),
  });
}

function agentReplies(ok: boolean, body: object) {
  mockFetch.mockResolvedValueOnce({ ok, json: () => Promise.resolve(body) });
}

describe("MCP consent route", () => {
  let POST: (req: Request) => Promise<Response>;
  beforeAll(async () => {
    POST = (await import("@/app/auth/mcp/consent/route")).POST;
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it.each([
    ["foreign", "https://evil.example.com"],
    ["missing", null],
    ["null", "null"],
  ])("rejects a %s origin with 403", async (_label, origin) => {
    const res = await POST(
      makeRequest({ decision: "allow", provider: "github" }, origin),
    );

    expect(res.status).toBe(403);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each([
    [{ decision: "maybe", provider: "github" }],
    [{ decision: "allow", provider: "gitlab" }],
    [{ decision: "allow" }],
  ])("rejects bad input %j with 400", async (fields) => {
    const res = await POST(makeRequest(fields));

    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("approve calls the agent, sets the binding cookie & redirects to the provider", async () => {
    agentReplies(true, {
      provider_url: "https://github.com/login/oauth/authorize?x=1",
      oauth_state: "ab123",
      binding: "bind-abc",
    });

    const res = await POST(
      makeRequest({ decision: "allow", provider: "google" }),
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8084/oauth/authorize/approve",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ ...params, provider: "google" }),
      }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "https://github.com/login/oauth/authorize?x=1",
    );
    const cookie = (res as NextResponse).cookies.get("mcp_b_ab123");
    expect(cookie).toMatchObject({
      value: "bind-abc",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
  });

  it.each([["a;Domain=x"], ["a\r\nb"], ["ABC"], [42]])(
    "approve with non-hex oauth_state %j redirects with error & no cookie",
    async (oauth_state) => {
      agentReplies(true, {
        provider_url: "https://github.com/login/oauth/authorize?x=1",
        oauth_state,
        binding: "bind-abc",
      });

      const res = await POST(
        makeRequest({ decision: "allow", provider: "github" }),
      );

      expect(res.status).toBe(303);
      const url = new URL(res.headers.get("location") as string);
      expect(url.pathname).toBe("/auth/mcp/authorize");
      expect(url.searchParams.get("error")).toBe("1");
      expect((res as NextResponse).cookies.getAll()).toEqual([]);
    },
  );

  it("deny redirects to the client redirect_url", async () => {
    agentReplies(true, {
      redirect_url: "http://localhost:9999/cb?error=denied",
    });

    const res = await POST(makeRequest({ decision: "deny" }));

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8084/oauth/authorize/deny",
      expect.objectContaining({ body: JSON.stringify(params) }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "http://localhost:9999/cb?error=denied",
    );
  });

  it("agent error redirects to the page with error=1", async () => {
    agentReplies(false, { error: "bad" });

    const res = await POST(
      makeRequest({ decision: "allow", provider: "github" }),
    );

    expect(res.status).toBe(303);
    const url = new URL(res.headers.get("location") as string);
    expect(url.pathname).toBe("/auth/mcp/authorize");
    expect(url.searchParams.get("error")).toBe("1");
    expect(url.searchParams.get("client_id")).toBe(params.client_id);
  });
});
