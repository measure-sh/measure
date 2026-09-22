import { catalog, percentile } from "./catalog";
import type { HttpSample, NetworkEndpointStats } from "./catalog";
import { jsonResponse, parseRange, SandboxRoute } from "./query";
import { deviceAttributeBag, matchFraction, matchesFilterExpr } from "./filter";
import {
  drawCounts,
  scaledSeries,
  smoothScales,
  windowCoverage,
} from "./aggregate";

function sampleAttributes(sample: HttpSample): Record<string, unknown> {
  const { user_id: _userId, ...rest } = deviceAttributeBag(sample.attribute);
  return { http_method: sample.method, ...rest };
}

function matchingSamples(
  appId: string,
  domain: string,
  path: string,
  filterExpr: string | null,
): HttpSample[] {
  const bundle = catalog().appById.get(appId);
  return (bundle?.httpSamples ?? []).filter(
    (s) =>
      (domain === "" || s.domain === domain) &&
      (path === "" || s.path === path) &&
      matchesFilterExpr(sampleAttributes(s), filterExpr),
  );
}

type Outcomes = NetworkEndpointStats["outcomes"];

// A request that never got a response is recorded as code 0, and the backend
// leaves it out of every status code count and total, so shares are taken
// over the answered requests.
function answered(outcomes: Outcomes): Outcomes {
  return outcomes.filter((o) => o.code !== 0);
}

function weightShare(outcomes: Outcomes, min: number, max: number): number {
  const total = outcomes.reduce((sum, o) => sum + o.weight, 0);
  if (total <= 0) {
    return 0;
  }
  const inRange = outcomes
    .filter((o) => o.code >= min && o.code <= max)
    .reduce((sum, o) => sum + o.weight, 0);
  return inRange / total;
}

function answeredDailyRequests(stats: NetworkEndpointStats): number {
  return stats.dailyRequests * (1 - weightShare(stats.outcomes, 0, 0));
}

function codeWobbles(seed: string, codes: number[], count: number): number[][] {
  return codes.map((code) =>
    smoothScales(
      `${seed}:${code}`,
      count,
      code >= 200 && code <= 299 ? 0.05 : 0.4,
    ),
  );
}

export const networkRoutes: SandboxRoute[] = [
  {
    method: "GET",
    path: "/api/apps/:appId/networkRequests/endpoints",
    handle: ({ params, url }) => {
      const query = (url.searchParams.get("query") ?? "").toLowerCase();
      const filterExpr = url.searchParams.get("filter_expr");
      const samples = matchingSamples(params.appId, "", "", filterExpr);
      const seen = new Set<string>();
      const results: { domain: string; path_pattern: string }[] = [];
      for (const sample of samples) {
        const key = `${sample.domain}${sample.path}`;
        if (
          seen.has(key) ||
          (query !== "" && !key.toLowerCase().includes(query))
        ) {
          continue;
        }
        seen.add(key);
        results.push({ domain: sample.domain, path_pattern: sample.path });
      }
      return jsonResponse({ results });
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/networkRequests/plots/latency",
    handle: ({ params, url }) => {
      const domain = url.searchParams.get("domain") ?? "";
      const path = url.searchParams.get("path") ?? "";
      const filterExpr = url.searchParams.get("filter_expr");
      const bundle = catalog().appById.get(params.appId);
      const stats = bundle?.networkEndpoints.get(`${domain}|${path}`);
      const unfiltered = matchingSamples(params.appId, domain, path, null);
      if (!stats || unfiltered.length === 0) {
        return jsonResponse([]);
      }
      const filtered = matchingSamples(params.appId, domain, path, filterExpr);
      const fraction = matchFraction(unfiltered, sampleAttributes, filterExpr);
      const total = answeredDailyRequests(stats) * 30 * fraction;
      const range = parseRange(url);
      const counts = scaledSeries(
        range,
        total,
        bundle!.dataStart,
        `latency:${domain}|${path}`,
        bundle!.app.id,
      );
      const durationsMs = filtered.map((s) => s.durationMs);
      const scales = smoothScales(
        `latency:${domain}|${path}`,
        counts.length,
        0.11,
      );
      const data = counts.map((point, i) => {
        const durations = durationsMs
          .map((d) => Math.round(d * scales[i]))
          .sort((a, b) => a - b);
        return {
          datetime: point.datetime,
          p50: percentile(durations, 50),
          p90: percentile(durations, 90),
          p95: percentile(durations, 95),
          p99: percentile(durations, 99),
          count: point.instances,
        };
      });
      return jsonResponse(data);
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/networkRequests/plots/statusCodes",
    handle: ({ params, url }) => {
      const domain = url.searchParams.get("domain") ?? "";
      const path = url.searchParams.get("path") ?? "";
      const filterExpr = url.searchParams.get("filter_expr");
      const bundle = catalog().appById.get(params.appId);
      const endpoints = Array.from(
        bundle?.networkEndpoints.values() ?? [],
      ).filter(
        (e) =>
          (domain === "" || e.domain === domain) &&
          (path === "" || e.path === path),
      );
      if (endpoints.length === 0) {
        return jsonResponse([]);
      }
      const unfiltered = matchingSamples(params.appId, domain, path, null);
      const fraction = matchFraction(unfiltered, sampleAttributes, filterExpr);
      const totalDailyRequests = endpoints.reduce(
        (sum, e) => sum + answeredDailyRequests(e),
        0,
      );
      const shareFor = (min: number, max: number) =>
        totalDailyRequests === 0
          ? 0
          : endpoints.reduce(
              (sum, e) =>
                sum +
                answeredDailyRequests(e) *
                  weightShare(answered(e.outcomes), min, max),
              0,
            ) / totalDailyRequests;
      const p2 = shareFor(200, 299);
      const p3 = shareFor(300, 399);
      const p4 = shareFor(400, 499);
      const p5 = shareFor(500, 599);
      const range = parseRange(url);
      const total = totalDailyRequests * 30 * fraction;
      const series = scaledSeries(
        range,
        total,
        bundle!.dataStart,
        `statuscodes:${domain}|${path}`,
        bundle!.app.id,
      );
      const shares = [p2, p3, p4, p5];
      const wobbles = codeWobbles(
        `statuscodes:${domain}|${path}`,
        [200, 300, 400, 500],
        series.length,
      );
      const data = series.map((point, i) => {
        const [c2, c3, c4, c5] = drawCounts(
          shares.map((share, slot) => share * wobbles[slot][i]),
          point.instances,
          `statuscodes:${domain}|${path}:${i}`,
        );
        return {
          datetime: point.datetime,
          total_count: point.instances,
          count_2xx: c2,
          count_3xx: c3,
          count_4xx: c4,
          count_5xx: c5,
        };
      });
      return jsonResponse(data);
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/networkRequests/plots/endpointStatusCodes",
    handle: ({ params, url }) => {
      const domain = url.searchParams.get("domain") ?? "";
      const path = url.searchParams.get("path") ?? "";
      const filterExpr = url.searchParams.get("filter_expr");
      const bundle = catalog().appById.get(params.appId);
      const stats = bundle?.networkEndpoints.get(`${domain}|${path}`);
      const unfiltered = matchingSamples(params.appId, domain, path, null);
      if (!stats || unfiltered.length === 0) {
        return jsonResponse({ status_codes: [], data_points: [] });
      }
      const fraction = matchFraction(unfiltered, sampleAttributes, filterExpr);
      const range = parseRange(url);
      const total = answeredDailyRequests(stats) * 30 * fraction;
      const series = scaledSeries(
        range,
        total,
        bundle!.dataStart,
        `endpointstatus:${domain}|${path}`,
        bundle!.app.id,
      );
      const outcomes = answered(stats.outcomes);
      const codes = outcomes.map((o) => o.code);
      const wobbles = codeWobbles(
        `endpointstatus:${domain}|${path}`,
        codes,
        series.length,
      );
      const data_points = series.map((point, i) => {
        const counts = drawCounts(
          outcomes.map((outcome, slot) => outcome.weight * wobbles[slot][i]),
          point.instances,
          `endpointstatus:${domain}|${path}:${i}`,
        );
        return {
          datetime: point.datetime,
          total_count: point.instances,
          ...Object.fromEntries(
            codes.map((code, i) => [`count_${code}`, counts[i]]),
          ),
        };
      });
      return jsonResponse({ status_codes: codes, data_points });
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/networkRequests/plots/timeline",
    handle: ({ params, url }) => {
      const domain = url.searchParams.get("domain") ?? "";
      const path = url.searchParams.get("path") ?? "";
      const filterExpr = url.searchParams.get("filter_expr");
      const bundle = catalog().appById.get(params.appId);
      const samples = matchingSamples(params.appId, domain, path, filterExpr);
      const interval = 5;
      const counts = new Map<string, number>();
      for (const sample of samples) {
        const session = bundle?.sessions.find(
          (s) => s.list.session_id === sample.sessionId,
        );
        if (!session) {
          continue;
        }
        const start = new Date(session.list.first_event_time);
        const elapsedRaw = Math.max(
          0,
          (sample.startTime.toJSDate().getTime() - start.getTime()) / 1000,
        );
        const elapsed = Math.floor(elapsedRaw / interval) * interval;
        const key = `${elapsed}|${sample.domain}|${sample.path}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const perSessionScale = (bundle?.scenario.app.dailySessions ?? 0) / 10;
      const byEndpoint = new Map<
        string,
        { elapsed: number; count: number }[]
      >();
      for (const [key, count] of counts) {
        const [elapsed, pointDomain, pointPath] = key.split("|");
        const endpoint = `${pointDomain}|${pointPath}`;
        const list = byEndpoint.get(endpoint) ?? [];
        list.push({ elapsed: Number(elapsed), count });
        byEndpoint.set(endpoint, list);
      }
      const points = Array.from(byEndpoint.entries()).flatMap(
        ([endpoint, list]) => {
          const ordered = [...list].sort((a, b) => a.elapsed - b.elapsed);
          const scales = smoothScales(
            `timeline:${endpoint}`,
            ordered.length,
            0.11,
          );
          const [pointDomain, pointPath] = endpoint.split("|");
          return ordered.map((entry, i) => ({
            elapsed: entry.elapsed,
            domain: pointDomain,
            path_pattern: pointPath,
            count: Math.max(
              1,
              Math.round(entry.count * perSessionScale * scales[i]),
            ),
          }));
        },
      );
      return jsonResponse({ interval, points });
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/networkRequests/trends",
    handle: ({ params, url }) => {
      const filterExpr = url.searchParams.get("filter_expr");
      const bundle = catalog().appById.get(params.appId);
      const coverage = bundle
        ? windowCoverage(parseRange(url), bundle.dataStart)
        : 0;
      const samples = matchingSamples(params.appId, "", "", filterExpr);
      const byEndpoint = new Map<string, HttpSample[]>();
      for (const sample of samples) {
        const key = `${sample.domain}|${sample.path}`;
        const list = byEndpoint.get(key) ?? [];
        list.push(sample);
        byEndpoint.set(key, list);
      }
      const entries = Array.from(byEndpoint.entries()).flatMap(
        ([key, list]) => {
          const [domain, path_pattern] = key.split("|");
          const stats = bundle?.networkEndpoints.get(key);
          if (!stats) {
            return [];
          }
          const fraction = matchFraction(
            matchingSamples(params.appId, domain, path_pattern, null),
            sampleAttributes,
            filterExpr,
          );
          const frequency = Math.round(
            answeredDailyRequests(stats) * 30 * coverage * fraction,
          );
          if (frequency === 0) {
            return [];
          }
          const durations = list.map((s) => s.durationMs).sort((a, b) => a - b);
          const errorShare = weightShare(answered(stats.outcomes), 400, 599);
          return [
            {
              domain,
              path_pattern,
              p95_latency: percentile(durations, 95),
              error_rate: Math.round(errorShare * 1000) / 10,
              frequency,
            },
          ];
        },
      );
      return jsonResponse({
        trends_latency: [...entries].sort(
          (a, b) => b.p95_latency - a.p95_latency,
        ),
        trends_error_rate: [...entries].sort(
          (a, b) => b.error_rate - a.error_rate,
        ),
        trends_frequency: [...entries].sort(
          (a, b) => b.frequency - a.frequency,
        ),
      });
    },
  },
];
