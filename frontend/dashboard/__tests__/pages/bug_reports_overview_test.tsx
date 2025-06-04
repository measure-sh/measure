import BugReportsOverview from '@/app/[teamId]/bug_reports/page'
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
    emptyBugReportsOverviewResponse: {
        meta: { next: false, previous: false },
        results: [],
    },
    BugReportsOverviewApiStatus: {
        Loading: 'loading',
        Error: 'error',
        Success: 'success'
    },
    fetchBugReportsOverviewFromServer: jest.fn(() =>
        Promise.resolve({
            status: 'success',
            data: {
                results: [
                    {
                        session_id: 'session1',
                        app_id: 'app1',
                        event_id: 'bug1',
                        description: 'Test Bug Report',
                        status: 0,
                        timestamp: "2020-01-01T00:00:00Z",
                        matched_free_text: "error",
                        attribute: {
                            installation_id: 'install1',
                            app_version: '1.0',
                            app_build: '1',
                            app_unique_id: 'app_unique_1',
                            measure_sdk_version: '1.0.0',
                            platform: 'ios',
                            thread_name: 'main',
                            user_id: 'user1',
                            device_name: 'iPhone',
                            device_model: 'iPhone 12',
                            device_manufacturer: 'Apple',
                            device_type: 'phone',
                            device_is_foldable: false,
                            device_is_physical: true,
                            device_density_dpi: 460,
                            device_width_px: 375,
                            device_height_px: 812,
                            device_density: 3,
                            device_locale: 'en_US',
                            device_low_power_mode: false,
                            device_thermal_throttling_enabled: false,
                            device_cpu_arch: 'arm64',
                            os_name: 'iOS',
                            os_version: '15.0',
                            os_page_size: 4096,
                            network_type: 'wifi',
                            network_provider: 'AT&T',
                            network_generation: '5G'
                        },
                        user_defined_attribute: null,
                        attachments: null
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

// Mock BugReportsOverviewPlot component.
jest.mock('@/app/components/bug_reports_overview_plot', () => () => (
    <div data-testid="bug-reports-overview-plot-mock">BugReportsOverviewPlot Rendered</div>
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
    formatDateToHumanReadableTime: jest.fn(() => '12:00 AM')
}))

describe('BugReportsOverview Component', () => {
    beforeEach(() => {
        replaceMock.mockClear()
        pushMock.mockClear()
    })

    it('renders the Bug Reports heading and Filters component', () => {
        render(<BugReportsOverview params={{ teamId: '123' }} />)
        expect(screen.getByText('Bug Reports')).toBeInTheDocument()
        expect(screen.getByTestId('filters-mock')).toBeInTheDocument()
    })

    it('does not render main bug reports UI when filters are not ready', () => {
        render(<BugReportsOverview params={{ teamId: '123' }} />)
        expect(screen.queryByTestId('bug-reports-overview-plot-mock')).not.toBeInTheDocument()
        expect(screen.queryByTestId('paginator-mock')).not.toBeInTheDocument()
        expect(screen.queryByTestId('loading-bar-mock')).not.toBeInTheDocument()
        expect(screen.queryByText('Bug Report Id')).not.toBeInTheDocument()
    })

    it('renders main bug reports UI, updates URL when filters become ready, and renders table headers', async () => {
        render(<BugReportsOverview params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check URL update.
        expect(replaceMock).toHaveBeenCalledWith('?po=0&updated', { scroll: false })

        // Verify main UI components are rendered.
        expect(await screen.findByTestId('bug-reports-overview-plot-mock')).toBeInTheDocument()
        expect(await screen.findByTestId('paginator-mock')).toBeInTheDocument()
        // Check that the table header cells are rendered.
        expect(screen.getByText('Bug Report')).toBeInTheDocument()
        expect(screen.getByText('Time')).toBeInTheDocument()
        expect(screen.getByText('Status')).toBeInTheDocument()
    })

    it('displays bug report data correctly when API returns results', async () => {
        render(<BugReportsOverview params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Verify the bug report data is displayed
        expect(screen.getByText('Test Bug Report')).toBeInTheDocument()
        expect(screen.getByText('Jan 1, 2020')).toBeInTheDocument()
        expect(screen.getByText('12:00 AM')).toBeInTheDocument()
        expect(screen.getByText('Open')).toBeInTheDocument()
        expect(screen.getByText('ID: bug1')).toBeInTheDocument()
        expect(screen.getByText('Matched error')).toBeInTheDocument()
        expect(screen.getByText('v1.0(1), iOS 15.0, Apple iPhone 12')).toBeInTheDocument()
    })

    it('does not update filters if they remain unchanged', async () => {
        render(<BugReportsOverview params={{ teamId: '123' }} />)
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
        const { fetchBugReportsOverviewFromServer } = require('@/app/api/api_calls')
        fetchBugReportsOverviewFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 'error',
            })
        )

        render(<BugReportsOverview params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check that error message is displayed
        expect(screen.getByText(/Error fetching list of bug reports/)).toBeInTheDocument()
    })

    it('renders appropriate link for each bug report that includes teamId, app_id and event_id', async () => {
        render(<BugReportsOverview params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Check that the bug report link is rendered with the correct href and accessible name
        const link = screen.getByRole('link', { name: /ID: bug1/i })
        expect(link).toBeInTheDocument()
        expect(link).toHaveAttribute('href', '/123/bug_reports/app1/bug1')

        // Find the table row that contains this link
        const row = link.closest('tr')
        expect(row).toBeInTheDocument()

        // Simulate keyboard navigation (Enter) on the row
        await act(async () => {
            fireEvent.keyDown(row!, { key: 'Enter' })
        })
        expect(pushMock).toHaveBeenCalledWith('/123/bug_reports/app1/bug1')

        // Simulate keyboard navigation (Space) on the row
        await act(async () => {
            fireEvent.keyDown(row!, { key: ' ' })
        })
        expect(pushMock).toHaveBeenCalledWith('/123/bug_reports/app1/bug1')
    })

    it('handles bug reports with no description properly', async () => {
        // Override the mock to return a bug report with no description
        const { fetchBugReportsOverviewFromServer } = require('@/app/api/api_calls')
        fetchBugReportsOverviewFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 'success',
                data: {
                    results: [
                        {
                            session_id: 'session1',
                            app_id: 'app1',
                            event_id: 'bug1',
                            description: null, // No description
                            status: 0,
                            timestamp: "2020-01-01T00:00:00Z",
                            matched_free_text: "",
                            attribute: {
                                app_version: '1.0',
                                app_build: '1',
                                os_name: 'iOS',
                                os_version: '15.0',
                                device_manufacturer: 'Apple',
                                device_model: 'iPhone 12'
                            },
                            user_defined_attribute: null,
                            attachments: null
                        }
                    ],
                    meta: { previous: false, next: false },
                }
            })
        )

        render(<BugReportsOverview params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Verify "No Description" text is displayed
        expect(screen.getByText('No Description')).toBeInTheDocument()
    })

    describe('Pagination offset handling', () => {
        it('initializes pagination offset to 0 when no offset is provided', async () => {
            render(<BugReportsOverview params={{ teamId: '123' }} />)
            const updateButton = screen.getByTestId('update-filters')
            await act(async () => {
                fireEvent.click(updateButton)
            })
            expect(replaceMock).toHaveBeenCalledWith('?po=0&updated', { scroll: false })
        })

        it('increments pagination offset when Next is clicked', async () => {
            render(<BugReportsOverview params={{ teamId: '123' }} />)
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
            render(<BugReportsOverview params={{ teamId: '123' }} />)
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

            render(<BugReportsOverview params={{ teamId: '123' }} />)
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
        const { fetchBugReportsOverviewFromServer } = require('@/app/api/api_calls')

        // Create a promise that won't resolve immediately to maintain loading state
        let resolvePromise: (value: any) => void
        const loadingPromise = new Promise(resolve => {
            resolvePromise = resolve
        })

        fetchBugReportsOverviewFromServer.mockImplementationOnce(() => loadingPromise)

        render(<BugReportsOverview params={{ teamId: '123' }} />)
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
                            event_id: 'bug1',
                            description: 'Test Bug Report',
                            status: 0,
                            timestamp: "2020-01-01T00:00:00Z",
                            matched_free_text: "error",
                            attribute: {
                                app_version: '1.0',
                                app_build: '1',
                                os_name: 'iOS',
                                os_version: '15.0',
                                device_manufacturer: 'Apple',
                                device_model: 'iPhone 12'
                            },
                            user_defined_attribute: null,
                            attachments: null
                        }
                    ],
                    meta: { previous: true, next: true },
                }
            })
        })

        // After loading, the loading bar should be invisible
        await screen.findByText('Test Bug Report')
        expect(loadingBarContainer).not.toHaveClass('visible')
        expect(loadingBarContainer).toHaveClass('invisible')
    })

    it('renders "Open" and "Closed" status correctly based on status value', async () => {
        // First render with status 0 (Open)
        const { unmount } = render(<BugReportsOverview params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Find the Open status element
        const openStatusText = screen.getByText('Open')
        const statusPill = openStatusText.closest('p')

        // Check for correct styling on the status pill
        expect(statusPill).toHaveClass('border-green-600')
        expect(statusPill).toHaveClass('text-green-600')
        expect(statusPill).toHaveClass('bg-green-50')

        // Clean up the first render
        unmount()

        // Re-render with status 1 (Closed)
        const { fetchBugReportsOverviewFromServer } = require('@/app/api/api_calls')
        fetchBugReportsOverviewFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 'success',
                data: {
                    results: [
                        {
                            session_id: 'session1',
                            app_id: 'app1',
                            event_id: 'bug1',
                            description: 'Test Bug Report',
                            status: 1, // Closed status
                            timestamp: "2020-01-01T00:00:00Z",
                            matched_free_text: "",
                            attribute: {
                                app_version: '1.0',
                                app_build: '1',
                                os_name: 'iOS',
                                os_version: '15.0',
                                device_manufacturer: 'Apple',
                                device_model: 'iPhone 12'
                            },
                            user_defined_attribute: null,
                            attachments: null
                        }
                    ],
                    meta: { previous: true, next: true },
                }
            })
        )

        render(<BugReportsOverview params={{ teamId: '123' }} />)
        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        // Find the Closed status element
        const closedStatusText = screen.getByText('Closed')
        const closedStatusPill = closedStatusText.closest('p')

        // Check for correct styling on the closed status pill
        expect(closedStatusPill).toHaveClass('border-indigo-600')
        expect(closedStatusPill).toHaveClass('text-indigo-600')
        expect(closedStatusPill).toHaveClass('bg-indigo-50')
    })
})