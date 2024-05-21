import { Session, SupabaseClient } from "@supabase/supabase-js"

export async function syncSupabaseUserToMeasureServer(session: Session, supabase: SupabaseClient) {
    const authToken = session!.access_token
    const user = (await supabase.auth.getUser()).data.user!

    const payload = {
        id: user.id,
        email: user.email,
        name: user.user_metadata.name,
        invited_by_user_id: user.user_metadata.invited_by_user_id,
        invited_to_team_id: user.user_metadata.invited_to_team_id,
        invited_as_role: user.user_metadata.invited_as_role,
        confirmed_at: user.confirmed_at,
        last_sign_in_at: user.last_sign_in_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
    }

    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        method: 'PUT',
        headers: {
            "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
    }

    const res = await fetch(`${origin}/users`, opts)
    return { res, user }
}
