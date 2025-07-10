import { NextResponse } from "next/server"

export function setCookiesFromJWT(accessToken: string, refreshToken: string, response: NextResponse<any>): NextResponse<any> {
    // Decode the access token to extract the expiry
    const accessTokenPayload = JSON.parse(
        Buffer.from(accessToken.split('.')[1], 'base64').toString()
    )
    const accessExp = new Date(accessTokenPayload.exp * 1000)

    // Decode the refresh token to extract the expiry
    const refreshTokenPayload = JSON.parse(
        Buffer.from(refreshToken.split('.')[1], 'base64').toString()
    )
    const refreshExp = new Date(refreshTokenPayload.exp * 1000)

    // extract the domain from the NEXT_PUBLIC_SITE_URL
    // and set it as the domain for the cookies
    const domain = new URL(process.env.NEXT_PUBLIC_SITE_URL!).hostname

    const isDev = process.env.NODE_ENV === 'development'

    response.cookies.set('access_token', accessToken, {
        path: '/',
        domain: domain,
        maxAge: Math.floor((accessExp.getTime() - Date.now()) / 1000),
        httpOnly: true,
        secure: !isDev,
        sameSite: isDev ? 'lax' : 'lax',
    })

    response.cookies.set('refresh_token', refreshToken, {
        path: '/',
        domain: domain,
        maxAge: Math.floor((refreshExp.getTime() - Date.now()) / 1000),
        httpOnly: true,
        secure: !isDev,
        sameSite: isDev ? 'lax' : 'lax',
    })

    return response
}

export function clearCookies(response: NextResponse<any>): NextResponse<any> {
    // extract the domain from the NEXT_PUBLIC_SITE_URL
    // and set it as the domain for the cookies
    const domain = new URL(process.env.NEXT_PUBLIC_SITE_URL!).hostname

    const isDev = process.env.NODE_ENV === 'development'

    response.cookies.set('access_token', '', {
        path: '/',
        domain: domain,
        maxAge: -1,
        httpOnly: true,
        secure: !isDev,
        sameSite: isDev ? 'lax' : 'lax',
    })

    response.cookies.set('refresh_token', '', {
        path: '/',
        domain: domain,
        maxAge: -1,
        httpOnly: true,
        secure: !isDev,
        sameSite: isDev ? 'lax' : 'lax',
    })

    return response

}
