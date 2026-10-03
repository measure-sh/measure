import { ErrorsOverview } from "@/app/components/errors_overview";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

jest.mock("@nivo/bar", () => ({
  ResponsiveBarCanvas: () => null,
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
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
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

describe("ErrorsOverview", () => {
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

  it("links to the type alone when a group has no file name", () => {
    const href = hrefOf(renderWith([group({ file_name: "" })]));

    expect(href).toContain("java.lang.RuntimeException");
    expect(href).not.toContain("@");
  });
});
