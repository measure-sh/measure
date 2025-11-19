import AttributeBuilder from '@/app/components/targeting/attribute_builder'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AttributeField } from '@/app/utils/cel/conditions'

// Mock callbacks
const onUpdateKeyMock = jest.fn()
const onUpdateValueMock = jest.fn()
const onUpdateOperatorMock = jest.fn()
const onDeleteMock = jest.fn()

// Mock DropdownSelect component
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

// Mock AutocompleteInput component
jest.mock('@/app/components/autocomplete_input', () => ({
    __esModule: true,
    default: (props: any) => (
        <input
            data-testid="autocomplete-input"
            type="text"
            value={props.value}
            placeholder={props.placeholder}
            onChange={(e) => props.onValueChange(e.target.value)}
            className={props.className}
        />
    )
}))

describe('AttributeBuilder Component', () => {
    beforeEach(() => {
        onUpdateKeyMock.mockClear()
        onUpdateValueMock.mockClear()
        onUpdateOperatorMock.mockClear()
        onDeleteMock.mockClear()
    })

    const defaultStringAttribute: AttributeField = {
        id: 'attr-1',
        key: 'user_id',
        type: 'string',
        value: 'test-value',
        operator: 'eq',
        source: 'session',
        suggestions: ['user-1', 'user-2'],
        hint: 'Enter a user ID'
    }

    const defaultAttributeKeys = {
        'user_id': 'session',
        'app_version': 'session',
        'device_locale': 'session'
    }

    const defaultOperators = ['eq', 'neq', 'contains']

    it('renders with initial string attribute values', () => {
        render(
            <AttributeBuilder
                attribute={defaultStringAttribute}
                attributeKeys={defaultAttributeKeys}
                operators={defaultOperators}
                onUpdateKey={onUpdateKeyMock}
                onUpdateValue={onUpdateValueMock}
                onUpdateOperator={onUpdateOperatorMock}
                onDelete={onDeleteMock}
                allowDelete={true}
                suggestions={defaultStringAttribute.suggestions}
            />
        )

        expect(screen.getByText('and')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /user_id/i })).toBeInTheDocument()
        expect(screen.getByTestId('dropdown-Condition')).toHaveValue('eq')
        expect(screen.getByTestId('autocomplete-input')).toHaveValue('test-value')
    })

    it('opens attribute key dropdown and shows all available keys', async () => {
        render(
            <AttributeBuilder
                attribute={defaultStringAttribute}
                attributeKeys={defaultAttributeKeys}
                operators={defaultOperators}
                onUpdateKey={onUpdateKeyMock}
                onUpdateValue={onUpdateValueMock}
                onUpdateOperator={onUpdateOperatorMock}
                onDelete={onDeleteMock}
                allowDelete={true}
            />
        )

        const keyButton = screen.getByRole('button', { name: /user_id/i })
        await act(async () => {
            fireEvent.click(keyButton)
        })

        await waitFor(() => {
            expect(screen.getByText('app_version')).toBeInTheDocument()
        })

        expect(screen.getByText('device_locale')).toBeInTheDocument()
    })

    it('changes attribute key when selecting from dropdown', async () => {
        render(
            <AttributeBuilder
                attribute={defaultStringAttribute}
                attributeKeys={defaultAttributeKeys}
                operators={defaultOperators}
                onUpdateKey={onUpdateKeyMock}
                onUpdateValue={onUpdateValueMock}
                onUpdateOperator={onUpdateOperatorMock}
                onDelete={onDeleteMock}
                allowDelete={true}
            />
        )

        const keyButton = screen.getByRole('button', { name: /user_id/i })
        await act(async () => {
            fireEvent.click(keyButton)
        })

        await waitFor(() => {
            expect(screen.getByText('app_version')).toBeInTheDocument()
        })

        const appVersionOption = screen.getByText('app_version')
        await act(async () => {
            fireEvent.click(appVersionOption)
        })

        expect(onUpdateKeyMock).toHaveBeenCalledWith('attr-1', 'app_version', 'session')
    })

    it('searches for attribute keys in dropdown', async () => {
        render(
            <AttributeBuilder
                attribute={defaultStringAttribute}
                attributeKeys={defaultAttributeKeys}
                operators={defaultOperators}
                onUpdateKey={onUpdateKeyMock}
                onUpdateValue={onUpdateValueMock}
                onUpdateOperator={onUpdateOperatorMock}
                onDelete={onDeleteMock}
                allowDelete={true}
            />
        )

        const keyButton = screen.getByRole('button', { name: /user_id/i })
        await act(async () => {
            fireEvent.click(keyButton)
        })

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
        })

        const searchInput = screen.getByPlaceholderText('Search...')
        await act(async () => {
            fireEvent.change(searchInput, { target: { value: 'device' } })
        })

        await waitFor(() => {
            expect(screen.getByText('device_locale')).toBeInTheDocument()
        })

        expect(screen.queryByText('app_version')).not.toBeInTheDocument()
    })

    it('changes operator value', async () => {
        render(
            <AttributeBuilder
                attribute={defaultStringAttribute}
                attributeKeys={defaultAttributeKeys}
                operators={defaultOperators}
                onUpdateKey={onUpdateKeyMock}
                onUpdateValue={onUpdateValueMock}
                onUpdateOperator={onUpdateOperatorMock}
                onDelete={onDeleteMock}
                allowDelete={true}
            />
        )

        const operatorDropdown = screen.getByTestId('dropdown-Condition')
        await act(async () => {
            fireEvent.change(operatorDropdown, { target: { value: 'contains' } })
        })

        expect(onUpdateOperatorMock).toHaveBeenCalledWith('attr-1', 'contains')
    })

    it('changes string value', async () => {
        render(
            <AttributeBuilder
                attribute={defaultStringAttribute}
                attributeKeys={defaultAttributeKeys}
                operators={defaultOperators}
                onUpdateKey={onUpdateKeyMock}
                onUpdateValue={onUpdateValueMock}
                onUpdateOperator={onUpdateOperatorMock}
                onDelete={onDeleteMock}
                allowDelete={true}
            />
        )

        const valueInput = screen.getByTestId('autocomplete-input')
        await act(async () => {
            fireEvent.change(valueInput, { target: { value: 'new-value' } })
        })

        expect(onUpdateValueMock).toHaveBeenCalledWith('attr-1', 'new-value')
    })

    it('handles integer attribute type', async () => {
        const intAttribute: AttributeField = {
            id: 'attr-2',
            key: 'count',
            type: 'int64',
            value: 10,
            operator: 'gt',
            source: 'ud'
        }

        render(
            <AttributeBuilder
                attribute={intAttribute}
                attributeKeys={defaultAttributeKeys}
                operators={['eq', 'neq', 'gt', 'lt']}
                onUpdateKey={onUpdateKeyMock}
                onUpdateValue={onUpdateValueMock}
                onUpdateOperator={onUpdateOperatorMock}
                onDelete={onDeleteMock}
                allowDelete={true}
            />
        )

        const valueInput = screen.getByTestId('autocomplete-input')
        expect(valueInput).toHaveValue('10')

        await act(async () => {
            fireEvent.change(valueInput, { target: { value: '25' } })
        })

        expect(onUpdateValueMock).toHaveBeenCalledWith('attr-2', 25)
    })

    it('handles float attribute type', async () => {
        const floatAttribute: AttributeField = {
            id: 'attr-3',
            key: 'price',
            type: 'float64',
            value: 19.99,
            operator: 'gte',
            source: 'ud'
        }

        render(
            <AttributeBuilder
                attribute={floatAttribute}
                attributeKeys={defaultAttributeKeys}
                operators={['eq', 'neq', 'gt', 'lt', 'gte', 'lte']}
                onUpdateKey={onUpdateKeyMock}
                onUpdateValue={onUpdateValueMock}
                onUpdateOperator={onUpdateOperatorMock}
                onDelete={onDeleteMock}
                allowDelete={true}
            />
        )

        const valueInput = screen.getByTestId('autocomplete-input')
        expect(valueInput).toHaveValue('19.99')

        await act(async () => {
            fireEvent.change(valueInput, { target: { value: '29.99' } })
        })

        expect(onUpdateValueMock).toHaveBeenCalledWith('attr-3', 29.99)
    })

    it('handles boolean attribute type with dropdown', async () => {
        const boolAttribute: AttributeField = {
            id: 'attr-4',
            key: 'is_premium',
            type: 'bool',
            value: true,
            operator: 'eq',
            source: 'ud'
        }

        render(
            <AttributeBuilder
                attribute={boolAttribute}
                attributeKeys={defaultAttributeKeys}
                operators={['eq', 'neq']}
                onUpdateKey={onUpdateKeyMock}
                onUpdateValue={onUpdateValueMock}
                onUpdateOperator={onUpdateOperatorMock}
                onDelete={onDeleteMock}
                allowDelete={true}
            />
        )

        const boolDropdown = screen.getByTestId('dropdown-Value')
        expect(boolDropdown).toHaveValue('true')

        await act(async () => {
            fireEvent.change(boolDropdown, { target: { value: 'false' } })
        })

        expect(onUpdateValueMock).toHaveBeenCalledWith('attr-4', false)
    })

    it('shows delete button when allowDelete is true', () => {
        render(
            <AttributeBuilder
                attribute={defaultStringAttribute}
                attributeKeys={defaultAttributeKeys}
                operators={defaultOperators}
                onUpdateKey={onUpdateKeyMock}
                onUpdateValue={onUpdateValueMock}
                onUpdateOperator={onUpdateOperatorMock}
                onDelete={onDeleteMock}
                allowDelete={true}
            />
        )

        const deleteButton = screen.getByRole('button', { name: '' })
        expect(deleteButton).toBeInTheDocument()
    })

    it('hides delete button when allowDelete is false', () => {
        render(
            <AttributeBuilder
                attribute={defaultStringAttribute}
                attributeKeys={defaultAttributeKeys}
                operators={defaultOperators}
                onUpdateKey={onUpdateKeyMock}
                onUpdateValue={onUpdateValueMock}
                onUpdateOperator={onUpdateOperatorMock}
                allowDelete={false}
            />
        )

        // Should not find delete button with X icon
        const buttons = screen.getAllByRole('button')
        const deleteButton = buttons.find(btn => btn.querySelector('.lucide-x'))
        expect(deleteButton).toBeUndefined()
    })

    it('calls onDelete when delete button is clicked', async () => {
        render(
            <AttributeBuilder
                attribute={defaultStringAttribute}
                attributeKeys={defaultAttributeKeys}
                operators={defaultOperators}
                onUpdateKey={onUpdateKeyMock}
                onUpdateValue={onUpdateValueMock}
                onUpdateOperator={onUpdateOperatorMock}
                onDelete={onDeleteMock}
                allowDelete={true}
            />
        )

        const buttons = screen.getAllByRole('button')
        const deleteButton = buttons.find(btn => btn.querySelector('.lucide-x'))

        await act(async () => {
            fireEvent.click(deleteButton!)
        })

        expect(onDeleteMock).toHaveBeenCalledWith('attr-1')
    })

    it('displays hint as placeholder when provided', () => {
        render(
            <AttributeBuilder
                attribute={defaultStringAttribute}
                attributeKeys={defaultAttributeKeys}
                operators={defaultOperators}
                onUpdateKey={onUpdateKeyMock}
                onUpdateValue={onUpdateValueMock}
                onUpdateOperator={onUpdateOperatorMock}
                onDelete={onDeleteMock}
                allowDelete={true}
            />
        )

        const valueInput = screen.getByPlaceholderText('Enter a user ID')
        expect(valueInput).toBeInTheDocument()
    })

    it('displays default placeholder when no hint provided', () => {
        const attrWithoutHint: AttributeField = {
            ...defaultStringAttribute,
            hint: undefined
        }

        render(
            <AttributeBuilder
                attribute={attrWithoutHint}
                attributeKeys={defaultAttributeKeys}
                operators={defaultOperators}
                onUpdateKey={onUpdateKeyMock}
                onUpdateValue={onUpdateValueMock}
                onUpdateOperator={onUpdateOperatorMock}
                onDelete={onDeleteMock}
                allowDelete={true}
            />
        )

        const valueInput = screen.getByPlaceholderText('Enter text value')
        expect(valueInput).toBeInTheDocument()
    })

    it('shows "No results found" when search has no matches', async () => {
        render(
            <AttributeBuilder
                attribute={defaultStringAttribute}
                attributeKeys={defaultAttributeKeys}
                operators={defaultOperators}
                onUpdateKey={onUpdateKeyMock}
                onUpdateValue={onUpdateValueMock}
                onUpdateOperator={onUpdateOperatorMock}
                onDelete={onDeleteMock}
                allowDelete={true}
            />
        )

        const keyButton = screen.getByRole('button', { name: /user_id/i })
        await act(async () => {
            fireEvent.click(keyButton)
        })

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
        })

        const searchInput = screen.getByPlaceholderText('Search...')
        await act(async () => {
            fireEvent.change(searchInput, { target: { value: 'nonexistent' } })
        })

        await waitFor(() => {
            expect(screen.getByText('No results found')).toBeInTheDocument()
        })
    })
})