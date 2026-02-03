import LayoutSnapshot, { LayoutElementType, LayoutSnapshotStripedBgImage } from '@/app/components/layout_snapshot'
import { TooltipProvider } from '@/app/components/tooltip'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, waitFor } from '@testing-library/react'


// Mock ResizeObserver for Radix UI
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
}

type LayoutElement = {
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
    label: 'Root Container',
    type: 'container',
    x: 0,
    y: 0,
    width: 1000,
    height: 400,
    scrollable: false,
    highlighted: false,
    children: []
}

global.fetch = jest.fn() as unknown as jest.Mock<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
>

const renderWithTooltipProvider = (ui: React.ReactElement) => {
    return render(
        <TooltipProvider delayDuration={0}>
            {ui}
        </TooltipProvider>
    )
}

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
        // Use a promise that never resolves to test the loading state
        (global.fetch as jest.Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>)
            .mockImplementationOnce(() => new Promise(() => { }))

        const { container } = renderWithTooltipProvider(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={400}
                height={300}
            />
        )

        expect(container.querySelector('.relative.overflow-hidden')).toBeNull()
    })

    it('renders correctly after fetching layout', async () => {
        mockFetch(mockElement)

        const { container } = renderWithTooltipProvider(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={400}
                height={300}
            />
        )

        await waitFor(() => {
            expect(container.querySelector('.absolute.inset-0.border')).toBeInTheDocument()
        })
    })

    it('calls fetch with correct URL', async () => {
        mockFetch(mockElement)

        renderWithTooltipProvider(
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

        const { container } = renderWithTooltipProvider(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={400}
                height={300}
            />
        )

        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalled()
        })

        expect(container.querySelector('.relative.overflow-hidden')).toBeNull()
        consoleErrorSpy.mockRestore()
    })

    it('renders with correct outer dimensions', async () => {
        mockFetch(mockElement)

        const { container } = renderWithTooltipProvider(
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

        const { container } = renderWithTooltipProvider(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={800}
                height={600}
            />
        )

        await waitFor(() => {
            const elements = container.querySelectorAll('.absolute.inset-0.border')
            expect(elements).toHaveLength(3) // root + 2 children
        })
    })

    it('applies highlighted styling to highlighted elements', async () => {
        mockFetch(mockElementWithChildren)

        const { container } = renderWithTooltipProvider(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={800}
                height={600}
            />
        )

        await waitFor(() => {
            const elements = container.querySelectorAll('.absolute.inset-0.border')
            const highlightedChild = elements[2]

            expect(highlightedChild).toHaveClass('border-primary')
            expect(highlightedChild).toHaveStyle({
                backgroundImage: LayoutSnapshotStripedBgImage
            })
        })
    })

    it('handles nested elements correctly', async () => {
        mockFetch(mockNestedElement)

        const { container } = renderWithTooltipProvider(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={800}
                height={600}
            />
        )

        await waitFor(() => {
            const elements = container.querySelectorAll('.absolute.inset-0.border')
            expect(elements).toHaveLength(3) // root + parent + nested child
        })
    })

    it('maintains highlighted styling even when hovered', async () => {
        mockFetch(mockElementWithChildren)

        const { container } = renderWithTooltipProvider(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={800}
                height={600}
            />
        )

        await waitFor(() => {
            expect(container.querySelector('.absolute.inset-0.border')).toBeInTheDocument()
        })

        const elements = container.querySelectorAll('.absolute.inset-0.border')
        const highlightedChild = elements[2]

        expect(highlightedChild).toHaveClass('border-primary')

        fireEvent.pointerEnter(highlightedChild)
        expect(highlightedChild).toHaveClass('border-primary')
    })

    it('applies correct scaling for vertical orientation', async () => {
        const verticalElement: LayoutElement = {
            ...mockElement,
            width: 400,
            height: 800
        }

        mockFetch(verticalElement)

        const { container } = renderWithTooltipProvider(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={211}
                height={366}
            />
        )

        await waitFor(() => {
            expect(container.querySelector('.absolute.inset-0.border')).toBeInTheDocument()
        })
    })

    it('applies correct scaling for horizontal orientation', async () => {
        mockFetch(mockHorizontalElement)

        const { container } = renderWithTooltipProvider(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={366}
                height={211}
            />
        )

        await waitFor(() => {
            expect(container.querySelector('.absolute.inset-0.border')).toBeInTheDocument()
        })
    })

    it('handles empty children array', async () => {
        const elementWithEmptyChildren: LayoutElement = {
            ...mockElement,
            children: []
        }

        mockFetch(elementWithEmptyChildren)

        const { container } = renderWithTooltipProvider(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={400}
                height={300}
            />
        )

        await waitFor(() => {
            expect(container.querySelector('.absolute.inset-0.border')).toBeInTheDocument()
        })
    })

    it('refetches layout when layoutUrl changes', async () => {
        mockFetch(mockElement)

        const { rerender } = renderWithTooltipProvider(
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
            <TooltipProvider delayDuration={0}>
                <LayoutSnapshot
                    layoutUrl="http://example.com/layout2.json"
                    width={400}
                    height={300}
                />
            </TooltipProvider>
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

        const { container } = renderWithTooltipProvider(
            <LayoutSnapshot
                layoutUrl="http://example.com/layout.json"
                width={400}
                height={300}
            />
        )

        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalled()
        })

        expect(container.querySelector('.relative.overflow-hidden')).toBeNull()
        consoleErrorSpy.mockRestore()
    })
})