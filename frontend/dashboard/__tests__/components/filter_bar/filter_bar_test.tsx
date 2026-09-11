import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";

const mockUseFilterKeysQuery = jest.fn();
const mockToastNegative = jest.fn();

jest.mock("@/app/components/toast", () => ({
  __esModule: true,
  toastNegative: (text: string) => mockToastNegative(text),
}));

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useFilterKeysQuery: (
    appId: string | undefined,
    entity: string,
    keyNames: string[],
  ) => mockUseFilterKeysQuery(appId, entity, keyNames),
}));

jest.mock("@/app/components/skeleton", () => ({
  __esModule: true,
  Skeleton: () => <div data-testid="skeleton" />,
}));

jest.mock("@/app/components/onboarding", () => ({
  __esModule: true,
  default: ({ teamId }: any) => (
    <div data-testid="onboarding" data-team={teamId} />
  ),
}));

jest.mock("@/app/components/dropdown_select", () => ({
  __esModule: true,
  DropdownSelectType: { SingleString: "SingleString" },
  default: ({ items, initialSelected, onChangeSelected }: any) => (
    <div data-testid="span-select" data-selected={initialSelected}>
      {items.map((item: string) => (
        <button
          key={item}
          data-testid={`pick-span-${item}`}
          onClick={() => onChangeSelected(item)}
        >
          {item}
        </button>
      ))}
    </div>
  ),
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
        <button
          data-testid="pick-custom-range"
          onClick={() =>
            onChange({
              dateRange: "Custom Range",
              startDate: "2026-02-01T00:00:00.000Z",
              endDate: "2026-02-08T00:00:00.000Z",
            })
          }
        >
          custom
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
    onOpenChange,
    trigger,
    open,
  }: any) => (
    <div
      data-testid="key-picker"
      data-groups={keyGroups.join(",")}
      data-open={String(open)}
    >
      {trigger}
      <button data-testid="open-keys" onClick={() => onOpenChange(true)}>
        open
      </button>
      {/* The real list is drawn only while the picker is open. */}
      {open && (
        <>
          {keys.map((key: any) => (
            <button
              key={key.name}
              data-testid={`pick-key-${key.name}${selected ? "-in-row" : ""}`}
              onClick={() => onSelect(key)}
            >
              pick {key.label}
            </button>
          ))}
          {onAddGroup && (
            <button data-testid="add-group" onClick={() => onAddGroup()}>
              group
            </button>
          )}
          <button data-testid="close-keys" onClick={() => onOpenChange(false)}>
            close
          </button>
        </>
      )}
    </div>
  ),
  OperatorPicker: ({
    operators,
    onSelect,
    onOpenChange,
    open,
    trigger,
  }: any) => (
    <div data-testid="operator-picker" data-open={String(open)}>
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
      <button data-testid="open-operator" onClick={() => onOpenChange(true)}>
        open
      </button>
      <button data-testid="close-operator" onClick={() => onOpenChange(false)}>
        close
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/filter_bar/value_picker", () => ({
  __esModule: true,
  default: ({ selected, onChange, open, onOpenChange, trigger }: any) => (
    <div data-testid="value-picker" data-open={String(open)}>
      {trigger}
      <button
        data-testid="pick-value"
        onClick={() => onChange([{ text: "dsym" }], false)}
      >
        choose dsym
      </button>
      <button
        data-testid="pick-another-value"
        onClick={() => onChange([...selected, { text: "proguard" }], false)}
      >
        choose proguard
      </button>
      <button data-testid="unpick-value" onClick={() => onChange([], false)}>
        take every value off
      </button>
      <button
        data-testid="pick-one-value"
        onClick={() => onChange([{ text: "dsym" }], true)}
      >
        choose dsym and finish
      </button>
      <button data-testid="open-values" onClick={() => onOpenChange(true)}>
        open
      </button>
      <button data-testid="close-values" onClick={() => onOpenChange(false)}>
        close
      </button>
    </div>
  ),
}));

import type { App } from "@/app/api/api_calls";
import type { FilterKey } from "@/app/api/filter_types";
import { toDateSelection } from "@/app/components/filter_bar/date_range_select";
import FilterBar, {
  type FilterChange,
  type FilterSelection,
} from "@/app/components/filter_bar/filter_bar";
import { MAX_CONDITIONS } from "@/app/components/filter_bar/limits";

const app = (id: string, name: string) => ({ id, name }) as App;
const apps = [app("app-1", "Checkout"), app("app-2", "Wallet")];

const mappingTypeKey = {
  name: "mapping_type",
  label: "File type",
  key_group: "Build",
  description: "The kind of mapping file",
  value_type: "string",
  value_suggestion_mode: "full_list",
  operators: ["in", "not_in", "contains"],
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

const patchKey = {
  name: "patch_id",
  label: "Patch",
  key_group: "Build",
  description: "Whether the build is a patch",
  value_type: "string",
  value_suggestion_mode: "none",
  operators: ["is_set", "is_not_set"],
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

const keys = [mappingTypeKey, versionKey, patchKey];
const keyGroups = ["Build", "Version"];

function keysServed(served: FilterKey[] = keys) {
  mockUseFilterKeysQuery.mockReturnValue({
    data: { keys: served, key_groups: keyGroups },
    isPending: false,
    isError: false,
  });
}

const last6Hours = toDateSelection({
  dateRange: "Last 6 Hours",
  startDate: null,
  endDate: null,
})!;

const settled: FilterSelection = {
  app: apps[0],
  date: last6Hours,
  filterExpr: null,
  rootSpanName: null,
  discarded: false,
};

function applyChange(
  value: FilterSelection,
  change: FilterChange,
): FilterSelection {
  return {
    app:
      change.appId === undefined
        ? value.app
        : apps.find((candidate) => candidate.id === change.appId)!,
    date:
      change.dateRange === undefined
        ? value.date
        : toDateSelection(change.dateRange)!,
    filterExpr:
      change.filterExpr === undefined ? value.filterExpr : change.filterExpr,
    rootSpanName:
      change.rootSpanName === undefined
        ? value.rootSpanName
        : change.rootSpanName,
    discarded: false,
  };
}

type BarProps = Partial<ComponentProps<typeof FilterBar>>;

async function renderBar(
  initial: Partial<FilterSelection> | null = {},
  props: BarProps = {},
) {
  let drawnValue: FilterSelection | null =
    initial === null ? null : { ...settled, ...initial };
  let liveValue = drawnValue;
  let held = false;
  let result!: ReturnType<typeof render>;
  const onChange = jest.fn((change: FilterChange) => {
    liveValue = applyChange(liveValue ?? settled, change);
    if (!held) {
      drawnValue = liveValue;
      result.rerender(bar());
    }
  });
  const bar = () => (
    <FilterBar
      entity="builds"
      teamId="team-1"
      status={{ kind: "ready" }}
      value={drawnValue}
      apps={apps}
      keys={keys}
      keyGroups={keyGroups}
      keysUnavailable={false}
      onChange={onChange}
      {...props}
    />
  );

  await act(async () => {
    result = render(bar());
  });

  const setValue = async (next: Partial<FilterSelection> | null) => {
    drawnValue = next === null ? null : { ...(drawnValue ?? settled), ...next };
    liveValue = drawnValue;
    await act(async () => {
      result.rerender(bar());
    });
  };

  const holdChanges = () => {
    held = true;
  };

  const land = async () => {
    drawnValue = liveValue;
    await act(async () => {
      result.rerender(bar());
    });
  };

  return { onChange, setValue, holdChanges, land };
}

function lastChange(onChange: jest.Mock): FilterChange {
  const calls = onChange.mock.calls as FilterChange[][];
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

// The key picker of the chip whose key segment reads this label.
function chipKeyPicker(label: string) {
  return pickerOf(screen.getByText(label));
}

function valuePickers() {
  return screen.queryAllByTestId("value-picker");
}

function marksInBar() {
  return [...document.querySelectorAll(".decoration-wavy")].map(
    (mark) => mark.textContent,
  );
}

async function pickValue() {
  await click(screen.getAllByTestId("pick-value").at(-1)!);
}

// The list of a closed picker is not drawn, so its control is pressed first.
async function pickFromKeyList(
  picker: ReturnType<typeof pickerOf>,
  testId: string,
) {
  await click(picker.getByTestId("open-keys"));
  await click(picker.getByTestId(testId));
}

async function addGroup(picker = wholeFilterPicker()) {
  await pickFromKeyList(picker, "add-group");
}

async function addCondition(
  picker = wholeFilterPicker(),
  keyName = "mapping_type",
) {
  await pickFromKeyList(picker, `pick-key-${keyName}`);
  await pickValue();
}

describe("FilterBar", () => {
  beforeEach(() => {
    keysServed();
    mockUseFilterKeysQuery.mockClear();
    mockToastNegative.mockClear();
  });

  describe("what it draws", () => {
    it("draws a skeleton until it has a value", async () => {
      await renderBar(null);

      expect(screen.queryByTestId("filter-bar")).toBeNull();
      expect(screen.getAllByTestId("skeleton")).toHaveLength(3);
    });

    it("draws a skeleton while the keys load", async () => {
      await renderBar({}, { keys: null });

      expect(screen.queryByTestId("filter-bar")).toBeNull();
      expect(screen.getAllByTestId("skeleton")).toHaveLength(3);
    });

    it("draws the integration wizard on its own for a team with no apps", async () => {
      await renderBar(null, {
        status: { kind: "onboarding", reason: "no-apps" },
      });

      expect(screen.getByTestId("onboarding")).toHaveAttribute(
        "data-team",
        "team-1",
      );
      expect(screen.queryByTestId("app-select")).toBeNull();
      expect(screen.queryByTestId("date-select")).toBeNull();
      expect(screen.queryByTestId("filter-bar")).toBeNull();
    });

    it("points a team with no apps at the apps page when the wizard is not offered", async () => {
      await renderBar(null, { status: { kind: "no-apps" } });

      expect(
        screen.getByRole("link", { name: "creating your first app!" }),
      ).toHaveAttribute("href", "apps");
      expect(screen.queryByTestId("onboarding")).toBeNull();
      expect(screen.queryByTestId("filter-bar")).toBeNull();
    });

    it("draws the wizard under the app selector for an app with no events", async () => {
      await renderBar(
        {},
        { status: { kind: "onboarding", reason: "not-onboarded" } },
      );

      expect(screen.getByTestId("app-select")).toHaveAttribute(
        "data-selected",
        "Checkout",
      );
      expect(screen.getByTestId("onboarding")).toBeInTheDocument();
      expect(screen.queryByTestId("date-select")).toBeNull();
      expect(screen.queryByTestId("filter-bar")).toBeNull();
    });

    it("sends the app the selector picks while the wizard is up", async () => {
      const { onChange } = await renderBar(
        {},
        { status: { kind: "onboarding", reason: "not-onboarded" } },
      );

      await click(screen.getByTestId("pick-app-app-2"));

      expect(lastChange(onChange)).toEqual({ appId: "app-2" });
    });

    it("draws the app and range it is given", async () => {
      await renderBar({
        app: apps[1],
        date: toDateSelection({
          dateRange: "Last Week",
          startDate: null,
          endDate: null,
        })!,
      });

      expect(screen.getByTestId("app-select")).toHaveAttribute(
        "data-selected",
        "Wallet",
      );
      expect(screen.getByTestId("date-select")).toHaveAttribute(
        "data-range",
        "Last Week",
      );
    });

    it("draws the app and range alone when the filter is not offered", async () => {
      await renderBar({}, { showFilterExpr: false });

      expect(screen.getByTestId("app-select")).toBeInTheDocument();
      expect(screen.getByTestId("date-select")).toBeInTheDocument();
      expect(screen.queryByTestId("filter-bar")).toBeNull();
    });

    it("draws the filter editor when nothing says otherwise", async () => {
      await renderBar();

      expect(screen.getByTestId("filter-bar")).toBeInTheDocument();
    });

    it("draws the filter as conditions", async () => {
      await renderBar({ filterExpr: "mapping_type:in:dsym" });

      expect(screen.getByTestId("operator-picker")).toBeInTheDocument();
      expect(screen.getByTestId("value-picker")).toHaveAttribute(
        "data-open",
        "false",
      );
      expect(screen.getByLabelText("Remove condition")).toBeInTheDocument();
      expect(screen.getByText("dsym")).toBeInTheDocument();
    });

    it("draws the groups the filter was written with", async () => {
      await renderBar({
        filterExpr:
          "mapping_type:in:dsym AND (version_name:in:1.0 OR version_name:in:1.1)",
      });

      const group = screen.getByRole("group", { name: "Filter group" });
      expect(within(group).getAllByLabelText("Remove condition")).toHaveLength(
        2,
      );
    });

    it("redraws when the value changes from outside", async () => {
      const { setValue } = await renderBar({
        filterExpr: "mapping_type:in:dsym",
      });

      await setValue({ app: apps[1], filterExpr: "version_name:in:1.0" });

      expect(screen.getByTestId("app-select")).toHaveAttribute(
        "data-selected",
        "Wallet",
      );
      expect(screen.getByText("App version")).toBeInTheDocument();
      expect(screen.queryByText("File type")).toBeNull();
    });

    it("stands in for the values an operator takes, one or many", async () => {
      await renderBar({ filterExpr: "mapping_type:in:dsym" });

      await pickFromKeyList(wholeFilterPicker(), "pick-key-version_name");
      expect(screen.getByText("<values>")).toBeInTheDocument();

      await click(screen.getAllByTestId("pick-op-contains")[0]);
      expect(screen.getByText("<value>")).toBeInTheDocument();
      expect(screen.queryByText("<values>")).toBeNull();
    });

    it("shows the placeholder until there is a condition", async () => {
      await renderBar({}, { placeholder: "Filter builds…" });

      expect(screen.getByTestId("filter-input")).toHaveTextContent(
        "Filter builds…",
      );

      await pickFromKeyList(wholeFilterPicker(), "pick-key-mapping_type");

      expect(screen.getByTestId("filter-input")).toHaveTextContent("");
    });

    it("draws no span selector unless asked", async () => {
      await renderBar();

      expect(screen.queryByTestId("span-select")).toBeNull();
      expect(screen.queryByTestId("skeleton")).toBeNull();
    });

    it("draws a skeleton in place of the span selector while the names load", async () => {
      await renderBar({}, { spanNames: null });

      expect(screen.getByTestId("skeleton")).toBeInTheDocument();
      expect(screen.queryByTestId("span-select")).toBeNull();
    });

    it("draws nothing for the span selector when the app has no traces", async () => {
      await renderBar({}, { spanNames: [] });

      expect(screen.queryByTestId("span-select")).toBeNull();
      expect(screen.queryByTestId("skeleton")).toBeNull();
    });

    it("draws the span selector on the value's name", async () => {
      await renderBar(
        { rootSpanName: "startup" },
        { spanNames: ["checkout", "startup"] },
      );

      expect(screen.getByTestId("span-select")).toHaveAttribute(
        "data-selected",
        "startup",
      );
    });
  });

  describe("when the keys cannot be fetched", () => {
    it("keeps the bar drawn but refuses input", async () => {
      await renderBar({}, { keysUnavailable: true });

      const bar = screen.getByTestId("filter-bar");
      expect(bar).toHaveAttribute("aria-disabled", "true");
      expect(bar.querySelectorAll("button")).toHaveLength(0);
      expect(bar).toHaveTextContent("Filter…");
      expect(screen.getByTestId("app-select")).toBeInTheDocument();
    });
  });

  describe("what it sends", () => {
    it("sends another app with the filter and span cleared, and empties the editor", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym",
      });

      await click(screen.getByLabelText("Edit as text"));
      await act(async () => {
        fireEvent.change(screen.getByTestId("filter-text"), {
          target: { value: "version_name:in:1.0" },
        });
      });
      await click(screen.getByTestId("pick-app-app-2"));

      expect(lastChange(onChange)).toEqual({
        appId: "app-2",
        filterExpr: null,
        rootSpanName: null,
      });
      expect(screen.getByTestId("filter-text")).toHaveValue("");
    });

    it("sends a relative range as its label alone", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym",
      });

      await click(screen.getByTestId("pick-range"));

      expect(lastChange(onChange)).toEqual({
        dateRange: { dateRange: "Last Week", startDate: null, endDate: null },
      });
      expect(screen.getByTestId("date-select")).toHaveAttribute(
        "data-range",
        "Last Week",
      );
      expect(screen.getByText("dsym")).toBeInTheDocument();
    });

    it("sends a custom range with its timestamps", async () => {
      const { onChange } = await renderBar();

      await click(screen.getByTestId("pick-custom-range"));

      expect(lastChange(onChange)).toEqual({
        dateRange: {
          dateRange: "Custom Range",
          startDate: "2026-02-01T00:00:00.000Z",
          endDate: "2026-02-08T00:00:00.000Z",
        },
      });
    });

    it("sends a span name only when it differs from the value's", async () => {
      const { onChange } = await renderBar(
        { rootSpanName: "checkout" },
        { spanNames: ["checkout", "startup"] },
      );

      await click(screen.getByTestId("pick-span-checkout"));
      expect(onChange).not.toHaveBeenCalled();

      await click(screen.getByTestId("pick-span-startup"));
      expect(lastChange(onChange)).toEqual({ rootSpanName: "startup" });
    });

    it("sends the filter without a removed condition, and null for the last", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym AND version_name:in:1.0",
      });

      await click(screen.getAllByLabelText("Remove condition")[1]);
      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:in:dsym",
      });

      await click(screen.getByLabelText("Remove condition"));
      expect(lastChange(onChange)).toEqual({ filterExpr: null });
    });

    it("switches the whole filter between and and or", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym AND version_name:in:1.0",
      });

      await click(screen.getByTestId("filter-logical-operator"));

      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:in:dsym OR version_name:in:1.0",
      });
    });

    it("keeps the values when the operator wants the same kind", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym",
      });

      await click(screen.getByTestId("pick-op-not_in"));

      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:not_in:dsym",
      });
      expect(valuePickers()[0]).toHaveAttribute("data-open", "false");
    });

    it("applies a key whose operator takes no value at once", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym",
      });

      await pickFromKeyList(
        chipKeyPicker("File type"),
        "pick-key-patch_id-in-row",
      );

      expect(lastChange(onChange)).toEqual({ filterExpr: "patch_id:is_set" });
      expect(valuePickers()).toHaveLength(0);
    });

    it("clears every condition at once", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym AND version_name:in:1.0",
      });

      await click(screen.getByTestId("filter-clear"));

      expect(lastChange(onChange)).toEqual({ filterExpr: null });
      expect(screen.queryByTestId("filter-clear")).toBeNull();
      expect(screen.queryByLabelText("Remove condition")).toBeNull();
    });

    it("applies every toggle of a many-valued condition at once", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym",
      });

      await click(screen.getByTestId("pick-another-value"));

      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:in:[dsym,proguard]",
      });
    });

    it("draws what it sent before the value follows", async () => {
      const { onChange, holdChanges, land } = await renderBar({
        filterExpr: "mapping_type:in:dsym AND version_name:in:1.0",
      });

      holdChanges();
      await click(screen.getAllByLabelText("Remove condition")[1]);

      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:in:dsym",
      });
      expect(screen.getAllByLabelText("Remove condition")).toHaveLength(1);
      expect(screen.queryByText("App version")).toBeNull();

      await land();

      expect(screen.getAllByLabelText("Remove condition")).toHaveLength(1);
      expect(screen.queryByText("App version")).toBeNull();
    });

    it("draws the value instead once it moves elsewhere before what it sent lands", async () => {
      const { holdChanges, setValue } = await renderBar({
        filterExpr: "mapping_type:in:dsym AND version_name:in:1.0",
      });

      holdChanges();
      await click(screen.getAllByLabelText("Remove condition")[1]);
      await setValue({ filterExpr: "patch_id:is_set" });

      expect(screen.getAllByLabelText("Remove condition")).toHaveLength(1);
      expect(screen.getByText("Patch")).toBeInTheDocument();
      expect(screen.queryByText("File type")).toBeNull();
    });

    it("builds a second quick edit on the first while it is on its way", async () => {
      const { onChange, holdChanges } = await renderBar({
        filterExpr: "mapping_type:in:dsym AND version_name:in:1.0",
      });

      holdChanges();
      await click(screen.getAllByLabelText("Remove condition")[1]);
      await click(screen.getByTestId("pick-op-not_in"));

      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:not_in:dsym",
      });
    });
  });

  describe("a condition being built", () => {
    it("starts with its key picked and its value picker open, sending nothing", async () => {
      const { onChange } = await renderBar();

      await pickFromKeyList(wholeFilterPicker(), "pick-key-mapping_type");

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByText("<values>")).toBeInTheDocument();
      expect(screen.getByTestId("value-picker")).toHaveAttribute(
        "data-open",
        "true",
      );
      expect(screen.getByLabelText("Remove condition")).toBeInTheDocument();
    });

    it("is sent once it has a value, and keeps its picker open for more", async () => {
      const { onChange } = await renderBar();

      await addCondition();

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:in:dsym",
      });
      expect(screen.getByText("dsym")).toBeInTheDocument();
      expect(screen.getByTestId("value-picker")).toHaveAttribute(
        "data-open",
        "true",
      );

      await click(screen.getByTestId("pick-another-value"));

      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:in:[dsym,proguard]",
      });
    });

    it("keeps its picker open while the value it sent is on its way", async () => {
      const { onChange, holdChanges, land } = await renderBar();

      holdChanges();
      await addCondition();

      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:in:dsym",
      });
      expect(screen.getByText("dsym")).toBeInTheDocument();
      expect(screen.getByTestId("value-picker")).toHaveAttribute(
        "data-open",
        "true",
      );

      await land();

      expect(screen.getByTestId("value-picker")).toHaveAttribute(
        "data-open",
        "true",
      );

      await click(screen.getByTestId("pick-another-value"));
      await land();

      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:in:[dsym,proguard]",
      });
      expect(screen.getByTestId("value-picker")).toHaveAttribute(
        "data-open",
        "true",
      );
    });

    it("closes its picker after a value that ends the selection", async () => {
      const { onChange } = await renderBar();

      await pickFromKeyList(wholeFilterPicker(), "pick-key-mapping_type");
      await click(screen.getByTestId("pick-one-value"));

      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:in:dsym",
      });
      expect(screen.getByTestId("value-picker")).toHaveAttribute(
        "data-open",
        "false",
      );
    });

    it("is dropped, picker and all, when the value moves elsewhere while what it sent is on its way", async () => {
      const { holdChanges, setValue } = await renderBar();

      holdChanges();
      await addCondition();
      await setValue({ filterExpr: "version_name:in:1.0" });

      expect(screen.getAllByLabelText("Remove condition")).toHaveLength(1);
      expect(screen.getByText("App version")).toBeInTheDocument();
      expect(screen.getByTestId("value-picker")).toHaveAttribute(
        "data-open",
        "false",
      );
    });

    it("leaves the picker of a condition drawn in its place closed once the value moves on", async () => {
      const { setValue } = await renderBar({
        filterExpr: "mapping_type:in:dsym",
      });

      await pickFromKeyList(wholeFilterPicker(), "pick-key-version_name");
      expect(valuePickers()[1]).toHaveAttribute("data-open", "true");

      await setValue({
        filterExpr: "mapping_type:in:dsym AND version_name:in:1.0",
      });

      expect(valuePickers()).toHaveLength(2);
      expect(valuePickers()[1]).toHaveAttribute("data-open", "false");
    });

    it("goes at the end of the filter it was added to", async () => {
      const { onChange } = await renderBar({
        filterExpr: "version_name:in:1.0",
      });

      await addCondition();

      expect(lastChange(onChange)).toEqual({
        filterExpr: "version_name:in:1.0 AND mapping_type:in:dsym",
      });
    });

    it("keeps its place when the operator picker is opened over the value picker", async () => {
      const { onChange } = await renderBar();

      await pickFromKeyList(wholeFilterPicker(), "pick-key-mapping_type");
      await click(screen.getByTestId("open-operator"));

      expect(screen.getByLabelText("Remove condition")).toBeInTheDocument();
      expect(screen.getByTestId("value-picker")).toHaveAttribute(
        "data-open",
        "false",
      );
      expect(screen.getByTestId("operator-picker")).toHaveAttribute(
        "data-open",
        "true",
      );
      expect(onChange).not.toHaveBeenCalled();
    });

    it("waits for a value again once the operator is changed, and is sent when one is picked", async () => {
      const { onChange } = await renderBar();

      await pickFromKeyList(wholeFilterPicker(), "pick-key-mapping_type");
      await click(screen.getByTestId("open-operator"));
      await click(screen.getByTestId("pick-op-not_in"));

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByTestId("operator-picker")).toHaveAttribute(
        "data-open",
        "false",
      );
      expect(screen.getByTestId("value-picker")).toHaveAttribute(
        "data-open",
        "true",
      );

      await click(screen.getByTestId("pick-value"));

      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:not_in:dsym",
      });
    });

    it("is dropped when the operator picker it was moved to closes", async () => {
      const { onChange } = await renderBar();

      await pickFromKeyList(wholeFilterPicker(), "pick-key-mapping_type");
      await click(screen.getByTestId("open-operator"));
      await click(screen.getByTestId("close-operator"));

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.queryByLabelText("Remove condition")).toBeNull();
    });

    it("keeps its place when the key picker is opened over the value picker", async () => {
      await renderBar();

      await pickFromKeyList(wholeFilterPicker(), "pick-key-mapping_type");
      await click(chipKeyPicker("File type").getByTestId("open-keys"));

      expect(screen.getByLabelText("Remove condition")).toBeInTheDocument();
      expect(
        screen.getByText("File type").closest("[data-testid='key-picker']"),
      ).toHaveAttribute("data-open", "true");
      expect(screen.getByTestId("value-picker")).toHaveAttribute(
        "data-open",
        "false",
      );
    });

    it("is put back when the value picker reached through the operator picker is dismissed", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym",
      });

      await click(screen.getByTestId("open-operator"));
      await click(screen.getByTestId("pick-op-contains"));

      expect(screen.getByText("<value>")).toBeInTheDocument();
      expect(screen.getByTestId("value-picker")).toHaveAttribute(
        "data-open",
        "true",
      );

      await click(screen.getByTestId("close-values"));

      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:in:dsym",
      });
      expect(screen.queryByText("<value>")).toBeNull();
    });

    it("is put back when the key picker opened over that value picker is dismissed", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym",
      });

      await click(screen.getByTestId("open-operator"));
      await click(screen.getByTestId("pick-op-contains"));
      await click(chipKeyPicker("File type").getByTestId("open-keys"));
      await click(chipKeyPicker("File type").getByTestId("close-keys"));

      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:in:dsym",
      });
      expect(screen.queryByText("<value>")).toBeNull();
    });

    it("is put back when the value it was given is taken off again and the picker dismissed", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym",
      });

      await pickFromKeyList(
        chipKeyPicker("File type"),
        "pick-key-version_name-in-row",
      );
      await click(screen.getByTestId("pick-value"));
      await click(screen.getByTestId("unpick-value"));
      await click(screen.getByTestId("close-values"));

      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:in:dsym",
      });
      expect(screen.getByText("dsym")).toBeInTheDocument();
    });

    it("is dropped when its value picker closes without a value", async () => {
      const { onChange } = await renderBar();

      await pickFromKeyList(wholeFilterPicker(), "pick-key-mapping_type");
      await click(screen.getByTestId("close-values"));

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.queryByLabelText("Remove condition")).toBeNull();
      expect(document.activeElement).toBe(screen.getByTestId("filter-input"));
    });

    it("is dropped when the filter changes from outside", async () => {
      const { onChange, setValue } = await renderBar();

      await pickFromKeyList(wholeFilterPicker(), "pick-key-mapping_type");
      await setValue({ filterExpr: "version_name:in:1.0" });

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getAllByLabelText("Remove condition")).toHaveLength(1);
      expect(screen.getByText("App version")).toBeInTheDocument();
      expect(screen.queryByText("<values>")).toBeNull();
    });

    it("is dropped when the range changes from outside", async () => {
      const { onChange, setValue } = await renderBar();

      await pickFromKeyList(wholeFilterPicker(), "pick-key-mapping_type");
      await setValue({
        date: toDateSelection({
          dateRange: "Last Week",
          startDate: null,
          endDate: null,
        })!,
      });

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.queryByLabelText("Remove condition")).toBeNull();
      expect(valuePickers()).toHaveLength(0);
    });

    it("is dropped when the span changes from outside", async () => {
      const { onChange, setValue } = await renderBar(
        { rootSpanName: "span.first" },
        { spanNames: ["span.first", "span.second"] },
      );

      await pickFromKeyList(wholeFilterPicker(), "pick-key-mapping_type");
      await setValue({ rootSpanName: "span.second" });

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.queryByLabelText("Remove condition")).toBeNull();
      expect(valuePickers()).toHaveLength(0);
    });

    it("is dropped by an edit elsewhere in the filter", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym AND version_name:in:1.0",
      });

      await pickFromKeyList(wholeFilterPicker(), "pick-key-mapping_type");
      await click(screen.getAllByTestId("filter-logical-operator")[0]);

      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:in:dsym OR version_name:in:1.0",
      });
      expect(screen.getAllByLabelText("Remove condition")).toHaveLength(2);
      expect(screen.queryByText("<values>")).toBeNull();
    });

    it("is dropped when another app is picked", async () => {
      const { onChange } = await renderBar();

      await pickFromKeyList(wholeFilterPicker(), "pick-key-mapping_type");
      await click(screen.getByTestId("pick-app-app-2"));

      expect(lastChange(onChange)).toEqual({
        appId: "app-2",
        filterExpr: null,
        rootSpanName: null,
      });
      expect(screen.queryByLabelText("Remove condition")).toBeNull();
    });

    it("is dropped when another condition is removed", async () => {
      const { onChange } = await renderBar({
        filterExpr: "version_name:in:1.0",
      });

      await pickFromKeyList(wholeFilterPicker(), "pick-key-mapping_type");
      await click(screen.getAllByLabelText("Remove condition")[0]);

      expect(lastChange(onChange)).toEqual({ filterExpr: null });
      expect(screen.queryByLabelText("Remove condition")).toBeNull();
    });

    it("is replaced by the next one started", async () => {
      const { onChange } = await renderBar();

      await pickFromKeyList(wholeFilterPicker(), "pick-key-mapping_type");
      await pickFromKeyList(wholeFilterPicker(), "pick-key-version_name");

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getAllByLabelText("Remove condition")).toHaveLength(1);
      expect(screen.getByText("App version")).toBeInTheDocument();
      expect(screen.queryByText("File type")).toBeNull();
    });

    it("starts again in its place when its key is changed", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym AND version_name:in:1.0",
      });

      await pickFromKeyList(
        chipKeyPicker("File type"),
        "pick-key-version_name-in-row",
      );

      expect(lastChange(onChange)).toEqual({
        filterExpr: "version_name:in:1.0",
      });
      const rows = screen.getAllByLabelText("Remove condition");
      expect(rows).toHaveLength(2);
      expect(screen.getByText("<values>")).toBeInTheDocument();
      expect(valuePickers()[0]).toHaveAttribute("data-open", "true");
      expect(valuePickers()[1]).toHaveAttribute("data-open", "false");

      await pickValue();
    });

    it("keeps its place once the changed key has a value", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym AND version_name:in:1.0",
      });

      await pickFromKeyList(
        chipKeyPicker("File type"),
        "pick-key-version_name-in-row",
      );
      await click(screen.getAllByTestId("pick-value")[0]);

      expect(lastChange(onChange)).toEqual({
        filterExpr: "version_name:in:dsym AND version_name:in:1.0",
      });
    });

    it("starts again when the operator cannot keep the values", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym",
      });

      await click(screen.getByTestId("pick-op-contains"));

      expect(lastChange(onChange)).toEqual({ filterExpr: null });
      expect(screen.getByText("<value>")).toBeInTheDocument();
      expect(screen.getByTestId("value-picker")).toHaveAttribute(
        "data-open",
        "true",
      );

      await pickValue();

      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:contains:dsym",
      });
    });

    it("puts the condition back when the restarted picker is dismissed", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym AND version_name:in:1.0",
      });

      await click(screen.getByTestId("pick-op-contains"));
      expect(lastChange(onChange)).toEqual({
        filterExpr: "version_name:in:1.0",
      });

      await click(screen.getAllByTestId("close-values")[0]);

      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:in:dsym AND version_name:in:1.0",
      });
      expect(screen.queryByText("<value>")).toBeNull();
    });

    it("drops the edit when the filter it sent was discarded", async () => {
      const { setValue } = await renderBar();

      await pickFromKeyList(wholeFilterPicker(), "pick-key-mapping_type");
      await setValue({ discarded: true });

      expect(screen.queryByText("<values>")).toBeNull();
      expect(screen.queryByLabelText("Remove condition")).toBeNull();
    });

    it("keeps a pending row while the span names arrive", async () => {
      const { setValue } = await renderBar(
        { rootSpanName: null },
        { spanNames: null },
      );

      await pickFromKeyList(wholeFilterPicker(), "pick-key-mapping_type");
      await setValue({ rootSpanName: "span.first" });

      expect(screen.getByText("<values>")).toBeInTheDocument();
    });

    it("keeps the group it is the only condition of", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym AND (version_name:in:1.0)",
      });

      const group = () => screen.getByRole("group", { name: "Filter group" });
      await pickFromKeyList(
        chipKeyPicker("App version"),
        "pick-key-mapping_type-in-row",
      );

      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:in:dsym",
      });
      expect(within(group()).getByText("<values>")).toBeInTheDocument();

      await pickValue();

      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:in:dsym AND (mapping_type:in:dsym)",
      });
    });

    it("keeps the groups around it, however deep", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym AND ((version_name:in:1.0))",
      });

      const innermost = () => screen.getAllByRole("group").at(-1)!;
      await pickFromKeyList(
        chipKeyPicker("App version"),
        "pick-key-mapping_type-in-row",
      );

      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:in:dsym",
      });
      expect(screen.getAllByRole("group")).toHaveLength(2);
      expect(within(innermost()).getByText("<values>")).toBeInTheDocument();

      await pickValue();

      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:in:dsym AND ((mapping_type:in:dsym))",
      });
      expect(screen.getAllByRole("group")).toHaveLength(2);
    });

    it("is dropped from the group it started in when the value picker closes", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym AND (version_name:in:1.0)",
      });

      const group = () => screen.getByRole("group", { name: "Filter group" });
      await pickFromKeyList(groupPicker(group()), "pick-key-mapping_type");
      expect(
        within(group()).getAllByLabelText("Remove condition"),
      ).toHaveLength(2);

      await click(screen.getAllByTestId("close-values").at(-1)!);

      expect(onChange).not.toHaveBeenCalled();
      expect(
        within(group()).getAllByLabelText("Remove condition"),
      ).toHaveLength(1);
    });
  });

  describe("grouping", () => {
    const onlyGroup = () => screen.getByRole("group", { name: "Filter group" });

    it("opens the key list for the first condition of a group, sending nothing", async () => {
      const { onChange } = await renderBar();

      await addGroup();

      expect(onChange).not.toHaveBeenCalled();
      expect(
        within(onlyGroup())
          .getByLabelText("Add a filter to this group")
          .closest("[data-testid='key-picker']"),
      ).toHaveAttribute("data-open", "true");
      expect(groupPicker(onlyGroup()).queryByTestId("add-group")).toBeNull();
    });

    it("drops the group when its key list closes without a pick", async () => {
      await renderBar();

      await addGroup();
      await click(groupPicker(onlyGroup()).getByTestId("close-keys"));

      expect(screen.queryByRole("group")).toBeNull();
    });

    it("offers a nested group from the list of a group that holds a condition", async () => {
      await renderBar({
        filterExpr: "mapping_type:in:dsym AND (version_name:in:1.0)",
      });

      await addGroup(groupPicker(onlyGroup()));

      expect(screen.getAllByRole("group")).toHaveLength(2);
    });

    it("keeps a group that already holds a condition when its key list is dismissed", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym AND (version_name:in:1.0)",
      });

      await click(groupPicker(onlyGroup()).getByTestId("open-keys"));
      await click(groupPicker(onlyGroup()).getByTestId("close-keys"));

      expect(onChange).not.toHaveBeenCalled();
      expect(
        within(onlyGroup()).getAllByLabelText("Remove condition"),
      ).toHaveLength(1);
    });

    it("sends the group once its first condition has a value", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym",
      });

      await addGroup();
      await click(
        groupPicker(onlyGroup()).getByTestId("pick-key-version_name"),
      );

      expect(onChange).not.toHaveBeenCalled();
      expect(within(onlyGroup()).getByText("<values>")).toBeInTheDocument();

      await pickValue();

      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:in:dsym AND (version_name:in:dsym)",
      });
    });

    it("switches a group between and and or without touching the filter", async () => {
      const { onChange } = await renderBar({
        filterExpr:
          "mapping_type:in:dsym AND (mapping_type:in:dsym AND version_name:in:1.0)",
      });

      await click(within(onlyGroup()).getByTestId("filter-logical-operator"));

      expect(lastChange(onChange)).toEqual({
        filterExpr:
          "mapping_type:in:dsym AND (mapping_type:in:dsym OR version_name:in:1.0)",
      });
    });

    it("drops a group and everything in it", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym AND (version_name:in:1.0)",
      });

      await click(screen.getByLabelText("Remove group"));

      expect(screen.queryByRole("group")).toBeNull();
      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:in:dsym",
      });
    });

    it("drops a group along with the last condition in it", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym AND (version_name:in:1.0)",
      });

      await click(within(onlyGroup()).getByLabelText("Remove condition"));

      expect(screen.queryByRole("group")).toBeNull();
      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:in:dsym",
      });
    });

    it("declines a group nested deeper than the server allows", async () => {
      await renderBar({ filterExpr: "((mapping_type:in:dsym))" });

      const innermost = () => screen.getAllByRole("group").at(-1)!;
      await addGroup(groupPicker(innermost()));

      expect(mockToastNegative).toHaveBeenCalledWith(
        "Filter groups cannot be nested deeper",
      );
      expect(screen.getAllByRole("group")).toHaveLength(2);
    });
  });

  describe("where focus goes", () => {
    it("moves to the condition before the one removed", async () => {
      await renderBar({
        filterExpr: "mapping_type:in:dsym AND version_name:in:1.0",
      });

      await click(screen.getAllByLabelText("Remove condition").at(-1)!);

      expect(document.activeElement).toHaveTextContent("File type");
    });

    it("moves to the condition before the one removed inside a group", async () => {
      await renderBar({
        filterExpr:
          "version_name:in:1.0 AND (mapping_type:in:dsym AND mapping_type:in:dsym)",
      });
      const group = screen.getByRole("group", { name: "Filter group" });

      await click(within(group).getAllByLabelText("Remove condition").at(-1)!);

      expect(document.activeElement).toHaveTextContent("File type");
    });

    it("leaves a group for the condition before it", async () => {
      await renderBar({
        filterExpr: "version_name:in:1.0 AND (mapping_type:in:dsym)",
      });
      const group = screen.getByRole("group", { name: "Filter group" });

      await click(within(group).getByLabelText("Remove condition"));

      expect(document.activeElement).toHaveTextContent("App version");
    });

    it("goes to the add control when nothing is drawn before", async () => {
      await renderBar({ filterExpr: "mapping_type:in:dsym" });

      await click(screen.getByLabelText("Remove condition"));

      expect(document.activeElement).toBe(screen.getByTestId("filter-input"));
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

    it("leaves a click on a control to that control", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym",
      });

      await click(screen.getByLabelText("Remove condition"));

      expect(wholePicker()).toHaveAttribute("data-open", "false");
      expect(lastChange(onChange)).toEqual({ filterExpr: null });
    });

    it("closes once a key is picked from it", async () => {
      await renderBar();

      await pickFromKeyList(wholeFilterPicker(), "pick-key-mapping_type");

      expect(wholePicker()).toHaveAttribute("data-open", "false");
    });

    it("closes once a group is added from it", async () => {
      await renderBar();

      await addGroup();

      expect(wholePicker()).toHaveAttribute("data-open", "false");
    });

    it("stays shut while a condition has a picker of its own open", async () => {
      await renderBar();

      await pickFromKeyList(wholeFilterPicker(), "pick-key-mapping_type");
      await click(screen.getByTestId("filter-bar"));

      expect(wholePicker()).toHaveAttribute("data-open", "false");
    });

    it("leaves the bar alone while the filter is edited as text", async () => {
      await renderBar();

      await click(screen.getByLabelText("Edit as text"));
      await click(screen.getByTestId("filter-bar"));

      expect(screen.getByTestId("filter-text")).toBeInTheDocument();
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

    it("opens on the filter the value holds", async () => {
      await renderBar({ filterExpr: "mapping_type:in:dsym" });

      await startTyping();

      expect(textBox()).toHaveValue("mapping_type:in:dsym");
    });

    it("sends what was typed, in canonical form, once it is applied", async () => {
      const { onChange } = await renderBar();

      await startTyping();
      await type("version_name:in:[1.0]");
      expect(onChange).not.toHaveBeenCalled();

      await pressEnter();

      expect(lastChange(onChange)).toEqual({
        filterExpr: "version_name:in:1.0",
      });
      expect(textBox()).toHaveValue("version_name:in:1.0");
    });

    it("keeps showing what it applied while the value follows", async () => {
      const { onChange, holdChanges, land } = await renderBar();

      holdChanges();
      await startTyping();
      await type("version_name:in:[1.0]");
      await pressEnter();

      expect(lastChange(onChange)).toEqual({
        filterExpr: "version_name:in:1.0",
      });
      expect(textBox()).toHaveValue("version_name:in:1.0");

      await click(screen.getByLabelText("Edit as conditions"));

      expect(screen.getByText("App version")).toBeInTheDocument();

      await land();

      expect(screen.getByText("App version")).toBeInTheDocument();
    });

    it("applies on blur too", async () => {
      const { onChange } = await renderBar();

      await startTyping();
      await type("version_name:in:1.0");
      await act(async () => {
        fireEvent.blur(textBox());
      });

      expect(lastChange(onChange)).toEqual({
        filterExpr: "version_name:in:1.0",
      });
    });

    it("sends nothing for text that only differs in form", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym",
      });

      await startTyping();
      await type("mapping_type:in:[dsym]");
      await pressEnter();

      expect(onChange).not.toHaveBeenCalled();
      expect(textBox()).toHaveValue("mapping_type:in:dsym");
    });

    it("says what is wrong and keeps the text instead of applying it", async () => {
      const { onChange } = await renderBar();

      await startTyping();
      await type("version_name:in:1.0 AND");
      await pressEnter();

      expect(screen.getByTestId("filter-issue")).toHaveTextContent(
        "Filter ends where a condition was expected",
      );
      expect(onChange).not.toHaveBeenCalled();
      expect(textBox()).toHaveValue("version_name:in:1.0 AND");
    });

    it("refuses a condition still waiting for its value", async () => {
      const { onChange } = await renderBar();

      await startTyping();
      await type("version_name:in:");
      await pressEnter();

      expect(screen.getByTestId("filter-issue")).toHaveTextContent(
        "App version needs a value",
      );
      expect(marksInBar()).toEqual(["version_name", ":", "in"]);
      expect(onChange).not.toHaveBeenCalled();
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
      await type("device_cohort:in:new AND another_missing:in:x)");

      expect(screen.getByTestId("filter-issue")).toHaveTextContent(
        "There is no filter named device_cohort (+2 more)",
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

    it("draws what was typed as conditions on the way back", async () => {
      const { onChange } = await renderBar();

      await startTyping();
      await type("version_name:in:1.0 AND (mapping_type:in:dsym)");
      await click(screen.getByLabelText("Edit as conditions"));

      expect(lastChange(onChange)).toEqual({
        filterExpr: "version_name:in:1.0 AND (mapping_type:in:dsym)",
      });
      expect(screen.queryByTestId("filter-text")).toBeNull();
      expect(screen.getAllByLabelText("Remove condition")).toHaveLength(2);
      expect(
        screen.getByRole("group", { name: "Filter group" }),
      ).toBeInTheDocument();
    });

    it("empties the editor when the filter is cleared", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym",
      });

      await startTyping();
      await type("version_name:in:1.0");
      await click(screen.getByTestId("filter-clear"));

      expect(textBox()).toHaveValue("");
      expect(lastChange(onChange)).toEqual({ filterExpr: null });
    });

    it("drops the text and closes on Escape", async () => {
      const { onChange } = await renderBar({
        filterExpr: "mapping_type:in:dsym",
      });

      await startTyping();
      await type("version_name:in:1.0");
      await act(async () => {
        fireEvent.keyDown(textBox(), { key: "Escape" });
      });

      expect(screen.queryByTestId("filter-text")).toBeNull();
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByText("dsym")).toBeInTheDocument();
    });
  });

  describe("issues the server sent back", () => {
    const refused = [
      {
        message: 'Key "mapping_type" has no value "dsym"',
        span: { start: 0, end: 20 },
      },
    ];

    it("marks the span the server refused", async () => {
      await renderBar(
        { filterExpr: "mapping_type:in:dsym" },
        { filterExprIssues: refused },
      );

      expect(screen.getByTestId("filter-issue")).toHaveTextContent(
        'Key "mapping_type" has no value "dsym"',
      );

      await click(screen.getByTestId("filter-toggle-text"));

      expect(marksInBar()).toEqual(["mapping_type", ":", "in", ":", "dsym"]);
    });

    it("keeps the message but drops the marks when only the spacing changed", async () => {
      await renderBar(
        { filterExpr: "mapping_type:in:dsym" },
        { filterExprIssues: refused },
      );

      await click(screen.getByTestId("filter-toggle-text"));
      await act(async () => {
        fireEvent.change(screen.getByTestId("filter-text"), {
          target: { value: "  mapping_type:in:[dsym]" },
        });
      });

      expect(screen.getByTestId("filter-issue")).toHaveTextContent(
        'Key "mapping_type" has no value "dsym"',
      );
      expect(marksInBar()).toEqual([]);
    });

    it("drops the message once the text would filter by something else", async () => {
      const { onChange } = await renderBar(
        { filterExpr: "mapping_type:in:dsym" },
        { filterExprIssues: refused },
      );

      await click(screen.getByTestId("filter-toggle-text"));
      await act(async () => {
        fireEvent.change(screen.getByTestId("filter-text"), {
          target: { value: "mapping_type:in:proguard" },
        });
      });

      expect(screen.queryByTestId("filter-issue")).toBeNull();

      await act(async () => {
        fireEvent.keyDown(screen.getByTestId("filter-text"), { key: "Enter" });
      });

      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:in:proguard",
      });
    });

    it("still applies a condition changed while the server is refusing one", async () => {
      const { onChange } = await renderBar(
        { filterExpr: "mapping_type:in:dsym" },
        { filterExprIssues: refused },
      );

      await click(screen.getByLabelText("Edit as text"));
      await click(screen.getByLabelText("Edit as conditions"));

      expect(screen.queryByTestId("filter-text")).toBeNull();
      expect(mockToastNegative).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();

      await click(screen.getByTestId("pick-op-not_in"));

      expect(lastChange(onChange)).toEqual({
        filterExpr: "mapping_type:not_in:dsym",
      });
    });
  });

  describe("a user-defined key", () => {
    beforeEach(() => {
      keysServed([...keys, customPremiumKey, customPlanKey]);
    });

    const allKeys = { keys: [...keys, customPremiumKey, customPlanKey] };

    it("draws a custom condition by the raw attribute name", async () => {
      await renderBar({ filterExpr: "custom.is_premium:eq:true" }, allKeys);

      expect(screen.getByText("is_premium")).toBeInTheDocument();
    });

    it("sends a picked custom key under its full dotted name", async () => {
      const { onChange } = await renderBar({}, allKeys);

      await addCondition(wholeFilterPicker(), "custom.plan");

      expect(lastChange(onChange)).toEqual({
        filterExpr: "custom.plan:in:dsym",
      });
    });

    it("asks the keys query for the custom keys in the filter and the ones typed", async () => {
      mockUseFilterKeysQuery.mockImplementation(
        (_appId: string | undefined, _entity: string, keyNames: string[]) => ({
          data: {
            keys: keyNames.includes("custom.plan")
              ? [...keys, customPlanKey]
              : keys,
            key_groups: keyGroups,
          },
          isPending: false,
          isError: false,
        }),
      );
      const { onChange } = await renderBar({
        filterExpr: "custom.is_premium:eq:true",
      });

      expect(mockUseFilterKeysQuery).toHaveBeenLastCalledWith(
        "app-1",
        "builds",
        ["custom.is_premium"],
      );

      await click(screen.getByLabelText("Edit as text"));
      await act(async () => {
        fireEvent.change(screen.getByTestId("filter-text"), {
          target: { value: "custom.plan:in:pro" },
        });
      });

      expect(mockUseFilterKeysQuery).toHaveBeenLastCalledWith(
        "app-1",
        "builds",
        ["custom.is_premium", "custom.plan"],
      );
      expect(screen.queryByTestId("filter-issue")).toBeNull();

      await act(async () => {
        fireEvent.keyDown(screen.getByTestId("filter-text"), { key: "Enter" });
      });

      expect(lastChange(onChange)).toEqual({
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
        undefined,
        "builds",
        [],
      );
    });
  });

  describe("when an edit would cross a limit", () => {
    const full = Array.from(
      { length: MAX_CONDITIONS },
      () => "mapping_type:in:dsym",
    ).join(" AND ");

    it("declines the edit and names the limit that stopped it", async () => {
      const { onChange } = await renderBar({ filterExpr: full });

      await pickFromKeyList(wholeFilterPicker(), "pick-key-mapping_type");

      expect(mockToastNegative).toHaveBeenCalledWith(
        `A filter can hold at most ${MAX_CONDITIONS} conditions`,
      );
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.queryByText("<values>")).toBeNull();
    });

    it("keeps the group and its open list when its first condition is declined", async () => {
      const { onChange } = await renderBar({ filterExpr: full });

      await addGroup();
      const group = screen.getByRole("group", { name: "Filter group" });
      await click(groupPicker(group).getByTestId("pick-key-version_name"));

      expect(mockToastNegative).toHaveBeenCalledWith(
        `A filter can hold at most ${MAX_CONDITIONS} conditions`,
      );
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByRole("group")).toBeInTheDocument();
      expect(groupPicker(group).getByTestId("close-keys")).toBeInTheDocument();
    });

    it("says nothing while the filter is still inside every limit", async () => {
      const { onChange } = await renderBar();

      for (let i = 0; i < MAX_CONDITIONS; i++) {
        await addCondition();
      }

      expect(mockToastNegative).not.toHaveBeenCalled();
      expect(lastChange(onChange)).toEqual({ filterExpr: full });
    });
  });
});
