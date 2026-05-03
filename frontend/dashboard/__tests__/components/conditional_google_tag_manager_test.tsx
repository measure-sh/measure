import { ConditionalGoogleTagManager } from '@/app/components/conditional_google_tag_manager'
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@next/third-parties/google', () => ({
    GoogleTagManager: ({ gtmId }: { gtmId: string }) => (
        <div data-testid="gtm" data-gtm-id={gtmId} />
    ),
}))

jest.mock('@/app/context/cookie_consent', () => ({
    useCookieConsent: jest.fn(),
}))

import { useCookieConsent } from '@/app/context/cookie_consent'

beforeEach(() => {
    process.env.NEXT_PUBLIC_GTM_ID = 'GTM-TEST'
    ; (useCookieConsent as jest.Mock).mockReturnValue({
        consent: 'granted',
        setConsent: jest.fn(),
        hydrated: true,
    })
})

afterEach(() => {
    delete process.env.NEXT_PUBLIC_GTM_ID
})

describe('ConditionalGoogleTagManager', () => {
    it('renders GoogleTagManager when consent is granted and GTM ID is set', () => {
        render(<ConditionalGoogleTagManager />)

        const gtm = screen.getByTestId('gtm')
        expect(gtm).toBeInTheDocument()
        expect(gtm).toHaveAttribute('data-gtm-id', 'GTM-TEST')
    })

    it('does not render when consent is pending', () => {
        ; (useCookieConsent as jest.Mock).mockReturnValue({
            consent: 'pending',
            setConsent: jest.fn(),
            hydrated: true,
        })

        render(<ConditionalGoogleTagManager />)

        expect(screen.queryByTestId('gtm')).not.toBeInTheDocument()
    })

    it('does not render when consent is denied', () => {
        ; (useCookieConsent as jest.Mock).mockReturnValue({
            consent: 'denied',
            setConsent: jest.fn(),
            hydrated: true,
        })

        render(<ConditionalGoogleTagManager />)

        expect(screen.queryByTestId('gtm')).not.toBeInTheDocument()
    })

    it('does not render when GTM ID is not set, even if consent is granted', () => {
        delete process.env.NEXT_PUBLIC_GTM_ID

        render(<ConditionalGoogleTagManager />)

        expect(screen.queryByTestId('gtm')).not.toBeInTheDocument()
    })
})
