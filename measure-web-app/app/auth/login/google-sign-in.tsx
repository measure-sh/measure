"use client"

import { useEffect, useState } from "react"
import { encodeOAuthState } from "@/utils/auth"

const origin = process?.env?.NEXT_PUBLIC_SITE_URL
const googleClientID = process?.env?.NEXT_PUBLIC_MEASURE_GOOGLE_OAUTH_CLIENT_ID

async function genNonce() {
  const buff = new Uint8Array(16)
  crypto.getRandomValues(buff)
  const nonce = Array.from(buff).map(b => b.toString(16).padStart(2, '0')).join("")
  const encoder = new TextEncoder()
  const encodedNonce = encoder.encode(nonce)
  const hash = await crypto.subtle.digest("SHA-256", encodedNonce)
  const bytes = new Uint8Array(hash)
  const hashedNonce = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join("")
  return { nonce, hashedNonce }
}

export default function GoogleSignIn() {
  const [nonce, setNonce] = useState("");
  const [hashedNonce, setHashedNonce] = useState("");
  const [state, setState] = useState("");

  useEffect(() => {
    genNonce().then(({ nonce, hashedNonce }) => {
      setNonce(nonce)
      setHashedNonce(hashedNonce)
    })

    const state = encodeOAuthState("")
    setState(state)
  }, [])

  return (
    <>
      <div id="g_id_onload"
        data-client_id={googleClientID}
        data-context="signin"
        data-ux_mode="popup"
        data-nonce={hashedNonce}
        data-login_uri={`${origin}/auth/callback/google?nonce=${encodeURIComponent(nonce)}&state=${encodeURIComponent(state)}`}
        data-auto_select="true"
        data-itp_support="true">
      </div>

      <div className="g_id_signin"
        data-type="standard"
        data-shape="rectangular"
        data-theme="outline"
        data-text="signin_with"
        data-size="large"
        data-logo_alignment="center"
        data-state={state}
        data-width="400">
      </div>
    </>
  )
}