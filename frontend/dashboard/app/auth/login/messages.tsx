'use client'

import { useSearchParams } from "next/navigation"
import Link from "next/link"

export default function Messages() {
  const searchParams = useSearchParams()
  const error = searchParams?.get('error')
  const message = searchParams?.get('message')
  let showLink = false
  if (error) {
    showLink = true
  }
  if (message) {
    showLink = true
  }

  return (
    <div className="text-center font-display">
      {error && (
        <>
          <p className="mt-4 text-red-600">{error}</p>
        </>
      )}
      {message && (
        <>
          <p className="mt-4 font-body text-center">{message}</p>
        </>
      )}
      {showLink && (
        <Link href="/auth/login" className="underline text-blue-500 hover:text-blue-700 mt-4 inline-block">Go back to login</Link>
      )}
    </div>
  )
}