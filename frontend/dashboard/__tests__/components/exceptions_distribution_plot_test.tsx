import { describe, expect, it, beforeEach } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, render, screen, waitFor } from '@testing-library/react'
import React from 'react'

const mockFetchPlot = jest.fn()

jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    ExceptionsDistributionPlotApiStatus: { Loading: 0, Success: 1, Error: 2, NoData: 3 },
    ExceptionsType: { Crash: 'crash', Anr: 'anr' },
    fetchExceptionsDistributionPlotFromServer: (...args: any[]) => mockFetchPlot(...args),
}))

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

jest.mock('@/app/components/loading_spinner', () => ({
    __esModule: true,
    default: () => <div data-testid="loading-spinner">Loading...</div>,
}))

import ExceptionsDistributionPlot from '@/app/components/exceptions_distribution_plot'

function readyFilters() {
    return { ready: true, app: { id: 'app-1' } }
}

function mockPlotData() {
    return {
        app_version: { '1.0.0 (100)': 1796, '2.0.0 (200)': 2204 },
        country: { UK: 1200, US: 2800 },
        os_version: { 'android 27': 200, 'android 33': 3200 },
    }
}

describe('ExceptionsDistributionPlot', () => {
    describe('API states', () => {
        it('shows loading spinner while loading', async () => {
            mockFetchPlot.mockReturnValue(new Promise(() => { }))
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" filters={readyFilters() as any} />)
            })
            expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
        })

        it('shows error message on error', async () => {
            mockFetchPlot.mockResolvedValue({ status: 2 })
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" filters={readyFilters() as any} />)
            })
            await waitFor(() => {
                expect(screen.getByText(/Error fetching plot/)).toBeInTheDocument()
            })
        })

        it('shows "No Data" on NoData status', async () => {
            mockFetchPlot.mockResolvedValue({ status: 3 })
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" filters={readyFilters() as any} />)
            })
            await waitFor(() => {
                expect(screen.getByText('No Data')).toBeInTheDocument()
            })
        })
    })

    describe('Success state', () => {
        beforeEach(() => {
            mockFetchPlot.mockResolvedValue({ status: 1, data: mockPlotData() })
        })

        it('renders ResponsiveBar chart', async () => {
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" filters={readyFilters() as any} />)
            })
            await waitFor(() => {
                expect(screen.getByTestId('responsive-bar')).toBeInTheDocument()
            })
        })

        it('transforms os_version keys for Android', async () => {
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" filters={readyFilters() as any} />)
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
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" filters={readyFilters() as any} />)
            })
            await waitFor(() => {
                const bar = screen.getByTestId('responsive-bar')
                const data = bar.textContent!
                expect(data).toContain('App Version')
                expect(data).toContain('Country')
            })
        })

        it('transforms ios os_version keys', async () => {
            mockFetchPlot.mockResolvedValue({ status: 1, data: { os_version: { 'ios 17': 500 } } })
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" filters={readyFilters() as any} />)
            })
            await waitFor(() => {
                const bar = screen.getByTestId('responsive-bar')
                expect(bar.textContent).toContain('iOS 17')
            })
        })

        it('transforms ipados os_version keys', async () => {
            mockFetchPlot.mockResolvedValue({ status: 1, data: { os_version: { 'ipados 17': 300 } } })
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" filters={readyFilters() as any} />)
            })
            await waitFor(() => {
                const bar = screen.getByTestId('responsive-bar')
                expect(bar.textContent).toContain('iPadOS 17')
            })
        })

        it('passes through unknown os names', async () => {
            mockFetchPlot.mockResolvedValue({ status: 1, data: { os_version: { 'linux 5.4': 100 } } })
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" filters={readyFilters() as any} />)
            })
            await waitFor(() => {
                const bar = screen.getByTestId('responsive-bar')
                expect(bar.textContent).toContain('linux 5.4')
            })
        })

        it('handles single-word os_version key without version', async () => {
            mockFetchPlot.mockResolvedValue({ status: 1, data: { os_version: { 'unknown': 50 } } })
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" filters={readyFilters() as any} />)
            })
            await waitFor(() => {
                const bar = screen.getByTestId('responsive-bar')
                expect(bar.textContent).toContain('unknown')
            })
        })

        it('uses "API Level" label for os_version when android data present', async () => {
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" filters={readyFilters() as any} />)
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
            mockFetchPlot.mockResolvedValue({ status: 1, data: mockPlotData() })
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" filters={{ ready: false } as any} />)
            })
            expect(mockFetchPlot).not.toHaveBeenCalled()
        })

        it('calls API with correct arguments', async () => {
            mockFetchPlot.mockResolvedValue({ status: 1, data: mockPlotData() })
            const filters = readyFilters()
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" filters={filters as any} />)
            })
            expect(mockFetchPlot).toHaveBeenCalledWith('crash', 'grp-1', filters)
        })
    })

    describe('Demo mode', () => {
        it('does not call API in demo mode', async () => {
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" filters={{ ready: false } as any} demo={true} />)
            })
            expect(mockFetchPlot).not.toHaveBeenCalled()
        })

        it('renders chart in demo mode', async () => {
            await act(async () => {
                render(<ExceptionsDistributionPlot exceptionsType={'crash' as any} exceptionsGroupId="grp-1" filters={{ ready: false } as any} demo={true} />)
            })
            expect(screen.getByTestId('responsive-bar')).toBeInTheDocument()
        })
    })
})
