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
    useCreateTeamMutation: () => ({
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
    DialogDescription: ({ children }: any) => <p>{children}</p>,
}))

jest.mock('@/app/components/input', () => ({
    Input: (props: any) => <input {...props} />,
}))

// --- Import ---

import CreateTeam from '@/app/components/create_team'

// --- Helpers ---

function renderCreateTeam(overrides: Partial<{ onSuccess: (teamId: string) => void }> = {}) {
    const props = {
        onSuccess: jest.fn(),
        ...overrides,
    }
    const result = render(<CreateTeam {...props} />)
    return { ...result, props }
}

function openDialog() {
    fireEvent.click(screen.getByText(/Create Team/))
}

async function fillAndSubmit(name: string) {
    fireEvent.change(screen.getByPlaceholderText('Enter team name'), { target: { value: name } })
    await act(async () => {
        fireEvent.submit(screen.getByPlaceholderText('Enter team name').closest('form')!)
    })
}

// ============================================================
// Tests
// ============================================================

describe('CreateTeam', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockIsPending = false
    })

    describe('Rendering', () => {
        it('renders Create Team trigger button', () => {
            renderCreateTeam()
            expect(screen.getByText(/Create Team/)).toBeInTheDocument()
        })

        it('does not show dialog initially', () => {
            renderCreateTeam()
            expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
        })

        it('opens dialog when trigger button is clicked', () => {
            renderCreateTeam()
            openDialog()
            expect(screen.getByTestId('dialog')).toBeInTheDocument()
            expect(screen.getByText('Add new team')).toBeInTheDocument()
        })

        it('renders team name input inside dialog', () => {
            renderCreateTeam()
            openDialog()
            expect(screen.getByPlaceholderText('Enter team name')).toBeInTheDocument()
        })

        it('renders Cancel button inside dialog', () => {
            renderCreateTeam()
            openDialog()
            expect(screen.getByText('Cancel')).toBeInTheDocument()
        })

        it('disables submit button when team name is empty', () => {
            renderCreateTeam()
            openDialog()
            const submitButtons = screen.getAllByText(/Create Team/)
            const submitButton = submitButtons.find(b => b.closest('button')?.getAttribute('type') === 'submit')!
            expect(submitButton.closest('button')).toBeDisabled()
        })
    })

    describe('Form submission', () => {
        it('does not call API when team name is empty', async () => {
            renderCreateTeam()
            openDialog()
            await fillAndSubmit('')
            expect(mockMutateAsync).not.toHaveBeenCalled()
        })

        it('calls createTeam with team name', async () => {
            mockMutateAsync.mockResolvedValue({ id: 'team-1' })
            renderCreateTeam()
            openDialog()
            await fillAndSubmit('My Team')
            expect(mockMutateAsync).toHaveBeenCalledWith({ teamName: 'My Team' })
        })

        it('shows loading state while API is in progress', async () => {
            mockIsPending = true
            renderCreateTeam()
            openDialog()

            // Type a name so the button would normally be enabled
            fireEvent.change(screen.getByPlaceholderText('Enter team name'), { target: { value: 'My Team' } })

            const submitButtons = screen.getAllByText(/Create Team/)
            const submitButton = submitButtons.find(b => b.closest('button')?.getAttribute('type') === 'submit')!
            expect(submitButton.closest('button')).toBeDisabled()
        })
    })

    describe('Success handling', () => {
        beforeEach(() => {
            mockMutateAsync.mockResolvedValue({ id: 'team-new' })
        })

        it('closes dialog on success', async () => {
            renderCreateTeam()
            openDialog()
            await fillAndSubmit('My Team')
            await waitFor(() => {
                expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
            })
        })

        it('shows success toast with team name', async () => {
            renderCreateTeam()
            openDialog()
            await fillAndSubmit('My Team')
            await waitFor(() => {
                expect(mockToastPositive).toHaveBeenCalledWith('Team My Team has been created')
            })
        })

        it('calls onSuccess callback with the created team id', async () => {
            const onSuccess = jest.fn()
            renderCreateTeam({ onSuccess })
            openDialog()
            await fillAndSubmit('My Team')
            await waitFor(() => {
                expect(onSuccess).toHaveBeenCalledWith('team-new')
            })
        })

        it('does not throw when onSuccess is not provided', async () => {
            renderCreateTeam({ onSuccess: undefined })
            openDialog()
            await expect(fillAndSubmit('My Team')).resolves.not.toThrow()
        })

        it('clears the team name input after success', async () => {
            renderCreateTeam()
            openDialog()
            await fillAndSubmit('My Team')
            // Re-open dialog
            openDialog()
            await waitFor(() => {
                const input = screen.getByPlaceholderText('Enter team name') as HTMLInputElement
                expect(input.value).toBe('')
            })
        })
    })

    describe('Error handling', () => {
        beforeEach(() => {
            mockMutateAsync.mockRejectedValue(new Error('Name already taken'))
        })

        it('shows error toast with error message', async () => {
            renderCreateTeam()
            openDialog()
            await fillAndSubmit('My Team')
            await waitFor(() => {
                expect(mockToastNegative).toHaveBeenCalledWith('Error creating team: Name already taken')
            })
        })

        it('does not close dialog on error', async () => {
            renderCreateTeam()
            openDialog()
            await fillAndSubmit('My Team')
            await waitFor(() => {
                expect(mockToastNegative).toHaveBeenCalled()
            })
            expect(screen.getByTestId('dialog')).toBeInTheDocument()
        })

        it('does not call onSuccess on error', async () => {
            const onSuccess = jest.fn()
            renderCreateTeam({ onSuccess })
            openDialog()
            await fillAndSubmit('My Team')
            await waitFor(() => {
                expect(mockToastNegative).toHaveBeenCalled()
            })
            expect(onSuccess).not.toHaveBeenCalled()
        })
    })
})
