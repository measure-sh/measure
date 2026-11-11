"use client";

import { QueryClient } from "@tanstack/react-query";

/** Data is considered stale immediately — every mount triggers a fresh fetch. */
export const QUERY_STALE_TIME = 0;

/** Cache evicted on unmount — no stale-flash on remount. */
export const QUERY_GC_TIME = 0;

// Keep cached data fresh for 5 minutes when navigating back to a page. A
// browser refresh fetches from the server so users can see new events.
export const BROWSER_CACHE = {
  staleTime: 5 * 60 * 1000,
  gcTime: 5 * 60 * 1000,
};

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
