'use client'

import { useEffect, useMemo } from "react"

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'

// Create a noop PostHog client that matches the PostHog interface
const createNoopPostHog = () => {
    const noop = () => { }
    const noopReturning = () => undefined

    return new Proxy({} as typeof posthog, {
        get: () => noop || noopReturning
    })
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_API_KEY
    const shouldInit = apiKey

    useEffect(() => {
        if (shouldInit) {
            posthog.init(apiKey as string, {
                api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
                person_profiles: 'identified_only',
                defaults: '2025-05-24',
                cookieless_mode: 'on_reject'
            })
        }
    }, [shouldInit])

    const client = useMemo(() => {
        return shouldInit ? posthog : createNoopPostHog()
    }, [shouldInit])

    return (
        <PHProvider client={client}>
            {children}
        </PHProvider>
    )
}
