import NetworkOverview from '@/app/components/network_overview'
import { addRecentSearch, getRecentSearchesForDomain, removeRecentSearch } from '@/app/utils/network_recent_searches'
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
jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    FilterSource: { Events: 'events' },
}))

jest.mock('@/app/stores/provider', () => {
    const { create } = jest.requireActual('zustand')
    const filtersStore = create(() => ({
        filters: { ready: false, serialisedFilters: '' },
    }))
    return { __esModule: true, useFiltersStore: filtersStore }
})

const mockUseNetworkDomainsQuery = jest.fn(() => ({
    data: null as any,
    status: 'pending' as string,
    error: null as Error | null,
}))

const mockUseNetworkPathsQuery = jest.fn(() => ({
    data: null as any,
    status: 'pending' as string,
    error: null as Error | null,
}))

const mockUseNetworkStatusPlotQuery = jest.fn(() => ({
    data: null as any,
    status: 'pending' as string,
    error: null as Error | null,
}))

const mockUseNetworkTimelineQuery = jest.fn(() => ({
    data: null as any,
    status: 'pending' as string,
    error: null as Error | null,
}))

jest.mock('@/app/query/hooks', () => ({
    __esModule: true,
    useNetworkDomainsQuery: () => mockUseNetworkDomainsQuery(),
    useNetworkPathsQuery: () => mockUseNetworkPathsQuery(),
    useNetworkStatusPlotQuery: () => mockUseNetworkStatusPlotQuery(),
    useNetworkTimelineQuery: () => mockUseNetworkTimelineQuery(),
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

// Helper to set queries to a fully successful state
function setupSuccessfulQueryState() {
    mockUseNetworkDomainsQuery.mockReturnValue({
        data: ['api.example.com', 'cdn.example.com'],
        status: 'success',
        error: null as Error | null,
    })
    mockUseNetworkPathsQuery.mockReturnValue({
        data: ['/v1/users', '/v1/orders'],
        status: 'success',
        error: null as Error | null,
    })
    mockUseNetworkStatusPlotQuery.mockReturnValue({
        data: [
            { datetime: '2024-01-01', total_count: 100, count_2xx: 90, count_3xx: 2, count_4xx: 5, count_5xx: 3 },
        ],
        status: 'success',
        error: null as Error | null,
    })
    mockUseNetworkTimelineQuery.mockReturnValue({
        data: {
            interval: 5,
            points: [{ elapsed: 1, domain: 'api.example.com', path_pattern: '/v1/users', count: 10 }],
        },
        status: 'success',
        error: null as Error | null,
    })
}

describe('NetworkOverview - Demo mode', () => {
    beforeEach(() => {
        replaceMock.mockClear()
        pushMock.mockClear()
        mockUseNetworkDomainsQuery.mockReset()
        mockUseNetworkPathsQuery.mockReset()
        mockUseNetworkStatusPlotQuery.mockReset()
        mockUseNetworkTimelineQuery.mockReset()
        mockUseNetworkDomainsQuery.mockReturnValue({ data: null, status: 'pending' as string, error: null })
        mockUseNetworkPathsQuery.mockReturnValue({ data: null, status: 'pending' as string, error: null })
        mockUseNetworkStatusPlotQuery.mockReturnValue({ data: null, status: 'pending' as string, error: null })
        mockUseNetworkTimelineQuery.mockReturnValue({ data: null, status: 'pending' as string, error: null })
    })

    it('renders title and sections in demo mode without fetching APIs', () => {
        render(<NetworkOverview demo={true} />)

        expect(screen.getByText('Network Performance')).toBeInTheDocument()
        expect(screen.queryByText('Beta')).not.toBeInTheDocument()
        expect(screen.getByText('Status Distribution')).toBeInTheDocument()
        expect(screen.getByText('Timeline')).toBeInTheDocument()
        expect(screen.queryByTestId('filters-mock')).not.toBeInTheDocument()
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
        mockUseNetworkDomainsQuery.mockReset()
        mockUseNetworkPathsQuery.mockReset()
        mockUseNetworkStatusPlotQuery.mockReset()
        mockUseNetworkTimelineQuery.mockReset()
        mockUseNetworkDomainsQuery.mockReturnValue({ data: null, status: 'pending' as string, error: null })
        mockUseNetworkPathsQuery.mockReturnValue({ data: null, status: 'pending' as string, error: null })
        mockUseNetworkStatusPlotQuery.mockReturnValue({ data: null, status: 'pending' as string, error: null })
        mockUseNetworkTimelineQuery.mockReturnValue({ data: null, status: 'pending' as string, error: null })
        useFiltersStore.setState({ filters: { ready: false, serialisedFilters: '' } })
            ; (addRecentSearch as jest.Mock).mockClear()
            ; (removeRecentSearch as jest.Mock).mockClear()
            ; (getRecentSearchesForDomain as jest.Mock).mockReset().mockReturnValue([])
    })

    it('renders Filters component and does not render main UI when filters are not ready', () => {
        render(<NetworkOverview params={{ teamId: '123' }} />)

        expect(screen.getByTestId('filters-mock')).toBeInTheDocument()
        expect(screen.queryByText('Status Distribution')).not.toBeInTheDocument()
        expect(screen.queryByText('Explore endpoint')).not.toBeInTheDocument()
    })

    it('shows loading spinner while domains are loading', async () => {
        mockUseNetworkDomainsQuery.mockReturnValue({ data: null, status: 'pending' as string, error: null })
        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' }, startDate: '2024-01-01', endDate: '2024-01-14' } })
        })

        expect(screen.getByTestId('loading-spinner-mock')).toBeInTheDocument()
    })

    it('renders main content after domains load successfully and updates URL', async () => {
        setupSuccessfulQueryState()
        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' }, startDate: '2024-01-01', endDate: '2024-01-14' } })
        })

        // URL should be updated
        expect(replaceMock).toHaveBeenCalledWith('?updated', { scroll: false })

        // Main sections should be visible
        expect(screen.getByText('Explore endpoint')).toBeInTheDocument()
        expect(screen.getByText('Status Distribution')).toBeInTheDocument()
        expect(screen.getByText('Timeline')).toBeInTheDocument()
        expect(screen.getByTestId('network-trends-mock')).toBeInTheDocument()
    })

    it('shows error message when domains API returns error', async () => {
        mockUseNetworkDomainsQuery.mockReturnValue({ data: null, status: 'error', error: new Error('fail') })
        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' }, startDate: '2024-01-01', endDate: '2024-01-14' } })
        })

        expect(screen.getByText('Error fetching domains, please change filters & try again')).toBeInTheDocument()
    })

    it('shows no data message when domains API returns no data', async () => {
        mockUseNetworkDomainsQuery.mockReturnValue({ data: null, status: 'success', error: null })
        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' }, startDate: '2024-01-01', endDate: '2024-01-14' } })
        })

        expect(screen.getByText('No data available for the selected app')).toBeInTheDocument()
    })

    it('shows status plot error message when status codes API fails', async () => {
        mockUseNetworkDomainsQuery.mockReturnValue({ data: ['api.example.com'], status: 'success', error: null })
        mockUseNetworkStatusPlotQuery.mockReturnValue({ data: null, status: 'error', error: new Error('fail') })
        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' }, startDate: '2024-01-01', endDate: '2024-01-14' } })
        })

        expect(screen.getByText('Error fetching status overview, please change filters & try again')).toBeInTheDocument()
    })

    it('shows no data message when status codes API returns no data', async () => {
        mockUseNetworkDomainsQuery.mockReturnValue({ data: ['api.example.com'], status: 'success', error: null })
        mockUseNetworkStatusPlotQuery.mockReturnValue({ data: null, status: 'success', error: null })
        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' }, startDate: '2024-01-01', endDate: '2024-01-14' } })
        })

        expect(screen.getByText('No data available for the selected filters')).toBeInTheDocument()
    })

    it('shows timeline error message when timeline API fails', async () => {
        mockUseNetworkDomainsQuery.mockReturnValue({ data: ['api.example.com'], status: 'success', error: null })
        mockUseNetworkTimelineQuery.mockReturnValue({ data: null, status: 'error', error: new Error('fail') })
        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' }, startDate: '2024-01-01', endDate: '2024-01-14' } })
        })

        expect(screen.getByText('Error fetching requests timeline, please change filters & try again')).toBeInTheDocument()
    })

    it('navigates to details page when search is performed with a path', async () => {
        setupSuccessfulQueryState()
        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' }, startDate: '2024-01-01', endDate: '2024-01-14' } })
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
        setupSuccessfulQueryState()
        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' }, startDate: '2024-01-01', endDate: '2024-01-14' } })
        })

        const input = screen.getByTestId('path-input-mock')
        await act(async () => {
            fireEvent.keyDown(input, { key: 'Enter' })
        })

        expect(pushMock).not.toHaveBeenCalled()
    })

    it('updates URL when filters change', async () => {
        setupSuccessfulQueryState()
        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' }, startDate: '2024-01-01', endDate: '2024-01-14' } })
        })

        expect(replaceMock).toHaveBeenCalledWith('?updated', { scroll: false })

        // Change filters
        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated2', app: { id: 'app1' }, startDate: '2024-01-01', endDate: '2024-01-14' } })
        })

        expect(replaceMock).toHaveBeenLastCalledWith('?updated2', { scroll: false })
    })

    it('navigates to details page when Search button is clicked', async () => {
        setupSuccessfulQueryState()
        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' }, startDate: '2024-01-01', endDate: '2024-01-14' } })
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
        setupSuccessfulQueryState()
        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' }, startDate: '2024-01-01', endDate: '2024-01-14' } })
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
        ; (getRecentSearchesForDomain as jest.Mock).mockReturnValue(['/v1/recent', '/v1/old'])

        setupSuccessfulQueryState()
        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' }, startDate: '2024-01-01', endDate: '2024-01-14' } })
        })

        const input = screen.getByTestId('path-input-mock')
        await act(async () => {
            fireEvent.focus(input)
        })

        expect(screen.getByText('/v1/recent')).toBeInTheDocument()
        expect(screen.getByText('/v1/old')).toBeInTheDocument()
    })

    it('removes a recent search when Remove is clicked', async () => {
        ; (getRecentSearchesForDomain as jest.Mock).mockReturnValue(['/v1/recent', '/v1/old'])

        setupSuccessfulQueryState()
        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' }, startDate: '2024-01-01', endDate: '2024-01-14' } })
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
        ; (getRecentSearchesForDomain as jest.Mock).mockReturnValue(['/v1/recent', '/v1/old'])

        setupSuccessfulQueryState()
        render(<NetworkOverview params={{ teamId: '123' }} />)

        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' }, startDate: '2024-01-01', endDate: '2024-01-14' } })
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
