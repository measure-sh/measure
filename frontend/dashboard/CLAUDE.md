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
| `backend/api/measure/billing.go` | `BillingInfo` response | `makeBillingInfoFixture` |
| `backend/api/measure/app.go` | app retention response | `makeAppRetentionFixture` |
| `backend/api/measure/app.go` | SDK config response | `makeSdkConfigFixture` |
| `backend/api/measure/authz.go` | authz+members response | `makeAuthzAndMembersFixture` |
| `backend/api/measure/team.go` | teams list response | `makeTeamsFixture` |
| `backend/api/measure/team.go` | pending invites response | `makePendingInvitesFixture` |
| `backend/api/measure/team.go` | Slack connect URL | `makeSlackConnectUrlFixture` |
| `backend/api/measure/team.go` | Slack status response | `makeSlackStatusFixture` |
| `backend/api/measure/prefs.go` | notification prefs response | `makeNotifPrefsFixture` |
| `backend/api/measure/usage.go` | usage response | `makeUsageFixture` |

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

## Billing system

Billing is owned by Autumn (https://useautumn.com), which sits on top of
Stripe. The backend is a thin wrapper; the dashboard calls one endpoint
for everything.

### Plans

Configured in the Autumn dashboard, not in code. Each plan has a `bytes`
feature (monthly cap) and a `retention_days` feature (data retention).

- **measure_free** — 5 GB / month, 30 days retention. Marked `is_default`
  in Autumn so it auto-activates after Pro cancellation.
- **measure_pro** — $50/mo minimum, 25 GB included, $2/GB overage,
  90 days retention.
- **enterprise** — bespoke per-customer plans created manually in Autumn.

> Plan IDs (`measure_free`, `measure_pro`) are hardcoded in the backend
> (`backend/api/measure/billing.go`). Renaming in the Autumn dashboard
> requires a coordinated code change — otherwise the backend silently
> mis-classifies the plan as Enterprise via the fallthrough.

### Frontend reads

- `useBillingInfoQuery` → `GET /teams/{id}/billing/info` → `BillingInfo`:
  `plan`, `bytes_granted`, `bytes_used`, `status`, `current_period_start`,
  `current_period_end`, `canceled_at`. Backend resolves these from
  `autumn.GetCustomer` and surfaces only the fields the UI needs.
- The public `/pricing` page can't reach `BillingInfo` (no auth, no team
  context). It uses hardcoded values in `app/utils/pricing_constants.ts`
  which must be hand-synced with the Autumn dashboard.
- The Pro card's "Undo Cancellation" UI is gated on
  `plan === 'pro' && canceled_at > 0 && current_period_end * 1000 > Date.now()`.
  All three are required — past `current_period_end` is treated as no
  cancellation pending so the page doesn't render stale dates.

### Frontend writes

- `useHandleUpgradeMutation` → `PATCH /billing/checkout` → returns a Stripe
  Checkout URL or `{already_upgraded: true}`.
- `useDowngradeToFreeMutation` → `PATCH /billing/downgrade` → schedules an
  end-of-cycle cancel. Surfaces as `canceled_at > 0` on the next
  `BillingInfo` fetch.
- `useUndoDowngradeMutation` → `PATCH /billing/undo-downgrade` → reverses
  a pending cancel. Only valid when `canceled_at > 0`.
- `fetchCustomerPortalUrl` → `POST /billing/portal` → Stripe customer
  portal redirect.

After a Stripe Checkout redirect-back (`?success=true`), the usage page
sets `awaitingProConfirmation` and the `useBillingInfoQuery` polls every
1s until `plan === 'pro'`. No timeout — a refresh resets it.

### Plan transitions

The backend listens for `customer.products.updated` webhooks from Autumn
and resets per-app retention based on the new plan's `retention_days`.
Email notifications fire on actual transitions (`upgrade`, `downgrade`,
`expired`); scheduling/uncancelling/renewals are silent on the email
side because the user already saw a UI confirmation.
