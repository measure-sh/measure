import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";

const mockUseAppsQuery = jest.fn();
const mockUseFilterKeysQuery = jest.fn();
const mockUseRootSpanNamesQuery = jest.fn();
const mockToastNegative = jest.fn();

jest.mock("@/app/components/toast", () => ({
  __esModule: true,
  toastNegative: (text: string) => mockToastNegative(text),
}));

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useAppsQuery: (teamId: string) => mockUseAppsQuery(teamId),
  useFilterKeysQuery: (
    appId: string | undefined,
    entity: string,
    keyNames: string[],
  ) => mockUseFilterKeysQuery(appId, entity, keyNames),
  useRootSpanNamesQuery: (app: unknown) => mockUseRootSpanNamesQuery(app),
}));

const { useStore } = jest.requireActual("zustand") as any;
const { createFiltersStore } = jest.requireActual(
  "@/app/stores/filters_store",
) as any;

let storeInstance: any;

jest.mock("@/app/stores/provider", () => ({
  __esModule: true,
  useFiltersStore: (selector?: any) =>
    useStore(storeInstance, selector ?? ((s: any) => s)),
}));

jest.mock("@/app/components/filter_bar/app_select", () => ({
  __esModule: true,
  default: ({ apps, selected, onChange }: any) => (
    <div data-testid="app-select" data-selected={selected?.name}>
      {apps.map((app: any) => (
        <button
          key={app.id}
          data-testid={`pick-app-${app.id}`}
          onClick={() => onChange(app)}
        >
          {app.name}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("@/app/components/filter_bar/date_range_select", () => {
  const actual = jest.requireActual(
    "@/app/components/filter_bar/date_range_select",
  ) as any;
  return {
    __esModule: true,
    ...actual,
    default: ({ selection, onChange }: any) => (
      <div data-testid="date-select" data-range={selection.dateRange}>
        <button
          data-testid="pick-range"
          onClick={() =>
            onChange({
              dateRange: "Last Week",
              startDate: "2026-02-01T00:00:00.000Z",
              endDate: "2026-02-08T00:00:00.000Z",
            })
          }
        >
          last week
        </button>
      </div>
    ),
  };
});

jest.mock("@/app/components/filter_bar/key_picker", () => ({
  __esModule: true,
  default: ({
    keys,
    keyGroups,
    selected,
    onSelect,
    onAddGroup,
    trigger,
    open,
  }: any) => (
    <div
      data-testid="key-picker"
      data-groups={keyGroups.join(",")}
      // Only the picker for the whole filter is told when to open, so the
      // attribute is absent on the pickers that open themselves.
      data-open={open === undefined ? undefined : String(open)}
    >
      {trigger}
      {keys.map((key: any) => (
        <button
          key={key.name}
          data-testid={`pick-key-${key.name}${selected ? "-in-row" : ""}`}
          onClick={() => onSelect(key)}
        >
          {key.label}
        </button>
      ))}
      {onAddGroup && (
        <button data-testid="add-group" onClick={() => onAddGroup()}>
          group
        </button>
      )}
    </div>
  ),
  OperatorPicker: ({ operators, onSelect, trigger }: any) => (
    <div data-testid="operator-picker">
      {trigger}
      {operators.map((operator: string) => (
        <button
          key={operator}
          data-testid={`pick-op-${operator}`}
          onClick={() => onSelect(operator)}
        >
          {operator}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("@/app/components/filter_bar/value_picker", () => ({
  __esModule: true,
  default: ({ onChange, trigger }: any) => (
    <div data-testid="value-picker">
      {trigger}
      <button
        data-testid="pick-value"
        onClick={() => onChange([{ text: "dsym" }])}
      >
        dsym
      </button>
    </div>
  ),
}));

import type { App } from "@/app/api/api_calls";
import type { FilterKey } from "@/app/api/filter_types";
import { MAX_CONDITIONS } from "@/app/components/filter_bar/limits";
import FilterBar, {
  type FilterRequest,
  type FilterState,
} from "@/app/components/filter_bar/filter_bar";

const app = (id: string, name: string) => ({ id, name }) as App;
const apps = [app("app-1", "Checkout"), app("app-2", "Wallet")];

const mappingTypeKey = {
  name: "mapping_type",
  label: "File type",
  key_group: "Build",
  description: "The kind of mapping file",
  value_type: "string",
  value_suggestion_mode: "full_list",
  operators: ["in", "not_in"],
} as unknown as FilterKey;

const versionKey = {
  name: "version_name",
  label: "App version",
  key_group: "Version",
  description: "The version the build reports",
  value_type: "string",
  value_suggestion_mode: "full_list",
  operators: ["in", "not_in"],
} as unknown as FilterKey;

// The server serves a user-defined attribute key with a `custom.` prefix on
// the name and the raw attribute name as the label.
const customPremiumKey = {
  name: "custom.is_premium",
  label: "is_premium",
  key_group: "Custom",
  description: "A user-defined attribute",
  value_type: "bool",
  value_suggestion_mode: "full_list",
  operators: ["eq"],
} as unknown as FilterKey;

const customPlanKey = {
  name: "custom.plan",
  label: "plan",
  key_group: "Custom",
  description: "A user-defined attribute",
  value_type: "string",
  value_suggestion_mode: "sample",
  operators: ["in", "not_in", "contains"],
} as unknown as FilterKey;

function appsLoaded(loaded: App[] = apps) {
  mockUseAppsQuery.mockReturnValue({
    status: "success",
    data: loaded,
  } as any);
}

function keysLoaded(
  keys: FilterKey[] = [mappingTypeKey, versionKey],
  keyGroups: string[] = ["Build", "Version"],
) {
  mockUseFilterKeysQuery.mockReturnValue({
    data: { keys, key_groups: keyGroups },
    isPending: false,
    isError: false,
  } as any);
}

const nothingRequested = {
  requestedAppId: null,
  requestedDateRange: { dateRange: null, startDate: null, endDate: null },
  requestedFilterExpr: null,
};

const propOfField = {
  appId: "requestedAppId",
  dateRange: "requestedDateRange",
  filterExpr: "requestedFilterExpr",
  rootSpanName: "requestedRootSpanName",
} as const;

// Stands in for the page. A pick is merged into the requested props, and a
// new request from outside replaces it.
function Host({
  asked,
  onFilterChange,
}: {
  asked: any;
  onFilterChange: (state: FilterState) => void;
}) {
  const [pick, setPick] = useState<{ on: any; request: any } | null>(null);
  const request = pick !== null && pick.on === asked ? pick.request : asked;

  return (
    <FilterBar
      teamId="team-1"
      entity="builds"
      {...request}
      onRequestChange={(change: Partial<FilterRequest>) =>
        setPick({
          on: asked,
          request: {
            ...request,
            ...Object.fromEntries(
              Object.entries(change).map(([field, value]) => [
                propOfField[field as keyof FilterRequest],
                value,
              ]),
            ),
          },
        })
      }
      onFilterChange={onFilterChange}
    />
  );
}

async function renderBar(props: any = {}) {
  const onFilterChange = jest.fn();
  const bar = (asked: any) => (
    <Host
      asked={{ ...nothingRequested, ...props, ...asked }}
      onFilterChange={onFilterChange}
    />
  );

  let result: any;
  await act(async () => {
    result = render(bar({}));
  });

  const askAgain = async (asked: any) => {
    await act(async () => {
      result.rerender(bar(asked));
    });
  };

  return { onFilterChange, ...result, askAgain };
}

function lastState(onFilterChange: jest.Mock): FilterState {
  const calls = onFilterChange.mock.calls as any[][];
  return calls[calls.length - 1][0];
}

const click = async (element: HTMLElement) => {
  await act(async () => {
    fireEvent.click(element);
  });
};

function pickerOf(trigger: HTMLElement) {
  return within(trigger.closest("[data-testid='key-picker']") as HTMLElement);
}

function wholeFilterPicker() {
  return pickerOf(screen.getByTestId("filter-input"));
}

function groupPicker(group: HTMLElement) {
  return pickerOf(within(group).getByLabelText("Add a filter to this group"));
}

function marksInBar() {
  return [...document.querySelectorAll(".decoration-wavy")].map(
    (mark) => mark.textContent,
  );
}

async function pickValue() {
  await click(screen.getAllByTestId("pick-value").at(-1)!);
}

async function addCondition(
  picker = wholeFilterPicker(),
  keyName = "mapping_type",
) {
  await click(picker.getByTestId(`pick-key-${keyName}`));
  await pickValue();
}

describe("FilterBar", () => {
  beforeEach(() => {
    storeInstance = createFiltersStore();
    appsLoaded();
    keysLoaded();
    // Most tests leave the root span selector off, so the bar passes null
    // and the query stays in its disabled pending state.
    mockUseRootSpanNamesQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      isSuccess: false,
    });
    mockToastNegative.mockClear();
  });

  describe("what it opens on", () => {
    it("waits for the apps before reporting anything to filter by", async () => {
      mockUseAppsQuery.mockReturnValue({ status: "pending", data: undefined });
      const { onFilterChange } = await renderBar();

      expect(lastState(onFilterChange).status).toBe("pending");
    });

    it("reports the app and range it settled on", async () => {
      const { onFilterChange } = await renderBar();

      const state = lastState(onFilterChange);
      expect(state).toMatchObject({ status: "ready", app: apps[0] });
      expect(state.status === "ready" && state.date.dateRange).toBe(
        "Last 6 Hours",
      );
    });

    it("takes the requested app", async () => {
      const { onFilterChange } = await renderBar({ requestedAppId: "app-2" });

      expect(lastState(onFilterChange)).toMatchObject({ app: apps[1] });
    });

    it("reports the request as applied when everything asked for is honoured", async () => {
      const { onFilterChange } = await renderBar({
        requestedAppId: "app-2",
        requestedDateRange: {
          dateRange: "Last Week",
          startDate: null,
          endDate: null,
        },
      });

      expect(lastState(onFilterChange)).toMatchObject({
        status: "ready",
        appliedAsRequested: true,
      });
    });

    it("keeps the app another page left on the store", async () => {
      storeInstance.getState().setSelectedApp(apps[1]);
      const { onFilterChange } = await renderBar();

      expect(lastState(onFilterChange)).toMatchObject({ app: apps[1] });
    });

    it("toasts when the requested root span name is unknown to the app", async () => {
      mockUseRootSpanNamesQuery.mockReturnValue({
        data: ["checkout", "startup"],
        isPending: false,
        isError: false,
        isSuccess: true,
      });
      const { onFilterChange } = await renderBar({
        requestedAppId: "app-1",
        showRootSpanSelector: true,
        requestedRootSpanName: "gone",
      });

      expect(mockToastNegative).toHaveBeenCalledWith(
        "Some filters were invalid, page reset to defaults",
      );
      expect(lastState(onFilterChange)).toMatchObject({
        status: "ready",
        rootSpanName: "checkout",
        appliedAsRequested: false,
      });
    });

    it("resolves with no name when the app has never reported a trace", async () => {
      mockUseRootSpanNamesQuery.mockReturnValue({
        data: [],
        isPending: false,
        isError: false,
        isSuccess: true,
      });
      const { onFilterChange } = await renderBar({
        requestedAppId: "app-1",
        showRootSpanSelector: true,
      });

      expect(lastState(onFilterChange)).toMatchObject({
        status: "ready",
        app: apps[0],
        rootSpanName: null,
        appliedAsRequested: true,
      });
      expect(mockToastNegative).not.toHaveBeenCalled();
    });

    it("does not toast for a root span name with no requested app", async () => {
      mockUseRootSpanNamesQuery.mockReturnValue({
        data: ["checkout", "startup"],
        isPending: false,
        isError: false,
        isSuccess: true,
      });
      // The link's name belongs to the app the link asked for; without a
      // requested app the name is not judged against the selected app's list.
      await renderBar({
        showRootSpanSelector: true,
        requestedRootSpanName: "gone",
      });

      expect(mockToastNegative).not.toHaveBeenCalled();
    });

    it("ranks the requested app above the one another page left on the store", async () => {
      storeInstance.getState().setSelectedApp(apps[1]);
      const { onFilterChange } = await renderBar({ requestedAppId: "app-1" });

      // Every ready state carries the requested app; a first report built
      // from the remembered app would overwrite the link's app in the URL.
      for (const [state] of onFilterChange.mock.calls) {
        if (state.status === "ready") {
          expect(state.app).toEqual(apps[0]);
        }
      }
      expect(lastState(onFilterChange)).toMatchObject({ app: apps[0] });
      expect(storeInstance.getState().selectedApp).toEqual(apps[0]);
    });

    it("falls back to the team's first app when the requested one is gone", async () => {
      const { onFilterChange } = await renderBar({
        requestedAppId: "app-gone",
      });

      expect(lastState(onFilterChange)).toMatchObject({ app: apps[0] });
    });

    it("takes the requested range", async () => {
      const { onFilterChange } = await renderBar({
        requestedDateRange: {
          dateRange: "Last Week",
          startDate: null,
          endDate: null,
        },
      });

      const state = lastState(onFilterChange);
      expect(state.status === "ready" && state.date.dateRange).toBe(
        "Last Week",
      );
    });

    it("keeps the stored range when the requested one cannot be read", async () => {
      storeInstance.getState().setSelectedDateRange("Last 24 Hours");
      const { onFilterChange } = await renderBar({
        requestedDateRange: {
          dateRange: "Last Fortnight",
          startDate: null,
          endDate: null,
        },
      });

      const state = lastState(onFilterChange);
      expect(state.status === "ready" && state.date.dateRange).toBe(
        "Last 24 Hours",
      );
    });

    it("does not report the stored range before the requested one", async () => {
      storeInstance.getState().setSelectedApp(apps[0]);
      storeInstance.getState().setSelectedDateRange("Last 24 Hours");
      const { onFilterChange } = await renderBar({
        requestedDateRange: {
          dateRange: "Last Week",
          startDate: null,
          endDate: null,
        },
      });

      const ranges = onFilterChange.mock.calls
        .map(([state]: [FilterState]) => state)
        .filter((state: FilterState) => state.status === "ready")
        .map(
          (state: FilterState & { status: "ready" }) => state.date.dateRange,
        );
      expect(ranges).toEqual(["Last Week"]);
    });

    it("puts the app and the range on the store for other pages", async () => {
      await renderBar({ requestedAppId: "app-2" });

      expect(storeInstance.getState().selectedApp).toEqual(apps[1]);
      expect(storeInstance.getState().selectedDateRange).toBe("Last 6 Hours");
    });
  });

  describe("when there is nothing to filter by", () => {
    it("reports a team with no apps as an error", async () => {
      appsLoaded([]);
      const { onFilterChange } = await renderBar();

      expect(lastState(onFilterChange)).toEqual({
        status: "error",
        message: expect.stringContaining("don't have any apps yet"),
      });
    });

    it("reports an apps request that failed as an error", async () => {
      mockUseAppsQuery.mockReturnValue({ status: "error", data: undefined });
      const { onFilterChange } = await renderBar();

      expect(lastState(onFilterChange)).toEqual({
        status: "error",
        message: expect.stringContaining("Error fetching apps"),
      });
    });

    it("draws no message of its own", async () => {
      appsLoaded([]);
      await renderBar();

      expect(screen.queryByText(/don't have any apps yet/)).toBeNull();
      expect(screen.queryByTestId("filter-bar")).toBeNull();
    });
  });

  describe("the requested expression", () => {
    it("is drawn as conditions", async () => {
      await renderBar({ requestedFilterExpr: "mapping_type:in:dsym" });

      expect(screen.getByTestId("operator-picker")).toBeInTheDocument();
      expect(screen.getByTestId("value-picker")).toBeInTheDocument();
      expect(screen.getByLabelText("Remove condition")).toBeInTheDocument();
    });

    it("stands in for the values an operator takes, one or many", async () => {
      keysLoaded([
        mappingTypeKey,
        { ...versionKey, operators: ["contains"] } as FilterKey,
      ]);
      await renderBar();

      await click(wholeFilterPicker().getByTestId("pick-key-mapping_type"));
      expect(screen.getByText("<values>")).toBeInTheDocument();

      await click(wholeFilterPicker().getByTestId("pick-key-version_name"));
      expect(screen.getByText("<value>")).toBeInTheDocument();
    });

    it("draws the groups it was written with", async () => {
      await renderBar({
        requestedFilterExpr:
          "mapping_type:in:dsym AND (version_name:in:1.0 OR version_name:in:1.1)",
      });

      const group = screen.getByRole("group", { name: "Filter group" });
      expect(within(group).getAllByLabelText("Remove condition")).toHaveLength(
        2,
      );
    });

    it("reports again when the request changes, even to the same resolution", async () => {
      const { onFilterChange, askAgain } = await renderBar({
        requestedAppId: "app-1",
      });
      expect(lastState(onFilterChange)).toMatchObject({
        status: "ready",
        app: { id: "app-1" },
      });
      const settledCalls = onFilterChange.mock.calls.length;

      // Dropping the app from the request resolves to the same app, date
      // and filter as before.
      await askAgain({ requestedAppId: null });

      expect(onFilterChange.mock.calls.length).toBeGreaterThan(settledCalls);
      expect(lastState(onFilterChange)).toMatchObject({
        status: "ready",
        app: { id: "app-1" },
      });
    });

    it("holds the page back until the keys can vouch for it", async () => {
      mockUseFilterKeysQuery.mockReturnValue({
        data: undefined,
        isPending: true,
        isError: false,
      } as any);
      const { onFilterChange } = await renderBar({
        requestedFilterExpr: "mapping_type:in:dsym",
      });

      expect(lastState(onFilterChange).status).toBe("pending");
    });

    it("does not judge a request by another app's keys", async () => {
      mockUseFilterKeysQuery.mockReturnValue({
        data: { keys: [versionKey], key_groups: ["Version"] },
        isPending: false,
        isPlaceholderData: true,
        isError: false,
      } as any);
      const { onFilterChange } = await renderBar({
        requestedFilterExpr: "mapping_type:in:dsym",
      });

      expect(lastState(onFilterChange).status).toBe("pending");
      expect(mockToastNegative).not.toHaveBeenCalled();
    });

    it("filters nothing when it is empty", async () => {
      const { onFilterChange } = await renderBar({ requestedFilterExpr: "" });

      expect(lastState(onFilterChange)).toMatchObject({
        status: "ready",
        filterExpr: null,
      });
      expect(mockToastNegative).not.toHaveBeenCalled();
    });

    it("filters nothing when it cannot be read", async () => {
      const { onFilterChange } = await renderBar({
        requestedFilterExpr: "nonsense:",
      });

      expect(lastState(onFilterChange)).toMatchObject({
        status: "ready",
        filterExpr: null,
      });
    });

    it("keeps a custom key the keys listing left out", async () => {
      // The app has more custom keys than the listing returns, so the
      // server serves custom.plan only when the request specifies it.
      mockUseFilterKeysQuery.mockImplementation(
        (_appId: string | undefined, _entity: string, keyNames: string[]) => ({
          data: {
            keys: keyNames.includes("custom.plan")
              ? [mappingTypeKey, versionKey, customPlanKey]
              : [mappingTypeKey, versionKey],
            key_groups: ["Build", "Version", "Custom"],
          },
          isPending: false,
          isError: false,
        }),
      );

      const { onFilterChange } = await renderBar({
        requestedFilterExpr: "custom.plan:in:pro",
      });

      expect(lastState(onFilterChange)).toMatchObject({
        status: "ready",
        filterExpr: "custom.plan:in:pro",
      });
      expect(mockToastNegative).not.toHaveBeenCalled();
    });

    it("filters nothing when it names a key this app does not have", async () => {
      const { onFilterChange } = await renderBar({
        requestedFilterExpr: "device_cohort:in:new",
      });

      expect(lastState(onFilterChange)).toMatchObject({
        status: "ready",
        filterExpr: null,
      });
    });

    it("draws a condition with no value yet, and reports without it", async () => {
      const { onFilterChange } = await renderBar({
        requestedFilterExpr: "mapping_type:in:dsym AND version_name:in:",
      });

      expect(screen.getAllByLabelText("Remove condition")).toHaveLength(2);
      expect(screen.getByText("<values>")).toBeInTheDocument();
      expect(lastState(onFilterChange)).toMatchObject({
        status: "ready",
        filterExpr: "mapping_type:in:dsym",
        appliedAsRequested: true,
      });
      expect(mockToastNegative).not.toHaveBeenCalled();
    });
  });

  describe("a request from outside", () => {
    it("replaces a pick", async () => {
      const { onFilterChange, askAgain } = await renderBar();

      await click(screen.getByTestId("pick-app-app-2"));
      await addCondition();
      expect(lastState(onFilterChange)).toMatchObject({
        app: apps[1],
        filterExpr: "mapping_type:in:dsym",
      });

      await askAgain({
        requestedAppId: "app-1",
        requestedFilterExpr: "version_name:in:1.0",
      });

      expect(lastState(onFilterChange)).toMatchObject({
        app: apps[0],
        filterExpr: "version_name:in:1.0",
      });
      expect(screen.getByTestId("app-select")).toHaveAttribute(
        "data-selected",
        "Checkout",
      );
    });

    it("drops a condition with no value yet", async () => {
      const { onFilterChange, askAgain } = await renderBar();

      await click(wholeFilterPicker().getByTestId("pick-key-mapping_type"));
      expect(screen.getByLabelText("Remove condition")).toBeInTheDocument();

      await askAgain({});

      expect(screen.queryByLabelText("Remove condition")).toBeNull();
      expect(lastState(onFilterChange)).toMatchObject({ filterExpr: null });
    });
  });

  describe("opening the key list from the bar", () => {
    const wholePicker = () =>
      screen
        .getByTestId("filter-input")
        .closest("[data-testid='key-picker']") as HTMLElement;

    it("opens the list from a click on the empty space", async () => {
      await renderBar();

      expect(wholePicker()).toHaveAttribute("data-open", "false");

      await click(screen.getByTestId("filter-bar"));

      expect(wholePicker()).toHaveAttribute("data-open", "true");
    });

    it("opens it from the space left once conditions are on screen", async () => {
      await renderBar();

      await addCondition();
      await click(screen.getByTestId("filter-bar"));

      expect(wholePicker()).toHaveAttribute("data-open", "true");
    });

    it("leaves a click on a control to that control", async () => {
      const { onFilterChange } = await renderBar();

      await addCondition();
      await click(screen.getByLabelText("Remove condition"));

      expect(wholePicker()).toHaveAttribute("data-open", "false");
      expect(lastState(onFilterChange)).toMatchObject({ filterExpr: null });
    });

    it("leaves the bar alone while the filter is edited as text", async () => {
      await renderBar();

      await click(screen.getByLabelText("Edit as text"));
      await click(screen.getByTestId("filter-bar"));

      expect(screen.getByTestId("filter-text")).toBeInTheDocument();
    });
  });

  describe("editing", () => {
    it("reports nothing for a condition that is still half built", async () => {
      const { onFilterChange } = await renderBar();

      await click(wholeFilterPicker().getByTestId("pick-key-mapping_type"));

      expect(lastState(onFilterChange)).toMatchObject({ filterExpr: null });
    });

    it("reports the expression once a condition has a value", async () => {
      const { onFilterChange } = await renderBar();

      await addCondition();

      expect(lastState(onFilterChange)).toMatchObject({
        filterExpr: "mapping_type:in:dsym",
      });
    });

    it("reports a pick the page handed back as applied", async () => {
      const { onFilterChange } = await renderBar();

      await addCondition();

      expect(lastState(onFilterChange)).toMatchObject({
        appliedAsRequested: true,
      });
    });

    it("still filters by a condition changed while the server is refusing one", async () => {
      const { onFilterChange } = await renderBar({
        requestedFilterExpr: "mapping_type:in:dsym",
        filterExprIssues: [
          { message: 'Key "mapping_type" has no value "dsym"' },
        ],
      });

      expect(screen.getByTestId("filter-issue")).toBeInTheDocument();

      await click(screen.getByTestId("pick-op-not_in"));

      expect(lastState(onFilterChange)).toMatchObject({
        filterExpr: "mapping_type:not_in:dsym",
      });
    });

    it("clears the conditions when another app is picked", async () => {
      const { onFilterChange } = await renderBar();

      await addCondition();
      await click(screen.getByTestId("pick-app-app-2"));

      expect(lastState(onFilterChange)).toMatchObject({
        app: apps[1],
        filterExpr: null,
      });
    });

    it("reports the new range, and keeps the expression", async () => {
      const { onFilterChange } = await renderBar();

      await addCondition();
      await click(screen.getByTestId("pick-range"));

      const state = lastState(onFilterChange);
      expect(state).toMatchObject({ filterExpr: "mapping_type:in:dsym" });
      expect(state.status === "ready" && state.date.dateRange).toBe(
        "Last Week",
      );
      expect(storeInstance.getState().selectedDateRange).toBe("Last Week");
    });

    it("switches the whole filter between and and or", async () => {
      const { onFilterChange } = await renderBar();

      await addCondition();
      await addCondition();

      expect(lastState(onFilterChange)).toMatchObject({
        filterExpr: "mapping_type:in:dsym AND mapping_type:in:dsym",
      });

      await click(screen.getByTestId("filter-logical-operator"));

      expect(lastState(onFilterChange)).toMatchObject({
        filterExpr: "mapping_type:in:dsym OR mapping_type:in:dsym",
      });
    });

    it("starts a condition again when its key is changed", async () => {
      const { onFilterChange } = await renderBar();

      await addCondition();
      await click(screen.getByTestId("pick-key-version_name-in-row"));

      expect(lastState(onFilterChange)).toMatchObject({ filterExpr: null });
    });

    it("keeps the values when the operator wants the same kind", async () => {
      const { onFilterChange } = await renderBar();

      await addCondition();
      await click(screen.getByTestId("pick-op-not_in"));

      expect(lastState(onFilterChange)).toMatchObject({
        filterExpr: "mapping_type:not_in:dsym",
      });
    });

    it("drops a condition that is removed", async () => {
      const { onFilterChange } = await renderBar();

      await addCondition();
      await act(async () => {
        fireEvent.click(screen.getByLabelText("Remove condition"));
      });

      expect(lastState(onFilterChange)).toMatchObject({ filterExpr: null });
    });

    it("clears every condition at once", async () => {
      const { onFilterChange } = await renderBar();

      await addCondition();
      await click(screen.getByTestId("filter-clear"));

      expect(lastState(onFilterChange)).toMatchObject({ filterExpr: null });
      expect(screen.queryByTestId("filter-clear")).toBeNull();
    });
  });

  describe("where focus goes", () => {
    it("moves to the condition before the one removed", async () => {
      await renderBar();

      await addCondition();
      await addCondition(wholeFilterPicker(), "version_name");

      await click(screen.getAllByLabelText("Remove condition").at(-1)!);

      expect(document.activeElement).toHaveTextContent("File type");
    });

    it("moves to the condition before the one removed inside a group", async () => {
      await renderBar();

      await addCondition(wholeFilterPicker(), "version_name");
      await click(wholeFilterPicker().getByTestId("add-group"));
      const group = () => screen.getByRole("group", { name: "Filter group" });
      await addCondition(groupPicker(group()));
      await addCondition(groupPicker(group()));

      await click(
        within(group()).getAllByLabelText("Remove condition").at(-1)!,
      );

      expect(document.activeElement).toHaveTextContent("File type");
    });

    it("leaves a group for the condition before it", async () => {
      await renderBar();

      await addCondition(wholeFilterPicker(), "version_name");
      await click(wholeFilterPicker().getByTestId("add-group"));
      const group = screen.getByRole("group", {
        name: "Filter group",
      });
      await addCondition(groupPicker(group));

      await click(within(group).getByLabelText("Remove condition"));

      expect(document.activeElement).toHaveTextContent("App version");
    });

    it("goes to the add control when nothing is drawn before", async () => {
      await renderBar();

      await addCondition();
      await click(screen.getByLabelText("Remove condition"));

      expect(document.activeElement).toBe(screen.getByTestId("filter-input"));
    });
  });

  describe("grouping", () => {
    const onlyGroup = () => screen.getByRole("group", { name: "Filter group" });

    async function addGroup(picker = wholeFilterPicker()) {
      await click(picker.getByTestId("add-group"));
    }

    it("opens a group with nothing in it yet", async () => {
      const { onFilterChange } = await renderBar();

      await addGroup();

      expect(
        within(onlyGroup()).getByLabelText("Add a filter to this group"),
      ).toBeInTheDocument();
      expect(
        within(onlyGroup()).queryByLabelText("Remove condition"),
      ).toBeNull();
      expect(lastState(onFilterChange)).toMatchObject({ filterExpr: null });
    });

    it("reports a group as its own part of the filter", async () => {
      const { onFilterChange } = await renderBar();

      await addCondition();
      await addGroup();
      await addCondition(groupPicker(onlyGroup()));
      await addCondition(groupPicker(onlyGroup()));
      await click(within(onlyGroup()).getByTestId("filter-logical-operator"));

      expect(lastState(onFilterChange)).toMatchObject({
        filterExpr:
          "mapping_type:in:dsym AND (mapping_type:in:dsym OR mapping_type:in:dsym)",
      });
    });

    it("switches a group between and and or without touching the filter", async () => {
      const { onFilterChange } = await renderBar();

      await addCondition();
      await addCondition();
      await addGroup();
      await addCondition(groupPicker(onlyGroup()));
      await addCondition(groupPicker(onlyGroup()));
      await click(within(onlyGroup()).getByTestId("filter-logical-operator"));

      const state = lastState(onFilterChange);
      expect(state).toMatchObject({
        filterExpr:
          "mapping_type:in:dsym AND mapping_type:in:dsym AND (mapping_type:in:dsym OR mapping_type:in:dsym)",
      });
    });

    it("keeps a group of one condition in what it reports", async () => {
      const { onFilterChange } = await renderBar();

      await addCondition();
      await addGroup();
      await addCondition(groupPicker(onlyGroup()));

      expect(lastState(onFilterChange)).toMatchObject({
        filterExpr: "mapping_type:in:dsym AND (mapping_type:in:dsym)",
      });
    });

    it("drops a group and everything in it", async () => {
      const { onFilterChange } = await renderBar();

      await addCondition();
      await addGroup();
      await addCondition(groupPicker(onlyGroup()));
      await click(screen.getByLabelText("Remove group"));

      expect(screen.queryByRole("group")).toBeNull();
      expect(lastState(onFilterChange)).toMatchObject({
        filterExpr: "mapping_type:in:dsym",
      });
    });

    it("drops a group along with the last condition in it", async () => {
      await renderBar();

      await addGroup();
      await addCondition(groupPicker(onlyGroup()));
      await click(within(onlyGroup()).getByLabelText("Remove condition"));

      expect(screen.queryByRole("group")).toBeNull();
    });

    it("declines a group nested deeper than the server allows", async () => {
      await renderBar();

      const innermost = () => screen.getAllByRole("group").at(-1)!;

      await addGroup();
      await addGroup(groupPicker(innermost()));
      expect(mockToastNegative).not.toHaveBeenCalled();

      await addGroup(groupPicker(innermost()));

      expect(mockToastNegative).toHaveBeenCalledWith(
        "Filter groups cannot be nested deeper",
      );
      expect(screen.getAllByRole("group")).toHaveLength(2);
    });
  });

  describe("editing the filter as text", () => {
    const textBox = () => screen.getByTestId("filter-text");

    async function startTyping() {
      await click(screen.getByLabelText("Edit as text"));
    }

    async function type(expr: string) {
      await act(async () => {
        fireEvent.change(textBox(), { target: { value: expr } });
      });
    }

    async function pressEnter() {
      await act(async () => {
        fireEvent.keyDown(textBox(), { key: "Enter" });
      });
    }

    it("opens on the expression the conditions say", async () => {
      await renderBar();

      await addCondition();
      await startTyping();

      expect(textBox()).toHaveValue("mapping_type:in:dsym");
    });

    it("shows a condition still waiting for its values", async () => {
      await renderBar();

      await click(wholeFilterPicker().getByTestId("pick-key-mapping_type"));
      await startTyping();

      expect(textBox()).toHaveValue("mapping_type:in:");
    });

    it("filters by what was typed once it is applied", async () => {
      const { onFilterChange } = await renderBar();

      await startTyping();
      await type("version_name:in:1.0");
      expect(lastState(onFilterChange)).toMatchObject({ filterExpr: null });

      await pressEnter();

      expect(lastState(onFilterChange)).toMatchObject({
        filterExpr: "version_name:in:1.0",
      });
    });

    it("says what is wrong and filters nothing while it is", async () => {
      const { onFilterChange } = await renderBar();

      await startTyping();
      await type("version_name:in:1.0 AND");
      await pressEnter();

      expect(screen.getByTestId("filter-issue")).toHaveTextContent(
        "Filter ends where a condition was expected",
      );
      expect(lastState(onFilterChange)).toMatchObject({ filterExpr: null });
    });

    it("says so for a key this app does not have", async () => {
      await renderBar();

      await startTyping();
      await type("device_cohort:in:new");

      expect(screen.getByTestId("filter-issue")).toHaveTextContent(
        "There is no filter named device_cohort",
      );
    });

    it("counts the issues it is not naming", async () => {
      await renderBar();

      await startTyping();
      await type("device_cohort:in:new AND another_missing:in:x");

      expect(screen.getByTestId("filter-issue")).toHaveTextContent(
        "There is no filter named device_cohort (+1 more)",
      );
    });

    it("counts the keys it cannot use alongside text it cannot read", async () => {
      await renderBar();

      await startTyping();
      await type("device_cohort:in:new AND another_missing:in:x)");

      expect(screen.getByTestId("filter-issue")).toHaveTextContent(
        "There is no filter named device_cohort (+2 more)",
      );
    });

    it("names the issue that comes first in the text", async () => {
      await renderBar();

      await startTyping();
      await type("mapping_type:in:proguard AND device_cohort:in:new)");

      expect(screen.getByTestId("filter-issue")).toHaveTextContent(
        "There is no filter named device_cohort (+1 more)",
      );
    });

    it("says so for an operator the key is not compared with", async () => {
      await renderBar();

      await startTyping();
      await type("mapping_type:gt:2");

      expect(screen.getByTestId("filter-issue")).toHaveTextContent(
        "File type cannot be compared with gt",
      );
    });

    it("discards a requested expression holding more conditions than the limit", async () => {
      const tooMany = Array.from(
        { length: MAX_CONDITIONS + 1 },
        () => "mapping_type:in:dsym",
      ).join(" AND ");
      const { onFilterChange } = await renderBar({
        requestedFilterExpr: tooMany,
      });

      const state = lastState(onFilterChange);
      expect(state.status === "ready" && state.filterExpr).toBeNull();
      expect(mockToastNegative).toHaveBeenCalledWith(
        "Some filters were invalid, page reset to defaults",
      );
    });

    it("marks the span the server refused", async () => {
      await renderBar({
        requestedFilterExpr: "mapping_type:in:dsym",
        filterExprIssues: [
          {
            message: 'Key "mapping_type" has no value "dsym"',
            span: { start: 0, end: 20 },
          },
        ],
      });

      await click(screen.getByTestId("filter-toggle-text"));

      expect(screen.getByTestId("filter-issue")).toHaveTextContent(
        'Key "mapping_type" has no value "dsym"',
      );
      expect(marksInBar()).toEqual(["mapping_type", ":", "in", ":", "dsym"]);
    });

    it("says what the server refused for text holding brackets and extra spaces", async () => {
      await renderBar({
        requestedFilterExpr: "mapping_type:in:[dsym]  AND version_name:in:1.0",
        filterExprIssues: [
          { message: 'Key "mapping_type" has no value "dsym"' },
        ],
      });

      expect(screen.getByTestId("filter-issue")).toHaveTextContent(
        'Key "mapping_type" has no value "dsym"',
      );
    });

    it("drops the message once the text would filter by something else", async () => {
      const { onFilterChange } = await renderBar({
        requestedFilterExpr: "mapping_type:in:dsym",
        filterExprIssues: [
          {
            message: 'Key "mapping_type" has no value "dsym"',
            span: { start: 0, end: 20 },
          },
        ],
      });

      await click(screen.getByTestId("filter-toggle-text"));
      await type("mapping_type:in:proguard");

      expect(screen.queryByTestId("filter-issue")).not.toBeInTheDocument();

      await pressEnter();

      expect(lastState(onFilterChange)).toMatchObject({
        filterExpr: "mapping_type:in:proguard",
      });
    });

    it("keeps the message but drops the marks when only the spacing changed", async () => {
      await renderBar({
        requestedFilterExpr: "mapping_type:in:dsym",
        filterExprIssues: [
          {
            message: 'Key "mapping_type" has no value "dsym"',
            span: { start: 0, end: 20 },
          },
        ],
      });

      await click(screen.getByTestId("filter-toggle-text"));
      await type("  mapping_type:in:dsym");

      expect(screen.getByTestId("filter-issue")).toHaveTextContent(
        'Key "mapping_type" has no value "dsym"',
      );
      expect(marksInBar()).toEqual([]);
    });

    it("refuses to go back to conditions while the text is wrong", async () => {
      await renderBar();

      await startTyping();
      await type("version_name:in:1.0 AND");
      await click(screen.getByLabelText("Edit as conditions"));

      expect(textBox()).toBeInTheDocument();
      expect(mockToastNegative).toHaveBeenCalledWith(
        "Filter ends where a condition was expected",
      );
    });

    it("goes back to conditions while the server is refusing a value", async () => {
      const { onFilterChange } = await renderBar({
        requestedFilterExpr: "mapping_type:in:dsym",
        filterExprIssues: [
          { message: 'Key "mapping_type" has no value "dsym"' },
        ],
      });

      await click(screen.getByLabelText("Edit as text"));
      const before = onFilterChange.mock.calls.length;
      await click(screen.getByLabelText("Edit as conditions"));

      expect(screen.queryByTestId("filter-text")).not.toBeInTheDocument();
      expect(mockToastNegative).not.toHaveBeenCalled();
      expect(onFilterChange.mock.calls.length).toBe(before);

      expect(screen.getByTestId("filter-issue")).toHaveTextContent(
        'Key "mapping_type" has no value "dsym"',
      );

      await click(screen.getByTestId("pick-op-not_in"));

      expect(lastState(onFilterChange)).toMatchObject({
        filterExpr: "mapping_type:not_in:dsym",
      });
    });

    it("draws what was typed as conditions on the way back", async () => {
      await renderBar();

      await startTyping();
      await type("version_name:in:1.0 AND (mapping_type:in:dsym)");
      await click(screen.getByLabelText("Edit as conditions"));

      expect(screen.queryByTestId("filter-text")).toBeNull();
      expect(screen.getAllByLabelText("Remove condition")).toHaveLength(2);
      expect(
        screen.getByRole("group", { name: "Filter group" }),
      ).toBeInTheDocument();
    });

    it("empties the editor when the filter is cleared", async () => {
      const { onFilterChange } = await renderBar();

      await addCondition();
      await startTyping();
      await type("version_name:in:1.0");
      await click(screen.getByTestId("filter-clear"));

      expect(textBox()).toHaveValue("");
      expect(lastState(onFilterChange)).toMatchObject({ filterExpr: null });
    });

    it("empties the editor when another app is picked", async () => {
      await renderBar();

      await startTyping();
      await type("version_name:in:1.0");
      await click(screen.getByTestId("pick-app-app-2"));

      expect(textBox()).toHaveValue("");
    });

    it("puts back the filter the page is on when it is left without applying", async () => {
      const { onFilterChange } = await renderBar();

      await addCondition();
      await startTyping();
      await type("version_name:in:1.0");
      await act(async () => {
        fireEvent.keyDown(textBox(), { key: "Escape" });
      });

      expect(screen.queryByTestId("filter-text")).toBeNull();
      expect(lastState(onFilterChange)).toMatchObject({
        filterExpr: "mapping_type:in:dsym",
      });
    });
  });

  describe("a user-defined key", () => {
    beforeEach(() => {
      keysLoaded(
        [mappingTypeKey, versionKey, customPremiumKey, customPlanKey],
        ["Build", "Version", "Custom"],
      );
    });

    it("draws a requested custom condition and filters by it", async () => {
      const { onFilterChange } = await renderBar({
        requestedFilterExpr: "custom.is_premium:eq:true",
      });

      expect(screen.getByTestId("operator-picker")).toBeInTheDocument();
      expect(lastState(onFilterChange)).toMatchObject({
        status: "ready",
        filterExpr: "custom.is_premium:eq:true",
      });
    });

    it("names the condition by the raw attribute name", async () => {
      await renderBar();

      await click(
        wholeFilterPicker().getByTestId("pick-key-custom.is_premium"),
      );

      // The key control of the new condition takes focus, so the text on it is
      // what the chip shows for this key.
      expect(document.activeElement?.textContent).toBe("is_premium");
    });

    it("serializes a picked custom key under its full dotted name", async () => {
      const { onFilterChange } = await renderBar();

      await addCondition(wholeFilterPicker(), "custom.plan");

      expect(lastState(onFilterChange)).toMatchObject({
        filterExpr: "custom.plan:in:dsym",
      });
    });

    it("asks the keys query for a custom key typed by hand", async () => {
      // The app has more custom keys than the listing returns, so the
      // server serves custom.plan only when the request specifies it.
      mockUseFilterKeysQuery.mockImplementation(
        (_appId: string | undefined, _entity: string, keyNames: string[]) => ({
          data: {
            keys: keyNames.includes("custom.plan")
              ? [mappingTypeKey, versionKey, customPlanKey]
              : [mappingTypeKey, versionKey],
            key_groups: ["Build", "Version", "Custom"],
          },
          isPending: false,
          isError: false,
        }),
      );

      const { onFilterChange } = await renderBar();

      await click(screen.getByLabelText("Edit as text"));
      await act(async () => {
        fireEvent.change(screen.getByTestId("filter-text"), {
          target: { value: "custom.plan:in:pro" },
        });
      });

      expect(mockUseFilterKeysQuery).toHaveBeenLastCalledWith(
        "app-1",
        "builds",
        ["custom.plan"],
      );
      expect(screen.queryByTestId("filter-issue")).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.keyDown(screen.getByTestId("filter-text"), { key: "Enter" });
      });

      expect(lastState(onFilterChange)).toMatchObject({
        filterExpr: "custom.plan:in:pro",
      });
    });

    it("does not ask for a custom key still being typed", async () => {
      await renderBar();

      await click(screen.getByLabelText("Edit as text"));
      await act(async () => {
        fireEvent.change(screen.getByTestId("filter-text"), {
          target: { value: "custom.pl" },
        });
      });

      expect(mockUseFilterKeysQuery).toHaveBeenLastCalledWith(
        "app-1",
        "builds",
        [],
      );
    });

    it("round-trips a typed custom condition through the text editor", async () => {
      const { onFilterChange } = await renderBar();

      await click(screen.getByLabelText("Edit as text"));
      await act(async () => {
        fireEvent.change(screen.getByTestId("filter-text"), {
          target: {
            value: "custom.plan:in:pro AND custom.is_premium:eq:true",
          },
        });
      });
      await click(screen.getByLabelText("Edit as conditions"));

      expect(screen.queryByTestId("filter-issue")).not.toBeInTheDocument();
      expect(screen.getAllByLabelText("Remove condition")).toHaveLength(2);
      expect(lastState(onFilterChange)).toMatchObject({
        filterExpr: "custom.plan:in:pro AND custom.is_premium:eq:true",
      });
    });
  });

  describe("while the keys are on their way", () => {
    it("shows no bar to filter with", async () => {
      mockUseFilterKeysQuery.mockReturnValue({
        data: undefined,
        isPending: true,
        isError: false,
      } as any);
      await renderBar();

      expect(screen.queryByTestId("filter-bar")).toBeNull();
    });

    it("still reports what it is filtering by, so the page can fetch", async () => {
      mockUseFilterKeysQuery.mockReturnValue({
        data: undefined,
        isPending: true,
        isError: false,
      } as any);
      const { onFilterChange } = await renderBar();

      expect(lastState(onFilterChange).status).toBe("ready");
    });
  });

  describe("when the keys cannot be fetched", () => {
    it("keeps the bar drawn but refuses input", async () => {
      mockUseFilterKeysQuery.mockReturnValue({
        data: undefined,
        isPending: false,
        isError: true,
      } as any);
      await renderBar();

      expect(screen.getByTestId("filter-bar")).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    });

    it("leaves nothing a keyboard can reach", async () => {
      mockUseFilterKeysQuery.mockReturnValue({
        data: undefined,
        isPending: false,
        isError: true,
      } as any);
      await renderBar();

      const bar = screen.getByTestId("filter-bar");
      expect(bar.querySelectorAll("button")).toHaveLength(0);
      expect(bar).toHaveTextContent("Filter…");
    });

    it("draws no message of its own, and reports one for the page", async () => {
      mockUseFilterKeysQuery.mockReturnValue({
        data: undefined,
        isPending: false,
        isError: true,
      } as any);
      const { onFilterChange } = await renderBar();

      expect(screen.queryByText(/Error fetching filters/)).toBeNull();
      expect(lastState(onFilterChange)).toEqual({
        status: "error",
        message: expect.stringContaining("Error fetching filters"),
      });
    });
  });

  describe("when an edit would cross a limit", () => {
    it("declines the edit and names the limit that stopped it", async () => {
      const { onFilterChange } = await renderBar();

      for (let i = 0; i < MAX_CONDITIONS; i++) {
        await addCondition();
      }
      const filled = lastState(onFilterChange);
      await click(wholeFilterPicker().getByTestId("pick-key-mapping_type"));

      expect(mockToastNegative).toHaveBeenCalledWith(
        `A filter can hold at most ${MAX_CONDITIONS} conditions`,
      );
      expect(lastState(onFilterChange)).toMatchObject({
        filterExpr: (filled as any).filterExpr,
      });
    });

    it("says nothing while the filter is still inside every limit", async () => {
      await renderBar();

      for (let i = 0; i < MAX_CONDITIONS; i++) {
        await addCondition();
      }

      expect(mockToastNegative).not.toHaveBeenCalled();
    });
  });

  describe("when something requested cannot be honoured", () => {
    it("says so for an app the team no longer has", async () => {
      await renderBar({ requestedAppId: "app-gone" });

      expect(mockToastNegative).toHaveBeenCalledWith(
        "Some filters were invalid, page reset to defaults",
      );
    });

    it("says so for a range that does not read back", async () => {
      await renderBar({
        requestedDateRange: {
          dateRange: "Last Fortnight",
          startDate: null,
          endDate: null,
        },
      });

      expect(mockToastNegative).toHaveBeenCalledWith(
        "Some filters were invalid, page reset to defaults",
      );
    });

    it("says so for an expression that cannot be read", async () => {
      const { onFilterChange } = await renderBar({
        requestedFilterExpr: "mapping_type:in:dsym AND",
      });

      expect(mockToastNegative).toHaveBeenCalledWith(
        "Some filters were invalid, page reset to defaults",
      );
      expect(lastState(onFilterChange)).toMatchObject({
        status: "ready",
        appliedAsRequested: false,
      });
    });

    it("says so once, however much was refused", async () => {
      await renderBar({
        requestedAppId: "app-gone",
        requestedDateRange: {
          dateRange: "Last Fortnight",
          startDate: null,
          endDate: null,
        },
        requestedFilterExpr: "mapping_type:in:dsym AND",
      });

      expect(mockToastNegative).toHaveBeenCalledTimes(1);
    });

    it("stays quiet when everything requested is honoured", async () => {
      await renderBar({
        requestedAppId: "app-2",
        requestedDateRange: {
          dateRange: "Last Week",
          startDate: null,
          endDate: null,
        },
      });

      expect(mockToastNegative).not.toHaveBeenCalled();
    });

    it("stays quiet when nothing was requested", async () => {
      await renderBar();

      expect(mockToastNegative).not.toHaveBeenCalled();
    });

    it("stays quiet when the range asked for is the one it just reported", async () => {
      const { askAgain } = await renderBar({
        requestedDateRange: {
          dateRange: "Last 6 Hours",
          startDate: null,
          endDate: null,
        },
      });

      await click(screen.getByTestId("pick-range"));
      await askAgain({
        requestedDateRange: {
          dateRange: "Last Week",
          startDate: "2026-02-01T00:00:00.000Z",
          endDate: "2026-02-08T00:00:00.000Z",
        },
      });

      expect(mockToastNegative).not.toHaveBeenCalled();
    });
  });

  it("shows the placeholder until there is a condition", async () => {
    await renderBar({ placeholder: "Filter builds…" });

    expect(screen.getByTestId("filter-input")).toHaveTextContent(
      "Filter builds…",
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("pick-key-mapping_type"));
    });

    expect(screen.getByTestId("filter-input")).toHaveTextContent("");
  });
});
