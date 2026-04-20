import NetworkDetails from '@/app/components/network_details'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, render, screen, waitFor } from '@testing-library/react'

const mockRouterReplace = jest.fn()

jest.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockRouterReplace }),
    useSearchParams: () => new URLSearchParams('domain=api.example.com&path=/v1/users'),
}))

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, children, className }: any) => <a href={href} className={className}>{children}</a>,
}))

jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    FilterSource: { Events: 0 },
}))

jest.mock('@/app/stores/provider', () => {
    const { create } = jest.requireActual('zustand')
    const filtersStore = create(() => ({
        filters: { ready: false, serialisedFilters: '' },
    }))
    return { __esModule: true, useFiltersStore: filtersStore }
})

const mockUseNetworkEndpointLatencyQuery = jest.fn(() => ({
    data: null as any,
    status: 'pending' as string,
    error: null as Error | null,
}))

const mockUseNetworkEndpointStatusCodesQuery = jest.fn(() => ({
    data: null as any,
    status: 'pending' as string,
    error: null as Error | null,
}))

const mockUseNetworkEndpointTimelineQuery = jest.fn(() => ({
    data: null as any,
    status: 'pending' as string,
    error: null as Error | null,
}))

jest.mock('@/app/query/hooks', () => ({
    __esModule: true,
    useNetworkEndpointLatencyQuery: () => mockUseNetworkEndpointLatencyQuery(),
    useNetworkEndpointStatusCodesQuery: () => mockUseNetworkEndpointStatusCodesQuery(),
    useNetworkEndpointTimelineQuery: () => mockUseNetworkEndpointTimelineQuery(),
}))

jest.mock('@/app/components/filters', () => ({
    __esModule: true,
    default: () => <div data-testid="filters-mock" />,
    AppVersionsInitialSelectionType: { Latest: 'latest', All: 'all' },
}))

jest.mock('@/app/components/skeleton', () => ({
    Skeleton: ({ className, ...props }: any) => <div data-testid="skeleton-mock" className={className} {...props} />,
    SkeletonPlot: () => <div data-testid="skeleton-mock">Loading...</div>,
}))

jest.mock('@/app/components/network_latency_plot', () => ({
    __esModule: true,
    default: () => <div data-testid="latency-plot" />,
}))

jest.mock('@/app/components/network_endpoint_status_codes_plot', () => ({
    __esModule: true,
    default: () => <div data-testid="status-codes-plot" />,
}))

jest.mock('@/app/components/network_timeline_plot', () => ({
    __esModule: true,
    default: () => <div data-testid="timeline-plot" />,
}))

jest.mock('@/app/utils/time_utils', () => ({
    getPlotTimeGroupForRange: () => 'days',
}))

jest.mock('@/app/utils/shared_styles', () => ({
    underlineLinkStyle: 'underline',
}))

const { useFiltersStore } = require('@/app/stores/provider') as any

describe('NetworkDetails', () => {
    beforeEach(() => {
        mockRouterReplace.mockReset()
        mockUseNetworkEndpointLatencyQuery.mockReset()
        mockUseNetworkEndpointStatusCodesQuery.mockReset()
        mockUseNetworkEndpointTimelineQuery.mockReset()
        mockUseNetworkEndpointLatencyQuery.mockReturnValue({ data: null, status: 'pending' as string, error: null })
        mockUseNetworkEndpointStatusCodesQuery.mockReturnValue({ data: null, status: 'pending' as string, error: null })
        mockUseNetworkEndpointTimelineQuery.mockReturnValue({ data: null, status: 'pending' as string, error: null })
        useFiltersStore.setState({ filters: { ready: false, serialisedFilters: '' } })
    })

    describe('Rendering', () => {
        it('renders Filters component', () => {
            render(<NetworkDetails params={{ teamId: 'team-1' }} />)
            expect(screen.getByTestId('filters-mock')).toBeInTheDocument()
        })
    })

    describe('Latency section', () => {
        it('shows error message on latency API failure', async () => {
            mockUseNetworkEndpointLatencyQuery.mockReturnValue({ data: null, status: 'error', error: new Error('fail') })
            render(<NetworkDetails params={{ teamId: 'team-1' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, app: { id: 'app-1' }, serialisedFilters: 'a=app-1', startDate: '2024-01-01', endDate: '2024-01-14' } })
            })
            await waitFor(() => {
                expect(screen.getByText(/Error fetching latency/)).toBeInTheDocument()
            })
        })

        it('shows no data message when latency has no data', async () => {
            mockUseNetworkEndpointLatencyQuery.mockReturnValue({ data: null, status: 'success', error: null })
            render(<NetworkDetails params={{ teamId: 'team-1' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, app: { id: 'app-1' }, serialisedFilters: 'a=app-1', startDate: '2024-01-01', endDate: '2024-01-14' } })
            })
            await waitFor(() => {
                expect(screen.getAllByText(/No data available/).length).toBeGreaterThan(0)
            })
        })
    })

    describe('Status distribution section', () => {
        it('shows error message on status codes API failure', async () => {
            mockUseNetworkEndpointStatusCodesQuery.mockReturnValue({ data: null, status: 'error', error: new Error('fail') })
            render(<NetworkDetails params={{ teamId: 'team-1' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, app: { id: 'app-1' }, serialisedFilters: 'a=app-1', startDate: '2024-01-01', endDate: '2024-01-14' } })
            })
            await waitFor(() => {
                expect(screen.getByText(/Error fetching status distribution/)).toBeInTheDocument()
            })
        })
    })

    describe('Timeline section', () => {
        it('shows error message on timeline API failure', async () => {
            mockUseNetworkEndpointTimelineQuery.mockReturnValue({ data: null, status: 'error', error: new Error('fail') })
            render(<NetworkDetails params={{ teamId: 'team-1' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, app: { id: 'app-1' }, serialisedFilters: 'a=app-1', startDate: '2024-01-01', endDate: '2024-01-14' } })
            })
            await waitFor(() => {
                expect(screen.getByText(/Error fetching timeline/)).toBeInTheDocument()
            })
        })

        it('hides timeline section when NoData', async () => {
            mockUseNetworkEndpointTimelineQuery.mockReturnValue({ data: null, status: 'success', error: null })
            render(<NetworkDetails params={{ teamId: 'team-1' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, app: { id: 'app-1' }, serialisedFilters: 'a=app-1', startDate: '2024-01-01', endDate: '2024-01-14' } })
            })
            await waitFor(() => {
                // Timeline section title should not appear when NoData
                const timelineHeaders = screen.queryAllByText('Timeline')
                expect(timelineHeaders).toHaveLength(0)
            })
        })
    })

    describe('Success rendering', () => {
        it('renders latency plot on success', async () => {
            mockUseNetworkEndpointLatencyQuery.mockReturnValue({
                data: [{ datetime: '2024-01-01', p50: 100, p90: 200, p95: 300, p99: 400, count: 10 }],
                status: 'success',
                error: null as Error | null,
            })
            render(<NetworkDetails params={{ teamId: 'team-1' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, app: { id: 'app-1' }, serialisedFilters: 'a=app-1', startDate: '2024-01-01', endDate: '2024-01-14' } })
            })
            await waitFor(() => {
                expect(screen.getByTestId('latency-plot')).toBeInTheDocument()
            })
        })

        it('renders status codes plot on success', async () => {
            mockUseNetworkEndpointStatusCodesQuery.mockReturnValue({
                data: { status_codes: [200, 404], data_points: [{ datetime: '2024-01-01', total_count: 100 }] },
                status: 'success',
                error: null as Error | null,
            })
            render(<NetworkDetails params={{ teamId: 'team-1' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, app: { id: 'app-1' }, serialisedFilters: 'a=app-1', startDate: '2024-01-01', endDate: '2024-01-14' } })
            })
            await waitFor(() => {
                expect(screen.getByTestId('status-codes-plot')).toBeInTheDocument()
            })
        })

        it('renders timeline plot on success', async () => {
            mockUseNetworkEndpointTimelineQuery.mockReturnValue({
                data: { interval: 5, points: [{ elapsed: 1, domain: 'a', path_pattern: '/b', count: 1 }] },
                status: 'success',
                error: null as Error | null,
            })
            render(<NetworkDetails params={{ teamId: 'team-1' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, app: { id: 'app-1' }, serialisedFilters: 'a=app-1', startDate: '2024-01-01', endDate: '2024-01-14' } })
            })
            await waitFor(() => {
                expect(screen.getByTestId('timeline-plot')).toBeInTheDocument()
            })
        })
    })
})
