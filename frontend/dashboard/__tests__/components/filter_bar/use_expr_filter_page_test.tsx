import { mockFiltersStore } from "@/__tests__/helpers/mock_filters_store";
import { mockRouter } from "@/__tests__/helpers/mock_router";
import type { App } from "@/app/api/api_calls";
import type { FilterKey } from "@/app/api/filter_types";
import { beforeEach, describe, expect, it } from "@jest/globals";
import { act, render } from "@testing-library/react";
import { DateTime } from "luxon";
import { useEffect } from "react";

const mockUseAppsQuery = jest.fn();
const mockUseFilterKeysQuery = jest.fn();
const mockUseRootSpanNamesQuery = jest.fn();
const mockToastNegative = jest.fn();

jest.mock("next/navigation", () =>
  require("@/__tests__/helpers/mock_router").nextNavigationMock(),
);

jest.mock("@/app/stores/provider", () =>
  require("@/__tests__/helpers/mock_filters_store").filtersProviderMock(),
);

jest.mock("@/app/components/toast", () => ({
  __esModule: true,
  toastNegative: (text: string) => mockToastNegative(text),
}));

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  paginationOffsetUrlKey: "po",
  useAppsQuery: (teamId: string) => mockUseAppsQuery(teamId),
  useFilterKeysQuery: (
    appId: string | undefined,
    entity: string,
    keyNames: string[],
  ) => mockUseFilterKeysQuery(appId, entity, keyNames),
  useRootSpanNamesQuery: (app: unknown) => mockUseRootSpanNamesQuery(app),
}));

import { useExprFilterPage } from "@/app/components/filter_bar/use_expr_filter_page";

const app = (id: string, name: string, onboarded = true) =>
  ({ id, name, onboarded }) as App;
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

function appsLoaded(loaded: App[] = apps) {
  mockUseAppsQuery.mockReturnValue({ status: "success", data: loaded });
}

function keysPending() {
  mockUseFilterKeysQuery.mockReturnValue({
    data: undefined,
    isPending: true,
    isError: false,
    isPlaceholderData: false,
  });
}

function keysLoaded(keys: FilterKey[] = [mappingTypeKey]) {
  mockUseFilterKeysQuery.mockReturnValue({
    data: { keys, key_groups: ["Build"] },
    isPending: false,
    isError: false,
    isPlaceholderData: false,
  });
}

function namesLoaded(names: string[] | null) {
  mockUseRootSpanNamesQuery.mockReturnValue({
    data: names,
    isSuccess: true,
    isError: false,
  });
}

type Options = Parameters<typeof useExprFilterPage>[0];

let page: ReturnType<typeof useExprFilterPage>;

function Host(options: Options) {
  const rendered = useExprFilterPage(options);
  useEffect(() => {
    page = rendered;
  });
  return null;
}

const paginated: Options = {
  teamId: "team-1",
  entity: "builds",
  paginationLimit: 10,
};

async function renderPage(options: Options = paginated) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(<Host {...options} />);
  });
  return result;
}

const settled = { a: "app-1", d: "Last 6 Hours" };

describe("useExprFilterPage", () => {
  beforeEach(() => {
    mockRouter.reset();
    mockFiltersStore.reset();
    mockToastNegative.mockClear();
    mockUseFilterKeysQuery.mockClear();
    appsLoaded();
    keysLoaded();
    mockUseRootSpanNamesQuery.mockReturnValue({
      data: undefined,
      isSuccess: false,
      isError: false,
    });
  });

  describe("a bare URL", () => {
    it("is filled in with what the page settled on, and fetched", async () => {
      await renderPage();

      expect(mockRouter.urlParams()).toEqual(settled);
      expect(page.status).toEqual({ kind: "ready" });
      expect(page.value).toMatchObject({
        app: apps[0],
        filterExpr: null,
        rootSpanName: null,
      });
      expect(page.filterParams).toEqual({
        appId: "app-1",
        startDate: page.value!.date.startDate,
        endDate: page.value!.date.endDate,
        filterExpr: null,
      });
      expect(page.paginationOffset).toBe(0);
      expect(mockToastNegative).not.toHaveBeenCalled();
    });

    it("keeps the app and range another page left on the store", async () => {
      mockFiltersStore.store.getState().setSelectedApp(apps[1]);
      mockFiltersStore.store.getState().setSelectedDateRange("Last Week");
      await renderPage();

      expect(mockRouter.urlParams()).toEqual({ a: "app-2", d: "Last Week" });
    });

    it("puts the app, the range and the apps on the store for other pages", async () => {
      await renderPage();

      const state = mockFiltersStore.store.getState();
      expect(state.selectedApp).toEqual(apps[0]);
      expect(state.selectedDateRange).toBe("Last 6 Hours");
      expect(state.selectedStartDate).toBe(page.value!.date.startDate);
      expect(state.apps).toEqual(apps);
      expect(state.appsState).toBe("loaded");
    });

    it("fetches nothing until the apps have loaded", async () => {
      mockUseAppsQuery.mockReturnValue({ status: "pending", data: undefined });
      await renderPage();

      expect(page.status).toEqual({ kind: "loading" });
      expect(page.value).toBeNull();
      expect(page.filterParams).toBeNull();
      expect(mockRouter.urlParams()).toEqual({});
      expect(mockFiltersStore.store.getState().appsState).toBe("pending");
    });

    it("fetches before the keys load when there is no filter to judge, with no keys for the bar yet", async () => {
      keysPending();
      await renderPage();

      expect(page.status).toEqual({ kind: "ready" });
      expect(page.value).toMatchObject({ app: apps[0], filterExpr: null });
      expect(page.keys).toBeNull();
      expect(mockRouter.urlParams()).toEqual(settled);
      expect(page.filterParams).toMatchObject({
        appId: "app-1",
        filterExpr: null,
      });

      keysLoaded();
      await renderPage();

      expect(page.keys).toEqual([mappingTypeKey]);
      expect(page.filterParams).toMatchObject({
        appId: "app-1",
        filterExpr: null,
      });
    });

    it("waits for the keys before fetching a URL that carries a filter", async () => {
      mockRouter.setUrl("?filter_expr=mapping_type%3Ain%3Adsym");
      keysPending();
      await renderPage();

      expect(page.status).toEqual({ kind: "loading" });
      expect(page.value).toBeNull();
      expect(page.filterParams).toBeNull();
      expect(mockRouter.urlParams()).toEqual({
        filter_expr: "mapping_type:in:dsym",
      });
    });
  });

  describe("a URL it cannot honour", () => {
    it("is rewritten from page one, with a toast", async () => {
      mockRouter.setUrl(
        "?a=app-gone&d=Last+Week&po=20&filter_expr=mapping_type%3Ain%3Adsym",
      );
      await renderPage();

      expect(mockRouter.urlParams()).toEqual({
        a: "app-1",
        d: "Last Week",
        po: "0",
        filter_expr: "mapping_type:in:dsym",
      });
      expect(mockToastNegative).toHaveBeenCalledTimes(1);
      expect(mockToastNegative).toHaveBeenCalledWith(
        "Some filters were invalid, page reset to defaults",
      );
      expect(page.filterParams).toMatchObject({
        appId: "app-1",
        filterExpr: "mapping_type:in:dsym",
      });
    });

    it("drops a filter the keys cannot vouch for", async () => {
      mockRouter.setUrl("?po=20&filter_expr=device_cohort%3Ain%3Anew");
      await renderPage();

      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "0" });
      expect(mockToastNegative).toHaveBeenCalledTimes(1);
    });

    it("keeps the page for a filter that only needed its canonical form", async () => {
      mockRouter.setUrl("?po=20&filter_expr=mapping_type%3Ain%3A%5Bdsym%5D");
      await renderPage();

      expect(mockRouter.urlParams()).toEqual({
        ...settled,
        po: "20",
        filter_expr: "mapping_type:in:dsym",
      });
      expect(mockToastNegative).not.toHaveBeenCalled();
      expect(page.paginationOffset).toBe(20);
    });

    it("says so once, however much was refused", async () => {
      mockRouter.setUrl("?a=app-gone&d=Last+Fortnight&filter_expr=nonsense%3A");
      await renderPage();

      expect(mockToastNegative).toHaveBeenCalledTimes(1);
      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "0" });
    });
  });

  describe("a change from the bar", () => {
    it("writes the filter from page one and carries the page's own keys", async () => {
      mockRouter.setUrl("?a=app-1&d=Last+6+Hours&po=20&jt=Exceptions");
      await renderPage();

      await act(async () => {
        page.onChange({ filterExpr: "mapping_type:in:dsym" });
      });

      expect(mockRouter.urlParams()).toEqual({
        ...settled,
        po: "0",
        jt: "Exceptions",
        filter_expr: "mapping_type:in:dsym",
      });
      expect(page.paginationOffset).toBe(0);
      expect(page.filterParams).toMatchObject({
        filterExpr: "mapping_type:in:dsym",
      });
    });

    it("removes the keys a null value stands for", async () => {
      mockRouter.setUrl(
        "?a=app-1&d=Last+6+Hours&r=span.first&filter_expr=mapping_type%3Ain%3Adsym",
      );
      mockUseRootSpanNamesQuery.mockImplementation((app: App) =>
        app.id === "app-1"
          ? { data: ["span.first"], isSuccess: true, isError: false }
          : { data: undefined, isSuccess: false, isError: false },
      );
      await renderPage({ ...paginated, entity: "spans", rootSpan: true });

      await act(async () => {
        page.onChange({ appId: "app-2", filterExpr: null, rootSpanName: null });
      });

      expect(mockRouter.urlParams()).toEqual({
        a: "app-2",
        d: "Last 6 Hours",
        po: "0",
      });
      expect(page.status).toEqual({ kind: "loading" });
    });

    it("writes a relative range as its label alone, and a custom range with its timestamps", async () => {
      mockRouter.setUrl(
        "?a=app-1&d=Custom+Range&sd=2026-02-01T00%3A00%3A00.000Z&ed=2026-02-02T00%3A00%3A00.000Z",
      );
      await renderPage({ teamId: "team-1", entity: "journeys" });

      await act(async () => {
        page.onChange({
          dateRange: { dateRange: "Last Week", startDate: null, endDate: null },
        });
      });
      expect(mockRouter.urlParams()).toEqual({ a: "app-1", d: "Last Week" });

      const custom = {
        dateRange: "Custom Range",
        startDate: DateTime.fromISO("2026-02-01T00:00:00.000Z").toISO()!,
        endDate: DateTime.fromISO("2026-02-02T00:00:00.000Z").toISO()!,
      };
      await act(async () => {
        page.onChange({ dateRange: custom });
      });
      expect(mockRouter.urlParams()).toEqual({
        a: "app-1",
        d: "Custom Range",
        sd: custom.startDate,
        ed: custom.endDate,
      });
      expect(page.filterParams).toMatchObject({
        startDate: custom.startDate,
        endDate: custom.endDate,
      });
    });

    it("keeps a write still in flight when the page writes one of its keys", async () => {
      mockRouter.setUrl("?a=app-1&d=Last+6+Hours&jt=Paths");
      await renderPage({ teamId: "team-1", entity: "journeys" });

      mockRouter.deferReplace = true;
      await act(async () => {
        page.onChange({
          dateRange: { dateRange: "Last Week", startDate: null, endDate: null },
        });
      });
      await act(async () => {
        page.setPageUrlKey("jt", "Exceptions");
      });

      expect(mockRouter.urlParams()).toEqual({
        a: "app-1",
        d: "Last Week",
        jt: "Exceptions",
      });
      expect(page.filterParams).toMatchObject({
        startDate: page.value!.date.startDate,
      });
      expect(page.value!.date.dateRange).toBe("Last 6 Hours");

      await act(async () => {
        mockRouter.applyDeferredReplace();
      });
      expect(page.value!.date.dateRange).toBe("Last Week");
      expect(page.filterParams).toMatchObject({
        startDate: page.value!.date.startDate,
      });
    });
  });

  describe("a fixed app", () => {
    const fixedToApp2: Options = { ...paginated, appId: "app-2" };

    it("takes precedence over the URL's app id", async () => {
      mockRouter.setUrl("?a=app-1&d=Last+6+Hours");
      await renderPage(fixedToApp2);

      expect(page.value).toMatchObject({ app: apps[1] });
      expect(page.filterParams).toMatchObject({ appId: "app-2" });
    });

    it("is still written to the URL", async () => {
      await renderPage(fixedToApp2);

      expect(mockRouter.urlParams()).toEqual({ a: "app-2", d: "Last 6 Hours" });
    });

    it("stays fixed after the URL's app id changes underneath it", async () => {
      const rendered = await renderPage(fixedToApp2);

      await act(async () => {
        mockRouter.setUrl("?a=app-1&d=Last+6+Hours");
        rendered.rerender(<Host {...fixedToApp2} />);
      });

      expect(page.value).toMatchObject({ app: apps[1] });
      expect(mockRouter.urlParams()).toEqual({ a: "app-2", d: "Last 6 Hours" });
    });
  });

  describe("the fetch", () => {
    it("waits while the URL still says something else", async () => {
      mockRouter.setUrl("?a=app-1&d=Last+6+Hours");
      await renderPage();
      expect(page.filterParams).not.toBeNull();

      await act(async () => {
        mockRouter.setUrl("?a=app-gone&d=Last+6+Hours&po=10");
        mockRouter.deferReplace = true;
      });

      expect(page.filterParams).toBeNull();
      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "0" });

      await act(async () => {
        mockRouter.applyDeferredReplace();
      });
      expect(page.filterParams).toMatchObject({ appId: "app-1" });
      expect(page.paginationOffset).toBe(0);
    });

    it("does not write over a URL the router has not rendered yet", async () => {
      mockRouter.setUrl("?a=app-1&d=Last+6+Hours");
      const rendered = await renderPage();

      mockRouter.deferReplace = true;
      mockRouter.setUrl("?a=app-2");
      await act(async () => {
        rendered.rerender(<Host {...paginated} />);
      });

      expect(mockRouter.urlParams()).toEqual({ a: "app-2" });
      expect(page.filterParams).toMatchObject({ appId: "app-1" });

      await act(async () => {
        mockRouter.applyDeferredReplace();
      });

      expect(mockRouter.urlParams()).toEqual({ a: "app-2", d: "Last 6 Hours" });
      expect(page.filterParams).toBeNull();

      await act(async () => {
        mockRouter.applyDeferredReplace();
      });

      expect(page.filterParams).toMatchObject({ appId: "app-2" });
    });

    it("ignores timestamps the URL carries with a relative label", async () => {
      mockRouter.setUrl(
        "?a=app-1&d=Last+6+Hours&sd=2020-01-01T00%3A00%3A00.000Z&ed=2020-01-02T00%3A00%3A00.000Z",
      );
      await renderPage();

      expect(page.filterParams).toMatchObject({
        startDate: page.value!.date.startDate,
        endDate: page.value!.date.endDate,
      });
      expect(page.filterParams!.startDate).not.toBe("2020-01-01T00:00:00.000Z");
    });

    it("asks the keys query for the custom keys the URL's filter names", async () => {
      const customPlanKey = {
        ...mappingTypeKey,
        name: "custom.plan",
        label: "plan",
        key_group: "Custom",
      };
      mockUseFilterKeysQuery.mockImplementation(
        (_appId: string | undefined, _entity: string, keyNames: string[]) => ({
          data: {
            keys: keyNames.includes("custom.plan")
              ? [mappingTypeKey, customPlanKey]
              : [mappingTypeKey],
            key_groups: ["Build", "Custom"],
          },
          isPending: false,
          isError: false,
          isPlaceholderData: false,
        }),
      );
      mockRouter.setUrl("?filter_expr=custom.plan%3Ain%3Apro");
      await renderPage();

      expect(mockUseFilterKeysQuery).toHaveBeenLastCalledWith(
        "app-1",
        "builds",
        ["custom.plan"],
      );
      expect(mockRouter.urlParams()).toEqual({
        ...settled,
        filter_expr: "custom.plan:in:pro",
      });
      expect(mockToastNegative).not.toHaveBeenCalled();
    });
  });

  describe("when the keys cannot be fetched", () => {
    it("reports the error, keeps the bar drawn, and leaves the URL alone", async () => {
      mockRouter.setUrl("?po=10");
      mockUseFilterKeysQuery.mockReturnValue({
        data: undefined,
        isPending: false,
        isError: true,
        isPlaceholderData: false,
      });
      await renderPage();

      expect(page.status).toEqual({
        kind: "error",
        message: expect.stringContaining("Error fetching filters"),
      });
      expect(page.value).toMatchObject({ app: apps[0] });
      expect(page.keysUnavailable).toBe(true);
      expect(page.keys).toEqual([]);
      expect(page.filterParams).toBeNull();
      expect(mockRouter.urlParams()).toEqual({ po: "10" });
    });

    it("does not toast for a filter it could not judge", async () => {
      mockRouter.setUrl("?filter_expr=mapping_type%3Ain%3Adsym");
      mockUseFilterKeysQuery.mockReturnValue({
        data: undefined,
        isPending: false,
        isError: true,
        isPlaceholderData: false,
      });
      await renderPage();

      expect(page.status).toEqual({
        kind: "error",
        message: expect.stringContaining("Error fetching filters"),
      });
      expect(mockToastNegative).not.toHaveBeenCalled();
      expect(mockRouter.urlParams()).toEqual({
        filter_expr: "mapping_type:in:dsym",
      });
    });
  });

  describe("the root span", () => {
    const traces: Options = {
      teamId: "team-1",
      entity: "spans",
      paginationLimit: 5,
      rootSpan: true,
    };

    it("settles on the first name and writes it", async () => {
      namesLoaded(["span.first", "span.second"]);
      await renderPage(traces);

      expect(mockRouter.urlParams()).toEqual({ ...settled, r: "span.first" });
      expect(page.value?.rootSpanName).toBe("span.first");
      expect(page.spanNames).toEqual(["span.first", "span.second"]);
    });

    it("discards a name the app does not have", async () => {
      mockRouter.setUrl("?a=app-1&r=span.gone&po=10");
      namesLoaded(["span.first", "span.second"]);
      await renderPage(traces);

      expect(mockRouter.urlParams()).toEqual({
        ...settled,
        r: "span.first",
        po: "0",
      });
      expect(mockToastNegative).toHaveBeenCalledTimes(1);
    });

    it("is ready with no name when the app never reported a trace", async () => {
      mockRouter.setUrl("?a=app-1&po=10");
      namesLoaded(null);
      await renderPage(traces);

      expect(page.status).toEqual({ kind: "ready" });
      expect(page.value?.rootSpanName).toBeNull();
      expect(page.spanNames).toEqual([]);
      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "10" });
      expect(mockToastNegative).not.toHaveBeenCalled();
    });

    it("discards a name the URL carries for an app that never reported a trace", async () => {
      mockRouter.setUrl("?a=app-1&r=span.first&po=10");
      namesLoaded(null);
      await renderPage(traces);

      expect(page.status).toEqual({ kind: "ready" });
      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "0" });
      expect(mockToastNegative).toHaveBeenCalledTimes(1);
    });

    it("keeps the app usable while the names load, without fetching", async () => {
      await renderPage(traces);

      expect(page.status).toEqual({ kind: "loading" });
      expect(page.value).toMatchObject({ app: apps[0], rootSpanName: null });
      expect(page.spanNames).toBeNull();
      expect(page.filterParams).toBeNull();
      expect(mockRouter.urlParams()).toEqual({});
    });

    it("reports names that could not be fetched", async () => {
      mockUseRootSpanNamesQuery.mockReturnValue({
        data: undefined,
        isSuccess: false,
        isError: true,
      });
      await renderPage(traces);

      expect(page.status).toEqual({
        kind: "error",
        message: expect.stringContaining("Error fetching traces list"),
      });
      expect(page.spanNames).toEqual([]);
      expect(page.filterParams).toBeNull();
    });

    it("stays null on a page without a span selector", async () => {
      namesLoaded(["span.first"]);
      await renderPage();

      expect(mockUseRootSpanNamesQuery).toHaveBeenLastCalledWith(null);
      expect(page.spanNames).toBeNull();
      expect(page.value?.rootSpanName).toBeNull();
    });
  });

  describe("pagination", () => {
    it("reads a negative or unreadable offset as zero", async () => {
      mockRouter.setUrl("?a=app-1&d=Last+6+Hours&po=-5");
      await renderPage();
      expect(page.paginationOffset).toBe(0);

      await act(async () => {
        mockRouter.setUrl("?a=app-1&d=Last+6+Hours&po=abc");
      });
      await renderPage();
      expect(page.paginationOffset).toBe(0);
    });

    it("moves the offset by the page size, never below zero", async () => {
      mockRouter.setUrl("?a=app-1&d=Last+6+Hours&po=10");
      await renderPage();
      expect(page.paginationOffset).toBe(10);

      await act(async () => {
        page.nextPage();
      });
      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "20" });
      expect(page.paginationOffset).toBe(20);

      await act(async () => {
        page.prevPage();
      });
      await act(async () => {
        page.prevPage();
      });
      await act(async () => {
        page.prevPage();
      });
      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "0" });
      expect(page.paginationOffset).toBe(0);
    });

    it("has no offset on a page without pagination", async () => {
      mockRouter.setUrl("?po=10");
      await renderPage({ teamId: "team-1", entity: "journeys" });

      await act(async () => {
        page.nextPage();
      });

      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "10" });
      expect(page.paginationOffset).toBe(0);
    });
  });

  describe("the integration wizard", () => {
    const fresh = app("app-3", "Fresh", false);

    it("stands in for a team with no apps, with nothing fetched", async () => {
      appsLoaded([]);
      await renderPage();

      expect(page.status).toEqual({ kind: "onboarding", reason: "no-apps" });
      expect(page.value).toBeNull();
      expect(page.filterParams).toBeNull();
      expect(mockFiltersStore.store.getState().appsState).toBe("no-apps");
    });

    it("stands in for an app that has not reported an event, which it still puts on the store", async () => {
      appsLoaded([fresh]);
      await renderPage();

      expect(page.status).toEqual({
        kind: "onboarding",
        reason: "not-onboarded",
      });
      expect(page.value).toMatchObject({ app: fresh, filterExpr: null });
      expect(page.filterParams).toBeNull();
      expect(mockFiltersStore.store.getState().selectedApp).toEqual(fresh);
      expect(mockUseFilterKeysQuery).toHaveBeenLastCalledWith(
        undefined,
        "builds",
        [],
      );
    });

    it("is left out on a page that does without it", async () => {
      appsLoaded([fresh]);
      await renderPage({ ...paginated, onboarding: false });

      expect(page.status).toEqual({ kind: "ready" });
      expect(page.filterParams).toMatchObject({ appId: "app-3" });
    });
  });
});
