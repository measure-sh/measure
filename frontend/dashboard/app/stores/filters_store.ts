import { createStore } from "zustand/vanilla";
import { App } from "../api/api_calls";

const urlFiltersKeyMap = {
  appId: "a",
  rootSpanName: "r",
  dateRange: "d",
  startDate: "sd",
  endDate: "ed",
};

export { urlFiltersKeyMap };

interface FiltersStoreState {
  selectedApp: App | null;
  selectedDateRange: string;
  selectedStartDate: string;
  selectedEndDate: string;
}

interface FiltersStoreActions {
  setSelectedApp: (app: App | null) => void;
  setSelectedDateRange: (range: string) => void;
  setSelectedStartDate: (date: string) => void;
  setSelectedEndDate: (date: string) => void;
  reset: () => void;
}

const initialState: FiltersStoreState = {
  selectedApp: null,
  selectedDateRange: "",
  selectedStartDate: "",
  selectedEndDate: "",
};

export type FiltersStore = FiltersStoreState & FiltersStoreActions;

export function createFiltersStore() {
  return createStore<FiltersStore>()((set) => ({
    ...initialState,

    setSelectedApp: (app) => set({ selectedApp: app }),
    setSelectedDateRange: (range) => set({ selectedDateRange: range }),
    setSelectedStartDate: (date) => set({ selectedStartDate: date }),
    setSelectedEndDate: (date) => set({ selectedEndDate: date }),

    reset: () => set({ ...initialState }),
  }));
}
