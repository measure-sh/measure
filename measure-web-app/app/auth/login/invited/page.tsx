"use client"

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase/browser';
import { syncSupabaseUserToMeasureServerFromBrowser } from '@/utils/supabase/sync_user_browser';

export default function Invited() {
  const router = useRouter()

  const loginUserWithInvitedUserCreds = async () => {
    const errRedirectUrl = `/auth/login?error=Could not sign in with email`

    const hash = window.location.hash.substring(1); // Remove the leading '#'
    const hashParams = new URLSearchParams(hash);

    const accessToken = hashParams.get('access_token')!
    const refreshToken = hashParams.get('refresh_token')!

    const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })

    if (error) {
      const msg = `failed to retrieve user session`
      console.log(msg, error)
      router.push(errRedirectUrl)
      return
    }

    const userCreationRes = await syncSupabaseUserToMeasureServerFromBrowser()
    if (!userCreationRes.ok) {
      router.push(errRedirectUrl)
      return
    }

    const invitedToTeamId = data.user!.user_metadata.invited_to_team_id
    console.log("invited to team id: " + invitedToTeamId)
    router.push(`/${invitedToTeamId}/overview`)
  }

  useEffect(() => {
    loginUserWithInvitedUserCreds()
  }, []);


  return (
    <div className="flex flex-col min-h-screen selection:bg-yellow-200/75 items-center justify-center p-24 pt-8">
      <div className="py-4" />
      <p className="font-display font-regular text-2xl max-w-6xl text-center">Welcome to Measure</p>
      <div className="py-4" />
      <p className="font-sans font-regular max-w-6xl text-center">Setting up your account...</p>
    </div>
  )
}
