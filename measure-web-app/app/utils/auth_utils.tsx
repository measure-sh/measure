import { createClient } from '@supabase/supabase-js'
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context';

// Utility function to try and access current access token. If session retrieval
// fails for any reason, logout will be called and the user will be redirected to auth
export async function getAccessTokenOrRedirectToAuth(router: AppRouterInstance) {  
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  
    const { data: {session}, error } = await supabase.auth.getSession()
  
    if(error) {
      await supabase.auth.signOut()
      router.push('/auth/logout')
      return null
    }
  
    return session!.access_token;
  }
  
  // Utility function to check if API reponse has an authentication error.
  // If it does, logout will be called and the user will be redirected to auth
  export async function logoutIfAuthError(router: AppRouterInstance, res: Response) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  
    if(res.status === 401) {
      await supabase.auth.signOut()
      router.push('/auth/logout')
      return
    }
  }