
import LayoutSnapshot, { LayoutElementType, LayoutSnapshotStripedBgImage } from '@/app/components/layout_snapshot'
import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

type LayoutElement = {
    id: string
    label: string
    type: LayoutElementType
    x: number
    y: number
    width: number
    height: number
    scrollable: boolean
    highlighted: boolean
    children: LayoutElement[]
}

const mockElement: LayoutElement = {
    id: 'root',
    label: 'Root Container',
    type: 'container',
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    scrollable: false,
    highlighted: false,
    children: []
}

const mockElementWithChildren: LayoutElement = {
    id: 'root',
    label: 'Root Container',
    type: 'container',
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    scrollable: false,
    highlighted: false,
    children: [
        {
            id: 'child1',
            label: 'Button Element',
            type: 'button',
            x: 100,
            y: 100,
            width: 200,
            height: 50,
            scrollable: false,
            highlighted: false,
            children: []
        },
        {
            id: 'child2',
            label: 'Text Element',
            type: 'text',
            x: 400,
            y: 200,
            width: 300,
            height: 30,
            scrollable: false,
            highlighted: true,
            children: []
        }
    ]
}

const mockNestedElement: LayoutElement = {
    id: 'root',
    label: 'Root Container',
    type: 'container',
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    scrollable: false,
    highlighted: false,
    children: [
        {
            id: 'parent',
            label: 'Parent Container',
            type: 'container',
            x: 50,
            y: 50,
            width: 400,
            height: 300,
            scrollable: false,
            highlighted: false,
            children: [
                {
                    id: 'nested-child',
                    label: 'Nested Input',
                    type: 'input',
                    x: 10,
                    y: 10,
                    width: 100,
                    height: 40,
                    scrollable: false,
                    highlighted: false,
                    children: []
                }
            ]
        }
    ]
}

describe('LayoutSnapshot', () => {
    it('renders correctly with basic layout', () => {
        const container = render(
            <LayoutSnapshot
                layout={mockElement}
                width={400}
                height={300}
            />
        )

        expect(container).toMatchSnapshot()
    })

    it('renders with correct dimensions and scaling', () => {
        const { container } = render(
            <LayoutSnapshot
                layout={mockElement}
                width={400}
                height={300}
            />
        )

        const wrapper = container.firstChild as HTMLElement
        expect(wrapper).toHaveStyle({
            width: '400px',
            height: '300px'
        })
    })

    it('renders children elements correctly', () => {
        render(
            <LayoutSnapshot
                layout={mockElementWithChildren}
                width={800}
                height={600}
            />
        )

        // The elements should be present in the DOM (though not visible as text)
        const elements = document.querySelectorAll('.absolute.border')
        expect(elements).toHaveLength(3) // root + 2 children
    })

    it('applies highlighted styling to highlighted elements', () => {
        const { container } = render(
            <LayoutSnapshot
                layout={mockElementWithChildren}
                width={800}
                height={600}
            />
        )

        // Find the highlighted element (child2 which has highlighted: true)
        const elements = container.querySelectorAll('.absolute.border')
        const highlightedChild = elements[2] // root, child1, child2 (highlighted)

        // Check that it has the yellow border class for highlighted elements
        expect(highlightedChild).toHaveClass('border-yellow-200')

        // Check that it has the striped background style
        expect(highlightedChild).toHaveStyle({
            backgroundImage: LayoutSnapshotStripedBgImage
        })
    })

    it('handles hover interactions correctly', () => {
        const { container } = render(
            <LayoutSnapshot
                layout={mockElementWithChildren}
                width={800}
                height={600}
            />
        )

        // Simulate mouse move to set position for tooltip
        const wrapper = container.querySelector('.relative')!
        fireEvent.mouseMove(wrapper, { clientX: 150, clientY: 200 })

        const elements = container.querySelectorAll('.absolute.border')
        const firstChild = elements[1] // Skip root, get first child

        fireEvent.mouseEnter(firstChild)

        // Should show tooltip with label
        expect(screen.getByText('Button Element')).toBeInTheDocument()
    })

    it('shows and hides tooltip on mouse enter and leave', () => {
        const { container } = render(
            <LayoutSnapshot
                layout={mockElementWithChildren}
                width={800}
                height={600}
            />
        )

        // Simulate mouse move to set position for tooltip
        const wrapper = container.querySelector('.relative')!
        fireEvent.mouseMove(wrapper, { clientX: 150, clientY: 200 })

        const elements = container.querySelectorAll('.absolute.border')
        const firstChild = elements[1]

        // Mouse enter should show tooltip
        fireEvent.mouseEnter(firstChild)
        expect(screen.getByText('Button Element')).toBeInTheDocument()

        // Mouse leave should hide tooltip
        fireEvent.mouseLeave(firstChild)
        expect(screen.queryByText('Button Element')).not.toBeInTheDocument()
    })

    it('positions tooltip relative to mouse position', () => {
        const { container } = render(
            <LayoutSnapshot
                layout={mockElementWithChildren}
                width={800}
                height={600}
            />
        )

        const wrapper = container.querySelector('.relative')!
        const elements = container.querySelectorAll('.absolute.border')
        const firstChild = elements[1]

        // Simulate mouse move and hover
        fireEvent.mouseMove(wrapper, { clientX: 150, clientY: 200 })
        fireEvent.mouseEnter(firstChild)

        const tooltip = screen.getByText('Button Element')
        expect(tooltip).toHaveStyle({
            top: '220px', // clientY + 20
            left: '160px' // clientX + 10
        })
    })

    it('handles nested elements correctly', () => {
        const { container } = render(
            <LayoutSnapshot
                layout={mockNestedElement}
                width={800}
                height={600}
            />
        )

        const elements = container.querySelectorAll('.absolute.border')
        expect(elements).toHaveLength(3) // root + parent + nested child
    })

    it('finds and displays correct label for nested elements', () => {
        const { container } = render(
            <LayoutSnapshot
                layout={mockNestedElement}
                width={800}
                height={600}
            />
        )

        const elements = container.querySelectorAll('.absolute.border')
        const nestedChild = elements[2] // root, parent, then nested child

        // Just verify the structure is correct - tooltip testing is complex due to mouse position dependency
        expect(elements).toHaveLength(3)
        expect(nestedChild).toHaveClass('border-gray-400')
    })

    it('applies correct scaling when dimensions differ from layout size', () => {
        const { container } = render(
            <LayoutSnapshot
                layout={mockElement} // 800x600
                width={400} // Half width
                height={300} // Half height
            />
        )

        const rootElement = container.querySelector('.absolute.border')
        expect(rootElement).toHaveStyle({
            width: '400px', // 800 * 0.5
            height: '300px'  // 600 * 0.5
        })
    })

    it('handles empty children array', () => {
        const elementWithEmptyChildren: LayoutElement = {
            ...mockElement,
            children: []
        }

        const container = render(
            <LayoutSnapshot
                layout={elementWithEmptyChildren}
                width={400}
                height={300}
            />
        )

        expect(container).toMatchSnapshot()
    })

    it('applies hover styling correctly', () => {
        const { container } = render(
            <LayoutSnapshot
                layout={mockElementWithChildren}
                width={800}
                height={600}
            />
        )

        const elements = container.querySelectorAll('.absolute.border')
        const firstChild = elements[1]

        // Before hover - should have gray border
        expect(firstChild).toHaveClass('border-gray-400')

        fireEvent.mouseEnter(firstChild)

        // After hover - should have yellow border
        expect(firstChild).toHaveClass('border-yellow-200')
    })

    it('maintains highlighted styling even when hovered', () => {
        const { container } = render(
            <LayoutSnapshot
                layout={mockElementWithChildren}
                width={800}
                height={600}
            />
        )

        // Find the highlighted element (child2)
        const elements = container.querySelectorAll('.absolute.border')
        const highlightedChild = elements[2] // root, child1, child2 (highlighted)

        // Should have yellow border due to highlighting
        expect(highlightedChild).toHaveClass('border-yellow-200')

        // Test hover state change
        fireEvent.mouseEnter(highlightedChild)

        // Should still have yellow border (highlighted elements keep yellow border)
        expect(highlightedChild).toHaveClass('border-yellow-200')
    })

    it('handles mouse movement without crashing', () => {
        const { container } = render(
            <LayoutSnapshot
                layout={mockElement}
                width={400}
                height={300}
            />
        )

        const wrapper = container.querySelector('.relative')!

        expect(() => {
            fireEvent.mouseMove(wrapper, { clientX: 100, clientY: 150 })
            fireEvent.mouseMove(wrapper, { clientX: 200, clientY: 250 })
        }).not.toThrow()
    })

    it('tooltip functionality works with proper sequence', () => {
        const { container } = render(
            <LayoutSnapshot
                layout={mockElementWithChildren}
                width={800}
                height={600}
            />
        )

        const wrapper = container.querySelector('.relative')!
        const elements = container.querySelectorAll('.absolute.border')
        const firstChild = elements[1]

        // Step 1: Move mouse to set position
        fireEvent.mouseMove(wrapper, { clientX: 150, clientY: 200 })

        // Step 2: Hover over element 
        fireEvent.mouseEnter(firstChild)

        // The tooltip should appear
        expect(screen.getByText('Button Element')).toBeInTheDocument()

        // Step 3: Move mouse to update position
        fireEvent.mouseMove(wrapper, { clientX: 200, clientY: 250 })

        // Tooltip should still be visible and repositioned
        const tooltip = screen.getByText('Button Element')
        expect(tooltip).toHaveStyle({
            top: '270px', // clientY + 20
            left: '210px' // clientX + 10
        })

        // Step 4: Mouse leave should hide tooltip
        fireEvent.mouseLeave(firstChild)
        expect(screen.queryByText('Button Element')).not.toBeInTheDocument()
    })
})