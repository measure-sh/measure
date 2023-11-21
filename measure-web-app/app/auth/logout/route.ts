import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const supabase = createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    console.log(`logout failed with error`, error)
  }

  return NextResponse.redirect(`${requestUrl.origin}/auth/login`, {
    // using temporary redirect, so that browsers don't cache this
    // redirection
    status: 302,
  })
}