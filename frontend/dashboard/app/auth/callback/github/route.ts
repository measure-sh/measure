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
  const errRedirectUrl = `${origin}/auth/login?error=Could not sign in with GitHub`;

  let err = ""
  if (!code) {
    err = "GitHub login failure: no nonce"
    posthog.captureException(err, {
      source: 'github_oauth_callback'
    })
    console.log(err);
    return NextResponse.redirect(errRedirectUrl, { status: 302 });
  }

  if (!state) {
    err = "GitHub login failure: no state"
    posthog.captureException(err, {
      source: 'github_oauth_callback'
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
      err = `MCP GitHub callback failure: ${mcpRes.status}`
      posthog.captureException(err, { source: 'github_oauth_callback' })
      console.log(err);
      return NextResponse.redirect(errRedirectUrl, { status: 302 });
    }

    const mcpData = await mcpRes.json();
    return NextResponse.redirect(mcpData.redirect_url, { status: 302 });
  }

  const res = await fetch(`${apiOrigin}/auth/github`, {
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
    let body: { error?: string; details?: string } | string;
    try {
      body = await res.json();
    } catch (error) {
      posthog.captureException(error, {
        source: 'github_oauth_callback'
      })
      console.error("Error parsing GitHub login error response JSON:", error);
      body = await res.text();
    }

    if (body) {
      err = `GitHub login failure - post /auth/github returned ${res.status}. Details: ${JSON.stringify(body)}`
    } else {
      err = `GitHub login failure: post /auth/github returned ${res.status}`
    }
    posthog.captureException(err, {
      source: 'github_oauth_callback'
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
