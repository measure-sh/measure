import { createStore } from "zustand/vanilla"

export enum PlotType {
  Paths = "Paths",
  Exceptions = "Exceptions",
}

interface UserJourneysStoreState {
  plotType: string
  searchText: string
}

interface UserJourneysStoreActions {
  setPlotType: (type: string) => void
  setSearchText: (text: string) => void
  reset: () => void
}

export type UserJourneysStore = UserJourneysStoreState & UserJourneysStoreActions

const initialState: UserJourneysStoreState = {
  plotType: PlotType.Paths,
  searchText: "",
}

export function createUserJourneysStore() {
  return createStore<UserJourneysStore>()((set) => ({
    ...initialState,

    setPlotType: (type) => set({ plotType: type }),
    setSearchText: (text) => set({ searchText: text }),

    reset: () => set(initialState),
  }))
}
