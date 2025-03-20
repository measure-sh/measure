import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, beforeEach, expect } from '@jest/globals'
import '@testing-library/jest-dom'
import SessionsOverview from '@/app/[teamId]/sessions/page'

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

// Mock API calls and constants for sessions overview with valid data.
jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    emptySessionsOverviewResponse: {
        meta: { next: false, previous: false },
        results: [],
    },
    SessionsOverviewApiStatus: {
        Loading: 'loading',
        Error: 'error',
        Success: 'success'
    },
    fetchSessionsOverviewFromServer: jest.fn(() =>
        Promise.resolve({
            status: 'success',
            data: {
                results: [
                    {
                        session_id: 'session1',
                        app_id: 'app1',
                        first_event_time: "2020-01-01T00:00:00Z",
                        last_event_time: "2020-01-01T00:05:00Z",
                        duration: "1000",
                        matched_free_text: 'dummyMatch',
                        attribute: {
                            app_version: '1.0',
                            app_build: '1',
                            user_id: 'user1',
                            device_name: 'iPhone',
                            device_model: 'iPhone 12',
                            device_manufacturer: 'Apple',
                            os_name: 'iOS',
                            os_version: '15',
                        }
                    }
                ],
                // For pagination tests, enable both previous and next.
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

// Mock SessionsOverviewPlot component.
jest.mock('@/app/components/sessions_overview_plot', () => () => (
    <div data-testid="sessions-overview-plot-mock">SessionsOverviewPlot Rendered</div>
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
    formatMillisToHumanReadable: jest.fn(() => '1s')
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

describe('SessionsOverview Component', () => {
    beforeEach(() => {
        replaceMock.mockClear()
    })

    it('renders the Sessions heading and Filters component', () => {
        render(<SessionsOverview params={{ teamId: '123' }} />)
        expect(screen.getByText('Sessions')).toBeInTheDocument()
        expect(screen.getByTestId('filters-mock')).toBeInTheDocument()
    })

    it('does not render main sessions UI when filters are not ready', () => {
        render(<SessionsOverview params={{ teamId: '123' }} />)
        expect(screen.queryByTestId('sessions-overview-plot-mock')).not.toBeInTheDocument()
        expect(screen.queryByTestId('paginator-mock')).not.toBeInTheDocument()
        expect(screen.queryByTestId('loading-bar-mock')).not.toBeInTheDocument()
        expect(screen.queryByText('Session Id')).not.toBeInTheDocument()
    })

    it('renders main sessions UI, updates URL when filters become ready, and renders table headers', async () => {
        render(<SessionsOverview params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check URL update.
        expect(replaceMock).toHaveBeenCalledWith('?po=0&updated', { scroll: false })

        // Verify main UI components are rendered.
        expect(await screen.findByTestId('sessions-overview-plot-mock')).toBeInTheDocument()
        expect(await screen.findByTestId('paginator-mock')).toBeInTheDocument()
        // Check that the table header cells are rendered.
        expect(screen.getByText('Session Id')).toBeInTheDocument()
        expect(screen.getByText('Start Time')).toBeInTheDocument()
        expect(screen.getByText('Duration')).toBeInTheDocument()
    })

    it('displays session data correctly when API returns results', async () => {
        render(<SessionsOverview params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Verify the session data is displayed
        expect(screen.getByText('session1')).toBeInTheDocument()
        expect(screen.getByText('Jan 1, 2020')).toBeInTheDocument()
        expect(screen.getByText('12:00 AM')).toBeInTheDocument()
        expect(screen.getByText('1s')).toBeInTheDocument()
        expect(screen.getByText('Matched dummyMatch')).toBeInTheDocument()
        expect(screen.getByText('v1.0(1), iOS 15, Apple iPhone 12')).toBeInTheDocument()
    })

    it('does not update filters if they remain unchanged', async () => {
        render(<SessionsOverview params={{ teamId: '123' }} />)
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
        const { fetchSessionsOverviewFromServer } = require('@/app/api/api_calls')
        fetchSessionsOverviewFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 'error',
            })
        )

        render(<SessionsOverview params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check that error message is displayed
        expect(screen.getByText(/Error fetching list of sessions/)).toBeInTheDocument()
    })

    it('renders appropriate link for each session that includes teamId, app_id and session_id', async () => {
        render(<SessionsOverview params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check that the link includes the correct path
        const link = screen.getByTestId('mock-link')
        expect(link).toHaveAttribute('href', '/123/sessions/app1/session1')
    })

    describe('Pagination offset handling', () => {
        it('initializes pagination offset to 0 when no offset is provided', async () => {
            render(<SessionsOverview params={{ teamId: '123' }} />)
            const updateButton = screen.getByTestId('update-filters')
            await act(async () => {
                fireEvent.click(updateButton)
            })
            expect(replaceMock).toHaveBeenCalledWith('?po=0&updated', { scroll: false })
        })

        it('increments pagination offset when Next is clicked', async () => {
            render(<SessionsOverview params={{ teamId: '123' }} />)
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
            render(<SessionsOverview params={{ teamId: '123' }} />)
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

            render(<SessionsOverview params={{ teamId: '123' }} />)
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
        const { fetchSessionsOverviewFromServer } = require('@/app/api/api_calls')

        // Create a promise that won't resolve immediately to maintain loading state
        let resolvePromise: (value: any) => void
        const loadingPromise = new Promise(resolve => {
            resolvePromise = resolve
        })

        fetchSessionsOverviewFromServer.mockImplementationOnce(() => loadingPromise)

        render(<SessionsOverview params={{ teamId: '123' }} />)
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
                            session_id: 'session1',
                            app_id: 'app1',
                            first_event_time: "2020-01-01T00:00:00Z",
                            last_event_time: "2020-01-01T00:05:00Z",
                            duration: "1000",
                            matched_free_text: 'dummyMatch',
                            attribute: {
                                app_version: '1.0',
                                app_build: '1',
                                user_id: 'user1',
                                device_name: 'iPhone',
                                device_model: 'iPhone 12',
                                device_manufacturer: 'Apple',
                                os_name: 'iOS',
                                os_version: '15',
                            }
                        }
                    ],
                    // For pagination tests, enable both previous and next.
                    meta: { previous: true, next: true },
                }
            })
        })

        // After loading, the loading bar should be invisible
        await screen.findByText('session1')
        expect(loadingBarContainer).not.toHaveClass('visible')
        expect(loadingBarContainer).toHaveClass('invisible')
    })
})