import DocsLayout from '@/app/docs/layout'
import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import '@testing-library/jest-dom/jest-globals'
import { render, screen } from '@testing-library/react'

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, ...props }: any) => <img alt={alt} {...props} />,
}))

jest.mock('next/navigation', () => ({
  usePathname: () => '/docs',
  useRouter: () => ({ replace: jest.fn() }),
}))

// Mock the sidebar to avoid complex internal dependencies
jest.mock('@/app/components/sidebar', () => ({
  SidebarProvider: ({ children }: any) => <div data-testid="sidebar-provider">{children}</div>,
  SidebarInset: ({ children }: any) => <div data-testid="sidebar-inset">{children}</div>,
  SidebarTrigger: () => <button data-testid="sidebar-trigger">Toggle Sidebar</button>,
  Sidebar: ({ children }: any) => <div data-testid="sidebar">{children}</div>,
  SidebarContent: ({ children }: any) => <div>{children}</div>,
  SidebarGroup: ({ children }: any) => <div>{children}</div>,
  SidebarHeader: ({ children }: any) => <div>{children}</div>,
  SidebarMenu: ({ children }: any) => <div>{children}</div>,
  SidebarMenuButton: ({ children }: any) => <div>{children}</div>,
  SidebarMenuItem: ({ children }: any) => <div>{children}</div>,
  SidebarMenuSub: ({ children }: any) => <div>{children}</div>,
  SidebarMenuSubButton: ({ children }: any) => <div>{children}</div>,
  SidebarMenuSubItem: ({ children }: any) => <div>{children}</div>,
}))

describe('DocsLayout', () => {
  it('renders children content', () => {
    render(
      <DocsLayout>
        <p>Test content</p>
      </DocsLayout>
    )

    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  it('renders mobile header with md:hidden class', () => {
    const { container } = render(
      <DocsLayout>
        <p>Content</p>
      </DocsLayout>
    )

    const header = container.querySelector('header')
    expect(header).toBeInTheDocument()
    expect(header).toHaveClass('md:hidden')
  })

  it('renders logo in mobile header linking to home', () => {
    render(
      <DocsLayout>
        <p>Content</p>
      </DocsLayout>
    )

    const logos = screen.getAllByAltText('Measure logo')
    expect(logos.length).toBeGreaterThanOrEqual(2)

    // Logo link should point to home
    const logoLink = logos[0].closest('a')
    expect(logoLink).toHaveAttribute('href', '/')
  })

  it('renders light and dark mode logos', () => {
    const { container } = render(
      <DocsLayout>
        <p>Content</p>
      </DocsLayout>
    )

    const header = container.querySelector('header')

    const lightLogo = header?.querySelector('img[src*="black"]')
    expect(lightLogo).toBeInTheDocument()
    expect(lightLogo).toHaveClass('dark:hidden')

    const darkLogo = header?.querySelector('img[src*="white"]')
    expect(darkLogo).toBeInTheDocument()
    expect(darkLogo).toHaveClass('hidden', 'dark:block')
  })

  it('renders sidebar trigger button in mobile header', () => {
    render(
      <DocsLayout>
        <p>Content</p>
      </DocsLayout>
    )

    expect(screen.getByTestId('sidebar-trigger')).toBeInTheDocument()
  })

  it('renders content wrapper with responsive padding', () => {
    const { container } = render(
      <DocsLayout>
        <p>Content</p>
      </DocsLayout>
    )

    const contentDiv = container.querySelector('.max-w-6xl')
    expect(contentDiv).toBeInTheDocument()
    expect(contentDiv).toHaveClass('px-4', 'sm:px-8', 'md:px-16')
  })

  it('renders content wrapper centered with mx-auto', () => {
    const { container } = render(
      <DocsLayout>
        <p>Content</p>
      </DocsLayout>
    )

    const contentDiv = container.querySelector('.max-w-6xl')
    expect(contentDiv).toHaveClass('mx-auto', 'w-full')
  })

  it('wraps everything in SidebarProvider', () => {
    render(
      <DocsLayout>
        <p>Content</p>
      </DocsLayout>
    )

    expect(screen.getByTestId('sidebar-provider')).toBeInTheDocument()
  })
})
