"use client";

import { filterExprIssuesIn } from "@/app/api/api_error";
import FilterBar from "@/app/components/filter_bar/filter_bar";
import { useFilterPage } from "@/app/components/filter_bar/use_filter_page";
import {
  RootSpanMetricsQuantile,
  useAuthzAndMembersQuery,
  useDeleteFunnelMutation,
  useFunnelConversionQuery,
  useFunnelCadenceQuery,
  useFunnelQuery,
  useFunnelTrendQuery,
} from "@/app/query/hooks";
import { track } from "@/app/utils/analytics/track";
import { Funnel as FunnelIcon, Pencil, Trash2 } from "lucide-react";
import { DateTime } from "luxon";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type {
  Funnel,
  FunnelConversion,
  FunnelCadence,
  FunnelTrend,
  FunnelTrendPeriod,
} from "../../api/api_calls";
import {
  cadenceHourRange,
  formatConversionWindow,
  formatShare,
  trendPeriodRange,
} from "./format";
import { numberToKMB } from "../../utils/number_utils";
import { formatDateToHumanReadableDateTime } from "../../utils/time_utils";
import { Button } from "../button";
import DangerConfirmationDialog from "../danger_confirmation_dialog";
import EmptyState from "../empty_state";
import { DateRange } from "../filter_bar/date_range_select";
import FunnelChart from "./chart";
import {
  appPlatform,
  type FrictionItemTarget,
  funnelEventProps,
  stepProp,
} from "./analytics";
import FunnelEditor from "./editor";
import {
  demoCadences,
  demoConversion,
  demoFunnel,
  demoStepErrors,
  demoStepNetwork,
  demoStepTraces,
  demoTrends,
} from "./demo_data";
import FunnelFriction, {
  ControlSeparator,
  FRICTION_FIRST_PAGES,
  FrictionHeading,
  FrictionList,
  FrictionListsView,
} from "./friction";
import FunnelCadencePlot from "./cadence_plot";
import FunnelSessions, { outcomeParams, SessionsOutcome } from "./sessions";
import FunnelSteps from "./steps";
import FunnelTrendPlot, { FunnelTrendMetric } from "./trend_plot";
import Pill from "../pill";
import SimpleTooltip from "../simple_tooltip";
import { Skeleton, SkeletonPlot } from "../skeleton";
import TabSelect from "../tab_select";
import { toastNegative, toastPositive } from "../toast";

const viewUrlKey = "fv";
const periodUrlKey = "fp";
const metricUrlKey = "fm";
const stepUrlKey = "fs";
const overallStep = "overall";
const listUrlKey = "fl";
const outcomeUrlKey = "fo";
const weeksUrlKey = "fw";

enum FunnelView {
  Breakdown = "Breakdown",
  Trend = "Trend",
  Cadence = "Cadence",
}

const PERIODS: { label: string; period: FunnelTrendPeriod }[] = [
  { label: "Daily", period: "day" },
  { label: "Weekly", period: "week" },
  { label: "Monthly", period: "month" },
];
const DEFAULT_PERIOD = PERIODS[1];

const CADENCE_SPANS = [
  { label: "1 week", weeks: 1 },
  { label: "4 weeks", weeks: 4 },
  { label: "12 weeks", weeks: 12 },
];
const DEFAULT_CADENCE_SPAN = CADENCE_SPANS[1];

function enumFromUrl<T extends string>(
  values: T[],
  value: string | null,
  fallback: T,
): T {
  return values.find((v) => v === value) ?? fallback;
}

function formatConversion(entered: number, converted: number): string {
  return `${formatShare(converted, entered)} converted · ${numberToKMB(converted)} of ${numberToKMB(entered)} users`;
}

function conversionSummary(conversion: FunnelConversion): string {
  const { steps } = conversion;
  return formatConversion(steps[0].users, steps[steps.length - 1].users);
}

// Adds up every period of the trend, so the figure covers its whole span.
function trendSummary(trend: FunnelTrend): string {
  const total = (users: (point: FunnelTrend["points"][number]) => number) =>
    trend.points.reduce((sum, point) => sum + users(point), 0);
  return formatConversion(
    total((point) => point.steps[0].users),
    total((point) => point.steps[point.steps.length - 1].users),
  );
}

function cadenceSummary(hours: FunnelCadence): string {
  return formatConversion(
    hours.hours.reduce((sum, cell) => sum + cell.users, 0),
    hours.hours.reduce((sum, cell) => sum + cell.converted, 0),
  );
}

function FunnelHeader({
  funnel,
  actions,
}: {
  funnel: Funnel | undefined;
  // The demo leaves these out, since it has no funnel to edit or delete.
  actions?: {
    canChange: boolean;
    deleting: boolean;
    onEdit: () => void;
    onDelete: () => void;
  };
}) {
  if (funnel === undefined) {
    return (
      <div className="flex flex-col gap-3 w-full">
        <Skeleton className="h-9 w-56" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6.5 w-144 max-w-full rounded-full" />
          <Skeleton className="h-6.5 w-40 rounded-full" />
          <Skeleton className="h-6.5 w-48 rounded-full" />
          <Skeleton className="h-6.5 w-52 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex flex-wrap w-full items-center justify-between gap-2">
        <p className="font-display text-2xl truncate min-w-0">{funnel.name}</p>
        {actions && (
          <div className="flex flex-row gap-2">
            <SimpleTooltip content="Edit funnel" align="end">
              <Button
                variant="outline"
                size="icon"
                aria-label="Edit funnel"
                disabled={!actions.canChange}
                onClick={actions.onEdit}
              >
                <Pencil />
              </Button>
            </SimpleTooltip>
            <SimpleTooltip content="Delete funnel" align="end">
              <Button
                variant="outline"
                size="icon"
                aria-label="Delete funnel"
                disabled={!actions.canChange}
                loading={actions.deleting}
                onClick={actions.onDelete}
              >
                <Trash2 />
              </Button>
            </SimpleTooltip>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <FunnelSteps funnel={funnel} />
        <Pill tooltip>
          {`Conversion window: ${formatConversionWindow(funnel.conversion_window_seconds)}`}
        </Pill>
        <Pill tooltip>
          {`Created by: ${funnel.created_by_email ?? "Deleted user"}`}
        </Pill>
        <Pill tooltip>
          {`Updated: ${formatDateToHumanReadableDateTime(funnel.updated_at)}`}
        </Pill>
      </div>
    </div>
  );
}

type Period = (typeof PERIODS)[number];
type CadenceSpan = (typeof CADENCE_SPANS)[number];

function FunnelViewHeader({
  view,
  onSelectView,
  metric,
  onSelectMetric,
  period,
  onSelectPeriod,
  cadenceSpan,
  onSelectCadenceSpan,
  summary,
}: {
  view: FunnelView;
  onSelectView: (view: FunnelView) => void;
  metric: FunnelTrendMetric;
  onSelectMetric: (metric: FunnelTrendMetric) => void;
  period: Period;
  onSelectPeriod: (period: Period) => void;
  cadenceSpan: CadenceSpan;
  onSelectCadenceSpan: (span: CadenceSpan) => void;
  summary: string | undefined;
}) {
  return (
    <>
      <div className="flex flex-wrap w-full items-center justify-between gap-4">
        <p className="font-display text-xl whitespace-nowrap">{view}</p>
        <div className="flex items-center gap-2 whitespace-nowrap">
          {view === FunnelView.Trend && (
            <>
              <TabSelect
                items={Object.values(FunnelTrendMetric)}
                selected={metric}
                onChangeSelected={(item) =>
                  onSelectMetric(item as FunnelTrendMetric)
                }
              />
              <ControlSeparator />
              <TabSelect
                items={PERIODS.map((p) => p.label)}
                selected={period.label}
                onChangeSelected={(label) =>
                  onSelectPeriod(PERIODS.find((p) => p.label === label)!)
                }
              />
              <ControlSeparator />
            </>
          )}
          {view === FunnelView.Cadence && (
            <>
              <TabSelect
                items={CADENCE_SPANS.map((span) => span.label)}
                selected={cadenceSpan.label}
                onChangeSelected={(label) =>
                  onSelectCadenceSpan(
                    CADENCE_SPANS.find((span) => span.label === label)!,
                  )
                }
              />
              <ControlSeparator />
            </>
          )}
          <TabSelect
            items={Object.values(FunnelView)}
            selected={view}
            onChangeSelected={(item) => onSelectView(item as FunnelView)}
          />
        </div>
      </div>
      <p className="font-body text-sm text-muted-foreground">
        {summary ?? " "}
      </p>
    </>
  );
}

function demoQuery<Data>(data: Data) {
  return { data, status: "success" as const, isFetching: false };
}

export function FunnelDetailsDemo({
  hideTitle = false,
}: {
  hideTitle?: boolean;
}) {
  const [view, setView] = useState(FunnelView.Breakdown);
  const [metric, setMetric] = useState(FunnelTrendMetric.Conversion);
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [cadenceSpan, setCadenceSpan] =
    useState<CadenceSpan>(DEFAULT_CADENCE_SPAN);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [list, setList] = useState(FrictionList.Errors);
  const [quantile, setQuantile] = useState(RootSpanMetricsQuantile.p50);
  const [offsets, setOffsets] = useState(FRICTION_FIRST_PAGES);

  const trend = demoTrends[period.period];
  const cadence = demoCadences[cadenceSpan.weeks];

  // The chart passes 0 for the first step, which no users move into, so it
  // selects the whole funnel as it does on the dashboard.
  const selectStep = (step: number | null) => {
    setSelectedStep(step !== null && step >= 1 ? step : null);
    setOffsets(FRICTION_FIRST_PAGES);
  };

  const openInBreakdown = (step: number | null) => {
    selectStep(step);
    setView(FunnelView.Breakdown);
  };

  return (
    <div className="flex flex-col items-start w-full">
      <p className="font-display text-4xl max-w-6xl text-center">
        {hideTitle ? "" : "Funnels"}
      </p>
      {!hideTitle && <div className="py-4" />}
      <FunnelHeader funnel={demoFunnel} />
      <div className="py-6" />
      <div className="w-full">
        <FunnelViewHeader
          view={view}
          onSelectView={setView}
          metric={metric}
          onSelectMetric={setMetric}
          period={period}
          onSelectPeriod={setPeriod}
          cadenceSpan={cadenceSpan}
          onSelectCadenceSpan={setCadenceSpan}
          summary={
            view === FunnelView.Breakdown
              ? conversionSummary(demoConversion)
              : view === FunnelView.Trend
                ? trendSummary(trend)
                : cadenceSummary(cadence)
          }
        />
        <div className="py-2" />
        {view === FunnelView.Breakdown && (
          <FunnelChart conversion={demoConversion} onSelectStep={selectStep} />
        )}
        {view === FunnelView.Trend && (
          <FunnelTrendPlot
            period={period.period}
            metric={metric}
            status="success"
            trend={trend}
            onSelectPoint={(_, step) => openInBreakdown(step)}
          />
        )}
        {view === FunnelView.Cadence && (
          <FunnelCadencePlot
            status="success"
            hours={cadence}
            onSelectPoint={() => openInBreakdown(null)}
          />
        )}
      </div>
      {view === FunnelView.Breakdown && (
        <>
          <div className="py-8" />
          <div className="w-full font-body">
            <FrictionHeading />
            <FrictionListsView
              teamId="demo-team"
              appId={demoFunnel.app_id}
              demo
              conversion={demoConversion}
              selectedStep={selectedStep}
              onSelectStep={selectStep}
              list={list}
              onSelectList={setList}
              quantile={quantile}
              onSelectQuantile={setQuantile}
              errorsQuery={demoQuery(
                demoStepErrors(selectedStep, offsets[FrictionList.Errors]),
              )}
              tracesQuery={demoQuery(
                demoStepTraces(
                  selectedStep,
                  quantile,
                  offsets[FrictionList.Traces],
                ),
              )}
              networkQuery={demoQuery(
                demoStepNetwork(
                  selectedStep,
                  quantile,
                  offsets[FrictionList.Network],
                ),
              )}
              offsets={offsets}
              onChangeOffset={(list, offset) =>
                setOffsets((offsets) => ({ ...offsets, [list]: offset }))
              }
            />
          </div>
        </>
      )}
    </div>
  );
}

export default function FunnelDetails({
  teamId,
  appId,
  funnelId,
}: {
  teamId: string;
  appId: string;
  funnelId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const funnelQuery = useFunnelQuery(appId, funnelId);
  const funnel = funnelQuery.data;
  const deleteFunnel = useDeleteFunnelMutation();
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { data: authzAndMembers } = useAuthzAndMembersQuery(teamId);

  const view = enumFromUrl(
    Object.values(FunnelView),
    searchParams.get(viewUrlKey),
    FunnelView.Breakdown,
  );
  const period =
    PERIODS.find((p) => p.period === searchParams.get(periodUrlKey)) ??
    DEFAULT_PERIOD;
  const cadenceSpan =
    CADENCE_SPANS.find(
      (span) => String(span.weeks) === searchParams.get(weeksUrlKey),
    ) ?? DEFAULT_CADENCE_SPAN;
  const metric = enumFromUrl(
    Object.values(FunnelTrendMetric),
    searchParams.get(metricUrlKey),
    FunnelTrendMetric.Conversion,
  );
  const list = enumFromUrl(
    Object.values(FrictionList),
    searchParams.get(listUrlKey),
    FrictionList.Errors,
  );
  const outcome = enumFromUrl(
    Object.values(SessionsOutcome),
    searchParams.get(outcomeUrlKey),
    SessionsOutcome.Dropped,
  );

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
  } = useFilterPage({ teamId, entity: "funnels", appId });
  const platform = appPlatform(apps, appId);
  const entryPoint = searchParams.get("from") ?? "direct";
  const viewReady =
    funnel !== undefined && apps.some((app) => app.id === appId);

  // The dependencies leave out the funnel and the apps list, whose objects
  // change on every refetch, so the view is tracked once, when both have
  // loaded.
  useEffect(() => {
    if (!viewReady) {
      return;
    }
    track(
      "funnel_investigated",
      funnelEventProps({ teamId, appId, platform, entryPoint }),
    );
  }, [viewReady, teamId, appId, funnelId, platform, entryPoint]);

  const conversionQuery = useFunnelConversionQuery(
    filterParams,
    funnelId,
    view === FunnelView.Breakdown,
  );
  // The step users move into, or null for the whole funnel, which is
  // selected until the URL specifies a step.
  const urlStep = Number(searchParams.get(stepUrlKey));
  // A saved edit changes the funnel's steps straight away, while the
  // conversion keeps the old steps until it is fetched again, so the step must
  // exist in both.
  const stepCount = Math.min(
    funnel?.steps.length ?? 0,
    conversionQuery.data?.steps.length ?? 0,
  );
  const selectedStep =
    Number.isInteger(urlStep) && urlStep >= 1 && urlStep < stepCount
      ? urlStep
      : null;
  const trendQuery = useFunnelTrendQuery(
    filterParams,
    funnelId,
    period.period,
    true,
    view === FunnelView.Trend,
  );
  const cadenceQuery = useFunnelCadenceQuery(
    filterParams,
    funnelId,
    cadenceSpan.weeks,
    view === FunnelView.Cadence,
  );
  const filterExprIssues =
    filterExprIssuesIn(conversionQuery.error) ??
    filterExprIssuesIn(trendQuery.error) ??
    filterExprIssuesIn(cadenceQuery.error);

  // A click in the trend or the cadence sets this ref so the Breakdown view
  // opens at the top of the page. The jump is instant because a smooth scroll
  // stops partway when the lists below load and the page grows.
  const scrollToTopRef = useRef(false);
  useEffect(() => {
    if (view !== FunnelView.Breakdown || !scrollToTopRef.current) {
      return;
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    scrollToTopRef.current = false;
  }, [view]);

  const trackFunnelEvent = (name: string, props?: Record<string, unknown>) =>
    track(name, {
      ...funnelEventProps({ teamId, appId, platform, entryPoint }),
      ...props,
    });

  const selectStep = (step: number | null) =>
    setPageUrlKey(stepUrlKey, step === null ? overallStep : String(step));

  const selectStepFrom =
    (source: "chart" | "friction" | "sessions") => (step: number | null) => {
      if (stepProp(step) !== stepProp(selectedStep)) {
        trackFunnelEvent("funnel_step_selected", {
          step: stepProp(step),
          source,
        });
      }
      selectStep(step);
    };

  const trackFrictionItem = (target: FrictionItemTarget) =>
    trackFunnelEvent("funnel_friction_item_clicked", {
      target,
      step: stepProp(selectedStep),
    });

  const trackViewSwitch = (
    section: "view" | "friction" | "sessions",
    current: string,
    selected: string,
  ) => {
    if (selected !== current) {
      trackFunnelEvent("funnel_view_switched", { section, selected });
    }
  };

  const openInBreakdown = (
    start: DateTime,
    end: DateTime,
    step: number | null,
  ) => {
    scrollToTopRef.current = true;
    onChange({
      dateRange: {
        dateRange: DateRange.Custom,
        startDate: start.toISO(),
        endDate: end.toISO(),
      },
    });
    selectStep(step);
    setPageUrlKey(viewUrlKey, FunnelView.Breakdown);
  };

  const handleSelectTrendPoint = (datetime: string, step: number | null) => {
    const { start, end } = trendPeriodRange(datetime, period.period);
    trackFunnelEvent("funnel_chart_point_selected", {
      view: "trend",
      period: period.period,
      metric,
      step: stepProp(step),
    });
    openInBreakdown(start, end, step);
  };

  const handleSelectCadencePoint = (weekday: number, hour: number) => {
    const { start, end } = cadenceHourRange(
      cadenceQuery.data!.to,
      weekday,
      hour,
    );
    trackFunnelEvent("funnel_chart_point_selected", { view: "cadence" });
    openInBreakdown(start, end, null);
  };

  const handleDelete = async () => {
    setDeleteOpen(false);
    try {
      await deleteFunnel.mutateAsync({ appId, funnelId });
      trackFunnelEvent("funnel_deleted");
      toastPositive(`Funnel ${funnel?.name} has been deleted`);
      router.push(`/${teamId}/funnels`);
    } catch (error) {
      toastNegative(
        `Error deleting funnel: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  if (funnelQuery.isError) {
    return (
      <div className="flex flex-col items-start w-full">
        <div className="py-4" />
        <p className="font-body text-sm">
          Error fetching funnel, please refresh page to try again
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start w-full">
      <div className="py-4" />
      <FunnelHeader
        funnel={funnel}
        actions={{
          canChange: authzAndMembers?.can_change_funnels === true,
          deleting: deleteFunnel.isPending,
          onEdit: () => setEditorOpen(true),
          onDelete: () => setDeleteOpen(true),
        }}
      />
      <div className="py-4" />
      <FilterBar
        entity="funnels"
        teamId={teamId}
        placeholder="Filter funnel…"
        value={value}
        apps={apps}
        keys={keys}
        keyGroups={keyGroups}
        keysUnavailable={keysUnavailable}
        filterExprIssues={filterExprIssues}
        showAppSelect={false}
        showDateRange={view === FunnelView.Breakdown}
        status={filterStatus}
        onChange={onChange}
      />
      <div className="py-4" />

      {filterStatus.kind === "error" && (
        <p className="text-lg font-display">{filterStatus.message}</p>
      )}

      {filterStatus.kind !== "error" && (
        <>
          <div className="w-full">
            <FunnelViewHeader
              view={view}
              onSelectView={(selected) => {
                trackViewSwitch(
                  "view",
                  view.toLowerCase(),
                  selected.toLowerCase(),
                );
                setPageUrlKey(viewUrlKey, selected);
              }}
              metric={metric}
              onSelectMetric={(metric) => setPageUrlKey(metricUrlKey, metric)}
              period={period}
              onSelectPeriod={(period) =>
                setPageUrlKey(periodUrlKey, period.period)
              }
              cadenceSpan={cadenceSpan}
              onSelectCadenceSpan={(span) =>
                setPageUrlKey(weeksUrlKey, String(span.weeks))
              }
              summary={
                view === FunnelView.Breakdown
                  ? conversionQuery.data &&
                    conversionQuery.data.steps[0].users > 0
                    ? conversionSummary(conversionQuery.data)
                    : undefined
                  : view === FunnelView.Trend
                    ? trendQuery.data &&
                      trendQuery.data.points.some((p) => p.steps[0].users > 0)
                      ? trendSummary(trendQuery.data)
                      : undefined
                    : cadenceQuery.data && cadenceQuery.data.hours.length > 0
                      ? cadenceSummary(cadenceQuery.data)
                      : undefined
              }
            />
            <div className="py-2" />

            {view === FunnelView.Breakdown && (
              <>
                {conversionQuery.isPending && (
                  <div className="flex font-body items-center justify-center w-full h-72">
                    <SkeletonPlot />
                  </div>
                )}
                {conversionQuery.isError && filterExprIssues === null && (
                  <div className="flex font-body items-center justify-center w-full h-72">
                    <p className="text-lg font-display text-center p-4">
                      Error fetching plot, please change filters or refresh page
                      to try again
                    </p>
                  </div>
                )}
                {conversionQuery.data?.steps[0].users === 0 && (
                  <EmptyState
                    icon={FunnelIcon}
                    title="No users entered this funnel"
                    description="Try different filters"
                    className="h-144"
                  />
                )}
                {conversionQuery.data &&
                  conversionQuery.data.steps[0].users > 0 && (
                    <FunnelChart
                      conversion={conversionQuery.data}
                      onSelectStep={selectStepFrom("chart")}
                    />
                  )}
              </>
            )}

            {view === FunnelView.Trend && (
              <FunnelTrendPlot
                period={period.period}
                metric={metric}
                status={funnel ? trendQuery.status : "pending"}
                trend={trendQuery.data}
                onSelectPoint={handleSelectTrendPoint}
              />
            )}

            {view === FunnelView.Cadence && (
              <FunnelCadencePlot
                status={funnel ? cadenceQuery.status : "pending"}
                hours={cadenceQuery.data}
                onSelectPoint={handleSelectCadencePoint}
              />
            )}
          </div>

          {view === FunnelView.Breakdown && (
            <>
              <div className="py-8" />
              <FunnelFriction
                teamId={teamId}
                funnelId={funnelId}
                params={filterParams}
                conversion={conversionQuery.data}
                conversionFailed={conversionQuery.isError}
                selectedStep={selectedStep}
                onSelectStep={selectStepFrom("friction")}
                list={list}
                onSelectList={(selected) => {
                  trackViewSwitch(
                    "friction",
                    list.toLowerCase(),
                    selected.toLowerCase(),
                  );
                  setPageUrlKey(listUrlKey, selected);
                }}
                onOpenItem={trackFrictionItem}
              />
              <div className="py-8" />
              <FunnelSessions
                teamId={teamId}
                funnelId={funnelId}
                params={filterParams}
                conversion={conversionQuery.data}
                conversionFailed={conversionQuery.isError}
                selectedStep={selectedStep}
                onSelectStep={selectStepFrom("sessions")}
                onOpenSession={() => trackFrictionItem("session")}
                outcome={outcome}
                onSelectOutcome={(selected) => {
                  trackViewSwitch(
                    "sessions",
                    outcomeParams[outcome],
                    outcomeParams[selected],
                  );
                  setPageUrlKey(outcomeUrlKey, selected);
                }}
              />
            </>
          )}
        </>
      )}

      {funnel !== undefined && (
        <>
          <FunnelEditor
            appId={appId}
            funnel={funnel}
            open={editorOpen}
            onOpenChange={setEditorOpen}
            onSaved={() => trackFunnelEvent("funnel_edited")}
          />
          <DangerConfirmationDialog
            body={
              <p className="font-body">
                Delete funnel{" "}
                <span className="font-display">{funnel.name}</span>? This cannot
                be undone.
              </p>
            }
            open={deleteOpen}
            affirmativeText="Delete funnel"
            cancelText="Cancel"
            onAffirmativeAction={handleDelete}
            onCancelAction={() => setDeleteOpen(false)}
          />
        </>
      )}
    </div>
  );
}
