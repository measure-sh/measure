import { createServerClient as createClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const createAdminClient = () => {
  const cookieStore = cookies()

  return createClient(process?.env?.NEXT_PUBLIC_SUPABASE_URL!, process?.env?.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!, {
    cookies: {
      // cookies are read-only for server side ssr
      get(name: string) {
        return cookieStore.get(name)?.value
      }
    }
  })
}