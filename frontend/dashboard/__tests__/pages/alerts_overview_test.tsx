import AlertsOverview from '@/app/[teamId]/alerts/page'
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
    emptyAlertsOverviewResponse: {
        meta: { next: false, previous: false },
        results: [],
    },
    FilterSource: { Events: 'events' },
}))

jest.mock('@/app/stores/provider', () => {
    const { create } = jest.requireActual('zustand')
    const filtersStore = create(() => ({
        currentTeamId: '123',
        filters: { ready: false, serialisedFilters: '' },
    }))
    return { __esModule: true, useFiltersStore: filtersStore }
})

const mockUseAlertsOverviewQuery = jest.fn(() => ({
    data: undefined as any,
    status: 'pending' as string, isFetching: true,
    error: null as Error | null,
}))

jest.mock('@/app/query/hooks', () => ({
    __esModule: true,
    useAlertsOverviewQuery: () => mockUseAlertsOverviewQuery(),
    paginationOffsetUrlKey: 'po',
}))

jest.mock('@/app/components/filters', () => ({
    __esModule: true,
    default: () => <div data-testid="filters-mock" />,
    AppVersionsInitialSelectionType: { All: 'all' },
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

const { useFiltersStore } = require('@/app/stores/provider') as any

const mockAlertData = {
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

describe('AlertsOverview Component', () => {
    beforeEach(() => {
        replaceMock.mockClear()
        pushMock.mockClear()
        mockSearchParams = new URLSearchParams()
        mockUseAlertsOverviewQuery.mockReset()
        mockUseAlertsOverviewQuery.mockReturnValue({ data: undefined, status: 'pending' as string, isFetching: true, error: null })
        useFiltersStore.setState({ filters: { ready: false, serialisedFilters: '' } })
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
        mockUseAlertsOverviewQuery.mockReturnValue({ data: mockAlertData, status: 'success', isFetching: false, error: null })
        render(<AlertsOverview params={{ teamId: '123' }} />)
        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
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
        mockUseAlertsOverviewQuery.mockReturnValue({ data: mockAlertData, status: 'success', isFetching: false, error: null })
        render(<AlertsOverview params={{ teamId: '123' }} />)
        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
        })

        // Verify the alert data is displayed
        expect(screen.getByText('message1')).toBeInTheDocument()
        expect(screen.getByText('Jan 1, 2020')).toBeInTheDocument()
        expect(screen.getByText('12:00 AM')).toBeInTheDocument()
        expect(screen.getByText('ID: alert1')).toBeInTheDocument()
    })

    it('shows error message when API returns error status', async () => {
        mockUseAlertsOverviewQuery.mockReturnValue({ data: undefined, status: 'error', isFetching: false, error: new Error('fail') })
        render(<AlertsOverview params={{ teamId: '123' }} />)
        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
        })

        // Check that error message is displayed
        expect(screen.getByText(/Error fetching list of alerts/)).toBeInTheDocument()
    })

    it('renders appropriate link for each alert ', async () => {
        mockUseAlertsOverviewQuery.mockReturnValue({ data: mockAlertData, status: 'success', isFetching: false, error: null })
        render(<AlertsOverview params={{ teamId: '123' }} />)
        await act(async () => {
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
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
            mockUseAlertsOverviewQuery.mockReturnValue({ data: mockAlertData, status: 'success', isFetching: false, error: null })
            render(<AlertsOverview params={{ teamId: '123' }} />)
            await act(async () => {
                useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
            })
            expect(replaceMock).toHaveBeenCalledWith('?po=0&updated', { scroll: false })
        })

        it('increments pagination offset when Next is clicked', async () => {
            mockUseAlertsOverviewQuery.mockReturnValue({ data: mockAlertData, status: 'success', isFetching: false, error: null })
            render(<AlertsOverview params={{ teamId: '123' }} />)
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
            mockUseAlertsOverviewQuery.mockReturnValue({ data: mockAlertData, status: 'success', isFetching: false, error: null })
            render(<AlertsOverview params={{ teamId: '123' }} />)
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
            mockUseAlertsOverviewQuery.mockReturnValue({ data: mockAlertData, status: 'success', isFetching: false, error: null })

            render(<AlertsOverview params={{ teamId: '123' }} />)
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
        // Start with pending status
        mockUseAlertsOverviewQuery.mockReturnValue({ data: undefined, status: 'pending' as string, isFetching: true, error: null })
        render(<AlertsOverview params={{ teamId: '123' }} />)

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
            mockUseAlertsOverviewQuery.mockReturnValue({ data: mockAlertData, status: 'success', isFetching: false, error: null })
            useFiltersStore.setState({ filters: { ready: true, serialisedFilters: 'updated', app: { id: 'app-1' } } })
        })

        // After loading, the loading bar should be invisible
        expect(loadingBarContainer).not.toHaveClass('visible')
        expect(loadingBarContainer).toHaveClass('invisible')
    })
})
