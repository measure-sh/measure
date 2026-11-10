/** @jest-environment node */
import { describe, expect, it, jest } from "@jest/globals";

jest.mock("next/server", () => ({ NextResponse: {} }));

type CookieModule = typeof import("@/app/auth/cookie");

function loadCookie(env: string): CookieModule {
  const original = process.env.NODE_ENV;
  (process.env as any).NODE_ENV = env;
  let mod!: CookieModule;
  jest.isolateModules(() => {
    mod = require("@/app/auth/cookie");
  });
  (process.env as any).NODE_ENV = original;
  return mod;
}

describe("cookie helpers", () => {
  const { readMcpBindingCookie, isOAuthState, clearMcpBindingCookie } =
    loadCookie("test");

  it.each([
    ["present", "mcp_b_ab1=v1", "v1"],
    ["absent", "_ga=1", ""],
    ["value with =", "mcp_b_ab1=a=b==", "a=b=="],
    ["among others", "_ga=1; mcp_b_ab1=v1; gclid=x", "v1"],
    ["other state", "mcp_b_ab2=v2", ""],
  ])("readMcpBindingCookie %s", (_l, header, want) => {
    expect(readMcpBindingCookie(header, "ab1")).toBe(want);
  });

  it("readMcpBindingCookie handles a null header", () => {
    expect(readMcpBindingCookie(null, "ab1")).toBe("");
  });

  it.each([
    ["abc123", true],
    ["a".repeat(128), true],
    ["a".repeat(129), false],
    ["", false],
    ["ABC", false],
    ["a;Domain=x", false],
    ["a\r\nb", false],
  ])("isOAuthState(%j) = %s", (s, want) => {
    expect(isOAuthState(s)).toBe(want);
  });

  it("clear re-sets the cookie empty with maxAge 0 & the same attrs", () => {
    const set = jest.fn();
    clearMcpBindingCookie({ cookies: { set } } as any, "ab1");
    expect(set).toHaveBeenCalledWith("mcp_b_ab1", "", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  });

  it("prod uses the __Host- prefix & Secure", () => {
    const prod = loadCookie("production");
    const set = jest.fn();
    prod.clearMcpBindingCookie({ cookies: { set } } as any, "ab1");
    expect(set).toHaveBeenCalledWith(
      "__Host-mcp_b_ab1",
      "",
      expect.objectContaining({ secure: true, maxAge: 0 }),
    );
    expect(prod.readMcpBindingCookie("__Host-mcp_b_ab1=v", "ab1")).toBe("v");
  });
});
