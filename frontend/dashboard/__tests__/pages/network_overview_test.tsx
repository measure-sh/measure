import NetworkOverview from '@/app/components/network_overview'
import { addRecentSearch, removeRecentSearch, getRecentSearchesForDomain } from '@/app/utils/network_recent_searches'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'

// Global router mocks
const replaceMock = jest.fn()
const pushMock = jest.fn()

// Mock next/navigation hooks
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: replaceMock,
        push: pushMock,
    }),
    useSearchParams: () => new URLSearchParams(),
}))

// Mock API calls
const mockFetchDomains = jest.fn()
const mockFetchPaths = jest.fn()
const mockFetchStatusCodes = jest.fn()
const mockFetchTimeline = jest.fn()

jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    FilterSource: { Events: 'events' },
    NetworkDomainsApiStatus: {
        Loading: 'loading',
        Success: 'success',
        Error: 'error',
        NoData: 'no_data',
    },
    NetworkPathsApiStatus: {
        Loading: 'loading',
        Success: 'success',
        Error: 'error',
        NoData: 'no_data',
    },
    NetworkOverviewStatusCodesPlotApiStatus: {
        Loading: 'loading',
        Success: 'success',
        Error: 'error',
        NoData: 'no_data',
    },
    NetworkTimelinePlotApiStatus: {
        Loading: 'loading',
        Success: 'success',
        Error: 'error',
        NoData: 'no_data',
    },
    fetchNetworkDomainsFromServer: (...args: any[]) => mockFetchDomains(...args),
    fetchNetworkPathsFromServer: (...args: any[]) => mockFetchPaths(...args),
    fetchNetworkOverviewStatusCodesPlotFromServer: (...args: any[]) => mockFetchStatusCodes(...args),
    fetchNetworkTimelinePlotFromServer: (...args: any[]) => mockFetchTimeline(...args),
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
}))

// Mock child components
jest.mock('@/app/components/loading_spinner', () => {
    return function LoadingSpinner() {
        return <div data-testid="loading-spinner-mock">LoadingSpinner</div>
    }
})

jest.mock('@/app/components/network_status_distribution_plot', () => ({
    __esModule: true,
    default: () => <div data-testid="status-distribution-plot-mock">StatusDistributionPlot</div>,
}))

jest.mock('@/app/components/network_timeline_plot', () => ({
    __esModule: true,
    default: () => <div data-testid="network-timeline-plot-mock">NetworkTimelinePlot</div>,
    NetworkTimelineData: {},
    NetworkTimelineDataPoint: {},
}))

jest.mock('@/app/components/network_trends', () => ({
    __esModule: true,
    default: (props: any) => <div data-testid="network-trends-mock">NetworkTrends</div>,
}))

jest.mock('@/app/components/badge', () => ({
    Badge: (props: any) => <span {...props}>{props.children}</span>,
}))

jest.mock('@/app/components/button', () => ({
    Button: (props: any) => <button {...props}>{props.children}</button>,
}))

jest.mock('@/app/components/tooltip', () => ({
    Tooltip: (props: any) => <div>{props.children}</div>,
    TooltipContent: (props: any) => <div>{props.children}</div>,
    TooltipTrigger: (props: any) => <div>{props.children}</div>,
}))

jest.mock('@/app/components/dropdown_select', () => ({
    __esModule: true,
    default: (props: any) => (
        <select
            data-testid="domain-dropdown-mock"
            value={props.initialSelected}
            onChange={(e) => props.onChangeSelected(e.target.value)}
        >
            {(props.items || []).map((item: string) => (
                <option key={item} value={item}>{item}</option>
            ))}
        </select>
    ),
    DropdownSelectType: { SingleString: 'single_string' },
}))

jest.mock('@/app/components/input', () => ({
    Input: (props: any) => <input data-testid="path-input-mock" {...props} />,
}))

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, children, className }: any) => (
        <a href={href} className={className}>{children}</a>
    ),
}))

jest.mock('@/app/utils/network_recent_searches', () => ({
    addRecentSearch: jest.fn(),
    removeRecentSearch: jest.fn(),
    getRecentSearchesForDomain: jest.fn(() => []),
}))

jest.mock('@/app/utils/shared_styles', () => ({
    underlineLinkStyle: 'underline-link',
}))

// Helper to set up default successful API responses
function setupSuccessfulApis() {
    mockFetchDomains.mockResolvedValue({
        status: 'success',
        data: { results: ['api.example.com', 'cdn.example.com'] },
    })
    mockFetchPaths.mockResolvedValue({
        status: 'success',
        data: { results: ['/v1/users', '/v1/orders'] },
    })
    mockFetchStatusCodes.mockResolvedValue({
        status: 'success',
        data: [
            { datetime: '2024-01-01', total_count: 100, count_2xx: 90, count_3xx: 2, count_4xx: 5, count_5xx: 3 },
        ],
    })
    mockFetchTimeline.mockResolvedValue({
        status: 'success',
        data: {
            interval: 5,
            points: [{ elapsed: 1, domain: 'api.example.com', path_pattern: '/v1/users', count: 10 }],
        },
    })
}

describe('NetworkOverview - Demo mode', () => {
    beforeEach(() => {
        replaceMock.mockClear()
        pushMock.mockClear()
        mockFetchDomains.mockReset()
        mockFetchPaths.mockReset()
        mockFetchStatusCodes.mockReset()
        mockFetchTimeline.mockReset()
    })

    it('renders title and sections in demo mode without fetching APIs', () => {
        render(<NetworkOverview demo={true} />)

        expect(screen.getByText('Network Performance')).toBeInTheDocument()
        expect(screen.queryByText('Beta')).not.toBeInTheDocument()
        expect(screen.getByText('Status Distribution')).toBeInTheDocument()
        expect(screen.getByText('Timeline')).toBeInTheDocument()
        expect(screen.queryByTestId('filters-mock')).not.toBeInTheDocument()
        expect(mockFetchDomains).not.toHaveBeenCalled()
        expect(mockFetchStatusCodes).not.toHaveBeenCalled()
        expect(mockFetchTimeline).not.toHaveBeenCalled()
    })

    it('renders NetworkTrends in demo mode', () => {
        render(<NetworkOverview demo={true} />)
        expect(screen.getByTestId('network-trends-mock')).toBeInTheDocument()
    })

    it('does not render the search endpoint section in demo mode', () => {
        render(<NetworkOverview demo={true} />)
        expect(screen.queryByText('Explore endpoint')).not.toBeInTheDocument()
        expect(screen.queryByTestId('path-input-mock')).not.toBeInTheDocument()
    })

    it('hides title and beta badge when hideDemoTitle is true', () => {
        render(<NetworkOverview demo={true} hideDemoTitle={true} />)
        expect(screen.queryByText('Network Performance')).not.toBeInTheDocument()
        expect(screen.queryByText('Beta')).not.toBeInTheDocument()
    })
})

describe('NetworkOverview', () => {
    beforeEach(() => {
        replaceMock.mockClear()
        pushMock.mockClear()
        mockFetchDomains.mockReset()
        mockFetchPaths.mockReset()
        mockFetchStatusCodes.mockReset()
        mockFetchTimeline.mockReset()
        ;(addRecentSearch as jest.Mock).mockClear()
        ;(removeRecentSearch as jest.Mock).mockClear()
        ;(getRecentSearchesForDomain as jest.Mock).mockReset().mockReturnValue([])
    })

    it('renders Filters component and does not render main UI when filters are not ready', () => {
        render(<NetworkOverview params={{ teamId: '123' }} />)

        expect(screen.getByTestId('filters-mock')).toBeInTheDocument()
        expect(screen.queryByText('Status Distribution')).not.toBeInTheDocument()
        expect(screen.queryByText('Explore endpoint')).not.toBeInTheDocument()
    })

    it('shows loading spinner while domains are loading', async () => {
        // Never-resolving promise to keep loading state
        mockFetchDomains.mockReturnValue(new Promise(() => { }))
        mockFetchStatusCodes.mockReturnValue(new Promise(() => { }))
        mockFetchTimeline.mockReturnValue(new Promise(() => { }))
        mockFetchPaths.mockReturnValue(new Promise(() => { }))

        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        expect(screen.getByTestId('loading-spinner-mock')).toBeInTheDocument()
    })

    it('renders main content after domains load successfully and updates URL', async () => {
        setupSuccessfulApis()

        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        // URL should be updated
        expect(replaceMock).toHaveBeenCalledWith('?updated', { scroll: false })

        // Main sections should be visible
        expect(screen.getByText('Explore endpoint')).toBeInTheDocument()
        expect(screen.getByText('Status Distribution')).toBeInTheDocument()
        expect(screen.getByText('Timeline')).toBeInTheDocument()
        expect(screen.getByTestId('network-trends-mock')).toBeInTheDocument()
    })

    it('does not update URL if filters remain unchanged', async () => {
        setupSuccessfulApis()

        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })
        expect(replaceMock).toHaveBeenCalledTimes(1)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })
        expect(replaceMock).toHaveBeenCalledTimes(1)
    })

    it('shows error message when domains API returns error', async () => {
        mockFetchDomains.mockResolvedValue({ status: 'error' })
        mockFetchStatusCodes.mockReturnValue(new Promise(() => { }))
        mockFetchTimeline.mockReturnValue(new Promise(() => { }))
        mockFetchPaths.mockReturnValue(new Promise(() => { }))

        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        expect(screen.getByText('Error fetching domains, please change filters & try again')).toBeInTheDocument()
    })

    it('shows no data message when domains API returns no data', async () => {
        mockFetchDomains.mockResolvedValue({ status: 'no_data' })
        mockFetchStatusCodes.mockReturnValue(new Promise(() => { }))
        mockFetchTimeline.mockReturnValue(new Promise(() => { }))
        mockFetchPaths.mockReturnValue(new Promise(() => { }))

        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        expect(screen.getByText('No data available for the selected app')).toBeInTheDocument()
    })

    it('shows status plot error message when status codes API fails', async () => {
        mockFetchDomains.mockResolvedValue({
            status: 'success',
            data: { results: ['api.example.com'] },
        })
        mockFetchStatusCodes.mockResolvedValue({ status: 'error' })
        mockFetchTimeline.mockResolvedValue({
            status: 'success',
            data: { interval: 5, points: [{ elapsed: 1, domain: 'a', path_pattern: '/b', count: 1 }] },
        })
        mockFetchPaths.mockResolvedValue({ status: 'success', data: { results: [] } })

        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        expect(screen.getByText('Error fetching status overview, please change filters & try again')).toBeInTheDocument()
    })

    it('shows no data message when status codes API returns no data', async () => {
        mockFetchDomains.mockResolvedValue({
            status: 'success',
            data: { results: ['api.example.com'] },
        })
        mockFetchStatusCodes.mockResolvedValue({ status: 'no_data' })
        mockFetchTimeline.mockResolvedValue({
            status: 'success',
            data: { interval: 5, points: [{ elapsed: 1, domain: 'a', path_pattern: '/b', count: 1 }] },
        })
        mockFetchPaths.mockResolvedValue({ status: 'success', data: { results: [] } })

        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        expect(screen.getByText('No data available for the selected filters')).toBeInTheDocument()
    })

    it('shows timeline error message when timeline API fails', async () => {
        mockFetchDomains.mockResolvedValue({
            status: 'success',
            data: { results: ['api.example.com'] },
        })
        mockFetchStatusCodes.mockResolvedValue({
            status: 'success',
            data: [{ datetime: '2024-01-01', total_count: 100, count_2xx: 90, count_3xx: 2, count_4xx: 5, count_5xx: 3 }],
        })
        mockFetchTimeline.mockResolvedValue({ status: 'error' })
        mockFetchPaths.mockResolvedValue({ status: 'success', data: { results: [] } })

        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        expect(screen.getByText('Error fetching requests timeline, please change filters & try again')).toBeInTheDocument()
    })

    it('navigates to details page when search is performed with a path', async () => {
        setupSuccessfulApis()

        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        const input = screen.getByTestId('path-input-mock')
        await act(async () => {
            fireEvent.change(input, { target: { value: '/v1/users' } })
        })

        // Simulate pressing Enter
        await act(async () => {
            fireEvent.keyDown(input, { key: 'Enter' })
        })

        expect(pushMock).toHaveBeenCalledWith(
            '/123/network/details?domain=api.example.com&path=%2Fv1%2Fusers'
        )
    })

    it('does not navigate when search path is empty', async () => {
        setupSuccessfulApis()

        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        const input = screen.getByTestId('path-input-mock')
        await act(async () => {
            fireEvent.keyDown(input, { key: 'Enter' })
        })

        expect(pushMock).not.toHaveBeenCalled()
    })

    it('re-fetches data when filters change', async () => {
        setupSuccessfulApis()

        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        expect(mockFetchDomains).toHaveBeenCalledTimes(1)

        // Change filters
        setupSuccessfulApis()
        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters-2'))
        })

        expect(mockFetchDomains).toHaveBeenCalledTimes(2)
        expect(replaceMock).toHaveBeenLastCalledWith('?updated2', { scroll: false })
    })

    it('navigates to details page when Search button is clicked', async () => {
        setupSuccessfulApis()

        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        const input = screen.getByTestId('path-input-mock')
        await act(async () => {
            fireEvent.change(input, { target: { value: '/v1/users' } })
        })

        await act(async () => {
            fireEvent.click(screen.getByText('Search'))
        })

        expect(pushMock).toHaveBeenCalledWith(
            '/123/network/details?domain=api.example.com&path=%2Fv1%2Fusers'
        )
    })

    it('calls addRecentSearch when navigating via Enter', async () => {
        setupSuccessfulApis()

        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        const input = screen.getByTestId('path-input-mock')
        await act(async () => {
            fireEvent.change(input, { target: { value: '/v1/users' } })
        })

        await act(async () => {
            fireEvent.keyDown(input, { key: 'Enter' })
        })

        expect(addRecentSearch).toHaveBeenCalledWith('123', 'api.example.com', '/v1/users')
    })

    it('shows recent search suggestions when input is focused', async () => {
        setupSuccessfulApis()
        ;(getRecentSearchesForDomain as jest.Mock).mockReturnValue(['/v1/recent', '/v1/old'])

        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        const input = screen.getByTestId('path-input-mock')
        await act(async () => {
            fireEvent.focus(input)
        })

        expect(screen.getByText('/v1/recent')).toBeInTheDocument()
        expect(screen.getByText('/v1/old')).toBeInTheDocument()
    })

    it('removes a recent search when Remove is clicked', async () => {
        setupSuccessfulApis()
        ;(getRecentSearchesForDomain as jest.Mock).mockReturnValue(['/v1/recent', '/v1/old'])

        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        const input = screen.getByTestId('path-input-mock')
        await act(async () => {
            fireEvent.focus(input)
        })

        const removeButtons = screen.getAllByText('Remove')
        await act(async () => {
            fireEvent.mouseDown(removeButtons[0])
        })

        expect(removeRecentSearch).toHaveBeenCalledWith('123', 'api.example.com', '/v1/recent')
    })

    it('selects a recent search path when clicked', async () => {
        setupSuccessfulApis()
        ;(getRecentSearchesForDomain as jest.Mock).mockReturnValue(['/v1/recent', '/v1/old'])

        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        const input = screen.getByTestId('path-input-mock')
        await act(async () => {
            fireEvent.focus(input)
        })

        await act(async () => {
            fireEvent.mouseDown(screen.getByText('/v1/recent'))
        })

        expect((input as HTMLInputElement).value).toBe('/v1/recent')
    })
})
