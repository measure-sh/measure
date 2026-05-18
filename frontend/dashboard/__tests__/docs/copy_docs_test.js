const { describe, expect, it, beforeEach } = require('@jest/globals')
const path = require('path')

// Mock fs before requiring copy_docs
jest.mock('fs')
const fs = require('fs')

const {
  stripHtmlComments,
  extractTitle,
  mdPathToSlug,
  getTitleFromFile,
  parseDirectoryNav,
  generateDocsNav,
  generateSearchIndex,
  stripSearchContent,
} = require('@/scripts/copy_docs')

describe('stripHtmlComments', () => {
  it('removes a single comment', () => {
    expect(stripHtmlComments('hello <!-- comment --> world')).toBe('hello  world')
  })

  it('removes multiple comments', () => {
    expect(stripHtmlComments('a <!-- one --> b <!-- two --> c')).toBe('a  b  c')
  })

  it('removes multiline comments', () => {
    const input = 'before <!-- multi\nline\ncomment --> after'
    expect(stripHtmlComments(input)).toBe('before  after')
  })

  it('returns text unchanged when no comments present', () => {
    expect(stripHtmlComments('no comments here')).toBe('no comments here')
  })

  it('returns empty string for empty input', () => {
    expect(stripHtmlComments('')).toBe('')
  })

  it('handles comment at start of text', () => {
    expect(stripHtmlComments('<!-- start -->rest')).toBe('rest')
  })

  it('handles comment at end of text', () => {
    expect(stripHtmlComments('rest<!-- end -->')).toBe('rest')
  })

  it('trims surrounding whitespace', () => {
    expect(stripHtmlComments('  <!-- comment -->  ')).toBe('')
  })

  it('handles text that is only a comment', () => {
    expect(stripHtmlComments('<!-- only a comment -->')).toBe('')
  })

  it('handles omit in toc comments', () => {
    expect(stripHtmlComments('Contents <!-- omit in toc -->')).toBe('Contents')
  })
})

describe('extractTitle', () => {
  it('extracts h1 title', () => {
    expect(extractTitle('# My Title\n\nSome content')).toBe('My Title')
  })

  it('returns Documentation fallback when no h1', () => {
    expect(extractTitle('## Only h2\n\nNo h1 here')).toBe('Documentation')
  })

  it('strips HTML comments from title', () => {
    expect(extractTitle('# Title <!-- omit in toc -->\n\nContent')).toBe('Title')
  })

  it('handles h1 not on first line', () => {
    expect(extractTitle('Some preamble\n\n# Actual Title')).toBe('Actual Title')
  })

  it('returns Documentation for empty content', () => {
    expect(extractTitle('')).toBe('Documentation')
  })
})

describe('mdPathToSlug', () => {
  it('converts a simple .md file', () => {
    expect(mdPathToSlug('faqs.md')).toBe('/docs/faqs')
  })

  it('converts a nested .md file', () => {
    expect(mdPathToSlug('features/feature-crash-reporting.md')).toBe('/docs/features/feature-crash-reporting')
  })

  it('converts README.md to /docs', () => {
    expect(mdPathToSlug('README.md')).toBe('/docs')
  })

  it('converts nested README.md to directory slug', () => {
    expect(mdPathToSlug('hosting/README.md')).toBe('/docs/hosting')
  })

  it('converts deeply nested README.md', () => {
    expect(mdPathToSlug('sdk-upgrade-guides/android/README.md')).toBe('/docs/sdk-upgrade-guides/android')
  })

  it('strips fragment identifiers', () => {
    expect(mdPathToSlug('features/feature-crash-reporting.md#setup')).toBe('/docs/features/feature-crash-reporting')
  })

  it('strips leading ./', () => {
    expect(mdPathToSlug('./faqs.md')).toBe('/docs/faqs')
  })

  it('strips leading ./ with nested path', () => {
    expect(mdPathToSlug('./hosting/README.md')).toBe('/docs/hosting')
  })
})

describe('getTitleFromFile', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('returns h1 title from a markdown file', () => {
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue('# Crash Reporting\n\nSome content')

    expect(getTitleFromFile('/docs', 'features/feature-crash-reporting.md')).toBe('Crash Reporting')
    expect(fs.readFileSync).toHaveBeenCalledWith(
      path.join('/docs', 'features/feature-crash-reporting.md'),
      'utf-8'
    )
  })

  it('returns null for a missing file', () => {
    fs.existsSync.mockReturnValue(false)

    expect(getTitleFromFile('/docs', 'nonexistent.md')).toBeNull()
  })

  it('returns null for a file without h1', () => {
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue('## Only h2\n\nNo title here')

    expect(getTitleFromFile('/docs', 'no-title.md')).toBeNull()
  })

  it('strips HTML comments from title', () => {
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue('# My Title <!-- omit in toc -->\n\nContent')

    expect(getTitleFromFile('/docs', 'file.md')).toBe('My Title')
  })

  it('strips leading ./ from path', () => {
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockReturnValue('# Title\n\nContent')

    getTitleFromFile('/docs', './some-file.md')
    expect(fs.readFileSync).toHaveBeenCalledWith(
      path.join('/docs', 'some-file.md'),
      'utf-8'
    )
  })
})

describe('parseDirectoryNav', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('returns empty array when README.md is missing', () => {
    fs.existsSync.mockReturnValue(false)

    expect(parseDirectoryNav('/docs', 'missing-dir')).toEqual([])
  })

  it('parses links from a subdirectory README', () => {
    fs.existsSync.mockImplementation((p) => {
      if (p.endsWith('hosting/README.md')) return true
      if (p.endsWith('install.md')) return true
      if (p.endsWith('upgrade.md')) return true
      return false
    })
    fs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('hosting/README.md')) {
        return [
          '# Self-Hosting Guide',
          '',
          '* [**Install**](install.md)',
          '* [**Upgrade**](upgrade.md)',
        ].join('\n')
      }
      if (p.endsWith('install.md')) return '# Installation\n\nContent'
      if (p.endsWith('upgrade.md')) return '# Upgrading\n\nContent'
      return ''
    })
    fs.readdirSync.mockReturnValue([
      { name: 'README.md', isFile: () => true, isDirectory: () => false },
      { name: 'install.md', isFile: () => true, isDirectory: () => false },
      { name: 'upgrade.md', isFile: () => true, isDirectory: () => false },
    ])

    const result = parseDirectoryNav('/docs', 'hosting')

    expect(result).toEqual([
      { title: 'Installation', slug: '/docs/hosting/install' },
      { title: 'Upgrading', slug: '/docs/hosting/upgrade' },
    ])
  })

  it('skips external links, anchors, and parent links', () => {
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('mydir/README.md')) {
        return [
          '# My Dir',
          '* [External](https://example.com/foo.md)',
          '* [Anchor](#section)',
          '* [Parent](../other.md)',
        ].join('\n')
      }
      return ''
    })
    fs.readdirSync.mockReturnValue([
      { name: 'README.md', isFile: () => true, isDirectory: () => false },
    ])

    const result = parseDirectoryNav('/docs', 'mydir')

    expect(result).toEqual([])
  })

  it('appends unlisted .md files not in the README', () => {
    fs.existsSync.mockImplementation((p) => {
      if (p.endsWith('subdir/README.md')) return true
      if (p.endsWith('extra.md')) return true
      return false
    })
    fs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('subdir/README.md')) return '# Sub Dir\n\nNo links here'
      if (p.endsWith('extra.md')) return '# Extra Page\n\nContent'
      return ''
    })
    fs.readdirSync.mockReturnValue([
      { name: 'README.md', isFile: () => true, isDirectory: () => false },
      { name: 'extra.md', isFile: () => true, isDirectory: () => false },
    ])

    const result = parseDirectoryNav('/docs', 'subdir')

    expect(result).toEqual([
      { title: 'Extra Page', slug: '/docs/subdir/extra' },
    ])
  })

  it('skips assets directory entries', () => {
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('subdir/README.md')) return '# Sub\n\nContent'
      return ''
    })
    fs.readdirSync.mockReturnValue([
      { name: 'README.md', isFile: () => true, isDirectory: () => false },
      { name: 'assets', isFile: () => false, isDirectory: () => true },
    ])

    const result = parseDirectoryNav('/docs', 'subdir')

    expect(result).toEqual([])
  })

  it('does not duplicate slugs from README links and filesystem', () => {
    fs.existsSync.mockReturnValue(true)
    fs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('subdir/README.md')) {
        return '# Sub\n\n* [**Page**](page.md)'
      }
      if (p.endsWith('page.md')) return '# Page Title\n\nContent'
      return ''
    })
    fs.readdirSync.mockReturnValue([
      { name: 'README.md', isFile: () => true, isDirectory: () => false },
      { name: 'page.md', isFile: () => true, isDirectory: () => false },
    ])

    const result = parseDirectoryNav('/docs', 'subdir')

    expect(result).toEqual([
      { title: 'Page Title', slug: '/docs/subdir/page' },
    ])
  })

  it('handles nested README links as directory groups', () => {
    fs.existsSync.mockImplementation((p) => {
      if (p.endsWith('parent/README.md')) return true
      if (p.endsWith('parent/child/README.md')) return true
      if (p.endsWith('child/item.md')) return true
      return false
    })
    fs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('parent/README.md')) {
        return '# Parent\n\n* [**Child**](child/README.md)'
      }
      if (p.endsWith('parent/child/README.md')) {
        return '# Child Dir\n\n* [**Item**](item.md)'
      }
      if (p.endsWith('item.md')) return '# My Item\n\nContent'
      return ''
    })
    fs.readdirSync.mockImplementation((p) => {
      if (p.endsWith('/parent/child')) {
        return [
          { name: 'README.md', isFile: () => true, isDirectory: () => false },
          { name: 'item.md', isFile: () => true, isDirectory: () => false },
        ]
      }
      // parent directory
      return [
        { name: 'README.md', isFile: () => true, isDirectory: () => false },
        { name: 'child', isFile: () => false, isDirectory: () => true },
      ]
    })

    const result = parseDirectoryNav('/docs', 'parent')

    expect(result).toEqual([
      {
        title: 'Child Dir',
        children: [
          { title: 'Overview', slug: '/docs/parent/child' },
          { title: 'My Item', slug: '/docs/parent/child/item' },
        ],
      },
    ])
  })
})

describe('generateDocsNav', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('creates a Features group from Explore Features section', () => {
    fs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('README.md') && !p.includes('features')) {
        return [
          '# Explore Features',
          '',
          '* [**Session Timelines**](features/feature-session-timelines.md)',
          '* [**Crash Reporting**](features/feature-crash-reporting.md)',
        ].join('\n')
      }
      if (p.includes('session-timelines')) return '# Session Timeline\nContent'
      if (p.includes('crash-reporting')) return '# Crash Reporting\nContent'
      return ''
    })
    fs.existsSync.mockReturnValue(true)

    const nav = generateDocsNav('/docs')

    expect(nav).toEqual([
      {
        title: 'Features',
        children: [
          { title: 'Session Timeline', slug: '/docs/features/feature-session-timelines' },
          { title: 'Crash Reporting', slug: '/docs/features/feature-crash-reporting' },
        ],
      },
    ])
  })

  it('handles indented bullet children for nested groups', () => {
    fs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('README.md') && !p.includes('features')) {
        return [
          '# Explore Features',
          '',
          '* **Bug Reporting** — report bugs',
          '    * [**Android**](features/feature-bug-report-android.md)',
          '    * [**iOS**](features/feature-bug-report-ios.md)',
        ].join('\n')
      }
      if (p.includes('bug-report-android')) return '# Bug Report Android\nContent'
      if (p.includes('bug-report-ios')) return '# Bug Report iOS\nContent'
      return ''
    })
    fs.existsSync.mockReturnValue(true)

    const nav = generateDocsNav('/docs')

    expect(nav[0].title).toBe('Features')
    expect(nav[0].children).toEqual([
      {
        title: 'Bug Reporting',
        children: [
          { title: 'Bug Report Android', slug: '/docs/features/feature-bug-report-android' },
          { title: 'Bug Report iOS', slug: '/docs/features/feature-bug-report-ios' },
        ],
      },
    ])
  })

  it('handles inline links for non-feature sections', () => {
    fs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('README.md') && !p.includes('features')) {
        return [
          '# Configuration Options',
          '',
          'Read more about [Configuration Options](features/configuration-options.md).',
        ].join('\n')
      }
      if (p.includes('configuration-options')) return '# Configuration Options\nContent'
      return ''
    })
    fs.existsSync.mockReturnValue(true)

    const nav = generateDocsNav('/docs')

    expect(nav).toEqual([
      { title: 'Configuration Options', slug: '/docs/features/configuration-options' },
    ])
  })

  it('appends Further Reading links after body sections', () => {
    fs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('README.md') && !p.includes('hosting') && !p.includes('features')) {
        return [
          '# Integrate the SDK',
          '',
          'Check out the [SDK Integration Guide](sdk-integration-guide.md) to learn.',
          '',
          '**Further Reading**',
          '',
          '* [**FAQs**](faqs.md)',
        ].join('\n')
      }
      if (p.includes('sdk-integration-guide')) return '# Getting Started\nContent'
      if (p.includes('faqs')) return '# FAQs\nContent'
      return ''
    })
    fs.existsSync.mockReturnValue(true)

    const nav = generateDocsNav('/docs')

    // Inline link from "Integrate the SDK" section
    expect(nav[0]).toEqual({ title: 'Getting Started', slug: '/docs/sdk-integration-guide' })
    // Further Reading appended after
    expect(nav[1]).toEqual({ title: 'FAQs', slug: '/docs/faqs' })
  })

  it('handles Further Reading directory links with children', () => {
    fs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('/docs/README.md')) {
        return [
          '**Further Reading**',
          '',
          '* [**Self-Hosting Guide**](hosting/README.md)',
        ].join('\n')
      }
      if (p.endsWith('hosting/README.md')) {
        return '# Self-Hosting Guide\n\n* [**Install**](install.md)'
      }
      if (p.includes('install.md')) return '# Installation\nContent'
      return ''
    })
    fs.existsSync.mockReturnValue(true)
    fs.readdirSync.mockReturnValue([
      { name: 'README.md', isFile: () => true, isDirectory: () => false },
      { name: 'install.md', isFile: () => true, isDirectory: () => false },
    ])

    const nav = generateDocsNav('/docs')

    expect(nav).toEqual([
      {
        title: 'Self-Hosting Guide',
        children: [
          { title: 'Overview', slug: '/docs/hosting' },
          { title: 'Installation', slug: '/docs/hosting/install' },
        ],
      },
    ])
  })

  it('skips ### sub-headings', () => {
    fs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('README.md')) {
        return [
          '### Table of Contents',
          '',
          '* [**Integrate the SDK**](#integrate-the-sdk)',
          '',
          '# Integrate the SDK',
          '',
          'Check [SDK Guide](sdk-integration-guide.md).',
        ].join('\n')
      }
      if (p.includes('sdk-integration-guide')) return '# Getting Started\nContent'
      return ''
    })
    fs.existsSync.mockReturnValue(true)

    const nav = generateDocsNav('/docs')

    // Should only have one entry, not treat "Table of Contents" as a section
    expect(nav).toEqual([
      { title: 'Getting Started', slug: '/docs/sdk-integration-guide' },
    ])
  })

  it('does not process the same inline section twice', () => {
    fs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('README.md')) {
        return [
          '# Performance Impact',
          '',
          'Read the [Performance Impact](features/performance-impact.md) docs.',
          'Also see [Performance Impact](features/performance-impact.md) here.',
        ].join('\n')
      }
      if (p.includes('performance-impact')) return '# Performance Impact\nContent'
      return ''
    })
    fs.existsSync.mockReturnValue(true)

    const nav = generateDocsNav('/docs')

    expect(nav).toEqual([
      { title: 'Performance Impact', slug: '/docs/features/performance-impact' },
    ])
  })

  it('uses fallback title from link text when file has no h1', () => {
    fs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('README.md')) {
        return [
          '# Explore Features',
          '',
          '* [**My Feature**](features/no-h1.md)',
        ].join('\n')
      }
      if (p.includes('no-h1')) return 'No heading here, just content'
      return ''
    })
    fs.existsSync.mockReturnValue(true)

    const nav = generateDocsNav('/docs')

    expect(nav[0].children[0].title).toBe('My Feature')
  })

  it('returns empty array for README with no sections or links', () => {
    fs.readFileSync.mockReturnValue('Just some text with no links or headings.')
    fs.existsSync.mockReturnValue(true)

    const nav = generateDocsNav('/docs')

    expect(nav).toEqual([])
  })
})

describe('generateSearchIndex', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('indexes markdown files with title, headings, and content', () => {
    fs.readdirSync.mockReturnValue([
      { name: 'guide.md', isFile: () => true, isDirectory: () => false },
    ])
    fs.readFileSync.mockReturnValue([
      '# My Guide',
      '',
      '## Setup',
      '',
      'Install the package.',
      '',
      '### Advanced',
      '',
      'More details.',
    ].join('\n'))

    const index = generateSearchIndex('/docs')

    expect(index).toHaveLength(1)
    expect(index[0].slug).toBe('/guide')
    expect(index[0].title).toBe('My Guide')
    expect(index[0].headings).toEqual(['Setup', 'Advanced'])
    expect(index[0].content).toContain('Install the package.')
    expect(index[0].content).toContain('More details.')
  })

  it('strips HTML comments from content', () => {
    fs.readdirSync.mockReturnValue([
      { name: 'page.md', isFile: () => true, isDirectory: () => false },
    ])
    fs.readFileSync.mockReturnValue('# Title\n\nVisible <!-- hidden --> text')

    const index = generateSearchIndex('/docs')

    expect(index[0].content).not.toContain('hidden')
    expect(index[0].content).toContain('Visible')
    expect(index[0].content).toContain('text')
  })

  it('strips HTML comments from headings', () => {
    fs.readdirSync.mockReturnValue([
      { name: 'page.md', isFile: () => true, isDirectory: () => false },
    ])
    fs.readFileSync.mockReturnValue('# Title\n\n## Contents <!-- omit in toc -->\n\nBody')

    const index = generateSearchIndex('/docs')

    expect(index[0].headings).toEqual(['Contents'])
  })

  it('uses directory slug for README.md files', () => {
    fs.readdirSync
      .mockReturnValueOnce([
        { name: 'hosting', isFile: () => false, isDirectory: () => true },
      ])
      .mockReturnValueOnce([
        { name: 'README.md', isFile: () => true, isDirectory: () => false },
      ])
    fs.readFileSync.mockReturnValue('# Hosting\n\nContent')

    const index = generateSearchIndex('/docs')

    expect(index[0].slug).toBe('/hosting')
  })

  it('skips assets directories', () => {
    fs.readdirSync.mockReturnValue([
      { name: 'assets', isFile: () => false, isDirectory: () => true },
      { name: 'page.md', isFile: () => true, isDirectory: () => false },
    ])
    fs.readFileSync.mockReturnValue('# Page\n\nContent')

    const index = generateSearchIndex('/docs')

    expect(index).toHaveLength(1)
    expect(index[0].slug).toBe('/page')
  })

  it('strips frontmatter', () => {
    fs.readdirSync.mockReturnValue([
      { name: 'page.md', isFile: () => true, isDirectory: () => false },
    ])
    fs.readFileSync.mockReturnValue('---\ntitle: Meta Title\n---\n# Real Title\n\nBody')

    const index = generateSearchIndex('/docs')

    expect(index[0].title).toBe('Real Title')
    expect(index[0].content).not.toContain('Meta Title')
  })

  it('strips markdown link syntax but keeps text', () => {
    fs.readdirSync.mockReturnValue([
      { name: 'page.md', isFile: () => true, isDirectory: () => false },
    ])
    fs.readFileSync.mockReturnValue('# Title\n\nSee [the docs](https://example.com) for more.')

    const index = generateSearchIndex('/docs')

    expect(index[0].content).toContain('the docs')
    expect(index[0].content).not.toContain('https://example.com')
  })

  it('strips markdown formatting characters', () => {
    fs.readdirSync.mockReturnValue([
      { name: 'page.md', isFile: () => true, isDirectory: () => false },
    ])
    fs.readFileSync.mockReturnValue('# Title\n\nThis is **bold** and *italic* and `code`')

    const index = generateSearchIndex('/docs')

    expect(index[0].content).toContain('This is bold and italic and code')
  })
})

describe('stripSearchContent', () => {
  it('returns empty string for empty input', () => {
    expect(stripSearchContent('')).toBe('')
  })

  it('strips fenced code blocks entirely', () => {
    const md = 'Before\n\n```kotlin\nMeasure.init()\n```\n\nAfter'
    expect(stripSearchContent(md)).toBe('Before After')
  })

  it('strips multi-line fenced code blocks with language tags', () => {
    const md = [
      'Intro',
      '',
      '```dart',
      'void main() {',
      '  runApp(MyApp());',
      '}',
      '```',
      '',
      'Outro',
    ].join('\n')
    expect(stripSearchContent(md)).toBe('Intro Outro')
  })

  it('strips headings of all levels', () => {
    const md = '# H1\n\n## H2\n\n### H3\n\nbody\n\n#### H4\n\nmore body'
    expect(stripSearchContent(md)).toBe('body more body')
  })

  it('strips raw HTML tags but keeps inner text', () => {
    const md = '<details><summary>Self-host Compatibility</summary>Body</details>'
    const out = stripSearchContent(md)
    expect(out).not.toContain('<')
    expect(out).not.toContain('>')
    expect(out).toContain('Self-host Compatibility')
    expect(out).toContain('Body')
  })

  it('strips <br> and other void HTML tags', () => {
    expect(stripSearchContent('Line 1<br />Line 2')).toBe('Line 1Line 2')
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

  it('strips image syntax (alt text and src)', () => {
    expect(stripSearchContent('See ![Cool diagram](img.png) below')).toBe(
      'See below',
    )
  })

  it('unwraps markdown links to keep only the visible text', () => {
    expect(
      stripSearchContent('Read [the docs](https://example.com) for more.'),
    ).toBe('Read the docs for more.')
  })

  it('strips GFM callout markers but keeps the body text', () => {
    const md = '> [!NOTE]\n> Some note text'
    expect(stripSearchContent(md)).toBe('Some note text')
  })

  it('strips all five GFM callout types', () => {
    for (const kind of ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']) {
      const md = `> [!${kind}]\n> Body for ${kind}`
      const out = stripSearchContent(md)
      expect(out).not.toContain(`[!${kind}]`)
      expect(out).toContain(`Body for ${kind}`)
    }
  })

  it('strips callout markers regardless of case', () => {
    expect(stripSearchContent('[!note] x')).not.toContain('[!')
    expect(stripSearchContent('[!Tip] x')).not.toContain('[!')
  })

  it('strips emphasis, strong, code, and strikethrough markers', () => {
    expect(stripSearchContent('**bold** *italic* `code` ~strike~')).toBe(
      'bold italic code strike',
    )
  })

  it('strips list bullets (-, *, +)', () => {
    const md = '- one\n* two\n+ three'
    expect(stripSearchContent(md)).toBe('one two three')
  })

  it('strips blockquote markers', () => {
    expect(stripSearchContent('> quoted text')).toBe('quoted text')
  })

  it('replaces table pipes with spaces', () => {
    const md = '| Col A | Col B |\n| --- | --- |\n| Val 1 | Val 2 |'
    const out = stripSearchContent(md)
    expect(out).not.toContain('|')
    expect(out).toContain('Col A')
    expect(out).toContain('Col B')
    expect(out).toContain('Val 1')
  })

  it('strips HTML comments', () => {
    expect(stripSearchContent('Before <!-- hidden --> after')).toBe(
      'Before after',
    )
  })

  it('collapses multiple whitespace into a single space', () => {
    expect(stripSearchContent('a    b\n\n\nc')).toBe('a b c')
  })

  it('handles a realistic mixed-syntax markdown block end-to-end', () => {
    const md = [
      '# Bug Reports — Android',
      '',
      '* [Session Timeline](#session-timeline)',
      '* [Built-in Experience](#built-in-experience)',
      '',
      '> [!NOTE]',
      '> Use **Measure.launchBugReportActivity** to start the flow.',
      '',
      '```kotlin',
      'Measure.launchBugReportActivity(activity)',
      '```',
      '',
      '| Mode | Dark | Light |',
      '| --- | --- | --- |',
      '| Default | ![](dark.png) | ![](light.png) |',
      '',
      '<details><summary>More</summary>Extra info</details>',
    ].join('\n')
    const out = stripSearchContent(md)
    expect(out).not.toMatch(/```|<|>|\||\[!|!\[/)
    expect(out).not.toContain('Bug Reports — Android') // heading stripped
    expect(out).toContain('Session Timeline')
    expect(out).toContain('Use Measure.launchBugReportActivity to start the flow.')
    expect(out).toContain('Mode')
    expect(out).toContain('Default')
    expect(out).toContain('Extra info')
  })
})
