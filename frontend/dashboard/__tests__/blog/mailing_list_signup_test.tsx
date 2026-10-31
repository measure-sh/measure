import MailingListSignup from "@/app/blog/components/mailing_list_signup";
import { ApiError } from "@/app/api/api_error";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";

const mockMutate = jest.fn();
let mockIsSuccess = false;
const mockTrack = jest.fn();

jest.mock("@/app/utils/analytics/track", () => ({
  track: (...args: any[]) => mockTrack(...args),
}));

jest.mock("next/navigation", () => ({
  usePathname: () => "/blog/a-post",
}));

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useSubscribeToMailingListMutation: () => ({
    mutate: mockMutate,
    isPending: false,
    isSuccess: mockIsSuccess,
  }),
}));

jest.mock("@/app/components/button", () => ({
  Button: ({ children, loading, disabled, ...props }: any) => (
    <button disabled={disabled || loading} {...props}>
      {children}
    </button>
  ),
}));

async function submit(email: string) {
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: email },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
  });
}

describe("MailingListSignup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSuccess = false;
  });

  it("subscribes the address and tracks the click", async () => {
    render(<MailingListSignup attribution="blog" />);

    await submit("ada@example.com");

    expect(mockMutate).toHaveBeenCalledWith(
      { email: "ada@example.com", attribution: "blog" },
      expect.anything(),
    );
    expect(mockTrack).toHaveBeenCalledWith("blog_action_click", {
      action: "subscribe",
      blog_section: expect.anything(),
    });
  });

  it("shows the server's reason when it refuses", async () => {
    mockMutate.mockImplementation((_params: any, opts: any) =>
      opts.onError(
        new ApiError(429, "Too many attempts. Please try again tomorrow."),
      ),
    );
    render(<MailingListSignup attribution="blog" />);

    await submit("ada@example.com");

    expect(screen.getByRole("alert")).toHaveTextContent("Too many attempts");
  });

  it("shows a general error when the request fails", async () => {
    mockMutate.mockImplementation((_params: any, opts: any) =>
      opts.onError(new Error("network")),
    );
    render(<MailingListSignup attribution="blog" />);

    await submit("ada@example.com");

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("asks the visitor to check their inbox once sent", () => {
    mockIsSuccess = true;
    render(<MailingListSignup attribution="blog" />);

    expect(screen.getByRole("status")).toHaveTextContent(/Check your inbox/);
    expect(screen.queryByRole("button", { name: "Subscribe" })).toBeNull();
  });
});
