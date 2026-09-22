import { describe, expect, it } from "@jest/globals";
import { render } from "@testing-library/react";
import React from "react";

let mockPathname = "/team-001/overview";
jest.mock("next/navigation", () => ({
  __esModule: true,
  usePathname: () => mockPathname,
}));

const mockPosthogRegister = jest.fn();
const mockPosthogUnregister = jest.fn();
const mockPosthogResetGroups = jest.fn();
jest.mock("posthog-js", () => ({
  __esModule: true,
  default: {
    register: (...args: any[]) => mockPosthogRegister(...args),
    unregister: (...args: any[]) => mockPosthogUnregister(...args),
    resetGroups: () => mockPosthogResetGroups(),
  },
}));

const mockReloadPage = jest.fn();
jest.mock("@/app/utils/navigation", () => ({
  __esModule: true,
  navigateTo: jest.fn(),
  reloadPage: () => mockReloadPage(),
}));

import { ClientProviders } from "@/app/components/client_providers";

function tree() {
  return (
    <ClientProviders>
      <span data-testid="page">page</span>
    </ClientProviders>
  );
}

describe("ClientProviders sandbox boundary", () => {
  beforeEach(() => {
    mockReloadPage.mockClear();
    mockPosthogRegister.mockClear();
    mockPosthogUnregister.mockClear();
    mockPathname = "/team-001/overview";
  });

  it("reloads only when a real team navigates into the sandbox", () => {
    const { queryByTestId, rerender } = render(tree());
    expect(queryByTestId("page")).not.toBeNull();

    mockPathname = "/team-002/apps";
    rerender(tree());
    expect(queryByTestId("page")).not.toBeNull();
    expect(mockReloadPage).not.toHaveBeenCalled();

    mockPathname = "/sandbox/overview";
    rerender(tree());
    expect(queryByTestId("page")).toBeNull();
    expect(mockReloadPage).toHaveBeenCalledTimes(1);
  });

  it("reloads only when the sandbox navigates to a real route", () => {
    mockPathname = "/sandbox/overview";
    const { queryByTestId, rerender } = render(tree());
    expect(queryByTestId("page")).not.toBeNull();

    mockPathname = "/sandbox/errors";
    rerender(tree());
    expect(queryByTestId("page")).not.toBeNull();
    expect(mockReloadPage).not.toHaveBeenCalled();

    mockPathname = "/auth/login";
    rerender(tree());
    expect(queryByTestId("page")).toBeNull();
    expect(mockReloadPage).toHaveBeenCalledTimes(1);
  });
});

describe("ClientProviders PostHog sandbox tag", () => {
  beforeEach(() => {
    mockPosthogRegister.mockClear();
    mockPosthogUnregister.mockClear();
    mockPosthogResetGroups.mockClear();
  });

  it("tags sandbox events and clears a real team's group on a sandbox path", () => {
    mockPathname = "/sandbox/overview";
    render(tree());

    expect(mockPosthogRegister).toHaveBeenCalledWith({ sandbox: true });
    expect(mockPosthogResetGroups).toHaveBeenCalledTimes(1);
    expect(mockPosthogUnregister).not.toHaveBeenCalled();
  });

  it("drops the sandbox tag and keeps the team group on a real team path", () => {
    mockPathname = "/team-001/overview";
    render(tree());

    expect(mockPosthogUnregister).toHaveBeenCalledWith("sandbox");
    expect(mockPosthogRegister).not.toHaveBeenCalled();
    expect(mockPosthogResetGroups).not.toHaveBeenCalled();
  });
});
