import { handleSandboxRequest } from "@/app/sandbox/handlers";
import { catalog, dailyBugReports } from "@/app/sandbox/catalog";
import type { SdkConfig } from "@/app/api/api_calls";
import {
  DEVICE_MEMORY_TIERS,
  deviceMemoryTier,
} from "@/app/sandbox/device_memory";
import { describe, expect, it } from "@jest/globals";
import { DateTime } from "luxon";

const world = catalog();
const TEAM_ID = world.team.id;
const bundle = world.appById.get(world.apps[0].id)!;
const APP_ID = bundle.app.id;

type Case = {
  name: string;
  method?: string;
  path: string;
  body?: unknown;
  status: number;
  check?: (json: any) => void | Promise<void>;
};

async function fetchJson(path: string, init?: RequestInit) {
  const res = await handleSandboxRequest(path, init);
  const json = await res.json();
  return { res, json };
}

async function run({ method, path, body, status, check }: Case) {
  const init =
    method !== undefined
      ? { method, body: body !== undefined ? JSON.stringify(body) : undefined }
      : undefined;
  const res = await handleSandboxRequest(path, init);
  expect(res.status).toBe(status);
  if (check) {
    await check(await res.json());
  }
}

function expectPage(
  json: any,
  {
    length,
    next,
    previous,
  }: { length: number; next: boolean; previous: boolean },
) {
  expect(json.results).toHaveLength(length);
  expect(json.meta.next).toBe(next);
  expect(json.meta.previous).toBe(previous);
}

function withFilter(path: string, filterExpr: string) {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}filter_expr=${encodeURIComponent(filterExpr)}`;
}

function expectEmpty(json: any, key = "results") {
  expect(json[key]).toEqual([]);
}

async function expectNarrowsAgainst(
  basePath: string,
  filteredJson: any,
  itemCheck: (item: any) => void = () => {},
  key = "results",
) {
  const { json: all } = await fetchJson(basePath);
  expect(filteredJson[key].length).toBeGreaterThan(0);
  expect(filteredJson[key].length).toBeLessThan(all[key].length);
  for (const item of filteredJson[key]) {
    itemCheck(item);
  }
}

function rangeParams(minutesBack: number, extra: Record<string, string> = {}) {
  const to = DateTime.now();
  return new URLSearchParams({
    from: to.minus({ minutes: minutesBack }).toISO()!,
    to: to.toISO()!,
    timezone: "UTC",
    ...extra,
  }).toString();
}

function wideRangeParams(extra: Record<string, string> = {}) {
  return new URLSearchParams({
    from: world.builtAt.minus({ days: 30 }).toISO()!,
    to: world.builtAt.toISO()!,
    ...extra,
  });
}

const latestVersion = bundle.scenario.app.versions[0].name;
const EMPTY_RANGE =
  "from=1990-01-01T00:00:00.000Z&to=1990-01-02T00:00:00.000Z&timezone=UTC";

function quoted(value: string): string {
  return `"${value.replace(/["\\]/g, "\\$&")}"`;
}

const generalCases: Case[] = [
  {
    name: "returns a sandbox session on GET /api/auth/session",
    path: "/api/auth/session",
    status: 200,
    check: (data) => {
      expect(data.user.id).toEqual(expect.any(String));
      expect(data.user.own_team_id).toBe(TEAM_ID);
      expect(data.user.name).toEqual(expect.any(String));
      expect(data.user.email).toEqual(expect.any(String));
    },
  },
  {
    name: "returns the sandbox team on GET /api/teams",
    path: "/api/teams",
    status: 200,
    check: (data) => expect(data).toEqual([{ id: TEAM_ID, name: "Acme Team" }]),
  },
  {
    name: "returns every catalog app on GET /api/teams/sandbox/apps",
    path: `/api/teams/${TEAM_ID}/apps`,
    status: 200,
    check: (data) => {
      expect(data.map((a: any) => a.id).sort()).toEqual(
        world.apps.map((a) => a.id).sort(),
      );
      const app = data.find((a: any) => a.id === APP_ID);
      expect(app).toMatchObject({
        team_id: TEAM_ID,
        onboarded: true,
        os_names: [bundle.scenario.app.os],
        unique_identifier: bundle.scenario.app.uniqueId,
      });
      expect(app.api_key).toEqual(expect.objectContaining({ revoked: false }));
    },
  },
  {
    name: "returns the least-privileged (viewer) authz on GET /api/teams/sandbox/authz",
    path: `/api/teams/${TEAM_ID}/authz`,
    status: 200,
    check: (data) => {
      expect(data.can_create_app).toBe(false);
      expect(data.can_rename_team).toBe(false);
      expect(data.can_manage_slack).toBe(false);
      expect(data.can_change_billing).toBe(false);
      expect(data.can_invite_roles).toEqual([
        "viewer",
        "developer",
        "admin",
        "owner",
      ]);
      expect(data.members).toHaveLength(1);
      expect(data.members[0].role).toBe("viewer");
    },
  },
  {
    name: "returns 404 for an unknown route, and for a known path with an unsupported method",
    path: "/api/does-not-exist",
    status: 404,
    check: async (data) => {
      expect(data.error).toEqual(expect.any(String));
      const { res } = await fetchJson("/api/teams", { method: "POST" });
      expect(res.status).toBe(404);
    },
  },
];

const DEVICE_KEYS = [
  "os_name",
  "os_version",
  "device_name",
  "device_manufacturer",
  "locale",
  "network_type",
  "network_generation",
  "network_provider",
  "country",
];
const VERSION_KEYS = [
  "version_name",
  "version_code",
  "patch_version",
  "patch_id",
];
const FILTER_KEYS: Record<string, string[]> = {
  app_health: ["version_name", "version_code"],
  journeys: VERSION_KEYS,
  errors: ["error_type", ...VERSION_KEYS, "user_id", ...DEVICE_KEYS],
  error_group_events: [...VERSION_KEYS, "user_id", ...DEVICE_KEYS],
  sessions: [
    "session_events",
    "session_foreground_background",
    "device_total_memory",
    "session_custom_event",
    "session_log",
    "session_screen",
    "session_error_text",
    "session_id",
    ...VERSION_KEYS,
    "user_id",
    ...DEVICE_KEYS,
  ],
  bug_reports: [
    "bug_report_status",
    "bug_report_description",
    "session_id",
    ...VERSION_KEYS,
    "user_id",
    ...DEVICE_KEYS,
  ],
  memory: [
    "app_state",
    ...VERSION_KEYS,
    "os_name",
    "os_version",
    "device_name",
    "device_manufacturer",
    "device_total_memory",
  ],
  network: ["http_method", ...VERSION_KEYS, ...DEVICE_KEYS],
  builds: ["mapping_type", ...VERSION_KEYS],
  spans: ["span_status", ...VERSION_KEYS, ...DEVICE_KEYS],
  alerts: [],
};
const FREE_TEXT_KEYS = [
  "session_log",
  "session_error_text",
  "bug_report_description",
  "session_id",
];

const overviewCases: Case[] = [
  {
    name: "returns metrics shaped for MetricsOverview on GET /metrics",
    path: `/api/apps/${APP_ID}/metrics`,
    status: 200,
    check: (data) => {
      expect(data.adoption.adoption).toEqual(expect.any(Number));
      expect(data.crash_free_sessions.crash_free_sessions).toEqual(
        expect.any(Number),
      );
      expect(data.cold_launch.p95).toEqual(expect.any(Number));
      expect(data.sizes.multiple_versions).toBe(true);
    },
  },
  {
    name: "GET /metrics reports the app size only for a single version name",
    path: `/api/apps/${APP_ID}/metrics?filter_expr=${encodeURIComponent(`version_name:in:[${latestVersion}]`)}`,
    status: 200,
    check: (data) => expect(data.sizes.selected_app_size).toBeGreaterThan(0),
  },
  {
    name: "returns one point per bucket for the requested range on GET /health/plots/instances",
    path: `/api/apps/${APP_ID}/health/plots/instances?from=2026-04-01T00:00:00.000Z&to=2026-04-04T00:00:00.000Z&plot_time_group=days`,
    status: 200,
    check: (data) => {
      expect(data.map((s: any) => s.id).sort()).toEqual([
        "anrs",
        "crashes",
        "sessions",
      ]);
      for (const series of data) {
        expect(series.data).toHaveLength(4);
        for (const point of series.data) {
          expect(typeof point.datetime).toBe("string");
          expect(point.instances).toEqual(expect.any(Number));
        }
      }
    },
  },
  {
    name: "returns nodes and links shaped for the journey component on GET /journey",
    path: `/api/apps/${APP_ID}/journey`,
    status: 200,
    check: (data) => {
      expect(data.links.length).toBeGreaterThan(0);
      expect(data.nodes.length).toBeGreaterThan(0);
      for (const link of data.links) {
        expect(typeof link.source).toBe("string");
        expect(typeof link.target).toBe("string");
        expect(link.value).toEqual(expect.any(Number));
      }
      expect(data.totalIssues).toEqual(expect.any(Number));
      expect(
        data.nodes.some((node: any) => node.issues.crashes.length > 0),
      ).toBe(true);
    },
  },
  {
    name: "returns the backend's empty journey and no_data metrics for a range before the app's first session",
    path: `/api/apps/${APP_ID}/journey?${EMPTY_RANGE}`,
    status: 200,
    check: async (data) => {
      const empty = { totalIssues: 0, nodes: null, links: null };
      expect(data).toEqual(empty);
      const { json: unmatched } = await fetchJson(
        withFilter(`/api/apps/${APP_ID}/journey`, "version_name:in:9.9.9"),
      );
      expect(unmatched).toEqual(empty);
      const { json: metrics } = await fetchJson(
        `/api/apps/${APP_ID}/metrics?${EMPTY_RANGE}`,
      );
      expect(metrics.adoption.no_data).toBe(true);
      expect(metrics.crash_free_sessions).toEqual({
        crash_free_sessions: 0,
        unselected_crash_free_sessions: 0,
        no_data: true,
        unselected_no_data: true,
      });
      for (const block of [
        "perceived_crash_free_sessions",
        "anr_free_sessions",
        "perceived_anr_free_sessions",
        "cold_launch",
        "warm_launch",
        "hot_launch",
      ]) {
        expect(metrics[block].no_data).toBe(true);
      }
    },
  },
  {
    name: "advertises the same filter keys the backend defines for each entity",
    path: `/api/apps/${APP_ID}/filters/keys?entity=error_group_events`,
    status: 200,
    check: async (data) => {
      expect(data.key_groups).toEqual([
        "Version",
        "User",
        "OS",
        "Device",
        "Network",
        "Location",
      ]);
      for (const [entity, names] of Object.entries(FILTER_KEYS)) {
        const { json } = await fetchJson(
          `/api/apps/${APP_ID}/filters/keys?entity=${entity}`,
        );
        expect(json.keys.map((k: any) => k.name)).toEqual(names);
        expect(json.key_groups.length > 0).toBe(names.length > 0);
        for (const key of json.keys) {
          if (FREE_TEXT_KEYS.includes(key.name)) {
            expect(key.value_suggestion_mode).toBe("none");
          }
        }
      }
    },
  },
  {
    name: "returns an empty key list for an unknown entity",
    path: `/api/apps/${APP_ID}/filters/keys?entity=does_not_exist`,
    status: 200,
    check: (data) => expect(data).toEqual({ keys: [], key_groups: [] }),
  },
  {
    name: "answers /filters/values for every suggested error_group_events key",
    path: `/api/apps/${APP_ID}/filters/values?entity=app_health&key_name=version_name`,
    status: 200,
    check: async (data) => {
      expect(data.values.map((v: any) => v.text)).toEqual(
        expect.arrayContaining(bundle.scenario.app.versions.map((v) => v.name)),
      );
      expect(data.truncated).toBe(false);
      for (const keyName of FILTER_KEYS.error_group_events.filter(
        (key) => !key.startsWith("patch_"),
      )) {
        const { json } = await fetchJson(
          `/api/apps/${APP_ID}/filters/values?entity=error_group_events&key_name=${keyName}`,
        );
        expect(json.values.length).toBeGreaterThan(0);
        expect(json.truncated).toBe(false);
      }
    },
  },
  {
    name: "returns an empty value list for a free-text key",
    path: `/api/apps/${APP_ID}/filters/values?entity=bug_reports&key_name=session_id`,
    status: 200,
    check: (data) => expect(data.values).toEqual([]),
  },
  {
    name: "returns the catalog's root span names on GET /spans/roots/names",
    path: `/api/apps/${APP_ID}/spans/roots/names`,
    status: 200,
    check: (data) => expect(data.results).toEqual(bundle.rootSpanNames),
  },
];

const SESSIONS_BASE = `/api/apps/${APP_ID}/sessions?${wideRangeParams().toString()}`;
const sessionCount = bundle.sessions.length;

const sessionsCases: Case[] = [
  {
    name: "returns a page of sessions shaped like the real overview response",
    path: `${SESSIONS_BASE}&limit=5&offset=0`,
    status: 200,
    check: (data) => {
      expectPage(data, { length: 5, next: true, previous: false });
      const first = data.results[0];
      expect(first.app_id).toBe(APP_ID);
      expect(typeof first.session_id).toBe("string");
      expect(typeof first.duration).toBe("string");
      expect(first.attribute).toEqual(
        expect.objectContaining({
          app_version: expect.any(String),
          os_name: bundle.scenario.app.os,
        }),
      );
    },
  },
  {
    name: "narrows the sessions list with filter_expr",
    path: withFilter(
      `${SESSIONS_BASE}&limit=200&offset=0`,
      `version_name:in:${latestVersion}`,
    ),
    status: 200,
    check: (data) =>
      expectNarrowsAgainst(`${SESSIONS_BASE}&limit=200&offset=0`, data, (s) =>
        expect(s.attribute.app_version).toBe(latestVersion),
      ),
  },
  {
    name: "returns an empty sessions list, not an error, when filter_expr matches nothing",
    path: withFilter(
      `${SESSIONS_BASE}&limit=200&offset=0`,
      "version_name:in:9.9.9",
    ),
    status: 200,
    check: (data) => expectEmpty(data),
  },
  {
    name: "honours limit and offset for sessions pagination",
    path: `${SESSIONS_BASE}&limit=5&offset=0`,
    status: 200,
    check: async (page1) => {
      expect(page1.meta.previous).toBe(false);
      expect(page1.meta.next).toBe(true);
      const { json: page2 } = await fetchJson(
        `${SESSIONS_BASE}&limit=5&offset=5`,
      );
      expect(page2.meta.previous).toBe(true);
      expect(page2.meta.next).toBe(false);
      const ids1 = page1.results.map((s: any) => s.session_id);
      const ids2 = page2.results.map((s: any) => s.session_id);
      expect(ids1).not.toEqual(ids2);
    },
  },
  {
    name: "narrows the sessions list, and the high memory usage list, to exactly the sessions carrying a session key's value",
    path: `/api/apps/${APP_ID}/filters/values?entity=sessions&key_name=device_total_memory`,
    status: 200,
    check: async (data) => {
      expect(data.values.map((v: any) => v.text)).toEqual(DEVICE_MEMORY_TIERS);
      type Session = (typeof bundle.sessions)[number];
      const events = (s: Session) => Object.values(s.detail.threads).flat();
      const keyed = Array.from(world.appById.values()).find((b) =>
        b.sessions.some((s) =>
          events(s).some((e) => e.event_type === "custom"),
        ),
      )!;
      const sessions = keyed.sessions;
      const some = (s: Session, pred: (e: any) => boolean) =>
        events(s).some(pred);
      const first = (pred: (e: any) => boolean) =>
        sessions.flatMap(events).find(pred)!;
      const custom = String(first((e) => e.event_type === "custom").name);
      const log = String(first((e) => e.event_type === "log").body);
      const screenEvent = first(
        (e) =>
          e.event_type === "screen_view" ||
          e.event_type === "lifecycle_activity",
      );
      const screen = String(screenEvent.name ?? screenEvent.class_name);
      const message = String(first((e) => e.event_type === "error").message);
      const tierOf = (s: Session) =>
        deviceMemoryTier(s.detail.attribute.device_total_memory);
      const tier = tierOf(sessions[0]);
      const isFatal = (e: any) =>
        (e.event_type === "error" && e.severity === "fatal") ||
        e.event_type === "anr";
      const showsScreen = (e: any) =>
        e.event_type === "screen_view"
          ? e.name === screen
          : e.event_type.startsWith("lifecycle_") && e.class_name === screen;
      const cases: [string, (s: Session) => boolean][] = [
        [
          "session_events:in:bug_report",
          (s) => some(s, (e) => e.event_type === "bug_report"),
        ],
        ["session_events:not_in:[fatal_error,anr]", (s) => !some(s, isFatal)],
        [
          "session_foreground_background:in:background",
          (s) =>
            some(
              s,
              (e) =>
                e.event_type === "lifecycle_app" && e.type === "background",
            ),
        ],
        [
          `session_custom_event:in:${quoted(custom)}`,
          (s) => some(s, (e) => e.event_type === "custom" && e.name === custom),
        ],
        [
          `session_log:contains:${quoted(log)}`,
          (s) => some(s, (e) => e.event_type === "log" && e.body === log),
        ],
        [`session_screen:in:${quoted(screen)}`, (s) => some(s, showsScreen)],
        [
          `session_error_text:contains:${quoted(message)}`,
          (s) => some(s, (e) => e.message === message),
        ],
        [`device_total_memory:in:${tier}`, (s) => tierOf(s) === tier],
      ];
      const ids = (rows: { session_id: string }[]) =>
        rows.map((r) => r.session_id).sort();
      for (const [filterExpr, carries] of cases) {
        const { json } = await fetchJson(
          `/api/apps/${keyed.app.id}/sessions?${wideRangeParams({ limit: "50", offset: "0", filter_expr: filterExpr })}`,
        );
        expect(ids(json.results)).toEqual(
          ids(sessions.filter(carries).map((s) => s.list)),
        );
      }
      const highUsage = (extra: Record<string, string>) =>
        fetchJson(
          `/api/apps/${keyed.app.id}/memory/sessions/highUsage?${wideRangeParams({ limit: "50", offset: "0", ...extra })}`,
        );
      const { json: high } = await highUsage({});
      const highTier = deviceMemoryTier(
        high.results[0].attribute.device_total_memory,
      );
      const { json: highByTier } = await highUsage({
        filter_expr: `device_total_memory:in:${highTier}`,
      });
      expect(ids(highByTier.results)).toEqual(
        ids(
          high.results.filter(
            (r: any) =>
              deviceMemoryTier(r.attribute.device_total_memory) === highTier,
          ),
        ),
      );
    },
  },
  {
    name: "returns no sessions for a range with none",
    path: `/api/apps/${APP_ID}/sessions?from=1990-01-01T00:00:00.000Z&to=1990-01-02T00:00:00.000Z&limit=5&offset=0`,
    status: 200,
    check: (data) =>
      expectPage(data, { length: 0, next: false, previous: false }),
  },
  {
    name: "resolves every listed session id, including the fatal crash and anr flavors, on GET /sessions/:sessionId",
    path: `${SESSIONS_BASE}&limit=${sessionCount}&offset=0`,
    status: 200,
    check: async (listData) => {
      expect(listData.results.length).toBe(sessionCount);
      let foundCrash = false;
      let foundAnr = false;
      for (const session of listData.results) {
        const { res, json: detail } = await fetchJson(
          `/api/apps/${APP_ID}/sessions/${session.session_id}`,
        );
        expect(res.status).toBe(200);
        expect(detail.session_id).toBe(session.session_id);
        expect(detail.app_id).toBe(APP_ID);
        expect(detail.attribute.app_version).toBe(
          session.attribute.app_version,
        );
        expect(detail.threads.main.length).toBeGreaterThan(0);
        const eventTypes = detail.threads.main.map((e: any) => e.event_type);
        if (eventTypes.includes("error")) {
          foundCrash = true;
        }
        if (eventTypes.includes("anr")) {
          foundAnr = true;
        }
      }
      expect(foundCrash).toBe(true);
      expect(foundAnr).toBe(true);
    },
  },
  {
    name: "returns 404 for an unknown session id",
    path: `/api/apps/${APP_ID}/sessions/does-not-exist`,
    status: 404,
    check: (data) => expect(data.error).toEqual(expect.any(String)),
  },
];

const ERROR_GROUPS_BASE = `/api/apps/${APP_ID}/errorGroups`;
const firstGroup = bundle.errorGroups[0];
const multiVersionGroup = bundle.errorGroups.find(
  (g) => new Set(g.instances.map((i) => i.attribute.app_version)).size > 1,
)!;
const multiVersionInstance = multiVersionGroup.instances[0];

const errorsCases: Case[] = [
  {
    name: "lists crash and ANR groups together, without their instances",
    path: `${ERROR_GROUPS_BASE}?limit=200&offset=0`,
    status: 200,
    check: (data) => {
      expect(data.results).toHaveLength(bundle.errorGroups.length);
      expect(new Set(data.results.map((g: any) => g.error_type))).toEqual(
        new Set(["exception", "anr"]),
      );
      for (const group of data.results) {
        expect(group.instances).toBeUndefined();
        expect(group.screen).toBeUndefined();
      }
    },
  },
  {
    name: "narrows the errorGroups list with filter_expr",
    path: withFilter(
      `${ERROR_GROUPS_BASE}?limit=200&offset=0&include_trend=true`,
      "error_type:in:ANR",
    ),
    status: 200,
    check: async (data) => {
      await expectNarrowsAgainst(
        `${ERROR_GROUPS_BASE}?limit=200&offset=0`,
        data,
        (g) => expect(g.error_type).toBe("anr"),
      );
      for (const g of data.results) {
        expect(
          g.trend.reduce((sum: number, p: any) => sum + p.instances, 0),
        ).toBe(g.count);
      }
    },
  },
  {
    name: "leaves the trend out of the errorGroups list unless asked for",
    path: `${ERROR_GROUPS_BASE}?limit=200&offset=0`,
    status: 200,
    check: (data) => {
      expect(data.results.length).toBeGreaterThan(0);
      expect(data.meta.plot_time_group).toBeUndefined();
      for (const g of data.results) {
        expect(g.trend).toBeUndefined();
      }
    },
  },
  {
    name: "returns an empty errorGroups list, not an error, when filter_expr matches nothing",
    path: withFilter(
      `${ERROR_GROUPS_BASE}?limit=200&offset=0`,
      "version_name:in:9.9.9",
    ),
    status: 200,
    check: (data) => expectEmpty(data),
  },
  {
    name: "paginates a group's instances one at a time",
    path: `${ERROR_GROUPS_BASE}/${firstGroup.id}/errors?limit=1&offset=0&${wideRangeParams().toString()}`,
    status: 200,
    check: (data) => {
      expect(data.results).toHaveLength(1);
      expect(data.results[0].id).toBe(firstGroup.instances[0].id);
    },
  },
  {
    name: "narrows a group's instances to the filtered version",
    path: withFilter(
      `${ERROR_GROUPS_BASE}/${multiVersionGroup.id}/errors?limit=50&offset=0&${wideRangeParams().toString()}`,
      `version_name:in:${multiVersionInstance.attribute.app_version}`,
    ),
    status: 200,
    check: (data) => {
      expect(data.results.length).toBeGreaterThan(0);
      expect(data.results.length).toBeLessThan(
        multiVersionGroup.instances.length,
      );
      for (const instance of data.results) {
        expect(instance.attribute.app_version).toBe(
          multiVersionInstance.attribute.app_version,
        );
      }
    },
  },
  {
    name: "returns 404 for an unknown error group's instances",
    path: `${ERROR_GROUPS_BASE}/does-not-exist/errors`,
    status: 404,
  },
];

const BUG_REPORTS_BASE = `/api/apps/${APP_ID}/bugReports?${wideRangeParams().toString()}`;
const firstBugReport = bundle.bugReports[0];

const bugReportsCases: Case[] = [
  {
    name: "lists bug reports without attachments",
    path: `${BUG_REPORTS_BASE}&limit=200&offset=0`,
    status: 200,
    check: (data) => {
      expect(data.results.length).toBe(bundle.bugReports.length);
      for (const report of data.results) {
        expect(report.attachments).toBeNull();
      }
    },
  },
  {
    name: "returns an empty bugReports list, not an error, when filter_expr matches nothing",
    path: withFilter(
      `${BUG_REPORTS_BASE}&limit=200&offset=0`,
      "bug_report_status:in:archived",
    ),
    status: 200,
    check: (data) => expectEmpty(data),
  },
  {
    name: "scales the bugReports plot's total from dailySessions and the sample's bug-report rate",
    path: `/api/apps/${APP_ID}/bugReports/plots/instances?${wideRangeParams({ plot_time_group: "days" }).toString()}`,
    status: 200,
    check: (data) => {
      const total = data.reduce(
        (sum: number, series: any) =>
          sum + series.data.reduce((a: number, p: any) => a + p.instances, 0),
        0,
      );
      const expected = dailyBugReports(bundle.scenario.app) * 30;
      expect(total).toBeGreaterThan(expected * 0.85);
      expect(total).toBeLessThan(expected * 1.15);
    },
  },
  {
    name: "returns a bug report's detail with attachments",
    path: `/api/apps/${APP_ID}/bugReports/${firstBugReport.event_id}`,
    status: 200,
    check: (data) => {
      expect(data.event_id).toBe(firstBugReport.event_id);
      expect(data.attachments.length).toBeGreaterThan(0);
    },
  },
  {
    name: "returns 404 for an unknown bug report id",
    path: `/api/apps/${APP_ID}/bugReports/does-not-exist`,
    status: 404,
  },
  {
    name: "succeeds and forgets a bug report status PATCH",
    method: "PATCH",
    path: `/api/apps/${APP_ID}/bugReports/${firstBugReport.event_id}`,
    body: { status: 1 - firstBugReport.status },
    status: 200,
    check: async () => {
      const { json } = await fetchJson(
        `/api/apps/${APP_ID}/bugReports/${firstBugReport.event_id}`,
      );
      expect(json.status).toBe(firstBugReport.status);
    },
  },
];

const rootSpan = bundle.rootSpanNames[0];
const SPANS_BASE = `/api/apps/${APP_ID}/spans?span_name=${encodeURIComponent(rootSpan)}&${wideRangeParams().toString()}`;

const tracesCases: Case[] = [
  {
    name: "returns one plot point per bucket for a root span name on GET /spans/plots/metrics",
    path: `/api/apps/${APP_ID}/spans/plots/metrics?span_name=${encodeURIComponent(rootSpan)}&from=2000-01-01T00:00:00.000Z&to=2100-01-01T00:00:00.000Z&plot_time_group=months`,
    status: 200,
    check: (data) => {
      const labels = bundle.scenario.app.versions.map(
        (v) => `${v.name} (${v.code})`,
      );
      expect(data.length).toBeGreaterThan(0);
      for (const series of data) {
        expect(labels).toContain(series.id);
        for (const point of series.data) {
          expect(typeof point.datetime).toBe("string");
        }
      }
    },
  },
  {
    name: "lists spans for a root span name, most recent first",
    path: `${SPANS_BASE}&limit=50&offset=0`,
    status: 200,
    check: (data) => {
      expect(data.results.length).toBeGreaterThan(0);
      expect(data.results.every((r: any) => r.span_name === rootSpan)).toBe(
        true,
      );
      const starts = data.results.map((r: any) => r.start_time);
      expect([...starts].sort().reverse()).toEqual(starts);
    },
  },
  {
    name: "returns an empty spans list, not an error, when filter_expr matches nothing",
    path: withFilter(
      `${SPANS_BASE}&limit=50&offset=0`,
      "version_name:in:9.9.9",
    ),
    status: 200,
    check: (data) => expectEmpty(data),
  },
  {
    name: "returns a trace by id matching a row from the spans list, with more than one span",
    path: `${SPANS_BASE}&limit=1&offset=0`,
    status: 200,
    check: async (list) => {
      const traceId = list.results[0].trace_id;
      const { res, json: trace } = await fetchJson(
        `/api/apps/${APP_ID}/traces/${traceId}`,
      );
      expect(res.status).toBe(200);
      expect(trace.trace_id).toBe(traceId);
      expect(trace.spans.length).toBeGreaterThan(1);
      expect(trace.spans.some((s: any) => s.parent_id === "")).toBe(true);
    },
  },
  {
    name: "returns 404 for an unknown trace id",
    path: `/api/apps/${APP_ID}/traces/does-not-exist`,
    status: 404,
  },
];

const ENDPOINTS_BASE = `/api/apps/${APP_ID}/networkRequests/endpoints`;
const endpoints = Array.from(bundle.networkEndpoints.values());
const firstEndpoint = endpoints[0];
const endpointParams = `domain=${firstEndpoint.domain}&path=${encodeURIComponent(firstEndpoint.path)}`;

const networkCases: Case[] = [
  {
    name: "lists every endpoint the sessions called",
    path: ENDPOINTS_BASE,
    status: 200,
    check: (data) => {
      expect(data.results.length).toBe(endpoints.length);
      for (const endpoint of endpoints) {
        expect(data.results).toContainEqual({
          domain: endpoint.domain,
          path_pattern: endpoint.path,
        });
      }
    },
  },
  {
    name: "narrows endpoints by the query param",
    path: `${ENDPOINTS_BASE}?query=${encodeURIComponent(firstEndpoint.path)}`,
    status: 200,
    check: (data) => {
      expect(data.results.length).toBeGreaterThan(0);
      expect(data.results.length).toBeLessThan(endpoints.length);
      for (const result of data.results) {
        expect(result.path_pattern).toContain(firstEndpoint.path);
      }
    },
  },
  {
    name: "returns an empty endpoint list, not an error, when filter_expr matches nothing",
    path: withFilter(ENDPOINTS_BASE, "http_method:in:put"),
    status: 200,
    check: (data) => expectEmpty(data),
  },
  {
    name: "returns a latency series for an endpoint",
    path: `/api/apps/${APP_ID}/networkRequests/plots/latency?from=2000-01-01T00:00:00.000Z&to=2100-01-01T00:00:00.000Z&plot_time_group=months&${endpointParams}`,
    status: 200,
    check: (data) => {
      expect(data.length).toBeGreaterThan(0);
      const total = data.reduce((sum: number, p: any) => sum + p.count, 0);
      expect(total).toBeGreaterThan(0);
    },
  },
  {
    name: "returns an empty latency series for an endpoint that does not exist",
    path: `/api/apps/${APP_ID}/networkRequests/plots/latency?from=2026-04-01T00:00:00.000Z&to=2026-04-02T00:00:00.000Z&domain=unknown.example.com&path=/nope`,
    status: 200,
    check: (data) => expect(data).toEqual([]),
  },
  {
    name: "returns timeline points scoped to the selected endpoint",
    path: `/api/apps/${APP_ID}/networkRequests/plots/timeline?${endpointParams}`,
    status: 200,
    check: (data) => {
      expect(data.interval).toEqual(expect.any(Number));
      expect(data.points.length).toBeGreaterThan(0);
      expect(
        data.points.every((p: any) => p.domain === firstEndpoint.domain),
      ).toBe(true);
    },
  },
  {
    name: "returns trends sorted by latency, error rate and frequency",
    path: `/api/apps/${APP_ID}/networkRequests/trends`,
    status: 200,
    check: (data) => {
      expect(data.trends_latency.length).toBeGreaterThan(0);
      for (let i = 1; i < data.trends_latency.length; i++) {
        expect(data.trends_latency[i - 1].p95_latency).toBeGreaterThanOrEqual(
          data.trends_latency[i].p95_latency,
        );
      }
    },
  },
];

const writeCalls: [string, string, unknown?][] = [
  [`/api/apps/${APP_ID}/config`, "PATCH", { trace_sampling_rate: 25 }],
  [`/api/apps/${APP_ID}/retention`, "PATCH", { retention: 30 }],
  [`/api/apps/${APP_ID}/rename`, "PATCH", { name: "New name" }],
  [`/api/apps/${APP_ID}/apiKey`, "PATCH"],
  [`/api/apps/${APP_ID}/builds/build-file-001/download`, "GET"],
  ["/api/auth/validateInvite", "POST", { invite_id: "x" }],
  [`/api/teams/${TEAM_ID}/invite`, "POST"],
  [`/api/teams/${TEAM_ID}/invite/invite-1`, "PATCH"],
  [`/api/teams/${TEAM_ID}/invite/invite-1`, "DELETE"],
  [`/api/teams/${TEAM_ID}/members/user-1`, "DELETE"],
  [`/api/teams/${TEAM_ID}/members/user-1/role`, "PATCH"],
  [`/api/teams/${TEAM_ID}/rename`, "PATCH"],
  [`/api/teams/${TEAM_ID}/slack/connect-url`, "GET"],
  [`/api/teams/${TEAM_ID}/slack/status`, "PATCH"],
  [`/api/teams/${TEAM_ID}/slack`, "DELETE"],
  [`/api/teams/${TEAM_ID}/slack/test`, "POST"],
  [`/api/teams/${TEAM_ID}/billing/checkout`, "PATCH"],
  [`/api/teams/${TEAM_ID}/billing/downgrade`, "PATCH"],
  [`/api/teams/${TEAM_ID}/billing/undo-downgrade`, "PATCH"],
  [`/api/teams/${TEAM_ID}/billing/portal`, "POST"],
];

const buildVersions = new Set([
  bundle.scenario.app.candidate.name,
  ...bundle.scenario.app.versions.map((v) => v.name),
]);

function sinceCreationParams(extra: Record<string, string> = {}) {
  return new URLSearchParams({
    from: world.builtAt
      .minus({ days: bundle.scenario.app.createdDaysAgo })
      .toISO()!,
    to: world.builtAt.toISO()!,
    ...extra,
  });
}
const mappedApp = world.apps
  .map((a) => world.appById.get(a.id)!)
  .find((b) => b.scenario.app.mappingTypes.length > 1)!;

const settingsCases: Case[] = [
  {
    name: "lists alerts of the kinds the alerts page renders",
    path: `/api/apps/${APP_ID}/alerts?${wideRangeParams({ limit: "200", offset: "0" }).toString()}`,
    status: 200,
    check: (data) => {
      expect(data.results.length).toBe(bundle.alerts.length);
      for (const alert of data.results) {
        expect(["crash_spike", "anr_spike", "bug_report"]).toContain(
          alert.type,
        );
      }
    },
  },
  {
    name: "returns nothing outside the alerts' time span",
    path: (() => {
      const to = DateTime.now().minus({ years: 5 });
      const params = new URLSearchParams({
        from: to.minus({ hours: 6 }).toISO()!,
        to: to.toISO()!,
        timezone: "UTC",
        limit: "5",
        offset: "0",
      });
      return `/api/apps/${APP_ID}/alerts?${params.toString()}`;
    })(),
    status: 200,
    check: (data) => expect(data.results).toHaveLength(0),
  },
  {
    name: "sdk config GET carries every key of the SdkConfig type",
    path: `/api/apps/${APP_ID}/config`,
    status: 200,
    check: (data) => {
      const keys: Record<keyof SdkConfig, true> = {
        trace_sampling_rate: true,
        error_replay_duration: true,
        error_fatal_take_screenshot: true,
        error_fatal_replay_enabled: true,
        error_unhandled_replay_enabled: true,
        error_handled_replay_enabled: true,
        error_fatal_sampling_rate: true,
        error_unhandled_sampling_rate: true,
        error_handled_sampling_rate: true,
        anr_timeline_duration: true,
        anr_take_screenshot: true,
        bug_report_timeline_duration: true,
        launch_sampling_rate: true,
        journey_sampling_rate: true,
        http_sampling_rate: true,
        http_disable_event_for_urls: true,
        http_track_request_for_urls: true,
        http_track_response_for_urls: true,
        http_blocked_headers: true,
        screenshot_mask_level: true,
        profile_sampling_rate: true,
        memory_usage_interval: true,
        memory_usage_background_interval: true,
        memory_usage_session_sampling_rate: true,
        log_autocollect_enabled: true,
        log_min_severity: true,
        log_ignore_patterns: true,
      };
      expect(Object.keys(data).sort()).toEqual(Object.keys(keys).sort());
    },
  },
  {
    name: "threshold prefs GET returns prefs, PATCH is disabled",
    path: `/api/apps/${APP_ID}/thresholdPrefs`,
    status: 200,
    check: async (data) => {
      expect(data.error_good_threshold).toEqual(expect.any(Number));
      const { res } = await fetchJson(`/api/apps/${APP_ID}/thresholdPrefs`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      expect(res.status).toBe(403);
    },
  },
  {
    name: "retention GET returns a retention fixture",
    path: `/api/apps/${APP_ID}/retention`,
    status: 200,
    check: (data) => expect(data.retention).toEqual(expect.any(Number)),
  },
  {
    name: "lists builds across every version the app carries",
    path: `/api/apps/${APP_ID}/builds?${sinceCreationParams({ limit: "10", offset: "0" }).toString()}`,
    status: 200,
    check: (data) => {
      const versions = new Set(data.results.map((b: any) => b.version_name));
      expect(versions).toEqual(buildVersions);
      expect(data.results[0].files[0]).toMatchObject({
        mapping_type: bundle.scenario.app.mappingTypes[0],
      });
    },
  },
  {
    name: "narrows the builds list with filter_expr",
    path: `/api/apps/${APP_ID}/builds?${wideRangeParams({ limit: "10", offset: "0", filter_expr: `version_name:in:${latestVersion}` }).toString()}`,
    status: 200,
    check: (data) => {
      expect(data.results.length).toBeGreaterThan(0);
      expect(data.results.length).toBeLessThan(buildVersions.size);
      for (const build of data.results) {
        expect(build.version_name).toBe(latestVersion);
      }
    },
  },
  {
    name: "lists only the build files that match the filter",
    path: `/api/apps/${mappedApp.app.id}/builds?${wideRangeParams({ limit: "10", offset: "0", filter_expr: `mapping_type:in:${mappedApp.scenario.app.mappingTypes[1]}` }).toString()}`,
    status: 200,
    check: (data) => {
      expect(data.results.length).toBeGreaterThan(0);
      for (const build of data.results) {
        expect(build.files.map((f: any) => f.mapping_type)).toEqual([
          mappedApp.scenario.app.mappingTypes[1],
        ]);
      }
    },
  },
  {
    name: "GET team invites returns an empty list",
    path: `/api/teams/${TEAM_ID}/invites`,
    status: 200,
    check: (data) => expect(data).toEqual([]),
  },
  {
    name: "GET slack status reports a connected, active workspace",
    path: `/api/teams/${TEAM_ID}/slack`,
    status: 200,
    check: (data) => {
      expect(data.slack_team_name).toEqual(expect.any(String));
      expect(data.is_active).toBe(true);
      expect(data.needs_reauth).toBe(false);
    },
  },
  {
    name: "notification prefs GET returns prefs, PATCH is disabled",
    path: "/api/prefs/notifPrefs",
    status: 200,
    check: async (prefs) => {
      expect(prefs).toMatchObject({
        error_spike: expect.any(Boolean),
        app_hang_spike: expect.any(Boolean),
        bug_report: expect.any(Boolean),
        daily_summary: expect.any(Boolean),
      });
      const { res } = await fetchJson("/api/prefs/notifPrefs", {
        method: "PATCH",
        body: JSON.stringify({ ...prefs, bug_report: true }),
      });
      expect(res.status).toBe(403);
    },
  },
  {
    name: "GET usage reports the last three months of sessions, events and spans for every app",
    path: `/api/teams/${TEAM_ID}/usage`,
    status: 200,
    check: (data) => {
      expect(data.map((u: any) => u.app_id).sort()).toEqual(
        world.apps.map((a) => a.id).sort(),
      );
      for (const usage of data) {
        expect(usage.monthly_app_usage).toHaveLength(3);
        for (const month of usage.monthly_app_usage) {
          expect(month.sessions).toBeGreaterThan(0);
          expect(month.events).toBeGreaterThan(month.sessions);
          expect(month.spans).toBeGreaterThan(0);
        }
      }
    },
  },
  {
    name: "GET billing info reports the bytes the usage page adds up",
    path: `/api/teams/${TEAM_ID}/billing/info`,
    status: 200,
    check: (data) => {
      expect(data.plan).toBe("pro");
      expect(data.bytes_used).toBeLessThan(data.bytes_granted);
      const thisMonth = Array.from(world.appById.values()).reduce(
        (sum, b) => sum + b.usage.monthly_app_usage.slice(-1)[0].bytes_in,
        0,
      );
      expect(data.bytes_used).toBe(thisMonth);
    },
  },
  ...writeCalls.map(
    ([path, method, body]): Case => ({
      name: `${method} ${path} is disabled`,
      method,
      path,
      body,
      status: 403,
    }),
  ),
];

describe("general sandbox routes", () => {
  it.each(generalCases)("$name", run);
});

describe("overview sandbox routes", () => {
  it.each(overviewCases)("$name", run);
});

describe("sandbox sessions routes", () => {
  it.each(sessionsCases)("$name", run);
});

describe("sandbox errorGroups routes", () => {
  it.each(errorsCases)("$name", run);
});

describe("sandbox bugReports routes", () => {
  it.each(bugReportsCases)("$name", run);
});

describe("traces sandbox routes", () => {
  it.each(tracesCases)("$name", run);
});

describe("network sandbox routes", () => {
  it.each(networkCases)("$name", run);
});

describe("sandbox settings routes", () => {
  it.each(settingsCases)("$name", run);
});

const sixHourRange = rangeParams(6 * 60);

describe.each(Array.from(world.appById.values()))(
  "six-hour coverage: $app.name",
  (appBundle) => {
    const id = appBundle.app.id;

    it("shows sessions on both recent versions, every error group, every root span, the bug reports, a build and an alert", async () => {
      const { json: sessions } = await fetchJson(
        `/api/apps/${id}/sessions?${sixHourRange}&limit=10&offset=0`,
      );
      expect(sessions.results.length).toBeGreaterThan(0);
      const versionsSeen = new Set(
        sessions.results.map((s: any) => s.attribute.app_version),
      );
      expect(versionsSeen.has(appBundle.scenario.app.versions[0].name)).toBe(
        true,
      );
      expect(versionsSeen.has(appBundle.scenario.app.versions[1].name)).toBe(
        true,
      );
      const { json: groups } = await fetchJson(
        `/api/apps/${id}/errorGroups?${sixHourRange}&limit=200&offset=0`,
      );
      expect(groups.results).toHaveLength(appBundle.errorGroups.length);
      for (const spanName of appBundle.rootSpanNames) {
        const { json } = await fetchJson(
          `/api/apps/${id}/spans?span_name=${encodeURIComponent(spanName)}&${sixHourRange}&limit=50&offset=0`,
        );
        expect(json.results.length).toBeGreaterThan(0);
      }
      const { json: bugReports } = await fetchJson(
        `/api/apps/${id}/bugReports?${sixHourRange}&limit=10&offset=0`,
      );
      const sixHoursAgo = DateTime.utc().minus({ hours: 6 }).toISO()!;
      const recentReports = appBundle.bugReports.filter(
        (r) => r.timestamp >= sixHoursAgo,
      );
      expect(recentReports.length).toBeGreaterThan(0);
      expect(bugReports.results.length).toBe(recentReports.length);
      const { json: bugReportPlot } = await fetchJson(
        `/api/apps/${id}/bugReports/plots/instances?${sixHourRange}`,
      );
      expect(
        bugReportPlot[0].data.reduce(
          (sum: number, p: any) => sum + p.instances,
          0,
        ),
      ).toBeGreaterThan(0);
      const { json: builds } = await fetchJson(
        `/api/apps/${id}/builds?${sixHourRange}&limit=10&offset=0`,
      );
      expect(builds.results.length).toBeGreaterThan(0);
      const { json: alerts } = await fetchJson(
        `/api/apps/${id}/alerts?${sixHourRange}&limit=10&offset=0`,
      );
      expect(alerts.results.length).toBeGreaterThan(0);
    });

    it("opens every group listed over a range to at least one instance in that range", async () => {
      for (const minutes of [15, 60, 6 * 60, 24 * 60, 7 * 24 * 60]) {
        const params = rangeParams(minutes);
        const { json: list } = await fetchJson(
          `/api/apps/${id}/errorGroups?${params}&limit=200&offset=0`,
        );
        for (const group of list.results) {
          const { json } = await fetchJson(
            `/api/apps/${id}/errorGroups/${group.id}/errors?${params}&limit=50&offset=0`,
          );
          expect([minutes, group.type, json.results.length > 0]).toEqual([
            minutes,
            group.type,
            true,
          ]);
        }
      }
    });
  },
);
