import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"
import posthog from "posthog-js"

/**
 * ApiClient is a thin wrapper around fetch that handles:
 * - Cookie-based credentials
 * - Token refresh on 401 responses with retry of the original request
 * - Posthog metrics for API calls
 *
 * It does not manage auth state — that lives in useSessionStore.
 * It does not deduplicate, cache or track in-flight requests — those concerns
 * are owned by the store layer (see app/stores/utils/in_flight.ts).
 */
export class ApiClient {
  private router: AppRouterInstance | null = null

  /**
   * Stores the Next.js router so the client can navigate to /auth/login
   * when authentication fails.
   */
  public init(router: AppRouterInstance): void {
    this.router = router
  }

  /**
   * Navigates the user to the login page. Used internally on auth failures.
   */
  public redirectToLogin(): void {
    posthog.reset()

    if (!this.router) {
      throw new Error("Router is not initialized. Call `init` method first.")
    }
    this.router.replace("/auth/login")
  }

  /**
   * Refresh the access token using the refresh token cookie.
   */
  private async refreshToken(): Promise<Response> {
    const refreshEndpoint = `/auth/refresh`

    const config: RequestInit = {
      method: "POST",
      credentials: "include",
    }

    try {
      return await fetch(refreshEndpoint, config)
    } catch (error) {
      console.error("Failed to refresh token:", error)
      throw error
    }
  }

  /**
   * Proxies fetch requests with automatic token refresh on 401.
   */
  public async fetch(
    resource: string | Request | URL,
    config: RequestInit = {},
    redirectToLogin: boolean = true,
  ): Promise<Response> {
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
        return urlStr.split("?")[0]
      }
    }

    const endpoint = getEndpoint(resource)
    const metricEndpoint = endpoint.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ":id",
    )

    const isRefreshRequest = endpoint === `/auth/refresh`

    const newConfig: RequestInit = {
      ...config,
      credentials: "include",
      headers: {
        ...(config.headers || {}),
      },
    }

    const method = (config.method || "GET").toUpperCase()

    const start = performance.now()
    let response = await fetch(resource, newConfig)
    const latencyMs = Math.round(performance.now() - start)

    if (!isRefreshRequest) {
      posthog.capture("api_call_completed", {
        endpoint: metricEndpoint,
        method,
        status_code: response.status,
        latency_ms: latencyMs,
        success: response.ok,
      })
    }

    if (response.status === 401 && !isRefreshRequest) {
      const refreshResponse = await this.refreshToken()

      if (refreshResponse.ok) {
        const retryConfig: RequestInit = {
          ...config,
          credentials: "include",
          headers: {
            ...(config.headers || {}),
          },
        }

        const retryStart = performance.now()
        response = await fetch(resource, retryConfig)
        const retryLatencyMs = Math.round(performance.now() - retryStart)

        posthog.capture("api_call_completed", {
          endpoint,
          method,
          status_code: response.status,
          latency_ms: retryLatencyMs,
          success: response.ok,
          retried: true,
        })

        if (response.status === 401 && redirectToLogin) {
          this.redirectToLogin()
        }
      } else if (refreshResponse.status === 401 && redirectToLogin) {
        this.redirectToLogin()
      }
    }

    return response
  }
}

export const apiClient = new ApiClient()
