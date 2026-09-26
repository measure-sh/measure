"use client";

import { useQuery } from "@tanstack/react-query";

// This hook is kept out of query/hooks.ts because importing that module from a
// marketing page bundles the dashboard's API client and request functions into
// the page.

const AUTH_STATUS_TIMEOUT_MS = 1000;

// The hook calls fetch directly so marketing page views stay out of apiClient's
// per-request analytics.
export function useAuthStatusQuery() {
  return useQuery<boolean>({
    queryKey: ["authStatus"] as const,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/auth/status`, {
        signal: AbortSignal.any([
          signal,
          AbortSignal.timeout(AUTH_STATUS_TIMEOUT_MS),
        ]),
      });
      if (!res.ok) {
        throw new Error(`Auth status request failed with ${res.status}`);
      }
      const data = await res.json();
      return data.signed_in === true;
    },
  });
}
