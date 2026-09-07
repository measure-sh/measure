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
import { type ComponentProps, type ReactNode, useState } from "react";

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
  if (demo) {
    return <DemoUserJourneys hideTitle={hideDemoTitle} />;
  }
  return <TeamUserJourneys teamId={params.teamId} />;
}

function DemoUserJourneys({ hideTitle }: { hideTitle: boolean }) {
  const [plotType, setPlotType] = useState(PlotType.Paths);

  return (
    <div className="flex flex-col items-start">
      <p className="font-display text-4xl max-w-6xl text-center">
        {hideTitle ? "" : "User Journeys"}
      </p>
      <div className="py-4" />

      <JourneyPlot
        plotType={plotType}
        onChangePlotType={setPlotType}
        query={demoJourneyQuery}
      />
    </div>
  );
}

function TeamUserJourneys({ teamId }: { teamId: string }) {
  const searchParams = useSearchParams();

  const {
    value,
    apps,
    keys,
    keyGroups,
    keysUnavailable,
    status: filterStatus,
    filterParams,
    onChange,
    setPageUrlKey,
  } = useExprFilterPage({ teamId, entity: "journeys" });
  const readyValue = filterStatus.kind === "ready" ? value : null;

  const plotType =
    searchParams.get(journeyTypeUrlKey) === PlotType.Exceptions
      ? PlotType.Exceptions
      : PlotType.Paths;
  const [searchText, setSearchText] = useState("");

  const journeyQuery = useJourneyQuery(filterParams);

  const filterExprIssues = filterExprIssuesIn(journeyQuery.error);

  const { status } = journeyQuery;

  return (
    <div className="flex flex-col items-start">
      <div className="py-4" />

      <FilterBar
        entity="journeys"
        placeholder="Filter journeys…"
        value={value}
        apps={apps}
        keys={keys}
        keyGroups={keyGroups}
        keysUnavailable={keysUnavailable}
        filterExprIssues={filterExprIssues}
        onChange={onChange}
      />
      <div className="py-4" />

      {filterStatus.kind === "error" && (
        <p className="text-lg font-display">{filterStatus.message}</p>
      )}

      {filterStatus.kind === "loading" && <SkeletonListPage />}

      {readyValue !== null &&
        status === "error" &&
        filterExprIssues === null && (
          <p className="text-lg font-display">
            Error fetching journey. Please refresh page or change filters to try
            again.
          </p>
        )}

      {readyValue !== null &&
        (status === "success" || status === "pending") && (
          <JourneyPlot
            plotType={plotType}
            onChangePlotType={(type) => setPageUrlKey(journeyTypeUrlKey, type)}
            search={
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
            }
            searchText={searchText}
            query={journeyQuery}
            errorDetailContext={{ teamId, appId: readyValue.app.id }}
          />
        )}
    </div>
  );
}

function JourneyPlot({
  plotType,
  onChangePlotType,
  search,
  searchText,
  query,
  errorDetailContext,
}: {
  plotType: PlotType;
  onChangePlotType: (plotType: PlotType) => void;
  search?: ReactNode;
  searchText?: string;
  query: ComponentProps<typeof Journey>["query"];
  errorDetailContext?: ComponentProps<typeof Journey>["errorDetailContext"];
}) {
  const journeyType =
    plotType === PlotType.Paths ? JourneyType.Paths : JourneyType.Exceptions;

  return (
    <>
      <div className="w-full flex items-center justify-between pb-2 pr-2">
        {search ?? <div />}
        <TabSelect
          items={Object.values(PlotType)}
          selected={plotType}
          onChangeSelected={(item) => onChangePlotType(item as PlotType)}
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
          query={query}
          errorDetailContext={errorDetailContext}
        />
      </div>
    </>
  );
}
