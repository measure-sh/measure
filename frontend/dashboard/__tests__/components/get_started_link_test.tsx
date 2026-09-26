import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

const mockTrack = jest.fn();
jest.mock("@/app/utils/analytics/track", () => ({
  track: (...args: any[]) => mockTrack(...args),
}));

import GetStartedLink from "@/app/components/get_started_link";

const mockFetch = jest.fn();

function renderLink() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0 } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <GetStartedLink location="hero" />
    </QueryClientProvider>,
  );
  return queryClient;
}

function statusResponse(signedIn: boolean) {
  return {
    ok: true,
    json: async () => ({ signed_in: signedIn }),
  };
}

function authStatus(queryClient: QueryClient) {
  return queryClient.getQueryState(["authStatus"])?.status;
}

describe("GetStartedLink", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockTrack.mockReset();
    global.fetch = mockFetch as any;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows Get Started while the auth status is loading", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderLink();
    expect(screen.getByRole("link")).toHaveTextContent("Get Started");
  });

  it("keeps Get Started for a signed-out visitor", async () => {
    mockFetch.mockResolvedValue(statusResponse(false));
    const queryClient = renderLink();
    await waitFor(() => expect(authStatus(queryClient)).toBe("success"));
    expect(screen.getByRole("link")).toHaveTextContent("Get Started");
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/auth/login");
    fireEvent.click(link);
    expect(mockTrack).toHaveBeenCalledWith("cta_click", {
      location: "hero",
      destination: "signup",
    });
  });

  it("shows Dashboard for a signed-in visitor", async () => {
    mockFetch.mockResolvedValue(statusResponse(true));
    renderLink();
    await waitFor(() =>
      expect(screen.getByRole("link")).toHaveTextContent("Dashboard"),
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/auth/login");
    fireEvent.click(link);
    expect(mockTrack).toHaveBeenCalledWith("cta_click", {
      location: "hero",
      destination: "dashboard",
    });
  });

  it("keeps Get Started when the request fails", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const queryClient = renderLink();
    await waitFor(() => expect(authStatus(queryClient)).toBe("error"));
    expect(screen.getByRole("link")).toHaveTextContent("Get Started");
  });

  it("keeps Get Started when the request times out", async () => {
    jest.useFakeTimers();
    mockFetch.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener("abort", () =>
            reject(init.signal!.reason),
          );
        }),
    );
    const queryClient = renderLink();
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    await waitFor(() => expect(authStatus(queryClient)).toBe("error"));
    expect(screen.getByRole("link")).toHaveTextContent("Get Started");
  });
});
