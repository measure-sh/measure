import { DateTime } from "luxon";
import type {
  Journey,
  JourneyErrorsResponse,
  JourneyNetworkResponse,
  JourneyNode,
  JourneyPathUsers,
  JourneySessionsResponse,
  JourneyTracesResponse,
} from "../api/api_calls";
import { selectedNames, sessionsIn } from "./adoption";
import { catalog, screenSequence } from "./catalog";
import type { AppBundle, ErrorGroup } from "./catalog";
import { groupCount, groupSessionsAndUsers } from "./errors";
import { matchesFilterExpr, sessionAttributeBag } from "./filter";
import { rangeDays, sessionsPerUser } from "./funnels";
import {
  jsonResponse,
  pageResponse,
  parseQuantile,
  parseRange,
  quantileOf,
  stableInt,
  type SandboxRoute,
} from "./query";

const SHOWN_NODES = 50;
const SHOWN_LINKS = 200;

// The space in the name keeps it apart from screen and custom event names.
// Responses and requests use the server's id for the node, FATAL_ID.
const FATAL_NODE = "Fatal error";
const FATAL_ID = "fatal";
const idOf = (name: string) => (name === FATAL_NODE ? FATAL_ID : name);
const nameOf = (id: string) => (id === FATAL_ID ? FATAL_NODE : id);

type Step = { name: string; kind: JourneyNode["kind"]; time: number };

type SampleSession = {
  bundleSession: AppBundle["sessions"][number];
  steps: Step[];
  // The sample user of the session. The sandbox has few app installations,
  // each with a few sessions. If each installation were one user, most nodes
  // would show almost the same count. Thus each sample session stands for its
  // own group of users that took that path in the range.
  user: string;
  // The share of the app's users that the session's user stands for.
  weight: number;
};

// A stretch of one session that a node's or a link's lists cover.
type Window = { session: SampleSession; from: number; to: number };

// The share of a group's errors that end the session: every fatal crash
// and ANR, plus hangs during which the app was killed. Most hangs recover,
// and groups have too few samples to measure the share, so it is fixed.
export function killedShare(group: ErrorGroup): number {
  return group.error_type === "app_hang" ? 0.2 : 1;
}

const fatalTimesCache = new WeakMap<AppBundle, Map<string, number>>();

// The time of each session's first fatal crash, ANR or app hang, which ends
// the session.
function fatalTimes(bundle: AppBundle): Map<string, number> {
  const cached = fatalTimesCache.get(bundle);
  if (cached) {
    return cached;
  }
  const times = new Map<string, number>();
  for (const group of bundle.errorGroups) {
    for (const instance of group.instances) {
      if (group.severity !== "fatal" && instance.app_hang?.state !== "killed") {
        continue;
      }
      const time = DateTime.fromISO(instance.timestamp).toMillis();
      const earliest = times.get(instance.session_id);
      if (earliest === undefined || time < earliest) {
        times.set(instance.session_id, time);
      }
    }
  }
  fatalTimesCache.set(bundle, times);
  return times;
}

// A session that ends in a fatal crash, ANR or app hang gets one more step,
// the fatal error, after its last screen or custom event.
function stepsOf(
  bundle: AppBundle,
  session: AppBundle["sessions"][number],
): Step[] {
  const time = (iso: string) => DateTime.fromISO(iso).toMillis();
  const screens: Step[] = screenSequence(
    session.detail,
    bundle.scenario.threadNames.main,
  ).map((s) => ({ name: s.name, kind: "screen", time: time(s.timestamp) }));
  const events: Step[] = Object.values(session.detail.threads)
    .flat()
    .filter((event) => event.event_type === "custom")
    .map((event) => ({
      name: String(event.name),
      kind: "event",
      time: time(String(event.timestamp)),
    }));
  const fatalTime = fatalTimes(bundle).get(session.list.session_id);
  const fatal: Step[] =
    fatalTime === undefined
      ? []
      : [{ name: FATAL_NODE, kind: "fatal", time: fatalTime }];
  // Several events in a row for one screen or custom event count as one step.
  const steps = [...screens, ...events]
    .filter((step) => fatalTime === undefined || step.time <= fatalTime)
    .sort((a, b) => a.time - b.time)
    .filter((step, i, all) => i === 0 || all[i - 1].name !== step.name);
  return [...steps, ...fatal];
}

// Each sample user stands for a share of the app's users in the range. Thus
// the counts agree with the other sandbox pages.
// Many more sample users crash than real users. Thus the sample users with a
// fatal error share the count of users that the errors pages show for fatal
// errors. The other sample users share the remaining users.
// In a range before the app's first session, each sample user gets a share of
// zero. The function removes these users, so they do not add nodes and links
// with zero users.
function sampleSessions(bundle: AppBundle, url: URL): SampleSession[] {
  const range = parseRange(url);
  const filterExpr = url.searchParams.get("filter_expr");
  const now = DateTime.now();
  const total =
    sessionsIn(bundle, range, selectedNames(bundle.scenario.app, filterExpr)) /
    sessionsPerUser(rangeDays(range.from, range.to < now ? range.to : now));
  const matching = bundle.sessions
    .filter((s) => matchesFilterExpr(sessionAttributeBag(s.detail), filterExpr))
    .map((s) => ({
      bundleSession: s,
      steps: stepsOf(bundle, s),
      user: s.list.session_id,
    }))
    .filter((s) => s.steps.length > 0);
  const endsInFatal = (s: { steps: Step[] }) =>
    s.steps[s.steps.length - 1].kind === "fatal";
  const crashed = new Set(matching.filter(endsInFatal).map((s) => s.user));
  const draws = new Map(
    matching.map((s) => [
      s.user,
      stableInt(`journeyweight:${s.user}`, 600, 1400),
    ]),
  );
  const drawsOf = (fatal: boolean) =>
    [...draws.entries()]
      .filter(([user]) => crashed.has(user) === fatal)
      .reduce((sum, [, draw]) => sum + draw, 0);
  const fatalDraws = drawsOf(true);
  const otherDraws = drawsOf(false);
  const fatalUsers = bundle.errorGroups
    .filter((g) => g.severity === "fatal" || g.error_type === "app_hang")
    .reduce((sum, g) => {
      const count = Math.round(
        groupCount(bundle, g, range, filterExpr) * killedShare(g),
      );
      return count === 0 ? sum : sum + groupSessionsAndUsers(g, count).users;
    }, 0);
  const fatalTotal = fatalDraws === 0 ? 0 : Math.min(total, fatalUsers);
  return matching
    .map((s) => {
      const [share, sum] = crashed.has(s.user)
        ? [fatalTotal, fatalDraws]
        : [total - fatalTotal, otherDraws];
      const draw = draws.get(s.user)!;
      return { ...s, weight: sum === 0 ? 0 : (share * draw) / sum };
    })
    .filter((s) => s.weight > 0);
}

// Each user's sessions in the order they started.
function usersOf(sessions: SampleSession[]): SampleSession[][] {
  const byUser = new Map<string, SampleSession[]>();
  for (const session of sessions) {
    byUser.set(session.user, [...(byUser.get(session.user) ?? []), session]);
  }
  return [...byUser.values()].map((user) =>
    user.sort((a, b) =>
      a.bundleSession.list.first_event_time.localeCompare(
        b.bundleSession.list.first_event_time,
      ),
    ),
  );
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function weightedMedian(values: { value: number; weight: number }[]): number {
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const half = sorted.reduce((sum, v) => sum + v.weight, 0) / 2;
  let seen = 0;
  for (const v of sorted) {
    seen += v.weight;
    if (seen >= half) {
      return v.value;
    }
  }
  return 0;
}

// A user counts once towards a node and once towards a link, however often
// they visit the screen or make the move, in one session or several. Moves to
// or from a screen or custom event outside the shown nodes are left out. The
// fatal error node and the links to it are always shown, so every fatal
// crash, ANR and app hang in the range leads to it.
function journeyOf(sessions: SampleSession[]): Journey {
  const users = usersOf(sessions);
  const reach = new Map<string, number>();
  for (const user of users) {
    const names = new Set(
      user.flatMap((s) => s.steps.map((step) => step.name)),
    );
    for (const name of names) {
      reach.set(name, (reach.get(name) ?? 0) + user[0].weight);
    }
  }
  const shown = new Set(
    [...reach.entries()]
      .filter(([name]) => name !== FATAL_NODE)
      .sort((a, b) => b[1] - a[1])
      .slice(0, SHOWN_NODES)
      .map(([name]) => name),
  );
  if (reach.has(FATAL_NODE)) {
    shown.add(FATAL_NODE);
  }

  const nodes = new Map<
    string,
    {
      kind: Step["kind"];
      users: number;
      continuing: number;
      gaps: number[];
      firstSteps: { value: number; weight: number }[];
    }
  >();
  const links = new Map<
    string,
    { source: string; target: string; users: number }
  >();
  for (const user of users) {
    const weight = user[0].weight;
    const visited = new Set<string>();
    const continued = new Set<string>();
    const moves = new Set<string>();
    for (const session of user) {
      session.steps.forEach((step, i) => {
        if (!shown.has(step.name)) {
          return;
        }
        const totals = nodes.get(step.name) ?? {
          kind: step.kind,
          users: 0,
          continuing: 0,
          gaps: [],
          firstSteps: [],
        };
        if (i > 0) {
          totals.gaps.push(step.time - session.steps[i - 1].time);
        }
        if (!visited.has(step.name)) {
          visited.add(step.name);
          totals.users += weight;
          totals.firstSteps.push({ value: i, weight });
        }
        if (i < session.steps.length - 1 && !continued.has(step.name)) {
          continued.add(step.name);
          totals.continuing += weight;
        }
        nodes.set(step.name, totals);
      });

      for (let i = 0; i < session.steps.length - 1; i++) {
        const source = session.steps[i].name;
        const target = session.steps[i + 1].name;
        const key = `${source}>${target}`;
        if (!shown.has(source) || !shown.has(target) || moves.has(key)) {
          continue;
        }
        moves.add(key);
        const link = links.get(key) ?? { source, target, users: 0 };
        link.users += weight;
        links.set(key, link);
      }
    }
  }

  return {
    sample_percent: 100,
    nodes: [...nodes.entries()]
      .map(([name, totals]) => ({
        id: idOf(name),
        name,
        kind: totals.kind,
        step: weightedMedian(totals.firstSteps),
        users: Math.round(totals.users),
        continuing: Math.round(totals.continuing),
        median_ms_from_previous: median(totals.gaps),
      }))
      .sort((a, b) => a.step - b.step || b.users - a.users),
    links: [
      ...[...links.values()]
        .filter((link) => link.target !== FATAL_NODE)
        .sort((a, b) => b.users - a.users)
        .slice(0, SHOWN_LINKS),
      ...[...links.values()].filter((link) => link.target === FATAL_NODE),
    ].map((link) => ({
      source: idOf(link.source),
      target: idOf(link.target),
      users: Math.round(link.users),
    })),
  };
}

// Each visit to the node, from reaching it until the session's next step, or
// until the session ends after its last step.
function nodeWindows(sessions: SampleSession[], node: string): Window[] {
  return sessions.flatMap((session) =>
    session.steps.flatMap((step, i) => {
      if (step.name !== node) {
        return [];
      }
      const next = session.steps[i + 1];
      const end = DateTime.fromISO(
        session.bundleSession.list.last_event_time,
      ).toMillis();
      return [{ session, from: step.time, to: next?.time ?? end }];
    }),
  );
}

// A window for each time a session makes all the moves of the path in
// sequence. A link is a path of two nodes, so its windows come from here too.
function pathWindows(sessions: SampleSession[], path: string[]): Window[] {
  return sessions.flatMap((session) =>
    session.steps.slice(0, 1 - path.length).flatMap((step, i) => {
      const steps = session.steps.slice(i, i + path.length);
      return steps.every((s, j) => s.name === path[j])
        ? [{ session, from: step.time, to: steps[steps.length - 1].time }]
        : [];
    }),
  );
}

function pathUsers(windows: Window[]): JourneyPathUsers {
  const users = new Map(windows.map((w) => [w.session.user, w.session.weight]));
  return {
    users: Math.round([...users.values()].reduce((sum, w) => sum + w, 0)),
    sample_percent: 100,
  };
}

// Counts are summed over the sample users' weights. `users` counts each user
// once, however many of their windows the item came up in.
function tally<Item>(
  windows: Window[],
  itemsIn: (w: Window) => { key: string; item: Item; value?: number }[],
) {
  const byKey = new Map<
    string,
    { item: Item; count: number; users: number; values: number[] }
  >();
  const seen = new Set<string>();
  for (const w of windows) {
    for (const { key, item, value } of itemsIn(w)) {
      const entry = byKey.get(key) ?? {
        item,
        count: 0,
        users: 0,
        values: [],
      };
      entry.count += w.session.weight;
      const userKey = `${w.session.user}:${key}`;
      if (!seen.has(userKey)) {
        entry.users += w.session.weight;
        seen.add(userKey);
      }
      if (value !== undefined) {
        entry.values.push(value);
      }
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()]
    .map((e) => ({
      ...e,
      count: Math.round(e.count),
      users: Math.round(e.users),
    }))
    .filter((e) => e.users > 0)
    .sort((a, b) => b.users - a.users || b.count - a.count);
}

function within(time: string | DateTime, w: Window): boolean {
  const millis =
    typeof time === "string"
      ? DateTime.fromISO(time).toMillis()
      : time.toMillis();
  return millis >= w.from && millis <= w.to;
}

function inSession(sessionId: string, w: Window): boolean {
  return sessionId === w.session.bundleSession.list.session_id;
}

function linkErrors(
  bundle: AppBundle,
  windows: Window[],
): JourneyErrorsResponse["results"] {
  return tally(windows, (w) =>
    bundle.errorGroups.flatMap((group) =>
      group.instances
        .filter(
          (instance) =>
            inSession(instance.session_id, w) && within(instance.timestamp, w),
        )
        .map(() => ({ key: group.id, item: group })),
    ),
  ).map(({ item: group, count, users }) => ({
    id: group.id,
    type: group.type,
    error_type: group.error_type,
    severity: group.severity,
    message: group.message,
    method_name: group.method_name,
    file_name: group.file_name,
    count,
    users,
  }));
}

function linkTraces(
  bundle: AppBundle,
  windows: Window[],
  quantile: number,
): JourneyTracesResponse["results"] {
  const traces = [...bundle.traces.values()];
  return tally(windows, (w) =>
    traces
      .filter(
        (trace) =>
          inSession(trace.session_id, w) && within(trace.start_time, w),
      )
      .flatMap((trace) => {
        const root = trace.spans.find((span) => span.parent_id === "");
        return root
          ? [
              {
                key: root.span_name,
                item: root.span_name,
                value: trace.duration,
              },
            ]
          : [];
      }),
  ).map(({ item, count, users, values }) => ({
    span_name: item,
    count,
    users,
    duration_ms: quantileOf(values, quantile),
  }));
}

function linkNetwork(
  bundle: AppBundle,
  windows: Window[],
  quantile: number,
): JourneyNetworkResponse["results"] {
  return tally(windows, (w) =>
    bundle.httpSamples
      .filter(
        (sample) =>
          inSession(sample.sessionId, w) && within(sample.startTime, w),
      )
      .map((sample) => ({
        key: `${sample.domain}${sample.path}`,
        item: sample,
        value: sample.durationMs,
      })),
  ).map(({ item, count, users, values }) => ({
    domain: item.domain,
    path_pattern: item.path,
    count,
    users,
    latency_ms: quantileOf(values, quantile),
  }));
}

function linkSessions(windows: Window[]): JourneySessionsResponse["results"] {
  const seen = new Set<string>();
  return windows
    .sort((a, b) => b.from - a.from)
    .flatMap(({ session }) => {
      const { list, detail } = session.bundleSession;
      if (seen.has(list.session_id)) {
        return [];
      }
      seen.add(list.session_id);
      return [
        {
          session_id: list.session_id,
          installation_id: detail.attribute.installation_id,
          user_id: list.attribute.user_id,
          first_event_time: list.first_event_time,
          duration: Number(list.duration),
        },
      ];
    });
}

// The lists take a node, a link's source and target, or the nodes of a path.
function withSelection(
  appId: string,
  url: URL,
  handle: (bundle: AppBundle, windows: Window[]) => Response,
): Response {
  const bundle = catalog().appById.get(appId);
  const node = url.searchParams.get("node");
  const source = url.searchParams.get("source");
  const target = url.searchParams.get("target");
  const path = (
    source !== null && target !== null
      ? [source, target]
      : url.searchParams.getAll("path")
  ).map(nameOf);
  if (!bundle || (node === null && path.length < 2)) {
    return jsonResponse({ error: "Journey node, link or path not found" }, 404);
  }
  const sessions = sampleSessions(bundle, url);
  return handle(
    bundle,
    node !== null
      ? nodeWindows(sessions, nameOf(node))
      : pathWindows(sessions, path),
  );
}

export const journeyRoutes: SandboxRoute[] = [
  {
    method: "GET",
    path: "/api/apps/:appId/journey",
    handle: ({ params, url }) => {
      const bundle = catalog().appById.get(params.appId);
      return jsonResponse(
        bundle
          ? journeyOf(sampleSessions(bundle, url))
          : { nodes: [], links: [] },
      );
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/journey/path",
    handle: ({ params, url }) => {
      const bundle = catalog().appById.get(params.appId);
      const path = url.searchParams.getAll("path").map(nameOf);
      if (!bundle || path.length < 2) {
        return jsonResponse({ error: "Journey path not found" }, 404);
      }
      return jsonResponse(
        pathUsers(pathWindows(sampleSessions(bundle, url), path)),
      );
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/journey/errors",
    handle: ({ params, url }) =>
      withSelection(params.appId, url, (bundle, windows) =>
        pageResponse(linkErrors(bundle, windows), url),
      ),
  },
  {
    method: "GET",
    path: "/api/apps/:appId/journey/traces",
    handle: ({ params, url }) =>
      withSelection(params.appId, url, (bundle, windows) => {
        const quantile = parseQuantile(url);
        if (quantile instanceof Response) {
          return quantile;
        }
        return pageResponse(linkTraces(bundle, windows, quantile), url);
      }),
  },
  {
    method: "GET",
    path: "/api/apps/:appId/journey/network",
    handle: ({ params, url }) =>
      withSelection(params.appId, url, (bundle, windows) => {
        const quantile = parseQuantile(url);
        if (quantile instanceof Response) {
          return quantile;
        }
        return pageResponse(linkNetwork(bundle, windows, quantile), url);
      }),
  },
  {
    method: "GET",
    path: "/api/apps/:appId/journey/sessions",
    handle: ({ params, url }) =>
      withSelection(params.appId, url, (_, windows) =>
        pageResponse(linkSessions(windows), url),
      ),
  },
];
