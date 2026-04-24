import { beforeEach, describe, expect, it } from '@jest/globals'

// Mock posthog before importing the module under test
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { reset: jest.fn(), capture: jest.fn() },
}))

// Mock apiClient — the store depends on it for authenticated fetches
// and for init/redirectToLogin wiring.
const mockApiClientFetch = jest.fn()
const mockApiClientInit = jest.fn()
const mockApiClientRedirectToLogin = jest.fn()

jest.mock('@/app/api/api_client', () => ({
    __esModule: true,
    apiClient: {
        init: (...args: any[]) => mockApiClientInit(...args),
        fetch: (...args: any[]) => mockApiClientFetch(...args),
        redirectToLogin: (...args: any[]) => mockApiClientRedirectToLogin(...args),
    },
    ApiClient: class { },
}))

import { createSessionStore, type SessionStore } from '@/app/stores/session_store'
import posthog from 'posthog-js'
import { StoreApi } from 'zustand/vanilla'

// Silence console.log/error during tests
jest.spyOn(console, 'log').mockImplementation(() => { })
jest.spyOn(console, 'error').mockImplementation(() => { })

const mockFetch = jest.fn()
global.fetch = mockFetch as any

function mockRouter() {
    return { replace: jest.fn() } as any
}

describe('useSessionStore', () => {
    let store: StoreApi<SessionStore>

    beforeEach(() => {
        store = createSessionStore()
        mockFetch.mockReset()
        mockApiClientFetch.mockReset()
        mockApiClientInit.mockReset()
        mockApiClientRedirectToLogin.mockReset()
            ; (posthog.reset as jest.Mock).mockClear()
            ; (posthog.capture as jest.Mock).mockClear()
    })

    describe('init', () => {
        it('forwards router to apiClient', () => {
            const router = mockRouter()

            store.getState().init(router)

            expect(mockApiClientInit).toHaveBeenCalledWith(router)
        })

        it('wires router so signOut ultimately uses it via apiClient.redirectToLogin', async () => {
            const router = mockRouter()
            store.getState().init(router)
            mockFetch.mockResolvedValueOnce({ ok: true })

            await store.getState().signOut()

            // signOut calls apiClient.redirectToLogin, which in real code uses the router
            expect(mockApiClientInit).toHaveBeenCalledWith(router)
            expect(mockApiClientRedirectToLogin).toHaveBeenCalled()
        })
    })

    describe('fetchSession', () => {
        it('sets session and null error on success', async () => {
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

            mockApiClientFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ user: userData }),
            })

            await store.getState().fetchSession()

            const state = store.getState()
            expect(state.error).toBeNull()
            expect(state.session).not.toBeNull()
            expect(state.session!.user).toEqual(userData)
            expect(state.loaded).toBe(true)
        })

        it('fetches from /api/auth/session via apiClient', async () => {
            mockApiClientFetch.mockResolvedValueOnce({
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

            await store.getState().fetchSession()

            expect(mockApiClientFetch).toHaveBeenCalledWith('/api/auth/session')
        })

        it('sets error when response is not ok', async () => {
            mockApiClientFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
            })

            await store.getState().fetchSession()

            const state = store.getState()
            expect(state.session).toBeNull()
            expect(state.error).toBeInstanceOf(Error)
            expect(state.error!.message).toBe('Failed to retrieve session data')
            expect(state.loaded).toBe(true)
        })

        it('sets error when user is missing from response', async () => {
            mockApiClientFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
            })

            await store.getState().fetchSession()

            const state = store.getState()
            expect(state.session).toBeNull()
            expect(state.error).toBeInstanceOf(Error)
            expect(state.error!.message).toBe('No user in session')
            expect(state.loaded).toBe(true)
        })

        it('sets error when fetch throws', async () => {
            mockApiClientFetch.mockRejectedValueOnce(new Error('Network error'))

            await store.getState().fetchSession()

            const state = store.getState()
            expect(state.session).toBeNull()
            expect(state.error).toBeInstanceOf(Error)
            expect(state.error!.message).toBe('Network error')
            expect(state.loaded).toBe(true)
        })

        it('wraps non-Error throws in an Error', async () => {
            mockApiClientFetch.mockRejectedValueOnce('string error')

            await store.getState().fetchSession()

            const state = store.getState()
            expect(state.session).toBeNull()
            expect(state.error).toBeInstanceOf(Error)
            expect(state.error!.message).toBe('Unknown error getting session')
            expect(state.loaded).toBe(true)
        })

        it('marks loaded: true after fetch completes', async () => {
            expect(store.getState().loaded).toBe(false)

            mockApiClientFetch.mockResolvedValueOnce({
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

            await store.getState().fetchSession()

            expect(store.getState().loaded).toBe(true)
        })

        it('returns cached session on second call without hitting apiClient.fetch', async () => {
            // First successful fetch populates loaded=true and session={...}
            mockApiClientFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    user: {
                        id: 'cached-user', own_team_id: 't', name: 'n', email: 'e',
                        avatar_url: '', confirmed_at: '', last_sign_in_at: '',
                        created_at: '', updated_at: '',
                    },
                }),
            })
            await store.getState().fetchSession()
            expect(store.getState().loaded).toBe(true)
            expect(store.getState().session).not.toBeNull()
            expect(mockApiClientFetch).toHaveBeenCalledTimes(1)

            // Reset call counter so we only observe the second call
            mockApiClientFetch.mockClear()

            // Second call should early-return due to `if (loaded && session) return`
            await store.getState().fetchSession()

            expect(mockApiClientFetch).not.toHaveBeenCalled()
            // session is unchanged
            expect(store.getState().session!.user.id).toBe('cached-user')
        })
    })

    describe('signOut', () => {
        it('calls DELETE /auth/logout with credentials and redirects via apiClient', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true })

            await store.getState().signOut()

            expect(mockFetch).toHaveBeenCalledWith('/auth/logout', {
                method: 'DELETE',
                credentials: 'include',
            })
            expect(mockApiClientRedirectToLogin).toHaveBeenCalled()
        })
    })

    describe('encodeOAuthState', () => {
        it('returns a base64url-encoded JSON string with random and path', () => {
            const encoded = store.getState().encodeOAuthState('/dashboard')

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
            const encoded = store.getState().encodeOAuthState()

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
                const encoded = store.getState().encodeOAuthState('/test')
                expect(encoded).not.toMatch(/[+/=]/)
            }
        })

        it('returns different values on each call due to random component', () => {
            const a = store.getState().encodeOAuthState('/test')
            const b = store.getState().encodeOAuthState('/test')
            expect(a).not.toBe(b)
        })
    })

    describe('signInWithOAuth', () => {
        it('throws if clientId is undefined', async () => {
            await expect(
                store.getState().signInWithOAuth({
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

            const result = await store.getState().signInWithOAuth({
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

            await store.getState().signInWithOAuth({
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

            const result = await store.getState().signInWithOAuth({
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

            const result = await store.getState().signInWithOAuth({
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

            const result = await store.getState().signInWithOAuth({
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

            const result = await store.getState().signInWithOAuth({
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

            const result = await store.getState().signInWithOAuth({
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
            const result = await store.getState().signInWithOAuth({
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

    describe('reset', () => {
        it('resets state to initial values', async () => {
            // Put store into a non-initial state
            mockApiClientFetch.mockResolvedValueOnce({
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
            await store.getState().fetchSession()
            expect(store.getState().session).not.toBeNull()
            expect(store.getState().loaded).toBe(true)

            store.getState().reset()

            const state = store.getState()
            expect(state.session).toBeNull()
            expect(state.error).toBeNull()
            expect(state.loaded).toBe(false)
        })

        it('clears the in-flight tracker so subsequent fetchSession calls run fresh', async () => {
            // First fetchSession resolves successfully
            mockApiClientFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    user: {
                        id: 'u1', own_team_id: 't', name: 'n', email: 'e',
                        avatar_url: '', confirmed_at: '', last_sign_in_at: '',
                        created_at: '', updated_at: '',
                    },
                }),
            })
            await store.getState().fetchSession()
            expect(mockApiClientFetch).toHaveBeenCalledTimes(1)

            // Reset clears the tracker so the next call actually fetches again
            store.getState().reset()

            mockApiClientFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    user: {
                        id: 'u2', own_team_id: 't', name: 'n', email: 'e',
                        avatar_url: '', confirmed_at: '', last_sign_in_at: '',
                        created_at: '', updated_at: '',
                    },
                }),
            })
            await store.getState().fetchSession()

            expect(mockApiClientFetch).toHaveBeenCalledTimes(2)
            expect(store.getState().session!.user.id).toBe('u2')
        })
    })
})
