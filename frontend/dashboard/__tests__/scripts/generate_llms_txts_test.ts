import { afterAll, beforeAll, describe, expect, it } from '@jest/globals'
import fs from 'fs'
import os from 'os'
import path from 'path'

const {
  slugToFilePath,
  flattenNavSlugs,
  generateLlmsTxt,
  generateLlmsFullTxt,
  rewriteRelativeLinks,
} = require('@/scripts/generate_llms_txts')

// ─── Fixtures ──────────────────────────────────────────────────────────────

let tmpDir: string

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'copy_docs_test_'))

  // README.md (root)
  fs.writeFileSync(
    path.join(tmpDir, 'README.md'),
    '# Documentation\n\nOverview content here.\n\nSee [Guide](guide.md) for more.'
  )

  // guide.md with relative links and images
  fs.writeFileSync(
    path.join(tmpDir, 'guide.md'),
    '# Guide\n\nSome [link](features/foo.md) to foo.\n\n![screenshot](assets/pic.png)\n\nAlso see [bar](features/bar.md#setup).'
  )

  // features/
  fs.mkdirSync(path.join(tmpDir, 'features'))
  fs.writeFileSync(
    path.join(tmpDir, 'features', 'README.md'),
    '# Features\n\n* [Foo](foo.md)\n* [Bar](bar.md)'
  )
  fs.writeFileSync(
    path.join(tmpDir, 'features', 'foo.md'),
    '# Foo Feature\n\n<!-- internal comment -->\n\nFoo content here.'
  )
  fs.writeFileSync(
    path.join(tmpDir, 'features', 'bar.md'),
    '# Bar Feature\n\nBar content here.\n\nSee [Foo](foo.md) for related info.'
  )
})

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

// ─── slugToFilePath ────────────────────────────────────────────────────────

describe('slugToFilePath', () => {
  it('returns root README.md for /docs slug', () => {
    const result = slugToFilePath(tmpDir, '/docs')

    expect(result).toBe(path.join(tmpDir, 'README.md'))
  })

  it('returns root README.md for /docs/ slug with trailing slash', () => {
    const result = slugToFilePath(tmpDir, '/docs/')

    expect(result).toBe(path.join(tmpDir, 'README.md'))
  })

  it('returns direct .md file when it exists', () => {
    const result = slugToFilePath(tmpDir, '/docs/guide')

    expect(result).toBe(path.join(tmpDir, 'guide.md'))
  })

  it('falls back to README.md inside directory', () => {
    const result = slugToFilePath(tmpDir, '/docs/features')

    expect(result).toBe(path.join(tmpDir, 'features', 'README.md'))
  })

  it('resolves nested file paths', () => {
    const result = slugToFilePath(tmpDir, '/docs/features/foo')

    expect(result).toBe(path.join(tmpDir, 'features', 'foo.md'))
  })

  it('returns null for non-existent slug', () => {
    const result = slugToFilePath(tmpDir, '/docs/nonexistent')

    expect(result).toBeNull()
  })

  it('returns null for non-existent nested slug', () => {
    const result = slugToFilePath(tmpDir, '/docs/features/nonexistent')

    expect(result).toBeNull()
  })
})

// ─── flattenNavSlugs ───────────────────────────────────────────────────────

describe('flattenNavSlugs', () => {
  it('returns ["/docs"] for empty nav', () => {
    const result = flattenNavSlugs([])

    expect(result).toEqual(['/docs'])
  })

  it('flattens single-level items', () => {
    const nav = [
      { title: 'A', slug: '/docs/a' },
      { title: 'B', slug: '/docs/b' },
    ]
    const result = flattenNavSlugs(nav)

    expect(result).toEqual(['/docs', '/docs/a', '/docs/b'])
  })

  it('recursively flattens nested children', () => {
    const nav = [
      {
        title: 'Group',
        children: [
          { title: 'A', slug: '/docs/a' },
          { title: 'B', slug: '/docs/b' },
        ],
      },
    ]
    const result = flattenNavSlugs(nav)

    expect(result).toEqual(['/docs', '/docs/a', '/docs/b'])
  })

  it('handles mixed items with and without children', () => {
    const nav = [
      { title: 'Solo', slug: '/docs/solo' },
      {
        title: 'Group',
        children: [
          { title: 'C1', slug: '/docs/c1' },
          { title: 'C2', slug: '/docs/c2' },
        ],
      },
      { title: 'Another', slug: '/docs/another' },
    ]
    const result = flattenNavSlugs(nav)

    expect(result).toEqual(['/docs', '/docs/solo', '/docs/c1', '/docs/c2', '/docs/another'])
  })

  it('handles deeply nested children', () => {
    const nav = [
      {
        title: 'L1',
        children: [
          {
            title: 'L2',
            children: [
              { title: 'L3', slug: '/docs/deep' },
            ],
          },
        ],
      },
    ]
    const result = flattenNavSlugs(nav)

    expect(result).toEqual(['/docs', '/docs/deep'])
  })

  it('skips items with neither slug nor children', () => {
    const nav = [
      { title: 'No slug or children' },
      { title: 'Has slug', slug: '/docs/a' },
    ]
    const result = flattenNavSlugs(nav)

    expect(result).toEqual(['/docs', '/docs/a'])
  })
})

// ─── generateLlmsTxt ──────────────────────────────────────────────────────

describe('generateLlmsTxt', () => {
  it('starts with # measure.sh heading', () => {
    const result = generateLlmsTxt([])

    expect(result).toMatch(/^# measure\.sh\n/)
  })

  it('contains blockquote description', () => {
    const result = generateLlmsTxt([])

    expect(result).toContain('> Open source tool to monitor mobile apps')
  })

  it('produces H2 sections for items with children', () => {
    const nav = [
      {
        title: 'Features',
        children: [
          { title: 'Crash Reporting', slug: '/docs/features/crash' },
          { title: 'ANR Reporting', slug: '/docs/features/anr' },
        ],
      },
    ]
    const result = generateLlmsTxt(nav)

    expect(result).toContain('## Features')
    expect(result).toContain('- [Crash Reporting](https://measure.sh/docs/features/crash)')
    expect(result).toContain('- [ANR Reporting](https://measure.sh/docs/features/anr)')
  })

  it('collects standalone items under ## Docs', () => {
    const nav = [
      { title: 'Guide', slug: '/docs/guide' },
      { title: 'FAQ', slug: '/docs/faq' },
    ]
    const result = generateLlmsTxt(nav)

    expect(result).toContain('## Docs')
    expect(result).toContain('- [Guide](https://measure.sh/docs/guide)')
    expect(result).toContain('- [FAQ](https://measure.sh/docs/faq)')
  })

  it('flattens nested grandchildren into the parent H2 section', () => {
    const nav = [
      {
        title: 'Features',
        children: [
          {
            title: 'Bug Reporting',
            children: [
              { title: 'Android', slug: '/docs/features/bug-android' },
              { title: 'iOS', slug: '/docs/features/bug-ios' },
            ],
          },
        ],
      },
    ]
    const result = generateLlmsTxt(nav)

    expect(result).toContain('## Features')
    expect(result).toContain('- [Android](https://measure.sh/docs/features/bug-android)')
    expect(result).toContain('- [iOS](https://measure.sh/docs/features/bug-ios)')
  })

  it('ends with ## Optional section linking to llms-full.txt', () => {
    const result = generateLlmsTxt([])

    expect(result).toContain('## Optional')
    expect(result).toContain('- [llms-full.txt](https://measure.sh/llms-full.txt)')
  })

  it('all URLs are absolute', () => {
    const nav = [
      { title: 'A', slug: '/docs/a' },
      {
        title: 'Group',
        children: [{ title: 'B', slug: '/docs/b' }],
      },
    ]
    const result = generateLlmsTxt(nav)

    const linkRegex = /\]\(([^)]+)\)/g
    let match
    while ((match = linkRegex.exec(result)) !== null) {
      expect(match[1]).toMatch(/^https:\/\/measure\.sh/)
    }
  })

  it('produces valid structure with empty nav', () => {
    const result = generateLlmsTxt([])

    expect(result).toContain('# measure.sh')
    expect(result).toContain('> ')
    expect(result).toContain('## Optional')
    expect(result).not.toContain('## Docs')
  })
})

// ─── rewriteRelativeLinks ──────────────────────────────────────────────────

describe('rewriteRelativeLinks', () => {
  it('rewrites relative .md links to absolute URLs', () => {
    const input = 'See [Crash Reporting](features/feature-crash-reporting.md) for details.'
    const result = rewriteRelativeLinks(input)

    expect(result).toBe(
      'See [Crash Reporting](https://measure.sh/docs/features/feature-crash-reporting) for details.'
    )
  })

  it('rewrites .md links with anchors', () => {
    const input = 'See [Config](features/configuration-options.md#sdk-options) for details.'
    const result = rewriteRelativeLinks(input)

    expect(result).toContain('https://measure.sh/docs/features/configuration-options')
  })

  it('rewrites relative image paths', () => {
    const input = '![screenshot](assets/pic.png)'
    const result = rewriteRelativeLinks(input)

    expect(result).toBe('![screenshot](https://measure.sh/docs/assets/pic.png)')
  })

  it('rewrites image paths with ./ prefix', () => {
    const input = '![screenshot](./assets/pic.png)'
    const result = rewriteRelativeLinks(input)

    expect(result).toBe('![screenshot](https://measure.sh/docs/assets/pic.png)')
  })

  it('does not rewrite absolute URLs', () => {
    const input = 'See [GitHub](https://github.com/example/repo) for source.'
    const result = rewriteRelativeLinks(input)

    expect(result).toBe(input)
  })

  it('does not rewrite anchor-only links', () => {
    const input = 'See [section](#some-section) above.'
    const result = rewriteRelativeLinks(input)

    expect(result).toBe(input)
  })

  it('handles README.md links', () => {
    const input = 'See [Hosting](hosting/README.md) for details.'
    const result = rewriteRelativeLinks(input)

    expect(result).toBe('See [Hosting](https://measure.sh/docs/hosting) for details.')
  })

  it('handles multiple links in the same line', () => {
    const input = 'See [A](a.md) and [B](b.md).'
    const result = rewriteRelativeLinks(input)

    expect(result).toContain('https://measure.sh/docs/a')
    expect(result).toContain('https://measure.sh/docs/b')
  })
})

// ─── generateLlmsFullTxt ──────────────────────────────────────────────────

describe('generateLlmsFullTxt', () => {
  const simpleNav = [
    { title: 'Guide', slug: '/docs/guide' },
    {
      title: 'Features',
      children: [
        { title: 'Foo', slug: '/docs/features/foo' },
        { title: 'Bar', slug: '/docs/features/bar' },
      ],
    },
  ]

  it('starts with the root doc', () => {
    const result = generateLlmsFullTxt(tmpDir, simpleNav)

    expect(result).toMatch(/^---\nSource: https:\/\/measure\.sh\/docs\n---/)
    expect(result).toContain('# Documentation')
  })

  it('includes all docs in nav order', () => {
    const result = generateLlmsFullTxt(tmpDir, simpleNav)
    const sourceLines = result.match(/Source: .+/g) || []
    const sources = sourceLines.map((l: string) => l.replace('Source: ', ''))

    expect(sources).toEqual([
      'https://measure.sh/docs',
      'https://measure.sh/docs/guide',
      'https://measure.sh/docs/features/foo',
      'https://measure.sh/docs/features/bar',
    ])
  })

  it('separates docs with --- markers', () => {
    const result = generateLlmsFullTxt(tmpDir, simpleNav)
    const separators = result.match(/^---$/gm) || []

    // Each doc has opening and closing --- lines (2 per doc)
    expect(separators.length).toBe(8) // 4 docs * 2
  })

  it('strips HTML comments from content', () => {
    const result = generateLlmsFullTxt(tmpDir, simpleNav)

    expect(result).not.toContain('<!-- internal comment -->')
    expect(result).toContain('Foo content here.')
  })

  it('rewrites relative .md links to absolute URLs', () => {
    const result = generateLlmsFullTxt(tmpDir, simpleNav)

    expect(result).not.toMatch(/\]\([^)]*\.md\)/)
    expect(result).toContain('https://measure.sh/docs/features/foo')
  })

  it('rewrites relative image paths to absolute URLs', () => {
    const result = generateLlmsFullTxt(tmpDir, simpleNav)

    expect(result).not.toContain('](assets/')
    expect(result).toContain('https://measure.sh/docs/assets/pic.png')
  })

  it('does not crash on non-existent slugs', () => {
    const nav = [{ title: 'Missing', slug: '/docs/nonexistent' }]
    const result = generateLlmsFullTxt(tmpDir, nav)

    // Should still have the root doc
    expect(result).toContain('Source: https://measure.sh/docs')
    // Should not have the missing doc
    expect(result).not.toContain('Source: https://measure.sh/docs/nonexistent')
  })

  it('deduplicates slugs', () => {
    const nav = [
      { title: 'Guide', slug: '/docs/guide' },
      { title: 'Guide Again', slug: '/docs/guide' },
    ]
    const result = generateLlmsFullTxt(tmpDir, nav)
    const guideMatches = result.match(/Source: https:\/\/measure\.sh\/docs\/guide$/gm) || []

    expect(guideMatches.length).toBe(1)
  })

  it('produces output with empty nav (root doc only)', () => {
    const result = generateLlmsFullTxt(tmpDir, [])

    expect(result).toContain('Source: https://measure.sh/docs')
    expect(result).toContain('# Documentation')
  })
})
