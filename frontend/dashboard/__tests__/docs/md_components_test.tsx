import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import '@testing-library/jest-dom/jest-globals'
import { render, screen } from '@testing-library/react'
import { rewriteHref, rewriteImgSrc, createMarkdownComponents } from '@/app/docs/components/md_components'

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

// ─── rewriteHref ────────────────────────────────────────────────────────────

describe('rewriteHref', () => {
  describe('passthrough cases', () => {
    it('returns empty string unchanged', () => {
      expect(rewriteHref('', [])).toBe('')
    })

    it('returns anchor links unchanged', () => {
      expect(rewriteHref('#section', ['features', 'feature-crash-reporting'])).toBe('#section')
    })

    it('returns http URLs unchanged', () => {
      expect(rewriteHref('http://example.com', [])).toBe('http://example.com')
    })

    it('returns https URLs unchanged', () => {
      expect(rewriteHref('https://example.com', [])).toBe('https://example.com')
    })

    it('returns mailto links unchanged', () => {
      expect(rewriteHref('mailto:test@example.com', [])).toBe('mailto:test@example.com')
    })

    it('returns non-.md relative paths unchanged', () => {
      expect(rewriteHref('some/path', ['features'])).toBe('some/path')
    })
  })

  describe('relative .md links', () => {
    it('rewrites a sibling .md file from root', () => {
      expect(rewriteHref('faqs.md', ['sdk-integration-guide'])).toBe('/docs/faqs')
    })

    it('rewrites a sibling .md file from a subdirectory', () => {
      expect(rewriteHref('feature-crash-reporting.md', ['features', 'feature-session-timelines'])).toBe('/docs/features/feature-crash-reporting')
    })

    it('rewrites a relative path with directory', () => {
      expect(rewriteHref('features/feature-crash-reporting.md', ['sdk-integration-guide'])).toBe('/docs/features/feature-crash-reporting')
    })

    it('rewrites a path with ./ prefix', () => {
      expect(rewriteHref('./faqs.md', ['sdk-integration-guide'])).toBe('/docs/faqs')
    })

    it('rewrites a parent directory reference with ../', () => {
      expect(rewriteHref('../faqs.md', ['features', 'feature-crash-reporting'])).toBe('/docs/faqs')
    })

    it('rewrites README.md to directory index route', () => {
      expect(rewriteHref('README.md', ['features', 'feature-crash-reporting'])).toBe('/docs/features')
    })

    it('rewrites subdirectory README.md to directory route', () => {
      expect(rewriteHref('hosting/README.md', ['sdk-integration-guide'])).toBe('/docs/hosting')
    })

    it('preserves anchor fragments after rewriting', () => {
      expect(rewriteHref('configuration-options.md#journey-sampling', ['features', 'feature-crash-reporting'])).toBe('/docs/features/configuration-options#journey-sampling')
    })

    it('handles root-level page linking to another root page', () => {
      expect(rewriteHref('versioning.md', ['faqs'])).toBe('/docs/versioning')
    })
  })

  describe('links that escape the docs tree', () => {
    it('generates a GitHub URL when .md link traverses above docs root', () => {
      const result = rewriteHref('../../backend/README.md', ['sdk-integration-guide'])

      expect(result).toContain('github.com/measure-sh/measure')
    })

    it('generates a GitHub URL for non-.md links that escape docs tree', () => {
      const result = rewriteHref('../self-host/session-data/config.toml.example', ['CONTRIBUTING'])

      expect(result).toBe('https://github.com/measure-sh/measure/blob/main/self-host/session-data/config.toml.example')
    })
  })
})

// ─── rewriteImgSrc ──────────────────────────────────────────────────────────

describe('rewriteImgSrc', () => {
  describe('passthrough cases', () => {
    it('returns empty string unchanged', () => {
      expect(rewriteImgSrc('')).toBe('')
    })

    it('returns http URLs unchanged', () => {
      expect(rewriteImgSrc('http://example.com/img.png')).toBe('http://example.com/img.png')
    })

    it('returns https URLs unchanged', () => {
      expect(rewriteImgSrc('https://example.com/img.png')).toBe('https://example.com/img.png')
    })

    it('returns absolute paths unchanged', () => {
      expect(rewriteImgSrc('/images/logo.png')).toBe('/images/logo.png')
    })
  })

  describe('relative asset paths', () => {
    it('rewrites assets/ prefix', () => {
      expect(rewriteImgSrc('assets/screenshot.png')).toBe('/docs/assets/screenshot.png')
    })

    it('rewrites ./assets/ prefix', () => {
      expect(rewriteImgSrc('./assets/screenshot.png')).toBe('/docs/assets/screenshot.png')
    })

    it('rewrites ../assets/ prefix', () => {
      expect(rewriteImgSrc('../assets/create-app.png')).toBe('/docs/assets/create-app.png')
    })

    it('rewrites deeply nested assets/ path', () => {
      expect(rewriteImgSrc('some/deep/path/assets/image.png')).toBe('/docs/assets/image.png')
    })

    it('preserves the filename and subdirectories after assets/', () => {
      expect(rewriteImgSrc('assets/screenshots/dark/crash.png')).toBe('/docs/assets/screenshots/dark/crash.png')
    })
  })

  describe('non-asset relative paths', () => {
    it('returns paths without assets/ unchanged', () => {
      expect(rewriteImgSrc('images/logo.png')).toBe('images/logo.png')
    })
  })
})

// ─── createMarkdownComponents ────────────────────────────────────────────────────

describe('createMarkdownComponents', () => {
  it('returns an object with expected element keys', () => {
    const components = createMarkdownComponents([])
    const expectedKeys = ['h1', 'h2', 'h3', 'h4', 'p', 'a', 'img', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'table', 'thead', 'th', 'td', 'hr', 'details', 'summary', 'strong']

    for (const key of expectedKeys) {
      expect(components).toHaveProperty(key)
    }
  })

  describe('link component', () => {
    it('renders internal .md links as internal navigation', () => {
      const components = createMarkdownComponents(['features', 'feature-crash-reporting'])
      const LinkComponent = components.a as React.FC<{ href?: string; children?: React.ReactNode }>

      render(<LinkComponent href="feature-session-timelines.md">Session Timelines</LinkComponent>)

      const link = screen.getByText('Session Timelines')
      expect(link).toHaveAttribute('href', '/docs/features/feature-session-timelines')
      expect(link).not.toHaveAttribute('target')
    })

    it('renders external links with target=_blank', () => {
      const components = createMarkdownComponents([])
      const LinkComponent = components.a as React.FC<{ href?: string; children?: React.ReactNode }>

      render(<LinkComponent href="https://example.com">External</LinkComponent>)

      const link = screen.getByText('External')
      expect(link).toHaveAttribute('href', 'https://example.com')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('renders anchor links as-is', () => {
      const components = createMarkdownComponents(['sdk-integration-guide'])
      const LinkComponent = components.a as React.FC<{ href?: string; children?: React.ReactNode }>

      render(<LinkComponent href="#setup">Setup</LinkComponent>)

      const link = screen.getByText('Setup')
      expect(link).toHaveAttribute('href', '#setup')
    })
  })

  describe('image component', () => {
    it('rewrites relative asset paths', () => {
      const components = createMarkdownComponents(['features', 'feature-crash-reporting'])
      const ImgComponent = components.img as React.FC<{ src?: string; alt?: string }>

      render(<ImgComponent src="assets/crash.png" alt="Crash screenshot" />)

      const img = screen.getByAltText('Crash screenshot')
      expect(img).toHaveAttribute('src', '/docs/assets/crash.png')
    })

    it('sets loading=lazy on images', () => {
      const components = createMarkdownComponents([])
      const ImgComponent = components.img as React.FC<{ src?: string; alt?: string }>

      render(<ImgComponent src="https://example.com/img.png" alt="Test" />)

      const img = screen.getByAltText('Test')
      expect(img).toHaveAttribute('loading', 'lazy')
    })

    it('provides empty alt text when none given', () => {
      const components = createMarkdownComponents([])
      const ImgComponent = components.img as React.FC<{ src?: string }>

      const { container } = render(<ImgComponent src="/test.png" />)

      const img = container.querySelector('img')
      expect(img).toHaveAttribute('alt', '')
    })
  })

  describe('heading components', () => {
    it('renders h2 with anchor link', () => {
      const components = createMarkdownComponents([])
      const H2Component = components.h2 as React.FC<{ children?: React.ReactNode; id?: string }>

      render(<H2Component id="setup">Setup</H2Component>)

      const heading = screen.getByText('Setup')
      expect(heading.closest('h2')).toHaveAttribute('id', 'setup')

      const anchor = screen.getByLabelText('Link to section')
      expect(anchor).toHaveAttribute('href', '#setup')
    })

    it('renders h3 with anchor link', () => {
      const components = createMarkdownComponents([])
      const H3Component = components.h3 as React.FC<{ children?: React.ReactNode; id?: string }>

      render(<H3Component id="details">Details</H3Component>)

      const anchor = screen.getByLabelText('Link to section')
      expect(anchor).toHaveAttribute('href', '#details')
    })

    it('renders h2 without anchor when no id provided', () => {
      const components = createMarkdownComponents([])
      const H2Component = components.h2 as React.FC<{ children?: React.ReactNode; id?: string }>

      render(<H2Component>No ID</H2Component>)

      expect(screen.queryByLabelText('Link to section')).toBeNull()
    })
  })

  describe('blockquote component', () => {
    it('renders a regular blockquote', () => {
      const components = createMarkdownComponents([])
      const BlockquoteComponent = components.blockquote as React.FC<{ children?: React.ReactNode }>

      const { container } = render(<BlockquoteComponent>Regular quote</BlockquoteComponent>)

      expect(container.querySelector('blockquote')).toBeInTheDocument()
    })

    it('renders a NOTE admonition', () => {
      const components = createMarkdownComponents([])
      const BlockquoteComponent = components.blockquote as React.FC<{ children?: React.ReactNode }>

      render(<BlockquoteComponent>[!NOTE] This is important</BlockquoteComponent>)

      expect(screen.getByText('Note')).toBeInTheDocument()
    })

    it('renders a WARNING admonition', () => {
      const components = createMarkdownComponents([])
      const BlockquoteComponent = components.blockquote as React.FC<{ children?: React.ReactNode }>

      render(<BlockquoteComponent>[!WARNING] Be careful</BlockquoteComponent>)

      expect(screen.getByText('Warning')).toBeInTheDocument()
    })

    it('renders a TIP admonition', () => {
      const components = createMarkdownComponents([])
      const BlockquoteComponent = components.blockquote as React.FC<{ children?: React.ReactNode }>

      render(<BlockquoteComponent>[!TIP] Helpful tip</BlockquoteComponent>)

      expect(screen.getByText('Tip')).toBeInTheDocument()
    })

    it('renders an IMPORTANT admonition', () => {
      const components = createMarkdownComponents([])
      const BlockquoteComponent = components.blockquote as React.FC<{ children?: React.ReactNode }>

      render(<BlockquoteComponent>[!IMPORTANT] Do this</BlockquoteComponent>)

      expect(screen.getByText('Important')).toBeInTheDocument()
    })

    it('renders a CAUTION admonition', () => {
      const components = createMarkdownComponents([])
      const BlockquoteComponent = components.blockquote as React.FC<{ children?: React.ReactNode }>

      render(<BlockquoteComponent>[!CAUTION] Danger zone</BlockquoteComponent>)

      expect(screen.getByText('Caution')).toBeInTheDocument()
    })
  })

  describe('code component', () => {
    it('renders inline code without className', () => {
      const components = createMarkdownComponents([])
      const CodeComponent = components.code as React.FC<{ children?: React.ReactNode; className?: string }>

      const { container } = render(<CodeComponent>inline</CodeComponent>)

      const code = container.querySelector('code')
      expect(code).toHaveClass('font-code', 'bg-muted')
    })

    it('renders code block with language className', () => {
      const components = createMarkdownComponents([])
      const CodeComponent = components.code as React.FC<{ children?: React.ReactNode; className?: string }>

      const { container } = render(<CodeComponent className="language-typescript">const x = 1</CodeComponent>)

      const code = container.querySelector('code')
      expect(code).toHaveClass('font-code', 'language-typescript')
    })
  })
})
