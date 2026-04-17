import BugReportsOverview from '@/app/[teamId]/bug_reports/page'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'

// Global replace mock for router.replace
const replaceMock = jest.fn()
const pushMock = jest.fn()

// Mock next/navigation hooks
let mockSearchParams = new URLSearchParams()
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: replaceMock,
        push: pushMock,
    }),
    // By default, return empty search params.
    useSearchParams: () => mockSearchParams,
}))

// Mock API calls and constants
jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    emptyBugReportsOverviewResponse: {
        meta: { next: false, previous: false },
        results: [],
    },
    FilterSource: { Events: 'events' },
}))

jest.mock('@/app/stores/provider', () => {
    const { create } = jest.requireActual('zustand')
    const filtersStore = create(() => ({
        filters: { ready: false, serialisedFilters: '' },
    }))
    return { __esModule: true, useFiltersStore: filtersStore }
})

const mockUseBugReportsOverviewQuery = jest.fn(() => ({
    data: undefined as any,
    status: 'pending' as string, isFetching: true,
    error: null as Error | null,
}))

jest.mock('@/app/query/hooks', () => ({
    __esModule: true,
    useBugReportsOverviewQuery: () => mockUseBugReportsOverviewQuery(),
    paginationOffsetUrlKey: 'po',
}))

jest.mock('@/app/components/filters', () => ({
    __esModule: true,
    default: () => <div data-testid="filters-mock" />,
    AppVersionsInitialSelectionType: { All: 'all' },
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

const { useFiltersStore } = require('@/app/stores/provider') as any

const mockBugReportResult = {
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
        os_name: 'ios',
        os_version: '15.0',
        device_manufacturer: 'Apple',
        device_model: 'iPhone 12'
    },
    user_defined_attribute: null,
    attachments: null
}

const mockBugReportsData = {
    results: [mockBugReportResult],
    meta: { previous: true, next: true },
}

describe('BugReportsOverview Component', () => {
    beforeEach(() => {
        replaceMock.mockClear()
        pushMock.mockClear()
        mockSearchParams = new URLSearchParams()
        mockUseBugReportsOverviewQuery.mockReset()
        mockUseBugReportsOverviewQuery.mockReturnValue({ data: undefined, status: 'pending' as string, isFetching: true, error: null })
        useFiltersStore.setState({ filters: { ready: false, serialisedFilters: '' } })
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
        mockUseBugReportsOverviewQuery.mockReturnValue({ data: mockBugReportsData, status: 'success', isFetching: false, error: null })
        render(<BugReportsOverview params={{ teamId: '123' }} />)
        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' } } })
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
        mockUseBugReportsOverviewQuery.mockReturnValue({ data: mockBugReportsData, status: 'success', isFetching: false, error: null })
        render(<BugReportsOverview params={{ teamId: '123' }} />)
        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' } } })
        })

        // Verify the bug report data is displayed
        expect(screen.getByText('Test Bug Report')).toBeInTheDocument()
        expect(screen.getByText('Jan 1, 2020')).toBeInTheDocument()
        expect(screen.getByText('12:00 AM')).toBeInTheDocument()
        expect(screen.getByText('Open')).toBeInTheDocument()
        expect(screen.getByText('ID: bug1')).toBeInTheDocument()
        expect(screen.getByText('Matched error')).toBeInTheDocument()
        expect(screen.getByText('1.0(1), iOS 15.0, Apple iPhone 12')).toBeInTheDocument()
    })

    it('shows error message when API returns error status', async () => {
        mockUseBugReportsOverviewQuery.mockReturnValue({ data: undefined, status: 'error', isFetching: false, error: new Error('fail') })
        render(<BugReportsOverview params={{ teamId: '123' }} />)
        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' } } })
        })

        // Check that error message is displayed
        expect(screen.getByText(/Error fetching list of bug reports/)).toBeInTheDocument()
    })

    it('renders appropriate link for each bug report that includes teamId, app_id and event_id', async () => {
        mockUseBugReportsOverviewQuery.mockReturnValue({ data: mockBugReportsData, status: 'success', isFetching: false, error: null })
        render(<BugReportsOverview params={{ teamId: '123' }} />)
        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' } } })
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
        const noDescData = {
            results: [{ ...mockBugReportResult, description: null, matched_free_text: "" }],
            meta: { previous: false, next: false },
        }
        mockUseBugReportsOverviewQuery.mockReturnValue({ data: noDescData, status: 'success', isFetching: false, error: null })
        render(<BugReportsOverview params={{ teamId: '123' }} />)
        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' } } })
        })

        // Verify "No Description" text is displayed
        expect(screen.getByText('No Description')).toBeInTheDocument()
    })

    describe('Pagination offset handling', () => {
        it('initializes pagination offset to 0 when no offset is provided', async () => {
            mockUseBugReportsOverviewQuery.mockReturnValue({ data: mockBugReportsData, status: 'success', isFetching: false, error: null })
            render(<BugReportsOverview params={{ teamId: '123' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' } } })
            })
            expect(replaceMock).toHaveBeenCalledWith('?po=0&updated', { scroll: false })
        })

        it('increments pagination offset when Next is clicked', async () => {
            mockUseBugReportsOverviewQuery.mockReturnValue({ data: mockBugReportsData, status: 'success', isFetching: false, error: null })
            render(<BugReportsOverview params={{ teamId: '123' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' } } })
            })
            const nextButton = await screen.findByTestId('next-button')
            await act(async () => {
                fireEvent.click(nextButton)
            })
            // The pagination limit is 5 so offset should be 5.
            expect(replaceMock).toHaveBeenLastCalledWith('?po=5&updated', { scroll: false })
        })

        it('decrements pagination offset when Prev is clicked, but not below 0', async () => {
            mockUseBugReportsOverviewQuery.mockReturnValue({ data: mockBugReportsData, status: 'success', isFetching: false, error: null })
            render(<BugReportsOverview params={{ teamId: '123' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' } } })
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
            mockUseBugReportsOverviewQuery.mockReturnValue({ data: mockBugReportsData, status: 'success', isFetching: false, error: null })

            render(<BugReportsOverview params={{ teamId: '123' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' } } })
            })
            expect(replaceMock).toHaveBeenCalledWith('?po=0&updated', { scroll: false })

            // Click Next twice to get to offset 10.
            const nextButton = await screen.findByTestId('next-button')
            await act(async () => {
                fireEvent.click(nextButton)
            })
            expect(replaceMock).toHaveBeenLastCalledWith('?po=5&updated', { scroll: false })

            await act(async () => {
                fireEvent.click(nextButton)
            })
            expect(replaceMock).toHaveBeenLastCalledWith('?po=10&updated', { scroll: false })

            // Now simulate a filter change with a different value.
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated2', app: { id: 'app1' } } })
                await new Promise(resolve => setTimeout(resolve, 0))
            })
            expect(replaceMock).toHaveBeenLastCalledWith('?po=0&updated2', { scroll: false })
        })
    })

    it('correctly toggles loading bar visibility based on API status', async () => {
        mockUseBugReportsOverviewQuery.mockReturnValue({ data: undefined, status: 'pending' as string, isFetching: true, error: null })
        render(<BugReportsOverview params={{ teamId: '123' }} />)

        // Set loading state
        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' } } })
        })

        // Test the loading state - loading bar should be visible
        const loadingBarContainer = screen.getByTestId('loading-bar-mock').parentElement
        expect(loadingBarContainer).toHaveClass('visible')
        expect(loadingBarContainer).not.toHaveClass('invisible')

        // Set success state
        await act(async () => {
            mockUseBugReportsOverviewQuery.mockReturnValue({ data: mockBugReportsData, status: 'success', isFetching: false, error: null })
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' } } })
        })

        // After loading, the loading bar should be invisible
        await screen.findByText('Test Bug Report')
        expect(loadingBarContainer).not.toHaveClass('visible')
        expect(loadingBarContainer).toHaveClass('invisible')
    })

    it('renders "Open" and "Closed" status correctly based on status value', async () => {
        // First render with status 0 (Open)
        mockUseBugReportsOverviewQuery.mockReturnValue({ data: mockBugReportsData, status: 'success', isFetching: false, error: null })
        const { unmount } = render(<BugReportsOverview params={{ teamId: '123' }} />)
        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' } } })
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
        useFiltersStore.setState({ filters: { ready: false, serialisedFilters: '' } })

        // Re-render with status 1 (Closed)
        const closedData = {
            results: [{ ...mockBugReportResult, status: 1, matched_free_text: "" }],
            meta: { previous: true, next: true },
        }
        mockUseBugReportsOverviewQuery.mockReturnValue({ data: closedData, status: 'success', isFetching: false, error: null })
        render(<BugReportsOverview params={{ teamId: '123' }} />)
        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app1' } } })
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
