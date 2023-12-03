import { createRouteClient } from '@/utils/supabase/route'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const errRedirectUrl = `${requestUrl.origin}/auth/login?err=Could not authenticate with email`
  const code = requestUrl.searchParams.get('code')

  if (!code) {
    console.log("email signin redirection failed, no code found")
    return NextResponse.redirect(errRedirectUrl, { status: 302 })
  }

  const supabase = createRouteClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.log("email signin code exchange failed with error", error)
    return NextResponse.redirect(errRedirectUrl, { status: 302 })
  }

  const accessToken = data.session.access_token

  const origin = process?.env?.NEXT_PUBLIC_API_BASE_URL

  const res = await fetch(`${origin}/teams`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`
    }
  })

  if (!res.ok) {
    console.log(`GET /teams failed during email signin redirection returned ${res.status} response`)
    return NextResponse.redirect(errRedirectUrl, { status: 302 })
  }

  const teams = await res.json()
  if (!teams.length) {
    console.log(`no teams found for user: ${data.user?.id}`)
    return NextResponse.redirect(errRedirectUrl, { status: 302 })
  }

  type Team = {
    id: string,
    name: string,
    role: string,
  }

  const ownTeam = teams.find((team: Team) => team.role === "owner")

  if (!ownTeam) {
    console.log(`user ${data.user?.id} does not own any team`)
    return NextResponse.redirect(errRedirectUrl, { status: 302 })
  }

  return NextResponse.redirect(`${requestUrl.origin}/${ownTeam.id}/overview`, { status: 302 })
}