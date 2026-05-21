import { describe, expect, it, jest } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

import ErrorsTypeFilter from "@/app/components/errors_type_filter";

type Handlers = {
  onChangeErrorTypes: jest.Mock<(types: string[]) => void>;
  onChangeCustomErrorsOnly: jest.Mock<(custom: boolean) => void>;
};

function renderFilter(
  overrides: Partial<{
    selectedErrorTypes: string[];
    customErrorsOnly: boolean;
    showCustomToggle: boolean;
    open: boolean;
  }> = {},
): Handlers {
  const handlers: Handlers = {
    onChangeErrorTypes: jest.fn() as Handlers["onChangeErrorTypes"],
    onChangeCustomErrorsOnly: jest.fn() as Handlers["onChangeCustomErrorsOnly"],
  };
  render(
    <ErrorsTypeFilter
      selectedErrorTypes={overrides.selectedErrorTypes ?? ["error"]}
      customErrorsOnly={overrides.customErrorsOnly ?? false}
      showCustomToggle={overrides.showCustomToggle ?? true}
      onChangeErrorTypes={handlers.onChangeErrorTypes}
      onChangeCustomErrorsOnly={handlers.onChangeCustomErrorsOnly}
      open={overrides.open ?? true}
    />,
  );
  return handlers;
}

function getControl(label: string): HTMLElement {
  const text = screen.getByText(label);
  const wrapper = text.closest('[role="checkbox"], label');
  if (!wrapper) {
    throw new Error(`No checkbox/label wrapper found for "${label}"`);
  }
  if (wrapper.getAttribute("role") === "checkbox") {
    return wrapper as HTMLElement;
  }
  const input = wrapper.querySelector('button[role="switch"]');
  if (!input) {
    throw new Error(`No switch control found in label "${label}"`);
  }
  return input as HTMLElement;
}

describe("ErrorsTypeFilter", () => {
  it("renders Type trigger and Error, ANR entries", () => {
    renderFilter();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("ANR")).toBeInTheDocument();
  });

  it("renders Custom inline on the Error row with a Switch when showCustomToggle is true", () => {
    renderFilter();
    const custom = screen.getByText("Custom Only");
    expect(custom).toBeInTheDocument();
    const switchEl = custom
      .closest("label")
      ?.querySelector('button[role="switch"]');
    expect(switchEl).not.toBeNull();
  });

  it("renders Error and ANR as multi-select items (matching DropdownSelect)", () => {
    renderFilter();
    expect(getControl("Error")).toHaveAttribute("role", "checkbox");
    expect(getControl("ANR")).toHaveAttribute("role", "checkbox");
  });

  it("hides Custom when showCustomToggle is false", () => {
    renderFilter({ showCustomToggle: false });
    expect(screen.queryByText("Custom Only")).not.toBeInTheDocument();
  });

  it("disables the Custom switch when Error is unchecked", () => {
    renderFilter({ selectedErrorTypes: ["anr"] });
    expect(getControl("Custom Only")).toBeDisabled();
  });

  it("enables the Custom switch when Error is checked", () => {
    renderFilter({ selectedErrorTypes: ["error"] });
    expect(getControl("Custom Only")).not.toBeDisabled();
  });

  it("reflects checked state for Error, ANR, and Custom from props", () => {
    renderFilter({
      selectedErrorTypes: ["error", "anr"],
      customErrorsOnly: true,
    });
    expect(getControl("Error")).toHaveAttribute("aria-checked", "true");
    expect(getControl("ANR")).toHaveAttribute("aria-checked", "true");
    expect(getControl("Custom Only")).toHaveAttribute("data-state", "checked");
  });

  it("adds 'error' to the list when Error is checked", () => {
    const h = renderFilter({ selectedErrorTypes: ["anr"] });
    fireEvent.click(getControl("Error"));
    expect(h.onChangeErrorTypes).toHaveBeenCalledWith(["anr", "error"]);
  });

  it("removes 'error' from the list when Error is unchecked", () => {
    const h = renderFilter({ selectedErrorTypes: ["error", "anr"] });
    fireEvent.click(getControl("Error"));
    expect(h.onChangeErrorTypes).toHaveBeenCalledWith(["anr"]);
  });

  it("clears Custom when Error is unchecked (Custom is scoped to Error)", () => {
    const h = renderFilter({
      selectedErrorTypes: ["error", "anr"],
      customErrorsOnly: true,
    });
    fireEvent.click(getControl("Error"));
    expect(h.onChangeErrorTypes).toHaveBeenCalledWith(["anr"]);
    expect(h.onChangeCustomErrorsOnly).toHaveBeenCalledWith(false);
  });

  it("does NOT clear Custom when Error is unchecked if Custom was already off", () => {
    const h = renderFilter({
      selectedErrorTypes: ["error", "anr"],
      customErrorsOnly: false,
    });
    fireEvent.click(getControl("Error"));
    expect(h.onChangeErrorTypes).toHaveBeenCalledWith(["anr"]);
    expect(h.onChangeCustomErrorsOnly).not.toHaveBeenCalled();
  });

  it("adds 'anr' to the list when ANR is checked", () => {
    const h = renderFilter({ selectedErrorTypes: ["error"] });
    fireEvent.click(getControl("ANR"));
    expect(h.onChangeErrorTypes).toHaveBeenCalledWith(["error", "anr"]);
  });

  it("removes 'anr' from the list when ANR is unchecked", () => {
    const h = renderFilter({ selectedErrorTypes: ["error", "anr"] });
    fireEvent.click(getControl("ANR"));
    expect(h.onChangeErrorTypes).toHaveBeenCalledWith(["error"]);
  });

  it("forwards Custom Switch changes through onChangeCustomErrorsOnly", () => {
    const h = renderFilter({
      selectedErrorTypes: ["error"],
      customErrorsOnly: false,
    });
    fireEvent.click(getControl("Custom Only"));
    expect(h.onChangeCustomErrorsOnly).toHaveBeenCalledWith(true);
  });
});
