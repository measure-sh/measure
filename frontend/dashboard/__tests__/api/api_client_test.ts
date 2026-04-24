import { beforeEach, describe, expect, it } from '@jest/globals'

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
    default: { reset: jest.fn(), capture: jest.fn() },
}))

import { ApiClient, apiClient } from '@/app/api/api_client'
import posthog from 'posthog-js'

// Silence console.log/error during tests
jest.spyOn(console, 'log').mockImplementation(() => { })
jest.spyOn(console, 'error').mockImplementation(() => { })

const mockFetch = jest.fn()
global.fetch = mockFetch as any

function mockRouter() {
    return { replace: jest.fn() } as any
}

describe('ApiClient', () => {
    let client: ApiClient

    beforeEach(() => {
        client = new ApiClient()
        mockFetch.mockReset()
            ; (posthog.reset as jest.Mock).mockClear()
            ; (posthog.capture as jest.Mock).mockClear()
    })

    describe('init', () => {
        it('stores the router for later use', () => {
            const router = mockRouter()
            client.init(router)

            // Verify router is stored by exercising redirectToLogin
            client.redirectToLogin()

            expect(router.replace).toHaveBeenCalledWith('/auth/login')
        })
    })

    describe('redirectToLogin', () => {
        it('calls posthog.reset and router.replace', () => {
            const router = mockRouter()
            client.init(router)

            client.redirectToLogin()

            expect(posthog.reset).toHaveBeenCalled()
            expect(router.replace).toHaveBeenCalledWith('/auth/login')
        })

        it('throws if router is not initialized', () => {
            expect(() => client.redirectToLogin()).toThrow(
                'Router is not initialized. Call `init` method first.'
            )
        })
    })

    describe('fetch', () => {
        beforeEach(() => {
            client.init(mockRouter())
        })

        it('makes a request with credentials: include', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

            await client.fetch('/api/test')

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/test',
                expect.objectContaining({ credentials: 'include' })
            )
        })

        it('passes through custom config', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

            await client.fetch('/api/test', {
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

            const result = await client.fetch('/api/test')

            expect(mockFetch).toHaveBeenCalledTimes(3)
            // First: original request
            expect(mockFetch.mock.calls[0][0]).toBe('/api/test')
            // Second: refresh
            expect(mockFetch.mock.calls[1][0]).toBe('/auth/refresh')
            // Third: retry
            expect(mockFetch.mock.calls[2][0]).toBe('/api/test')
            expect(result.status).toBe(200)
        })

        it('refreshes token on 401 and retries non-GET requests', async () => {
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

            const result = await client.fetch('/api/test', { method: 'POST' })

            expect(mockFetch).toHaveBeenCalledTimes(3)
            expect(result.status).toBe(200)
        })

        it('redirects to login when retry still returns 401', async () => {
            const router = mockRouter()
            client.init(router)

            // First call 401
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
            // Refresh succeeds
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })
            // Retry still 401
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })

            await client.fetch('/api/test')

            expect(router.replace).toHaveBeenCalledWith('/auth/login')
        })

        it('redirects to login when refresh token is expired (401)', async () => {
            const router = mockRouter()
            client.init(router)

            // First call 401
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
            // Refresh also 401
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })

            await client.fetch('/api/test')

            expect(router.replace).toHaveBeenCalledWith('/auth/login')
        })

        it('does not redirect to login when redirectToLogin is false and retry returns 401', async () => {
            const router = mockRouter()
            client.init(router)

            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })

            await client.fetch('/api/test', {}, false)

            expect(router.replace).not.toHaveBeenCalled()
        })

        it('does not redirect to login when redirectToLogin is false and refresh returns 401', async () => {
            const router = mockRouter()
            client.init(router)

            // First call 401
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
            // Refresh also 401
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })

            await client.fetch('/api/test', {}, false)

            expect(router.replace).not.toHaveBeenCalled()
        })

        it('does not refresh when request is already a refresh request', async () => {
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })

            const result = await client.fetch('/auth/refresh')

            // Only 1 call - no recursive refresh
            expect(mockFetch).toHaveBeenCalledTimes(1)
            expect(result.status).toBe(401)
        })

        it('does not deduplicate or abort duplicate requests — stores own that concern', async () => {
            // Multiple parallel requests to the same endpoint all run to
            // completion. The api_client is a pure HTTP wrapper; dedup,
            // caching and in-flight tracking live in the store layer.
            mockFetch
                .mockResolvedValueOnce({ ok: true, status: 200 })
                .mockResolvedValueOnce({ ok: true, status: 200 })
                .mockResolvedValueOnce({ ok: true, status: 200 })

            const a = client.fetch('/api/test', { method: 'POST' })
            const b = client.fetch('/api/test', { method: 'POST' })
            const c = client.fetch('/api/test')

            const results = await Promise.all([a, b, c])
            expect(results.every((r) => r.status === 200)).toBe(true)
            expect(mockFetch).toHaveBeenCalledTimes(3)
        })

        it('does not pass an AbortSignal to fetch', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

            await client.fetch('/api/test', { method: 'POST' })

            const passedConfig = mockFetch.mock.calls[0][1] as RequestInit
            expect(passedConfig.signal).toBeUndefined()
        })

        it('handles Request object as resource', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

            const req = new Request('http://localhost:3000/api/test')
            await client.fetch(req)

            expect(mockFetch).toHaveBeenCalledWith(
                req,
                expect.objectContaining({ credentials: 'include' })
            )
        })

        it('handles URL object as resource', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

            const url = new URL('http://localhost:3000/api/test')
            await client.fetch(url)

            expect(mockFetch).toHaveBeenCalledWith(
                url,
                expect.objectContaining({ credentials: 'include' })
            )
        })

        it('handles string URL as resource', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

            await client.fetch('/api/test')

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/test',
                expect.objectContaining({ credentials: 'include' })
            )
        })

        it('does not redirect when refresh fails with non-401 status', async () => {
            const router = mockRouter()
            client.init(router)

            // First call 401
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
            // Refresh returns 500 (not 401)
            mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

            const result = await client.fetch('/api/test')

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
                client.fetch('/api/test')
            ).rejects.toThrow('Network failure')
        })

        it('rethrows non-AbortError exceptions from fetch', async () => {
            mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

            await expect(
                client.fetch('/api/test')
            ).rejects.toThrow('Failed to fetch')
        })
    })

    describe('posthog metrics', () => {
        beforeEach(() => {
            client.init(mockRouter())
        })

        it('captures api_call_completed with correct properties', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

            await client.fetch('/api/apps/test')

            expect(posthog.capture).toHaveBeenCalledWith(
                'api_call_completed',
                expect.objectContaining({
                    endpoint: '/api/apps/test',
                    method: 'GET',
                    status_code: 200,
                    success: true,
                })
            )
            expect(posthog.capture).toHaveBeenCalledWith(
                'api_call_completed',
                expect.objectContaining({
                    latency_ms: expect.any(Number),
                })
            )
        })

        it('captures correct method for POST requests', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

            await client.fetch('/api/test', { method: 'POST' })

            expect(posthog.capture).toHaveBeenCalledWith(
                'api_call_completed',
                expect.objectContaining({ method: 'POST' })
            )
        })

        it('captures success: false for non-ok responses', async () => {
            mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

            await client.fetch('/api/test')

            expect(posthog.capture).toHaveBeenCalledWith(
                'api_call_completed',
                expect.objectContaining({
                    status_code: 500,
                    success: false,
                })
            )
        })

        it('does not capture for /auth/refresh requests', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

            await client.fetch('/auth/refresh')

            expect(posthog.capture).not.toHaveBeenCalled()
        })

        it('captures retried: true on retry after token refresh', async () => {
            // First call returns 401
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
            // Refresh succeeds
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })
            // Retry succeeds
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

            await client.fetch('/api/test')

            expect(posthog.capture).toHaveBeenCalledTimes(2)
            // First capture: original 401
            expect(posthog.capture).toHaveBeenNthCalledWith(
                1,
                'api_call_completed',
                expect.objectContaining({
                    status_code: 401,
                    success: false,
                })
            )
            // Second capture: retry with retried flag
            expect(posthog.capture).toHaveBeenNthCalledWith(
                2,
                'api_call_completed',
                expect.objectContaining({
                    status_code: 200,
                    success: true,
                    retried: true,
                })
            )
        })

        it('normalizes UUIDs to :id in endpoint', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

            await client.fetch('/api/apps/5952c302-0e9f-4a00-98c4-f4e6106faedc/journey')

            expect(posthog.capture).toHaveBeenCalledWith(
                'api_call_completed',
                expect.objectContaining({
                    endpoint: '/api/apps/:id/journey',
                })
            )
        })

        it('normalizes multiple UUIDs in endpoint', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

            await client.fetch('/api/teams/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/apps/11111111-2222-3333-4444-555555555555/filters')

            expect(posthog.capture).toHaveBeenCalledWith(
                'api_call_completed',
                expect.objectContaining({
                    endpoint: '/api/teams/:id/apps/:id/filters',
                })
            )
        })

    })

    describe('apiClient singleton', () => {
        it('exports a default ApiClient instance', () => {
            expect(apiClient).toBeInstanceOf(ApiClient)
        })
    })
})
