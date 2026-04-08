import { afterAll, beforeAll, describe, expect, it } from '@jest/globals'
import fs from 'fs'
import os from 'os'
import path from 'path'

const {
    stripHtmlComments,
    extractTitle,
    mdPathToSlug,
    getTitleFromFile,
    parseDirectoryNav,
    generateDocsNav,
    generateSearchIndex,
} = require('@/scripts/copy_docs')

// ─── Fixtures ──────────────────────────────────────────────────────────────

let tmpDir: string

beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'copy_docs_test_'))

    // Root README.md with sections matching generateDocsNav's parser
    fs.writeFileSync(
        path.join(tmpDir, 'README.md'),
        [
            '# Documentation',
            '',
            '# Integrate the SDK',
            '',
            'Read the [SDK Integration Guide](sdk-integration-guide.md) to get started.',
            '',
            '# Explore Features',
            '',
            '* [Crash Reporting](features/feature-crash-reporting.md)',
            '* [ANR Reporting](features/feature-anr-reporting.md)',
            '* **Bug Reporting**',
            '  * [Android](features/feature-bug-reporting-android.md)',
            '  * [iOS](features/feature-bug-reporting-ios.md)',
            '',
            '# Configuration Options',
            '',
            'See [Configuration](features/configuration-options.md) for details.',
            '',
            '**Further Reading**',
            '',
            '* [Hosting](hosting/README.md)',
            '* [FAQs](faqs.md)',
        ].join('\n')
    )

    // sdk-integration-guide.md
    fs.writeFileSync(
        path.join(tmpDir, 'sdk-integration-guide.md'),
        '# SDK Integration Guide\n\nIntegration content.'
    )

    // faqs.md
    fs.writeFileSync(
        path.join(tmpDir, 'faqs.md'),
        '# FAQs\n\n## How do I start?\n\nJust install the SDK.\n\n## What platforms?\n\nAndroid and iOS.'
    )

    // features/
    fs.mkdirSync(path.join(tmpDir, 'features'))
    fs.writeFileSync(
        path.join(tmpDir, 'features', 'feature-crash-reporting.md'),
        '# Crash Reporting\n\nCrash content here.'
    )
    fs.writeFileSync(
        path.join(tmpDir, 'features', 'feature-anr-reporting.md'),
        '# ANR Reporting\n\nANR content here.'
    )
    fs.writeFileSync(
        path.join(tmpDir, 'features', 'feature-bug-reporting-android.md'),
        '# Bug Reporting (Android)\n\nAndroid bug content.'
    )
    fs.writeFileSync(
        path.join(tmpDir, 'features', 'feature-bug-reporting-ios.md'),
        '# Bug Reporting (iOS)\n\niOS bug content.'
    )
    fs.writeFileSync(
        path.join(tmpDir, 'features', 'configuration-options.md'),
        '# Configuration Options\n\nConfig content.'
    )
    // An unlinked .md file in features/ (should be picked up by parseDirectoryNav)
    fs.writeFileSync(
        path.join(tmpDir, 'features', 'unlisted-feature.md'),
        '# Unlisted Feature\n\nThis is not linked from README.'
    )

    // hosting/ with README and children
    fs.mkdirSync(path.join(tmpDir, 'hosting'))
    fs.writeFileSync(
        path.join(tmpDir, 'hosting', 'README.md'),
        '# Hosting\n\n* [Self Hosting](self-hosting.md)\n* [Docker](docker.md)'
    )
    fs.writeFileSync(
        path.join(tmpDir, 'hosting', 'self-hosting.md'),
        '# Self Hosting\n\nSelf hosting guide.'
    )
    fs.writeFileSync(
        path.join(tmpDir, 'hosting', 'docker.md'),
        '# Docker\n\nDocker guide.'
    )

    // assets/ directory (should be skipped)
    fs.mkdirSync(path.join(tmpDir, 'assets'))
    fs.writeFileSync(path.join(tmpDir, 'assets', 'image.png'), 'fake image')
})

afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
})

// ─── stripHtmlComments ──────────────────────────────────────────────────────

describe('stripHtmlComments', () => {
    it('strips single-line comments', () => {
        expect(stripHtmlComments('Hello <!-- omit --> World')).toBe('Hello  World')
    })

    it('strips multi-line comments', () => {
        expect(stripHtmlComments('Before\n<!-- multi\nline -->\nAfter')).toBe('Before\n\nAfter')
    })

    it('returns unchanged text without comments', () => {
        expect(stripHtmlComments('No comments')).toBe('No comments')
    })

    it('handles empty string', () => {
        expect(stripHtmlComments('')).toBe('')
    })
})

// ─── extractTitle ──────────────────────────────────────────────────────────

describe('extractTitle', () => {
    it('extracts h1 heading', () => {
        expect(extractTitle('# My Title\n\nContent')).toBe('My Title')
    })

    it('returns "Documentation" when no h1 found', () => {
        expect(extractTitle('Just text')).toBe('Documentation')
    })

    it('strips HTML comments from title', () => {
        expect(extractTitle('# My Title <!-- omit in toc -->')).toBe('My Title')
    })
})

// ─── mdPathToSlug ──────────────────────────────────────────────────────────

describe('mdPathToSlug', () => {
    it('converts .md file to slug', () => {
        expect(mdPathToSlug('features/feature-crash-reporting.md')).toBe('/docs/features/feature-crash-reporting')
    })

    it('converts README.md to directory slug', () => {
        expect(mdPathToSlug('hosting/README.md')).toBe('/docs/hosting')
    })

    it('converts root README.md to /docs', () => {
        expect(mdPathToSlug('README.md')).toBe('/docs')
    })

    it('strips ./ prefix', () => {
        expect(mdPathToSlug('./features/foo.md')).toBe('/docs/features/foo')
    })

    it('strips fragment from path', () => {
        expect(mdPathToSlug('features/foo.md#section')).toBe('/docs/features/foo')
    })
})

// ─── getTitleFromFile ──────────────────────────────────────────────────────

describe('getTitleFromFile', () => {
    it('reads h1 title from a file', () => {
        expect(getTitleFromFile(tmpDir, 'sdk-integration-guide.md')).toBe('SDK Integration Guide')
    })

    it('returns null for non-existent file', () => {
        expect(getTitleFromFile(tmpDir, 'nonexistent.md')).toBeNull()
    })

    it('returns null for file without h1', () => {
        const noH1 = path.join(tmpDir, 'no-h1.md')
        fs.writeFileSync(noH1, 'Just some text without a heading')
        expect(getTitleFromFile(tmpDir, 'no-h1.md')).toBeNull()
        fs.unlinkSync(noH1)
    })

    it('strips ./ prefix from path', () => {
        expect(getTitleFromFile(tmpDir, './sdk-integration-guide.md')).toBe('SDK Integration Guide')
    })
})

// ─── parseDirectoryNav ─────────────────────────────────────────────────────

describe('parseDirectoryNav', () => {
    it('parses links from directory README', () => {
        const children = parseDirectoryNav(tmpDir, 'hosting')

        expect(children.length).toBeGreaterThanOrEqual(2)
        const slugs = children.map((c: any) => c.slug)
        expect(slugs).toContain('/docs/hosting/self-hosting')
        expect(slugs).toContain('/docs/hosting/docker')
    })

    it('reads titles from linked files', () => {
        const children = parseDirectoryNav(tmpDir, 'hosting')
        const selfHosting = children.find((c: any) => c.slug === '/docs/hosting/self-hosting')

        expect(selfHosting.title).toBe('Self Hosting')
    })

    it('returns empty array when no README exists', () => {
        expect(parseDirectoryNav(tmpDir, 'nonexistent')).toEqual([])
    })
})

// ─── generateDocsNav ──────────────────────────────────────────────────────

describe('generateDocsNav', () => {
    it('generates nav tree from root README', () => {
        const nav = generateDocsNav(tmpDir)

        expect(nav.length).toBeGreaterThan(0)
    })

    it('creates Features group with children', () => {
        const nav = generateDocsNav(tmpDir)
        const features = nav.find((item: any) => item.title === 'Features')

        expect(features).toBeTruthy()
        expect(features.children.length).toBeGreaterThanOrEqual(2)
    })

    it('includes crash reporting as a feature child', () => {
        const nav = generateDocsNav(tmpDir)
        const features = nav.find((item: any) => item.title === 'Features')
        const crash = features.children.find((c: any) => c.slug === '/docs/features/feature-crash-reporting')

        expect(crash).toBeTruthy()
        expect(crash.title).toBe('Crash Reporting')
    })

    it('creates nested Bug Reporting group with platform children', () => {
        const nav = generateDocsNav(tmpDir)
        const features = nav.find((item: any) => item.title === 'Features')
        const bugReporting = features.children.find((c: any) => c.title === 'Bug Reporting')

        expect(bugReporting).toBeTruthy()
        expect(bugReporting.children).toBeTruthy()
        const slugs = bugReporting.children.map((c: any) => c.slug)
        expect(slugs).toContain('/docs/features/feature-bug-reporting-android')
        expect(slugs).toContain('/docs/features/feature-bug-reporting-ios')
    })

    it('includes inline-linked sections (Configuration Options)', () => {
        const nav = generateDocsNav(tmpDir)
        const config = nav.find((item: any) => item.slug === '/docs/features/configuration-options')

        expect(config).toBeTruthy()
    })

    it('includes Further Reading items (Hosting with children)', () => {
        const nav = generateDocsNav(tmpDir)
        const hosting = nav.find((item: any) => item.title === 'Hosting')

        expect(hosting).toBeTruthy()
        expect(hosting.children).toBeTruthy()
        expect(hosting.children.length).toBeGreaterThanOrEqual(2)
    })

    it('includes Further Reading items (FAQs as leaf)', () => {
        const nav = generateDocsNav(tmpDir)
        const faqs = nav.find((item: any) => item.slug === '/docs/faqs')

        expect(faqs).toBeTruthy()
        expect(faqs.title).toBe('FAQs')
    })
})

// ─── parseDirectoryNav (edge cases) ────────────────────────────────────────

describe('parseDirectoryNav edge cases', () => {
    let edgeDir: string

    beforeAll(() => {
        edgeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'copy_docs_edge_'))

        // Root with a README that has duplicate links, skippable links, and a nested subdir
        fs.mkdirSync(path.join(edgeDir, 'mydir'))
        fs.writeFileSync(
            path.join(edgeDir, 'mydir', 'README.md'),
            [
                '# My Dir',
                '',
                '* [Page A](page-a.md)',
                '* [Page A Again](page-a.md)',  // duplicate — should be skipped
                '* [Anchor](#some-section)',     // anchor link — should be skipped
                '* [External](https://example.com/foo.md)',  // http link — should be skipped
                '* [Parent](../other.md)',       // parent link — should be skipped
                '* [Sub Dir](subdir/README.md)', // nested dir with children
                '* [Empty Dir](emptydir/README.md)', // nested dir with no children
            ].join('\n')
        )
        fs.writeFileSync(path.join(edgeDir, 'mydir', 'page-a.md'), '# Page A\n\nContent A.')
        // An extra unlinked file
        fs.writeFileSync(path.join(edgeDir, 'mydir', 'extra.md'), '# Extra\n\nExtra content.')

        // Nested subdir
        fs.mkdirSync(path.join(edgeDir, 'mydir', 'subdir'))
        fs.writeFileSync(
            path.join(edgeDir, 'mydir', 'subdir', 'README.md'),
            '# Sub Dir\n\n* [Child](child.md)'
        )
        fs.writeFileSync(path.join(edgeDir, 'mydir', 'subdir', 'child.md'), '# Child Page\n\nChild content.')

        // Empty nested dir (README exists but no links to other .md files)
        fs.mkdirSync(path.join(edgeDir, 'mydir', 'emptydir'))
        fs.writeFileSync(
            path.join(edgeDir, 'mydir', 'emptydir', 'README.md'),
            '# Empty Dir\n\nNo links here.'
        )

        // A directory not linked from README but has its own README (should be picked up by directory scan)
        fs.mkdirSync(path.join(edgeDir, 'mydir', 'unseen-dir'))
        fs.writeFileSync(path.join(edgeDir, 'mydir', 'unseen-dir', 'README.md'), '# Unseen Dir\n\nContent.')
        fs.writeFileSync(path.join(edgeDir, 'mydir', 'unseen-dir', 'page.md'), '# Unseen Page\n\nContent.')
    })

    afterAll(() => {
        fs.rmSync(edgeDir, { recursive: true, force: true })
    })

    it('deduplicates links with the same slug', () => {
        const children = parseDirectoryNav(edgeDir, 'mydir')
        const pageASlugs = children.filter((c: any) => c.slug === '/docs/mydir/page-a')
        expect(pageASlugs).toHaveLength(1)
    })

    it('picks up unlinked .md files from directory', () => {
        const children = parseDirectoryNav(edgeDir, 'mydir')
        const extra = children.find((c: any) => c.slug === '/docs/mydir/extra')
        expect(extra).toBeTruthy()
        expect(extra.title).toBe('Extra')
    })

    it('creates nested children for subdirectory README links', () => {
        const children = parseDirectoryNav(edgeDir, 'mydir')
        const subDir = children.find((c: any) => c.title === 'Sub Dir')
        expect(subDir).toBeTruthy()
        expect(subDir.children).toBeTruthy()
        // Should have Overview + child
        const childPage = subDir.children.find((c: any) => c.slug === '/docs/mydir/subdir/child')
        expect(childPage).toBeTruthy()
    })

    it('skips anchor, http, and parent links', () => {
        const children = parseDirectoryNav(edgeDir, 'mydir')
        const slugs = children.map((c: any) => c.slug).filter(Boolean)
        // None of the skipped links should produce slugs
        expect(slugs).not.toContain('/docs/mydir/#some-section')
        // http and parent links should not produce any slugs
        for (const slug of slugs) {
            expect(slug.startsWith('/docs/')).toBe(true)
        }
    })

    it('treats README link with no children as leaf node', () => {
        const children = parseDirectoryNav(edgeDir, 'mydir')
        const emptyDir = children.find((c: any) => c.title === 'Empty Dir')
        expect(emptyDir).toBeTruthy()
        // No children → should be a leaf with slug, not a group
        expect(emptyDir.children).toBeUndefined()
        expect(emptyDir.slug).toBe('/docs/mydir/emptydir')
    })

    it('picks up unseen directories with README.md', () => {
        const children = parseDirectoryNav(edgeDir, 'mydir')
        const unseenDir = children.find((c: any) => c.title === 'Unseen Dir')
        expect(unseenDir).toBeTruthy()
        // Has children (Overview + page.md inside)
        expect(unseenDir.children).toBeTruthy()
    })
})

// ─── generateSearchIndex ──────────────────────────────────────────────────

describe('generateSearchIndex', () => {
    it('returns an array of search entries', () => {
        const entries = generateSearchIndex(tmpDir)

        expect(Array.isArray(entries)).toBe(true)
        expect(entries.length).toBeGreaterThan(0)
    })

    it('includes slug, title, headings, and content for each entry', () => {
        const entries = generateSearchIndex(tmpDir)

        for (const entry of entries) {
            expect(entry).toHaveProperty('slug')
            expect(entry).toHaveProperty('title')
            expect(entry).toHaveProperty('headings')
            expect(entry).toHaveProperty('content')
        }
    })

    it('uses / for root README slug', () => {
        const entries = generateSearchIndex(tmpDir)
        const root = entries.find((e: any) => e.slug === '/')

        expect(root).toBeTruthy()
        expect(root.title).toBe('Documentation')
    })

    it('extracts headings from content', () => {
        const entries = generateSearchIndex(tmpDir)
        const faqs = entries.find((e: any) => e.slug === '/faqs')

        expect(faqs).toBeTruthy()
        expect(faqs.headings).toContain('How do I start?')
        expect(faqs.headings).toContain('What platforms?')
    })

    it('skips assets directory', () => {
        const entries = generateSearchIndex(tmpDir)
        const slugs = entries.map((e: any) => e.slug)

        for (const slug of slugs) {
            expect(slug).not.toContain('assets')
        }
    })

    it('strips frontmatter from content', () => {
        const testFile = path.join(tmpDir, 'frontmatter-test.md')
        fs.writeFileSync(testFile, '---\ntitle: Test\nauthor: Someone\n---\n\n# Frontmatter Test\n\nActual content.')

        const entries = generateSearchIndex(tmpDir)
        const entry = entries.find((e: any) => e.slug === '/frontmatter-test')

        expect(entry).toBeTruthy()
        expect(entry.title).toBe('Frontmatter Test')
        expect(entry.content).not.toContain('author: Someone')
        expect(entry.content).toContain('Actual content.')

        fs.unlinkSync(testFile)
    })

    it('strips HTML comments from content', () => {
        // Write a file with HTML comment
        const testFile = path.join(tmpDir, 'comment-test.md')
        fs.writeFileSync(testFile, '# Test\n\n<!-- hidden -->\n\nVisible content.')

        const entries = generateSearchIndex(tmpDir)
        const entry = entries.find((e: any) => e.slug === '/comment-test')

        expect(entry).toBeTruthy()
        expect(entry.content).not.toContain('hidden')
        expect(entry.content).toContain('Visible content.')

        fs.unlinkSync(testFile)
    })

    it('uses directory slug for README.md files', () => {
        const entries = generateSearchIndex(tmpDir)
        const hosting = entries.find((e: any) => e.slug === '/hosting')

        expect(hosting).toBeTruthy()
        expect(hosting.title).toBe('Hosting')
    })
})
