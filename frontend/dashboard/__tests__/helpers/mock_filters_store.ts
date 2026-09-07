// The real filters store behind a jest.mock factory for "@/app/stores/provider".
import {
  createFiltersStore,
  type FiltersStore,
} from "@/app/stores/filters_store";
import { useStore } from "zustand";

export const mockFiltersStore = {
  store: createFiltersStore(),
  reset() {
    mockFiltersStore.store = createFiltersStore();
  },
};

export function filtersProviderMock() {
  return {
    __esModule: true,
    useFiltersStore: (selector?: (state: FiltersStore) => unknown) =>
      useStore(mockFiltersStore.store, selector ?? ((state) => state)),
  };
}
