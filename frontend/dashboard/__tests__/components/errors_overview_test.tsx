import { ErrorsOverview } from "@/app/components/errors_overview";
import "@testing-library/jest-dom";
import { pointerDown } from "@/__tests__/helpers/pointer_events";
import { fireEvent, render, screen } from "@testing-library/react";

let mockShownTooltipIndex: number | null = null;
const mockPush = jest.fn();

// jsdom cannot draw the canvas, so each bar is a button whose click event
// reaches the chart's onClick and then bubbles to the plot, as a canvas click
// does. When mockShownTooltipIndex is set, the mock renders that bar's tooltip
// inside the plot, as nivo does when a bar is hovered or tapped.
jest.mock("@nivo/bar", () => ({
  ResponsiveBarCanvas: (props: any) => (
    <div data-testid="bar-canvas">
      {props.data.map((_: unknown, index: number) => (
        <button
          key={index}
          aria-label={`Bar ${index}`}
          onClick={(event) => props.onClick({ index }, event)}
        />
      ))}
      {mockShownTooltipIndex !== null &&
        props.tooltip({
          data: props.data[mockShownTooltipIndex],
          index: mockShownTooltipIndex,
        })}
    </div>
  ),
}));

jest.mock("@/app/components/errors_overview_plot", () => ({
  __esModule: true,
  default: () => <div data-testid="errors-overview-plot-mock" />,
}));

jest.mock("@/app/components/filter_bar/filter_bar", () => ({
  __esModule: true,
  default: () => <div data-testid="filter-bar-mock" />,
}));

jest.mock("@/app/components/filter_bar/use_filter_page", () => ({
  __esModule: true,
  useFilterPage: () => ({
    value: {
      app: { id: "app-id" },
      date: { startDate: "2026-01-01", endDate: "2026-01-02" },
    },
    status: { kind: "ready" },
    filterParams: {},
    paginationOffset: 0,
    onChange: jest.fn(),
    nextPage: jest.fn(),
    prevPage: jest.fn(),
  }),
}));

jest.mock("@/app/components/paginator", () => ({
  __esModule: true,
  default: () => <div data-testid="paginator-mock" />,
}));

jest.mock("@/app/components/loading_bar", () => ({
  __esModule: true,
  default: () => <div data-testid="loading-bar-mock" />,
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockUseErrorsOverviewQuery = jest.fn();

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useErrorsOverviewQuery: () => mockUseErrorsOverviewQuery(),
  useErrorsOverviewPlotQuery: () => ({ status: "success", error: null }),
}));

const group = (overrides: Record<string, unknown>) => ({
  id: "group-id",
  type: "java.lang.RuntimeException",
  error_type: "error",
  severity: "fatal",
  message: "something broke",
  method_name: "load",
  file_name: "Repo.kt",
  count: 3,
  sessions: 2,
  users: 1,
  last_seen: "2026-01-02T00:00:00Z",
  percentage_contribution: 100,
  ...overrides,
});

const renderWith = (results: any[]) => {
  mockUseErrorsOverviewQuery.mockReturnValue({
    data: { results, meta: { next: false, previous: false } },
    status: "success",
    isFetching: false,
  });
  const { container } = render(<ErrorsOverview teamId="team-id" />);
  return container;
};

const hrefOf = (container: HTMLElement) =>
  decodeURIComponent(container.querySelector("a[href]")!.getAttribute("href")!);

const PILL_LABELS = [
  "Crash",
  "Error",
  "ANR",
  "App Hang",
  "Fatal",
  "Unhandled",
  "Handled",
  "Killed",
  "Recovered",
];

const pillsOf = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-testid="exception-row"]')).map(
    (row) =>
      Array.from(row.querySelectorAll('[data-slot="badge"]'))
        .map((badge) => badge.textContent ?? "")
        .filter((label) => PILL_LABELS.includes(label)),
  );

const appHang = () =>
  group({
    id: "hang-id",
    type: "",
    error_type: "app_hang",
    severity: "",
    message: "",
    method_name: "blockMainThread()",
    file_name: "ViewController.swift",
  });

describe("ErrorsOverview", () => {
  beforeEach(() => {
    mockShownTooltipIndex = null;
    mockPush.mockClear();
  });

  it("renders type and message, and links to type@file", () => {
    const container = renderWith([group({})]);

    expect(screen.getByTestId("exception-row-type")).toHaveTextContent(
      "java.lang.RuntimeException:something broke",
    );
    expect(hrefOf(container)).toContain("java.lang.RuntimeException@Repo.kt");
  });

  it("renders a group without a type, with no leading colon", () => {
    renderWith([group({ type: "", message: "Input dispatching timed out" })]);

    expect(screen.getByTestId("exception-row-type")).toHaveTextContent(
      "Input dispatching timed out",
    );
    expect(screen.getByTestId("exception-row-type").textContent).not.toContain(
      ":",
    );
  });

  it("links to the file alone when a group has no type", () => {
    const href = hrefOf(renderWith([group({ type: "" })]));

    expect(href).toContain("Repo.kt");
    expect(href).not.toContain("@");
  });

  it("renders the type and severity pills of a crash and an ANR", () => {
    const container = renderWith([
      group({ error_type: "exception", severity: "fatal" }),
      group({ error_type: "anr", severity: "fatal" }),
    ]);

    expect(pillsOf(container)).toEqual([
      ["Crash", "Fatal"],
      ["ANR", "Fatal"],
    ]);
  });

  it("renders an app hang with only the App Hang pill", () => {
    const container = renderWith([appHang()]);

    expect(pillsOf(container)).toEqual([["App Hang"]]);
  });

  it("renders an app hang titled by file and method, and links to the file alone", () => {
    const container = renderWith([appHang()]);

    expect(
      screen.getByText("ViewController.swift: blockMainThread()"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("exception-row-type")).toBeEmptyDOMElement();
    const href = hrefOf(container);
    expect(href).toContain("/hang-id/ViewController.swift");
    expect(href).not.toContain("@");
  });

  it("links to unknown_file when an app hang has no file name", () => {
    const href = hrefOf(renderWith([{ ...appHang(), file_name: "" }]));

    expect(href).toContain("/hang-id/unknown_file");
  });

  it("links to the type alone when a group has no file name", () => {
    const href = hrefOf(renderWith([group({ file_name: "" })]));

    expect(href).toContain("java.lang.RuntimeException");
    expect(href).not.toContain("@");
  });

  it("links every cell of a row to the group's page", () => {
    const container = renderWith([group({})]);
    const hrefs = [...container.querySelectorAll("a[href]")].map((link) =>
      link.getAttribute("href"),
    );

    expect(hrefs.length).toBeGreaterThan(1);
    for (const href of hrefs) {
      expect(href).toBe(
        "/team-id/errors/app-id/group-id/java.lang.RuntimeException%40Repo.kt?from=errors_overview",
      );
    }
  });

  it("titles a group by its file and method", () => {
    renderWith([group({})]);

    expect(screen.getByLabelText("Repo.kt: load()")).toBeInTheDocument();
    expect(screen.getByText("Repo.kt: load()")).toBeInTheDocument();
  });

  describe("row trend chart", () => {
    const trend = [
      { datetime: "2026-01-01", instances: 2 },
      { datetime: "2026-01-02", instances: 1 },
    ];
    const rawHrefOf = (container: HTMLElement) =>
      container.querySelector("a[href]")!.getAttribute("href");

    it("opens the error when a bar or the space between bars is clicked", () => {
      const container = renderWith([group({ trend })]);

      fireEvent.click(screen.getByRole("button", { name: "Bar 1" }));
      fireEvent.click(screen.getByTestId("bar-canvas"));

      expect(mockPush).toHaveBeenCalledTimes(2);
      expect(mockPush).toHaveBeenNthCalledWith(1, rawHrefOf(container));
      expect(mockPush).toHaveBeenNthCalledWith(2, rawHrefOf(container));
    });

    it("opens the error on a tap only when the bar’s tooltip is visible", () => {
      mockShownTooltipIndex = 1;
      const container = renderWith([group({ trend })]);
      const tap = (target: Element) => {
        pointerDown(target, "touch");
        fireEvent.click(target);
      };

      tap(screen.getByRole("button", { name: "Bar 0" }));
      tap(screen.getByTestId("bar-canvas"));
      expect(mockPush).not.toHaveBeenCalled();
      tap(screen.getByRole("button", { name: "Bar 1" }));
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith(rawHrefOf(container));
    });
  });
});
