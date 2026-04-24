# State management architecture

## Overview

The app splits state into three categories:

- **Server data** → TanStack Query hooks in `app/query/hooks.ts`
- **Shared client state** → Zustand stores in `app/stores/`
- **Local UI state / side effects** → `useState`, `useEffect` in components

### How to decide where new state belongs

1. **Does the server own this data?** (API response, database record) →
   **TanStack Query**. The server is the source of truth; the client caches it.
2. **Do multiple components need to read or write it, and is it client-owned?**
   (user's filter selections, auth session, UI toggles shared across siblings)
   → **Zustand**. The client is the source of truth; there is no server copy.
3. **Neither?** → **`useState`** in the component.

Do not put server data in Zustand. Do not put single-component UI state in
Zustand. Do not use TanStack Query for client-owned state.

## TanStack Query — server data

All API reads and writes go through hooks in `app/query/hooks.ts`.

### Query hooks (reads)

```ts
export function useMetricsQuery() {
  const filters = useFiltersStore((s) => s.filters)
  return useQuery({
    queryKey: ["metrics", filters.serialisedFilters],
    queryFn: async () => {
      const result = await fetchMetricsFromServer(filters)
      if (result.status === MetricsApiStatus.Error) throw new Error("...")
      return result.data
    },
    enabled: filters.ready,
  })
}
```

Key patterns:
- **`queryKey`** includes all parameters that affect the result (filters,
  pagination offset, entity IDs). Key change = automatic refetch.
- **`enabled`** gates the fetch (e.g., `filters.ready`, `!!appId`).
- **`placeholderData: keepPreviousData`** on paginated queries keeps old
  data visible while the next page loads.
- **NoData** is returned as `null` with `status: 'success'`.
- **Error** throws, giving `status: 'error'` in the component.

### Mutation hooks (writes)

```ts
export function useChangeAppNameMutation() {
  return useMutation({
    mutationFn: async ({ appId, name }) => {
      const result = await changeAppNameFromServer(appId, name)
      if (result.status === AppNameChangeApiStatus.Error) throw new Error("...")
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] })
    },
  })
}
```

Key patterns:
- **`onSuccess`** invalidates related query keys so stale data refetches.
- Components use `mutation.mutate()` or `mutation.mutateAsync()`.
- `mutation.isPending` / `mutation.isError` / `mutation.isSuccess` drive UI.

### Cache config

In `app/query/query_client.ts`:
- `staleTime: 30s` — data is fresh for 30 seconds, no refetch within window
- `gcTime: 5min` — cached data kept 5 minutes after last subscriber unmounts
- `refetchOnWindowFocus: false` — no ambient refetches
- `retry: 0` — failed requests not retried

### Adding a new query or mutation

1. Add the hook to `app/query/hooks.ts`
2. Import and use it in the component
3. For mutations, add `onSuccess` invalidation for affected query keys

No store files, registry, or provider changes needed.

## Zustand — shared client state (3 stores)

### filtersStore

The single source of truth for filter selections. TanStack Query hooks read
`filters.serialisedFilters` as part of their query key — when filters change,
all dependent queries automatically refetch.

**Persisted across pages**: `selectedApp`, `selectedVersions`,
`selectedDateRange`, `selectedStartDate`, `selectedEndDate`

**Reset to defaults on page navigation**: all other filters (countries,
OS versions, session types, etc.) via `setConfig()`.

**`setConfig(config)`**: Called by the Filters component on mount. Updates
which filter controls are visible (`show*` flags). When the `filterSource`
changes (different page), clears per-page selections so `applyFilterOptions`
applies fresh defaults.

**`applyFilterOptions(data, app, initConfig, state)`**: Resolves filter
selections with priority: URL params > existing selections > defaults.
Uses `selectedOsVersions.length > 0` as proxy for "has existing selections"
to decide whether to preserve or apply defaults.

#### FilterSource

```ts
enum FilterSource { Events, Crashes, Anrs, Spans }
```

Each page passes a `FilterSource` to the Filters component. This is sent as a
query flag (`?crash=1`, `?anr=1`, `?span=1`) to `GET /api/apps/{id}/filters`
so the backend returns filter options relevant to that data source.

#### ShortCode cache

The wrapped `set` in `filters_store.ts` maintains a
`Map<bodyKey, { promise, createdAt }>` with a 5-minute TTL.

- **Cache hit** (same body key, < 5 min old) → reuse existing promise
- **Cache miss** → fire new POST to `/shortFilters`, store promise
- Backend cleans up short filter codes after 1 hour

### sessionStore

Auth session state. Fetches session from `/api/auth/session`, handles
OAuth sign-in and sign-out. Used by layouts and auth pages.

### userJourneysStore

Pure UI state: `plotType` (Paths/Exceptions) and `searchText`. No API calls.

### Key files

| File | Purpose |
|------|---------|
| `provider.tsx` | Context, provider, hooks for 3 Zustand stores |
| `registry.ts` | `MeasureStoreRegistry` type |
| `reset_all.ts` | Clears TanStack Query cache + resets Zustand stores on logout |
| `query_client.ts` | TanStack Query client singleton |
| `hooks.ts` | All query and mutation hooks |

## Component patterns

### Paginated pages

```tsx
const [offset, setOffset] = useState(() => {
  const po = searchParams.get('po')
  return po ? parseInt(po) : 0
})

// Reset pagination when filters change (skip pre-ready transitions)
const prevFiltersRef = useRef<string | null>(null)
useEffect(() => {
  if (!filters.ready) return
  if (prevFiltersRef.current !== null && prevFiltersRef.current !== filters.serialisedFilters) {
    setOffset(0)
  }
  prevFiltersRef.current = filters.serialisedFilters
}, [filters.ready, filters.serialisedFilters])

// URL sync
useEffect(() => {
  if (!filters.ready) return
  router.replace(`?po=${offset}&${filters.serialisedFilters!}`, { scroll: false })
}, [offset, filters.ready, filters.serialisedFilters])

const { data, status, isFetching } = useXQuery(offset)
```

- Pagination offset is component-local `useState`, initialized from URL
- `isFetching` drives loading bar and paginator button disable state
- `keepPreviousData` means `status` stays `'success'` during page transitions

### Plot components

```tsx
const { data: plot, status } = useXPlotQuery(type, groupId)
const effectiveStatus = demo ? 'success' : status
const effectivePlot = demo ? demoPlot : plot
```

No `plotDataKey` matching — TanStack Query handles staleness via query keys.

## Logout

`resetAllStores(registry)` in `reset_all.ts`:
1. Calls `queryClient.clear()` — removes all TanStack Query cached data
2. Resets the 3 Zustand stores

## Testing

- **Unit tests** (`__tests__/components/`, `__tests__/pages/`) — mock
  `@/app/query/hooks` with `jest.fn()` returning `{ data, status, isFetching, error }`.
  Mock `@/app/stores/provider` for `useFiltersStore`/`useSessionStore`.
- **Integration tests** (`__tests__/integration/`) — do NOT mock
  `@/app/query/hooks`. Let real hooks run with MSW intercepting API calls.
  Wrap renders in `QueryClientProvider`. Only mock `@/app/stores/provider`
  for `useFiltersStore`.
- **Store tests** (`__tests__/stores/`) — test filtersStore and sessionStore
  directly via factory functions.

## Navigation

Internal links MUST use `<Link>` from `next/link` (not raw `<a href>`).
Raw anchors cause full page reloads that destroy React state and TanStack
Query cache.
