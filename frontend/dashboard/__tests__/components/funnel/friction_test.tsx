import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, useState } from "react";

jest.mock("next/navigation", () =>
  require("@/__tests__/helpers/mock_router").nextNavigationMock(),
);

const mockUseFunnelStepErrorsQuery = jest.fn();
const mockUseFunnelStepTracesQuery = jest.fn();
const mockUseFunnelStepNetworkQuery = jest.fn();
jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  FUNNEL_STEP_LIST_LIMIT: 5,
  RootSpanMetricsQuantile: { p50: "p50", p90: "p90", p95: "p95", p99: "p99" },
  useFunnelStepErrorsQuery: (...args: unknown[]) =>
    mockUseFunnelStepErrorsQuery(...args),
  useFunnelStepTracesQuery: (...args: unknown[]) =>
    mockUseFunnelStepTracesQuery(...args),
  useFunnelStepNetworkQuery: (...args: unknown[]) =>
    mockUseFunnelStepNetworkQuery(...args),
}));

// Renders the content only while open, like the Radix popover.
jest.mock("@/app/components/popover", () => {
  const { createContext, useContext } =
    jest.requireActual<typeof import("react")>("react");
  const PopoverContext = createContext({
    open: false,
    onOpenChange: (_open: boolean) => {},
  });
  return {
    Popover: ({
      open,
      onOpenChange,
      children,
    }: {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      children: ReactNode;
    }) => (
      <PopoverContext.Provider value={{ open, onOpenChange }}>
        {children}
      </PopoverContext.Provider>
    ),
    PopoverTrigger: ({ children }: { children: ReactNode }) => {
      const { open, onOpenChange } = useContext(PopoverContext);
      return (
        <div data-testid="step-trigger" onClick={() => onOpenChange(!open)}>
          {children}
        </div>
      );
    },
    PopoverContent: ({ children }: { children: ReactNode }) => {
      const { open } = useContext(PopoverContext);
      return open ? <div>{children}</div> : null;
    },
  };
});

jest.mock("@/app/components/command", () => ({
  Command: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  CommandItem: ({
    children,
    onSelect,
  }: {
    children: ReactNode;
    onSelect: () => void;
  }) => (
    <div data-testid="step-option" onClick={() => onSelect()}>
      {children}
    </div>
  ),
}));

jest.mock("@/app/components/skeleton", () => ({
  __esModule: true,
  Skeleton: () => <div data-testid="skeleton" />,
  SkeletonTable: () => <div data-testid="skeleton-table" />,
}));

import FunnelFriction, { FrictionList } from "@/app/components/funnel/friction";

const params = {
  appId: "app-1",
  startDate: "2026-01-01T00:00:00Z",
  endDate: "2026-01-31T00:00:00Z",
  filterExpr: null as string | null,
};

const conversion = {
  steps: [
    {
      event_name: "view_cart",
      users: 1000,
      median_seconds_from_previous: null,
    },
    {
      event_name: "start_checkout",
      users: 400,
      median_seconds_from_previous: 30,
    },
    { event_name: "purchase", users: 300, median_seconds_from_previous: 90 },
  ],
};

const listQuery = (
  results: unknown[],
  { next = false, previous = false, isFetching = false } = {},
) => ({
  status: "success",
  data: { meta: { next, previous }, results },
  isFetching,
});

const stepError = {
  id: "group-1",
  type: "java.lang.IllegalStateException",
  error_type: "exception",
  severity: "fatal",
  message: "cart is empty",
  method_name: "checkout",
  file_name: "Cart.kt",
  count: 12,
  users: 9,
  converted: 100,
  dropped: 300,
};

const stepTrace = {
  span_name: "checkout.load",
  count: 40,
  converted: 200,
  dropped: 150,
  converted_duration_ms: 500,
  dropped_duration_ms: 800,
};

const stepEndpoint = {
  domain: "api.example.com",
  path_pattern: "/v1/cart",
  count: 70,
  converted: 40,
  dropped: 60,
  converted_latency_ms: 120,
  dropped_latency_ms: 130,
};

const onSelectStep = jest.fn();
const onSelectList = jest.fn();
const onOpenItem = jest.fn();

// Keeps the selected step and list in state, like the page that renders
// FunnelFriction.
function Harness({
  initialStep = 1 as number | null,
  initialList = FrictionList.Errors,
  sectionParams = params as typeof params | null,
  conversionLoaded = true,
  conversionFailed = false,
}) {
  const [step, setStep] = useState(initialStep);
  const [list, setList] = useState(initialList);
  return (
    <FunnelFriction
      teamId="team-1"
      funnelId="funnel-1"
      params={sectionParams}
      conversion={conversionLoaded ? conversion : undefined}
      conversionFailed={conversionFailed}
      selectedStep={step}
      onSelectStep={(next) => {
        onSelectStep(next);
        setStep(next);
      }}
      list={list}
      onSelectList={(next) => {
        onSelectList(next);
        setList(next);
      }}
      onOpenItem={onOpenItem}
    />
  );
}

const lastArgs = (mock: jest.Mock) => mock.mock.calls.at(-1)!;

const button = (name: string) => screen.getByRole("button", { name });

const openStepOptions = () => {
  fireEvent.click(screen.getByTestId("step-trigger"));
  return screen.getAllByTestId("step-option");
};

beforeEach(() => {
  mockUseFunnelStepErrorsQuery.mockReturnValue(listQuery([stepError]));
  mockUseFunnelStepTracesQuery.mockReturnValue(listQuery([stepTrace]));
  mockUseFunnelStepNetworkQuery.mockReturnValue(listQuery([stepEndpoint]));
});

describe("FunnelFriction placeholders", () => {
  it.each([
    ["filters", { sectionParams: null }],
    ["conversion", { conversionLoaded: false }],
  ])("shows the section with a skeleton until the %s are ready", (_, props) => {
    const { container } = render(<Harness {...props} />);

    const section = container.firstElementChild;
    expect(section).toHaveTextContent("Friction");
    expect(section).toContainElement(screen.getByTestId("skeleton"));
    expect(section).toContainElement(screen.getByTestId("skeleton-table"));
    expect(screen.queryByTestId("step-trigger")).not.toBeInTheDocument();
    expect(mockUseFunnelStepErrorsQuery).not.toHaveBeenCalled();
  });

  it("shows an error when the conversion failed", () => {
    render(<Harness conversionFailed />);

    expect(
      screen.getByText(
        "Error fetching friction, please change filters or refresh page to try again",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
    expect(mockUseFunnelStepErrorsQuery).not.toHaveBeenCalled();
  });
});

describe("FunnelFriction step selector", () => {
  it("shows the selected transition on the trigger", () => {
    render(<Harness initialStep={2} />);

    expect(screen.getByTestId("step-trigger")).toHaveTextContent(
      "start_checkout→purchase",
    );
  });

  it("shows Overall on the trigger for the whole funnel", () => {
    render(<Harness initialStep={null} />);

    expect(screen.getByTestId("step-trigger")).toHaveTextContent("Overall");
  });

  it("offers the whole funnel first and then every transition, with their drop-offs", () => {
    render(<Harness />);

    const options = openStepOptions();
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent("Overall700 dropped · 70%");
    expect(options[1]).toHaveTextContent(
      "view_cart→start_checkout600 dropped · 60%",
    );
    expect(options[2]).toHaveTextContent(
      "start_checkout→purchase100 dropped · 25%",
    );
  });

  it.each([
    ["the whole funnel", null, 0],
    ["a transition", 2, 2],
  ])("marks %s when selected", (_, step, selectedIndex) => {
    render(<Harness initialStep={step} />);

    openStepOptions().forEach((option, i) => {
      const check = option.querySelector("svg.lucide-check");
      if (i === selectedIndex) {
        expect(check).not.toHaveClass("invisible");
      } else {
        expect(check).toHaveClass("invisible");
      }
    });
  });

  // Choosing another step remounts the selector, which closes it either way, so
  // this test picks the selected step.
  it("closes the options after a choice", () => {
    render(<Harness />);

    fireEvent.click(openStepOptions()[1]);

    expect(onSelectStep).toHaveBeenCalledWith(1);
    expect(screen.queryByTestId("step-option")).not.toBeInTheDocument();
  });

  it("queries each list for the first page of a chosen transition, fetching only the shown one", () => {
    mockUseFunnelStepErrorsQuery.mockReturnValue(
      listQuery([stepError], { next: true }),
    );
    render(<Harness />);
    fireEvent.click(button("Next"));
    expect(lastArgs(mockUseFunnelStepErrorsQuery)[3]).toBe(5);

    fireEvent.click(openStepOptions()[2]);

    expect(onSelectStep).toHaveBeenCalledWith(2);
    expect(lastArgs(mockUseFunnelStepErrorsQuery)).toEqual([
      params,
      "funnel-1",
      2,
      0,
      true,
    ]);
    expect(lastArgs(mockUseFunnelStepTracesQuery)).toEqual([
      params,
      "funnel-1",
      2,
      "p50",
      0,
      false,
    ]);
    expect(lastArgs(mockUseFunnelStepNetworkQuery)).toEqual([
      params,
      "funnel-1",
      2,
      "p50",
      0,
      false,
    ]);
  });
});

describe("FunnelFriction lists", () => {
  it("reports which list a clicked row belongs to", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("link", { name: "Cart.kt: checkout()" }));
    fireEvent.click(screen.getByRole("link", { name: "checkout.load" }));
    fireEvent.click(
      screen.getByRole("link", { name: "api.example.com/v1/cart" }),
    );

    expect(onOpenItem.mock.calls).toEqual([["error"], ["trace"], ["network"]]);
  });

  it("queries each list for the whole funnel after Overall is chosen, fetching only the shown one", () => {
    render(<Harness />);

    fireEvent.click(openStepOptions()[0]);

    expect(onSelectStep).toHaveBeenCalledWith(null);
    expect(lastArgs(mockUseFunnelStepErrorsQuery)).toEqual([
      params,
      "funnel-1",
      null,
      0,
      true,
    ]);
    expect(lastArgs(mockUseFunnelStepTracesQuery)).toEqual([
      params,
      "funnel-1",
      null,
      "p50",
      0,
      false,
    ]);
    expect(lastArgs(mockUseFunnelStepNetworkQuery)).toEqual([
      params,
      "funnel-1",
      null,
      "p50",
      0,
      false,
    ]);
  });

  it("queries each list for the selected step on the first page at p50, fetching only the shown one", () => {
    render(<Harness />);

    expect(lastArgs(mockUseFunnelStepErrorsQuery)).toEqual([
      params,
      "funnel-1",
      1,
      0,
      true,
    ]);
    expect(lastArgs(mockUseFunnelStepTracesQuery)).toEqual([
      params,
      "funnel-1",
      1,
      "p50",
      0,
      false,
    ]);
    expect(lastArgs(mockUseFunnelStepNetworkQuery)).toEqual([
      params,
      "funnel-1",
      1,
      "p50",
      0,
      false,
    ]);
  });

  it("fetches a list once it is first opened and keeps fetching it after switching away", () => {
    render(<Harness />);
    expect(lastArgs(mockUseFunnelStepTracesQuery).at(-1)).toBe(false);

    fireEvent.click(button("Traces"));
    expect(lastArgs(mockUseFunnelStepTracesQuery).at(-1)).toBe(true);

    fireEvent.click(button("Errors"));
    expect(lastArgs(mockUseFunnelStepTracesQuery).at(-1)).toBe(true);
    expect(lastArgs(mockUseFunnelStepNetworkQuery).at(-1)).toBe(false);
  });

  it("fetches only the shown list after the step changes", () => {
    render(<Harness />);
    fireEvent.click(button("Traces"));

    fireEvent.click(openStepOptions()[2]);

    expect(lastArgs(mockUseFunnelStepTracesQuery).at(-1)).toBe(true);
    expect(lastArgs(mockUseFunnelStepErrorsQuery).at(-1)).toBe(false);
    expect(lastArgs(mockUseFunnelStepNetworkQuery).at(-1)).toBe(false);
  });

  it("lists one fingerprint seen as both a crash and a handled error as two rows", () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockUseFunnelStepErrorsQuery.mockReturnValue(
      listQuery([stepError, { ...stepError, severity: "handled" }]),
    );
    render(<Harness />);

    expect(screen.getAllByText("Cart.kt: checkout()")).toHaveLength(2);
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining("same key"),
      expect.anything(),
    );
    consoleError.mockRestore();
  });

  it("measures each row against the users that converted and dropped", () => {
    render(<Harness />);

    // Of 1,000 users at view_cart, 400 reached start_checkout and 600 dropped.
    // The error was seen by 100 and 300 of them.
    const row = screen.getByText("Cart.kt: checkout()").closest("tr")!;
    expect(row).toHaveTextContent("25%100");
    expect(row).toHaveTextContent("50%300");
  });

  it("measures each row against the users that finished the funnel and dropped for the whole funnel", () => {
    render(<Harness initialStep={null} />);

    // Of 1,000 users at view_cart, 300 reached purchase and 700 dropped.
    const row = screen.getByText("Cart.kt: checkout()").closest("tr")!;
    expect(row).toHaveTextContent("33%100");
    expect(row).toHaveTextContent("43%300");
  });

  it("applies a new percentile to traces and network requests from their first page", () => {
    mockUseFunnelStepTracesQuery.mockReturnValue(
      listQuery([stepTrace], { next: true }),
    );
    mockUseFunnelStepNetworkQuery.mockReturnValue(
      listQuery([stepEndpoint], { next: true }),
    );
    render(<Harness initialList={FrictionList.Traces} />);
    fireEvent.click(button("Next"));
    fireEvent.click(button("Network"));
    fireEvent.click(button("Next"));

    fireEvent.click(button("p95"));

    expect(lastArgs(mockUseFunnelStepTracesQuery).slice(3)).toEqual([
      "p95",
      0,
      true,
    ]);
    expect(lastArgs(mockUseFunnelStepNetworkQuery).slice(3)).toEqual([
      "p95",
      0,
      true,
    ]);
    expect(screen.getByText("Conversion Duration (p95)")).toBeInTheDocument();
    expect(screen.getByText("Conversion Latency (p95)")).toBeInTheDocument();
  });
});

describe("FunnelFriction pagination", () => {
  it("enables the paginator from the active list's meta", () => {
    mockUseFunnelStepErrorsQuery.mockReturnValue(
      listQuery([stepError], { next: true }),
    );
    mockUseFunnelStepTracesQuery.mockReturnValue(
      listQuery([stepTrace], { previous: true }),
    );
    render(<Harness />);

    expect(button("Next")).toBeEnabled();
    expect(button("Previous")).toBeDisabled();

    fireEvent.click(button("Traces"));

    expect(button("Next")).toBeDisabled();
    expect(button("Previous")).toBeEnabled();
  });

  it("disables the paginator while the active list fetches", () => {
    mockUseFunnelStepErrorsQuery.mockReturnValue(
      listQuery([stepError], { next: true, previous: true, isFetching: true }),
    );
    render(<Harness />);

    expect(button("Next")).toBeDisabled();
    expect(button("Previous")).toBeDisabled();
  });

  it("disables the paginator when the active list has no data", () => {
    mockUseFunnelStepErrorsQuery.mockReturnValue({
      status: "error",
      data: undefined,
      isFetching: false,
    });
    render(<Harness />);

    expect(button("Next")).toBeDisabled();
    expect(button("Previous")).toBeDisabled();
  });

  it("pages only the active list by the step list limit", () => {
    mockUseFunnelStepTracesQuery.mockReturnValue(
      listQuery([stepTrace], { next: true, previous: true }),
    );
    render(<Harness initialList={FrictionList.Traces} />);

    fireEvent.click(button("Next"));
    fireEvent.click(button("Next"));

    expect(lastArgs(mockUseFunnelStepTracesQuery)[4]).toBe(10);
    expect(lastArgs(mockUseFunnelStepErrorsQuery)[3]).toBe(0);
    expect(lastArgs(mockUseFunnelStepNetworkQuery)[4]).toBe(0);

    fireEvent.click(button("Previous"));

    expect(lastArgs(mockUseFunnelStepTracesQuery)[4]).toBe(5);
  });

  it("does not page back past the first page", () => {
    mockUseFunnelStepErrorsQuery.mockReturnValue(
      listQuery([stepError], { previous: true }),
    );
    render(<Harness />);

    fireEvent.click(button("Previous"));

    expect(lastArgs(mockUseFunnelStepErrorsQuery)[3]).toBe(0);
  });

  it("keeps each list's page when switching tabs", () => {
    mockUseFunnelStepErrorsQuery.mockReturnValue(
      listQuery([stepError], { next: true }),
    );
    render(<Harness />);
    fireEvent.click(button("Next"));

    fireEvent.click(button("Network"));
    fireEvent.click(button("Errors"));

    expect(lastArgs(mockUseFunnelStepErrorsQuery)[3]).toBe(5);
  });

  it("keeps the percentile and goes back to the first page when the step changes", () => {
    mockUseFunnelStepTracesQuery.mockReturnValue(
      listQuery([stepTrace], { next: true }),
    );
    render(<Harness initialList={FrictionList.Traces} />);
    fireEvent.click(button("p95"));
    fireEvent.click(button("Next"));

    fireEvent.click(openStepOptions()[0]);

    expect(lastArgs(mockUseFunnelStepTracesQuery)).toEqual([
      params,
      "funnel-1",
      null,
      "p95",
      0,
      true,
    ]);
    expect(screen.getByText("Conversion Duration (p95)")).toBeInTheDocument();
  });

  it.each([
    ["start date", { startDate: "2026-01-02T00:00:00Z" }],
    ["end date", { endDate: "2026-02-01T00:00:00Z" }],
    ["filter", { filterExpr: "os_name:in:android" }],
  ])("goes back to the first page when the %s changes", (_, change) => {
    mockUseFunnelStepErrorsQuery.mockReturnValue(
      listQuery([stepError], { next: true }),
    );
    const { rerender } = render(<Harness />);
    fireEvent.click(button("Next"));

    const changed = { ...params, ...change };
    rerender(<Harness sectionParams={changed} />);

    expect(lastArgs(mockUseFunnelStepErrorsQuery)).toEqual([
      changed,
      "funnel-1",
      1,
      0,
      true,
    ]);
  });
});
