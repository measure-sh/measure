import { describe, expect, it } from "@jest/globals";

import { App } from "@/app/api/api_calls";

import { createFiltersStore } from "@/app/stores/filters_store";

function makeApp(id: string, overrides: Partial<App> = {}): App {
  return {
    id,
    team_id: "t1",
    name: `App ${id}`,
    api_key: {
      created_at: "",
      key: "k",
      last_seen: null,
      revoked: false,
    },
    onboarded: true,
    created_at: "",
    updated_at: "",
    os_names: ["android"],
    onboarded_at: null,
    unique_identifier: null,
    ...overrides,
  };
}

describe("filtersStore actions", () => {
  it("setSelectedApp stores the app", () => {
    const store = createFiltersStore();

    store.getState().setSelectedApp(makeApp("a"));
    expect(store.getState().selectedApp?.id).toBe("a");

    store.getState().setSelectedApp(makeApp("b"));
    expect(store.getState().selectedApp?.id).toBe("b");

    store.getState().setSelectedApp(null);
    expect(store.getState().selectedApp).toBeNull();
  });

  it("date setters store the range and its bounds", () => {
    const store = createFiltersStore();

    store.getState().setSelectedDateRange("Last 6 Hours");
    store.getState().setSelectedStartDate("2026-01-01T00:00");
    store.getState().setSelectedEndDate("2026-01-02T00:00");

    expect(store.getState().selectedDateRange).toBe("Last 6 Hours");
    expect(store.getState().selectedStartDate).toBe("2026-01-01T00:00");
    expect(store.getState().selectedEndDate).toBe("2026-01-02T00:00");
  });

  it("reset wipes the selection back to initial state", () => {
    const store = createFiltersStore();
    store.getState().setSelectedApp(makeApp("a"));
    store.getState().setSelectedDateRange("Last 6 Hours");

    store.getState().reset();

    expect(store.getState().selectedApp).toBeNull();
    expect(store.getState().selectedDateRange).toBe("");
  });
});
