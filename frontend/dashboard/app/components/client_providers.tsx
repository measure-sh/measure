"use client"

import { queryClient } from "@/app/query/query_client"
import { MeasureStoreProvider } from "@/app/stores/provider"
import { QueryClientProvider } from "@tanstack/react-query"

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <MeasureStoreProvider>{children}</MeasureStoreProvider>
    </QueryClientProvider>
  )
}
