import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

let mockPathname = '/docs'

jest.mock('next/navigation', () => ({
    usePathname: () => mockPathname,
}))

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, children, className }: any) => <a href={href} className={className}>{children}</a>,
}))

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ alt, ...props }: any) => <img alt={alt} {...props} />,
}))

jest.mock('lucide-react', () => ({
    ChevronRight: ({ className }: any) => <span data-testid="chevron" className={className} />,
    Search: ({ className }: any) => <span data-testid="search-icon" className={className} />,
}))

jest.mock('@/app/components/button', () => ({
    buttonVariants: () => 'btn-class',
}))

jest.mock('@/app/components/input', () => ({
    Input: (props: any) => <input {...props} />,
}))

jest.mock('@/app/components/theme_toggle', () => ({
    ThemeToggle: () => <div data-testid="theme-toggle" />,
}))

jest.mock('@/app/components/sidebar', () => ({
    Sidebar: ({ children }: any) => <div data-testid="sidebar">{children}</div>,
    SidebarContent: ({ children }: any) => <div>{children}</div>,
    SidebarGroup: ({ children }: any) => <div>{children}</div>,
    SidebarHeader: ({ children }: any) => <div data-testid="sidebar-header">{children}</div>,
    SidebarMenu: ({ children }: any) => <ul>{children}</ul>,
    SidebarMenuButton: ({ children, onClick, isActive, asChild, ...props }: any) => (
        <div data-testid="menu-button" data-active={isActive} onClick={onClick} {...props}>{children}</div>
    ),
    SidebarMenuItem: ({ children }: any) => <li>{children}</li>,
    SidebarMenuSub: ({ children }: any) => <ul data-testid="menu-sub">{children}</ul>,
    SidebarMenuSubButton: ({ children, isActive, asChild, ...props }: any) => (
        <div data-testid="menu-sub-button" data-active={isActive} {...props}>{children}</div>
    ),
    SidebarMenuSubItem: ({ children }: any) => <li>{children}</li>,
}))

jest.mock('@/app/docs/components/docs_search', () => ({
    __esModule: true,
    default: ({ open }: any) => open ? <div data-testid="docs-search-open" /> : null,
}))

// Mock docsNav with test data that covers all branching: leaf, parent with children, nested children
jest.mock('@/app/docs/docs_nav', () => ({
    docsNav: [
        { title: 'Getting Started', slug: '/docs/getting-started' },
        {
            title: 'Features',
            slug: '/docs/features',
            children: [
                { title: 'Crash Reporting', slug: '/docs/features/crash-reporting' },
                { title: 'Performance', slug: '/docs/features/performance' },
                {
                    title: 'Advanced',
                    slug: '/docs/features/advanced',
                    children: [
                        { title: 'Custom Events', slug: '/docs/features/advanced/custom-events' },
                    ],
                },
            ],
        },
    ],
}))

import DocsAppSidebar from '@/app/docs/components/docs_sidebar'

describe('DocsAppSidebar', () => {
    beforeEach(() => {
        mockPathname = '/docs'
    })

    describe('Rendering', () => {
        it('renders sidebar with logo images', () => {
            render(<DocsAppSidebar />)
            const logos = screen.getAllByAltText('Measure logo')
            expect(logos.length).toBe(2)
        })

        it('renders theme toggle', () => {
            render(<DocsAppSidebar />)
            expect(screen.getByTestId('theme-toggle')).toBeInTheDocument()
        })

        it('renders Overview link', () => {
            render(<DocsAppSidebar />)
            expect(screen.getByText('Overview')).toBeInTheDocument()
        })

        it('renders search input', () => {
            render(<DocsAppSidebar />)
            expect(screen.getByPlaceholderText('Search docs...')).toBeInTheDocument()
        })

        it('renders leaf nav items as links', () => {
            render(<DocsAppSidebar />)
            const link = screen.getByText('Getting Started')
            expect(link.closest('a')).toHaveAttribute('href', '/docs/getting-started')
        })

        it('renders parent nav items with chevron', () => {
            render(<DocsAppSidebar />)
            expect(screen.getByText('Features')).toBeInTheDocument()
        })
    })

    describe('Overview active state', () => {
        it('marks Overview as active when on /docs', () => {
            mockPathname = '/docs'
            render(<DocsAppSidebar />)
            const overviewButton = screen.getByText('Overview').closest('[data-testid="menu-button"]')
            expect(overviewButton).toHaveAttribute('data-active', 'true')
        })

        it('does not mark Overview as active on other pages', () => {
            mockPathname = '/docs/getting-started'
            render(<DocsAppSidebar />)
            const overviewButton = screen.getByText('Overview').closest('[data-testid="menu-button"]')
            expect(overviewButton).toHaveAttribute('data-active', 'false')
        })
    })

    describe('Collapsible nav items', () => {
        it('expands parent item on click to show children', () => {
            render(<DocsAppSidebar />)
            // Features should be collapsed initially (no child active)
            expect(screen.queryByText('Crash Reporting')).not.toBeInTheDocument()

            // Click to expand
            fireEvent.click(screen.getByText('Features'))
            expect(screen.getByText('Crash Reporting')).toBeInTheDocument()
            expect(screen.getByText('Performance')).toBeInTheDocument()
        })

        it('collapses parent item on second click', () => {
            render(<DocsAppSidebar />)
            fireEvent.click(screen.getByText('Features'))
            expect(screen.getByText('Crash Reporting')).toBeInTheDocument()

            fireEvent.click(screen.getByText('Features'))
            expect(screen.queryByText('Crash Reporting')).not.toBeInTheDocument()
        })

        it('auto-expands parent when child is active', () => {
            mockPathname = '/docs/features/crash-reporting'
            render(<DocsAppSidebar />)
            // Features should be auto-expanded because a child is active
            expect(screen.getByText('Crash Reporting')).toBeInTheDocument()
        })

        it('marks active child link', () => {
            mockPathname = '/docs/features/crash-reporting'
            render(<DocsAppSidebar />)
            const subButton = screen.getByText('Crash Reporting').closest('[data-testid="menu-sub-button"]')
            expect(subButton).toHaveAttribute('data-active', 'true')
        })

        it('does not mark inactive child link', () => {
            mockPathname = '/docs/features/crash-reporting'
            render(<DocsAppSidebar />)
            const subButton = screen.getByText('Performance').closest('[data-testid="menu-sub-button"]')
            expect(subButton).toHaveAttribute('data-active', 'false')
        })
    })

    describe('Nested collapsible sub-items', () => {
        it('renders nested parent with chevron', () => {
            mockPathname = '/docs/features/crash-reporting'
            render(<DocsAppSidebar />)
            // Features is expanded, Advanced should be visible but collapsed
            expect(screen.getByText('Advanced')).toBeInTheDocument()
            expect(screen.queryByText('Custom Events')).not.toBeInTheDocument()
        })

        it('expands nested sub-item on click', () => {
            mockPathname = '/docs/features/crash-reporting'
            render(<DocsAppSidebar />)
            fireEvent.click(screen.getByText('Advanced'))
            expect(screen.getByText('Custom Events')).toBeInTheDocument()
        })

        it('collapses nested sub-item on second click', () => {
            mockPathname = '/docs/features/crash-reporting'
            render(<DocsAppSidebar />)
            fireEvent.click(screen.getByText('Advanced'))
            expect(screen.getByText('Custom Events')).toBeInTheDocument()

            fireEvent.click(screen.getByText('Advanced'))
            expect(screen.queryByText('Custom Events')).not.toBeInTheDocument()
        })

        it('auto-expands nested parent when deep child is active', () => {
            mockPathname = '/docs/features/advanced/custom-events'
            render(<DocsAppSidebar />)
            // Both Features and Advanced should be auto-expanded
            expect(screen.getByText('Advanced')).toBeInTheDocument()
            expect(screen.getByText('Custom Events')).toBeInTheDocument()
        })
    })

    describe('Search', () => {
        it('opens search dialog when search input is clicked', () => {
            render(<DocsAppSidebar />)
            expect(screen.queryByTestId('docs-search-open')).not.toBeInTheDocument()

            const searchContainer = screen.getByPlaceholderText('Search docs...').closest('div')!
            fireEvent.click(searchContainer)
            expect(screen.getByTestId('docs-search-open')).toBeInTheDocument()
        })

        it('opens search dialog when search input is focused', () => {
            render(<DocsAppSidebar />)
            const input = screen.getByPlaceholderText('Search docs...')
            fireEvent.focus(input)
            expect(screen.getByTestId('docs-search-open')).toBeInTheDocument()
        })
    })
})
