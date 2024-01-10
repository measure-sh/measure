import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)

  return NextResponse.redirect(`${requestUrl.origin}/auth/login`, {
    // using temporary redirect, so that browsers don't cache this
    // redirection
    status: 302,
  })
}