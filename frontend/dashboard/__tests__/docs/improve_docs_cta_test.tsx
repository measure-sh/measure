/**
 * Pins the improve-docs call to action: the issue link must name the docs
 * issue template (a bare ?title= link loses the title on the template
 * chooser) and prefill the title with the page path, and a click emits
 * the docs_action_click event shared with the other docs actions.
 */
import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("@/app/utils/analytics/track", () => ({
  track: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  __esModule: true,
  usePathname: () => "/docs/hosting/slack",
}));

import { track } from "@/app/utils/analytics/track";
import { ImproveDocsCta } from "@/app/docs/components/improve_docs_cta";

describe("ImproveDocsCta", () => {
  it("links to a new issue with the docs template and page title", () => {
    render(<ImproveDocsCta />);

    const link = screen.getByRole("link", { name: /open an issue/i });
    const url = new URL(link.getAttribute("href")!);

    expect(url.origin + url.pathname).toBe(
      "https://github.com/measure-sh/measure/issues/new",
    );
    expect(url.searchParams.get("template")).toBe("docs_improvement.md");
    expect(url.searchParams.get("title")).toBe(
      "Improve doc: /docs/hosting/slack",
    );
    expect(url.searchParams.get("body")).toBe(
      "**Page**\n\nhttps://measure.sh/docs/hosting/slack\n\n**What could be better?**\n",
    );
    expect(url.searchParams.get("labels")).toBe("docs");
  });

  it("tracks the click as a docs action", () => {
    render(<ImproveDocsCta />);

    fireEvent.click(screen.getByRole("link", { name: /open an issue/i }));

    expect(track).toHaveBeenCalledWith("docs_action_click", {
      action: "open_issue",
      doc_section: "hosting",
    });
  });
});
