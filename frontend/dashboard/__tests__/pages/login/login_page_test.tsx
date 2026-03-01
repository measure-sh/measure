import Login from '@/app/auth/login/page'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, render, screen } from '@testing-library/react'

const mockGetSession = jest.fn(() => Promise.resolve({ session: null }))

jest.mock('@/app/auth/measure_auth', () => ({
    measureAuth: {
        getSession: (...args: any[]) => mockGetSession.apply(null, args),
        encodeOAuthState: jest.fn(() => 'encoded-state'),
    },
    MeasureAuthSession: {},
}))

jest.mock('@/app/api/api_calls', () => ({
    ValidateInviteApiStatus: { Error: 'error', Success: 'success' },
    validateInvitesFromServer: jest.fn(() => Promise.resolve({ status: 'success' })),
}))

jest.mock('next/navigation', () => ({
    useRouter: () => ({ replace: jest.fn() }),
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
    posthog: { identify: jest.fn() },
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
        mockGetSession.mockClear()
        mockAssign.mockClear()
        process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com'
    })

    it('renders normal login when mcp param is absent', async () => {
        await act(async () => {
            render(<Login searchParams={{}} />)
        })

        // Should call getSession for normal login flow
        expect(mockGetSession).toHaveBeenCalled()
    })

    it('skips session check in MCP mode', () => {
        render(<Login searchParams={{ mcp: '1', response_type: 'code', client_id: 'test_client', redirect_uri: 'http://localhost/cb', state: 's', code_challenge: 'ch' }} />)

        // Should NOT call getSession in MCP mode
        expect(mockGetSession).not.toHaveBeenCalled()
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
})
