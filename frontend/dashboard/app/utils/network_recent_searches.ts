const STORAGE_KEY_PREFIX = "network_recent_searches"
const MAX_RESULTS = 5

interface RecentSearchEntry {
    domain: string
    path: string
}

function storageKey(teamId: string): string {
    return `${STORAGE_KEY_PREFIX}_${teamId}`
}

function readEntries(teamId: string): RecentSearchEntry[] {
    try {
        const raw = localStorage.getItem(storageKey(teamId))
        if (!raw) return []
        return JSON.parse(raw) as RecentSearchEntry[]
    } catch {
        return []
    }
}

function writeEntries(teamId: string, entries: RecentSearchEntry[]): void {
    try {
        localStorage.setItem(storageKey(teamId), JSON.stringify(entries))
    } catch {
        // silently fail if localStorage unavailable
    }
}

export function addRecentSearch(teamId: string, domain: string, path: string): void {
    let entries = readEntries(teamId)
    entries = entries.filter(e => !(e.domain === domain && e.path === path))
    entries.unshift({ domain, path })
    // Keep only MAX_RESULTS per domain
    const domainCount: Record<string, number> = {}
    entries = entries.filter(e => {
        domainCount[e.domain] = (domainCount[e.domain] || 0) + 1
        return domainCount[e.domain] <= MAX_RESULTS
    })
    writeEntries(teamId, entries)
}

export function removeRecentSearch(teamId: string, domain: string, path: string): void {
    const entries = readEntries(teamId).filter(e => !(e.domain === domain && e.path === path))
    writeEntries(teamId, entries)
}

export function getRecentSearchesForDomain(teamId: string, domain: string, query?: string): string[] {
    const entries = readEntries(teamId).filter(e => e.domain === domain)

    const filtered = query
        ? entries.filter(e => e.path.toLowerCase().includes(query.toLowerCase()))
        : entries

    return filtered.slice(0, MAX_RESULTS).map(e => e.path)
}
