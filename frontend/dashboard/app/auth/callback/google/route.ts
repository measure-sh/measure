import { NextResponse } from "next/server";
import { getPosthogServer } from "../../../posthog-server";
import { setCookiesFromJWT } from "../../cookie";

export const dynamic = "force-dynamic";

const origin = process?.env?.NEXT_PUBLIC_SITE_URL;
const apiOrigin = process?.env?.API_BASE_URL;
const posthog = getPosthogServer()

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const errRedirectUrl = `${origin}/auth/login?error=Could not sign in with Google`;
  const nonce = searchParams.get("nonce");
  const state = searchParams.get("state");

  const formdata = await request.formData();
  const credential = formdata.get("credential");

  let err = ""
  if (!credential) {
    err = "google login failure: no credential"
    posthog.captureException(err, {
      source: 'google_oauth_callback'
    })
    console.log(err);

    return NextResponse.redirect(errRedirectUrl, { status: 302 });
  }

  if (state && !nonce) {
    err = "google login failure: no nonce"
    posthog.captureException(err, {
      source: 'google_oauth_callback'
    })
    console.log(err);
    return NextResponse.redirect(errRedirectUrl, { status: 302 });
  }

  if (nonce && !state) {
    err = "google login failure: no state"
    posthog.captureException(err, {
      source: 'google_oauth_callback'
    })
    console.log(err);
    return NextResponse.redirect(errRedirectUrl, { status: 302 });
  }

  // Google API JavaScript client has an open issue where
  // it does not send nonce or state in its authorization
  // callback
  // See: https://github.com/google/google-api-javascript-client/issues/843
  //
  // If nonce and state, both are  empty, we consider it
  // valid and proceed for now, while keeping an eye out
  // on the user agent.
  if (!nonce && !state) {
    const headers = Object.fromEntries(request.headers);
    console.log(
      `google login warning: nonce and state both are missing, request possibly originated from Safari, check UA: ${headers["user-agent"]}`,
    );
  }

  const res = await fetch(`${apiOrigin}/auth/google`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      credential: String(credential),
      state,
      nonce,
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
