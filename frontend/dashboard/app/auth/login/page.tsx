'use client'

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import Messages from "./messages"
import GoogleSignIn from "./google-sign-in"
import GitHubSignIn from "./github-sign-in"
import { measureAuth, MeasureAuthSession } from "@/app/auth/measure_auth"

export default function Login({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const error = searchParams["error"]
  const message = searchParams["message"]
  const [session, setSession] = useState<MeasureAuthSession | null>(null)
  const [home, setHome] = useState("")
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const getSession = async () => {
    const { session } = await measureAuth.getSession()
    if (session) {
      setSession(session)
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
      <Messages />
    </div>
  )
}