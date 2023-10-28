import { createClient } from '@/utils/supabase/server'
import { NextResponse} from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const supabase = createClient()

  await supabase.auth.signOut()

  return NextResponse.redirect(`${requestUrl.origin}/auth/login`, {
    status: 301,
  })
}