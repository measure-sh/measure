# Dashboard — Claude Code instructions

## API fixture maintenance

MSW integration tests (`__tests__/integration/`) use fixture factories in
`__tests__/msw/fixtures.ts` whose shapes must match the Go backend response
structs. **When you change a backend API response struct, update the
corresponding fixture factory.** The mapping is:

| Backend file | Go struct | Fixture factory |
|---|---|---|
| `backend/api/measure/app.go` | `App` | `makeAppFixture` |
| `backend/api/measure/app.go` | `GetAppFilters` response | `makeFiltersFixture` |
| `backend/api/measure/app.go` | `CreateShortFilters` response | `makeShortFiltersFixture` |
| `backend/api/session/plot.go` | `SessionInstance` | `makeSessionPlotFixture` |
| `backend/api/event/plot.go` | `IssueInstance` | `makeCrashPlotFixture`, `makeAnrPlotFixture` |
| `backend/api/metrics/metrics.go` | `LaunchMetric`, `SessionAdoption`, etc. | `makeMetricsFixture` |
| `backend/api/measure/app_threshold_prefs.go` | `AppThresholdPrefs` | `makeThresholdPrefsFixture` |
| `backend/api/measure/bug_report.go` | bug report list response | `makeBugReportsOverviewFixture` |
| `backend/api/measure/bug_report.go` | single bug report response | `makeBugReportDetailFixture` |
| `backend/api/measure/bug_report.go` | bug report plot response | `makeBugReportsPlotFixture` |
| `backend/api/measure/alert.go` | alerts list response | `makeAlertsOverviewFixture` |
| `backend/api/measure/span.go` | spans list response | `makeSpansOverviewFixture` |
| `backend/api/measure/span.go` | single trace response | `makeTraceDetailFixture` |
| `backend/api/measure/span.go` | span metrics plot response | `makeSpanMetricsPlotFixture` |
| `backend/api/measure/network.go` | network domains response | `makeNetworkDomainsFixture` |
| `backend/api/measure/network.go` | network paths response | `makeNetworkPathsFixture` |
| `backend/api/measure/network.go` | network overview status codes | `makeNetworkOverviewStatusCodesFixture` |
| `backend/api/measure/network.go` | network trends response | `makeNetworkTrendsFixture` |
| `backend/api/measure/network.go` | network overview timeline | `makeNetworkTimelineFixture` |
| `backend/api/measure/network.go` | endpoint latency plot | `makeNetworkEndpointLatencyFixture` |
| `backend/api/measure/network.go` | endpoint status codes plot | `makeNetworkEndpointStatusCodesFixture` |
| `backend/api/measure/network.go` | endpoint timeline plot | `makeNetworkEndpointTimelineFixture` |
| `backend/api/measure/authz.go` | authz permissions response | `makeAuthzFixture` |
| `backend/api/measure/billing.go` | billing info response | `makeBillingInfoFixture` |
| `backend/api/measure/app.go` | app retention response | `makeAppRetentionFixture` |
| `backend/api/measure/app.go` | SDK config response | `makeSdkConfigFixture` |
| `backend/api/measure/authz.go` | authz+members response | `makeAuthzAndMembersFixture` |
| `backend/api/measure/team.go` | teams list response | `makeTeamsFixture` |
| `backend/api/measure/team.go` | pending invites response | `makePendingInvitesFixture` |
| `backend/api/measure/team.go` | Slack connect URL | `makeSlackConnectUrlFixture` |
| `backend/api/measure/team.go` | Slack status response | `makeSlackStatusFixture` |
| `backend/api/measure/prefs.go` | notification prefs response | `makeNotifPrefsFixture` |
| `backend/api/measure/usage.go` | usage response | `makeUsageFixture` |
| `backend/api/measure/billing.go` | subscription info response | `makeSubscriptionInfoFixture` |

If you add a new page's integration test, add its fixtures to the same file
and extend this table.

## Test commands

```sh
npm test                  # runs BOTH unit + integration tests sequentially
npm run test:unit         # unit + store + component tests only (jest.config.ts)
npm run test:integration  # MSW integration tests only (jest.integration.config.ts)
```

Integration tests live in `__tests__/integration/` and use a separate jest
config because MSW's ESM transitive deps need different `transformIgnorePatterns`
than what `next/jest` provides by default.

## Architecture overview

The app follows three rules for where state and data live:

- **Server data** (API responses) → TanStack Query (`app/query/hooks.ts`)
- **Shared client state** (filters, auth) → Zustand (`app/stores/`)
- **Side effects** (URL sync, pagination reset) → `useEffect`

### How to decide where state belongs

Ask two questions:

1. **Does the server own this data?** (API response, database record, computed
   on the backend) → **TanStack Query**. The server is the source of truth;
   the client is just a cache.
2. **Do multiple components need to read or write it, and is it client-owned?**
   (user's filter selections, who is logged in, UI toggles shared across
   siblings) → **Zustand**. The client is the source of truth; there is no
   server equivalent.

If neither — it's local to one component → **`useState`**.

Do not put server data in Zustand. Do not put single-component UI state in
Zustand. Do not use TanStack Query for client-owned state.

### Data fetching — TanStack Query

All reads and writes go through hooks in `app/query/hooks.ts`:

- **Query hooks** (`useXQuery`) for GET requests — automatic caching,
  deduplication, stale-while-revalidate. Paginated queries use
  `placeholderData: keepPreviousData` to avoid flashing.
- **Mutation hooks** (`useXMutation`) for POST/PUT/DELETE — `onSuccess`
  invalidates related query keys automatically.
- **Components** import hooks from `@/app/query/hooks`, never call
  `api_calls` functions directly.
- **Cache config** in `app/query/query_client.ts`: `staleTime: 30s`,
  `gcTime: 5min`, `retry: 0`, `refetchOnWindowFocus: false`.

### Client state — Zustand (3 stores)

| Store | Purpose |
|---|---|
| `filtersStore` | Filter selections, config, app/date persistence, shortcode cache |
| `sessionStore` | Auth session, OAuth flow |
| `userJourneysStore` | Pure UI state (plot type, search text) |

Stores use the [Zustand Next.js provider pattern](https://zustand.docs.pmnd.rs/learn/guides/nextjs)
via `app/stores/provider.tsx`.

### Navigation

Internal links MUST use `<Link>` from `next/link` (not raw `<a href>`) to
preserve React state and TanStack Query cache across navigations.

### Filters behaviour

- **Persisted across pages**: selected app, versions, date range
- **Reset to defaults on page navigation**: all other filters (countries,
  OS versions, etc.)
- **`setConfig()`** controls which filter UI controls are visible per page
- **`FilterSource`** is passed as a query flag (`?crash=1`, `?anr=1`,
  `?span=1`) to the same `/api/apps/{id}/filters` endpoint
- **ShortCode cache** has a 5-minute TTL; backend cleans up after 1 hour

See `app/stores/ARCHITECTURE.md` for detailed filters store internals.

## Things to avoid

- Do not use raw `<a href>` for internal navigation
- Do not call `api_calls` functions directly from components — use query hooks
- Do not add server-data state to Zustand stores — use TanStack Query
- Do not mock `@/app/query/hooks` in integration tests — let MSW intercept
