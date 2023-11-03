"use client"

import { useEffect, useState } from "react"

export default function GoogleSignIn() {
  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    setIsClient(true)
  }, [])
  return (isClient ?
    <script src="https://accounts.google.com/gsi/client" async></script> : <p className="font-display text-center" style={{ height: "0.73rem" }}>Loading social logins...</p>
  )
}