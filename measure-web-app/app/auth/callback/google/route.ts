import { createRouteClient } from '@/utils/supabase/route'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const requestUrl = new URL(request.url)
  const errRedirectUrl = `${requestUrl.origin}/auth/login?error=Could not sign in with Google`
  const nonce = requestUrl.searchParams.get('nonce')

  if (!nonce) {
    console.log(`google oauth nonce not found`)
    return NextResponse.redirect(errRedirectUrl, { status: 301 })
  }

  const formdata = await request.formData()
  console.log({ nonce })
  console.log({ formdata })
  const credential = formdata.get('credential')
  const supabase = createRouteClient()
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: String(credential),
    nonce: nonce
  })
  console.log({ data })

  if (error) {
    console.log(error, { nonce })
    return NextResponse.redirect(errRedirectUrl, {
      // a 301 status is required to redirect from a POST to a GET route
      status: 301
    })
  }

  const accessToken = data.session.access_token

  const origin = process?.env?.NEXT_PUBLIC_API_BASE_URL

  const res = await fetch(`${origin}/teams`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`
    }
  })

  if (!res.ok) {
    console.log(`GET /teams failed during google oauth redirection returned ${res.status} response`)
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