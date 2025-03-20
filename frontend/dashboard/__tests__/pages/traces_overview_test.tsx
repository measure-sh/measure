import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, beforeEach, expect } from '@jest/globals'
import '@testing-library/jest-dom'
import TracesOverview from '@/app/[teamId]/traces/page'

// Global replace mock for router.replace
const replaceMock = jest.fn()

// Mock next/navigation hooks
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: replaceMock,
    }),
    // By default, return empty search params.
    useSearchParams: () => new URLSearchParams(),
}))

// Mock API calls and constants for traces overview with valid data.
jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    emptySpansResponse: {
        meta: { next: false, previous: false },
        results: [],
    },
    SpansApiStatus: {
        Loading: 'loading',
        Error: 'error',
        Success: 'success'
    },
    fetchSpansFromServer: jest.fn(() =>
        Promise.resolve({
            status: 'success',
            data: {
                results: [
                    {
                        app_id: 'app1',
                        span_name: 'Test Span',
                        span_id: 'span1',
                        trace_id: 'trace1',
                        status: 1,
                        start_time: "2020-01-01T00:00:00Z",
                        end_time: "2020-01-01T00:05:00Z",
                        duration: 5000,
                        app_version: '1.0',
                        app_build: '1',
                        os_name: 'iOS',
                        os_version: '15',
                        device_manufacturer: 'Apple',
                        device_model: 'iPhone 12',
                    }
                ],
                // Enable both previous and next for pagination tests.
                meta: { previous: true, next: true },
            }
        })
    ),
    FilterSource: { Spans: 'spans' },
}))

// Update the Filters mock to always render two update buttons.
jest.mock('@/app/components/filters', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="filters-mock">
            <button
                data-testid="update-filters"
                onClick={() =>
                    props.onFiltersChanged({ ready: true, serialisedFilters: 'updated' })
                }
            >
                Update Filters
            </button>
            <button
                data-testid="update-filters-2"
                onClick={() =>
                    props.onFiltersChanged({ ready: true, serialisedFilters: 'updated2' })
                }
            >
                Update Filters 2
            </button>
        </div>
    ),
    AppVersionsInitialSelectionType: { All: 'all' },
    defaultFilters: { ready: false, serialisedFilters: '' },
}))

// Mock SpanMetricsPlot component.
jest.mock('@/app/components/span_metrics_plot', () => () => (
    <div data-testid="span-metrics-plot-mock">TracesOverviewPlot Rendered</div>
))

// Updated Paginator mock renders Next and Prev buttons.
jest.mock('@/app/components/paginator', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="paginator-mock">
            <button data-testid="prev-button" onClick={props.onPrev} disabled={!props.prevEnabled}>Prev</button>
            <button data-testid="next-button" onClick={props.onNext} disabled={!props.nextEnabled}>Next</button>
            <span>{props.displayText}</span>
        </div>
    ),
}))

// Mock LoadingBar component.
jest.mock('@/app/components/loading_bar', () => () => (
    <div data-testid="loading-bar-mock">LoadingBar Rendered</div>
))

// Mock time utils
jest.mock('@/app/utils/time_utils', () => ({
    formatDateToHumanReadableDate: jest.fn(() => 'Jan 1, 2020'),
    formatDateToHumanReadableTime: jest.fn(() => '12:00 AM'),
    formatMillisToHumanReadable: jest.fn(() => '5s')
}))

// Mock Next.js Link component
jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
        <a href={href} className={className} data-testid="mock-link">
            {children}
        </a>
    ),
}))

describe('TracesOverview Component', () => {
    beforeEach(() => {
        replaceMock.mockClear()
    })

    it('renders the Traces heading and Filters component', () => {
        render(<TracesOverview params={{ teamId: '123' }} />)
        expect(screen.getByText('Traces')).toBeInTheDocument()
        expect(screen.getByTestId('filters-mock')).toBeInTheDocument()
    })

    it('does not render main traces UI when filters are not ready', () => {
        render(<TracesOverview params={{ teamId: '123' }} />)
        expect(screen.queryByTestId('span-metrics-plot-mock')).not.toBeInTheDocument()
        expect(screen.queryByTestId('paginator-mock')).not.toBeInTheDocument()
        expect(screen.queryByTestId('loading-bar-mock')).not.toBeInTheDocument()
        expect(screen.queryByText('Trace Id')).not.toBeInTheDocument()
    })

    it('renders main traces UI, updates URL when filters become ready, and renders table headers', async () => {
        render(<TracesOverview params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check URL update.
        expect(replaceMock).toHaveBeenCalledWith('?po=0&updated', { scroll: false })

        // Verify main UI components are rendered.
        expect(await screen.findByTestId('span-metrics-plot-mock')).toBeInTheDocument()
        expect(await screen.findByTestId('paginator-mock')).toBeInTheDocument()
        // Check that the table header cells are rendered.
        expect(screen.getByText('Traces')).toBeInTheDocument()
        expect(screen.getByText('Start Time')).toBeInTheDocument()
        expect(screen.getByText('Duration')).toBeInTheDocument()
        expect(screen.getByText('Status')).toBeInTheDocument()
    })

    it('displays span data correctly when API returns results', async () => {
        render(<TracesOverview params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        Promise.resolve({
            status: 'success',
            data: {
                results: [
                    {
                        app_id: 'app1',
                        span_name: 'Test Span',
                        span_id: 'span1',
                        trace_id: 'trace1',
                        status: 1,
                        start_time: "2020-01-01T00:00:00Z",
                        end_time: "2020-01-01T00:05:00Z",
                        duration: 5000,
                        app_version: '1.0',
                        app_build: '1',
                        os_name: 'iOS',
                        os_version: '15',
                        device_manufacturer: 'Apple',
                        device_model: 'iPhone 12',
                    }
                ],
                // Enable both previous and next for pagination tests.
                meta: { previous: true, next: true },
            }
        })

        // Verify the bug report data is displayed
        expect(screen.getByText('Test Span')).toBeInTheDocument()
        expect(screen.getByText('Jan 1, 2020')).toBeInTheDocument()
        expect(screen.getByText('12:00 AM')).toBeInTheDocument()
        expect(screen.getByText('5s')).toBeInTheDocument()
        expect(screen.getByText('Okay')).toBeInTheDocument()
        expect(screen.getByText('v1.0(1), iOS 15, Apple iPhone 12')).toBeInTheDocument()
    })

    it('does not update filters if they remain unchanged', async () => {
        render(<TracesOverview params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })
        expect(replaceMock).toHaveBeenCalledTimes(1)
        await act(async () => {
            fireEvent.click(updateButton)
        })
        expect(replaceMock).toHaveBeenCalledTimes(1)
    })

    it('shows error message when API returns error status', async () => {
        // Override the mock to return an error
        const { fetchSpansFromServer } = require('@/app/api/api_calls')
        fetchSpansFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 'error',
            })
        )

        render(<TracesOverview params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check that error message is displayed
        expect(screen.getByText(/Error fetching list of traces/)).toBeInTheDocument()
    })

    it('renders appropriate link for each span that includes teamId, app_id and trace_id', async () => {
        render(<TracesOverview params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check that the link includes the correct path
        const link = screen.getByTestId('mock-link')
        expect(link).toHaveAttribute('href', '/123/traces/app1/trace1')
    })

    describe('Pagination offset handling', () => {
        it('initializes pagination offset to 0 when no offset is provided', async () => {
            render(<TracesOverview params={{ teamId: '123' }} />)
            const updateButton = screen.getByTestId('update-filters')
            await act(async () => {
                fireEvent.click(updateButton)
            })
            expect(replaceMock).toHaveBeenCalledWith('?po=0&updated', { scroll: false })
        })

        it('increments pagination offset when Next is clicked', async () => {
            render(<TracesOverview params={{ teamId: '123' }} />)
            const updateButton = screen.getByTestId('update-filters')
            await act(async () => {
                fireEvent.click(updateButton)
            })
            const nextButton = await screen.findByTestId('next-button')
            await act(async () => {
                fireEvent.click(nextButton)
            })
            // The pagination limit is 5 so offset should be 5.
            expect(replaceMock).toHaveBeenLastCalledWith('?po=5&updated', { scroll: false })
        })

        it('decrements pagination offset when Prev is clicked, but not below 0', async () => {
            render(<TracesOverview params={{ teamId: '123' }} />)
            const updateButton = screen.getByTestId('update-filters')
            await act(async () => {
                fireEvent.click(updateButton)
            })
            const nextButton = await screen.findByTestId('next-button')
            await act(async () => {
                fireEvent.click(nextButton)
            })
            expect(replaceMock).toHaveBeenLastCalledWith('?po=5&updated', { scroll: false })
            const prevButton = await screen.findByTestId('prev-button')
            await act(async () => {
                fireEvent.click(prevButton)
            })
            expect(replaceMock).toHaveBeenLastCalledWith('?po=0&updated', { scroll: false })
            await act(async () => {
                fireEvent.click(prevButton)
            })
            expect(replaceMock).toHaveBeenLastCalledWith('?po=0&updated', { scroll: false })
        })

        it('resets pagination offset to 0 when filters change (if previous filters were non-default)', async () => {
            // Override useSearchParams to simulate an initial offset.
            const { useSearchParams } = jest.requireActual('next/navigation')
            const useSearchParamsSpy = jest
                .spyOn(require('next/navigation'), 'useSearchParams')
                .mockReturnValue(new URLSearchParams('?po=5'))

            render(<TracesOverview params={{ teamId: '123' }} />)
            const updateButton = screen.getByTestId('update-filters')
            // First update: filters become ready with "updated" and offset parsed from URL is 5.
            await act(async () => {
                fireEvent.click(updateButton)
            })
            expect(replaceMock).toHaveBeenCalledWith('?po=5&updated', { scroll: false })

            // Click Next to further increment the offset.
            const nextButton = await screen.findByTestId('next-button')
            await act(async () => {
                fireEvent.click(nextButton)
            })
            expect(replaceMock).toHaveBeenLastCalledWith('?po=10&updated', { scroll: false })

            // Now simulate a filter change with a different value.
            const updateButton2 = screen.getByTestId('update-filters-2')
            await act(async () => {
                fireEvent.click(updateButton2)
                await new Promise(resolve => setTimeout(resolve, 0))
            })
            expect(replaceMock).toHaveBeenLastCalledWith('?po=0&updated2', { scroll: false })
            useSearchParamsSpy.mockRestore()
        })
    })

    it('correctly toggles loading bar visibility based on API status', async () => {
        // Mock implementation to control loading state
        const { fetchSpansFromServer } = require('@/app/api/api_calls')

        // Create a promise that won't resolve immediately to maintain loading state
        let resolvePromise: (value: any) => void
        const loadingPromise = new Promise(resolve => {
            resolvePromise = resolve
        })

        fetchSpansFromServer.mockImplementationOnce(() => loadingPromise)

        render(<TracesOverview params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')

        // Click to trigger loading state
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Test the loading state - loading bar should be visible
        const loadingBarContainer = screen.getByTestId('loading-bar-mock').parentElement
        expect(loadingBarContainer).toHaveClass('visible')
        expect(loadingBarContainer).not.toHaveClass('invisible')

        // Resolve the loading promise to move to success state
        await act(async () => {
            resolvePromise({
                status: 'success',
                data: {
                    results: [
                        {
                            app_id: 'app1',
                            span_name: 'Test Span',
                            span_id: 'span1',
                            trace_id: 'trace1',
                            status: 1,
                            start_time: "2020-01-01T00:00:00Z",
                            end_time: "2020-01-01T00:05:00Z",
                            duration: 5000,
                            app_version: '1.0',
                            app_build: '1',
                            os_name: 'iOS',
                            os_version: '15',
                            device_manufacturer: 'Apple',
                            device_model: 'iPhone 12',
                        }
                    ],
                    // Enable both previous and next for pagination tests.
                    meta: { previous: true, next: true },
                }
            })
        })

        // After loading, the loading bar should be invisible
        await screen.findByText('Test Span')
        expect(loadingBarContainer).not.toHaveClass('visible')
        expect(loadingBarContainer).toHaveClass('invisible')
    })
})