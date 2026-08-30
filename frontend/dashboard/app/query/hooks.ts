"use client";

import {
  JourneyType,
  SdkConfig,
  Team,
  changeAppApiKeyFromServer,
  changeAppNameFromServer,
  changeRoleFromServer,
  changeTeamNameFromServer,
  createAppFromServer,
  createTeamFromServer,
  defaultAppThresholdPrefs,
  downgradeToFreeFromServer,
  emptyAppRetention,
  emptyNotifPrefs,
  fetchAlertsOverviewFromServer,
  fetchAppRetentionFromServer,
  fetchAppThresholdPrefsFromServer,
  fetchAuthzAndMembersFromServer,
  fetchBillingInfoFromServer,
  fetchBugReportFromServer,
  fetchBugReportsOverviewFromServer,
  fetchBugReportsOverviewPlotFromServer,
  fetchBuildsFromServer,
  fetchCheckoutSessionFromServer,
  fetchCustomerPortalUrlFromServer,
  fetchErrorGroupCommonPathFromServer,
  fetchErrorsDetailsFromServer,
  fetchErrorsDetailsPlotFromServer,
  fetchErrorsDistributionPlotFromServer,
  fetchErrorsOverviewFromServer,
  fetchErrorsOverviewPlotFromServer,
  fetchJourneyFromServer,
  fetchMetricsFromServer,
  fetchNetworkEndpointsFromServer,
  fetchNetworkEndpointStatusCodesPlotFromServer,
  fetchNetworkLatencyPlotFromServer,
  fetchNetworkStatusCodesPlotFromServer,
  fetchNetworkTimelinePlotFromServer,
  fetchNetworkTrendsFromServer,
  fetchNotifPrefsFromServer,
  fetchPendingInvitesFromServer,
  fetchSdkConfigFromServer,
  fetchSessionReplayFromServer,
  fetchSessionReplayOverviewFromServer,
  fetchSessionReplayOverviewPlotFromServer,
  fetchAppHealthPlotFromServer,
  fetchSpanMetricsPlotFromServer,
  fetchSpansFromServer,
  fetchTeamSlackConnectUrlFromServer,
  fetchTeamSlackStatusFromServer,
  fetchTeamsFromServer,
  fetchTraceFromServer,
  fetchUsageFromServer,
  inviteMemberFromServer,
  removeMemberFromServer,
  removePendingInviteFromServer,
  removeTeamSlackFromServer,
  resendPendingInviteFromServer,
  sendTestSlackAlertFromServer,
  undoDowngradeFromServer,
  updateAppRetentionFromServer,
  updateAppThresholdPrefsFromServer,
  updateBugReportStatusFromServer,
  updateNotifPrefsFromServer,
  updateSdkConfigFromServer,
  updateTeamSlackStatusFromServer,
} from "@/app/api/api_calls";
import {
  App,
  AppVersion,
  fetchAppsFromServer,
  fetchFilterKeys,
  fetchFilterValues,
  fetchFiltersFromServer,
  fetchRootSpanNamesFromServer,
  FilterSource,
  OsVersion,
  UserDefAttr,
} from "@/app/api/api_calls";
import type { FilterKeysResponse } from "@/app/api/filter_types";
import { ApiError } from "@/app/api/api_error";
import { apiClient } from "@/app/api/api_client";
import { queryClient } from "@/app/query/query_client";
import type { FilterOptionsData } from "@/app/stores/filters_store";
import { useFiltersStore } from "@/app/stores/provider";
import {
  Query,
  keepPreviousData,
  useMutation,
  useQuery,
} from "@tanstack/react-query";

// ─── Filter options & session ────────────────────────────────────────────

function parseFilterResponse(data: any): FilterOptionsData {
  const versions =
    data.versions !== null
      ? data.versions.map(
          (v: { name: string; code: string }) => new AppVersion(v.name, v.code),
        )
      : [];

  const osVersions =
    data.os_versions !== null
      ? data.os_versions.map(
          (v: { name: string; version: string }) =>
            new OsVersion(v.name, v.version),
        )
      : [];

  let userDefAttrs: UserDefAttr[] = [];
  let userDefAttrOps = new Map<string, string[]>();
  if (
    data.ud_attrs !== null &&
    data.ud_attrs.key_types !== null &&
    data.ud_attrs.operator_types !== null
  ) {
    userDefAttrs = data.ud_attrs.key_types;
    userDefAttrOps = new Map<string, string[]>(
      Object.entries(data.ud_attrs.operator_types),
    );
  }

  return {
    versions,
    osVersions,
    countries: data.countries ?? [],
    networkProviders: data.network_providers ?? [],
    networkTypes: data.network_types ?? [],
    networkGenerations: data.network_generations ?? [],
    locales: data.locales ?? [],
    deviceManufacturers: data.device_manufacturers ?? [],
    deviceNames: data.device_names ?? [],
    userDefAttrs,
    userDefAttrOps,
  };
}

export function useAppsQuery(teamId: string | undefined) {
  return useQuery<App[]>({
    queryKey: ["filterApps", teamId] as const,
    queryFn: () => fetchAppsFromServer(teamId!),
    enabled: !!teamId,
  });
}

/**
 * The parsed form of FilterOptionsResult. It has the same four outcomes, and
 * the raw server response becomes the option lists that the store holds.
 */
export type ParsedFilterOptionsResult =
  | { kind: "options"; data: FilterOptionsData }
  | { kind: "no-data" }
  | { kind: "not-onboarded" }
  | { kind: "no-builds" };

export function useFilterOptionsQuery(
  app: App | null | undefined,
  filterSource: FilterSource,
) {
  return useQuery<ParsedFilterOptionsResult>({
    queryKey: [
      "filterOptions",
      app?.id,
      filterSource,
      app?.onboarded ?? false,
    ] as const,
    queryFn: async () => {
      // An app that is not onboarded has no events, so every event-derived
      // filterSource is empty. This code therefore skips the request. The
      // user can upload a build before onboarding, so the Builds source
      // always asks the server.
      if (!app!.onboarded && filterSource !== FilterSource.Builds) {
        return { kind: "not-onboarded" };
      }
      const result = await fetchFiltersFromServer(app!, filterSource);
      if (result.kind !== "options") {
        return result;
      }
      return { kind: "options", data: parseFilterResponse(result.data) };
    },
    enabled: !!app,
  });
}

// ─── Dynamic filters ─────────────────────────────────────────────────────

export function useFilterKeysQuery(
  appId: string | undefined,
  entity: string,
  keyNames: string[],
) {
  return useQuery<FilterKeysResponse>({
    queryKey: ["filterKeys", appId, entity, keyNames] as const,
    queryFn: () => fetchFilterKeys(appId!, entity, keyNames),
    enabled: !!appId,
    // The key names grow while the user types a custom key into the filter
    // text editor; keeping the last response stops every loaded key from
    // being flagged unknown during the refetch.
    placeholderData: keepPreviousData,
  });
}

/**
 * Kept fresh for a minute so reopening a picker does not refetch what was
 * just shown.
 */
export function useFilterValuesQuery(
  appId: string | undefined,
  entity: string,
  keyName: string | null,
  search: string,
) {
  return useQuery({
    queryKey: ["filterValues", appId, entity, keyName, search] as const,
    queryFn: () => fetchFilterValues(appId!, entity, keyName!, search),
    enabled: !!appId && !!keyName,
    staleTime: 60 * 1000,
  });
}

export function useRootSpanNamesQuery(app: App | null | undefined) {
  return useQuery<string[] | null>({
    queryKey: ["rootSpanNames", app?.id] as const,
    queryFn: () => fetchRootSpanNamesFromServer(app!),
    enabled: !!app,
  });
}

export type SessionUser = {
  id: string;
  own_team_id: string;
  name: string;
  email: string;
  avatar_url: string;
  confirmed_at: string;
  last_sign_in_at: string;
  created_at: string;
  updated_at: string;
};

export type Session = { user: SessionUser };

export async function fetchCurrentSession(): Promise<Session | null> {
  try {
    const res = await apiClient.fetch(`/api/auth/session`);
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    if (!data.user) {
      return null;
    }
    const user: SessionUser = {
      id: data.user.id,
      own_team_id: data.user.own_team_id,
      name: data.user.name,
      email: data.user.email,
      avatar_url: data.user.avatar_url,
      confirmed_at: data.user.confirmed_at,
      last_sign_in_at: data.user.last_sign_in_at,
      created_at: data.user.created_at,
      updated_at: data.user.updated_at,
    };
    return { user };
  } catch {
    // apiClient may navigate on auth failure; treat any throw as "no session"
    return null;
  }
}

export function useSessionQuery() {
  return useQuery<Session>({
    queryKey: ["session"] as const,
    queryFn: async () => {
      const session = await fetchCurrentSession();
      if (!session) {
        throw new Error("No session");
      }
      return session;
    },
    // Session info doesn't change often; keep it warm to avoid extra
    // /api/auth/session round-trips on every page navigation.
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export async function signOut(): Promise<void> {
  await fetch(`/auth/logout`, {
    method: "DELETE",
    credentials: "include",
  });
  apiClient.redirectToLogin();
}

// ─── Types ───────────────────────────────────────────────────────────────

export type ExceptionGroupCommonPath = {
  sessions_analyzed: number;
  steps: Array<{
    description: string;
    thread_name: string;
    confidence_pct: number;
  }>;
};

// ─── Constants re-exported for components ────────────────────────────────

export const paginationOffsetUrlKey = "po";

/**
 * Query inputs for the pages whose filter lives in the URL. The page derives
 * these from searchParams, so a query's filter and pagination offset always
 * come from the same URL snapshot.
 */
export type FilterParams = {
  appId: string;
  startDate: string;
  endDate: string;
  filterExpr: string | null;
};

export enum TrendsTab {
  Latency = "Latency",
  ErrorRate = "Error Rate",
  Frequency = "Frequency",
}

export enum RootSpanMetricsQuantile {
  p50 = "p50",
  p90 = "p90",
  p95 = "p95",
  p99 = "p99",
}

// ─── Shared helpers ──────────────────────────────────────────────────────

/** Standard plot transformation: datetime/instances → x/y */
function mapPlotData(data: any[] | null) {
  if (data === null) {
    return null;
  }
  return data.map((item: any) => ({
    id: item.id,
    data: item.data.map((d: any) => ({ x: d.datetime, y: d.instances })),
  }));
}

/** Span metrics: pick quantile value for y-axis */
function getYBasedOnQuantile(
  data: any,
  quantile: RootSpanMetricsQuantile,
): number {
  switch (quantile) {
    case RootSpanMetricsQuantile.p50:
      return data.p50;
    case RootSpanMetricsQuantile.p90:
      return data.p90;
    case RootSpanMetricsQuantile.p95:
      return data.p95;
    case RootSpanMetricsQuantile.p99:
      return data.p99;
  }
}

export function transformSpanMetricsPlotData(
  rawData: any,
  quantile: RootSpanMetricsQuantile,
) {
  return rawData.map((item: any) => ({
    id: item.id,
    data: item.data.map((data: any, index: number) => ({
      id: item.id + "." + index,
      x: data.datetime,
      y: getYBasedOnQuantile(data, quantile),
    })),
  }));
}

/** Distribution plot: parse attribute/value pairs with OS version formatting */
function formatAttribute(str: string, hasAndroidData: boolean = false): string {
  if (str === "os_version" && hasAndroidData) {
    return "API Level";
  }
  return str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatOsVersionKey(key: string): string {
  const parts = key.toLowerCase().split(" ");
  if (parts.length >= 2) {
    const osName = parts[0];
    const version = parts[1];
    const displayName =
      osName === "android"
        ? "Android API Level"
        : osName === "ios"
          ? "iOS"
          : osName === "ipados"
            ? "iPadOS"
            : osName;
    return `${displayName} ${version}`;
  }
  return key;
}

function parseDistributionPlot(resultData: any) {
  if (resultData === null) {
    return null;
  }
  const plotKeys: string[] = [];
  const plot = Object.entries(resultData).map(([attribute, values]) => {
    const transformedValues: { [key: string]: number } = {};
    let hasAndroidData = false;
    Object.entries(values as { [key: string]: number }).forEach(
      ([key, value]) => {
        if (
          attribute === "os_version" &&
          key.toLowerCase().startsWith("android")
        ) {
          hasAndroidData = true;
        }
        const transformedKey =
          attribute === "os_version" ? formatOsVersionKey(key) : key;
        transformedValues[transformedKey] = value;
        if (!plotKeys.includes(transformedKey)) {
          plotKeys.push(transformedKey);
        }
      },
    );
    return {
      attribute: formatAttribute(attribute, hasAndroidData),
      ...transformedValues,
    };
  });
  return { plot, plotKeys };
}

// ─── Metrics ─────────────────────────────────────────────────────────────

export function useMetricsQuery() {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: ["metrics", filters.serialisedFilters] as const,
    queryFn: () => fetchMetricsFromServer(filters),
    enabled: filters.ready,
  });
}

export function useAppThresholdPrefsQuery(appId: string | undefined) {
  return useQuery({
    queryKey: ["appThresholdPrefs", appId] as const,
    queryFn: () => fetchAppThresholdPrefsFromServer(appId!),
    enabled: !!appId,
  });
}

// ─── Journey ─────────────────────────────────────────────────────────────

export function useJourneyQuery(
  journeyType: JourneyType,
  bidirectional: boolean,
) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: [
      "journey",
      journeyType,
      bidirectional,
      filters.serialisedFilters,
    ] as const,
    queryFn: () => fetchJourneyFromServer(bidirectional, filters),
    enabled: filters.ready,
  });
}

// ─── Network ─────────────────────────────────────────────────────────────

// The network plot queries are scoped by an endpoint selection: an empty domain
// is every endpoint, a domain on its own is one domain, and a domain with a
// path is one endpoint.

const NETWORK_TRENDS_LIMIT = 10;

export function useNetworkEndpointsQuery(query: string, enabled: boolean) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: ["networkEndpoints", filters.serialisedFilters, query] as const,
    queryFn: ({ signal }) =>
      fetchNetworkEndpointsFromServer(filters, query, signal),
    enabled: enabled && filters.ready && !!filters.app,
  });
}

export function useNetworkLatencyQuery(domain: string, path: string) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: [
      "networkLatency",
      filters.serialisedFilters,
      domain,
      path,
    ] as const,
    queryFn: () => fetchNetworkLatencyPlotFromServer(filters, domain, path),
    // Latency only renders once a domain or path scope is picked, so a page
    // without either has nothing to fetch.
    enabled: filters.ready && !!filters.app && (domain !== "" || path !== ""),
  });
}

export function useNetworkStatusCodesQuery(domain: string, path: string) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: [
      "networkStatusCodes",
      filters.serialisedFilters,
      domain,
      path,
    ] as const,
    queryFn: () => fetchNetworkStatusCodesPlotFromServer(filters, domain, path),
    enabled: filters.ready && !!filters.app,
  });
}

export function useNetworkEndpointStatusCodesQuery(
  domain: string,
  path: string,
) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: [
      "networkEndpointStatusCodes",
      filters.serialisedFilters,
      domain,
      path,
    ] as const,
    queryFn: () =>
      fetchNetworkEndpointStatusCodesPlotFromServer(filters, domain, path),
    enabled: filters.ready && !!filters.app && (domain !== "" || path !== ""),
  });
}

export function useNetworkTimelineQuery(domain: string, path: string) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: [
      "networkTimeline",
      filters.serialisedFilters,
      domain,
      path,
    ] as const,
    queryFn: () => fetchNetworkTimelinePlotFromServer(filters, domain, path),
    enabled: filters.ready && !!filters.app,
  });
}

export function useNetworkTrendsQuery(active: boolean) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: ["networkTrends", filters.serialisedFilters] as const,
    queryFn: () => fetchNetworkTrendsFromServer(filters, NETWORK_TRENDS_LIMIT),
    enabled: filters.ready && active,
  });
}

// ─── Plot: Overview ──────────────────────────────────────────────────────

export function useBugReportsOverviewPlotQuery(params: FilterParams | null) {
  return useQuery({
    queryKey: [
      "bugReportsOverviewPlot",
      params?.appId,
      params?.startDate,
      params?.endDate,
      params?.filterExpr,
    ] as const,
    queryFn: async () => {
      const result = await fetchBugReportsOverviewPlotFromServer(
        params!.appId,
        params!.startDate,
        params!.endDate,
        params!.filterExpr,
      );
      return mapPlotData(result);
    },
    enabled: params !== null,
    retry: false,
  });
}

export function useSessionReplayOverviewPlotQuery() {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: ["sessionReplayOverviewPlot", filters.serialisedFilters] as const,
    queryFn: async () => {
      const result = await fetchSessionReplayOverviewPlotFromServer(filters);
      return mapPlotData(result);
    },
    enabled: filters.ready,
  });
}

export function useAppHealthPlotQuery() {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: ["appHealthPlot", filters.serialisedFilters] as const,
    queryFn: () => fetchAppHealthPlotFromServer(filters),
    enabled: filters.ready,
  });
}

// ─── Plot: Span Metrics ──────────────────────────────────────────────────

export function useSpanMetricsPlotQuery(
  params: FilterParams | null,
  spanName: string | null,
) {
  return useQuery({
    queryKey: [
      "spanMetricsPlot",
      params?.appId,
      params?.startDate,
      params?.endDate,
      params?.filterExpr,
      spanName,
    ] as const,
    queryFn: () =>
      fetchSpanMetricsPlotFromServer(
        params!.appId,
        spanName!,
        params!.startDate,
        params!.endDate,
        params!.filterExpr,
      ),
    enabled: params !== null && spanName !== null,
    retry: false,
  });
}

// ─── Paginated: Alerts ───────────────────────────────────────────────────

const ALERTS_LIMIT = 5;

export function useAlertsOverviewQuery(paginationOffset: number) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: [
      "alertsOverview",
      filters.serialisedFilters,
      paginationOffset,
    ] as const,
    placeholderData: keepPreviousData,
    queryFn: () =>
      fetchAlertsOverviewFromServer(filters, ALERTS_LIMIT, paginationOffset),
    enabled: filters.ready,
  });
}

// ─── Paginated: Bug Reports ──────────────────────────────────────────────

const BUG_REPORTS_LIMIT = 5;

export function useBugReportsOverviewQuery(
  params: FilterParams | null,
  paginationOffset: number,
) {
  return useQuery({
    queryKey: [
      "bugReportsOverview",
      params?.appId,
      params?.startDate,
      params?.endDate,
      params?.filterExpr,
      paginationOffset,
    ] as const,
    placeholderData: keepPreviousData,
    queryFn: () =>
      fetchBugReportsOverviewFromServer(
        params!.appId,
        params!.startDate,
        params!.endDate,
        params!.filterExpr,
        BUG_REPORTS_LIMIT,
        paginationOffset,
      ),
    enabled: params !== null,
    retry: false,
  });
}

// ─── Paginated: Builds ───────────────────────────────────────────────────

const BUILDS_LIMIT = 10;

export function useBuildsQuery(
  params: FilterParams | null,
  paginationOffset: number,
) {
  return useQuery({
    queryKey: [
      "builds",
      params?.appId,
      params?.startDate,
      params?.endDate,
      params?.filterExpr,
      paginationOffset,
    ] as const,
    placeholderData: keepPreviousData,
    queryFn: () =>
      fetchBuildsFromServer(
        params!.appId,
        params!.startDate,
        params!.endDate,
        params!.filterExpr,
        BUILDS_LIMIT,
        paginationOffset,
      ),
    enabled: params !== null,
    retry: false,
  });
}

// ─── Paginated: Traces ───────────────────────────────────────────────────

const TRACES_LIMIT = 5;

export function useSpansQuery(
  params: FilterParams | null,
  spanName: string | null,
  paginationOffset: number,
) {
  return useQuery({
    queryKey: [
      "spans",
      params?.appId,
      params?.startDate,
      params?.endDate,
      params?.filterExpr,
      spanName,
      paginationOffset,
    ] as const,
    placeholderData: keepPreviousData,
    queryFn: () =>
      fetchSpansFromServer(
        params!.appId,
        spanName!,
        params!.startDate,
        params!.endDate,
        params!.filterExpr,
        TRACES_LIMIT,
        paginationOffset,
      ),
    enabled: params !== null && spanName !== null,
    retry: false,
  });
}

// ─── Paginated: Session Replay ────────────────────────────────────────

const SESSION_REPLAY_LIMIT = 5;

export function useSessionReplayOverviewQuery(paginationOffset: number) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: [
      "sessionReplayOverview",
      filters.serialisedFilters,
      paginationOffset,
    ] as const,
    placeholderData: keepPreviousData,
    queryFn: () =>
      fetchSessionReplayOverviewFromServer(
        filters,
        SESSION_REPLAY_LIMIT,
        paginationOffset,
      ),
    enabled: filters.ready,
  });
}

// ─── Errors (unified Crashes + ANRs) ─────────────────────────────────────

const ERRORS_OVERVIEW_LIMIT = 5;
const ERRORS_DETAILS_LIMIT = 1;

export function useErrorsOverviewQuery(paginationOffset: number) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: [
      "errorsOverview",
      filters.serialisedFilters,
      paginationOffset,
    ] as const,
    placeholderData: keepPreviousData,
    queryFn: () =>
      fetchErrorsOverviewFromServer(
        filters,
        ERRORS_OVERVIEW_LIMIT,
        paginationOffset,
      ),
    enabled: filters.ready,
  });
}

export function useErrorsOverviewPlotQuery() {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: ["errorsOverviewPlot", filters.serialisedFilters] as const,
    queryFn: async () => {
      const result = await fetchErrorsOverviewPlotFromServer(filters);
      return mapPlotData(result);
    },
    enabled: filters.ready,
  });
}

export function useErrorsDetailsQuery(
  errorGroupId: string,
  paginationOffset: number,
) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: [
      "errorsDetails",
      errorGroupId,
      filters.serialisedFilters,
      paginationOffset,
    ] as const,
    placeholderData: keepPreviousData,
    queryFn: () =>
      fetchErrorsDetailsFromServer(
        errorGroupId,
        paginationOffset,
        filters,
        ERRORS_DETAILS_LIMIT,
      ),
    enabled: filters.ready && errorGroupId !== "",
  });
}

export function useErrorsDetailsPlotQuery(errorGroupId: string) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: [
      "errorsDetailsPlot",
      errorGroupId,
      filters.serialisedFilters,
    ] as const,
    queryFn: async () => {
      const result = await fetchErrorsDetailsPlotFromServer(
        errorGroupId,
        filters,
      );
      return mapPlotData(result);
    },
    enabled: filters.ready && errorGroupId !== "",
  });
}

export function useErrorsDistributionPlotQuery(errorGroupId: string) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: [
      "errorsDistributionPlot",
      errorGroupId,
      filters.serialisedFilters,
    ] as const,
    queryFn: async () => {
      const result = await fetchErrorsDistributionPlotFromServer(
        errorGroupId,
        filters,
      );
      return parseDistributionPlot(result);
    },
    enabled: filters.ready && errorGroupId !== "",
  });
}

export function useErrorGroupCommonPathQuery(errorGroupId: string) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery<ExceptionGroupCommonPath>({
    queryKey: ["errorGroupCommonPath", filters.app?.id, errorGroupId] as const,
    queryFn: async () => {
      const result = await fetchErrorGroupCommonPathFromServer(
        errorGroupId,
        filters,
      );
      return result as ExceptionGroupCommonPath;
    },
    enabled: !!filters.app && !!errorGroupId,
  });
}

// ─── Teams ──────────────────────────────────────────────────────────────

export function useTeamsQuery() {
  return useQuery({
    queryKey: ["teams"] as const,
    queryFn: () => fetchTeamsFromServer(),
  });
}

// ─── Trace Details ──────────────────────────────────────────────────────

export function useTraceQuery(appId: string, traceId: string) {
  return useQuery({
    queryKey: ["trace", appId, traceId] as const,
    queryFn: () => fetchTraceFromServer(appId, traceId),
    enabled: !!appId && !!traceId,
  });
}

// ─── Session Replay ───────────────────────────────────────────────────

export function useSessionReplayQuery(appId: string, sessionId: string) {
  return useQuery({
    queryKey: ["sessionReplay", appId, sessionId] as const,
    queryFn: () => fetchSessionReplayFromServer(appId, sessionId),
    enabled: !!appId && !!sessionId,
    // Attachment URLs are presigned for 48 hours, so returning to a tab left
    // open longer than that draws against expired ones. Coming back to the tab
    // refetches and re-signs them, and the staleness window keeps a quick
    // switch away and back from asking for the whole session again.
    refetchOnWindowFocus: true,
    staleTime: 30 * 60 * 1000,
  });
}

// ─── Bug Report ─────────────────────────────────────────────────────────

export function useBugReportQuery(appId: string, bugReportId: string) {
  return useQuery({
    queryKey: ["bugReport", appId, bugReportId] as const,
    queryFn: () => fetchBugReportFromServer(appId, bugReportId),
    enabled: !!appId && !!bugReportId,
  });
}

export function useToggleBugReportStatusMutation() {
  return useMutation({
    mutationFn: async (params: {
      appId: string;
      bugReportId: string;
      newStatus: number;
    }) => {
      await updateBugReportStatusFromServer(
        params.appId,
        params.bugReportId,
        params.newStatus,
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["bugReport", variables.appId, variables.bugReportId],
      });
      queryClient.invalidateQueries({ queryKey: ["bugReportsOverview"] });
    },
  });
}

// ─── Notification Preferences ───────────────────────────────────────────

export function useNotifPrefsQuery() {
  return useQuery({
    queryKey: ["notifPrefs"] as const,
    queryFn: () => fetchNotifPrefsFromServer(),
  });
}

export function useSaveNotifPrefsMutation() {
  return useMutation({
    mutationFn: async (params: { notifPrefs: typeof emptyNotifPrefs }) => {
      try {
        await updateNotifPrefsFromServer(params.notifPrefs);
      } catch {
        // The preferences page shows this message below its own heading.
        // The message therefore names the user's task, and does not repeat
        // the server's words for the same failure.
        throw new Error("Failed to save notification preferences");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifPrefs"] });
    },
  });
}

// ─── Create App ─────────────────────────────────────────────────────────

export function useCreateAppMutation() {
  return useMutation({
    mutationFn: (params: { teamId: string; appName: string }) =>
      createAppFromServer(params.teamId, params.appName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

// ─── Create Team ────────────────────────────────────────────────────────

export function useCreateTeamMutation() {
  return useMutation({
    mutationFn: async (params: { teamName: string }) => {
      const result = await createTeamFromServer(params.teamName);
      return result as Team;
    },
    onSuccess: (newTeam) => {
      queryClient.setQueryData<Team[]>(["teams"], (old) =>
        old ? [...old, newTeam] : [newTeam],
      );
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

// ─── Apps Store: Reads ──────────────────────────────────────────────────

export function useAuthzAndMembersQuery(teamId: string | undefined) {
  return useQuery({
    queryKey: ["authzAndMembers", teamId] as const,
    queryFn: () => fetchAuthzAndMembersFromServer(teamId!),
    enabled: !!teamId,
  });
}

export function useAppRetentionQuery(appId: string | undefined) {
  return useQuery({
    queryKey: ["appRetention", appId] as const,
    queryFn: () => fetchAppRetentionFromServer(appId!),
    enabled: !!appId,
  });
}

export function useSdkConfigQuery(appId: string | undefined) {
  return useQuery({
    queryKey: ["sdkConfig", appId] as const,
    queryFn: () => fetchSdkConfigFromServer(appId!),
    enabled: !!appId,
  });
}

type BillingInfoData = Awaited<ReturnType<typeof fetchBillingInfoFromServer>>;

type RefetchInterval =
  | number
  | false
  | ((q: Query<BillingInfoData>) => number | false);

export function useBillingInfoQuery(
  teamId: string | undefined,
  opts?: { refetchInterval?: RefetchInterval },
) {
  return useQuery({
    queryKey: ["billingInfo", teamId] as const,
    queryFn: () => fetchBillingInfoFromServer(teamId!),
    enabled: !!teamId,
    refetchInterval: opts?.refetchInterval,
  });
}

// ─── Apps Store: Mutations ──────────────────────────────────────────────

export function useUpdateAppRetentionMutation() {
  return useMutation({
    mutationFn: async (params: {
      appId: string;
      retention: typeof emptyAppRetention;
    }) => {
      await updateAppRetentionFromServer(params.appId, params.retention);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["appRetention", variables.appId],
      });
    },
  });
}

export function useChangeAppNameMutation() {
  return useMutation({
    mutationFn: async (params: { appId: string; appName: string }) => {
      await changeAppNameFromServer(params.appId, params.appName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useChangeAppApiKeyMutation() {
  return useMutation({
    mutationFn: async (params: { appId: string }) => {
      await changeAppApiKeyFromServer(params.appId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useUpdateAppThresholdPrefsMutation() {
  return useMutation({
    mutationFn: async (params: {
      appId: string;
      prefs: typeof defaultAppThresholdPrefs;
    }) => {
      await updateAppThresholdPrefsFromServer(params.appId, params.prefs);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["appThresholdPrefs", variables.appId],
      });
    },
  });
}

// ─── SDK Configurator ───────────────────────────────────────────────────

export function useSaveSdkConfigMutation() {
  return useMutation({
    mutationFn: (params: { appId: string; config: Partial<SdkConfig> }) =>
      updateSdkConfigFromServer(params.appId, params.config),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["sdkConfig", variables.appId],
      });
    },
  });
}

// ─── Team Page: Reads ───────────────────────────────────────────────────

export function usePendingInvitesQuery(teamId: string | undefined) {
  return useQuery({
    queryKey: ["pendingInvites", teamId] as const,
    queryFn: () => fetchPendingInvitesFromServer(teamId!),
    enabled: !!teamId,
  });
}

export function useTeamSlackConnectUrlQuery(
  teamId: string | undefined,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: ["teamSlackConnectUrl", teamId] as const,
    queryFn: async () => {
      const result = await fetchTeamSlackConnectUrlFromServer(teamId!);
      return result.url as string;
    },
    enabled: !!teamId && enabled,
  });
}

export function useTeamSlackStatusQuery(teamId: string | undefined) {
  return useQuery({
    queryKey: ["teamSlackStatus", teamId] as const,
    queryFn: () => fetchTeamSlackStatusFromServer(teamId!),
    enabled: !!teamId,
  });
}

// ─── Team Page: Mutations ───────────────────────────────────────────────

export function useChangeTeamNameMutation() {
  return useMutation({
    mutationFn: async (params: { teamId: string; newName: string }) => {
      await changeTeamNameFromServer(params.teamId, params.newName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useInviteMemberMutation() {
  return useMutation({
    mutationFn: async (params: {
      teamId: string;
      email: string;
      role: string;
    }) => {
      await inviteMemberFromServer(params.teamId, params.email, params.role);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["authzAndMembers", variables.teamId],
      });
      queryClient.invalidateQueries({
        queryKey: ["pendingInvites", variables.teamId],
      });
    },
  });
}

export function useRemoveMemberMutation() {
  return useMutation({
    mutationFn: async (params: { teamId: string; memberId: string }) => {
      await removeMemberFromServer(params.teamId, params.memberId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["authzAndMembers", variables.teamId],
      });
    },
  });
}

export function useResendPendingInviteMutation() {
  return useMutation({
    mutationFn: async (params: { teamId: string; inviteId: string }) => {
      await resendPendingInviteFromServer(params.teamId, params.inviteId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["pendingInvites", variables.teamId],
      });
    },
  });
}

export function useRemovePendingInviteMutation() {
  return useMutation({
    mutationFn: async (params: { teamId: string; inviteId: string }) => {
      await removePendingInviteFromServer(params.teamId, params.inviteId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["pendingInvites", variables.teamId],
      });
    },
  });
}

export function useChangeRoleMutation() {
  return useMutation({
    mutationFn: async (params: {
      teamId: string;
      newRole: string;
      memberId: string;
    }) => {
      await changeRoleFromServer(
        params.teamId,
        params.newRole,
        params.memberId,
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["authzAndMembers", variables.teamId],
      });
    },
  });
}

export function useUpdateSlackStatusMutation() {
  return useMutation({
    mutationFn: async (params: { teamId: string; status: boolean }) => {
      await updateTeamSlackStatusFromServer(params.teamId, params.status);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["teamSlackStatus", variables.teamId],
      });
    },
  });
}

export function useRemoveTeamSlackMutation() {
  return useMutation({
    mutationFn: async (params: { teamId: string }) => {
      await removeTeamSlackFromServer(params.teamId);
    },
    // Settled, not just success: a failed remove can mean the integration is
    // already gone (removed from another session) or that the response was
    // lost after the server deleted the row, so refetch the status in either
    // case.
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["teamSlackStatus", variables.teamId],
      });
    },
  });
}

export function useTestSlackAlertMutation() {
  return useMutation({
    mutationFn: async (params: { teamId: string }) => {
      await sendTestSlackAlertFromServer(params.teamId);
    },
  });
}

// ─── Usage Store: Reads ─────────────────────────────────────────────────

export function useUsageQuery(teamId: string | undefined) {
  return useQuery({
    queryKey: ["usage", teamId] as const,
    queryFn: () => fetchUsageFromServer(teamId!),
    enabled: !!teamId,
  });
}

export function useUsagePermissionsQuery(teamId: string | undefined) {
  return useQuery({
    queryKey: ["usagePermissions", teamId] as const,
    queryFn: async () => {
      const result = await fetchAuthzAndMembersFromServer(teamId!);
      return { canChangePlan: result.can_change_billing === true };
    },
    enabled: !!teamId,
  });
}

// ─── Usage Store: Mutations ─────────────────────────────────────────────

export function useHandleUpgradeMutation() {
  return useMutation({
    mutationFn: (params: { teamId: string; successUrl: string }) =>
      fetchCheckoutSessionFromServer(params.teamId, params.successUrl),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["billingInfo", variables.teamId],
      });
    },
  });
}

export function useDowngradeToFreeMutation() {
  return useMutation({
    mutationFn: (params: { teamId: string }) =>
      downgradeToFreeFromServer(params.teamId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["billingInfo", variables.teamId],
      });
    },
  });
}

export function useUndoDowngradeMutation() {
  return useMutation({
    mutationFn: (params: { teamId: string }) =>
      undoDowngradeFromServer(params.teamId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["billingInfo", variables.teamId],
      });
    },
  });
}

export async function fetchCustomerPortalUrl(
  teamId: string,
  returnUrl: string,
): Promise<{ redirect?: string; error?: string }> {
  try {
    const result = await fetchCustomerPortalUrlFromServer(teamId, returnUrl);
    if (result?.url) {
      return { redirect: result.url };
    }
    return { error: "No portal URL returned." };
  } catch (e) {
    if (e instanceof ApiError) {
      return { error: "Please try again." };
    }
    return { error: "Request was cancelled." };
  }
}
