'use client';

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Messages from "./messages"
import GoogleSignIn from "./google-sign-in"
import GitHubSignIn from "./github-sign-in"
import { getSession, decodeJWT } from "@/app/utils/auth/auth"
import Script from "next/script"

export default function Login({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const error = searchParams["error"]
  const message = searchParams["message"]
  const [loading, setLoading] = useState(true)
  const [home, setHome] = useState("")
  const loggedIn = home === "" && loading === false ? false : true
  const router = useRouter()
  const initial = !Boolean(error || message)

  useEffect(() => {
    setLoading(false)
    const { session } = getSession()
    if (!session) {
      return
    }

    const { payload } = decodeJWT(session.access_token)
    const url = `/${payload["team"]}/overview`
    setHome(url)
    router.replace(url)
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
      {/* a fixed max-width is best as the google sign-in button has a width constraint */}
      <div className="w-full space-y-6" style={{ width: "400px" }}>
        {home && <p className="font-body text-center">Logging in...</p>}
        {!loggedIn && initial && (
          <>
            <Script src="https://accounts.google.com/gsi/client" />
            <GoogleSignIn />
          </>
        )}
      </div>
      <div className="my-6 place-content-end" style={{ width: "400px" }}>
        {!loggedIn && initial && <GitHubSignIn />}
      </div>
      <Messages />
    </div>
  )
}