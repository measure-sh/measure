# State management architecture

## Overview

State splits three ways:

- **Server data** → TanStack Query hooks in `app/query/hooks.ts`
- **Cross-component client state** → Zustand stores in `app/stores/`
- **Local UI state** → `useState` / `useEffect` in the component that owns it

### Where does new state belong?

1. **Server owns the data** (API response, DB row, session, list of apps,
   filter option lists) → **TanStack Query**.
2. **Client owns the data, and more than one component reads or writes it**
   (filter selections, onboarding wizard step) → **Zustand**.
3. **One component owns it** (a dropdown's open flag, a search input's value
   when only that component cares) → **`useState`**.

Server data never goes in Zustand. Single-component UI state never goes in
Zustand. Client-owned state never goes in TanStack Query.

## TanStack Query — server data

All API reads and writes live in `app/query/hooks.ts`.

### Query hooks (reads)

```ts
export function useMetricsQuery() {
  const filters = useFiltersStore((s) => s.filters)
  return useQuery({
    queryKey: ["metrics", filters.serialisedFilters] as const,
    queryFn: async () => {
      const result = await fetchMetricsFromServer(filters)
      if (result.status === MetricsApiStatus.Error) throw new Error("...")
      return result.data
    },
    enabled: filters.ready,
  })
}
```

Patterns:
- **`queryKey`** includes every parameter that changes the result (filter
  serialisation, pagination offset, entity IDs). Key change → automatic
  refetch.
- **`enabled`** gates the fetch (e.g. `filters.ready`, `!!appId`).
- **`placeholderData: keepPreviousData`** on paginated queries keeps the
  previous page visible while the next page loads.
- **NoData** is returned as `null` with `status: 'success'` so consumers can
  branch on it without throwing.
- **Error** throws inside `queryFn` so consumers see `status: 'error'`.

### Filter-option queries

The Filters component drives three query hooks itself; consumers never call
these directly:

| Hook | What it fetches |
|------|-----------------|
| `useAppsQuery(teamId)` | The apps list for a team. |
| `useFilterOptionsQuery(app, filterSource)` | Available filter values (versions, OS, countries, …) for the selected app + source. Skips the round-trip and returns `NotOnboarded` when `app.onboarded === false`. |
| `useRootSpanNamesQuery(app, filterSource)` | Trace names; only enabled when `filterSource === Spans`. |

The Filters component subscribes to each of these and mirrors the result
into `filtersStore` so all downstream consumers (the filter dropdowns
themselves, `computeFilters` for the `all` flag, etc.) read from one place.

### Session

`useSessionQuery()` returns the current user. `fetchCurrentSession()` is a
plain async version for callers that aren't components (e.g. the login
page's pre-redirect check). `signOut()` posts `DELETE /auth/logout` then
calls `apiClient.redirectToLogin()`.

OAuth helpers live in `app/auth/oauth.ts` (`encodeOAuthState`,
`signInWithGitHub`) — they're stateless, no hook needed.

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

- `onSuccess` invalidates affected query keys so dependent queries refetch.
- Components call `mutation.mutate()` / `mutateAsync()` and key UI off
  `isPending` / `isError` / `isSuccess`.

### Cache config

In `app/query/query_client.ts`:

| Option | Value | Why |
|--------|-------|-----|
| `staleTime` | `0` | Every mount triggers a fresh fetch. |
| `gcTime` | `0` | Cache evicted on unmount. No stale-flash on remount, no cross-navigation caching. |
| `refetchOnWindowFocus` | `false` | No ambient refetches. |
| `retry` | `0` | Failed requests don't retry. |

`useSessionQuery` overrides both `staleTime` and `gcTime` to 5 minutes — the
session doesn't change often and we don't want to hit `/auth/session` on
every page navigation.

The filter-store's `/shortFilters` POST (see below) also passes an explicit
`gcTime` because `queryClient.fetchQuery` has no React subscriber and would
otherwise be GC'd the instant the promise resolves.

### Adding a new query or mutation

1. Add the hook to `app/query/hooks.ts`.
2. Import and use in the component.
3. For mutations, invalidate the relevant query keys in `onSuccess`.

No changes to stores, provider, or registry.

## Zustand — client-owned shared state (2 stores)

### filtersStore

Holds filter **selections** plus enough mirrored server data to render the
dropdowns and derive the `all` flag for each filter. The Filters component
is the only writer to the mirror state; pages only ever read.

**Preserved across page navigation:** `selectedApp`, `selectedDateRange`,
`selectedStartDate`, `selectedEndDate`. Dynamic date ranges (Last Year,
Last 7 Days, etc.) re-anchor `startDate`/`endDate` to `now()` on every
Filters mount so pages don't render data from a stale window.

**Reset to defaults on every Filters mount** (via `applyFilterOptions`):
versions, OS, countries, network providers/types/generations, locales,
device manufacturers/names, session types, span statuses, bug report
statuses, http methods, UD-attr matchers, free text, root span name. URL
filters override defaults; without a URL filter the default is "everything
selected" for index-based lists.

#### Filter source

```ts
enum FilterSource { Events, Crashes, Anrs, Spans }
```

Each page passes a `FilterSource` to `<Filters>`. It's sent as a query flag
(`?crash=1`, `?anr=1`, `?span=1`) to `GET /api/apps/{id}/filters` so the
backend returns options relevant to that data source. `setConfig` wipes
per-page selections when `filterSource` changes so the next
`applyFilterOptions` installs fresh defaults.

#### serialisedFilters + filterShortCodePromise

`computeFilters` produces a `Filters` object that includes:

- **`serialisedFilters`** — URL-encoded query string used as the cache key
  for every query hook that depends on filters.
- **`filterShortCodePromise`** — a promise that resolves to the server-side
  short code for the current filter combination. The store's wrapped `set`
  kicks off a `POST /shortFilters` via `queryClient.fetchQuery` whenever the
  body changes (deduped by hash of the body) and parks the promise on
  `filters.filterShortCodePromise`. URL builders in `api_calls.ts` await
  the promise instead of POSTing themselves — exactly one POST per filter
  change regardless of how many parallel data fetchers run.

  Because `queryClient.fetchQuery` adds no React subscriber, an explicit
  `gcTime` keeps the cache entry alive past resolution. Without it the
  global `gcTime: 0` would evict the entry immediately and every
  subsequent `set()` would POST again.

### onboardingStore

Per-app onboarding wizard state (current step, native platform, Flutter
sub-platform), persisted to `localStorage` under `measure_onboarding_<appId>`.
Hydrates synchronously on creation so the very first render already sees
the persisted step.

`markVerified(appId)` is the terminal transition; it clears the persisted
entry because there's nothing meaningful to resume on a refresh once the
flow is done.

### Files

| File | Purpose |
|------|---------|
| `provider.tsx` | React Context provider; exposes `useFiltersStore`, `useOnboardingStore`, `useMeasureStoreRegistry`. |
| `registry.ts` | `MeasureStoreRegistry` type. |
| `filters_store.ts` | `createFiltersStore`, `applyFilterOptions`, `pickApp`, `resolveRootSpanName`, URL serialization helpers. |
| `onboarding_store.ts` | `createOnboardingStore`, onboarding types, localStorage helpers. |
| `reset_all.ts` | Clears TanStack Query cache + resets both stores on logout. |

## Component patterns

### Filters mount

Pages render `<Filters>` with the `show*` flags appropriate to that page.
Filters owns the apps / filter-options / root-span-names tanstack queries,
mirrors their state into the store, runs `pickApp` to auto-select on first
load, and runs `applyFilterOptions` when fresh option data arrives.

### `queryClient` in components

Components that need to invalidate or refetch should use the
`useQueryClient()` hook, not the module-imported singleton. Both resolve to
the same client in production, but tests inject their own; the hook makes
that work transparently.

```ts
const queryClient = useQueryClient()
// ...
await queryClient.refetchQueries({ queryKey: ["filterApps", teamId] })
```

The singleton is still imported directly in two places that don't have a
React context: the `filterShortCodePromise` machinery in `filters_store.ts`
and `resetAllStores` in `reset_all.ts`.

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

`isFetching` drives loading bars and paginator-button disable state.
`keepPreviousData` keeps `status` at `'success'` during page transitions.

### Plot components

```tsx
const { data: plot, status } = useXPlotQuery(type, groupId)
const effectiveStatus = demo ? 'success' : status
const effectivePlot = demo ? demoPlot : plot
```

Demo mode bypasses the query and substitutes a fixture.

## Logout

`resetAllStores(registry)` in `reset_all.ts`:

1. `queryClient.clear()` — wipes all TanStack Query cached data.
2. `filtersStore.reset()` — back to initial selections.
3. `onboardingStore.reset()` — clears in-memory wizard state. Persisted
   `localStorage` entries are wiped per-step by the store's own actions,
   not here.

## Testing

- **Unit tests** (`__tests__/components/`, `__tests__/pages/`) — mock
  `@/app/query/hooks` with `jest.fn()` returning
  `{ data, status, isFetching, error }`. Mock `@/app/stores/provider` to
  expose `useFiltersStore` / `useOnboardingStore` over real stores you
  construct in the test so action-based assertions run against real logic.
- **Integration tests** (`__tests__/integration/`) — don't mock
  `@/app/query/hooks`. Let real hooks run with MSW intercepting API calls.
  Wrap renders in `QueryClientProvider` with a per-test client. Mock
  `@/app/stores/provider` and feed it real store instances created in
  `beforeEach`.
- **Store tests** (`__tests__/stores/`) — call `createFiltersStore()` /
  `createOnboardingStore()` directly and exercise actions and the pure
  helpers (`applyFilterOptions`, `pickApp`, `resolveRootSpanName`).
- **Query hook tests** (`__tests__/query/`) — `renderHook` with a fresh
  `QueryClient`, mock the underlying `api_calls.ts` functions.

When the mocked `useFiltersStore` / `useOnboardingStore` accepts an
optional selector, call `useStore` unconditionally with
`selector ?? ((s) => s)` — a `selector ? useStore(...) : useStore(...)`
ternary trips the `react-hooks/rules-of-hooks` lint.

## Navigation

Internal links MUST use `<Link>` from `next/link`. Raw `<a href>` causes
a full page reload that destroys React state and the TanStack Query cache.
