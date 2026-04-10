import { afterAll, beforeAll, describe, expect, it } from '@jest/globals'
import fs from 'fs'
import os from 'os'
import path from 'path'

// Create a temp docs directory for testing filesystem functions
let tmpDir: string

beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs_utils_test_'))

    // Root README
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Docs Home\n\n<!-- comment -->\n\nWelcome.')

    // A direct .md file
    fs.writeFileSync(path.join(tmpDir, 'guide.md'), '# Guide\n\n## Step 1\n\nDo this.\n\n## Step 2\n\nDo that.')

    // A subdirectory with README
    fs.mkdirSync(path.join(tmpDir, 'hosting'))
    fs.writeFileSync(path.join(tmpDir, 'hosting', 'README.md'), '# Hosting\n\nHosting content.')
    fs.writeFileSync(path.join(tmpDir, 'hosting', 'docker.md'), '# Docker\n\nDocker content.')

    // features/ directory
    fs.mkdirSync(path.join(tmpDir, 'features'))
    fs.writeFileSync(path.join(tmpDir, 'features', 'crash.md'), '# Crash Reporting\n\nCrash content.')

    // assets/ directory (should be skipped)
    fs.mkdirSync(path.join(tmpDir, 'assets'))
    fs.writeFileSync(path.join(tmpDir, 'assets', 'image.png'), 'fake')
})

afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
})

// We need to test the actual functions from docs.ts, but they use getDocsDirectory()
// which resolves paths relative to process.cwd(). Instead, we test the exported pure
// functions (cleanContent, extractTitle, extractTocEntries) and the filesystem functions
// by calling them with our temp directory structure.

// Import the pure functions (already tested in docs_test.ts, but we need getAllDocSlugs etc.)
// Since docs.ts uses its own getDocsDirectory() internally, we mock fs.existsSync to
// redirect to our temp dir for the functions that call getDocsDirectory().

// Actually, getDocBySlug, getDocIndex, getAllDocSlugs, and generateSearchIndex all call
// getDocsDirectory() internally. We need to mock that. Let's use jest.mock to replace
// the module partially.

// The simplest approach: test the logic by importing and calling with controlled paths.
// But docs.ts doesn't export slugToFilePath or getDocsDirectory - they're private.
// The exported functions (getDocBySlug, getDocIndex, getAllDocSlugs, generateSearchIndex)
// all call getDocsDirectory() internally.

// Let's mock fs.existsSync and fs.readFileSync to redirect docs directory resolution.

describe('docs.ts filesystem functions', () => {
    let originalExistsSync: typeof fs.existsSync
    let originalReadFileSync: typeof fs.readFileSync
    let originalReaddirSync: typeof fs.readdirSync

    beforeAll(() => {
        originalExistsSync = fs.existsSync
        originalReadFileSync = fs.readFileSync
        originalReaddirSync = fs.readdirSync

        // Override existsSync to make getDocsDirectory() find our tmpDir
        // getDocsDirectory checks: path.join(process.cwd(), "content", "docs")
        // If that doesn't exist, falls back to path.join(process.cwd(), "..", "..", "docs")
        const contentDocsPath = path.join(process.cwd(), 'content', 'docs')

        jest.spyOn(fs, 'existsSync').mockImplementation((p: fs.PathLike) => {
            const pStr = p.toString()
            // Redirect content/docs check to our tmpDir
            if (pStr === contentDocsPath) {
                return true
            }
            // For slugToFilePath checks, redirect from content/docs/... to tmpDir/...
            if (pStr.startsWith(contentDocsPath)) {
                const relative = pStr.slice(contentDocsPath.length)
                return originalExistsSync(path.join(tmpDir, relative))
            }
            return originalExistsSync(pStr)
        })

        jest.spyOn(fs, 'readFileSync').mockImplementation((p: fs.PathOrFileDescriptor, options?: any) => {
            const pStr = p.toString()
            if (pStr.startsWith(contentDocsPath)) {
                const relative = pStr.slice(contentDocsPath.length)
                return originalReadFileSync(path.join(tmpDir, relative), options)
            }
            return originalReadFileSync(p, options)
        })

        jest.spyOn(fs, 'readdirSync').mockImplementation((p: fs.PathLike, options?: any) => {
            const pStr = p.toString()
            if (pStr.startsWith(contentDocsPath)) {
                const relative = pStr.slice(contentDocsPath.length)
                return originalReaddirSync(path.join(tmpDir, relative), options) as any
            }
            return originalReaddirSync(p, options) as any
        })
    })

    afterAll(() => {
        jest.restoreAllMocks()
    })

    // Re-require to pick up mocked fs
    const { getDocBySlug, getDocIndex, getAllDocSlugs, generateSearchIndex } = require('@/app/docs/docs')

    describe('getDocBySlug', () => {
        it('returns doc page for a direct .md slug', () => {
            const doc = getDocBySlug(['guide'])
            expect(doc).not.toBeNull()
            expect(doc.title).toBe('Guide')
            expect(doc.slug).toEqual(['guide'])
        })

        it('returns doc page for a directory slug (README.md)', () => {
            const doc = getDocBySlug(['hosting'])
            expect(doc).not.toBeNull()
            expect(doc.title).toBe('Hosting')
        })

        it('returns doc page for a nested slug', () => {
            const doc = getDocBySlug(['hosting', 'docker'])
            expect(doc).not.toBeNull()
            expect(doc.title).toBe('Docker')
        })

        it('returns null for non-existent slug', () => {
            const doc = getDocBySlug(['nonexistent'])
            expect(doc).toBeNull()
        })

        it('strips HTML comments from content', () => {
            const doc = getDocIndex()
            expect(doc.content).not.toContain('<!-- comment -->')
        })
    })

    describe('getDocIndex', () => {
        it('returns the root README doc', () => {
            const doc = getDocIndex()
            expect(doc).not.toBeNull()
            expect(doc.title).toBe('Docs Home')
            expect(doc.slug).toEqual([])
        })
    })

    describe('getAllDocSlugs', () => {
        it('returns array of slug arrays', () => {
            const slugs = getAllDocSlugs()
            expect(Array.isArray(slugs)).toBe(true)
            expect(slugs.length).toBeGreaterThan(0)
        })

        it('includes direct .md files as single-element slugs', () => {
            const slugs = getAllDocSlugs()
            const guideSlug = slugs.find((s: string[]) => s.length === 1 && s[0] === 'guide')
            expect(guideSlug).toBeTruthy()
        })

        it('includes directory README as directory slug', () => {
            const slugs = getAllDocSlugs()
            const hostingSlug = slugs.find((s: string[]) => s.length === 1 && s[0] === 'hosting')
            expect(hostingSlug).toBeTruthy()
        })

        it('includes nested .md files', () => {
            const slugs = getAllDocSlugs()
            const dockerSlug = slugs.find((s: string[]) => JSON.stringify(s) === '["hosting","docker"]')
            expect(dockerSlug).toBeTruthy()
        })

        it('skips assets directory', () => {
            const slugs = getAllDocSlugs()
            for (const slug of slugs) {
                expect(slug).not.toContain('assets')
            }
        })

        it('does not include root README', () => {
            const slugs = getAllDocSlugs()
            const rootSlug = slugs.find((s: string[]) => s.length === 0)
            expect(rootSlug).toBeUndefined()
        })
    })

    describe('generateSearchIndex', () => {
        it('returns search entries for all docs', () => {
            const entries = generateSearchIndex()
            expect(entries.length).toBeGreaterThan(0)
        })

        it('includes title and headings', () => {
            const entries = generateSearchIndex()
            const guide = entries.find((e: any) => e.slug === '/guide')
            expect(guide).toBeTruthy()
            expect(guide.title).toBe('Guide')
            expect(guide.headings).toContain('Step 1')
            expect(guide.headings).toContain('Step 2')
        })
    })
})
