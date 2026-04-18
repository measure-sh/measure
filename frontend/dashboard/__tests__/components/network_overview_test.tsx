import NetworkOverview from '@/app/components/network_overview'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, render, screen } from '@testing-library/react'

const mockRouterReplace = jest.fn()
const mockRouterPush = jest.fn()

jest.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockRouterReplace, push: mockRouterPush }),
}))

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, children, className }: any) => <a href={href} className={className}>{children}</a>,
}))

jest.mock('luxon', () => ({
    DateTime: { now: () => ({ toUTC: () => ({ minus: () => ({ toFormat: () => '2024-01-01' }), toISO: () => '2024-01-01T00:00:00.000Z' }) }) },
}))

jest.mock('lucide-react', () => ({
    History: () => <span data-testid="history-icon" />,
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

jest.mock('@/app/components/filters', () => ({
    __esModule: true,
    default: () => <div data-testid="filters-mock" />,
    AppVersionsInitialSelectionType: { Latest: 'latest', All: 'all' },
}))

jest.mock('@/app/components/beta_badge', () => ({
    __esModule: true,
    default: () => <span data-testid="beta-badge" />,
}))

jest.mock('@/app/components/skeleton', () => ({
    Skeleton: ({ className, ...props }: any) => <div data-testid="skeleton-mock" className={className} {...props} />,
    SkeletonPlot: () => <div data-testid="skeleton-plot-mock">Loading...</div>,
    SkeletonTable: () => <div data-testid="skeleton-table-mock" />,
}))

jest.mock('@/app/components/dropdown_select', () => ({
    __esModule: true,
    default: ({ title, initialSelected, onChangeSelected }: any) => (
        <div data-testid={`dropdown-${title}`}>{initialSelected}</div>
    ),
    DropdownSelectType: { SingleString: 0 },
}))

jest.mock('@/app/components/input', () => ({
    Input: (props: any) => <input {...props} />,
}))

jest.mock('@/app/components/button', () => ({
    Button: ({ children, onClick, disabled, ...props }: any) => (
        <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
    ),
}))

jest.mock('@/app/components/network_timeline_plot', () => ({
    __esModule: true,
    default: () => <div data-testid="network-timeline-plot" />,
}))

jest.mock('@/app/components/network_status_distribution_plot', () => ({
    __esModule: true,
    default: () => <div data-testid="network-status-plot" />,
}))

jest.mock('@/app/components/network_trends', () => ({
    __esModule: true,
    default: ({ demo }: any) => <div data-testid="network-trends" data-demo={demo} />,
}))

jest.mock('@/app/utils/time_utils', () => ({
    getPlotTimeGroupForRange: () => 'days',
}))

jest.mock('@/app/utils/network_recent_searches', () => ({
    addRecentSearch: jest.fn(),
    removeRecentSearch: jest.fn(),
    getRecentSearchesForDomain: () => [],
}))

jest.mock('@/app/utils/shared_styles', () => ({
    underlineLinkStyle: 'underline',
}))

const { useFiltersStore } = require('@/app/stores/provider') as any

describe('NetworkOverview', () => {
    beforeEach(() => {
        mockRouterPush.mockReset()
        mockRouterReplace.mockReset()
        mockUseNetworkDomainsQuery.mockReset()
        mockUseNetworkPathsQuery.mockReset()
        mockUseNetworkStatusPlotQuery.mockReset()
        mockUseNetworkTimelineQuery.mockReset()
        mockUseNetworkDomainsQuery.mockReturnValue({ data: null, status: 'pending' as string, error: null })
        mockUseNetworkPathsQuery.mockReturnValue({ data: null, status: 'pending' as string, error: null })
        mockUseNetworkStatusPlotQuery.mockReturnValue({ data: null, status: 'pending' as string, error: null })
        mockUseNetworkTimelineQuery.mockReturnValue({ data: null, status: 'pending' as string, error: null })
        useFiltersStore.setState({ filters: { ready: false, serialisedFilters: '' } })
    })

    describe('Demo mode', () => {
        it('renders title', () => {
            render(<NetworkOverview demo={true} />)
            expect(screen.getByText(/Network Performance/)).toBeInTheDocument()
        })

        it('hides title when hideDemoTitle is true', () => {
            render(<NetworkOverview demo={true} hideDemoTitle={true} />)
            expect(screen.queryByText(/Network Performance/)).not.toBeInTheDocument()
        })

        it('does not render Filters in demo mode', () => {
            render(<NetworkOverview demo={true} />)
            expect(screen.queryByTestId('filters-mock')).not.toBeInTheDocument()
        })

        it('renders status distribution section', () => {
            render(<NetworkOverview demo={true} />)
            expect(screen.getByText('Status Distribution')).toBeInTheDocument()
        })

        it('renders network trends component', () => {
            render(<NetworkOverview demo={true} />)
            expect(screen.getByTestId('network-trends')).toBeInTheDocument()
        })

        it('renders timeline section', () => {
            render(<NetworkOverview demo={true} />)
            expect(screen.getByText('Timeline')).toBeInTheDocument()
        })

        it('does not show search section in demo mode', () => {
            render(<NetworkOverview demo={true} />)
            expect(screen.queryByText('Explore endpoint')).not.toBeInTheDocument()
        })
    })

    describe('Non-demo mode', () => {
        it('renders Filters component', () => {
            render(<NetworkOverview params={{ teamId: 'team-1' }} />)
            expect(screen.getByTestId('filters-mock')).toBeInTheDocument()
        })

        it('renders beta badge', () => {
            render(<NetworkOverview params={{ teamId: 'team-1' }} />)
            expect(screen.getByTestId('beta-badge')).toBeInTheDocument()
        })

        it('shows loading spinner before domains are fetched', async () => {
            mockUseNetworkDomainsQuery.mockReturnValue({ data: null, status: 'pending' as string, error: null })
            render(<NetworkOverview params={{ teamId: 'team-1' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, app: { id: 'app-1' }, serialisedFilters: 'a=app-1', startDate: '2024-01-01', endDate: '2024-01-14' } })
            })
            expect(screen.getAllByTestId('skeleton-mock').length).toBeGreaterThan(0)
        })

        it('shows error message when domains API fails', async () => {
            mockUseNetworkDomainsQuery.mockReturnValue({ data: null, status: 'error', error: new Error('fail') })
            render(<NetworkOverview params={{ teamId: 'team-1' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, app: { id: 'app-1' }, serialisedFilters: 'a=app-1', startDate: '2024-01-01', endDate: '2024-01-14' } })
            })
            expect(screen.getByText(/Error fetching domains/)).toBeInTheDocument()
        })

        it('shows no data message when domains API returns no data', async () => {
            mockUseNetworkDomainsQuery.mockReturnValue({ data: null, status: 'success', error: null })
            render(<NetworkOverview params={{ teamId: 'team-1' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, app: { id: 'app-1' }, serialisedFilters: 'a=app-1', startDate: '2024-01-01', endDate: '2024-01-14' } })
            })
            expect(screen.getByText(/No data available/)).toBeInTheDocument()
        })

        it('shows status distribution section after domains succeed', async () => {
            mockUseNetworkDomainsQuery.mockReturnValue({ data: ['api.example.com'], status: 'success', error: null })
            mockUseNetworkStatusPlotQuery.mockReturnValue({ data: null, status: 'error', error: new Error('fail') })
            render(<NetworkOverview params={{ teamId: 'team-1' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, app: { id: 'app-1' }, serialisedFilters: 'a=app-1', startDate: '2024-01-01', endDate: '2024-01-14' } })
            })
            expect(screen.getByText('Status Distribution')).toBeInTheDocument()
        })

        it('shows timeline section after domains succeed', async () => {
            mockUseNetworkDomainsQuery.mockReturnValue({ data: ['api.example.com'], status: 'success', error: null })
            mockUseNetworkTimelineQuery.mockReturnValue({ data: null, status: 'error', error: new Error('fail') })
            render(<NetworkOverview params={{ teamId: 'team-1' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, app: { id: 'app-1' }, serialisedFilters: 'a=app-1', startDate: '2024-01-01', endDate: '2024-01-14' } })
            })
            expect(screen.getByText('Timeline')).toBeInTheDocument()
        })

        it('shows search section when domains succeed', async () => {
            mockUseNetworkDomainsQuery.mockReturnValue({ data: ['api.example.com'], status: 'success', error: null })
            render(<NetworkOverview params={{ teamId: 'team-1' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, app: { id: 'app-1' }, serialisedFilters: 'a=app-1', startDate: '2024-01-01', endDate: '2024-01-14' } })
            })
            expect(screen.getByText('Explore endpoint')).toBeInTheDocument()
        })
    })
})
