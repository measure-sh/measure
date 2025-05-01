import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"

export type MeasureAuthSession = {
    user: {
        id: string,
        own_team_id: string
        name: string,
        email: string,
        confirmed_at: string,
        last_sign_in_at: string,
        created_at: string,
        updated_at: string,
    }
}

export type OAuthState = {
    random: string
    path: string
}

export type OAuthOptions = {
    provider: 'github' | 'google'
    clientId: string | undefined
    options: {
        redirectTo: URL | string
        next: URL | string
    }
}

/**
 * MeasureAuth encapsulates login, logout and session management.
 * It also has a fetch method that automatically refreshes the access token
 * when it expires and retries the original request along with duplicate
 * request cancellation.
 */
export class MeasureAuth {
    private apiOrigin: string
    private inFlightRequests = new Map<string, AbortController>()
    private router: AppRouterInstance | null = null

    constructor(apiOrigin: string) {
        if (!apiOrigin) {
            throw new Error("`apiOrigin` is required")
        }
        this.apiOrigin = apiOrigin
    }

    /**
     * Initializes the auth module
     */
    public init(router: AppRouterInstance): void {
        this.router = router
    }

    private base64UrlEncode(input: string) {
        let base64 = btoa(input)
        return base64
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '')
    }

    public encodeOAuthState(path: string = ""): string {
        const state: OAuthState = {
            random: this.getRandomValues(32),
            path,
        }
        const json = JSON.stringify(state)
        return this.base64UrlEncode(json)
    }

    private getRandomValues(len: number): string {
        const arr = crypto.getRandomValues(new Uint8Array(len))
        return Array.from(arr, byte => byte.toString(16).padStart(2, '0')).join('')
    }

    private redirectToLogin(): void {
        if (!this.router) {
            throw new Error("Router is not initialized. Call `init` method first.")
        }
        this.router.replace("/auth/login")
    }

    /**
     * Initiates an OAuth sign-in flow.
     * It creates an OAuth state, contacts the backend to initialize the flow,
     * and then constructs the external OAuth URL.
     */
    public async oAuthSignin(options: OAuthOptions): Promise<{ url?: URL; error?: Error }> {
        if (!options.clientId) {
            throw new Error("`clientId` is required")
        }
        const state = this.encodeOAuthState(options.options.next.toString())
        // Determine the endpoint based on the provider.
        const path = options.provider === 'github' ? '/auth/github' : '/auth/google'
        const url = new URL(path, this.apiOrigin)
        const body = JSON.stringify({ type: "init", state })
        const res = await fetch(url.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
        })
        const json = await res.json()

        let error: Error | undefined
        if (res.status === 400) {
            error = new Error(`Bad request: ${json?.error}`)
        } else if (res.status === 401) {
            error = new Error(`Unauthorized: ${json?.error}`)
        }
        if (error) {
            return { error }
        }
        // Construct the OAuth URL.
        const oauthUrl = new URL("https://github.com/login/oauth/authorize")
        oauthUrl.searchParams.append("scope", "user:email")
        oauthUrl.searchParams.append("client_id", options.clientId)
        oauthUrl.searchParams.append("state", state)
        oauthUrl.searchParams.append("redirect_uri", options.options.redirectTo.toString())
        return { url: oauthUrl }
    }

    /**
     * Retrieves the current session from the server and returns it.
     * If no session is found, it returns null and redirects user to login page.
     */
    public async getSession(): Promise<{ session: null; error: Error } | { session: MeasureAuthSession; error: null }> {
        try {
            const res = await this.fetchMeasure(`${this.apiOrigin}/auth/session`)

            if (!res.ok) {
                throw new Error("Failed to retrieve session data")
            }

            const data = await res.json()

            if (!data.user) {
                return { session: null, error: new Error("No user in session") }
            }

            // Construct a session object from the response
            const session: MeasureAuthSession = {
                user: {
                    id: data.user.id,
                    own_team_id: data.user.own_team_id,
                    name: data.user.name,
                    email: data.user.email,
                    confirmed_at: data.user.confirmed_at,
                    last_sign_in_at: data.user.last_sign_in_at,
                    created_at: data.user.created_at,
                    updated_at: data.user.updated_at,
                },
            }

            return { session, error: null }
        } catch (error) {
            return {
                session: null,
                error: error instanceof Error ? error : new Error("Unknown error getting session")
            }
        }
    }

    /**
    * Refresh the access token using the refresh token
    * @private
    */
    private async refreshToken(): Promise<Response> {
        const refreshEndpoint = `/auth/refresh`

        // Create a separate controller for the refresh request
        const controller = new AbortController()

        const config: RequestInit = {
            method: 'POST',
            credentials: 'include',
            signal: controller.signal
        }

        try {
            return await fetch(refreshEndpoint, config)
        } catch (error) {
            console.error('Failed to refresh token:', error)
            throw error
        }
    }

    /**
     * Signs out the current user by calling the backend sign-out API
     */
    public async signout(): Promise<void> {
        await fetch(`/auth/logout`, {
            method: "DELETE",
            credentials: 'include'
        })

        // Redirect to login page after successful logout
        this.redirectToLogin()
    }

    /**
    * Proxies fetch requests to automatically refresh tokens if needed
    * and cancels duplicate in-flight requests with some exceptions.
    */
    public async fetchMeasure(resource: string | Request | URL, config: RequestInit = {}, redirectToLogin: Boolean = true): Promise<Response> {
        const getEndpoint = (res: string | Request | URL): string => {
            let urlStr: string
            if (res instanceof Request) {
                urlStr = res.url
            } else if (res instanceof URL) {
                urlStr = res.toString()
            } else {
                urlStr = res
            }
            try {
                const url = new URL(urlStr)
                return `${url.origin}${url.pathname}`
            } catch {
                return urlStr.split('?')[0]
            }
        }

        const endpoint = getEndpoint(resource)

        // Skip token refresh if we're already refreshing
        const isRefreshRequest = endpoint === `/auth/refresh`

        // Abort existing requests for the same endpoint (except for shortFilters)
        const existingController = this.inFlightRequests.get(endpoint)
        if (existingController && !endpoint.includes('shortFilters')) {
            existingController.abort()
            this.inFlightRequests.delete(endpoint)
        }

        const controller = new AbortController()
        this.inFlightRequests.set(endpoint, controller)

        const newConfig: RequestInit = {
            ...config,
            credentials: 'include',
            signal: controller.signal,
            headers: {
                ...(config.headers || {})
            },
        }

        try {
            // Make the request
            let response = await fetch(resource, newConfig)

            // If we get a 401 Unauthorized and it's not already a refresh request
            if (response.status === 401 && !isRefreshRequest) {
                // Try to refresh the token
                const refreshResponse = await this.refreshToken()

                // If refresh was successful, retry the original request
                if (refreshResponse.ok) {
                    this.inFlightRequests.delete(endpoint)
                    const retryController = new AbortController()
                    this.inFlightRequests.set(endpoint, retryController)

                    const retryConfig: RequestInit = {
                        ...config,
                        credentials: 'include',
                        signal: retryController.signal,
                        headers: {
                            ...(config.headers || {})
                        },
                    }

                    response = await fetch(resource, retryConfig)

                    if (response.status === 401 && redirectToLogin) {
                        // If response is still 401 after refresh and retry has been attempted, redirect to login
                        this.redirectToLogin()
                    }
                } else if (refreshResponse.status === 401 && redirectToLogin) {
                    // If refresh token is also expired, redirect to login
                    this.redirectToLogin()
                }
            }

            return response
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                console.log(`Request to ${endpoint} was cancelled`)
            }
            throw error
        } finally {
            this.inFlightRequests.delete(endpoint)
        }
    }


}

export const measureAuth = new MeasureAuth(process.env.NEXT_PUBLIC_API_BASE_URL!)


