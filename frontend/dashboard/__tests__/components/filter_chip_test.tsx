import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

// --- Mocks ---

jest.mock("lucide-react", () => ({
  RotateCcw: ({ className }: any) => (
    <span data-testid="reset-icon" className={className} />
  ),
  X: ({ className }: any) => (
    <span data-testid="clear-icon" className={className} />
  ),
}));

jest.mock("@/app/components/tooltip", () => ({
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipTrigger: ({ children }: any) => <>{children}</>,
  TooltipContent: ({ children }: any) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

// --- Import (after mocks) ---

import FilterChip from "@/app/components/filter_chip";

// ============================================================
// Tests
// ============================================================

describe("FilterChip", () => {
  describe("without an action", () => {
    it("renders the label", () => {
      render(<FilterChip label="App versions: 2.0 (200)" onClick={() => {}} />);
      expect(screen.getByText("App versions: 2.0 (200)")).toBeInTheDocument();
    });

    it("renders a single button and no action button", () => {
      render(<FilterChip label="App versions: 2.0 (200)" onClick={() => {}} />);
      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(screen.queryByTestId("clear-icon")).not.toBeInTheDocument();
      expect(screen.queryByTestId("reset-icon")).not.toBeInTheDocument();
    });

    it("calls onClick when clicked", () => {
      const onClick = jest.fn();
      render(<FilterChip label="App versions: 2.0 (200)" onClick={onClick} />);
      fireEvent.click(screen.getByText("App versions: 2.0 (200)"));
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("clear action", () => {
    function renderClear() {
      const onClick = jest.fn();
      const onClear = jest.fn();
      render(
        <FilterChip
          label="Country: US"
          onClick={onClick}
          action={{ kind: "clear", onClick: onClear }}
        />,
      );
      return { onClick, onClear };
    }

    it("renders the clear (X) icon, not the reset icon", () => {
      renderClear();
      expect(screen.getByTestId("clear-icon")).toBeInTheDocument();
      expect(screen.queryByTestId("reset-icon")).not.toBeInTheDocument();
    });

    it("labels the action button 'Clear <filter>'", () => {
      renderClear();
      expect(screen.getByLabelText("Clear Country")).toBeInTheDocument();
    });

    it("fires only the action onClick when the action button is clicked", () => {
      const { onClick, onClear } = renderClear();
      fireEvent.click(screen.getByLabelText("Clear Country"));
      expect(onClear).toHaveBeenCalledTimes(1);
      expect(onClick).not.toHaveBeenCalled();
    });

    it("fires only the body onClick when the label is clicked", () => {
      const { onClick, onClear } = renderClear();
      fireEvent.click(screen.getByText("Country: US"));
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClear).not.toHaveBeenCalled();
    });

    it("shows a 'Clear' tooltip on the action button", () => {
      renderClear();
      expect(screen.getByText("Clear")).toBeInTheDocument();
    });
  });

  describe("reset action", () => {
    function renderReset() {
      render(
        <FilterChip
          label="Session Types: Crashes"
          onClick={() => {}}
          action={{ kind: "reset", onClick: () => {} }}
        />,
      );
    }

    it("renders the reset icon, not the clear icon", () => {
      renderReset();
      expect(screen.getByTestId("reset-icon")).toBeInTheDocument();
      expect(screen.queryByTestId("clear-icon")).not.toBeInTheDocument();
    });

    it("labels the action button 'Reset <filter>'", () => {
      renderReset();
      expect(screen.getByLabelText("Reset Session Types")).toBeInTheDocument();
    });

    it("shows a 'Reset to defaults' tooltip on the action button", () => {
      renderReset();
      expect(screen.getByText("Reset to defaults")).toBeInTheDocument();
    });
  });

  describe("body tooltip", () => {
    it("shows the full, untruncated text when the label is truncated", () => {
      render(
        <FilterChip
          label="OS Versions: a, b + 2 more"
          tooltip="OS Versions: a, b, c, d"
          onClick={() => {}}
        />,
      );
      expect(screen.getByText("OS Versions: a, b, c, d")).toBeInTheDocument();
    });

    it("shows no body tooltip when the full text equals the label", () => {
      render(
        <FilterChip
          label="OS Versions: a, b"
          tooltip="OS Versions: a, b"
          onClick={() => {}}
        />,
      );
      expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();
    });

    it("shows no body tooltip when no tooltip text is provided", () => {
      render(<FilterChip label="OS Versions: a, b" onClick={() => {}} />);
      expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();
    });
  });
});
