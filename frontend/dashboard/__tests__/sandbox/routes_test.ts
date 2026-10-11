import { handleSandboxRequest } from "@/app/sandbox/handlers";
import { catalog, dailyBugReports } from "@/app/sandbox/catalog";
import type { SdkConfig } from "@/app/api/api_calls";
import {
  DEVICE_MEMORY_TIERS,
  deviceMemoryTier,
} from "@/app/sandbox/device_memory";
import { afterEach, describe, expect, it } from "@jest/globals";
import { existsSync } from "fs";
import { DateTime } from "luxon";
import path from "path";

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
    name: "returns developer authz with every write disabled on GET /api/teams/sandbox/authz",
    path: `/api/teams/${TEAM_ID}/authz`,
    status: 200,
    check: (data) => {
      expect(data.can_create_app).toBe(false);
      expect(data.can_rename_team).toBe(false);
      expect(data.can_manage_slack).toBe(false);
      expect(data.can_change_billing).toBe(false);
      expect(data.can_invite_roles).toEqual(["developer", "viewer"]);
      expect(data.members.map((member: any) => member.role)).toEqual([
        "developer",
        "owner",
        "admin",
      ]);
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
  funnels: [...VERSION_KEYS, ...DEVICE_KEYS],
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
  profiles: [
    "profile_trigger",
    ...VERSION_KEYS,
    "user_id",
    "os_version",
    "device_name",
    "device_manufacturer",
  ],
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

const iosApp = world.apps
  .map((a) => world.appById.get(a.id)!)
  .find((b) => b.scenario.app.os !== "android")!;
const profilesPath = `/api/apps/${APP_ID}/profiles?${wideRangeParams({ limit: "10", offset: "0" }).toString()}`;

const profilesCases: Case[] = [
  {
    name: "lists an Android app's ANR and app fully drawn profiles, newest first",
    path: profilesPath,
    status: 200,
    check: (data) => {
      expect(data.results.map((p: any) => p.trigger).sort()).toEqual([
        "anr",
        "app_fully_drawn",
      ]);
      expect(data.results[0].timestamp >= data.results[1].timestamp).toBe(true);
      const sessionIds = bundle.sessions.map((s) => s.list.session_id);
      for (const profile of data.results) {
        expect(sessionIds).toContain(profile.session_id);
      }
    },
  },
  {
    name: "serves each profile's trace from the public folder",
    path: profilesPath,
    status: 200,
    check: (data) => {
      for (const profile of data.results) {
        const [attachment] = profile.attachments;
        expect(
          existsSync(path.join(process.cwd(), "public", attachment.location)),
        ).toBe(true);
      }
    },
  },
  {
    name: "writes each profile into its session's timeline",
    path: profilesPath,
    status: 200,
    check: async (data) => {
      for (const profile of data.results) {
        const { json: detail } = await fetchJson(
          `/api/apps/${APP_ID}/sessions/${profile.session_id}`,
        );
        const profileEvents = Object.values(detail.threads)
          .flat()
          .filter((event: any) => event.event_type === "profile");
        expect(profileEvents).toContainEqual(
          expect.objectContaining({
            trigger: profile.trigger,
            timestamp: profile.timestamp,
          }),
        );
      }
    },
  },
  {
    name: "filters profiles by trigger",
    path: withFilter(profilesPath, "profile_trigger:in:[anr]"),
    status: 200,
    check: (data) => {
      expect(data.results.map((p: any) => p.trigger)).toEqual(["anr"]);
    },
  },
  {
    name: "suggests the profile triggers the app has",
    path: `/api/apps/${APP_ID}/filters/values?entity=profiles&key_name=profile_trigger`,
    status: 200,
    check: (data) => {
      expect(data.values.map((v: any) => v.text).sort()).toEqual([
        "anr",
        "app_fully_drawn",
      ]);
    },
  },
  {
    name: "lists no profiles for an app that is not on Android",
    path: `/api/apps/${iosApp.app.id}/profiles?${wideRangeParams({ limit: "10", offset: "0" }).toString()}`,
    status: 200,
    check: (data) => expectEmpty(data),
  },
  {
    name: "returns nothing outside the profiles' time span",
    path: `/api/apps/${APP_ID}/profiles?${EMPTY_RANGE}&limit=10&offset=0`,
    status: 200,
    check: (data) => expectEmpty(data),
  },
];

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
        app_hang_threshold_millis: true,
        app_hang_timeline_duration: true,
        app_hang_sampling_rate: true,
        app_hang_replay_enabled: true,
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
    name: "sdk config history GET returns two pages of changes",
    path: `/api/apps/${APP_ID}/config/history?limit=5&offset=0`,
    status: 200,
    check: async (data) => {
      expectPage(data, { length: 5, next: true, previous: false });
      const { json } = await fetchJson(
        `/api/apps/${APP_ID}/config/history?limit=5&offset=5`,
      );
      expect(json.results.length).toBeGreaterThan(0);
      expect(json.meta.next).toBe(false);
      expect(json.meta.previous).toBe(true);
    },
  },
  {
    name: "sdk config history of every app is consistent with its config, its owners and admins, and its creation date",
    path: `/api/teams/${TEAM_ID}/authz`,
    status: 200,
    check: async (authz) => {
      const writers = authz.members
        .filter((member: any) => ["owner", "admin"].includes(member.role))
        .map((member: any) => member.email);
      for (const app of world.apps) {
        const { json: config } = await fetchJson(`/api/apps/${app.id}/config`);
        const { json: history } = await fetchJson(
          `/api/apps/${app.id}/config/history`,
        );
        expect(history.results.length).toBeGreaterThanOrEqual(6);
        expect(history.results.length).toBeLessThanOrEqual(8);

        const oldestFirst = [...history.results].reverse();
        const current: Record<string, unknown> = {};
        let previousAt = DateTime.fromISO(app.created_at);
        for (const change of oldestFirst) {
          const changedAt = DateTime.fromISO(change.changed_at);
          expect(changedAt > previousAt).toBe(true);
          previousAt = changedAt;
          expect(writers).toContain(change.changed_by_email);
          for (const [field, { old, new: next }] of Object.entries<any>(
            change.changes,
          )) {
            expect(old).not.toEqual(next);
            if (field in current) {
              expect(old).toEqual(current[field]);
            }
            current[field] = next;
          }
        }
        expect(previousAt < world.builtAt).toBe(true);
        for (const [field, value] of Object.entries(current)) {
          expect(value).toEqual(config[field]);
        }
      }
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

const FUNNELS_BASE = `/api/apps/${APP_ID}/funnels`;
const SEEDED_PINS = ["Checkout", "Search to order", "Open to purchase"];
const noLoginApp = world.apps
  .map((a) => world.appById.get(a.id)!)
  .find(
    (b) =>
      !b.sessions.some((s) =>
        Object.values(s.detail.threads)
          .flat()
          .some((e) => e.name === "login_succeeded"),
      ),
  )!;
const segmentApp = world.apps
  .map((a) => world.appById.get(a.id)!)
  .find((b) =>
    Array.from(b.networkEndpoints.values()).some((e) =>
      e.path.endsWith("/payment-methods"),
    ),
  )!;

function allFunnelsPath(appId: string = APP_ID) {
  return `/api/apps/${appId}/funnels?limit=100&offset=0`;
}

function named(page: any, name: string) {
  return page.results.find((f: any) => f.name === name);
}

async function funnelsOf(appId: string = APP_ID): Promise<any[]> {
  const { json } = await fetchJson(allFunnelsPath(appId));
  return json.results;
}

async function funnelNamed(name: string, appId: string = APP_ID) {
  const { json } = await fetchJson(allFunnelsPath(appId));
  return named(json, name);
}

async function pinnedNames(appId: string = APP_ID): Promise<string[]> {
  const { json } = await fetchJson(`/api/apps/${appId}/funnels/pinned`);
  return json.results.map((f: any) => f.name);
}

// The sandbox keeps pins in memory, so each case starts from the seeded pins
// even after a case that failed midway.
async function restoreSeededPins() {
  for (const app of world.apps) {
    const base = `/api/apps/${app.id}/funnels`;
    const funnels = await funnelsOf(app.id);
    for (const funnel of funnels) {
      const method = SEEDED_PINS.includes(funnel.name) ? "PUT" : "DELETE";
      await fetchJson(`${base}/${funnel.id}/pin`, { method });
    }
    const ids = SEEDED_PINS.map(
      (name) => funnels.find((f) => f.name === name)!.id,
    );
    await fetchJson(`${base}/pinned`, {
      method: "PUT",
      body: JSON.stringify({ funnel_ids: ids }),
    });
  }
}

async function funnelUsers(funnel: any, range: string): Promise<number[]> {
  const { json } = await fetchJson(
    `/api/apps/${funnel.app_id}/funnels/${funnel.id}/conversion?${range}`,
  );
  return json.steps.map((s: any) => s.users);
}

function stepParams(step: number | null, extra: Record<string, string> = {}) {
  return wideRangeParams({
    ...(step === null ? {} : { step: String(step) }),
    limit: "100",
    offset: "0",
    ...extra,
  }).toString();
}

function expectNonIncreasing(values: number[]) {
  for (let i = 1; i < values.length; i++) {
    expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
  }
}

function expectStepOutcomes(rows: any[], users: number[], step: number) {
  for (const row of rows) {
    expect(row.dropped + row.converted).toBeGreaterThan(0);
    expect(row.dropped).toBeLessThanOrEqual(users[step - 1] - users[step]);
    expect(row.converted).toBeLessThanOrEqual(users[step]);
  }
}

const funnelsCases: Case[] = [
  {
    name: "lists an app's funnels, most recently updated first, each made by an owner or admin",
    path: `/api/teams/${TEAM_ID}/authz`,
    status: 200,
    check: async (authz) => {
      const writers = authz.members.filter((member: any) =>
        ["owner", "admin"].includes(member.role),
      );
      const funnels = await funnelsOf();
      expect(funnels.length).toBeGreaterThan(0);
      expect(new Set(funnels.map((f) => f.id)).size).toBe(funnels.length);
      const updated = funnels.map((f) => f.updated_at);
      expect(updated).toEqual([...updated].sort().reverse());
      for (const funnel of funnels) {
        expect(funnel.app_id).toBe(APP_ID);
        expect(funnel.steps.length).toBeGreaterThanOrEqual(2);
        expect(funnel.conversion_window_seconds).toBeGreaterThan(0);
        expect(funnel.created_at <= funnel.updated_at).toBe(true);
        expect(funnel.updated_at <= world.builtAt.toISO()!).toBe(true);
        expect(writers).toContainEqual(
          expect.objectContaining({
            id: funnel.created_by,
            email: funnel.created_by_email,
          }),
        );
      }
    },
  },
  {
    name: "lists the login funnels only for an app whose users sign in",
    path: allFunnelsPath(noLoginApp.app.id),
    status: 200,
    check: async (data) => {
      const startsAtLogin = (f: any) =>
        f.steps.some((s: any) => s.event_name.startsWith("login_"));
      expect(data.results.length).toBeGreaterThan(0);
      expect(data.results.some(startsAtLogin)).toBe(false);
      const withLogin = await funnelsOf();
      expect(withLogin.some(startsAtLogin)).toBe(true);
      expect(data.results.map((f: any) => f.name)).toEqual(
        withLogin.filter((f) => !startsAtLogin(f)).map((f) => f.name),
      );
    },
  },
  {
    name: "searches funnel names without regard to case",
    path: `${FUNNELS_BASE}?search=ORDER&limit=100&offset=0`,
    status: 200,
    check: async (data) => {
      const all = await funnelsOf();
      expect(data.results.map((f: any) => f.name)).toEqual(
        all
          .filter((f) => f.name.toLowerCase().includes("order"))
          .map((f) => f.name),
      );
      expect(data.results.length).toBeGreaterThan(0);
      expect(data.results.length).toBeLessThan(all.length);
      const { json: none } = await fetchJson(
        `${FUNNELS_BASE}?search=nothing-matches&limit=10&offset=0`,
      );
      expectPage(none, { length: 0, next: false, previous: false });
    },
  },
  {
    name: "honours limit and offset for funnels pagination",
    path: `${FUNNELS_BASE}?limit=5&offset=0`,
    status: 200,
    check: async (page1) => {
      const all = await funnelsOf();
      expectPage(page1, { length: 5, next: true, previous: false });
      const { json: page2 } = await fetchJson(
        `${FUNNELS_BASE}?limit=5&offset=5`,
      );
      expect(page2.meta.previous).toBe(true);
      const { json: last } = await fetchJson(
        `${FUNNELS_BASE}?limit=5&offset=${all.length - 1}`,
      );
      expectPage(last, { length: 1, next: false, previous: true });
      expect([...page1.results, ...page2.results]).toEqual(all.slice(0, 10));
    },
  },
  {
    name: "returns no funnels, events or pins for an unknown app",
    path: "/api/apps/does-not-exist/funnels?limit=10&offset=0",
    status: 200,
    check: async (data) => {
      expectPage(data, { length: 0, next: false, previous: false });
      const { json: events } = await fetchJson(
        "/api/apps/does-not-exist/funnels/events",
      );
      expect(events).toEqual({ results: [] });
      const { json: pinned } = await fetchJson(
        "/api/apps/does-not-exist/funnels/pinned",
      );
      expect(pinned).toEqual({ results: [] });
    },
  },
  {
    name: "lists every event the app's funnels use, once each and sorted",
    path: `${FUNNELS_BASE}/events`,
    status: 200,
    check: async (data) => {
      const used = new Set(
        (await funnelsOf()).flatMap((f) =>
          f.steps.map((s: any) => s.event_name),
        ),
      );
      expect(data.results).toEqual([...used].sort());
      const { json: noLogin } = await fetchJson(
        `/api/apps/${noLoginApp.app.id}/funnels/events`,
      );
      expect(noLogin.results.length).toBeGreaterThan(0);
      expect(
        noLogin.results.some((name: string) => name.startsWith("login_")),
      ).toBe(false);
    },
  },
  {
    name: "lists only the events whose name contains the search, ignoring case",
    path: `${FUNNELS_BASE}/events?search=CART`,
    status: 200,
    check: async (data) => {
      const { json: all } = await fetchJson(`${FUNNELS_BASE}/events`);
      const matching = all.results.filter((name: string) =>
        name.toLowerCase().includes("cart"),
      );
      expect(matching.length).toBeGreaterThan(0);
      expect(matching.length).toBeLessThan(all.results.length);
      expect(data.results).toEqual(matching);
    },
  },
  {
    name: "starts every app with the seeded pins, in their pinned order",
    path: `${FUNNELS_BASE}/pinned`,
    status: 200,
    check: async (data) => {
      expect(data.results.map((f: any) => f.name)).toEqual(SEEDED_PINS);
      data.results.forEach((funnel: any, i: number) => {
        expect(funnel.pinned).toBe(true);
        expect(funnel.pin_order).toBe(i);
      });
      expect(await pinnedNames(noLoginApp.app.id)).toEqual(SEEDED_PINS);
      for (const funnel of await funnelsOf()) {
        const order = SEEDED_PINS.indexOf(funnel.name);
        expect(funnel.pinned).toBe(order !== -1);
        expect(funnel.pin_order).toBe(order === -1 ? null : order);
      }
    },
  },
  {
    name: "returns each listed funnel by id",
    path: allFunnelsPath(),
    status: 200,
    check: async (data) => {
      for (const funnel of data.results) {
        const { res, json } = await fetchJson(`${FUNNELS_BASE}/${funnel.id}`);
        expect(res.status).toBe(200);
        expect(json).toEqual(funnel);
      }
    },
  },
  {
    name: "returns 404 on every funnel route for an unknown funnel id",
    path: `${FUNNELS_BASE}/does-not-exist`,
    status: 404,
    check: async (data) => {
      expect(data.error).toBe("Funnel not found");
      const login = await funnelNamed("Log in");
      const unknown = `${FUNNELS_BASE}/does-not-exist`;
      for (const [path, method] of [
        [`${unknown}/conversion?${wideRangeParams().toString()}`, "GET"],
        [`${unknown}/errors?${stepParams(1)}`, "GET"],
        [`${unknown}/traces?${stepParams(1, { quantile: "p50" })}`, "GET"],
        [`${unknown}/network?${stepParams(1, { quantile: "p50" })}`, "GET"],
        [`${unknown}/trend?period=day`, "GET"],
        [`${unknown}/pin`, "PUT"],
        [`${unknown}/pin`, "DELETE"],
        [`/api/apps/${noLoginApp.app.id}/funnels/${login.id}`, "GET"],
      ]) {
        const { res } = await fetchJson(path, { method });
        expect([path, method, res.status]).toEqual([path, method, 404]);
      }
    },
  },
  {
    name: "pins a funnel after the others and unpins it, keeping pins in memory for that app only",
    path: FUNNELS_BASE,
    status: 200,
    check: async () => {
      const funnel = await funnelNamed("Order tracking");
      expect(funnel.pinned).toBe(false);
      const { json: pinned } = await fetchJson(
        `${FUNNELS_BASE}/${funnel.id}/pin`,
        { method: "PUT" },
      );
      expect(pinned).toMatchObject({
        id: funnel.id,
        pinned: true,
        pin_order: 3,
      });
      const { json: again } = await fetchJson(
        `${FUNNELS_BASE}/${funnel.id}/pin`,
        { method: "PUT" },
      );
      expect(again.pin_order).toBe(3);
      expect(await pinnedNames()).toEqual([...SEEDED_PINS, "Order tracking"]);
      expect((await funnelNamed("Order tracking")).pin_order).toBe(3);
      expect(await pinnedNames(noLoginApp.app.id)).toEqual(SEEDED_PINS);

      const { json: unpinned } = await fetchJson(
        `${FUNNELS_BASE}/${funnel.id}/pin`,
        { method: "DELETE" },
      );
      expect(unpinned).toMatchObject({ pinned: false, pin_order: null });
      expect(await pinnedNames()).toEqual(SEEDED_PINS);
    },
  },
  {
    name: "moves the remaining pins up when a pinned funnel is unpinned",
    path: FUNNELS_BASE,
    status: 200,
    check: async () => {
      const checkout = await funnelNamed("Checkout");
      await fetchJson(`${FUNNELS_BASE}/${checkout.id}/pin`, {
        method: "DELETE",
      });
      expect(await pinnedNames()).toEqual(SEEDED_PINS.slice(1));
      expect((await funnelNamed("Search to order")).pin_order).toBe(0);
    },
  },
  {
    name: "reorders the pinned funnels and keeps the new order",
    path: `${FUNNELS_BASE}/pinned`,
    status: 200,
    check: async (data) => {
      const ids = data.results.map((f: any) => f.id);
      const reversed = [...ids].reverse();
      const { res, json } = await fetchJson(`${FUNNELS_BASE}/pinned`, {
        method: "PUT",
        body: JSON.stringify({ funnel_ids: reversed }),
      });
      expect(res.status).toBe(200);
      expect(json.results.map((f: any) => f.id)).toEqual(reversed);
      expect(json.results.map((f: any) => f.pin_order)).toEqual([0, 1, 2]);
      expect(await pinnedNames()).toEqual([...SEEDED_PINS].reverse());
      expect((await funnelNamed(SEEDED_PINS[0])).pin_order).toBe(2);
    },
  },
  {
    name: "rejects a reorder that does not list each current pin once with 409, leaving the order as it was",
    path: `${FUNNELS_BASE}/pinned`,
    status: 200,
    check: async (data) => {
      const ids: string[] = data.results.map((f: any) => f.id);
      const other = (await funnelNamed("Order tracking")).id;
      for (const body of [
        {},
        { funnel_ids: "not-a-list" },
        { funnel_ids: ids.slice(1) },
        { funnel_ids: [...ids, other] },
        { funnel_ids: [ids[0], ids[0], ids[1]] },
        { funnel_ids: [other, ids[1], ids[2]] },
      ]) {
        const { res, json } = await fetchJson(`${FUNNELS_BASE}/pinned`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        expect([body, res.status]).toEqual([body, 409]);
        expect(json.error).toEqual(expect.any(String));
      }
      expect(await pinnedNames()).toEqual(SEEDED_PINS);
      const { res } = await fetchJson(
        "/api/apps/does-not-exist/funnels/pinned",
        {
          method: "PUT",
          body: JSON.stringify({ funnel_ids: ids }),
        },
      );
      expect(res.status).toBe(404);
    },
  },
  {
    name: "rejects creating, editing and deleting a funnel in the demo with 403",
    path: FUNNELS_BASE,
    method: "POST",
    body: {
      name: "New funnel",
      steps: [{ event_name: "app_opened" }, { event_name: "order_placed" }],
      conversion_window_seconds: 3600,
    },
    status: 403,
    check: async (data) => {
      expect(data.error).toBe("Not available in the interactive demo");
      const funnel = await funnelNamed("Checkout");
      for (const method of ["PATCH", "DELETE"]) {
        const { res, json } = await fetchJson(`${FUNNELS_BASE}/${funnel.id}`, {
          method,
          body: JSON.stringify({ ...funnel, name: "Renamed" }),
        });
        expect(res.status).toBe(403);
        expect(json.error).toBe("Not available in the interactive demo");
      }
      const funnels = await funnelsOf();
      expect(funnels.find((f) => f.id === funnel.id)).toEqual(funnel);
      expect(funnels.some((f) => f.name === "New funnel")).toBe(false);
    },
  },
  {
    name: "returns one conversion row per step for every funnel, with users falling step to step",
    path: allFunnelsPath(),
    status: 200,
    check: async (data) => {
      for (const funnel of data.results) {
        const { json } = await fetchJson(
          `${FUNNELS_BASE}/${funnel.id}/conversion?${wideRangeParams().toString()}`,
        );
        expect(json.steps.map((s: any) => s.event_name)).toEqual(
          funnel.steps.map((s: any) => s.event_name),
        );
        const users = json.steps.map((s: any) => s.users);
        expect(users[0]).toBeGreaterThan(0);
        expectNonIncreasing(users);
        for (const value of users) {
          expect(Number.isInteger(value)).toBe(true);
        }
        expect(json.steps[0].median_seconds_from_previous).toBeNull();
        for (const step of json.steps.slice(1)) {
          expect(Number.isInteger(step.median_seconds_from_previous)).toBe(
            true,
          );
          expect(step.median_seconds_from_previous).toBeGreaterThanOrEqual(1);
        }
      }
    },
  },
  {
    name: "reports no users and no step times for a range before the app's first session, or a filter that matches nothing",
    path: allFunnelsPath(),
    status: 200,
    check: async (data) => {
      const funnel = named(data, "Checkout");
      for (const range of [
        EMPTY_RANGE,
        wideRangeParams({ filter_expr: "version_name:in:9.9.9" }).toString(),
      ]) {
        const { json } = await fetchJson(
          `${FUNNELS_BASE}/${funnel.id}/conversion?${range}`,
        );
        for (const step of json.steps) {
          expect(step.users).toBe(0);
          expect(step.median_seconds_from_previous).toBeNull();
        }
      }
    },
  },
  {
    name: "narrows a funnel's conversion when the filter selects one version",
    path: allFunnelsPath(),
    status: 200,
    check: async (data) => {
      const funnel = named(data, "Checkout");
      const all = await funnelUsers(funnel, wideRangeParams().toString());
      const one = await funnelUsers(
        funnel,
        wideRangeParams({
          filter_expr: `version_name:in:${latestVersion}`,
        }).toString(),
      );
      expect(one[0]).toBeGreaterThan(0);
      expect(one[0]).toBeLessThan(all[0]);
      expectNonIncreasing(one);
    },
  },
  {
    name: "returns one trend point per period up to the current one, each with users falling step to step",
    path: allFunnelsPath(),
    status: 200,
    check: async (data) => {
      const funnel = named(data, "Checkout");
      const periods = [
        ["day", 30],
        ["week", 12],
        ["month", 12],
      ] as const;
      for (const [period, count] of periods) {
        const { res, json } = await fetchJson(
          `${FUNNELS_BASE}/${funnel.id}/trend?period=${period}&timezone=UTC`,
        );
        expect(res.status).toBe(200);
        expect(json.event_names).toEqual(
          funnel.steps.map((step: any) => step.event_name),
        );
        expect(json.points).toHaveLength(count);
        const current = DateTime.utc().startOf(period);
        json.points.forEach((point: any, i: number) => {
          expect(point.datetime).toBe(
            current.minus({ [period]: count - 1 - i }).toFormat("yyyy-MM-dd"),
          );
          expect(point.steps).toHaveLength(funnel.steps.length);
          expect(point.steps[0].median_seconds_from_previous).toBeNull();
          expectNonIncreasing(point.steps.map((s: any) => s.users));
        });
        expect(json.points.at(-1).steps[0].users).toBeGreaterThan(0);
      }
    },
  },
  {
    name: "starts each daily trend point at midnight in the requested timezone, and in UTC without one",
    path: allFunnelsPath(),
    status: 200,
    check: async (data) => {
      const funnel = named(data, "Checkout");
      const trend = `${FUNNELS_BASE}/${funnel.id}/trend?period=day`;
      const datesOf = async (query: string) => {
        const { json } = await fetchJson(`${trend}${query}`);
        return json.points.map((p: any) => p.datetime);
      };
      const daysTo = (today: DateTime) =>
        Array.from({ length: 30 }, (_, i) =>
          today.minus({ days: 29 - i }).toFormat("yyyy-MM-dd"),
        );
      const utc = await datesOf("&timezone=UTC");
      expect(await datesOf("")).toEqual(utc);
      // These zones are fourteen hours ahead of UTC and eleven behind it, so
      // at any hour at least one of them is on a different date than UTC.
      const zoned = [];
      for (const zone of ["Pacific/Kiritimati", "Pacific/Pago_Pago"]) {
        const dates = await datesOf(`&timezone=${encodeURIComponent(zone)}`);
        expect(dates).toEqual(
          daysTo(DateTime.now().setZone(zone).startOf("day")),
        );
        zoned.push(dates);
      }
      expect(zoned.some((dates) => dates.at(-1) !== utc.at(-1))).toBe(true);
    },
  },
  {
    name: "counts a week and a day the same in Breakdown as in the trend point for it",
    path: allFunnelsPath(),
    status: 200,
    check: async (data) => {
      const funnel = named(data, "Checkout");
      for (const period of ["week", "day"] as const) {
        const { json: trend } = await fetchJson(
          `${FUNNELS_BASE}/${funnel.id}/trend?period=${period}&timezone=UTC`,
        );
        const point = trend.points.at(-4);
        const start = DateTime.fromISO(point.datetime, { zone: "UTC" });
        const query = new URLSearchParams({
          from: start.toISO()!,
          to: start.plus({ [period]: 1 }).toISO()!,
          timezone: "UTC",
        });
        const { json: conversion } = await fetchJson(
          `${FUNNELS_BASE}/${funnel.id}/conversion?${query}`,
        );
        expect(conversion.steps.map((s: any) => s.users)).toEqual(
          point.steps.map((s: any) => s.users),
        );
        expect(
          conversion.steps.map((s: any) => s.median_seconds_from_previous),
        ).toEqual(point.steps.map((s: any) => s.median_seconds_from_previous));
      }
    },
  },
  {
    name: "returns a cadence of whole weeks ending before the funnel's users are still converting",
    path: allFunnelsPath(),
    status: 200,
    check: async (data) => {
      // Checkout's window is a day and Abandoned cart recovery's three days.
      for (const name of ["Checkout", "Abandoned cart recovery"]) {
        const funnel = named(data, name);
        const { res, json } = await fetchJson(
          `${FUNNELS_BASE}/${funnel.id}/cadence?weeks=4&timezone=UTC`,
        );
        expect(res.status).toBe(200);
        const to = DateTime.utc()
          .minus({ seconds: funnel.conversion_window_seconds })
          .startOf("week");
        expect(DateTime.fromISO(json.to).toMillis()).toBe(to.toMillis());
        expect(DateTime.fromISO(json.from).toMillis()).toBe(
          to.minus({ weeks: 4 }).toMillis(),
        );
        expect(json.hours.length).toBeGreaterThan(0);
        for (const hour of json.hours) {
          expect(hour.converted).toBeLessThanOrEqual(hour.users);
        }
      }
    },
  },
  {
    name: "dips cadence conversion during the payment maintenance only for funnels that place an order after their first step",
    path: allFunnelsPath(),
    status: 200,
    check: async () => {
      const conversionAt = (hours: any[], weekday: number, hour: number) => {
        const cell = hours.find(
          (h: any) => h.weekday === weekday && h.hour === hour,
        );
        return cell.converted / cell.users;
      };
      const maintenanceRatio = async (appId: string, name: string) => {
        const funnel = (await funnelsOf(appId)).find(
          (f: any) => f.name === name,
        );
        const { json } = await fetchJson(
          `/api/apps/${appId}/funnels/${funnel.id}/cadence?weeks=12&timezone=UTC`,
        );
        // Wednesday 2pm against Tuesday 2pm, outside the maintenance.
        return (
          conversionAt(json.hours, 3, 14) / conversionAt(json.hours, 2, 14)
        );
      };
      let orderTrackingAppId: string | undefined;
      for (const app of world.apps) {
        if (
          (await funnelsOf(app.id)).some((f) => f.name === "Order tracking")
        ) {
          orderTrackingAppId = app.id;
          break;
        }
      }
      expect(await maintenanceRatio(APP_ID, "Checkout")).toBeLessThan(0.75);
      expect(
        await maintenanceRatio(orderTrackingAppId!, "Order tracking"),
      ).toBeGreaterThan(0.75);
    },
  },
  {
    name: "marks a trend point complete only once its period and the funnel's conversion window have passed",
    path: allFunnelsPath(),
    status: 200,
    check: async (data) => {
      // A daily point ends at the next midnight, so a one-day window leaves
      // today and yesterday open and a three-day window leaves four days open.
      for (const [name, open] of [
        ["Checkout", 2],
        ["Abandoned cart recovery", 4],
      ] as const) {
        const funnel = named(data, name);
        expect(funnel.conversion_window_seconds).toBe(
          (open - 1) * 24 * 60 * 60,
        );
        const { json } = await fetchJson(
          `${FUNNELS_BASE}/${funnel.id}/trend?period=day&timezone=UTC`,
        );
        const complete = json.points.map((p: any) => p.complete);
        expect(complete).toEqual([
          ...Array(complete.length - open).fill(true),
          ...Array(open).fill(false),
        ]);
      }
    },
  },
  {
    name: "gives a trend point a time to convert at least the sum of its step times, and none when nobody converted",
    path: allFunnelsPath(),
    status: 200,
    check: async (data) => {
      const funnel = named(data, "Checkout");
      const trend = `${FUNNELS_BASE}/${funnel.id}/trend?period=week&timezone=UTC`;
      const { json } = await fetchJson(trend);
      for (const point of json.points) {
        const converted = point.steps[point.steps.length - 1].users;
        expect(converted).toBeGreaterThan(0);
        const stepTimes = point.steps.reduce(
          (sum: number, s: any) => sum + (s.median_seconds_from_previous ?? 0),
          0,
        );
        expect(point.median_seconds_to_convert).toBeGreaterThanOrEqual(
          stepTimes,
        );
      }
      const { json: unmatched } = await fetchJson(
        withFilter(trend, "version_name:in:9.9.9"),
      );
      for (const point of unmatched.points) {
        expect(point.median_seconds_to_convert).toBeNull();
        for (const step of point.steps) {
          expect(step.users).toBe(0);
          expect(step.median_seconds_from_previous).toBeNull();
        }
      }
    },
  },
  {
    name: "lists the builds uploaded inside a trend's span, oldest first, when asked",
    path: allFunnelsPath(),
    status: 200,
    check: async (data) => {
      const funnel = named(data, "Checkout");
      const trend = `${FUNNELS_BASE}/${funnel.id}/trend?timezone=UTC`;
      const { json: withoutBuilds } = await fetchJson(`${trend}&period=month`);
      expect(withoutBuilds.builds).toEqual([]);
      const { json } = await fetchJson(`${trend}&period=month&builds=true`);
      expect(json.builds.length).toBeGreaterThan(0);
      const uploaded = json.builds.map((b: any) => b.uploaded_at);
      expect(uploaded).toEqual([...uploaded].sort());
      const versions = bundle.builds.map((b) => b.version_name);
      for (const build of json.builds) {
        expect(versions).toContain(build.version_name);
        expect(
          DateTime.fromISO(build.uploaded_at) >=
            DateTime.fromISO(json.points[0].datetime, { zone: "UTC" }),
        ).toBe(true);
        expect(DateTime.fromISO(build.uploaded_at) <= DateTime.now()).toBe(
          true,
        );
      }
      const { json: daily } = await fetchJson(
        `${trend}&period=day&builds=true`,
      );
      expect(daily.builds.length).toBeLessThanOrEqual(json.builds.length);
    },
  },
  {
    name: "rejects a missing or unknown trend period with 400",
    path: allFunnelsPath(),
    status: 200,
    check: async (data) => {
      const id = data.results[0].id;
      for (const query of ["", "?period=year", "?period=toString"]) {
        const { res, json } = await fetchJson(
          `${FUNNELS_BASE}/${id}/trend${query}`,
        );
        expect(res.status).toBe(400);
        expect(json.error).toBe("period must be one of day, week or month");
      }
    },
  },
  {
    name: "lists the errors users hit before each step, most drop-offs first, within the step's conversion",
    path: allFunnelsPath(),
    status: 200,
    check: async (data) => {
      const funnel = named(data, "Checkout");
      const users = await funnelUsers(funnel, wideRangeParams().toString());
      const groupIds = bundle.errorGroups.map((g) => g.id);
      let listed = 0;
      for (let step = 1; step < funnel.steps.length; step++) {
        const { json } = await fetchJson(
          `${FUNNELS_BASE}/${funnel.id}/errors?${stepParams(step)}`,
        );
        listed += json.results.length;
        const dropped = json.results.map((e: any) => e.dropped);
        expect(dropped).toEqual([...dropped].sort((a, b) => b - a));
        expectStepOutcomes(json.results, users, step);
        for (const error of json.results) {
          expect(groupIds).toContain(error.id);
          expect(error.users).toBe(error.dropped + error.converted);
        }
      }
      expect(listed).toBeGreaterThan(0);
    },
  },
  {
    name: "keeps a step's error counts and users within what the errors page lists for the same range and filter",
    path: allFunnelsPath(),
    status: 200,
    check: async (data) => {
      const funnel = named(data, "Checkout");
      const filters: Record<string, string>[] = [
        {},
        { filter_expr: `version_name:in:${latestVersion}` },
      ];
      for (const extra of filters) {
        const { json: groups } = await fetchJson(
          `${ERROR_GROUPS_BASE}?${wideRangeParams({ limit: "200", offset: "0", ...extra }).toString()}`,
        );
        const byId = new Map<string, any>(
          groups.results.map((g: any) => [g.id, g]),
        );
        for (let step = 1; step < funnel.steps.length; step++) {
          const { json } = await fetchJson(
            `${FUNNELS_BASE}/${funnel.id}/errors?${stepParams(step, extra)}`,
          );
          expect(json.results.length).toBeGreaterThan(0);
          for (const error of json.results) {
            const group = byId.get(error.id);
            expect(group).toBeDefined();
            expect(error.count).toBeLessThanOrEqual(group.count);
            expect(error.users).toBeLessThanOrEqual(group.users);
            expect(error.error_type).toBe(group.error_type);
          }
        }
      }
    },
  },
  {
    name: "pages a step's errors, and lists none for a range without errors",
    path: allFunnelsPath(),
    status: 200,
    check: async (data) => {
      const funnel = named(data, "Checkout");
      const errors = `${FUNNELS_BASE}/${funnel.id}/errors`;
      const { json: all } = await fetchJson(`${errors}?${stepParams(1)}`);
      expect(all.results.length).toBeGreaterThan(2);
      const { json: page1 } = await fetchJson(
        `${errors}?${stepParams(1, { limit: "2" })}`,
      );
      expectPage(page1, { length: 2, next: true, previous: false });
      const { json: page2 } = await fetchJson(
        `${errors}?${stepParams(1, { limit: "2", offset: "2" })}`,
      );
      expect(page2.meta.previous).toBe(true);
      expect([...page1.results, ...page2.results]).toEqual(
        all.results.slice(0, 4),
      );
      const { json: empty } = await fetchJson(
        `${errors}?${EMPTY_RANGE}&step=1&limit=10&offset=0`,
      );
      expectPage(empty, { length: 0, next: false, previous: false });
    },
  },
  {
    name: "rejects a step that is not between the funnel's second and last step with 400",
    path: allFunnelsPath(),
    status: 200,
    check: async (data) => {
      const funnel = named(data, "Checkout");
      const last = funnel.steps.length - 1;
      for (const route of ["errors", "traces", "network", "sessions"]) {
        for (const step of ["", "0", String(last + 1), "1.5", "abc"]) {
          const { res, json } = await fetchJson(
            `${FUNNELS_BASE}/${funnel.id}/${route}?${wideRangeParams({ step, quantile: "p50", outcome: "dropped" }).toString()}`,
          );
          expect([route, step, res.status]).toEqual([route, step, 400]);
          expect(json.error).toBe(`step must be between 1 and ${last}`);
        }
        const { res } = await fetchJson(
          `${FUNNELS_BASE}/${funnel.id}/${route}?${stepParams(last, { quantile: "p50", outcome: "dropped" })}`,
        );
        expect(res.status).toBe(200);
      }
    },
  },
  {
    name: "lists the sandbox's own sessions between two steps, keeping each installation's sessions together",
    path: allFunnelsPath(),
    status: 200,
    check: async () => {
      const crossSession: string[] = [];
      for (const app of world.apps) {
        const sessionById = new Map(
          world.appById
            .get(app.id)!
            .sessions.map((s) => [s.list.session_id, s]),
        );
        for (const funnel of await funnelsOf(app.id)) {
          for (let step = 1; step < funnel.steps.length; step++) {
            for (const outcome of ["dropped", "converted"]) {
              const { json } = await fetchJson(
                `/api/apps/${app.id}/funnels/${funnel.id}/sessions?${stepParams(step, { outcome })}`,
              );
              const installations: string[] = [];
              for (const row of json.results) {
                const found = sessionById.get(row.session_id)!;
                expect(found.detail.attribute.installation_id).toBe(
                  row.installation_id,
                );
                expect(row.user_id).toBe(found.list.attribute.user_id);
                expect(row.first_event_time).toBe(found.list.first_event_time);
                expect(row.duration).toBe(Number(found.list.duration));
                if (installations.at(-1) === row.installation_id) {
                  crossSession.push(`${outcome}:${row.installation_id}`);
                } else {
                  expect(installations).not.toContain(row.installation_id);
                  installations.push(row.installation_id);
                }
              }
            }
          }
        }
      }
      // A user who views a product in one session and adds it to the cart in
      // the next has both sessions listed for that step.
      expect(crossSession.some((s) => s.startsWith("converted:"))).toBe(true);
    },
  },
  {
    name: "lists errors, traces and network requests across the whole funnel when no step is given",
    path: allFunnelsPath(),
    status: 200,
    check: async (data) => {
      const funnel = named(data, "Checkout");
      const users = await funnelUsers(funnel, wideRangeParams().toString());
      const last = users.length - 1;
      for (const route of ["errors", "traces", "network"]) {
        const { res, json } = await fetchJson(
          `${FUNNELS_BASE}/${funnel.id}/${route}?${stepParams(null, { quantile: "p95" })}`,
        );
        expect(res.status).toBe(200);
        expect(json.results.length).toBeGreaterThan(0);
        const dropped = json.results.map((r: any) => r.dropped);
        expect(dropped).toEqual([...dropped].sort((a, b) => b - a));
        for (const row of json.results) {
          expect(row.dropped).toBeLessThanOrEqual(users[0] - users[last]);
          expect(row.converted).toBeLessThanOrEqual(users[last]);
        }
      }
    },
  },
  {
    name: "lists the sessions of installations that finished the funnel, or dropped off at any step, when no step is given",
    path: allFunnelsPath(),
    status: 200,
    check: async () => {
      const installationsOf = async (
        app: string,
        funnel: string,
        step: number | null,
        outcome: string,
      ) => {
        const { json } = await fetchJson(
          `/api/apps/${app}/funnels/${funnel}/sessions?${stepParams(step, { outcome })}`,
        );
        return new Set<string>(json.results.map((r: any) => r.installation_id));
      };
      let listed = 0;
      for (const app of world.apps) {
        for (const funnel of await funnelsOf(app.id)) {
          const last = funnel.steps.length - 1;
          const converted = await installationsOf(
            app.id,
            funnel.id,
            null,
            "converted",
          );
          expect(converted).toEqual(
            await installationsOf(app.id, funnel.id, last, "converted"),
          );
          const droppedAtSteps = new Set<string>();
          for (let step = 1; step <= last; step++) {
            for (const id of await installationsOf(
              app.id,
              funnel.id,
              step,
              "dropped",
            )) {
              droppedAtSteps.add(id);
            }
          }
          const dropped = await installationsOf(
            app.id,
            funnel.id,
            null,
            "dropped",
          );
          expect(dropped).toEqual(droppedAtSteps);
          listed += converted.size + dropped.size;
        }
      }
      expect(listed).toBeGreaterThan(0);
    },
  },
  {
    name: "rejects a missing or unknown outcome on step sessions with 400",
    path: allFunnelsPath(),
    status: 200,
    check: async (data) => {
      const funnel = named(data, "Checkout");
      for (const outcome of ["", "Dropped off", "both"]) {
        const { res, json } = await fetchJson(
          `${FUNNELS_BASE}/${funnel.id}/sessions?${stepParams(1, { outcome })}`,
        );
        expect(res.status).toBe(400);
        expect(json.error).toBe("outcome must be one of dropped or converted");
      }
    },
  },
  {
    name: "rejects a missing or unknown quantile on step traces and network with 400",
    path: allFunnelsPath(),
    status: 200,
    check: async (data) => {
      const funnel = named(data, "Checkout");
      const quantiles: Record<string, string>[] = [
        {},
        { quantile: "p75" },
        { quantile: "constructor" },
      ];
      for (const route of ["traces", "network"]) {
        for (const extra of quantiles) {
          const { res, json } = await fetchJson(
            `${FUNNELS_BASE}/${funnel.id}/${route}?${stepParams(1, extra)}`,
          );
          expect(res.status).toBe(400);
          expect(json.error).toBe(
            "quantile must be one of p50, p90, p95 or p99",
          );
        }
      }
    },
  },
  {
    name: "lists the root spans before a step, the one the step waits on first, within the step's conversion",
    path: allFunnelsPath(),
    status: 200,
    check: async (data) => {
      const funnel = named(data, "Checkout");
      const users = await funnelUsers(funnel, wideRangeParams().toString());
      const { json } = await fetchJson(
        `${FUNNELS_BASE}/${funnel.id}/traces?${stepParams(1, { quantile: "p95" })}`,
      );
      expect(json.results.length).toBeGreaterThan(1);
      expectStepOutcomes(json.results, users, 1);
      const dropped = json.results.map((t: any) => t.dropped);
      expect(dropped).toEqual([...dropped].sort((a, b) => b - a));
      // Adding to the cart waits on loading the product, so that span is the
      // one most users who dropped off ran, and waited longer on.
      const [first] = json.results;
      expect(first.span_name).toBe("product_load");
      expect(
        first.dropped_duration_ms / first.converted_duration_ms,
      ).toBeGreaterThan(1.15);
      for (const trace of json.results) {
        expect(bundle.rootSpanNames).toContain(trace.span_name);
      }
    },
  },
  {
    name: "times step spans and endpoints at the requested percentile",
    path: allFunnelsPath(),
    status: 200,
    check: async (data) => {
      const funnel = named(data, "Checkout");
      const fields = {
        traces: ["span_name", "converted_duration_ms"],
        network: ["path_pattern", "converted_latency_ms"],
      };
      for (const [route, [key, timing]] of Object.entries(fields)) {
        const at = async (quantile: string) => {
          const { json } = await fetchJson(
            `${FUNNELS_BASE}/${funnel.id}/${route}?${stepParams(1, { quantile })}`,
          );
          return new Map<string, number>(
            json.results.map((r: any) => [r[key], r[timing]]),
          );
        };
        const p50 = await at("p50");
        const p99 = await at("p99");
        expect(p50.size).toBeGreaterThan(0);
        expect([...p99.keys()].sort()).toEqual([...p50.keys()].sort());
        for (const [name, ms] of p50) {
          expect(p99.get(name)!).toBeGreaterThanOrEqual(ms);
        }
        expect([...p50].some(([name, ms]) => p99.get(name)! > ms)).toBe(true);
      }
    },
  },
  {
    name: "matches endpoints to steps by whole path segments, so payment-methods slows submitting payment and payments slows placing the order",
    path: allFunnelsPath(segmentApp.app.id),
    status: 200,
    check: async (data) => {
      const funnel = named(data, "Checkout");
      const base = `/api/apps/${segmentApp.app.id}/funnels/${funnel.id}`;
      const users = await funnelUsers(funnel, wideRangeParams().toString());
      expect(funnel.steps.map((s: any) => s.event_name).slice(3)).toEqual([
        "payment_submitted",
        "order_placed",
      ]);
      const endpoints = Array.from(segmentApp.networkEndpoints.values()).map(
        (e) => `${e.domain}${e.path}`,
      );
      const ratiosAt = async (step: number) => {
        const { json } = await fetchJson(
          `${base}/network?${stepParams(step, { quantile: "p95" })}`,
        );
        expectStepOutcomes(json.results, users, step);
        const dropped = json.results.map((r: any) => r.dropped);
        expect(dropped).toEqual([...dropped].sort((a, b) => b - a));
        const ratios = json.results.map(
          (r: any) => r.dropped_latency_ms / r.converted_latency_ms,
        );
        for (const row of json.results) {
          expect(endpoints).toContain(`${row.domain}${row.path_pattern}`);
        }
        return new Map<string, number>(
          json.results.map((r: any, i: number) => [
            r.path_pattern.split("/").pop(),
            ratios[i],
          ]),
        );
      };
      const submitting = await ratiosAt(3);
      expect(submitting.get("payment-methods")).toBeGreaterThan(1.15);
      expect(submitting.get("payments")).toBeLessThan(1.1);
      const placing = await ratiosAt(4);
      expect(placing.get("payments")).toBeGreaterThan(1.15);
      expect(placing.get("payment-methods")).toBeLessThan(1.1);
    },
  },
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

describe("sandbox profiles routes", () => {
  it.each(profilesCases)("$name", run);
});

describe("sandbox settings routes", () => {
  it.each(settingsCases)("$name", run);
});

describe("funnels sandbox routes", () => {
  afterEach(restoreSeededPins);
  it.each(funnelsCases)("$name", run);
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
