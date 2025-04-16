import { NextResponse } from 'next/server'
import { clearCookies } from '../cookie'

export const dynamic = 'force-dynamic'

const origin = process?.env?.NEXT_PUBLIC_SITE_URL
const apiOrigin = process?.env?.API_BASE_URL

export async function DELETE(request: Request) {
    const cookies = request.headers.get('cookie')
    const headers = new Headers(request.headers)
    headers.set('cookie', cookies || '')
    const res = await fetch(`${apiOrigin}/auth/signout`, {
        method: 'DELETE',
        headers: headers
    })

    if (!res.ok) {
        console.log(`Logout failure: post /auth/signout returned ${res.status}`)
    }

    const data = await res.json()
    if (data.error) {
        console.log(`Logout failure: post /auth/signout returned ${data.error}`)
    }

    // Create a response with redirect
    let response = NextResponse.redirect(
        // Redirect to login page
        new URL(`${origin}/auth/login`),
        { status: 303 }
    )

    response = clearCookies(response)

    return response
}