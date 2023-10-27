import Messages from "../sign-up/messages"

export default function Login({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const error = searchParams["error"]
  const message = searchParams["message"]
  const initial = !Boolean(error || message)
  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {initial && (
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold font-display text-gray-900">
              Sign in to your account
            </h2>
          </div>
        )}
        {initial && (
          <form className="mt-8 space-y-6" action="/auth/sign-up" method="post">
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="auth-email">Email</label>
                <input id="auth-email" type="email" placeholder="you@example.com" required className="w-full border border-black rounded-md outline-none focus-visible:outline-yellow-300 text-black py-2 px-4 font-sans placeholder:text-neutral-400" name="email" />
              </div>
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