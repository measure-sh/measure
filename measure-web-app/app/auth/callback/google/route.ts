import { decodeJWT } from '@/utils/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

const apiOrigin = process?.env?.NEXT_PUBLIC_API_BASE_URL
if (!apiOrigin) {
  throw new Error(`env var "NEXT_PUBLIC_API_BASE_URL" is unset`)
}

export async function POST(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const errRedirectUrl = `${origin}/auth/login?error=Could not sign in with Google`
  const nonce = searchParams.get('nonce')
  const state = searchParams.get('state')

  if (!nonce) {
    return NextResponse.redirect(errRedirectUrl, { status: 301 })
  }

  if (!state) {
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
    return NextResponse.redirect(errRedirectUrl, { status: 302 });
  }

  const session = await res.json();
  const { payload } = decodeJWT(session.access_token);

  const redirectURL = new URL(`${origin}/${payload["team"]}/overview`);
  redirectURL.hash = `access_token=${session.access_token}&refresh_token=${session.refresh_token}&state=${session.state}`;

  return NextResponse.redirect(redirectURL, { status: 302 });
}