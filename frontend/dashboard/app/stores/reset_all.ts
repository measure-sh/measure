import type { QueryClient } from "@tanstack/react-query";
import type { MeasureStoreRegistry } from "./registry";

export function resetAllStores(
  registry: MeasureStoreRegistry,
  queryClient: QueryClient,
): void {
  queryClient.clear();
  registry.filtersStore.getState().reset();
  registry.onboardingStore.getState().reset();
}
