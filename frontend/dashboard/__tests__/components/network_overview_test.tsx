import { describe, expect, it, beforeEach } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'

const mockFetchDomains = jest.fn()
const mockFetchStatusPlot = jest.fn()
const mockFetchTimeline = jest.fn()
const mockFetchPaths = jest.fn()
const mockRouterReplace = jest.fn()
const mockRouterPush = jest.fn()

jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    FilterSource: { Events: 0 },
    NetworkDomainsApiStatus: { Loading: 0, Success: 1, Error: 2, NoData: 3 },
    NetworkPathsApiStatus: { Loading: 0, Success: 1, Error: 2, NoData: 3 },
    NetworkOverviewStatusCodesPlotApiStatus: { Loading: 0, Success: 1, Error: 2, NoData: 3 },
    NetworkTimelinePlotApiStatus: { Loading: 0, Success: 1, Error: 2, NoData: 3 },
    fetchNetworkDomainsFromServer: (...args: any[]) => mockFetchDomains(...args),
    fetchNetworkPathsFromServer: (...args: any[]) => mockFetchPaths(...args),
    fetchNetworkOverviewStatusCodesPlotFromServer: (...args: any[]) => mockFetchStatusPlot(...args),
    fetchNetworkTimelinePlotFromServer: (...args: any[]) => mockFetchTimeline(...args),
}))

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

jest.mock('@/app/components/filters', () => ({
    __esModule: true,
    default: ({ onFiltersChanged }: any) => (
        <div data-testid="filters-mock">
            <button data-testid="set-filters-ready" onClick={() =>
                onFiltersChanged({ ready: true, app: { id: 'app-1' }, serialisedFilters: 'a=app-1', startDate: '2024-01-01', endDate: '2024-01-14' })
            }>Ready</button>
        </div>
    ),
    AppVersionsInitialSelectionType: { All: 1 },
    defaultFilters: { ready: false, serialisedFilters: null, startDate: '', endDate: '' },
}))

jest.mock('@/app/components/beta_badge', () => ({
    __esModule: true,
    default: () => <span data-testid="beta-badge" />,
}))

jest.mock('@/app/components/loading_spinner', () => ({
    __esModule: true,
    default: () => <div data-testid="loading-spinner">Loading...</div>,
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

import NetworkOverview from '@/app/components/network_overview'

describe('NetworkOverview', () => {
    beforeEach(() => {
        mockFetchDomains.mockReset()
        mockFetchStatusPlot.mockReset()
        mockFetchTimeline.mockReset()
        mockFetchPaths.mockReset()
        mockRouterPush.mockReset()
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

        it('does not call any API in demo mode', () => {
            render(<NetworkOverview demo={true} />)
            expect(mockFetchDomains).not.toHaveBeenCalled()
            expect(mockFetchStatusPlot).not.toHaveBeenCalled()
            expect(mockFetchTimeline).not.toHaveBeenCalled()
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
            mockFetchDomains.mockReturnValue(new Promise(() => { }))
            mockFetchStatusPlot.mockReturnValue(new Promise(() => { }))
            mockFetchTimeline.mockReturnValue(new Promise(() => { }))

            render(<NetworkOverview params={{ teamId: 'team-1' }} />)
            await act(async () => {
                fireEvent.click(screen.getByTestId('set-filters-ready'))
            })
            await waitFor(() => {
                expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
            })
        })

        it('shows error message when domains API fails', async () => {
            mockFetchDomains.mockResolvedValue({ status: 2 })
            mockFetchStatusPlot.mockReturnValue(new Promise(() => { }))
            mockFetchTimeline.mockReturnValue(new Promise(() => { }))

            render(<NetworkOverview params={{ teamId: 'team-1' }} />)
            await act(async () => {
                fireEvent.click(screen.getByTestId('set-filters-ready'))
            })
            await waitFor(() => {
                expect(screen.getByText(/Error fetching domains/)).toBeInTheDocument()
            })
        })

        it('shows no data message when domains API returns no data', async () => {
            mockFetchDomains.mockResolvedValue({ status: 3 })
            mockFetchStatusPlot.mockReturnValue(new Promise(() => { }))
            mockFetchTimeline.mockReturnValue(new Promise(() => { }))

            render(<NetworkOverview params={{ teamId: 'team-1' }} />)
            await act(async () => {
                fireEvent.click(screen.getByTestId('set-filters-ready'))
            })
            await waitFor(() => {
                expect(screen.getByText(/No data available/)).toBeInTheDocument()
            })
        })

        it('shows search section when domains succeed', async () => {
            mockFetchDomains.mockResolvedValue({ status: 1, data: { results: ['api.example.com'] } })
            mockFetchStatusPlot.mockReturnValue(new Promise(() => { }))
            mockFetchTimeline.mockReturnValue(new Promise(() => { }))
            mockFetchPaths.mockReturnValue(new Promise(() => { }))

            render(<NetworkOverview params={{ teamId: 'team-1' }} />)
            await act(async () => {
                fireEvent.click(screen.getByTestId('set-filters-ready'))
            })
            await waitFor(() => {
                expect(screen.getByText('Explore endpoint')).toBeInTheDocument()
            })
        })
    })
})
