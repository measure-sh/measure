import GoogleSignIn from '@/app/auth/login/google-sign-in'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

const mockFetch = jest.fn(() => Promise.resolve({ ok: true, status: 200 }))
global.fetch = mockFetch as any

jest.mock('@/app/auth/measure_auth', () => ({
    measureAuth: {
        encodeOAuthState: jest.fn(() => 'encoded-state'),
    },
}))

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ alt, ...props }: any) => <img alt={alt} {...props} />,
}))

// Mock window.location.assign
const mockAssign = jest.fn()
Object.defineProperty(window, 'location', {
    value: { ...window.location, assign: mockAssign, href: 'http://localhost:3000/auth/login' },
    writable: true,
})

describe('GoogleSignIn', () => {
    beforeEach(() => {
        mockAssign.mockClear()
        mockFetch.mockClear()
    })

    it('renders a button with Google logo', () => {
        render(<GoogleSignIn />)

        expect(screen.getByText('Sign in with Google')).toBeInTheDocument()
        // Should have black and white logo variants
        const logos = screen.getAllByAltText('Google logo')
        expect(logos.length).toBe(1)
    })

    it('normal mode calls fetch init and redirects to Google OAuth', async () => {
        render(<GoogleSignIn />)

        fireEvent.click(screen.getByText('Sign in with Google'))

        // Wait for async doGoogleLogin to complete
        await new Promise(resolve => setTimeout(resolve, 0))

        // Should have called fetch to init state
        expect(mockFetch).toHaveBeenCalledWith(
            '/api/auth/google',
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('"type":"init"'),
            })
        )

        // Should redirect to Google OAuth
        expect(mockAssign).toHaveBeenCalledTimes(1)
        const url = new URL(mockAssign.mock.calls[0][0] as string)
        expect(url.origin).toBe('https://accounts.google.com')
        expect(url.pathname).toBe('/o/oauth2/v2/auth')
        expect(url.searchParams.get('response_type')).toBe('code')
        expect(url.searchParams.get('scope')).toBe('openid email profile')
    })

    it('MCP mode redirects to mcpAuthorizeUrl on click', () => {
        const mcpUrl = 'https://api.example.com/oauth/authorize?provider=google&client_id=test'
        render(<GoogleSignIn mcpAuthorizeUrl={mcpUrl} />)

        fireEvent.click(screen.getByText('Sign in with Google'))
        expect(mockAssign).toHaveBeenCalledWith(mcpUrl)
    })

    it('MCP mode does not call fetch init', () => {
        const mcpUrl = 'https://api.example.com/oauth/authorize?provider=google&client_id=test'
        render(<GoogleSignIn mcpAuthorizeUrl={mcpUrl} />)

        fireEvent.click(screen.getByText('Sign in with Google'))
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it('normal mode still redirects when fetch init returns non-ok', async () => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

        render(<GoogleSignIn />)
        fireEvent.click(screen.getByText('Sign in with Google'))

        await new Promise(resolve => setTimeout(resolve, 0))

        // doGoogleLogin does not check the fetch response, so it still redirects
        expect(mockAssign).toHaveBeenCalledTimes(1)
        const url = new URL(mockAssign.mock.calls[0][0] as string)
        expect(url.origin).toBe('https://accounts.google.com')
    })
})
