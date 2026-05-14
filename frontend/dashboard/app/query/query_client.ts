"use client";

import { QueryClient } from "@tanstack/react-query";

/** Data is considered stale immediately — every mount triggers a fresh fetch. */
export const QUERY_STALE_TIME = 0;

/** Cache evicted on unmount — no stale-flash on remount. */
export const QUERY_GC_TIME = 0;

/** ShortCode cache TTL — backend cleans up after 1 hour, so expire well before */
export const SHORT_CODE_STALE_TIME = 5 * 60 * 1000; // 5 minutes

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIME,
      gcTime: QUERY_GC_TIME,
      refetchOnWindowFocus: false,
      retry: 0,
    },
  },
});
