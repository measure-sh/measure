import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, beforeEach, expect } from '@jest/globals'
import '@testing-library/jest-dom'
import Overview from '@/app/[teamId]/overview/page'

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
    __esModule: true, // Ensures the mock behaves like an ES module
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
    AppVersionsInitialSelectionType: { Latest: 'latest' }, // Mock the Latest property
    defaultFilters: { ready: false, serialisedFilters: '' }, // Mock defaultFilters
}))

// Mock Journey component
jest.mock('@/app/components/journey', () => ({
    __esModule: true, // Ensures the mock behaves like an ES module
    default: () => (
        <div data-testid="journey-mock">Journey Component Rendered</div>
    ),
    JourneyType: { Overview: 'overview' }, // Mock the JourneyType enum
}))

// Mock MetricsOverview component
jest.mock('@/app/components/metrics_overview', () => () => (
    <div data-testid="metrics-overview-mock">MetricsOverview Rendered</div>
))

describe('Overview Component', () => {
    beforeEach(() => {
        replaceMock.mockClear()
    })

    it('renders the Overview heading and Filters component', () => {
        render(<Overview params={{ teamId: '123' }} />)
        expect(screen.getByText('Overview')).toBeInTheDocument()
        expect(screen.getByTestId('filters-mock')).toBeInTheDocument()
    })

    it('does not render Journey or MetricsOverview when filters are not ready', () => {
        render(<Overview params={{ teamId: '123' }} />)
        expect(screen.queryByTestId('journey-mock')).not.toBeInTheDocument()
        expect(screen.queryByTestId('metrics-overview-mock')).not.toBeInTheDocument()
    })

    it('renders Journey and MetricsOverview when filters become ready and updates URL', async () => {
        render(<Overview params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')

        await act(async () => {
            fireEvent.click(updateButton)
        })

        expect(await screen.findByTestId('journey-mock')).toBeInTheDocument()
        expect(await screen.findByTestId('metrics-overview-mock')).toBeInTheDocument()
        expect(replaceMock).toHaveBeenCalledWith('?updated', { scroll: false })
    })

    it('does not update filters if they remain unchanged', async () => {
        render(<Overview params={{ teamId: '123' }} />)
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
