process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
process.env.API_BASE_URL = 'http://localhost:8080'

import { beforeEach, describe, expect, it } from '@jest/globals'

const mockRedirect = jest.fn((_url: string | URL, _init?: any) => ({
    status: _init?.status ?? 307,
}))

jest.mock('next/server', () => ({
    NextResponse: {
        redirect: (...args: any[]) => mockRedirect.apply(null, args),
    },
}))

jest.mock('@/app/posthog-server', () => ({
    getPosthogServer: () => ({
        captureException: jest.fn(),
    }),
}))

const mockSetCookies = jest.fn((_at: string, _rt: string, res: any) => res)
jest.mock('@/app/auth/cookie', () => ({
    setCookiesFromJWT: (...args: any[]) => mockSetCookies.apply(null, args),
}))

const mockFetch = jest.fn()
global.fetch = mockFetch as any

// Use require (not import) so the route module loads AFTER process.env is set.
// Static imports are hoisted by the compiler above process.env assignments.
const { GET } = require('@/app/auth/callback/github/route')

function makeRequest(params: string) {
    return { url: `http://localhost:3000/auth/callback/github${params}` } as unknown as Request
}

// Silence console.log/error from the route handler during tests
jest.spyOn(console, 'log').mockImplementation(() => { })
jest.spyOn(console, 'error').mockImplementation(() => { })

describe('GitHub Callback Route', () => {
    beforeEach(() => {
        mockRedirect.mockClear()
        mockSetCookies.mockClear()
        mockFetch.mockReset()
    })

    it('missing code redirects to login with error', async () => {
        await GET(makeRequest('?state=some-state'))

        expect(mockRedirect).toHaveBeenCalledTimes(1)
        const url = mockRedirect.mock.calls[0][0] as string
        expect(url).toContain('/auth/login?error=')
        expect(mockRedirect.mock.calls[0][1]).toEqual({ status: 302 })
    })

    it('missing state redirects to login with error', async () => {
        await GET(makeRequest('?code=some-code'))

        expect(mockRedirect).toHaveBeenCalledTimes(1)
        const url = mockRedirect.mock.calls[0][0] as string
        expect(url).toContain('/auth/login?error=')
        expect(mockRedirect.mock.calls[0][1]).toEqual({ status: 302 })
    })

    it('MCP flow: mcp_ prefix state POSTs to /mcp/auth/callback and redirects', async () => {
        const mcpRedirectUrl = 'https://client.example.com/callback?code=mcp-code-123'
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ redirect_url: mcpRedirectUrl }),
        })

        await GET(makeRequest('?code=gh-code&state=mcp_abc123'))

        // Should POST to MCP callback with state prefix stripped
        expect(mockFetch).toHaveBeenCalledWith(
            'http://localhost:8080/mcp/auth/callback',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ code: 'gh-code', state: 'abc123' }),
            })
        )

        expect(mockRedirect).toHaveBeenCalledWith(mcpRedirectUrl, { status: 302 })
    })

    it('MCP flow: backend failure redirects to login with error', async () => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 502 })

        await GET(makeRequest('?code=gh-code&state=mcp_abc123'))

        expect(mockRedirect).toHaveBeenCalledTimes(1)
        const url = mockRedirect.mock.calls[0][0] as string
        expect(url).toContain('/auth/login?error=')
        expect(mockRedirect.mock.calls[0][1]).toEqual({ status: 302 })
    })

    it('dashboard flow: exchanges code via backend and sets cookies', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                own_team_id: 'team-abc',
                access_token: 'at.eyJ0eXAiOiJKV1QifQ.test',
                refresh_token: 'rt.eyJ0eXAiOiJKV1QifQ.test',
            }),
        })

        await GET(makeRequest('?code=gh-code&state=dashboard-state'))

        // Should POST to /auth/github
        expect(mockFetch).toHaveBeenCalledWith(
            'http://localhost:8080/auth/github',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ type: 'code', state: 'dashboard-state', code: 'gh-code' }),
            })
        )

        // Should redirect to overview with 303
        expect(mockRedirect).toHaveBeenCalledTimes(1)
        const url = mockRedirect.mock.calls[0][0] as URL
        expect(url.pathname).toBe('/team-abc/overview')
        expect(mockRedirect.mock.calls[0][1]).toEqual({ status: 303 })

        // Should set cookies
        expect(mockSetCookies).toHaveBeenCalledWith(
            'at.eyJ0eXAiOiJKV1QifQ.test',
            'rt.eyJ0eXAiOiJKV1QifQ.test',
            expect.anything()
        )
    })

    it('dashboard flow: backend failure redirects to login with error', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'internal_error' }),
        })

        await GET(makeRequest('?code=gh-code&state=dashboard-state'))

        expect(mockRedirect).toHaveBeenCalledTimes(1)
        const url = mockRedirect.mock.calls[0][0] as string
        expect(url).toContain('/auth/login?error=')
        expect(mockRedirect.mock.calls[0][1]).toEqual({ status: 302 })
    })

    it('dashboard flow: non-JSON error response falls back to text', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: () => Promise.reject(new Error('not json')),
            text: () => Promise.resolve('plain text error'),
        })

        await GET(makeRequest('?code=gh-code&state=dashboard-state'))

        expect(mockRedirect).toHaveBeenCalledTimes(1)
        const url = mockRedirect.mock.calls[0][0] as string
        expect(url).toContain('/auth/login?error=')
        expect(mockRedirect.mock.calls[0][1]).toEqual({ status: 302 })
    })

})
