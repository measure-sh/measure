import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

// next/image is replaced with a plain img so the avatar's onError handler
// can be triggered with a DOM error event. The fill prop is dropped
// because it is not a valid img attribute.
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ fill, ...props }: any) => <img {...props} />,
}));

jest.mock("@/app/components/button", () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

jest.mock("@/app/components/dropdown_menu", () => ({
  DropdownMenu: ({ children }: any) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: any) => (
    <div data-testid="dropdown-trigger">{children}</div>
  ),
  DropdownMenuContent: ({ children }: any) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({ children, onClick }: any) => (
    <div data-testid="dropdown-item" onClick={onClick}>
      {children}
    </div>
  ),
}));

// The component reads session state from useSessionQuery; each test sets
// the return value directly instead of going through react-query.
const mockUseSessionQuery = jest.fn();
jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useSessionQuery: () => mockUseSessionQuery(),
}));

import UserAvatar from "@/app/components/user_avatar";

const session = {
  user: {
    id: "user-001",
    name: "Test User",
    email: "test@example.com",
    avatar_url: "https://example.com/avatar.png",
  },
};

beforeEach(() => {
  mockUseSessionQuery.mockReturnValue({
    data: session,
    error: null,
    isLoading: false,
  });
});

describe("UserAvatar", () => {
  it("renders user name from session", () => {
    render(<UserAvatar />);
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("renders user email from session", () => {
    render(<UserAvatar />);
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("renders user avatar image", () => {
    render(<UserAvatar />);
    const avatar = screen.getByAltText("User Avatar");
    expect(avatar).toBeInTheDocument();
    expect(avatar.getAttribute("src")).toBe("https://example.com/avatar.png");
  });

  it('shows "Updating..." when session is loading', () => {
    mockUseSessionQuery.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    });
    render(<UserAvatar />);
    expect(screen.getByText("Updating...")).toBeInTheDocument();
    expect(screen.queryByText("Test User")).not.toBeInTheDocument();
  });

  it('shows "Error" when session fetch fails', () => {
    mockUseSessionQuery.mockReturnValue({
      data: undefined,
      error: new Error("session fetch failed"),
      isLoading: false,
    });
    render(<UserAvatar />);
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.queryByText("Test User")).not.toBeInTheDocument();
  });

  it("shows initials from the user name when the avatar image fails to load", () => {
    render(<UserAvatar />);
    fireEvent.error(screen.getByAltText("User Avatar"));
    expect(screen.queryByAltText("User Avatar")).not.toBeInTheDocument();
    // "Test User" produces the initials "TU"
    expect(screen.getByText("TU")).toBeInTheDocument();
  });
});
