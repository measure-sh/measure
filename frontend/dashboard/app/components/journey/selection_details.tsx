"use client";

import { AlertTriangle, Globe, Timer, Video } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Journey, JourneySelection } from "@/app/api/api_calls";
import { queryErrorMessage } from "@/app/api/api_error";
import {
  type FilterParams,
  JOURNEY_LIST_LIMIT,
  RootSpanMetricsQuantile,
  useJourneyErrorsQuery,
  useJourneyNetworkQuery,
  useJourneyPathUsersQuery,
  useJourneySessionsQuery,
  useJourneyTracesQuery,
} from "@/app/query/hooks";
import { urlFiltersKeyMap } from "@/app/stores/filters_store";
import { errorGroupPath, errorGroupTitle } from "@/app/utils/error_utils";
import {
  formatDateToHumanReadableDate,
  formatDateToHumanReadableTime,
  formatMillisToHumanReadable,
} from "@/app/utils/time_utils";
import { ControlSeparator } from "../funnel/friction";
import { ErrorPills } from "../funnel/step_errors";
import {
  CountCell,
  StepCell,
  StepList,
  StepRow,
  useDateRangeParams,
} from "../funnel/step_list";
import Paginator from "../paginator";
import { Skeleton } from "../skeleton";
import TabSelect from "../tab_select";
import { TableHead } from "../table";
import {
  demoErrors,
  demoNetwork,
  demoPathUsers,
  demoSessions,
  demoTraces,
} from "./demo_data";
import { linkStats, nodeStats, shortName, type Stat } from "./format";
import { sameLink } from "./highlight";
import type { PageUrlEntries } from "@/app/components/filter_bar/use_filter_page";
import {
  enumFromUrl,
  offsetFromUrl,
  offsetUrlValue,
  pastLastPage,
  unknownOffset,
  unknownUrlKeys,
  useDiscardUrlKeys,
} from "@/app/utils/url_utils";

export enum ListTab {
  Errors = "Errors",
  Traces = "Traces",
  Network = "Network",
  SessionReplays = "Session Replays",
}

export const FIRST_PAGES: Record<ListTab, number> = {
  [ListTab.Errors]: 0,
  [ListTab.Traces]: 0,
  [ListTab.Network]: 0,
  [ListTab.SessionReplays]: 0,
};

const listUrlKey = "jl";
const quantileUrlKey = "jq";
const offsetUrlKeys: Record<ListTab, string> = {
  [ListTab.Errors]: "joe",
  [ListTab.Traces]: "jot",
  [ListTab.Network]: "jon",
  [ListTab.SessionReplays]: "jos",
};

// The URL keys of the lists of a selection, which start over for each
// selection.
export const detailsUrlKeys = [
  listUrlKey,
  quantileUrlKey,
  ...Object.values(offsetUrlKeys),
];

const ENTRY_POINT = "journeys";

function DurationCell({
  href,
  className,
  ms,
}: {
  href: string | undefined;
  className: string;
  ms: number;
}) {
  return (
    <StepCell href={href} className={`${className} text-right truncate`}>
      {formatMillisToHumanReadable(ms)}
    </StepCell>
  );
}

// The users of a path come from a separate request. Thus the stats of a path
// are null until that request finishes.
function summaryOf(
  journey: Journey,
  selection: JourneySelection,
  pathUsers: number | undefined,
): {
  title: string;
  fullTitle: string;
  description: string;
  stats: Stat[] | null;
} | null {
  const nodeOf = (id: string) => journey.nodes.find((n) => n.id === id);
  if ("path" in selection) {
    const nodes = selection.path.flatMap((id) => nodeOf(id) ?? []);
    if (nodes.length !== selection.path.length) {
      return null;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const from = shortName(first.name);
    return {
      title: nodes.map((n) => shortName(n.name)).join(" → "),
      fullTitle: nodes.map((n) => n.name).join(" → "),
      description: `Errors, traces, network requests and session replays between ${from} and ${
        last.kind === "fatal" ? "the fatal error" : shortName(last.name)
      } in sessions that sequentially progressed through the path.`,
      stats: pathUsers === undefined ? null : linkStats(first, pathUsers),
    };
  }
  if ("node" in selection) {
    const node = nodeOf(selection.node);
    if (!node) {
      return null;
    }
    const name = shortName(node.name);
    return {
      title: name,
      fullTitle: node.name,
      description:
        node.kind === "fatal"
          ? "Crashes, ANRs and App hangs that ended sessions."
          : `Errors, traces, network requests and session replays between ${name} and all immediate next steps.`,
      stats: nodeStats(node),
    };
  }
  const source = nodeOf(selection.source);
  const target = nodeOf(selection.target);
  const link = journey.links.find((l) => sameLink(l, selection));
  if (!source || !target || !link) {
    return null;
  }
  const from = shortName(source.name);
  const to = shortName(target.name);
  return {
    title: `${from} → ${to}`,
    fullTitle: `${source.name} → ${target.name}`,
    description:
      target.kind === "fatal"
        ? `Errors, traces, network requests and session replays between ${from} and the fatal error.`
        : `Errors, traces, network requests and session replays between ${from} and ${to}.`,
    stats: linkStats(source, link.users),
  };
}

export default function SelectionDetails({
  teamId,
  params,
  journey,
  selection,
  onChangeUrl,
  onDiscardUrlKeys,
}: {
  teamId: string;
  params: FilterParams;
  journey: Journey;
  selection: JourneySelection;
  onChangeUrl: (entries: PageUrlEntries) => void;
  onDiscardUrlKeys: (keys: string[]) => void;
}) {
  const searchParams = useSearchParams();
  const list = enumFromUrl(
    Object.values(ListTab),
    searchParams.get(listUrlKey),
    ListTab.Errors,
  );
  const quantile = enumFromUrl(
    Object.values(RootSpanMetricsQuantile),
    searchParams.get(quantileUrlKey),
    RootSpanMetricsQuantile.p50,
  );
  const offsets = Object.fromEntries(
    Object.values(ListTab).map((l) => [
      l,
      offsetFromUrl(searchParams.get(offsetUrlKeys[l])),
    ]),
  ) as Record<ListTab, number>;
  // Each list's query is expensive, so a list is fetched only once the user
  // has opened it.
  const [opened, setOpened] = useState(() => new Set([list]));
  const isOpen = (l: ListTab) => l === list || opened.has(l);

  const pathUsersQuery = useJourneyPathUsersQuery(
    params,
    journey.sample_percent,
    "path" in selection ? selection.path : [],
    "path" in selection,
  );
  const errorsQuery = useJourneyErrorsQuery(
    params,
    journey.sample_percent,
    selection,
    offsets[ListTab.Errors],
    isOpen(ListTab.Errors),
  );
  const tracesQuery = useJourneyTracesQuery(
    params,
    journey.sample_percent,
    selection,
    quantile,
    offsets[ListTab.Traces],
    isOpen(ListTab.Traces),
  );
  const networkQuery = useJourneyNetworkQuery(
    params,
    journey.sample_percent,
    selection,
    quantile,
    offsets[ListTab.Network],
    isOpen(ListTab.Network),
  );
  const sessionsQuery = useJourneySessionsQuery(
    params,
    journey.sample_percent,
    selection,
    offsets[ListTab.SessionReplays],
    isOpen(ListTab.SessionReplays),
  );

  const queries = {
    [ListTab.Errors]: errorsQuery,
    [ListTab.Traces]: tracesQuery,
    [ListTab.Network]: networkQuery,
    [ListTab.SessionReplays]: sessionsQuery,
  };
  const unusableKeys = [
    ...unknownUrlKeys(searchParams, {
      [listUrlKey]: Object.values(ListTab),
      [quantileUrlKey]: Object.values(RootSpanMetricsQuantile),
    }),
    ...Object.values(ListTab)
      .filter(
        (l) =>
          unknownOffset(searchParams.get(offsetUrlKeys[l])) ||
          pastLastPage(offsets[l], queries[l]),
      )
      .map((l) => offsetUrlKeys[l]),
  ];
  useDiscardUrlKeys(unusableKeys, onDiscardUrlKeys);

  return (
    <SelectionDetailsView
      teamId={teamId}
      appId={params.appId}
      journey={journey}
      selection={selection}
      pathUsersQuery={pathUsersQuery}
      list={list}
      onSelectList={(item) => {
        setOpened((current) => new Set(current).add(item));
        onChangeUrl({ [listUrlKey]: item });
      }}
      quantile={quantile}
      onSelectQuantile={(item) => onChangeUrl({ [quantileUrlKey]: item })}
      offsets={offsets}
      onChangeOffsets={(change) => {
        const changed = change(offsets);
        onChangeUrl(
          Object.fromEntries(
            Object.values(ListTab).map((l) => [
              offsetUrlKeys[l],
              offsetUrlValue(changed[l]),
            ]),
          ),
        );
      }}
      errorsQuery={errorsQuery}
      tracesQuery={tracesQuery}
      networkQuery={networkQuery}
      sessionsQuery={sessionsQuery}
    />
  );
}

// The demo has no queries, so it lists its own data, and its rows link
// nowhere.
export function SelectionDetailsView({
  teamId,
  appId,
  journey,
  selection,
  pathUsersQuery,
  list,
  onSelectList,
  quantile,
  onSelectQuantile,
  offsets,
  onChangeOffsets,
  errorsQuery,
  tracesQuery,
  networkQuery,
  sessionsQuery,
  demo = false,
}: {
  teamId: string;
  appId: string;
  journey: Journey;
  selection: JourneySelection;
  pathUsersQuery?: ReturnType<typeof useJourneyPathUsersQuery>;
  list: ListTab;
  onSelectList: (list: ListTab) => void;
  quantile: RootSpanMetricsQuantile;
  onSelectQuantile: (quantile: RootSpanMetricsQuantile) => void;
  offsets: Record<ListTab, number>;
  onChangeOffsets: (
    change: (offsets: Record<ListTab, number>) => Record<ListTab, number>,
  ) => void;
  errorsQuery?: ReturnType<typeof useJourneyErrorsQuery>;
  tracesQuery?: ReturnType<typeof useJourneyTracesQuery>;
  networkQuery?: ReturnType<typeof useJourneyNetworkQuery>;
  sessionsQuery?: ReturnType<typeof useJourneySessionsQuery>;
  demo?: boolean;
}) {
  const dateRangeParams = useDateRangeParams();
  const errors = demo ? demoErrors(selection) : errorsQuery?.data;
  const traces = demo ? demoTraces(selection, quantile) : tracesQuery?.data;
  const network = demo ? demoNetwork(selection, quantile) : networkQuery?.data;
  const sessions = demo ? demoSessions(selection) : sessionsQuery?.data;
  const pathUsers =
    demo && "path" in selection
      ? demoPathUsers(selection.path)
      : pathUsersQuery?.data?.users;

  const activeQuery = {
    [ListTab.Errors]: errorsQuery,
    [ListTab.Traces]: tracesQuery,
    [ListTab.Network]: networkQuery,
    [ListTab.SessionReplays]: sessionsQuery,
  }[list];
  const activeData = {
    [ListTab.Errors]: errors,
    [ListTab.Traces]: traces,
    [ListTab.Network]: network,
    [ListTab.SessionReplays]: sessions,
  }[list];
  const isFetching = activeQuery?.isFetching ?? false;
  const offset = offsets[list];
  const setOffset = (value: number) =>
    onChangeOffsets((current) => ({ ...current, [list]: value }));

  const linkTo = (path: string, extra: Record<string, string>) => {
    if (demo) {
      return undefined;
    }
    const search = new URLSearchParams(dateRangeParams);
    for (const [key, value] of Object.entries(extra)) {
      search.set(key, value);
    }
    return `${path}?${search}`;
  };

  const summary = summaryOf(journey, selection, pathUsers);
  if (summary === null) {
    return null;
  }

  return (
    <div className="w-full font-body">
      <p className="font-display text-xl truncate" title={summary.fullTitle}>
        {summary.title}
      </p>
      <p className="text-sm text-muted-foreground">{summary.description}</p>
      <div className="py-2" />
      <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        {summary.stats === null ? (
          pathUsersQuery?.isError ? (
            <p className="text-muted-foreground">
              {queryErrorMessage(
                pathUsersQuery.error,
                "Error fetching the users of this path.",
              )}
            </p>
          ) : (
            <Skeleton className="h-9 w-56" />
          )
        ) : (
          summary.stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={`tabular-nums ${stat.className ?? ""}`}>
                {stat.value}
              </p>
            </div>
          ))
        )}
      </div>
      <div className="py-2" />
      <div className="flex w-full flex-wrap items-center justify-end gap-2">
        {(list === ListTab.Traces || list === ListTab.Network) && (
          <>
            <TabSelect
              items={Object.values(RootSpanMetricsQuantile)}
              selected={quantile}
              onChangeSelected={(item) => {
                onSelectQuantile(item as RootSpanMetricsQuantile);
                onChangeOffsets((current) => ({
                  ...current,
                  [ListTab.Traces]: 0,
                  [ListTab.Network]: 0,
                }));
              }}
            />
            <ControlSeparator />
          </>
        )}
        <Paginator
          size="sm"
          displayText=""
          prevEnabled={!isFetching && (activeData?.meta.previous ?? false)}
          nextEnabled={!isFetching && (activeData?.meta.next ?? false)}
          onNext={() => setOffset(offset + JOURNEY_LIST_LIMIT)}
          onPrev={() => setOffset(Math.max(0, offset - JOURNEY_LIST_LIMIT))}
        />
        <ControlSeparator />
        <TabSelect
          items={Object.values(ListTab)}
          selected={list}
          onChangeSelected={(item) => onSelectList(item as ListTab)}
        />
      </div>

      {list === ListTab.Errors && (
        <StepList
          status={demo ? "success" : (errorsQuery?.status ?? "pending")}
          data={errors}
          error={errorsQuery?.error}
          isFetching={errorsQuery?.isFetching}
          offset={offsets[ListTab.Errors]}
          noun="errors"
          tableClassName="max-lg:min-w-125"
          icon={AlertTriangle}
          columns={3}
          header={
            <>
              <TableHead className="w-[70%]">Error</TableHead>
              <TableHead className="w-[15%] text-center">Instances</TableHead>
              <TableHead className="w-[15%] text-right">Users</TableHead>
            </>
          }
        >
          {(error) => {
            const href = linkTo(errorGroupPath(teamId, appId, error), {
              from: ENTRY_POINT,
            });
            const title = errorGroupTitle(error.file_name, error.method_name);
            return (
              <StepRow
                key={`${error.error_type}:${error.severity}:${error.id}`}
                href={href}
                label={title}
                titleClassName="w-[70%]"
                title={
                  <>
                    <p className="truncate">{title}</p>
                    <p className="text-xs truncate text-muted-foreground mt-0.5">
                      {[error.type, error.message]
                        .filter((part) => part !== "")
                        .join(":")}
                    </p>
                    <ErrorPills error={error} />
                  </>
                }
              >
                <CountCell
                  href={href}
                  className="w-[15%]"
                  count={error.count}
                />
                <CountCell
                  href={href}
                  className="w-[15%] text-right"
                  count={error.users}
                />
              </StepRow>
            );
          }}
        </StepList>
      )}

      {list === ListTab.Traces && (
        <StepList
          status={demo ? "success" : (tracesQuery?.status ?? "pending")}
          data={traces}
          error={tracesQuery?.error}
          isFetching={tracesQuery?.isFetching}
          offset={offsets[ListTab.Traces]}
          noun="traces"
          tableClassName="max-lg:min-w-125"
          icon={Timer}
          columns={4}
          header={
            <>
              <TableHead className="w-[55%]">Trace</TableHead>
              <TableHead className="w-[15%] text-center">Instances</TableHead>
              <TableHead className="w-[15%] text-center">Users</TableHead>
              <TableHead className="w-[15%] text-right">
                Duration ({quantile})
              </TableHead>
            </>
          }
        >
          {(trace) => {
            const href = linkTo(`/${teamId}/traces`, {
              [urlFiltersKeyMap.appId]: appId,
              [urlFiltersKeyMap.rootSpanName]: trace.span_name,
            });
            return (
              <StepRow
                key={trace.span_name}
                href={href}
                label={trace.span_name}
                titleClassName="w-[55%]"
                title={<p className="truncate">{trace.span_name}</p>}
              >
                <CountCell
                  href={href}
                  className="w-[15%]"
                  count={trace.count}
                />
                <CountCell
                  href={href}
                  className="w-[15%]"
                  count={trace.users}
                />
                <DurationCell
                  href={href}
                  className="w-[15%]"
                  ms={trace.duration_ms}
                />
              </StepRow>
            );
          }}
        </StepList>
      )}

      {list === ListTab.Network && (
        <StepList
          status={demo ? "success" : (networkQuery?.status ?? "pending")}
          data={network}
          error={networkQuery?.error}
          isFetching={networkQuery?.isFetching}
          offset={offsets[ListTab.Network]}
          noun="network requests"
          tableClassName="max-lg:min-w-125"
          icon={Globe}
          columns={4}
          header={
            <>
              <TableHead className="w-[55%]">Endpoint</TableHead>
              <TableHead className="w-[15%] text-center">Requests</TableHead>
              <TableHead className="w-[15%] text-center">Users</TableHead>
              <TableHead className="w-[15%] text-right">
                Latency ({quantile})
              </TableHead>
            </>
          }
        >
          {(endpoint) => {
            const name = `${endpoint.domain}${endpoint.path_pattern}`;
            const href = linkTo(`/${teamId}/network/details`, {
              [urlFiltersKeyMap.appId]: appId,
              domain: endpoint.domain,
              path: endpoint.path_pattern,
              from: ENTRY_POINT,
            });
            return (
              <StepRow
                key={name}
                href={href}
                label={name}
                titleClassName="w-[55%] max-w-0"
                title={
                  <p className="truncate font-mono" title={name}>
                    {name}
                  </p>
                }
              >
                <CountCell
                  href={href}
                  className="w-[15%]"
                  count={endpoint.count}
                />
                <CountCell
                  href={href}
                  className="w-[15%]"
                  count={endpoint.users}
                />
                <DurationCell
                  href={href}
                  className="w-[15%]"
                  ms={endpoint.latency_ms}
                />
              </StepRow>
            );
          }}
        </StepList>
      )}

      {list === ListTab.SessionReplays && (
        <StepList
          status={demo ? "success" : (sessionsQuery?.status ?? "pending")}
          data={sessions}
          error={sessionsQuery?.error}
          isFetching={sessionsQuery?.isFetching}
          offset={offsets[ListTab.SessionReplays]}
          noun="session replays"
          tableClassName="max-lg:min-w-140"
          icon={Video}
          columns={3}
          header={
            <>
              <TableHead className="w-[60%]">
                User ID / Installation ID
              </TableHead>
              <TableHead className="w-[20%] text-center">Start Time</TableHead>
              <TableHead className="w-[20%] text-right">Duration</TableHead>
            </>
          }
        >
          {(session) => {
            const href = demo
              ? undefined
              : `/${teamId}/session_replays/${appId}/${session.session_id}?from=${ENTRY_POINT}`;
            return (
              <StepRow
                key={session.session_id}
                href={href}
                label={`Session ID: ${session.session_id}`}
                titleClassName="w-[60%] max-w-0"
                title={
                  session.user_id ? (
                    <>
                      <p className="truncate">{session.user_id}</p>
                      <div className="py-1" />
                      <p className="text-xs truncate text-muted-foreground">
                        {session.installation_id}
                      </p>
                    </>
                  ) : (
                    <p className="truncate">{session.installation_id}</p>
                  )
                }
              >
                <StepCell href={href} className="w-[20%] text-center">
                  <p className="truncate">
                    {formatDateToHumanReadableDate(session.first_event_time)}
                  </p>
                  <div className="py-1" />
                  <p className="text-xs truncate">
                    {formatDateToHumanReadableTime(session.first_event_time)}
                  </p>
                </StepCell>
                <StepCell href={href} className="w-[20%] text-right">
                  {session.duration === 0
                    ? "N/A"
                    : formatMillisToHumanReadable(session.duration)}
                </StepCell>
              </StepRow>
            );
          }}
        </StepList>
      )}
    </div>
  );
}
