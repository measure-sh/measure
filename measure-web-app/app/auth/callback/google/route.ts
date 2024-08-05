import { decodeJWT } from '@/app/utils/auth/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

const origin = process?.env?.NEXT_PUBLIC_SITE_URL
const apiOrigin = process?.env?.API_BASE_URL

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const errRedirectUrl = `${origin}/auth/login?error=Could not sign in with Google`
  const nonce = searchParams.get('nonce')
  const state = searchParams.get('state')

  if (!nonce) {
    console.log("google login failure: no nonce")
    return NextResponse.redirect(errRedirectUrl, { status: 301 })
  }

  if (!state) {
    console.log("google login failure: no state")
    return NextResponse.redirect(errRedirectUrl, { status: 301 })
  }

  const formdata = await request.formData()
  const credential = formdata.get('credential')

  const res = await fetch(`${apiOrigin}/auth/google`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      credential: String(credential),
      state,
      nonce
    })
  });

  if (!res.ok) {
    console.log(`google login failure: post /auth/google returned ${res.status}`)
    return NextResponse.redirect(errRedirectUrl, { status: 302 });
  }

  const session = await res.json();
  const { payload } = decodeJWT(session.access_token);

  const redirectURL = new URL(`${origin}/${payload["team"]}/overview`);
  redirectURL.hash = `access_token=${session.access_token}&refresh_token=${session.refresh_token}&state=${session.state}`;

  return NextResponse.redirect(redirectURL, { status: 302 });
}