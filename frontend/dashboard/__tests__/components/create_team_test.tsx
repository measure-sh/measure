import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'

// --- Mocks ---

const mockCreateTeam = jest.fn()
const mockToastPositive = jest.fn()
const mockToastNegative = jest.fn()

jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    CreateTeamApiStatus: { Init: 0, Loading: 1, Success: 2, Error: 3, Cancelled: 4 },
    createTeamFromServer: (...args: any[]) => mockCreateTeam(...args),
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
        beforeEach(() => {
            mockCreateTeam.mockReset()
        })

        it('does not call API when team name is empty', async () => {
            renderCreateTeam()
            openDialog()
            await fillAndSubmit('')
            expect(mockCreateTeam).not.toHaveBeenCalled()
        })

        it('calls createTeamFromServer with team name', async () => {
            mockCreateTeam.mockResolvedValue({ status: 2, data: { id: 'team-1' } })
            renderCreateTeam()
            openDialog()
            await fillAndSubmit('My Team')
            expect(mockCreateTeam).toHaveBeenCalledWith('My Team')
        })

        it('shows loading state while API is in progress', async () => {
            let resolveApi: Function
            mockCreateTeam.mockReturnValue(new Promise(r => { resolveApi = r }))
            renderCreateTeam()
            openDialog()
            await fillAndSubmit('My Team')

            const submitButtons = screen.getAllByText(/Create Team/)
            const submitButton = submitButtons.find(b => b.closest('button')?.getAttribute('type') === 'submit')!
            expect(submitButton.closest('button')).toBeDisabled()

            await act(async () => {
                resolveApi!({ status: 2, data: { id: 'team-1' } })
            })
        })
    })

    describe('Success handling', () => {
        beforeEach(() => {
            mockCreateTeam.mockResolvedValue({ status: 2, data: { id: 'team-new' } })
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
            mockCreateTeam.mockResolvedValue({ status: 3, error: 'Name already taken' })
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
