import SessionTargetingRule from '@/app/components/session_targeting/session_targeting_rule'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'

// Global replace and push mocks for router
const replaceMock = jest.fn()
const pushMock = jest.fn()

// Mock next/navigation hooks
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: replaceMock,
        push: pushMock,
    }),
}))

// Mock API calls and constants for session targeting
jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    sessionTargetingConfigResponse: {
        result: {
            events: [
                { type: 'click', attrs: [{ key: 'button_id', type: 'string' }], ud_attrs: true }
            ],
            session_attrs: [{ key: 'user_id', type: 'string' }],
            event_ud_attrs: { key_types: [{ key: 'custom_attr', type: 'string' }] },
            operator_types: { string: ['eq', 'neq'], number: ['eq', 'gt'] }
        }
    },
    emptySessionTargetingRuleResponse: {
        results: {
            id: 'rule-123',
            name: 'Test Rule',
            sampling_rate: 75,
            status: 1,
            rule: 'event.type == "click"'
        }
    },
    SessionTargetingConfigApiStatus: {
        Loading: 'loading',
        Error: 'error',
        Success: 'success'
    },
    SessionTargetingRuleApiStatus: {
        Loading: 'loading',
        Error: 'error',
        Success: 'success'
    },
    CreateSessionTargetingRuleApiStatus: {
        Loading: 'loading',
        Error: 'error',
        Success: 'success'
    },
    UpdateSessionTargetingRuleApiStatus: {
        Loading: 'loading',
        Error: 'error',
        Success: 'success'
    },
    fetchSessionTargetingConfigFromServer: jest.fn(() =>
        Promise.resolve({
            status: 'success',
            data: {
                result: {
                    events: [
                        {
                            type: 'anr', attrs: [
                                {
                                    key: 'handled',
                                    type: 'bool'
                                }
                            ], ud_attrs: false
                        },
                        {
                            type: 'exception', attrs: [
                                {
                                    key: 'handled',
                                    type: 'bool'
                                }
                            ], ud_attrs: false
                        }
                    ],
                    session_attrs: [
                        {
                            key: 'is_device_foldable',
                            type: 'bool'
                        }
                    ],
                    event_ud_attrs: {},
                    operator_types: {
                        string: ['eq', 'neq'],
                        bool: ['eq', 'neq']
                    }
                }
            }
        })
    ),
    fetchSessionTargetingRuleFromServer: jest.fn(() =>
        Promise.resolve({
            status: 'success',
            data: {
                id: 'rule-123',
                name: 'Test Rule',
                sampling_rate: 75,
                status: 1,
                rule: '(event_type == "anr")'
            }
        })
    ),
    createSessionTargetingRule: jest.fn(),
    updateSessionTargetingRule: jest.fn(),
}))

// Mock loading component
jest.mock('@/app/components/loading_spinner', () => () => (
    <div data-testid="loading-spinner-mock">Loading...</div>
))

// Mock attribute components
jest.mock('@/app/components/session_targeting/rule_builder_attribute_row', () => ({
    attr,
    onRemoveAttr,
    conditionId,
    attrType
}: any) => (
    <div data-testid={`attribute-row-${attr.id}`}>
        <span>Attribute: {attr.key}</span>
        <span>{String(attr.value)}</span>
        <button
            data-testid={`remove-attribute-${attr.id}`}
            onClick={() => onRemoveAttr?.(conditionId, attr.id, attrType)}
        >
            Remove
        </button>
    </div>
))

jest.mock('@/app/components/session_targeting/rule_builder_add_attribute', () => ({
    title,
    onAdd,
    disabled
}: any) => (
    <button
        data-testid={`add-attribute-${title.toLowerCase().replace(/\s+/g, '-')}`}
        onClick={onAdd}
        disabled={disabled}
    >
        + Add {title}
    </button>
))

// Mock crypto.randomUUID
Object.defineProperty(global.crypto, 'randomUUID', {
    value: jest.fn(() => 'mock-uuid-123'),
    writable: true
})

describe('SessionTargetingRule Component - Page State', () => {
    beforeEach(() => {
        replaceMock.mockClear()
        pushMock.mockClear()
    })

    const defaultProps = {
        params: {
            teamId: 'team-123',
            appId: 'app-123'
        },
        isEditMode: false
    }

    it('renders loading state when page is loading', () => {
        // Mock API to never resolve to keep loading state
        const { fetchSessionTargetingConfigFromServer } = require('@/app/api/api_calls')
        fetchSessionTargetingConfigFromServer.mockImplementationOnce(() => new Promise(() => { }))

        render(<SessionTargetingRule {...defaultProps} />)

        // Verify loading spinner is visible
        expect(screen.getByTestId('loading-spinner-mock')).toBeInTheDocument()
        expect(screen.queryByText('Session Targeting Rule')).toBeInTheDocument()

        // Verify main UI elements are not rendered during loading
        expect(screen.queryByText('Rule name')).not.toBeInTheDocument()
        expect(screen.queryByText('Sampling rate %')).not.toBeInTheDocument()
        expect(screen.queryByText('Active')).not.toBeInTheDocument()
        expect(screen.queryByText('Event Conditions')).not.toBeInTheDocument()
        expect(screen.queryByText('Session Conditions')).not.toBeInTheDocument()
    })

    it('renders error state when API call fails', async () => {
        const { fetchSessionTargetingConfigFromServer, } = require('@/app/api/api_calls')
        fetchSessionTargetingConfigFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 'error'
            })
        )

        render(<SessionTargetingRule {...defaultProps} />)

        // Wait for the error state to appear and verify exact error message
        expect(await screen.findByText('Error loading rule. Please refresh the page to try again.')).toBeInTheDocument()

        // Verify loading spinner is not visible
        expect(screen.queryByTestId('loading-spinner-mock')).not.toBeInTheDocument()

        // Verify main UI elements are not rendered in error state
        expect(screen.queryByText('Session Targeting Rule')).not.toBeInTheDocument()
        expect(screen.queryByText('Rule name')).not.toBeInTheDocument()
        expect(screen.queryByText('Sampling rate %')).not.toBeInTheDocument()
        expect(screen.queryByText('Active')).not.toBeInTheDocument()
        expect(screen.queryByText('Event Conditions')).not.toBeInTheDocument()
        expect(screen.queryByText('Session Conditions')).not.toBeInTheDocument()
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })


    it('renders ready state in create mode when API call succeeds', async () => {
        render(<SessionTargetingRule {...defaultProps} />)

        // Wait for the ready state to appear and verify main heading
        expect(await screen.findByText('Session Targeting Rule')).toBeInTheDocument()

        // Verify loading spinner is not visible
        expect(screen.queryByTestId('loading-spinner-mock')).not.toBeInTheDocument()

        // Verify form labels are rendered
        expect(screen.getByText('Rule name')).toBeInTheDocument()
        expect(screen.getByText('Sampling rate %')).toBeInTheDocument()
        expect(screen.getByText('Active')).toBeInTheDocument()

        // Verify form inputs are rendered with initial values
        const ruleNameInput = screen.getByPlaceholderText('Enter rule name')
        expect(ruleNameInput).toBeInTheDocument()
        expect(ruleNameInput).toHaveValue('')

        const samplingRateInput = screen.getByPlaceholderText('0-100%')
        expect(samplingRateInput).toBeInTheDocument()
        expect(samplingRateInput).toHaveValue(100)

        // Verify condition sections are rendered
        expect(screen.getByText('Event Conditions')).toBeInTheDocument()
        expect(screen.getByText('Session Conditions')).toBeInTheDocument()

        // Verify two add condition buttons are present
        const addConditionButtons = screen.getAllByText('+ Add condition')
        expect(addConditionButtons.length).toBe(2)
    })

    it('renders ready state in edit mode with existing rule data', async () => {
        // Mock the rule data from server
        const { fetchSessionTargetingRuleFromServer, fetchSessionTargetingConfigFromServer } = require('@/app/api/api_calls')
        fetchSessionTargetingRuleFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 'success',
                data: {
                    id: 'rule-456',
                    name: 'Complex Test Rule',
                    sampling_rate: 85,
                    status: 1, // enabled
                    rule: '((event_type == "anr") && (event_type == "exception")) && (attribute.is_device_foldable == true)'
                }
            })
        )

        fetchSessionTargetingConfigFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 'success',
                data: {
                    result: {
                        events: [
                            { type: 'anr', attrs: [], ud_attrs: false },
                            { type: 'exception', attrs: [], ud_attrs: false }
                        ],
                        session_attrs: [
                            {
                                key: 'is_device_foldable',
                                type: 'bool'

                            }
                        ],
                        event_ud_attrs: {},
                        operator_types: {
                            string: ['eq', 'neq'],
                        }
                    }
                }
            })
        )

        const editModeProps = {
            params: {
                teamId: 'team-123',
                appId: 'app-123',
                ruleId: 'rule-456'
            },
            isEditMode: true
        }

        render(<SessionTargetingRule {...editModeProps} />)

        // Wait for the ready state to appear and verify main heading
        expect(await screen.findByText('Session Targeting Rule')).toBeInTheDocument()

        // Verify loading spinner is not visible
        expect(screen.queryByTestId('loading-spinner-mock')).not.toBeInTheDocument()

        // Update button is disabled when no changes are made
        const updateButton = screen.getByText('Update Rule')
        expect(updateButton).toBeDisabled()

        // Verify form is populated with existing rule data
        const ruleNameInput = screen.getByPlaceholderText('Enter rule name')
        expect(ruleNameInput).toBeInTheDocument()
        expect(ruleNameInput).toHaveValue('Complex Test Rule')

        const samplingRateInput = screen.getByPlaceholderText('0-100%')
        expect(samplingRateInput).toBeInTheDocument()
        expect(samplingRateInput).toHaveValue(85)

        // Verify condition sections are rendered
        expect(screen.getByText('Event Conditions')).toBeInTheDocument()
        expect(screen.getByText('Session Conditions')).toBeInTheDocument()

        // Check for event types: "anr" and "exception"
        expect(screen.getByText('anr')).toBeInTheDocument()
        expect(screen.getByText('exception')).toBeInTheDocument()

        // Check for session attribute
        expect(screen.getByText('Attribute: is_device_foldable')).toBeInTheDocument()

        // Check for boolean value
        expect(screen.getByText('true')).toBeInTheDocument()
    })
})

describe('SessionTargetingRule Component - Add/remove Event Attributes', () => {
    beforeEach(() => {
        replaceMock.mockClear()
        pushMock.mockClear()
    })

    const defaultProps = {
        params: {
            teamId: 'team-123',
            appId: 'app-123'
        },
        isEditMode: false
    }

    it('adds and removes event attributes correctly', async () => {
        render(<SessionTargetingRule {...defaultProps} />)

        // Wait for ready state
        await screen.findByText('Session Targeting Rule')

        // Add an event condition first
        const addEventConditionButton = screen.getAllByText('+ Add condition')[0]
        await act(async () => {
            fireEvent.click(addEventConditionButton)
        })

        // Verify event condition was added
        expect(screen.getByText('anr')).toBeInTheDocument()

        // Add an attribute to the event condition
        const addAttributeButton = screen.getByTestId('add-attribute-attributes')
        await act(async () => {
            fireEvent.click(addAttributeButton)
        })

        // Verify attribute was added
        expect(screen.getByTestId('attribute-row-mock-uuid-123')).toBeInTheDocument()
        expect(screen.getByText('Attribute: handled')).toBeInTheDocument()

        // Remove the attribute
        const removeAttributeButton = screen.getByTestId('remove-attribute-mock-uuid-123')
        await act(async () => {
            fireEvent.click(removeAttributeButton)
        })

        // Verify attribute was removed
        expect(screen.queryByTestId('attribute-row-mock-uuid-123')).not.toBeInTheDocument()
        expect(screen.queryByText('Attribute: handled')).not.toBeInTheDocument()

        // Event condition should still exist
        expect(screen.getByText('anr')).toBeInTheDocument()
    })
})

describe('SessionTargetingRule Component - Save Rule', () => {
    beforeEach(() => {
        replaceMock.mockClear()
        pushMock.mockClear()
    })

    const defaultProps = {
        params: {
            teamId: 'team-123',
            appId: 'app-123'
        },
        isEditMode: false
    }

    it('creates new rule when published', async () => {
        const { createSessionTargetingRule } = require('@/app/api/api_calls')
        createSessionTargetingRule.mockImplementationOnce(() =>
            Promise.resolve({
                status: 'success'
            })
        )

        render(<SessionTargetingRule {...defaultProps} />)

        // Wait for ready state
        await screen.findByText('Session Targeting Rule')

        // Enter rule name
        const ruleNameInput = screen.getByPlaceholderText('Enter rule name')
        await act(async () => {
            fireEvent.change(ruleNameInput, { target: { value: 'Test Rule Name' } })
        })

        // Change sampling rate
        const samplingRateInput = screen.getByPlaceholderText('0-100%')
        await act(async () => {
            fireEvent.change(samplingRateInput, { target: { value: '75' } })
        })

        // Toggle status to enabled
        const statusToggle = screen.getByRole('switch')
        await act(async () => {
            fireEvent.click(statusToggle)
        })

        // Add one event condition
        const addEventConditionButton = screen.getAllByText('+ Add condition')[0]
        await act(async () => {
            fireEvent.click(addEventConditionButton)
        })

        // Add one session condition
        const addSessionConditionButton = screen.getAllByText("+ Add condition")[1]
        await act(async () => {
            fireEvent.click(addSessionConditionButton)
        })

        // Click publish button
        const publishButton = screen.getByText('Publish Rule')
        await act(async () => {
            fireEvent.click(publishButton)
        })

        // Verify API was called with correct rule name
        expect(createSessionTargetingRule).toHaveBeenCalledWith(
            'app-123',
            expect.objectContaining({
                name: 'Test Rule Name',
                status: 1,
                sampling_rate: 75,
                rule: '(event_type == "anr") && (attribute.is_device_foldable == false)'
            })
        )
    })

    it('udpates existing rule with updated values when published', async () => {
        const { updateSessionTargetingRule } = require('@/app/api/api_calls')
        updateSessionTargetingRule.mockImplementationOnce(() =>
            Promise.resolve({
                status: 'success'
            })
        )

        // Mock the rule data from server
        const { fetchSessionTargetingRuleFromServer, fetchSessionTargetingConfigFromServer } = require('@/app/api/api_calls')
        fetchSessionTargetingRuleFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 'success',
                data: {
                    id: 'rule-456',
                    name: 'Initial Test Rule',
                    sampling_rate: 100,
                    status: 0, // disabled
                    rule: '((event_type == "anr") && (event_type == "exception")) && (attribute.is_device_foldable == true)'
                }
            })
        )

        fetchSessionTargetingConfigFromServer.mockImplementationOnce(() =>
            Promise.resolve({
                status: 'success',
                data: {
                    result: {
                        events: [
                            { type: 'anr', attrs: [], ud_attrs: false },
                            { type: 'exception', attrs: [], ud_attrs: false }
                        ],
                        session_attrs: [
                            {
                                key: 'is_device_foldable',
                                type: 'bool'

                            }
                        ],
                        event_ud_attrs: {},
                        operator_types: {
                            string: ['eq', 'neq'],
                        }
                    }
                }
            })
        )

        const editModeProps = {
            params: {
                teamId: 'team-123',
                appId: 'app-123',
                ruleId: 'rule-456'
            },
            isEditMode: true
        }

        render(<SessionTargetingRule {...editModeProps} />)

        // Wait for ready state
        await screen.findByText('Session Targeting Rule')

        // Enter rule name
        const ruleNameInput = screen.getByPlaceholderText('Enter rule name')
        await act(async () => {
            fireEvent.change(ruleNameInput, { target: { value: 'Test Rule Name' } })
        })

        // Change sampling rate
        const samplingRateInput = screen.getByPlaceholderText('0-100%')
        await act(async () => {
            fireEvent.change(samplingRateInput, { target: { value: '75' } })
        })

        // Toggle status to enabled
        const statusToggle = screen.getByRole('switch')
        await act(async () => {
            fireEvent.click(statusToggle)
        })

        // Click update button
        const updateButton = screen.getByText('Update Rule')
        await act(async () => {
            fireEvent.click(updateButton)
        })

        // Verify API was called with correct rule name
        expect(updateSessionTargetingRule).toHaveBeenCalledWith(
            'app-123',
            'rule-456',
            expect.objectContaining({
                name: 'Test Rule Name',
                status: 1,
                sampling_rate: 75,
                rule: '((event_type == "anr") && (event_type == "exception")) && (attribute.is_device_foldable == true)'
            })
        )
    })
})