import GitHubSignIn from '@/app/auth/login/github-sign-in'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/app/auth/measure_auth', () => ({
    measureAuth: {
        oAuthSignin: jest.fn(() => Promise.resolve({ url: 'https://github.com/login/oauth/authorize?test=1', error: null })),
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

// Silence console.error from the component during tests
jest.spyOn(console, 'error').mockImplementation(() => {})

describe('GitHubSignIn', () => {
    beforeEach(() => {
        mockAssign.mockClear()
    })

    it('renders sign in with GitHub button', () => {
        render(<GitHubSignIn />)
        expect(screen.getByText('Sign in with GitHub')).toBeInTheDocument()
    })

    it('renders GitHub logo images', () => {
        render(<GitHubSignIn />)
        const logos = screen.getAllByAltText('GitHub logo')
        expect(logos.length).toBe(2) // black and white variants
    })

    it('MCP mode redirects to mcpAuthorizeUrl on click', () => {
        const mcpUrl = 'https://api.example.com/oauth/authorize?provider=github&client_id=test'
        render(<GitHubSignIn mcpAuthorizeUrl={mcpUrl} />)
        fireEvent.click(screen.getByText('Sign in with GitHub'))

        expect(mockAssign).toHaveBeenCalledWith(mcpUrl)
    })

    it('MCP mode does not call measureAuth.oAuthSignin', () => {
        const { measureAuth } = require('@/app/auth/measure_auth')
        measureAuth.oAuthSignin.mockClear()

        const mcpUrl = 'https://api.example.com/oauth/authorize?provider=github&client_id=test'
        render(<GitHubSignIn mcpAuthorizeUrl={mcpUrl} />)
        fireEvent.click(screen.getByText('Sign in with GitHub'))

        expect(measureAuth.oAuthSignin).not.toHaveBeenCalled()
    })

    it('normal mode calls measureAuth.oAuthSignin on click', () => {
        const { measureAuth } = require('@/app/auth/measure_auth')
        measureAuth.oAuthSignin.mockClear()

        render(<GitHubSignIn />)
        fireEvent.click(screen.getByText('Sign in with GitHub'))

        expect(measureAuth.oAuthSignin).toHaveBeenCalled()
    })

    it('normal mode does not redirect when oAuthSignin returns error', async () => {
        const { measureAuth } = require('@/app/auth/measure_auth')
        measureAuth.oAuthSignin.mockClear()
        measureAuth.oAuthSignin.mockResolvedValueOnce({
            url: null,
            error: 'something went wrong',
        })

        render(<GitHubSignIn />)
        fireEvent.click(screen.getByText('Sign in with GitHub'))

        await new Promise(resolve => setTimeout(resolve, 0))

        expect(mockAssign).not.toHaveBeenCalled()
    })

    it('normal mode redirects to GitHub OAuth URL', async () => {
        const { measureAuth } = require('@/app/auth/measure_auth')
        measureAuth.oAuthSignin.mockClear()
        measureAuth.oAuthSignin.mockResolvedValueOnce({
            url: 'https://github.com/login/oauth/authorize?client_id=test&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback%2Fgithub',
            error: null,
        })

        render(<GitHubSignIn />)
        fireEvent.click(screen.getByText('Sign in with GitHub'))

        await new Promise(resolve => setTimeout(resolve, 0))

        expect(mockAssign).toHaveBeenCalledTimes(1)
        const url = new URL(mockAssign.mock.calls[0][0] as string)
        expect(url.origin).toBe('https://github.com')
        expect(url.pathname).toBe('/login/oauth/authorize')
    })
})
