import LayoutSnapshot, { LayoutElementType, LayoutSnapshotStripedBgImage } from '@/app/components/layout_snapshot'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

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

const mockHorizontalElement: LayoutElement = {
    id: 'root',
    label: 'Root Container',
    type: 'container',
    x: 0,
    y: 0,
    width: 1000, // Wider than tall
    height: 400,
    scrollable: false,
    highlighted: false,
    children: []
}

global.fetch = jest.fn() as unknown as jest.Mock<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
>

describe('LayoutSnapshot', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    const mockFetch = (data: LayoutElement) => {
        (global.fetch as jest.Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => data
            } as Partial<Response> as Response)
    }

    it('shows nothing while fetching', async () => {
        mockFetch(mockElement)

        const { container } = render(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={400}
                height={300}
            />
        )

        // Should show nothing
        await waitFor(() => {
            expect(container.firstChild).toBeNull()
        })
    })

    it('renders correctly after fetching layout', async () => {
        mockFetch(mockElement)

        const { container } = render(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={400}
                height={300}
            />
        )

        await waitFor(() => {
            expect(container.querySelector('.absolute.border')).toBeInTheDocument()
        })
    })

    it('calls fetch with correct URL', async () => {
        mockFetch(mockElement)

        render(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={400}
                height={300}
            />
        )

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith("http://example.com/layout.json")
        })
    })

    it('handles fetch errors gracefully', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        (global.fetch as jest.Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>)
            .mockRejectedValueOnce(new Error('Network error'))

        const { container } = render(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={400}
                height={300}
            />
        )

        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalled()
        })

        // Should show nothing on error
        expect(container.firstChild).toBeNull()

        consoleErrorSpy.mockRestore()
    })

    it('renders with correct outer dimensions', async () => {
        mockFetch(mockElement)

        const { container } = render(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={400}
                height={300}
            />
        )

        await waitFor(() => {
            const wrapper = container.querySelector('.relative.overflow-hidden') as HTMLElement
            expect(wrapper).toBeInTheDocument()
        })
    })

    it('renders children elements correctly', async () => {
        mockFetch(mockElementWithChildren)

        render(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={800}
                height={600}
            />
        )

        await waitFor(() => {
            const elements = document.querySelectorAll('.absolute.border')
            expect(elements).toHaveLength(3) // root + 2 children
        })
    })

    it('applies highlighted styling to highlighted elements', async () => {
        mockFetch(mockElementWithChildren)

        const { container } = render(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={800}
                height={600}
            />
        )

        await waitFor(() => {
            const elements = container.querySelectorAll('.absolute.border')
            const highlightedChild = elements[2] // root, child1, child2 (highlighted)

            expect(highlightedChild).toHaveClass('border-yellow-200')
            expect(highlightedChild).toHaveStyle({
                backgroundImage: LayoutSnapshotStripedBgImage
            })
        })
    })

    it('handles hover interactions correctly', async () => {
        mockFetch(mockElementWithChildren)

        const { container } = render(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={800}
                height={600}
            />
        )

        await waitFor(() => {
            expect(container.querySelector('.absolute.border')).toBeInTheDocument()
        })

        const wrapper = container.querySelector('.relative')!
        fireEvent.mouseMove(wrapper, { clientX: 150, clientY: 200 })

        const elements = container.querySelectorAll('.absolute.border')
        const firstChild = elements[1]

        fireEvent.mouseEnter(firstChild)

        expect(screen.getByText('Button Element')).toBeInTheDocument()
    })

    it('shows and hides tooltip on mouse enter and leave', async () => {
        mockFetch(mockElementWithChildren)

        const { container } = render(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={800}
                height={600}
            />
        )

        await waitFor(() => {
            expect(container.querySelector('.absolute.border')).toBeInTheDocument()
        })

        const wrapper = container.querySelector('.relative')!
        fireEvent.mouseMove(wrapper, { clientX: 150, clientY: 200 })

        const elements = container.querySelectorAll('.absolute.border')
        const firstChild = elements[1]

        fireEvent.mouseEnter(firstChild)
        expect(screen.getByText('Button Element')).toBeInTheDocument()

        fireEvent.mouseLeave(firstChild)
        expect(screen.queryByText('Button Element')).not.toBeInTheDocument()
    })

    it('positions tooltip relative to mouse position', async () => {
        mockFetch(mockElementWithChildren)

        const { container } = render(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={800}
                height={600}
            />
        )

        await waitFor(() => {
            expect(container.querySelector('.absolute.border')).toBeInTheDocument()
        })

        const wrapper = container.querySelector('.relative')!
        const elements = container.querySelectorAll('.absolute.border')
        const firstChild = elements[1]

        fireEvent.mouseMove(wrapper, { clientX: 150, clientY: 200 })
        fireEvent.mouseEnter(firstChild)

        const tooltip = screen.getByText('Button Element')
        expect(tooltip).toHaveStyle({
            top: '220px', // clientY + 20
            left: '160px' // clientX + 10
        })
    })

    it('handles nested elements correctly', async () => {
        mockFetch(mockNestedElement)

        const { container } = render(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={800}
                height={600}
            />
        )

        await waitFor(() => {
            const elements = container.querySelectorAll('.absolute.border')
            expect(elements).toHaveLength(3) // root + parent + nested child
        })
    })

    it('finds and displays correct label for nested elements', async () => {
        mockFetch(mockNestedElement)

        const { container } = render(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={800}
                height={600}
            />
        )

        await waitFor(() => {
            const elements = container.querySelectorAll('.absolute.border')
            expect(elements).toHaveLength(3)

            const nestedChild = elements[2]
            expect(nestedChild).toHaveClass('border-gray-400')
        })
    })

    it('applies correct scaling for vertical orientation', async () => {
        // Mock element with vertical aspect ratio (height > width)
        const verticalElement: LayoutElement = {
            ...mockElement,
            width: 400,
            height: 800
        }

        mockFetch(verticalElement)

        const { container } = render(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={211}
                height={366}
            />
        )

        await waitFor(() => {
            expect(container.querySelector('.absolute.border')).toBeInTheDocument()
        })
    })

    it('applies correct scaling for horizontal orientation', async () => {
        mockFetch(mockHorizontalElement)

        const { container } = render(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={366}
                height={211}
            />
        )

        await waitFor(() => {
            expect(container.querySelector('.absolute.border')).toBeInTheDocument()
        })
    })

    it('handles empty children array', async () => {
        const elementWithEmptyChildren: LayoutElement = {
            ...mockElement,
            children: []
        }

        mockFetch(elementWithEmptyChildren)

        const { container } = render(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={400}
                height={300}
            />
        )

        await waitFor(() => {
            expect(container.querySelector('.absolute.border')).toBeInTheDocument()
        })
    })

    it('applies hover styling correctly', async () => {
        mockFetch(mockElementWithChildren)

        const { container } = render(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={800}
                height={600}
            />
        )

        await waitFor(() => {
            expect(container.querySelector('.absolute.border')).toBeInTheDocument()
        })

        const elements = container.querySelectorAll('.absolute.border')
        const firstChild = elements[1]

        expect(firstChild).toHaveClass('border-gray-400')

        fireEvent.mouseEnter(firstChild)
        expect(firstChild).toHaveClass('border-yellow-200')
    })

    it('maintains highlighted styling even when hovered', async () => {
        mockFetch(mockElementWithChildren)

        const { container } = render(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={800}
                height={600}
            />
        )

        await waitFor(() => {
            expect(container.querySelector('.absolute.border')).toBeInTheDocument()
        })

        const elements = container.querySelectorAll('.absolute.border')
        const highlightedChild = elements[2]

        expect(highlightedChild).toHaveClass('border-yellow-200')

        fireEvent.mouseEnter(highlightedChild)
        expect(highlightedChild).toHaveClass('border-yellow-200')
    })

    it('handles mouse movement without crashing', async () => {
        mockFetch(mockElement)

        const { container } = render(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={400}
                height={300}
            />
        )

        await waitFor(() => {
            expect(container.querySelector('.relative')).toBeInTheDocument()
        })

        const wrapper = container.querySelector('.relative')!

        expect(() => {
            fireEvent.mouseMove(wrapper, { clientX: 100, clientY: 150 })
            fireEvent.mouseMove(wrapper, { clientX: 200, clientY: 250 })
        }).not.toThrow()
    })

    it('tooltip functionality works with proper sequence', async () => {
        mockFetch(mockElementWithChildren)

        const { container } = render(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={800}
                height={600}
            />
        )

        await waitFor(() => {
            expect(container.querySelector('.absolute.border')).toBeInTheDocument()
        })

        const wrapper = container.querySelector('.relative')!
        const elements = container.querySelectorAll('.absolute.border')
        const firstChild = elements[1]

        fireEvent.mouseMove(wrapper, { clientX: 150, clientY: 200 })
        fireEvent.mouseEnter(firstChild)

        expect(screen.getByText('Button Element')).toBeInTheDocument()

        fireEvent.mouseMove(wrapper, { clientX: 200, clientY: 250 })

        const tooltip = screen.getByText('Button Element')
        expect(tooltip).toHaveStyle({
            top: '270px',
            left: '210px'
        })

        fireEvent.mouseLeave(firstChild)
        expect(screen.queryByText('Button Element')).not.toBeInTheDocument()
    })

    it('refetches layout when layoutUrl changes', async () => {
        mockFetch(mockElement)

        const { rerender } = render(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout1.json"
                width={400}
                height={300}
            />
        )

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith("http://example.com/layout1.json")
        })

        mockFetch(mockElementWithChildren)

        rerender(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout2.json"
                width={400}
                height={300}
            />
        )

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith("http://example.com/layout2.json")
        })
    })

    it('handles non-ok response from fetch', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        (global.fetch as jest.Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>)
            .mockResolvedValueOnce({
                ok: false
            } as unknown as Partial<Response> as Response)

        const { container } = render(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={400}
                height={300}
            />
        )

        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalled()
        })

        // Should show nothing on non-ok response
        expect(container.firstChild).toBeNull()

        consoleErrorSpy.mockRestore()
    })
})