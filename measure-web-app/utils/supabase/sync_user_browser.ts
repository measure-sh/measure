import { supabase } from "@/utils/supabase/browser"
import { syncSupabaseUserToMeasureServer } from "./sync_user"

export const syncSupabaseUserToMeasureServerFromBrowser = async () => {
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession()

    if (sessionErr) {
        return Response.error()
    }

    const { res, user } = await syncSupabaseUserToMeasureServer(session!, supabase)

    if (!res.ok) {
        return Response.error()
    }

    return Response.json({ msg: "Created/Updated user with payload: " + user, status: 201 })
}