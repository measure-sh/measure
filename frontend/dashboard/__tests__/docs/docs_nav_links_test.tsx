import DocsNavLinks from '@/app/docs/components/docs_nav_links'
import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import '@testing-library/jest-dom/jest-globals'
import { render, screen } from '@testing-library/react'

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

describe('DocsNavLinks', () => {
  it('renders nothing for an unknown slug', () => {
    const { container } = render(<DocsNavLinks currentSlug="/docs/nonexistent" />)

    expect(container.innerHTML).toBe('')
  })

  it('renders only next link on the first page (/docs)', () => {
    render(<DocsNavLinks currentSlug="/docs" />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)

    // Next link should point to Getting Started
    expect(links[0]).toHaveAttribute('href', '/docs/sdk-integration-guide')
    expect(links[0]).toHaveTextContent('Getting Started')
  })

  it('renders only previous link on the last page', () => {
    render(<DocsNavLinks currentSlug="/docs/CONTRIBUTING" />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)

    // Should be a previous link (no next)
    const linkHref = links[0].getAttribute('href')
    expect(linkHref).toBeTruthy()
    expect(linkHref).not.toBe('/docs/CONTRIBUTING')
  })

  it('renders both previous and next links for a middle page', () => {
    render(<DocsNavLinks currentSlug="/docs/features/feature-crash-reporting" />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
  })

  it('shows correct previous and next titles', () => {
    render(<DocsNavLinks currentSlug="/docs/sdk-integration-guide" />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)

    // Previous should be Overview (/docs)
    expect(links[0]).toHaveTextContent('Overview')
    expect(links[0]).toHaveAttribute('href', '/docs')

    // Next should be the first Features item
    expect(links[1]).toHaveTextContent('Session Timeline')
    expect(links[1]).toHaveAttribute('href', '/docs/features/feature-session-timelines')
  })

  it('resolves nested nav item titles correctly', () => {
    // Bug Reports > Android is a deeply nested item
    render(<DocsNavLinks currentSlug="/docs/features/feature-bug-report-android" />)

    const links = screen.getAllByRole('link')
    expect(links.length).toBeGreaterThanOrEqual(1)

    // Verify that link text is a real title, not "Documentation" fallback
    for (const link of links) {
      expect(link.textContent).not.toBe('Documentation')
    }
  })
})
