import { PostHog } from 'posthog-node'

let posthogInstance = null

/// Create a noop PostHog client using Proxy
const createNoopPosthogServer = () => {
    return new Proxy({}, {
        get: () => async () => { }
    })
}

export function getPosthogServer() {
    if (!posthogInstance) {
        const apiKey = process.env.POSTHOG_API_KEY

        // Only initialize if we have an API key
        const shouldInit = apiKey

        if (shouldInit) {
            posthogInstance = new PostHog(
                apiKey,
                {
                    host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
                    flushAt: 1,
                    flushInterval: 0
                }
            )
        } else {
            posthogInstance = createNoopPosthogServer()
        }
    }
    return posthogInstance
}