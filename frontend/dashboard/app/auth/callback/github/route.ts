import { measureAuth } from '@/app/auth/measure_auth'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const origin = process?.env?.NEXT_PUBLIC_SITE_URL
const apiOrigin = process?.env?.API_BASE_URL

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const errRedirectUrl = `${origin}/auth/login?error=Could not sign in with GitHub`
  if (!code) {
    console.log("github login failure: no nonce")
    return NextResponse.redirect(errRedirectUrl, { status: 302 })
  }

  if (!state) {
    console.log("github login failure: no state")
    return NextResponse.redirect(errRedirectUrl, { status: 302 })
  }

  const res = await fetch(`${apiOrigin}/auth/github`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: "code",
      state,
      code
    })
  });

  if (!res.ok) {
    console.log(`github login failure: post /auth/github returned ${res.status}`)
    return NextResponse.redirect(errRedirectUrl, { status: 302 });
  }

  const session = await res.json();
  const { payload } = measureAuth.decodeJWT(session.access_token)

  const redirectURL = new URL(`${origin}/${payload["team"]}/overview`);
  redirectURL.hash = `access_token=${session.access_token}&refresh_token=${session.refresh_token}&state=${session.state}`;

  return NextResponse.redirect(redirectURL, { status: 302 });
}