import MetricsOverview from '@/app/components/metrics_overview'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, render, screen, waitFor } from '@testing-library/react'

jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
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

jest.mock('@/app/stores/provider', () => {
    const { create } = jest.requireActual('zustand')
    const filtersStore = create(() => ({
        filters: { ready: false, serialisedFilters: '', versions: { selected: [], all: false } },
    }))
    return { __esModule: true, useFiltersStore: filtersStore }
})

const mockUseMetricsQuery = jest.fn(() => ({
    data: undefined as any,
    status: 'pending' as string,
    error: null as Error | null,
}))

const mockUseAppThresholdPrefsQuery = jest.fn(() => ({
    data: undefined as any,
    status: 'pending' as string,
    error: null as Error | null,
}))

jest.mock('@/app/query/hooks', () => ({
    __esModule: true,
    useMetricsQuery: () => mockUseMetricsQuery(),
    useAppThresholdPrefsQuery: () => mockUseAppThresholdPrefsQuery(),
}))

const { useFiltersStore } = require('@/app/stores/provider') as any

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

const emptyMetrics = {
    adoption: { all_versions: 0, selected_version: 0, adoption: 0, nan: true },
    crash_free_sessions: { crash_free_sessions: 0, delta: 0, nan: true },
    perceived_crash_free_sessions: { perceived_crash_free_sessions: 0, delta: 0, nan: true },
    anr_free_sessions: null,
    perceived_anr_free_sessions: null,
    cold_launch: { p95: 0, delta: 0, nan: true, delta_nan: true },
    warm_launch: { p95: 0, delta: 0, nan: true, delta_nan: true },
    hot_launch: { p95: 0, delta: 0, nan: true, delta_nan: true },
    sizes: null,
}

describe('MetricsOverview', () => {
    describe('API integration', () => {
        beforeEach(() => {
            useFiltersStore.setState({ filters: { ready: false, serialisedFilters: '', versions: { selected: [], all: false } } })
            mockUseMetricsQuery.mockReset()
            mockUseAppThresholdPrefsQuery.mockReset()
            mockUseMetricsQuery.mockReturnValue({ data: undefined, status: 'pending' as string, error: null })
            mockUseAppThresholdPrefsQuery.mockReturnValue({ data: undefined, status: 'pending' as string, error: null })
        })

        it('renders metrics cards with pending status when filters are not ready', async () => {
            useFiltersStore.setState({ filters: { ready: false, versions: { selected: [], all: false } } })
            await act(async () => {
                render(<MetricsOverview />)
            })
            // The component renders with emptyMetrics defaults when data is undefined
            expect(screen.getByTestId('metrics-card-app_adoption')).toBeInTheDocument()
        })

        it('renders metrics cards with data when filters are ready and query succeeds', async () => {
            useFiltersStore.setState({ filters: readyFilters() })
            mockUseMetricsQuery.mockReturnValue({
                data: mockMetricsData(),
                status: 'success',
                error: null as Error | null,
            })
            mockUseAppThresholdPrefsQuery.mockReturnValue({
                data: { error_good_threshold: 99, error_caution_threshold: 95 },
                status: 'success',
                error: null as Error | null,
            })
            await act(async () => {
                render(<MetricsOverview />)
            })
            expect(screen.getByTestId('metrics-card-app_adoption')).toBeInTheDocument()
            expect(screen.getByTestId('metrics-card-crash_free_sessions')).toBeInTheDocument()
        })
    })

    describe('Success state', () => {
        beforeEach(() => {
            useFiltersStore.setState({ filters: readyFilters() })
            mockUseMetricsQuery.mockReset()
            mockUseAppThresholdPrefsQuery.mockReset()
            mockUseMetricsQuery.mockReturnValue({
                data: mockMetricsData(),
                status: 'success',
                error: null as Error | null,
            })
            mockUseAppThresholdPrefsQuery.mockReturnValue({
                data: { error_good_threshold: 99, error_caution_threshold: 95 },
                status: 'success',
                error: null as Error | null,
            })
        })

        it('renders all metrics cards', async () => {
            await act(async () => {
                render(<MetricsOverview />)
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
        beforeEach(() => {
            useFiltersStore.setState({ filters: { ready: false, versions: { selected: [], all: false } } })
            mockUseMetricsQuery.mockReset()
            mockUseAppThresholdPrefsQuery.mockReset()
            mockUseMetricsQuery.mockReturnValue({ data: undefined, status: 'pending' as string, error: null })
            mockUseAppThresholdPrefsQuery.mockReturnValue({ data: undefined, status: 'pending' as string, error: null })
        })

        it('renders metrics cards in demo mode', async () => {
            await act(async () => {
                render(<MetricsOverview demo={true} />)
            })
            expect(screen.getByTestId('metrics-card-app_adoption')).toBeInTheDocument()
            expect(screen.getByTestId('metrics-card-crash_free_sessions')).toBeInTheDocument()
        })
    })

    describe('Conditional rendering', () => {
        beforeEach(() => {
            useFiltersStore.setState({ filters: readyFilters() })
            mockUseMetricsQuery.mockReset()
            mockUseAppThresholdPrefsQuery.mockReset()
            mockUseAppThresholdPrefsQuery.mockReturnValue({
                data: { error_good_threshold: 99, error_caution_threshold: 95 },
                status: 'success',
                error: null as Error | null,
            })
        })

        it('does not render ANR card when anr_free_sessions is null', async () => {
            const data = mockMetricsData()
            data.anr_free_sessions = null as any
            data.perceived_anr_free_sessions = null as any
            mockUseMetricsQuery.mockReturnValue({ data, status: 'success', error: null })
            await act(async () => {
                render(<MetricsOverview />)
            })
            await waitFor(() => {
                expect(screen.queryByTestId('metrics-card-anr_free_sessions')).not.toBeInTheDocument()
                expect(screen.queryByTestId('metrics-card-perceived_anr_free_sessions')).not.toBeInTheDocument()
            })
        })

        it('does not render app size card when sizes is null', async () => {
            const data = mockMetricsData()
            data.sizes = null as any
            mockUseMetricsQuery.mockReturnValue({ data, status: 'success', error: null })
            await act(async () => {
                render(<MetricsOverview />)
            })
            await waitFor(() => {
                expect(screen.queryByTestId('metrics-card-app_size')).not.toBeInTheDocument()
            })
        })
    })
})
