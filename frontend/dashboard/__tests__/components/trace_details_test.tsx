import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, render, screen, waitFor } from '@testing-library/react'

const emptyTrace = {
    app_id: '', trace_id: '', session_id: '', user_id: '',
    start_time: '', end_time: '', duration: 0, app_version: '',
    os_version: '', device_manufacturer: '', device_model: '',
    network_type: '', spans: [],
}

// Mock query hook
let mockTraceData: any = undefined
let mockTraceStatus: string = 'pending'

jest.mock('@/app/query/hooks', () => ({
    __esModule: true,
    useTraceQuery: () => ({
        data: mockTraceData,
        status: mockTraceStatus,
    }),
}))

jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    emptyTrace: {
        app_id: '', trace_id: '', session_id: '', user_id: '',
        start_time: '', end_time: '', duration: 0, app_version: '',
        os_version: '', device_manufacturer: '', device_model: '',
        network_type: '', spans: [],
    },
}))

jest.mock('@/app/utils/time_utils', () => ({
    formatDateToHumanReadableDateTime: (ts: string) => `formatted:${ts}`,
    formatMillisToHumanReadable: (ms: number) => `${ms}ms`,
}))

jest.mock('@/app/components/skeleton', () => ({
    Skeleton: ({ className, ...props }: any) => <div data-testid="skeleton-mock" className={className} {...props} />,
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

function mockTraceDataObj() {
    return {
        app_id: 'app-1', trace_id: 'trace-abc', session_id: 'session-xyz',
        user_id: 'user-1', start_time: '2024-01-01T00:00:00Z', end_time: '2024-01-01T00:01:00Z',
        duration: 1200, app_version: '2.0.0 (200)', os_version: 'android 33',
        device_manufacturer: 'Google ', device_model: 'Pixel 7',
        network_type: 'Wifi', spans: [],
    }
}

describe('TraceDetails', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockTraceData = undefined
        mockTraceStatus = 'pending'
    })

    describe('Loading state', () => {
        it('shows loading spinner initially', async () => {
            mockTraceStatus = 'pending'
            await act(async () => {
                render(<TraceDetails params={{ teamId: 'team-1', appId: 'app-1', traceId: 'trace-abc' }} />)
            })
            expect(screen.getAllByTestId('skeleton-mock').length).toBeGreaterThan(0)
        })
    })

    describe('Error state', () => {
        it('shows error message on API failure', async () => {
            mockTraceStatus = 'error'
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
            mockTraceData = mockTraceDataObj()
            mockTraceStatus = 'success'
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
            mockTraceData = { ...mockTraceDataObj(), user_id: '' }
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

        it('renders non-clickable session timeline button in demo mode', async () => {
            await act(async () => {
                render(<TraceDetails demo={true} />)
            })
            expect(screen.getByText('View Session Timeline')).toBeInTheDocument()
            expect(screen.getByText('View Session Timeline').closest('a')).toBeNull()
        })
    })
})
