import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

import TabSelect, { TabSize } from '@/app/components/tab_select'

describe('TabSelect', () => {
    const items = ['Tab A', 'Tab B', 'Tab C']

    describe('Rendering', () => {
        it('renders all tab items as buttons', () => {
            render(<TabSelect items={items} selected="Tab A" />)
            expect(screen.getByText('Tab A')).toBeInTheDocument()
            expect(screen.getByText('Tab B')).toBeInTheDocument()
            expect(screen.getByText('Tab C')).toBeInTheDocument()
        })

        it('applies small text class by default', () => {
            const { container } = render(<TabSelect items={items} selected="Tab A" />)
            expect(container.firstChild).toHaveClass('text-xs')
        })

        it('does not apply small text class when size is Large', () => {
            const { container } = render(<TabSelect items={items} selected="Tab A" size={TabSize.Large} />)
            expect(container.firstChild).not.toHaveClass('text-xs')
        })
    })

    describe('Selection', () => {
        it('applies selected style to the selected item', () => {
            render(<TabSelect items={items} selected="Tab B" />)
            const selectedButton = screen.getByText('Tab B')
            expect(selectedButton.className).toContain('bg-accent')
        })

        it('applies unselected style to non-selected items', () => {
            render(<TabSelect items={items} selected="Tab B" />)
            const unselectedButton = screen.getByText('Tab A')
            expect(unselectedButton.className).toContain('bg-background')
        })
    })

    describe('Callback', () => {
        it('calls onChangeSelected with clicked item', () => {
            const onChangeSelected = jest.fn()
            render(<TabSelect items={items} selected="Tab A" onChangeSelected={onChangeSelected} />)
            fireEvent.click(screen.getByText('Tab B'))
            expect(onChangeSelected).toHaveBeenCalledWith('Tab B')
        })

        it('does not throw when onChangeSelected is undefined', () => {
            render(<TabSelect items={items} selected="Tab A" />)
            expect(() => fireEvent.click(screen.getByText('Tab B'))).not.toThrow()
        })
    })
})
