import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import TraceToolbar from "@/app/components/trace/toolbar";

function setup(
  overrides: Partial<React.ComponentProps<typeof TraceToolbar>> = {},
) {
  const props = {
    searchQuery: "",
    setSearchQuery: jest.fn(),
    matchCount: 0,
    matchIndex: 0,
    onSearchPrev: jest.fn(),
    onSearchNext: jest.fn(),
    errorCount: 0,
    highlightErrors: false,
    setHighlightErrors: jest.fn(),
    ...overrides,
  };
  render(<TraceToolbar {...props} />);
  return props;
}

describe("TraceToolbar — search", () => {
  it("renders the search input", () => {
    setup();
    expect(
      screen.getByPlaceholderText("Search spans, attributes, checkpoints..."),
    ).toBeTruthy();
  });

  it("calls setSearchQuery on input change", () => {
    const { setSearchQuery } = setup();
    fireEvent.change(screen.getByPlaceholderText(/Search spans/), {
      target: { value: "checkout" },
    });
    expect(setSearchQuery).toHaveBeenCalledWith("checkout");
  });

  it("hides match counter when the query is empty", () => {
    setup({ searchQuery: "" });
    expect(screen.queryByLabelText("Next match")).toBeNull();
    expect(screen.queryByLabelText("Previous match")).toBeNull();
    expect(screen.queryByLabelText("Clear search")).toBeNull();
  });

  it('shows "0 matches" when no matches found', () => {
    setup({ searchQuery: "x", matchCount: 0 });
    expect(screen.getByText("0 matches")).toBeTruthy();
  });

  it("shows index/total when there are matches", () => {
    setup({ searchQuery: "x", matchCount: 5, matchIndex: 2 });
    expect(screen.getByText("3 / 5")).toBeTruthy();
  });

  it("calls onSearchNext / onSearchPrev when the buttons are clicked", () => {
    const { onSearchNext, onSearchPrev } = setup({
      searchQuery: "x",
      matchCount: 2,
    });
    fireEvent.click(screen.getByLabelText("Next match"));
    fireEvent.click(screen.getByLabelText("Previous match"));
    expect(onSearchNext).toHaveBeenCalledTimes(1);
    expect(onSearchPrev).toHaveBeenCalledTimes(1);
  });

  it("clears the search via the X button", () => {
    const { setSearchQuery } = setup({ searchQuery: "x", matchCount: 0 });
    fireEvent.click(screen.getByLabelText("Clear search"));
    expect(setSearchQuery).toHaveBeenCalledWith("");
  });

  it("disables nav buttons when there are no matches", () => {
    setup({ searchQuery: "x", matchCount: 0 });
    expect(screen.getByLabelText("Next match").hasAttribute("disabled")).toBe(
      true,
    );
    expect(
      screen.getByLabelText("Previous match").hasAttribute("disabled"),
    ).toBe(true);
  });

  it("disables the search input when searchDisabled is true", () => {
    setup({ searchDisabled: true });
    const input = screen.getByPlaceholderText(
      /Search spans/,
    ) as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it("leaves the search input enabled by default", () => {
    setup();
    const input = screen.getByPlaceholderText(
      /Search spans/,
    ) as HTMLInputElement;
    expect(input.disabled).toBe(false);
  });
});

describe("TraceToolbar — errors", () => {
  it('shows "Show errors" without count when errorCount=0', () => {
    setup({ errorCount: 0 });
    expect(screen.getByText("Show errors")).toBeTruthy();
  });

  it('shows "Show errors (N)" when errorCount > 0', () => {
    setup({ errorCount: 3 });
    expect(screen.getByText("Show errors (3)")).toBeTruthy();
  });

  it("toggles highlightErrors via the switch", () => {
    const { setHighlightErrors } = setup({ highlightErrors: false });
    fireEvent.click(screen.getByLabelText("Show errors"));
    expect(setHighlightErrors).toHaveBeenCalledWith(true);
  });
});

describe("TraceToolbar — session timeline slot", () => {
  it("renders sessionTimelineNode when provided", () => {
    setup({
      sessionTimelineNode: (
        <a href="/x" data-testid="session-link">
          View Session Timeline
        </a>
      ),
    });
    expect(screen.getByTestId("session-link")).toBeTruthy();
    expect(screen.getByText("View Session Timeline")).toBeTruthy();
  });

  it("renders nothing in the slot by default", () => {
    setup();
    expect(screen.queryByText("View Session Timeline")).toBeNull();
  });
});
