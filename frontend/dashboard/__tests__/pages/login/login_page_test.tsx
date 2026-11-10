import { promiseParams } from "@/__tests__/helpers/promise_params";
import Login from "@/app/auth/login/page";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { ApiError } from "@/app/api/api_error";
import { act, render, screen } from "@testing-library/react";

const mockRouterReplace = jest.fn();
const mockValidateInvites = jest.fn((_arg?: any) => Promise.resolve());
const mockPosthogIdentify = jest.fn();
const mockFetchCurrentSession = jest.fn((...args: any[]) =>
  Promise.resolve(null as any),
);
const mockResetAllStores = jest.fn();

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  fetchCurrentSession: (...args: any[]) => mockFetchCurrentSession(...args),
}));

jest.mock("@/app/stores/provider", () => ({
  __esModule: true,
  useMeasureStoreRegistry: () => ({}),
}));

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ clear: jest.fn() }),
}));

jest.mock("@/app/stores/reset_all", () => ({
  resetAllStores: (...args: any[]) => mockResetAllStores(...args),
}));

jest.mock("@/app/api/api_calls", () => ({
  validateInvitesFromServer: (arg: any) => mockValidateInvites(arg),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockRouterReplace }),
  useSearchParams: () => ({ get: jest.fn(() => null) }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, ...props }: any) => <img alt={alt} {...props} />,
}));

jest.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", resolvedTheme: "light" }),
}));

jest.mock("posthog-js", () => ({
  posthog: { identify: (...args: [...any[]]) => mockPosthogIdentify(...args) },
}));

let mockIsCloud = false;
jest.mock("@/app/utils/env_utils", () => ({
  __esModule: true,
  isCloud: () => mockIsCloud,
}));

// Full-page navigation goes through the navigation module because jsdom's
// window.location can't be stubbed; mock it to observe the OAuth redirect.
const mockAssign = jest.fn();
jest.mock("@/app/utils/navigation", () => ({
  navigateTo: (...args: any[]) => mockAssign(...args),
  reloadPage: jest.fn(),
}));

describe("Login Page", () => {
  beforeEach(() => {
    mockIsCloud = false;
    mockAssign.mockClear();
    mockRouterReplace.mockClear();
    mockValidateInvites.mockClear();
    mockValidateInvites.mockResolvedValue(undefined);
    mockPosthogIdentify.mockClear();
    mockFetchCurrentSession.mockReset();
    mockFetchCurrentSession.mockResolvedValue(null);
    mockResetAllStores.mockClear();
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
  });

  it("fetches the current session when mcp param is absent", async () => {
    await act(async () => {
      render(<Login searchParams={promiseParams({})} />);
    });

    expect(mockFetchCurrentSession).toHaveBeenCalled();
  });

  it("error param hides sign-in buttons", async () => {
    await act(async () => {
      render(
        <Login searchParams={promiseParams({ error: "Could not sign in" })} />,
      );
    });

    expect(screen.queryByText("Sign in with GitHub")).not.toBeInTheDocument();
    expect(screen.queryByText("Sign in with Google")).not.toBeInTheDocument();
  });

  it("message param hides sign-in buttons", async () => {
    await act(async () => {
      render(
        <Login
          searchParams={promiseParams({
            message: "user@example.com not allowed",
          })}
        />,
      );
    });

    expect(screen.queryByText("Sign in with GitHub")).not.toBeInTheDocument();
    expect(screen.queryByText("Sign in with Google")).not.toBeInTheDocument();
  });

  it("validates invite when inviteId is present in non-MCP mode", async () => {
    await act(async () => {
      render(
        <Login searchParams={promiseParams({ inviteId: "invite-123" })} />,
      );
    });

    expect(mockValidateInvites).toHaveBeenCalledWith("invite-123");
  });

  it("shows invalid invite message when the server rejects the invite", async () => {
    mockValidateInvites.mockRejectedValue(new ApiError(404, "no such invite"));

    await act(async () => {
      render(
        <Login searchParams={promiseParams({ inviteId: "bad-invite" })} />,
      );
    });

    expect(
      screen.getByText("Invalid or expired invite link."),
    ).toBeInTheDocument();
  });

  it("does not show invalid invite message when invite is valid", async () => {
    mockValidateInvites.mockResolvedValue(undefined);

    await act(async () => {
      render(
        <Login searchParams={promiseParams({ inviteId: "good-invite" })} />,
      );
    });

    expect(
      screen.queryByText("Invalid or expired invite link."),
    ).not.toBeInTheDocument();
  });

  it("leaves the invite unjudged when the network fails", async () => {
    mockValidateInvites.mockRejectedValue(new Error("network down"));

    await act(async () => {
      render(
        <Login searchParams={promiseParams({ inviteId: "some-invite" })} />,
      );
    });

    expect(
      screen.queryByText("Invalid or expired invite link."),
    ).not.toBeInTheDocument();
  });

  it("redirects to overview when session exists", async () => {
    mockFetchCurrentSession.mockResolvedValueOnce({
      user: {
        id: "user-1",
        email: "test@example.com",
        name: "Test",
        own_team_id: "team-1",
      },
    } as any);

    await act(async () => {
      render(<Login searchParams={promiseParams({})} />);
    });

    expect(mockRouterReplace).toHaveBeenCalledWith("/team-1/overview");
  });

  it('shows "Logging in..." when session exists and redirecting', async () => {
    mockFetchCurrentSession.mockResolvedValueOnce({
      user: {
        id: "user-1",
        email: "test@example.com",
        name: "Test",
        own_team_id: "team-1",
      },
    } as any);

    await act(async () => {
      render(<Login searchParams={promiseParams({})} />);
    });

    expect(screen.getByText("Logging in...")).toBeInTheDocument();
  });

  it("calls posthog.identify when session exists", async () => {
    mockFetchCurrentSession.mockResolvedValueOnce({
      user: {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        own_team_id: "team-1",
      },
    } as any);

    await act(async () => {
      render(<Login searchParams={promiseParams({})} />);
    });

    expect(mockPosthogIdentify).toHaveBeenCalledWith(
      "user-1",
      {
        email: "test@example.com",
        name: "Test User",
      },
      {
        first_touch_utm_source: undefined,
        first_touch_utm_medium: undefined,
        first_touch_utm_campaign: undefined,
        last_touch_utm_source: undefined,
        last_touch_utm_medium: undefined,
        referrer_domain: undefined,
        signup_acquisition_source: "direct",
        signup_is_inbound: true,
        email_domain: "example.com",
      },
    );
  });

  it("links terms of service and privacy policy in cloud mode", async () => {
    mockIsCloud = true;

    await act(async () => {
      render(<Login searchParams={promiseParams({})} />);
    });

    expect(screen.getByText(/By continuing, you agree to our/)).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Terms of Service" }),
    ).toHaveAttribute("href", "/terms-of-service");
    expect(
      screen.getByRole("link", { name: "Privacy Policy" }),
    ).toHaveAttribute("href", "/privacy-policy");
  });

  it("omits the terms notice when self-hosted", async () => {
    await act(async () => {
      render(<Login searchParams={promiseParams({})} />);
    });

    expect(
      screen.queryByText(/By continuing, you agree to our/),
    ).not.toBeInTheDocument();
  });
});
