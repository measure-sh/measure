import { NextResponse } from "next/server";
import { getPosthogServer } from "../../../posthog-server";
import {
  clearMcpBindingCookie,
  isOAuthState,
  readMcpBindingCookie,
  setCookiesFromJWT,
} from "../../cookie";

export const dynamic = "force-dynamic";

const origin = process.env.NEXT_PUBLIC_SITE_URL;
const apiOrigin = process.env.API_BASE_URL;
const agentOrigin = process.env.AGENT_BASE_URL;
const posthog = getPosthogServer();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errRedirectUrl = `${origin}/auth/login?error=Could not sign in with Google`;

  let err = "";
  if (!code) {
    err = "Google login failure: no code";
    posthog.captureException(err, {
      source: "google_oauth_callback",
    });
    console.log(err);
    return NextResponse.redirect(errRedirectUrl, { status: 302 });
  }

  if (!state) {
    err = "Google login failure: no state";
    posthog.captureException(err, {
      source: "google_oauth_callback",
    });
    console.log(err);
    return NextResponse.redirect(errRedirectUrl, { status: 302 });
  }

  // MCP flow: state starts with "mcp_" — forward to the MCP callback endpoint
  if (state.startsWith("mcp_")) {
    if (!agentOrigin) {
      throw new Error("AGENT_BASE_URL is not set");
    }
    const oauthState = state.slice(4);
    if (!isOAuthState(oauthState)) {
      err = "MCP Google callback failure: invalid state";
      posthog.captureException(err, { source: "google_oauth_callback" });
      console.log(err);
      return NextResponse.redirect(errRedirectUrl, { status: 302 });
    }
    const binding = readMcpBindingCookie(
      request.headers.get("cookie"),
      oauthState,
    );
    const mcpRes = await fetch(`${agentOrigin}/mcp/auth/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, state: oauthState, binding }),
    });

    if (!mcpRes.ok) {
      err = `MCP Google callback failure: ${mcpRes.status}`;
      posthog.captureException(err, { source: "google_oauth_callback" });
      console.log(err);
      return clearMcpBindingCookie(
        NextResponse.redirect(errRedirectUrl, { status: 302 }),
        oauthState,
      );
    }

    const mcpData = await mcpRes.json();
    return clearMcpBindingCookie(
      NextResponse.redirect(mcpData.redirect_url, { status: 302 }),
      oauthState,
    );
  }

  // Dashboard flow: exchange code via the backend
  if (!apiOrigin) {
    throw new Error("API_BASE_URL is not set");
  }
  const codeUrl = `${apiOrigin}/auth/google`;

  const res = await fetch(codeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "code",
      state,
      code,
    }),
  });

  if (!res.ok) {
    let body: { error?: string; details?: string } | string = "";
    try {
      body = await res.json();
    } catch (error) {
      console.error("Error parsing Google login error response JSON:", error);
      body = await res.text();
    }

    if (body) {
      err = `Google login failure - post /auth/google returned ${res.status}. Details: ${JSON.stringify(body)}`;
    } else {
      err = `Google login failure: post /auth/google returned ${res.status}`;
    }
    posthog.captureException(err, {
      source: "google_oauth_callback",
    });
    console.log(err);

    return NextResponse.redirect(errRedirectUrl, { status: 302 });
  }

  const data = await res.json();

  // Create a response with redirect
  const response = NextResponse.redirect(
    // Redirect to overview page with own team Id
    new URL(`${origin}/${data.own_team_id}/overview`),
    { status: 303 },
  );

  return setCookiesFromJWT(data.access_token, data.refresh_token, response);
}
