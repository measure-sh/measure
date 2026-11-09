"use client";

import { filterExprIssuesIn, queryErrorMessage } from "@/app/api/api_error";
import type { Journey, JourneySelection } from "@/app/api/api_calls";
import DropdownSelect, {
  DropdownSelectType,
} from "@/app/components/dropdown_select";
import EmptyState from "@/app/components/empty_state";
import FilterBar, {
  type FilterChange,
} from "@/app/components/filter_bar/filter_bar";
import { useFilterPage } from "@/app/components/filter_bar/use_filter_page";
import Pill from "@/app/components/pill";
import { SamplePercent } from "@/app/components/sample_percent";
import { SkeletonListPage, SkeletonPlot } from "@/app/components/skeleton";
import { RootSpanMetricsQuantile, useJourneyQuery } from "@/app/query/hooks";
import { useDiscardUrlKeys } from "@/app/utils/url_utils";
import { Waypoints } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { demoJourney, demoSelection } from "./demo_data";
import { shortName, useKindColours } from "./format";
import JourneyGraph from "./graph";
import { selectionKey } from "./highlight";
import SelectionDetails, {
  detailsUrlKeys,
  FIRST_PAGES,
  ListTab,
  SelectionDetailsView,
} from "./selection_details";
import { DEFAULT_SHOWN_NODES, selectableNodes, showNodes } from "./node_picker";
import {
  encodeNodeIds,
  selectionFromUrl,
  selectionIn,
  selectionUrlEntries,
  shownNodesUrlKey,
  useNodeIds,
} from "./url_state";

const EMPTY_JOURNEY: Journey = { nodes: [], links: [], sample_percent: 100 };

export function JourneysDemo({ hideTitle = false }: { hideTitle?: boolean }) {
  const [selection, setSelection] = useState<JourneySelection | null>(
    demoSelection,
  );
  const [list, setList] = useState(ListTab.Network);
  const [quantile, setQuantile] = useState(RootSpanMetricsQuantile.p50);
  const [offsets, setOffsets] = useState(FIRST_PAGES);

  return (
    <div className="flex flex-col items-start w-full">
      <p className="font-display text-4xl max-w-6xl text-center">
        {hideTitle ? "" : "User Journeys"}
      </p>
      {!hideTitle && <div className="py-4" />}
      <div className="w-full h-120 2xl:h-180">
        <JourneyGraph
          journey={demoJourney}
          selection={selection}
          onSelect={setSelection}
          summary={[
            <SamplePercent key="sample" percent={demoJourney.sample_percent} />,
          ]}
        />
      </div>
      {selection !== null && (
        <>
          <div className="py-6" />
          <SelectionDetailsView
            teamId="demo-team"
            appId="demo-app"
            journey={demoJourney}
            selection={selection}
            list={list}
            onSelectList={setList}
            quantile={quantile}
            onSelectQuantile={setQuantile}
            offsets={offsets}
            onChangeOffsets={setOffsets}
            demo
          />
        </>
      )}
    </div>
  );
}

export default function JourneysOverview({ teamId }: { teamId: string }) {
  const {
    value,
    apps,
    keys,
    keyGroups,
    keysUnavailable,
    status: filterStatus,
    filterParams,
    onChange,
    setPageUrlKeys,
    discardPageUrlKeys,
  } = useFilterPage({ teamId, entity: "journeys" });
  const searchParams = useSearchParams();
  const readyValue = filterStatus.kind === "ready" ? value : null;

  const journeyQuery = useJourneyQuery(filterParams);
  const filterExprIssues = filterExprIssuesIn(journeyQuery.error);
  const journey = journeyQuery.data;

  // Until the user selects which nodes to show, each new journey shows its
  // nodes with the most users. The graph gets a new journey when the shown
  // nodes change, which fits it to the view again.
  const pickedIds = useNodeIds(searchParams.get(shownNodesUrlKey));
  const selectable = useMemo(
    () => (journey === undefined ? [] : selectableNodes(journey)),
    [journey],
  );
  const shownIds = useMemo(() => {
    if (pickedIds.ids === null) {
      return selectable.slice(0, DEFAULT_SHOWN_NODES).map((node) => node.id);
    }
    const ids = new Set(selectable.map((node) => node.id));
    return pickedIds.ids.filter((id) => ids.has(id));
  }, [selectable, pickedIds.ids]);
  const shownJourney = useMemo(
    () => showNodes(journey ?? EMPTY_JOURNEY, shownIds),
    [journey, shownIds],
  );
  const kindColours = useKindColours();

  // The selection object stays the same while the URL holds the same
  // selection, since the graph compares selections by reference.
  const urlSelection = selectionFromUrl(searchParams);
  const urlSelectionKey = JSON.stringify(urlSelection);
  const selection = useMemo(
    () =>
      urlSelection !== null &&
      !pickedIds.pending &&
      selectionIn(shownJourney, urlSelection)
        ? urlSelection
        : null,
    [urlSelectionKey, shownJourney, pickedIds.pending],
  );

  // The selection is judged only once the journey of the current filters and
  // shown nodes has loaded, so a slow or failed request does not remove a
  // selection the journey has.
  const journeyLoaded =
    journeyQuery.status === "success" &&
    !journeyQuery.isPlaceholderData &&
    !pickedIds.pending;
  const unusableKeys: string[] = [];
  if (
    searchParams.has(shownNodesUrlKey) &&
    !pickedIds.pending &&
    pickedIds.ids === null
  ) {
    unusableKeys.push(shownNodesUrlKey);
  }
  if (journeyLoaded) {
    unusableKeys.push(
      ...Object.entries(selectionUrlEntries(selection))
        .filter(([key, entry]) => entry === null && searchParams.has(key))
        .map(([key]) => key),
    );
    if (selection === null) {
      unusableKeys.push(
        ...detailsUrlKeys.filter((key) => searchParams.has(key)),
      );
    }
  }
  useDiscardUrlKeys(unusableKeys, discardPageUrlKeys);

  // The lists of a selection start over for each selection.
  const selectionEntries = (next: JourneySelection | null) => ({
    ...selectionUrlEntries(next),
    ...Object.fromEntries(detailsUrlKeys.map((key) => [key, null])),
  });
  // The graph selects a link again when the user clicks the selected link,
  // and the selection keeps its lists.
  const select = (next: JourneySelection | null) => {
    if (
      next !== null &&
      selection !== null &&
      selectionKey(next) === selectionKey(selection)
    ) {
      return;
    }
    setPageUrlKeys(selectionEntries(next));
  };

  // A selection belongs to the journey it was made on, so changing the filters
  // or the shown nodes clears it. The shown nodes belong to the app.
  const changeFilters = (change: FilterChange) => {
    onChange(change);
    const appChanged =
      change.appId !== undefined && change.appId !== value?.app.id;
    setPageUrlKeys({
      ...selectionEntries(null),
      ...(appChanged ? { [shownNodesUrlKey]: null } : {}),
    });
  };

  // Encoding is asynchronous, so a quick second change can finish first, and
  // only the latest change is written.
  const pickCount = useRef(0);
  const pickNodes = async (ids: string[]) => {
    const count = ++pickCount.current;
    const encoded = await encodeNodeIds(ids);
    if (count !== pickCount.current) {
      return;
    }
    pickedIds.remember(encoded, ids);
    setPageUrlKeys({
      [shownNodesUrlKey]: encoded,
      ...selectionEntries(null),
    });
  };

  const nodePicker = (
    <DropdownSelect
      type={DropdownSelectType.MultiString}
      title="Select Nodes"
      items={selectable.map((node) => ({
        value: node.id,
        label: shortName(node.name),
        color: kindColours[node.kind],
      }))}
      initialSelected={shownIds}
      disabled={journey === undefined || pickedIds.pending}
      onChangeSelected={(ids) => pickNodes(ids as string[])}
    />
  );

  let canvasPlaceholder: React.ReactNode;
  if (
    journeyQuery.status === "pending" ||
    journeyQuery.isPlaceholderData ||
    pickedIds.pending
  ) {
    canvasPlaceholder = <SkeletonPlot showAxes={false} />;
  } else if (journeyQuery.status === "error") {
    canvasPlaceholder = (
      <p className="p-4 text-lg font-display">
        {queryErrorMessage(
          journeyQuery.error,
          "Error fetching journey. Please refresh page or change filters to try again.",
        )}
      </p>
    );
  } else if (journey !== undefined && selectable.length === 0) {
    canvasPlaceholder = (
      <EmptyState
        icon={Waypoints}
        title="No journeys found"
        description="Try a wider time range or different filters"
        className="h-full border-none"
      />
    );
  } else if (shownJourney.nodes.length === 0) {
    canvasPlaceholder = (
      <EmptyState
        icon={Waypoints}
        title="No nodes shown"
        description="Select the screens and custom events to show"
        className="h-full border-none"
      />
    );
  }

  return (
    <div className="flex flex-col items-start">
      <div className="py-4" />

      <FilterBar
        entity="journeys"
        teamId={teamId}
        placeholder="Filter journeys…"
        value={value}
        apps={apps}
        keys={keys}
        keyGroups={keyGroups}
        keysUnavailable={keysUnavailable}
        filterExprIssues={filterExprIssues}
        status={filterStatus}
        onChange={changeFilters}
      />
      <div className="py-4" />

      {filterStatus.kind === "error" && (
        <p className="text-lg font-display">{filterStatus.message}</p>
      )}

      {filterStatus.kind === "loading" && <SkeletonListPage />}

      {readyValue !== null && filterExprIssues === null && (
        <>
          <div className="w-full h-120 2xl:h-180">
            <JourneyGraph
              journey={shownJourney}
              selection={selection}
              onSelect={select}
              toolbarStart={nodePicker}
              placeholder={canvasPlaceholder}
              summary={[
                <Pill
                  key="nodes"
                  tooltip="The graph shows only selected screens and custom events in the journey. Use Select Nodes to adjust."
                >
                  {`${shownIds.length} of ${selectable.length} nodes`}
                </Pill>,
                <SamplePercent
                  key="sample"
                  percent={journey?.sample_percent}
                />,
              ]}
            />
          </div>

          {selection !== null &&
            journey !== undefined &&
            filterParams !== null && (
              <>
                <div className="py-6" />
                <SelectionDetails
                  key={selectionKey(selection)}
                  teamId={teamId}
                  params={filterParams}
                  journey={shownJourney}
                  selection={selection}
                  onChangeUrl={setPageUrlKeys}
                  onDiscardUrlKeys={discardPageUrlKeys}
                />
              </>
            )}
        </>
      )}
    </div>
  );
}
