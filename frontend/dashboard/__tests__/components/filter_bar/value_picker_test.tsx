import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("@/app/components/popover", () => {
  const PopoverOpen = { current: false };
  return {
    __esModule: true,
    Popover: ({ children, open }: any) => {
      PopoverOpen.current = open;
      return <div data-testid="popover">{children}</div>;
    },
    PopoverTrigger: ({ children }: any) => (
      <div data-testid="popover-trigger">{children}</div>
    ),
    PopoverContent: ({ children }: any) =>
      PopoverOpen.current ? (
        <div data-testid="popover-content">{children}</div>
      ) : null,
  };
});

jest.mock("@/app/components/input", () => ({
  __esModule: true,
  Input: (props: any) => <input {...props} />,
}));

// The real input waits for a pause in typing before it reports a change.
jest.mock("@/app/components/debounce_text_input", () => ({
  __esModule: true,
  default: ({ onChange, initialValue, ...props }: any) => (
    <input
      data-testid="value-search"
      defaultValue={initialValue}
      onChange={(e: any) => onChange(e.target.value)}
      {...props}
    />
  ),
}));

jest.mock("@/app/components/skeleton", () => ({
  __esModule: true,
  Skeleton: (props: any) => <div data-testid="skeleton" {...props} />,
}));

const mockUseFilterValuesQuery = jest.fn();
jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useFilterValuesQuery: (
    appId: string,
    entity: string,
    keyName: string,
    search: string,
  ) => mockUseFilterValuesQuery(appId, entity, keyName, search),
}));

import ValuePicker from "@/app/components/filter_bar/value_picker";

function valuesLoaded(
  values: { text: string; label?: string }[],
  truncated = false,
) {
  mockUseFilterValuesQuery.mockReturnValue({
    data: { values, truncated },
    isPending: false,
    isError: false,
    isSuccess: true,
  } as any);
}

function renderPicker(props: any = {}) {
  const onChange = jest.fn();
  const onOpenChange = jest.fn();
  render(
    <ValuePicker
      appId="app-1"
      entity="builds"
      keyName="version"
      valueType="string"
      valueSuggestionMode="full_list"
      takesTypedText={false}
      takesOneValue={false}
      selected={[]}
      onChange={onChange}
      onOpenChange={onOpenChange}
      open
      trigger={<button>open</button>}
      {...props}
    />,
  );
  return { onChange, onOpenChange };
}

describe("ValuePicker", () => {
  beforeEach(() => {
    valuesLoaded([{ text: "1.0.0" }, { text: "1.0.1" }]);
  });

  it("shows nothing until it is opened", () => {
    renderPicker({ open: false });

    expect(screen.queryByTestId("popover-content")).not.toBeInTheDocument();
  });

  it("lists the values the app has reported", () => {
    renderPicker();

    expect(screen.getByTestId("filter-value-1.0.0")).toBeInTheDocument();
    expect(screen.getByTestId("filter-value-1.0.1")).toBeInTheDocument();
  });

  it("shows a value's label rather than its text when it has one", () => {
    valuesLoaded([{ text: "dsym", label: "dSYM" }]);
    renderPicker();

    expect(screen.getByTestId("filter-value-dsym")).toHaveTextContent("dSYM");
  });

  it("asks the server for what is being typed", () => {
    renderPicker();

    fireEvent.change(screen.getByTestId("value-search"), {
      target: { value: "1.0.1" },
    });

    expect(mockUseFilterValuesQuery).toHaveBeenLastCalledWith(
      "app-1",
      "builds",
      "version",
      "1.0.1",
    );
  });

  it("adds a value to the ones already picked", () => {
    const { onChange } = renderPicker({ selected: [{ text: "1.0.0" }] });

    fireEvent.click(screen.getByTestId("filter-value-1.0.1"));

    expect(onChange).toHaveBeenCalledWith([
      { text: "1.0.0" },
      { text: "1.0.1" },
    ]);
  });

  it("takes a picked value back off the list", () => {
    const { onChange } = renderPicker({
      selected: [{ text: "1.0.0" }, { text: "1.0.1" }],
    });

    fireEvent.click(screen.getByTestId("filter-value-1.0.0"));

    expect(onChange).toHaveBeenCalledWith([{ text: "1.0.1" }]);
  });

  it("marks the values that are picked", () => {
    renderPicker({ selected: [{ text: "1.0.0" }] });

    expect(screen.getByTestId("filter-value-1.0.0")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByTestId("filter-value-1.0.1")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("replaces the selection and closes for a one-value operator", () => {
    const { onChange, onOpenChange } = renderPicker({
      takesOneValue: true,
      selected: [{ text: "1.0.0" }],
    });

    fireEvent.click(screen.getByTestId("filter-value-1.0.1"));

    expect(onChange).toHaveBeenCalledWith([{ text: "1.0.1" }]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("offers what was typed when the list is only a sample", () => {
    renderPicker({ valueSuggestionMode: "sample" });

    fireEvent.change(screen.getByTestId("value-search"), {
      target: { value: "9.9.9" },
    });

    expect(screen.getByTestId("filter-value-9.9.9")).toBeInTheDocument();
  });

  it("shows a chosen value the list does not hold, so it can be taken off", () => {
    const { onChange } = renderPicker({
      valueSuggestionMode: "sample",
      selected: [{ text: "1.0.0" }, { text: "9.9.9" }],
    });

    expect(screen.getByTestId("filter-value-9.9.9")).toHaveAttribute(
      "aria-checked",
      "true",
    );

    fireEvent.click(screen.getByTestId("filter-value-9.9.9"));

    expect(onChange).toHaveBeenCalledWith([{ text: "1.0.0" }]);
  });

  it("shows a chosen value the sample left out, whatever its source", () => {
    valuesLoaded([{ text: "1.0.0" }], true);
    renderPicker({
      valueSuggestionMode: "full_list",
      selected: [{ text: "left-out" }],
    });

    expect(screen.getByTestId("filter-value-left-out")).toBeInTheDocument();
  });

  it("does not show a chosen value twice when the list holds it", () => {
    renderPicker({
      valueSuggestionMode: "sample",
      selected: [{ text: "1.0.0" }],
    });

    expect(screen.getAllByTestId("filter-value-1.0.0")).toHaveLength(1);
  });

  it("leaves a chosen value out while something is being searched for", () => {
    renderPicker({
      valueSuggestionMode: "sample",
      selected: [{ text: "9.9.9" }],
    });

    fireEvent.change(screen.getByTestId("value-search"), {
      target: { value: "1.0" },
    });

    expect(screen.queryByTestId("filter-value-9.9.9")).not.toBeInTheDocument();
  });

  it("does not offer what was typed twice when the list already has it", () => {
    renderPicker({ valueSuggestionMode: "sample" });

    fireEvent.change(screen.getByTestId("value-search"), {
      target: { value: "1.0.0" },
    });

    expect(screen.getAllByTestId("filter-value-1.0.0")).toHaveLength(1);
  });

  it("offers nothing outside a list that is the whole story", () => {
    renderPicker({ valueSuggestionMode: "full_list" });

    fireEvent.change(screen.getByTestId("value-search"), {
      target: { value: "9.9.9" },
    });

    expect(screen.queryByTestId("filter-value-9.9.9")).not.toBeInTheDocument();
  });

  it("says when a search matches nothing", () => {
    valuesLoaded([]);
    renderPicker();

    expect(screen.getByText("No values match")).toBeInTheDocument();
  });

  it("shows placeholders while the values are being fetched", () => {
    mockUseFilterValuesQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      isSuccess: false,
    } as any);
    renderPicker();

    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });

  it("says so when the values could not be fetched", () => {
    mockUseFilterValuesQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      isSuccess: false,
    } as any);
    renderPicker();

    expect(screen.getByText(/Couldn't load values/)).toBeInTheDocument();
  });

  it("says when more values matched than were sent", () => {
    valuesLoaded([{ text: "1.0.0" }, { text: "1.0.1" }], true);
    renderPicker();

    expect(screen.getByText(/Showing the first 2/)).toBeInTheDocument();
  });

  describe("a value that is typed rather than picked", () => {
    it("replaces the list when the operator matches part of a value", () => {
      renderPicker({ takesTypedText: true });

      expect(screen.getByTestId("filter-value-input")).toBeInTheDocument();
      expect(screen.queryByTestId("value-search")).not.toBeInTheDocument();
    });

    it("replaces the list when the key has no values to offer", () => {
      renderPicker({ valueSuggestionMode: "none" });

      expect(screen.getByTestId("filter-value-input")).toBeInTheDocument();
    });

    it("opens on the value the condition already has", () => {
      renderPicker({ valueSuggestionMode: "none", selected: [{ text: "42" }] });

      expect(screen.getByTestId("filter-value-input")).toHaveValue("42");
    });

    it("takes digits only for a number key", () => {
      renderPicker({ valueSuggestionMode: "none", valueType: "int32" });

      expect(screen.getByTestId("filter-value-input")).toHaveAttribute(
        "type",
        "number",
      );
    });

    it("bounds an integer key to what its column holds", () => {
      renderPicker({ valueSuggestionMode: "none", valueType: "int32" });

      const input = screen.getByTestId("filter-value-input");
      expect(input).toHaveAttribute("step", "1");
      expect(input).toHaveAttribute("min", "-2147483648");
      expect(input).toHaveAttribute("max", "2147483647");
    });

    it("leaves a number key that takes fractions unbounded", () => {
      renderPicker({ valueSuggestionMode: "none", valueType: "float64" });

      const input = screen.getByTestId("filter-value-input");
      expect(input).toHaveAttribute("step", "any");
      expect(input).not.toHaveAttribute("min");
    });

    it("takes free text for a key that is not a number", () => {
      renderPicker({ valueSuggestionMode: "none", valueType: "string" });

      expect(screen.getByTestId("filter-value-input")).toHaveAttribute(
        "type",
        "text",
      );
    });

    it("applies what was typed, trimmed, and closes", () => {
      const { onChange, onOpenChange } = renderPicker({
        valueSuggestionMode: "none",
      });

      fireEvent.change(screen.getByTestId("filter-value-input"), {
        target: { value: "  1.0.2  " },
      });
      fireEvent.submit(
        screen.getByTestId("filter-value-input").closest("form")!,
      );

      expect(onChange).toHaveBeenCalledWith([{ text: "1.0.2" }]);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("applies nothing when the box is empty", () => {
      const { onChange, onOpenChange } = renderPicker({
        valueSuggestionMode: "none",
      });

      fireEvent.change(screen.getByTestId("filter-value-input"), {
        target: { value: "   " },
      });
      fireEvent.submit(
        screen.getByTestId("filter-value-input").closest("form")!,
      );

      expect(onChange).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe("a user-defined key", () => {
    it("lists the fetched values for a bool key and replaces on pick", () => {
      valuesLoaded([{ text: "true" }, { text: "false" }]);
      const { onChange, onOpenChange } = renderPicker({
        keyName: "custom.is_premium",
        valueType: "bool",
        valueSuggestionMode: "full_list",
        takesOneValue: true,
      });

      expect(mockUseFilterValuesQuery).toHaveBeenLastCalledWith(
        "app-1",
        "builds",
        "custom.is_premium",
        "",
      );
      expect(screen.getByTestId("filter-value-true")).toBeInTheDocument();
      expect(screen.getByTestId("filter-value-false")).toBeInTheDocument();

      fireEvent.click(screen.getByTestId("filter-value-true"));

      expect(onChange).toHaveBeenCalledWith([{ text: "true" }]);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("asks for a string key's suggestions under its full dotted name", () => {
      valuesLoaded([{ text: "pro" }]);
      renderPicker({
        keyName: "custom.plan",
        valueSuggestionMode: "sample",
      });

      fireEvent.change(screen.getByTestId("value-search"), {
        target: { value: "fr" },
      });

      expect(mockUseFilterValuesQuery).toHaveBeenLastCalledWith(
        "app-1",
        "builds",
        "custom.plan",
        "fr",
      );
    });

    it("takes a typed whole number, unbounded, for an int64 key", () => {
      renderPicker({
        keyName: "custom.launch_count",
        valueType: "int64",
        valueSuggestionMode: "none",
      });

      const input = screen.getByTestId("filter-value-input");
      expect(input).toHaveAttribute("type", "number");
      expect(input).toHaveAttribute("step", "1");
      expect(input).not.toHaveAttribute("min");
      expect(input).not.toHaveAttribute("max");
    });
  });
});
