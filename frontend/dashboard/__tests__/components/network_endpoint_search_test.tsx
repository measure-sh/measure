import NetworkEndpointSearch from "@/app/components/network_endpoint_search";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";

// cmdk measures its list with ResizeObserver and scrolls the highlighted item
// into view; jsdom implements neither.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
}
Element.prototype.scrollIntoView = jest.fn();

const mockRouterPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockUseNetworkEndpointsQuery = jest.fn(
  (_query: string, _enabled: boolean) => ({ data: [] as any }),
);

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useNetworkEndpointsQuery: (query: string, enabled: boolean) =>
    mockUseNetworkEndpointsQuery(query, enabled),
}));

const initialSuggestions = [
  { domain: "api.example.com", path_pattern: "/v1/users/*" },
  { domain: "cdn.example.com", path_pattern: "/images/*" },
];

const searchResults = [
  ...initialSuggestions,
  { domain: "api.example.com", path_pattern: "/v1/users/123" },
  { domain: "cdn.example.com", path_pattern: "/images/logo.png" },
];

const box = () => screen.getByTestId("network-endpoint-search");
const renderSearch = () => render(<NetworkEndpointSearch teamId="test-team" />);

async function settleSearch(value: string) {
  fireEvent.change(box(), { target: { value } });
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
}

describe("NetworkEndpointSearch", () => {
  beforeEach(() => {
    mockRouterPush.mockReset();
    mockUseNetworkEndpointsQuery.mockReset();
    mockUseNetworkEndpointsQuery.mockImplementation((query: string) => ({
      data: query === "" ? initialSuggestions : searchResults,
    }));
    localStorage.clear();
  });

  it("opens with a single list of pattern suggestions", () => {
    renderSearch();
    fireEvent.focus(box());

    expect(box()).toHaveAttribute(
      "placeholder",
      "Search endpoints, e.g. /v1/products/*, /v1/**, api.example.com/v1/orders/**",
    );
    expect(mockUseNetworkEndpointsQuery).toHaveBeenLastCalledWith("", true);
    expect(screen.getAllByTestId("network-endpoint-suggestion")).toHaveLength(
      2,
    );
    expect(
      screen.queryByText("api.example.com/v1/users/123"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Request patterns")).not.toBeInTheDocument();
    expect(screen.queryByText("Captured endpoints")).not.toBeInTheDocument();
  });

  it("opens only a real result for plain-text search", async () => {
    jest.useFakeTimers();
    mockUseNetworkEndpointsQuery.mockReturnValue({ data: [] });
    renderSearch();

    await settleSearch("unknown");
    expect(
      screen.queryByTestId("network-endpoint-dropdown"),
    ).not.toBeInTheDocument();
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(mockRouterPush).not.toHaveBeenCalled();

    mockUseNetworkEndpointsQuery.mockImplementation((query: string) => ({
      data: query === "" ? initialSuggestions : searchResults,
    }));
    await settleSearch("users");
    fireEvent.keyDown(box(), { key: "Enter" });

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/test-team/network/details?domain=api.example.com&path=%2Fv1%2Fusers%2F*&from=search",
    );
    jest.useRealTimers();
  });

  it("puts wildcard exploration ahead of matching endpoints", async () => {
    jest.useFakeTimers();
    renderSearch();

    await settleSearch("api.example.com/v1/**");
    expect(
      screen.getByTestId("network-endpoint-explore-pattern"),
    ).toHaveTextContent("Explore patternapi.example.com/v1/**");
    fireEvent.keyDown(box(), { key: "Enter" });

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/test-team/network/details?domain=api.example.com&path=%2Fv1%2F**&from=search",
    );
    jest.useRealTimers();
  });

  it("normalizes a bare path wildcard before exploring it", async () => {
    jest.useFakeTimers();
    renderSearch();

    await settleSearch("reviews/*");
    expect(mockUseNetworkEndpointsQuery).toHaveBeenLastCalledWith(
      "/reviews/*",
      true,
    );
    fireEvent.keyDown(box(), { key: "Enter" });

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/test-team/network/details?domain=&path=%2Freviews%2F*&from=search",
    );
    jest.useRealTimers();
  });

  it("shows explored wildcard patterns in recent searches", async () => {
    jest.useFakeTimers();
    localStorage.setItem(
      "network_recent_searches_test-team",
      JSON.stringify([{ domain: "api.example.*", path: "/v1/**" }]),
    );
    renderSearch();

    await settleSearch("api.example.*/v1/**");

    expect(screen.getByTestId("network-recent-endpoint")).toHaveTextContent(
      "api.example.*/v1/**",
    );
    jest.useRealTimers();
  });

  it("puts at most three current recent searches before the results", async () => {
    jest.useFakeTimers();
    localStorage.setItem(
      "network_recent_searches_test-team",
      JSON.stringify([
        { domain: "api.example.com", path: "/v1/users/*" },
        { domain: "cdn.example.com", path: "/images/*" },
        { domain: "api.example.com", path: "/v1/users/123" },
        { domain: "cdn.example.com", path: "/images/logo.png" },
      ]),
    );
    renderSearch();
    await settleSearch("example");

    const recents = screen.getAllByTestId("network-recent-endpoint");
    expect(recents).toHaveLength(3);
    expect(
      recents[0].compareDocumentPosition(
        screen.getByText("cdn.example.com/images/logo.png"),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    jest.useRealTimers();
  });
});
