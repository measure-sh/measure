import PostFooter from "@/app/blog/components/post_footer";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

let mockIsCloud = true;

jest.mock("@/app/utils/env_utils", () => ({
  __esModule: true,
  isCloud: () => mockIsCloud,
}));

jest.mock("@/app/blog/components/mailing_list_signup", () => ({
  __esModule: true,
  default: () => <form aria-label="Newsletter signup" />,
}));

describe("PostFooter", () => {
  beforeEach(() => {
    mockIsCloud = true;
  });

  it("invites readers to subscribe on Measure cloud", () => {
    render(<PostFooter />);

    expect(screen.getByText(/Thanks for reading!/)).toHaveTextContent(
      "If you enjoyed this post, subscribe to the Measure newsletter to get the next one in your inbox.",
    );
    expect(
      screen.getByRole("form", { name: "Newsletter signup" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
  });

  it("shows only the thanks note when self-hosted", () => {
    mockIsCloud = false;
    render(<PostFooter />);

    expect(screen.getByText(/Thanks for reading!/)).not.toHaveTextContent(
      "subscribe",
    );
    expect(
      screen.queryByRole("form", { name: "Newsletter signup" }),
    ).toBeNull();
  });
});
