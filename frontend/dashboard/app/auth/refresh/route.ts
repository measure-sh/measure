import { NextResponse } from "next/server";
import { getPosthogServer } from "../../posthog-server";
import { setCookiesFromJWT } from "../cookie";

export const dynamic = "force-dynamic";

const origin = process?.env?.NEXT_PUBLIC_SITE_URL;
const apiOrigin = process?.env?.API_BASE_URL;

const posthog = getPosthogServer();

const errRedirectUrl = `${origin}/auth/login`;

export async function POST(request: Request) {
  const cookies = request.headers.get("cookie");
  const headers = new Headers(request.headers);
  headers.set("cookie", cookies || "");
  const res = await fetch(`${apiOrigin}/auth/refresh`, {
    method: "POST",
    headers: headers,
  });

  let err = ""
  if (!res.ok) {
    err = `Refresh token failure: post /auth/refresh returned ${res.status}`
    posthog.captureException(err, {
      source: 'refresh_token'
    });
    console.log(err);
    return NextResponse.redirect(errRedirectUrl, { status: 302 });
  }

  const data = await res.json();
  if (data.error) {
    err = `Refresh token failure: post /auth/refresh returned ${data.error}`
    posthog.captureException(err, {
      source: 'refresh_token'
    });
    console.log(err);
    return NextResponse.redirect(errRedirectUrl, { status: 302 });
  }

  let response = NextResponse.json(
    {
      ok: true,
    },
    {
      status: 200,
    },
  );

  return setCookiesFromJWT(data.access_token, data.refresh_token, response);
}
