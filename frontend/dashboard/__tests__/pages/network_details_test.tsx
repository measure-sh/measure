import NetworkDetails from '@/app/components/network_details'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'

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
const mockFetchLatency = jest.fn()
const mockFetchStatusCodes = jest.fn()
const mockFetchTimeline = jest.fn()

jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    FilterSource: { Events: 'events' },
    NetworkEndpointLatencyPlotApiStatus: {
        Loading: 'loading',
        Success: 'success',
        Error: 'error',
        NoData: 'no_data',
    },
    NetworkEndpointStatusCodesPlotApiStatus: {
        Loading: 'loading',
        Success: 'success',
        Error: 'error',
        NoData: 'no_data',
    },
    NetworkEndpointTimelinePlotApiStatus: {
        Loading: 'loading',
        Success: 'success',
        Error: 'error',
        NoData: 'no_data',
    },
    fetchNetworkEndpointLatencyPlotFromServer: (...args: any[]) => mockFetchLatency(...args),
    fetchNetworkEndpointStatusCodesPlotFromServer: (...args: any[]) => mockFetchStatusCodes(...args),
    fetchNetworkEndpointTimelinePlotFromServer: (...args: any[]) => mockFetchTimeline(...args),
}))

// Mock Filters component
jest.mock('@/app/components/filters', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="filters-mock">
            <button
                data-testid="update-filters"
                onClick={() =>
                    props.onFiltersChanged({
                        ready: true,
                        serialisedFilters: 'updated',
                        app: { id: 'app1' },
                        startDate: '2024-01-01',
                        endDate: '2024-01-14',
                    })
                }
            >
                Update Filters
            </button>
            <button
                data-testid="update-filters-2"
                onClick={() =>
                    props.onFiltersChanged({
                        ready: true,
                        serialisedFilters: 'updated2',
                        app: { id: 'app1' },
                        startDate: '2024-01-01',
                        endDate: '2024-01-14',
                    })
                }
            >
                Update Filters 2
            </button>
        </div>
    ),
    AppVersionsInitialSelectionType: { All: 'all' },
    defaultFilters: { ready: false, serialisedFilters: '', startDate: '', endDate: '' },
}))

// Mock time utils
jest.mock('@/app/utils/time_utils', () => ({
    getPlotTimeGroupForRange: jest.fn(() => 'days'),
    PlotTimeGroup: {},
}))

// Mock child components
jest.mock('@/app/components/loading_spinner', () => () => (
    <div data-testid="loading-spinner-mock">LoadingSpinner</div>
))

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

// Helper for successful API responses
function setupSuccessfulApis() {
    mockFetchLatency.mockResolvedValue({
        status: 'success',
        data: [
            { datetime: '2024-01-01', p50: 100, p90: 200, p95: 300, p99: 400, count: 50 },
        ],
    })
    mockFetchStatusCodes.mockResolvedValue({
        status: 'success',
        data: {
            status_codes: [200, 301, 404, 500],
            data_points: [{ datetime: '2024-01-01', total_count: 100, count_200: 90, count_301: 2, count_404: 5, count_500: 3 }],
        },
    })
    mockFetchTimeline.mockResolvedValue({
        status: 'success',
        data: {
            interval: 5,
            points: [{ elapsed: 1, domain: 'api.example.com', path_pattern: '/v1/users', count: 10 }],
        },
    })
}

describe('NetworkDetails', () => {
    beforeEach(() => {
        replaceMock.mockClear()
        mockFetchLatency.mockReset()
        mockFetchStatusCodes.mockReset()
        mockFetchTimeline.mockReset()
    })

    it('renders the page title and endpoint path', () => {
        mockFetchLatency.mockReturnValue(new Promise(() => { }))
        mockFetchStatusCodes.mockReturnValue(new Promise(() => { }))
        mockFetchTimeline.mockReturnValue(new Promise(() => { }))

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
        setupSuccessfulApis()

        render(<NetworkDetails params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        expect(screen.getByText('Latency')).toBeInTheDocument()
        expect(screen.getByText('Status Distribution')).toBeInTheDocument()
        expect(screen.getByText('Timeline')).toBeInTheDocument()
    })

    it('updates URL with domain and path when filters become ready', async () => {
        setupSuccessfulApis()

        render(<NetworkDetails params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
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
        setupSuccessfulApis()

        render(<NetworkDetails params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        expect(screen.getByText('api.example.com/v1/users')).toBeInTheDocument()
    })

    it('shows latency error message when latency API fails', async () => {
        mockFetchLatency.mockResolvedValue({ status: 'error' })
        mockFetchStatusCodes.mockResolvedValue({
            status: 'success',
            data: [{ datetime: '2024-01-01', total_count: 100, count_2xx: 90, count_3xx: 2, count_4xx: 5, count_5xx: 3 }],
        })
        mockFetchTimeline.mockResolvedValue({
            status: 'success',
            data: { interval: 5, points: [{ elapsed: 1, domain: 'a', path_pattern: '/b', count: 1 }] },
        })

        render(<NetworkDetails params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        expect(screen.getByText('Error fetching latency data, please change filters & try again')).toBeInTheDocument()
    })

    it('shows no data message when latency API returns no data', async () => {
        mockFetchLatency.mockResolvedValue({ status: 'no_data' })
        mockFetchStatusCodes.mockResolvedValue({
            status: 'success',
            data: [{ datetime: '2024-01-01', total_count: 100, count_2xx: 90, count_3xx: 2, count_4xx: 5, count_5xx: 3 }],
        })
        mockFetchTimeline.mockResolvedValue({
            status: 'success',
            data: { interval: 5, points: [{ elapsed: 1, domain: 'a', path_pattern: '/b', count: 1 }] },
        })

        render(<NetworkDetails params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        expect(screen.getAllByText('No data available for the selected filters').length).toBeGreaterThanOrEqual(1)
    })

    it('shows status distribution error message when API fails', async () => {
        mockFetchLatency.mockResolvedValue({
            status: 'success',
            data: [{ datetime: '2024-01-01', p50: 100, p90: 200, p95: 300, p99: 400, count: 50 }],
        })
        mockFetchStatusCodes.mockResolvedValue({ status: 'error' })
        mockFetchTimeline.mockResolvedValue({
            status: 'success',
            data: { interval: 5, points: [{ elapsed: 1, domain: 'a', path_pattern: '/b', count: 1 }] },
        })

        render(<NetworkDetails params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        expect(screen.getByText('Error fetching status distribution data, please change filters & try again')).toBeInTheDocument()
    })

    it('shows timeline error message when timeline API fails', async () => {
        mockFetchLatency.mockResolvedValue({
            status: 'success',
            data: [{ datetime: '2024-01-01', p50: 100, p90: 200, p95: 300, p99: 400, count: 50 }],
        })
        mockFetchStatusCodes.mockResolvedValue({
            status: 'success',
            data: [{ datetime: '2024-01-01', total_count: 100, count_2xx: 90, count_3xx: 2, count_4xx: 5, count_5xx: 3 }],
        })
        mockFetchTimeline.mockResolvedValue({ status: 'error' })

        render(<NetworkDetails params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        expect(screen.getByText('Error fetching timeline data, please change filters & try again')).toBeInTheDocument()
    })

    it('hides timeline section when timeline API returns no data', async () => {
        mockFetchLatency.mockResolvedValue({
            status: 'success',
            data: [{ datetime: '2024-01-01', p50: 100, p90: 200, p95: 300, p99: 400, count: 50 }],
        })
        mockFetchStatusCodes.mockResolvedValue({
            status: 'success',
            data: [{ datetime: '2024-01-01', total_count: 100, count_2xx: 90, count_3xx: 2, count_4xx: 5, count_5xx: 3 }],
        })
        mockFetchTimeline.mockResolvedValue({ status: 'no_data' })

        render(<NetworkDetails params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        // Timeline section is hidden entirely when NoData
        expect(screen.queryByText('Timeline')).not.toBeInTheDocument()
    })

    it('does not update URL if filters remain unchanged', async () => {
        setupSuccessfulApis()

        render(<NetworkDetails params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })
        expect(replaceMock).toHaveBeenCalledTimes(1)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })
        expect(replaceMock).toHaveBeenCalledTimes(1)
    })
})
