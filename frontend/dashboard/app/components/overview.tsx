"use client";

import { defaultAppThresholdPrefs, emptyMetrics } from "@/app/api/api_calls";
import { filterExprIssuesIn } from "@/app/api/api_error";
import AppHealthPlot, { demoPlot } from "@/app/components/app_health_plot";
import FilterBar from "@/app/components/filter_bar/filter_bar";
import { useExprFilterPage } from "@/app/components/filter_bar/use_expr_filter_page";
import MetricsOverview, {
  demoMetrics,
} from "@/app/components/metrics_overview";
import { SkeletonListPage } from "@/app/components/skeleton";
import {
  useAppHealthPlotQuery,
  useAppThresholdPrefsQuery,
  useMetricsQuery,
} from "@/app/query/hooks";

export function OverviewDemo({ hideTitle = false }: { hideTitle?: boolean }) {
  return (
    <div className="flex flex-col items-start">
      <p className="font-display text-4xl max-w-6xl text-center">
        {hideTitle ? "" : "App Health"}
      </p>
      {!hideTitle && <div className="py-4" />}
      <div className="py-8" />

      <AppHealthPlot status="success" plot={demoPlot} startDate="" endDate="" />
      <div className="py-8" />
      <MetricsOverview
        status="success"
        metrics={demoMetrics}
        appThresholdPrefs={defaultAppThresholdPrefs}
        gapClassName="gap-x-12 gap-y-16"
      />
    </div>
  );
}

export default function Overview({ params }: { params: { teamId: string } }) {
  const { teamId } = params;
  const {
    value,
    apps,
    keys,
    keyGroups,
    keysUnavailable,
    status: filterStatus,
    filterParams,
    onChange,
  } = useExprFilterPage({ teamId, entity: "app_health" });
  const readyValue = filterStatus.kind === "ready" ? value : null;

  const metricsQuery = useMetricsQuery(filterParams);
  const healthPlotQuery = useAppHealthPlotQuery(filterParams);
  const thresholdPrefsQuery = useAppThresholdPrefsQuery(readyValue?.app.id);

  const filterExprIssues =
    filterExprIssuesIn(metricsQuery.error) ??
    filterExprIssuesIn(healthPlotQuery.error);

  const metrics = metricsQuery.data ?? emptyMetrics;
  const appThresholdPrefs =
    thresholdPrefsQuery.data ?? defaultAppThresholdPrefs;

  return (
    <div className="flex flex-col items-start">
      <div className="py-4" />

      <FilterBar
        entity="app_health"
        placeholder="Filter by app version…"
        value={value}
        apps={apps}
        keys={keys}
        keyGroups={keyGroups}
        keysUnavailable={keysUnavailable}
        filterExprIssues={filterExprIssues}
        onChange={onChange}
      />

      {filterStatus.kind === "error" && (
        <>
          <div className="py-4" />
          <p className="text-lg font-display">{filterStatus.message}</p>
        </>
      )}

      {filterStatus.kind === "loading" && (
        <>
          <div className="py-4" />
          <SkeletonListPage />
        </>
      )}

      {readyValue !== null && (
        <>
          <div className="py-8" />
          <AppHealthPlot
            status={healthPlotQuery.status}
            plot={healthPlotQuery.data}
            startDate={readyValue.date.startDate}
            endDate={readyValue.date.endDate}
          />
          <div className="py-8" />
          <MetricsOverview
            status={metricsQuery.status}
            metrics={metrics}
            appThresholdPrefs={appThresholdPrefs}
          />
        </>
      )}
    </div>
  );
}
