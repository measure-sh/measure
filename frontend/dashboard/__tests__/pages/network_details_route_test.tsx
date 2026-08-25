import NetworkDetailsPage from "@/app/[teamId]/network/details/page";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { promiseParams } from "../helpers/promise_params";

const mockReplace = jest.fn();
const mockTrack = jest.fn();
let mockSearchParams = new URLSearchParams(
  "domain=api.example.com&path=/v1/users",
);

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock("@/app/components/network_details", () => ({
  __esModule: true,
  default: () => <div data-testid="network-details" />,
}));

jest.mock("@/app/utils/analytics/track", () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

describe("NetworkDetailsPage", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockTrack.mockReset();
    mockSearchParams = new URLSearchParams(
      "domain=api.example.com&path=/v1/users",
    );
  });

  it("renders and tracks a selected endpoint", async () => {
    render(<NetworkDetailsPage params={promiseParams({ teamId: "team-1" })} />);

    expect(screen.getByTestId("network-details")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith(
        "network_call_inspected",
        expect.objectContaining({
          team_id: "team-1",
          entry_point: "direct",
        }),
      );
    });
  });

  it("counts one inspection when a filter changes", async () => {
    const { rerender } = render(
      <NetworkDetailsPage params={promiseParams({ teamId: "team-1" })} />,
    );
    await waitFor(() => expect(mockTrack).toHaveBeenCalledTimes(1));

    mockSearchParams = new URLSearchParams(
      "a=app-1&domain=api.example.com&path=/v1/users",
    );
    rerender(
      <NetworkDetailsPage params={promiseParams({ teamId: "team-1" })} />,
    );

    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it("counts a new inspection when the endpoint changes", async () => {
    const { rerender } = render(
      <NetworkDetailsPage params={promiseParams({ teamId: "team-1" })} />,
    );
    await waitFor(() => expect(mockTrack).toHaveBeenCalledTimes(1));

    mockSearchParams = new URLSearchParams(
      "domain=api.example.com&path=/v1/orders",
    );
    rerender(
      <NetworkDetailsPage params={promiseParams({ teamId: "team-1" })} />,
    );

    await waitFor(() => expect(mockTrack).toHaveBeenCalledTimes(2));
  });

  it("uses the source from the detail URL", async () => {
    mockSearchParams = new URLSearchParams(
      "domain=api.example.com&path=/v1/users&from=search",
    );
    render(<NetworkDetailsPage params={promiseParams({ teamId: "team-1" })} />);

    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith(
        "network_call_inspected",
        expect.objectContaining({ entry_point: "search" }),
      );
    });
  });

  it("does not track the same endpoint again after URL filters change", async () => {
    mockSearchParams = new URLSearchParams(
      "domain=api.example.com&path=/v1/users&from=search",
    );
    const { rerender } = render(
      <NetworkDetailsPage params={promiseParams({ teamId: "team-1" })} />,
    );
    await waitFor(() => expect(mockTrack).toHaveBeenCalledTimes(1));

    // NetworkDetails rebuilds the query string from filters without `from`.
    mockSearchParams = new URLSearchParams(
      "a=app-1&domain=api.example.com&path=/v1/users",
    );
    rerender(
      <NetworkDetailsPage params={promiseParams({ teamId: "team-1" })} />,
    );

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith(
      "network_call_inspected",
      expect.objectContaining({ entry_point: "search" }),
    );
  });

  it("renders a path-only selection", async () => {
    mockSearchParams = new URLSearchParams(
      "a=app-1&path=/v1/users&from=search",
    );
    render(<NetworkDetailsPage params={promiseParams({ teamId: "team-1" })} />);

    expect(screen.getByTestId("network-details")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith(
        "network_call_inspected",
        expect.objectContaining({ entry_point: "search" }),
      );
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("returns a detail URL without a selection to Network overview", async () => {
    mockSearchParams = new URLSearchParams("a=app-1&from=search");
    render(<NetworkDetailsPage params={promiseParams({ teamId: "team-1" })} />);

    expect(screen.queryByTestId("network-details")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/team-1/network?a=app-1");
    });
    expect(mockTrack).not.toHaveBeenCalled();
  });
});
