import { createRouteClient } from '@/utils/supabase/route'
import { NextResponse } from 'next/server'
import { syncSupabaseUserToMeasureServerFromServer } from '@/utils/supabase/sync_user_server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const errRedirectUrl = `${origin}/auth/login?error=Could not sign in with GitHub`
  if (!code) {
    return NextResponse.redirect(errRedirectUrl)
  }
  const supabase = createRouteClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(errRedirectUrl)
  }
  const { data: { session }, error: sessionErr } = await supabase.auth.getSession()
  if (sessionErr) {
    return NextResponse.redirect(errRedirectUrl)
  }
  const accessToken = session?.access_token
  const refreshToken = session?.refresh_token

  if (!accessToken || !refreshToken) {
    return NextResponse.redirect(errRedirectUrl)
  }

  const userCreationRes = await syncSupabaseUserToMeasureServerFromServer()
  if (!userCreationRes.ok) {
    return NextResponse.redirect(errRedirectUrl, { status: 302 })
  }

  const apiOrigin = process?.env?.NEXT_PUBLIC_API_BASE_URL

  const res = await fetch(`${apiOrigin}/teams`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`
    }
  })

  const teams = await res.json()
  if (!teams?.length) {
    return NextResponse.redirect(errRedirectUrl, { status: 302 })
  }

  type Team = {
    id: string,
    name: string,
    role: string,
  }

  const ownTeam = teams.find((team: Team) => team.role === "owner")

  if (!ownTeam) {
    return NextResponse.redirect(errRedirectUrl, { status: 302 })
  }

  return NextResponse.redirect(`${origin}/${ownTeam.id}/overview`, { status: 302 })
}