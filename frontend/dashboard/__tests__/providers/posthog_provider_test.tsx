import { PostHogProvider } from '@/app/context/posthog'
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { usePostHog } from 'posthog-js/react'

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        init: jest.fn(),
        get_explicit_consent_status: jest.fn().mockReturnValue('pending'),
    },
}))

import posthog from 'posthog-js'

function ConsentStatusChild() {
    const ph = usePostHog()
    return <div data-testid="status">{ph?.get_explicit_consent_status?.() ?? ''}</div>
}

beforeEach(() => {
    ; (posthog.get_explicit_consent_status as jest.Mock).mockReturnValue('pending')
    process.env.NEXT_PUBLIC_POSTHOG_API_KEY = 'test-key'
    global.fetch = jest.fn().mockResolvedValue({ ok: true })
})

afterEach(() => {
    delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST
})

describe('PostHogProvider', () => {
    it('does not call posthog.init or fetch and uses noop client when no API key', () => {
        delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY

        render(
            <PostHogProvider>
                <ConsentStatusChild />
            </PostHogProvider>
        )

        expect(global.fetch).not.toHaveBeenCalled()
        expect(posthog.init).not.toHaveBeenCalled()
        expect(screen.getByTestId('status')).toHaveTextContent('denied')
    })

    it('calls posthog.init with correct params when API key is set and fetch resolves', async () => {
        render(
            <PostHogProvider>
                <ConsentStatusChild />
            </PostHogProvider>
        )

        await waitFor(() => {
            expect(posthog.init).toHaveBeenCalledWith('test-key', expect.objectContaining({
                api_host: 'https://us.i.posthog.com',
                person_profiles: 'identified_only',
                defaults: '2025-05-24',
                cookieless_mode: 'on_reject',
            }))
        })

        expect(screen.getByTestId('status')).toHaveTextContent('pending')
    })

    it('switches to noop client when canary fetch fails (ad blocked)', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('ERR_BLOCKED_BY_CLIENT'))

        render(
            <PostHogProvider>
                <ConsentStatusChild />
            </PostHogProvider>
        )

        // After the rejected promise settles, isBlocked=true → noop client → 'denied'
        await waitFor(() => {
            expect(screen.getByTestId('status')).toHaveTextContent('denied')
        })
    })

    it('canary fetch is called with the posthog host', async () => {
        render(
            <PostHogProvider>
                <div />
            </PostHogProvider>
        )

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('https://us.i.posthog.com')
        })
    })

    it('switches to noop client when canary fetch returns a non-success status', async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: false })

        render(
            <PostHogProvider>
                <ConsentStatusChild />
            </PostHogProvider>
        )

        await waitFor(() => {
            expect(screen.getByTestId('status')).toHaveTextContent('denied')
        })
    })

    it('uses custom host from NEXT_PUBLIC_POSTHOG_HOST env var', async () => {
        process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://custom.posthog.com'

        render(
            <PostHogProvider>
                <div />
            </PostHogProvider>
        )

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('https://custom.posthog.com')
            expect(posthog.init).toHaveBeenCalledWith(
                'test-key',
                expect.objectContaining({ api_host: 'https://custom.posthog.com' })
            )
        })
    })
})
