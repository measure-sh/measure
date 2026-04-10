import { describe, expect, it, beforeEach } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, render, screen, waitFor } from '@testing-library/react'
import React from 'react'

const mockFetchMetrics = jest.fn()
const mockFetchThresholdPrefs = jest.fn()

jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    MetricsApiStatus: { Loading: 0, Success: 1, Error: 2 },
    FetchAppThresholdPrefsApiStatus: { Success: 0, Error: 1, Cancelled: 2 },
    emptyMetrics: {
        adoption: { all_versions: 0, selected_version: 0, adoption: 0, nan: true },
        crash_free_sessions: { crash_free_sessions: 0, delta: 0, nan: true },
        perceived_crash_free_sessions: { perceived_crash_free_sessions: 0, delta: 0, nan: true },
        anr_free_sessions: null,
        perceived_anr_free_sessions: null,
        cold_launch: { p95: 0, delta: 0, nan: true, delta_nan: true },
        warm_launch: { p95: 0, delta: 0, nan: true, delta_nan: true },
        hot_launch: { p95: 0, delta: 0, nan: true, delta_nan: true },
        sizes: null,
    },
    defaultAppThresholdPrefs: { error_good_threshold: 99, error_caution_threshold: 95 },
    fetchMetricsFromServer: (...args: any[]) => mockFetchMetrics(...args),
    fetchAppThresholdPrefsFromServer: (...args: any[]) => mockFetchThresholdPrefs(...args),
}))

jest.mock('@/app/components/filters', () => ({
    __esModule: true,
}))

jest.mock('@/app/components/metrics_card', () => ({
    __esModule: true,
    default: ({ type, status, launchType }: any) => (
        <div data-testid={`metrics-card-${type}${launchType ? `-${launchType}` : ''}`} data-status={status}>
            {type}{launchType ? ` ${launchType}` : ''}
        </div>
    ),
}))

import MetricsOverview from '@/app/components/metrics_overview'

function readyFilters(overrides: Record<string, any> = {}) {
    return {
        ready: true,
        app: { id: 'app-1' },
        versions: { selected: [{ name: '1.0', code: '1' }], all: false },
        ...overrides,
    }
}

function mockMetricsData() {
    return {
        adoption: { all_versions: 10000, selected_version: 4100, adoption: 41, nan: false },
        crash_free_sessions: { crash_free_sessions: 99.1, delta: 1.1, nan: false },
        perceived_crash_free_sessions: { perceived_crash_free_sessions: 99.6, delta: 1.05, nan: false },
        anr_free_sessions: { anr_free_sessions: 99.7, delta: 1.01, nan: false },
        perceived_anr_free_sessions: { perceived_anr_free_sessions: 99.8, delta: 1.05, nan: false },
        cold_launch: { p95: 923, delta: 0.07, nan: false, delta_nan: false },
        warm_launch: { p95: 503, delta: 1.03, nan: false, delta_nan: false },
        hot_launch: { p95: 197, delta: 0.02, nan: false, delta_nan: false },
        sizes: { average_app_size: 23000000, selected_app_size: 23345678, delta: -345678, nan: false },
    }
}

describe('MetricsOverview', () => {
    describe('API integration', () => {
        beforeEach(() => {
            mockFetchMetrics.mockReset()
            mockFetchThresholdPrefs.mockReset()
        })

        it('does not fetch metrics when filters are not ready', async () => {
            mockFetchMetrics.mockResolvedValue({ status: 1, data: mockMetricsData() })
            await act(async () => {
                render(<MetricsOverview filters={{ ready: false } as any} />)
            })
            expect(mockFetchMetrics).not.toHaveBeenCalled()
        })

        it('fetches metrics when filters are ready', async () => {
            mockFetchMetrics.mockResolvedValue({ status: 1, data: mockMetricsData() })
            mockFetchThresholdPrefs.mockResolvedValue({ status: 0, data: { error_good_threshold: 99, error_caution_threshold: 95 } })
            await act(async () => {
                render(<MetricsOverview filters={readyFilters() as any} />)
            })
            expect(mockFetchMetrics).toHaveBeenCalled()
        })

        it('fetches threshold prefs with app id', async () => {
            mockFetchMetrics.mockResolvedValue({ status: 1, data: mockMetricsData() })
            mockFetchThresholdPrefs.mockResolvedValue({ status: 0, data: { error_good_threshold: 99, error_caution_threshold: 95 } })
            await act(async () => {
                render(<MetricsOverview filters={readyFilters() as any} />)
            })
            expect(mockFetchThresholdPrefs).toHaveBeenCalledWith('app-1')
        })
    })

    describe('Success state', () => {
        beforeEach(() => {
            mockFetchMetrics.mockResolvedValue({ status: 1, data: mockMetricsData() })
            mockFetchThresholdPrefs.mockResolvedValue({ status: 0, data: { error_good_threshold: 99, error_caution_threshold: 95 } })
        })

        it('renders all metrics cards', async () => {
            await act(async () => {
                render(<MetricsOverview filters={readyFilters() as any} />)
            })
            await waitFor(() => {
                expect(screen.getByTestId('metrics-card-app_adoption')).toBeInTheDocument()
                expect(screen.getByTestId('metrics-card-crash_free_sessions')).toBeInTheDocument()
                expect(screen.getByTestId('metrics-card-perceived_crash_free_sessions')).toBeInTheDocument()
                expect(screen.getByTestId('metrics-card-anr_free_sessions')).toBeInTheDocument()
                expect(screen.getByTestId('metrics-card-perceived_anr_free_sessions')).toBeInTheDocument()
                expect(screen.getByTestId('metrics-card-app_start_time-Cold')).toBeInTheDocument()
                expect(screen.getByTestId('metrics-card-app_start_time-Warm')).toBeInTheDocument()
                expect(screen.getByTestId('metrics-card-app_start_time-Hot')).toBeInTheDocument()
                expect(screen.getByTestId('metrics-card-app_size')).toBeInTheDocument()
            })
        })
    })

    describe('Demo mode', () => {
        it('does not call fetchMetricsFromServer in demo mode', async () => {
            await act(async () => {
                render(<MetricsOverview filters={{ ready: false, versions: { selected: [], all: false } } as any} demo={true} />)
            })
            expect(mockFetchMetrics).not.toHaveBeenCalled()
        })

        it('does not call fetchAppThresholdPrefsFromServer in demo mode', async () => {
            await act(async () => {
                render(<MetricsOverview filters={{ ready: false, versions: { selected: [], all: false } } as any} demo={true} />)
            })
            expect(mockFetchThresholdPrefs).not.toHaveBeenCalled()
        })

        it('renders metrics cards in demo mode', async () => {
            await act(async () => {
                render(<MetricsOverview filters={{ ready: false, versions: { selected: [], all: false } } as any} demo={true} />)
            })
            expect(screen.getByTestId('metrics-card-app_adoption')).toBeInTheDocument()
            expect(screen.getByTestId('metrics-card-crash_free_sessions')).toBeInTheDocument()
        })
    })

    describe('Conditional rendering', () => {
        it('does not render ANR card when anr_free_sessions is null', async () => {
            const data = mockMetricsData()
            data.anr_free_sessions = null as any
            data.perceived_anr_free_sessions = null as any
            mockFetchMetrics.mockResolvedValue({ status: 1, data })
            mockFetchThresholdPrefs.mockResolvedValue({ status: 0, data: { error_good_threshold: 99, error_caution_threshold: 95 } })
            await act(async () => {
                render(<MetricsOverview filters={readyFilters() as any} />)
            })
            await waitFor(() => {
                expect(screen.queryByTestId('metrics-card-anr_free_sessions')).not.toBeInTheDocument()
                expect(screen.queryByTestId('metrics-card-perceived_anr_free_sessions')).not.toBeInTheDocument()
            })
        })

        it('does not render app size card when sizes is null', async () => {
            const data = mockMetricsData()
            data.sizes = null as any
            mockFetchMetrics.mockResolvedValue({ status: 1, data })
            mockFetchThresholdPrefs.mockResolvedValue({ status: 0, data: { error_good_threshold: 99, error_caution_threshold: 95 } })
            await act(async () => {
                render(<MetricsOverview filters={readyFilters() as any} />)
            })
            await waitFor(() => {
                expect(screen.queryByTestId('metrics-card-app_size')).not.toBeInTheDocument()
            })
        })
    })
})
