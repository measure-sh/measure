import { catalog, percentile } from "./catalog";
import type { AppBundle, SessionAttribute, SpanListRow } from "./catalog";
import {
  bucketsForRange,
  formatBucket,
  isWithinRange,
  jsonResponse,
  paginate,
  parseRange,
  SandboxRoute,
} from "./query";
import { smoothScales } from "./aggregate";
import { shareAt } from "./adoption";
import { countryOf, matchesFilterExpr } from "./filter";

function spanAttributes(
  row: SpanListRow,
  session: SessionAttribute | undefined,
): Record<string, unknown> {
  return {
    span_status: row.status === 2 ? "error" : row.status === 0 ? "unset" : "ok",
    version_name: row.app_version,
    version_code: row.app_build,
    os_name: row.os_name,
    os_version: row.os_version,
    device_manufacturer: row.device_manufacturer,
    device_name: session?.device_name,
    locale: session?.device_locale,
    country: session ? countryOf(session.device_locale) : undefined,
    network_type: session?.network_type,
    network_generation: session?.network_generation,
    network_provider: session?.network_provider,
  };
}

function sessionAttributeForSpan(
  bundle: AppBundle | undefined,
  row: SpanListRow,
): SessionAttribute | undefined {
  const sessionId = bundle?.traces.get(row.trace_id)?.session_id;
  return bundle?.sessions.find((s) => s.list.session_id === sessionId)?.detail
    .attribute;
}

export const tracesRoutes: SandboxRoute[] = [
  {
    method: "GET",
    path: "/api/apps/:appId/spans/plots/metrics",
    handle: ({ params, url }) => {
      const bundle = catalog().appById.get(params.appId);
      const spanName = url.searchParams.get("span_name") ?? "";
      const filterExpr = url.searchParams.get("filter_expr");
      const matching = (bundle?.spanRows ?? []).filter(
        (row) =>
          row.span_name === spanName &&
          matchesFilterExpr(
            spanAttributes(row, sessionAttributeForSpan(bundle, row)),
            filterExpr,
          ),
      );
      if (matching.length === 0) {
        return jsonResponse([]);
      }
      const range = parseRange(url);
      const buckets = bucketsForRange(range);
      const unit =
        range.group === "minutes"
          ? "minute"
          : range.group === "hours"
            ? "hour"
            : range.group === "months"
              ? "month"
              : "day";
      const series = (bundle?.scenario.app.versions ?? []).flatMap(
        (version, index) => {
          const durations = matching
            .filter(
              (row) =>
                row.app_version === version.name &&
                row.app_build === version.code,
            )
            .map((row) => row.duration);
          if (durations.length === 0) {
            return [];
          }
          const scales = smoothScales(
            `span:${params.appId}:${spanName}:${version.name}`,
            buckets.length,
            0.11,
          );
          // A version has readings only from the buckets it ran in.
          const data = buckets.flatMap((bucket, i) => {
            const bucketEnd = bucket.plus({ [unit]: 1 });
            if (shareAt(bundle!.releases, index, bucketEnd) < 0.01) {
              return [];
            }
            const scaled = durations
              .map((d) => Math.round(d * scales[i]))
              .sort((a, b) => a - b);
            return [
              {
                datetime: formatBucket(bucket, range.group),
                p50: percentile(scaled, 50),
                p90: percentile(scaled, 90),
                p95: percentile(scaled, 95),
                p99: percentile(scaled, 99),
              },
            ];
          });
          return data.length === 0
            ? []
            : [{ id: `${version.name} (${version.code})`, data }];
        },
      );
      return jsonResponse(series);
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/spans",
    handle: ({ params, url }) => {
      const bundle = catalog().appById.get(params.appId);
      const spanName = url.searchParams.get("span_name") ?? "";
      const range = parseRange(url);
      const filterExpr = url.searchParams.get("filter_expr");
      const matching = (bundle?.spanRows ?? [])
        .filter(
          (row) =>
            row.span_name === spanName &&
            isWithinRange(row.start_time, range) &&
            matchesFilterExpr(
              spanAttributes(row, sessionAttributeForSpan(bundle, row)),
              filterExpr,
            ),
        )
        .sort((a, b) => (a.start_time < b.start_time ? 1 : -1));
      const { items, hasNext, hasPrev } = paginate(matching, url);
      return jsonResponse({
        meta: { next: hasNext, previous: hasPrev },
        results: items,
      });
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/traces/:traceId",
    handle: ({ params }) => {
      const bundle = catalog().appById.get(params.appId);
      const trace = bundle?.traces.get(params.traceId);
      if (!trace) {
        return jsonResponse({ error: "Trace not found" }, 404);
      }
      return jsonResponse(trace);
    },
  },
];
