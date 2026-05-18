import { StoreApi } from "zustand/vanilla";

import type { FiltersStore } from "./filters_store";
import type { OnboardingStore } from "./onboarding_store";

export type MeasureStoreRegistry = {
  filtersStore: StoreApi<FiltersStore>;
  onboardingStore: StoreApi<OnboardingStore>;
};
