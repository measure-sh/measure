import TracesOverview from '@/app/[teamId]/traces/page'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'

// Global replace mock for router.replace
const replaceMock = jest.fn()
const pushMock = jest.fn()

// Mock next/navigation hooks
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: replaceMock,
        push: pushMock,
    }),
    // By default, return empty search params.
    useSearchParams: () => new URLSearchParams(),
}))

// Mock API calls and constants
jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    emptySpansResponse: {
        meta: { next: false, previous: false },
        results: [],
    },
    FilterSource: { Spans: 'spans' },
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

const mockUseSpansQuery = jest.fn(() => ({
    data: undefined as any,
    status: 'pending' as string, isFetching: true,
    error: null as Error | null,
}))

jest.mock('@/app/query/hooks', () => ({
    __esModule: true,
    useSpansQuery: () => mockUseSpansQuery(),
    paginationOffsetUrlKey: 'po',
}))

jest.mock('@/app/components/filters', () => ({
    __esModule: true,
    default: () => <div data-testid="filters-mock" />,
    AppVersionsInitialSelectionType: { All: 'all' },
}))

// Mock SpanMetricsPlot component.
jest.mock('@/app/components/span_metrics_plot', () => () => (
    <div data-testid="span-metrics-plot-mock">TracesOverviewPlot Rendered</div>
))

// Updated Paginator mock renders Next and Prev buttons.
jest.mock('@/app/components/paginator', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="paginator-mock">
            <button data-testid="prev-button" onClick={props.onPrev} disabled={!props.prevEnabled}>Prev</button>
            <button data-testid="next-button" onClick={props.onNext} disabled={!props.nextEnabled}>Next</button>
            <span>{props.displayText}</span>
        </div>
    ),
}))

// Mock LoadingBar component.
jest.mock('@/app/components/loading_bar', () => () => (
    <div data-testid="loading-bar-mock">LoadingBar Rendered</div>
))

// Mock time utils
jest.mock('@/app/utils/time_utils', () => ({
    formatDateToHumanReadableDate: jest.fn(() => 'Jan 1, 2020'),
    formatDateToHumanReadableTime: jest.fn(() => '12:00 AM'),
    formatMillisToHumanReadable: jest.fn(() => '5s')
}))

const { useFiltersStore } = require('@/app/stores/provider') as any

const mockSpanData = {
    results: [
        {
            app_id: 'app1',
            span_name: 'Test Span',
            span_id: 'span1',
            trace_id: 'trace1',
            status: 1,
            start_time: "2020-01-01T00:00:00Z",
            end_time: "2020-01-01T00:05:00Z",
            duration: 5000,
            app_version: '1.0',
            app_build: '1',
            os_name: 'ios',
            os_version: '15',
            device_manufacturer: 'Apple',
            device_model: 'iPhone 12',
        }
    ],
    meta: { previous: true, next: true },
}

describe('TracesOverview Component', () => {
    beforeEach(() => {
        replaceMock.mockClear()
        pushMock.mockClear()
        mockUseSpansQuery.mockReset()
        mockUseSpansQuery.mockReturnValue({ data: undefined, status: 'pending' as string, isFetching: true, error: null })
        useFiltersStore.setState({ filters: { ready: false, serialisedFilters: '' } })
    })

    it('renders the Traces heading and Filters component', () => {
        render(<TracesOverview params={{ teamId: '123' }} />)
        expect(screen.getByText('Traces')).toBeInTheDocument()
        expect(screen.getByTestId('filters-mock')).toBeInTheDocument()
    })

    it('does not render main traces UI when filters are not ready', () => {
        render(<TracesOverview params={{ teamId: '123' }} />)
        expect(screen.queryByTestId('span-metrics-plot-mock')).not.toBeInTheDocument()
        expect(screen.queryByTestId('paginator-mock')).not.toBeInTheDocument()
        expect(screen.queryByTestId('loading-bar-mock')).not.toBeInTheDocument()
    })

    it('renders main traces UI when filters are ready and data is loaded', async () => {
        mockUseSpansQuery.mockReturnValue({ data: mockSpanData, status: 'success', isFetching: false, error: null })
        render(<TracesOverview params={{ teamId: '123' }} />)
        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
        })

        expect(replaceMock).toHaveBeenCalledWith('?po=0&updated', { scroll: false })
        expect(await screen.findByTestId('span-metrics-plot-mock')).toBeInTheDocument()
        expect(await screen.findByTestId('paginator-mock')).toBeInTheDocument()
        expect(screen.getByText('Start Time')).toBeInTheDocument()
        expect(screen.getByText('Duration')).toBeInTheDocument()
        expect(screen.getByText('Status')).toBeInTheDocument()
    })

    it('displays span data correctly', async () => {
        mockUseSpansQuery.mockReturnValue({ data: mockSpanData, status: 'success', isFetching: false, error: null })
        render(<TracesOverview params={{ teamId: '123' }} />)
        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
        })

        expect(screen.getByText('Test Span')).toBeInTheDocument()
        expect(screen.getByText('Jan 1, 2020')).toBeInTheDocument()
        expect(screen.getByText('12:00 AM')).toBeInTheDocument()
        expect(screen.getByText('5s')).toBeInTheDocument()
        expect(screen.getByText('Okay')).toBeInTheDocument()
        expect(screen.getByText('1.0(1), iOS 15, Apple iPhone 12')).toBeInTheDocument()
    })

    it('shows error message when API returns error status', async () => {
        mockUseSpansQuery.mockReturnValue({ data: undefined, status: 'error', isFetching: false, error: new Error('fail') })
        render(<TracesOverview params={{ teamId: '123' }} />)
        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
        })

        expect(screen.getByText(/Error fetching list of traces/)).toBeInTheDocument()
    })

    it('renders appropriate link for each span', async () => {
        mockUseSpansQuery.mockReturnValue({ data: mockSpanData, status: 'success', isFetching: false, error: null })
        render(<TracesOverview params={{ teamId: '123' }} />)
        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
        })

        const link = screen.getByRole('link', { name: /ID: trace1/i })
        expect(link).toBeInTheDocument()
        expect(link).toHaveAttribute('href', '/123/traces/app1/trace1')

        const row = link.closest('tr')
        await act(async () => {
            fireEvent.keyDown(row!, { key: 'Enter' })
        })
        expect(pushMock).toHaveBeenCalledWith('/123/traces/app1/trace1')

        await act(async () => {
            fireEvent.keyDown(row!, { key: ' ' })
        })
        expect(pushMock).toHaveBeenCalledWith('/123/traces/app1/trace1')
    })

    describe('Pagination', () => {
        it('renders paginator with correct enabled state', async () => {
            mockUseSpansQuery.mockReturnValue({ data: mockSpanData, status: 'success', isFetching: false, error: null })
            render(<TracesOverview params={{ teamId: '123' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
            })

            const prevButton = screen.getByTestId('prev-button')
            const nextButton = screen.getByTestId('next-button')
            expect(prevButton).not.toBeDisabled()
            expect(nextButton).not.toBeDisabled()
        })

        it('disables paginator buttons during loading', async () => {
            mockUseSpansQuery.mockReturnValue({ data: mockSpanData, status: 'pending' as string, isFetching: true, error: null })
            render(<TracesOverview params={{ teamId: '123' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
            })

            const prevButton = screen.getByTestId('prev-button')
            const nextButton = screen.getByTestId('next-button')
            expect(prevButton).toBeDisabled()
            expect(nextButton).toBeDisabled()
        })

        it('includes pagination offset in URL', async () => {
            mockUseSpansQuery.mockReturnValue({ data: mockSpanData, status: 'success', isFetching: false, error: null })
            render(<TracesOverview params={{ teamId: '123' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
            })

            // Click next to change offset
            const nextButton = screen.getByTestId('next-button')
            await act(async () => {
                fireEvent.click(nextButton)
            })

            expect(replaceMock).toHaveBeenLastCalledWith('?po=5&updated', { scroll: false })
        })
    })

    it('correctly toggles loading bar visibility', async () => {
        mockUseSpansQuery.mockReturnValue({ data: undefined, status: 'pending' as string, isFetching: true, error: null })
        render(<TracesOverview params={{ teamId: '123' }} />)

        // Set loading state
        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
        })

        const loadingBarContainer = screen.getByTestId('loading-bar-mock').parentElement
        expect(loadingBarContainer).toHaveClass('visible')
        expect(loadingBarContainer).not.toHaveClass('invisible')

        // Set success state
        await act(async () => {
            mockUseSpansQuery.mockReturnValue({ data: mockSpanData, status: 'success', isFetching: false, error: null })
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
        })

        expect(loadingBarContainer).not.toHaveClass('visible')
        expect(loadingBarContainer).toHaveClass('invisible')
    })
})
