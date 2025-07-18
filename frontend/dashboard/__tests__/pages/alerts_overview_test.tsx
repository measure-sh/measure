import AlertsOverview from '@/app/[teamId]/alerts/page'
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

// Mock API calls and constants for bug reports overview with valid data.
jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    emptyAlertsOverviewResponse: {
        meta: { next: false, previous: false },
        results: [],
    },
    AlertsOverviewApiStatus: {
        Loading: 'loading',
        Error: 'error',
        Success: 'success'
    },
    fetchAlertsOverviewFromServer: jest.fn(() =>
        Promise.resolve({
            status: 'success',
            data: {
                results: [
                    {

                        id: 'alert1',
                        team_id: 'team1',
                        app_id: 'app1',
                        entity_id: 'crash1',
                        type: 'crash_spike',
                        message: 'message1',
                        url: 'http://example.com/alert1',
                        created_at: "2020-01-01T00:00:00Z",
                        updated_at: "2020-01-01T00:00:00Z",

                    }
                ],
                // Enable both previous and next for pagination tests.
                meta: { previous: true, next: true },
            }
        })
    ),
    FilterSource: { Events: 'events' },
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
    formatDateToHumanReadableTime: jest.fn(() => '12:00 AM')
}))

describe('AlertsOverview Component', () => {
    beforeEach(() => {
        replaceMock.mockClear()
        pushMock.mockClear()
    })

    it('renders the Alerts heading and Filters component', () => {
        render(<AlertsOverview params={{ teamId: '123' }} />)
        expect(screen.getByText('Alerts')).toBeInTheDocument()
        expect(screen.getByTestId('filters-mock')).toBeInTheDocument()
    })

    it('does not render main alerts UI when filters are not ready', () => {
        render(<AlertsOverview params={{ teamId: '123' }} />)
        expect(screen.queryByTestId('paginator-mock')).not.toBeInTheDocument()
        expect(screen.queryByTestId('loading-bar-mock')).not.toBeInTheDocument()
        expect(screen.queryByText('Alert Id')).not.toBeInTheDocument()
    })

    it('renders main bug reports UI, updates URL when filters become ready, and renders table headers', async () => {
        render(<AlertsOverview params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check URL update.
        expect(replaceMock).toHaveBeenCalledWith('?po=0&updated', { scroll: false })

        // Verify main UI components are rendered.
        expect(await screen.findByTestId('paginator-mock')).toBeInTheDocument()
        // Check that the table header cells are rendered.
        expect(screen.getByText('Alert')).toBeInTheDocument()
        expect(screen.getByText('Time')).toBeInTheDocument()
    })

    it('displays alert data correctly when API returns results', async () => {
        render(<AlertsOverview params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Verify the alert data is displayed
        expect(screen.getByText('message1')).toBeInTheDocument()
        expect(screen.getByText('Jan 1, 2020')).toBeInTheDocument()
        expect(screen.getByText('12:00 AM')).toBeInTheDocument()
        expect(screen.getByText('ID: alert1')).toBeInTheDocument()
    })

    it('does not update filters if they remain unchanged', async () => {
        render(<AlertsOverview params={{ teamId: '123' }} />)
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
        const { fetchAlertsOverviewFromServer } = require('@/app/api/api_calls')
        fetchAlertsOverviewFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 'error',
            })
        )

        render(<AlertsOverview params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check that error message is displayed
        expect(screen.getByText(/Error fetching list of alerts/)).toBeInTheDocument()
    })

    it('renders appropriate link for each alert ', async () => {
        render(<AlertsOverview params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check that the alert link is rendered with the correct href and accessible name
        const link = screen.getByRole('link', { name: /ID: alert1/i })
        expect(link).toBeInTheDocument()
        expect(link).toHaveAttribute('href', 'http://example.com/alert1')

        // Find the table row that contains this link
        const row = link.closest('tr')
        expect(row).toBeInTheDocument()

        // Simulate keyboard navigation (Enter) on the row
        await act(async () => {
            fireEvent.keyDown(row!, { key: 'Enter' })
        })
        expect(pushMock).toHaveBeenCalledWith('http://example.com/alert1')

        // Simulate keyboard navigation (Space) on the row
        await act(async () => {
            fireEvent.keyDown(row!, { key: ' ' })
        })
        expect(pushMock).toHaveBeenCalledWith('http://example.com/alert1')
    })

    describe('Pagination offset handling', () => {
        it('initializes pagination offset to 0 when no offset is provided', async () => {
            render(<AlertsOverview params={{ teamId: '123' }} />)
            const updateButton = screen.getByTestId('update-filters')
            await act(async () => {
                fireEvent.click(updateButton)
            })
            expect(replaceMock).toHaveBeenCalledWith('?po=0&updated', { scroll: false })
        })

        it('increments pagination offset when Next is clicked', async () => {
            render(<AlertsOverview params={{ teamId: '123' }} />)
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
            render(<AlertsOverview params={{ teamId: '123' }} />)
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

            render(<AlertsOverview params={{ teamId: '123' }} />)
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
        const { fetchAlertsOverviewFromServer } = require('@/app/api/api_calls')

        // Create a promise that won't resolve immediately to maintain loading state
        let resolvePromise: (value: any) => void
        const loadingPromise = new Promise(resolve => {
            resolvePromise = resolve
        })

        fetchAlertsOverviewFromServer.mockImplementationOnce(() => loadingPromise)

        render(<AlertsOverview params={{ teamId: '123' }} />)
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

                            id: 'alert1',
                            team_id: 'team1',
                            app_id: 'app1',
                            entity_id: 'crash1',
                            type: 'crash_spike',
                            message: 'message1',
                            url: 'http://example.com/alert1',
                            created_at: "2020-01-01T00:00:00Z",
                            updated_at: "2020-01-01T00:00:00Z",

                        }
                    ],
                    meta: { previous: true, next: true },
                }
            })
        })

        // After loading, the loading bar should be invisible
        await screen.findByText('ID: alert1')
        expect(loadingBarContainer).not.toHaveClass('visible')
        expect(loadingBarContainer).toHaveClass('invisible')
    })
})