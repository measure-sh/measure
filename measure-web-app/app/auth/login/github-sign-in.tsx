"use client"

import { createClient } from '@supabase/supabase-js'

async function doGitHubLogin() {
  const url = new URL(window.location.href)
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${url.origin}/dashboard/overview`,
    }
  })

  if (error) {
    console.error(`failed to login using GitHub`, error)
  }
}

export default function GitHubSignIn() {
  return <button className="mt-4 justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display text-black transition-colors duration-100 py-2 px-4 w-full" onClick={() => doGitHubLogin()}>Login with GitHub</button>
}