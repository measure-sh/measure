import { beforeEach, afterEach, describe, expect, it } from '@jest/globals'

// Provide a minimal Request polyfill for jsdom (the source uses `instanceof Request`)
if (typeof globalThis.Request === 'undefined' || !(globalThis.Request.prototype instanceof Object && 'url' in new (globalThis.Request as any)('http://x'))) {
    globalThis.Request = class Request {
        url: string
        constructor(input: string | URL) {
            this.url = typeof input === 'string' ? input : input.toString()
        }
    } as any
}

// Mock posthog before importing the module under test
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { reset: jest.fn() },
}))

import posthog from 'posthog-js'
import { MeasureAuth } from '@/app/auth/measure_auth'

// Silence console.log/error during tests
jest.spyOn(console, 'log').mockImplementation(() => { })
jest.spyOn(console, 'error').mockImplementation(() => { })

const mockFetch = jest.fn()
global.fetch = mockFetch as any

function mockRouter() {
    return { replace: jest.fn() } as any
}

describe('MeasureAuth', () => {
    let auth: MeasureAuth

    beforeEach(() => {
        auth = new MeasureAuth()
        mockFetch.mockReset()
    })

    describe('init', () => {
        it('stores the router for later use', async () => {
            const router = mockRouter()
            auth.init(router)

            // Verify router is stored by exercising redirectToLogin via signout
            mockFetch.mockResolvedValueOnce({ ok: true })
            await auth.signout()

            expect(router.replace).toHaveBeenCalledWith('/auth/login')
        })
    })

    describe('encodeOAuthState', () => {
        it('returns a base64url-encoded JSON string with random and path', () => {
            const encoded = auth.encodeOAuthState('/dashboard')

            // Decode and parse
            // Re-add padding for atob
            let padded = encoded.replace(/-/g, '+').replace(/_/g, '/')
            while (padded.length % 4 !== 0) {
                padded += '='
            }
            const decoded = JSON.parse(atob(padded))

            expect(decoded).toHaveProperty('random')
            expect(decoded).toHaveProperty('path', '/dashboard')
            expect(typeof decoded.random).toBe('string')
            expect(decoded.random.length).toBe(64) // 32 bytes = 64 hex chars
        })

        it('defaults path to empty string when not provided', () => {
            const encoded = auth.encodeOAuthState()

            let padded = encoded.replace(/-/g, '+').replace(/_/g, '/')
            while (padded.length % 4 !== 0) {
                padded += '='
            }
            const decoded = JSON.parse(atob(padded))

            expect(decoded.path).toBe('')
        })

        it('produces base64url output without +, /, or = characters', () => {
            // Run multiple times to increase chance of catching bad encoding
            for (let i = 0; i < 20; i++) {
                const encoded = auth.encodeOAuthState('/test')
                expect(encoded).not.toMatch(/[+/=]/)
            }
        })

        it('returns different values on each call due to random component', () => {
            const a = auth.encodeOAuthState('/test')
            const b = auth.encodeOAuthState('/test')
            expect(a).not.toBe(b)
        })
    })

    describe('oAuthSignin', () => {
        it('throws if clientId is undefined', async () => {
            await expect(
                auth.oAuthSignin({
                    clientId: undefined,
                    options: {
                        redirectTo: 'http://localhost:3000/auth/callback/github',
                        next: '/',
                    },
                })
            ).rejects.toThrow('`clientId` is required')
        })

        it('returns an OAuth URL on successful init', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ success: true }),
            })

            const result = await auth.oAuthSignin({
                clientId: 'test-client-id',
                options: {
                    redirectTo: 'http://localhost:3000/auth/callback/github',
                    next: '/dashboard',
                },
            })

            expect(result.error).toBeUndefined()
            expect(result.url).toBeInstanceOf(URL)
            expect(result.url!.hostname).toBe('github.com')
            expect(result.url!.pathname).toBe('/login/oauth/authorize')
            expect(result.url!.searchParams.get('client_id')).toBe('test-client-id')
            expect(result.url!.searchParams.get('scope')).toBe('user:email read:user')
            expect(result.url!.searchParams.get('redirect_uri')).toBe(
                'http://localhost:3000/auth/callback/github'
            )
            expect(result.url!.searchParams.get('state')).toBeTruthy()
        })

        it('POSTs init request to /api/auth/github with state', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
            })

            await auth.oAuthSignin({
                clientId: 'test-client-id',
                options: {
                    redirectTo: 'http://localhost:3000/auth/callback/github',
                    next: '/',
                },
            })

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/auth/github',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                })
            )

            const body = JSON.parse(mockFetch.mock.calls[0][1].body)
            expect(body.type).toBe('init')
            expect(body.state).toBeTruthy()
        })

        it('returns error on 400 response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: () => Promise.resolve({ error: 'invalid_request' }),
            })

            const result = await auth.oAuthSignin({
                clientId: 'test-client-id',
                options: {
                    redirectTo: 'http://localhost:3000/auth/callback/github',
                    next: '/',
                },
            })

            expect(result.error).toBeInstanceOf(Error)
            expect(result.error!.message).toContain('Bad request')
            expect(result.error!.message).toContain('invalid_request')
            expect(result.url).toBeUndefined()
        })

        it('returns error on 401 response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: () => Promise.resolve({ error: 'unauthorized' }),
            })

            const result = await auth.oAuthSignin({
                clientId: 'test-client-id',
                options: {
                    redirectTo: 'http://localhost:3000/auth/callback/github',
                    next: '/',
                },
            })

            expect(result.error).toBeInstanceOf(Error)
            expect(result.error!.message).toContain('Unauthorized')
            expect(result.url).toBeUndefined()
        })

        it('returns URL without error on non-400/401 failure (e.g. 500)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: () => Promise.resolve({ error: 'server_error' }),
            })

            const result = await auth.oAuthSignin({
                clientId: 'test-client-id',
                options: {
                    redirectTo: 'http://localhost:3000/auth/callback/github',
                    next: '/',
                },
            })

            // Source only checks 400 and 401, so 500 falls through and returns URL
            expect(result.error).toBeUndefined()
            expect(result.url).toBeInstanceOf(URL)
        })

        it('encodes the next path into the OAuth state', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
            })

            const result = await auth.oAuthSignin({
                clientId: 'test-client-id',
                options: {
                    redirectTo: 'http://localhost:3000/auth/callback/github',
                    next: '/my/dashboard',
                },
            })

            const stateParam = result.url!.searchParams.get('state')!
            let padded = stateParam.replace(/-/g, '+').replace(/_/g, '/')
            while (padded.length % 4 !== 0) {
                padded += '='
            }
            const decoded = JSON.parse(atob(padded))
            expect(decoded.path).toBe('/my/dashboard')
        })

        it('accepts next as a URL object', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
            })

            const result = await auth.oAuthSignin({
                clientId: 'test-client-id',
                options: {
                    redirectTo: 'http://localhost:3000/auth/callback/github',
                    next: new URL('http://localhost:3000/my/dashboard'),
                },
            })

            const stateParam = result.url!.searchParams.get('state')!
            let padded = stateParam.replace(/-/g, '+').replace(/_/g, '/')
            while (padded.length % 4 !== 0) {
                padded += '='
            }
            const decoded = JSON.parse(atob(padded))
            expect(decoded.path).toBe('http://localhost:3000/my/dashboard')
        })

        it('accepts redirectTo as a URL object', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
            })

            const redirectUrl = new URL('http://localhost:3000/auth/callback/github')
            const result = await auth.oAuthSignin({
                clientId: 'test-client-id',
                options: {
                    redirectTo: redirectUrl,
                    next: '/',
                },
            })

            expect(result.url!.searchParams.get('redirect_uri')).toBe(
                'http://localhost:3000/auth/callback/github'
            )
        })
    })

    describe('getSession', () => {
        beforeEach(() => {
            auth.init(mockRouter())
        })

        it('returns session with all user fields mapped correctly', async () => {
            const userData = {
                id: 'user-1',
                own_team_id: 'team-1',
                name: 'Test User',
                email: 'test@example.com',
                avatar_url: 'https://example.com/avatar.png',
                confirmed_at: '2026-01-01T00:00:00Z',
                last_sign_in_at: '2026-03-01T00:00:00Z',
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-03-01T00:00:00Z',
            }

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ user: userData }),
            })

            const result = await auth.getSession()

            expect(result.error).toBeNull()
            expect(result.session).not.toBeNull()
            expect(result.session!.user).toEqual(userData)
        })

        it('fetches from /api/auth/session', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    user: {
                        id: 'u', own_team_id: 't', name: 'n', email: 'e',
                        avatar_url: '', confirmed_at: '', last_sign_in_at: '',
                        created_at: '', updated_at: '',
                    },
                }),
            })

            await auth.getSession()

            expect(mockFetch.mock.calls[0][0]).toBe('/api/auth/session')
        })

        it('returns error when response is not ok', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
            })

            const result = await auth.getSession()

            expect(result.session).toBeNull()
            expect(result.error).toBeInstanceOf(Error)
            expect(result.error!.message).toBe('Failed to retrieve session data')
        })

        it('returns error when user is missing from response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
            })

            const result = await auth.getSession()

            expect(result.session).toBeNull()
            expect(result.error).toBeInstanceOf(Error)
            expect(result.error!.message).toBe('No user in session')
        })

        it('returns error when fetch throws', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'))

            const result = await auth.getSession()

            expect(result.session).toBeNull()
            expect(result.error).toBeInstanceOf(Error)
            expect(result.error!.message).toBe('Network error')
        })

        it('wraps non-Error throws in an Error', async () => {
            mockFetch.mockRejectedValueOnce('string error')

            const result = await auth.getSession()

            expect(result.session).toBeNull()
            expect(result.error).toBeInstanceOf(Error)
            expect(result.error!.message).toBe('Unknown error getting session')
        })
    })

    describe('signout', () => {
        it('calls DELETE /auth/logout and redirects to login', async () => {
            const router = mockRouter()
            auth.init(router)

            mockFetch.mockResolvedValueOnce({ ok: true })

            await auth.signout()

            expect(mockFetch).toHaveBeenCalledWith('/auth/logout', {
                method: 'DELETE',
                credentials: 'include',
            })
            expect(posthog.reset).toHaveBeenCalled()
            expect(router.replace).toHaveBeenCalledWith('/auth/login')
        })

        it('throws if router is not initialized', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true })

            await expect(auth.signout()).rejects.toThrow(
                'Router is not initialized. Call `init` method first.'
            )
        })
    })

    describe('fetchMeasure', () => {
        beforeEach(() => {
            auth.init(mockRouter())
        })

        it('makes a request with credentials: include', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

            await auth.fetchMeasure('/api/test')

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/test',
                expect.objectContaining({ credentials: 'include' })
            )
        })

        it('passes through custom config', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

            await auth.fetchMeasure('/api/test', {
                method: 'POST',
                headers: { 'X-Custom': 'value' },
            })

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/test',
                expect.objectContaining({
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'X-Custom': 'value' },
                })
            )
        })

        it('refreshes token on 401 and retries', async () => {
            // First call returns 401
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
            // Refresh call succeeds
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })
            // Retry call succeeds
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200, data: 'success' })

            const result = await auth.fetchMeasure('/api/test')

            expect(mockFetch).toHaveBeenCalledTimes(3)
            // First: original request
            expect(mockFetch.mock.calls[0][0]).toBe('/api/test')
            // Second: refresh
            expect(mockFetch.mock.calls[1][0]).toBe('/auth/refresh')
            // Third: retry
            expect(mockFetch.mock.calls[2][0]).toBe('/api/test')
            expect(result.status).toBe(200)
        })

        it('redirects to login when retry still returns 401', async () => {
            const router = mockRouter()
            auth.init(router)

            // First call 401
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
            // Refresh succeeds
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })
            // Retry still 401
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })

            await auth.fetchMeasure('/api/test')

            expect(router.replace).toHaveBeenCalledWith('/auth/login')
        })

        it('redirects to login when refresh token is expired (401)', async () => {
            const router = mockRouter()
            auth.init(router)

            // First call 401
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
            // Refresh also 401
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })

            await auth.fetchMeasure('/api/test')

            expect(router.replace).toHaveBeenCalledWith('/auth/login')
        })

        it('does not redirect to login when redirectToLogin is false and retry returns 401', async () => {
            const router = mockRouter()
            auth.init(router)

            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })

            await auth.fetchMeasure('/api/test', {}, false)

            expect(router.replace).not.toHaveBeenCalled()
        })

        it('does not redirect to login when redirectToLogin is false and refresh returns 401', async () => {
            const router = mockRouter()
            auth.init(router)

            // First call 401
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
            // Refresh also 401
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })

            await auth.fetchMeasure('/api/test', {}, false)

            expect(router.replace).not.toHaveBeenCalled()
        })

        it('does not refresh when request is already a refresh request', async () => {
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })

            const result = await auth.fetchMeasure('/auth/refresh')

            // Only 1 call - no recursive refresh
            expect(mockFetch).toHaveBeenCalledTimes(1)
            expect(result.status).toBe(401)
        })

        it('aborts duplicate non-GET requests to the same endpoint', async () => {
            let aborted = false
            mockFetch.mockImplementation((_url: string, config: RequestInit) => {
                return new Promise((resolve, reject) => {
                    if (config.signal) {
                        config.signal.addEventListener('abort', () => {
                            aborted = true
                            reject(new DOMException('Aborted', 'AbortError'))
                        })
                    }
                    // Resolve after a tick to give the second call time to abort the first
                    setTimeout(() => resolve({ ok: true, status: 200 }), 10)
                })
            })

            const first = auth.fetchMeasure('/api/test', { method: 'POST' })
            const second = auth.fetchMeasure('/api/test', { method: 'POST' })

            // First request should be aborted
            await expect(first).rejects.toThrow()
            expect(aborted).toBe(true)

            // Second should complete
            const result = await second
            expect(result.status).toBe(200)
        })

        it('does not abort duplicate GET requests', async () => {
            mockFetch
                .mockResolvedValueOnce({ ok: true, status: 200, data: 'first' })
                .mockResolvedValueOnce({ ok: true, status: 200, data: 'second' })

            const first = auth.fetchMeasure('/api/test')
            const second = auth.fetchMeasure('/api/test')

            const [r1, r2] = await Promise.all([first, second])
            expect(r1.status).toBe(200)
            expect(r2.status).toBe(200)
        })

        it('does not abort duplicate shortFilters requests', async () => {
            mockFetch
                .mockResolvedValueOnce({ ok: true, status: 200 })
                .mockResolvedValueOnce({ ok: true, status: 200 })

            const first = auth.fetchMeasure('/api/shortFilters', { method: 'POST' })
            const second = auth.fetchMeasure('/api/shortFilters', { method: 'POST' })

            const [r1, r2] = await Promise.all([first, second])
            expect(r1.status).toBe(200)
            expect(r2.status).toBe(200)
        })

        it('handles Request object as resource', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

            const req = new Request('http://localhost:3000/api/test')
            await auth.fetchMeasure(req)

            expect(mockFetch).toHaveBeenCalledWith(
                req,
                expect.objectContaining({ credentials: 'include' })
            )
        })

        it('handles URL object as resource', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

            const url = new URL('http://localhost:3000/api/test')
            await auth.fetchMeasure(url)

            expect(mockFetch).toHaveBeenCalledWith(
                url,
                expect.objectContaining({ credentials: 'include' })
            )
        })

        it('strips query parameters for endpoint dedup key', async () => {
            let aborted = false
            mockFetch.mockImplementation((_url: string, config: RequestInit) => {
                return new Promise((resolve, reject) => {
                    if (config.signal) {
                        config.signal.addEventListener('abort', () => {
                            aborted = true
                            reject(new DOMException('Aborted', 'AbortError'))
                        })
                    }
                    setTimeout(() => resolve({ ok: true, status: 200 }), 10)
                })
            })

            const first = auth.fetchMeasure('/api/test?a=1', { method: 'POST' })
            const second = auth.fetchMeasure('/api/test?b=2', { method: 'POST' })

            await expect(first).rejects.toThrow()
            expect(aborted).toBe(true)

            const result = await second
            expect(result.status).toBe(200)
        })

        it('rethrows AbortError with logged message', async () => {
            mockFetch.mockRejectedValueOnce(
                new DOMException('The operation was aborted', 'AbortError')
            )

            await expect(
                auth.fetchMeasure('/api/test')
            ).rejects.toThrow('The operation was aborted')
        })

        it('does not redirect when refresh fails with non-401 status', async () => {
            const router = mockRouter()
            auth.init(router)

            // First call 401
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
            // Refresh returns 500 (not 401)
            mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

            const result = await auth.fetchMeasure('/api/test')

            // Should not redirect — source only redirects on refresh status 401
            expect(router.replace).not.toHaveBeenCalled()
            // Returns the original 401 response
            expect(result.status).toBe(401)
        })

        it('propagates error when refresh fetch itself throws', async () => {
            // First call 401
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
            // Refresh fetch throws network error
            mockFetch.mockRejectedValueOnce(new Error('Network failure'))

            await expect(
                auth.fetchMeasure('/api/test')
            ).rejects.toThrow('Network failure')
        })

        it('rethrows non-AbortError exceptions from fetch', async () => {
            mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

            await expect(
                auth.fetchMeasure('/api/test')
            ).rejects.toThrow('Failed to fetch')
        })
    })

    describe('measureAuth singleton', () => {
        it('exports a default MeasureAuth instance', async () => {
            const { measureAuth } = await import('@/app/auth/measure_auth')
            expect(measureAuth).toBeInstanceOf(MeasureAuth)
        })
    })
})
