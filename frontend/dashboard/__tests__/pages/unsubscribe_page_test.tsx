import { promiseParams } from "@/__tests__/helpers/promise_params";
import { ApiError } from "@/app/api/api_error";
import Unsubscribe from "@/app/unsubscribe/page";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";

const mockMutate = jest.fn();
let mockLink: { id: string; sig: string } | null = null;
let mockQuery: any;
let mockMutation: any;

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useMailingListLinkSubscriptionsQuery: (link: { id: string; sig: string }) => {
    mockLink = link;
    return mockQuery;
  },
  useUnsubscribeFromMailingListMutation: () => ({
    mutate: mockMutate,
    ...mockMutation,
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

function lists(subscribed: boolean) {
  return {
    isSuccess: true,
    isError: false,
    error: null,
    data: {
      lists: [
        { list_id: "newsletter", name: "Measure newsletter", subscribed },
      ],
    },
  };
}

const link = { id: "sub-1", sig: "sig", list: "newsletter" };

async function renderPage(params: Record<string, string>) {
  await act(async () => {
    render(<Unsubscribe searchParams={promiseParams(params)} />);
  });
}

describe("Unsubscribe page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery = lists(true);
    mockMutation = { isPending: false, isSuccess: false, isError: false };
  });

  it("names the list from the link and waits for a click before unsubscribing", async () => {
    await renderPage(link);

    expect(mockLink).toEqual({ id: "sub-1", sig: "sig" });
    expect(
      screen.getByText("Unsubscribe from the Measure newsletter"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "blog" })).toHaveAttribute(
      "href",
      "/blog",
    );
    expect(mockMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Unsubscribe" }));

    expect(mockMutate).toHaveBeenCalledWith("newsletter");
  });

  it("says the reader is unsubscribed once the server accepts", async () => {
    mockMutation = { isPending: false, isSuccess: true, isError: false };
    await renderPage(link);

    expect(screen.getByRole("status")).toHaveTextContent("You're unsubscribed");
    expect(screen.getByRole("status")).toHaveTextContent(
      "You won't get the Measure newsletter anymore.",
    );
    expect(screen.queryByRole("button", { name: "Unsubscribe" })).toBeNull();
  });

  it("says the reader is unsubscribed when they already were", async () => {
    mockQuery = lists(false);
    await renderPage(link);

    expect(screen.getByRole("status")).toHaveTextContent("You're unsubscribed");
    expect(screen.queryByRole("button", { name: "Unsubscribe" })).toBeNull();
  });

  it("refuses a link without a signature or with an unknown list", async () => {
    for (const params of [
      { id: "sub-1", list: "newsletter" },
      { ...link, list: "weekly" },
    ]) {
      await renderPage(params);

      expect(screen.getByRole("alert")).toHaveTextContent(
        "This unsubscribe link is invalid.",
      );
      expect(screen.queryByRole("button", { name: "Unsubscribe" })).toBeNull();
      document.body.innerHTML = "";
    }
  });

  it("shows why the server refused the link", async () => {
    mockQuery = {
      isSuccess: false,
      isError: true,
      error: new ApiError(400, "This unsubscribe link is invalid."),
    };
    await renderPage(link);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This unsubscribe link is invalid.",
    );
  });

  it("keeps the button when unsubscribing fails", async () => {
    mockMutation = {
      isPending: false,
      isSuccess: false,
      isError: true,
      error: new Error("network"),
    };
    await renderPage(link);

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(
      screen.getByRole("button", { name: "Unsubscribe" }),
    ).toBeInTheDocument();
  });
});
