import { beforeEach, describe, expect, it } from '@jest/globals'

import { PlotType, createUserJourneysStore, type UserJourneysStore } from '@/app/stores/user_journeys_store'
import { StoreApi } from 'zustand/vanilla'

describe('useUserJourneysStore', () => {
    let store: StoreApi<UserJourneysStore>

    beforeEach(() => {
        store = createUserJourneysStore()
    })

    describe('initial state', () => {
        it('starts with Paths plot type and empty search text', () => {
            const state = store.getState()
            expect(state.plotType).toBe(PlotType.Paths)
            expect(state.searchText).toBe('')
        })
    })

    describe('setPlotType', () => {
        it('updates plot type to Exceptions', () => {
            store.getState().setPlotType(PlotType.Exceptions)

            expect(store.getState().plotType).toBe(PlotType.Exceptions)
        })

        it('updates plot type back to Paths', () => {
            store.getState().setPlotType(PlotType.Exceptions)
            store.getState().setPlotType(PlotType.Paths)

            expect(store.getState().plotType).toBe(PlotType.Paths)
        })

        it('accepts any string as plot type', () => {
            store.getState().setPlotType('CustomType')

            expect(store.getState().plotType).toBe('CustomType')
        })

        it('does not affect searchText', () => {
            store.getState().setSearchText('login')
            store.getState().setPlotType(PlotType.Exceptions)

            expect(store.getState().searchText).toBe('login')
        })
    })

    describe('setSearchText', () => {
        it('updates search text', () => {
            store.getState().setSearchText('checkout')

            expect(store.getState().searchText).toBe('checkout')
        })

        it('allows clearing search text with empty string', () => {
            store.getState().setSearchText('something')
            store.getState().setSearchText('')

            expect(store.getState().searchText).toBe('')
        })

        it('does not affect plotType', () => {
            store.getState().setPlotType(PlotType.Exceptions)
            store.getState().setSearchText('cart')

            expect(store.getState().plotType).toBe(PlotType.Exceptions)
        })
    })

    describe('reset', () => {
        it('clears state back to initial values', () => {
            store.getState().setPlotType(PlotType.Exceptions)
            store.getState().setSearchText('search term')

            store.getState().reset()

            const state = store.getState()
            expect(state.plotType).toBe(PlotType.Paths)
            expect(state.searchText).toBe('')
        })
    })

    describe('PlotType enum', () => {
        it('exposes Paths and Exceptions values', () => {
            expect(PlotType.Paths).toBe('Paths')
            expect(PlotType.Exceptions).toBe('Exceptions')
        })
    })
})
