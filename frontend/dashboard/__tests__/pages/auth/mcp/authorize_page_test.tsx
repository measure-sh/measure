import { promiseParams } from "@/__tests__/helpers/promise_params";
import McpAuthorize from "@/app/auth/mcp/authorize/page";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, ...props }: any) => <img alt={alt} {...props} />,
}));

jest.mock("@/app/utils/env_utils", () => ({ isCloud: () => false }));

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

const query = {
  response_type: "code",
  client_id: "https://claude.ai/meta.json",
  redirect_uri: "http://localhost:9999/cb",
  state: "client-state",
  code_challenge: "challenge",
  resource: "https://agent.example.com/mcp",
};

const details = {
  client_name: "Claude",
  client_host: "claude.ai",
  redirect_host: "localhost",
  redirect_uri: "http://localhost:9999/cb",
  redirect_is_loopback: true,
};

async function renderPage(searchParams: Record<string, string> = query) {
  const ui = await McpAuthorize({ searchParams: promiseParams(searchParams) });
  return render(ui);
}

function detailsReply(body: object, ok = true) {
  mockFetch.mockResolvedValueOnce({ ok, json: () => Promise.resolve(body) });
}

describe("MCP authorize page", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.AGENT_BASE_URL = "https://agent.example.com";
  });

  it("fetches details uncached & renders client, redirect host & loopback warning", async () => {
    detailsReply(details);
    await renderPage();

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("https://agent.example.com/oauth/authorize/details?");
    expect(init).toEqual({ cache: "no-store" });
    expect(
      screen.getByText("Claude wants to access your Measure account"),
    ).toBeInTheDocument();
    expect(screen.getByText("localhost")).toBeInTheDocument();
    expect(screen.getByText(/runs on this computer/)).toBeInTheDocument();
  });

  it("renders the full redirect URI truncated at 200 chars", async () => {
    detailsReply(details);
    const first = await renderPage();
    expect(screen.getByText("http://localhost:9999/cb")).toBeInTheDocument();
    first.unmount();

    detailsReply({
      ...details,
      redirect_uri: "https://a.example/" + "p".repeat(300),
    });
    await renderPage();
    expect(
      screen.getByText(
        `${("https://a.example/" + "p".repeat(300)).slice(0, 200)}…`,
      ),
    ).toBeInTheDocument();
  });

  it("falls back to the client host then a generic name & truncates long names", async () => {
    detailsReply({ ...details, client_name: "" });
    const first = await renderPage();
    expect(screen.getByText(/^claude.ai wants/)).toBeInTheDocument();
    first.unmount();

    detailsReply({ ...details, client_name: "x".repeat(100) });
    await renderPage();
    expect(
      screen.getByText(
        `${"x".repeat(60)}… wants to access your Measure account`,
      ),
    ).toBeInTheDocument();
  });

  it("Allow reveals provider forms carrying the hidden params", async () => {
    detailsReply({ ...details, redirect_is_loopback: false });
    const { container } = await renderPage();
    expect(screen.queryByText(/runs on this computer/)).not.toBeInTheDocument();
    expect(screen.queryByText("Continue with GitHub")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Allow"));

    expect(screen.getByText("Shares your email address")).toBeInTheDocument();
    expect(
      screen.getByText("Shares your name & email address"),
    ).toBeInTheDocument();
    const form = screen
      .getByText("Continue with GitHub")
      .closest("form") as HTMLFormElement;
    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("action", "/auth/mcp/consent");
    const fields = Object.fromEntries(new FormData(form).entries());
    expect(fields).toEqual({
      ...query,
      decision: "allow",
      provider: "github",
    });
    expect(container.querySelectorAll("form")).toHaveLength(2);
  });

  it("Deny is a form posting decision=deny", async () => {
    detailsReply(details);
    await renderPage();

    const form = screen.getByText("Deny").closest("form") as HTMLFormElement;
    expect(Object.fromEntries(new FormData(form).entries())).toEqual({
      ...query,
      decision: "deny",
    });
  });

  it.each([
    ["agent rejection", () => detailsReply({ error: "x" }, false), query],
    ["error=1", () => {}, { ...query, error: "1" }],
  ])("shows the invalid message on %s", async (_label, setup, params) => {
    setup();
    await renderPage(params);

    expect(
      screen.getByText(/This sign-in link is invalid or expired/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Allow")).not.toBeInTheDocument();
  });
});
