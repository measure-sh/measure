import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, describe, it } from '@jest/globals'
import TeamSwitcher, { TeamsSwitcherStatus } from '@/app/components/team_switcher'
import { Team } from '@/app/api/api_calls'

describe('TeamSwitcher', () => {
    it('renders correctly in collapsed state', () => {
        const items = [{ id: '1', name: 'Team 1' }, { id: '2', name: 'Team 2' }, { id: '3', name: 'Team 3' }]

        const container = render(<TeamSwitcher items={items} teamsSwitcherStatus={TeamsSwitcherStatus.Success} onChangeSelectedItem={() => { }} />)

        expect(container).toMatchSnapshot()
    })

    it('renders correctly on passing in initial item index', () => {
        const items = [{ id: '1', name: 'Team 1' }, { id: '2', name: 'Team 2' }, { id: '3', name: 'Team 3' }]

        const container = render(<TeamSwitcher items={items} initialItemIndex={2} teamsSwitcherStatus={TeamsSwitcherStatus.Success} onChangeSelectedItem={() => { }} />)

        expect(container).toMatchSnapshot()
    })

    it('renders correctly in loading state', () => {
        const items = [{ id: '1', name: 'Team 1' }, { id: '2', name: 'Team 2' }, { id: '3', name: 'Team 3' }]

        const container = render(<TeamSwitcher items={items} initialItemIndex={2} teamsSwitcherStatus={TeamsSwitcherStatus.Loading} onChangeSelectedItem={() => { }} />)

        expect(container).toMatchSnapshot()
    })

    it('renders correctly in error state', () => {
        const items = [{ id: '1', name: 'Team 1' }, { id: '2', name: 'Team 2' }, { id: '3', name: 'Team 3' }]

        const container = render(<TeamSwitcher items={items} initialItemIndex={2} teamsSwitcherStatus={TeamsSwitcherStatus.Error} onChangeSelectedItem={() => { }} />)

        expect(container).toMatchSnapshot()
    })

    it('renders correctly in opened state', () => {
        const items = [{ id: '1', name: 'Team 1' }, { id: '2', name: 'Team 2' }, { id: '3', name: 'Team 3' }]

        const container = render(<TeamSwitcher items={items} teamsSwitcherStatus={TeamsSwitcherStatus.Success} onChangeSelectedItem={() => { }} />)

        expect(container).toMatchSnapshot()

        fireEvent.click(screen.getByText('Team 1'))

        expect(container).toMatchSnapshot()
    })

    it('renders correctly on new team selection', () => {
        const items = [{ id: '1', name: 'Team 1' }, { id: '2', name: 'Team 2' }, { id: '3', name: 'Team 3' }]

        const container = render(<TeamSwitcher items={items} teamsSwitcherStatus={TeamsSwitcherStatus.Success} onChangeSelectedItem={() => { }} />)

        expect(container).toMatchSnapshot()

        fireEvent.click(screen.getByText('Team 1'))

        fireEvent.click(screen.getByText('Team 3'))

        expect(container).toMatchSnapshot()
    })

    it('calls listener new team selection', () => {
        const items = [{ id: '1', name: 'Team 1' }, { id: '2', name: 'Team 2' }, { id: '3', name: 'Team 3' }]

        let newSelectedItem = {} as Team
        let onChangeSelectedItem = (item: Team) => newSelectedItem = item

        render(<TeamSwitcher items={items} teamsSwitcherStatus={TeamsSwitcherStatus.Success} onChangeSelectedItem={onChangeSelectedItem} />)

        fireEvent.click(screen.getByText('Team 1'))

        fireEvent.click(screen.getByText('Team 3'))

        expect(newSelectedItem).toStrictEqual({ id: '3', name: 'Team 3' })

    })
})