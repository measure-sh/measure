import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

// --- Mocks ---

const mockMutateAsync = jest.fn()
const mockToastPositive = jest.fn()
const mockToastNegative = jest.fn()

let mockIsPending = false

jest.mock('@/app/query/hooks', () => ({
    __esModule: true,
    useCreateAppMutation: () => ({
        mutateAsync: mockMutateAsync,
        isPending: mockIsPending,
    }),
}))

jest.mock('@/app/utils/use_toast', () => ({
    toastPositive: (...args: any[]) => mockToastPositive(...args),
    toastNegative: (...args: any[]) => mockToastNegative(...args),
}))

jest.mock('lucide-react', () => ({
    Plus: () => <span data-testid="plus-icon" />,
}))

jest.mock('@/app/components/button', () => ({
    Button: ({ children, onClick, disabled, loading, ...props }: any) => (
        <button onClick={onClick} disabled={disabled} data-loading={loading} {...props}>
            {children}
        </button>
    ),
}))

jest.mock('@/app/components/dialog', () => ({
    Dialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null,
    DialogContent: ({ children }: any) => <div>{children}</div>,
    DialogHeader: ({ children }: any) => <div>{children}</div>,
    DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}))

jest.mock('@/app/components/input', () => ({
    Input: (props: any) => <input {...props} />,
}))

// --- Import ---

import CreateApp from '@/app/components/create_app'

// --- Helpers ---

function renderCreateApp(overrides: Partial<{ disabled: boolean; teamId: string; onSuccess: (app: any) => void }> = {}) {
    const props = {
        disabled: false,
        teamId: 'team-1',
        onSuccess: jest.fn(),
        ...overrides,
    }
    const result = render(<CreateApp {...props} />)
    return { ...result, props }
}

function openDialog() {
    fireEvent.click(screen.getByText(/Create App/))
}

async function fillAndSubmit(name: string) {
    fireEvent.change(screen.getByPlaceholderText('Enter app name'), { target: { value: name } })
    await act(async () => {
        fireEvent.submit(screen.getByPlaceholderText('Enter app name').closest('form')!)
    })
}

// ============================================================
// Tests
// ============================================================

describe('CreateApp', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockIsPending = false
    })

    describe('Rendering', () => {
        it('renders Create App trigger button', () => {
            renderCreateApp()
            expect(screen.getByText(/Create App/)).toBeInTheDocument()
        })

        it('does not show dialog initially', () => {
            renderCreateApp()
            expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
        })

        it('disables trigger button when disabled prop is true', () => {
            renderCreateApp({ disabled: true })
            expect(screen.getByText(/Create App/).closest('button')).toBeDisabled()
        })

        it('opens dialog when trigger button is clicked', () => {
            renderCreateApp()
            openDialog()
            expect(screen.getByTestId('dialog')).toBeInTheDocument()
            expect(screen.getByText('Add new app')).toBeInTheDocument()
        })

        it('renders app name input inside dialog', () => {
            renderCreateApp()
            openDialog()
            expect(screen.getByPlaceholderText('Enter app name')).toBeInTheDocument()
        })

        it('renders Cancel button inside dialog', () => {
            renderCreateApp()
            openDialog()
            expect(screen.getByText('Cancel')).toBeInTheDocument()
        })

        it('disables submit button when app name is empty', () => {
            renderCreateApp()
            openDialog()
            const submitButtons = screen.getAllByText(/Create App/)
            const submitButton = submitButtons.find(b => b.closest('button')?.getAttribute('type') === 'submit')!
            expect(submitButton.closest('button')).toBeDisabled()
        })
    })

    describe('Form submission', () => {
        it('does not call API when app name is empty', async () => {
            renderCreateApp()
            openDialog()
            await fillAndSubmit('')
            expect(mockMutateAsync).not.toHaveBeenCalled()
        })

        it('calls createApp with teamId and app name', async () => {
            mockMutateAsync.mockResolvedValue({ name: 'My App', id: 'app-1' })
            renderCreateApp({ teamId: 'team-42' })
            openDialog()
            await fillAndSubmit('My App')
            expect(mockMutateAsync).toHaveBeenCalledWith({ teamId: 'team-42', appName: 'My App' })
        })

        it('shows loading state while API is in progress', async () => {
            mockIsPending = true
            renderCreateApp()
            openDialog()

            // Type a name so the button would normally be enabled
            fireEvent.change(screen.getByPlaceholderText('Enter app name'), { target: { value: 'My App' } })

            // Submit button should be disabled because isPending is true
            const submitButtons = screen.getAllByText(/Create App/)
            const submitButton = submitButtons.find(b => b.closest('button')?.getAttribute('type') === 'submit')!
            expect(submitButton.closest('button')).toBeDisabled()
        })
    })

    describe('Success handling', () => {
        beforeEach(() => {
            mockMutateAsync.mockResolvedValue({ name: 'My App', id: 'app-1' })
        })

        it('closes dialog on success', async () => {
            renderCreateApp()
            openDialog()
            await fillAndSubmit('My App')
            await waitFor(() => {
                expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
            })
        })

        it('shows success toast with app name', async () => {
            renderCreateApp()
            openDialog()
            await fillAndSubmit('My App')
            await waitFor(() => {
                expect(mockToastPositive).toHaveBeenCalledWith('App My App has been created')
            })
        })

        it('calls onSuccess callback with the created app', async () => {
            const onSuccess = jest.fn()
            renderCreateApp({ onSuccess })
            openDialog()
            await fillAndSubmit('My App')
            await waitFor(() => {
                expect(onSuccess).toHaveBeenCalledWith({ name: 'My App', id: 'app-1' })
            })
        })

        it('does not throw when onSuccess is not provided', async () => {
            const { props } = renderCreateApp({ onSuccess: undefined })
            openDialog()
            await expect(fillAndSubmit('My App')).resolves.not.toThrow()
        })

        it('clears the app name input after success', async () => {
            renderCreateApp()
            openDialog()
            await fillAndSubmit('My App')
            // Re-open dialog
            openDialog()
            await waitFor(() => {
                // Submit button should be disabled (name is cleared)
                const submitButtons = screen.getAllByText(/Create App/)
                const submitButton = submitButtons.find(b => b.closest('button')?.getAttribute('type') === 'submit')!
                expect(submitButton.closest('button')).toBeDisabled()
            })
        })
    })

    describe('Error handling', () => {
        beforeEach(() => {
            mockMutateAsync.mockRejectedValue(new Error('Name already taken'))
        })

        it('shows error toast with error message', async () => {
            renderCreateApp()
            openDialog()
            await fillAndSubmit('My App')
            await waitFor(() => {
                expect(mockToastNegative).toHaveBeenCalledWith('Error creating app: Name already taken')
            })
        })

        it('does not close dialog on error', async () => {
            renderCreateApp()
            openDialog()
            await fillAndSubmit('My App')
            await waitFor(() => {
                expect(mockToastNegative).toHaveBeenCalled()
            })
            expect(screen.getByTestId('dialog')).toBeInTheDocument()
        })

        it('does not call onSuccess on error', async () => {
            const onSuccess = jest.fn()
            renderCreateApp({ onSuccess })
            openDialog()
            await fillAndSubmit('My App')
            await waitFor(() => {
                expect(mockToastNegative).toHaveBeenCalled()
            })
            expect(onSuccess).not.toHaveBeenCalled()
        })
    })
})
