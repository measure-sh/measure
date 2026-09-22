import { catalog, dailyBugReports } from "./catalog";
import type { BugReport } from "./catalog";
import {
  isWithinRange,
  jsonResponse,
  paginate,
  parseRange,
  SandboxRoute,
} from "./query";
import { deviceAttributeBag, matchFraction, matchesFilterExpr } from "./filter";
import { scaledSeries } from "./aggregate";
import { adoptionOf } from "./adoption";

function bugReportAttributes(report: BugReport): Record<string, unknown> {
  return {
    bug_report_status: report.status === 0 ? "open" : "closed",
    bug_report_description: report.description,
    session_id: report.session_id,
    ...deviceAttributeBag(report.attribute),
  };
}

function overviewItemOf(report: BugReport) {
  const { attachments: _attachments, ...rest } = report;
  return { ...rest, attachments: null };
}

export const bugReportsRoutes: SandboxRoute[] = [
  {
    method: "GET",
    path: "/api/apps/:appId/bugReports",
    handle: ({ params, url }) => {
      const bundle = catalog().appById.get(params.appId);
      const range = parseRange(url);
      const filterExpr = url.searchParams.get("filter_expr");
      const items = (bundle?.bugReports ?? [])
        .filter(
          (r) =>
            isWithinRange(r.timestamp, range) &&
            matchesFilterExpr(bugReportAttributes(r), filterExpr),
        )
        .map(overviewItemOf);
      const { items: page, hasNext, hasPrev } = paginate(items, url);
      return jsonResponse({
        meta: { next: hasNext, previous: hasPrev },
        results: page,
      });
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/bugReports/plots/instances",
    handle: ({ params, url }) => {
      const bundle = catalog().appById.get(params.appId);
      if (!bundle) {
        return jsonResponse([]);
      }
      const range = parseRange(url);
      const filterExpr = url.searchParams.get("filter_expr");
      const app = bundle.scenario.app;
      const series = app.versions.flatMap((version) => {
        const sampleForVersion = bundle.bugReports.filter(
          (r) => r.attribute.app_version === version.name,
        );
        const fraction = matchFraction(
          sampleForVersion.length > 0 ? sampleForVersion : bundle.bugReports,
          bugReportAttributes,
          filterExpr,
        );
        const total = dailyBugReports(app) * 30 * fraction;
        if (total === 0) {
          return [];
        }
        return [
          {
            id: `${version.name} (${version.code})`,
            data: scaledSeries(
              range,
              total,
              bundle.dataStart,
              `bugreports:${bundle.app.id}:${version.name}`,
              bundle.app.id,
              adoptionOf(bundle.releases, [version.name]),
            ),
          },
        ];
      });
      return jsonResponse(series);
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/bugReports/:id",
    handle: ({ params }) => {
      const bundle = catalog().appById.get(params.appId);
      const report = bundle?.bugReports.find((r) => r.event_id === params.id);
      if (!report) {
        return jsonResponse({ error: "Bug report not found" }, 404);
      }
      return jsonResponse({
        ...report,
        user_defined_attribute: report.user_defined_attribute,
      });
    },
  },
  {
    method: "PATCH",
    path: "/api/apps/:appId/bugReports/:id",
    handle: () => jsonResponse({ ok: true }),
  },
];
