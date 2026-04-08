import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

// --- Mocks ---

jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
}))

jest.mock('lucide-react', () => ({
    ChevronsUpDown: ({ className }: any) => <span data-testid="chevrons-icon" className={className} />,
    Circle: ({ className }: any) => <span data-testid="circle-icon" className={className} />,
    CircleCheck: ({ className }: any) => <span data-testid="circle-check-icon" className={className} />,
}))

jest.mock('@/app/components/button', () => ({
    Button: ({ children, onClick, ...props }: any) => (
        <button onClick={onClick} {...props}>{children}</button>
    ),
}))

jest.mock('@/app/components/popover', () => ({
    Popover: ({ children }: any) => <div data-testid="popover">{children}</div>,
    PopoverTrigger: ({ children }: any) => <div data-testid="popover-trigger">{children}</div>,
    PopoverContent: ({ children }: any) => <div data-testid="popover-content">{children}</div>,
}))

jest.mock('@/app/components/command', () => ({
    Command: ({ children }: any) => <div data-testid="command">{children}</div>,
    CommandInput: ({ placeholder, value, onValueChange, ...props }: any) => (
        <input
            data-testid="command-input"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            {...props}
        />
    ),
    CommandEmpty: ({ children }: any) => <div data-testid="command-empty">{children}</div>,
    CommandGroup: ({ children }: any) => <div data-testid="command-group">{children}</div>,
    CommandItem: ({ children, onSelect, onKeyDown, ...props }: any) => (
        <div
            data-testid="command-item"
            onClick={() => onSelect?.()}
            onKeyDown={onKeyDown}
            {...props}
        >
            {children}
        </div>
    ),
}))

// --- Import (after mocks) ---

import UserDefAttrSelector, { UdAttrMatcher } from '@/app/components/user_def_attr_selector'

// --- Helpers ---

type UserDefAttr = { key: string; type: string }

function defaultAttrs(): UserDefAttr[] {
    return [
        { key: 'user_id', type: 'string' },
        { key: 'is_premium', type: 'bool' },
        { key: 'age', type: 'int64' },
        { key: 'score', type: 'float64' },
    ]
}

function defaultOps(): Map<string, string[]> {
    return new Map([
        ['string', ['eq', 'neq', 'contains']],
        ['bool', ['eq']],
        ['int64', ['eq', 'gt', 'lt']],
        ['float64', ['eq', 'gt', 'lt']],
    ])
}

function renderSelector(overrides: Partial<{
    attrs: UserDefAttr[]
    ops: Map<string, string[]>
    initialSelected: UdAttrMatcher[]
    onChangeSelected: (matchers: UdAttrMatcher[]) => void
}> = {}) {
    const props = {
        attrs: defaultAttrs(),
        ops: defaultOps(),
        initialSelected: [] as UdAttrMatcher[],
        onChangeSelected: jest.fn(),
        ...overrides,
    }
    const result = render(<UserDefAttrSelector {...props} />)
    return { ...result, props }
}

function lastCall(fn: jest.Mock): UdAttrMatcher[] {
    const calls = fn.mock.calls
    return calls[calls.length - 1][0]
}

// ============================================================
// Tests
// ============================================================

describe('UserDefAttrSelector', () => {
    // --- Rendering ---

    describe('Rendering', () => {
        it('renders trigger button with label', () => {
            renderSelector()
            expect(screen.getByText('User Defined Attrs')).toBeInTheDocument()
        })

        it('renders all attribute keys', () => {
            renderSelector()
            expect(screen.getByText('user_id')).toBeInTheDocument()
            expect(screen.getByText('is_premium')).toBeInTheDocument()
            expect(screen.getByText('age')).toBeInTheDocument()
            expect(screen.getByText('score')).toBeInTheDocument()
        })

        it('renders type labels for each attribute', () => {
            renderSelector()
            expect(screen.getByText('string')).toBeInTheDocument()
            expect(screen.getByText('bool')).toBeInTheDocument()
            expect(screen.getByText('int64')).toBeInTheDocument()
            expect(screen.getByText('float64')).toBeInTheDocument()
        })

        it('renders operator dropdowns for each attribute', () => {
            renderSelector()
            const items = screen.getAllByTestId('command-item')
            expect(items.length).toBe(4)
            // Each item has at least one select (op dropdown)
            items.forEach(item => {
                expect(item.querySelector('select')).toBeTruthy()
            })
        })

        it('renders Clear button', () => {
            renderSelector()
            expect(screen.getByText('Clear')).toBeInTheDocument()
        })

        it('renders search input', () => {
            renderSelector()
            expect(screen.getByTestId('command-input')).toBeInTheDocument()
        })
    })

    // --- Initial state ---

    describe('Initial state from initialSelected', () => {
        it('pre-selects attrs from initialSelected', () => {
            renderSelector({
                initialSelected: [
                    { key: 'user_id', type: 'string', op: 'eq', value: 'abc' },
                ],
            })
            // Selected attrs show CircleCheck icon
            const checkIcons = screen.getAllByTestId('circle-check-icon')
            expect(checkIcons.length).toBe(1)
        })

        it('uses op from initialSelected instead of default', () => {
            renderSelector({
                initialSelected: [
                    { key: 'user_id', type: 'string', op: 'contains', value: 'test' },
                ],
            })
            // The op dropdown for user_id should show "contains"
            const selects = screen.getAllByRole('combobox')
            const userIdSelect = selects.find(s => (s as HTMLSelectElement).value === 'contains')
            expect(userIdSelect).toBeTruthy()
        })

        it('uses value from initialSelected instead of default', () => {
            renderSelector({
                initialSelected: [
                    { key: 'user_id', type: 'string', op: 'eq', value: 'hello' },
                ],
            })
            const textInput = screen.getByDisplayValue('hello')
            expect(textInput).toBeInTheDocument()
        })

        it('fires onChangeSelected on mount with initialSelected matchers', () => {
            const onChangeSelected = jest.fn()
            renderSelector({
                initialSelected: [
                    { key: 'user_id', type: 'string', op: 'eq', value: 'abc' },
                ],
                onChangeSelected,
            })
            expect(onChangeSelected).toHaveBeenCalled()
            const matchers = lastCall(onChangeSelected as jest.Mock)
            expect(matchers).toHaveLength(1)
            expect(matchers[0]).toEqual({ key: 'user_id', type: 'string', op: 'eq', value: 'abc' })
        })
    })

    // --- Default values by type ---

    describe('Default values by type', () => {
        it('defaults bool to false', () => {
            renderSelector({ attrs: [{ key: 'flag', type: 'bool' }] })
            const boolSelect = screen.getByDisplayValue('False')
            expect(boolSelect).toBeInTheDocument()
        })

        it('defaults string to empty', () => {
            renderSelector({ attrs: [{ key: 'name', type: 'string' }] })
            const item = screen.getByTestId('command-item')
            const textInput = item.querySelector('input[type="text"]')!
            expect((textInput as HTMLInputElement).value).toBe('')
        })

        it('defaults int64 to 0', () => {
            renderSelector({ attrs: [{ key: 'count', type: 'int64' }] })
            const numInput = screen.getByDisplayValue('0')
            expect(numInput).toBeInTheDocument()
        })

        it('defaults float64 to 0', () => {
            renderSelector({ attrs: [{ key: 'ratio', type: 'float64' }] })
            const numInput = screen.getByDisplayValue('0')
            expect(numInput).toBeInTheDocument()
        })
    })

    // --- Toggle attr selection ---

    describe('Toggle attr selection', () => {
        it('selects an unselected attr on click', () => {
            const onChangeSelected = jest.fn()
            renderSelector({ onChangeSelected })

            // Initially no attrs selected
            expect(screen.queryByTestId('circle-check-icon')).not.toBeInTheDocument()

            // Click first attr
            const items = screen.getAllByTestId('command-item')
            fireEvent.click(items[0]) // user_id

            const matchers = lastCall(onChangeSelected as jest.Mock)
            expect(matchers).toHaveLength(1)
            expect(matchers[0].key).toBe('user_id')
        })

        it('deselects a selected attr on click', () => {
            const onChangeSelected = jest.fn()
            renderSelector({
                initialSelected: [
                    { key: 'user_id', type: 'string', op: 'eq', value: 'abc' },
                ],
                onChangeSelected,
            })

            // Click user_id to deselect
            const items = screen.getAllByTestId('command-item')
            fireEvent.click(items[0])

            const matchers = lastCall(onChangeSelected as jest.Mock)
            expect(matchers).toHaveLength(0)
        })

        it('supports selecting multiple attrs', () => {
            const onChangeSelected = jest.fn()
            renderSelector({ onChangeSelected })

            const items = screen.getAllByTestId('command-item')
            fireEvent.click(items[0]) // user_id
            fireEvent.click(items[1]) // is_premium

            const matchers = lastCall(onChangeSelected as jest.Mock)
            expect(matchers).toHaveLength(2)
            expect(matchers[0].key).toBe('user_id')
            expect(matchers[1].key).toBe('is_premium')
        })

        it('shows Circle icon for unselected attrs and CircleCheck for selected', () => {
            renderSelector({
                initialSelected: [
                    { key: 'user_id', type: 'string', op: 'eq', value: '' },
                ],
            })

            expect(screen.getAllByTestId('circle-check-icon')).toHaveLength(1)
            expect(screen.getAllByTestId('circle-icon')).toHaveLength(3)
        })
    })

    // --- Clear all ---

    describe('Clear all', () => {
        it('clears all selections when Clear button is clicked', () => {
            const onChangeSelected = jest.fn()
            renderSelector({
                initialSelected: [
                    { key: 'user_id', type: 'string', op: 'eq', value: 'abc' },
                    { key: 'age', type: 'int64', op: 'gt', value: 10 },
                ],
                onChangeSelected,
            })

            fireEvent.click(screen.getByText('Clear'))

            const matchers = lastCall(onChangeSelected as jest.Mock)
            expect(matchers).toHaveLength(0)
        })
    })

    // --- Search filtering ---

    describe('Search filtering', () => {
        it('filters attrs by key name', () => {
            renderSelector()

            const searchInput = screen.getByTestId('command-input')
            fireEvent.change(searchInput, { target: { value: 'user' } })

            const items = screen.getAllByTestId('command-item')
            expect(items).toHaveLength(1)
            expect(screen.getByText('user_id')).toBeInTheDocument()
        })

        it('is case-insensitive', () => {
            renderSelector()

            const searchInput = screen.getByTestId('command-input')
            fireEvent.change(searchInput, { target: { value: 'USER' } })

            const items = screen.getAllByTestId('command-item')
            expect(items).toHaveLength(1)
        })

        it('shows all attrs when search is cleared', () => {
            renderSelector()

            const searchInput = screen.getByTestId('command-input')
            fireEvent.change(searchInput, { target: { value: 'user' } })
            expect(screen.getAllByTestId('command-item')).toHaveLength(1)

            fireEvent.change(searchInput, { target: { value: '' } })
            expect(screen.getAllByTestId('command-item')).toHaveLength(4)
        })

        it('shows no items when search has no matches', () => {
            renderSelector()

            const searchInput = screen.getByTestId('command-input')
            fireEvent.change(searchInput, { target: { value: 'nonexistent' } })

            expect(screen.queryAllByTestId('command-item')).toHaveLength(0)
        })
    })

    // --- Operator selection ---

    describe('Operator selection', () => {
        it('renders available ops for each attr type', () => {
            renderSelector({ attrs: [{ key: 'user_id', type: 'string' }] })

            const select = screen.getByRole('combobox')
            const options = Array.from((select as HTMLSelectElement).options)
            expect(options.map(o => o.value)).toEqual(['eq', 'neq', 'contains'])
        })

        it('defaults to first op for each attr type', () => {
            renderSelector({ attrs: [{ key: 'count', type: 'int64' }] })

            const select = screen.getByRole('combobox')
            expect((select as HTMLSelectElement).value).toBe('eq')
        })

        it('fires onChangeSelected with updated op when changed', () => {
            const onChangeSelected = jest.fn()
            renderSelector({
                attrs: [{ key: 'user_id', type: 'string' }],
                initialSelected: [{ key: 'user_id', type: 'string', op: 'eq', value: 'test' }],
                onChangeSelected,
            })

            const select = screen.getByRole('combobox')
            fireEvent.change(select, { target: { value: 'neq' } })

            const matchers = lastCall(onChangeSelected as jest.Mock)
            expect(matchers[0].op).toBe('neq')
        })
    })

    // --- Value input by type ---

    describe('Value input by type', () => {
        it('renders text input for string type', () => {
            renderSelector({ attrs: [{ key: 'name', type: 'string' }] })
            const item = screen.getByTestId('command-item')
            const input = item.querySelector('input[type="text"]')
            expect(input).toBeTruthy()
        })

        it('renders select with True/False for bool type', () => {
            renderSelector({ attrs: [{ key: 'flag', type: 'bool' }] })
            expect(screen.getByText('True')).toBeInTheDocument()
            expect(screen.getByText('False')).toBeInTheDocument()
        })

        it('renders number input with step=1 for int64 type', () => {
            renderSelector({ attrs: [{ key: 'count', type: 'int64' }] })
            const input = screen.getByRole('spinbutton')
            expect(input).toHaveAttribute('type', 'number')
            expect(input).toHaveAttribute('step', '1')
        })

        it('renders number input with step=0.1 for float64 type', () => {
            renderSelector({ attrs: [{ key: 'ratio', type: 'float64' }] })
            const input = screen.getByRole('spinbutton')
            expect(input).toHaveAttribute('type', 'number')
            expect(input).toHaveAttribute('step', '0.1')
        })

        it('fires onChangeSelected with updated string value', () => {
            const onChangeSelected = jest.fn()
            renderSelector({
                attrs: [{ key: 'name', type: 'string' }],
                initialSelected: [{ key: 'name', type: 'string', op: 'eq', value: '' }],
                onChangeSelected,
            })

            const item = screen.getByTestId('command-item')
            const input = item.querySelector('input[type="text"]')!
            fireEvent.change(input, { target: { value: 'hello' } })

            const matchers = lastCall(onChangeSelected as jest.Mock)
            expect(matchers[0].value).toBe('hello')
        })

        it('fires onChangeSelected with updated bool value', () => {
            const onChangeSelected = jest.fn()
            renderSelector({
                attrs: [{ key: 'flag', type: 'bool' }],
                initialSelected: [{ key: 'flag', type: 'bool', op: 'eq', value: false }],
                onChangeSelected,
            })

            // Find the bool select (not the op select)
            const selects = screen.getAllByRole('combobox')
            const boolSelect = selects.find(s =>
                Array.from((s as HTMLSelectElement).options).some(o => o.value === 'true')
            )!
            fireEvent.change(boolSelect, { target: { value: 'true' } })

            const matchers = lastCall(onChangeSelected as jest.Mock)
            expect(matchers[0].value).toBe(true)
        })

        it('fires onChangeSelected with updated int64 value', () => {
            const onChangeSelected = jest.fn()
            renderSelector({
                attrs: [{ key: 'count', type: 'int64' }],
                initialSelected: [{ key: 'count', type: 'int64', op: 'eq', value: 0 }],
                onChangeSelected,
            })

            const input = screen.getByRole('spinbutton')
            fireEvent.change(input, { target: { value: '42' } })

            const matchers = lastCall(onChangeSelected as jest.Mock)
            expect(matchers[0].value).toBe(42)
        })

        it('fires onChangeSelected with updated float64 value', () => {
            const onChangeSelected = jest.fn()
            renderSelector({
                attrs: [{ key: 'ratio', type: 'float64' }],
                initialSelected: [{ key: 'ratio', type: 'float64', op: 'eq', value: 0 }],
                onChangeSelected,
            })

            const input = screen.getByRole('spinbutton')
            fireEvent.change(input, { target: { value: '3.14' } })

            const matchers = lastCall(onChangeSelected as jest.Mock)
            expect(matchers[0].value).toBe(3.14)
        })
    })

    // --- onChangeSelected callback shape ---

    describe('onChangeSelected callback', () => {
        it('returns complete UdAttrMatcher with key, type, op, and value', () => {
            const onChangeSelected = jest.fn()
            renderSelector({
                initialSelected: [
                    { key: 'user_id', type: 'string', op: 'contains', value: 'test' },
                ],
                onChangeSelected,
            })

            const matchers = lastCall(onChangeSelected as jest.Mock)
            expect(matchers[0]).toEqual({
                key: 'user_id',
                type: 'string',
                op: 'contains',
                value: 'test',
            })
        })

        it('does not fire when onChangeSelected is undefined', () => {
            // Should not throw
            expect(() => {
                renderSelector({ onChangeSelected: undefined })
            }).not.toThrow()
        })

        it('preserves values of other attrs when one attr is toggled', () => {
            const onChangeSelected = jest.fn()
            renderSelector({
                initialSelected: [
                    { key: 'user_id', type: 'string', op: 'eq', value: 'abc' },
                ],
                onChangeSelected,
            })

            // Select age too
            const items = screen.getAllByTestId('command-item')
            const ageItem = items.find(i => i.textContent?.includes('age'))!
            fireEvent.click(ageItem)

            const matchers = lastCall(onChangeSelected as jest.Mock)
            expect(matchers).toHaveLength(2)
            // user_id retains its values
            expect(matchers[0]).toEqual({ key: 'user_id', type: 'string', op: 'eq', value: 'abc' })
            // age gets default values
            expect(matchers[1].key).toBe('age')
            expect(matchers[1].op).toBe('eq')
            expect(matchers[1].value).toBe(0)
        })
    })
})
