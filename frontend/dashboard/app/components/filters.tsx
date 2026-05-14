"use client";
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
} from "react";
import {
  App,
  AppsApiStatus,
  AppVersion,
  BugReportStatus,
  FiltersApiStatus,
  FilterSource,
  HttpMethod,
  OsVersion,
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
import DebounceTextInput from "./debounce_text_input";
import DropdownSelect, { DropdownSelectType } from "./dropdown_select";
import { Input } from "./input";
import Onboarding from "./onboarding";
import Pill from "./pill";
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
  freeTextPlaceholder?: string;
}

const defaultFreeTextPlaceholder = "Search anything...";

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

function deserializeUrlFilters(queryString: string): URLFilters {
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

    const skeletonDropdownCount = [
      showAppSelector,
      showDates,
      showAppVersions,
      showSessionTypes,
      filterSource === FilterSource.Spans,
      filterSource === FilterSource.Spans,
      showBugReportStatus,
      showHttpMethods,
      showOsVersions,
      showCountries,
      showNetworkProviders,
      showNetworkTypes,
      showNetworkGenerations,
      showLocales,
      showDeviceManufacturers,
      showDeviceNames,
    ].filter(Boolean).length;

    const skeletonPillCount = [
      showDates,
      showAppVersions,
      showSessionTypes,
      filterSource === FilterSource.Spans,
      filterSource === FilterSource.Spans,
      showBugReportStatus,
      showHttpMethods,
      showOsVersions,
      showCountries,
      showNetworkProviders,
      showNetworkTypes,
      showNetworkGenerations,
      showLocales,
      showDeviceManufacturers,
      showDeviceNames,
    ].filter(Boolean).length;

    const filtersSkeleton = (
      skeletonCount: number,
      leadingContent?: React.ReactNode,
    ) => (
      <>
        <div className="flex flex-wrap gap-8 items-center">
          {leadingContent}
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-[150px]" />
          ))}
        </div>
        {showFreeText && (
          <>
            <div className="py-4" />
            <Skeleton className="h-9 w-full" />
          </>
        )}
        {skeletonPillCount > 0 && (
          <>
            <div className="py-4" />
            <div className="flex flex-wrap gap-2 items-center">
              {Array.from({ length: skeletonPillCount }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-[120px] rounded-full" />
              ))}
            </div>
          </>
        )}
      </>
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

    return (
      <div>
        {store.appsApiStatus === AppsApiStatus.Loading &&
          filtersSkeleton(skeletonDropdownCount)}

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
                filtersSkeleton(skeletonDropdownCount - 1, appSelectorDropdown)}
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
                    {filterSource === FilterSource.Crashes
                      ? "crashes"
                      : filterSource === FilterSource.Anrs
                        ? "ANRs"
                        : "data"}{" "}
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
                filtersSkeleton(skeletonDropdownCount - 1, appSelectorDropdown)}
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
                  />
                )}
                {showSessionTypes && (
                  <DropdownSelect
                    title="Session Types"
                    type={DropdownSelectType.MultiString}
                    items={Object.values(SessionType)}
                    initialSelected={store.selectedSessionTypes}
                    onChangeSelected={(items) =>
                      store.setSelectedSessionTypes(items as SessionType[])
                    }
                  />
                )}
                {filterSource === FilterSource.Spans && (
                  <DropdownSelect
                    type={DropdownSelectType.MultiString}
                    title="Span Status"
                    items={Object.values(SpanStatus)}
                    initialSelected={store.selectedSpanStatuses}
                    onChangeSelected={(items) =>
                      store.setSelectedSpanStatuses(items as SpanStatus[])
                    }
                  />
                )}
                {showBugReportStatus && (
                  <DropdownSelect
                    type={DropdownSelectType.MultiString}
                    title="Bug Report Status"
                    items={Object.values(BugReportStatus)}
                    initialSelected={store.selectedBugReportStatuses}
                    onChangeSelected={(items) =>
                      store.setSelectedBugReportStatuses(
                        items as BugReportStatus[],
                      )
                    }
                  />
                )}
                {showHttpMethods && (
                  <DropdownSelect
                    type={DropdownSelectType.MultiString}
                    title="HTTP Method"
                    items={Object.values(HttpMethod).map((m) =>
                      m.toUpperCase(),
                    )}
                    initialSelected={store.selectedHttpMethods.map((m) =>
                      m.toUpperCase(),
                    )}
                    onChangeSelected={(items) =>
                      store.setSelectedHttpMethods(
                        (items as string[]).map(
                          (m) => m.toLowerCase() as HttpMethod,
                        ),
                      )
                    }
                  />
                )}
                {showOsVersions && store.osVersions.length > 0 && (
                  <DropdownSelect
                    type={DropdownSelectType.MultiOsVersion}
                    title="OS Versions"
                    items={store.osVersions}
                    initialSelected={store.selectedOsVersions}
                    onChangeSelected={(items) =>
                      store.setSelectedOsVersions(items as OsVersion[])
                    }
                  />
                )}
                {showCountries && store.countries.length > 0 && (
                  <DropdownSelect
                    type={DropdownSelectType.MultiString}
                    title="Country"
                    items={store.countries}
                    initialSelected={store.selectedCountries}
                    onChangeSelected={(items) =>
                      store.setSelectedCountries(items as string[])
                    }
                  />
                )}
                {showNetworkProviders && store.networkProviders.length > 0 && (
                  <DropdownSelect
                    type={DropdownSelectType.MultiString}
                    title="Network Provider"
                    items={store.networkProviders}
                    initialSelected={store.selectedNetworkProviders}
                    onChangeSelected={(items) =>
                      store.setSelectedNetworkProviders(items as string[])
                    }
                  />
                )}
                {showNetworkTypes && store.networkTypes.length > 0 && (
                  <DropdownSelect
                    type={DropdownSelectType.MultiString}
                    title="Network type"
                    items={store.networkTypes}
                    initialSelected={store.selectedNetworkTypes}
                    onChangeSelected={(items) =>
                      store.setSelectedNetworkTypes(items as string[])
                    }
                  />
                )}
                {showNetworkGenerations &&
                  store.networkGenerations.length > 0 && (
                    <DropdownSelect
                      type={DropdownSelectType.MultiString}
                      title="Network generation"
                      items={store.networkGenerations}
                      initialSelected={store.selectedNetworkGenerations}
                      onChangeSelected={(items) =>
                        store.setSelectedNetworkGenerations(items as string[])
                      }
                    />
                  )}
                {showLocales && store.locales.length > 0 && (
                  <DropdownSelect
                    type={DropdownSelectType.MultiString}
                    title="Locale"
                    items={store.locales}
                    initialSelected={store.selectedLocales}
                    onChangeSelected={(items) =>
                      store.setSelectedLocales(items as string[])
                    }
                  />
                )}
                {showDeviceManufacturers &&
                  store.deviceManufacturers.length > 0 && (
                    <DropdownSelect
                      type={DropdownSelectType.MultiString}
                      title="Device Manufacturer"
                      items={store.deviceManufacturers}
                      initialSelected={store.selectedDeviceManufacturers}
                      onChangeSelected={(items) =>
                        store.setSelectedDeviceManufacturers(items as string[])
                      }
                    />
                  )}
                {showDeviceNames && store.deviceNames.length > 0 && (
                  <DropdownSelect
                    type={DropdownSelectType.MultiString}
                    title="Device Name"
                    items={store.deviceNames}
                    initialSelected={store.selectedDeviceNames}
                    onChangeSelected={(items) =>
                      store.setSelectedDeviceNames(items as string[])
                    }
                  />
                )}
                {showUdAttrs && store.userDefAttrs.length > 0 && (
                  <UserDefAttrSelector
                    attrs={store.userDefAttrs}
                    ops={store.userDefAttrOps}
                    initialSelected={store.selectedUdAttrMatchers}
                    onChangeSelected={(udAttrMatchers) =>
                      store.setSelectedUdAttrMatchers(udAttrMatchers)
                    }
                  />
                )}
                {showFreeText && (
                  <DebounceTextInput
                    id="free-text"
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
              <div className="py-4" />
              <div className="flex flex-wrap gap-2 items-center">
                {filterSource === FilterSource.Spans && (
                  <Pill title={store.selectedRootSpanName} />
                )}
                {showDates && (
                  <Pill
                    title={`${formatDateToHumanReadableDateTime(store.selectedStartDate)} to ${formatDateToHumanReadableDateTime(store.selectedEndDate)}`}
                  />
                )}
                {showAppVersions && store.selectedVersions.length > 0 && (
                  <Pill
                    title={Array.from(store.selectedVersions)
                      .map((v) => v.displayName)
                      .join(", ")}
                  />
                )}
                {showSessionTypes && store.selectedSessionTypes.length > 0 && (
                  <Pill
                    title={Array.from(store.selectedSessionTypes).join(", ")}
                  />
                )}
                {filterSource === FilterSource.Spans &&
                  store.selectedSpanStatuses.length > 0 && (
                    <Pill
                      title={Array.from(store.selectedSpanStatuses).join(", ")}
                    />
                  )}
                {showBugReportStatus &&
                  store.selectedBugReportStatuses.length > 0 && (
                    <Pill
                      title={Array.from(store.selectedBugReportStatuses).join(
                        ", ",
                      )}
                    />
                  )}
                {showHttpMethods && store.selectedHttpMethods.length > 0 && (
                  <Pill
                    title={Array.from(store.selectedHttpMethods)
                      .map((m) => m.toUpperCase())
                      .join(", ")}
                  />
                )}
                {showOsVersions && store.selectedOsVersions.length > 0 && (
                  <Pill
                    title={Array.from(store.selectedOsVersions)
                      .map((v) => v.displayName)
                      .join(", ")}
                  />
                )}
                {showCountries && store.selectedCountries.length > 0 && (
                  <Pill
                    title={Array.from(store.selectedCountries).join(", ")}
                  />
                )}
                {showNetworkProviders &&
                  store.selectedNetworkProviders.length > 0 && (
                    <Pill
                      title={Array.from(store.selectedNetworkProviders).join(
                        ", ",
                      )}
                    />
                  )}
                {showNetworkTypes && store.selectedNetworkTypes.length > 0 && (
                  <Pill
                    title={Array.from(store.selectedNetworkTypes).join(", ")}
                  />
                )}
                {showNetworkGenerations &&
                  store.selectedNetworkGenerations.length > 0 && (
                    <Pill
                      title={Array.from(store.selectedNetworkGenerations).join(
                        ", ",
                      )}
                    />
                  )}
                {showLocales && store.selectedLocales.length > 0 && (
                  <Pill title={Array.from(store.selectedLocales).join(", ")} />
                )}
                {showDeviceManufacturers &&
                  store.selectedDeviceManufacturers.length > 0 && (
                    <Pill
                      title={Array.from(store.selectedDeviceManufacturers).join(
                        ", ",
                      )}
                    />
                  )}
                {showDeviceNames && store.selectedDeviceNames.length > 0 && (
                  <Pill
                    title={Array.from(store.selectedDeviceNames).join(", ")}
                  />
                )}
                {showUdAttrs && store.selectedUdAttrMatchers.length > 0 && (
                  <Pill
                    title={store.selectedUdAttrMatchers
                      .map(
                        (matcher) =>
                          `${matcher.key} (${matcher.type}) ${matcher.op} ${matcher.value}`,
                      )
                      .join(", ")}
                  />
                )}
                {showFreeText && store.selectedFreeText !== "" && (
                  <Pill title={"Search Text: " + store.selectedFreeText} />
                )}
              </div>
            </div>
          )}
      </div>
    );
  },
);

FiltersComponent.displayName = "Filters";
export default FiltersComponent;
