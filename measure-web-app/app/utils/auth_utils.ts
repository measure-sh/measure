import { Auth } from '@/utils/auth';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

// Utility function to try and access current user's ID. If session retrieval
// fails for any reason, logout will be called and the user will be redirected to auth
export async function getUserIdOrRedirectToAuth(auth: Auth, router: AppRouterInstance) {
  const { session, error } = auth.getSession()

  if (error) {
    await auth.signout();
    router.push('/auth/login');
    return null
  }

  return session!.user.id;
}

// Utility function to check if API reponse has an authentication error.
// If it does, logout will be called and the user will be redirected to auth
export async function logoutIfAuthError(auth: Auth, router: AppRouterInstance, res: Response) {
  if (res.status === 401) {
    await auth.signout()
    router.push('/auth/logout')
    return
  }
}

// Utility function to log out current logged in user
export async function logout(auth: Auth, router: AppRouterInstance) {
  await auth.signout();
  router.push("/auth/login");
}