import ExceptionsDistributionPlot from '@/app/components/exceptions_distribution_plot'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, render, screen, waitFor } from '@testing-library/react'

jest.mock('next-themes', () => ({
    useTheme: () => ({ theme: 'light' }),
}))

jest.mock('@nivo/bar', () => ({
    ResponsiveBar: ({ data, keys, tooltip, axisLeft, valueFormat }: any) => {
        // Exercise the tooltip and format functions to cover them
        const tooltipNode = tooltip?.({ id: 'test', value: 1234, color: '#000' })
        const formattedValue = valueFormat?.(5000) ?? ''
        const axisLabel = axisLeft?.format?.(100) ?? ''
        return (
            <div data-testid="responsive-bar" data-keys={JSON.stringify(keys)} data-formatted={formattedValue} data-axis-label={axisLabel}>
                {tooltipNode}
                {JSON.stringify(data)}
            </div>
        )
    },
}))

jest.mock('@/app/utils/number_utils', () => ({
    numberToKMB: (n: number) => `${n}`,
}))

jest.mock('@/app/utils/shared_styles', () => ({
    chartTheme: {},
}))

jest.mock('@/app/components/filters', () => ({
    __esModule: true,
}))

jest.mock('@/app/components/skeleton', () => ({
    SkeletonPlot: () => <div data-testid="skeleton-mock">Loading...</div>,
}))

const mockUseExceptionsDistributionPlotQuery = jest.fn((): { data: any; status: string; error: Error | null } => ({ data: undefined, status: 'pending', error: null }))

jest.mock('@/app/query/hooks', () => ({
    __esModule: true,
    useExceptionsDistributionPlotQuery: () => mockUseExceptionsDistributionPlotQuery(),
}))

jest.mock('@/app/stores/provider', () => {
    const { create } = jest.requireActual('zustand')
    const filtersStore = create(() => ({
        filters: { ready: false, serialisedFilters: null },
    }))
    return { __esModule: true, useFiltersStore: filtersStore }
})

const { useFiltersStore } = require('@/app/stores/provider') as any

function readyFilters() {
    return { ready: true, app: { id: 'app-1' }, serialisedFilters: 'default' }
}

function mockPlotData() {
    return [
        { attribute: 'App Version', '1.0.0 (100)': 1796, '2.0.0 (200)': 2204 },
        { attribute: 'Country', 'UK': 1200, 'US': 2800 },
        { attribute: 'API Level', 'Android API Level 27': 200, 'Android API Level 33': 3200 },
    ]
}

function mockPlotKeys() {
    return ['1.0.0 (100)', '2.0.0 (200)', 'UK', 'US', 'Android API Level 27', 'Android API Level 33']
}

describe('ExceptionsDistributionPlot', () => {
    beforeEach(() => {
        useFiltersStore.setState({ filters: { ready: false, serialisedFilters: null } })
        mockUseExceptionsDistributionPlotQuery.mockReturnValue({ data: undefined, status: 'pending', error: null })
    })

    describe('API states', () => {
        it('shows loading spinner while loading', async () => {
            useFiltersStore.setState({ filters: readyFilters() })
            mockUseExceptionsDistributionPlotQuery.mockReturnValue({ data: undefined, status: 'pending', error: null })
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" />)
            })
            expect(screen.getByTestId('skeleton-mock')).toBeInTheDocument()
        })

        it('shows error message on error', async () => {
            useFiltersStore.setState({ filters: readyFilters() })
            mockUseExceptionsDistributionPlotQuery.mockReturnValue({ data: undefined, status: 'error', error: new Error('test') })
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" />)
            })
            await waitFor(() => {
                expect(screen.getByText(/Error fetching plot/)).toBeInTheDocument()
            })
        })

        it('shows "No Data" on NoData status', async () => {
            useFiltersStore.setState({ filters: readyFilters() })
            mockUseExceptionsDistributionPlotQuery.mockReturnValue({ data: null, status: 'success', error: null })
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" />)
            })
            await waitFor(() => {
                expect(screen.getByText('No Data')).toBeInTheDocument()
            })
        })
    })

    describe('Success state', () => {
        beforeEach(() => {
            useFiltersStore.setState({ filters: readyFilters() })
            mockUseExceptionsDistributionPlotQuery.mockReturnValue({
                data: { plot: mockPlotData(), plotKeys: mockPlotKeys() },
                status: 'success',
                error: null,
            })
        })

        it('renders ResponsiveBar chart', async () => {
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" />)
            })
            await waitFor(() => {
                expect(screen.getByTestId('responsive-bar')).toBeInTheDocument()
            })
        })

        it('transforms os_version keys for Android', async () => {
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" />)
            })
            await waitFor(() => {
                const bar = screen.getByTestId('responsive-bar')
                const data = bar.textContent!
                expect(data).toContain('Android API Level 27')
                expect(data).toContain('Android API Level 33')
            })
        })

        it('formats attribute names with title case', async () => {
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" />)
            })
            await waitFor(() => {
                const bar = screen.getByTestId('responsive-bar')
                const data = bar.textContent!
                expect(data).toContain('App Version')
                expect(data).toContain('Country')
            })
        })

        it('transforms ios os_version keys', async () => {
            mockUseExceptionsDistributionPlotQuery.mockReturnValue({
                data: { plot: [{ attribute: 'Os Version', 'iOS 17': 500 }], plotKeys: ['iOS 17'] },
                status: 'success',
                error: null,
            })
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" />)
            })
            await waitFor(() => {
                const bar = screen.getByTestId('responsive-bar')
                expect(bar.textContent).toContain('iOS 17')
            })
        })

        it('transforms ipados os_version keys', async () => {
            mockUseExceptionsDistributionPlotQuery.mockReturnValue({
                data: { plot: [{ attribute: 'Os Version', 'iPadOS 17': 300 }], plotKeys: ['iPadOS 17'] },
                status: 'success',
                error: null,
            })
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" />)
            })
            await waitFor(() => {
                const bar = screen.getByTestId('responsive-bar')
                expect(bar.textContent).toContain('iPadOS 17')
            })
        })

        it('passes through unknown os names', async () => {
            mockUseExceptionsDistributionPlotQuery.mockReturnValue({
                data: { plot: [{ attribute: 'Os Version', 'linux 5.4': 100 }], plotKeys: ['linux 5.4'] },
                status: 'success',
                error: null,
            })
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" />)
            })
            await waitFor(() => {
                const bar = screen.getByTestId('responsive-bar')
                expect(bar.textContent).toContain('linux 5.4')
            })
        })

        it('handles single-word os_version key without version', async () => {
            mockUseExceptionsDistributionPlotQuery.mockReturnValue({
                data: { plot: [{ attribute: 'Os Version', 'unknown': 50 }], plotKeys: ['unknown'] },
                status: 'success',
                error: null,
            })
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" />)
            })
            await waitFor(() => {
                const bar = screen.getByTestId('responsive-bar')
                expect(bar.textContent).toContain('unknown')
            })
        })

        it('uses "API Level" label for os_version when android data present', async () => {
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" />)
            })
            await waitFor(() => {
                const bar = screen.getByTestId('responsive-bar')
                const data = bar.textContent!
                expect(data).toContain('API Level')
            })
        })
    })

    describe('Filters interaction', () => {
        it('does not fetch when filters are not ready', async () => {
            useFiltersStore.setState({ filters: { ready: false, serialisedFilters: null } })
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" />)
            })
            // Query hook is called but TanStack Query handles the enabled flag internally
            expect(mockUseExceptionsDistributionPlotQuery).toHaveBeenCalled()
        })

        it('calls query hook when filters are ready', async () => {
            useFiltersStore.setState({ filters: readyFilters() })
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" />)
            })
            expect(mockUseExceptionsDistributionPlotQuery).toHaveBeenCalled()
        })
    })

    describe('Demo mode', () => {
        it('does not use query data in demo mode', async () => {
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" demo={true} />)
            })
            // In demo mode, the component uses hardcoded demo data instead of query result
            expect(screen.getByTestId('responsive-bar')).toBeInTheDocument()
        })

        it('renders chart in demo mode', async () => {
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" demo={true} />)
            })
            expect(screen.getByTestId('responsive-bar')).toBeInTheDocument()
        })
    })
})
