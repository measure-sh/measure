import { describe, expect, it, beforeEach } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'

const mockFetchTrends = jest.fn()
const mockRouterPush = jest.fn()

jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    NetworkTrendsApiStatus: { Loading: 0, Success: 1, Error: 2, NoData: 3 },
    fetchNetworkTrendsFromServer: (...args: any[]) => mockFetchTrends(...args),
}))

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

import NetworkTrends from '@/app/components/network_trends'

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
        mockFetchTrends.mockReset()
        mockRouterPush.mockReset()
    })

    describe('Loading state', () => {
        it('shows loading bar while fetching', async () => {
            mockFetchTrends.mockReturnValue(new Promise(() => { }))
            await act(async () => {
                render(<NetworkTrends filters={readyFilters() as any} teamId="team-1" />)
            })
            expect(screen.getByTestId('loading-bar')).toBeInTheDocument()
        })
    })

    describe('Error state', () => {
        it('shows error message', async () => {
            mockFetchTrends.mockResolvedValue({ status: 2 })
            await act(async () => {
                render(<NetworkTrends filters={readyFilters() as any} teamId="team-1" />)
            })
            await waitFor(() => {
                expect(screen.getByText(/Error fetching overview/)).toBeInTheDocument()
            })
        })
    })

    describe('NoData state', () => {
        it('shows no data message', async () => {
            mockFetchTrends.mockResolvedValue({ status: 3 })
            await act(async () => {
                render(<NetworkTrends filters={readyFilters() as any} teamId="team-1" />)
            })
            await waitFor(() => {
                expect(screen.getByText(/No data available/)).toBeInTheDocument()
            })
        })
    })

    describe('Success state', () => {
        beforeEach(() => {
            mockFetchTrends.mockResolvedValue({ status: 1, data: mockTrendsData() })
        })

        it('renders table with endpoint data', async () => {
            await act(async () => {
                render(<NetworkTrends filters={readyFilters() as any} teamId="team-1" />)
            })
            await waitFor(() => {
                expect(screen.getByText('api.example.com/v1/checkout')).toBeInTheDocument()
                expect(screen.getByText('api.example.com/v1/users')).toBeInTheDocument()
            })
        })

        it('shows latency, error rate and frequency columns', async () => {
            await act(async () => {
                render(<NetworkTrends filters={readyFilters() as any} teamId="team-1" />)
            })
            await waitFor(() => {
                expect(screen.getByText('Latency (p95)')).toBeInTheDocument()
                expect(screen.getByText('Error Rate %')).toBeInTheDocument()
                expect(screen.getByText('Frequency')).toBeInTheDocument()
            })
        })

        it('renders tab buttons (Slowest, Highest Error %, Most Frequent)', async () => {
            await act(async () => {
                render(<NetworkTrends filters={readyFilters() as any} teamId="team-1" />)
            })
            await waitFor(() => {
                expect(screen.getByText('Slowest')).toBeInTheDocument()
                expect(screen.getByText('Highest Error %')).toBeInTheDocument()
                expect(screen.getByText('Most Frequent')).toBeInTheDocument()
            })
        })

        it('switches data when tab is clicked', async () => {
            await act(async () => {
                render(<NetworkTrends filters={readyFilters() as any} teamId="team-1" />)
            })
            await waitFor(() => {
                expect(screen.getByText('api.example.com/v1/checkout')).toBeInTheDocument()
            })

            fireEvent.click(screen.getByText('Most Frequent'))
            // Most Frequent has only /v1/users
            await waitFor(() => {
                expect(screen.getByText('api.example.com/v1/users')).toBeInTheDocument()
                expect(screen.queryByText('api.example.com/v1/checkout')).not.toBeInTheDocument()
            })
        })

        it('navigates to endpoint details on row click', async () => {
            await act(async () => {
                render(<NetworkTrends filters={readyFilters() as any} teamId="team-1" />)
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

    describe('Filters interaction', () => {
        it('does not fetch when filters are not ready', async () => {
            await act(async () => {
                render(<NetworkTrends filters={{ ready: false } as any} teamId="team-1" />)
            })
            expect(mockFetchTrends).not.toHaveBeenCalled()
        })

        it('does not fetch when active is false', async () => {
            await act(async () => {
                render(<NetworkTrends filters={readyFilters() as any} teamId="team-1" active={false} />)
            })
            expect(mockFetchTrends).not.toHaveBeenCalled()
        })
    })

    describe('Demo mode', () => {
        it('renders table without API call', async () => {
            await act(async () => {
                render(<NetworkTrends demo={true} />)
            })
            expect(mockFetchTrends).not.toHaveBeenCalled()
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
