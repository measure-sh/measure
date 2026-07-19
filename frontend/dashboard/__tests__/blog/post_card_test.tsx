import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render } from "@testing-library/react";

import {
  PostCard,
  type BlogPostSummary,
} from "@/app/blog/components/post_card";

function summary(overrides?: Partial<BlogPostSummary>): BlogPostSummary {
  return {
    url: "/blog/mobile-breaks-differently",
    slug: "mobile-breaks-differently",
    title: "Mobile breaks differently",
    description: "Why mobile observability is its own discipline.",
    authorName: "Anup Cowkur",
    dateISO: "2026-04-17",
    dateFormatted: "April 17, 2026",
    tags: ["observability"],
    ...overrides,
  };
}

describe("PostCard", () => {
  it("renders the hero image when the summary has one", () => {
    const { container } = render(
      <PostCard post={summary({ image: "/blog/assets/mobile-hero.webp" })} />,
    );

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(decodeURIComponent(img!.getAttribute("src") ?? "")).toContain(
      "/blog/assets/mobile-hero.webp",
    );
  });

  it("renders no image element when the summary has none", () => {
    const { container } = render(<PostCard post={summary()} />);

    expect(container.querySelector("img")).toBeNull();
  });

  it("links the title to the post and each tag to its tag page", () => {
    const { getByRole } = render(<PostCard post={summary()} />);

    expect(
      getByRole("link", { name: "Mobile breaks differently" }),
    ).toHaveAttribute("href", "/blog/mobile-breaks-differently");
    expect(getByRole("link", { name: "observability" })).toHaveAttribute(
      "href",
      "/blog/tags/observability",
    );
  });
});
