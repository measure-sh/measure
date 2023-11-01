import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const requestUrl = new URL(request.url)
  const nonce = requestUrl.searchParams.get('nonce')

  if (nonce) {
    const formdata = await request.formData()
    const credential = formdata.get('credential')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: String(credential),
      nonce: nonce
    })

    if (error) {
      console.log(error)
      return NextResponse.redirect(
        `${requestUrl.origin}/auth/login?error=Could not sign in with Google`,
        {
          // a 301 status is required to redirect from a POST to a GET route
          status: 301,
        }
      )
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}/dashboard/overview`, { status: 301 })
}