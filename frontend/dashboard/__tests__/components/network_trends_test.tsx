import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockRouterPush = jest.fn()

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush }),
}))

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, children, className }: any) => <a href={href} className={className}>{children}</a>,
}))

jest.mock('@/app/components/filters', () => ({
    __esModule: true,
    defaultFilters: { ready: false, serialisedFilters: null },
}))

jest.mock('@/app/components/loading_bar', () => ({
    __esModule: true,
    default: () => <div data-testid="loading-bar">Loading...</div>,
}))

jest.mock('@/app/components/table', () => ({
    Table: ({ children }: any) => <table>{children}</table>,
    TableHeader: ({ children }: any) => <thead>{children}</thead>,
    TableBody: ({ children }: any) => <tbody>{children}</tbody>,
    TableRow: ({ children, onClick, ...props }: any) => <tr onClick={onClick} {...props}>{children}</tr>,
    TableHead: ({ children }: any) => <th>{children}</th>,
    TableCell: ({ children }: any) => <td>{children}</td>,
}))

jest.mock('@/app/utils/time_utils', () => ({
    formatMillisToHumanReadable: (ms: number) => `${ms}ms`,
}))

jest.mock('@/app/utils/number_utils', () => ({
    numberToKMB: (n: number) => `${n}`,
}))

jest.mock('@/app/utils/shared_styles', () => ({
    underlineLinkStyle: 'underline',
}))

jest.mock('@/app/stores/provider', () => {
    const { create } = jest.requireActual('zustand')
    const filtersStore = create(() => ({
        filters: { ready: false, serialisedFilters: null },
    }))
    return { __esModule: true, useFiltersStore: filtersStore }
})

const mockUseNetworkTrendsQuery = jest.fn(() => ({
    data: null as any,
    status: 'pending' as string,
    error: null as Error | null,
}))

jest.mock('@/app/query/hooks', () => ({
    __esModule: true,
    useNetworkTrendsQuery: () => mockUseNetworkTrendsQuery(),
    TrendsTab: { Latency: 'Latency', ErrorRate: 'Error Rate', Frequency: 'Frequency' },
}))

import NetworkTrends from '@/app/components/network_trends'
const { useFiltersStore } = require('@/app/stores/provider') as any

function mockTrendsData() {
    return {
        trends_latency: [
            { domain: 'api.example.com', path_pattern: '/v1/checkout', p95_latency: 3100, error_rate: 5.7, frequency: 8400 },
            { domain: 'api.example.com', path_pattern: '/v1/users', p95_latency: 1250, error_rate: 2.1, frequency: 84200 },
        ],
        trends_error_rate: [
            { domain: 'api.example.com', path_pattern: '/v1/checkout', p95_latency: 3100, error_rate: 5.7, frequency: 8400 },
        ],
        trends_frequency: [
            { domain: 'api.example.com', path_pattern: '/v1/users', p95_latency: 1250, error_rate: 2.1, frequency: 84200 },
        ],
    }
}

function readyFilters() {
    return { ready: true, app: { id: 'app-1' }, serialisedFilters: 'a=app-1' }
}

describe('NetworkTrends', () => {
    beforeEach(() => {
        mockRouterPush.mockReset()
        mockUseNetworkTrendsQuery.mockReset()
        mockUseNetworkTrendsQuery.mockReturnValue({ data: null, status: 'pending' as string, error: null })
        useFiltersStore.setState({ filters: { ready: false, serialisedFilters: null } })
    })

    describe('Loading state', () => {
        it('shows loading bar while fetching', async () => {
            useFiltersStore.setState({ filters: readyFilters() })
            mockUseNetworkTrendsQuery.mockReturnValue({ data: null, status: 'pending' as string, error: null })
            await act(async () => {
                render(<NetworkTrends teamId="team-1" />)
            })
            expect(screen.getByTestId('loading-bar')).toBeInTheDocument()
        })
    })

    describe('Error state', () => {
        it('shows error message', async () => {
            useFiltersStore.setState({ filters: readyFilters() })
            mockUseNetworkTrendsQuery.mockReturnValue({ data: null, status: 'error', error: new Error('fail') })
            await act(async () => {
                render(<NetworkTrends teamId="team-1" />)
            })
            await waitFor(() => {
                expect(screen.getByText(/Error fetching overview/)).toBeInTheDocument()
            })
        })
    })

    describe('NoData state', () => {
        it('shows no data message', async () => {
            useFiltersStore.setState({ filters: readyFilters() })
            mockUseNetworkTrendsQuery.mockReturnValue({ data: null, status: 'success', error: null })
            await act(async () => {
                render(<NetworkTrends teamId="team-1" />)
            })
            await waitFor(() => {
                expect(screen.getByText(/No data available/)).toBeInTheDocument()
            })
        })
    })

    describe('Success state', () => {
        beforeEach(() => {
            useFiltersStore.setState({ filters: readyFilters() })
            mockUseNetworkTrendsQuery.mockReturnValue({
                data: mockTrendsData(),
                status: 'success',
                error: null as Error | null,
            })
        })

        it('renders table with endpoint data', async () => {
            await act(async () => {
                render(<NetworkTrends teamId="team-1" />)
            })
            await waitFor(() => {
                expect(screen.getByText('api.example.com/v1/checkout')).toBeInTheDocument()
                expect(screen.getByText('api.example.com/v1/users')).toBeInTheDocument()
            })
        })

        it('shows latency, error rate and frequency columns', async () => {
            await act(async () => {
                render(<NetworkTrends teamId="team-1" />)
            })
            await waitFor(() => {
                expect(screen.getByText('Latency (p95)')).toBeInTheDocument()
                expect(screen.getByText('Error Rate %')).toBeInTheDocument()
                // 'Frequency' appears as both tab button and table header
                expect(screen.getAllByText('Frequency').length).toBeGreaterThanOrEqual(1)
            })
        })

        it('renders tab buttons (Latency, Error Rate, Frequency)', async () => {
            await act(async () => {
                render(<NetworkTrends teamId="team-1" />)
            })
            await waitFor(() => {
                // Use getAllByText for 'Frequency' since the table header also says 'Frequency'
                expect(screen.getByText('Latency')).toBeInTheDocument()
                expect(screen.getByText('Error Rate')).toBeInTheDocument()
                expect(screen.getAllByText('Frequency').length).toBeGreaterThanOrEqual(1)
            })
        })

        it('switches data when tab is clicked', async () => {
            await act(async () => {
                render(<NetworkTrends teamId="team-1" />)
            })
            await waitFor(() => {
                expect(screen.getByText('api.example.com/v1/checkout')).toBeInTheDocument()
            })

            // 'Frequency' appears in both tab button and table header; pick the button
            const freqButtons = screen.getAllByText('Frequency')
            await act(async () => {
                fireEvent.click(freqButtons[0])
            })
            // Frequency tab shows trends_frequency data
            await waitFor(() => {
                expect(screen.getByText('api.example.com/v1/users')).toBeInTheDocument()
                expect(screen.queryByText('api.example.com/v1/checkout')).not.toBeInTheDocument()
            })
        })

        it('navigates to endpoint details on row click', async () => {
            await act(async () => {
                render(<NetworkTrends teamId="team-1" />)
            })
            await waitFor(() => {
                expect(screen.getByText('api.example.com/v1/checkout')).toBeInTheDocument()
            })

            fireEvent.click(screen.getByText('api.example.com/v1/checkout').closest('tr')!)
            expect(mockRouterPush).toHaveBeenCalledWith(
                '/team-1/network/details?domain=api.example.com&path=%2Fv1%2Fcheckout'
            )
        })
    })

    describe('Demo mode', () => {
        it('renders table without API call', async () => {
            await act(async () => {
                render(<NetworkTrends demo={true} />)
            })
            expect(screen.getByText('Top Endpoints')).toBeInTheDocument()
            // Demo data should render some endpoints
            expect(screen.getAllByRole('row').length).toBeGreaterThan(1)
        })

        it('does not navigate on row click in demo mode', async () => {
            await act(async () => {
                render(<NetworkTrends demo={true} />)
            })
            const rows = screen.getAllByRole('row')
            fireEvent.click(rows[1]) // first data row
            expect(mockRouterPush).not.toHaveBeenCalled()
        })
    })
})
