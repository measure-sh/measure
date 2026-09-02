import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

const mockRouterReplace = jest.fn();
const mockRouterPush = jest.fn();
const mockSetPageUrlKey = jest.fn();

jest.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ replace: mockRouterReplace, push: mockRouterPush }),
  useSearchParams: () => new URLSearchParams(),
}));

// The demo never renders the filter bar or fetches, but the component calls
// the live page's hooks on every render, so they are stubbed to stay idle.
jest.mock("@/app/components/filter_bar/filter_bar", () => ({
  __esModule: true,
  default: () => <div data-testid="filter-bar" />,
}));

jest.mock("@/app/components/filter_bar/use_expr_filter_page", () => ({
  __esModule: true,
  useExprFilterPage: () => ({
    requestedFilters: {
      app: null,
      dateRange: { dateRange: null, startDate: null, endDate: null },
      filterExpr: null,
    },
    filterState: { status: "pending" },
    filterParams: null,
    onFilterChange: jest.fn(),
    setPageUrlKey: mockSetPageUrlKey,
  }),
}));

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useJourneyQuery: () => ({ status: "pending", data: undefined, error: null }),
}));

jest.mock("next-themes", () => ({
  __esModule: true,
  useTheme: () => ({ theme: "light" }),
}));

// The real Sankey needs DOM layout that jsdom does not provide. The stub
// renders each node as a clickable span so tests can see which data reached
// the chart and open the issue panel.
jest.mock("@nivo/sankey", () => ({
  __esModule: true,
  ResponsiveSankey: ({ data, onClick }: any) => (
    <div data-testid="nivo-sankey">
      {data?.nodes?.map((node: any) => (
        <span
          key={node.id}
          data-testid={`sankey-node-${node.id.split(".").pop()}`}
          onClick={() => onClick?.(node)}
        >
          {node.id.split(".").pop()}
        </span>
      ))}
    </div>
  ),
}));

import UserJourneys from "@/app/components/user_journeys";

describe("UserJourneys", () => {
  beforeEach(() => {
    mockRouterReplace.mockClear();
    mockRouterPush.mockClear();
    mockSetPageUrlKey.mockClear();
  });

  it("renders the title", () => {
    render(<UserJourneys demo={true} />);
    expect(screen.getByText("User Journeys")).toBeInTheDocument();
  });

  it("hides the title when asked", () => {
    render(<UserJourneys demo={true} hideDemoTitle={true} />);
    expect(screen.queryByText("User Journeys")).not.toBeInTheDocument();
  });

  it("draws the demo journey without a search input", () => {
    render(<UserJourneys demo={true} />);
    expect(screen.getByTestId("sankey-node-MainActivity")).toBeInTheDocument();
    expect(
      screen.getByTestId("sankey-node-CheckoutActivity"),
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Search nodes...")).toBeNull();
  });

  it("starts on the Paths tab", () => {
    render(<UserJourneys demo={true} />);
    expect(screen.getByRole("button", { name: "Paths" })).toHaveClass(
      "bg-accent",
    );
    expect(screen.getByRole("button", { name: "Exceptions" })).not.toHaveClass(
      "bg-accent",
    );
  });

  it("switches tabs locally, writing nothing to the URL", () => {
    render(<UserJourneys demo={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Exceptions" }));

    expect(screen.getByRole("button", { name: "Exceptions" })).toHaveClass(
      "bg-accent",
    );
    expect(screen.getByTestId("sankey-node-MainActivity")).toBeInTheDocument();
    expect(mockRouterReplace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Paths" }));
    expect(screen.getByRole("button", { name: "Paths" })).toHaveClass(
      "bg-accent",
    );
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("opens the issue panel on the Exceptions tab, with inert issue buttons", () => {
    render(<UserJourneys demo={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Exceptions" }));
    fireEvent.click(screen.getByTestId("sankey-node-CheckoutActivity"));

    const crash = screen
      .getByText(/retrofit2.HttpException@CheckoutService.kt/)
      .closest("button")!;
    fireEvent.click(crash);
    expect(mockRouterPush).not.toHaveBeenCalled();
  });
});
