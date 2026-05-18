"use client";

import {
  AlertsOverviewApiStatus,
  AppApiKeyChangeApiStatus,
  AppNameChangeApiStatus,
  AuthzAndMembersApiStatus,
  BugReportApiStatus,
  BugReportsOverviewApiStatus,
  BugReportsOverviewPlotApiStatus,
  CreateAppApiStatus,
  CreateTeamApiStatus,
  DowngradeToFreeApiStatus,
  ExceptionGroupCommonPathApiStatus,
  ExceptionsDetailsApiStatus,
  ExceptionsDetailsPlotApiStatus,
  ExceptionsDistributionPlotApiStatus,
  ExceptionsOverviewApiStatus,
  ExceptionsOverviewPlotApiStatus,
  ExceptionsType,
  FetchAppRetentionApiStatus,
  FetchAppThresholdPrefsApiStatus,
  FetchBillingInfoApiStatus,
  FetchCheckoutSessionApiStatus,
  FetchCustomerPortalUrlApiStatus,
  FetchNotifPrefsApiStatus,
  FetchTeamSlackConnectUrlApiStatus,
  FetchTeamSlackStatusApiStatus,
  FetchUsageApiStatus,
  InviteMemberApiStatus,
  JourneyApiStatus,
  JourneyType,
  MetricsApiStatus,
  NetworkDomainsApiStatus,
  NetworkEndpointLatencyPlotApiStatus,
  NetworkEndpointStatusCodesPlotApiStatus,
  NetworkEndpointTimelinePlotApiStatus,
  NetworkOverviewStatusCodesPlotApiStatus,
  NetworkPathsApiStatus,
  NetworkTimelinePlotApiStatus,
  NetworkTrendsApiStatus,
  PendingInvitesApiStatus,
  RemoveMemberApiStatus,
  RemovePendingInviteApiStatus,
  ResendPendingInviteApiStatus,
  RoleChangeApiStatus,
  SdkConfig,
  SdkConfigApiStatus,
  SessionTimelineApiStatus,
  SessionTimelinesOverviewApiStatus,
  SessionTimelinesOverviewPlotApiStatus,
  SessionsVsExceptionsPlotApiStatus,
  SpanMetricsPlotApiStatus,
  SpansApiStatus,
  Team,
  TeamNameChangeApiStatus,
  TeamsApiStatus,
  TestSlackAlertApiStatus,
  TraceApiStatus,
  UndoDowngradeApiStatus,
  UpdateAppRetentionApiStatus,
  UpdateAppThresholdPrefsApiStatus,
  UpdateBugReportStatusApiStatus,
  UpdateNotifPrefsApiStatus,
  UpdateSdkConfigApiStatus,
  UpdateTeamSlackStatusApiStatus,
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
  fetchCheckoutSessionFromServer,
  fetchCustomerPortalUrlFromServer,
  fetchExceptionGroupCommonPathFromServer,
  fetchExceptionsDetailsFromServer,
  fetchExceptionsDetailsPlotFromServer,
  fetchExceptionsDistributionPlotFromServer,
  fetchExceptionsOverviewFromServer,
  fetchExceptionsOverviewPlotFromServer,
  fetchJourneyFromServer,
  fetchMetricsFromServer,
  fetchNetworkDomainsFromServer,
  fetchNetworkEndpointLatencyPlotFromServer,
  fetchNetworkEndpointStatusCodesPlotFromServer,
  fetchNetworkEndpointTimelinePlotFromServer,
  fetchNetworkOverviewStatusCodesPlotFromServer,
  fetchNetworkPathsFromServer,
  fetchNetworkTimelinePlotFromServer,
  fetchNetworkTrendsFromServer,
  fetchNotifPrefsFromServer,
  fetchPendingInvitesFromServer,
  fetchSdkConfigFromServer,
  fetchSessionTimelineFromServer,
  fetchSessionTimelinesOverviewFromServer,
  fetchSessionTimelinesOverviewPlotFromServer,
  fetchSessionsVsExceptionsPlotFromServer,
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
  AppsApiStatus,
  AppVersion,
  fetchAppsFromServer,
  fetchFiltersFromServer,
  fetchRootSpanNamesFromServer,
  FiltersApiStatus,
  FilterSource,
  OsVersion,
  RootSpanNamesApiStatus,
  UserDefAttr,
} from "@/app/api/api_calls";
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

export type AppsQueryResult = {
  status: AppsApiStatus;
  data: App[];
};

export function useAppsQuery(teamId: string | undefined) {
  return useQuery<AppsQueryResult>({
    queryKey: ["filterApps", teamId] as const,
    queryFn: async () => {
      const r = await fetchAppsFromServer(teamId!);
      if (r.status === AppsApiStatus.Error) {
        throw new Error("Failed to fetch apps");
      }
      return { status: r.status, data: (r.data as App[] | null) ?? [] };
    },
    enabled: !!teamId,
  });
}

export type FilterOptionsQueryResult = {
  status: FiltersApiStatus;
  data: FilterOptionsData | null;
};

export function useFilterOptionsQuery(
  app: App | null | undefined,
  filterSource: FilterSource,
) {
  return useQuery<FilterOptionsQueryResult>({
    queryKey: [
      "filterOptions",
      app?.id,
      filterSource,
      app?.onboarded ?? false,
    ] as const,
    queryFn: async () => {
      // Fast path: never-onboarded apps return NotOnboarded for every
      // filterSource. Skip the network round-trip.
      if (!app!.onboarded) {
        return { status: FiltersApiStatus.NotOnboarded, data: null };
      }
      const r = await fetchFiltersFromServer(app!, filterSource);
      if (r.status === FiltersApiStatus.Error) {
        throw new Error("Failed to fetch filters");
      }
      const parsed = r.data ? parseFilterResponse(r.data) : null;
      return { status: r.status, data: parsed };
    },
    enabled: !!app,
  });
}

export type RootSpanNamesQueryResult = {
  status: RootSpanNamesApiStatus;
  data: string[] | null;
};

export function useRootSpanNamesQuery(
  app: App | null | undefined,
  filterSource: FilterSource,
) {
  return useQuery<RootSpanNamesQueryResult>({
    queryKey: ["rootSpanNames", app?.id] as const,
    queryFn: async () => {
      const r = await fetchRootSpanNamesFromServer(app!);
      if (r.status === RootSpanNamesApiStatus.Error) {
        throw new Error("Failed to fetch root span names");
      }
      return {
        status: r.status,
        data: (r.data?.results as string[] | null) ?? null,
      };
    },
    enabled: !!app && filterSource === FilterSource.Spans,
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
function mapPlotData(data: any[]) {
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
    queryFn: async () => {
      const result = await fetchMetricsFromServer(filters);
      if (result.status === MetricsApiStatus.Error) {
        throw new Error("Failed to fetch metrics");
      }
      return result.data;
    },
    enabled: filters.ready,
  });
}

export function useAppThresholdPrefsQuery(appId: string | undefined) {
  return useQuery({
    queryKey: ["appThresholdPrefs", appId] as const,
    queryFn: async () => {
      const result = await fetchAppThresholdPrefsFromServer(appId!);
      if (result.status === FetchAppThresholdPrefsApiStatus.Error) {
        throw new Error("Failed to fetch threshold prefs");
      }
      return result.data;
    },
    enabled: !!appId,
  });
}

// ─── Journey ─────────────────────────────────────────────────────────────

export function useJourneyQuery(
  journeyType: JourneyType,
  exceptionsGroupId: string | null,
  bidirectional: boolean,
) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: [
      "journey",
      journeyType,
      exceptionsGroupId,
      bidirectional,
      filters.serialisedFilters,
    ] as const,
    queryFn: async () => {
      const result = await fetchJourneyFromServer(
        journeyType,
        exceptionsGroupId,
        bidirectional,
        filters,
      );
      if (result.status === JourneyApiStatus.Error) {
        throw new Error("Failed to fetch journey");
      }
      if (result.status === JourneyApiStatus.NoData) {
        return null;
      }
      return result.data;
    },
    enabled: filters.ready,
  });
}

// ─── Network: Overview ───────────────────────────────────────────────────

export function useNetworkDomainsQuery() {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: ["networkDomains", filters.serialisedFilters] as const,
    queryFn: async () => {
      const result = await fetchNetworkDomainsFromServer(filters.app!, filters);
      if (result.status === NetworkDomainsApiStatus.Error) {
        throw new Error("Failed to fetch domains");
      }
      if (result.status === NetworkDomainsApiStatus.NoData) {
        return null;
      }
      return result.data.results as string[];
    },
    enabled: filters.ready && !!filters.app,
  });
}

export function useNetworkPathsQuery(domain: string, searchPattern: string) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: [
      "networkPaths",
      filters.serialisedFilters,
      domain,
      searchPattern,
    ] as const,
    queryFn: async () => {
      const result = await fetchNetworkPathsFromServer(
        filters.app!,
        domain,
        searchPattern,
        filters,
      );
      if (result.status === NetworkPathsApiStatus.Error) {
        throw new Error("Failed to fetch paths");
      }
      if (result.status === NetworkPathsApiStatus.NoData) {
        return null;
      }
      return result.data.results as string[];
    },
    enabled: filters.ready && !!filters.app && domain !== "",
  });
}

export function useNetworkStatusPlotQuery() {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: ["networkStatusPlot", filters.serialisedFilters] as const,
    queryFn: async () => {
      const result =
        await fetchNetworkOverviewStatusCodesPlotFromServer(filters);
      if (result.status === NetworkOverviewStatusCodesPlotApiStatus.Error) {
        throw new Error("Failed to fetch status plot");
      }
      if (result.status === NetworkOverviewStatusCodesPlotApiStatus.NoData) {
        return null;
      }
      return result.data;
    },
    enabled: filters.ready && !!filters.app,
  });
}

export function useNetworkTimelineQuery() {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: ["networkTimeline", filters.serialisedFilters] as const,
    queryFn: async () => {
      const result = await fetchNetworkTimelinePlotFromServer(filters, 10);
      if (result.status === NetworkTimelinePlotApiStatus.Error) {
        throw new Error("Failed to fetch timeline");
      }
      if (result.status === NetworkTimelinePlotApiStatus.NoData) {
        return null;
      }
      return result.data;
    },
    enabled: filters.ready && !!filters.app,
  });
}

// ─── Network: Details ────────────────────────────────────────────────────

export function useNetworkEndpointLatencyQuery(domain: string, path: string) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: [
      "networkEndpointLatency",
      filters.serialisedFilters,
      domain,
      path,
    ] as const,
    queryFn: async () => {
      const result = await fetchNetworkEndpointLatencyPlotFromServer(
        filters,
        domain,
        path,
      );
      if (result.status === NetworkEndpointLatencyPlotApiStatus.Error) {
        throw new Error("Failed to fetch latency");
      }
      if (result.status === NetworkEndpointLatencyPlotApiStatus.NoData) {
        return null;
      }
      return result.data;
    },
    enabled: filters.ready && domain !== "" && path !== "",
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
    queryFn: async () => {
      const result = await fetchNetworkEndpointStatusCodesPlotFromServer(
        filters,
        domain,
        path,
      );
      if (result.status === NetworkEndpointStatusCodesPlotApiStatus.Error) {
        throw new Error("Failed to fetch status codes");
      }
      if (result.status === NetworkEndpointStatusCodesPlotApiStatus.NoData) {
        return null;
      }
      return result.data;
    },
    enabled: filters.ready && domain !== "" && path !== "",
  });
}

export function useNetworkEndpointTimelineQuery(domain: string, path: string) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: [
      "networkEndpointTimeline",
      filters.serialisedFilters,
      domain,
      path,
    ] as const,
    queryFn: async () => {
      const result = await fetchNetworkEndpointTimelinePlotFromServer(
        filters,
        domain,
        path,
      );
      if (result.status === NetworkEndpointTimelinePlotApiStatus.Error) {
        throw new Error("Failed to fetch endpoint timeline");
      }
      if (result.status === NetworkEndpointTimelinePlotApiStatus.NoData) {
        return null;
      }
      return result.data;
    },
    enabled: filters.ready && domain !== "" && path !== "",
  });
}

// ─── Network: Trends ─────────────────────────────────────────────────────

export function useNetworkTrendsQuery(active: boolean) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: ["networkTrends", filters.serialisedFilters] as const,
    queryFn: async () => {
      const result = await fetchNetworkTrendsFromServer(filters, 15);
      if (result.status === NetworkTrendsApiStatus.Error) {
        throw new Error("Failed to fetch trends");
      }
      if (result.status === NetworkTrendsApiStatus.NoData) {
        return null;
      }
      return result.data;
    },
    enabled: filters.ready && active,
  });
}

// ─── Plot: Overview ──────────────────────────────────────────────────────

export function useExceptionsOverviewPlotQuery(exceptionsType: ExceptionsType) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: [
      "exceptionsOverviewPlot",
      exceptionsType,
      filters.serialisedFilters,
    ] as const,
    queryFn: async () => {
      const result = await fetchExceptionsOverviewPlotFromServer(
        exceptionsType,
        filters,
      );
      if (result.status === ExceptionsOverviewPlotApiStatus.Error) {
        throw new Error("Failed to fetch exceptions plot");
      }
      if (result.status === ExceptionsOverviewPlotApiStatus.NoData) {
        return null;
      }
      return mapPlotData(result.data);
    },
    enabled: filters.ready,
  });
}

export function useBugReportsOverviewPlotQuery() {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: ["bugReportsOverviewPlot", filters.serialisedFilters] as const,
    queryFn: async () => {
      const result = await fetchBugReportsOverviewPlotFromServer(filters);
      if (result.status === BugReportsOverviewPlotApiStatus.Error) {
        throw new Error("Failed to fetch bug reports plot");
      }
      if (result.status === BugReportsOverviewPlotApiStatus.NoData) {
        return null;
      }
      return mapPlotData(result.data);
    },
    enabled: filters.ready,
  });
}

export function useSessionTimelinesOverviewPlotQuery() {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: [
      "sessionTimelinesOverviewPlot",
      filters.serialisedFilters,
    ] as const,
    queryFn: async () => {
      const result = await fetchSessionTimelinesOverviewPlotFromServer(filters);
      if (result.status === SessionTimelinesOverviewPlotApiStatus.Error) {
        throw new Error("Failed to fetch session timelines plot");
      }
      if (result.status === SessionTimelinesOverviewPlotApiStatus.NoData) {
        return null;
      }
      return mapPlotData(result.data);
    },
    enabled: filters.ready,
  });
}

export function useSessionsVsExceptionsPlotQuery() {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: ["sessionsVsExceptionsPlot", filters.serialisedFilters] as const,
    queryFn: async () => {
      const result = await fetchSessionsVsExceptionsPlotFromServer(filters);
      if (result.status === SessionsVsExceptionsPlotApiStatus.Error) {
        throw new Error("Failed to fetch sessions vs exceptions plot");
      }
      if (result.status === SessionsVsExceptionsPlotApiStatus.NoData) {
        return null;
      }
      return result.data;
    },
    enabled: filters.ready,
  });
}

// ─── Plot: Exception Details ─────────────────────────────────────────────

export function useExceptionsDetailsPlotQuery(
  exceptionsType: ExceptionsType,
  exceptionsGroupId: string,
) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: [
      "exceptionsDetailsPlot",
      exceptionsType,
      exceptionsGroupId,
      filters.serialisedFilters,
    ] as const,
    queryFn: async () => {
      const result = await fetchExceptionsDetailsPlotFromServer(
        exceptionsType,
        exceptionsGroupId,
        filters,
      );
      if (result.status === ExceptionsDetailsPlotApiStatus.Error) {
        throw new Error("Failed to fetch exceptions details plot");
      }
      if (result.status === ExceptionsDetailsPlotApiStatus.NoData) {
        return null;
      }
      return mapPlotData(result.data);
    },
    enabled: filters.ready && exceptionsGroupId !== "",
  });
}

export function useExceptionsDistributionPlotQuery(
  exceptionsType: ExceptionsType,
  exceptionsGroupId: string,
) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: [
      "exceptionsDistributionPlot",
      exceptionsType,
      exceptionsGroupId,
      filters.serialisedFilters,
    ] as const,
    queryFn: async () => {
      const result = await fetchExceptionsDistributionPlotFromServer(
        exceptionsType,
        exceptionsGroupId,
        filters,
      );
      if (result.status === ExceptionsDistributionPlotApiStatus.Error) {
        throw new Error("Failed to fetch distribution plot");
      }
      if (result.status === ExceptionsDistributionPlotApiStatus.NoData) {
        return null;
      }
      return parseDistributionPlot(result.data);
    },
    enabled: filters.ready && exceptionsGroupId !== "",
  });
}

// ─── Plot: Span Metrics ──────────────────────────────────────────────────

export function useSpanMetricsPlotQuery(quantile: RootSpanMetricsQuantile) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: ["spanMetricsPlot", filters.serialisedFilters] as const,
    queryFn: async () => {
      const result = await fetchSpanMetricsPlotFromServer(filters);
      if (result.status === SpanMetricsPlotApiStatus.Error) {
        throw new Error("Failed to fetch span metrics plot");
      }
      if (result.status === SpanMetricsPlotApiStatus.NoData) {
        return null;
      }
      return result.data;
    },
    select: (rawData) =>
      rawData ? transformSpanMetricsPlotData(rawData, quantile) : null,
    enabled: filters.ready,
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
    queryFn: async () => {
      const result = await fetchAlertsOverviewFromServer(
        filters,
        ALERTS_LIMIT,
        paginationOffset,
      );
      if (result.status === AlertsOverviewApiStatus.Error) {
        throw new Error("Failed to fetch alerts");
      }
      return result.data;
    },
    enabled: filters.ready,
  });
}

// ─── Paginated: Bug Reports ──────────────────────────────────────────────

const BUG_REPORTS_LIMIT = 5;

export function useBugReportsOverviewQuery(paginationOffset: number) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: [
      "bugReportsOverview",
      filters.serialisedFilters,
      paginationOffset,
    ] as const,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await fetchBugReportsOverviewFromServer(
        filters,
        BUG_REPORTS_LIMIT,
        paginationOffset,
      );
      if (result.status === BugReportsOverviewApiStatus.Error) {
        throw new Error("Failed to fetch bug reports");
      }
      return result.data;
    },
    enabled: filters.ready,
  });
}

// ─── Paginated: Exceptions Overview ──────────────────────────────────────

const EXCEPTIONS_OVERVIEW_LIMIT = 5;

export function useExceptionsOverviewQuery(
  exceptionsType: ExceptionsType,
  paginationOffset: number,
) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: [
      "exceptionsOverview",
      exceptionsType,
      filters.serialisedFilters,
      paginationOffset,
    ] as const,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await fetchExceptionsOverviewFromServer(
        exceptionsType,
        filters,
        EXCEPTIONS_OVERVIEW_LIMIT,
        paginationOffset,
      );
      if (result.status === ExceptionsOverviewApiStatus.Error) {
        throw new Error("Failed to fetch exceptions overview");
      }
      return result.data;
    },
    enabled: filters.ready,
  });
}

// ─── Paginated: Traces ───────────────────────────────────────────────────

const TRACES_LIMIT = 5;

export function useSpansQuery(paginationOffset: number) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: ["spans", filters.serialisedFilters, paginationOffset] as const,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await fetchSpansFromServer(
        filters,
        TRACES_LIMIT,
        paginationOffset,
      );
      if (result.status === SpansApiStatus.Error) {
        throw new Error("Failed to fetch spans");
      }
      return result.data;
    },
    enabled: filters.ready,
  });
}

// ─── Paginated: Session Timelines ────────────────────────────────────────

const SESSION_TIMELINES_LIMIT = 5;

export function useSessionTimelinesOverviewQuery(paginationOffset: number) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: [
      "sessionTimelinesOverview",
      filters.serialisedFilters,
      paginationOffset,
    ] as const,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await fetchSessionTimelinesOverviewFromServer(
        filters,
        SESSION_TIMELINES_LIMIT,
        paginationOffset,
      );
      if (result.status === SessionTimelinesOverviewApiStatus.Error) {
        throw new Error("Failed to fetch session timelines");
      }
      return result.data;
    },
    enabled: filters.ready,
  });
}

// ─── Paginated: Crash/ANR Details ────────────────────────────────────────

const EXCEPTIONS_DETAILS_LIMIT = 1;

export function useCrashDetailsQuery(
  exceptionsGroupId: string,
  paginationOffset: number,
) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: [
      "crashDetails",
      exceptionsGroupId,
      filters.serialisedFilters,
      paginationOffset,
    ] as const,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await fetchExceptionsDetailsFromServer(
        ExceptionsType.Crash,
        exceptionsGroupId,
        filters,
        EXCEPTIONS_DETAILS_LIMIT,
        paginationOffset,
      );
      if (result.status === ExceptionsDetailsApiStatus.Error) {
        throw new Error("Failed to fetch crash details");
      }
      return result.data;
    },
    enabled: filters.ready && exceptionsGroupId !== "",
  });
}

export function useAnrDetailsQuery(
  exceptionsGroupId: string,
  paginationOffset: number,
) {
  const filters = useFiltersStore((s) => s.filters);
  return useQuery({
    queryKey: [
      "anrDetails",
      exceptionsGroupId,
      filters.serialisedFilters,
      paginationOffset,
    ] as const,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await fetchExceptionsDetailsFromServer(
        ExceptionsType.Anr,
        exceptionsGroupId,
        filters,
        EXCEPTIONS_DETAILS_LIMIT,
        paginationOffset,
      );
      if (result.status === ExceptionsDetailsApiStatus.Error) {
        throw new Error("Failed to fetch ANR details");
      }
      return result.data;
    },
    enabled: filters.ready && exceptionsGroupId !== "",
  });
}

// ─── Teams ──────────────────────────────────────────────────────────────

export function useTeamsQuery() {
  return useQuery({
    queryKey: ["teams"] as const,
    queryFn: async () => {
      const result = await fetchTeamsFromServer();
      if (result.status === TeamsApiStatus.Error) {
        throw new Error("Failed to fetch teams");
      }
      return result.data;
    },
  });
}

// ─── Trace Details ──────────────────────────────────────────────────────

export function useTraceQuery(appId: string, traceId: string) {
  return useQuery({
    queryKey: ["trace", appId, traceId] as const,
    queryFn: async () => {
      const result = await fetchTraceFromServer(appId, traceId);
      if (result.status === TraceApiStatus.Error) {
        throw new Error("Failed to fetch trace");
      }
      return result.data;
    },
    enabled: !!appId && !!traceId,
  });
}

// ─── Session Timeline ───────────────────────────────────────────────────

export function useSessionTimelineQuery(appId: string, sessionId: string) {
  return useQuery({
    queryKey: ["sessionTimeline", appId, sessionId] as const,
    queryFn: async () => {
      const result = await fetchSessionTimelineFromServer(appId, sessionId);
      if (result.status === SessionTimelineApiStatus.Error) {
        throw new Error("Failed to fetch session timeline");
      }
      return result.data;
    },
    enabled: !!appId && !!sessionId,
  });
}

// ─── Exception Group Common Path ────────────────────────────────────────

export function useExceptionGroupCommonPathQuery(
  type: ExceptionsType,
  appId: string,
  groupId: string,
) {
  return useQuery<ExceptionGroupCommonPath>({
    queryKey: ["exceptionGroupCommonPath", type, appId, groupId] as const,
    queryFn: async () => {
      const result = await fetchExceptionGroupCommonPathFromServer(
        type,
        appId,
        groupId,
      );
      if (result.status === ExceptionGroupCommonPathApiStatus.Error) {
        throw new Error("Failed to fetch common path");
      }
      return result.data as ExceptionGroupCommonPath;
    },
    enabled: !!appId && !!groupId,
  });
}

// ─── Bug Report ─────────────────────────────────────────────────────────

export function useBugReportQuery(appId: string, bugReportId: string) {
  return useQuery({
    queryKey: ["bugReport", appId, bugReportId] as const,
    queryFn: async () => {
      const result = await fetchBugReportFromServer(appId, bugReportId);
      if (result.status === BugReportApiStatus.Error) {
        throw new Error("Failed to fetch bug report");
      }
      return result.data;
    },
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
      const result = await updateBugReportStatusFromServer(
        params.appId,
        params.bugReportId,
        params.newStatus,
      );
      if (result.status === UpdateBugReportStatusApiStatus.Error) {
        throw new Error("Failed to update bug report status");
      }
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
    queryFn: async () => {
      const result = await fetchNotifPrefsFromServer();
      if (result.status === FetchNotifPrefsApiStatus.Error) {
        throw new Error("Failed to fetch notification preferences");
      }
      return result.data;
    },
  });
}

export function useSaveNotifPrefsMutation() {
  return useMutation({
    mutationFn: async (params: { notifPrefs: typeof emptyNotifPrefs }) => {
      const result = await updateNotifPrefsFromServer(params.notifPrefs);
      if (result.status === UpdateNotifPrefsApiStatus.Error) {
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
    mutationFn: async (params: { teamId: string; appName: string }) => {
      const result = await createAppFromServer(params.teamId, params.appName);
      if (result.status === CreateAppApiStatus.Error) {
        throw new Error(result.error ?? "Failed to create app");
      }
      return result.data;
    },
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
      if (result.status === CreateTeamApiStatus.Error) {
        throw new Error(result.error ?? "Failed to create team");
      }
      return result.data as Team;
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
    queryFn: async () => {
      const result = await fetchAuthzAndMembersFromServer(teamId!);
      if (result.status === AuthzAndMembersApiStatus.Error) {
        throw new Error("Failed to fetch authz and members");
      }
      return result.data;
    },
    enabled: !!teamId,
  });
}

export function useAppRetentionQuery(appId: string | undefined) {
  return useQuery({
    queryKey: ["appRetention", appId] as const,
    queryFn: async () => {
      const result = await fetchAppRetentionFromServer(appId!);
      if (result.status === FetchAppRetentionApiStatus.Error) {
        throw new Error("Failed to fetch app retention");
      }
      return result.data;
    },
    enabled: !!appId,
  });
}

export function useSdkConfigQuery(appId: string | undefined) {
  return useQuery({
    queryKey: ["sdkConfig", appId] as const,
    queryFn: async () => {
      const result = await fetchSdkConfigFromServer(appId!);
      if (result.status === SdkConfigApiStatus.Error) {
        throw new Error("Failed to fetch SDK config");
      }
      return result.data;
    },
    enabled: !!appId,
  });
}

type BillingInfoData = Awaited<
  ReturnType<typeof fetchBillingInfoFromServer>
>["data"];

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
    queryFn: async () => {
      const result = await fetchBillingInfoFromServer(teamId!);
      if (result.status === FetchBillingInfoApiStatus.Error) {
        throw new Error("Failed to fetch billing info");
      }
      return result.data;
    },
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
      const result = await updateAppRetentionFromServer(
        params.appId,
        params.retention,
      );
      if (result.status === UpdateAppRetentionApiStatus.Error) {
        throw new Error("Failed to update app retention");
      }
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
      const result = await changeAppNameFromServer(
        params.appId,
        params.appName,
      );
      if (result.status === AppNameChangeApiStatus.Error) {
        throw new Error("Failed to change app name");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useChangeAppApiKeyMutation() {
  return useMutation({
    mutationFn: async (params: { appId: string }) => {
      const result = await changeAppApiKeyFromServer(params.appId);
      if (result.status === AppApiKeyChangeApiStatus.Error) {
        throw new Error("Failed to change app API key");
      }
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
      const result = await updateAppThresholdPrefsFromServer(
        params.appId,
        params.prefs,
      );
      if (result.status === UpdateAppThresholdPrefsApiStatus.Error) {
        throw new Error("Failed to update threshold prefs");
      }
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
    mutationFn: async (params: {
      appId: string;
      config: Partial<SdkConfig>;
    }) => {
      const result = await updateSdkConfigFromServer(
        params.appId,
        params.config,
      );
      if (result.status === UpdateSdkConfigApiStatus.Error) {
        throw new Error("Failed to save SDK config");
      }
      return result.data;
    },
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
    queryFn: async () => {
      const result = await fetchPendingInvitesFromServer(teamId!);
      if (result.status === PendingInvitesApiStatus.Error) {
        throw new Error("Failed to fetch pending invites");
      }
      return result.data;
    },
    enabled: !!teamId,
  });
}

export function useTeamSlackConnectUrlQuery(
  userId: string | undefined,
  teamId: string | undefined,
  redirectUrl: string,
) {
  return useQuery({
    queryKey: ["teamSlackConnectUrl", teamId] as const,
    queryFn: async () => {
      const result = await fetchTeamSlackConnectUrlFromServer(
        userId!,
        teamId!,
        redirectUrl,
      );
      if (result.status === FetchTeamSlackConnectUrlApiStatus.Error) {
        throw new Error("Failed to fetch Slack connect URL");
      }
      return result.data.url as string;
    },
    enabled: !!userId && !!teamId,
  });
}

export function useTeamSlackStatusQuery(teamId: string | undefined) {
  return useQuery({
    queryKey: ["teamSlackStatus", teamId] as const,
    queryFn: async () => {
      const result = await fetchTeamSlackStatusFromServer(teamId!);
      if (result.status === FetchTeamSlackStatusApiStatus.Error) {
        throw new Error("Failed to fetch Slack status");
      }
      return result.data;
    },
    enabled: !!teamId,
  });
}

// ─── Team Page: Mutations ───────────────────────────────────────────────

export function useChangeTeamNameMutation() {
  return useMutation({
    mutationFn: async (params: { teamId: string; newName: string }) => {
      const result = await changeTeamNameFromServer(
        params.teamId,
        params.newName,
      );
      if (result.status === TeamNameChangeApiStatus.Error) {
        throw new Error("Failed to change team name");
      }
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
      const result = await inviteMemberFromServer(
        params.teamId,
        params.email,
        params.role,
      );
      if (result.status === InviteMemberApiStatus.Error) {
        throw new Error("Failed to invite member");
      }
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
      const result = await removeMemberFromServer(
        params.teamId,
        params.memberId,
      );
      if (result.status === RemoveMemberApiStatus.Error) {
        throw new Error("Failed to remove member");
      }
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
      const result = await resendPendingInviteFromServer(
        params.teamId,
        params.inviteId,
      );
      if (result.status === ResendPendingInviteApiStatus.Error) {
        throw new Error("Failed to resend invite");
      }
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
      const result = await removePendingInviteFromServer(
        params.teamId,
        params.inviteId,
      );
      if (result.status === RemovePendingInviteApiStatus.Error) {
        throw new Error("Failed to remove invite");
      }
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
      const result = await changeRoleFromServer(
        params.teamId,
        params.newRole,
        params.memberId,
      );
      if (result.status === RoleChangeApiStatus.Error) {
        throw new Error("Failed to change role");
      }
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
      const result = await updateTeamSlackStatusFromServer(
        params.teamId,
        params.status,
      );
      if (result.status === UpdateTeamSlackStatusApiStatus.Error) {
        throw new Error("Failed to update Slack status");
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["teamSlackStatus", variables.teamId],
      });
    },
  });
}

export function useTestSlackAlertMutation() {
  return useMutation({
    mutationFn: async (params: { teamId: string }) => {
      const result = await sendTestSlackAlertFromServer(params.teamId);
      if (result.status === TestSlackAlertApiStatus.Error) {
        throw new Error("Failed to send test Slack alert");
      }
    },
  });
}

// ─── Usage Store: Reads ─────────────────────────────────────────────────

export function useUsageQuery(teamId: string | undefined) {
  return useQuery({
    queryKey: ["usage", teamId] as const,
    queryFn: async () => {
      const result = await fetchUsageFromServer(teamId!);
      if (result.status === FetchUsageApiStatus.Error) {
        throw new Error("Failed to fetch usage");
      }
      if (result.status === FetchUsageApiStatus.NoApps) {
        return null;
      }
      return result.data;
    },
    enabled: !!teamId,
  });
}

export function useUsagePermissionsQuery(teamId: string | undefined) {
  return useQuery({
    queryKey: ["usagePermissions", teamId] as const,
    queryFn: async () => {
      const result = await fetchAuthzAndMembersFromServer(teamId!);
      if (result.status === AuthzAndMembersApiStatus.Error) {
        throw new Error("Failed to fetch usage permissions");
      }
      return { canChangePlan: result.data.can_change_billing === true };
    },
    enabled: !!teamId,
  });
}

// ─── Usage Store: Mutations ─────────────────────────────────────────────

export function useHandleUpgradeMutation() {
  return useMutation({
    mutationFn: async (params: { teamId: string; successUrl: string }) => {
      const result = await fetchCheckoutSessionFromServer(
        params.teamId,
        params.successUrl,
      );
      if (result.status === FetchCheckoutSessionApiStatus.Error) {
        throw new Error("Failed to create checkout session");
      }
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["billingInfo", variables.teamId],
      });
    },
  });
}

export function useDowngradeToFreeMutation() {
  return useMutation({
    mutationFn: async (params: { teamId: string }) => {
      const result = await downgradeToFreeFromServer(params.teamId);
      if (result.status === DowngradeToFreeApiStatus.Error) {
        throw new Error("Failed to downgrade to free");
      }
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["billingInfo", variables.teamId],
      });
    },
  });
}

export function useUndoDowngradeMutation() {
  return useMutation({
    mutationFn: async (params: { teamId: string }) => {
      const result = await undoDowngradeFromServer(params.teamId);
      if (result.status === UndoDowngradeApiStatus.Error) {
        throw new Error("Failed to undo cancellation");
      }
      return result.data;
    },
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
  const result = await fetchCustomerPortalUrlFromServer(teamId, returnUrl);

  switch (result.status) {
    case FetchCustomerPortalUrlApiStatus.Success:
      if (result.data?.url) {
        return { redirect: result.data.url };
      }
      return { error: "No portal URL returned." };
    case FetchCustomerPortalUrlApiStatus.Error:
      return { error: "Please try again." };
    default:
      return { error: "Request was cancelled." };
  }
}
