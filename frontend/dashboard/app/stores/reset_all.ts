import { queryClient } from "@/app/query/query_client";
import type { MeasureStoreRegistry } from "./registry";

export function resetAllStores(registry: MeasureStoreRegistry): void {
  queryClient.clear();
  registry.filtersStore.getState().reset();
  registry.onboardingStore.getState().reset();
}
