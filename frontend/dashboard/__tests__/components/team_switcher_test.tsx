import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
}))

jest.mock('lucide-react', () => ({
    ChevronsUpDown: ({ className }: any) => <span data-testid="chevrons-icon" className={className} />,
}))

jest.mock('@/app/components/button', () => ({
    Button: ({ children, onClick, disabled, ...props }: any) => (
        <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
    ),
}))

jest.mock('@/app/components/loading_spinner', () => ({
    __esModule: true,
    default: () => <div data-testid="loading-spinner">Loading...</div>,
}))

jest.mock('@/app/components/dropdown_menu', () => ({
    DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
    DropdownMenuTrigger: ({ children }: any) => <div data-testid="dropdown-trigger">{children}</div>,
    DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
    DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
    DropdownMenuItem: ({ children, onClick }: any) => (
        <div data-testid="dropdown-item" onClick={onClick}>{children}</div>
    ),
}))

jest.mock('@radix-ui/react-dropdown-menu', () => ({
    DropdownMenuSeparator: () => <hr />,
}))

import TeamSwitcher, { TeamsSwitcherStatus } from '@/app/components/team_switcher'

type Team = { id: string; name: string }

function mockTeams(): Team[] {
    return [
        { id: 'team-1', name: 'Alpha Team' },
        { id: 'team-2', name: 'Beta Team' },
        { id: 'team-3', name: 'Gamma Team' },
    ]
}

describe('TeamSwitcher', () => {
    describe('Loading state', () => {
        it('shows loading spinner', () => {
            render(<TeamSwitcher items={null} teamsSwitcherStatus={TeamsSwitcherStatus.Loading} />)
            expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
        })

        it('disables the trigger button', () => {
            render(<TeamSwitcher items={null} teamsSwitcherStatus={TeamsSwitcherStatus.Loading} />)
            expect(screen.getByRole('button')).toBeDisabled()
        })
    })

    describe('Error state', () => {
        it('shows error message', () => {
            render(<TeamSwitcher items={null} teamsSwitcherStatus={TeamsSwitcherStatus.Error} />)
            expect(screen.getByText('Teams Fetch Error')).toBeInTheDocument()
        })

        it('disables the trigger button', () => {
            render(<TeamSwitcher items={null} teamsSwitcherStatus={TeamsSwitcherStatus.Error} />)
            expect(screen.getByRole('button')).toBeDisabled()
        })
    })

    describe('Success state', () => {
        it('shows first team name by default', () => {
            render(<TeamSwitcher items={mockTeams()} teamsSwitcherStatus={TeamsSwitcherStatus.Success} />)
            const trigger = screen.getByTestId('dropdown-trigger')
            expect(trigger.textContent).toContain('Alpha Team')
        })

        it('shows team at initialItemIndex', () => {
            render(<TeamSwitcher items={mockTeams()} initialItemIndex={2} teamsSwitcherStatus={TeamsSwitcherStatus.Success} />)
            const trigger = screen.getByTestId('dropdown-trigger')
            expect(trigger.textContent).toContain('Gamma Team')
        })

        it('enables the trigger button', () => {
            render(<TeamSwitcher items={mockTeams()} teamsSwitcherStatus={TeamsSwitcherStatus.Success} />)
            expect(screen.getByRole('button')).not.toBeDisabled()
        })

        it('renders all teams as menu items', () => {
            render(<TeamSwitcher items={mockTeams()} teamsSwitcherStatus={TeamsSwitcherStatus.Success} />)
            const items = screen.getAllByTestId('dropdown-item')
            expect(items).toHaveLength(3)
        })

        it('renders Select Team label', () => {
            render(<TeamSwitcher items={mockTeams()} teamsSwitcherStatus={TeamsSwitcherStatus.Success} />)
            expect(screen.getByText('Select Team')).toBeInTheDocument()
        })
    })

    describe('Team selection', () => {
        it('calls onChangeSelectedItem when a team is clicked', () => {
            const onChangeSelectedItem = jest.fn()
            render(<TeamSwitcher items={mockTeams()} teamsSwitcherStatus={TeamsSwitcherStatus.Success} onChangeSelectedItem={onChangeSelectedItem} />)

            const items = screen.getAllByTestId('dropdown-item')
            fireEvent.click(items[1]) // Beta Team

            expect(onChangeSelectedItem).toHaveBeenCalledWith({ id: 'team-2', name: 'Beta Team' })
        })

        it('updates displayed team name after selection', () => {
            render(<TeamSwitcher items={mockTeams()} teamsSwitcherStatus={TeamsSwitcherStatus.Success} />)

            const items = screen.getAllByTestId('dropdown-item')
            fireEvent.click(items[1]) // Beta Team

            const trigger = screen.getByTestId('dropdown-trigger')
            expect(trigger.textContent).toContain('Beta Team')
        })

        it('does not throw when onChangeSelectedItem is undefined', () => {
            render(<TeamSwitcher items={mockTeams()} teamsSwitcherStatus={TeamsSwitcherStatus.Success} />)
            const items = screen.getAllByTestId('dropdown-item')
            expect(() => fireEvent.click(items[0])).not.toThrow()
        })
    })
})
