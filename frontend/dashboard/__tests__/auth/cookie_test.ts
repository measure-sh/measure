import { beforeEach, afterEach, describe, expect, it } from '@jest/globals'

// Build a minimal NextResponse mock that tracks cookie set calls
type CookieSetCall = { name: string; value: string; options: Record<string, any> }

function createMockResponse() {
    const setCalls: CookieSetCall[] = []
    return {
        cookies: {
            set: (name: string, value: string, options: Record<string, any>) => {
                setCalls.push({ name, value, options })
            },
        },
        _setCalls: setCalls,
    }
}

jest.mock('next/server', () => ({}))

import { setCookiesFromJWT } from '@/app/auth/cookie'

// Helper: create a minimal JWT with a given exp (seconds since epoch)
function makeJWT(exp: number): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64')
    const payload = Buffer.from(JSON.stringify({ exp })).toString('base64')
    return `${header}.${payload}.signature`
}

describe('setCookiesFromJWT', () => {
    const originalEnv = process.env.NODE_ENV

    afterEach(() => {
        process.env.NODE_ENV = originalEnv
    })

    it('sets access_token and refresh_token cookies', () => {
        const now = Math.floor(Date.now() / 1000)
        const accessExp = now + 3600 // 1 hour
        const refreshExp = now + 86400 // 1 day

        const accessToken = makeJWT(accessExp)
        const refreshToken = makeJWT(refreshExp)
        const response = createMockResponse()

        setCookiesFromJWT(accessToken, refreshToken, response as any)

        expect(response._setCalls).toHaveLength(2)
        expect(response._setCalls[0].name).toBe('access_token')
        expect(response._setCalls[0].value).toBe(accessToken)
        expect(response._setCalls[1].name).toBe('refresh_token')
        expect(response._setCalls[1].value).toBe(refreshToken)
    })

    it('sets httpOnly and path on both cookies', () => {
        const now = Math.floor(Date.now() / 1000)
        const accessToken = makeJWT(now + 3600)
        const refreshToken = makeJWT(now + 86400)
        const response = createMockResponse()

        setCookiesFromJWT(accessToken, refreshToken, response as any)

        for (const call of response._setCalls) {
            expect(call.options.httpOnly).toBe(true)
            expect(call.options.path).toBe('/')
        }
    })

    it('calculates maxAge from token expiry', () => {
        const now = Math.floor(Date.now() / 1000)
        const accessExp = now + 3600
        const refreshExp = now + 86400

        const accessToken = makeJWT(accessExp)
        const refreshToken = makeJWT(refreshExp)
        const response = createMockResponse()

        setCookiesFromJWT(accessToken, refreshToken, response as any)

        const accessMaxAge = response._setCalls[0].options.maxAge
        const refreshMaxAge = response._setCalls[1].options.maxAge

        // maxAge should be approximately the time until expiry (within 5s tolerance for test execution)
        expect(accessMaxAge).toBeGreaterThan(3590)
        expect(accessMaxAge).toBeLessThanOrEqual(3600)

        expect(refreshMaxAge).toBeGreaterThan(86390)
        expect(refreshMaxAge).toBeLessThanOrEqual(86400)
    })

    it('uses secure: false and sameSite: lax in development', () => {
        process.env.NODE_ENV = 'development'

        const now = Math.floor(Date.now() / 1000)
        const accessToken = makeJWT(now + 3600)
        const refreshToken = makeJWT(now + 86400)
        const response = createMockResponse()

        setCookiesFromJWT(accessToken, refreshToken, response as any)

        for (const call of response._setCalls) {
            expect(call.options.secure).toBe(false)
            expect(call.options.sameSite).toBe('lax')
        }
    })

    it('uses secure: true and sameSite: strict in production', () => {
        process.env.NODE_ENV = 'production'

        const now = Math.floor(Date.now() / 1000)
        const accessToken = makeJWT(now + 3600)
        const refreshToken = makeJWT(now + 86400)
        const response = createMockResponse()

        setCookiesFromJWT(accessToken, refreshToken, response as any)

        for (const call of response._setCalls) {
            expect(call.options.secure).toBe(true)
            expect(call.options.sameSite).toBe('strict')
        }
    })

    it('returns the response object', () => {
        const now = Math.floor(Date.now() / 1000)
        const accessToken = makeJWT(now + 3600)
        const refreshToken = makeJWT(now + 86400)
        const response = createMockResponse()

        const result = setCookiesFromJWT(accessToken, refreshToken, response as any)

        expect(result).toBe(response)
    })

    it('decodes the correct payload from a 3-part JWT', () => {
        // Create a JWT with specific extra claims to verify payload decoding
        const now = Math.floor(Date.now() / 1000)
        const accessPayload = { exp: now + 1800, sub: 'user-123', role: 'admin' }
        const refreshPayload = { exp: now + 604800, sub: 'user-123', type: 'refresh' }

        const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64')
        const accessToken = `${header}.${Buffer.from(JSON.stringify(accessPayload)).toString('base64')}.sig`
        const refreshToken = `${header}.${Buffer.from(JSON.stringify(refreshPayload)).toString('base64')}.sig`

        const response = createMockResponse()
        setCookiesFromJWT(accessToken, refreshToken, response as any)

        // Access token maxAge should be ~1800
        expect(response._setCalls[0].options.maxAge).toBeGreaterThan(1790)
        expect(response._setCalls[0].options.maxAge).toBeLessThanOrEqual(1800)

        // Refresh token maxAge should be ~604800 (7 days)
        expect(response._setCalls[1].options.maxAge).toBeGreaterThan(604790)
        expect(response._setCalls[1].options.maxAge).toBeLessThanOrEqual(604800)
    })

    it('handles tokens with very short expiry', () => {
        const now = Math.floor(Date.now() / 1000)
        const accessToken = makeJWT(now + 1) // 1 second
        const refreshToken = makeJWT(now + 10) // 10 seconds
        const response = createMockResponse()

        setCookiesFromJWT(accessToken, refreshToken, response as any)

        expect(response._setCalls[0].options.maxAge).toBeLessThanOrEqual(1)
        expect(response._setCalls[0].options.maxAge).toBeGreaterThanOrEqual(0)
        expect(response._setCalls[1].options.maxAge).toBeLessThanOrEqual(10)
        expect(response._setCalls[1].options.maxAge).toBeGreaterThanOrEqual(9)
    })

    it('treats test environment as non-production (isDev = true)', () => {
        process.env.NODE_ENV = 'test'

        const now = Math.floor(Date.now() / 1000)
        const accessToken = makeJWT(now + 3600)
        const refreshToken = makeJWT(now + 86400)
        const response = createMockResponse()

        setCookiesFromJWT(accessToken, refreshToken, response as any)

        for (const call of response._setCalls) {
            expect(call.options.secure).toBe(false)
            expect(call.options.sameSite).toBe('lax')
        }
    })

    it('produces negative maxAge for already-expired tokens', () => {
        const now = Math.floor(Date.now() / 1000)
        const accessToken = makeJWT(now - 60) // expired 1 minute ago
        const refreshToken = makeJWT(now - 10) // expired 10 seconds ago
        const response = createMockResponse()

        setCookiesFromJWT(accessToken, refreshToken, response as any)

        expect(response._setCalls[0].options.maxAge).toBeLessThan(0)
        expect(response._setCalls[1].options.maxAge).toBeLessThan(0)
    })
})
