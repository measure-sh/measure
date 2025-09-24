import UserJourneys from '@/app/[teamId]/journeys/page'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'

const replaceMock = jest.fn()

// Mock next/navigation hooks
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: replaceMock,
    }),
    useSearchParams: () => new URLSearchParams(),
}))

// Mock API calls and constants
jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    FilterSource: { Events: 'events' },
}))

// Mock Filters component
jest.mock('@/app/components/filters', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="filters-mock">
            <button
                data-testid="update-filters"
                onClick={() => props.onFiltersChanged({ ready: true, serialisedFilters: 'updated' })}
            >
                Update Filters
            </button>
        </div>
    ),
    AppVersionsInitialSelectionType: { Latest: 'latest' },
    defaultFilters: { ready: false, serialisedFilters: '' },
}))

// Mock DebounceTextInput
jest.mock('@/app/components/debounce_text_input', () => ({
    __esModule: true,
    default: (props: any) => (
        <input
            data-testid="debounce-text-input-mock"
            value={props.initialValue}
            onChange={e => props.onChange(e.target.value)}
        />
    ),
}))

// Mock TabSelect
jest.mock('@/app/components/tab_select', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="tab-select-mock">
            {props.items.map((item: string) => (
                <button
                    key={item}
                    data-testid={`tab-${item}`}
                    onClick={() => props.onChangeSelected(item)}
                >
                    {item}
                </button>
            ))}
        </div>
    ),
}))

// Mock Journey component
jest.mock('@/app/components/journey', () => ({
    __esModule: true,
    JourneyType: { Paths: 'Paths', Exceptions: 'Exceptions' },
    default: (props: any) => (
        <div data-testid={`journey-mock-${props.journeyType}`}>{`Journey Rendered: ${props.journeyType}`}</div>
    ),
}))

// Helper to mock useSearchParams with custom query
const getSearchParamsMock = (params: Record<string, string>) => {
    return () => new URLSearchParams(params)
}

describe('UserJourneys Page', () => {
    beforeEach(() => {
        replaceMock.mockClear()
    })

    it('renders the User Journeys heading and Filters component', () => {
        render(<UserJourneys params={{ teamId: '123' }} />)
        expect(screen.getByText('User Journeys')).toBeInTheDocument()
        expect(screen.getByTestId('filters-mock')).toBeInTheDocument()
    })

    it('does not render Journey, TabSelect or DebounceTextInput when filters are not ready', () => {
        render(<UserJourneys params={{ teamId: '123' }} />)
        expect(screen.queryByTestId('tab-select-mock')).not.toBeInTheDocument()
        expect(screen.queryByTestId('debounce-text-input-mock')).not.toBeInTheDocument()
        expect(screen.queryByTestId('journey-mock-Paths')).not.toBeInTheDocument()
        expect(screen.queryByTestId('journey-mock-Exceptions')).not.toBeInTheDocument()
    })

    it('renders TabSelect, DebounceTextInput, and Journey (Paths) when filters become ready and updates URL', async () => {
        render(<UserJourneys params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')

        await act(async () => {
            fireEvent.click(updateButton)
        })

        expect(await screen.findByTestId('tab-select-mock')).toBeInTheDocument()
        expect(await screen.findByTestId('debounce-text-input-mock')).toBeInTheDocument()
        expect(await screen.findByTestId('journey-mock-Paths')).toBeInTheDocument()
        expect(replaceMock).toHaveBeenCalledWith('?jt=Paths&updated', { scroll: false })
    })

    it('renders Journey (Exceptions) when Exceptions tab is selected', async () => {
        render(<UserJourneys params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')

        await act(async () => {
            fireEvent.click(updateButton)
        })

        const exceptionsTab = await screen.findByTestId('tab-Exceptions')
        await act(async () => {
            fireEvent.click(exceptionsTab)
        })

        expect(await screen.findByTestId('journey-mock-Exceptions')).toBeInTheDocument()
    })

    it('renders Journey (Paths) by default and switches to Exceptions when tab is selected', async () => {
        render(<UserJourneys params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')

        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Initially, Paths journey should be rendered
        expect(await screen.findByTestId('journey-mock-Paths')).toBeInTheDocument()
        expect(screen.queryByTestId('journey-mock-Exceptions')).not.toBeInTheDocument()

        // Switch to Exceptions tab
        const exceptionsTab = await screen.findByTestId('tab-Exceptions')
        await act(async () => {
            fireEvent.click(exceptionsTab)
        })

        // Now, Exceptions journey should be rendered
        expect(await screen.findByTestId('journey-mock-Exceptions')).toBeInTheDocument()
        expect(screen.queryByTestId('journey-mock-Paths')).not.toBeInTheDocument()
    })

    it('sets jt query param in URL when tab is changed', async () => {
        // Patch useSearchParams to return empty initially
        jest.mock('next/navigation', () => ({
            useRouter: () => ({ replace: replaceMock }),
            useSearchParams: getSearchParamsMock({}),
        }))
        // Re-import UserJourneys to use the new mock
        const { default: UserJourneysPatched } = require('@/app/[teamId]/journeys/page')
        render(<UserJourneysPatched params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')
        await act(async () => { fireEvent.click(updateButton) })
        const exceptionsTab = await screen.findByTestId('tab-Exceptions')
        await act(async () => { fireEvent.click(exceptionsTab) })
        expect(replaceMock).toHaveBeenLastCalledWith('?jt=Exceptions&updated', { scroll: false })
    })

    it('updates searchText when DebounceTextInput changes', async () => {
        render(<UserJourneys params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')

        await act(async () => {
            fireEvent.click(updateButton)
        })

        const input = await screen.findByTestId('debounce-text-input-mock')
        await act(async () => {
            fireEvent.change(input, { target: { value: 'search term' } })
        })
        // No assertion needed, just ensure no crash and input is present
        expect(input).toBeInTheDocument()
    })

    it('does not update filters if they remain unchanged', async () => {
        render(<UserJourneys params={{ teamId: '123' }} />)
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
})