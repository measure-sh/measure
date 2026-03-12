import { describe, expect, it } from '@jest/globals'
import { docsNav, getFlatNavSlugs, type NavItem } from '@/app/docs/docs_nav'

describe('docsNav', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(docsNav)).toBe(true)
    expect(docsNav.length).toBeGreaterThan(0)
  })

  it('has a title on every item', () => {
    function checkTitles(items: NavItem[]) {
      for (const item of items) {
        expect(typeof item.title).toBe('string')
        expect(item.title.length).toBeGreaterThan(0)
        if (item.children) {
          checkTitles(item.children)
        }
      }
    }

    checkTitles(docsNav)
  })

  it('every leaf item has a slug', () => {
    function checkLeaves(items: NavItem[]) {
      for (const item of items) {
        if (!item.children || item.children.length === 0) {
          expect(item.slug).toBeDefined()
          expect(item.slug).toMatch(/^\/docs/)
        }
        if (item.children) {
          checkLeaves(item.children)
        }
      }
    }

    checkLeaves(docsNav)
  })

  it('all slugs start with /docs/', () => {
    function collectSlugs(items: NavItem[]): string[] {
      const slugs: string[] = []
      for (const item of items) {
        if (item.slug) {
          slugs.push(item.slug)
        }
        if (item.children) {
          slugs.push(...collectSlugs(item.children))
        }
      }
      return slugs
    }

    const slugs = collectSlugs(docsNav)

    for (const slug of slugs) {
      expect(slug).toMatch(/^\/docs\//)
    }
  })

  it('has no duplicate slugs', () => {
    function collectSlugs(items: NavItem[]): string[] {
      const slugs: string[] = []
      for (const item of items) {
        if (item.slug) {
          slugs.push(item.slug)
        }
        if (item.children) {
          slugs.push(...collectSlugs(item.children))
        }
      }
      return slugs
    }

    const slugs = collectSlugs(docsNav)
    const unique = new Set(slugs)

    expect(slugs.length).toBe(unique.size)
  })
})

describe('getFlatNavSlugs', () => {
  it('starts with /docs as the first entry', () => {
    const slugs = getFlatNavSlugs()

    expect(slugs[0]).toBe('/docs')
  })

  it('returns a flat array of strings', () => {
    const slugs = getFlatNavSlugs()

    expect(Array.isArray(slugs)).toBe(true)
    for (const slug of slugs) {
      expect(typeof slug).toBe('string')
    }
  })

  it('includes all slugs from the nav tree', () => {
    function collectSlugs(items: NavItem[]): string[] {
      const slugs: string[] = []
      for (const item of items) {
        if (item.slug) {
          slugs.push(item.slug)
        }
        if (item.children) {
          slugs.push(...collectSlugs(item.children))
        }
      }
      return slugs
    }

    const flatSlugs = getFlatNavSlugs()
    const treeSlugs = collectSlugs(docsNav)

    for (const slug of treeSlugs) {
      expect(flatSlugs).toContain(slug)
    }
  })

  it('has no duplicate entries', () => {
    const slugs = getFlatNavSlugs()
    const unique = new Set(slugs)

    expect(slugs.length).toBe(unique.size)
  })

  it('preserves depth-first traversal order', () => {
    const slugs = getFlatNavSlugs()

    // Getting Started should come before Features children
    const gettingStarted = slugs.indexOf('/docs/sdk-integration-guide')
    const sessionTimelines = slugs.indexOf('/docs/features/feature-session-timelines')

    expect(gettingStarted).toBeLessThan(sessionTimelines)

    // SDK Upgrade Guides should come after Performance Impact
    const performanceImpact = slugs.indexOf('/docs/features/performance-impact')
    const upgradeGuides = slugs.indexOf('/docs/sdk-upgrade-guides')

    expect(performanceImpact).toBeLessThan(upgradeGuides)
  })

  it('contains more entries than top-level nav items due to nested children', () => {
    const slugs = getFlatNavSlugs()

    // /docs + all nav items with slugs (including deeply nested ones)
    expect(slugs.length).toBeGreaterThan(docsNav.length)
  })
})
