import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"

export type MSRSession = {
    access_token: string
    refresh_token: string
}

export type MSRSessionFull = MSRSession & {
    user: {
        id: string
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

const sessionKey = "msr-session"

/**
 * MeasureAuth encapsulates session management, JWT handling, OAuth sign-in helpers,
 * and API request functionality in one module.
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

    /* ----------------- Session and Storage Helpers ----------------- */

    private storeSession(session: MSRSession) {
        if (!globalThis.localStorage) {
            throw new Error("localStorage is not available")
        }
        localStorage.setItem(sessionKey, JSON.stringify(session))
    }

    private loadSession(): MSRSession | undefined {
        if (!globalThis.localStorage) {
            throw new Error("localStorage is not available")
        }
        const value = localStorage.getItem(sessionKey)
        if (!value) return undefined
        return JSON.parse(value)
    }

    private clearSession(): void {
        if (globalThis.localStorage) {
            localStorage.removeItem(sessionKey)
        }
    }

    /* ----------------- JWT and Helper Functions ----------------- */

    public decodeJWT(token: string) {
        const [encodedHeader, encodedPayload] = token.split('.')
        const header = JSON.parse(atob(encodedHeader))
        const payload = JSON.parse(atob(encodedPayload))
        return { header, payload }
    }

    private validateJWT(token: string): boolean {
        const { header, payload } = this.decodeJWT(token)
        const now = Math.floor(Date.now() / 1000)
        return header.alg === 'HS256' && header.typ === 'JWT' && now <= payload.exp
    }

    private needsRefresh(token: string): boolean {
        const { payload } = this.decodeJWT(token)
        const now = Math.floor(Date.now() / 1000)
        // Refresh if the token expires in the next five minutes.
        return payload.exp < now + 5 * 60
    }

    private base64UrlEncode(input: string) {
        let base64 = btoa(input)
        return base64
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '')
    }

    private base64UrlDecode(input: string): string {
        let base64 = input.replace(/-/g, '+').replace(/_/g, '/')
        // Add '=' padding when needed.
        while (base64.length % 4 !== 0) {
            base64 += '='
        }
        return atob(base64)
    }

    public encodeOAuthState(path: string = ""): string {
        const state: OAuthState = {
            random: this.getRandomValues(32),
            path,
        }
        const json = JSON.stringify(state)
        return this.base64UrlEncode(json)
    }

    private decodeOAuthState(input: string): OAuthState {
        return JSON.parse(this.base64UrlDecode(input))
    }

    private getRandomValues(len: number): string {
        const arr = crypto.getRandomValues(new Uint8Array(len))
        return Array.from(arr, byte => byte.toString(16).padStart(2, '0')).join('')
    }

    /* ----------------- Session Refresh and URL Parsing ----------------- */

    /**
     * Extracts session tokens from the URL hash and stores them.
     * If a "next" path is encoded in the state, it adjusts the URL accordingly.
     */
    private storeSessionFromURL(currURL: string) {
        const url = new URL(currURL)
        let hash = url.hash
        if (!hash.includes("access_token") && !hash.includes("refresh_token")) {
            return
        }
        // Remove '#' from the beginning.
        hash = hash.substring(1)
        const params = new URLSearchParams(hash)
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        const state = params.get('state')

        if (!access_token || !refresh_token) {
            return
        }

        if (state) {
            const { path } = this.decodeOAuthState(state)
            if (path && path !== "") {
                url.pathname = path
            }
        }
        this.storeSession({ access_token, refresh_token })
        url.hash = ''
        history.replaceState(null, '', url.toString())
    }

    private async refreshSession(): Promise<MSRSession> {
        const session = this.loadSession()
        if (!session) {
            throw new Error("Could not retrieve session")
        }
        const url = new URL("/auth/refresh", this.apiOrigin)
        const res = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.refresh_token}`,
            },
        })
        if (!res.ok) {
            throw new Error("Failed to refresh session")
        }
        const data = await res.json()
        this.storeSession(data)
        return data
    }

    /* ----------------- Public Methods ----------------- */

    /**
     * Initializes the auth module by checking the URL for tokens.
     * If no session is found, it redirects to the login page.
     */
    public init(router: AppRouterInstance): void {
        this.router = router
        if (globalThis.window) {
            this.storeSessionFromURL(window.location.href)
            const session = this.loadSession()
            if (!session && 'location' in window) {
                window.location.assign("/auth/login")
            }
        }
    }

    /**
     * Retrieves and returns the current session.
     * If not available, returns an error.
     */
    public getSession(): { session: null; error: Error } | { session: MSRSessionFull; error: null } {
        let error: Error | null = null
        if (!globalThis.localStorage) {
            error = new Error("localStorage is not available")
            return { session: null, error }
        }
        const serialized = localStorage.getItem(sessionKey)
        if (!serialized) {
            error = new Error("Session not available")
            return { session: null, error }
        }
        let session: MSRSessionFull
        try {
            session = JSON.parse(serialized)
        } catch (e) {
            throw new Error("Failed to parse session")
        }
        // Enrich the session with the user ID from the JWT.
        const { payload } = this.decodeJWT(session.access_token)
        session.user = { id: payload["sub"] }
        return { session, error: null }
    }

    /**
     * Signs out the current user by calling the backend sign-out API (if valid),
     * then clears the session from local storage.
     */
    public async signout(): Promise<void> {
        const session = this.loadSession()
        if (!session) {
            return
        }
        if (this.validateJWT(session.refresh_token)) {
            const url = new URL("/auth/signout", this.apiOrigin)
            await fetch(url.toString(), {
                method: "DELETE",
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.refresh_token}`,
                },
            })
        }
        this.clearSession()
    }

    /* ----------------- Proxied Fetch with Automatic Refresh ----------------- */

    /**
     * Proxies fetch requests to automatically refresh tokens if needed,
     * attach the access token in headers, and avoid duplicate in-flight requests.
     */
    public async fetchMeasure(resource: string | Request | URL, config: RequestInit = {}): Promise<Response> {
        let session = this.loadSession()
        if (!session) {
            this.clearSession()
            if (typeof window !== "undefined" && 'location' in window) {
                window.location.assign("/auth/login")
            }
            throw new Error("Could not retrieve session")
        }
        if (this.needsRefresh(session.access_token)) {
            try {
                session = await this.refreshSession()
            } catch (e) {
                console.error("Session refresh failed:", e)
                this.clearSession()
                if (typeof window !== "undefined" && 'location' in window) {
                    window.location.assign("/auth/login")
                }
            }
        }

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
        const existingController = this.inFlightRequests.get(endpoint)
        if (existingController && !endpoint.includes('shortFilters')) {
            existingController.abort()
            this.inFlightRequests.delete(endpoint)
        }
        const controller = new AbortController()
        this.inFlightRequests.set(endpoint, controller)

        const newConfig: RequestInit = {
            ...config,
            signal: controller.signal,
            headers: {
                ...(config.headers || {}),
                'Authorization': `Bearer ${session.access_token}`,
            },
        }

        try {
            const response = await fetch(resource, newConfig)
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

    /* ----------------- OAuth Sign In ----------------- */

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
    * Gets the current user's ID or redirects to login if not authenticated.
    */
    public async getUserIdOrRedirectToAuth(): Promise<string | null> {
        const result = this.getSession()
        if (result.error) {
            await this.signout()
            this.router?.push('/auth/login')
            return null
        }
        return result.session.user.id
    }

    /**
     * Checks for authentication errors in a response and logs out if needed.
     */
    public async logoutIfAuthError(
        res: Response
    ) {
        if (res.status === 401) {
            await this.signout()
            this.router?.push('/auth/logout')
        }
    }

    /**
     * Logs out the current user.
     */
    public async logout(
    ) {
        await this.signout()
        this.router?.push("/auth/login")
    }
}

export const measureAuth = new MeasureAuth(process.env.NEXT_PUBLIC_API_BASE_URL!)


