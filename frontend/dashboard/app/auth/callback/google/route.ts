import { NextResponse } from 'next/server'
import { setCookiesFromJWT } from '../../cookie'

export const dynamic = 'force-dynamic'

const origin = process?.env?.NEXT_PUBLIC_SITE_URL
const apiOrigin = process?.env?.API_BASE_URL

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const errRedirectUrl = `${origin}/auth/login?error=Could not sign in with Google`
  const nonce = searchParams.get('nonce')
  const state = searchParams.get('state')

  const formdata = await request.formData()
  const credential = formdata.get('credential')

  if (!credential) {
    console.log("google login failure: no credential")
    return NextResponse.redirect(errRedirectUrl, { status: 302 })
  }

  if (state && !nonce) {
    console.log("google login failure: no nonce")
    return NextResponse.redirect(errRedirectUrl, { status: 302 })
  }

  if (nonce && !state) {
    console.log("google login failure: no state")
    return NextResponse.redirect(errRedirectUrl, { status: 302 })
  }

  // Google API JavaScript client has an open issue where
  // it does not send nonce or state in its authorization
  // callback
  // See: https://github.com/google/google-api-javascript-client/issues/843
  //
  // If nonce and state, both are  empty, we consider it
  // valid and proceed for now, while keeping an eye out
  // on the user agent.
  if (!nonce && !state) {
    const headers = Object.fromEntries(request.headers)
    console.log(`google login warning: nonce and state both are missing, request possibly originated from Safari, check UA: ${headers["user-agent"]}`)
  }

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
  })

  if (!res.ok) {
    console.log(`google login failure: post /auth/google returned ${res.status}`)
    return NextResponse.redirect(errRedirectUrl, { status: 302 })
  }

  const data = await res.json()

  // Create a response with redirect
  let response = NextResponse.redirect(
    // Redirect to overview page with own team Id
    new URL(`${origin}/${data.own_team_id}/overview`),
    { status: 303 }
  )

  response = setCookiesFromJWT(data.access_token, data.refresh_token, response)

  return response
}