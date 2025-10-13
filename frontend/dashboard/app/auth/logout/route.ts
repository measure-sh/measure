import { NextResponse } from "next/server";
import { getPosthogServer } from "../../posthog-server";

export const dynamic = "force-dynamic"

const origin = process?.env?.NEXT_PUBLIC_SITE_URL
const apiOrigin = process?.env?.API_BASE_URL

const posthog = getPosthogServer()

export async function DELETE(request: Request) {
  const cookies = request.headers.get("cookie")
  const headers = new Headers(request.headers)
  headers.set("cookie", cookies || "")
  const res = await fetch(`${apiOrigin}/auth/signout`, {
    method: "DELETE",
    headers: headers,
  })

  let err = ""
  if (!res.ok) {
    err = `Logout failure: post /auth/signout returned ${res.status}`
    posthog.captureException(err, {
      source: 'logout'
    })
    console.log(err)
  }

  const data = await res.json()
  if (data.error) {
    err = `Logout failure: post /auth/signout returned ${data.error}`
    posthog.captureException(err, {
      source: 'logout'
    })
    console.log(err)
  }

  // Create a response with redirect
  let response = NextResponse.redirect(
    // Redirect to login page
    new URL(`${origin}/auth/login`),
    { status: 303 },
  )

  response.cookies.delete("access_token")
  response.cookies.delete("refresh_token")

  return response
}
