import { CookieBanner } from '@/app/components/cookie_banner'
import { describe, expect, it, beforeEach } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { usePostHog } from 'posthog-js/react'

jest.mock('posthog-js/react', () => ({
    usePostHog: jest.fn(),
}))

const mockPostHog = {
    get_explicit_consent_status: jest.fn(),
    opt_in_capturing: jest.fn(),
    opt_out_capturing: jest.fn(),
}

beforeEach(() => {
    ;(usePostHog as jest.Mock).mockReturnValue(mockPostHog)
})

describe('CookieBanner', () => {
    it('does not render banner when posthog is not available', () => {
        ;(usePostHog as jest.Mock).mockReturnValue(null)

        render(<CookieBanner />)

        expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument()
    })

    it('does not render banner when consent is denied', () => {
        mockPostHog.get_explicit_consent_status.mockReturnValue('denied')

        render(<CookieBanner />)

        expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument()
    })

    it('does not render banner when PostHog is blocked and noop returns denied', () => {
        // Simulates the canary-fetch blocked case: createNoopPostHog returns 'denied'
        mockPostHog.get_explicit_consent_status.mockReturnValue('denied')

        render(<CookieBanner />)

        expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument()
    })

    it('does not render banner when consent is granted', () => {
        mockPostHog.get_explicit_consent_status.mockReturnValue('granted')

        render(<CookieBanner />)

        expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument()
    })

    it('renders banner when consent is pending', () => {
        mockPostHog.get_explicit_consent_status.mockReturnValue('pending')

        render(<CookieBanner />)

        expect(screen.getByText(/we use cookies/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /accept all/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /accept essential/i })).toBeInTheDocument()
    })

    it('calls opt_in_capturing and hides banner when Accept All is clicked', () => {
        mockPostHog.get_explicit_consent_status.mockReturnValue('pending')

        render(<CookieBanner />)
        fireEvent.click(screen.getByRole('button', { name: /accept all/i }))

        expect(mockPostHog.opt_in_capturing).toHaveBeenCalledTimes(1)
        expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument()
    })

    it('calls opt_out_capturing and hides banner when Accept Essential is clicked', () => {
        mockPostHog.get_explicit_consent_status.mockReturnValue('pending')

        render(<CookieBanner />)
        fireEvent.click(screen.getByRole('button', { name: /accept essential/i }))

        expect(mockPostHog.opt_out_capturing).toHaveBeenCalledTimes(1)
        expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument()
    })
})
