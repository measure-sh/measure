const STORAGE_KEY = "network_recent_searches"
const MAX_ENTRIES = 20
const MAX_RESULTS = 5

interface RecentSearchEntry {
    domain: string
    path: string
    timestamp: number
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
    const entries = readEntries()
    const filtered = entries.filter(e => !(e.domain === domain && e.path === path))
    filtered.unshift({ domain, path, timestamp: Date.now() })
    writeEntries(filtered.slice(0, MAX_ENTRIES))
}

export function removeRecentSearch(domain: string, path: string): void {
    const entries = readEntries().filter(e => !(e.domain === domain && e.path === path))
    writeEntries(entries)
}

export function getRecentSearchesForDomain(domain: string, query?: string): string[] {
    const entries = readEntries()
        .filter(e => e.domain === domain)
        .sort((a, b) => b.timestamp - a.timestamp)

    const filtered = query
        ? entries.filter(e => e.path.toLowerCase().includes(query.toLowerCase()))
        : entries

    return filtered.slice(0, MAX_RESULTS).map(e => e.path)
}
