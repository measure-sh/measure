import { describe, expect, it } from "@jest/globals";

import { createFiltersStore } from "@/app/stores/filters_store";
import { createOnboardingStore } from "@/app/stores/onboarding_store";
import type { MeasureStoreRegistry } from "@/app/stores/registry";
import { resetAllStores } from "@/app/stores/reset_all";

const mockQueryClientClear = jest.fn();
jest.mock("@/app/query/query_client", () => ({
  queryClient: {
    clear: () => mockQueryClientClear(),
  },
  SHORT_CODE_STALE_TIME: 5 * 60 * 1000,
}));

function createTestRegistry(): MeasureStoreRegistry {
  return {
    filtersStore: createFiltersStore(),
    onboardingStore: createOnboardingStore(),
  };
}

const allStoreNames: (keyof MeasureStoreRegistry)[] = [
  "filtersStore",
  "onboardingStore",
];

describe("resetAllStores", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls reset on every store", () => {
    const registry = createTestRegistry();

    const spies = allStoreNames.map((name) => ({
      name,
      spy: jest.spyOn(registry[name].getState(), "reset"),
    }));

    resetAllStores(registry);

    for (const { name, spy } of spies) {
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    }
  });

  it("calls queryClient.clear()", () => {
    const registry = createTestRegistry();
    resetAllStores(registry);
    expect(mockQueryClientClear).toHaveBeenCalled();
  });

  it("covers every store in the registry", () => {
    const registry = createTestRegistry();
    expect(Object.keys(registry).sort()).toEqual([...allStoreNames].sort());
  });
});
