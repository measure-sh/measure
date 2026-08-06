import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

const mockRouterPush = jest.fn();

jest.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock("next-themes", () => ({
  __esModule: true,
  useTheme: () => ({ theme: "light" }),
}));

jest.mock("@/app/api/api_calls", () => ({
  __esModule: true,
  JourneyType: { Paths: 0, Exceptions: 1 },
  emptyJourney: { links: [], nodes: [], totalIssues: 0 },
}));

// The component reads the selected app and date range to build the error
// detail URLs pushed when a crash or ANR row is clicked.
const mockFilters = {
  app: { id: "app-1" },
  startDate: "2026-01-01T00:00:00.000Z",
  endDate: "2026-01-31T00:00:00.000Z",
};

jest.mock("@/app/stores/provider", () => ({
  __esModule: true,
  useFiltersStore: (selector: any) => selector({ filters: mockFilters }),
}));

const mockUseJourneyQuery = jest.fn();
jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useJourneyQuery: (...args: any[]) => mockUseJourneyQuery(...args),
}));

// The real Sankey needs DOM layout that jsdom does not provide. The stub
// renders each node and link as a clickable span so tests can assert what
// data reached the chart and drive the component's onClick handler.
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
      {data?.links?.map((link: any, i: number) => (
        <span
          key={i}
          data-testid={`sankey-link-${i}`}
          onClick={() =>
            onClick?.({
              ...link,
              source: { id: link.source },
              target: { id: link.target },
            })
          }
        >
          {link.source}→{link.target}: {link.value}
        </span>
      ))}
    </div>
  ),
}));

import Journey, { JourneyType } from "@/app/components/journey";

// Four screens where MainActivity links to ProductListActivity and
// SearchActivity, and ProductListActivity links on to CartActivity.
// SearchActivity and CartActivity share no link, which the search tests
// use to tell matched-plus-connected nodes apart from filtered-out ones.
function makeJourney() {
  return {
    nodes: [
      {
        id: "sh.measure.demo.MainActivity",
        issues: { crashes: [], anrs: [] },
      },
      {
        id: "sh.measure.demo.ProductListActivity",
        issues: { crashes: [], anrs: [] },
      },
      {
        id: "sh.measure.demo.SearchActivity",
        issues: { crashes: [], anrs: [] },
      },
      {
        id: "sh.measure.demo.CartActivity",
        issues: { crashes: [], anrs: [] },
      },
    ],
    links: [
      {
        source: "sh.measure.demo.MainActivity",
        target: "sh.measure.demo.ProductListActivity",
        value: 5000,
      },
      {
        source: "sh.measure.demo.MainActivity",
        target: "sh.measure.demo.SearchActivity",
        value: 2800,
      },
      {
        source: "sh.measure.demo.ProductListActivity",
        target: "sh.measure.demo.CartActivity",
        value: 1200,
      },
    ],
    totalIssues: 0,
  };
}

// ProductListActivity carries a crash and CartActivity carries an ANR,
// while MainActivity is clean, so the panel tests have one node of each kind.
function makeJourneyWithExceptions() {
  return {
    nodes: [
      {
        id: "sh.measure.demo.MainActivity",
        issues: { crashes: [], anrs: [] },
      },
      {
        id: "sh.measure.demo.ProductListActivity",
        issues: {
          crashes: [
            {
              id: "crash-001",
              title: "NullPointerException at ProductList",
              count: 150,
            },
          ],
          anrs: [],
        },
      },
      {
        id: "sh.measure.demo.CartActivity",
        issues: {
          crashes: [],
          anrs: [{ id: "anr-001", title: "ANR in CartActivity", count: 30 }],
        },
      },
    ],
    links: [
      {
        source: "sh.measure.demo.MainActivity",
        target: "sh.measure.demo.ProductListActivity",
        value: 5000,
      },
      {
        source: "sh.measure.demo.ProductListActivity",
        target: "sh.measure.demo.CartActivity",
        value: 1200,
      },
    ],
    totalIssues: 180,
  };
}

// CheckoutActivity carries both a crash and an ANR, which exercises the
// panel's Crashes/ANRs tab switching (each tab shows only its own type).
function makeJourneyWithMixedIssues() {
  return {
    nodes: [
      {
        id: "sh.measure.demo.HomeActivity",
        issues: { crashes: [], anrs: [] },
      },
      {
        id: "sh.measure.demo.CheckoutActivity",
        issues: {
          crashes: [
            {
              id: "crash-100",
              title: "IllegalStateException at Checkout",
              count: 75,
            },
          ],
          anrs: [
            { id: "anr-100", title: "ANR in CheckoutActivity", count: 12 },
          ],
        },
      },
    ],
    links: [
      {
        source: "sh.measure.demo.HomeActivity",
        target: "sh.measure.demo.CheckoutActivity",
        value: 800,
      },
    ],
    totalIssues: 87,
  };
}

function renderJourney(props: Partial<ComponentProps<typeof Journey>> = {}) {
  return render(
    <Journey
      teamId="test-team"
      bidirectional={false}
      journeyType={JourneyType.Paths}
      {...props}
    />,
  );
}

beforeEach(() => {
  mockRouterPush.mockClear();
  mockUseJourneyQuery.mockReturnValue({
    status: "success",
    data: makeJourney(),
  });
});

describe("Journey — chart rendering", () => {
  it("renders Sankey chart nodes from the journey data", () => {
    renderJourney();
    expect(screen.getByTestId("sankey-node-MainActivity")).toBeInTheDocument();
    expect(
      screen.getByTestId("sankey-node-ProductListActivity"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("sankey-node-SearchActivity"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("sankey-node-CartActivity")).toBeInTheDocument();
  });

  it("renders Sankey chart links from the journey data", () => {
    renderJourney();
    expect(screen.getByTestId("sankey-link-0")).toBeInTheDocument();
    expect(screen.getByTestId("sankey-link-1")).toBeInTheDocument();
    expect(screen.getByTestId("sankey-link-2")).toBeInTheDocument();
  });

  it('shows "No journey data" when the journey has no nodes', () => {
    mockUseJourneyQuery.mockReturnValue({
      status: "success",
      data: { nodes: [], links: [], totalIssues: 0 },
    });
    renderJourney();
    expect(screen.getByText("No journey data")).toBeInTheDocument();
    expect(screen.queryByTestId("nivo-sankey")).not.toBeInTheDocument();
  });

  it("shows loading skeleton while the query is pending", () => {
    mockUseJourneyQuery.mockReturnValue({
      status: "pending",
      data: undefined,
    });
    renderJourney();
    expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy();
    expect(screen.queryByTestId("nivo-sankey")).not.toBeInTheDocument();
  });
});

describe("Journey — exceptions panel", () => {
  beforeEach(() => {
    mockUseJourneyQuery.mockReturnValue({
      status: "success",
      data: makeJourneyWithExceptions(),
    });
  });

  function renderExceptions() {
    return renderJourney({ journeyType: JourneyType.Exceptions });
  }

  it("clicking a node with crashes opens the side panel", () => {
    renderExceptions();
    fireEvent.click(screen.getByTestId("sankey-node-ProductListActivity"));
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("panel shows crash title and count", () => {
    renderExceptions();
    fireEvent.click(screen.getByTestId("sankey-node-ProductListActivity"));
    expect(
      screen.getByText(/NullPointerException at ProductList/),
    ).toBeInTheDocument();
    expect(screen.getByText(/150/)).toBeInTheDocument();
  });

  it("panel shows ANR title and count", () => {
    renderExceptions();
    fireEvent.click(screen.getByTestId("sankey-node-CartActivity"));
    expect(screen.getByText(/ANR in CartActivity/)).toBeInTheDocument();
    // Title and count render in separate spans inside the item button,
    // so assert the count within that button rather than as a joined string.
    const anrButton = screen.getByText(/ANR in CartActivity/).closest("button");
    expect(anrButton?.textContent).toContain("30");
  });

  it("Close button hides the panel", () => {
    renderExceptions();
    fireEvent.click(screen.getByTestId("sankey-node-ProductListActivity"));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("clicking a node with no issues does not open the panel", () => {
    renderExceptions();
    fireEvent.click(screen.getByTestId("sankey-node-MainActivity"));
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("clicking a link does not open the panel", () => {
    renderExceptions();
    fireEvent.click(screen.getByTestId("sankey-link-0"));
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("open panel closes when clicking a node with no issues", () => {
    renderExceptions();
    fireEvent.click(screen.getByTestId("sankey-node-ProductListActivity"));
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("sankey-node-MainActivity"));
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("open panel closes when clicking a link", () => {
    renderExceptions();
    fireEvent.click(screen.getByTestId("sankey-node-CartActivity"));
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("sankey-link-0"));
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("panel switches content when clicking another node with issues", () => {
    renderExceptions();
    fireEvent.click(screen.getByTestId("sankey-node-ProductListActivity"));
    expect(
      screen.getByText(/NullPointerException at ProductList/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("sankey-node-CartActivity"));
    expect(screen.getByText(/ANR in CartActivity/)).toBeInTheDocument();
    expect(
      screen.queryByText(/NullPointerException at ProductList/),
    ).toBeNull();
  });

  it("clicking a crash item navigates to the error detail page", () => {
    renderExceptions();
    fireEvent.click(screen.getByTestId("sankey-node-ProductListActivity"));
    fireEvent.click(
      screen
        .getByText(/NullPointerException at ProductList/)
        .closest("button")!,
    );

    expect(mockRouterPush).toHaveBeenCalled();
    const target = mockRouterPush.mock.calls[0][0];
    expect(target).toContain("/test-team/errors/app-1/crash-001/");
  });

  it("clicking an ANR item navigates to the error detail page", () => {
    renderExceptions();
    fireEvent.click(screen.getByTestId("sankey-node-CartActivity"));
    fireEvent.click(screen.getByText(/ANR in CartActivity/).closest("button")!);

    expect(mockRouterPush).toHaveBeenCalled();
    const target = mockRouterPush.mock.calls[0][0];
    expect(target).toContain("/test-team/errors/app-1/anr-001/");
  });

  it("crash link includes start_date and end_date query params", () => {
    renderExceptions();
    fireEvent.click(screen.getByTestId("sankey-node-ProductListActivity"));
    fireEvent.click(
      screen
        .getByText(/NullPointerException at ProductList/)
        .closest("button")!,
    );

    const href = mockRouterPush.mock.calls[0][0];
    expect(href).toContain(`start_date=${mockFilters.startDate}`);
    expect(href).toContain(`end_date=${mockFilters.endDate}`);
  });

  it("ANR link includes start_date and end_date query params", () => {
    renderExceptions();
    fireEvent.click(screen.getByTestId("sankey-node-CartActivity"));
    fireEvent.click(screen.getByText(/ANR in CartActivity/).closest("button")!);

    const href = mockRouterPush.mock.calls[0][0];
    expect(href).toContain(`start_date=${mockFilters.startDate}`);
    expect(href).toContain(`end_date=${mockFilters.endDate}`);
  });

  it("clicking a node in Paths mode does not open the panel", () => {
    renderJourney({ journeyType: JourneyType.Paths });
    fireEvent.click(screen.getByTestId("sankey-node-ProductListActivity"));
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });
});

describe("Journey — exceptions panel tabs", () => {
  beforeEach(() => {
    mockUseJourneyQuery.mockReturnValue({
      status: "success",
      data: makeJourneyWithMixedIssues(),
    });
  });

  it("Crashes tab shows crashes and ANRs tab shows ANRs", () => {
    renderJourney({ journeyType: JourneyType.Exceptions });
    fireEvent.click(screen.getByTestId("sankey-node-CheckoutActivity"));

    // The panel defaults to the Crashes tab: the crash shows, the ANR does not.
    expect(
      screen.getByText(/IllegalStateException at Checkout/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ANR in CheckoutActivity/)).toBeNull();

    // Switch to the ANRs tab: the ANR shows, the crash does not.
    fireEvent.click(screen.getByRole("button", { name: "ANRs" }));
    expect(screen.getByText(/ANR in CheckoutActivity/)).toBeInTheDocument();
    expect(screen.queryByText(/IllegalStateException at Checkout/)).toBeNull();

    // Switch back to the Crashes tab: the crash shows again, the ANR is hidden.
    fireEvent.click(screen.getByRole("button", { name: "Crashes" }));
    expect(
      screen.getByText(/IllegalStateException at Checkout/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ANR in CheckoutActivity/)).toBeNull();
  });
});

describe("Journey — node search", () => {
  it("searchText keeps matching nodes and their directly connected nodes", () => {
    renderJourney({ searchText: "Cart" });
    // CartActivity matches; ProductListActivity is kept because a link
    // connects it to CartActivity.
    expect(screen.getByTestId("sankey-node-CartActivity")).toBeInTheDocument();
    expect(
      screen.getByTestId("sankey-node-ProductListActivity"),
    ).toBeInTheDocument();
    // SearchActivity shares no link with CartActivity, so it is filtered out.
    expect(screen.queryByTestId("sankey-node-SearchActivity")).toBeNull();
  });

  it("searchText matching a hub node keeps all its direct connections", () => {
    renderJourney({ searchText: "Main" });
    expect(screen.getByTestId("sankey-node-MainActivity")).toBeInTheDocument();
    expect(
      screen.getByTestId("sankey-node-ProductListActivity"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("sankey-node-SearchActivity"),
    ).toBeInTheDocument();
    // CartActivity only links to ProductListActivity, not to MainActivity.
    expect(screen.queryByTestId("sankey-node-CartActivity")).toBeNull();
  });

  it("clearing searchText shows all nodes again", () => {
    const { rerender } = render(
      <Journey
        teamId="test-team"
        bidirectional={false}
        journeyType={JourneyType.Paths}
        searchText="Cart"
      />,
    );
    expect(screen.queryByTestId("sankey-node-SearchActivity")).toBeNull();

    rerender(
      <Journey
        teamId="test-team"
        bidirectional={false}
        journeyType={JourneyType.Paths}
        searchText=""
      />,
    );
    expect(screen.getByTestId("sankey-node-MainActivity")).toBeInTheDocument();
    expect(
      screen.getByTestId("sankey-node-SearchActivity"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("sankey-node-CartActivity")).toBeInTheDocument();
  });

  it("searchText with no matches falls back to showing all nodes", () => {
    renderJourney({ searchText: "NonexistentNode" });
    expect(screen.getByTestId("sankey-node-MainActivity")).toBeInTheDocument();
    expect(
      screen.getByTestId("sankey-node-SearchActivity"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("sankey-node-CartActivity")).toBeInTheDocument();
  });

  it("lowercase search matches nodes case-insensitively", () => {
    renderJourney({ searchText: "cart" });
    expect(screen.getByTestId("sankey-node-CartActivity")).toBeInTheDocument();
    expect(screen.queryByTestId("sankey-node-SearchActivity")).toBeNull();
  });

  it("mixed case search matches nodes case-insensitively", () => {
    renderJourney({ searchText: "mAiN" });
    expect(screen.getByTestId("sankey-node-MainActivity")).toBeInTheDocument();
    expect(screen.queryByTestId("sankey-node-CartActivity")).toBeNull();
  });
});
