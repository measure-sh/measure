import SessionTimelinesOverview from '@/app/[teamId]/session_timelines/page'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'

// Global replace and push mocks for router
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
    emptySessionTimelinesOverviewResponse: {
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

const mockUseSessionTimelinesOverviewQuery = jest.fn(() => ({
    data: undefined as any,
    status: 'pending' as string, isFetching: true,
    error: null as Error | null,
}))

jest.mock('@/app/query/hooks', () => ({
    __esModule: true,
    useSessionTimelinesOverviewQuery: () => mockUseSessionTimelinesOverviewQuery(),
    paginationOffsetUrlKey: 'po',
}))

jest.mock('@/app/components/filters', () => ({
    __esModule: true,
    default: () => <div data-testid="filters-mock" />,
    AppVersionsInitialSelectionType: { All: 'all' },
}))

// Mock SessionTimelinesOverviewPlot component.
jest.mock('@/app/components/session_timelines_overview_plot', () => () => (
    <div data-testid="session-timelines-overview-plot-mock">SessionTimelinesOverviewPlot Rendered</div>
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

jest.mock('@/app/utils/shared_styles', () => ({
    underlineLinkStyle: 'underline-link',
}))

const { useFiltersStore } = require('@/app/stores/provider') as any

const mockSessionTimelineData = {
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
                os_name: 'ios',
                os_version: '15',
            }
        }
    ],
    meta: { previous: true, next: true },
}

describe('SessionTimelinesOverview Component', () => {
    beforeEach(() => {
        replaceMock.mockClear()
        pushMock.mockClear()
        mockSearchParams = new URLSearchParams()
        mockUseSessionTimelinesOverviewQuery.mockReset()
        mockUseSessionTimelinesOverviewQuery.mockReturnValue({ data: undefined, status: 'pending' as string, isFetching: true, error: null })
        useFiltersStore.setState({ filters: { ready: false, serialisedFilters: '' } })
    })

    it('renders the Filters component', () => {
        render(<SessionTimelinesOverview params={{ teamId: '123' }} />)
        expect(screen.getByTestId('filters-mock')).toBeInTheDocument()
    })

    it('does not render main sessions UI when filters are not ready', () => {
        render(<SessionTimelinesOverview params={{ teamId: '123' }} />)
        expect(screen.queryByTestId('session-timelines-overview-plot-mock')).not.toBeInTheDocument()
        expect(screen.queryByTestId('paginator-mock')).not.toBeInTheDocument()
        expect(screen.queryByTestId('loading-bar-mock')).not.toBeInTheDocument()
        expect(screen.queryByText('Session')).not.toBeInTheDocument()
    })

    it('renders main sessions UI, updates URL when filters become ready, and renders table headers', async () => {
        mockUseSessionTimelinesOverviewQuery.mockReturnValue({ data: mockSessionTimelineData, status: 'success', isFetching: false, error: null })
        render(<SessionTimelinesOverview params={{ teamId: '123' }} />)
        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
        })

        // Check URL update.
        expect(replaceMock).toHaveBeenCalledWith('?po=0&updated', { scroll: false })

        // Verify main UI components are rendered.
        expect(await screen.findByTestId('session-timelines-overview-plot-mock')).toBeInTheDocument()
        expect(await screen.findByTestId('paginator-mock')).toBeInTheDocument()

        // Check that the table header cells are rendered.
        expect(screen.getByText('Session Timeline')).toBeInTheDocument()
        expect(screen.getByText('Start Time')).toBeInTheDocument()
        expect(screen.getByText('Duration')).toBeInTheDocument()
    })

    it('displays session data correctly when API returns results', async () => {
        mockUseSessionTimelinesOverviewQuery.mockReturnValue({ data: mockSessionTimelineData, status: 'success', isFetching: false, error: null })
        render(<SessionTimelinesOverview params={{ teamId: '123' }} />)
        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
        })

        // Verify the session data is displayed
        expect(screen.getByText('Session ID: session1')).toBeInTheDocument()
        expect(screen.getByText('Jan 1, 2020')).toBeInTheDocument()
        expect(screen.getByText('12:00 AM')).toBeInTheDocument()
        expect(screen.getByText('1s')).toBeInTheDocument()
        expect(screen.getByText('Matched dummyMatch')).toBeInTheDocument()
        expect(screen.getByText('1.0(1), iOS 15, Apple iPhone 12')).toBeInTheDocument()
    })

    it('shows error message when API returns error status', async () => {
        mockUseSessionTimelinesOverviewQuery.mockReturnValue({ data: undefined, status: 'error', isFetching: false, error: new Error('fail') })
        render(<SessionTimelinesOverview params={{ teamId: '123' }} />)
        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
        })

        // Check that error message is displayed
        expect(screen.getByText(/Error fetching list of sessions/)).toBeInTheDocument()
    })

    it('renders appropriate link for each session that includes teamId, app_id and session_id', async () => {
        mockUseSessionTimelinesOverviewQuery.mockReturnValue({ data: mockSessionTimelineData, status: 'success', isFetching: false, error: null })
        render(<SessionTimelinesOverview params={{ teamId: '123' }} />)
        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
        })

        // Check that the session link is rendered with the correct href and accessible name
        const link = screen.getByRole('link', { name: /Session ID: session1/i })
        expect(link).toBeInTheDocument()
        expect(link).toHaveAttribute('href', '/123/session_timelines/app1/session1')

        // Find the table row that contains this link
        const row = link.closest('tr')
        expect(row).toBeInTheDocument()

        // Simulate keyboard navigation (Enter) on the row
        await act(async () => {
            fireEvent.keyDown(row!, { key: 'Enter' })
        })
        expect(pushMock).toHaveBeenCalledWith('/123/session_timelines/app1/session1')

        // Simulate keyboard navigation (Space) on the row
        await act(async () => {
            fireEvent.keyDown(row!, { key: ' ' })
        })
        expect(pushMock).toHaveBeenCalledWith('/123/session_timelines/app1/session1')
    })

    describe('Pagination offset handling', () => {
        it('initializes pagination offset to 0 when no offset is provided', async () => {
            mockUseSessionTimelinesOverviewQuery.mockReturnValue({ data: mockSessionTimelineData, status: 'success', isFetching: false, error: null })
            render(<SessionTimelinesOverview params={{ teamId: '123' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
            })
            expect(replaceMock).toHaveBeenCalledWith('?po=0&updated', { scroll: false })
        })

        it('increments pagination offset when Next is clicked', async () => {
            mockUseSessionTimelinesOverviewQuery.mockReturnValue({ data: mockSessionTimelineData, status: 'success', isFetching: false, error: null })
            render(<SessionTimelinesOverview params={{ teamId: '123' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
            })
            const nextButton = await screen.findByTestId('next-button')
            await act(async () => {
                fireEvent.click(nextButton)
            })
            // The pagination limit is 5 so offset should be 5.
            expect(replaceMock).toHaveBeenLastCalledWith('?po=5&updated', { scroll: false })
        })

        it('decrements pagination offset when Prev is clicked, but not below 0', async () => {
            mockUseSessionTimelinesOverviewQuery.mockReturnValue({ data: mockSessionTimelineData, status: 'success', isFetching: false, error: null })
            render(<SessionTimelinesOverview params={{ teamId: '123' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
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
            mockUseSessionTimelinesOverviewQuery.mockReturnValue({ data: mockSessionTimelineData, status: 'success', isFetching: false, error: null })

            render(<SessionTimelinesOverview params={{ teamId: '123' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
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
                useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated2', app: { id: 'app-1' } } })
                await new Promise(resolve => setTimeout(resolve, 0))
            })
            expect(replaceMock).toHaveBeenLastCalledWith('?po=0&updated2', { scroll: false })
        })
    })

    it('correctly toggles loading bar visibility based on API status', async () => {
        mockUseSessionTimelinesOverviewQuery.mockReturnValue({ data: undefined, status: 'pending' as string, isFetching: true, error: null })
        render(<SessionTimelinesOverview params={{ teamId: '123' }} />)

        // Set loading state
        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
        })

        // Test the loading state - loading bar should be visible
        const loadingBarContainer = screen.getByTestId('loading-bar-mock').parentElement
        expect(loadingBarContainer).toHaveClass('visible')
        expect(loadingBarContainer).not.toHaveClass('invisible')

        // Set success state
        await act(async () => {
            mockUseSessionTimelinesOverviewQuery.mockReturnValue({ data: mockSessionTimelineData, status: 'success', isFetching: false, error: null })
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
        })

        // After loading, the loading bar should be invisible
        expect(loadingBarContainer).not.toHaveClass('visible')
        expect(loadingBarContainer).toHaveClass('invisible')
    })
})
