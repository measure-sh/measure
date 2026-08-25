const STORAGE_KEY_PREFIX = "network_recent_searches";
const MAX_STORED_RECENT_SEARCHES = 10;
export interface RecentSearchEntry {
  domain: string;
  path: string;
}

function storageKey(teamId: string): string {
  return `${STORAGE_KEY_PREFIX}_${teamId}`;
}

function readEntries(teamId: string): RecentSearchEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(teamId));
    if (!raw) return [];
    return JSON.parse(raw) as RecentSearchEntry[];
  } catch {
    return [];
  }
}

function writeEntries(teamId: string, entries: RecentSearchEntry[]): void {
  try {
    localStorage.setItem(storageKey(teamId), JSON.stringify(entries));
  } catch {
    // Local storage can be unavailable in restricted browser contexts.
  }
}

export function addRecentSearch(
  teamId: string,
  domain: string,
  path: string,
): void {
  let entries = readEntries(teamId);
  entries = entries.filter(
    (entry) => !(entry.domain === domain && entry.path === path),
  );
  entries.unshift({ domain, path });
  writeEntries(teamId, entries.slice(0, MAX_STORED_RECENT_SEARCHES));
}

export function removeRecentSearch(
  teamId: string,
  domain: string,
  path: string,
): void {
  writeEntries(
    teamId,
    readEntries(teamId).filter(
      (entry) => !(entry.domain === domain && entry.path === path),
    ),
  );
}

export function getRecentSearches(teamId: string): RecentSearchEntry[] {
  return readEntries(teamId);
}
