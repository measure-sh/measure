import { NextResponse } from "next/server";
import { setCookiesFromJWT } from "../../cookie";

export const dynamic = "force-dynamic";

const origin = process?.env?.NEXT_PUBLIC_SITE_URL;
const apiOrigin = process?.env?.API_BASE_URL;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errRedirectUrl = `${origin}/auth/login?error=Could not sign in with GitHub`;

  if (!code) {
    console.log("GitHub login failure: no nonce");
    return NextResponse.redirect(errRedirectUrl, { status: 302 });
  }

  if (!state) {
    console.log("GitHub login failure: no state");
    return NextResponse.redirect(errRedirectUrl, { status: 302 });
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
      console.error("Error parsing GitHub login error response JSON:", error);
      body = await res.text();
    }

    // Check if allowlist banned this identity
    if (typeof body === "object" && body.error === "allowlist_banned") {
      console.log("GitHub login failure: allowlist banned");

      const parsedUrl = new URL(errRedirectUrl);
      if (body?.details) {
        parsedUrl.searchParams.set("message", body.details);
      }

      return NextResponse.redirect(parsedUrl.toString(), { status: 302 });
    }

    console.log(
      `GitHub login failure: post /auth/github returned ${res.status}`,
    );

    if (body) {
      console.log("github login failure res:", body);
    }

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
