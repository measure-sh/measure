import Login from '@/app/auth/login/page'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, render, screen } from '@testing-library/react'

const mockRouterReplace = jest.fn()
const mockValidateInvites = jest.fn((_arg?: any) => Promise.resolve({ status: 'success' }))
const mockPosthogIdentify = jest.fn()

jest.mock('@/app/stores/provider', () => {
    const { create } = jest.requireActual('zustand')
    const store = create((set: any) => ({
        session: null,
        error: null,
        loaded: false,
        init: jest.fn(),
        fetchSession: jest.fn(),
        signOut: jest.fn(),
        signInWithOAuth: jest.fn(),
        encodeOAuthState: jest.fn(() => 'encoded-state'),
        reset: jest.fn(),
    }))
    const mockRegistry = { sessionStore: store }
    return {
        __esModule: true,
        useSessionStore: store,
        useMeasureStoreRegistry: () => mockRegistry,
    }
})

const { useSessionStore } = require('@/app/stores/provider') as { useSessionStore: any }

jest.mock('@/app/api/api_calls', () => ({
    ValidateInviteApiStatus: { Error: 'error', Success: 'success' },
    validateInvitesFromServer: (arg: any) => mockValidateInvites(arg),
}))

jest.mock('@/app/stores/reset_all', () => ({
    resetAllStores: jest.fn(),
}))

jest.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockRouterReplace }),
    useSearchParams: () => ({ get: jest.fn(() => null) }),
}))

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}))

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ alt, ...props }: any) => <img alt={alt} {...props} />,
}))

jest.mock('next-themes', () => ({
    useTheme: () => ({ theme: 'light', resolvedTheme: 'light' }),
}))

jest.mock('posthog-js', () => ({
    posthog: { identify: (...args: [...any[]]) => mockPosthogIdentify(...args) },
}))

jest.mock('@/app/utils/env_utils', () => ({
    isCloud: () => false,
}))

// Mock window.location.assign
const mockAssign = jest.fn()
Object.defineProperty(window, 'location', {
    value: { ...window.location, assign: mockAssign, href: 'http://localhost:3000/auth/login' },
    writable: true,
})

describe('Login Page', () => {
    beforeEach(() => {
        // Reset the session store state and mock fetchSession to leave session as null by default
        const fetchSession = jest.fn(async () => {
            useSessionStore.setState({ session: null, loaded: true })
        })
        useSessionStore.setState({
            session: null,
            error: null,
            loaded: false,
            fetchSession,
        } as any)
        mockAssign.mockClear()
        mockRouterReplace.mockClear()
        mockValidateInvites.mockClear()
        mockValidateInvites.mockResolvedValue({ status: 'success' })
        mockPosthogIdentify.mockClear()
        process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com'
    })

    it('renders normal login when mcp param is absent', async () => {
        await act(async () => {
            render(<Login searchParams={{}} />)
        })

        // Should call fetchSession for normal login flow
        expect(useSessionStore.getState().fetchSession).toHaveBeenCalled()
    })

    it('skips session check in MCP mode', () => {
        render(<Login searchParams={{ mcp: '1', response_type: 'code', client_id: 'test_client', redirect_uri: 'http://localhost/cb', state: 's', code_challenge: 'ch' }} />)

        // Should NOT call fetchSession in MCP mode
        expect(useSessionStore.getState().fetchSession).not.toHaveBeenCalled()
    })

    it('renders sign-in buttons in MCP mode without loading state', () => {
        render(<Login searchParams={{ mcp: '1', response_type: 'code', client_id: 'test_client', redirect_uri: 'http://localhost/cb', state: 's', code_challenge: 'ch' }} />)

        // Should not show "Loading..." since MCP mode starts with loading=false
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()

        // Should show both sign-in buttons
        expect(screen.getByText('Sign in with GitHub')).toBeInTheDocument()
        expect(screen.getByText('Sign in with Google')).toBeInTheDocument()
    })

    it('constructs correct GitHub authorize URL in MCP mode', () => {
        render(<Login searchParams={{
            mcp: '1',
            response_type: 'code',
            client_id: 'my_client',
            redirect_uri: 'http://localhost:9999/cb',
            state: 'mystate',
            code_challenge: 'mychallenge',
        }} />)

        // Click the GitHub button and verify the redirect URL
        screen.getByText('Sign in with GitHub').click()

        expect(mockAssign).toHaveBeenCalledTimes(1)
        const url = new URL(mockAssign.mock.calls[0][0] as string)
        expect(url.origin).toBe('https://api.example.com')
        expect(url.pathname).toBe('/oauth/authorize')
        expect(url.searchParams.get('provider')).toBe('github')
        expect(url.searchParams.get('response_type')).toBe('code')
        expect(url.searchParams.get('client_id')).toBe('my_client')
        expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:9999/cb')
        expect(url.searchParams.get('state')).toBe('mystate')
        expect(url.searchParams.get('code_challenge')).toBe('mychallenge')
        // mcp param should NOT be forwarded
        expect(url.searchParams.get('mcp')).toBeNull()
    })

    it('constructs correct Google authorize URL in MCP mode', () => {
        render(<Login searchParams={{
            mcp: '1',
            response_type: 'code',
            client_id: 'my_client',
            redirect_uri: 'http://localhost:9999/cb',
            state: 'mystate',
            code_challenge: 'mychallenge',
        }} />)

        screen.getByText('Sign in with Google').click()

        expect(mockAssign).toHaveBeenCalledTimes(1)
        const url = new URL(mockAssign.mock.calls[0][0] as string)
        expect(url.origin).toBe('https://api.example.com')
        expect(url.pathname).toBe('/oauth/authorize')
        expect(url.searchParams.get('provider')).toBe('google')
        expect(url.searchParams.get('client_id')).toBe('my_client')
        // mcp param should NOT be forwarded
        expect(url.searchParams.get('mcp')).toBeNull()
    })

    it('error param hides sign-in buttons', async () => {
        await act(async () => {
            render(<Login searchParams={{ error: 'Could not sign in' }} />)
        })

        expect(screen.queryByText('Sign in with GitHub')).not.toBeInTheDocument()
        expect(screen.queryByText('Sign in with Google')).not.toBeInTheDocument()
    })

    it('message param hides sign-in buttons', async () => {
        await act(async () => {
            render(<Login searchParams={{ message: 'user@example.com not allowed' }} />)
        })

        expect(screen.queryByText('Sign in with GitHub')).not.toBeInTheDocument()
        expect(screen.queryByText('Sign in with Google')).not.toBeInTheDocument()
    })

    it('does not show invite error in MCP mode', () => {
        render(<Login searchParams={{ mcp: '1', response_type: 'code', client_id: 'c', redirect_uri: 'http://x/cb', state: 's', code_challenge: 'ch', inviteId: 'some-invite' }} />)

        expect(screen.queryByText('Invalid or expired invite link.')).not.toBeInTheDocument()
    })

    it('validates invite when inviteId is present in non-MCP mode', async () => {
        await act(async () => {
            render(<Login searchParams={{ inviteId: 'invite-123' }} />)
        })

        expect(mockValidateInvites).toHaveBeenCalledWith('invite-123')
    })

    it('shows invalid invite message when invite validation fails', async () => {
        mockValidateInvites.mockResolvedValue({ status: 'error' })

        await act(async () => {
            render(<Login searchParams={{ inviteId: 'bad-invite' }} />)
        })

        expect(screen.getByText('Invalid or expired invite link.')).toBeInTheDocument()
    })

    it('does not show invalid invite message when invite is valid', async () => {
        mockValidateInvites.mockResolvedValue({ status: 'success' })

        await act(async () => {
            render(<Login searchParams={{ inviteId: 'good-invite' }} />)
        })

        expect(screen.queryByText('Invalid or expired invite link.')).not.toBeInTheDocument()
    })

    it('redirects to overview when session exists', async () => {
        const session = { user: { id: 'user-1', email: 'test@example.com', name: 'Test', own_team_id: 'team-1' } }
        useSessionStore.setState({
            fetchSession: jest.fn(async () => {
                useSessionStore.setState({ session, loaded: true } as any)
            }),
        } as any)

        await act(async () => {
            render(<Login searchParams={{}} />)
        })

        expect(mockRouterReplace).toHaveBeenCalledWith('/team-1/overview')
    })

    it('shows "Logging in..." when session exists and redirecting', async () => {
        const session = { user: { id: 'user-1', email: 'test@example.com', name: 'Test', own_team_id: 'team-1' } }
        useSessionStore.setState({
            fetchSession: jest.fn(async () => {
                useSessionStore.setState({ session, loaded: true } as any)
            }),
        } as any)

        await act(async () => {
            render(<Login searchParams={{}} />)
        })

        expect(screen.getByText('Logging in...')).toBeInTheDocument()
    })

    it('calls posthog.identify when session exists', async () => {
        const session = { user: { id: 'user-1', email: 'test@example.com', name: 'Test User', own_team_id: 'team-1' } }
        useSessionStore.setState({
            fetchSession: jest.fn(async () => {
                useSessionStore.setState({ session, loaded: true } as any)
            }),
        } as any)

        await act(async () => {
            render(<Login searchParams={{}} />)
        })

        expect(mockPosthogIdentify).toHaveBeenCalledWith(
            'user-1',
            { email: 'test@example.com', name: 'Test User', plan: 'free' }
        )
    })

    it('does not validate invite in MCP mode', () => {
        render(<Login searchParams={{ mcp: '1', response_type: 'code', client_id: 'c', redirect_uri: 'http://x/cb', state: 's', code_challenge: 'ch', inviteId: 'some-invite' }} />)

        expect(mockValidateInvites).not.toHaveBeenCalled()
    })
})
