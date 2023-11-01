'use client'

import { useSearchParams } from "next/navigation"

export default function Messages() {
  const searchParams = useSearchParams()
  const error = searchParams?.get('error')
  const message = searchParams?.get('message')

  return (
    <div className="text-center font-display">
      {error && (
        <>
          <p className="mt-4 p-4 text-red-600">{error}</p>
          <a href="/auth/login" className="underline text-blue-500 hover:text-blue-700">Go back to login</a>
        </>
      )}
      {message && (
        <>
          <p className="mt-2 p-4">We've sent a magic link to your inbox.</p>
          <p className="mt-2 p-4 text-black">{message}</p>
        </>
      )}
    </div>
  )
}