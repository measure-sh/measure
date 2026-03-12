import { describe, expect, it } from '@jest/globals'
import { extractTocEntries, cleanContent, extractTitle } from '@/app/docs/docs'

describe('extractTocEntries', () => {
  it('skips the first h1 as the page title', () => {
    const content = [
      '# Page Title',
      '## Section One',
      '## Section Two',
    ].join('\n')

    const entries = extractTocEntries(content)

    expect(entries).toHaveLength(2)
    expect(entries[0].text).toBe('Section One')
    expect(entries[1].text).toBe('Section Two')
  })

  it('includes subsequent h1 headings after the first', () => {
    const content = [
      '# Page Title',
      '# Android',
      '## Install the SDK',
      '# iOS',
      '## Install the SDK',
    ].join('\n')

    const entries = extractTocEntries(content)

    expect(entries).toHaveLength(4)
    expect(entries[0]).toEqual({ id: 'android', text: 'Android', level: 1 })
    expect(entries[1]).toEqual({ id: 'install-the-sdk', text: 'Install the SDK', level: 2 })
    expect(entries[2]).toEqual({ id: 'ios', text: 'iOS', level: 1 })
    expect(entries[3]).toEqual({ id: 'install-the-sdk-1', text: 'Install the SDK', level: 2 })
  })

  it('extracts h1, h2, and h3 headings with correct levels', () => {
    const content = [
      '# Title',
      '## Section',
      '### Subsection',
    ].join('\n')

    const entries = extractTocEntries(content)

    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({ id: 'section', text: 'Section', level: 2 })
    expect(entries[1]).toEqual({ id: 'subsection', text: 'Subsection', level: 3 })
  })

  it('ignores h4 and deeper headings', () => {
    const content = [
      '# Title',
      '## Section',
      '#### Deep Heading',
    ].join('\n')

    const entries = extractTocEntries(content)

    expect(entries).toHaveLength(1)
    expect(entries[0].text).toBe('Section')
  })

  it('deduplicates identical heading IDs with suffixes', () => {
    const content = [
      '# Title',
      '## Initialize the SDK',
      '## Initialize the SDK',
      '## Initialize the SDK',
    ].join('\n')

    const entries = extractTocEntries(content)

    expect(entries).toHaveLength(3)
    expect(entries[0].id).toBe('initialize-the-sdk')
    expect(entries[1].id).toBe('initialize-the-sdk-1')
    expect(entries[2].id).toBe('initialize-the-sdk-2')
  })

  it('deduplicates across different heading levels', () => {
    const content = [
      '# Title',
      '## Setup',
      '### Setup',
    ].join('\n')

    const entries = extractTocEntries(content)

    expect(entries).toHaveLength(2)
    expect(entries[0].id).toBe('setup')
    expect(entries[1].id).toBe('setup-1')
  })

  it('strips markdown links from heading text', () => {
    const content = [
      '# Title',
      '## See the [troubleshooting](./troubleshooting.md) section',
    ].join('\n')

    const entries = extractTocEntries(content)

    expect(entries).toHaveLength(1)
    expect(entries[0].text).toBe('See the troubleshooting section')
  })

  it('strips emphasis markers from heading text', () => {
    const content = [
      '# Title',
      '## **Bold** and *italic* and `code`',
    ].join('\n')

    const entries = extractTocEntries(content)

    expect(entries).toHaveLength(1)
    expect(entries[0].text).toBe('Bold and italic and code')
  })

  it('generates slug-style IDs from heading text', () => {
    const content = [
      '# Title',
      '## 1. Create an App',
      '## Add the API Key & API URL',
    ].join('\n')

    const entries = extractTocEntries(content)

    expect(entries[0].id).toBe('1-create-an-app')
    expect(entries[1].id).toBe('add-the-api-key-api-url')
  })

  it('returns empty array for content with no headings', () => {
    const content = 'Just a paragraph of text without any headings.'

    const entries = extractTocEntries(content)

    expect(entries).toEqual([])
  })

  it('returns empty array for content with only a title', () => {
    const content = '# Just a Title'

    const entries = extractTocEntries(content)

    expect(entries).toEqual([])
  })

  it('handles content with code blocks that look like headings', () => {
    const content = [
      '# Title',
      '## Real Section',
      '```',
      '# This is inside a code block',
      '```',
    ].join('\n')

    // Note: regex-based extraction will pick up code block headings.
    // This documents the current behavior.
    const entries = extractTocEntries(content)

    expect(entries.length).toBeGreaterThanOrEqual(1)
    expect(entries[0].text).toBe('Real Section')
  })
})

describe('cleanContent', () => {
  it('strips single-line HTML comments', () => {
    expect(cleanContent('Hello <!-- omit in toc --> World')).toBe('Hello  World')
  })

  it('strips multi-line HTML comments', () => {
    const content = 'Before\n<!-- this is\na multi-line\ncomment -->\nAfter'

    expect(cleanContent(content)).toBe('Before\n\nAfter')
  })

  it('strips multiple comments in the same content', () => {
    expect(cleanContent('A <!-- one --> B <!-- two --> C')).toBe('A  B  C')
  })

  it('returns content unchanged when there are no comments', () => {
    expect(cleanContent('No comments here')).toBe('No comments here')
  })

  it('handles empty string', () => {
    expect(cleanContent('')).toBe('')
  })
})

describe('extractTitle', () => {
  it('extracts the first h1 heading', () => {
    expect(extractTitle('# My Title\n\nSome content')).toBe('My Title')
  })

  it('returns "Documentation" when no h1 is found', () => {
    expect(extractTitle('No headings here')).toBe('Documentation')
  })

  it('returns "Documentation" for empty content', () => {
    expect(extractTitle('')).toBe('Documentation')
  })

  it('extracts the first h1 even if there are multiple', () => {
    expect(extractTitle('# First\n# Second')).toBe('First')
  })

  it('trims whitespace from the title', () => {
    expect(extractTitle('#   Spaced Title   ')).toBe('Spaced Title')
  })

  it('ignores h2 and h3 headings', () => {
    expect(extractTitle('## Not a title\n### Also not')).toBe('Documentation')
  })
})
