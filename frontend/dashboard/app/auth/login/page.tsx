'use client'

import { ValidateInviteApiStatus, validateInvitesFromServer } from "@/app/api/api_calls"
import { measureAuth, MeasureAuthSession } from "@/app/auth/measure_auth"
import { isMeasureHost } from "@/app/utils/url_utils"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { posthog } from "posthog-js"
import { useEffect, useState } from "react"
import GitHubSignIn from "./github-sign-in"
import GoogleSignIn from "./google-sign-in"
import Messages from "./messages"

export default function Login({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const error = searchParams["error"]
  const message = searchParams["message"]
  const inviteId = searchParams["inviteId"]
  const [session, setSession] = useState<MeasureAuthSession | null>(null)
  const [home, setHome] = useState("")
  const [loading, setLoading] = useState(true)
  const [inviteInvalid, setInviteInvalid] = useState(false)
  const router = useRouter()

  const validateInvite = async () => {
    const result = await validateInvitesFromServer(inviteId as string)

    switch (result.status) {
      case ValidateInviteApiStatus.Error:
        setInviteInvalid(true)
        break
      case ValidateInviteApiStatus.Success:
        setInviteInvalid(false)
        break
    }
  }

  useEffect(() => {
    if (inviteId) {
      validateInvite()
    }
  }, [inviteId])

  const getSession = async () => {
    const { session } = await measureAuth.getSession()
    if (session) {
      setSession(session)
      posthog.identify(
        session.user.id,
        { email: session.user.email, name: session.user.name, plan: "free" }
      );
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!session) {
      getSession()
      return
    }

    if (session) {
      const url = `/${session.user.own_team_id}/overview`
      setHome(url)
      router.replace(url)
    }
  }, [session])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
      {/* a fixed max-width is best as the google sign-in button has a width constraint */}
      <div className="w-full space-y-6" style={{ width: "400px" }}>
        {loading && <p className="font-body text-center">Loading...</p>}
        {home && <p className="font-body text-center">Logging in...</p>}
        {!loading && !session && !error && !message && <GoogleSignIn />}
      </div>
      <div className="my-6 place-content-end" style={{ width: "400px" }}>
        {!loading && !session && !error && !message && <GitHubSignIn />}
      </div>
      {inviteInvalid && (
        <p className="font-display text-center text-sm p-2 my-4 text-red-600">Invalid or expired invite link.</p>
      )}
      {isMeasureHost() && <p className="p-2 my-4 text-sm font-display text-gray-500">
        Measure Cloud is limited to alpha users at the moment. Please{" "}
        <Link
          target="_blank"
          className="underline decoration-2 underline-offset-2 decoration-yellow-200 hover:decoration-yellow-500"
          href="mailto:support@measure.sh"
        >
          contact us
        </Link>{" "}
        if you&apos;d like to be a part of it!
      </p>}
      <Messages />
    </div>
  )
}