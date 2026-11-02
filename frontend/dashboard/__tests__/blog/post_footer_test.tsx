import PostFooter from "@/app/blog/components/post_footer";
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

jest.mock("@/app/blog/components/mailing_list_signup", () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => (
    <form aria-label="Newsletter signup">
      <h2>{title}</h2>
    </form>
  ),
}));

describe("PostFooter", () => {
  const originalSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
  });

  afterEach(() => {
    if (originalSiteKey === undefined) {
      delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    } else {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalSiteKey;
    }
  });

  it("invites readers to subscribe when Turnstile is set up", () => {
    render(<PostFooter />);

    expect(
      screen.getByRole("heading", {
        name: "Subscribe to the Measure newsletter",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("form", { name: "Newsletter signup" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Thanks for reading!/)).toBeNull();
  });

  it("shows only the thanks note without a Turnstile site key", () => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    render(<PostFooter />);

    expect(screen.getByText(/Thanks for reading!/)).toBeInTheDocument();
    expect(screen.queryByRole("heading")).toBeNull();
    expect(
      screen.queryByRole("form", { name: "Newsletter signup" }),
    ).toBeNull();
  });
});
