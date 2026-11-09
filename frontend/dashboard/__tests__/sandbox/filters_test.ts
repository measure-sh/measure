import { formatFilterExpr } from "@/app/components/filter_bar/parse";
import { catalog } from "@/app/sandbox/catalog";
import type { AppBundle, SessionAttribute } from "@/app/sandbox/catalog";
import { countryOf } from "@/app/sandbox/filter";
import { handleSandboxRequest } from "@/app/sandbox/handlers";
import { isWithinRange, parseRange } from "@/app/sandbox/query";
import { describe, expect, it } from "@jest/globals";

const world = catalog();
const bundles = world.apps.map((app) => world.appById.get(app.id)!);

type Attributes = Partial<SessionAttribute>;

const readers: Record<string, (attributes: Attributes) => string | undefined> =
  {
    version_name: (a) => a.app_version,
    version_code: (a) => a.app_build,
    user_id: (a) => a.user_id,
    os_name: (a) => a.os_name,
    os_version: (a) => a.os_version,
    device_model: (a) => a.device_model,
    device_manufacturer: (a) => a.device_manufacturer,
    device_name: (a) => a.device_name,
    locale: (a) => a.device_locale,
    country: (a) =>
      a.device_locale === undefined ? undefined : countryOf(a.device_locale),
    network_type: (a) => a.network_type,
    network_generation: (a) => a.network_generation,
    network_provider: (a) => a.network_provider,
  };

// A row may represent several events, such as an error group or endpoint, and
// carry the attributes of each event.
type Item = { id: string; attributes: Attributes[] };

type Page = {
  entity: string;
  bundles: AppBundle[];
  list: (bundle: AppBundle, filterExpr: string) => Promise<Item[]>;
  // Funnel attempts group a user's matching sessions, so filtering out some
  // sessions can change which ones appear in the list.
  exact: boolean;
};

function params(extra: Record<string, string> = {}): string {
  return new URLSearchParams({
    from: world.builtAt.minus({ days: 30 }).toISO()!,
    to: world.builtAt.toISO()!,
    timezone: "UTC",
    limit: "100000",
    offset: "0",
    ...extra,
  }).toString();
}

function filterParams(filterExpr: string, extra: Record<string, string> = {}) {
  return params(
    filterExpr === "" ? extra : { ...extra, filter_expr: filterExpr },
  );
}

const range = parseRange(new URL(`http://sandbox/?${params()}`));

async function get(path: string): Promise<any> {
  const res = await handleSandboxRequest(path);
  expect(res.status).toBe(200);
  return res.json();
}

function sessionItems(bundle: AppBundle, rows: { session_id: string }[]) {
  const attributes = new Map(
    bundle.sessions.map((s) => [s.list.session_id, s.detail.attribute]),
  );
  return rows.map((row) => ({
    id: row.session_id,
    attributes: attributes.has(row.session_id)
      ? [attributes.get(row.session_id)!]
      : [],
  }));
}

async function listAll(page: Page, filterExpr: string): Promise<Item[]> {
  const lists = await Promise.all(
    page.bundles.map((bundle) => page.list(bundle, filterExpr)),
  );
  return lists.flatMap((items, i) =>
    items.map((item) => ({
      ...item,
      id: `${page.bundles[i].app.id}/${item.id}`,
    })),
  );
}

function inFilter(key: string, value: string): string {
  return formatFilterExpr({
    condition: { key_name: key, operator: "in", values: [{ text: value }] },
  });
}

// Choose a value carried by some, but not all, items so the filter removes
// items. If all items carry the same value, choose that value.
function valueToFilter(
  items: Item[],
  read: (attributes: Attributes) => string | undefined,
): string | undefined {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const value of new Set(item.attributes.map(read))) {
      if (value) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
  }
  const ranked = [...counts.entries()].sort(
    ([a, countA], [b, countB]) => countB - countA || a.localeCompare(b),
  );
  return (ranked.find(([, count]) => count < items.length) ?? ranked[0])?.[0];
}

// Choose the journey node with the most users and the funnel and outcome with
// the most sessions so their lists have sessions to remove.
async function topJourneyNode(bundle: AppBundle): Promise<string> {
  const journey = await get(`/api/apps/${bundle.app.id}/journey?${params()}`);
  return [...journey.nodes].sort((a: any, b: any) => b.users - a.users)[0].id;
}

type FunnelList = { path: string; outcome: string };

async function largestFunnelList(bundle: AppBundle): Promise<FunnelList> {
  const funnels = await get(`/api/apps/${bundle.app.id}/funnels?${params()}`);
  const lists: (FunnelList & { size: number })[] = [];
  for (const funnel of funnels.results) {
    for (const outcome of ["converted", "dropped"]) {
      const path = `/api/apps/${bundle.app.id}/funnels/${funnel.id}/sessions`;
      const json = await get(`${path}?${params({ outcome })}`);
      lists.push({ path, outcome, size: json.results.length });
    }
  }
  return lists.sort((a, b) => b.size - a.size)[0];
}

const journeyNodes = new Map<string, Promise<string>>();
const funnelLists = new Map<string, Promise<FunnelList>>();

function once<T>(
  cache: Map<string, Promise<T>>,
  bundle: AppBundle,
  pick: (bundle: AppBundle) => Promise<T>,
): Promise<T> {
  if (!cache.has(bundle.app.id)) {
    cache.set(bundle.app.id, pick(bundle));
  }
  return cache.get(bundle.app.id)!;
}

const pages: Page[] = [
  {
    entity: "sessions",
    bundles,
    exact: true,
    list: async (bundle, filterExpr) => {
      const json = await get(
        `/api/apps/${bundle.app.id}/sessions?${filterParams(filterExpr)}`,
      );
      return sessionItems(bundle, json.results);
    },
  },
  {
    entity: "bug_reports",
    bundles,
    exact: true,
    list: async (bundle, filterExpr) => {
      const json = await get(
        `/api/apps/${bundle.app.id}/bugReports?${filterParams(filterExpr)}`,
      );
      return json.results.map((report: any) => ({
        id: report.event_id,
        attributes: [report.attribute],
      }));
    },
  },
  {
    entity: "errors",
    bundles,
    exact: true,
    list: async (bundle, filterExpr) => {
      const json = await get(
        `/api/apps/${bundle.app.id}/errorGroups?${filterParams(filterExpr)}`,
      );
      return json.results.map((row: any) => ({
        id: row.id,
        attributes: bundle.errorGroups
          .find((group) => group.id === row.id)!
          .instances.filter((instance) =>
            isWithinRange(instance.timestamp, range),
          )
          .map((instance) => instance.attribute),
      }));
    },
  },
  {
    entity: "error_group_events",
    bundles,
    exact: true,
    list: async (bundle, filterExpr) => {
      const group = [...bundle.errorGroups].sort(
        (a, b) => b.instances.length - a.instances.length,
      )[0];
      const json = await get(
        `/api/apps/${bundle.app.id}/errorGroups/${group.id}/errors?${filterParams(filterExpr)}`,
      );
      return json.results.map((instance: any) => ({
        id: instance.id,
        attributes: [instance.attribute],
      }));
    },
  },
  {
    entity: "spans",
    bundles,
    exact: true,
    list: async (bundle, filterExpr) => {
      const json = await get(
        `/api/apps/${bundle.app.id}/spans?${filterParams(filterExpr, { span_name: bundle.rootSpanNames[0] })}`,
      );
      const sessions = new Map(
        bundle.sessions.map((s) => [s.list.session_id, s.detail.attribute]),
      );
      // A span row carries its version, OS, device manufacturer and model.
      // Other attributes come from the span's session.
      return json.results.map((row: any) => {
        const sessionId = bundle.traces.get(row.trace_id)?.session_id;
        return {
          id: row.span_id,
          attributes: [
            {
              ...(sessionId === undefined ? {} : sessions.get(sessionId)),
              app_version: row.app_version,
              app_build: row.app_build,
              os_name: row.os_name,
              os_version: row.os_version,
              device_manufacturer: row.device_manufacturer,
              device_model: row.device_model,
            },
          ],
        };
      });
    },
  },
  {
    entity: "profiles",
    bundles: bundles.filter((bundle) => bundle.profiles.length > 0),
    exact: true,
    list: async (bundle, filterExpr) => {
      const json = await get(
        `/api/apps/${bundle.app.id}/profiles?${filterParams(filterExpr)}`,
      );
      return sessionItems(bundle, json.results).map((item, i) => ({
        ...item,
        id: json.results[i].id,
      }));
    },
  },
  {
    entity: "memory",
    bundles,
    exact: true,
    list: async (bundle, filterExpr) => {
      const json = await get(
        `/api/apps/${bundle.app.id}/memory/sessions/highUsage?${filterParams(filterExpr)}`,
      );
      return sessionItems(bundle, json.results);
    },
  },
  {
    entity: "network",
    bundles,
    exact: true,
    list: async (bundle, filterExpr) => {
      const json = await get(
        `/api/apps/${bundle.app.id}/networkRequests/endpoints?${filterParams(filterExpr)}`,
      );
      return json.results.map(
        (endpoint: { domain: string; path_pattern: string }) => ({
          id: `${endpoint.domain}${endpoint.path_pattern}`,
          attributes: bundle.httpSamples
            .filter(
              (sample) =>
                sample.domain === endpoint.domain &&
                sample.path === endpoint.path_pattern,
            )
            .map((sample) => sample.attribute),
        }),
      );
    },
  },
  {
    entity: "journeys",
    bundles,
    exact: true,
    list: async (bundle, filterExpr) => {
      const node = await once(journeyNodes, bundle, topJourneyNode);
      const json = await get(
        `/api/apps/${bundle.app.id}/journey/sessions?${filterParams(filterExpr, { node })}`,
      );
      return sessionItems(bundle, json.results);
    },
  },
  {
    entity: "funnels",
    bundles,
    exact: false,
    list: async (bundle, filterExpr) => {
      const { path, outcome } = await once(
        funnelLists,
        bundle,
        largestFunnelList,
      );
      const json = await get(
        `${path}?${filterParams(filterExpr, { outcome })}`,
      );
      return sessionItems(bundle, json.results);
    },
  },
];

describe("sandbox page filters", () => {
  for (const page of pages) {
    it(`narrows the ${page.entity} list by each version, user, OS, device, network and location filter key it offers`, async () => {
      const { keys } = await get(
        `/api/apps/${page.bundles[0].app.id}/filters/keys?entity=${page.entity}`,
      );
      const keyNames: string[] = keys
        .map((key: { name: string }) => key.name)
        .filter((name: string) => name in readers);
      expect(keyNames).toEqual(
        expect.arrayContaining(["device_manufacturer", "device_name"]),
      );

      const all = await listAll(page, "");
      expect(all.length).toBeGreaterThan(1);
      const ids = (items: Item[]) => items.map((item) => item.id).sort();

      for (const key of keyNames) {
        const read = readers[key];
        const value = valueToFilter(all, read);
        expect({ key, value }).toEqual({ key, value: expect.any(String) });
        const carries = (item: Item) =>
          item.attributes.some((attributes) => read(attributes) === value);

        const filtered = await listAll(page, inFilter(key, value!));
        if (page.exact) {
          expect({ key, value, ids: ids(filtered) }).toEqual({
            key,
            value,
            ids: ids(all.filter(carries)),
          });
        } else {
          expect({
            key,
            value,
            listed: filtered.length > 0,
            without: ids(filtered.filter((item) => !carries(item))),
          }).toEqual({ key, value, listed: true, without: [] });
        }

        const none = await listAll(page, inFilter(key, "no such value"));
        expect({ key, ids: ids(none) }).toEqual({ key, ids: [] });
      }
    });
  }
});
