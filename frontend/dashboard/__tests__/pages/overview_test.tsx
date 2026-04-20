import Overview from '@/app/[teamId]/overview/page'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, render, screen } from '@testing-library/react'

const replaceMock = jest.fn()

// Mock next/navigation hooks
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: replaceMock,
    }),
    useSearchParams: () => new URLSearchParams(),
}))

// Mock API calls and constants
jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    FilterSource: { Events: 'events' },
}))

jest.mock('@/app/stores/provider', () => {
    const { create } = jest.requireActual('zustand')
    const filtersStore = create(() => ({
        filters: { ready: false, serialisedFilters: '' },
    }))
    return {
        __esModule: true,
        useFiltersStore: filtersStore,
    }
})

// Mock Filters component
jest.mock('@/app/components/filters', () => ({
    __esModule: true,
    default: () => <div data-testid="filters-mock" />,
    AppVersionsInitialSelectionType: { Latest: 'latest', All: 'all' },
}))

const { useFiltersStore } = require('@/app/stores/provider') as any

// Mock SessionsVsExceptionsOverviewPlot component
jest.mock('@/app/components/sessions_vs_exceptions_overview_plot', () => ({
    __esModule: true, // Ensures the mock behaves like an ES module
    default: () => (
        <div data-testid="sessions-vs-exceptions-overview-plot-mock">SessionsVsExceptionsOverviewPlot Component Rendered</div>
    ),
}))

// Mock MetricsOverview component
jest.mock('@/app/components/metrics_overview', () => () => (
    <div data-testid="metrics-overview-mock">MetricsOverview Rendered</div>
))

describe('Overview Component', () => {
    beforeEach(() => {
        replaceMock.mockClear()
        useFiltersStore.setState({ filters: { ready: false, serialisedFilters: '' } })
    })

    it('renders the Filters component', () => {
        render(<Overview params={{ teamId: '123' }} />)
        expect(screen.getByTestId('filters-mock')).toBeInTheDocument()
    })

    it('does not render Journey or MetricsOverview when filters are not ready', () => {
        render(<Overview params={{ teamId: '123' }} />)
        expect(screen.queryByTestId('journey-mock')).not.toBeInTheDocument()
        expect(screen.queryByTestId('metrics-overview-mock')).not.toBeInTheDocument()
    })

    it('renders Journey and MetricsOverview when filters become ready and updates URL', async () => {
        render(<Overview params={{ teamId: '123' }} />)

        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
        })

        expect(await screen.findByTestId('sessions-vs-exceptions-overview-plot-mock')).toBeInTheDocument()
        expect(await screen.findByTestId('metrics-overview-mock')).toBeInTheDocument()
        expect(replaceMock).toHaveBeenCalledWith('?updated', { scroll: false })
    })
})
