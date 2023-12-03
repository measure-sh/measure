import { createServerClient as createClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"

export const createRouteClient = () => {
  const cookieStore = cookies()

  return createClient(process?.env?.NEXT_PUBLIC_SUPABASE_URL!, process?.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch (error) {
          console.log("failed to set cookie in route client:", error)
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options })
        } catch (error) {
          console.log("failed to remove cookie in route client:", error)
        }
      }
    }
  })
}