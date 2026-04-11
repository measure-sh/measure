import DocsSearch, { getMatchSnippet, highlightTerms } from '@/app/docs/components/docs_search'
import { beforeEach, describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import '@testing-library/jest-dom/jest-globals'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

// cmdk uses ResizeObserver internally
global.ResizeObserver = class {
  observe() { }
  unobserve() { }
  disconnect() { }
} as unknown as typeof ResizeObserver

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// ─── getMatchSnippet ────────────────────────────────────────────────────────

describe('getMatchSnippet', () => {
  it('returns empty string when no terms match', () => {
    expect(getMatchSnippet('some content here', ['xyz'])).toBe('')
  })

  it('returns empty string for empty content', () => {
    expect(getMatchSnippet('', ['test'])).toBe('')
  })

  it('returns empty string for empty terms', () => {
    expect(getMatchSnippet('some content', [])).toBe('')
  })

  it('returns snippet around matched term', () => {
    const content = 'The quick brown fox jumps over the lazy dog'
    const snippet = getMatchSnippet(content, ['fox'])

    expect(snippet).toContain('fox')
  })

  it('is case-insensitive', () => {
    const content = 'The Crash Reporting feature tracks errors'
    const snippet = getMatchSnippet(content, ['crash'])

    expect(snippet).toContain('Crash')
  })

  it('finds earliest matching term when multiple terms match', () => {
    const content = 'alpha beta gamma delta epsilon'
    const snippet = getMatchSnippet(content, ['delta', 'alpha'])

    // alpha appears first, so snippet should be anchored near alpha
    expect(snippet).toContain('alpha')
  })

  it('adds leading ellipsis when match is far into content', () => {
    const padding = 'a'.repeat(100)
    const content = `${padding} the target word here`
    const snippet = getMatchSnippet(content, ['target'])

    expect(snippet.startsWith('...')).toBe(true)
  })

  it('adds trailing ellipsis when content continues after snippet', () => {
    const trailing = 'b'.repeat(100)
    const content = `the target word here ${trailing}`
    const snippet = getMatchSnippet(content, ['target'])

    expect(snippet.endsWith('...')).toBe(true)
  })

  it('does not add ellipsis for short content fully captured', () => {
    const content = 'short content'
    const snippet = getMatchSnippet(content, ['short'])

    expect(snippet).not.toContain('...')
    expect(snippet).toBe('short content')
  })

  it('replaces newlines with spaces in snippet', () => {
    const content = 'line one\nthe target\nline three'
    const snippet = getMatchSnippet(content, ['target'])

    expect(snippet).not.toContain('\n')
    expect(snippet).toContain('the target')
  })

  it('handles term at very start of content', () => {
    const content = 'crash reporting is important for app stability'
    const snippet = getMatchSnippet(content, ['crash'])

    expect(snippet).toContain('crash')
    expect(snippet.startsWith('...')).toBe(false)
  })

  it('handles term at very end of content', () => {
    const content = 'monitoring app crash'
    const snippet = getMatchSnippet(content, ['crash'])

    expect(snippet).toContain('crash')
    expect(snippet.endsWith('...')).toBe(false)
  })
})

// ─── highlightTerms ─────────────────────────────────────────────────────────

describe('highlightTerms', () => {
  it('returns plain text when query is empty', () => {
    const result = highlightTerms('some text', '')

    expect(result).toBe('some text')
  })

  it('returns plain text when query is whitespace', () => {
    const result = highlightTerms('some text', '   ')

    expect(result).toBe('some text')
  })

  it('wraps matched term in mark element', () => {
    const { container } = render(<>{highlightTerms('the crash report', 'crash')}</>)
    const mark = container.querySelector('mark')

    expect(mark).toBeInTheDocument()
    expect(mark).toHaveTextContent('crash')
  })

  it('highlights are case-insensitive', () => {
    const { container } = render(<>{highlightTerms('Crash Reporting', 'crash')}</>)
    const mark = container.querySelector('mark')

    expect(mark).toHaveTextContent('Crash')
  })

  it('highlights multiple occurrences of a term', () => {
    const { container } = render(<>{highlightTerms('crash and crash again', 'crash')}</>)
    const marks = container.querySelectorAll('mark')

    expect(marks).toHaveLength(2)
  })

  it('highlights multiple different terms', () => {
    const { container } = render(<>{highlightTerms('crash and memory issues', 'crash memory')}</>)
    const marks = container.querySelectorAll('mark')

    expect(marks).toHaveLength(2)
    expect(marks[0]).toHaveTextContent('crash')
    expect(marks[1]).toHaveTextContent('memory')
  })

  it('preserves non-matching text around highlights', () => {
    const { container } = render(<>{highlightTerms('before crash after', 'crash')}</>)

    expect(container.textContent).toBe('before crash after')
  })

  it('handles regex special characters in query safely', () => {
    const { container } = render(<>{highlightTerms('price is $100 (USD)', '$100')}</>)
    const mark = container.querySelector('mark')

    expect(mark).toHaveTextContent('$100')
  })

  it('does not highlight when term is not in text', () => {
    const { container } = render(<>{highlightTerms('no match here', 'xyz')}</>)
    const marks = container.querySelectorAll('mark')

    expect(marks).toHaveLength(0)
    expect(container.textContent).toBe('no match here')
  })
})

// ─── DocsSearch component ───────────────────────────────────────────────────

const mockEntries = [
  {
    slug: '/features/feature-crash-reporting',
    title: 'Crash Reporting',
    headings: ['Metrics', 'Crash-Free Rate'],
    content: 'Track application crashes and errors across all platforms',
  },
  {
    slug: '/features/feature-memory-monitoring',
    title: 'Memory Monitoring',
    headings: ['Android', 'iOS'],
    content: 'Monitor memory usage and detect leaks in your application',
  },
  {
    slug: '/sdk-integration-guide',
    title: 'Getting Started',
    headings: ['Create an App', 'Set Up the SDK'],
    content: 'Follow these steps to integrate the SDK into your app',
  },
]

function mockFetchWith(data: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve(data),
  }) as jest.Mock
}

describe('DocsSearch component', () => {
  beforeEach(() => {
    mockPush.mockClear()
    jest.restoreAllMocks()
  })

  it('returns null when not open', () => {
    const { container } = render(<DocsSearch open={false} onOpenChange={jest.fn()} />)

    expect(container.innerHTML).toBe('')
  })

  it('renders search input when open', async () => {
    mockFetchWith(mockEntries)
    render(<DocsSearch open={true} onOpenChange={jest.fn()} />)
    await act(async () => { })

    expect(screen.getByPlaceholderText('Search documentation...')).toBeInTheDocument()
  })

  it('shows placeholder text before typing', async () => {
    mockFetchWith(mockEntries)
    render(<DocsSearch open={true} onOpenChange={jest.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Type to search documentation...')).toBeInTheDocument()
    })
  })

  it('fetches search index on first open', async () => {
    mockFetchWith(mockEntries)
    render(<DocsSearch open={true} onOpenChange={jest.fn()} />)
    await act(async () => { })

    expect(global.fetch).toHaveBeenCalledWith('/docs/search-index.json')
  })

  it('shows no results message for unmatched query', async () => {
    mockFetchWith(mockEntries)
    render(<DocsSearch open={true} onOpenChange={jest.fn()} />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const input = screen.getByPlaceholderText('Search documentation...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'xyznonexistent' } })
    })

    await waitFor(() => {
      expect(screen.getByText('No results found.')).toBeInTheDocument()
    })
  })

  it('shows matching results when query matches title', async () => {
    mockFetchWith(mockEntries)
    render(<DocsSearch open={true} onOpenChange={jest.fn()} />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const input = screen.getByPlaceholderText('Search documentation...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'crash' } })
    })

    await waitFor(() => {
      expect(screen.getByText('Crash Reporting')).toBeInTheDocument()
    })
  })

  it('shows matching results when query matches content', async () => {
    mockFetchWith(mockEntries)
    render(<DocsSearch open={true} onOpenChange={jest.fn()} />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const input = screen.getByPlaceholderText('Search documentation...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'leaks' } })
    })

    await waitFor(() => {
      expect(screen.getByText('Memory Monitoring')).toBeInTheDocument()
    })
  })

  it('ranks title matches above content matches', async () => {
    mockFetchWith(mockEntries)
    render(<DocsSearch open={true} onOpenChange={jest.fn()} />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const input = screen.getByPlaceholderText('Search documentation...')
    await act(async () => {
      // "memory" matches title of Memory Monitoring and content of other entries might not
      fireEvent.change(input, { target: { value: 'memory' } })
    })

    await waitFor(() => {
      const items = screen.getAllByRole('option')
      expect(items[0]).toHaveTextContent('Memory Monitoring')
    })
  })

  it('shows snippet with highlighted match', async () => {
    mockFetchWith(mockEntries)
    const { container } = render(<DocsSearch open={true} onOpenChange={jest.fn()} />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const input = screen.getByPlaceholderText('Search documentation...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'crashes' } })
    })

    await waitFor(() => {
      const mark = container.querySelector('mark')
      expect(mark).toBeInTheDocument()
      expect(mark).toHaveTextContent('crashes')
    })
  })

  it('shows headings fallback when match is only in title', async () => {
    const entries = [
      {
        slug: '/test',
        title: 'Crash Reporting',
        headings: ['Overview', 'Setup'],
        content: 'no matching words here at all',
      },
    ]
    mockFetchWith(entries)
    render(<DocsSearch open={true} onOpenChange={jest.fn()} />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const input = screen.getByPlaceholderText('Search documentation...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'crash' } })
    })

    await waitFor(() => {
      expect(screen.getByText('Overview / Setup')).toBeInTheDocument()
    })
  })

  it('navigates on result selection', async () => {
    mockFetchWith(mockEntries)
    const onOpenChange = jest.fn()
    render(<DocsSearch open={true} onOpenChange={onOpenChange} />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const input = screen.getByPlaceholderText('Search documentation...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'crash' } })
    })

    await waitFor(() => {
      expect(screen.getByText('Crash Reporting')).toBeInTheDocument()
    })

    const item = screen.getByText('Crash Reporting')
    await act(async () => {
      fireEvent.click(item)
    })

    expect(mockPush).toHaveBeenCalledWith('/docs/features/feature-crash-reporting')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('navigates to /docs for root slug', async () => {
    const entries = [
      { slug: '/', title: 'Documentation', headings: [], content: 'welcome to docs' },
    ]
    mockFetchWith(entries)
    render(<DocsSearch open={true} onOpenChange={jest.fn()} />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const input = screen.getByPlaceholderText('Search documentation...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'welcome' } })
    })

    await waitFor(() => {
      expect(screen.getByText('Documentation')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Documentation'))
    })

    expect(mockPush).toHaveBeenCalledWith('/docs')
  })

  it('closes on backdrop click', async () => {
    mockFetchWith(mockEntries)
    const onOpenChange = jest.fn()
    const { container } = render(<DocsSearch open={true} onOpenChange={onOpenChange} />)
    await act(async () => { })

    const backdrop = container.querySelector('.fixed.inset-0')!
    fireEvent.click(backdrop)

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('does not close when clicking inside the dialog', async () => {
    mockFetchWith(mockEntries)
    const onOpenChange = jest.fn()
    render(<DocsSearch open={true} onOpenChange={onOpenChange} />)
    await act(async () => { })

    const input = screen.getByPlaceholderText('Search documentation...')
    fireEvent.click(input)

    // onOpenChange should not have been called from the click (may be called from other effects)
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('toggles on Cmd+K', () => {
    mockFetchWith([])
    const onOpenChange = jest.fn()
    render(<DocsSearch open={false} onOpenChange={onOpenChange} />)

    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('toggles on Ctrl+K', () => {
    mockFetchWith([])
    const onOpenChange = jest.fn()
    render(<DocsSearch open={false} onOpenChange={onOpenChange} />)

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })

    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('closes on Escape key', async () => {
    mockFetchWith([])
    const onOpenChange = jest.fn()
    render(<DocsSearch open={true} onOpenChange={onOpenChange} />)
    await act(async () => { })

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows esc keyboard hint', async () => {
    mockFetchWith([])
    render(<DocsSearch open={true} onOpenChange={jest.fn()} />)
    await act(async () => { })

    expect(screen.getByText('esc')).toBeInTheDocument()
  })

  it('clears results when query is emptied', async () => {
    mockFetchWith(mockEntries)
    render(<DocsSearch open={true} onOpenChange={jest.fn()} />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const input = screen.getByPlaceholderText('Search documentation...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'crash' } })
    })

    await waitFor(() => {
      expect(screen.getByText('Crash Reporting')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.change(input, { target: { value: '' } })
    })

    await waitFor(() => {
      expect(screen.getByText('Type to search documentation...')).toBeInTheDocument()
    })
  })

  it('limits results to 10', async () => {
    const manyEntries = Array.from({ length: 20 }, (_, i) => ({
      slug: `/page-${i}`,
      title: `Page ${i} about crash`,
      headings: [],
      content: `crash content ${i}`,
    }))
    mockFetchWith(manyEntries)
    render(<DocsSearch open={true} onOpenChange={jest.fn()} />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const input = screen.getByPlaceholderText('Search documentation...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'crash' } })
    })

    await waitFor(() => {
      const items = screen.getAllByRole('option')
      expect(items).toHaveLength(10)
    })
  })

  it('handles fetch failure gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error')) as jest.Mock
    render(<DocsSearch open={true} onOpenChange={jest.fn()} />)

    // Should render without crashing
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search documentation...')).toBeInTheDocument()
    })
  })
})
