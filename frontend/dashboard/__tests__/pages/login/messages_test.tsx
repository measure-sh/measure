import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

let mockSearchParams: URLSearchParams

jest.mock('next/navigation', () => ({
    useSearchParams: () => mockSearchParams,
}))

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, children, className }: any) => <a href={href} className={className}>{children}</a>,
}))

import Messages from '@/app/auth/login/messages'

describe('Messages', () => {
    it('shows error message and login link when error param is present', () => {
        mockSearchParams = new URLSearchParams('error=Something went wrong')
        render(<Messages />)
        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
        expect(screen.getByText('Go back to login')).toBeInTheDocument()
    })

    it('shows info message and login link when message param is present', () => {
        mockSearchParams = new URLSearchParams('message=Check your email')
        render(<Messages />)
        expect(screen.getByText('Check your email')).toBeInTheDocument()
        expect(screen.getByText('Go back to login')).toBeInTheDocument()
    })

    it('does not show login link when neither error nor message is present', () => {
        mockSearchParams = new URLSearchParams('')
        render(<Messages />)
        expect(screen.queryByText('Go back to login')).not.toBeInTheDocument()
    })

    it('shows both error and message when both are present', () => {
        mockSearchParams = new URLSearchParams('error=Error&message=Info')
        render(<Messages />)
        expect(screen.getByText('Error')).toBeInTheDocument()
        expect(screen.getByText('Info')).toBeInTheDocument()
    })

    it('login link points to /auth/login', () => {
        mockSearchParams = new URLSearchParams('error=Oops')
        render(<Messages />)
        expect(screen.getByText('Go back to login').closest('a')).toHaveAttribute('href', '/auth/login')
    })
})
