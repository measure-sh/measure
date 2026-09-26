import { describe, expect, it } from "@jest/globals";

const mockJson = jest.fn((body: unknown, init?: ResponseInit) => ({
  body,
  init,
}));

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => mockJson(body, init),
  },
}));

import { GET } from "@/app/auth/status/route";

function makeRequest(cookieNames: string[]) {
  return {
    cookies: { has: (name: string) => cookieNames.includes(name) },
  } as any;
}

describe("Auth status route", () => {
  it("reports signed in when the refresh token cookie is present", () => {
    const res: any = GET(makeRequest(["access_token", "refresh_token"]));
    expect(res.body).toEqual({ signed_in: true });
  });

  it("reports signed in with only the refresh token cookie", () => {
    const res: any = GET(makeRequest(["refresh_token"]));
    expect(res.body).toEqual({ signed_in: true });
  });

  it("reports signed out without the refresh token cookie", () => {
    const res: any = GET(makeRequest(["access_token"]));
    expect(res.body).toEqual({ signed_in: false });
  });

  it("disables caching", () => {
    const res: any = GET(makeRequest([]));
    expect(res.init.headers).toEqual({ "Cache-Control": "no-store" });
  });
});
