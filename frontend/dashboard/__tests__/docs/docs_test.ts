import { cleanContent, extractDescription, extractTitle, extractTocEntries, parseFrontmatter, stripSearchContent } from '@/app/docs/docs'
import { describe, expect, it } from '@jest/globals'

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

describe('extractDescription', () => {
  it('returns the first paragraph after the title', () => {
    const content = [
      '# Crash Reporting',
      '',
      'Crashes are automatically tracked, optionally with a snapshot of the app UI.',
      '',
      '## Metrics',
    ].join('\n')

    expect(extractDescription(content)).toBe(
      'Crashes are automatically tracked, optionally with a snapshot of the app UI.',
    )
  })

  it('skips a TOC bullet list that immediately follows the title', () => {
    const content = [
      '# Getting Started',
      '',
      '* [Step 1](#step-1)',
      '* [Step 2](#step-2)',
      '',
      'Welcome to the integration guide for measure-sh.',
    ].join('\n')

    expect(extractDescription(content)).toBe(
      'Welcome to the integration guide for measure-sh.',
    )
  })

  it('skips admonitions and headings before finding a paragraph', () => {
    const content = [
      '# Feature',
      '',
      '> [!NOTE]',
      '> This is in beta.',
      '',
      '## Overview',
      '',
      'This feature lets you do things.',
    ].join('\n')

    expect(extractDescription(content)).toBe('This feature lets you do things.')
  })

  it('strips markdown links and emphasis', () => {
    const content = [
      '# Title',
      '',
      'See the [docs](https://example.com) for **details** and `code`.',
    ].join('\n')

    expect(extractDescription(content)).toBe(
      'See the docs for details and code.',
    )
  })

  it('truncates long paragraphs at a word boundary with an ellipsis', () => {
    const paragraph =
      'This is a long paragraph that goes on and on and on, packed with words that will need to be truncated because we only allow a limited number of characters in the description tag, which is a constraint imposed by search engines.'
    const content = ['# Title', '', paragraph].join('\n')

    const result = extractDescription(content)
    expect(result.length).toBeLessThan(paragraph.length)
    expect(result.length).toBeLessThanOrEqual(161)
    expect(result.endsWith('…')).toBe(true)
    expect(result.slice(0, -1)).not.toMatch(/\s$/)
    expect(paragraph).toContain(result.slice(0, -1))
  })

  it('returns empty string when no plain paragraph is present', () => {
    const content = [
      '# Title',
      '',
      '* only a list',
      '* of bullet items',
    ].join('\n')

    expect(extractDescription(content)).toBe('')
  })

  it('returns empty string for content with only a title', () => {
    expect(extractDescription('# Just a title')).toBe('')
  })
})

describe('parseFrontmatter', () => {
  it('returns empty frontmatter when content has none', () => {
    expect(parseFrontmatter('# Title\n\nbody')).toEqual({
      frontmatter: {},
      body: '# Title\n\nbody',
    })
  })

  it('parses a single description field', () => {
    const out = parseFrontmatter(
      '---\ndescription: A short summary.\n---\n\n# Title',
    )
    expect(out.frontmatter).toEqual({ description: 'A short summary.' })
    expect(out.body).toBe('# Title')
  })

  it('strips surrounding double quotes from values', () => {
    const out = parseFrontmatter(
      '---\ndescription: "Quoted summary with : a colon"\n---\n\n# Title',
    )
    expect(out.frontmatter.description).toBe('Quoted summary with : a colon')
  })

  it('strips surrounding single quotes from values', () => {
    const out = parseFrontmatter(
      "---\ntitle: 'Single quoted'\n---\n\n# X",
    )
    expect(out.frontmatter.title).toBe('Single quoted')
  })

  it('parses multiple fields', () => {
    const out = parseFrontmatter(
      '---\ntitle: T\ndescription: D\n---\n\n# X',
    )
    expect(out.frontmatter).toEqual({ title: 'T', description: 'D' })
  })

  it('returns original content if frontmatter has no closing delimiter', () => {
    const input = '---\ndescription: no closing\n# Title'
    expect(parseFrontmatter(input)).toEqual({
      frontmatter: {},
      body: input,
    })
  })

  it('ignores frontmatter that does not start the file', () => {
    const input = 'lead text\n---\ndescription: nope\n---\n# Title'
    expect(parseFrontmatter(input)).toEqual({
      frontmatter: {},
      body: input,
    })
  })

  it('preserves the body verbatim after the closing delimiter', () => {
    const out = parseFrontmatter(
      '---\ndescription: x\n---\n\n# Title\n\nFirst paragraph.\n',
    )
    expect(out.body).toBe('# Title\n\nFirst paragraph.\n')
  })

  it('handles CRLF line endings', () => {
    const out = parseFrontmatter(
      '---\r\ndescription: D\r\n---\r\n\r\n# X',
    )
    expect(out.frontmatter).toEqual({ description: 'D' })
    expect(out.body).toBe('# X')
  })

  it('skips lines that are not key: value pairs', () => {
    const out = parseFrontmatter(
      '---\n# a comment\ndescription: D\n---\n# X',
    )
    expect(out.frontmatter).toEqual({ description: 'D' })
  })
})

describe('stripSearchContent', () => {
  it('returns empty string for empty input', () => {
    expect(stripSearchContent('')).toBe('')
  })

  it('strips fenced code blocks entirely', () => {
    expect(stripSearchContent('Before\n\n```ts\nconst x = 1\n```\n\nAfter')).toBe(
      'Before After',
    )
  })

  it('strips headings of all levels', () => {
    expect(
      stripSearchContent('# H1\n\n## H2\n\n### H3\n\nbody\n\n#### H4\n\nmore'),
    ).toBe('body more')
  })

  it('strips raw HTML tags but keeps inner text', () => {
    const out = stripSearchContent(
      '<details><summary>Self-host Compatibility</summary>Body</details>',
    )
    expect(out).not.toMatch(/[<>]/)
    expect(out).toContain('Self-host Compatibility')
    expect(out).toContain('Body')
  })

  it('strips nested HTML tags fully (no <script> residue)', () => {
    // A single-pass replace would leave a partial `<script>` behind here.
    // The iterative strip must drain the residue so no executable tag survives.
    const out = stripSearchContent('<scr<script>ipt>foo</scr</script>ipt>')
    expect(out.toLowerCase()).not.toContain('<script')
    expect(out.toLowerCase()).not.toContain('</script')
    expect(out).not.toContain('<')
    expect(out).toContain('foo')
  })

  it('removes all < characters even from deeply nested tag soup', () => {
    // Only `<` matters for tag-injection risk; stray `>` is harmless text.
    const out = stripSearchContent('<<a><<b>c<<d>e>f>')
    expect(out).not.toContain('<')
    expect(out).toContain('f')
  })

  it('strips image syntax', () => {
    expect(stripSearchContent('See ![diagram](img.png) below')).toBe('See below')
  })

  it('unwraps markdown links to visible text', () => {
    expect(stripSearchContent('Read [the docs](https://example.com) now.')).toBe(
      'Read the docs now.',
    )
  })

  it('strips all five GFM callout markers but keeps body', () => {
    for (const kind of ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']) {
      const out = stripSearchContent(`> [!${kind}]\n> body for ${kind}`)
      expect(out).not.toContain(`[!${kind}]`)
      expect(out).toContain(`body for ${kind}`)
    }
  })

  it('strips callout markers case-insensitively', () => {
    expect(stripSearchContent('[!note] x')).not.toMatch(/\[!/i)
    expect(stripSearchContent('[!Tip] x')).not.toMatch(/\[!/i)
  })

  it('strips emphasis, strong, code, and strikethrough markers', () => {
    expect(stripSearchContent('**bold** *italic* `code` ~strike~')).toBe(
      'bold italic code strike',
    )
  })

  it('strips list bullets (-, *, +)', () => {
    expect(stripSearchContent('- one\n* two\n+ three')).toBe('one two three')
  })

  it('strips blockquote markers', () => {
    expect(stripSearchContent('> quoted text')).toBe('quoted text')
  })

  it('replaces table pipes with spaces', () => {
    const out = stripSearchContent(
      '| Col A | Col B |\n| --- | --- |\n| Val 1 | Val 2 |',
    )
    expect(out).not.toContain('|')
    expect(out).toContain('Col A')
    expect(out).toContain('Val 1')
  })

  it('strips HTML comments', () => {
    expect(stripSearchContent('Before <!-- hidden --> after')).toBe('Before after')
  })

  it('collapses multiple whitespace into a single space', () => {
    expect(stripSearchContent('a    b\n\n\nc')).toBe('a b c')
  })

  it('handles a realistic mixed-syntax markdown block end-to-end', () => {
    const md = [
      '# Bug Reports — Android',
      '',
      '* [Session Timeline](#session-timeline)',
      '',
      '> [!NOTE]',
      '> Use **Measure.launchBugReportActivity** to start the flow.',
      '',
      '```kotlin',
      'Measure.launchBugReportActivity(activity)',
      '```',
      '',
      '<details><summary>More</summary>Extra info</details>',
    ].join('\n')
    const out = stripSearchContent(md)
    expect(out).not.toMatch(/```|<|>|\[!|!\[/)
    expect(out).not.toContain('Bug Reports — Android')
    expect(out).toContain('Session Timeline')
    expect(out).toContain(
      'Use Measure.launchBugReportActivity to start the flow.',
    )
    expect(out).toContain('Extra info')
  })
})
