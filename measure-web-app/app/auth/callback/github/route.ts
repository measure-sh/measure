import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

const apiOrigin = process?.env?.NEXT_PUBLIC_API_BASE_URL
if (!apiOrigin) {
  throw new Error(`env var "NEXT_PUBLIC_API_BASE_URL" is unset`)
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const errRedirectUrl = `${origin}/auth/login?error=Could not sign in with GitHub`
  if (!code) {
    return NextResponse.redirect(errRedirectUrl, { status: 302 })
  }

  if (!state) {
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

  if (res.status !== 200) {
    return NextResponse.redirect(errRedirectUrl, { status: 302 });
  }

  const session = await res.json();

  const teamsRes = await fetch(`${apiOrigin}/teams`, {
    headers: {
      'Authorization': `Bearer ${session.access_token}`
    }
  });

  if (teamsRes.status !== 200) {
    return NextResponse.redirect(errRedirectUrl, { status: 302 });
  }

  const teams = await teamsRes.json();

  if (!teams?.length) {
    return NextResponse.redirect(errRedirectUrl, { status: 302 });
  }

  type Team = {
    id: string,
    name: string,
    role: string,
  }

  const ownTeam = teams.find((team: Team) => team.role === "owner");

  if (!ownTeam) {
    return NextResponse.redirect(errRedirectUrl, { status: 302 });
  }

  const redirectURL = new URL(`${origin}/${ownTeam.id}/overview`);
  redirectURL.hash = `access_token=${session.access_token}&refresh_token=${session.refresh_token}&expiry_at=${session.expiry_at}&state=${session.state}`;

  return NextResponse.redirect(redirectURL, { status: 302 });
}