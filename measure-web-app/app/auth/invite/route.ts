import { createAdminClient } from "@/utils/supabase/admin"
import { AuthApiError } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

type InviteReq = {
  email: string,
  teamId: string,
  role: string
}

async function authorize(accessToken: string | undefined, teamId: string, invites: { email: string, role: string }[]) {
  const url = `${process?.env?.NEXT_PUBLIC_API_BASE_URL}/teams/${teamId}/invite`
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${accessToken}`
  }

  return fetch(url, { method: "post", headers, body: JSON.stringify(invites) })
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url)
  const supabase = createAdminClient()

  const { data: { session }, error: sessionErr } = await supabase.auth.getSession()

  if (sessionErr) {
    const msg = `failed to retrieve user session`
    console.log(msg, sessionErr)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const { email, teamId, role }: InviteReq = await request.json()
  const invites = [{ email, role }]

  const res = await authorize(session?.access_token, teamId, invites)

  if (!res.ok && res.status === 403) {
    const json = await res.json()
    return NextResponse.json({ error: json.error }, { status: 403 })
  }

  if (!res.ok) {
    return NextResponse.json({ error: `failed to invite ${email}` }, { status: 500 })
  }

  const redirectUrl = `${requestUrl.origin}/${teamId}/overview`

  const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: redirectUrl,
    data: {
      invite: {
        userId: session?.user.id,
        teamId,
        role
      }
    }
  })

  if (error instanceof AuthApiError) {
    console.log(error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (error) {
    const msg = `failed to invite ${email}`
    console.log(msg, error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ ok: `invited ${email}` })
}