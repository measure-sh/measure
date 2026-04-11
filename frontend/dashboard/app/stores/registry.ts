/**
 * Central store registry for the remaining Zustand stores.
 * Data-fetching stores have been migrated to TanStack Query — see app/query/hooks.ts.
 */
import { StoreApi } from "zustand/vanilla"

import type { FiltersStore } from "./filters_store"
import type { SessionStore } from "./session_store"
import type { UserJourneysStore } from "./user_journeys_store"

export type MeasureStoreRegistry = {
  sessionStore: StoreApi<SessionStore>
  userJourneysStore: StoreApi<UserJourneysStore>
  filtersStore: StoreApi<FiltersStore>
}
