import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'
import fs from 'fs'
import path from 'path'

const {
  walk,
  routeFromFile,
  isDynamic,
  getDocsSlugs,
  buildSitemap,
  ensurePublicDir,
  main,
  APP_DIR,
  PUBLIC_DIR,
  ROOT,
  SITE_URL,
} = require('@/scripts/generate_sitemap')

// ─── routeFromFile ──────────────────────────────────────────────────────────

describe('routeFromFile', () => {
  it('returns / for root page.tsx', () => {
    const file = path.join(APP_DIR, 'page.tsx')

    expect(routeFromFile(file)).toBe('/')
  })

  it('returns /about for app/about/page.tsx', () => {
    const file = path.join(APP_DIR, 'about', 'page.tsx')

    expect(routeFromFile(file)).toBe('/about')
  })

  it('returns nested route for deeply nested page', () => {
    const file = path.join(APP_DIR, 'product', 'app-health', 'page.tsx')

    expect(routeFromFile(file)).toBe('/product/app-health')
  })

  it('returns route with dynamic segments intact', () => {
    const file = path.join(APP_DIR, '[teamId]', 'apps', 'page.tsx')

    expect(routeFromFile(file)).toBe('/[teamId]/apps')
  })

  it('returns route for docs catch-all', () => {
    const file = path.join(APP_DIR, 'docs', '[...slug]', 'page.tsx')

    expect(routeFromFile(file)).toBe('/docs/[...slug]')
  })
})

// ─── isDynamic ──────────────────────────────────────────────────────────────

describe('isDynamic', () => {
  it('returns true for single dynamic segment', () => {
    expect(isDynamic('/[teamId]/apps')).toBe(true)
  })

  it('returns true for catch-all dynamic segment', () => {
    expect(isDynamic('/docs/[...slug]')).toBe(true)
  })

  it('returns true for optional catch-all segment', () => {
    expect(isDynamic('/docs/[[...slug]]')).toBe(true)
  })

  it('returns false for static route', () => {
    expect(isDynamic('/about')).toBe(false)
  })

  it('returns false for root route', () => {
    expect(isDynamic('/')).toBe(false)
  })

  it('returns false for nested static route', () => {
    expect(isDynamic('/product/app-health')).toBe(false)
  })
})

// ─── walk ───────────────────────────────────────────────────────────────────

describe('walk', () => {
  it('finds page.tsx files in the app directory', () => {
    const files = walk(APP_DIR)

    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      expect(file).toMatch(/page\.tsx$/)
    }
  })

  it('includes the root page.tsx', () => {
    const files = walk(APP_DIR)
    const rootPage = path.join(APP_DIR, 'page.tsx')

    expect(files).toContain(rootPage)
  })

  it('includes nested page.tsx files', () => {
    const files = walk(APP_DIR)
    const aboutPage = path.join(APP_DIR, 'about', 'page.tsx')

    expect(files).toContain(aboutPage)
  })

  it('does not include non-page files', () => {
    const files = walk(APP_DIR)

    for (const file of files) {
      expect(path.basename(file)).toBe('page.tsx')
    }
  })
})

// ─── getDocsSlugs ───────────────────────────────────────────────────────────

describe('getDocsSlugs', () => {
  const contentDir = path.join(ROOT, 'content', 'docs')
  const hasContentDocs = fs.existsSync(contentDir)

  if (hasContentDocs) {
    it('returns an array of doc slugs', () => {
      const slugs = getDocsSlugs()

      expect(Array.isArray(slugs)).toBe(true)
      expect(slugs.length).toBeGreaterThan(0)
    })

    it('all slugs start with /docs/', () => {
      const slugs = getDocsSlugs()

      for (const slug of slugs) {
        expect(slug).toMatch(/^\/docs\//)
      }
    })

    it('does not include a slug for root README.md', () => {
      const slugs = getDocsSlugs()

      // Root README maps to /docs which is a static page
      expect(slugs).not.toContain('/docs')
      expect(slugs).not.toContain('/docs/')
    })

    it('includes subdirectory README.md as directory slug', () => {
      const slugs = getDocsSlugs()

      // hosting/README.md should produce /docs/hosting
      expect(slugs).toContain('/docs/hosting')
    })

    it('includes regular .md files as page slugs', () => {
      const slugs = getDocsSlugs()

      expect(slugs).toContain('/docs/faqs')
    })

    it('includes nested .md files with full path', () => {
      const slugs = getDocsSlugs()

      expect(slugs).toContain('/docs/features/feature-crash-reporting')
    })

    it('does not include assets directory contents', () => {
      const slugs = getDocsSlugs()

      for (const slug of slugs) {
        expect(slug).not.toContain('/assets/')
      }
    })

    it('has no duplicate slugs', () => {
      const slugs = getDocsSlugs()
      const unique = new Set(slugs)

      expect(slugs.length).toBe(unique.size)
    })
  } else {
    it('returns empty array when content/docs does not exist', () => {
      const slugs = getDocsSlugs()

      expect(slugs).toEqual([])
    })
  }
})

// ─── buildSitemap ───────────────────────────────────────────────────────────

describe('buildSitemap', () => {
  it('generates valid XML with the correct declaration', () => {
    const xml = buildSitemap(['https://measure.sh'])

    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)
  })

  it('wraps URLs in urlset element', () => {
    const xml = buildSitemap(['https://measure.sh'])

    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('</urlset>')
  })

  it('includes each URL in a <url><loc> element', () => {
    const urls = ['https://measure.sh', 'https://measure.sh/about']
    const xml = buildSitemap(urls)

    expect(xml).toContain('<loc>https://measure.sh</loc>')
    expect(xml).toContain('<loc>https://measure.sh/about</loc>')
  })

  it('includes lastmod timestamps', () => {
    const xml = buildSitemap(['https://measure.sh'])

    expect(xml).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z<\/lastmod>/)
  })

  it('generates one <url> block per input URL', () => {
    const urls = ['https://a.com', 'https://b.com', 'https://c.com']
    const xml = buildSitemap(urls)
    const urlBlocks = xml.match(/<url>/g)

    expect(urlBlocks).toHaveLength(3)
  })

  it('handles empty URL list', () => {
    const xml = buildSitemap([])

    expect(xml).toContain('<urlset')
    expect(xml).toContain('</urlset>')
    expect(xml).not.toContain('<url>')
  })
})

// ─── main (integration) ────────────────────────────────────────────────────

describe('main', () => {
  let writtenPath: string | null = null
  let writtenContent: string | null = null
  const originalWriteFileSync = fs.writeFileSync

  beforeEach(() => {
    writtenPath = null
    writtenContent = null
    // Intercept writeFileSync to capture output without writing to disk
    jest.spyOn(fs, 'writeFileSync').mockImplementation((filePath: any, content: any) => {
      writtenPath = filePath
      writtenContent = content
    })
    jest.spyOn(console, 'log').mockImplementation(() => { })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('writes sitemap.xml to the public directory', () => {
    main()

    expect(writtenPath).toBe(path.join(PUBLIC_DIR, 'sitemap.xml'))
  })

  it('generates valid XML content', () => {
    main()

    expect(writtenContent).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)
    expect(writtenContent).toContain('<urlset')
    expect(writtenContent).toContain('</urlset>')
  })

  it('includes the site root URL', () => {
    main()

    expect(writtenContent).toContain(`<loc>${SITE_URL}</loc>`)
  })

  it('includes static pages', () => {
    main()

    expect(writtenContent).toContain(`<loc>${SITE_URL}/about</loc>`)
    expect(writtenContent).toContain(`<loc>${SITE_URL}/pricing</loc>`)
  })

  it('excludes dynamic routes', () => {
    main()

    expect(writtenContent).not.toContain('[teamId]')
    expect(writtenContent).not.toContain('[...slug]')
  })

  it('includes docs pages when content/docs exists', () => {
    const contentDir = path.join(ROOT, 'content', 'docs')
    if (!fs.existsSync(contentDir)) {
      return
    }

    main()

    expect(writtenContent).toContain(`<loc>${SITE_URL}/docs/faqs</loc>`)
    expect(writtenContent).toContain(`<loc>${SITE_URL}/docs/hosting</loc>`)
    expect(writtenContent).toContain(`<loc>${SITE_URL}/docs/features/feature-crash-reporting</loc>`)
  })

  it('produces sorted URLs', () => {
    main()

    const locs = (writtenContent as string).match(/<loc>(.+?)<\/loc>/g) || []
    const urls = locs.map((l: string) => l.replace(/<\/?loc>/g, ''))
    const sorted = [...urls].sort()

    expect(urls).toEqual(sorted)
  })

  it('has no duplicate URLs', () => {
    main()

    const locs = (writtenContent as string).match(/<loc>(.+?)<\/loc>/g) || []
    const urls = locs.map((l: string) => l.replace(/<\/?loc>/g, ''))
    const unique = new Set(urls)

    expect(urls.length).toBe(unique.size)
  })
})
