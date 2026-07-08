import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

let mockPathname = "/docs";

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, className, ...props }: any) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, ...props }: any) => <img alt={alt} {...props} />,
}));

jest.mock("lucide-react", () => ({
  ChevronRight: ({ className }: any) => (
    <span data-testid="chevron" className={className} />
  ),
  Search: ({ className }: any) => (
    <span data-testid="search-icon" className={className} />
  ),
}));

jest.mock("@/app/components/button", () => ({
  buttonVariants: () => "btn-class",
}));

jest.mock("@/app/components/input", () => ({
  Input: (props: any) => <input {...props} />,
}));

jest.mock("@/app/components/theme_toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

jest.mock("@/app/components/sidebar", () => ({
  Sidebar: ({ children }: any) => <div data-testid="sidebar">{children}</div>,
  SidebarContent: ({ children }: any) => <div>{children}</div>,
  SidebarHeader: ({ children }: any) => (
    <div data-testid="sidebar-header">{children}</div>
  ),
}));

jest.mock("@/app/docs/components/docs_search", () => ({
  __esModule: true,
  default: ({ open }: any) =>
    open ? <div data-testid="docs-search-open" /> : null,
}));

// Mock docsNav with test data that covers all branching: top-level leaf,
// top-level group (always open), nested collapsible group. buildClusters
// stays real so the sidebar clusters the mock data exactly like production.
jest.mock("@/app/docs/docs_nav", () => ({
  ...jest.requireActual("@/app/docs/docs_nav"),
  docsNav: [
    { title: "Getting Started", slug: "/docs/getting-started" },
    {
      title: "Features",
      children: [
        { title: "Crash Reporting", slug: "/docs/features/crash-reporting" },
        { title: "Performance", slug: "/docs/features/performance" },
        {
          title: "Advanced",
          children: [
            {
              title: "Custom Events",
              slug: "/docs/features/advanced/custom-events",
            },
          ],
        },
      ],
    },
  ],
}));

import DocsAppSidebar from "@/app/docs/components/docs_sidebar";

describe("DocsAppSidebar", () => {
  beforeEach(() => {
    mockPathname = "/docs";
  });

  describe("Rendering", () => {
    it("renders sidebar with logo images", () => {
      render(<DocsAppSidebar />);
      const logos = screen.getAllByAltText("Measure logo");
      expect(logos.length).toBe(2);
    });

    it("renders theme toggle", () => {
      render(<DocsAppSidebar />);
      expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
    });

    it("renders Overview link", () => {
      render(<DocsAppSidebar />);
      expect(screen.getByText("Overview")).toBeInTheDocument();
    });

    it("renders search input", () => {
      render(<DocsAppSidebar />);
      expect(screen.getByPlaceholderText("Search docs...")).toBeInTheDocument();
    });

    it("renders leaf nav items as links", () => {
      render(<DocsAppSidebar />);
      const link = screen.getByText("Getting Started");
      expect(link.closest("a")).toHaveAttribute(
        "href",
        "/docs/getting-started",
      );
    });

    it("renders top-level groups as labels with children visible", () => {
      render(<DocsAppSidebar />);
      expect(screen.getByText("Features")).toBeInTheDocument();
      expect(screen.getByText("Crash Reporting")).toBeInTheDocument();
      expect(screen.getByText("Performance")).toBeInTheDocument();
    });

    it("does not render top-level group labels as links", () => {
      render(<DocsAppSidebar />);
      expect(screen.getByText("Features").closest("a")).toBeNull();
    });
  });

  describe("Overview active state", () => {
    it("marks Overview as active when on /docs", () => {
      mockPathname = "/docs";
      render(<DocsAppSidebar />);
      const overviewLink = screen.getByText("Overview").closest("a");
      expect(overviewLink).toHaveAttribute("aria-current", "page");
    });

    it("does not mark Overview as active on other pages", () => {
      mockPathname = "/docs/getting-started";
      render(<DocsAppSidebar />);
      const overviewLink = screen.getByText("Overview").closest("a");
      expect(overviewLink).not.toHaveAttribute("aria-current");
    });
  });

  describe("Active page highlighting", () => {
    it("marks the active page link", () => {
      mockPathname = "/docs/features/crash-reporting";
      render(<DocsAppSidebar />);
      const link = screen.getByText("Crash Reporting").closest("a");
      expect(link).toHaveAttribute("aria-current", "page");
    });

    it("does not mark inactive page links", () => {
      mockPathname = "/docs/features/crash-reporting";
      render(<DocsAppSidebar />);
      const link = screen.getByText("Performance").closest("a");
      expect(link).not.toHaveAttribute("aria-current");
    });
  });

  describe("Nested collapsible groups", () => {
    it("renders nested group collapsed when no child is active", () => {
      render(<DocsAppSidebar />);
      expect(screen.getByText("Advanced")).toBeInTheDocument();
      expect(screen.queryByText("Custom Events")).not.toBeInTheDocument();
    });

    it("expands nested group on click", () => {
      render(<DocsAppSidebar />);
      fireEvent.click(screen.getByText("Advanced"));
      expect(screen.getByText("Custom Events")).toBeInTheDocument();
    });

    it("collapses nested group on second click", () => {
      render(<DocsAppSidebar />);
      fireEvent.click(screen.getByText("Advanced"));
      expect(screen.getByText("Custom Events")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Advanced"));
      expect(screen.queryByText("Custom Events")).not.toBeInTheDocument();
    });

    it("auto-expands nested group when a child is active", () => {
      mockPathname = "/docs/features/advanced/custom-events";
      render(<DocsAppSidebar />);
      expect(screen.getByText("Custom Events")).toBeInTheDocument();
    });

    it("expands a collapsed group when navigation activates a child", () => {
      mockPathname = "/docs";
      const { rerender } = render(<DocsAppSidebar />);
      expect(screen.queryByText("Custom Events")).not.toBeInTheDocument();

      // Client-side navigation: pathname changes, sidebar does not remount
      mockPathname = "/docs/features/advanced/custom-events";
      rerender(<DocsAppSidebar />);
      expect(screen.getByText("Custom Events")).toBeInTheDocument();
    });
  });

  describe("Active row visibility", () => {
    it("scrolls the row that becomes active into view on navigation", () => {
      const scrollSpy = jest.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollSpy;

      mockPathname = "/docs";
      const { rerender } = render(<DocsAppSidebar />);
      scrollSpy.mockClear();

      mockPathname = "/docs/features/crash-reporting";
      rerender(<DocsAppSidebar />);
      expect(scrollSpy).toHaveBeenCalledWith({ block: "nearest" });
    });
  });

  describe("Search", () => {
    it("opens search dialog when search input is clicked", () => {
      render(<DocsAppSidebar />);
      expect(screen.queryByTestId("docs-search-open")).not.toBeInTheDocument();

      const searchContainer = screen
        .getByPlaceholderText("Search docs...")
        .closest("div")!;
      fireEvent.click(searchContainer);
      expect(screen.getByTestId("docs-search-open")).toBeInTheDocument();
    });

    it("opens search dialog when search input is focused", () => {
      render(<DocsAppSidebar />);
      const input = screen.getByPlaceholderText("Search docs...");
      fireEvent.focus(input);
      expect(screen.getByTestId("docs-search-open")).toBeInTheDocument();
    });
  });
});
