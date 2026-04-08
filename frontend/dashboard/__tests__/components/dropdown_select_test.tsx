import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

// --- Mocks ---

jest.mock('@/app/api/api_calls', () => ({
    __esModule: true,
    AppVersion: class AppVersion {
        name: string; code: string; displayName: string
        constructor(name: string, code: string) {
            this.name = name; this.code = code; this.displayName = `${name} (${code})`
        }
    },
    OsVersion: class OsVersion {
        name: string; version: string; displayName: string
        constructor(name: string, version: string) {
            this.name = name; this.version = version
            this.displayName = (name === 'android' ? 'Android API Level' : name === 'ios' ? 'iOS' : name) + ' ' + version
        }
    },
}))

jest.mock('lucide-react', () => ({
    Check: ({ className }: any) => <span data-testid="check-icon" className={className} />,
    ChevronsUpDown: ({ className }: any) => <span data-testid="chevrons-icon" className={className} />,
    Circle: ({ className }: any) => <span data-testid="circle-icon" className={className} />,
    CircleCheck: ({ className }: any) => <span data-testid="circle-check-icon" className={className} />,
}))

jest.mock('@/app/components/button', () => ({
    Button: ({ children, onClick, onKeyDown, disabled, ...props }: any) => (
        <button onClick={onClick} onKeyDown={onKeyDown} disabled={disabled} {...props}>
            {children}
        </button>
    ),
}))

jest.mock('@/app/components/popover', () => ({
    Popover: ({ children }: any) => <div data-testid="popover">{children}</div>,
    PopoverTrigger: ({ children, disabled }: any) => (
        <div data-testid="popover-trigger" data-disabled={disabled}>{children}</div>
    ),
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
        <div data-testid="command-item" onClick={() => onSelect?.()} onKeyDown={onKeyDown} {...props}>
            {children}
        </div>
    ),
}))

// --- Import ---

import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select'
import { AppVersion, OsVersion } from '@/app/api/api_calls'

// --- Helpers ---

function av(name: string, code: string): AppVersion {
    return new AppVersion(name, code)
}

function ov(name: string, version: string): OsVersion {
    return new OsVersion(name, version)
}

function getItems() {
    return screen.getAllByTestId('command-item')
}

function clickItem(index: number) {
    fireEvent.click(getItems()[index])
}

function search(text: string) {
    fireEvent.change(screen.getByTestId('command-input'), { target: { value: text } })
}

// ============================================================
// Tests
// ============================================================

describe('DropdownSelect', () => {
    // --- SingleString ---

    describe('SingleString', () => {
        const items = ['Apple', 'Banana', 'Cherry']

        it('renders all items', () => {
            render(
                <DropdownSelect type={DropdownSelectType.SingleString} title="Fruit" items={items} initialSelected="Apple" />
            )
            const renderedItems = getItems()
            expect(renderedItems).toHaveLength(3)
            expect(renderedItems[0].textContent).toContain('Apple')
            expect(renderedItems[1].textContent).toContain('Banana')
            expect(renderedItems[2].textContent).toContain('Cherry')
        })

        it('shows selected item as display text', () => {
            render(
                <DropdownSelect type={DropdownSelectType.SingleString} title="Fruit" items={items} initialSelected="Banana" />
            )
            // The trigger button should show the selected value, not the title
            const trigger = screen.getByTestId('popover-trigger')
            expect(trigger.textContent).toContain('Banana')
        })

        it('shows Check icon only for selected item', () => {
            render(
                <DropdownSelect type={DropdownSelectType.SingleString} title="Fruit" items={items} initialSelected="Apple" />
            )
            expect(screen.getAllByTestId('check-icon')).toHaveLength(1)
        })

        it('does not show Circle/CircleCheck icons', () => {
            render(
                <DropdownSelect type={DropdownSelectType.SingleString} title="Fruit" items={items} initialSelected="Apple" />
            )
            expect(screen.queryByTestId('circle-icon')).not.toBeInTheDocument()
            expect(screen.queryByTestId('circle-check-icon')).not.toBeInTheDocument()
        })

        it('fires onChangeSelected with the clicked item', () => {
            const onChangeSelected = jest.fn()
            render(
                <DropdownSelect type={DropdownSelectType.SingleString} title="Fruit" items={items} initialSelected="Apple" onChangeSelected={onChangeSelected} />
            )
            clickItem(1) // Banana
            expect(onChangeSelected).toHaveBeenCalledWith('Banana')
        })

        it('does not show All/Clear buttons', () => {
            render(
                <DropdownSelect type={DropdownSelectType.SingleString} title="Fruit" items={items} initialSelected="Apple" />
            )
            expect(screen.queryByText('All')).not.toBeInTheDocument()
            expect(screen.queryByText('Clear')).not.toBeInTheDocument()
        })

        it('does not throw when onChangeSelected is undefined', () => {
            render(
                <DropdownSelect type={DropdownSelectType.SingleString} title="Fruit" items={items} initialSelected="Apple" />
            )
            expect(() => clickItem(1)).not.toThrow()
        })
    })

    // --- MultiString ---

    describe('MultiString', () => {
        const items = ['US', 'IN', 'GB']

        it('shows title as display text (not selected items)', () => {
            render(
                <DropdownSelect type={DropdownSelectType.MultiString} title="Country" items={items} initialSelected={['US', 'IN']} />
            )
            const trigger = screen.getByTestId('popover-trigger')
            expect(trigger.textContent).toContain('Country')
        })

        it('shows CircleCheck for selected and Circle for unselected', () => {
            render(
                <DropdownSelect type={DropdownSelectType.MultiString} title="Country" items={items} initialSelected={['US']} />
            )
            expect(screen.getAllByTestId('circle-check-icon')).toHaveLength(1)
            expect(screen.getAllByTestId('circle-icon')).toHaveLength(2)
        })

        it('toggles item on when clicked', () => {
            const onChangeSelected = jest.fn()
            render(
                <DropdownSelect type={DropdownSelectType.MultiString} title="Country" items={items} initialSelected={['US']} onChangeSelected={onChangeSelected} />
            )
            clickItem(1) // IN
            const lastCall = onChangeSelected.mock.calls.slice(-1)[0][0]
            expect(lastCall).toContain('IN')
            expect(lastCall).toContain('US')
        })

        it('toggles item off when clicked again', () => {
            const onChangeSelected = jest.fn()
            render(
                <DropdownSelect type={DropdownSelectType.MultiString} title="Country" items={items} initialSelected={['US', 'IN']} onChangeSelected={onChangeSelected} />
            )
            clickItem(0) // US (deselect)
            const lastCall = onChangeSelected.mock.calls.slice(-1)[0][0]
            expect(lastCall).not.toContain('US')
            expect(lastCall).toContain('IN')
        })

        it('allows deselecting all items', () => {
            const onChangeSelected = jest.fn()
            render(
                <DropdownSelect type={DropdownSelectType.MultiString} title="Country" items={items} initialSelected={['US']} onChangeSelected={onChangeSelected} />
            )
            clickItem(0) // deselect US
            const lastCall = onChangeSelected.mock.calls.slice(-1)[0][0]
            expect(lastCall).toHaveLength(0)
        })

        it('shows All and Clear buttons', () => {
            render(
                <DropdownSelect type={DropdownSelectType.MultiString} title="Country" items={items} initialSelected={[]} />
            )
            expect(screen.getByText('All')).toBeInTheDocument()
            expect(screen.getByText('Clear')).toBeInTheDocument()
        })

        it('does not show All/Clear buttons when only 1 item', () => {
            render(
                <DropdownSelect type={DropdownSelectType.MultiString} title="Country" items={['US']} initialSelected={[]} />
            )
            expect(screen.queryByText('All')).not.toBeInTheDocument()
            expect(screen.queryByText('Clear')).not.toBeInTheDocument()
        })

        it('selects all items when All is clicked', () => {
            const onChangeSelected = jest.fn()
            render(
                <DropdownSelect type={DropdownSelectType.MultiString} title="Country" items={items} initialSelected={['US']} onChangeSelected={onChangeSelected} />
            )
            fireEvent.click(screen.getByText('All'))
            const lastCall = onChangeSelected.mock.calls.slice(-1)[0][0]
            expect(lastCall).toEqual(['US', 'IN', 'GB'])
        })

        it('clears all items when Clear is clicked', () => {
            const onChangeSelected = jest.fn()
            render(
                <DropdownSelect type={DropdownSelectType.MultiString} title="Country" items={items} initialSelected={['US', 'IN']} onChangeSelected={onChangeSelected} />
            )
            fireEvent.click(screen.getByText('Clear'))
            const lastCall = onChangeSelected.mock.calls.slice(-1)[0][0]
            expect(lastCall).toEqual([])
        })
    })

    // --- MultiAppVersion ---

    describe('MultiAppVersion', () => {
        const versions = [av('1.0', '1'), av('2.0', '2'), av('3.0', '10')]

        it('renders version displayNames', () => {
            render(
                <DropdownSelect type={DropdownSelectType.MultiAppVersion} title="App versions" items={versions} initialSelected={versions} />
            )
            expect(screen.getByText('1.0 (1)')).toBeInTheDocument()
            expect(screen.getByText('2.0 (2)')).toBeInTheDocument()
            expect(screen.getByText('3.0 (10)')).toBeInTheDocument()
        })

        it('shows All and Latest buttons (not Clear)', () => {
            render(
                <DropdownSelect type={DropdownSelectType.MultiAppVersion} title="App versions" items={versions} initialSelected={versions} />
            )
            expect(screen.getByText('All')).toBeInTheDocument()
            expect(screen.getByText('Latest')).toBeInTheDocument()
            expect(screen.queryByText('Clear')).not.toBeInTheDocument()
        })

        it('toggles version on when clicked', () => {
            const onChangeSelected = jest.fn()
            render(
                <DropdownSelect type={DropdownSelectType.MultiAppVersion} title="App versions" items={versions} initialSelected={[versions[0]]} onChangeSelected={onChangeSelected} />
            )
            clickItem(1) // 2.0
            const lastCall = onChangeSelected.mock.calls.slice(-1)[0][0]
            expect(lastCall).toHaveLength(2)
        })

        it('prevents deselecting the last remaining version', () => {
            const onChangeSelected = jest.fn()
            render(
                <DropdownSelect type={DropdownSelectType.MultiAppVersion} title="App versions" items={versions} initialSelected={[versions[0]]} onChangeSelected={onChangeSelected} />
            )
            clickItem(0) // try to deselect 1.0 (only one selected)
            expect(onChangeSelected).not.toHaveBeenCalled()
        })

        it('allows deselecting when multiple versions are selected', () => {
            const onChangeSelected = jest.fn()
            render(
                <DropdownSelect type={DropdownSelectType.MultiAppVersion} title="App versions" items={versions} initialSelected={[versions[0], versions[1]]} onChangeSelected={onChangeSelected} />
            )
            clickItem(0) // deselect 1.0
            const lastCall = onChangeSelected.mock.calls.slice(-1)[0][0]
            expect(lastCall).toHaveLength(1)
            expect(lastCall[0].displayName).toBe('2.0 (2)')
        })

        it('selects version with highest code when Latest is clicked', () => {
            const onChangeSelected = jest.fn()
            // codes: '1', '2', '10' — highest is '10' (parsed as int)
            render(
                <DropdownSelect type={DropdownSelectType.MultiAppVersion} title="App versions" items={versions} initialSelected={versions} onChangeSelected={onChangeSelected} />
            )
            fireEvent.click(screen.getByText('Latest'))
            const lastCall = onChangeSelected.mock.calls.slice(-1)[0][0]
            expect(lastCall).toHaveLength(1)
            expect(lastCall[0].displayName).toBe('3.0 (10)')
        })

        it('selects all versions when All is clicked', () => {
            const onChangeSelected = jest.fn()
            render(
                <DropdownSelect type={DropdownSelectType.MultiAppVersion} title="App versions" items={versions} initialSelected={[versions[0]]} onChangeSelected={onChangeSelected} />
            )
            fireEvent.click(screen.getByText('All'))
            const lastCall = onChangeSelected.mock.calls.slice(-1)[0][0]
            expect(lastCall).toHaveLength(3)
        })
    })

    // --- SingleAppVersion ---

    describe('SingleAppVersion', () => {
        const versions = [av('1.0', '1'), av('2.0', '2')]

        it('shows selected version displayName as display text', () => {
            render(
                <DropdownSelect type={DropdownSelectType.SingleAppVersion} title="Version" items={versions} initialSelected={versions[0]} />
            )
            const trigger = screen.getByTestId('popover-trigger')
            expect(trigger.textContent).toContain('1.0 (1)')
        })

        it('fires onChangeSelected with the clicked version', () => {
            const onChangeSelected = jest.fn()
            render(
                <DropdownSelect type={DropdownSelectType.SingleAppVersion} title="Version" items={versions} initialSelected={versions[0]} onChangeSelected={onChangeSelected} />
            )
            clickItem(1)
            expect(onChangeSelected).toHaveBeenCalledWith(versions[1])
        })
    })

    // --- MultiOsVersion ---

    describe('MultiOsVersion', () => {
        const osVersions = [ov('android', '33'), ov('android', '34'), ov('ios', '17')]

        it('renders OS version displayNames', () => {
            render(
                <DropdownSelect type={DropdownSelectType.MultiOsVersion} title="OS Versions" items={osVersions} initialSelected={osVersions} />
            )
            expect(screen.getByText('Android API Level 33')).toBeInTheDocument()
            expect(screen.getByText('Android API Level 34')).toBeInTheDocument()
            expect(screen.getByText('iOS 17')).toBeInTheDocument()
        })

        it('toggles OS version on when clicked', () => {
            const onChangeSelected = jest.fn()
            render(
                <DropdownSelect type={DropdownSelectType.MultiOsVersion} title="OS Versions" items={osVersions} initialSelected={[osVersions[0]]} onChangeSelected={onChangeSelected} />
            )
            clickItem(1) // android 34
            const lastCall = onChangeSelected.mock.calls.slice(-1)[0][0]
            expect(lastCall).toHaveLength(2)
        })

        it('toggles OS version off when clicked again', () => {
            const onChangeSelected = jest.fn()
            render(
                <DropdownSelect type={DropdownSelectType.MultiOsVersion} title="OS Versions" items={osVersions} initialSelected={[osVersions[0], osVersions[1]]} onChangeSelected={onChangeSelected} />
            )
            clickItem(0) // deselect android 33
            const lastCall = onChangeSelected.mock.calls.slice(-1)[0][0]
            expect(lastCall).toHaveLength(1)
            expect(lastCall[0].displayName).toBe('Android API Level 34')
        })

        it('shows All and Clear buttons (not Latest)', () => {
            render(
                <DropdownSelect type={DropdownSelectType.MultiOsVersion} title="OS Versions" items={osVersions} initialSelected={[]} />
            )
            expect(screen.getByText('All')).toBeInTheDocument()
            expect(screen.getByText('Clear')).toBeInTheDocument()
            expect(screen.queryByText('Latest')).not.toBeInTheDocument()
        })
    })

    // --- SingleOsVersion ---

    describe('SingleOsVersion', () => {
        const osVersions = [ov('android', '33'), ov('ios', '17')]

        it('shows selected OS version displayName as display text', () => {
            render(
                <DropdownSelect type={DropdownSelectType.SingleOsVersion} title="OS" items={osVersions} initialSelected={osVersions[1]} />
            )
            const trigger = screen.getByTestId('popover-trigger')
            expect(trigger.textContent).toContain('iOS 17')
        })

        it('fires onChangeSelected with the clicked OS version', () => {
            const onChangeSelected = jest.fn()
            render(
                <DropdownSelect type={DropdownSelectType.SingleOsVersion} title="OS" items={osVersions} initialSelected={osVersions[0]} onChangeSelected={onChangeSelected} />
            )
            clickItem(1)
            expect(onChangeSelected).toHaveBeenCalledWith(osVersions[1])
        })
    })

    // --- Search filtering ---

    describe('Search filtering', () => {
        it('filters string items case-insensitively', () => {
            render(
                <DropdownSelect type={DropdownSelectType.MultiString} title="Country" items={['US', 'India', 'UK']} initialSelected={[]} />
            )
            search('ind')
            expect(getItems()).toHaveLength(1)
            expect(screen.getByText('India')).toBeInTheDocument()
        })

        it('filters AppVersion items by displayName', () => {
            const versions = [av('1.0', '1'), av('2.0', '2'), av('10.0', '10')]
            render(
                <DropdownSelect type={DropdownSelectType.MultiAppVersion} title="Versions" items={versions} initialSelected={[]} />
            )
            search('10')
            expect(getItems()).toHaveLength(1)
            expect(screen.getByText('10.0 (10)')).toBeInTheDocument()
        })

        it('filters OsVersion items by displayName', () => {
            const osVersions = [ov('android', '33'), ov('ios', '17')]
            render(
                <DropdownSelect type={DropdownSelectType.MultiOsVersion} title="OS" items={osVersions} initialSelected={[]} />
            )
            search('ios')
            expect(getItems()).toHaveLength(1)
            expect(screen.getByText('iOS 17')).toBeInTheDocument()
        })

        it('shows all items when search is cleared', () => {
            render(
                <DropdownSelect type={DropdownSelectType.MultiString} title="Country" items={['US', 'IN', 'GB']} initialSelected={[]} />
            )
            search('US')
            expect(getItems()).toHaveLength(1)
            search('')
            expect(getItems()).toHaveLength(3)
        })

        it('shows no items when search has no matches', () => {
            render(
                <DropdownSelect type={DropdownSelectType.MultiString} title="Country" items={['US', 'IN']} initialSelected={[]} />
            )
            search('zzz')
            expect(screen.queryAllByTestId('command-item')).toHaveLength(0)
        })
    })

    // --- Disabled state ---

    describe('Disabled state', () => {
        it('passes disabled to popover trigger', () => {
            render(
                <DropdownSelect type={DropdownSelectType.SingleString} title="Fruit" items={['Apple']} initialSelected="Apple" disabled={true} />
            )
            expect(screen.getByTestId('popover-trigger')).toHaveAttribute('data-disabled', 'true')
        })

        it('is not disabled by default', () => {
            render(
                <DropdownSelect type={DropdownSelectType.SingleString} title="Fruit" items={['Apple']} initialSelected="Apple" />
            )
            expect(screen.getByTestId('popover-trigger')).toHaveAttribute('data-disabled', 'false')
        })
    })

    // --- initialSelected sync ---

    describe('initialSelected sync', () => {
        it('updates selection when initialSelected prop changes', () => {
            const { rerender } = render(
                <DropdownSelect type={DropdownSelectType.SingleString} title="Fruit" items={['Apple', 'Banana']} initialSelected="Apple" />
            )
            expect(screen.getByTestId('popover-trigger').textContent).toContain('Apple')

            rerender(
                <DropdownSelect type={DropdownSelectType.SingleString} title="Fruit" items={['Apple', 'Banana']} initialSelected="Banana" />
            )
            expect(screen.getByTestId('popover-trigger').textContent).toContain('Banana')
        })
    })
})
