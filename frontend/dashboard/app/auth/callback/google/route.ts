import { NextResponse } from "next/server";
import { getPosthogServer } from "../../../posthog-server";
import { setCookiesFromJWT } from "../../cookie";

export const dynamic = "force-dynamic";

const origin = process?.env?.NEXT_PUBLIC_SITE_URL;
const apiOrigin = process?.env?.API_BASE_URL;
const posthog = getPosthogServer()

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errRedirectUrl = `${origin}/auth/login?error=Could not sign in with Google`;

  let err = ""
  if (!code) {
    err = "Google login failure: no code"
    posthog.captureException(err, {
      source: 'google_oauth_callback'
    })
    console.log(err);
    return NextResponse.redirect(errRedirectUrl, { status: 302 });
  }

  if (!state) {
    err = "Google login failure: no state"
    posthog.captureException(err, {
      source: 'google_oauth_callback'
    })
    console.log(err);
    return NextResponse.redirect(errRedirectUrl, { status: 302 });
  }

  // MCP flow: state starts with "mcp_" — forward to the MCP callback endpoint
  if (state.startsWith("mcp_")) {
    const mcpRes = await fetch(`${apiOrigin}/mcp/auth/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, state: state.slice(4) }),
    });

    if (!mcpRes.ok) {
      err = `MCP Google callback failure: ${mcpRes.status}`
      posthog.captureException(err, { source: 'google_oauth_callback' })
      console.log(err);
      return NextResponse.redirect(errRedirectUrl, { status: 302 });
    }

    const mcpData = await mcpRes.json();
    return NextResponse.redirect(mcpData.redirect_url, { status: 302 });
  }

  // Dashboard flow: exchange code via the backend
  const res = await fetch(`${apiOrigin}/auth/google`, {
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

    // Check if allowlist banned this identity
    if (typeof body === "object" && body.error === "allowlist_banned") {
      err = "Google login failure: allowlist banned"
      posthog.captureException(err, {
        source: 'google_oauth_callback'
      })
      console.log(err);

      const parsedUrl = new URL(errRedirectUrl);
      if (body?.details) {
        parsedUrl.searchParams.set("message", body.details);
      }

      return NextResponse.redirect(parsedUrl.toString(), { status: 302 });
    }

    if (body) {
      err = `Google login failure - post /auth/google returned ${res.status}. Details: ${JSON.stringify(body)}`
    } else {
      err = `Google login failure: post /auth/google returned ${res.status}`
    }
    posthog.captureException(err, {
      source: 'google_oauth_callback'
    })
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
