import { mockRouter } from "@/__tests__/helpers/mock_router";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("next/navigation", () =>
  require("@/__tests__/helpers/mock_router").nextNavigationMock(),
);

jest.mock("@/app/components/skeleton", () => ({
  __esModule: true,
  SkeletonTable: ({ columns }: { columns: number }) => (
    <div data-testid="skeleton-table" data-columns={columns} />
  ),
}));

import type {
  FunnelStepErrorsResponse,
  FunnelStepNetworkResponse,
  FunnelStepTracesResponse,
} from "@/app/api/api_calls";
import FunnelStepErrors from "@/app/components/funnel/step_errors";
import FunnelStepNetwork from "@/app/components/funnel/step_network";
import FunnelStepTraces from "@/app/components/funnel/step_traces";
import {
  RootSpanMetricsQuantile,
  type useFunnelStepErrorsQuery,
  type useFunnelStepNetworkQuery,
  type useFunnelStepTracesQuery,
} from "@/app/query/hooks";

type StepError = FunnelStepErrorsResponse["results"][number];
type StepTrace = FunnelStepTracesResponse["results"][number];
type StepEndpoint = FunnelStepNetworkResponse["results"][number];

const outcomes = { converted: 400, dropped: 600 };

const successQuery = (results: unknown[], isFetching = false) => ({
  status: "success" as const,
  data: { meta: { next: false, previous: false }, results },
  isFetching,
});
const pendingQuery = {
  status: "pending" as const,
  data: undefined,
  isFetching: true,
};
const errorQuery = {
  status: "error" as const,
  data: undefined,
  isFetching: false,
};

// The lists read only status, data and isFetching, so the stand-ins carry only
// those.
type ListQuery =
  | ReturnType<typeof successQuery>
  | typeof pendingQuery
  | typeof errorQuery;

const stepError = (overrides: Partial<StepError> = {}): StepError => ({
  id: "group-1",
  type: "java.lang.IllegalStateException",
  error_type: "exception",
  severity: "fatal",
  message: "cart is empty",
  method_name: "checkout",
  file_name: "Cart.kt",
  count: 1500,
  users: 9,
  converted: 100,
  dropped: 300,
  ...overrides,
});

const stepTrace = (overrides: Partial<StepTrace> = {}): StepTrace => ({
  span_name: "checkout.load",
  count: 40,
  converted: 200,
  dropped: 150,
  converted_duration_ms: 1500,
  dropped_duration_ms: 1800,
  ...overrides,
});

const stepEndpoint = (overrides: Partial<StepEndpoint> = {}): StepEndpoint => ({
  domain: "api.example.com",
  path_pattern: "/v1/cart",
  count: 70,
  converted: 40,
  dropped: 60,
  converted_latency_ms: 200,
  dropped_latency_ms: 250,
  ...overrides,
});

function renderErrors(query: ListQuery, offset = 0) {
  return render(
    <FunnelStepErrors
      teamId="team-1"
      appId="app-1"
      query={query as ReturnType<typeof useFunnelStepErrorsQuery>}
      offset={offset}
      outcomes={outcomes}
    />,
  );
}

function renderTraces(query: ListQuery, demo = false, onOpenItem?: () => void) {
  return render(
    <FunnelStepTraces
      teamId="team-1"
      appId="app-1"
      query={query as ReturnType<typeof useFunnelStepTracesQuery>}
      quantile={RootSpanMetricsQuantile.p90}
      offset={0}
      outcomes={outcomes}
      demo={demo}
      onOpenItem={onOpenItem}
    />,
  );
}

function renderNetwork(query: ListQuery) {
  return render(
    <FunnelStepNetwork
      teamId="team-1"
      appId="app-1"
      query={query as ReturnType<typeof useFunnelStepNetworkQuery>}
      quantile={RootSpanMetricsQuantile.p95}
      offset={0}
      outcomes={outcomes}
    />,
  );
}

const rowOf = (text: string) => screen.getByText(text).closest("tr")!;

// Every cell in a row links to the same page, so the hrefs are deduplicated.
const rowHrefs = (row: HTMLElement) => [
  ...new Set(
    [...row.querySelectorAll("a")].map((link) => link.getAttribute("href")),
  ),
];

const cellTexts = (row: HTMLElement) =>
  [...row.querySelectorAll("td")].map((cell) => cell.textContent);

beforeEach(() => {
  mockRouter.reset();
});

describe("StepList", () => {
  it("shows a skeleton with the list's columns while loading", () => {
    renderNetwork(pendingQuery);

    expect(screen.getByTestId("skeleton-table")).toHaveAttribute(
      "data-columns",
      "6",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it.each([
    ["errors", renderErrors],
    ["traces", renderTraces],
    ["network requests", renderNetwork],
  ])("names the %s list in its error message", (noun, renderList) => {
    renderList(errorQuery);

    expect(
      screen.getByText(
        `Error fetching list of ${noun}, please change filters or refresh page to try again`,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it.each([
    ["errors", renderErrors],
    ["traces", renderTraces],
    ["network requests", renderNetwork],
  ])("shows an empty state when there are no %s", (noun, renderList) => {
    renderList(successQuery([]));

    expect(
      screen.getByText(`No ${noun} between these steps`),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("keeps the table on a later page with no rows", () => {
    renderErrors(successQuery([]), 5);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.queryByText("No errors between these steps"),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["a loaded list refetching", successQuery([stepError()], true), true],
    ["a loaded list not fetching", successQuery([stepError()]), false],
    ["a first load", pendingQuery, false],
  ])("shows the loading bar correctly for %s", (_, query, visible) => {
    const { container } = renderErrors(query);

    const loadingBar = container.querySelector(".font-body > div")!;
    expect(loadingBar).toHaveClass(visible ? "visible" : "invisible");
  });
});

describe("StepRow", () => {
  it("opens the row's page with Enter or Space", () => {
    renderTraces(successQuery([stepTrace()]));
    const row = rowOf("checkout.load");

    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });

    expect(mockRouter.pushMock.mock.calls).toEqual([
      ["/team-1/traces?a=app-1&r=checkout.load"],
      ["/team-1/traces?a=app-1&r=checkout.load"],
    ]);
  });

  it("reports a click on any cell and an Enter as opening the row", () => {
    const onOpenItem = jest.fn();
    renderTraces(successQuery([stepTrace()]), false, onOpenItem);
    const row = rowOf("checkout.load");

    fireEvent.click(row.querySelectorAll("a")[0]);
    fireEvent.click(row.querySelectorAll("a")[3]);
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: "ArrowDown" });

    expect(onOpenItem).toHaveBeenCalledTimes(3);
  });

  it("reports a middle click as opening the row, and not a right click", () => {
    const onOpenItem = jest.fn();
    renderTraces(successQuery([stepTrace()]), false, onOpenItem);
    const link = rowOf("checkout.load").querySelectorAll("a")[2];

    fireEvent(link, new MouseEvent("auxclick", { bubbles: true, button: 1 }));
    fireEvent(link, new MouseEvent("auxclick", { bubbles: true, button: 2 }));

    expect(onOpenItem).toHaveBeenCalledTimes(1);
  });

  it("ignores other keys", () => {
    renderTraces(successQuery([stepTrace()]));

    fireEvent.keyDown(rowOf("checkout.load"), { key: "ArrowDown" });

    expect(mockRouter.pushMock).not.toHaveBeenCalled();
  });

  it("links every cell of a row to the same page", () => {
    renderTraces(successQuery([stepTrace()]));
    const row = rowOf("checkout.load");

    expect(row.querySelectorAll("a")).toHaveLength(6);
    expect(rowHrefs(row)).toEqual(["/team-1/traces?a=app-1&r=checkout.load"]);
  });

  it("leaves the rows of a demo unlinked", () => {
    renderTraces(successQuery([stepTrace()]), true);
    const row = rowOf("checkout.load");

    fireEvent.keyDown(row, { key: "Enter" });

    expect(row.querySelectorAll("a")).toHaveLength(0);
    expect(row).not.toHaveAttribute("tabindex");
    expect(mockRouter.pushMock).not.toHaveBeenCalled();
    expect(cellTexts(row)).toEqual([
      "checkout.load",
      "40",
      "1.5s",
      "1.8s20% slower",
      "50%200",
      "25%150",
    ]);
  });
});

describe("FunnelStepErrors", () => {
  it("shows the group title, type and message, counts and shares", () => {
    renderErrors(successQuery([stepError()]));

    const row = rowOf("Cart.kt: checkout()");
    expect(row).toHaveTextContent(
      "java.lang.IllegalStateException:cart is empty",
    );
    expect(cellTexts(row).slice(1)).toEqual(["1.5K", "9", "25%100", "50%300"]);
  });

  it("leaves out the colon when the error has no type", () => {
    renderErrors(
      successQuery([stepError({ type: "", message: "Input dispatching" })]),
    );

    expect(screen.getByText("Input dispatching")).toBeInTheDocument();
  });

  it("links to the error group", () => {
    renderErrors(successQuery([stepError()]));

    expect(rowHrefs(rowOf("Cart.kt: checkout()"))).toEqual([
      `/team-1/errors/app-1/group-1/${encodeURIComponent("java.lang.IllegalStateException@Cart.kt")}?from=funnel`,
    ]);
  });

  it("carries only the date range from the URL to the error group", () => {
    mockRouter.setUrl(
      "a=app-9&d=Custom+Range&sd=2026-01-01&ed=2026-01-31&fs=2",
    );
    renderErrors(successQuery([stepError()]));

    expect(rowHrefs(rowOf("Cart.kt: checkout()"))).toEqual([
      `/team-1/errors/app-1/group-1/${encodeURIComponent("java.lang.IllegalStateException@Cart.kt")}?d=Custom+Range&sd=2026-01-01&ed=2026-01-31&from=funnel`,
    ]);
  });

  const allPills = [
    "Crash",
    "Error",
    "ANR",
    "App Hang",
    "Fatal",
    "Handled",
    "Unhandled",
  ];

  it.each<[string, StepError["error_type"], string, string[]]>([
    ["a fatal exception", "exception", "fatal", ["Crash", "Fatal"]],
    ["a handled exception", "exception", "handled", ["Error", "Handled"]],
    [
      "an unhandled exception",
      "exception",
      "unhandled",
      ["Error", "Unhandled"],
    ],
    ["an ANR", "anr", "fatal", ["ANR", "Fatal"]],
    ["an app hang", "app_hang", "", ["App Hang"]],
  ])("labels %s", (_, errorType, severity, pills) => {
    renderErrors(
      successQuery([stepError({ error_type: errorType, severity })]),
    );

    const title = within(rowOf("Cart.kt: checkout()").querySelector("td")!);
    for (const pill of allPills) {
      if (pills.includes(pill)) {
        expect(title.getByText(pill)).toBeInTheDocument();
      } else {
        expect(title.queryByText(pill)).not.toBeInTheDocument();
      }
    }
  });

  it("shows a row for every result", () => {
    renderErrors(
      successQuery([
        stepError(),
        stepError({ id: "group-2", file_name: "Pay.kt", method_name: "pay" }),
      ]),
    );

    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("Pay.kt: pay()")).toBeInTheDocument();
  });
});

describe("FunnelStepTraces", () => {
  it("shows the percentile in the duration headers", () => {
    renderTraces(successQuery([stepTrace()]));

    expect(screen.getByText("Conversion Duration (p90)")).toBeInTheDocument();
    expect(screen.getByText("Drop-off Duration (p90)")).toBeInTheDocument();
  });

  it("shows instances, durations and shares", () => {
    renderTraces(successQuery([stepTrace()]));

    expect(cellTexts(rowOf("checkout.load")).slice(1)).toEqual([
      "40",
      "1.5s",
      "1.8s20% slower",
      "50%200",
      "25%150",
    ]);
  });

  it("links to the traces page for the span with the date range", () => {
    mockRouter.setUrl("d=Last+7+days&a=app-9&r=other");
    renderTraces(successQuery([stepTrace({ span_name: "pay screen" })]));

    const href = screen
      .getByRole("link", { name: "pay screen" })
      .getAttribute("href")!;
    const url = new URL(href, "http://localhost");
    expect(url.pathname).toBe("/team-1/traces");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      d: "Last 7 days",
      a: "app-1",
      r: "pay screen",
    });
  });
});

describe("FunnelStepNetwork", () => {
  it("shows the percentile in the latency headers", () => {
    renderNetwork(successQuery([stepEndpoint()]));

    expect(screen.getByText("Conversion Latency (p95)")).toBeInTheDocument();
    expect(screen.getByText("Drop-off Latency (p95)")).toBeInTheDocument();
  });

  it("shows the endpoint, requests, latencies and shares", () => {
    renderNetwork(successQuery([stepEndpoint()]));

    expect(cellTexts(rowOf("api.example.com/v1/cart")).slice(1)).toEqual([
      "70",
      "200ms",
      "250ms25% slower",
      "10%40",
      "10%60",
    ]);
  });

  it("links to the endpoint's network details with the date range", () => {
    mockRouter.setUrl("sd=2026-01-01&ed=2026-01-31&d=Custom+Range");
    renderNetwork(successQuery([stepEndpoint()]));

    const href = screen
      .getByRole("link", { name: "api.example.com/v1/cart" })
      .getAttribute("href")!;
    const url = new URL(href, "http://localhost");
    expect(url.pathname).toBe("/team-1/network/details");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      d: "Custom Range",
      sd: "2026-01-01",
      ed: "2026-01-31",
      a: "app-1",
      domain: "api.example.com",
      path: "/v1/cart",
      from: "funnel",
    });
  });
});

describe("DurationCells", () => {
  const renderLatencies = (convertedMs: number, droppedMs: number) => {
    renderNetwork(
      successQuery([
        stepEndpoint({
          converted_latency_ms: convertedMs,
          dropped_latency_ms: droppedMs,
        }),
      ]),
    );
    return rowOf("api.example.com/v1/cart");
  };

  it("labels a drop-off duration 10% above the conversion duration as slower", () => {
    expect(renderLatencies(200, 220)).toHaveTextContent("10% slower");
  });

  it.each([
    ["less than 10% slower", 200, 215],
    ["faster", 200, 100],
    ["equally fast", 200, 200],
    ["against a zero conversion duration", 0, 500],
  ])(
    "leaves out the label for a drop-off duration %s",
    (_, convertedMs, droppedMs) => {
      expect(renderLatencies(convertedMs, droppedMs)).not.toHaveTextContent(
        "slower",
      );
    },
  );
});
