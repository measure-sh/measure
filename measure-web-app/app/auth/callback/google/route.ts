import { createRouteClient } from '@/utils/supabase/route'
import { NextResponse } from 'next/server'
import { syncSupabaseUserToMeasureServerFromServer } from '@/utils/supabase/sync_user_server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const requestUrl = new URL(request.url)
  const errRedirectUrl = `${requestUrl.origin}/auth/login?error=Could not sign in with Google`
  const nonce = requestUrl.searchParams.get('nonce')

  if (!nonce) {
    return NextResponse.redirect(errRedirectUrl, { status: 301 })
  }

  const formdata = await request.formData()
  const credential = formdata.get('credential')
  const supabase = createRouteClient()
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: String(credential),
    nonce: nonce
  })

  if (error) {
    return NextResponse.redirect(errRedirectUrl, {
      // a 301 status is required to redirect from a POST to a GET route
      status: 301
    })
  }

  const accessToken = data.session.access_token

  const userCreationRes = await syncSupabaseUserToMeasureServerFromServer()
  if (!userCreationRes.ok) {
    return NextResponse.redirect(errRedirectUrl, { status: 302 })
  }

  const origin = process?.env?.NEXT_PUBLIC_API_BASE_URL

  const res = await fetch(`${origin}/teams`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`
    }
  })

  if (!res.ok) {
    return NextResponse.redirect(errRedirectUrl, { status: 302 })
  }

  const teams = await res.json()
  if (!teams.length) {
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

  return NextResponse.redirect(`${requestUrl.origin}/${ownTeam.id}/overview`, { status: 302 })
}