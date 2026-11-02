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

// The fake check passes as soon as it renders, unless a test says it has not
// finished yet.
let mockTurnstileToken: string | null = "turnstile-token";
const mockTurnstileReset = jest.fn();
let mockTurnstileProps: any;

jest.mock("@/app/components/turnstile", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: React.forwardRef((props: any, ref: any) => {
      const { onToken } = props;
      mockTurnstileProps = props;
      React.useImperativeHandle(ref, () => ({ reset: mockTurnstileReset }));
      React.useEffect(() => onToken(mockTurnstileToken), [onToken]);
      return null;
    }),
  };
});

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

const props = {
  title: "Subscribe to the Measure newsletter",
  description: "Once a month, we'll share what we shipped.",
  attribution: "blog",
  turnstileSiteKey: "site-key",
};

describe("MailingListSignup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSuccess = false;
    mockTurnstileToken = "turnstile-token";
  });

  it("subscribes the address with the Turnstile token and tracks the click", async () => {
    render(<MailingListSignup {...props} />);

    await submit("ada@example.com");

    expect(mockMutate).toHaveBeenCalledWith(
      {
        email: "ada@example.com",
        attribution: "blog",
        turnstileToken: "turnstile-token",
      },
      expect.anything(),
    );
    expect(mockTrack).toHaveBeenCalledWith("blog_action_click", {
      action: "subscribe",
      blog_section: expect.anything(),
    });
  });

  it("waits for the Turnstile check before subscribing", async () => {
    mockTurnstileToken = null;
    render(<MailingListSignup {...props} />);

    await submit("ada@example.com");

    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Checking your browser",
    );
  });

  it("asks the visitor to tick the checkbox when Cloudflare shows it, and clears the message once the check passes", async () => {
    mockTurnstileToken = null;
    render(<MailingListSignup {...props} />);

    act(() => mockTurnstileProps.onCheckShown());
    await submit("ada@example.com");

    expect(screen.getByRole("alert")).toHaveTextContent(
      'Tick "Verify you are human" below, then subscribe.',
    );

    act(() => mockTurnstileProps.onToken("turnstile-token"));

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the server's reason when it refuses, and gets a fresh token", async () => {
    mockMutate.mockImplementation((_params: any, opts: any) =>
      opts.onError(
        new ApiError(400, "We couldn't verify you're human. Please try again."),
      ),
    );
    render(<MailingListSignup {...props} />);

    await submit("ada@example.com");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't verify you're human",
    );
    expect(mockTurnstileReset).toHaveBeenCalledTimes(1);

    // The fresh token that follows the reset leaves the server's reason up.
    act(() => mockTurnstileProps.onToken("fresh-token"));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't verify you're human",
    );
  });

  it("shows a general error when the request fails", async () => {
    mockMutate.mockImplementation((_params: any, opts: any) =>
      opts.onError(new Error("network")),
    );
    render(<MailingListSignup {...props} />);

    await submit("ada@example.com");

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("asks the visitor to check their inbox once sent", () => {
    mockIsSuccess = true;
    render(<MailingListSignup {...props} />);

    expect(screen.getByRole("status")).toHaveTextContent(/Check your inbox/);
    expect(screen.queryByRole("button", { name: "Subscribe" })).toBeNull();
    expect(screen.queryByRole("heading", { name: props.title })).toBeNull();
    expect(screen.queryByText(props.description)).toBeNull();
  });
});
