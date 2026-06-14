"use client";

import { FilterSource } from "@/app/api/api_calls";
import DebounceTextInput from "@/app/components/debounce_text_input";
import Filters, {
  AppVersionsInitialSelectionType,
} from "@/app/components/filters";
import Journey, { JourneyType } from "@/app/components/journey";
import TabSelect from "@/app/components/tab_select";
import { useFiltersStore } from "@/app/stores/provider";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Skeleton, SkeletonPlot } from "../components/skeleton";

export enum PlotType {
  Paths = "Paths",
  Exceptions = "Exceptions",
}

const journeyTypeUrlKey = "jt";

interface UserJourneysProps {
  params?: { teamId: string };
  demo?: boolean;
  hideDemoTitle?: boolean;
}

export default function UserJourneys({
  params = { teamId: "demo-team-id" },
  demo = false,
  hideDemoTitle = false,
}: UserJourneysProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useFiltersStore((state) => state.filters);

  // Derive the initial plot type from the URL once.
  const [plotType, setPlotType] = useState<PlotType>(() =>
    searchParams.get(journeyTypeUrlKey) === PlotType.Exceptions
      ? PlotType.Exceptions
      : PlotType.Paths,
  );
  const [searchText, setSearchText] = useState("");

  // Sync filters and plot type to URL
  useEffect(() => {
    if (!filters.ready) {
      return;
    }
    const queryParams = `${journeyTypeUrlKey}=${encodeURIComponent(plotType)}&${filters.serialisedFilters!}`;
    router.replace(`?${queryParams}`, { scroll: false });
  }, [filters.ready, filters.serialisedFilters, plotType]);

  return (
    <div className="flex flex-col items-start">
      <p className="font-display text-4xl max-w-6xl text-center">
        {demo ? (hideDemoTitle ? "" : "User Journeys") : ""}
      </p>
      <div className="py-4" />

      {!demo && (
        <Filters
          teamId={params.teamId}
          filterSource={FilterSource.Events}
          appVersionsInitialSelectionType={
            AppVersionsInitialSelectionType.Latest
          }
          showNoData={true}
          showNotOnboarded={true}
          showAppSelector={true}
          showAppVersions={true}
          showDates={true}
          showSessionTypes={false}
          showOsVersions={false}
          showCountries={false}
          showNetworkTypes={false}
          showNetworkProviders={false}
          showNetworkGenerations={false}
          showLocales={false}
          showDeviceManufacturers={false}
          showDeviceNames={false}
          showBugReportStatus={false}
          showHttpMethods={false}
          showFreeText={false}
          showUdAttrs={false}
        />
      )}

      {!demo && filters.loading && (
        <>
          <div className="w-full flex justify-end pb-2 pr-2">
            <Skeleton className="h-9 w-40" />
          </div>
          <div className="w-full h-[800px]">
            <div className="py-2" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-3 w-72 mt-4" />
            <div className="py-4" />
            <SkeletonPlot showAxes={false} />
          </div>
        </>
      )}

      {(demo || filters.ready) && (
        <>
          {/* TabSelect for plot type */}
          <div className="w-full flex justify-end pb-2 pr-2">
            <TabSelect
              items={Object.values(PlotType)}
              selected={plotType}
              onChangeSelected={(item) => {
                setPlotType(item as PlotType);
              }}
            />
          </div>

          {/* Main content area */}
          <div className="w-full h-[800px]">
            {!demo && <div className="py-2" />}
            {!demo && (
              <DebounceTextInput
                className="w-full"
                id="free-text"
                placeholder="Search nodes..."
                initialValue={""}
                onChange={(it) => setSearchText(it)}
              />
            )}
            <div className="py-4" />

            {plotType === PlotType.Paths && (
              <Journey
                teamId={params.teamId}
                bidirectional={false}
                journeyType={JourneyType.Paths}
                searchText={searchText}
                demo={demo}
              />
            )}
            {plotType === PlotType.Exceptions && (
              <Journey
                teamId={params.teamId}
                bidirectional={false}
                journeyType={JourneyType.Exceptions}
                searchText={searchText}
                demo={demo}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
