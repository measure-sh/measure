import DocsNavLinks from "@/app/docs/components/docs_nav_links";
import { docsNav, getFlatNavSlugs } from "@/app/docs/docs_nav";
import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import "@testing-library/jest-dom/jest-globals";
import { render, screen } from "@testing-library/react";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("DocsNavLinks", () => {
  it("renders nothing for an unknown slug", () => {
    const { container } = render(
      <DocsNavLinks currentSlug="/docs/nonexistent" />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("renders only next link on the first page (/docs)", () => {
    render(<DocsNavLinks currentSlug="/docs" />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);

    // Next link should point to the second page in nav order
    expect(links[0]).toHaveAttribute("href", getFlatNavSlugs()[1]);
    expect(links[0].textContent).toBeTruthy();
    expect(links[0].textContent).not.toContain("Documentation");
  });

  it("renders only previous link on the last page", () => {
    const flatSlugs = getFlatNavSlugs();
    const lastSlug = flatSlugs[flatSlugs.length - 1];
    render(<DocsNavLinks currentSlug={lastSlug} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);

    // Should be a previous link (no next)
    const linkHref = links[0].getAttribute("href");
    expect(linkHref).toBeTruthy();
    expect(linkHref).not.toBe(lastSlug);
  });

  it("renders both previous and next links for a middle page", () => {
    // Any slug that is neither first nor last in the nav order works here
    const flatSlugs = getFlatNavSlugs();
    const middleSlug = flatSlugs[Math.floor(flatSlugs.length / 2)];
    render(<DocsNavLinks currentSlug={middleSlug} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
  });

  it("shows correct previous and next titles", () => {
    // The second page's previous link is the docs root, whose "Overview"
    // title is a component constant rather than a nav title
    const flatSlugs = getFlatNavSlugs();
    render(<DocsNavLinks currentSlug={flatSlugs[1]} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);

    expect(links[0]).toHaveTextContent("Overview");
    expect(links[0]).toHaveAttribute("href", "/docs");

    expect(links[1]).toHaveAttribute("href", flatSlugs[2]);
    expect(links[1].textContent).toBeTruthy();
    expect(links[1].textContent).not.toContain("Documentation");
  });

  it("resolves nested nav item titles correctly", () => {
    // A leaf two levels deep exercises the recursive title lookup
    const outerGroup = docsNav.find((item) =>
      (item.children ?? []).some((child) => (child.children ?? []).length > 0),
    );
    expect(outerGroup).toBeDefined();
    const nestedGroup = outerGroup!.children!.find(
      (child) => (child.children ?? []).length > 0,
    );
    const nestedLeaf = nestedGroup!.children!.find((child) => child.slug);
    expect(nestedLeaf).toBeDefined();

    render(<DocsNavLinks currentSlug={nestedLeaf!.slug!} />);

    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(1);

    // Verify that link text is a real title, not "Documentation" fallback
    for (const link of links) {
      expect(link.textContent).not.toContain("Documentation");
    }
  });
});
