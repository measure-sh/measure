import RuleBuilder from '@/app/components/targeting/rule_builder'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

// Mock callbacks
const onCancelMock = jest.fn()
const onSaveMock = jest.fn()
const onDeleteMock = jest.fn()

Object.defineProperty(global, 'crypto', {
    value: {
        randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(7)
    }
})

// Mock API calls
jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    CreateEventTargetingRuleApiStatus: {
        Success: 'success',
        Error: 'error'
    },
    UpdateEventTargetingRuleApiStatus: {
        Success: 'success',
        Error: 'error'
    },
    DeleteEventTargetingRuleApiStatus: {
        Success: 'success',
        Error: 'error'
    },
    CreateTraceTargetingRuleApiStatus: {
        Success: 'success',
        Error: 'error'
    },
    UpdateTraceTargetingRuleApiStatus: {
        Success: 'success',
        Error: 'error'
    },
    DeleteTraceTargetingRuleApiStatus: {
        Success: 'success',
        Error: 'error'
    },
    CreateSessionTargetingRuleApiStatus: {
        Success: 'success',
        Error: 'error'
    },
    UpdateSessionTargetingRuleApiStatus: {
        Success: 'success',
        Error: 'error'
    },
    DeleteSessionTargetingRuleApiStatus: {
        Success: 'success',
        Error: 'error'
    },
    fetchEventTargetingConfigFromServer: jest.fn(() =>
        Promise.resolve({
            data: {
                events: [
                    {
                        type: 'click',
                        attrs: [
                            {
                                key: 'target',
                                type: 'string',
                                suggestions: null,
                                hint: 'The target element'
                            }
                        ],
                        has_ud_attrs: true
                    },
                    {
                        type: 'http',
                        attrs: [
                            {
                                key: 'url',
                                type: 'string',
                                hint: 'Enter a HTTP URL',
                                suggestions: null
                            }
                        ],
                        has_ud_attrs: false
                    }
                ],
                traces: [
                    {
                        name: 'api_call',
                        attrs: [],
                        has_ud_attrs: true
                    }
                ],
                session_attrs: [
                    {
                        key: 'user_id',
                        type: 'string',
                        suggestions: null,
                        hint: 'Enter a user ID'
                    },
                    {
                        key: 'app_version',
                        type: 'string',
                        hint: "Enter your app's version",
                        suggestions: ['0.0.1']
                    }
                ],
                event_ud_attrs: [
                    {
                        key: 'custom_attr',
                        type: 'string',
                        suggestions: null,
                        hint: ''
                    },
                    {
                        key: 'is_premium',
                        type: 'bool',
                        hint: '',
                        suggestions: null
                    }
                ],
                trace_ud_attrs: [
                    {
                        key: 'endpoint',
                        type: 'string',
                        hint: '',
                        suggestions: null
                    }
                ],
                operator_types: {
                    string: ['eq', 'neq', 'contains', 'startsWith'],
                    int64: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte'],
                    float64: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte'],
                    bool: ['eq', 'neq']
                }
            }
        })
    ),
    fetchSessionTargetingRuleFromServer: jest.fn(() =>
        Promise.resolve({
            data: {
                id: 'session-rule-1',
                team_id: 'team-1',
                app_id: 'app-1',
                name: 'Test Session Rule',
                condition: '(event_type == "click")',
                sampling_rate: 100,
                created_at: '2025-11-18T05:50:03.474764Z',
                created_by: 'test@example.com',
                updated_at: null,
                updated_by: '',
                auto_created: false
            }
        })
    ),
    fetchTraceTargetingConfigFromServer: jest.fn(() =>
        Promise.resolve({
            data: {
                traces: [
                    {
                        name: 'api_call',
                        attrs: [],
                        has_ud_attrs: true
                    },
                    {
                        name: 'load-data',
                        attrs: [],
                        has_ud_attrs: true
                    }
                ],
                session_attrs: [
                    {
                        key: 'user_id',
                        type: 'string',
                        suggestions: null,
                        hint: 'Enter a user ID'
                    }
                ],
                trace_ud_attrs: [
                    {
                        key: 'endpoint',
                        type: 'string',
                        hint: '',
                        suggestions: null
                    },
                    {
                        key: 'timeout_ms',
                        type: 'int64',
                        hint: '',
                        suggestions: null
                    }
                ],
                operator_types: {
                    string: ['eq', 'neq', 'contains', 'startsWith'],
                    int64: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte'],
                    float64: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte'],
                    bool: ['eq', 'neq']
                }
            }
        })
    ),
    fetchTraceTargetingRuleFromServer: jest.fn(() =>
        Promise.resolve({
            data: {
                id: 'trace-rule-1',
                team_id: 'team-1',
                app_id: 'app-1',
                name: 'Test Trace Rule',
                condition: '(span_name == "api_call")',
                collection_mode: 'sampled',
                sampling_rate: 50,
                is_default_behaviour: false,
                created_at: '2025-11-18T05:50:03.474764Z',
                created_by: 'test@example.com',
                updated_at: null,
                updated_by: '',
                auto_created: false
            }
        })
    ),
    fetchSessionTargetingConfigFromServer: jest.fn(() =>
        Promise.resolve({
            data: {
                events: [
                    {
                        type: 'click',
                        attrs: [
                            {
                                key: 'target',
                                type: 'string',
                                suggestions: null,
                                hint: 'The target element'
                            }
                        ],
                        has_ud_attrs: true
                    }
                ],
                traces: [
                    {
                        name: 'api_call',
                        attrs: [],
                        has_ud_attrs: true
                    }
                ],
                session_attrs: [
                    {
                        key: 'user_id',
                        type: 'string',
                        suggestions: null,
                        hint: 'Enter a user ID'
                    }
                ],
                operator_types: {
                    string: ['eq', 'neq', 'contains', 'startsWith'],
                    int64: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte'],
                    float64: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte'],
                    bool: ['eq', 'neq']
                }
            }
        })
    ),
    fetchEventTargetingRuleFromServer: jest.fn(() =>
        Promise.resolve({
            data: {
                id: 'rule-1',
                team_id: 'team-1',
                app_id: 'app-1',
                name: 'Test Event Rule',
                condition: '(event_type == "click")',
                collection_mode: 'sampled',
                sampling_rate: 100,
                take_screenshot: false,
                take_layout_snapshot: false,
                is_default_behaviour: false,
                created_at: '2025-11-18T05:50:03.474764Z',
                created_by: 'test@example.com',
                updated_at: null,
                updated_by: '',
                auto_created: false
            }
        })
    ),
    createEventTargetingRule: jest.fn(() =>
        Promise.resolve({
            status: 'success'
        })
    ),
    updateEventTargetingRule: jest.fn(() =>
        Promise.resolve({
            status: 'success'
        })
    ),
    deleteEventTargetingRule: jest.fn(() =>
        Promise.resolve({
            status: 'success'
        })
    ),
    createTraceTargetingRule: jest.fn(() =>
        Promise.resolve({
            status: 'success'
        })
    ),
    updateTraceTargetingRule: jest.fn(() =>
        Promise.resolve({
            status: 'success'
        })
    ),
    deleteTraceTargetingRule: jest.fn(() =>
        Promise.resolve({
            status: 'success'
        })
    ),
    createSessionTargetingRule: jest.fn(() =>
        Promise.resolve({
            status: 'success'
        })
    ),
    updateSessionTargetingRule: jest.fn(() =>
        Promise.resolve({
            status: 'success'
        })
    ),
    deleteSessionTargetingRule: jest.fn(() =>
        Promise.resolve({
            status: 'success'
        })
    ),
}))

// Mock toast
jest.mock('@/app/utils/use_toast', () => ({
    toastPositive: jest.fn(),
    toastNegative: jest.fn(),
}))

// Mock components
jest.mock('@/app/components/loading_spinner', () => ({
    __esModule: true,
    default: () => <div data-testid="loading-spinner">Loading...</div>
}))

jest.mock('@/app/components/dropdown_select', () => ({
    __esModule: true,
    default: (props: any) => (
        <select
            data-testid={`dropdown-${props.title}`}
            value={props.initialSelected}
            onChange={(e) => props.onChangeSelected(e.target.value)}
        >
            {props.items.map((item: string) => (
                <option key={item} value={item}>{item}</option>
            ))}
        </select>
    ),
    DropdownSelectType: {
        SingleString: 'single-string'
    }
}))

jest.mock('@/app/components/targeting/sampling_rate_input', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="sampling-rate-input">
            <input
                type="number"
                value={props.value}
                onChange={(e) => props.onChange(Number(e.target.value))}
                disabled={props.disabled}
            />
        </div>
    )
}))

jest.mock('@/app/components/danger_confirmation_dialog', () => ({
    __esModule: true,
    default: (props: any) => {
        if (!props.open) return null

        return (
            <div data-testid="danger-confirmation-dialog">
                <p>{props.body}</p>
                <button
                    data-testid="dialog-affirmative"
                    onClick={props.onAffirmativeAction}
                >
                    {props.affirmativeText}
                </button>
                <button
                    data-testid="dialog-cancel"
                    onClick={props.onCancelAction}
                >
                    {props.cancelText}
                </button>
            </div>
        )
    }
}))

jest.mock('@/app/components/targeting/attribute_builder', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid={`attribute-builder-${props.attribute.id}`}>
            <span>Attribute: {props.attribute.key}</span>
            <button onClick={() => props.onDelete(props.attribute.id)}>Delete</button>
        </div>
    )
}))

jest.mock('@/app/components/targeting/trace_name_operator_input', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="trace-name-operator-input">
            <input
                type="text"
                placeholder={props.placeholder}
                value={props.value}
                onChange={(e) => props.onValueChange(e.target.value)}
            />
            <select
                value={props.operator}
                onChange={(e) => props.onOperatorChange(e.target.value)}
            >
                {props.availableOperators.map((op: string) => (
                    <option key={op} value={op}>{op}</option>
                ))}
            </select>
        </div>
    )
}))

describe('Basic Rendering', () => {
    it('renders heading and save button for create mode', async () => {
        await act(async () => {
            render(
                <RuleBuilder
                    type="event"
                    mode="create"
                    appId="test-app-id"
                    onCancel={onCancelMock}
                    onSave={onSaveMock}
                    onDelete={onDeleteMock}
                />
            )
        })

        await waitFor(() => {
            expect(screen.getByText('When')).toBeInTheDocument()
            expect(screen.getByText('Then')).toBeInTheDocument()
            expect(screen.getByText('Rule Name')).toBeInTheDocument()
        })

        expect(screen.getByText('Create Event Rule')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Publish Rule/i })).toBeEnabled()
    })

    it('renders heading and save button for edit mode', async () => {
        await act(async () => {
            render(
                <RuleBuilder
                    type="event"
                    mode="edit"
                    appId="test-app-id"
                    ruleId="rule-1"
                    onCancel={onCancelMock}
                    onSave={onSaveMock}
                    onDelete={onDeleteMock}
                />
            )
        })

        await waitFor(() => {
            expect(screen.getByText('When')).toBeInTheDocument()
            expect(screen.getByText('Then')).toBeInTheDocument()
        })

        expect(screen.getByText('Edit Event Rule')).toBeInTheDocument()

        const saveButton = screen.getByRole('button', { name: /Save Changes/i })
        expect(saveButton).toBeInTheDocument()
    })

    it('shows loading spinner while fetching data', async () => {
        render(
            <RuleBuilder
                type="event"
                mode="create"
                appId="test-app-id"
                onCancel={onCancelMock}
                onSave={onSaveMock}
                onDelete={onDeleteMock}
            />
        )

        // Check loading state immediately
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
        expect(screen.queryByText('When')).not.toBeInTheDocument()

        // cleanup to avoid warnings
        await waitFor(() => {
            expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
        })
    })

    it('shows error message when data fetch fails', async () => {
        const { fetchEventTargetingConfigFromServer } = require('@/app/api/api_calls')
        fetchEventTargetingConfigFromServer.mockImplementationOnce(() => Promise.resolve(null))

        await act(async () => {
            render(
                <RuleBuilder
                    type="event"
                    mode="create"
                    appId="test-app-id"
                    onCancel={onCancelMock}
                    onSave={onSaveMock}
                    onDelete={onDeleteMock}
                />
            )
        })

        await waitFor(() => {
            expect(screen.getByText(/Error loading rule/)).toBeInTheDocument()
        })

        expect(screen.getByText('Retry')).toBeInTheDocument()
        expect(screen.getByText('Go Back')).toBeInTheDocument()
        expect(screen.queryByText('When')).not.toBeInTheDocument()
    })

    describe('Event Rules', () => {
        it('renders event type selector and "When" section for event rules', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            expect(screen.getByText('Event of type')).toBeInTheDocument()
            expect(screen.getByText('occurs')).toBeInTheDocument()

            const eventTypeDropdown = screen.getByTestId('dropdown-Select event type')
            expect(eventTypeDropdown).toBeInTheDocument()
            expect(eventTypeDropdown).toHaveValue('click')
        })

        it('displays loaded event rule data correctly in edit mode', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="edit"
                        appId="test-app-id"
                        ruleId="rule-1"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            const ruleNameInput = screen.getByPlaceholderText('Enter a rule name')
            expect(ruleNameInput).toHaveValue('Test Event Rule')

            const eventTypeDropdown = screen.getByTestId('dropdown-Select event type')
            expect(eventTypeDropdown).toHaveValue('click')

            // Check sampling rate is loaded
            const samplingRateInput = screen.getByTestId('sampling-rate-input').querySelector('input')
            expect(samplingRateInput).toHaveValue(100)
        })

        it('allows changing event type', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            const eventTypeDropdown = screen.getByTestId('dropdown-Select event type')
            expect(eventTypeDropdown).toHaveValue('click')

            await act(async () => {
                fireEvent.change(eventTypeDropdown, { target: { value: 'http' } })
            })

            expect(eventTypeDropdown).toHaveValue('http')
        })

        it('adds new attribute when "Add Filter" is clicked', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            expect(screen.queryByTestId(/^attribute-builder-/)).not.toBeInTheDocument()

            const addFilterButton = screen.getAllByText('Add Filter')[0]
            await act(async () => {
                fireEvent.click(addFilterButton)
            })

            expect(screen.getByTestId(/^attribute-builder-/)).toBeInTheDocument()
        })

        it('removes attribute when delete is clicked', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            // Add an attribute
            const addFilterButton = screen.getAllByText('Add Filter')[0]
            await act(async () => {
                fireEvent.click(addFilterButton)
            })

            const attributeBuilder = screen.getByTestId(/^attribute-builder-/)
            expect(attributeBuilder).toBeInTheDocument()

            // Delete the attribute
            const deleteButton = within(attributeBuilder).getByText('Delete')
            await act(async () => {
                fireEvent.click(deleteButton)
            })

            expect(screen.queryByTestId(/^attribute-builder-/)).not.toBeInTheDocument()
        })

        it('renders collection mode options with sampling rate', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('Then')).toBeInTheDocument()
            })

            // Check collection mode options
            expect(screen.getByText('Collect with timeline only')).toBeInTheDocument()
            expect(screen.getByText('Do not collect')).toBeInTheDocument()

            // Check sampling rate input
            expect(screen.getByTestId('sampling-rate-input')).toBeInTheDocument()
        })

        it('renders attachment options for event rules', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('Then')).toBeInTheDocument()
            })

            expect(screen.getByText('Take layout snapshot')).toBeInTheDocument()
            expect(screen.getByText('Take screenshot')).toBeInTheDocument()
            expect(screen.getByText('No attachments')).toBeInTheDocument()
        })

        it('disables attachment options when collection mode is disabled', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('Then')).toBeInTheDocument()
            })

            // Select "Do not collect" mode
            const doNotCollectRadio = screen.getByLabelText('Do not collect')
            await act(async () => {
                fireEvent.click(doNotCollectRadio)
            })

            // Check that attachment radios are disabled
            const layoutSnapshotRadio = screen.getByLabelText('Take layout snapshot')
            const screenshotRadio = screen.getByLabelText('Take screenshot')

            expect(layoutSnapshotRadio).toBeDisabled()
            expect(screenshotRadio).toBeDisabled()
        })
    })

    describe('Trace Rules', () => {
        it('renders trace name input and operator selector for trace rules', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="trace"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            expect(screen.getByText('Trace with name')).toBeInTheDocument()
            expect(screen.getByText('ends')).toBeInTheDocument()
            expect(screen.getByTestId('trace-name-operator-input')).toBeInTheDocument()
        })

        it('displays loaded trace rule data correctly in edit mode', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="trace"
                        mode="edit"
                        appId="test-app-id"
                        ruleId="trace-rule-1"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            const ruleNameInput = screen.getByPlaceholderText('Enter a rule name')
            expect(ruleNameInput).toHaveValue('Test Trace Rule')

            const traceNameInput = screen.getByTestId('trace-name-operator-input').querySelector('input')
            expect(traceNameInput).toHaveValue('api_call')

            // Check sampling rate is loaded
            const samplingRateInput = screen.getByTestId('sampling-rate-input').querySelector('input')
            expect(samplingRateInput).toHaveValue(50)
        })

        it('allows changing trace name and operator', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="trace"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            const traceOperatorInput = screen.getByTestId('trace-name-operator-input')
            const nameInput = traceOperatorInput.querySelector('input[type="text"]')
            const operatorSelect = traceOperatorInput.querySelector('select')

            await act(async () => {
                fireEvent.change(nameInput!, { target: { value: 'load-data' } })
            })

            expect(nameInput).toHaveValue('load-data')

            await act(async () => {
                fireEvent.change(operatorSelect!, { target: { value: 'contains' } })
            })

            expect(operatorSelect).toHaveValue('contains')
        })

        it('adds new trace attribute when "Add Filter" is clicked', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="trace"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            expect(screen.queryByTestId(/^attribute-builder-/)).not.toBeInTheDocument()

            const addFilterButton = screen.getAllByText('Add Filter')[0]
            await act(async () => {
                fireEvent.click(addFilterButton)
            })

            expect(screen.getByTestId(/^attribute-builder-/)).toBeInTheDocument()
        })

        it('renders trace rule heading in create mode', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="trace"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            expect(screen.getByText('Create Trace Rule')).toBeInTheDocument()
        })

        it('renders trace rule heading in edit mode', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="trace"
                        mode="edit"
                        appId="test-app-id"
                        ruleId="trace-rule-1"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            expect(screen.getByText('Edit Trace Rule')).toBeInTheDocument()
        })
    })

    describe('Timeline Rules', () => {
        it('renders condition type selector for timeline rules', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="timeline"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText(/When Session contains/)).toBeInTheDocument()
            })

            expect(screen.getByText('Create Session Timeline Rule')).toBeInTheDocument()
            const conditionTypeDropdown = screen.getByTestId('dropdown-Select condition type')
            expect(conditionTypeDropdown).toBeInTheDocument()
        })

        it('switches between event and trace conditions', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="timeline"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText(/When Session contains/)).toBeInTheDocument()
            })

            const conditionTypeDropdown = screen.getByTestId('dropdown-Select condition type')
            expect(conditionTypeDropdown).toHaveValue('event')

            // Should show event type dropdown
            expect(screen.getByText('with type')).toBeInTheDocument()
            expect(screen.getByTestId('dropdown-Select event type')).toBeInTheDocument()

            // Switch to trace
            await act(async () => {
                fireEvent.change(conditionTypeDropdown, { target: { value: 'trace' } })
            })

            expect(conditionTypeDropdown).toHaveValue('trace')

            // Should show trace name input
            expect(screen.getByText('with name')).toBeInTheDocument()
            expect(screen.getByTestId('trace-name-operator-input')).toBeInTheDocument()
        })

        it('displays event fields when condition type is event', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="timeline"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText(/When Session contains/)).toBeInTheDocument()
            })

            expect(screen.getByText('with type')).toBeInTheDocument()
            expect(screen.getByTestId('dropdown-Select event type')).toBeInTheDocument()
            expect(screen.queryByTestId('trace-name-operator-input')).not.toBeInTheDocument()
        })

        it('displays trace fields when condition type is trace', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="timeline"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText(/When Session contains/)).toBeInTheDocument()
            })

            const conditionTypeDropdown = screen.getByTestId('dropdown-Select condition type')

            await act(async () => {
                fireEvent.change(conditionTypeDropdown, { target: { value: 'trace' } })
            })

            expect(screen.getByText('with name')).toBeInTheDocument()
            expect(screen.getByTestId('trace-name-operator-input')).toBeInTheDocument()
            expect(screen.queryByTestId('dropdown-Select event type')).not.toBeInTheDocument()
        })

        it('renders sampling rate input as the only collection option', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="timeline"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('Then')).toBeInTheDocument()
            })

            // Should have sampling rate
            expect(screen.getByTestId('sampling-rate-input')).toBeInTheDocument()

            // Should NOT have collection mode options
            expect(screen.queryByText('Collect with timeline only')).not.toBeInTheDocument()
            expect(screen.queryByText('Do not collect')).not.toBeInTheDocument()
        })

        it('displays loaded timeline rule data correctly in edit mode', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="timeline"
                        mode="edit"
                        appId="test-app-id"
                        ruleId="session-rule-1"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText(/When Session contains/)).toBeInTheDocument()
            })

            const ruleNameInput = screen.getByPlaceholderText('Enter a rule name')
            expect(ruleNameInput).toHaveValue('Test Session Rule')

            const conditionTypeDropdown = screen.getByTestId('dropdown-Select condition type')
            expect(conditionTypeDropdown).toHaveValue('event')

            const eventTypeDropdown = screen.getByTestId('dropdown-Select event type')
            expect(eventTypeDropdown).toHaveValue('click')

            const samplingRateInput = screen.getByTestId('sampling-rate-input').querySelector('input')
            expect(samplingRateInput).toHaveValue(100)
        })

        it('renders timeline rule heading in edit mode', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="timeline"
                        mode="edit"
                        appId="test-app-id"
                        ruleId="session-rule-1"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText(/When Session contains/)).toBeInTheDocument()
            })

            expect(screen.getByText('Edit Session Timeline Rule')).toBeInTheDocument()
        })
    })

    describe('Save Rule', () => {
        it('disables save button when no changes are made in edit mode', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="edit"
                        appId="test-app-id"
                        ruleId="rule-1"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            const saveButton = screen.getByRole('button', { name: /Save Changes/i })
            expect(saveButton).toBeDisabled()
        })

        it('enables save button when changes are made in edit mode', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="edit"
                        appId="test-app-id"
                        ruleId="rule-1"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            const saveButton = screen.getByRole('button', { name: /Save Changes/i })
            expect(saveButton).toBeDisabled()

            // Make a change to the rule name
            const ruleNameInput = screen.getByPlaceholderText('Enter a rule name')
            await act(async () => {
                fireEvent.change(ruleNameInput, { target: { value: 'Updated Rule Name' } })
            })

            expect(saveButton).toBeEnabled()
        })

        it('enables save button in create mode', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            const saveButton = screen.getByRole('button', { name: /Publish Rule/i })
            expect(saveButton).toBeEnabled()
        })

        it('shows validation error when rule name is empty', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            const saveButton = screen.getByRole('button', { name: /Publish Rule/i })

            await act(async () => {
                fireEvent.click(saveButton)
            })

            const { toastNegative } = require('@/app/utils/use_toast')
            expect(toastNegative).toHaveBeenCalledWith('Please enter a rule name')

            // Check that the error styling is applied
            const ruleNameInput = screen.getByPlaceholderText('Enter a rule name')
            expect(ruleNameInput).toHaveClass('border-red-500')

            expect(screen.getByText('Rule name is required')).toBeInTheDocument()
        })

        it('calls onSave callback after successful save in create mode', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            // Enter a rule name
            const ruleNameInput = screen.getByPlaceholderText('Enter a rule name')
            await act(async () => {
                fireEvent.change(ruleNameInput, { target: { value: 'My New Rule' } })
            })

            const saveButton = screen.getByRole('button', { name: /Publish Rule/i })

            await act(async () => {
                fireEvent.click(saveButton)
            })

            await waitFor(() => {
                expect(onSaveMock).toHaveBeenCalled()
            })

            const { toastPositive } = require('@/app/utils/use_toast')
            expect(toastPositive).toHaveBeenCalledWith('Successfully created rule')
        })

        it('calls onSave callback after successful save in edit mode', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="edit"
                        appId="test-app-id"
                        ruleId="rule-1"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            // Make a change
            const ruleNameInput = screen.getByPlaceholderText('Enter a rule name')
            await act(async () => {
                fireEvent.change(ruleNameInput, { target: { value: 'Updated Rule' } })
            })

            const saveButton = screen.getByRole('button', { name: /Save Changes/i })

            await act(async () => {
                fireEvent.click(saveButton)
            })

            await waitFor(() => {
                expect(onSaveMock).toHaveBeenCalled()
            })

            const { toastPositive } = require('@/app/utils/use_toast')
            expect(toastPositive).toHaveBeenCalledWith('Successfully updated rule')
        })

        it('shows error toast when save fails', async () => {
            const { createEventTargetingRule } = require('@/app/api/api_calls')
            createEventTargetingRule.mockImplementationOnce(() =>
                Promise.resolve({ status: 'error' })
            )

            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            // Enter a rule name
            const ruleNameInput = screen.getByPlaceholderText('Enter a rule name')
            await act(async () => {
                fireEvent.change(ruleNameInput, { target: { value: 'My New Rule' } })
            })

            const saveButton = screen.getByRole('button', { name: /Publish Rule/i })

            await act(async () => {
                fireEvent.click(saveButton)
            })

            await waitFor(() => {
                const { toastNegative } = require('@/app/utils/use_toast')
                expect(toastNegative).toHaveBeenCalledWith('Failed to save rule, please try again later')
            })

            expect(onSaveMock).not.toHaveBeenCalled()
        })

        it('shows loading state on save button while saving', async () => {
            // Create a promise we can control
            let resolveSave: any
            const savePromise = new Promise(resolve => {
                resolveSave = resolve
            })

            const { createEventTargetingRule } = require('@/app/api/api_calls')
            createEventTargetingRule.mockImplementationOnce(() => savePromise)

            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            // Enter a rule name
            const ruleNameInput = screen.getByPlaceholderText('Enter a rule name')
            await act(async () => {
                fireEvent.change(ruleNameInput, { target: { value: 'My New Rule' } })
            })

            const saveButton = screen.getByRole('button', { name: /Publish Rule/i })
            expect(saveButton).toBeEnabled()

            await act(async () => {
                fireEvent.click(saveButton)
            })

            // The button should be disabled while saving
            await waitFor(() => {
                expect(saveButton).toBeDisabled()
            })

            // Resolve the save
            await act(async () => {
                resolveSave({ status: 'success' })
            })

            await waitFor(() => {
                expect(onSaveMock).toHaveBeenCalled()
            })
        })
    })

    describe('Delete Rule', () => {
        it('shows delete button only in edit mode', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="edit"
                        appId="test-app-id"
                        ruleId="rule-1"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            expect(screen.getByRole('button', { name: /Delete Rule/i })).toBeInTheDocument()
        })

        it('does not show delete button in create mode', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            expect(screen.queryByRole('button', { name: /Delete Rule/i })).not.toBeInTheDocument()
        })

        it('opens confirmation dialog when delete button is clicked', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="edit"
                        appId="test-app-id"
                        ruleId="rule-1"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            expect(screen.queryByTestId('danger-confirmation-dialog')).not.toBeInTheDocument()

            const deleteButton = screen.getByRole('button', { name: /Delete Rule/i })
            await act(async () => {
                fireEvent.click(deleteButton)
            })

            await waitFor(() => {
                expect(screen.getByTestId('danger-confirmation-dialog')).toBeInTheDocument()
            })

            expect(screen.getByText(/Do you want to delete this rule/)).toBeInTheDocument()
        })

        it('closes confirmation dialog when cancel is clicked', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="edit"
                        appId="test-app-id"
                        ruleId="rule-1"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            const deleteButton = screen.getByRole('button', { name: /Delete Rule/i })
            await act(async () => {
                fireEvent.click(deleteButton)
            })

            await waitFor(() => {
                expect(screen.getByTestId('danger-confirmation-dialog')).toBeInTheDocument()
            })

            const cancelButton = screen.getByTestId('dialog-cancel')
            await act(async () => {
                fireEvent.click(cancelButton)
            })

            await waitFor(() => {
                expect(screen.queryByTestId('danger-confirmation-dialog')).not.toBeInTheDocument()
            })
        })

        it('calls onDelete callback after successful deletion for event rules', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="edit"
                        appId="test-app-id"
                        ruleId="rule-1"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            const deleteButton = screen.getByRole('button', { name: /Delete Rule/i })
            await act(async () => {
                fireEvent.click(deleteButton)
            })

            await waitFor(() => {
                expect(screen.getByTestId('danger-confirmation-dialog')).toBeInTheDocument()
            })

            const confirmButton = screen.getByTestId('dialog-affirmative')
            await act(async () => {
                fireEvent.click(confirmButton)
            })

            await waitFor(() => {
                expect(onDeleteMock).toHaveBeenCalled()
            })

            const { toastPositive } = require('@/app/utils/use_toast')
            expect(toastPositive).toHaveBeenCalledWith('Event rule deleted successfully')
        })

        it('calls onDelete callback after successful deletion for trace rules', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="trace"
                        mode="edit"
                        appId="test-app-id"
                        ruleId="trace-rule-1"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            const deleteButton = screen.getByRole('button', { name: /Delete Rule/i })
            await act(async () => {
                fireEvent.click(deleteButton)
            })

            await waitFor(() => {
                expect(screen.getByTestId('danger-confirmation-dialog')).toBeInTheDocument()
            })

            const confirmButton = screen.getByTestId('dialog-affirmative')
            await act(async () => {
                fireEvent.click(confirmButton)
            })

            await waitFor(() => {
                expect(onDeleteMock).toHaveBeenCalled()
            })

            const { toastPositive } = require('@/app/utils/use_toast')
            expect(toastPositive).toHaveBeenCalledWith('Trace rule deleted successfully')
        })

        it('calls onDelete callback after successful deletion for timeline rules', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="timeline"
                        mode="edit"
                        appId="test-app-id"
                        ruleId="session-rule-1"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText(/When Session contains/)).toBeInTheDocument()
            })

            const deleteButton = screen.getByRole('button', { name: /Delete Rule/i })
            await act(async () => {
                fireEvent.click(deleteButton)
            })

            await waitFor(() => {
                expect(screen.getByTestId('danger-confirmation-dialog')).toBeInTheDocument()
            })

            const confirmButton = screen.getByTestId('dialog-affirmative')
            await act(async () => {
                fireEvent.click(confirmButton)
            })

            await waitFor(() => {
                expect(onDeleteMock).toHaveBeenCalled()
            })

            const { toastPositive } = require('@/app/utils/use_toast')
            expect(toastPositive).toHaveBeenCalledWith('Session timeline rule deleted successfully')
        })

        it('shows error toast when deletion fails', async () => {
            const { deleteEventTargetingRule } = require('@/app/api/api_calls')
            deleteEventTargetingRule.mockImplementationOnce(() =>
                Promise.resolve({ status: 'error' })
            )

            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="edit"
                        appId="test-app-id"
                        ruleId="rule-1"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            const deleteButton = screen.getByRole('button', { name: /Delete Rule/i })
            await act(async () => {
                fireEvent.click(deleteButton)
            })

            await waitFor(() => {
                expect(screen.getByTestId('danger-confirmation-dialog')).toBeInTheDocument()
            })

            const confirmButton = screen.getByTestId('dialog-affirmative')
            await act(async () => {
                fireEvent.click(confirmButton)
            })

            await waitFor(() => {
                const { toastNegative } = require('@/app/utils/use_toast')
                expect(toastNegative).toHaveBeenCalledWith('Failed to delete event rule, please try again later')
            })

            expect(onDeleteMock).not.toHaveBeenCalled()
        })
    })

    describe('Cancel Callback', () => {
        it('calls onCancel callback when Go Back button is clicked in error state', async () => {
            const { fetchEventTargetingConfigFromServer } = require('@/app/api/api_calls')
            fetchEventTargetingConfigFromServer.mockImplementationOnce(() => Promise.resolve(null))

            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText(/Error loading rule/)).toBeInTheDocument()
            })

            const goBackButton = screen.getByRole('button', { name: /Go Back/i })
            await act(async () => {
                fireEvent.click(goBackButton)
            })

            expect(onCancelMock).toHaveBeenCalled()
        })

        it('retries data fetch when Retry button is clicked in error state', async () => {
            const { fetchEventTargetingConfigFromServer } = require('@/app/api/api_calls')
            fetchEventTargetingConfigFromServer.mockImplementationOnce(() => Promise.resolve(null))

            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText(/Error loading rule/)).toBeInTheDocument()
            })

            // Mock successful response for retry
            fetchEventTargetingConfigFromServer.mockImplementationOnce(() =>
                Promise.resolve({
                    data: {
                        events: [
                            {
                                type: 'click',
                                attrs: [
                                    {
                                        key: 'target',
                                        type: 'string',
                                        suggestions: null,
                                        hint: 'The target element'
                                    }
                                ],
                                has_ud_attrs: true
                            }
                        ],
                        session_attrs: [],
                        event_ud_attrs: [],
                        operator_types: {
                            string: ['eq', 'neq'],
                            int64: ['eq', 'neq'],
                            float64: ['eq', 'neq'],
                            bool: ['eq', 'neq']
                        }
                    }
                })
            )

            const retryButton = screen.getByRole('button', { name: /Retry/i })
            await act(async () => {
                fireEvent.click(retryButton)
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            expect(screen.queryByText(/Error loading rule/)).not.toBeInTheDocument()
        })
    })

    describe('Attribute Clearing on Type Changes', () => {
        it('clears attributes when event type is changed', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="event"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            // Add an attribute
            const addFilterButton = screen.getAllByText('Add Filter')[0]
            await act(async () => {
                fireEvent.click(addFilterButton)
            })

            expect(screen.getByTestId(/^attribute-builder-/)).toBeInTheDocument()

            // Change event type
            const eventTypeDropdown = screen.getByTestId('dropdown-Select event type')
            await act(async () => {
                fireEvent.change(eventTypeDropdown, { target: { value: 'http' } })
            })

            // Verify attributes are cleared
            expect(screen.queryByTestId(/^attribute-builder-/)).not.toBeInTheDocument()
        })

        it('preserves attributes when trace name or operator is changed', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="trace"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText('When')).toBeInTheDocument()
            })

            // Add an attribute
            const addFilterButton = screen.getAllByText('Add Filter')[0]
            await act(async () => {
                fireEvent.click(addFilterButton)
            })

            expect(screen.getByTestId(/^attribute-builder-/)).toBeInTheDocument()

            // Change trace name
            const traceOperatorInput = screen.getByTestId('trace-name-operator-input')
            const nameInput = traceOperatorInput.querySelector('input[type="text"]')

            await act(async () => {
                fireEvent.change(nameInput!, { target: { value: 'load-data' } })
            })

            // Verify attributes are NOT cleared (trace rules preserve attributes)
            expect(screen.getByTestId(/^attribute-builder-/)).toBeInTheDocument()

            // Change operator
            const operatorSelect = traceOperatorInput.querySelector('select')
            await act(async () => {
                fireEvent.change(operatorSelect!, { target: { value: 'contains' } })
            })

            // Verify attributes are still preserved
            expect(screen.getByTestId(/^attribute-builder-/)).toBeInTheDocument()
        })

        it('clears attributes when session timeline event type is changed', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="timeline"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText(/When Session contains/)).toBeInTheDocument()
            })

            // Verify we're in event mode
            const conditionTypeDropdown = screen.getByTestId('dropdown-Select condition type')
            expect(conditionTypeDropdown).toHaveValue('event')

            // Add an attribute
            const addFilterButton = screen.getAllByText('Add Filter')[0]
            await act(async () => {
                fireEvent.click(addFilterButton)
            })

            expect(screen.getByTestId(/^attribute-builder-/)).toBeInTheDocument()

            // Change event type
            const eventTypeDropdown = screen.getByTestId('dropdown-Select event type')
            await act(async () => {
                fireEvent.change(eventTypeDropdown, { target: { value: 'http' } })
            })

            // Verify attributes are cleared
            expect(screen.queryByTestId(/^attribute-builder-/)).not.toBeInTheDocument()
        })

        it('clears attributes when session timeline switches from event to trace condition', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="timeline"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText(/When Session contains/)).toBeInTheDocument()
            })

            // Start with event condition
            const conditionTypeDropdown = screen.getByTestId('dropdown-Select condition type')
            expect(conditionTypeDropdown).toHaveValue('event')

            // Add an attribute
            const addFilterButton = screen.getAllByText('Add Filter')[0]
            await act(async () => {
                fireEvent.click(addFilterButton)
            })

            expect(screen.getByTestId(/^attribute-builder-/)).toBeInTheDocument()

            // Switch to trace condition
            await act(async () => {
                fireEvent.change(conditionTypeDropdown, { target: { value: 'trace' } })
            })

            // Verify attributes are cleared
            expect(screen.queryByTestId(/^attribute-builder-/)).not.toBeInTheDocument()

            // Verify we're now showing trace inputs
            expect(screen.getByTestId('trace-name-operator-input')).toBeInTheDocument()
        })

        it('clears attributes when session timeline switches from trace to event condition', async () => {
            await act(async () => {
                render(
                    <RuleBuilder
                        type="timeline"
                        mode="create"
                        appId="test-app-id"
                        onCancel={onCancelMock}
                        onSave={onSaveMock}
                        onDelete={onDeleteMock}
                    />
                )
            })

            await waitFor(() => {
                expect(screen.getByText(/When Session contains/)).toBeInTheDocument()
            })

            const conditionTypeDropdown = screen.getByTestId('dropdown-Select condition type')

            // Switch to trace condition first
            await act(async () => {
                fireEvent.change(conditionTypeDropdown, { target: { value: 'trace' } })
            })

            expect(conditionTypeDropdown).toHaveValue('trace')

            // Add an attribute
            const addFilterButton = screen.getAllByText('Add Filter')[0]
            await act(async () => {
                fireEvent.click(addFilterButton)
            })

            expect(screen.getByTestId(/^attribute-builder-/)).toBeInTheDocument()

            // Switch back to event condition
            await act(async () => {
                fireEvent.change(conditionTypeDropdown, { target: { value: 'event' } })
            })

            // Verify attributes are cleared
            expect(screen.queryByTestId(/^attribute-builder-/)).not.toBeInTheDocument()

            // Verify we're now showing event inputs
            expect(screen.getByTestId('dropdown-Select event type')).toBeInTheDocument()
        })
    })
})