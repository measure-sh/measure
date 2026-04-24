import { describe, expect, it } from '@jest/globals'

// The 3 remaining Zustand stores
import { createFiltersStore } from '@/app/stores/filters_store'
import { createSessionStore } from '@/app/stores/session_store'
import { createUserJourneysStore } from '@/app/stores/user_journeys_store'

import type { MeasureStoreRegistry } from '@/app/stores/registry'
import { resetAllStores } from '@/app/stores/reset_all'

// Mock queryClient.clear()
const mockQueryClientClear = jest.fn()
jest.mock('@/app/query/query_client', () => ({
    queryClient: {
        clear: () => mockQueryClientClear(),
    },
}))

jest.spyOn(console, 'log').mockImplementation(() => { })
jest.spyOn(console, 'error').mockImplementation(() => { })

function createTestRegistry(): MeasureStoreRegistry {
    const registry = {} as MeasureStoreRegistry

    registry.sessionStore = createSessionStore()
    registry.userJourneysStore = createUserJourneysStore()
    registry.filtersStore = createFiltersStore()

    return registry
}

// All 3 store keys in the registry
const allStoreNames: (keyof MeasureStoreRegistry)[] = [
    'sessionStore',
    'userJourneysStore',
    'filtersStore',
]

describe('resetAllStores', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('calls reset on every store', () => {
        const registry = createTestRegistry()

        const spies = allStoreNames.map((name) => ({
            name,
            spy: jest.spyOn(registry[name].getState(), 'reset'),
        }))

        resetAllStores(registry)

        for (const { name, spy } of spies) {
            expect(spy).toHaveBeenCalled()
            spy.mockRestore()
        }
    })

    it('passes clearCache=true to filtersStore.reset', () => {
        const registry = createTestRegistry()
        const spy = jest.spyOn(registry.filtersStore.getState(), 'reset')
        resetAllStores(registry)
        expect(spy).toHaveBeenCalledWith(true)
        spy.mockRestore()
    })

    it('calls queryClient.clear()', () => {
        const registry = createTestRegistry()
        resetAllStores(registry)
        expect(mockQueryClientClear).toHaveBeenCalled()
    })

    it('covers every store (3 total)', () => {
        expect(allStoreNames.length).toBe(3)
    })
})
