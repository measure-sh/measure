"use client"

import { useState, useEffect } from "react"
import Messages from "../sign-up/messages"
import GoogleSignIn from "./google-sign-in"

export default function Login({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const error = searchParams["error"]
  const message = searchParams["message"]
  const initial = !Boolean(error || message)
  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    setIsClient(true)
  }, [])
  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* a fixed max-width is best as the google sign-in button has a max width constraint */}
      <div className="w-full space-y-8" style={{ maxWidth: "400px" }}>
        {initial && isClient && (
          <GoogleSignIn />
        )}
        {initial && !isClient && (
          <p className="font-display text-center text-gray-300" style={{ height: "4.5rem" }}>Loading social logins...</p>
        )}
        <p className="text-center text-lg font-display text-gray-400 before:line-through before:content-['\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0'] after:line-through after:content-['\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0\00a0']">
          <span className="ms-4 me-4">or continue with</span>
        </p>
        {initial && (
          <form className="mt-8 space-y-6" action="/auth/sign-up" method="post">
            <div className="rounded-md shadow-sm -space-y-px">
              <label htmlFor="auth-email" className="font-display my-1 block">Email</label>
              <input id="auth-email" type="email" placeholder="you@example.com" required className="w-full border border-black rounded-md outline-none focus-visible:outline-yellow-300 text-black py-2 px-4 font-sans placeholder:text-neutral-400" name="email" />
            </div>
            <div>
              <button type="submit" formAction="/auth/sign-up" className="outline-none hover:bg-yellow-200 focus-visible:bg-yellow-200 active:bg-yellow-300 font-display text-black border border-black rounded-md transition-colors duration-100 py-2 px-4 w-full">Sign In or Sign Up</button>
            </div>
          </form>
        )}
        <div className="flex items-center ">
          <p className="text-black font-display font-regular text-center w-full text-sm">You&apos;ll receive a Magic link in your inbox.</p>
        </div>
        <Messages />
      </div>
    </div>
  )
}