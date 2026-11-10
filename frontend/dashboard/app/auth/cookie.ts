import { NextResponse } from "next/server";

function isDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function setCookiesFromJWT(
  accessToken: string,
  refreshToken: string,
  response: NextResponse<any>,
): NextResponse<any> {
  const dev = isDev();

  // Decode the access token to extract the expiry
  const accessTokenPayload = JSON.parse(
    Buffer.from(accessToken.split(".")[1], "base64").toString(),
  );
  const accessExp = new Date(accessTokenPayload.exp * 1000);

  // Decode the refresh token to extract the expiry
  const refreshTokenPayload = JSON.parse(
    Buffer.from(refreshToken.split(".")[1], "base64").toString(),
  );
  const refreshExp = new Date(refreshTokenPayload.exp * 1000);

  response.cookies.set("access_token", accessToken, {
    path: "/",
    maxAge: Math.floor((accessExp.getTime() - Date.now()) / 1000),
    httpOnly: true,
    secure: !dev,
    sameSite: dev ? "lax" : "strict",
  });

  response.cookies.set("refresh_token", refreshToken, {
    path: "/",
    maxAge: Math.floor((refreshExp.getTime() - Date.now()) / 1000),
    httpOnly: true,
    secure: !dev,
    sameSite: dev ? "lax" : "strict",
  });

  return response;
}

const mcpBindingMaxAge = 600;

// isOAuthState reports whether s is a lowercase hex agent oauth_state. Gate every cookie name built from untrusted input on it.
export function isOAuthState(s: string): boolean {
  return /^[0-9a-f]{1,128}$/.test(s);
}

// mcpBindingCookieName returns the binding cookie name for oauthState. Prod adds the __Host- prefix & dev omits it since __Host- requires Secure
export function mcpBindingCookieName(oauthState: string): string {
  return `${isDev() ? "" : "__Host-"}mcp_b_${oauthState}`;
}

function mcpBindingCookieAttrs(maxAge: number) {
  return {
    httpOnly: true,
    secure: !isDev(),
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

// setMcpBindingCookie sets the binding cookie for oauthState with a 10 minute lifetime.
export function setMcpBindingCookie(
  response: NextResponse<any>,
  oauthState: string,
  binding: string,
): NextResponse<any> {
  response.cookies.set(
    mcpBindingCookieName(oauthState),
    binding,
    mcpBindingCookieAttrs(mcpBindingMaxAge),
  );
  return response;
}

// clearMcpBindingCookie expires the binding cookie by re-setting it empty with maxAge 0. Not cookies.delete(), which drops Secure so browsers reject it for __Host- cookies.
export function clearMcpBindingCookie(
  response: NextResponse<any>,
  oauthState: string,
): NextResponse<any> {
  response.cookies.set(
    mcpBindingCookieName(oauthState),
    "",
    mcpBindingCookieAttrs(0),
  );
  return response;
}

// readMcpBindingCookie returns the binding cookie value for oauthState from a Cookie header, or "" when absent
export function readMcpBindingCookie(
  cookieHeader: string | null,
  oauthState: string,
): string {
  const name = mcpBindingCookieName(oauthState);
  for (const part of (cookieHeader ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return rest.join("=");
    }
  }
  return "";
}
