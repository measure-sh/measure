import { ExceptionsType } from '@/app/api/api_calls'
import { ExceptionsOverview } from '@/app/components/exceptions_overview'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'

// Global replace mock for router.replace
const replaceMock = jest.fn()
const pushMock = jest.fn()

// Mock next/navigation hooks
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: replaceMock,
        push: pushMock,
    }),
    // By default, return empty search params.
    useSearchParams: () => new URLSearchParams(),
}))

// Mock API calls and constants for exceptions overview with valid data.
jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    emptyExceptionsOverviewResponse: {
        meta: { next: false, previous: false },
        results: [],
    },
    ExceptionsOverviewApiStatus: {
        Loading: 'loading',
        Error: 'error',
        Success: 'success'
    },
    ExceptionsType: {
        Crash: 'crash',
        Anr: 'anr'
    },
    FilterSource: {
        Crashes: 'crashes',
        Anrs: 'anrs',
        Events: 'events'
    },
    fetchExceptionsOverviewFromServer: jest.fn((exceptionsType) => {
        if (exceptionsType === 'anr' || exceptionsType === 'Anr') {
            return Promise.resolve({
                status: 'success',
                data: {
                    results: [
                        {
                            id: 'exception2',
                            app_id: 'app2',
                            type: 'ANRException',
                            message: 'App not responding',
                            method_name: 'onPause',
                            file_name: 'MainActivity.kt',
                            line_number: 99,
                            fingerprint: 'fingerprint2',
                            count: 42,
                            percentage_contribution: 12.5,
                            created_at: '2020-02-01T00:00:00Z',
                            updated_at: '2020-02-02T00:00:00Z'
                        }
                    ],
                    meta: { previous: false, next: false },
                }
            })
        }
        // Default to crash
        return Promise.resolve({
            status: 'success',
            data: {
                results: [
                    {
                        id: 'exception1',
                        app_id: 'app1',
                        type: 'NullPointerException',
                        message: 'Attempt to invoke virtual method on a null object reference',
                        method_name: 'onCreate',
                        file_name: 'MainActivity.java',
                        line_number: 42,
                        fingerprint: 'fingerprint1',
                        count: 120,
                        percentage_contribution: 35.5,
                        created_at: '2020-01-01T00:00:00Z',
                        updated_at: '2020-01-02T00:00:00Z'
                    }
                ],
                // Enable both previous and next for pagination tests.
                meta: { previous: true, next: true },
            }
        })
    }),
}))

// Update the Filters mock to always render two update buttons.
jest.mock('@/app/components/filters', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="filters-mock">
            <button
                data-testid="update-filters"
                onClick={() =>
                    props.onFiltersChanged({
                        ready: true,
                        serialisedFilters: 'updated',
                        app: { id: 'app1' }
                    })
                }
            >
                Update Filters
            </button>
            <button
                data-testid="update-filters-2"
                onClick={() =>
                    props.onFiltersChanged({
                        ready: true,
                        serialisedFilters: 'updated2',
                        app: { id: 'app1' }
                    })
                }
            >
                Update Filters 2
            </button>
        </div>
    ),
    AppVersionsInitialSelectionType: { All: 'all' },
    defaultFilters: { ready: false, serialisedFilters: '' },
}))

// Mock ExceptionsOverviewPlot component.
jest.mock('@/app/components/exceptions_overview_plot', () => () => (
    <div data-testid="exceptions-overview-plot-mock">ExceptionsOverviewPlot Rendered</div>
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

describe('ExceptionsOverview Component - Crashes', () => {
    beforeEach(() => {
        replaceMock.mockClear()
        pushMock.mockClear()
    })

    it('renders the Crashes heading and Filters component', () => {
        render(<ExceptionsOverview exceptionsType={ExceptionsType.Crash} teamId="123" />)
        expect(screen.getByText('Crashes')).toBeInTheDocument()
        expect(screen.getByTestId('filters-mock')).toBeInTheDocument()
    })

    it('does not render main exceptions UI when filters are not ready', () => {
        render(<ExceptionsOverview exceptionsType={ExceptionsType.Crash} teamId="123" />)
        expect(screen.queryByTestId('exceptions-overview-plot-mock')).not.toBeInTheDocument()
        expect(screen.queryByTestId('paginator-mock')).not.toBeInTheDocument()
        expect(screen.queryByTestId('loading-bar-mock')).not.toBeInTheDocument()
        expect(screen.queryByText('Crash Name')).not.toBeInTheDocument()
    })

    it('renders main exceptions UI, updates URL when filters become ready, and renders table headers', async () => {
        render(<ExceptionsOverview exceptionsType={ExceptionsType.Crash} teamId="123" />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check URL update with kId, pl, and filters
        expect(replaceMock).toHaveBeenCalledWith('?pl=5&updated', { scroll: false })

        // Verify main UI components are rendered
        expect(await screen.findByTestId('exceptions-overview-plot-mock')).toBeInTheDocument()
        expect(await screen.findByTestId('paginator-mock')).toBeInTheDocument()

        // Check that the table header cells are rendered
        expect(screen.getByText('Crash')).toBeInTheDocument()
        expect(screen.getByText('Instances')).toBeInTheDocument()
        expect(screen.getByText('Percentage contribution')).toBeInTheDocument()
    })

    it('displays exception data correctly when API returns results', async () => {
        render(<ExceptionsOverview exceptionsType={ExceptionsType.Crash} teamId="123" />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        expect(screen.getByText('MainActivity.java: onCreate()')).toBeInTheDocument()
        expect(screen.getByText('NullPointerException:Attempt to invoke virtual method on a null object reference')).toBeInTheDocument()
        expect(screen.getByText('120')).toBeInTheDocument()
        expect(screen.getByText('35.5%')).toBeInTheDocument()
    })

    it('does not update filters if they remain unchanged', async () => {
        render(<ExceptionsOverview exceptionsType={ExceptionsType.Crash} teamId="123" />)
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
        const { fetchExceptionsOverviewFromServer } = require('@/app/api/api_calls')
        fetchExceptionsOverviewFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 'error',
            })
        )

        render(<ExceptionsOverview exceptionsType={ExceptionsType.Crash} teamId="123" />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check that error message is displayed
        expect(screen.getByText(/Error fetching list of crashes/)).toBeInTheDocument()
    })

    it('renders appropriate link for each crash that includes teamId, app_id, crash_group_id and crash_group_name', async () => {
        render(<ExceptionsOverview exceptionsType={ExceptionsType.Crash} teamId="123" />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check that the exception link is rendered with the correct href and accessible name
        const crashLink = screen.getByRole('link', { name: /MainActivity\.java: onCreate\(\)/i })
        expect(crashLink).toBeInTheDocument()
        expect(crashLink).toHaveAttribute('href', '/123/crashes/app1/exception1/NullPointerException@MainActivity.java')

        // Find the table row that contains this link
        const crashRow = crashLink.closest('tr')
        expect(crashRow).toBeInTheDocument()

        // Simulate keyboard navigation (Enter) on the row
        await act(async () => {
            fireEvent.keyDown(crashRow!, { key: 'Enter' })
        })
        expect(pushMock).toHaveBeenCalledWith('/123/crashes/app1/exception1/NullPointerException@MainActivity.java')

        // Simulate keyboard navigation (Space) on the row
        await act(async () => {
            fireEvent.keyDown(crashRow!, { key: ' ' })
        })
        expect(pushMock).toHaveBeenCalledWith('/123/crashes/app1/exception1/NullPointerException@MainActivity.java')
    })

    it('handles exceptions with empty file_name correctly in link and display', async () => {
        // Override the mock to return an exception with no file name
        const { fetchExceptionsOverviewFromServer } = require('@/app/api/api_calls')
        fetchExceptionsOverviewFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 'success',
                data: {
                    results: [
                        {
                            id: 'exception1',
                            app_id: 'app1',
                            type: 'NullPointerException',
                            message: 'Attempt to invoke virtual method on a null object reference',
                            method_name: 'onCreate',
                            file_name: '', // Empty file name
                            line_number: 42,
                            fingerprint: 'fingerprint1',
                            count: 120,
                            percentage_contribution: 35.5,
                            created_at: '2020-01-01T00:00:00Z',
                            updated_at: '2020-01-02T00:00:00Z'
                        }
                    ],
                    meta: { previous: false, next: false },
                }
            })
        )

        render(<ExceptionsOverview exceptionsType={ExceptionsType.Crash} teamId="123" />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check that the exception link is rendered with the correct href and accessible name
        const crashLink = screen.getByRole('link', { name: /unknown_file: onCreate\(\)/i })
        expect(crashLink).toBeInTheDocument()
        expect(crashLink).toHaveAttribute('href', '/123/crashes/app1/exception1/NullPointerException')

        // Find the table row that contains this link
        const crashRow = crashLink.closest('tr')
        expect(crashRow).toBeInTheDocument()

        // Simulate keyboard navigation (Enter) on the row
        await act(async () => {
            fireEvent.keyDown(crashRow!, { key: 'Enter' })
        })
        expect(pushMock).toHaveBeenCalledWith('/123/crashes/app1/exception1/NullPointerException')

        // Simulate keyboard navigation (Space) on the row
        await act(async () => {
            fireEvent.keyDown(crashRow!, { key: ' ' })
        })
        expect(pushMock).toHaveBeenCalledWith('/123/crashes/app1/exception1/NullPointerException')
    })

    describe('Pagination key ID handling', () => {
        it('initializes without keyId when none is provided', async () => {
            render(<ExceptionsOverview exceptionsType={ExceptionsType.Crash} teamId="123" />)
            const updateButton = screen.getByTestId('update-filters')
            await act(async () => {
                fireEvent.click(updateButton)
            })
            expect(replaceMock).toHaveBeenCalledWith('?pl=5&updated', { scroll: false })
        })

        it('sets keyId to last result ID when Next is clicked', async () => {
            render(<ExceptionsOverview exceptionsType={ExceptionsType.Crash} teamId="123" />)
            const updateButton = screen.getByTestId('update-filters')
            await act(async () => {
                fireEvent.click(updateButton)
            })
            const nextButton = await screen.findByTestId('next-button')
            await act(async () => {
                fireEvent.click(nextButton)
            })
            // The keyId should be set to the ID of the last item in results
            expect(replaceMock).toHaveBeenLastCalledWith('?kId=exception1&pl=5&updated', { scroll: false })
        })

        it('sets keyId to first result ID when Prev is clicked', async () => {
            // Render component
            render(<ExceptionsOverview exceptionsType={ExceptionsType.Crash} teamId="123" />)
            const updateButton = screen.getByTestId('update-filters')
            await act(async () => {
                fireEvent.click(updateButton)
            })
            const prevButton = await screen.findByTestId('prev-button')
            await act(async () => {
                fireEvent.click(prevButton)
            })
            expect(replaceMock).toHaveBeenCalledWith('?kId=exception1&pl=-5&updated', { scroll: false })
        })

        it('resets keyId when filters change if previous filters were non-default', async () => {
            // Override useSearchParams to simulate an initial keyId
            const { useSearchParams } = jest.requireActual('next/navigation')
            const useSearchParamsSpy = jest
                .spyOn(require('next/navigation'), 'useSearchParams')
                .mockReturnValue(new URLSearchParams('?kId=previousKey&pl=5'))

            render(<ExceptionsOverview exceptionsType={ExceptionsType.Crash} teamId="123" />)
            const updateButton = screen.getByTestId('update-filters')

            // First update: filters become ready with "updated" and keyId from URL is "previousKey"
            await act(async () => {
                fireEvent.click(updateButton)
            })
            expect(replaceMock).toHaveBeenCalledWith('?kId=previousKey&pl=5&updated', { scroll: false })

            // Now simulate a filter change with a different value
            const updateButton2 = screen.getByTestId('update-filters-2')
            await act(async () => {
                fireEvent.click(updateButton2)
            })
            // Should reset keyId and use default limit
            expect(replaceMock).toHaveBeenLastCalledWith('?pl=5&updated2', { scroll: false })
            useSearchParamsSpy.mockRestore()
        })
    })

    it('correctly toggles loading bar visibility based on API status', async () => {
        // Mock implementation to control loading state
        const { fetchExceptionsOverviewFromServer } = require('@/app/api/api_calls')

        // Create a promise that won't resolve immediately to maintain loading state
        let resolvePromise: (value: any) => void
        const loadingPromise = new Promise(resolve => {
            resolvePromise = resolve
        })

        fetchExceptionsOverviewFromServer.mockImplementationOnce(() => loadingPromise)

        render(<ExceptionsOverview exceptionsType={ExceptionsType.Crash} teamId="123" />)
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
                            id: 'exception1',
                            app_id: 'app1',
                            type: 'NullPointerException',
                            message: 'Attempt to invoke virtual method on a null object reference',
                            method_name: 'onCreate',
                            file_name: 'MainActivity.java',
                            line_number: 42,
                            fingerprint: 'fingerprint1',
                            count: 120,
                            percentage_contribution: 35.5,
                            created_at: '2020-01-01T00:00:00Z',
                            updated_at: '2020-01-02T00:00:00Z'
                        }
                    ],
                    meta: { previous: true, next: true },
                }
            })
        })

        // After loading, the loading bar should be invisible
        await screen.findByText('MainActivity.java: onCreate()')
        expect(loadingBarContainer).not.toHaveClass('visible')
        expect(loadingBarContainer).toHaveClass('invisible')
    })
})

describe('ExceptionsOverview Component - ANRs', () => {
    beforeEach(() => {
        replaceMock.mockClear()
    })

    it('renders the ANRs heading when exceptionsType is anr', () => {
        render(<ExceptionsOverview exceptionsType={ExceptionsType.Anr} teamId="123" />)
        expect(screen.getByText('ANRs')).toBeInTheDocument()
    })

    it('shows ANR column headers instead of Crash headers', async () => {
        render(<ExceptionsOverview exceptionsType={ExceptionsType.Anr} teamId="123" />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        expect(screen.getByText('ANR')).toBeInTheDocument()
        expect(screen.queryByText('Crash')).not.toBeInTheDocument()
    })

    it('renders appropriate link for each ANR that includes teamId, app_id anr_group_id and anr_group_name', async () => {
        render(<ExceptionsOverview exceptionsType={ExceptionsType.Anr} teamId="456" />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check that the exception link is rendered with the correct href and accessible name
        const anrLink = screen.getByRole('link', { name: /MainActivity\.kt: onPause\(\)/i })
        expect(anrLink).toBeInTheDocument()
        expect(anrLink).toHaveAttribute('href', '/456/anrs/app1/exception2/ANRException@MainActivity.kt')

        // Find the table row that contains this link
        const anrRow = anrLink.closest('tr')
        expect(anrRow).toBeInTheDocument()

        // Simulate keyboard navigation (Enter) on the row
        await act(async () => {
            fireEvent.keyDown(anrRow!, { key: 'Enter' })
        })
        expect(pushMock).toHaveBeenCalledWith('/456/anrs/app1/exception2/ANRException@MainActivity.kt')

        // Simulate keyboard navigation (Space) on the row
        await act(async () => {
            fireEvent.keyDown(anrRow!, { key: ' ' })
        })
        expect(pushMock).toHaveBeenCalledWith('/456/anrs/app1/exception2/ANRException@MainActivity.kt')
    })

    it('shows error message with ANR-specific text', async () => {
        // Override the mock to return an error
        const { fetchExceptionsOverviewFromServer } = require('@/app/api/api_calls')
        fetchExceptionsOverviewFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 'error',
            })
        )

        render(<ExceptionsOverview exceptionsType={ExceptionsType.Anr} teamId="123" />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        expect(screen.getByText(/Error fetching list of ANRs/)).toBeInTheDocument()
    })
})