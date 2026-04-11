import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { createStore } from "zustand/vanilla"
import { apiClient } from "../api/api_client"
import { createInFlightTracker } from "./utils/in_flight"

export type SessionUser = {
  id: string
  own_team_id: string
  name: string
  email: string
  avatar_url: string
  confirmed_at: string
  last_sign_in_at: string
  created_at: string
  updated_at: string
}

export type Session = {
  user: SessionUser
}

export type OAuthState = {
  random: string
  path: string
}

export type OAuthSignInOptions = {
  clientId: string | undefined
  options: {
    redirectTo: URL | string
    next: URL | string
  }
}

interface SessionStoreState {
  session: Session | null
  error: Error | null
  loaded: boolean
}

interface SessionStoreActions {
  init: (router: AppRouterInstance) => void
  fetchSession: () => Promise<void>
  signOut: () => Promise<void>
  signInWithOAuth: (options: OAuthSignInOptions) => Promise<{ url?: URL; error?: Error }>
  encodeOAuthState: (path?: string) => string
  reset: () => void
}

export type SessionStore = SessionStoreState & SessionStoreActions

const initialState: SessionStoreState = {
  session: null,
  error: null,
  loaded: false,
}

function getRandomValues(len: number): string {
  const arr = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(arr, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function base64UrlEncode(input: string): string {
  const base64 = btoa(input)
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function createSessionStore() {
  return createStore<SessionStore>()((set, get) => {
    const fetchSessionTracker = createInFlightTracker()

    return {
      ...initialState,

      init: (router: AppRouterInstance) => {
        apiClient.init(router)
      },

      fetchSession: () => fetchSessionTracker('singleton', async () => {
        if (get().loaded && get().session) {
          return
        }
        try {
          const res = await apiClient.fetch(`/api/auth/session`)

          if (!res.ok) {
            set({ session: null, error: new Error("Failed to retrieve session data"), loaded: true })
            return
          }

          const data = await res.json()

          if (!data.user) {
            set({ session: null, error: new Error("No user in session"), loaded: true })
            return
          }

          const session: Session = {
            user: {
              id: data.user.id,
              own_team_id: data.user.own_team_id,
              name: data.user.name,
              email: data.user.email,
              avatar_url: data.user.avatar_url,
              confirmed_at: data.user.confirmed_at,
              last_sign_in_at: data.user.last_sign_in_at,
              created_at: data.user.created_at,
              updated_at: data.user.updated_at,
            },
          }

          set({ session, error: null, loaded: true })
        } catch (error) {
          set({
            session: null,
            error: error instanceof Error ? error : new Error("Unknown error getting session"),
            loaded: true,
          })
        }
      }),

      signOut: async () => {
        await fetch(`/auth/logout`, {
          method: "DELETE",
          credentials: "include",
        })
        apiClient.redirectToLogin()
      },

      encodeOAuthState: (path: string = "") => {
        const state: OAuthState = {
          random: getRandomValues(32),
          path,
        }
        return base64UrlEncode(JSON.stringify(state))
      },

      signInWithOAuth: async (options: OAuthSignInOptions) => {
        if (!options.clientId) {
          throw new Error("`clientId` is required")
        }
        const state: OAuthState = {
          random: getRandomValues(32),
          path: options.options.next.toString(),
        }
        const encodedState = base64UrlEncode(JSON.stringify(state))
        const body = JSON.stringify({ type: "init", state: encodedState })
        const res = await fetch("/api/auth/github", {
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

        const oauthUrl = new URL("https://github.com/login/oauth/authorize")
        oauthUrl.searchParams.append("scope", "user:email read:user")
        oauthUrl.searchParams.append("client_id", options.clientId)
        oauthUrl.searchParams.append("state", encodedState)
        oauthUrl.searchParams.append("redirect_uri", options.options.redirectTo.toString())
        return { url: oauthUrl }
      },

      reset: () => {
        fetchSessionTracker.clear()
        set(initialState)
      },
    }
  })
}
