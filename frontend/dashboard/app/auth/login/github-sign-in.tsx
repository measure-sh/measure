"use client"

import { measureAuth } from "@/app/auth/measure_auth";
import { Button } from "@/app/components/button";
import Image from "next/image";

async function doGitHubLogin() {
  const { origin } = new URL(window.location.href)
  const { url, error } = await measureAuth.oAuthSignin({
    clientId: process?.env?.NEXT_PUBLIC_OAUTH_GITHUB_KEY,
    options: {
      redirectTo: `${origin}/auth/callback/github`,
      next: "",
    },
  })

  if (error) {
    console.error(`failed to login using GitHub`, error)
    return
  }

  if (url) {
    window.location.assign(url)
  }
}

export default function GitHubSignIn() {
  return (
    <Button
      variant="outline"
      size={"lg"}
      className="group justify-center w-full font-display border-2 border-border"
      onClick={() => doGitHubLogin()}
    >
      <Image
        src="/images/github_logo_black.svg"
        width={24}
        height={24}
        className="w-4 h-4 dark:hidden group-hover:hidden"
        alt={"GitHub logo"}
      />
      <Image
        src="/images/github_logo_white.svg"
        width={24}
        height={24}
        className="w-4 h-4 hidden dark:block group-hover:block"
        alt={"GitHub logo"}
      />
      <span> Sign in with GitHub</span>
    </Button>
  )
}
