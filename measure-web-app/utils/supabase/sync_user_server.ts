import { createAdminClient } from "@/utils/supabase/admin"
import { NextResponse } from "next/server"
import { syncSupabaseUserToMeasureServer } from "./sync_user"

export const syncSupabaseUserToMeasureServerFromServer = async () => {
    const supabase = createAdminClient()

    const { data: { session }, error: sessionErr } = await supabase.auth.getSession()

    if (sessionErr) {
        const msg = `Could not create/update user, failed to fetch supabase session`
        return NextResponse.json({ error: msg }, { status: 500 })
    }

    const { res, user } = await syncSupabaseUserToMeasureServer(session!, supabase)

    if (!res.ok) {
        return Response.error()
    }

    return Response.json({ msg: "Created/Updated user with payload: " + user, status: 201 })
}