import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

// The real popover renders its content only while open, so this stub does the
// same.
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
    PopoverContent: ({ children, onCloseAutoFocus }: any) =>
      PopoverOpen.current ? (
        <div data-testid="popover-content">
          {children}
          {/* Stands in for Radix calling onCloseAutoFocus as the popover closes. */}
          <button
            data-testid="close-popover"
            onClick={() =>
              onCloseAutoFocus?.({ preventDefault: () => {} } as any)
            }
          >
            close
          </button>
        </div>
      ) : null,
  };
});

jest.mock("@/app/components/input", () => ({
  __esModule: true,
  Input: (props: any) => <input {...props} />,
}));

jest.mock("@/app/components/tab_select", () => ({
  __esModule: true,
  default: ({ items, selected, onChangeSelected }: any) => (
    <div data-testid="tabs" data-selected={selected}>
      {items.map((item: string) => (
        <button
          key={item}
          data-testid={`tab-${item}`}
          onClick={() => onChangeSelected(item)}
        >
          {item}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("@/app/components/button", () => ({
  __esModule: true,
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

import type { FilterKey } from "@/app/api/filter_types";
import KeyPicker, {
  OperatorPicker,
} from "@/app/components/filter_bar/key_picker";
import { operatorLabels as filterBarOperatorLabels } from "@/app/components/filter_bar/operators";

const key = (
  name: string,
  label: string,
  keyGroup: string,
  description: string,
) =>
  ({
    name,
    label,
    key_group: keyGroup,
    description,
    value_type: "string",
    value_suggestion_mode: "full_list",
    operators: ["in", "not_in"],
  }) as unknown as FilterKey;

const keys = [
  key("version", "App version", "Version", "The version the build reports"),
  key("patch_id", "Patch id", "Build", "The id of an Over-The-Air patch"),
  key("mapping_type", "File type", "Build", "The kind of mapping file"),
];

const keyGroups = ["Version", "Build"];

function openPicker(
  props: Partial<React.ComponentProps<typeof KeyPicker>> = {},
) {
  const onSelect = jest.fn();
  const onOpenChange = jest.fn();
  render(
    <KeyPicker
      keys={keys}
      keyGroups={keyGroups}
      selected={null}
      open
      onOpenChange={onOpenChange}
      onSelect={onSelect}
      trigger={<button>open</button>}
      {...props}
    />,
  );
  return { onSelect, onOpenChange };
}

function search(text: string) {
  fireEvent.change(screen.getByTestId("filter-key-search"), {
    target: { value: text },
  });
}

describe("KeyPicker", () => {
  it("shows nothing until it is opened", () => {
    render(
      <KeyPicker
        keys={keys}
        keyGroups={keyGroups}
        selected={null}
        onSelect={jest.fn()}
        trigger={<button>open</button>}
      />,
    );

    expect(screen.queryByTestId("popover-content")).not.toBeInTheDocument();
  });

  it("opens on the first group, with each key's description", () => {
    openPicker();

    expect(screen.getByTestId("tabs")).toHaveAttribute(
      "data-selected",
      "Version",
    );
    expect(screen.getByText("App version")).toBeInTheDocument();
    expect(
      screen.getByText("The version the build reports"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Patch id")).not.toBeInTheDocument();
  });

  it("opens on the group of the key already selected", () => {
    openPicker({ selected: keys[1] });

    expect(screen.getByTestId("tabs")).toHaveAttribute(
      "data-selected",
      "Build",
    );
    expect(screen.getByText("Patch id")).toBeInTheDocument();
    expect(screen.queryByText("App version")).not.toBeInTheDocument();
  });

  it("shows the keys of the group that is picked", () => {
    openPicker();

    fireEvent.click(screen.getByTestId("tab-Build"));

    expect(screen.getByText("Patch id")).toBeInTheDocument();
    expect(screen.getByText("File type")).toBeInTheDocument();
    expect(screen.queryByText("App version")).not.toBeInTheDocument();
  });

  it("falls back to the first group when the one picked is gone", () => {
    const { rerender } = render(
      <KeyPicker
        keys={keys}
        keyGroups={keyGroups}
        selected={null}
        open
        onSelect={jest.fn()}
        trigger={<button>open</button>}
      />,
    );
    fireEvent.click(screen.getByTestId("tab-Build"));

    rerender(
      <KeyPicker
        keys={keys.filter((k) => k.key_group === "Version")}
        keyGroups={["Version"]}
        selected={null}
        open
        onSelect={jest.fn()}
        trigger={<button>open</button>}
      />,
    );

    expect(screen.getByText("App version")).toBeInTheDocument();
  });

  it("searches every group, not the one on screen", () => {
    openPicker();

    search("patch");

    expect(screen.getByText("Patch id")).toBeInTheDocument();
    expect(screen.queryByText("App version")).not.toBeInTheDocument();
  });

  it("matches a key's description as well as its label", () => {
    openPicker();

    search("Over-The-Air");

    expect(screen.getByText("Patch id")).toBeInTheDocument();
  });

  it("heads search results by group, and hides the tabs", () => {
    openPicker();

    search("i");

    expect(screen.queryByTestId("tabs")).not.toBeInTheDocument();
    expect(screen.getByText("Build", { selector: "p" })).toBeInTheDocument();
  });

  it("says so when a search matches nothing", () => {
    openPicker();

    search("nothing goes by this");

    expect(screen.getByText("No filters found")).toBeInTheDocument();
  });

  it("offers no tabs for an entity with one group", () => {
    render(
      <KeyPicker
        keys={keys.filter((k) => k.key_group === "Build")}
        keyGroups={["Build"]}
        selected={null}
        open
        onSelect={jest.fn()}
        trigger={<button>open</button>}
      />,
    );

    expect(screen.queryByTestId("tabs")).not.toBeInTheDocument();
    expect(screen.getByText("Patch id")).toBeInTheDocument();
  });

  it("reports the key that was picked and closes", () => {
    const { onSelect, onOpenChange } = openPicker();

    fireEvent.click(screen.getByTestId("filter-key-version"));

    expect(onSelect).toHaveBeenCalledWith(keys[0]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("hands focus to the control the caller named as it closes", () => {
    function Harness() {
      const ref = React.useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={ref} data-testid="lands-here">
            lands here
          </button>
          <KeyPicker
            keys={keys}
            keyGroups={keyGroups}
            selected={null}
            open
            focusOnClose={ref}
            onSelect={jest.fn()}
            trigger={<button>open</button>}
          />
        </>
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByTestId("close-popover"));

    expect(screen.getByTestId("lands-here")).toHaveFocus();
  });

  describe("a user-defined key", () => {
    const customKey = key(
      "custom.is_premium",
      "is_premium",
      "Custom",
      "A user-defined attribute",
    );
    const withCustom = {
      keys: [...keys, customKey],
      keyGroups: [...keyGroups, "Custom"],
    };

    it("shows the Custom tab, and the key by its raw name", () => {
      openPicker(withCustom);

      fireEvent.click(screen.getByTestId("tab-Custom"));

      expect(screen.getByText("is_premium")).toBeInTheDocument();
      expect(screen.queryByText("custom.is_premium")).not.toBeInTheDocument();
    });

    it("reports the key with its full dotted name when picked", () => {
      const { onSelect } = openPicker(withCustom);

      fireEvent.click(screen.getByTestId("tab-Custom"));
      fireEvent.click(screen.getByTestId("filter-key-custom.is_premium"));

      expect(onSelect).toHaveBeenCalledWith(customKey);
    });
  });
});

describe("OperatorPicker", () => {
  const operatorLabels = { in: "is", not_in: "is not" };

  it("shows every operator by the name a person reads", () => {
    render(
      <OperatorPicker
        operators={["in", "not_in"]}
        selected="in"
        operatorLabels={operatorLabels}
        onSelect={jest.fn()}
        open
        trigger={<button>open</button>}
      />,
    );

    expect(screen.getByTestId("filter-op-in")).toHaveTextContent("is");
    expect(screen.getByTestId("filter-op-not_in")).toHaveTextContent("is not");
  });

  it("falls back to the wire name for an operator with no label", () => {
    render(
      <OperatorPicker
        operators={["between"]}
        selected={null}
        operatorLabels={operatorLabels}
        onSelect={jest.fn()}
        open
        trigger={<button>open</button>}
      />,
    );

    expect(screen.getByTestId("filter-op-between")).toHaveTextContent(
      "between",
    );
  });

  it("has a label for every comparison a number key offers", () => {
    render(
      <OperatorPicker
        operators={["eq", "neq", "gt", "gte", "lt", "lte"]}
        selected={null}
        operatorLabels={filterBarOperatorLabels}
        onSelect={jest.fn()}
        open
        trigger={<button>open</button>}
      />,
    );

    expect(screen.getByTestId("filter-op-eq")).toHaveTextContent("=");
    expect(screen.getByTestId("filter-op-neq")).toHaveTextContent("≠");
    expect(screen.getByTestId("filter-op-gt")).toHaveTextContent(">");
    expect(screen.getByTestId("filter-op-gte")).toHaveTextContent("≥");
    expect(screen.getByTestId("filter-op-lt")).toHaveTextContent("<");
    expect(screen.getByTestId("filter-op-lte")).toHaveTextContent("≤");
  });

  it("has a label for every match a text key offers", () => {
    render(
      <OperatorPicker
        operators={["contains", "not_contains", "starts_with", "ends_with"]}
        selected={null}
        operatorLabels={filterBarOperatorLabels}
        onSelect={jest.fn()}
        open
        trigger={<button>open</button>}
      />,
    );

    expect(screen.getByTestId("filter-op-contains")).toHaveTextContent(
      "contains",
    );
    expect(screen.getByTestId("filter-op-not_contains")).toHaveTextContent(
      "does not contain",
    );
    expect(screen.getByTestId("filter-op-starts_with")).toHaveTextContent(
      "starts with",
    );
    expect(screen.getByTestId("filter-op-ends_with")).toHaveTextContent(
      "ends with",
    );
  });

  it("reports the operator that was picked and closes", () => {
    const onSelect = jest.fn();
    const onOpenChange = jest.fn();
    render(
      <OperatorPicker
        operators={["in", "not_in"]}
        selected="in"
        operatorLabels={operatorLabels}
        onSelect={onSelect}
        open
        onOpenChange={onOpenChange}
        trigger={<button>open</button>}
      />,
    );

    fireEvent.click(screen.getByTestId("filter-op-not_in"));

    expect(onSelect).toHaveBeenCalledWith("not_in");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
