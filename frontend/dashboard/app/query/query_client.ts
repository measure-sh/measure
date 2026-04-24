"use client"

import { QueryClient } from "@tanstack/react-query"

/** Data is considered stale immediately — refetch on every mount, but gcTime
 *  keeps cached data visible instantly while the refetch happens in background */
export const QUERY_STALE_TIME = 0

/** Cached data kept this long after the last subscriber unmounts */
export const QUERY_GC_TIME = 5 * 60 * 1000 // 5 minutes

/** ShortCode cache TTL — backend cleans up after 1 hour, so expire well before */
export const SHORT_CODE_STALE_TIME = 5 * 60 * 1000 // 5 minutes

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIME,
      gcTime: QUERY_GC_TIME,
      refetchOnWindowFocus: false,
      retry: 0,
    },
  },
})
