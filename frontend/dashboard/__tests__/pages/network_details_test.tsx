import NetworkDetails from '@/app/components/network_details'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, render, screen } from '@testing-library/react'

// Global router mocks
const replaceMock = jest.fn()

// Mock next/navigation hooks
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: replaceMock,
    }),
    useSearchParams: () => new URLSearchParams('domain=api.example.com&path=/v1/users'),
}))

// Mock API calls
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

// Mock Filters component
jest.mock('@/app/components/filters', () => ({
    __esModule: true,
    default: () => <div data-testid="filters-mock" />,
    AppVersionsInitialSelectionType: { Latest: 'latest', All: 'all' },
}))

const { useFiltersStore } = require('@/app/stores/provider') as any

// Mock time utils
jest.mock('@/app/utils/time_utils', () => ({
    getPlotTimeGroupForRange: jest.fn(() => 'days'),
    PlotTimeGroup: {},
}))

// Mock child components
jest.mock('@/app/components/skeleton', () => ({
    Skeleton: ({ className, ...props }: any) => <div data-testid="skeleton-mock" className={className} {...props} />,
    SkeletonPlot: () => <div data-testid="skeleton-mock">Loading...</div>,
}))

jest.mock('@/app/components/network_latency_plot', () => ({
    __esModule: true,
    default: () => <div data-testid="latency-plot-mock">LatencyPlot</div>,
}))

jest.mock('@/app/components/network_endpoint_status_codes_plot', () => ({
    __esModule: true,
    default: () => <div data-testid="status-distribution-plot-mock">StatusDistributionPlot</div>,
}))

jest.mock('@/app/components/network_timeline_plot', () => ({
    __esModule: true,
    default: () => <div data-testid="timeline-plot-mock">TimelinePlot</div>,
    NetworkTimelineData: {},
}))

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, children, className }: any) => (
        <a href={href} className={className}>{children}</a>
    ),
}))

jest.mock('@/app/utils/shared_styles', () => ({
    underlineLinkStyle: 'underline-link',
}))

describe('NetworkDetails', () => {
    beforeEach(() => {
        replaceMock.mockClear()
        mockUseNetworkEndpointLatencyQuery.mockReset()
        mockUseNetworkEndpointStatusCodesQuery.mockReset()
        mockUseNetworkEndpointTimelineQuery.mockReset()
        mockUseNetworkEndpointLatencyQuery.mockReturnValue({ data: null, status: 'pending' as string, error: null })
        mockUseNetworkEndpointStatusCodesQuery.mockReturnValue({ data: null, status: 'pending' as string, error: null })
        mockUseNetworkEndpointTimelineQuery.mockReturnValue({ data: null, status: 'pending' as string, error: null })
        useFiltersStore.setState({ filters: { ready: false, serialisedFilters: '' } })
    })

    it('renders the page title and endpoint path', () => {
        render(<NetworkDetails params={{ teamId: '123' }} />)
        expect(screen.getByText('Network Performance')).toBeInTheDocument()
        expect(screen.getByTestId('filters-mock')).toBeInTheDocument()
    })

    it('does not render plot sections when filters are not ready', () => {
        render(<NetworkDetails params={{ teamId: '123' }} />)

        expect(screen.queryByText('Latency')).not.toBeInTheDocument()
        expect(screen.queryByText('Status Distribution')).not.toBeInTheDocument()
        expect(screen.queryByText('Timeline')).not.toBeInTheDocument()
    })

    it('renders all sections when filters are ready and APIs succeed', async () => {
        mockUseNetworkEndpointLatencyQuery.mockReturnValue({
            data: [{ datetime: '2024-01-01', p50: 100, p90: 200, p95: 300, p99: 400, count: 50 }],
            status: 'success',
            error: null as Error | null,
        })
        mockUseNetworkEndpointStatusCodesQuery.mockReturnValue({
            data: {
                status_codes: [200, 301, 404, 500],
                data_points: [{ datetime: '2024-01-01', total_count: 100, count_200: 90, count_301: 2, count_404: 5, count_500: 3 }],
            },
            status: 'success',
            error: null as Error | null,
        })
        mockUseNetworkEndpointTimelineQuery.mockReturnValue({
            data: {
                interval: 5,
                points: [{ elapsed: 1, domain: 'api.example.com', path_pattern: '/v1/users', count: 10 }],
            },
            status: 'success',
            error: null as Error | null,
        })

        render(<NetworkDetails params={{ teamId: '123' }} />)

        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' }, startDate: '2024-01-01', endDate: '2024-01-14' } })
        })

        expect(screen.getByText('Latency')).toBeInTheDocument()
        expect(screen.getByText('Status Distribution')).toBeInTheDocument()
        expect(screen.getByText('Timeline')).toBeInTheDocument()
    })

    it('updates URL with domain and path when filters become ready', async () => {
        mockUseNetworkEndpointLatencyQuery.mockReturnValue({
            data: [{ datetime: '2024-01-01', p50: 100, p90: 200, p95: 300, p99: 400, count: 50 }],
            status: 'success',
            error: null as Error | null,
        })
        mockUseNetworkEndpointStatusCodesQuery.mockReturnValue({
            data: { status_codes: [200], data_points: [{ datetime: '2024-01-01', total_count: 100, count_200: 100 }] },
            status: 'success',
            error: null as Error | null,
        })
        mockUseNetworkEndpointTimelineQuery.mockReturnValue({
            data: { interval: 5, points: [{ elapsed: 1, domain: 'api.example.com', path_pattern: '/v1/users', count: 10 }] },
            status: 'success',
            error: null as Error | null,
        })

        render(<NetworkDetails params={{ teamId: '123' }} />)

        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' }, startDate: '2024-01-01', endDate: '2024-01-14' } })
        })

        expect(replaceMock).toHaveBeenCalledWith(
            expect.stringContaining('domain=api.example.com'),
            { scroll: false }
        )
        expect(replaceMock).toHaveBeenCalledWith(
            expect.stringContaining('path=%2Fv1%2Fusers'),
            { scroll: false }
        )
    })

    it('shows endpoint display when filters are ready', async () => {
        render(<NetworkDetails params={{ teamId: '123' }} />)

        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' }, startDate: '2024-01-01', endDate: '2024-01-14' } })
        })

        expect(screen.getByText('api.example.com/v1/users')).toBeInTheDocument()
    })

    it('shows latency error message when latency API fails', async () => {
        mockUseNetworkEndpointLatencyQuery.mockReturnValue({ data: null, status: 'error', error: new Error('fail') })
        mockUseNetworkEndpointStatusCodesQuery.mockReturnValue({
            data: { status_codes: [200], data_points: [{ datetime: '2024-01-01', total_count: 100, count_200: 100 }] },
            status: 'success',
            error: null as Error | null,
        })
        mockUseNetworkEndpointTimelineQuery.mockReturnValue({
            data: { interval: 5, points: [{ elapsed: 1, domain: 'a', path_pattern: '/b', count: 1 }] },
            status: 'success',
            error: null as Error | null,
        })

        render(<NetworkDetails params={{ teamId: '123' }} />)

        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' }, startDate: '2024-01-01', endDate: '2024-01-14' } })
        })

        expect(screen.getByText('Error fetching latency data, please change filters & try again')).toBeInTheDocument()
    })

    it('shows no data message when latency API returns no data', async () => {
        mockUseNetworkEndpointLatencyQuery.mockReturnValue({ data: null, status: 'success', error: null })
        mockUseNetworkEndpointStatusCodesQuery.mockReturnValue({
            data: { status_codes: [200], data_points: [{ datetime: '2024-01-01', total_count: 100, count_200: 100 }] },
            status: 'success',
            error: null as Error | null,
        })
        mockUseNetworkEndpointTimelineQuery.mockReturnValue({
            data: { interval: 5, points: [{ elapsed: 1, domain: 'a', path_pattern: '/b', count: 1 }] },
            status: 'success',
            error: null as Error | null,
        })

        render(<NetworkDetails params={{ teamId: '123' }} />)

        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' }, startDate: '2024-01-01', endDate: '2024-01-14' } })
        })

        expect(screen.getAllByText('No data available for the selected filters').length).toBeGreaterThanOrEqual(1)
    })

    it('shows status distribution error message when API fails', async () => {
        mockUseNetworkEndpointLatencyQuery.mockReturnValue({
            data: [{ datetime: '2024-01-01', p50: 100, p90: 200, p95: 300, p99: 400, count: 50 }],
            status: 'success',
            error: null as Error | null,
        })
        mockUseNetworkEndpointStatusCodesQuery.mockReturnValue({ data: null, status: 'error', error: new Error('fail') })
        mockUseNetworkEndpointTimelineQuery.mockReturnValue({
            data: { interval: 5, points: [{ elapsed: 1, domain: 'a', path_pattern: '/b', count: 1 }] },
            status: 'success',
            error: null as Error | null,
        })

        render(<NetworkDetails params={{ teamId: '123' }} />)

        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' }, startDate: '2024-01-01', endDate: '2024-01-14' } })
        })

        expect(screen.getByText('Error fetching status distribution data, please change filters & try again')).toBeInTheDocument()
    })

    it('shows timeline error message when timeline API fails', async () => {
        mockUseNetworkEndpointLatencyQuery.mockReturnValue({
            data: [{ datetime: '2024-01-01', p50: 100, p90: 200, p95: 300, p99: 400, count: 50 }],
            status: 'success',
            error: null as Error | null,
        })
        mockUseNetworkEndpointStatusCodesQuery.mockReturnValue({
            data: { status_codes: [200], data_points: [{ datetime: '2024-01-01', total_count: 100, count_200: 100 }] },
            status: 'success',
            error: null as Error | null,
        })
        mockUseNetworkEndpointTimelineQuery.mockReturnValue({ data: null, status: 'error', error: new Error('fail') })

        render(<NetworkDetails params={{ teamId: '123' }} />)

        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' }, startDate: '2024-01-01', endDate: '2024-01-14' } })
        })

        expect(screen.getByText('Error fetching timeline data, please change filters & try again')).toBeInTheDocument()
    })

    it('hides timeline section when timeline API returns no data', async () => {
        mockUseNetworkEndpointLatencyQuery.mockReturnValue({
            data: [{ datetime: '2024-01-01', p50: 100, p90: 200, p95: 300, p99: 400, count: 50 }],
            status: 'success',
            error: null as Error | null,
        })
        mockUseNetworkEndpointStatusCodesQuery.mockReturnValue({
            data: { status_codes: [200], data_points: [{ datetime: '2024-01-01', total_count: 100, count_200: 100 }] },
            status: 'success',
            error: null as Error | null,
        })
        mockUseNetworkEndpointTimelineQuery.mockReturnValue({ data: null, status: 'success', error: null })

        render(<NetworkDetails params={{ teamId: '123' }} />)

        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' }, startDate: '2024-01-01', endDate: '2024-01-14' } })
        })

        // Timeline section is hidden entirely when NoData
        expect(screen.queryByText('Timeline')).not.toBeInTheDocument()
    })
})
