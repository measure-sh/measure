import { describe, expect, it, beforeEach } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'

const mockFetchLatency = jest.fn()
const mockFetchStatusCodes = jest.fn()
const mockFetchTimeline = jest.fn()
const mockRouterReplace = jest.fn()

jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    FilterSource: { Events: 0 },
    NetworkEndpointLatencyPlotApiStatus: { Loading: 0, Success: 1, Error: 2, NoData: 3 },
    NetworkEndpointStatusCodesPlotApiStatus: { Loading: 0, Success: 1, Error: 2, NoData: 3 },
    NetworkEndpointTimelinePlotApiStatus: { Loading: 0, Success: 1, Error: 2, NoData: 3 },
    fetchNetworkEndpointLatencyPlotFromServer: (...args: any[]) => mockFetchLatency(...args),
    fetchNetworkEndpointStatusCodesPlotFromServer: (...args: any[]) => mockFetchStatusCodes(...args),
    fetchNetworkEndpointTimelinePlotFromServer: (...args: any[]) => mockFetchTimeline(...args),
}))

jest.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockRouterReplace }),
    useSearchParams: () => new URLSearchParams('domain=api.example.com&path=/v1/users'),
}))

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, children, className }: any) => <a href={href} className={className}>{children}</a>,
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

jest.mock('@/app/components/loading_spinner', () => ({
    __esModule: true,
    default: () => <div data-testid="loading-spinner">Loading...</div>,
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

import NetworkDetails from '@/app/components/network_details'

describe('NetworkDetails', () => {
    beforeEach(() => {
        mockFetchLatency.mockReset()
        mockFetchStatusCodes.mockReset()
        mockFetchTimeline.mockReset()
    })

    describe('Rendering', () => {
        it('renders title', () => {
            render(<NetworkDetails params={{ teamId: 'team-1' }} />)
            expect(screen.getByText('Network Performance')).toBeInTheDocument()
        })

        it('renders Filters component', () => {
            render(<NetworkDetails params={{ teamId: 'team-1' }} />)
            expect(screen.getByTestId('filters-mock')).toBeInTheDocument()
        })

        it('shows domain+path after filters ready', async () => {
            mockFetchLatency.mockReturnValue(new Promise(() => { }))
            mockFetchStatusCodes.mockReturnValue(new Promise(() => { }))
            mockFetchTimeline.mockReturnValue(new Promise(() => { }))

            render(<NetworkDetails params={{ teamId: 'team-1' }} />)
            await act(async () => {
                fireEvent.click(screen.getByTestId('set-filters-ready'))
            })
            await waitFor(() => {
                expect(screen.getByText('api.example.com/v1/users')).toBeInTheDocument()
            })
        })
    })

    describe('Latency section', () => {
        it('shows error message on latency API failure', async () => {
            mockFetchLatency.mockResolvedValue({ status: 2 })
            mockFetchStatusCodes.mockReturnValue(new Promise(() => { }))
            mockFetchTimeline.mockReturnValue(new Promise(() => { }))

            render(<NetworkDetails params={{ teamId: 'team-1' }} />)
            await act(async () => {
                fireEvent.click(screen.getByTestId('set-filters-ready'))
            })
            await waitFor(() => {
                expect(screen.getByText(/Error fetching latency/)).toBeInTheDocument()
            })
        })

        it('shows no data message when latency has no data', async () => {
            mockFetchLatency.mockResolvedValue({ status: 3 })
            mockFetchStatusCodes.mockReturnValue(new Promise(() => { }))
            mockFetchTimeline.mockReturnValue(new Promise(() => { }))

            render(<NetworkDetails params={{ teamId: 'team-1' }} />)
            await act(async () => {
                fireEvent.click(screen.getByTestId('set-filters-ready'))
            })
            await waitFor(() => {
                expect(screen.getAllByText(/No data available/).length).toBeGreaterThan(0)
            })
        })
    })

    describe('Status distribution section', () => {
        it('shows error message on status codes API failure', async () => {
            mockFetchLatency.mockReturnValue(new Promise(() => { }))
            mockFetchStatusCodes.mockResolvedValue({ status: 2 })
            mockFetchTimeline.mockReturnValue(new Promise(() => { }))

            render(<NetworkDetails params={{ teamId: 'team-1' }} />)
            await act(async () => {
                fireEvent.click(screen.getByTestId('set-filters-ready'))
            })
            await waitFor(() => {
                expect(screen.getByText(/Error fetching status distribution/)).toBeInTheDocument()
            })
        })
    })

    describe('Timeline section', () => {
        it('shows error message on timeline API failure', async () => {
            mockFetchLatency.mockReturnValue(new Promise(() => { }))
            mockFetchStatusCodes.mockReturnValue(new Promise(() => { }))
            mockFetchTimeline.mockResolvedValue({ status: 2 })

            render(<NetworkDetails params={{ teamId: 'team-1' }} />)
            await act(async () => {
                fireEvent.click(screen.getByTestId('set-filters-ready'))
            })
            await waitFor(() => {
                expect(screen.getByText(/Error fetching timeline/)).toBeInTheDocument()
            })
        })

        it('hides timeline section when NoData', async () => {
            mockFetchLatency.mockReturnValue(new Promise(() => { }))
            mockFetchStatusCodes.mockReturnValue(new Promise(() => { }))
            mockFetchTimeline.mockResolvedValue({ status: 3 })

            render(<NetworkDetails params={{ teamId: 'team-1' }} />)
            await act(async () => {
                fireEvent.click(screen.getByTestId('set-filters-ready'))
            })
            await waitFor(() => {
                // Timeline section title should not appear when NoData
                const timelineHeaders = screen.queryAllByText('Timeline')
                expect(timelineHeaders).toHaveLength(0)
            })
        })
    })

    describe('API calls', () => {
        it('does not fetch before filters are ready', () => {
            render(<NetworkDetails params={{ teamId: 'team-1' }} />)
            expect(mockFetchLatency).not.toHaveBeenCalled()
            expect(mockFetchStatusCodes).not.toHaveBeenCalled()
            expect(mockFetchTimeline).not.toHaveBeenCalled()
        })

        it('fetches all 3 APIs when filters become ready', async () => {
            mockFetchLatency.mockReturnValue(new Promise(() => { }))
            mockFetchStatusCodes.mockReturnValue(new Promise(() => { }))
            mockFetchTimeline.mockReturnValue(new Promise(() => { }))

            render(<NetworkDetails params={{ teamId: 'team-1' }} />)
            await act(async () => {
                fireEvent.click(screen.getByTestId('set-filters-ready'))
            })
            expect(mockFetchLatency).toHaveBeenCalled()
            expect(mockFetchStatusCodes).toHaveBeenCalled()
            expect(mockFetchTimeline).toHaveBeenCalled()
        })
    })
})
