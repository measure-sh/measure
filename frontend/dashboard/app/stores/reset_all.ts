import { queryClient } from "@/app/query/query_client"
import type { MeasureStoreRegistry } from "./registry"

/**
 * Resets all state on logout: clears the TanStack Query cache and
 * resets the remaining Zustand stores.
 */
export function resetAllStores(registry: MeasureStoreRegistry): void {
  queryClient.clear()
  registry.filtersStore.getState().reset(true)
  registry.sessionStore.getState().reset()
  registry.userJourneysStore.getState().reset()
}
