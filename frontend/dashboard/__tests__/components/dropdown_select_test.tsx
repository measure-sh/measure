import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

// --- Mocks ---

jest.mock("lucide-react", () => ({
  Check: ({ className }: any) => (
    <span data-testid="check-icon" className={className} />
  ),
  ChevronsUpDown: ({ className }: any) => (
    <span data-testid="chevrons-icon" className={className} />
  ),
  Circle: ({ className }: any) => (
    <span data-testid="circle-icon" className={className} />
  ),
  CircleCheck: ({ className }: any) => (
    <span data-testid="circle-check-icon" className={className} />
  ),
}));

jest.mock("@/app/components/button", () => ({
  Button: ({ children, onClick, onKeyDown, disabled, ...props }: any) => (
    <button
      onClick={onClick}
      onKeyDown={onKeyDown}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  ),
}));

jest.mock("@/app/components/popover", () => ({
  Popover: ({ children }: any) => <div data-testid="popover">{children}</div>,
  PopoverTrigger: ({ children, disabled }: any) => (
    <div data-testid="popover-trigger" data-disabled={disabled}>
      {children}
    </div>
  ),
  PopoverContent: ({ children }: any) => (
    <div data-testid="popover-content">{children}</div>
  ),
}));

jest.mock("@/app/components/command", () => ({
  Command: ({ children }: any) => <div data-testid="command">{children}</div>,
  CommandInput: ({ placeholder, value, onValueChange, ...props }: any) => (
    <input
      data-testid="command-input"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      {...props}
    />
  ),
  CommandEmpty: ({ children }: any) => (
    <div data-testid="command-empty">{children}</div>
  ),
  CommandGroup: ({ children }: any) => (
    <div data-testid="command-group">{children}</div>
  ),
  CommandItem: ({ children, onSelect, onKeyDown, ...props }: any) => (
    <div
      data-testid="command-item"
      onClick={() => onSelect?.()}
      onKeyDown={onKeyDown}
      {...props}
    >
      {children}
    </div>
  ),
}));

// --- Import ---

import DropdownSelect, {
  DropdownSelectType,
} from "@/app/components/dropdown_select";

// --- Helpers ---

function getItems() {
  return screen.getAllByTestId("command-item");
}

function clickItem(index: number) {
  fireEvent.click(getItems()[index]);
}

function search(text: string) {
  fireEvent.change(screen.getByTestId("command-input"), {
    target: { value: text },
  });
}

// ============================================================
// Tests
// ============================================================

describe("DropdownSelect", () => {
  // --- SingleString ---

  describe("SingleString", () => {
    const items = ["Apple", "Banana", "Cherry"];

    it("renders all items", () => {
      render(
        <DropdownSelect
          type={DropdownSelectType.SingleString}
          title="Fruit"
          items={items}
          initialSelected="Apple"
        />,
      );
      const renderedItems = getItems();
      expect(renderedItems).toHaveLength(3);
      expect(renderedItems[0].textContent).toContain("Apple");
      expect(renderedItems[1].textContent).toContain("Banana");
      expect(renderedItems[2].textContent).toContain("Cherry");
    });

    it("shows selected item as display text", () => {
      render(
        <DropdownSelect
          type={DropdownSelectType.SingleString}
          title="Fruit"
          items={items}
          initialSelected="Banana"
        />,
      );
      // The trigger button should show the selected value, not the title
      const trigger = screen.getByTestId("popover-trigger");
      expect(trigger.textContent).toContain("Banana");
    });

    it("shows Check icon only for selected item", () => {
      render(
        <DropdownSelect
          type={DropdownSelectType.SingleString}
          title="Fruit"
          items={items}
          initialSelected="Apple"
        />,
      );
      expect(screen.getAllByTestId("check-icon")).toHaveLength(1);
    });

    it("does not show Circle/CircleCheck icons", () => {
      render(
        <DropdownSelect
          type={DropdownSelectType.SingleString}
          title="Fruit"
          items={items}
          initialSelected="Apple"
        />,
      );
      expect(screen.queryByTestId("circle-icon")).not.toBeInTheDocument();
      expect(screen.queryByTestId("circle-check-icon")).not.toBeInTheDocument();
    });

    it("fires onChangeSelected with the clicked item", () => {
      const onChangeSelected = jest.fn();
      render(
        <DropdownSelect
          type={DropdownSelectType.SingleString}
          title="Fruit"
          items={items}
          initialSelected="Apple"
          onChangeSelected={onChangeSelected}
        />,
      );
      clickItem(1); // Banana
      expect(onChangeSelected).toHaveBeenCalledWith("Banana");
    });

    it("does not show All/Clear buttons", () => {
      render(
        <DropdownSelect
          type={DropdownSelectType.SingleString}
          title="Fruit"
          items={items}
          initialSelected="Apple"
        />,
      );
      expect(screen.queryByText("All")).not.toBeInTheDocument();
      expect(screen.queryByText("Clear")).not.toBeInTheDocument();
    });

    it("does not throw when onChangeSelected is undefined", () => {
      render(
        <DropdownSelect
          type={DropdownSelectType.SingleString}
          title="Fruit"
          items={items}
          initialSelected="Apple"
        />,
      );
      expect(() => clickItem(1)).not.toThrow();
    });
  });

  // --- MultiString ---

  describe("MultiString", () => {
    const items = ["US", "IN", "GB"];

    it("shows title as display text (not selected items)", () => {
      render(
        <DropdownSelect
          type={DropdownSelectType.MultiString}
          title="Country"
          items={items}
          initialSelected={["US", "IN"]}
        />,
      );
      const trigger = screen.getByTestId("popover-trigger");
      expect(trigger.textContent).toContain("Country");
    });

    it("shows CircleCheck for selected and Circle for unselected", () => {
      render(
        <DropdownSelect
          type={DropdownSelectType.MultiString}
          title="Country"
          items={items}
          initialSelected={["US"]}
        />,
      );
      expect(screen.getAllByTestId("circle-check-icon")).toHaveLength(1);
      expect(screen.getAllByTestId("circle-icon")).toHaveLength(2);
    });

    it("toggles item on when clicked", () => {
      const onChangeSelected = jest.fn();
      render(
        <DropdownSelect
          type={DropdownSelectType.MultiString}
          title="Country"
          items={items}
          initialSelected={["US"]}
          onChangeSelected={onChangeSelected}
        />,
      );
      clickItem(1); // IN
      const lastCall = onChangeSelected.mock.calls.slice(-1)[0][0];
      expect(lastCall).toContain("IN");
      expect(lastCall).toContain("US");
    });

    it("toggles item off when clicked again", () => {
      const onChangeSelected = jest.fn();
      render(
        <DropdownSelect
          type={DropdownSelectType.MultiString}
          title="Country"
          items={items}
          initialSelected={["US", "IN"]}
          onChangeSelected={onChangeSelected}
        />,
      );
      clickItem(0); // US (deselect)
      const lastCall = onChangeSelected.mock.calls.slice(-1)[0][0];
      expect(lastCall).not.toContain("US");
      expect(lastCall).toContain("IN");
    });

    it("allows deselecting all items", () => {
      const onChangeSelected = jest.fn();
      render(
        <DropdownSelect
          type={DropdownSelectType.MultiString}
          title="Country"
          items={items}
          initialSelected={["US"]}
          onChangeSelected={onChangeSelected}
        />,
      );
      clickItem(0); // deselect US
      const lastCall = onChangeSelected.mock.calls.slice(-1)[0][0];
      expect(lastCall).toHaveLength(0);
    });

    it("shows All and Clear buttons", () => {
      render(
        <DropdownSelect
          type={DropdownSelectType.MultiString}
          title="Country"
          items={items}
          initialSelected={[]}
        />,
      );
      expect(screen.getByText("All")).toBeInTheDocument();
      expect(screen.getByText("Clear")).toBeInTheDocument();
    });

    it("does not show All/Clear buttons when only 1 item", () => {
      render(
        <DropdownSelect
          type={DropdownSelectType.MultiString}
          title="Country"
          items={["US"]}
          initialSelected={[]}
        />,
      );
      expect(screen.queryByText("All")).not.toBeInTheDocument();
      expect(screen.queryByText("Clear")).not.toBeInTheDocument();
    });

    it("selects all items when All is clicked", () => {
      const onChangeSelected = jest.fn();
      render(
        <DropdownSelect
          type={DropdownSelectType.MultiString}
          title="Country"
          items={items}
          initialSelected={["US"]}
          onChangeSelected={onChangeSelected}
        />,
      );
      fireEvent.click(screen.getByText("All"));
      const lastCall = onChangeSelected.mock.calls.slice(-1)[0][0];
      expect(lastCall).toEqual(["US", "IN", "GB"]);
    });

    it("clears all items when Clear is clicked", () => {
      const onChangeSelected = jest.fn();
      render(
        <DropdownSelect
          type={DropdownSelectType.MultiString}
          title="Country"
          items={items}
          initialSelected={["US", "IN"]}
          onChangeSelected={onChangeSelected}
        />,
      );
      fireEvent.click(screen.getByText("Clear"));
      const lastCall = onChangeSelected.mock.calls.slice(-1)[0][0];
      expect(lastCall).toEqual([]);
    });
  });

  // --- Item objects ---

  describe("Item objects", () => {
    const items = [
      { value: "step_1", label: "Opened app", color: "#ff0000" },
      { value: "step_2", label: "Added to cart" },
      { value: "step_3", label: "Checked out", color: "#0000ff" },
    ];

    function renderSingle(
      initialSelected: string,
      onChangeSelected?: (item: string | string[]) => void,
    ) {
      render(
        <DropdownSelect
          type={DropdownSelectType.SingleString}
          title="Step"
          items={items}
          initialSelected={initialSelected}
          onChangeSelected={onChangeSelected}
        />,
      );
    }

    function renderMulti(
      initialSelected: string[],
      onChangeSelected?: (item: string | string[]) => void,
    ) {
      render(
        <DropdownSelect
          type={DropdownSelectType.MultiString}
          title="Steps"
          items={items}
          initialSelected={initialSelected}
          onChangeSelected={onChangeSelected}
        />,
      );
    }

    function colorDot(item: HTMLElement) {
      return item.querySelector<HTMLElement>("span[style]");
    }

    it("renders each item's label", () => {
      renderMulti([]);
      expect(getItems().map((item) => item.textContent)).toEqual([
        "Opened app",
        "Added to cart",
        "Checked out",
      ]);
    });

    it("shows the selected item's label as display text in single select", () => {
      renderSingle("step_2");
      const trigger = screen.getByTestId("popover-trigger");
      expect(trigger.textContent).toContain("Added to cart");
      expect(trigger.textContent).not.toContain("step_2");
    });

    it("falls back to the selected value when no item has that value", () => {
      renderSingle("step_9");
      expect(screen.getByTestId("popover-trigger").textContent).toContain(
        "step_9",
      );
    });

    it("shows Check icon on the item whose value is selected", () => {
      renderSingle("step_3");
      expect(screen.getAllByTestId("check-icon")).toHaveLength(1);
      expect(
        getItems()[2].querySelector('[data-testid="check-icon"]'),
      ).not.toBeNull();
    });

    it("fires onChangeSelected with the value in single select", () => {
      const onChangeSelected = jest.fn();
      renderSingle("step_1", onChangeSelected);
      clickItem(1);
      expect(onChangeSelected).toHaveBeenCalledWith("step_2");
    });

    it("selects by value on Enter key", () => {
      const onChangeSelected = jest.fn();
      renderSingle("step_1", onChangeSelected);
      fireEvent.keyDown(getItems()[2], { key: "Enter" });
      expect(onChangeSelected).toHaveBeenCalledWith("step_3");
    });

    it("toggles values in multi select and marks selected items by value", () => {
      const onChangeSelected = jest.fn();
      renderMulti(["step_1"], onChangeSelected);
      expect(
        getItems()[0].querySelector('[data-testid="circle-check-icon"]'),
      ).not.toBeNull();
      clickItem(2);
      expect(onChangeSelected).toHaveBeenLastCalledWith(["step_3", "step_1"]);
    });

    it("selects every value when All is clicked", () => {
      const onChangeSelected = jest.fn();
      renderMulti([], onChangeSelected);
      fireEvent.click(screen.getByText("All"));
      expect(onChangeSelected).toHaveBeenLastCalledWith([
        "step_1",
        "step_2",
        "step_3",
      ]);
      expect(screen.getAllByTestId("circle-check-icon")).toHaveLength(3);
    });

    it("matches search against labels and not values", () => {
      renderMulti([]);
      search("CART");
      expect(getItems()).toHaveLength(1);
      expect(getItems()[0].textContent).toBe("Added to cart");

      search("step_");
      expect(screen.queryAllByTestId("command-item")).toHaveLength(0);
    });

    it("selects the value of a filtered item", () => {
      const onChangeSelected = jest.fn();
      renderSingle("step_1", onChangeSelected);
      search("checked");
      clickItem(0);
      expect(onChangeSelected).toHaveBeenCalledWith("step_3");
    });

    it("renders a color dot only for items with a color", () => {
      renderMulti([]);
      const renderedItems = getItems();
      expect(colorDot(renderedItems[0])).toHaveStyle({
        backgroundColor: "#ff0000",
      });
      expect(colorDot(renderedItems[1])).toBeNull();
      expect(colorDot(renderedItems[2])).toHaveStyle({
        backgroundColor: "#0000ff",
      });
    });
  });

  // --- Search filtering ---

  describe("Search filtering", () => {
    it("filters string items case-insensitively", () => {
      render(
        <DropdownSelect
          type={DropdownSelectType.MultiString}
          title="Country"
          items={["US", "India", "UK"]}
          initialSelected={[]}
        />,
      );
      search("ind");
      expect(getItems()).toHaveLength(1);
      expect(screen.getByText("India")).toBeInTheDocument();
    });

    it("shows all items when search is cleared", () => {
      render(
        <DropdownSelect
          type={DropdownSelectType.MultiString}
          title="Country"
          items={["US", "IN", "GB"]}
          initialSelected={[]}
        />,
      );
      search("US");
      expect(getItems()).toHaveLength(1);
      search("");
      expect(getItems()).toHaveLength(3);
    });

    it("shows no items when search has no matches", () => {
      render(
        <DropdownSelect
          type={DropdownSelectType.MultiString}
          title="Country"
          items={["US", "IN"]}
          initialSelected={[]}
        />,
      );
      search("zzz");
      expect(screen.queryAllByTestId("command-item")).toHaveLength(0);
    });
  });

  // --- Keyboard interaction ---

  describe("Keyboard interaction", () => {
    it("selects all on Enter key on All button", () => {
      const onChangeSelected = jest.fn();
      render(
        <DropdownSelect
          type={DropdownSelectType.MultiString}
          title="Country"
          items={["US", "IN", "GB"]}
          initialSelected={["US"]}
          onChangeSelected={onChangeSelected}
        />,
      );
      fireEvent.keyDown(screen.getByText("All"), { key: "Enter" });
      const lastCall = onChangeSelected.mock.calls.slice(-1)[0][0];
      expect(lastCall).toEqual(["US", "IN", "GB"]);
    });

    it("clears all on Enter key on Clear button", () => {
      const onChangeSelected = jest.fn();
      render(
        <DropdownSelect
          type={DropdownSelectType.MultiString}
          title="Country"
          items={["US", "IN"]}
          initialSelected={["US"]}
          onChangeSelected={onChangeSelected}
        />,
      );
      fireEvent.keyDown(screen.getByText("Clear"), { key: "Enter" });
      const lastCall = onChangeSelected.mock.calls.slice(-1)[0][0];
      expect(lastCall).toEqual([]);
    });

    it("selects item on Enter key on command item", () => {
      const onChangeSelected = jest.fn();
      render(
        <DropdownSelect
          type={DropdownSelectType.SingleString}
          title="Fruit"
          items={["Apple", "Banana"]}
          initialSelected="Apple"
          onChangeSelected={onChangeSelected}
        />,
      );
      const items = getItems();
      fireEvent.keyDown(items[1], { key: "Enter" });
      expect(onChangeSelected).toHaveBeenCalledWith("Banana");
    });
  });

  // --- Disabled state ---

  describe("Disabled state", () => {
    it("passes disabled to popover trigger", () => {
      render(
        <DropdownSelect
          type={DropdownSelectType.SingleString}
          title="Fruit"
          items={["Apple"]}
          initialSelected="Apple"
          disabled={true}
        />,
      );
      expect(screen.getByTestId("popover-trigger")).toHaveAttribute(
        "data-disabled",
        "true",
      );
    });

    it("is not disabled by default", () => {
      render(
        <DropdownSelect
          type={DropdownSelectType.SingleString}
          title="Fruit"
          items={["Apple"]}
          initialSelected="Apple"
        />,
      );
      expect(screen.getByTestId("popover-trigger")).toHaveAttribute(
        "data-disabled",
        "false",
      );
    });
  });

  // --- initialSelected sync ---

  describe("initialSelected sync", () => {
    it("updates selection when initialSelected prop changes", () => {
      const { rerender } = render(
        <DropdownSelect
          type={DropdownSelectType.SingleString}
          title="Fruit"
          items={["Apple", "Banana"]}
          initialSelected="Apple"
        />,
      );
      expect(screen.getByTestId("popover-trigger").textContent).toContain(
        "Apple",
      );

      rerender(
        <DropdownSelect
          type={DropdownSelectType.SingleString}
          title="Fruit"
          items={["Apple", "Banana"]}
          initialSelected="Banana"
        />,
      );
      expect(screen.getByTestId("popover-trigger").textContent).toContain(
        "Banana",
      );
    });
  });
});
