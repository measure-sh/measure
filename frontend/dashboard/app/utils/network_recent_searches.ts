const STORAGE_KEY = "network_recent_searches"
const MAX_RESULTS = 5

interface RecentSearchEntry {
    domain: string
    path: string
}

function readEntries(): RecentSearchEntry[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        return JSON.parse(raw) as RecentSearchEntry[]
    } catch {
        return []
    }
}

function writeEntries(entries: RecentSearchEntry[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch {
        // silently fail if localStorage unavailable
    }
}

export function addRecentSearch(domain: string, path: string): void {
    let entries = readEntries()
    entries = entries.filter(e => !(e.domain === domain && e.path === path))
    entries.unshift({ domain, path })
    // Keep only MAX_RESULTS per domain
    const domainCount: Record<string, number> = {}
    entries = entries.filter(e => {
        domainCount[e.domain] = (domainCount[e.domain] || 0) + 1
        return domainCount[e.domain] <= MAX_RESULTS
    })
    writeEntries(entries)
}

export function removeRecentSearch(domain: string, path: string): void {
    const entries = readEntries().filter(e => !(e.domain === domain && e.path === path))
    writeEntries(entries)
}

export function getRecentSearchesForDomain(domain: string, query?: string): string[] {
    const entries = readEntries().filter(e => e.domain === domain)

    const filtered = query
        ? entries.filter(e => e.path.toLowerCase().includes(query.toLowerCase()))
        : entries

    return filtered.slice(0, MAX_RESULTS).map(e => e.path)
}
