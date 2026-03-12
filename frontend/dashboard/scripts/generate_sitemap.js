const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const APP_DIR = path.join(ROOT, 'app')
const PUBLIC_DIR = path.join(ROOT, 'public')
const SITE_URL = 'https://measure.sh'

function walk(dir) {
    const files = []
    for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, name.name)
        if (name.isDirectory()) files.push(...walk(full))
        else if (name.isFile() && name.name === 'page.tsx') files.push(full)
    }
    return files
}

function routeFromFile(file) {
    const rel = path.relative(APP_DIR, path.dirname(file))
    let route = '/' + rel.replace(/\\/g, '/')
    if (route === '/.') route = '/'
    // normalize root
    route = route.replace(/\/\/$/, '')
    if (route === '/.') route = '/'
    return route === '/' ? '/' : route
}

function isDynamic(route) {
    return /\[.+?\]/.test(route)
}

function getDocsSlugs() {
    const contentDir = path.join(ROOT, 'content', 'docs')
    if (!fs.existsSync(contentDir)) {
        return []
    }

    const slugs = []

    function walkDocs(dir, prefix) {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (entry.name === 'assets') {
                    continue
                }
                walkDocs(path.join(dir, entry.name), [...prefix, entry.name])
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                if (entry.name === 'README.md') {
                    if (prefix.length > 0) {
                        slugs.push('/docs/' + prefix.join('/'))
                    }
                    // Root README.md is /docs (static page, already picked up)
                } else {
                    const name = entry.name.replace(/\.md$/, '')
                    slugs.push('/docs/' + [...prefix, name].join('/'))
                }
            }
        }
    }

    walkDocs(contentDir, [])
    return slugs
}

function ensurePublicDir() {
    if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true })
}

function buildSitemap(urls) {
    const now = new Date().toISOString()
    const parts = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for (const u of urls) {
        parts.push('  <url>')
        parts.push(`    <loc>${u}</loc>`)
        parts.push(`    <lastmod>${now}</lastmod>`)
        parts.push('  </url>')
    }
    parts.push('</urlset>')
    return parts.join('\n')
}

function main() {
    if (!fs.existsSync(APP_DIR)) {
        console.error('app directory not found:', APP_DIR)
        process.exit(1)
    }

    const files = walk(APP_DIR)

    const routes = new Set()

    for (const f of files) {
        const route = routeFromFile(f)
        if (isDynamic(route)) {
            continue
        }
        routes.add(route === '/' ? '/' : route.replace(/\\/g, '/'))
    }

    // Add docs pages from content/docs/
    const docsSlugs = getDocsSlugs()
    for (const slug of docsSlugs) {
        routes.add(slug)
    }

    if (docsSlugs.length > 0) {
        console.log(`Added ${docsSlugs.length} docs pages to sitemap`)
    }

    const urls = Array.from(routes)
        .sort()
        .map(r => (r === '/' ? SITE_URL : `${SITE_URL}${r}`))

    ensurePublicDir()
    const xml = buildSitemap(urls)
    const out = path.join(PUBLIC_DIR, 'sitemap.xml')
    fs.writeFileSync(out, xml, 'utf8')
    console.log('Wrote sitemap with', urls.length, 'entries to', out)
}

if (require.main === module) main()

module.exports = { walk, routeFromFile, isDynamic, getDocsSlugs, buildSitemap, ensurePublicDir, main, APP_DIR, PUBLIC_DIR, ROOT, SITE_URL }
