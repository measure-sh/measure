"use client";
import { SlidersHorizontal } from "lucide-react";
import { DateTime } from "luxon";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  App,
  AppsApiStatus,
  AppVersion,
  BugReportStatus,
  FiltersApiStatus,
  FilterSource,
  HttpMethod,
  RootSpanNamesApiStatus,
  SessionType,
  SpanStatus,
} from "../api/api_calls";
import {
  type AppsQueryResult,
  useAppsQuery,
  useFilterOptionsQuery,
  useRootSpanNamesQuery,
} from "../query/hooks";
import { useQueryClient } from "@tanstack/react-query";
import {
  applyFilterOptions,
  AppVersionsInitialSelectionType,
  defaultSessionTypes,
  expandRangesToArray,
  type Filters,
  type InitConfig,
  pickApp,
  resolveRootSpanName,
  type URLFilters,
  urlFiltersKeyMap,
} from "../stores/filters_store";
import { useFiltersStore } from "../stores/provider";
import { underlineLinkStyle } from "../utils/shared_styles";
import {
  formatDateToHumanReadableDateTime,
  formatIsoDateForDateTimeInputField,
  isValidTimestamp,
} from "../utils/time_utils";
import { Button } from "./button";
import { CheckChipGroup } from "./check_chip";
import { Checkbox } from "./checkbox";
import DebounceTextInput from "./debounce_text_input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import DropdownSelect, { DropdownSelectType } from "./dropdown_select";
import FilterChip, { type FilterChipAction } from "./filter_chip";
import { Input } from "./input";
import Onboarding from "./onboarding";
import { Skeleton } from "./skeleton";
import UserDefAttrSelector, { UdAttrMatcher } from "./user_def_attr_selector";

export { AppVersionsInitialSelectionType };
export type { Filters };

interface FiltersProps {
  ref?: React.RefObject<HTMLDivElement>;
  teamId: string;
  appId?: string;
  filterSource: FilterSource;
  appVersionsInitialSelectionType: AppVersionsInitialSelectionType;
  showNoData: boolean;
  showNotOnboarded: boolean;
  showAppSelector: boolean;
  showDates: boolean;
  showAppVersions: boolean;
  showOsVersions: boolean;
  showSessionTypes: boolean;
  showCountries: boolean;
  showNetworkProviders: boolean;
  showNetworkTypes: boolean;
  showNetworkGenerations: boolean;
  showLocales: boolean;
  showDeviceManufacturers: boolean;
  showDeviceNames: boolean;
  showBugReportStatus: boolean;
  showHttpMethods: boolean;
  showUdAttrs: boolean;
  showFreeText: boolean;
  showErrorType?: boolean;
  showSeverity?: boolean;
  showCustomErrors?: boolean;
  freeTextPlaceholder?: string;
}

const defaultFreeTextPlaceholder = "Search anything...";

const SEARCH_INPUT_ID = "free-text";

// Errors-only Type filter: store holds lowercase values; the dropdown shows
// capitalized labels.
const ERROR_TYPE_DISPLAY_ITEMS: string[] = ["Error", "ANR"];
const ERROR_TYPE_DISPLAY_TO_STORE: Record<string, string> = {
  Error: "error",
  ANR: "anr",
};
const ERROR_TYPE_STORE_TO_DISPLAY: Record<string, string> = {
  error: "Error",
  anr: "ANR",
};

// Errors-only Severity filter: store holds lowercase values; the dropdown
// shows capitalized labels.
const SEVERITY_DISPLAY_ITEMS: string[] = ["Fatal", "Unhandled", "Handled"];
const SEVERITY_DISPLAY_TO_STORE: Record<string, string> = {
  Fatal: "fatal",
  Unhandled: "unhandled",
  Handled: "handled",
};
const SEVERITY_STORE_TO_DISPLAY: Record<string, string> = {
  fatal: "Fatal",
  unhandled: "Unhandled",
  handled: "Handled",
};

enum DateRange {
  Last15Mins = "Last 15 Minutes",
  Last30Mins = "Last 30 Minutes",
  LastHour = "Last hour",
  Last3Hours = "Last 3 Hours",
  Last6Hours = "Last 6 Hours",
  Last12Hours = "Last 12 Hours",
  Last24Hours = "Last 24 Hours",
  LastWeek = "Last Week",
  Last15Days = "Last 15 Days",
  LastMonth = "Last Month",
  Last3Months = "Last 3 Months",
  Last6Months = "Last 6 Months",
  LastYear = "Last Year",
  Custom = "Custom Range",
}

function isStringKey(
  key: string,
): key is "appId" | "rootSpanName" | "startDate" | "endDate" | "freeText" {
  return ["appId", "rootSpanName", "startDate", "endDate", "freeText"].includes(
    key,
  );
}

// A filter's selection as chip text. `label` is the compact form shown on the
// chip — the criterion name, the first two values, then a "+ N more" count.
// `tooltip` is the full, untruncated list, surfaced on hover.
function chipLabels(
  name: string,
  items: string[],
): { label: string; tooltip: string } {
  const tooltip =
    items.length === 0 ? `${name}: None` : `${name}: ${items.join(", ")}`;
  const label =
    items.length <= 2
      ? tooltip
      : `${name}: ${items.slice(0, 2).join(", ")} + ${items.length - 2} more`;
  return { label, tooltip };
}

// True when two collections hold the same items regardless of order.
function sameItems<T>(a: T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item) => b.includes(item));
}

// A chip's clear button — empties the filter so the chip disappears.
const clearAction = (onClick: () => void): FilterChipAction => ({
  kind: "clear",
  onClick,
});

// A chip's reset button — restores the filter's non-empty default.
const resetAction = (onClick: () => void): FilterChipAction => ({
  kind: "reset",
  onClick,
});

export function deserializeUrlFilters(queryString: string): URLFilters {
  const params = new URLSearchParams(queryString);
  const result: URLFilters = {};

  for (const [minifiedKey, value] of params.entries()) {
    const originalKey = Object.entries(urlFiltersKeyMap).find(
      ([_, v]) => v === minifiedKey,
    )?.[0] as keyof URLFilters;
    if (!originalKey) continue;

    try {
      switch (originalKey) {
        case "versions":
        case "osVersions":
        case "countries":
        case "networkProviders":
        case "networkTypes":
        case "networkGenerations":
        case "locales":
        case "deviceManufacturers":
        case "deviceNames":
          result[originalKey] = expandRangesToArray(value);
          break;

        case "udAttrMatchers":
          result[originalKey] = value
            .split("|")
            .filter((part) => part)
            .map((part) => {
              const [key, type, op, val] = part
                .split("~")
                .map(decodeURIComponent);
              return { key, type, op, value: val } as UdAttrMatcher;
            })
            .filter((m) => m.key && m.type && m.op && m.value);
          break;

        case "spanStatuses":
          result[originalKey] = value
            .split(",")
            .filter((s): s is SpanStatus =>
              Object.values(SpanStatus).includes(s as SpanStatus),
            );
          break;

        case "bugReportStatuses":
          result[originalKey] = value
            .split(",")
            .filter((s): s is BugReportStatus =>
              Object.values(BugReportStatus).includes(s as BugReportStatus),
            );
          break;

        case "httpMethods":
          result[originalKey] = value
            .split(",")
            .filter((s): s is HttpMethod =>
              Object.values(HttpMethod).includes(s as HttpMethod),
            );
          break;

        case "sessionTypes":
          result[originalKey] = value
            .split(",")
            .filter((s): s is SessionType =>
              Object.values(SessionType).includes(s as SessionType),
            );
          break;

        case "errorTypes":
        case "severities":
          result[originalKey] = value.split(",").filter((s) => s);
          break;

        case "customErrorsOnly":
          result[originalKey] = value === "1";
          break;

        case "dateRange":
          result[originalKey] = Object.values(DateRange).includes(
            value as DateRange,
          )
            ? (value as DateRange)
            : undefined;
          break;

        default:
          if (isStringKey(originalKey)) {
            result[originalKey] = value;
          }
          break;
      }
    } catch (error) {
      console.warn(`Failed to parse ${originalKey}`, error);
    }
  }

  return result;
}

function mapDateRangeToDate(dateRange: string) {
  let today = DateTime.now();

  switch (dateRange) {
    case DateRange.Last15Mins:
      return today.minus({ minutes: 15 });
    case DateRange.Last30Mins:
      return today.minus({ minutes: 30 });
    case DateRange.LastHour:
      return today.minus({ hours: 1 });
    case DateRange.Last3Hours:
      return today.minus({ hours: 3 });
    case DateRange.Last6Hours:
      return today.minus({ hours: 6 });
    case DateRange.Last12Hours:
      return today.minus({ hours: 12 });
    case DateRange.Last24Hours:
      return today.minus({ hours: 24 });
    case DateRange.LastWeek:
      return today.minus({ days: 7 });
    case DateRange.Last15Days:
      return today.minus({ days: 15 });
    case DateRange.LastMonth:
      return today.minus({ months: 1 });
    case DateRange.Last3Months:
      return today.minus({ months: 3 });
    case DateRange.Last6Months:
      return today.minus({ months: 6 });
    case DateRange.LastYear:
      return today.minus({ years: 1 });
    case DateRange.Custom:
      throw Error("Custom date range cannot be mapped to date");
  }
}

// One labelled section inside the More filters modal. `rowKey` ids the section
// so a filter chip can scroll it into view when the modal opens.
function FilterRow({
  rowKey,
  title,
  children,
}: {
  rowKey?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={rowKey ? `filter-row-${rowKey}` : undefined}
      className="border-b py-4 first:pt-1 last:border-b-0 last:pb-1 scroll-mt-1"
    >
      <p className="font-display text-sm font-medium mb-2">{title}</p>
      {children}
    </div>
  );
}

// A multi-select string filter rendered as a row of check chips.
function StringMultiRow({
  rowKey,
  title,
  items,
  selected,
  onChange,
  getLabel = (item) => item,
}: {
  rowKey?: string;
  title: string;
  items: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  getLabel?: (item: string) => string;
}) {
  return (
    <FilterRow rowKey={rowKey} title={title}>
      <CheckChipGroup
        items={items}
        selected={selected}
        getLabel={getLabel}
        isEqual={(a, b) => a === b}
        onChange={onChange}
      />
    </FilterRow>
  );
}

const FiltersComponent = forwardRef<
  { refresh: (appIdToSelect?: string) => Promise<void> },
  FiltersProps
>(
  (
    {
      teamId,
      appId,
      filterSource,
      appVersionsInitialSelectionType,
      showNoData,
      showNotOnboarded,
      showAppSelector,
      showDates,
      showAppVersions,
      showOsVersions,
      showSessionTypes,
      showCountries,
      showNetworkTypes,
      showNetworkProviders,
      showNetworkGenerations,
      showLocales,
      showDeviceManufacturers,
      showDeviceNames,
      showBugReportStatus,
      showHttpMethods,
      showUdAttrs,
      showFreeText,
      showErrorType = false,
      showSeverity = false,
      showCustomErrors = false,
      freeTextPlaceholder,
    },
    ref,
  ) => {
    const searchParams = useSearchParams();
    const pathName = usePathname();

    const urlFilters = useMemo(
      () => deserializeUrlFilters(searchParams.toString()),
      [searchParams],
    );

    const initConfig: InitConfig = useMemo(
      () => ({
        urlFilters,
        appId,
        appVersionsInitialSelectionType,
        filterSource,
      }),
      [urlFilters, appId, appVersionsInitialSelectionType, filterSource],
    );

    const queryClient = useQueryClient();
    const store = useFiltersStore();
    const selectedApp = useFiltersStore((s) => s.selectedApp);
    const currentTeamId = useFiltersStore((s) => s.currentTeamId);

    // computeFilters reads every show* flag plus filterSource, so the store
    // has to see flips the moment the parent makes them (e.g. apps page
    // toggling showNotOnboarded once apps load).
    useEffect(() => {
      store.setConfig({
        filterSource,
        showNoData,
        showNotOnboarded,
        showAppSelector,
        showDates,
        showAppVersions,
        showOsVersions,
        showSessionTypes,
        showCountries,
        showNetworkProviders,
        showNetworkTypes,
        showNetworkGenerations,
        showLocales,
        showDeviceManufacturers,
        showDeviceNames,
        showBugReportStatus,
        showHttpMethods,
        showUdAttrs,
        showFreeText,
      });
    }, [
      filterSource,
      showNoData,
      showNotOnboarded,
      showAppSelector,
      showDates,
      showAppVersions,
      showOsVersions,
      showSessionTypes,
      showCountries,
      showNetworkProviders,
      showNetworkTypes,
      showNetworkGenerations,
      showLocales,
      showDeviceManufacturers,
      showDeviceNames,
      showBugReportStatus,
      showHttpMethods,
      showUdAttrs,
      showFreeText,
    ]);

    useEffect(() => {
      // Date init priority: URL > preserved store (re-anchored to now()) >
      // first-ever default. Non-custom ranges always recompute start/end
      // from now() on mount so "Last Year" doesn't render stale data
      // after navigation.
      if (urlFilters.dateRange) {
        const range = urlFilters.dateRange;
        const isCustom = range === DateRange.Custom;
        store.setSelectedDateRange(range);
        store.setSelectedStartDate(
          isCustom
            ? (urlFilters.startDate ??
                DateTime.now().minus({ hours: 6 }).toISO()!)
            : mapDateRangeToDate(range)!.toISO()!,
        );
        store.setSelectedEndDate(
          isCustom
            ? (urlFilters.endDate ?? DateTime.now().toISO()!)
            : DateTime.now().toISO()!,
        );
      } else if (store.selectedDateRange) {
        // Custom ranges keep the user's explicit start/end; everything
        // else re-anchors to now().
        if (store.selectedDateRange !== DateRange.Custom) {
          store.setSelectedStartDate(
            mapDateRangeToDate(store.selectedDateRange)!.toISO()!,
          );
          store.setSelectedEndDate(DateTime.now().toISO()!);
        }
      } else {
        const range = DateRange.Last6Hours;
        store.setSelectedDateRange(range);
        store.setSelectedStartDate(mapDateRangeToDate(range)!.toISO()!);
        store.setSelectedEndDate(DateTime.now().toISO()!);
      }

      // Wipe team-scoped state before the new team's apps query lands so
      // pages don't briefly render data for the previous team.
      if (currentTeamId !== "" && currentTeamId !== teamId) {
        store.resetForTeamChange(teamId);
      } else if (currentTeamId === "") {
        store.setCurrentTeamId(teamId);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [teamId]);

    const appsQuery = useAppsQuery(teamId);

    useEffect(() => {
      if (appsQuery.status === "pending") {
        store.setApps([], AppsApiStatus.Loading);
        return;
      }
      if (appsQuery.status === "error") {
        store.setApps([], AppsApiStatus.Error);
        return;
      }
      store.setApps(appsQuery.data.data, appsQuery.data.status);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appsQuery.status, appsQuery.data]);

    useEffect(() => {
      if (appsQuery.status !== "success") {
        return;
      }
      if (appsQuery.data.status !== AppsApiStatus.Success) {
        return;
      }
      const apps = appsQuery.data.data;
      if (apps.length === 0) {
        return;
      }
      const picked = pickApp(apps, initConfig, selectedApp);
      if (!picked) {
        return;
      }
      // Skip the setter when nothing changed — apps reference churns on
      // every refetch even when the picked app is the same.
      if (!selectedApp || selectedApp.id !== picked.id) {
        store.setSelectedApp(picked);
      } else if (selectedApp.onboarded !== picked.onboarded) {
        // Same id, new onboarded flag (poller saw verification). Update
        // in place without wiping selections.
        store.setSelectedApp(picked);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appsQuery.status, appsQuery.data, teamId]);

    const filterOptionsQuery = useFilterOptionsQuery(selectedApp, filterSource);

    useEffect(() => {
      if (!selectedApp) {
        return;
      }
      if (filterOptionsQuery.status === "pending") {
        store.setFilterOptions(null, FiltersApiStatus.Loading);
        return;
      }
      if (filterOptionsQuery.status === "error") {
        store.setFilterOptions(null, FiltersApiStatus.Error);
        return;
      }
      // Query resolved — inner status is Success, NoData, or NotOnboarded.
      const { status, data } = filterOptionsQuery.data;
      if (status === FiltersApiStatus.Success && data) {
        const selections = applyFilterOptions(
          data,
          selectedApp,
          initConfig,
          store,
        );
        store.setFilterOptions(data, FiltersApiStatus.Success);
        store.applySelections(selections);
      } else {
        store.setFilterOptions(null, status);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      filterOptionsQuery.status,
      filterOptionsQuery.data,
      selectedApp?.id,
      selectedApp?.onboarded,
    ]);

    const rootSpanNamesQuery = useRootSpanNamesQuery(selectedApp, filterSource);

    useEffect(() => {
      if (filterSource !== FilterSource.Spans) {
        return;
      }
      if (!selectedApp) {
        return;
      }
      if (rootSpanNamesQuery.status === "pending") {
        store.setRootSpanNames(null, RootSpanNamesApiStatus.Loading);
        return;
      }
      if (rootSpanNamesQuery.status === "error") {
        store.setRootSpanNames(null, RootSpanNamesApiStatus.Error);
        return;
      }
      const { status, data } = rootSpanNamesQuery.data;
      if (status === RootSpanNamesApiStatus.Success && data) {
        store.setRootSpanNames(data, RootSpanNamesApiStatus.Success);
        store.setSelectedRootSpanName(
          resolveRootSpanName(data, initConfig, selectedApp),
        );
      } else {
        store.setRootSpanNames(null, status);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      rootSpanNamesQuery.status,
      rootSpanNamesQuery.data,
      selectedApp?.id,
      filterSource,
    ]);

    // Refetch apps + filter-option queries, then optionally focus a
    // specific app once the fresh apps list lands.
    const refresh = useCallback(
      async (appIdToSelect?: string) => {
        await queryClient.refetchQueries({
          queryKey: ["filterApps", teamId],
        });
        if (appIdToSelect) {
          const apps =
            queryClient.getQueryData<AppsQueryResult>(["filterApps", teamId])
              ?.data ?? [];
          const app = apps.find((a) => a.id === appIdToSelect);
          if (app) {
            store.setSelectedApp(app);
          }
        }
        await queryClient.refetchQueries({
          queryKey: ["filterOptions", selectedApp?.id],
        });
        if (filterSource === FilterSource.Spans) {
          await queryClient.refetchQueries({
            queryKey: ["rootSpanNames", selectedApp?.id],
          });
        }
      },
      [teamId, selectedApp?.id, filterSource, store],
    );

    useImperativeHandle(ref, () => ({ refresh }), [refresh]);

    const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
    // Filter chip whose modal section should scroll into view once open.
    const [scrollTarget, setScrollTarget] = useState<string | null>(null);
    // Drives the inline app versions dropdown so its chip can open it too.
    const [appVersionsOpen, setAppVersionsOpen] = useState(false);

    // Open the More filters modal with one filter's section scrolled into view.
    const openFilterModal = (rowKey: string) => {
      setScrollTarget(rowKey);
      setMoreFiltersOpen(true);
    };

    useEffect(() => {
      if (!moreFiltersOpen || !scrollTarget) {
        return;
      }
      const raf = requestAnimationFrame(() => {
        document
          .getElementById(`filter-row-${scrollTarget}`)
          ?.scrollIntoView({ block: "start" });
      });
      return () => cancelAnimationFrame(raf);
    }, [moreFiltersOpen, scrollTarget]);

    // Filters that live behind the "More filters" modal. Config-only check
    // (no loaded data) so the skeleton can reserve the trigger's slot.
    const hasMoreFiltersConfig =
      showSessionTypes ||
      filterSource === FilterSource.Spans ||
      showBugReportStatus ||
      showHttpMethods ||
      showOsVersions ||
      showCountries ||
      showNetworkProviders ||
      showNetworkTypes ||
      showNetworkGenerations ||
      showLocales ||
      showDeviceManufacturers ||
      showDeviceNames ||
      showUdAttrs;

    // Errors-only controls live on the main row alongside the standard
    // inline dropdowns. Severity and Custom errors only render when the
    // user hasn't unchecked Error in the Type multi-select.
    const isErrorsSource = filterSource === FilterSource.Errors;
    const onlyAnrSelected =
      store.selectedErrorTypes.length === 1 &&
      store.selectedErrorTypes[0] === "anr";
    const showErrorTypeControl = isErrorsSource && showErrorType;
    const showSeverityControl =
      isErrorsSource && showSeverity && !onlyAnrSelected;
    const showCustomErrorsControl =
      isErrorsSource && showCustomErrors && !onlyAnrSelected;

    // Dropdowns that stay inline: app, trace name, date range, app versions,
    // the Errors-only controls, plus the "More filters" trigger.
    const skeletonMainRowCount =
      [
        showAppSelector,
        filterSource === FilterSource.Spans,
        showDates,
        showAppVersions,
        showErrorTypeControl,
        showSeverityControl,
        showCustomErrorsControl,
      ].filter(Boolean).length + (hasMoreFiltersConfig ? 1 : 0);

    // Same as hasMoreFiltersConfig but gated on loaded data — drives the real
    // trigger so it never opens an empty modal.
    const hasMoreFilters =
      showSessionTypes ||
      filterSource === FilterSource.Spans ||
      showBugReportStatus ||
      showHttpMethods ||
      (showOsVersions && store.osVersions.length > 0) ||
      (showCountries && store.countries.length > 0) ||
      (showNetworkProviders && store.networkProviders.length > 0) ||
      (showNetworkTypes && store.networkTypes.length > 0) ||
      (showNetworkGenerations && store.networkGenerations.length > 0) ||
      (showLocales && store.locales.length > 0) ||
      (showDeviceManufacturers && store.deviceManufacturers.length > 0) ||
      (showDeviceNames && store.deviceNames.length > 0) ||
      (showUdAttrs && store.userDefAttrs.length > 0);

    // Active filter chips: one per "More filters" criterion with a selection.
    // Index-list filters default to none, so their chip clears (and vanishes);
    // the rest reset to a default, and carry no action while already at it.
    const filterChips: {
      key: string;
      label: string;
      tooltip: string;
      action?: FilterChipAction;
    }[] = [];

    if (showSessionTypes && store.selectedSessionTypes.length > 0) {
      filterChips.push({
        key: "sessionTypes",
        ...chipLabels("Session Types", store.selectedSessionTypes),
        action: sameItems(store.selectedSessionTypes, defaultSessionTypes)
          ? undefined
          : resetAction(() =>
              store.setSelectedSessionTypes(defaultSessionTypes),
            ),
      });
    }
    if (
      filterSource === FilterSource.Spans &&
      store.selectedSpanStatuses.length > 0
    ) {
      filterChips.push({
        key: "spanStatuses",
        ...chipLabels("Span Status", store.selectedSpanStatuses),
        action:
          store.selectedSpanStatuses.length === Object.values(SpanStatus).length
            ? undefined
            : resetAction(() =>
                store.setSelectedSpanStatuses(
                  Object.values(SpanStatus) as SpanStatus[],
                ),
              ),
      });
    }
    if (showBugReportStatus && store.selectedBugReportStatuses.length > 0) {
      filterChips.push({
        key: "bugReportStatuses",
        ...chipLabels("Bug Report Status", store.selectedBugReportStatuses),
        action:
          store.selectedBugReportStatuses.length === 1 &&
          store.selectedBugReportStatuses[0] === BugReportStatus.Open
            ? undefined
            : resetAction(() =>
                store.setSelectedBugReportStatuses([BugReportStatus.Open]),
              ),
      });
    }
    if (showHttpMethods && store.selectedHttpMethods.length > 0) {
      filterChips.push({
        key: "httpMethods",
        ...chipLabels(
          "HTTP Method",
          store.selectedHttpMethods.map((m) => m.toUpperCase()),
        ),
        action:
          store.selectedHttpMethods.length === Object.values(HttpMethod).length
            ? undefined
            : resetAction(() =>
                store.setSelectedHttpMethods(
                  Object.values(HttpMethod) as HttpMethod[],
                ),
              ),
      });
    }
    if (showOsVersions && store.selectedOsVersions.length > 0) {
      filterChips.push({
        key: "osVersions",
        ...chipLabels(
          "OS Versions",
          store.selectedOsVersions.map((v) => v.displayName),
        ),
        action: clearAction(() => store.setSelectedOsVersions([])),
      });
    }
    if (showCountries && store.selectedCountries.length > 0) {
      filterChips.push({
        key: "countries",
        ...chipLabels("Country", store.selectedCountries),
        action: clearAction(() => store.setSelectedCountries([])),
      });
    }
    if (showNetworkProviders && store.selectedNetworkProviders.length > 0) {
      filterChips.push({
        key: "networkProviders",
        ...chipLabels("Network Provider", store.selectedNetworkProviders),
        action: clearAction(() => store.setSelectedNetworkProviders([])),
      });
    }
    if (showNetworkTypes && store.selectedNetworkTypes.length > 0) {
      filterChips.push({
        key: "networkTypes",
        ...chipLabels("Network type", store.selectedNetworkTypes),
        action: clearAction(() => store.setSelectedNetworkTypes([])),
      });
    }
    if (showNetworkGenerations && store.selectedNetworkGenerations.length > 0) {
      filterChips.push({
        key: "networkGenerations",
        ...chipLabels("Network generation", store.selectedNetworkGenerations),
        action: clearAction(() => store.setSelectedNetworkGenerations([])),
      });
    }
    if (showLocales && store.selectedLocales.length > 0) {
      filterChips.push({
        key: "locales",
        ...chipLabels("Locale", store.selectedLocales),
        action: clearAction(() => store.setSelectedLocales([])),
      });
    }
    if (
      showDeviceManufacturers &&
      store.selectedDeviceManufacturers.length > 0
    ) {
      filterChips.push({
        key: "deviceManufacturers",
        ...chipLabels("Device Manufacturer", store.selectedDeviceManufacturers),
        action: clearAction(() => store.setSelectedDeviceManufacturers([])),
      });
    }
    if (showDeviceNames && store.selectedDeviceNames.length > 0) {
      filterChips.push({
        key: "deviceNames",
        ...chipLabels("Device Name", store.selectedDeviceNames),
        action: clearAction(() => store.setSelectedDeviceNames([])),
      });
    }
    if (showUdAttrs && store.selectedUdAttrMatchers.length > 0) {
      filterChips.push({
        key: "udAttrs",
        ...chipLabels(
          "User Defined Attributes",
          store.selectedUdAttrMatchers.map(
            (m) => `${m.key} ${m.op} ${m.value}`,
          ),
        ),
        action: clearAction(() => store.setSelectedUdAttrMatchers([])),
      });
    }

    // Search lives inline, not in the modal — its chip points back to that
    // input instead of opening the modal.
    const searchActive = showFreeText && store.selectedFreeText !== "";

    // Errors-only active filter pills mirror the multi-select state. The
    // Errors pill folds Custom + severity subfilters into a single label.
    const showAnrsPill =
      isErrorsSource && store.selectedErrorTypes.includes("anr");
    const showErrorsPill =
      isErrorsSource && store.selectedErrorTypes.includes("error");
    const errorsPillSubfilters: string[] = [];
    if (store.customErrorsOnly) {
      errorsPillSubfilters.push("Custom");
    }
    for (const severity of store.selectedSeverities) {
      const display = SEVERITY_STORE_TO_DISPLAY[severity];
      if (display) {
        errorsPillSubfilters.push(display);
      }
    }
    const errorsPillLabel =
      errorsPillSubfilters.length > 0
        ? `Errors - ${errorsPillSubfilters.join(", ")}`
        : "Errors";

    // App versions: page default is the latest build, or every build.
    const defaultAppVersions =
      appVersionsInitialSelectionType === AppVersionsInitialSelectionType.All
        ? store.versions
        : store.versions.slice(0, 1);
    const appVersionsChanged = !sameItems(
      store.selectedVersions.map((v) => v.displayName),
      defaultAppVersions.map((v) => v.displayName),
    );

    const filtersSkeleton = (
      skeletonCount: number,
      leadingContent?: React.ReactNode,
    ) => (
      <div className="flex flex-wrap gap-8 items-center">
        {leadingContent}
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-[150px]" />
        ))}
      </div>
    );

    const appSelectorDropdown = (
      <DropdownSelect
        title="App Name"
        type={DropdownSelectType.SingleString}
        items={store.apps.map((e) => e.name)}
        initialSelected={store.selectedApp?.name ?? ""}
        onChangeSelected={(item) => {
          const app = store.apps.find((e) => e.name === item);
          if (app) store.setSelectedApp(app);
        }}
      />
    );

    const moreFiltersContent = (
      <div className="max-h-[60vh] overflow-y-auto px-1">
        {showSessionTypes && (
          <StringMultiRow
            rowKey="sessionTypes"
            title="Session Types"
            items={Object.values(SessionType)}
            selected={store.selectedSessionTypes}
            onChange={(items) =>
              store.setSelectedSessionTypes(items as SessionType[])
            }
          />
        )}
        {filterSource === FilterSource.Spans && (
          <StringMultiRow
            rowKey="spanStatuses"
            title="Span Status"
            items={Object.values(SpanStatus)}
            selected={store.selectedSpanStatuses}
            onChange={(items) =>
              store.setSelectedSpanStatuses(items as SpanStatus[])
            }
          />
        )}
        {showBugReportStatus && (
          <StringMultiRow
            rowKey="bugReportStatuses"
            title="Bug Report Status"
            items={Object.values(BugReportStatus)}
            selected={store.selectedBugReportStatuses}
            onChange={(items) =>
              store.setSelectedBugReportStatuses(items as BugReportStatus[])
            }
          />
        )}
        {showHttpMethods && (
          <StringMultiRow
            rowKey="httpMethods"
            title="HTTP Method"
            items={Object.values(HttpMethod)}
            selected={store.selectedHttpMethods}
            getLabel={(item) => item.toUpperCase()}
            onChange={(items) =>
              store.setSelectedHttpMethods(items as HttpMethod[])
            }
          />
        )}
        {showOsVersions && store.osVersions.length > 0 && (
          <FilterRow rowKey="osVersions" title="OS Versions">
            <CheckChipGroup
              items={store.osVersions}
              selected={store.selectedOsVersions}
              getLabel={(item) => item.displayName}
              isEqual={(a, b) => a.displayName === b.displayName}
              onChange={(items) => store.setSelectedOsVersions(items)}
            />
          </FilterRow>
        )}
        {showCountries && store.countries.length > 0 && (
          <StringMultiRow
            rowKey="countries"
            title="Country"
            items={store.countries}
            selected={store.selectedCountries}
            onChange={(items) => store.setSelectedCountries(items)}
          />
        )}
        {showNetworkProviders && store.networkProviders.length > 0 && (
          <StringMultiRow
            rowKey="networkProviders"
            title="Network Provider"
            items={store.networkProviders}
            selected={store.selectedNetworkProviders}
            onChange={(items) => store.setSelectedNetworkProviders(items)}
          />
        )}
        {showNetworkTypes && store.networkTypes.length > 0 && (
          <StringMultiRow
            rowKey="networkTypes"
            title="Network type"
            items={store.networkTypes}
            selected={store.selectedNetworkTypes}
            onChange={(items) => store.setSelectedNetworkTypes(items)}
          />
        )}
        {showNetworkGenerations && store.networkGenerations.length > 0 && (
          <StringMultiRow
            rowKey="networkGenerations"
            title="Network generation"
            items={store.networkGenerations}
            selected={store.selectedNetworkGenerations}
            onChange={(items) => store.setSelectedNetworkGenerations(items)}
          />
        )}
        {showLocales && store.locales.length > 0 && (
          <StringMultiRow
            rowKey="locales"
            title="Locale"
            items={store.locales}
            selected={store.selectedLocales}
            onChange={(items) => store.setSelectedLocales(items)}
          />
        )}
        {showDeviceManufacturers && store.deviceManufacturers.length > 0 && (
          <StringMultiRow
            rowKey="deviceManufacturers"
            title="Device Manufacturer"
            items={store.deviceManufacturers}
            selected={store.selectedDeviceManufacturers}
            onChange={(items) => store.setSelectedDeviceManufacturers(items)}
          />
        )}
        {showDeviceNames && store.deviceNames.length > 0 && (
          <StringMultiRow
            rowKey="deviceNames"
            title="Device Name"
            items={store.deviceNames}
            selected={store.selectedDeviceNames}
            onChange={(items) => store.setSelectedDeviceNames(items)}
          />
        )}
        {showUdAttrs && store.userDefAttrs.length > 0 && (
          <FilterRow rowKey="udAttrs" title="User Defined Attributes">
            <UserDefAttrSelector
              attrs={store.userDefAttrs}
              ops={store.userDefAttrOps}
              initialSelected={store.selectedUdAttrMatchers}
              onChangeSelected={(udAttrMatchers) =>
                store.setSelectedUdAttrMatchers(udAttrMatchers)
              }
            />
          </FilterRow>
        )}
      </div>
    );

    return (
      <div>
        {store.appsApiStatus === AppsApiStatus.Loading &&
          filtersSkeleton(skeletonMainRowCount)}

        {store.appsApiStatus === AppsApiStatus.Error && (
          <p className="font-body text-sm">
            Error fetching apps, please check if Team ID is valid or refresh
            page to try again
          </p>
        )}
        {store.appsApiStatus === AppsApiStatus.NoApps &&
          (showNotOnboarded ? (
            <Onboarding teamId={teamId} initConfig={initConfig} />
          ) : (
            <p className="font-body">
              Looks like you don&apos;t have any apps yet. Get started by{" "}
              {pathName.includes("apps") ? (
                "creating your first app!"
              ) : (
                <Link className={underlineLinkStyle} href={`apps`}>
                  creating your first app!
                </Link>
              )}
            </p>
          ))}

        {store.appsApiStatus === AppsApiStatus.Success &&
          store.filtersApiStatus !== FiltersApiStatus.Success && (
            <div className="flex flex-col">
              {showAppSelector &&
                store.filtersApiStatus === FiltersApiStatus.Loading &&
                filtersSkeleton(skeletonMainRowCount - 1, appSelectorDropdown)}
              {showAppSelector &&
                store.filtersApiStatus !== FiltersApiStatus.Loading && (
                  <div className="flex flex-wrap gap-8 items-center">
                    {appSelectorDropdown}
                  </div>
                )}
              <div className="py-4" />
              {store.filtersApiStatus === FiltersApiStatus.Error && (
                <p className="font-body text-sm">
                  Error fetching filters, please refresh page or select a
                  different app to try again
                </p>
              )}
              {showNoData &&
                store.filtersApiStatus === FiltersApiStatus.NoData && (
                  <p className="font-body text-sm">
                    No{" "}
                    {filterSource === FilterSource.Errors ? "errors" : "data"}{" "}
                    received for this app yet
                  </p>
                )}
              {showNotOnboarded &&
                store.filtersApiStatus === FiltersApiStatus.NotOnboarded && (
                  <Onboarding teamId={teamId} initConfig={initConfig} />
                )}
            </div>
          )}

        {store.appsApiStatus === AppsApiStatus.Success &&
          store.filtersApiStatus === FiltersApiStatus.Success &&
          filterSource === FilterSource.Spans &&
          store.rootSpanNamesApiStatus !== RootSpanNamesApiStatus.Success && (
            <div className="flex flex-col">
              {showAppSelector &&
                store.rootSpanNamesApiStatus ===
                  RootSpanNamesApiStatus.Loading &&
                filtersSkeleton(skeletonMainRowCount - 1, appSelectorDropdown)}
              {showAppSelector &&
                store.rootSpanNamesApiStatus !==
                  RootSpanNamesApiStatus.Loading && (
                  <div className="flex flex-wrap gap-8 items-center">
                    {appSelectorDropdown}
                  </div>
                )}
              <div className="py-4" />
              {store.rootSpanNamesApiStatus ===
                RootSpanNamesApiStatus.Error && (
                <p className="font-body text-sm">
                  Error fetching traces list, please refresh page or select a
                  different app to try again
                </p>
              )}
              {store.rootSpanNamesApiStatus ===
                RootSpanNamesApiStatus.NoData && (
                <p className="font-body text-sm">
                  No traces received for this app yet
                </p>
              )}
            </div>
          )}

        {store.appsApiStatus === AppsApiStatus.Success &&
          ((filterSource === FilterSource.Spans &&
            store.rootSpanNamesApiStatus === RootSpanNamesApiStatus.Success) ||
            filterSource !== FilterSource.Spans) &&
          store.filtersApiStatus === FiltersApiStatus.Success && (
            <div>
              <div className="flex flex-wrap gap-8 items-center">
                {showAppSelector && (
                  <DropdownSelect
                    title="App Name"
                    type={DropdownSelectType.SingleString}
                    items={store.apps.map((e) => e.name)}
                    initialSelected={store.selectedApp!.name}
                    onChangeSelected={(item) => {
                      const app = store.apps.find((e) => e.name === item);
                      if (app) store.setSelectedApp(app);
                    }}
                  />
                )}

                {filterSource === FilterSource.Spans && (
                  <DropdownSelect
                    title="Trace Name"
                    type={DropdownSelectType.SingleString}
                    items={store.rootSpanNames}
                    initialSelected={store.selectedRootSpanName}
                    onChangeSelected={(item) =>
                      store.setSelectedRootSpanName(item as string)
                    }
                  />
                )}

                <div className="flex flex-row items-center">
                  {showDates && (
                    <DropdownSelect
                      title="Date Range"
                      type={DropdownSelectType.SingleString}
                      items={Object.values(DateRange)}
                      initialSelected={store.selectedDateRange}
                      onChangeSelected={(item) => {
                        const range = item as string;

                        if (range === store.selectedDateRange) {
                          return;
                        }

                        if (range === DateRange.Custom) {
                          store.setSelectedDateRange(range);
                          return;
                        }

                        let today = DateTime.now();
                        let newDate = mapDateRangeToDate(range);

                        store.setSelectedStartDate(newDate!.toISO());
                        store.setSelectedEndDate(today.toISO());
                        store.setSelectedDateRange(range);
                      }}
                    />
                  )}
                  {showDates &&
                    store.selectedDateRange === DateRange.Custom && (
                      <p className="font-display px-2">:</p>
                    )}
                  {showDates &&
                    store.selectedDateRange === DateRange.Custom && (
                      <Input
                        type="datetime-local"
                        defaultValue={formatIsoDateForDateTimeInputField(
                          store.selectedStartDate,
                        )}
                        max={formatIsoDateForDateTimeInputField(
                          store.selectedEndDate,
                        )}
                        onChange={(e) => {
                          if (isValidTimestamp(e.target.value)) {
                            store.setSelectedStartDate(
                              DateTime.fromISO(e.target.value).toISO()!,
                            );
                          }
                        }}
                      />
                    )}
                  {showDates &&
                    store.selectedDateRange === DateRange.Custom && (
                      <p className="font-display px-2">to</p>
                    )}
                  {showDates &&
                    store.selectedDateRange === DateRange.Custom && (
                      <Input
                        type="datetime-local"
                        defaultValue={formatIsoDateForDateTimeInputField(
                          store.selectedEndDate,
                        )}
                        min={formatIsoDateForDateTimeInputField(
                          store.selectedStartDate,
                        )}
                        max={formatIsoDateForDateTimeInputField(
                          DateTime.now().toISO(),
                        )}
                        onChange={(e) => {
                          if (isValidTimestamp(e.target.value)) {
                            if (
                              DateTime.fromISO(e.target.value) <= DateTime.now()
                            ) {
                              store.setSelectedEndDate(
                                DateTime.fromISO(e.target.value).toISO()!,
                              );
                            } else {
                              e.target.value =
                                formatIsoDateForDateTimeInputField(
                                  store.selectedEndDate,
                                );
                            }
                          }
                        }}
                      />
                    )}
                </div>
                {showAppVersions && (
                  <DropdownSelect
                    title="App versions"
                    type={DropdownSelectType.MultiAppVersion}
                    items={store.versions}
                    initialSelected={store.selectedVersions}
                    onChangeSelected={(items) =>
                      store.setSelectedVersions(items as AppVersion[])
                    }
                    open={appVersionsOpen}
                    onOpenChange={setAppVersionsOpen}
                  />
                )}
                {showErrorTypeControl && (
                  <DropdownSelect
                    title="Type"
                    type={DropdownSelectType.MultiString}
                    items={ERROR_TYPE_DISPLAY_ITEMS}
                    initialSelected={store.selectedErrorTypes.map(
                      (t) => ERROR_TYPE_STORE_TO_DISPLAY[t] ?? t,
                    )}
                    onChangeSelected={(items) => {
                      const display = items as string[];
                      store.setSelectedErrorTypes(
                        display
                          .map((d) => ERROR_TYPE_DISPLAY_TO_STORE[d])
                          .filter((v): v is string => v !== undefined),
                      );
                    }}
                  />
                )}
                {showSeverityControl && (
                  <DropdownSelect
                    title="Severity"
                    type={DropdownSelectType.MultiString}
                    items={SEVERITY_DISPLAY_ITEMS}
                    initialSelected={store.selectedSeverities.map(
                      (s) => SEVERITY_STORE_TO_DISPLAY[s] ?? s,
                    )}
                    onChangeSelected={(items) => {
                      const display = items as string[];
                      store.setSelectedSeverities(
                        display
                          .map((d) => SEVERITY_DISPLAY_TO_STORE[d])
                          .filter((v): v is string => v !== undefined),
                      );
                    }}
                  />
                )}
                {showCustomErrorsControl && (
                  <label className="flex items-center gap-2 cursor-pointer select-none font-display text-sm">
                    <Checkbox
                      checked={store.customErrorsOnly}
                      onCheckedChange={(checked) =>
                        store.setCustomErrorsOnly(checked === true)
                      }
                    />
                    Custom errors only
                  </label>
                )}
                {hasMoreFilters && (
                  <Button
                    variant="outline"
                    className="select-none"
                    onClick={() => {
                      setScrollTarget(null);
                      setMoreFiltersOpen(true);
                    }}
                  >
                    <SlidersHorizontal />
                    More filters
                  </Button>
                )}
                {showFreeText && (
                  <DebounceTextInput
                    id={SEARCH_INPUT_ID}
                    placeholder={
                      freeTextPlaceholder
                        ? freeTextPlaceholder
                        : defaultFreeTextPlaceholder
                    }
                    initialValue={store.selectedFreeText}
                    onChange={(input) => store.setSelectedFreeText(input)}
                  />
                )}
              </div>

              {(showAppVersions ||
                filterChips.length > 0 ||
                searchActive ||
                showAnrsPill ||
                showErrorsPill) && (
                <>
                  <div className="py-4" />
                  <div className="flex flex-wrap gap-2 items-center">
                    {showAppVersions && (
                      <FilterChip
                        {...chipLabels(
                          "App versions",
                          store.selectedVersions.map((v) => v.displayName),
                        )}
                        onClick={() => setAppVersionsOpen(true)}
                        action={
                          appVersionsChanged
                            ? resetAction(() =>
                                store.setSelectedVersions(defaultAppVersions),
                              )
                            : undefined
                        }
                      />
                    )}
                    {filterChips.map((chip) => (
                      <FilterChip
                        key={chip.key}
                        label={chip.label}
                        tooltip={chip.tooltip}
                        onClick={() => openFilterModal(chip.key)}
                        action={chip.action}
                      />
                    ))}
                    {showAnrsPill && (
                      <FilterChip
                        label="ANRs"
                        onClick={() => {}}
                        action={clearAction(() =>
                          store.setSelectedErrorTypes(
                            store.selectedErrorTypes.filter((t) => t !== "anr"),
                          ),
                        )}
                      />
                    )}
                    {showErrorsPill && (
                      <FilterChip
                        label={errorsPillLabel}
                        onClick={() => {}}
                        action={clearAction(() => {
                          store.setSelectedErrorTypes(
                            store.selectedErrorTypes.filter(
                              (t) => t !== "error",
                            ),
                          );
                          store.setSelectedSeverities([]);
                          store.setCustomErrorsOnly(false);
                        })}
                      />
                    )}
                    {searchActive && (
                      <FilterChip
                        label={`Search: ${store.selectedFreeText}`}
                        onClick={() =>
                          document.getElementById(SEARCH_INPUT_ID)?.focus()
                        }
                        action={clearAction(() =>
                          store.setSelectedFreeText(""),
                        )}
                      />
                    )}
                  </div>
                </>
              )}

              {hasMoreFilters && (
                <Dialog
                  open={moreFiltersOpen}
                  onOpenChange={(open) => {
                    setMoreFiltersOpen(open);
                    if (!open) {
                      setScrollTarget(null);
                    }
                  }}
                >
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="font-display">
                        More filters
                      </DialogTitle>
                      <DialogDescription className="font-body">
                        Narrow down results with additional filters.
                      </DialogDescription>
                    </DialogHeader>
                    {moreFiltersContent}
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Done</Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          )}
      </div>
    );
  },
);

FiltersComponent.displayName = "Filters";
export default FiltersComponent;
