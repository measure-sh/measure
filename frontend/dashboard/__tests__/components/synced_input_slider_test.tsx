import { SyncedInputSlider } from "@/app/components/synced_input_slider";
import { describe, expect, it, jest } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

// Radix Slider measures its track via ResizeObserver, absent in jsdom.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
}

type Props = ComponentProps<typeof SyncedInputSlider>;

function setup(overrides: Partial<Props> = {}) {
  const onChange = jest.fn();
  const props: Props = {
    label: "Daily users",
    description: "How many users",
    value: 50,
    onChange,
    min: 0,
    max: 100,
    step: 1,
    rangeStartLabel: "0",
    rangeEndLabel: "100",
    ...overrides,
  };
  const utils = render(<SyncedInputSlider {...props} />);
  return { onChange, props, ...utils };
}

const input = () => screen.getByRole("textbox") as HTMLInputElement;

describe("SyncedInputSlider", () => {
  describe("rendering", () => {
    it("renders the label, description and value", () => {
      setup();
      expect(screen.getByText("Daily users")).toBeInTheDocument();
      expect(screen.getByText("How many users")).toBeInTheDocument();
      expect(input()).toHaveValue("50");
    });

    it("associates the label with the input", () => {
      setup();
      // The slider also carries the label as its aria-label, so scope to the
      // textbox role to confirm the <label> names the input.
      expect(screen.getByRole("textbox", { name: "Daily users" })).toBe(
        input(),
      );
    });

    it("groups large values with thousands separators", () => {
      setup({ value: 1000, max: 10_000_000, integer: true });
      expect(input()).toHaveValue("1,000");
    });

    it("renders the suffix when provided", () => {
      setup({ suffix: "users" });
      expect(screen.getByText("users")).toBeInTheDocument();
    });

    it("renders the range start and end labels", () => {
      setup({ rangeStartLabel: "0%", rangeEndLabel: "100%" });
      expect(screen.getByText("0%")).toBeInTheDocument();
      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    it("exposes the value, min and max on the slider", () => {
      setup({ value: 42 });
      const slider = screen.getByRole("slider");
      expect(slider).toHaveAttribute("aria-valuenow", "42");
      expect(slider).toHaveAttribute("aria-valuemin", "0");
      expect(slider).toHaveAttribute("aria-valuemax", "100");
    });

    it("computes the slider step from a step function", () => {
      const step = jest.fn((v: number) => (v < 50 ? 1 : 10));
      setup({ value: 50, step });
      expect(step).toHaveBeenCalledWith(50);
    });

    it("renders larger styling for the primary field", () => {
      setup({ large: true });
      expect(screen.getByText("Daily users")).toHaveClass("text-2xl");
    });
  });

  describe("manual entry — integer field", () => {
    it("calls onChange with the typed number", () => {
      const { onChange } = setup({ integer: true });
      act(() => fireEvent.change(input(), { target: { value: "75" } }));
      expect(input()).toHaveValue("75");
      expect(onChange).toHaveBeenCalledWith(75);
    });

    it("clamps to max when the entry exceeds it", () => {
      const { onChange } = setup({ integer: true, max: 100 });
      act(() => fireEvent.change(input(), { target: { value: "150" } }));
      expect(onChange).toHaveBeenCalledWith(100);
    });

    it("clamps to min when the entry is below it", () => {
      const { onChange } = setup({ integer: true, min: 10, max: 100 });
      act(() => fireEvent.change(input(), { target: { value: "5" } }));
      expect(onChange).toHaveBeenCalledWith(10);
    });

    it("clamps a negative entry to the default min of 0", () => {
      const { onChange } = setup({ integer: true });
      act(() => fireEvent.change(input(), { target: { value: "-10" } }));
      expect(onChange).toHaveBeenCalledWith(0);
    });

    it("keeps integer fields whole", () => {
      const { onChange } = setup({ integer: true });
      act(() => fireEvent.change(input(), { target: { value: "33.7" } }));
      expect(onChange).toHaveBeenCalledWith(33);
    });
  });

  describe("manual entry — decimal field", () => {
    const decimal = { value: 0.5, min: 0, max: 1, step: 0.01, precision: 2 };

    it("calls onChange with the typed float", () => {
      const { onChange } = setup(decimal);
      act(() => fireEvent.change(input(), { target: { value: "0.75" } }));
      expect(onChange).toHaveBeenCalledWith(0.75);
    });

    it("clamps a float above max", () => {
      const { onChange } = setup(decimal);
      act(() => fireEvent.change(input(), { target: { value: "1.5" } }));
      expect(onChange).toHaveBeenCalledWith(1);
    });

    it("clamps a float below min", () => {
      const { onChange } = setup(decimal);
      act(() => fireEvent.change(input(), { target: { value: "-0.5" } }));
      expect(onChange).toHaveBeenCalledWith(0);
    });

    it("rounds to the configured precision", () => {
      const { onChange } = setup(decimal);
      act(() => fireEvent.change(input(), { target: { value: "0.129" } }));
      expect(onChange).toHaveBeenCalledWith(0.13);
    });
  });

  describe("blur", () => {
    it("reverts to the last value when left empty", () => {
      setup({ integer: true });
      act(() => fireEvent.change(input(), { target: { value: "" } }));
      expect(input()).toHaveValue("");
      act(() => fireEvent.blur(input()));
      expect(input()).toHaveValue("50");
    });

    it("reverts to the last value when the text is invalid", () => {
      setup({ integer: true });
      act(() => fireEvent.change(input(), { target: { value: "abc" } }));
      act(() => fireEvent.blur(input()));
      expect(input()).toHaveValue("50");
    });

    it("clamps and reformats an out-of-range entry", () => {
      setup({ integer: true, max: 100 });
      act(() => fireEvent.change(input(), { target: { value: "150" } }));
      act(() => fireEvent.blur(input()));
      expect(input()).toHaveValue("100");
    });

    it("regroups a large entry with separators", () => {
      setup({ value: 1000, max: 10_000_000, integer: true });
      act(() => fireEvent.change(input(), { target: { value: "1500000" } }));
      act(() => fireEvent.blur(input()));
      expect(input()).toHaveValue("1,500,000");
    });
  });

  describe("focus formatting", () => {
    it("drops separators while editing and restores them on blur", () => {
      setup({ value: 1000, max: 10_000_000, integer: true });
      expect(input()).toHaveValue("1,000");

      act(() => fireEvent.focus(input()));
      expect(input()).toHaveValue("1000");

      act(() => fireEvent.blur(input()));
      expect(input()).toHaveValue("1,000");
    });
  });

  describe("external value changes", () => {
    it("syncs the input when the value prop changes (e.g. slider drag)", () => {
      const { props, rerender } = setup({ value: 50 });
      expect(input()).toHaveValue("50");

      rerender(<SyncedInputSlider {...props} value={75} />);
      expect(input()).toHaveValue("75");
    });

    it("updates the slider position when the value prop changes", () => {
      const { props, rerender } = setup({ value: 50 });
      expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "50");

      rerender(<SyncedInputSlider {...props} value={75} />);
      expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "75");
    });

    it("keeps in-progress text when the value changes mid-edit", () => {
      const { props, rerender } = setup({ value: 50, integer: true });
      act(() => fireEvent.focus(input()));
      act(() => fireEvent.change(input(), { target: { value: "7" } }));

      // A slider-driven value change while the field is focused must not
      // overwrite what the user is typing.
      rerender(<SyncedInputSlider {...props} value={90} />);
      expect(input()).toHaveValue("7");
    });
  });

  describe("edge cases", () => {
    it("does not call onChange for an empty entry", () => {
      const { onChange } = setup();
      act(() => fireEvent.change(input(), { target: { value: "" } }));
      expect(onChange).not.toHaveBeenCalled();
    });

    it("does not call onChange for whitespace", () => {
      const { onChange } = setup();
      act(() => fireEvent.change(input(), { target: { value: "   " } }));
      expect(onChange).not.toHaveBeenCalled();
    });

    it("handles min equal to max", () => {
      const { onChange } = setup({ min: 50, max: 50, value: 50 });
      act(() => fireEvent.change(input(), { target: { value: "100" } }));
      expect(onChange).toHaveBeenCalledWith(50);
    });

    it("renders a zero value", () => {
      setup({ value: 0, integer: true });
      expect(input()).toHaveValue("0");
    });
  });
});
