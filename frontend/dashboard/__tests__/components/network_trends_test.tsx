import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

const mockRouterPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, className }: any) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

jest.mock("@/app/components/loading_bar", () => ({
  __esModule: true,
  default: () => <div data-testid="loading-bar">Loading...</div>,
}));

jest.mock("@/app/components/table", () => ({
  Table: ({ children }: any) => <table>{children}</table>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableRow: ({ children, onClick, ...props }: any) => (
    <tr onClick={onClick} {...props}>
      {children}
    </tr>
  ),
  TableHead: ({ children }: any) => <th>{children}</th>,
  TableCell: ({ children }: any) => <td>{children}</td>,
}));

jest.mock("@/app/utils/time_utils", () => ({
  formatMillisToHumanReadable: (ms: number) => `${ms}ms`,
}));

jest.mock("@/app/utils/number_utils", () => ({
  numberToKMB: (n: number) => `${n}`,
}));

jest.mock("@/app/utils/shared_styles", () => ({
  underlineLinkStyle: "underline",
}));

const mockUseNetworkTrendsQuery = jest.fn(
  (_params: unknown, _active: boolean) => ({
    data: null as any,
    status: "pending" as string,
    error: null as Error | null,
  }),
);

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useNetworkTrendsQuery: (params: unknown, active: boolean) =>
    mockUseNetworkTrendsQuery(params, active),
  TrendsTab: {
    Latency: "Latency",
    ErrorRate: "Error Rate",
    Frequency: "Frequency",
  },
}));

import NetworkTrends from "@/app/components/network_trends";

const filterParams = {
  appId: "app-1",
  startDate: "2026-04-01T00:00:00.000Z",
  endDate: "2026-04-10T00:00:00.000Z",
  filterExpr: null,
};

function mockTrendsData() {
  return {
    trends_latency: [
      {
        domain: "api.example.com",
        path_pattern: "/v1/checkout",
        p95_latency: 3100,
        error_rate: 5.7,
        frequency: 8400,
      },
      {
        domain: "api.example.com",
        path_pattern: "/v1/users",
        p95_latency: 1250,
        error_rate: 2.1,
        frequency: 84200,
      },
    ],
    trends_error_rate: [
      {
        domain: "api.example.com",
        path_pattern: "/v1/checkout",
        p95_latency: 3100,
        error_rate: 5.7,
        frequency: 8400,
      },
    ],
    trends_frequency: [
      {
        domain: "api.example.com",
        path_pattern: "/v1/users",
        p95_latency: 1250,
        error_rate: 2.1,
        frequency: 84200,
      },
    ],
  };
}

describe("NetworkTrends", () => {
  beforeEach(() => {
    mockRouterPush.mockReset();
    mockUseNetworkTrendsQuery.mockReset();
    mockUseNetworkTrendsQuery.mockReturnValue({
      data: null,
      status: "pending" as string,
      error: null,
    });
  });

  describe("Loading state", () => {
    it("shows loading bar while fetching", async () => {
      mockUseNetworkTrendsQuery.mockReturnValue({
        data: null,
        status: "pending" as string,
        error: null,
      });
      await act(async () => {
        render(<NetworkTrends filterParams={filterParams} />);
      });
      expect(screen.getByTestId("loading-bar")).toBeInTheDocument();
    });
  });

  describe("Error state", () => {
    it("shows error message", async () => {
      mockUseNetworkTrendsQuery.mockReturnValue({
        data: null,
        status: "error",
        error: new Error("fail"),
      });
      await act(async () => {
        render(<NetworkTrends filterParams={filterParams} />);
      });
      await waitFor(() => {
        expect(screen.getByText(/Error fetching overview/)).toBeInTheDocument();
      });
    });
  });

  describe("NoData state", () => {
    it("shows no data message", async () => {
      mockUseNetworkTrendsQuery.mockReturnValue({
        data: null,
        status: "success",
        error: null,
      });
      await act(async () => {
        render(<NetworkTrends filterParams={filterParams} />);
      });
      await waitFor(() => {
        expect(screen.getByText(/No data available/)).toBeInTheDocument();
      });
    });
  });

  describe("Success state", () => {
    beforeEach(() => {
      mockUseNetworkTrendsQuery.mockReturnValue({
        data: mockTrendsData(),
        status: "success",
        error: null as Error | null,
      });
    });

    it("renders table with endpoint data", async () => {
      await act(async () => {
        render(<NetworkTrends filterParams={filterParams} />);
      });
      await waitFor(() => {
        expect(
          screen.getByText("api.example.com/v1/checkout"),
        ).toBeInTheDocument();
        expect(
          screen.getByText("api.example.com/v1/users"),
        ).toBeInTheDocument();
      });
    });

    it("shows latency, error rate and frequency columns", async () => {
      await act(async () => {
        render(<NetworkTrends filterParams={filterParams} />);
      });
      await waitFor(() => {
        expect(screen.getByText("Latency (p95)")).toBeInTheDocument();
        expect(screen.getByText("Error Rate %")).toBeInTheDocument();
        // 'Frequency' appears as both tab button and table header
        expect(screen.getAllByText("Frequency").length).toBeGreaterThanOrEqual(
          1,
        );
      });
    });

    it("renders tab buttons (Latency, Error Rate, Frequency)", async () => {
      await act(async () => {
        render(<NetworkTrends filterParams={filterParams} />);
      });
      await waitFor(() => {
        // Use getAllByText for 'Frequency' since the table header also says 'Frequency'
        expect(screen.getByText("Latency")).toBeInTheDocument();
        expect(screen.getByText("Error Rate")).toBeInTheDocument();
        expect(screen.getAllByText("Frequency").length).toBeGreaterThanOrEqual(
          1,
        );
      });
    });

    it("switches data when tab is clicked", async () => {
      await act(async () => {
        render(<NetworkTrends filterParams={filterParams} />);
      });
      await waitFor(() => {
        expect(
          screen.getByText("api.example.com/v1/checkout"),
        ).toBeInTheDocument();
      });

      // 'Frequency' appears in both tab button and table header; pick the button
      const freqButtons = screen.getAllByText("Frequency");
      await act(async () => {
        fireEvent.click(freqButtons[0]);
      });
      // Frequency tab shows trends_frequency data
      await waitFor(() => {
        expect(
          screen.getByText("api.example.com/v1/users"),
        ).toBeInTheDocument();
        expect(
          screen.queryByText("api.example.com/v1/checkout"),
        ).not.toBeInTheDocument();
      });
    });

    it("opens endpoint details when its row is clicked", async () => {
      await act(async () => {
        render(<NetworkTrends teamId="team-1" filterParams={filterParams} />);
      });
      await waitFor(() => {
        expect(
          screen.getByText("api.example.com/v1/checkout"),
        ).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByText("api.example.com/v1/checkout").closest("tr")!,
      );
      expect(mockRouterPush).toHaveBeenCalledWith(
        "/team-1/network/details?domain=api.example.com&path=%2Fv1%2Fcheckout&from=top_endpoint",
      );
    });

    it("links the endpoint text to its details page", async () => {
      await act(async () => {
        render(<NetworkTrends teamId="team-1" filterParams={filterParams} />);
      });
      await waitFor(() => {
        expect(
          screen.getByText("api.example.com/v1/checkout"),
        ).toBeInTheDocument();
      });

      expect(screen.getAllByRole("link")[0]).toHaveAttribute(
        "href",
        "/team-1/network/details?domain=api.example.com&path=%2Fv1%2Fcheckout&from=top_endpoint",
      );
    });

    it("leaves a modified endpoint click to the browser", async () => {
      await act(async () => {
        render(<NetworkTrends teamId="team-1" filterParams={filterParams} />);
      });
      await waitFor(() => {
        expect(
          screen.getByText("api.example.com/v1/checkout"),
        ).toBeInTheDocument();
      });

      expect(
        fireEvent.click(
          screen.getByText("api.example.com/v1/checkout").closest("tr")!,
          { metaKey: true },
        ),
      ).toBe(true);
      expect(mockRouterPush).not.toHaveBeenCalled();
    });

    it("opens endpoint details on Enter", async () => {
      await act(async () => {
        render(<NetworkTrends teamId="team-1" filterParams={filterParams} />);
      });
      await waitFor(() => {
        expect(
          screen.getByText("api.example.com/v1/checkout"),
        ).toBeInTheDocument();
      });

      fireEvent.keyDown(
        screen.getByText("api.example.com/v1/checkout").closest("tr")!,
        { key: "Enter" },
      );
      expect(mockRouterPush).toHaveBeenCalledWith(
        "/team-1/network/details?domain=api.example.com&path=%2Fv1%2Fcheckout&from=top_endpoint",
      );
    });
  });

  describe("Docs link", () => {
    it("offers the endpoint patterns tooltip beside the title", async () => {
      mockUseNetworkTrendsQuery.mockReturnValue({
        data: mockTrendsData(),
        status: "success",
        error: null as Error | null,
      });
      await act(async () => {
        render(<NetworkTrends filterParams={filterParams} />);
      });
      expect(
        screen
          .getByText("Top Endpoints")
          .parentElement!.querySelector('[data-slot="tooltip-trigger"]'),
      ).toBeTruthy();
    });

    it("drops the tooltip in demo mode", async () => {
      await act(async () => {
        render(<NetworkTrends demo={true} />);
      });
      expect(
        screen
          .getByText("Top Endpoints")
          .parentElement!.querySelector('[data-slot="tooltip-trigger"]'),
      ).toBeNull();
    });
  });

  describe("Demo mode", () => {
    it("renders table without API call", async () => {
      await act(async () => {
        render(<NetworkTrends demo={true} />);
      });
      expect(screen.getByText("Top Endpoints")).toBeInTheDocument();
      // Demo data should render some endpoints
      expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
      expect(mockUseNetworkTrendsQuery).toHaveBeenLastCalledWith(null, true);
    });

    it("does not navigate from a demo row click", async () => {
      await act(async () => {
        render(<NetworkTrends demo={true} />);
      });
      const rows = screen.getAllByRole("row");
      fireEvent.click(rows[1]); // first data row
      expect(mockRouterPush).not.toHaveBeenCalled();
    });
  });
});
