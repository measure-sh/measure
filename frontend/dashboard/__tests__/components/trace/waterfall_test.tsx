import TraceWaterfall from "@/app/components/trace/waterfall";
import { Span, Trace } from "@/app/components/trace/model";
import { describe, expect, it } from "@jest/globals";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

function makeSpan(overrides: Partial<Span> = {}): Span {
  return {
    span_name: "checkout_full_display",
    span_id: "span-root",
    parent_id: "",
    status: 0,
    start_time: "2026-04-10T14:30:00Z",
    end_time: "2026-04-10T14:30:01.187Z",
    duration: 1187,
    thread_name: "main",
    user_defined_attributes: null,
    checkpoints: null,
    ...overrides,
  };
}

// Two spans: a root with one child. The child carries an attribute and two
// checkpoints so sidebar content and checkpoint ticks can be asserted.
function makeTrace(overrides: Partial<Trace> = {}): Trace {
  return {
    app_id: "app-1",
    trace_id: "trace-001",
    session_id: "sess-trace-001",
    user_id: "user-trace-123",
    start_time: "2026-04-10T14:30:00Z",
    end_time: "2026-04-10T14:30:01.187Z",
    duration: 1187,
    app_version: "3.1.0 (310)",
    os_version: "android 14",
    device_model: "Pixel 8",
    device_manufacturer: "Google",
    network_type: "wifi",
    spans: [
      makeSpan(),
      makeSpan({
        span_name: "api_fetch_payments",
        span_id: "span-child-1",
        parent_id: "span-root",
        status: 1,
        start_time: "2026-04-10T14:30:00.100Z",
        end_time: "2026-04-10T14:30:00.850Z",
        duration: 750,
        thread_name: "okhttp",
        user_defined_attributes: { endpoint: "/api/payments" },
        checkpoints: [
          { name: "request_sent", timestamp: "2026-04-10T14:30:00.120Z" },
          { name: "response_received", timestamp: "2026-04-10T14:30:00.840Z" },
        ],
      }),
    ],
    ...overrides,
  };
}

// Root, middle and leaf chained by parent_id, so collapsing the middle span
// hides the leaf and navigation to the leaf must re-expand the middle.
function makeThreeLevelTrace(): Trace {
  return makeTrace({
    spans: [
      makeSpan({ span_id: "root", span_name: "root_span" }),
      makeSpan({
        span_id: "mid",
        span_name: "middle_span",
        parent_id: "root",
        status: 1,
        start_time: "2026-04-10T14:30:00.100Z",
        end_time: "2026-04-10T14:30:00.850Z",
        duration: 750,
        thread_name: "okhttp",
      }),
      makeSpan({
        span_id: "leaf",
        span_name: "leaf_span",
        parent_id: "mid",
        status: 1,
        start_time: "2026-04-10T14:30:00.200Z",
        end_time: "2026-04-10T14:30:00.700Z",
        duration: 500,
        thread_name: "okhttp",
      }),
    ],
  });
}

function makeTraceWithError(): Trace {
  const trace = makeTrace();
  trace.spans[1].status = 2;
  return trace;
}

function getSpanRows() {
  return Array.from(
    document.querySelectorAll('[data-testid^="span-bar-row-"]'),
  );
}

describe("TraceWaterfall — rendering", () => {
  it("renders span names from the trace", () => {
    render(<TraceWaterfall inputTrace={makeTrace()} />);
    expect(
      screen.getAllByText("checkout_full_display").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("api_fetch_payments").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders formatted duration labels on span bars", () => {
    render(<TraceWaterfall inputTrace={makeTrace()} />);
    expect(screen.getAllByText("1.187s").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("750ms").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the direct child count in the collapse badge", () => {
    render(<TraceWaterfall inputTrace={makeTrace()} />);
    const badge = screen.getByRole("button", {
      name: "Collapse checkout_full_display",
    });
    expect(badge.textContent).toBe("1");
  });
});

describe("TraceWaterfall — row selection and sidebar", () => {
  it("hides the sidebar until a span is selected", () => {
    render(<TraceWaterfall inputTrace={makeTrace()} />);
    expect(getSpanRows().length).toBe(2);
    expect(screen.queryByText("Span Name")).toBeNull();
  });

  it("clicking a row opens the sidebar with that span selected", async () => {
    render(<TraceWaterfall inputTrace={makeTrace()} />);
    await act(async () => {
      fireEvent.click(getSpanRows()[0]);
    });
    await waitFor(() => {
      expect(screen.getByText("Span Name")).toBeTruthy();
      // The root has no parent, which the sidebar renders as "--".
      expect(screen.getByText("--")).toBeTruthy();
    });
  });

  it("clicking a different row updates the sidebar in place", async () => {
    render(<TraceWaterfall inputTrace={makeTrace()} />);
    await act(async () => {
      fireEvent.click(getSpanRows()[0]);
    });
    await waitFor(() => expect(screen.getByText("--")).toBeTruthy());

    await act(async () => {
      fireEvent.click(getSpanRows()[1]);
    });
    await waitFor(() => {
      expect(screen.getByText("endpoint")).toBeTruthy();
      expect(screen.queryByText("--")).toBeNull();
    });
  });

  it("close button clears the selection and hides the sidebar", async () => {
    render(<TraceWaterfall inputTrace={makeTrace()} />);
    await act(async () => {
      fireEvent.click(getSpanRows()[0]);
    });
    await waitFor(() => expect(screen.getByText("Span Name")).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Close"));
    });
    await waitFor(() => {
      expect(screen.queryByText("Span Name")).toBeNull();
    });
    // With no selection, no row is dimmed.
    expect(getSpanRows()[1].className).not.toContain("opacity-50");
  });
});

describe("TraceWaterfall — checkpoint ticks", () => {
  function getCheckpointTicks() {
    return Array.from(
      document.querySelectorAll('[data-testid^="span-checkpoint-"]'),
    );
  }

  it("renders one tick per checkpoint on the span bar", () => {
    render(<TraceWaterfall inputTrace={makeTrace()} />);
    expect(getCheckpointTicks().length).toBe(2);
  });

  it("clicking a checkpoint opens the sidebar with its parent span", async () => {
    render(<TraceWaterfall inputTrace={makeTrace()} />);
    expect(screen.queryByText("Span Name")).toBeNull();

    // The tick has no click handler of its own; the click bubbles to the
    // row cell, so the span owning the checkpoint becomes the selection.
    await act(async () => {
      fireEvent.click(getCheckpointTicks()[0]);
    });
    await waitFor(() => {
      expect(screen.getByText("Span Name")).toBeTruthy();
      expect(screen.getAllByText(/span-root/).length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe("TraceWaterfall — expand/collapse", () => {
  function getCountBadge(name: string) {
    return (
      screen.queryByRole("button", { name: `Expand ${name}` }) ??
      screen.queryByRole("button", { name: `Collapse ${name}` })
    );
  }

  it("shows all spans expanded initially", () => {
    render(<TraceWaterfall inputTrace={makeTrace()} />);
    expect(getSpanRows().length).toBe(2);
  });

  it("clicking the count badge collapses the subtree", async () => {
    render(<TraceWaterfall inputTrace={makeTrace()} />);
    await act(async () => {
      fireEvent.click(getCountBadge("checkout_full_display")!);
    });
    await waitFor(() => {
      expect(getSpanRows().length).toBe(1);
    });
  });

  it("clicking the count badge again re-expands the subtree", async () => {
    render(<TraceWaterfall inputTrace={makeTrace()} />);
    await act(async () => {
      fireEvent.click(getCountBadge("checkout_full_display")!);
    });
    await waitFor(() => expect(getSpanRows().length).toBe(1));

    await act(async () => {
      fireEvent.click(getCountBadge("checkout_full_display")!);
    });
    await waitFor(() => expect(getSpanRows().length).toBe(2));
  });

  it("uses the Collapse aria-label while expanded", () => {
    render(<TraceWaterfall inputTrace={makeTrace()} />);
    expect(
      screen.queryByRole("button", { name: "Collapse checkout_full_display" }),
    ).toBeTruthy();
  });

  it("switches to the Expand aria-label after collapsing", async () => {
    render(<TraceWaterfall inputTrace={makeTrace()} />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Collapse checkout_full_display" }),
      );
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Expand checkout_full_display" }),
      ).toBeTruthy();
      expect(
        screen.queryByRole("button", {
          name: "Collapse checkout_full_display",
        }),
      ).toBeNull();
    });
  });
});

describe("TraceWaterfall — search navigation", () => {
  it("Next match selects the matched span and opens the sidebar", async () => {
    render(<TraceWaterfall inputTrace={makeTrace()} />);
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/Search spans/), {
        target: { value: "fetch" },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Next match"));
    });
    await waitFor(() => {
      expect(screen.getByText("Span Name")).toBeTruthy();
      // The matched child span's attribute key shows in the sidebar.
      expect(screen.getByText("endpoint")).toBeTruthy();
    });
  });

  it("re-expands collapsed ancestors when Next match selects an inner span", async () => {
    render(<TraceWaterfall inputTrace={makeThreeLevelTrace()} />);
    expect(getSpanRows().length).toBe(3);

    // Collapsing the middle span hides the leaf row.
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Collapse middle_span" }),
      );
    });
    await waitFor(() => expect(getSpanRows().length).toBe(2));

    // Searching for the leaf and stepping to it re-expands the middle span
    // so the selected row is visible again.
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/Search spans/), {
        target: { value: "leaf" },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Next match"));
    });
    await waitFor(() => {
      expect(getSpanRows().length).toBe(3);
      expect(
        document.querySelector('[data-testid="span-bar-row-leaf"]'),
      ).toBeTruthy();
    });
  });
});

describe("TraceWaterfall — show errors flow", () => {
  it("toggle reveals the error banner with the count", async () => {
    render(<TraceWaterfall inputTrace={makeTraceWithError()} />);
    expect(screen.queryByTestId("trace-error-banner")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Show errors"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("trace-error-banner")).toBeTruthy();
      expect(screen.getByText("1 error span")).toBeTruthy();
    });
  });

  it("Next error selects and opens the error span in the sidebar", async () => {
    render(<TraceWaterfall inputTrace={makeTraceWithError()} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Show errors"));
    });
    await waitFor(() =>
      expect(screen.getByTestId("trace-error-banner")).toBeTruthy(),
    );
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Next error"));
    });
    await waitFor(() => {
      expect(screen.getByText("Span Name")).toBeTruthy();
      expect(screen.getByText("endpoint")).toBeTruthy();
    });
  });

  it("toggle off hides the banner and clears dimming", async () => {
    render(<TraceWaterfall inputTrace={makeTraceWithError()} />);
    const sw = screen.getByLabelText("Show errors");
    await act(async () => {
      fireEvent.click(sw);
    });
    await waitFor(() =>
      expect(screen.getByTestId("trace-error-banner")).toBeTruthy(),
    );
    await act(async () => {
      fireEvent.click(sw);
    });
    await waitFor(() => {
      expect(screen.queryByTestId("trace-error-banner")).toBeNull();
      const root = document.querySelector(
        '[data-testid="span-bar-row-span-root"]',
      );
      expect(root?.className).not.toContain("opacity-30");
      expect(root?.className).not.toContain("opacity-50");
    });
  });
});

describe("TraceWaterfall — column layout", () => {
  it("starts at the default span and thread column fractions", () => {
    render(<TraceWaterfall inputTrace={makeTrace()} />);
    const waterfall = screen.getByTestId("trace-waterfall");
    // Defaults: span takes 30%, thread takes the left block's remainder,
    // 45% - 30% = 15%.
    expect(waterfall.style.getPropertyValue("--span-col-width")).toBe("30%");
    expect(waterfall.style.getPropertyValue("--thread-col-width")).toBe("15%");
  });

  it("renders both resizer handles in the header", () => {
    render(<TraceWaterfall inputTrace={makeTrace()} />);
    expect(screen.getByTestId("trace-column-resizer-span")).toBeTruthy();
    expect(screen.getByTestId("trace-column-resizer")).toBeTruthy();
  });
});

describe("TraceWaterfall — span row keyboard navigation", () => {
  it("Enter on a span row opens the sidebar with that span", async () => {
    render(<TraceWaterfall inputTrace={makeTrace()} />);
    await act(async () => {
      fireEvent.keyDown(getSpanRows()[1], { key: "Enter" });
    });
    await waitFor(() => {
      expect(screen.getByText("Span Name")).toBeTruthy();
      expect(screen.getByText("endpoint")).toBeTruthy();
    });
  });

  it("Space on a span row opens the sidebar with that span", async () => {
    render(<TraceWaterfall inputTrace={makeTrace()} />);
    await act(async () => {
      fireEvent.keyDown(getSpanRows()[0], { key: " " });
    });
    await waitFor(() => {
      expect(screen.getByText("Span Name")).toBeTruthy();
      expect(screen.getByText("--")).toBeTruthy();
    });
  });

  it("other keys do not open the sidebar", async () => {
    render(<TraceWaterfall inputTrace={makeTrace()} />);
    await act(async () => {
      fireEvent.keyDown(getSpanRows()[0], { key: "a" });
    });
    expect(screen.queryByText("Span Name")).toBeNull();
  });
});

describe("TraceWaterfall — hover sync across columns", () => {
  it("hovering one row applies the hover background to all five cells of that row", async () => {
    render(<TraceWaterfall inputTrace={makeTrace()} />);
    const countHoveredCells = () =>
      document.querySelectorAll(".bg-muted\\/50").length;
    expect(countHoveredCells()).toBe(0);

    await act(async () => {
      fireEvent.mouseEnter(getSpanRows()[0]);
    });
    // Span, spacer, thread, spacer and timeline cells all highlight for the
    // hovered row.
    expect(countHoveredCells()).toBe(5);

    await act(async () => {
      fireEvent.mouseLeave(getSpanRows()[0]);
    });
    expect(countHoveredCells()).toBe(0);
  });
});
