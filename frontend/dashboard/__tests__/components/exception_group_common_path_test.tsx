import ExceptionGroupCommonPath from '@/app/components/exception_group_common_path'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockCommonPathData = {
    sessions_analyzed: 50,
    steps: [
        {
            description: 'App cold launched (activity: MainActivity)',
            thread_name: 'main',
            confidence_pct: 95.5
        },
        {
            description: 'Activity created: MainActivity',
            thread_name: 'main',
            confidence_pct: 90.0
        },
        {
            description: 'User tapped on submit_button (Button)',
            thread_name: 'main',
            confidence_pct: 85.0
        },
        {
            description: 'Crash: NullPointerException - Object reference not set',
            thread_name: 'main',
            confidence_pct: 80.0
        },
        {
            description: 'HTTP GET to https://api.example.com/data (status: 200)',
            thread_name: 'worker-1',
            confidence_pct: 45.0
        }
    ]
}

// Mock API calls
jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    ExceptionGroupCommonPathApiStatus: {
        Loading: 'loading',
        Error: 'error',
        Success: 'success'
    },
    fetchExceptionGroupCommonPathFromServer: jest.fn(() =>
        Promise.resolve({
            status: 'success',
            data: mockCommonPathData
        })
    ),
    ExceptionsType: {
        Crash: 'crash',
        ANR: 'anr'
    }
}))

// Mock Badge component
jest.mock('@/app/components/badge', () => ({
    Badge: ({ children, ...props }: any) => <span data-testid="badge-mock" {...props}>{children}</span>
}))

// Mock LoadingSpinner component
jest.mock('@/app/components/loading_spinner', () => ({
    __esModule: true,
    default: () => <div data-testid="loading-spinner-mock">Loading...</div>
}))

// Mock Slider component
jest.mock('@/app/components/slider', () => ({
    Slider: ({ value, onValueChange, min, max, step, className }: any) => (
        <div data-testid="slider-mock" className={className}>
            <input
                type="range"
                data-testid="slider-input"
                value={value[0]}
                onChange={(e) => onValueChange([parseInt(e.target.value)])}
                min={min}
                max={max}
                step={step}
            />
        </div>
    )
}))

describe('ExceptionGroupCommonPath Component', () => {
    const defaultProps = {
        type: 'crash' as any,
        appId: 'app-123',
        groupId: 'crash-group-123'
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('Initial Rendering', () => {
        it('renders the Common Path heading with Beta badge', async () => {
            await act(async () => {
                render(<ExceptionGroupCommonPath {...defaultProps} />)
            })

            await waitFor(() => {
                expect(screen.getByText('Common Path')).toBeInTheDocument()
            })

            expect(screen.getByTestId('badge-mock')).toBeInTheDocument()
            expect(screen.getByText('Beta')).toBeInTheDocument()
        })

        it('shows loading spinner initially', async () => {
            // Create a promise we can control
            let resolvePromise: (value: any) => void
            const controlledPromise = new Promise((resolve) => {
                resolvePromise = resolve
            })

            const { fetchExceptionGroupCommonPathFromServer } = require('@/app/api/api_calls')
            fetchExceptionGroupCommonPathFromServer.mockImplementationOnce(() => controlledPromise)

            render(<ExceptionGroupCommonPath {...defaultProps} />)

            // Loading spinner should be visible while promise is pending
            expect(screen.getByTestId('loading-spinner-mock')).toBeInTheDocument()

            // Resolve the promise
            await act(async () => {
                resolvePromise!({
                    status: 'success',
                    data: mockCommonPathData
                })
            })

            // Wait for loading spinner to disappear
            await waitFor(() => {
                expect(screen.queryByTestId('loading-spinner-mock')).not.toBeInTheDocument()
            })
        })
    })

    describe('Data Fetching and Display', () => {
        it('fetches and displays common path data', async () => {
            await act(async () => {
                render(<ExceptionGroupCommonPath {...defaultProps} />)
            })

            await waitFor(() => {
                expect(screen.getByText('App cold launched (activity: MainActivity)')).toBeInTheDocument()
            })

            expect(screen.getByText('Activity created: MainActivity')).toBeInTheDocument()
            expect(screen.getByText('User tapped on submit_button (Button)')).toBeInTheDocument()
            expect(screen.getByText('Crash: NullPointerException - Object reference not set')).toBeInTheDocument()
        })

        it('displays session count correctly', async () => {
            await act(async () => {
                render(<ExceptionGroupCommonPath {...defaultProps} />)
            })

            await waitFor(() => {
                expect(screen.getByText(/Analyzed from latest 50 sessions/)).toBeInTheDocument()
            })
        })

        it('displays thread names and confidence percentages for each step', async () => {
            await act(async () => {
                render(<ExceptionGroupCommonPath {...defaultProps} />)
            })

            await waitFor(() => {
                // Check for specific confidence percentages to verify all steps rendered
                expect(screen.getByText(/Occurs in 95.5% of analyzed sessions/)).toBeInTheDocument()
                expect(screen.getByText(/Occurs in 90% of analyzed sessions/)).toBeInTheDocument()
                expect(screen.getByText(/Occurs in 85% of analyzed sessions/)).toBeInTheDocument()
                expect(screen.getByText(/Occurs in 80% of analyzed sessions/)).toBeInTheDocument()
            })
        })

        it('renders steps as an ordered list', async () => {
            await act(async () => {
                render(<ExceptionGroupCommonPath {...defaultProps} />)
            })

            await waitFor(() => {
                const orderedList = screen.getByRole('list')
                expect(orderedList).toBeInTheDocument()
                expect(orderedList.tagName).toBe('OL')
            })
        })

        it('shows error message when API returns error status', async () => {
            const { fetchExceptionGroupCommonPathFromServer } = require('@/app/api/api_calls')
            fetchExceptionGroupCommonPathFromServer.mockImplementationOnce(() =>
                Promise.resolve({
                    status: 'error'
                })
            )

            await act(async () => {
                render(<ExceptionGroupCommonPath {...defaultProps} />)
            })

            await waitFor(() => {
                expect(screen.getByText(/Error fetching common path, please refresh page to try again/)).toBeInTheDocument()
            })
        })
    })

    describe('Confidence Threshold Filtering', () => {
        it('initializes slider at 80% by default', async () => {
            await act(async () => {
                render(<ExceptionGroupCommonPath {...defaultProps} />)
            })

            await waitFor(() => {
                const slider = screen.getByTestId('slider-input')
                expect(slider).toHaveValue('80')
                expect(screen.getByText(/Showing events that are common in at least:/)).toBeInTheDocument()
            })
        })

        it('filters steps based on confidence threshold', async () => {
            await act(async () => {
                render(<ExceptionGroupCommonPath {...defaultProps} />)
            })

            await waitFor(() => {
                expect(screen.getByText('App cold launched (activity: MainActivity)')).toBeInTheDocument()
            })

            // At 80% threshold, should show 4 steps (95.5%, 90%, 85%, 80%)
            expect(screen.getByText(/4 of 5 steps/)).toBeInTheDocument()
            expect(screen.queryByText(/HTTP GET to https:\/\/api.example.com\/data/)).not.toBeInTheDocument()
        })

        it('updates displayed steps when slider value changes', async () => {
            await act(async () => {
                render(<ExceptionGroupCommonPath {...defaultProps} />)
            })

            await waitFor(() => {
                expect(screen.getByText('App cold launched (activity: MainActivity)')).toBeInTheDocument()
            })

            const slider = screen.getByTestId('slider-input')

            // Change threshold to 90%
            await act(async () => {
                fireEvent.change(slider, { target: { value: '90' } })
            })

            await waitFor(() => {
                expect(screen.getByText(/2 of 5 steps/)).toBeInTheDocument()
            })

            // Should only show steps with >= 90% confidence
            expect(screen.getByText('App cold launched (activity: MainActivity)')).toBeInTheDocument()
            expect(screen.getByText('Activity created: MainActivity')).toBeInTheDocument()
            expect(screen.queryByText('User tapped on submit_button (Button)')).not.toBeInTheDocument()
        })

        it('shows all steps when threshold is set to 1%', async () => {
            await act(async () => {
                render(<ExceptionGroupCommonPath {...defaultProps} />)
            })

            await waitFor(() => {
                expect(screen.getByText('App cold launched (activity: MainActivity)')).toBeInTheDocument()
            })

            const slider = screen.getByTestId('slider-input')

            await act(async () => {
                fireEvent.change(slider, { target: { value: '1' } })
            })

            await waitFor(() => {
                expect(screen.getByText(/5 of 5 steps/)).toBeInTheDocument()
            })

            expect(screen.getByText(/HTTP GET to https:\/\/api.example.com\/data/)).toBeInTheDocument()
        })

        it('shows no steps message when threshold excludes all steps', async () => {
            await act(async () => {
                render(<ExceptionGroupCommonPath {...defaultProps} />)
            })

            await waitFor(() => {
                expect(screen.getByText('App cold launched (activity: MainActivity)')).toBeInTheDocument()
            })

            const slider = screen.getByTestId('slider-input')

            await act(async () => {
                fireEvent.change(slider, { target: { value: '100' } })
            })

            await waitFor(() => {
                expect(screen.getByText(/No events are common in at least 100% of analyzed sessions/)).toBeInTheDocument()
            })

            expect(screen.getByText(/0 of 5 steps/)).toBeInTheDocument()
        })
    })

    describe('API Integration', () => {
        it('calls fetchExceptionGroupCommonPathFromServer with correct parameters', async () => {
            const { fetchExceptionGroupCommonPathFromServer } = require('@/app/api/api_calls')

            await act(async () => {
                render(<ExceptionGroupCommonPath {...defaultProps} />)
            })

            await waitFor(() => {
                expect(fetchExceptionGroupCommonPathFromServer).toHaveBeenCalledWith(
                    'crash',
                    'app-123',
                    'crash-group-123'
                )
            })
        })

        it('refetches data when groupId changes', async () => {
            const { fetchExceptionGroupCommonPathFromServer } = require('@/app/api/api_calls')

            let result: ReturnType<typeof render>
            await act(async () => {
                result = render(<ExceptionGroupCommonPath {...defaultProps} />)
            })

            await waitFor(() => {
                expect(fetchExceptionGroupCommonPathFromServer).toHaveBeenCalledTimes(1)
            })

            await act(async () => {
                result.rerender(<ExceptionGroupCommonPath {...defaultProps} groupId="crash-group-456" />)
            })

            await waitFor(() => {
                expect(fetchExceptionGroupCommonPathFromServer).toHaveBeenCalledTimes(2)
                expect(fetchExceptionGroupCommonPathFromServer).toHaveBeenLastCalledWith(
                    'crash',
                    'app-123',
                    'crash-group-456'
                )
            })
        })

        it('refetches data when appId changes', async () => {
            const { fetchExceptionGroupCommonPathFromServer } = require('@/app/api/api_calls')

            let result: ReturnType<typeof render>
            await act(async () => {
                result = render(<ExceptionGroupCommonPath {...defaultProps} />)
            })

            await waitFor(() => {
                expect(fetchExceptionGroupCommonPathFromServer).toHaveBeenCalledTimes(1)
            })

            await act(async () => {
                result.rerender(<ExceptionGroupCommonPath {...defaultProps} appId="app-456" />)
            })

            await waitFor(() => {
                expect(fetchExceptionGroupCommonPathFromServer).toHaveBeenCalledTimes(2)
                expect(fetchExceptionGroupCommonPathFromServer).toHaveBeenLastCalledWith(
                    'crash',
                    'app-456',
                    'crash-group-123'
                )
            })
        })

        it('refetches data when type changes', async () => {
            const { fetchExceptionGroupCommonPathFromServer } = require('@/app/api/api_calls')

            let result: ReturnType<typeof render>
            await act(async () => {
                result = render(<ExceptionGroupCommonPath {...defaultProps} />)
            })

            await waitFor(() => {
                expect(fetchExceptionGroupCommonPathFromServer).toHaveBeenCalledTimes(1)
            })

            await act(async () => {
                result.rerender(<ExceptionGroupCommonPath {...defaultProps} type={'anr' as any} />)
            })

            await waitFor(() => {
                expect(fetchExceptionGroupCommonPathFromServer).toHaveBeenCalledTimes(2)
                expect(fetchExceptionGroupCommonPathFromServer).toHaveBeenLastCalledWith(
                    'anr',
                    'app-123',
                    'crash-group-123'
                )
            })
        })
    })

    describe('Empty State', () => {
        it('shows empty message when no steps are returned', async () => {
            const { fetchExceptionGroupCommonPathFromServer } = require('@/app/api/api_calls')
            fetchExceptionGroupCommonPathFromServer.mockImplementationOnce(() =>
                Promise.resolve({
                    status: 'success',
                    data: {
                        sessions_analyzed: 50,
                        steps: []
                    }
                })
            )

            await act(async () => {
                render(<ExceptionGroupCommonPath {...defaultProps} />)
            })

            await waitFor(() => {
                expect(screen.getByText(/No events are common in at least 80% of analyzed sessions/)).toBeInTheDocument()
            })
        })
    })

    describe('UI Layout', () => {
        it('displays all UI elements in correct order', async () => {
            await act(async () => {
                render(<ExceptionGroupCommonPath {...defaultProps} />)
            })

            await waitFor(() => {
                const heading = screen.getByText('Common Path')
                const filterLabel = screen.getByText(/Showing events that are common/)
                const slider = screen.getByTestId('slider-mock')
                const list = screen.getByRole('list')

                // Check that elements appear in order
                expect(heading.compareDocumentPosition(filterLabel)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
                expect(filterLabel.compareDocumentPosition(slider)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
                expect(slider.compareDocumentPosition(list)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
            })
        })

        it('applies correct CSS classes to the list container', async () => {
            await act(async () => {
                render(<ExceptionGroupCommonPath {...defaultProps} />)
            })

            await waitFor(() => {
                const listContainer = screen.getByRole('list').parentElement
                expect(listContainer).toHaveClass('w-full', 'bg-accent', 'text-accent-foreground', 'px-4', 'py-4', 'h-[24rem]', 'overflow-y-auto')
            })
        })
    })
})