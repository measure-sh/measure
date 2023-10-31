"use client"

import { useEffect, useState } from "react"

export default function GoogleSignIn() {
  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    setIsClient(true)
  }, [])
  return (isClient ?
    <script src="https://accounts.google.com/gsi/client" async></script> : <p className="font-display text-center text-gray-300" style={{ height: "2.5rem" }}>Loading social logins...</p>
  )
}