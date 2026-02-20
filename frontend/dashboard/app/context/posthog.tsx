'use client'

import { useEffect, useMemo, useState } from "react"

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'

// Returns 'denied' so the cookie banner doesn't show when PostHog is unavailable
const createNoopPostHog = () => ({
    get_explicit_consent_status: () => 'denied',
    opt_in_capturing: () => { },
    opt_out_capturing: () => { },
    init: () => { },
    capture: () => { },
}) as unknown as typeof posthog

export function PostHogProvider({ children }: { children: React.ReactNode }) {
    const [isBlocked, setIsBlocked] = useState(true)
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_API_KEY
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

    useEffect(() => {
        if (apiKey) {
            // Canary fetch: fails instantly with ERR_BLOCKED_BY_CLIENT when ad-blocked
            fetch(host)
                .then(res => {
                    if (!res.ok) {
                        setIsBlocked(true)
                    } else {
                        setIsBlocked(false)
                    }
                })
                .catch(() => setIsBlocked(true))
        }
    }, [apiKey, host])

    const shouldInit = !!apiKey && !isBlocked

    useEffect(() => {
        if (shouldInit) {
            posthog.init(apiKey as string, {
                api_host: host,
                person_profiles: 'identified_only',
                defaults: '2025-05-24',
                cookieless_mode: 'on_reject'
            })
        }
    }, [shouldInit, apiKey, host])

    const client = useMemo(() => (shouldInit ? posthog : createNoopPostHog()), [shouldInit])

    return (
        <PHProvider client={client}>
            {children}
        </PHProvider>
    )
}
