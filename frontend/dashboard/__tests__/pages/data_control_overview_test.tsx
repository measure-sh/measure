import DataControlOverview from '@/app/[teamId]/data/page'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

const replaceMock = jest.fn()
const pushMock = jest.fn()

jest.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: replaceMock,
        push: pushMock,
    }),
    useSearchParams: () => new URLSearchParams(),
}))

// Mock API calls with valid data
jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    EventTargetingApiStatus: {
        Loading: 'loading',
        Error: 'error',
        Success: 'success',
        NoData: 'no_data'
    },
    TraceTargetingApiStatus: {
        Loading: 'loading',
        Error: 'error',
        Success: 'success',
        NoData: 'no_data'
    },
    fetchEventTargetingRulesFromServer: jest.fn(() =>
        Promise.resolve({
            status: 'success',
            data: {
                default_rule: {
                    id: 'default-event-1',
                    collection_mode: 'sampled',
                    sampling_rate: 100,
                    condition: 'default',
                    take_screenshot: false,
                    take_layout_snapshot: false
                },
                rules: [
                    {
                        id: 'event-rule-1',
                        name: 'High Priority Events',
                        collection_mode: 'sampled',
                        sampling_rate: 100,
                        condition: 'priority > 8',
                        take_screenshot: true,
                        take_layout_snapshot: false
                    }
                ]
            }
        })
    ),
    fetchTraceTargetingRulesFromServer: jest.fn(() =>
        Promise.resolve({
            status: 'success',
            data: {
                default_rule: {
                    id: 'default-trace-1',
                    collection_mode: 'timeline',
                    sampling_rate: 0,
                    condition: 'default'
                },
                rules: [
                    {
                        id: 'trace-rule-1',
                        name: 'Slow Traces',
                        collection_mode: 'sampled',
                        sampling_rate: 50,
                        condition: 'duration > 1000'
                    }
                ]
            }
        })
    ),
    fetchSessionTargetingRulesFromServer: jest.fn(() =>
        Promise.resolve({
            status: 'success',
            data: {
                results: [
                    {
                        id: 'session-rule-1',
                        name: 'Premium Users',
                        condition: 'user.tier == "premium"'
                    }
                ]
            }
        })
    ),
    FilterSource: { Events: 'events' },
}))

jest.mock('@/app/components/filters', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="filters-mock">
            <button
                data-testid="update-filters"
                onClick={() =>
                    props.onFiltersChanged({
                        ready: true,
                        serialisedFilters: 'app=test-app',
                        app: { id: 'test-app-id', name: 'Test App' }
                    })
                }
            >
                Update Filters
            </button>
        </div>
    ),
    AppVersionsInitialSelectionType: { All: 'all' },
    defaultFilters: { ready: false, serialisedFilters: '', app: null },
}))

jest.mock('@/app/components/targeting/rules_table', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid={`rules-table-${props.tableType}`}>
            {props.rules.map((rule: any) => (
                <button
                    key={rule.id}
                    data-testid={`rule-${rule.id}`}
                    onClick={() => props.onRuleClick(rule)}
                >
                    {rule.name}
                </button>
            ))}
        </div>
    ),
}))

jest.mock('@/app/components/targeting/edit_default_rule_dialog', () => ({
    __esModule: true,
    default: (props: any) => (
        props.isOpen ? (
            <div data-testid="edit-default-rule-dialog">
                <span data-testid="dialog-rule-type">{props.ruleType}</span>
                <button data-testid="dialog-close" onClick={props.onClose}>Close</button>
                <button
                    data-testid="dialog-success"
                    onClick={() => props.onSuccess('sampled', 75)}
                >
                    Save
                </button>
                <button
                    data-testid="dialog-error"
                    onClick={() => props.onError('Test error')}
                >
                    Trigger Error
                </button>
            </div>
        ) : null
    ),
}))

jest.mock('@/app/utils/use_toast', () => ({
    toastPositive: jest.fn(),
    toastNegative: jest.fn(),
}))

describe('DataControlOverview Component', () => {
    beforeEach(() => {
        replaceMock.mockClear()
        pushMock.mockClear()
    })

    it('renders the Data Control heading and Filters component', () => {
        render(<DataControlOverview params={{ teamId: '123' }} />)
        expect(screen.getByText('Data Control')).toBeInTheDocument()
        expect(screen.getByTestId('filters-mock')).toBeInTheDocument()
    })

    it('does not render main UI when filters are not ready', () => {
        render(<DataControlOverview params={{ teamId: '123' }} />)
        expect(screen.queryByText('Event Rules')).not.toBeInTheDocument()
        expect(screen.queryByText('Trace Rules')).not.toBeInTheDocument()
    })

    it('renders all rule sections and updates URL when filters become ready', async () => {
        render(<DataControlOverview params={{ teamId: '123' }} />)
        const updateButton = screen.getByTestId('update-filters')

        await act(async () => {
            fireEvent.click(updateButton)
        })

        expect(replaceMock).toHaveBeenCalledWith('?app=test-app', { scroll: false })
        expect(await screen.findByText('Event Rules')).toBeInTheDocument()
        expect(screen.getByText('Trace Rules')).toBeInTheDocument()
        expect(screen.getByText('Session Timeline Rules')).toBeInTheDocument()
    })

    it('displays default rules and override rules correctly', async () => {
        render(<DataControlOverview params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        // Check default rule displays
        expect(await screen.findByText(/Collect all events at 100% sample rate/)).toBeInTheDocument()
        expect(screen.getByText(/Collect traces with session timeline only/)).toBeInTheDocument()

        // Check override rules are rendered
        expect(screen.getByTestId('rules-table-event')).toBeInTheDocument()
        expect(screen.getByText('High Priority Events')).toBeInTheDocument()
        expect(screen.getByTestId('rules-table-trace')).toBeInTheDocument()
        expect(screen.getByText('Slow Traces')).toBeInTheDocument()
        expect(screen.getByTestId('rules-table-session')).toBeInTheDocument()
        expect(screen.getByText('Premium Users')).toBeInTheDocument()
    })

    it('shows error message when API returns error status', async () => {
        const { fetchEventTargetingRulesFromServer } = require('@/app/api/api_calls')
        fetchEventTargetingRulesFromServer.mockImplementationOnce(() =>
            Promise.resolve({ status: 'error' })
        )

        render(<DataControlOverview params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        expect(await screen.findByText(/Error loading rules/)).toBeInTheDocument()
    })

    it('navigates to edit page when rule is clicked', async () => {
        render(<DataControlOverview params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        const ruleButton = await screen.findByTestId('rule-event-rule-1')
        await act(async () => {
            fireEvent.click(ruleButton)
        })

        expect(pushMock).toHaveBeenCalledWith('/123/data/test-app-id/event/event-rule-1/edit')
    })

    it('opens and closes default rule edit dialog for events', async () => {
        render(<DataControlOverview params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        // Wait for content to load
        await screen.findByText('Event Rules')

        // Get all buttons and find the ones with pencil icons
        const allButtons = screen.getAllByRole('button')
        const eventEditButton = allButtons.find(btn =>
            btn.querySelector('.lucide-pencil') !== null
        )

        expect(eventEditButton).toBeDefined()

        await act(async () => {
            fireEvent.click(eventEditButton!)
        })

        expect(screen.getByTestId('edit-default-rule-dialog')).toBeInTheDocument()
        expect(screen.getByTestId('dialog-rule-type')).toHaveTextContent('event')

        await act(async () => {
            fireEvent.click(screen.getByTestId('dialog-close'))
        })

        expect(screen.queryByTestId('edit-default-rule-dialog')).not.toBeInTheDocument()
    })

    it('updates rule and shows success toast on successful save', async () => {
        const { toastPositive } = require('@/app/utils/use_toast')

        render(<DataControlOverview params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        // Open dialog
        const editButtons = screen.getAllByRole('button')
        const eventEditButton = editButtons.find(btn =>
            btn.querySelector('.lucide-pencil')
        )

        await act(async () => {
            fireEvent.click(eventEditButton!)
        })

        // Trigger success
        await act(async () => {
            fireEvent.click(screen.getByTestId('dialog-success'))
        })

        expect(toastPositive).toHaveBeenCalledWith('Rule updated successfully')
    })

    it('disables Create Rule button when rules are still loading', () => {
        render(<DataControlOverview params={{ teamId: '123' }} />)

        const createButton = screen.getByText('Create Rule')
        expect(createButton).toBeDisabled()
    })

    it('enables Create Rule button and shows dropdown when rules load successfully', async () => {
        render(<DataControlOverview params={{ teamId: '123' }} />)

        await act(async () => {
            fireEvent.click(screen.getByTestId('update-filters'))
        })

        const createButton = await screen.findByText('Create Rule')
        expect(createButton).not.toBeDisabled()
    })
})