import { createRouteClient } from '@/utils/supabase/route'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const errRedirectUrl = `${origin}/auth/login?error=Could not sign in with GitHub`
  if (!code) {
    console.log(`github signin failed, code was not received`)
    return NextResponse.redirect(errRedirectUrl)
  }
  const supabase = createRouteClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.log(`github signin route handler failed with error`, error)
    return NextResponse.redirect(errRedirectUrl)
  }
  const { data: { session }, error: sessionErr } = await supabase.auth.getSession()
  if (sessionErr) {
    console.log(`github signin failed with error`, sessionErr)
    return NextResponse.redirect(errRedirectUrl)
  }
  const accessToken = session?.access_token
  const refreshToken = session?.refresh_token

  if (!accessToken || !refreshToken) {
    return NextResponse.redirect(errRedirectUrl)
  }

  const { error: setSessionErr } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })

  if (setSessionErr) {
    console.log("failed to set session in github signin callback", setSessionErr)
  }

  const apiOrigin = process?.env?.NEXT_PUBLIC_API_BASE_URL

  const res = await fetch(`${apiOrigin}/teams`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`
    }
  })

  const teams = await res.json()
  if (!teams.length) {
    console.log(`no teams found for user: ${session?.user?.id}`)
    return NextResponse.redirect(errRedirectUrl, { status: 302 })
  }

  type Team = {
    id: string,
    name: string,
    role: string,
  }

  const ownTeam = teams.find((team: Team) => team.role === "owner")

  if (!ownTeam) {
    console.log(`user ${session?.user?.id} does not own any team`)
    return NextResponse.redirect(errRedirectUrl, { status: 302 })
  }

  return NextResponse.redirect(`${origin}/${ownTeam.id}/overview`, { status: 302 })
}