import { promiseParams } from "@/__tests__/helpers/promise_params";
import ConfirmMailingList from "@/app/mailing_list/confirm/page";
import { ApiError } from "@/app/api/api_error";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";

const mockMutate = jest.fn();
let mockState: { isSuccess: boolean; isError: boolean; error: unknown } = {
  isSuccess: false,
  isError: false,
  error: null,
};

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useConfirmMailingListMutation: () => ({
    mutate: mockMutate,
    isPending: false,
    ...mockState,
  }),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt} />,
}));

jest.mock("@/app/components/button", () => ({
  Button: ({ children, loading, disabled, ...props }: any) => (
    <button disabled={disabled || loading} {...props}>
      {children}
    </button>
  ),
}));

async function renderPage(params: Record<string, string>) {
  await act(async () => {
    render(<ConfirmMailingList searchParams={promiseParams(params)} />);
  });
}

describe("Mailing list confirm page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState = { isSuccess: false, isError: false, error: null };
  });

  it("waits for a click before confirming", async () => {
    await renderPage({ token: "tok_123" });

    expect(mockMutate).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Confirm subscription" }),
    );

    expect(mockMutate).toHaveBeenCalledWith("tok_123");
  });

  it("refuses a link without a token", async () => {
    await renderPage({});

    expect(
      screen.getByRole("button", { name: "Confirm subscription" }),
    ).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This confirmation link is invalid.",
    );
  });

  it("shows why the server refused the link", async () => {
    mockState = {
      isSuccess: false,
      isError: true,
      error: new ApiError(
        400,
        "This confirmation link has expired. Please subscribe again.",
      ),
    };
    await renderPage({ token: "tok_old" });

    expect(screen.getByRole("alert")).toHaveTextContent("has expired");
    expect(
      screen.getByRole("link", { name: "Subscribe from the blog" }),
    ).toHaveAttribute("href", "/blog");
  });

  it("confirms the subscription once the server accepts", async () => {
    mockState = { isSuccess: true, isError: false, error: null };
    await renderPage({ token: "tok_123" });

    expect(screen.getByRole("status")).toHaveTextContent("You're subscribed");
    expect(
      screen.queryByRole("button", { name: "Confirm subscription" }),
    ).toBeNull();
  });
});
