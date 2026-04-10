import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

const mockRouterReplace = jest.fn()

jest.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockRouterReplace }),
    useSearchParams: () => new URLSearchParams(),
}))

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, children, className }: any) => <a href={href} className={className}>{children}</a>,
}))

jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    FilterSource: { Events: 0 },
}))

jest.mock('@/app/components/filters', () => ({
    __esModule: true,
    default: ({ onFiltersChanged }: any) => (
        <div data-testid="filters-mock">
            <button data-testid="set-filters-ready" onClick={() => onFiltersChanged({ ready: true, serialisedFilters: 'a=app-1' })}>Ready</button>
        </div>
    ),
    AppVersionsInitialSelectionType: { Latest: 0 },
    defaultFilters: { ready: false, serialisedFilters: null },
}))

jest.mock('@/app/components/journey', () => ({
    __esModule: true,
    default: ({ journeyType, demo }: any) => <div data-testid={`journey-${journeyType}`} data-demo={demo} />,
    JourneyType: { Paths: 'Paths', Exceptions: 'Exceptions' },
}))

jest.mock('@/app/components/tab_select', () => ({
    __esModule: true,
    default: ({ items, selected, onChangeSelected }: any) => (
        <div data-testid="tab-select">
            {items.map((item: string) => (
                <button key={item} data-testid={`tab-${item}`} onClick={() => onChangeSelected(item)}
                    className={selected === item ? 'selected' : ''}>{item}</button>
            ))}
        </div>
    ),
}))

jest.mock('@/app/components/debounce_text_input', () => ({
    __esModule: true,
    default: ({ id, placeholder, onChange }: any) => (
        <input data-testid={`debounce-input-${id}`} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    ),
}))

jest.mock('@/app/utils/shared_styles', () => ({
    underlineLinkStyle: 'underline',
}))

import UserJourneys from '@/app/components/user_journeys'

describe('UserJourneys', () => {
    describe('Rendering', () => {
        it('renders title', () => {
            render(<UserJourneys />)
            expect(screen.getByText('User Journeys')).toBeInTheDocument()
        })

        it('hides title when hideDemoTitle is true', () => {
            render(<UserJourneys hideDemoTitle={true} />)
            expect(screen.queryByText('User Journeys')).not.toBeInTheDocument()
        })

        it('renders Filters when not in demo mode', () => {
            render(<UserJourneys params={{ teamId: 'team-1' }} />)
            expect(screen.getByTestId('filters-mock')).toBeInTheDocument()
        })

        it('does not render Filters in demo mode', () => {
            render(<UserJourneys demo={true} />)
            expect(screen.queryByTestId('filters-mock')).not.toBeInTheDocument()
        })
    })

    describe('Demo mode', () => {
        it('renders tab select and journey without waiting for filters', () => {
            render(<UserJourneys demo={true} />)
            expect(screen.getByTestId('tab-select')).toBeInTheDocument()
            expect(screen.getByTestId('journey-Paths')).toBeInTheDocument()
        })

        it('does not render search input in demo mode', () => {
            render(<UserJourneys demo={true} />)
            expect(screen.queryByTestId('debounce-input-free-text')).not.toBeInTheDocument()
        })
    })

    describe('Tab switching', () => {
        it('defaults to Paths tab', () => {
            render(<UserJourneys demo={true} />)
            expect(screen.getByTestId('journey-Paths')).toBeInTheDocument()
            expect(screen.queryByTestId('journey-Exceptions')).not.toBeInTheDocument()
        })

        it('switches to Exceptions journey when Exceptions tab is clicked', () => {
            render(<UserJourneys demo={true} />)
            fireEvent.click(screen.getByTestId('tab-Exceptions'))
            expect(screen.getByTestId('journey-Exceptions')).toBeInTheDocument()
            expect(screen.queryByTestId('journey-Paths')).not.toBeInTheDocument()
        })

        it('switches back to Paths journey', () => {
            render(<UserJourneys demo={true} />)
            fireEvent.click(screen.getByTestId('tab-Exceptions'))
            fireEvent.click(screen.getByTestId('tab-Paths'))
            expect(screen.getByTestId('journey-Paths')).toBeInTheDocument()
        })
    })

    describe('Non-demo mode', () => {
        it('shows journey only after filters become ready', async () => {
            render(<UserJourneys params={{ teamId: 'team-1' }} />)
            // Journey should not render before filters are ready
            expect(screen.queryByTestId('tab-select')).not.toBeInTheDocument()

            // Simulate filters becoming ready
            await act(async () => {
                fireEvent.click(screen.getByTestId('set-filters-ready'))
            })
            expect(screen.getByTestId('tab-select')).toBeInTheDocument()
            expect(screen.getByTestId('journey-Paths')).toBeInTheDocument()
        })

        it('renders search input after filters ready', async () => {
            render(<UserJourneys params={{ teamId: 'team-1' }} />)
            await act(async () => {
                fireEvent.click(screen.getByTestId('set-filters-ready'))
            })
            expect(screen.getByTestId('debounce-input-free-text')).toBeInTheDocument()
        })
    })
})
