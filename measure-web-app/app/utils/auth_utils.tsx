import { createBrowserClient } from '@/utils/supabase/browser';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context';

const supabase = createBrowserClient()

// Utility function to try and access current user's ID. If session retrieval
// fails for any reason, logout will be called and the user will be redirected to auth
export async function getUserIdOrRedirectToAuth(router: AppRouterInstance) {
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error) {
    await supabase.auth.signOut()
    router.push('/auth/logout')
    return null
  }

  return session!.user.id;
}

// Utility function to try and access current access token. If session retrieval
// fails for any reason, logout will be called and the user will be redirected to auth
export async function getAccessTokenOrRedirectToAuth(router: AppRouterInstance) {
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error) {
    await supabase.auth.signOut()
    router.push('/auth/logout')
    return null
  }

  return session!.access_token;
}

// Utility function to check if API reponse has an authentication error.
// If it does, logout will be called and the user will be redirected to auth
export async function logoutIfAuthError(router: AppRouterInstance, res: Response) {
  if (res.status === 401) {
    await supabase.auth.signOut()
    router.push('/auth/logout')
    return
  }
}

// Utility function to log out current logged in user
export async function logout(router: AppRouterInstance) {
  const supabase = createBrowserClient()
  await supabase.auth.signOut()
  router.push("/auth/logout")
}