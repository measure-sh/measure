import { describe, expect, it } from "@jest/globals";

import type { App } from "@/app/api/api_calls";
import type { FilterKey } from "@/app/api/filter_types";
import { MAX_CONDITIONS } from "@/app/components/filter_bar/limits";
import {
  type AppsQueryState,
  type KeysQueryState,
  type SpanNamesQueryState,
  type UrlFilters,
  resolveApp,
  resolveFilters,
} from "@/app/components/filter_bar/resolve_filters";

const app = (id: string, name: string) => ({ id, name }) as App;
const apps = [app("app-1", "Checkout"), app("app-2", "Wallet")];

const mappingTypeKey = {
  name: "mapping_type",
  label: "File type",
  key_group: "Build",
  description: "The kind of mapping file",
  value_type: "string",
  value_suggestion_mode: "full_list",
  operators: ["in", "not_in"],
} as unknown as FilterKey;

const versionKey = {
  name: "version_name",
  label: "App version",
  key_group: "Version",
  description: "The version the build reports",
  value_type: "string",
  value_suggestion_mode: "full_list",
  operators: ["in", "not_in"],
} as unknown as FilterKey;

const noDate = { dateRange: null, startDate: null, endDate: null };

const bareUrl: UrlFilters = {
  appId: null,
  dateRange: noDate,
  filterExpr: null,
  rootSpanName: null,
};

const appsLoaded: AppsQueryState = { status: "success", data: apps };
const appsPending: AppsQueryState = { status: "pending", data: undefined };
const appsFailed: AppsQueryState = { status: "error", data: undefined };

const keysLoaded: KeysQueryState = {
  isPending: false,
  isError: false,
  isPlaceholderData: false,
  data: {
    keys: [mappingTypeKey, versionKey],
    key_groups: ["Build", "Version"],
  },
};
const keysPending: KeysQueryState = {
  isPending: true,
  isError: false,
  isPlaceholderData: false,
  data: undefined,
};
const keysOfPreviousApp: KeysQueryState = {
  ...keysLoaded,
  isPlaceholderData: true,
};
const keysFailed: KeysQueryState = {
  isPending: false,
  isError: true,
  isPlaceholderData: false,
  data: undefined,
};

const namesLoaded = (names: string[] | null): SpanNamesQueryState => ({
  isError: false,
  isSuccess: true,
  data: names,
});
const namesPending: SpanNamesQueryState = {
  isError: false,
  isSuccess: false,
  data: undefined,
};
const namesFailed: SpanNamesQueryState = {
  isError: true,
  isSuccess: false,
  data: undefined,
};

const nothingRemembered = { appId: undefined, dateRange: noDate };

function resolve(
  overrides: Partial<Parameters<typeof resolveFilters>[0]> = {},
  url: Partial<UrlFilters> = {},
) {
  return resolveFilters({
    url: { ...bareUrl, ...url },
    apps: appsLoaded,
    keys: keysLoaded,
    spanNames: null,
    remembered: nothingRemembered,
    ...overrides,
  });
}

describe("resolveApp", () => {
  it("takes the URL's app when the team has it", () => {
    expect(resolveApp("app-2", apps, "app-1")).toEqual(apps[1]);
  });

  it("falls back to the remembered app, then the first", () => {
    expect(resolveApp("app-gone", apps, "app-2")).toEqual(apps[1]);
    expect(resolveApp("app-gone", apps, "app-gone")).toEqual(apps[0]);
    expect(resolveApp(null, apps, undefined)).toEqual(apps[0]);
  });

  it("has nothing to offer before the apps load, or when there are none", () => {
    expect(resolveApp("app-1", undefined, undefined)).toBeNull();
    expect(resolveApp("app-1", [], undefined)).toBeNull();
  });
});

describe("resolveFilters", () => {
  describe("the app", () => {
    it("settles on the URL's app", () => {
      const resolution = resolve({}, { appId: "app-2" });

      expect(resolution.status).toEqual({ kind: "ready" });
      expect(resolution.filters?.app).toEqual(apps[1]);
      expect(resolution.discarded).toBe(false);
    });

    it("ranks the URL's app above the remembered one", () => {
      const resolution = resolve(
        { remembered: { appId: "app-2", dateRange: noDate } },
        { appId: "app-1" },
      );

      expect(resolution.filters?.app).toEqual(apps[0]);
    });

    it("keeps the remembered app for a bare URL", () => {
      const resolution = resolve({
        remembered: { appId: "app-2", dateRange: noDate },
      });

      expect(resolution.filters?.app).toEqual(apps[1]);
      expect(resolution.discarded).toBe(false);
    });

    it("discards an app the team no longer has", () => {
      const resolution = resolve({}, { appId: "app-gone" });

      expect(resolution.filters?.app).toEqual(apps[0]);
      expect(resolution.discarded).toBe(true);
    });

    it("does not judge the URL's app before the apps load", () => {
      const resolution = resolve({ apps: appsPending }, { appId: "app-gone" });

      expect(resolution.status).toEqual({ kind: "loading" });
      expect(resolution.filters).toBeNull();
      expect(resolution.discarded).toBe(false);
    });
  });

  describe("the date", () => {
    it("takes the URL's label", () => {
      const resolution = resolve(
        {},
        {
          dateRange: { dateRange: "Last Week", startDate: null, endDate: null },
        },
      );

      expect(resolution.date.dateRange).toBe("Last Week");
      expect(resolution.discarded).toBe(false);
    });

    it("falls back to the remembered range, then the default", () => {
      const remembered = {
        appId: undefined,
        dateRange: {
          dateRange: "Last 24 Hours",
          startDate: null,
          endDate: null,
        },
      };

      expect(resolve({ remembered }).date.dateRange).toBe("Last 24 Hours");
      expect(resolve().date.dateRange).toBe("Last 6 Hours");
    });

    it("discards a label it cannot read", () => {
      const resolution = resolve(
        {},
        {
          dateRange: {
            dateRange: "Last Fortnight",
            startDate: null,
            endDate: null,
          },
        },
      );

      expect(resolution.date.dateRange).toBe("Last 6 Hours");
      expect(resolution.discarded).toBe(true);
    });

    it("keeps the timestamps of a custom range", () => {
      const custom = {
        dateRange: "Custom Range",
        startDate: "2026-02-01T00:00:00.000Z",
        endDate: "2026-02-02T00:00:00.000Z",
      };

      expect(resolve({}, { dateRange: custom }).date).toEqual(custom);
    });

    it("discards a custom range whose timestamps do not read back", () => {
      const resolution = resolve(
        {},
        {
          dateRange: {
            dateRange: "Custom Range",
            startDate: "yesterday",
            endDate: null,
          },
        },
      );

      expect(resolution.date.dateRange).toBe("Last 6 Hours");
      expect(resolution.discarded).toBe(true);
    });
  });

  describe("the filter", () => {
    it("keeps a filter the keys can vouch for, in its canonical form", () => {
      const resolution = resolve({}, { filterExpr: "mapping_type:in:[dsym]" });

      expect(resolution.filters?.filterExpr).toBe("mapping_type:in:dsym");
      expect(resolution.discarded).toBe(false);
    });

    it("filters by nothing for an empty filter, without a discard", () => {
      const resolution = resolve({}, { filterExpr: "" });

      expect(resolution.filters?.filterExpr).toBeNull();
      expect(resolution.discarded).toBe(false);
    });

    it("discards a filter it cannot read", () => {
      const resolution = resolve(
        {},
        { filterExpr: "mapping_type:in:dsym AND" },
      );

      expect(resolution.status).toEqual({ kind: "ready" });
      expect(resolution.filters?.filterExpr).toBeNull();
      expect(resolution.discarded).toBe(true);
    });

    it("discards a filter naming a key this app does not have", () => {
      const resolution = resolve({}, { filterExpr: "device_cohort:in:new" });

      expect(resolution.filters?.filterExpr).toBeNull();
      expect(resolution.discarded).toBe(true);
    });

    it("discards a condition without a value", () => {
      const resolution = resolve(
        {},
        { filterExpr: "mapping_type:in:dsym AND version_name:in:" },
      );

      expect(resolution.filters?.filterExpr).toBeNull();
      expect(resolution.discarded).toBe(true);
    });

    it("discards a filter past a limit", () => {
      const tooMany = Array.from(
        { length: MAX_CONDITIONS + 1 },
        () => "mapping_type:in:dsym",
      ).join(" AND ");
      const resolution = resolve({}, { filterExpr: tooMany });

      expect(resolution.filters?.filterExpr).toBeNull();
      expect(resolution.discarded).toBe(true);
    });

    it("waits for the keys before judging a filter", () => {
      const resolution = resolve(
        { keys: keysPending },
        { filterExpr: "mapping_type:in:dsym" },
      );

      expect(resolution.status).toEqual({ kind: "loading" });
      expect(resolution.filters).toBeNull();
      expect(resolution.discarded).toBe(false);
    });

    it("does not judge a filter by the previous app's keys", () => {
      const resolution = resolve(
        { keys: keysOfPreviousApp },
        { filterExpr: "device_cohort:in:new" },
      );

      expect(resolution.status).toEqual({ kind: "loading" });
      expect(resolution.filters).toBeNull();
      expect(resolution.discarded).toBe(false);
    });

    it("is ready with the previous app's keys when there is no filter to judge", () => {
      const resolution = resolve({ keys: keysOfPreviousApp });

      expect(resolution.status).toEqual({ kind: "ready" });
      expect(resolution.filters?.filterExpr).toBeNull();
    });

    it("is ready before the keys load when there is no filter to judge", () => {
      const resolution = resolve({ keys: keysPending });

      expect(resolution.status).toEqual({ kind: "ready" });
      expect(resolution.filters).toEqual({
        app: apps[0],
        filterExpr: null,
        rootSpanName: null,
      });
      expect(resolution.discarded).toBe(false);
    });

    it("leaves a filter unjudged when the keys cannot be fetched", () => {
      const resolution = resolve(
        { keys: keysFailed },
        { filterExpr: "device_cohort:in:new" },
      );

      expect(resolution.status).toEqual({
        kind: "error",
        message: expect.stringContaining("Error fetching filters"),
      });
      expect(resolution.filters?.filterExpr).toBeNull();
      expect(resolution.discarded).toBe(false);
    });
  });

  describe("the root span", () => {
    const names = namesLoaded(["checkout", "startup"]);

    it("stays null on a page without a span selector", () => {
      expect(resolve().filters?.rootSpanName).toBeNull();
    });

    it("takes the URL's name when the app has it", () => {
      const resolution = resolve(
        { spanNames: names },
        { appId: "app-1", rootSpanName: "startup" },
      );

      expect(resolution.status).toEqual({ kind: "ready" });
      expect(resolution.filters?.rootSpanName).toBe("startup");
      expect(resolution.discarded).toBe(false);
    });

    it("falls back to the first name for a bare URL", () => {
      const resolution = resolve({ spanNames: names });

      expect(resolution.filters?.rootSpanName).toBe("checkout");
      expect(resolution.discarded).toBe(false);
    });

    it("discards a name the app does not have", () => {
      const resolution = resolve(
        { spanNames: names },
        { appId: "app-1", rootSpanName: "gone" },
      );

      expect(resolution.filters?.rootSpanName).toBe("checkout");
      expect(resolution.discarded).toBe(true);
    });

    it("does not judge a name left over from another app", () => {
      const resolution = resolve(
        { spanNames: names },
        { appId: "app-gone", rootSpanName: "gone" },
      );

      expect(resolution.filters?.rootSpanName).toBe("checkout");
      expect(resolution.discarded).toBe(true);

      const withoutApp = resolve(
        { spanNames: names },
        { rootSpanName: "gone" },
      );

      expect(withoutApp.filters?.rootSpanName).toBe("checkout");
      expect(withoutApp.discarded).toBe(false);
    });

    it("is ready with no name when the app never reported a trace", () => {
      for (const data of [[], null]) {
        const resolution = resolve(
          { spanNames: namesLoaded(data) },
          { appId: "app-1" },
        );

        expect(resolution.status).toEqual({ kind: "ready" });
        expect(resolution.filters?.rootSpanName).toBeNull();
        expect(resolution.discarded).toBe(false);
      }
    });

    it("keeps the app usable while the names load", () => {
      const resolution = resolve({ spanNames: namesPending });

      expect(resolution.status).toEqual({ kind: "loading" });
      expect(resolution.filters).toEqual({
        app: apps[0],
        filterExpr: null,
        rootSpanName: null,
      });
    });

    it("reports names that could not be fetched", () => {
      const resolution = resolve({ spanNames: namesFailed });

      expect(resolution.status).toEqual({
        kind: "error",
        message: expect.stringContaining("Error fetching traces list"),
      });
      expect(resolution.filters?.app).toEqual(apps[0]);
    });
  });

  describe("errors, in order of precedence", () => {
    it("reports apps that could not be fetched", () => {
      const resolution = resolve({
        apps: appsFailed,
        keys: keysFailed,
        spanNames: namesFailed,
      });

      expect(resolution.status).toEqual({
        kind: "error",
        message: expect.stringContaining("Error fetching apps"),
      });
      expect(resolution.filters).toBeNull();
    });

    it("reports a team with no apps", () => {
      const resolution = resolve({
        apps: { status: "success", data: [] },
        keys: keysFailed,
        spanNames: namesFailed,
      });

      expect(resolution.status).toEqual({
        kind: "error",
        message: expect.stringContaining("don't have any apps yet"),
      });
      expect(resolution.filters).toBeNull();
    });

    it("reports keys that could not be fetched, with the app still settled", () => {
      const resolution = resolve({ keys: keysFailed, spanNames: namesFailed });

      expect(resolution.status).toEqual({
        kind: "error",
        message: expect.stringContaining("Error fetching filters"),
      });
      expect(resolution.filters?.app).toEqual(apps[0]);
    });
  });
});
