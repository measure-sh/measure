import { ErrorsOverview } from "@/app/components/errors_overview";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

jest.mock("@/app/components/errors_overview_plot", () => ({
  __esModule: true,
  default: () => <div data-testid="errors-overview-plot-mock" />,
}));

jest.mock("@/app/components/filters", () => ({
  __esModule: true,
  default: () => <div data-testid="filters-mock" />,
  AppVersionsInitialSelectionType: { Latest: "latest" },
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

jest.mock("@/app/stores/provider", () => ({
  __esModule: true,
  useFiltersStore: (selector: any) =>
    selector({
      filters: {
        ready: true,
        loading: false,
        serialisedFilters: "",
        app: { id: "app-id" },
      },
    }),
}));

const mockUseErrorsOverviewQuery = jest.fn();

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  paginationOffsetUrlKey: "po",
  useErrorsOverviewQuery: () => mockUseErrorsOverviewQuery(),
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
