import { describe, expect, it, beforeEach } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, render, screen, waitFor } from '@testing-library/react'
import React from 'react'

const mockFetchTrace = jest.fn()

jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    TraceApiStatus: { Loading: 0, Success: 1, Error: 2 },
    emptyTrace: {
        app_id: '', trace_id: '', session_id: '', user_id: '',
        start_time: '', end_time: '', duration: 0, app_version: '',
        os_version: '', device_manufacturer: '', device_model: '',
        network_type: '', spans: [],
    },
    fetchTraceFromServer: (...args: any[]) => mockFetchTrace(...args),
}))

jest.mock('@/app/utils/time_utils', () => ({
    formatDateToHumanReadableDateTime: (ts: string) => `formatted:${ts}`,
    formatMillisToHumanReadable: (ms: number) => `${ms}ms`,
}))

jest.mock('@/app/components/loading_spinner', () => ({
    __esModule: true,
    default: () => <div data-testid="loading-spinner">Loading...</div>,
}))

jest.mock('@/app/components/trace_viz', () => ({
    __esModule: true,
    default: ({ inputTrace }: any) => <div data-testid="trace-viz">{inputTrace.trace_id}</div>,
}))

jest.mock('@/app/components/pill', () => ({
    __esModule: true,
    default: ({ title }: any) => <span data-testid="pill">{title}</span>,
}))

jest.mock('@/app/components/button', () => ({
    buttonVariants: () => 'btn-class',
}))

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, children, className }: any) => <a href={href} className={className}>{children}</a>,
}))

jest.mock('luxon', () => ({
    DateTime: {
        now: () => ({
            toUTC: () => ({
                minus: () => ({
                    plus: () => ({
                        toISO: () => '2024-01-01T00:00:00.000Z',
                    }),
                    toISO: () => '2024-01-01T00:00:00.000Z',
                }),
                toISO: () => '2024-01-01T00:00:00.000Z',
            }),
        }),
    },
}))

import TraceDetails from '@/app/components/trace_details'

function mockTraceData() {
    return {
        app_id: 'app-1', trace_id: 'trace-abc', session_id: 'session-xyz',
        user_id: 'user-1', start_time: '2024-01-01T00:00:00Z', end_time: '2024-01-01T00:01:00Z',
        duration: 1200, app_version: '2.0.0 (200)', os_version: 'android 33',
        device_manufacturer: 'Google ', device_model: 'Pixel 7',
        network_type: 'Wifi', spans: [],
    }
}

describe('TraceDetails', () => {
    describe('Loading state', () => {
        it('shows loading spinner initially', async () => {
            mockFetchTrace.mockReturnValue(new Promise(() => { }))
            await act(async () => {
                render(<TraceDetails params={{ teamId: 'team-1', appId: 'app-1', traceId: 'trace-abc' }} />)
            })
            expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
        })
    })

    describe('Error state', () => {
        it('shows error message on API failure', async () => {
            mockFetchTrace.mockResolvedValue({ status: 2 })
            await act(async () => {
                render(<TraceDetails params={{ teamId: 'team-1', appId: 'app-1', traceId: 'trace-abc' }} />)
            })
            await waitFor(() => {
                expect(screen.getByText(/Error fetching trace/)).toBeInTheDocument()
            })
        })
    })

    describe('Success state', () => {
        beforeEach(() => {
            mockFetchTrace.mockResolvedValue({ status: 1, data: mockTraceData() })
        })

        it('renders trace ID in title', async () => {
            await act(async () => {
                render(<TraceDetails params={{ teamId: 'team-1', appId: 'app-1', traceId: 'trace-abc' }} />)
            })
            await waitFor(() => {
                expect(screen.getByText('Trace: trace-abc')).toBeInTheDocument()
            })
        })

        it('renders pills with trace metadata', async () => {
            await act(async () => {
                render(<TraceDetails params={{ teamId: 'team-1', appId: 'app-1', traceId: 'trace-abc' }} />)
            })
            await waitFor(() => {
                const pills = screen.getAllByTestId('pill')
                const pillTexts = pills.map(p => p.textContent)
                expect(pillTexts).toContainEqual(expect.stringContaining('User ID: user-1'))
                expect(pillTexts).toContainEqual(expect.stringContaining('Duration: 1200ms'))
                expect(pillTexts).toContainEqual(expect.stringContaining('App version: 2.0.0 (200)'))
                expect(pillTexts).toContainEqual(expect.stringContaining('Network type: Wifi'))
            })
        })

        it('shows N/A for empty user ID', async () => {
            mockFetchTrace.mockResolvedValue({ status: 1, data: { ...mockTraceData(), user_id: '' } })
            await act(async () => {
                render(<TraceDetails params={{ teamId: 'team-1', appId: 'app-1', traceId: 'trace-abc' }} />)
            })
            await waitFor(() => {
                const pills = screen.getAllByTestId('pill')
                const userPill = pills.find(p => p.textContent?.includes('User ID'))
                expect(userPill?.textContent).toContain('N/A')
            })
        })

        it('renders TraceViz component', async () => {
            await act(async () => {
                render(<TraceDetails params={{ teamId: 'team-1', appId: 'app-1', traceId: 'trace-abc' }} />)
            })
            await waitFor(() => {
                expect(screen.getByTestId('trace-viz')).toBeInTheDocument()
            })
        })

        it('renders session timeline link', async () => {
            await act(async () => {
                render(<TraceDetails params={{ teamId: 'team-1', appId: 'app-1', traceId: 'trace-abc' }} />)
            })
            await waitFor(() => {
                const link = screen.getByText('View Session Timeline')
                expect(link.closest('a')).toHaveAttribute('href', '/team-1/session_timelines/app-1/session-xyz')
            })
        })

        it('calls fetchTraceFromServer with correct args', async () => {
            await act(async () => {
                render(<TraceDetails params={{ teamId: 'team-1', appId: 'app-1', traceId: 'trace-abc' }} />)
            })
            expect(mockFetchTrace).toHaveBeenCalledWith('app-1', 'trace-abc')
        })
    })

    describe('Demo mode', () => {
        it('shows "Performance Traces" title in demo mode', async () => {
            await act(async () => {
                render(<TraceDetails demo={true} />)
            })
            expect(screen.getByText('Performance Traces')).toBeInTheDocument()
        })

        it('hides title when hideDemoTitle is true', async () => {
            await act(async () => {
                render(<TraceDetails demo={true} hideDemoTitle={true} />)
            })
            expect(screen.queryByText('Performance Traces')).not.toBeInTheDocument()
        })

        it('does not call fetchTraceFromServer in demo mode', async () => {
            await act(async () => {
                render(<TraceDetails demo={true} />)
            })
            expect(mockFetchTrace).not.toHaveBeenCalled()
        })

        it('renders non-clickable session timeline button in demo mode', async () => {
            await act(async () => {
                render(<TraceDetails demo={true} />)
            })
            expect(screen.getByText('View Session Timeline')).toBeInTheDocument()
            expect(screen.getByText('View Session Timeline').closest('a')).toBeNull()
        })
    })
})
