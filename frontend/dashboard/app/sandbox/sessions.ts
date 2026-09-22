import { catalog } from "./catalog";
import {
  isWithinRange,
  jsonResponse,
  paginate,
  parseRange,
  SandboxRoute,
} from "./query";
import {
  matchFraction,
  matchesFilterExpr,
  sessionAttributeBag,
} from "./filter";
import { scaledSeries } from "./aggregate";
import { adoptionOf } from "./adoption";

function sessionsListResponse(appId: string, url: URL): Response {
  const bundle = catalog().appById.get(appId);
  if (!bundle) {
    return jsonResponse({
      meta: { next: false, previous: false },
      results: [],
    });
  }
  const range = parseRange(url);
  const filterExpr = url.searchParams.get("filter_expr");
  const inRange = bundle.sessions
    .filter(
      (session) =>
        isWithinRange(session.list.last_event_time, range) &&
        matchesFilterExpr(sessionAttributeBag(session.detail), filterExpr),
    )
    .map((session) => session.list);
  const { items, hasNext, hasPrev } = paginate(inRange, url);
  return jsonResponse({
    meta: { next: hasNext, previous: hasPrev },
    results: items,
  });
}

function sessionsPlotResponse(appId: string, url: URL): Response {
  const bundle = catalog().appById.get(appId);
  if (!bundle) {
    return jsonResponse([]);
  }
  const range = parseRange(url);
  const filterExpr = url.searchParams.get("filter_expr");
  const app = bundle.scenario.app;
  const dataStart = bundle.dataStart;
  const allSessions = bundle.sessions;
  const series = app.versions.flatMap((version) => {
    const sampleForVersion = allSessions.filter(
      (s) => s.list.attribute.app_version === version.name,
    );
    const fraction = matchFraction(
      sampleForVersion.length > 0 ? sampleForVersion : allSessions,
      (session) => sessionAttributeBag(session.detail),
      filterExpr,
    );
    const total = app.dailySessions * 30 * fraction;
    if (total === 0) {
      return [];
    }
    return [
      {
        id: `${version.name} (${version.code})`,
        data: scaledSeries(
          range,
          total,
          dataStart,
          `sessions:${app.id}:${version.name}`,
          app.id,
          adoptionOf(bundle.releases, [version.name]),
        ),
      },
    ];
  });
  return jsonResponse(series);
}

export const sessionsRoutes: SandboxRoute[] = [
  {
    method: "GET",
    path: "/api/apps/:appId/sessions",
    handle: ({ params, url }) => sessionsListResponse(params.appId, url),
  },
  {
    method: "GET",
    path: "/api/apps/:appId/sessions/plots/instances",
    handle: ({ params, url }) => sessionsPlotResponse(params.appId, url),
  },
  {
    method: "GET",
    path: "/api/apps/:appId/sessions/:sessionId",
    handle: ({ params }) => {
      const bundle = catalog().appById.get(params.appId);
      const found = bundle?.sessions.find(
        (s) => s.list.session_id === params.sessionId,
      );
      if (!found) {
        return jsonResponse({ error: "Session not found" }, 404);
      }
      return jsonResponse(found.detail);
    },
  },
];
