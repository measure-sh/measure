import AutocompleteInput from '@/app/components/autocomplete_input'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const onValueChangeMock = jest.fn()

describe('AutocompleteInput Component', () => {
    beforeEach(() => {
        onValueChangeMock.mockClear()
    })

    const defaultSuggestions = ['user-123', 'user-456', 'user-789', 'admin-001', 'guest-user']

    it('renders input with placeholder', () => {
        render(
            <AutocompleteInput
                value=""
                suggestions={defaultSuggestions}
                placeholder="Enter a user ID..."
                onValueChange={onValueChangeMock}
            />
        )

        const input = screen.getByRole('combobox')
        expect(input).toBeInTheDocument()
        expect(input).toHaveAttribute('placeholder', 'Enter a user ID...')
    })

    it('renders with initial value', () => {
        render(
            <AutocompleteInput
                value="user-123"
                suggestions={defaultSuggestions}
                onValueChange={onValueChangeMock}
            />
        )

        const input = screen.getByRole('combobox')
        expect(input).toHaveValue('user-123')
    })

    it('shows suggestions when input is focused', async () => {
        render(
            <AutocompleteInput
                value=""
                suggestions={defaultSuggestions}
                onValueChange={onValueChangeMock}
            />
        )

        const input = screen.getByRole('combobox')

        await act(async () => {
            fireEvent.focus(input)
        })

        await waitFor(() => {
            expect(screen.getByRole('listbox')).toBeInTheDocument()
        })

        expect(screen.getByText('user-123')).toBeInTheDocument()
        expect(screen.getByText('user-456')).toBeInTheDocument()
        expect(screen.getByText('admin-001')).toBeInTheDocument()
    })

    it('filters suggestions based on input value', async () => {
        render(
            <AutocompleteInput
                value=""
                suggestions={defaultSuggestions}
                onValueChange={onValueChangeMock}
            />
        )

        const input = screen.getByRole('combobox')

        await act(async () => {
            fireEvent.focus(input)
            fireEvent.change(input, { target: { value: 'admin' } })
        })

        await waitFor(() => {
            expect(screen.getByText('admin-001')).toBeInTheDocument()
        })

        expect(screen.queryByText('user-123')).not.toBeInTheDocument()
        expect(screen.queryByText('guest-user')).not.toBeInTheDocument()
    })

    it('calls onValueChange when typing', async () => {
        render(
            <AutocompleteInput
                value=""
                suggestions={defaultSuggestions}
                onValueChange={onValueChangeMock}
            />
        )

        const input = screen.getByRole('combobox')

        await act(async () => {
            fireEvent.change(input, { target: { value: 'custom-id' } })
        })

        expect(onValueChangeMock).toHaveBeenCalledWith('custom-id')
    })

    it('selects suggestion on click', async () => {
        render(
            <AutocompleteInput
                value=""
                suggestions={defaultSuggestions}
                onValueChange={onValueChangeMock}
            />
        )

        const input = screen.getByRole('combobox')

        await act(async () => {
            fireEvent.focus(input)
        })

        await waitFor(() => {
            expect(screen.getByText('user-456')).toBeInTheDocument()
        })

        await act(async () => {
            fireEvent.mouseDown(screen.getByText('user-456'))
        })

        expect(onValueChangeMock).toHaveBeenCalledWith('user-456')

        await waitFor(() => {
            expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
        })
    })

    it('selects highlighted suggestion on Enter key', async () => {
        render(
            <AutocompleteInput
                value=""
                suggestions={defaultSuggestions}
                onValueChange={onValueChangeMock}
            />
        )

        const input = screen.getByRole('combobox')

        await act(async () => {
            fireEvent.focus(input)
        })

        await waitFor(() => {
            expect(screen.getByRole('listbox')).toBeInTheDocument()
        })

        await act(async () => {
            fireEvent.keyDown(input, { key: 'Enter' })
        })

        expect(onValueChangeMock).toHaveBeenCalledWith('user-123')
    })

    it('closes suggestions on Escape key', async () => {
        render(
            <AutocompleteInput
                value=""
                suggestions={defaultSuggestions}
                onValueChange={onValueChangeMock}
            />
        )

        const input = screen.getByRole('combobox')

        await act(async () => {
            fireEvent.focus(input)
        })

        await waitFor(() => {
            expect(screen.getByRole('listbox')).toBeInTheDocument()
        })

        await act(async () => {
            fireEvent.keyDown(input, { key: 'Escape' })
        })

        await waitFor(() => {
            expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
        })
    })

    it('focuses first suggestion on Tab key', async () => {
        render(
            <AutocompleteInput
                value=""
                suggestions={defaultSuggestions}
                onValueChange={onValueChangeMock}
            />
        )

        const input = screen.getByRole('combobox')

        await act(async () => {
            fireEvent.focus(input)
        })

        await waitFor(() => {
            expect(screen.getByRole('listbox')).toBeInTheDocument()
        })

        const firstOption = screen.getAllByRole('option')[0]

        await act(async () => {
            fireEvent.keyDown(input, { key: 'Tab' })
        })

        await waitFor(() => {
            expect(firstOption).toHaveFocus()
        })
    })

    it('selects suggestion on Space key when suggestion is focused', async () => {
        render(
            <AutocompleteInput
                value=""
                suggestions={defaultSuggestions}
                onValueChange={onValueChangeMock}
            />
        )

        const input = screen.getByRole('combobox')

        await act(async () => {
            fireEvent.focus(input)
        })

        await waitFor(() => {
            expect(screen.getByRole('listbox')).toBeInTheDocument()
        })

        const userOption = screen.getByText('user-456')

        await act(async () => {
            fireEvent.focus(userOption)
        })

        await act(async () => {
            fireEvent.keyDown(userOption, { key: ' ' })
        })

        expect(onValueChangeMock).toHaveBeenCalledWith('user-456')
    })

    it('selects suggestion on Enter key when suggestion is focused', async () => {
        render(
            <AutocompleteInput
                value=""
                suggestions={defaultSuggestions}
                onValueChange={onValueChangeMock}
            />
        )

        const input = screen.getByRole('combobox')

        await act(async () => {
            fireEvent.focus(input)
        })

        await waitFor(() => {
            expect(screen.getByRole('listbox')).toBeInTheDocument()
        })

        const adminOption = screen.getByText('admin-001')

        await act(async () => {
            fireEvent.focus(adminOption)
        })

        await act(async () => {
            fireEvent.keyDown(adminOption, { key: 'Enter' })
        })

        expect(onValueChangeMock).toHaveBeenCalledWith('admin-001')
    })

    it('highlights suggestion on hover', async () => {
        render(
            <AutocompleteInput
                value=""
                suggestions={defaultSuggestions}
                onValueChange={onValueChangeMock}
            />
        )

        const input = screen.getByRole('combobox')

        await act(async () => {
            fireEvent.focus(input)
        })

        await waitFor(() => {
            expect(screen.getByRole('listbox')).toBeInTheDocument()
        })

        const userOption = screen.getByText('user-789')

        await act(async () => {
            fireEvent.mouseEnter(userOption)
        })

        expect(userOption.closest('[role="option"]')).toHaveAttribute('aria-selected', 'true')
    })

    it('does not show suggestions when list is empty', async () => {
        render(
            <AutocompleteInput
                value=""
                suggestions={[]}
                onValueChange={onValueChangeMock}
            />
        )

        const input = screen.getByRole('combobox')

        await act(async () => {
            fireEvent.focus(input)
        })

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('hides suggestions when filtered list is empty', async () => {
        render(
            <AutocompleteInput
                value=""
                suggestions={defaultSuggestions}
                onValueChange={onValueChangeMock}
            />
        )

        const input = screen.getByRole('combobox')

        await act(async () => {
            fireEvent.focus(input)
        })

        await waitFor(() => {
            expect(screen.getByRole('listbox')).toBeInTheDocument()
        })

        await act(async () => {
            fireEvent.change(input, { target: { value: 'nonexistent' } })
        })

        await waitFor(() => {
            expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
        })
    })

    it('shows all suggestions when input value is cleared', async () => {
        render(
            <AutocompleteInput
                value="user"
                suggestions={defaultSuggestions}
                onValueChange={onValueChangeMock}
            />
        )

        const input = screen.getByRole('combobox')

        await act(async () => {
            fireEvent.focus(input)
        })

        // Initially shows filtered suggestions
        await waitFor(() => {
            expect(screen.getByText('user-123')).toBeInTheDocument()
        })

        expect(screen.queryByText('admin-001')).not.toBeInTheDocument()

        // Clear the input
        await act(async () => {
            fireEvent.change(input, { target: { value: '' } })
        })

        // Should show all suggestions
        await waitFor(() => {
            expect(screen.getByText('user-123')).toBeInTheDocument()
            expect(screen.getByText('user-456')).toBeInTheDocument()
            expect(screen.getByText('admin-001')).toBeInTheDocument()
        })
    })

    it('case-insensitive filtering', async () => {
        render(
            <AutocompleteInput
                value=""
                suggestions={defaultSuggestions}
                onValueChange={onValueChangeMock}
            />
        )

        const input = screen.getByRole('combobox')

        await act(async () => {
            fireEvent.focus(input)
            fireEvent.change(input, { target: { value: 'ADMIN' } })
        })

        await waitFor(() => {
            expect(screen.getByText('admin-001')).toBeInTheDocument()
        })

        expect(screen.queryByText('user-123')).not.toBeInTheDocument()
    })

    it('updates value when prop changes', async () => {
        const { rerender } = render(
            <AutocompleteInput
                value="user-123"
                suggestions={defaultSuggestions}
                onValueChange={onValueChangeMock}
            />
        )

        const input = screen.getByRole('combobox')
        expect(input).toHaveValue('user-123')

        rerender(
            <AutocompleteInput
                value="admin-001"
                suggestions={defaultSuggestions}
                onValueChange={onValueChangeMock}
            />
        )

        await waitFor(() => {
            expect(input).toHaveValue('admin-001')
        })
    })

    it('uses default placeholder when not provided', () => {
        render(
            <AutocompleteInput
                value=""
                suggestions={defaultSuggestions}
                onValueChange={onValueChangeMock}
            />
        )

        const input = screen.getByRole('combobox')
        expect(input).toHaveAttribute('placeholder', 'Enter value...')
    })
})