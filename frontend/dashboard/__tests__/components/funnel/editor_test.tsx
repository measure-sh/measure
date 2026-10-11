import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

// --- Mocks ---

const mockMutateAsync = jest.fn();
const mockToastPositive = jest.fn();
const mockToastNegative = jest.fn();

let mockSaveIsPending = false;
let mockEventNames: {
  data: string[] | undefined;
  isPending: boolean;
  isError: boolean;
};
// Answers like the server: the names containing the search.
const mockUseFunnelEventNamesQuery = jest.fn(
  (_appId: string, search: string) => ({
    ...mockEventNames,
    data: mockEventNames.data?.filter((name) => name.includes(search)),
  }),
);

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useFunnelEventNamesQuery: (appId: string, search: string) =>
    mockUseFunnelEventNamesQuery(appId, search),
  useSaveFunnelMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockSaveIsPending,
  }),
}));

jest.mock("@/app/components/toast", () => ({
  toastPositive: (...args: unknown[]) => mockToastPositive(...args),
  toastNegative: (...args: unknown[]) => mockToastNegative(...args),
}));

// --- Import ---

import type { Funnel } from "@/app/api/api_calls";
import FunnelEditor from "@/app/components/funnel/editor";

// --- Helpers ---

const EVENTS = ["add_to_cart", "checkout_started", "purchase", "view_item"];

function makeFunnel(overrides: Partial<Funnel> = {}): Funnel {
  return {
    id: "funnel-1",
    app_id: "app-1",
    name: "Checkout",
    steps: [
      { event_name: "view_item" },
      { event_name: "add_to_cart" },
      { event_name: "purchase" },
    ],
    conversion_window_seconds: 7_200,
    pinned: false,
    pin_order: null,
    created_by: null,
    created_by_email: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

function renderEditor(
  overrides: Partial<{
    funnel: Funnel | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: (funnel: Funnel) => void;
  }> = {},
) {
  const props = {
    appId: "app-1",
    funnel: null,
    open: true,
    onOpenChange: jest.fn(),
    onSaved: jest.fn(),
    ...overrides,
  };
  const result = render(<FunnelEditor {...props} />);
  return { ...result, props };
}

function stepRows() {
  return screen
    .getAllByRole("button", { name: "Remove step" })
    .map((button) => button.parentElement as HTMLElement);
}

function stepEvents() {
  return stepRows().map(
    (row) => within(row).getAllByRole("button")[0].textContent,
  );
}

function openPicker(index: number) {
  fireEvent.click(within(stepRows()[index]).getAllByRole("button")[0]);
}

function options() {
  return screen.getAllByRole("option").map((option) => option.textContent);
}

function typeSearch(text: string) {
  fireEvent.change(screen.getByPlaceholderText("Search events..."), {
    target: { value: text },
  });
}

function chooseEvent(index: number, eventName: string) {
  openPicker(index);
  fireEvent.click(screen.getByRole("option", { name: eventName }));
}

function setName(name: string) {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: name } });
}

function setAmount(amount: string) {
  fireEvent.change(screen.getByLabelText("Conversion window"), {
    target: { value: amount },
  });
}

function unitTrigger() {
  return screen
    .getByLabelText("Conversion window")
    .parentElement!.querySelector("button")!;
}

function setUnit(unit: string) {
  fireEvent.click(unitTrigger());
  fireEvent.click(screen.getByRole("option", { name: unit }));
}

function unitText() {
  return unitTrigger().textContent;
}

function fillValidDraft() {
  setName("Checkout");
  chooseEvent(0, "view_item");
  chooseEvent(1, "purchase");
}

function saveButton(name = "Create funnel") {
  return screen.getByRole("button", { name });
}

async function submit() {
  await act(async () => {
    fireEvent.submit(screen.getByLabelText("Name").closest("form")!);
  });
}

// ============================================================
// Tests
// ============================================================

describe("FunnelEditor", () => {
  beforeAll(() => {
    // jsdom has neither, and the Radix popover and cmdk list call them.
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
    Element.prototype.scrollIntoView = jest.fn();
  });

  beforeEach(() => {
    mockSaveIsPending = false;
    mockEventNames = { data: EVENTS, isPending: false, isError: false };
  });

  describe("Create mode", () => {
    it("shows the create title and button", () => {
      renderEditor();
      expect(
        screen.getByRole("heading", { name: "Create funnel" }),
      ).toBeInTheDocument();
      expect(saveButton()).toBeInTheDocument();
    });

    it("starts with an empty name, two unselected steps and a 1 day window", () => {
      renderEditor();
      expect(screen.getByLabelText("Name")).toHaveValue("");
      expect(stepEvents()).toEqual(["Select event", "Select event"]);
      expect(screen.getByLabelText("Conversion window")).toHaveValue(1);
      expect(unitText()).toBe("days");
    });

    it("renders nothing inside the dialog while closed", () => {
      renderEditor({ open: false });
      expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Create funnel" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Edit mode", () => {
    it("shows the edit title and save changes button", () => {
      renderEditor({ funnel: makeFunnel() });
      expect(
        screen.getByRole("heading", { name: "Edit funnel" }),
      ).toBeInTheDocument();
      expect(saveButton("Save changes")).toBeInTheDocument();
    });

    it("prefills the name, steps and conversion window", () => {
      renderEditor({ funnel: makeFunnel() });
      expect(screen.getByLabelText("Name")).toHaveValue("Checkout");
      expect(stepEvents()).toEqual(["view_item", "add_to_cart", "purchase"]);
      expect(screen.getByLabelText("Conversion window")).toHaveValue(2);
      expect(unitText()).toBe("hours");
    });

    it("disables save with no message until something changes", () => {
      renderEditor({ funnel: makeFunnel() });
      expect(saveButton("Save changes")).toBeDisabled();
      expect(screen.queryByText(/Give the funnel a name/)).toBeNull();
      expect(screen.queryByText(/Select an event/)).toBeNull();
      expect(screen.queryByText(/conversion window must/)).toBeNull();
    });

    it("enables save when the name changes and disables it again when changed back", () => {
      renderEditor({ funnel: makeFunnel() });
      setName("Checkout v2");
      expect(saveButton("Save changes")).toBeEnabled();
      setName("Checkout");
      expect(saveButton("Save changes")).toBeDisabled();
    });

    it("treats surrounding whitespace in the name as unchanged", () => {
      renderEditor({ funnel: makeFunnel() });
      setName("  Checkout  ");
      expect(saveButton("Save changes")).toBeDisabled();
    });

    it("enables save when a step event changes", () => {
      renderEditor({ funnel: makeFunnel() });
      chooseEvent(1, "checkout_started");
      expect(saveButton("Save changes")).toBeEnabled();
    });

    it("enables save when the same steps are reordered", () => {
      renderEditor({ funnel: makeFunnel() });
      fireEvent.click(
        within(stepRows()[0]).getByRole("button", { name: "Move step down" }),
      );
      expect(saveButton("Save changes")).toBeEnabled();
    });

    it("enables save when a step is removed", () => {
      renderEditor({ funnel: makeFunnel() });
      fireEvent.click(
        within(stepRows()[2]).getByRole("button", { name: "Remove step" }),
      );
      expect(saveButton("Save changes")).toBeEnabled();
    });

    it("enables save when the conversion window changes", () => {
      renderEditor({ funnel: makeFunnel() });
      setAmount("3");
      expect(saveButton("Save changes")).toBeEnabled();
    });

    it("treats the same window in a different unit as unchanged", () => {
      renderEditor({ funnel: makeFunnel() });
      setUnit("minutes");
      setAmount("120");
      expect(saveButton("Save changes")).toBeDisabled();
    });
  });

  describe("Event picker", () => {
    it("lists the app's event names", () => {
      renderEditor();
      openPicker(0);
      expect(mockUseFunnelEventNamesQuery).toHaveBeenLastCalledWith(
        "app-1",
        "",
      );
      expect(options()).toEqual(EVENTS);
    });

    describe("search", () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it("asks the server for the typed search once the user stops typing", () => {
        renderEditor();
        openPicker(0);
        typeSearch(" pur ");

        act(() => {
          jest.advanceTimersByTime(299);
        });
        expect(mockUseFunnelEventNamesQuery).not.toHaveBeenCalledWith(
          "app-1",
          "pur",
        );
        // The listed names are the server's, so typing alone does not narrow
        // them.
        expect(options()).toEqual(EVENTS);

        act(() => {
          jest.advanceTimersByTime(1);
        });
        expect(mockUseFunnelEventNamesQuery).toHaveBeenLastCalledWith(
          "app-1",
          "pur",
        );
        expect(options()).toEqual(["purchase"]);
      });

      it("starts the next opening with no search", () => {
        renderEditor();
        openPicker(0);
        typeSearch("pur");
        act(() => {
          jest.advanceTimersByTime(300);
        });
        fireEvent.click(screen.getByRole("option", { name: "purchase" }));
        // Radix finishes closing the popover on a timer.
        act(() => {
          jest.advanceTimersByTime(0);
        });

        openPicker(0);
        act(() => {
          jest.advanceTimersByTime(300);
        });
        expect(screen.getByPlaceholderText("Search events...")).toHaveValue("");
        expect(mockUseFunnelEventNamesQuery).toHaveBeenLastCalledWith(
          "app-1",
          "",
        );
        expect(options()).toEqual(EVENTS);
      });

      it("shows no events found when the search matches nothing", () => {
        renderEditor();
        openPicker(0);
        typeSearch("zzz");
        act(() => {
          jest.advanceTimersByTime(300);
        });
        expect(screen.getByText("No events found")).toBeInTheDocument();
      });
    });

    it("shows a loading message while event names load", () => {
      mockEventNames = { data: undefined, isPending: true, isError: false };
      renderEditor();
      openPicker(0);
      expect(screen.getByText("Loading...")).toBeInTheDocument();
      expect(screen.queryAllByRole("option")).toHaveLength(0);
    });

    it("shows an error message when event names fail to load", () => {
      mockEventNames = { data: undefined, isPending: false, isError: true };
      renderEditor();
      openPicker(0);
      expect(screen.getByText("Failed to load events")).toBeInTheDocument();
    });

    it("sets the chosen event on that step only and closes the list", () => {
      renderEditor();
      chooseEvent(1, "purchase");
      expect(stepEvents()).toEqual(["Select event", "purchase"]);
      expect(screen.queryAllByRole("option")).toHaveLength(0);
    });

    it.each([
      ["creating", null],
      ["editing", makeFunnel()],
    ])(
      "shows the form with a docs link in the event list when the app has sent no events, while %s",
      (_, funnel) => {
        mockEventNames = { data: [], isPending: false, isError: false };
        renderEditor({ funnel });
        expect(screen.getByLabelText("Name")).toBeInTheDocument();
        openPicker(0);
        expect(
          screen.getByText(/No custom events were sent in the last 30 days/),
        ).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Learn how" })).toHaveAttribute(
          "href",
          "/docs/custom-events",
        );
      },
    );
  });

  describe("Steps", () => {
    it("adds an empty step at the end", () => {
      renderEditor();
      chooseEvent(0, "view_item");
      chooseEvent(1, "purchase");
      fireEvent.click(screen.getByRole("button", { name: /Add step/ }));
      expect(stepEvents()).toEqual(["view_item", "purchase", "Select event"]);
      expect(within(stepRows()[2]).getByText("3")).toBeInTheDocument();
    });

    it("disables add step at 30 steps", () => {
      renderEditor();
      const addStep = screen.getByRole("button", { name: /Add step/ });
      for (let i = 0; i < 27; i++) {
        fireEvent.click(addStep);
      }
      expect(stepRows()).toHaveLength(29);
      expect(addStep).toBeEnabled();
      fireEvent.click(addStep);
      expect(stepRows()).toHaveLength(30);
      expect(addStep).toBeDisabled();
    });

    it("disables remove at two steps and enables it above two", () => {
      renderEditor();
      for (const row of stepRows()) {
        expect(
          within(row).getByRole("button", { name: "Remove step" }),
        ).toBeDisabled();
      }
      fireEvent.click(screen.getByRole("button", { name: /Add step/ }));
      for (const row of stepRows()) {
        expect(
          within(row).getByRole("button", { name: "Remove step" }),
        ).toBeEnabled();
      }
    });

    it("removes the step whose remove button is clicked", () => {
      renderEditor({ funnel: makeFunnel() });
      fireEvent.click(
        within(stepRows()[1]).getByRole("button", { name: "Remove step" }),
      );
      expect(stepEvents()).toEqual(["view_item", "purchase"]);
    });

    it("disables move up on the first step and move down on the last", () => {
      renderEditor({ funnel: makeFunnel() });
      const disabled = (name: string) =>
        stepRows().map((row) =>
          within(row).getByRole("button", { name }).hasAttribute("disabled"),
        );
      expect(disabled("Move step up")).toEqual([true, false, false]);
      expect(disabled("Move step down")).toEqual([false, false, true]);
    });

    it("moves a step up", () => {
      renderEditor({ funnel: makeFunnel() });
      fireEvent.click(
        within(stepRows()[2]).getByRole("button", { name: "Move step up" }),
      );
      expect(stepEvents()).toEqual(["view_item", "purchase", "add_to_cart"]);
    });

    it("moves a step down", () => {
      renderEditor({ funnel: makeFunnel() });
      fireEvent.click(
        within(stepRows()[0]).getByRole("button", { name: "Move step down" }),
      );
      expect(stepEvents()).toEqual(["add_to_cart", "view_item", "purchase"]);
    });

    it("allows the same event in more than one step", async () => {
      mockMutateAsync.mockResolvedValue(makeFunnel());
      renderEditor();
      setName("Repeat");
      chooseEvent(0, "view_item");
      chooseEvent(1, "view_item");
      expect(stepEvents()).toEqual(["view_item", "view_item"]);
      expect(saveButton()).toBeEnabled();
      await submit();
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: expect.objectContaining({
            steps: [{ event_name: "view_item" }, { event_name: "view_item" }],
          }),
        }),
      );
    });
  });

  describe("Validation", () => {
    it("asks for a name first", () => {
      renderEditor();
      expect(screen.getByText("Give the funnel a name")).toBeInTheDocument();
      expect(saveButton()).toBeDisabled();
    });

    it("treats a whitespace-only name as missing", () => {
      renderEditor();
      chooseEvent(0, "view_item");
      chooseEvent(1, "purchase");
      setName("   ");
      expect(screen.getByText("Give the funnel a name")).toBeInTheDocument();
      expect(saveButton()).toBeDisabled();
    });

    it("asks for an event on every step once named", () => {
      renderEditor();
      setName("Checkout");
      expect(
        screen.getByText("Select an event for each step"),
      ).toBeInTheDocument();
      chooseEvent(0, "view_item");
      expect(
        screen.getByText("Select an event for each step"),
      ).toBeInTheDocument();
      expect(saveButton()).toBeDisabled();
    });

    it("enables save and shows no message for a valid draft", () => {
      renderEditor();
      fillValidDraft();
      expect(saveButton()).toBeEnabled();
      expect(screen.queryByText(/Give the funnel a name/)).toBeNull();
      expect(screen.queryByText(/Select an event/)).toBeNull();
      expect(screen.queryByText(/conversion window must/)).toBeNull();
    });

    it("does not call save when the form is submitted with a problem", async () => {
      renderEditor();
      setName("Checkout");
      await submit();
      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it("does not call save when an unchanged funnel is submitted", async () => {
      renderEditor({ funnel: makeFunnel() });
      await submit();
      expect(mockMutateAsync).not.toHaveBeenCalled();
    });
  });

  describe("Conversion window", () => {
    const windowProblem =
      "The conversion window must be between 1 minute and 30 days";

    it("keeps an emptied amount field empty and reports the problem", () => {
      renderEditor();
      fillValidDraft();
      setAmount("");
      expect(screen.getByLabelText("Conversion window")).toHaveValue(null);
      expect(screen.getByText(windowProblem)).toBeInTheDocument();
      expect(saveButton()).toBeDisabled();
    });

    it.each(["0", "-1", "0.5"])(
      "reports a problem for an amount of %s minutes",
      (amount) => {
        renderEditor();
        fillValidDraft();
        setUnit("minutes");
        setAmount(amount);
        expect(screen.getByText(windowProblem)).toBeInTheDocument();
        expect(saveButton()).toBeDisabled();
      },
    );

    it.each([
      ["1.5", "minutes"],
      ["1.01", "hours"],
    ])(
      "reports a problem for %s %s, which is not a whole number of minutes",
      (amount, unit) => {
        renderEditor();
        fillValidDraft();
        setUnit(unit);
        setAmount(amount);
        expect(
          screen.getByText(
            "The conversion window must be a whole number of minutes",
          ),
        ).toBeInTheDocument();
        expect(saveButton()).toBeDisabled();
      },
    );

    it("reports a problem above 30 days", () => {
      renderEditor();
      fillValidDraft();
      setAmount("31");
      expect(screen.getByText(windowProblem)).toBeInTheDocument();
      expect(saveButton()).toBeDisabled();
    });

    it("accepts 30 days", () => {
      renderEditor();
      fillValidDraft();
      setAmount("30");
      expect(screen.queryByText(windowProblem)).toBeNull();
      expect(saveButton()).toBeEnabled();
    });

    it("accepts 1 minute", () => {
      renderEditor();
      fillValidDraft();
      setUnit("minutes");
      setAmount("1");
      expect(screen.queryByText(windowProblem)).toBeNull();
      expect(saveButton()).toBeEnabled();
    });

    it("reports a problem when switching to a larger unit pushes the window past 30 days", () => {
      renderEditor();
      fillValidDraft();
      setUnit("hours");
      setAmount("31");
      expect(screen.queryByText(windowProblem)).toBeNull();
      setUnit("days");
      expect(screen.getByText(windowProblem)).toBeInTheDocument();
    });
  });

  describe("Saving", () => {
    it("sends a new funnel with a trimmed name and the default window", async () => {
      mockMutateAsync.mockResolvedValue(makeFunnel());
      renderEditor();
      setName("  Checkout  ");
      chooseEvent(0, "view_item");
      chooseEvent(1, "purchase");
      await submit();
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
      expect(mockMutateAsync).toHaveBeenCalledWith({
        appId: "app-1",
        funnelId: null,
        draft: {
          name: "Checkout",
          steps: [{ event_name: "view_item" }, { event_name: "purchase" }],
          conversion_window_seconds: 86_400,
        },
      });
    });

    it.each([
      ["45", "minutes", 2_700],
      ["3", "hours", 10_800],
      ["1.5", "hours", 5_400],
      ["7", "days", 604_800],
    ])("sends %s %s as %i seconds", async (amount, unit, expectedSeconds) => {
      mockMutateAsync.mockResolvedValue(makeFunnel());
      renderEditor();
      fillValidDraft();
      setUnit(unit);
      setAmount(amount);
      await submit();
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: expect.objectContaining({
            conversion_window_seconds: expectedSeconds,
          }),
        }),
      );
    });

    it("keeps the amount when the unit changes", async () => {
      mockMutateAsync.mockResolvedValue(makeFunnel());
      renderEditor();
      fillValidDraft();
      setAmount("2");
      setUnit("hours");
      await submit();
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: expect.objectContaining({ conversion_window_seconds: 7_200 }),
        }),
      );
    });

    it("sends an edited funnel with its id and the edited draft", async () => {
      mockMutateAsync.mockResolvedValue(makeFunnel());
      renderEditor({ funnel: makeFunnel() });
      setName("Checkout v2 ");
      fireEvent.click(
        within(stepRows()[2]).getByRole("button", { name: "Move step up" }),
      );
      fireEvent.click(screen.getByRole("button", { name: /Add step/ }));
      chooseEvent(3, "checkout_started");
      setAmount("4");
      await submit();
      expect(mockMutateAsync).toHaveBeenCalledWith({
        appId: "app-1",
        funnelId: "funnel-1",
        draft: {
          name: "Checkout v2",
          steps: [
            { event_name: "view_item" },
            { event_name: "purchase" },
            { event_name: "add_to_cart" },
            { event_name: "checkout_started" },
          ],
          conversion_window_seconds: 14_400,
        },
      });
    });

    it("keeps the saved window of an edited funnel when only the name changes", async () => {
      mockMutateAsync.mockResolvedValue(makeFunnel());
      renderEditor({
        funnel: makeFunnel({ conversion_window_seconds: 5_400 }),
      });
      setName("Renamed");
      await submit();
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: expect.objectContaining({ conversion_window_seconds: 5_400 }),
        }),
      );
    });

    it("disables save while the save is pending", () => {
      mockSaveIsPending = true;
      renderEditor();
      fillValidDraft();
      expect(saveButton()).toBeDisabled();
    });

    it("toasts the saved funnel's name, closes the dialog and reports the saved funnel on success", async () => {
      const saved = makeFunnel({ id: "funnel-9", name: "Server name" });
      mockMutateAsync.mockResolvedValue(saved);
      const { props } = renderEditor();
      fillValidDraft();
      await submit();
      expect(mockToastPositive).toHaveBeenCalledWith(
        "Funnel Server name has been saved",
      );
      expect(props.onOpenChange).toHaveBeenCalledWith(false);
      expect(props.onSaved).toHaveBeenCalledWith(saved);
      expect(mockToastNegative).not.toHaveBeenCalled();
    });

    it("succeeds without an onSaved callback", async () => {
      mockMutateAsync.mockResolvedValue(makeFunnel());
      const { props } = renderEditor({ onSaved: undefined });
      fillValidDraft();
      await submit();
      expect(mockToastPositive).toHaveBeenCalled();
      expect(props.onOpenChange).toHaveBeenCalledWith(false);
    });

    it("toasts the error and stays open on failure", async () => {
      mockMutateAsync.mockRejectedValue(new Error("Name already taken"));
      const { props } = renderEditor();
      fillValidDraft();
      await submit();
      expect(mockToastNegative).toHaveBeenCalledWith(
        "Error saving funnel: Name already taken",
      );
      expect(props.onOpenChange).not.toHaveBeenCalled();
      expect(props.onSaved).not.toHaveBeenCalled();
      expect(mockToastPositive).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Name")).toHaveValue("Checkout");
    });

    it("toasts an unknown error when the failure is not an Error", async () => {
      mockMutateAsync.mockRejectedValue("boom");
      renderEditor();
      fillValidDraft();
      await submit();
      expect(mockToastNegative).toHaveBeenCalledWith(
        "Error saving funnel: Unknown error",
      );
    });
  });

  describe("Closing", () => {
    it("closes on cancel without saving", () => {
      const { props } = renderEditor();
      fillValidDraft();
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(props.onOpenChange).toHaveBeenCalledWith(false);
      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it("closes from the dialog close button", () => {
      const { props } = renderEditor();
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(props.onOpenChange).toHaveBeenCalledWith(false);
    });

    it("drops unsaved edits of a funnel when reopened", () => {
      const funnel = makeFunnel();
      const { rerender, props } = renderEditor({ funnel });
      setName("Changed");
      chooseEvent(0, "purchase");
      fireEvent.click(screen.getByRole("button", { name: /Add step/ }));
      setUnit("days");
      setAmount("5");
      rerender(<FunnelEditor {...props} open={false} />);
      rerender(<FunnelEditor {...props} open={true} />);
      expect(screen.getByLabelText("Name")).toHaveValue("Checkout");
      expect(stepEvents()).toEqual(["view_item", "add_to_cart", "purchase"]);
      expect(screen.getByLabelText("Conversion window")).toHaveValue(2);
      expect(unitText()).toBe("hours");
    });

    it("starts a new funnel from scratch when reopened", () => {
      const { rerender, props } = renderEditor();
      fillValidDraft();
      setAmount("3");
      rerender(<FunnelEditor {...props} open={false} />);
      rerender(<FunnelEditor {...props} open={true} />);
      expect(screen.getByLabelText("Name")).toHaveValue("");
      expect(stepEvents()).toEqual(["Select event", "Select event"]);
      expect(screen.getByLabelText("Conversion window")).toHaveValue(1);
      expect(unitText()).toBe("days");
    });
  });
});
