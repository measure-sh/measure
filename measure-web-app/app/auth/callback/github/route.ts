import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const errRedirectUrl = `${requestUrl.origin}/auth/login?error=Could not sign in with GitHub`
  const supabase = createClient()
  const cookieStore = cookies()
  const accessToken = cookieStore.get("sb-access-token");
  const refreshToken = cookieStore.get("sb-refresh-token");
  if (!accessToken) {
    console.log("access token not found in github auth callback")
    return NextResponse.redirect(errRedirectUrl, { status: 302 })
  }
  if (!refreshToken) {
    console.log("refresh token not found in github auth callback")
    return NextResponse.redirect(errRedirectUrl, { status: 302 })
  }
  const { data, error } = await supabase.auth.setSession({ access_token: accessToken?.value!, refresh_token: refreshToken?.value! })
  if (error) {
    console.log(error)
    return NextResponse.redirect(errRedirectUrl, { status: 302 })
  }

  const origin = process?.env?.NEXT_PUBLIC_API_BASE_URL

  const res = await fetch(`${origin}/teams`, {
    headers: {
      "Authorization": `Bearer ${accessToken.value}`
    }
  })
  const teams = await res.json()
  if (!teams.length) {
    console.log(`no teams found for user: ${data.user?.id}`)
    return NextResponse.redirect(errRedirectUrl, { status: 302 })
  }

  type Team = {
    teamId: string,
    name: string,
    role: string,
  }

  const ownTeam = teams.find((team: Team) => team.role === "owner")

  if (!ownTeam) {
    console.log(`user ${data.user?.id} does not own any team`)
    return NextResponse.redirect(errRedirectUrl, { status: 302 })
  }

  return NextResponse.redirect(`${requestUrl.origin}/${ownTeam.teamId}/overview`, { status: 302 })
}