import GitHubSignIn from "@/app/auth/login/github-sign-in";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

const mockSignInWithGitHub = jest.fn();
jest.mock("@/app/auth/oauth", () => ({
  __esModule: true,
  signInWithGitHub: (...args: any[]) => mockSignInWithGitHub(...args),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, ...props }: any) => <img alt={alt} {...props} />,
}));

const mockAssign = jest.fn();
Object.defineProperty(window, "location", {
  value: {
    ...window.location,
    assign: mockAssign,
    href: "http://localhost:3000/auth/login",
  },
  writable: true,
});

jest.spyOn(console, "error").mockImplementation(() => {});

describe("GitHubSignIn", () => {
  beforeEach(() => {
    mockAssign.mockClear();
    mockSignInWithGitHub.mockReset();
    mockSignInWithGitHub.mockResolvedValue({
      url: new URL("https://github.com/login/oauth/authorize?test=1"),
      error: undefined,
    });
  });

  it("renders sign in with GitHub button", () => {
    render(<GitHubSignIn />);
    expect(screen.getByText("Sign in with GitHub")).toBeInTheDocument();
  });

  it("renders GitHub logo images", () => {
    render(<GitHubSignIn />);
    const logos = screen.getAllByAltText("GitHub logo");
    expect(logos.length).toBe(2); // black and white variants
  });

  it("MCP mode redirects to mcpAuthorizeUrl on click", () => {
    const mcpUrl =
      "https://api.example.com/oauth/authorize?provider=github&client_id=test";
    render(<GitHubSignIn mcpAuthorizeUrl={mcpUrl} />);
    fireEvent.click(screen.getByText("Sign in with GitHub"));

    expect(mockAssign).toHaveBeenCalledWith(mcpUrl);
  });

  it("MCP mode does not call signInWithGitHub", () => {
    const mcpUrl =
      "https://api.example.com/oauth/authorize?provider=github&client_id=test";
    render(<GitHubSignIn mcpAuthorizeUrl={mcpUrl} />);
    fireEvent.click(screen.getByText("Sign in with GitHub"));

    expect(mockSignInWithGitHub).not.toHaveBeenCalled();
  });

  it("normal mode calls signInWithGitHub on click", () => {
    render(<GitHubSignIn />);
    fireEvent.click(screen.getByText("Sign in with GitHub"));

    expect(mockSignInWithGitHub).toHaveBeenCalled();
  });

  it("normal mode does not redirect when signInWithGitHub returns error", async () => {
    mockSignInWithGitHub.mockResolvedValueOnce({
      url: undefined,
      error: new Error("something went wrong"),
    });

    render(<GitHubSignIn />);
    fireEvent.click(screen.getByText("Sign in with GitHub"));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockAssign).not.toHaveBeenCalled();
  });

  it("normal mode redirects to GitHub OAuth URL", async () => {
    mockSignInWithGitHub.mockResolvedValueOnce({
      url: new URL("https://github.com/login/oauth/authorize?client_id=test"),
      error: undefined,
    });

    render(<GitHubSignIn />);
    fireEvent.click(screen.getByText("Sign in with GitHub"));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockAssign).toHaveBeenCalledTimes(1);
    const url = new URL(mockAssign.mock.calls[0][0]);
    expect(url.origin).toBe("https://github.com");
    expect(url.pathname).toBe("/login/oauth/authorize");
  });
});
