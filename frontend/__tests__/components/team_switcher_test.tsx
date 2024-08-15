import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, describe, it } from '@jest/globals'
import TeamSwitcher, { TeamsSwitcherStatus } from '@/app/components/team_switcher'

describe('TeamSwitcher', () => {
    it('renders correctly in collapsed state', () => {
        const items = ['Team 1', 'Team 2', 'Team 3']

        const container = render(<TeamSwitcher items={items} teamsSwitcherStatus={TeamsSwitcherStatus.Success} onChangeSelectedItem={() => { }} />)

        expect(container).toMatchSnapshot()
    })

    it('renders correctly on passing in initial item index', () => {
        const items = ['Team 1', 'Team 2', 'Team 3']

        const container = render(<TeamSwitcher items={items} initialItemIndex={2} teamsSwitcherStatus={TeamsSwitcherStatus.Success} onChangeSelectedItem={() => { }} />)

        expect(container).toMatchSnapshot()
    })

    it('renders correctly in loading state', () => {
        const items = ['Team 1', 'Team 2', 'Team 3']

        const container = render(<TeamSwitcher items={items} initialItemIndex={2} teamsSwitcherStatus={TeamsSwitcherStatus.Loading} onChangeSelectedItem={() => { }} />)

        expect(container).toMatchSnapshot()
    })

    it('renders correctly in error state', () => {
        const items = ['Team 1', 'Team 2', 'Team 3']

        const container = render(<TeamSwitcher items={items} initialItemIndex={2} teamsSwitcherStatus={TeamsSwitcherStatus.Error} onChangeSelectedItem={() => { }} />)

        expect(container).toMatchSnapshot()
    })

    it('renders correctly in opened state', () => {
        const items = ['Team 1', 'Team 2', 'Team 3']

        const container = render(<TeamSwitcher items={items} teamsSwitcherStatus={TeamsSwitcherStatus.Success} onChangeSelectedItem={() => { }} />)

        expect(container).toMatchSnapshot()

        fireEvent.click(screen.getByText('Team 1'))

        expect(container).toMatchSnapshot()
    })

    it('renders correctly on new team selection', () => {
        const items = ['Team 1', 'Team 2', 'Team 3']

        const container = render(<TeamSwitcher items={items} teamsSwitcherStatus={TeamsSwitcherStatus.Success} onChangeSelectedItem={() => { }} />)

        expect(container).toMatchSnapshot()

        fireEvent.click(screen.getByText('Team 1'))

        fireEvent.click(screen.getByText('Team 3'))

        expect(container).toMatchSnapshot()
    })

    it('calls listener new team selection', () => {
        const items = ['Team 1', 'Team 2', 'Team 3']

        let newSelectedItem = ''
        let onChangeSelectedItem = (item: string) => newSelectedItem = item

        render(<TeamSwitcher items={items} teamsSwitcherStatus={TeamsSwitcherStatus.Success} onChangeSelectedItem={onChangeSelectedItem} />)

        fireEvent.click(screen.getByText('Team 1'))

        fireEvent.click(screen.getByText('Team 3'))

        expect(newSelectedItem).toBe('Team 3')

    })
})