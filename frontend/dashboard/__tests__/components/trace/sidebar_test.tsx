import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import TraceSidebar from "@/app/components/trace/sidebar";
import { ERROR_PALETTE, PreparedSpan } from "@/app/components/trace/model";

function makePreparedSpan(overrides: Partial<PreparedSpan> = {}): PreparedSpan {
  return {
    span_name: "checkout_flow",
    span_id: "span-1",
    parent_id: "",
    status: 0,
    start_time: "2024-01-01T00:00:00.000Z",
    end_time: "2024-01-01T00:00:01.000Z",
    duration: 1000,
    thread_name: "main",
    checkpoints: null,
    depth: 0,
    ancestorIds: [],
    ancestorColors: [],
    directChildCount: 0,
    subtreeSize: 0,
    colorKey: "span-1",
    startMs: 0,
    endMs: 1000,
    ...overrides,
  };
}

describe("TraceSidebar", () => {
  it("renders nothing when span is undefined", () => {
    const { container } = render(
      <TraceSidebar
        span={undefined}
        showErrorAsRed={false}
        onClose={jest.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders core span fields", () => {
    render(
      <TraceSidebar
        span={makePreparedSpan()}
        showErrorAsRed={false}
        onClose={jest.fn()}
      />,
    );
    for (const key of [
      "Span Name",
      "Span Id",
      "Parent Id",
      "Thread Name",
      "Span Status",
      "Start Time",
      "End Time",
      "Duration",
    ]) {
      expect(screen.getByText(key)).toBeTruthy();
    }
  });

  it('renders parent_id as "--" when empty', () => {
    render(
      <TraceSidebar
        span={makePreparedSpan({ parent_id: "" })}
        showErrorAsRed={false}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText("--")).toBeTruthy();
  });

  it("renders actual parent_id for child spans", () => {
    render(
      <TraceSidebar
        span={makePreparedSpan({ parent_id: "span-root" })}
        showErrorAsRed={false}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText("span-root")).toBeTruthy();
  });

  it("renders user_defined_attributes as extra fields", () => {
    render(
      <TraceSidebar
        span={makePreparedSpan({
          user_defined_attributes: { endpoint: "/api/payments", retries: 3 },
        })}
        showErrorAsRed={false}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText("endpoint")).toBeTruthy();
    expect(screen.getByText("/api/payments")).toBeTruthy();
    expect(screen.getByText("retries")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it.each([
    [0, "Unset"],
    [1, "Okay"],
    [2, "Error"],
  ])("renders %s for status=%i", (status, label) => {
    render(
      <TraceSidebar
        span={makePreparedSpan({ status: status as number })}
        showErrorAsRed={false}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText(label as string)).toBeTruthy();
  });

  it("applies emerald class for status=1, red for status=2, none for status=0", () => {
    const renderStatus = (status: 0 | 1 | 2) =>
      render(
        <TraceSidebar
          span={makePreparedSpan({ status })}
          showErrorAsRed={false}
          onClose={jest.fn()}
        />,
      );
    const { container: c1, unmount: u1 } = renderStatus(1);
    expect(c1.querySelector(".text-emerald-600")).toBeTruthy();
    u1();
    const { container: c2, unmount: u2 } = renderStatus(2);
    expect(c2.querySelector(".text-red-600")).toBeTruthy();
    u2();
    const { container: c0 } = renderStatus(0);
    expect(c0.querySelector(".text-emerald-600")).toBeNull();
    expect(c0.querySelector(".text-red-600")).toBeNull();
  });

  it("calls onClose when the X button is clicked", () => {
    const onClose = jest.fn();
    render(
      <TraceSidebar
        span={makePreparedSpan()}
        showErrorAsRed={false}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("uses the error palette dot when showErrorAsRed && status=2", () => {
    const { container } = render(
      <TraceSidebar
        span={makePreparedSpan({ status: 2 })}
        showErrorAsRed={true}
        onClose={jest.fn()}
      />,
    );
    expect(container.querySelector(`.${ERROR_PALETTE.bg}`)).toBeTruthy();
  });

  it("uses the normal palette dot when status=2 but showErrorAsRed=false", () => {
    const { container } = render(
      <TraceSidebar
        span={makePreparedSpan({ status: 2 })}
        showErrorAsRed={false}
        onClose={jest.fn()}
      />,
    );
    expect(container.querySelector(`.${ERROR_PALETTE.bg}`)).toBeNull();
  });
});

describe("TraceSidebar — attribute filter", () => {
  function renderWithAttrs() {
    return render(
      <TraceSidebar
        span={makePreparedSpan({
          user_defined_attributes: {
            endpoint: "/api/payments",
            retries: 3,
          },
        })}
        showErrorAsRed={false}
        onClose={jest.fn()}
      />,
    );
  }

  it("filters attributes by key or value substring", () => {
    renderWithAttrs();
    fireEvent.change(screen.getByPlaceholderText("Search attributes..."), {
      target: { value: "endpoint" },
    });
    expect(screen.getByText("endpoint")).toBeTruthy();
    expect(screen.queryByText("retries")).toBeNull();
  });

  it("shows the empty-state message when nothing matches", () => {
    renderWithAttrs();
    fireEvent.change(screen.getByPlaceholderText("Search attributes..."), {
      target: { value: "zzz-no-match" },
    });
    expect(screen.getByText("No attributes match the filter.")).toBeTruthy();
  });
});

describe("TraceSidebar — checkpoints tab", () => {
  function gotoCheckpoints() {
    fireEvent.click(screen.getByRole("button", { name: "Checkpoints" }));
  }

  it('shows ": []" and the "no checkpoints" message when span has none', () => {
    render(
      <TraceSidebar
        span={makePreparedSpan({ checkpoints: null })}
        showErrorAsRed={false}
        onClose={jest.fn()}
      />,
    );
    gotoCheckpoints();
    expect(screen.getByText(": []")).toBeTruthy();
    expect(screen.getByText("This span has no checkpoints.")).toBeTruthy();
  });

  it('shows ": N" with the count when checkpoints exist', () => {
    render(
      <TraceSidebar
        span={makePreparedSpan({
          checkpoints: [
            {
              name: "request_sent",
              timestamp: "2024-01-01T00:00:00.100Z",
              startMs: 100,
            },
            {
              name: "response_received",
              timestamp: "2024-01-01T00:00:00.500Z",
              startMs: 500,
            },
          ],
        })}
        showErrorAsRed={false}
        onClose={jest.fn()}
      />,
    );
    gotoCheckpoints();
    expect(screen.getByText(": 2")).toBeTruthy();
    expect(screen.getByText("request_sent")).toBeTruthy();
    expect(screen.getByText("response_received")).toBeTruthy();
  });

  it("filters checkpoints by name", () => {
    render(
      <TraceSidebar
        span={makePreparedSpan({
          checkpoints: [
            {
              name: "request_sent",
              timestamp: "2024-01-01T00:00:00.100Z",
              startMs: 100,
            },
            {
              name: "response_received",
              timestamp: "2024-01-01T00:00:00.500Z",
              startMs: 500,
            },
          ],
        })}
        showErrorAsRed={false}
        onClose={jest.fn()}
      />,
    );
    gotoCheckpoints();
    fireEvent.change(screen.getByPlaceholderText("Search checkpoints..."), {
      target: { value: "response" },
    });
    expect(screen.queryByText("request_sent")).toBeNull();
    expect(screen.getByText("response_received")).toBeTruthy();
  });

  it('shows "no checkpoints match" when filter clears the list', () => {
    render(
      <TraceSidebar
        span={makePreparedSpan({
          checkpoints: [
            {
              name: "request_sent",
              timestamp: "2024-01-01T00:00:00.100Z",
              startMs: 100,
            },
          ],
        })}
        showErrorAsRed={false}
        onClose={jest.fn()}
      />,
    );
    gotoCheckpoints();
    fireEvent.change(screen.getByPlaceholderText("Search checkpoints..."), {
      target: { value: "zzz" },
    });
    expect(screen.getByText("No checkpoints match the filter.")).toBeTruthy();
  });

  it("attributes search placeholder is back when switching tabs", () => {
    render(
      <TraceSidebar
        span={makePreparedSpan()}
        showErrorAsRed={false}
        onClose={jest.fn()}
      />,
    );
    // Default: attributes tab
    expect(screen.getByPlaceholderText("Search attributes...")).toBeTruthy();
    gotoCheckpoints();
    expect(screen.getByPlaceholderText("Search checkpoints...")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Attributes" }));
    expect(screen.getByPlaceholderText("Search attributes...")).toBeTruthy();
  });
});
