"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import type { MeasureStoreRegistry } from "./registry";

import { createFiltersStore, type FiltersStore } from "./filters_store";
import {
  createOnboardingStore,
  type OnboardingStore,
} from "./onboarding_store";

export type MeasureStoreApi = MeasureStoreRegistry;

export const MeasureStoreContext = createContext<MeasureStoreApi | undefined>(
  undefined,
);

function createMeasureStoreRegistry(): MeasureStoreRegistry {
  const registry = {} as MeasureStoreRegistry;

  registry.filtersStore = createFiltersStore();
  registry.onboardingStore = createOnboardingStore();

  return registry;
}

export const MeasureStoreProvider = ({ children }: { children: ReactNode }) => {
  const [store] = useState(() => createMeasureStoreRegistry());
  return (
    <MeasureStoreContext.Provider value={store}>
      {children}
    </MeasureStoreContext.Provider>
  );
};

export function useMeasureStoreRegistry(): MeasureStoreRegistry {
  const ctx = useContext(MeasureStoreContext);
  if (!ctx) {
    throw new Error(
      "useMeasureStoreRegistry must be used within MeasureStoreProvider",
    );
  }
  return ctx;
}

function createHook<T>(key: keyof MeasureStoreRegistry) {
  function useStoreHook(): T;
  function useStoreHook<U>(selector: (state: T) => U): U;
  function useStoreHook<U>(selector?: (state: T) => U) {
    const ctx = useContext(MeasureStoreContext);
    return useStore(ctx![key] as any, selector as any);
  }
  return useStoreHook;
}

export const useFiltersStore = createHook<FiltersStore>("filtersStore");
export const useOnboardingStore =
  createHook<OnboardingStore>("onboardingStore");
