"use client"

import { measureAuth } from "@/app/auth/measure_auth"
import { Button } from "@/app/components/button"
import Image from "next/image"

const googleClientID = process?.env?.NEXT_PUBLIC_OAUTH_GOOGLE_KEY

async function doGoogleLogin() {
  const { origin } = new URL(window.location.href)
  const state = measureAuth.encodeOAuthState("")

  await fetch("/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "init", state }),
  })

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  url.searchParams.set("client_id", googleClientID || "")
  url.searchParams.set("redirect_uri", `${origin}/auth/callback/google`)
  url.searchParams.set("state", state)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", "openid email profile")
  url.searchParams.set("access_type", "offline")
  url.searchParams.set("prompt", "consent")
  window.location.assign(url.toString())
}

export default function GoogleSignIn({ mcpAuthorizeUrl }: { mcpAuthorizeUrl?: string }) {
  const handleClick = () => {
    if (mcpAuthorizeUrl) {
      window.location.assign(mcpAuthorizeUrl)
      return
    }
    doGoogleLogin()
  }

  return (
    <Button
      variant="outline"
      size={"lg"}
      className="justify-center w-full font-display border-2 border-border"
      onClick={handleClick}
    >
      <Image
        src="/images/google_logo.svg"
        width={24}
        height={24}
        className="w-4 h-4"
        alt={"Google logo"}
      />
      <span> Sign in with Google</span>
    </Button>
  )
}
