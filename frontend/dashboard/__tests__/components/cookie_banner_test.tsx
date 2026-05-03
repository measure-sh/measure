import { CookieBanner } from '@/app/components/cookie_banner'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/app/context/cookie_consent', () => ({
    useCookieConsent: jest.fn(),
}))

import { useCookieConsent } from '@/app/context/cookie_consent'

const setConsent = jest.fn()

beforeEach(() => {
    setConsent.mockClear()
    ; (useCookieConsent as jest.Mock).mockReturnValue({
        consent: 'pending',
        setConsent,
        hydrated: true,
    })
})

describe('CookieBanner', () => {
    it('does not render banner before hydration', () => {
        ; (useCookieConsent as jest.Mock).mockReturnValue({
            consent: 'pending',
            setConsent,
            hydrated: false,
        })

        render(<CookieBanner />)

        expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument()
    })

    it('does not render banner when consent is denied', () => {
        ; (useCookieConsent as jest.Mock).mockReturnValue({
            consent: 'denied',
            setConsent,
            hydrated: true,
        })

        render(<CookieBanner />)

        expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument()
    })

    it('does not render banner when consent is granted', () => {
        ; (useCookieConsent as jest.Mock).mockReturnValue({
            consent: 'granted',
            setConsent,
            hydrated: true,
        })

        render(<CookieBanner />)

        expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument()
    })

    it('renders banner when consent is pending and hydrated', () => {
        render(<CookieBanner />)

        expect(screen.getByText(/we use cookies/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /accept all/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /accept essential/i })).toBeInTheDocument()
    })

    it('renders the full descriptive text', () => {
        render(<CookieBanner />)

        expect(screen.getByText(/we use cookies to understand how you use the product and help us improve it/i)).toBeInTheDocument()
    })

    it('renders privacy policy link with correct href and target', () => {
        render(<CookieBanner />)

        const link = screen.getByRole('link', { name: /privacy policy/i })
        expect(link).toBeInTheDocument()
        expect(link).toHaveAttribute('href', '/privacy-policy')
        expect(link).toHaveAttribute('target', '_blank')
    })

    it('renders both Accept All and Accept Essential buttons', () => {
        render(<CookieBanner />)

        expect(screen.getByRole('button', { name: /accept all/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /accept essential/i })).toBeInTheDocument()
    })

    it('calls setConsent("granted") when Accept All is clicked', () => {
        render(<CookieBanner />)
        fireEvent.click(screen.getByRole('button', { name: /accept all/i }))

        expect(setConsent).toHaveBeenCalledTimes(1)
        expect(setConsent).toHaveBeenCalledWith('granted')
    })

    it('calls setConsent("denied") when Accept Essential is clicked', () => {
        render(<CookieBanner />)
        fireEvent.click(screen.getByRole('button', { name: /accept essential/i }))

        expect(setConsent).toHaveBeenCalledTimes(1)
        expect(setConsent).toHaveBeenCalledWith('denied')
    })
})
