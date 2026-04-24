'use client'

/**
 * Store provider for the remaining Zustand stores:
 * - filtersStore: filter selections and config (client state)
 * - sessionStore: auth session
 * - userJourneysStore: pure UI state
 *
 * All data-fetching stores have been migrated to TanStack Query — see app/query/hooks.ts.
 */

import { createContext, useContext, useState, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type { MeasureStoreRegistry } from './registry'

import { createFiltersStore, type FiltersStore } from './filters_store'
import { createSessionStore, type SessionStore } from './session_store'
import { createUserJourneysStore, type UserJourneysStore } from './user_journeys_store'

// --- Context ---

export type MeasureStoreApi = MeasureStoreRegistry

export const MeasureStoreContext = createContext<MeasureStoreApi | undefined>(
  undefined,
)

// --- Registry creation ---

function createMeasureStoreRegistry(): MeasureStoreRegistry {
  const registry = {} as MeasureStoreRegistry

  registry.sessionStore = createSessionStore()
  registry.userJourneysStore = createUserJourneysStore()
  registry.filtersStore = createFiltersStore()

  return registry
}

// --- Provider ---

export const MeasureStoreProvider = ({ children }: { children: ReactNode }) => {
  const [store] = useState(() => createMeasureStoreRegistry())
  return (
    <MeasureStoreContext.Provider value={store}>
      {children}
    </MeasureStoreContext.Provider>
  )
}

// --- Hooks ---

export function useMeasureStoreRegistry(): MeasureStoreRegistry {
  const ctx = useContext(MeasureStoreContext)
  if (!ctx) {
    throw new Error('useMeasureStoreRegistry must be used within MeasureStoreProvider')
  }
  return ctx
}

function createHook<T>(key: keyof MeasureStoreRegistry) {
  function useStoreHook(): T
  function useStoreHook<U>(selector: (state: T) => U): U
  function useStoreHook<U>(selector?: (state: T) => U) {
    const ctx = useContext(MeasureStoreContext)
    return useStore(ctx![key] as any, selector as any)
  }
  return useStoreHook
}

export const useSessionStore = createHook<SessionStore>('sessionStore')
export const useUserJourneysStore = createHook<UserJourneysStore>('userJourneysStore')
export const useFiltersStore = createHook<FiltersStore>('filtersStore')
