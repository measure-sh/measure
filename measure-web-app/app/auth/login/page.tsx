import crypto from "node:crypto"
import Messages from "../sign-up/messages"
import GoogleSignIn from "./google-sign-in"
import GitHubSignIn from "./github-sign-in"

async function genNonce() {
  const nonce = crypto.randomBytes(16).toString("base64")
  const encoder = new TextEncoder()
  const encodedNonce = encoder.encode(nonce)
  const hash = await crypto.subtle.digest("SHA-256", encodedNonce)
  const bytes = new Uint8Array(hash)
  const hashedNonce = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join("")
  return { nonce, hashedNonce }
}

export default async function Login({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const error = searchParams["error"]
  const message = searchParams["message"]
  const initial = !Boolean(error || message)
  const { nonce, hashedNonce } = await genNonce()
  console.log(`created nonce: [${nonce}] & hashedNonce: [${hashedNonce}]`)
  const origin = process?.env?.NEXT_PUBLIC_SITE_URL

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* a fixed max-width is best as the google sign-in button has a width constraint */}
      <div className="w-full space-y-8" style={{ width: "400px" }}>
        {initial && (
          <>
            <div id="g_id_onload"
              data-client_id={process.env.NEXT_PUBLIC_MEASURE_GOOGLE_OAUTH_CLIENT_ID}
              data-context="signin"
              data-ux_mode="popup"
              data-nonce={hashedNonce}
              data-login_uri={`${origin}/auth/callback/google?nonce=${nonce}`}
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
              data-width="400">
            </div>
          </>
        )}
        {initial && <GitHubSignIn />}
        {initial && (
          <>
            <GoogleSignIn />
            <p className="text-center text-lg font-display before:line-through before:content-['\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0'] after:line-through after:content-['\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0']">
              <span className="ms-4 me-4">or continue with</span>
            </p>
            <form className="mt-8 space-y-6" action="/auth/sign-up" method="post">
              <div className="rounded-md shadow-sm -space-y-px">
                <label htmlFor="auth-email" className="font-display my-1 block">Email</label>
                <input id="auth-email" type="email" placeholder="you@example.com" required className="w-full border border-black rounded-md outline-none focus-visible:outline-yellow-300 text-black py-2 px-4 font-sans placeholder:text-neutral-400" name="email" />
              </div>
              <div>
                <button type="submit" formAction="/auth/sign-up" className="outline-none hover:bg-yellow-200 focus-visible:bg-yellow-200 active:bg-yellow-300 font-display text-black border border-black rounded-md transition-colors duration-100 py-2 px-4 w-full">Sign In or Sign Up</button>
              </div>
            </form>
            <div className="flex items-center ">
              <p className="text-black font-display font-regular text-center w-full text-sm">You&apos;ll receive a Magic link in your inbox.</p>
            </div>
          </>
        )}
        <Messages />
      </div>
    </div>
  )
}