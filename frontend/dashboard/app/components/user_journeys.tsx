"use client";

import { filterExprIssuesIn } from "@/app/api/api_error";
import DebounceTextInput from "@/app/components/debounce_text_input";
import FilterBar from "@/app/components/filter_bar/filter_bar";
import { useExprFilterPage } from "@/app/components/filter_bar/use_expr_filter_page";
import Journey, {
  JourneyType,
  PlotType,
  demoJourney,
} from "@/app/components/journey";
import { SkeletonListPage } from "@/app/components/skeleton";
import TabSelect from "@/app/components/tab_select";
import { useJourneyQuery } from "@/app/query/hooks";
import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

const journeyTypeUrlKey = "jt";

// Stands in for the journey query on the marketing pages, where nothing is
// fetched and the chart draws the demo data as a completed query.
const demoJourneyQuery = { status: "success" as const, data: demoJourney };

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
  const searchParams = useSearchParams();

  const {
    requestedFilters,
    filterState,
    filterParams,
    onRequestChange,
    onFilterChange,
    setPageUrlKey,
  } = useExprFilterPage({ pageUrlKeys: [journeyTypeUrlKey] });
  const readyFilter = filterState.status === "ready" ? filterState : null;

  // The demo keeps its plot type in local state, so tab clicks on the
  // marketing page don't change its URL. The live page reads the plot
  // type from the URL on each render, so links open the specified plot and
  // tab clicks update the URL.
  const [demoPlotType, setDemoPlotType] = useState(PlotType.Paths);
  const plotType = demo
    ? demoPlotType
    : searchParams.get(journeyTypeUrlKey) === PlotType.Exceptions
      ? PlotType.Exceptions
      : PlotType.Paths;
  const [searchText, setSearchText] = useState("");

  const journeyQuery = useJourneyQuery(filterParams);

  const filterExprIssues = filterExprIssuesIn(journeyQuery.error);

  const { status } = journeyQuery;

  const journeyType =
    plotType === PlotType.Paths ? JourneyType.Paths : JourneyType.Exceptions;

  return (
    <div className="flex flex-col items-start">
      <p className="font-display text-4xl max-w-6xl text-center">
        {demo ? (hideDemoTitle ? "" : "User Journeys") : ""}
      </p>
      <div className="py-4" />

      {!demo && (
        <>
          <FilterBar
            teamId={params.teamId}
            entity="journeys"
            placeholder="Filter journeys…"
            requestedAppId={requestedFilters.appId}
            requestedDateRange={requestedFilters.dateRange}
            requestedFilterExpr={requestedFilters.filterExpr}
            filterExprIssues={filterExprIssues}
            onRequestChange={onRequestChange}
            onFilterChange={onFilterChange}
          />
          <div className="py-4" />
        </>
      )}

      {!demo && filterState.status === "error" && (
        <p className="text-lg font-display">{filterState.message}</p>
      )}

      {!demo && filterState.status === "pending" && <SkeletonListPage />}

      {!demo &&
        readyFilter !== null &&
        status === "error" &&
        filterExprIssues === null && (
          <p className="text-lg font-display">
            Error fetching journey. Please refresh page or change filters to try
            again.
          </p>
        )}

      {(demo ||
        (readyFilter !== null &&
          (status === "success" || status === "pending"))) && (
        <>
          <div className="w-full flex items-center justify-between pb-2 pr-2">
            {demo ? (
              <div />
            ) : (
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <DebounceTextInput
                  className="pl-8"
                  id="free-text"
                  placeholder="Search nodes..."
                  initialValue={""}
                  onChange={(it) => setSearchText(it)}
                />
              </div>
            )}
            <TabSelect
              items={Object.values(PlotType)}
              selected={plotType}
              onChangeSelected={(item) => {
                if (demo) {
                  setDemoPlotType(item as PlotType);
                } else {
                  setPageUrlKey(journeyTypeUrlKey, item);
                }
              }}
            />
          </div>

          <div className="w-full h-200">
            <div className="py-4" />

            {/* Keyed on the plot type so switching tabs mounts a fresh
                chart, which closes any issue panel the previous one had
                open. */}
            <Journey
              key={plotType}
              journeyType={journeyType}
              searchText={searchText}
              query={demo ? demoJourneyQuery : journeyQuery}
              errorDetailContext={
                demo || readyFilter === null
                  ? undefined
                  : { teamId: params.teamId, appId: readyFilter.app.id }
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
