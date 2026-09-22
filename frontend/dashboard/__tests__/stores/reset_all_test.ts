import { describe, expect, it } from "@jest/globals";

import { createFiltersStore } from "@/app/stores/filters_store";
import { createOnboardingStore } from "@/app/stores/onboarding_store";
import type { MeasureStoreRegistry } from "@/app/stores/registry";
import { resetAllStores } from "@/app/stores/reset_all";
import type { QueryClient } from "@tanstack/react-query";

const mockQueryClientClear = jest.fn();
const testQueryClient = {
  clear: () => mockQueryClientClear(),
} as unknown as QueryClient;

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

    resetAllStores(registry, testQueryClient);

    for (const { name, spy } of spies) {
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    }
  });

  it("clears the query client it is given", () => {
    const registry = createTestRegistry();
    resetAllStores(registry, testQueryClient);
    expect(mockQueryClientClear).toHaveBeenCalled();
  });

  it("covers every store in the registry", () => {
    const registry = createTestRegistry();
    expect(Object.keys(registry).sort()).toEqual([...allStoreNames].sort());
  });
});
