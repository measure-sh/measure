"use client";

import { buttonVariants } from "@/app/components/button_variants";
import { Input } from "@/app/components/input";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/app/components/sidebar";
import { ThemeToggle } from "@/app/components/theme_toggle";
import { buildClusters, docsNav, type NavItem } from "@/app/docs/docs_nav";
import { cn } from "@/app/utils/shadcn_utils";
import { accentGreenTextStyle } from "@/app/utils/shared_styles";
import { ChevronRight, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import DocsSearch from "./docs_search";

// Rows are plain text: muted by default, full-strength on hover, and the
// active page in brand green. The text-shadow fakes a bolder weight without
// changing glyph widths, so rows don't reflow when the active page changes.
const activeRowClass = cn(
  accentGreenTextStyle,
  "[text-shadow:-0.2px_0_0_currentColor,0.2px_0_0_currentColor]",
);
const idleRowClass = "text-muted-foreground hover:text-foreground";

// Nested rows indent one step per level below a group's children.
function depthClass(depth: number): string | undefined {
  if (depth === 1) {
    return "pl-3";
  }
  if (depth >= 2) {
    return "pl-6";
  }
  return undefined;
}

function NavLeafRow({ item, depth }: { item: NavItem; depth: number }) {
  const pathname = usePathname();
  const isActive = item.slug === pathname;
  const linkRef = useRef<HTMLAnchorElement>(null);

  // The sidebar doesn't scroll on its own when navigation comes from
  // elsewhere (prev/next links, search, deep links), so the row that just
  // became active brings itself into view.
  useEffect(() => {
    if (isActive) {
      linkRef.current?.scrollIntoView?.({ block: "nearest" });
    }
  }, [isActive]);

  return (
    <Link
      ref={linkRef}
      href={item.slug || "/docs"}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-start break-words py-1.5 leading-snug transition-colors",
        depthClass(depth),
        isActive ? activeRowClass : idleRowClass,
      )}
    >
      {item.title}
    </Link>
  );
}

function CollapsibleNavGroup({
  item,
  depth,
}: {
  item: NavItem;
  depth: number;
}) {
  const pathname = usePathname();
  const isChildActive = hasChildActive(item, pathname);
  const [isOpen, setIsOpen] = useState(isChildActive);

  // Re-expand when client-side navigation makes a child the active page — the
  // sidebar persists across docs routes, so the useState seed alone would stay
  // stale.
  const [prevChildActive, setPrevChildActive] = useState(isChildActive);
  if (isChildActive !== prevChildActive) {
    setPrevChildActive(isChildActive);
    if (isChildActive) {
      setIsOpen(true);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center gap-1 py-1.5 text-left leading-snug transition-colors",
          depthClass(depth),
          idleRowClass,
        )}
      >
        <span className="flex-1 break-words">{item.title}</span>
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform",
            isOpen && "rotate-90",
          )}
          aria-hidden="true"
        />
      </button>
      {isOpen && (
        <div className="flex flex-col">
          {item.children!.map((child) => (
            <NavNode
              key={child.slug || child.title}
              item={child}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NavNode({ item, depth }: { item: NavItem; depth: number }) {
  if (item.children && item.children.length > 0) {
    return <CollapsibleNavGroup item={item} depth={depth} />;
  }
  return <NavLeafRow item={item} depth={depth} />;
}

function hasChildActive(item: NavItem, pathname: string): boolean {
  if (item.slug === pathname) {
    return true;
  }
  if (item.children) {
    return item.children.some((child) => hasChildActive(child, pathname));
  }
  return false;
}

export default function DocsAppSidebar() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <>
      {/* border-sidebar-border lightens the divider in light mode
          (#e7e7e7 vs the default #d8d8d8); dark keeps the regular border. */}
      <Sidebar
        variant="sidebar"
        className="select-none border-sidebar-border dark:border-border"
      >
        <SidebarHeader className="px-4">
          <div className="flex items-center justify-between my-2">
            <Link
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "group/logo py-2 px-0 pr-1",
              )}
              href="/"
            >
              <Image
                src="/images/measure_logo_horizontal_black.svg"
                width={120}
                height={40}
                alt="Measure logo"
                className="dark:hidden"
              />
              <Image
                src="/images/measure_logo_horizontal_white.svg"
                width={120}
                height={40}
                alt="Measure logo"
                className="hidden dark:block"
              />
            </Link>
            <ThemeToggle />
          </div>
          <div
            className="relative cursor-pointer"
            onClick={() => setIsSearchOpen(true)}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              readOnly
              placeholder="Search docs..."
              className="h-8 cursor-pointer rounded-lg pl-9 pr-12 font-body text-sm focus-visible:ring-0"
              onFocus={(e) => {
                e.target.blur();
                setIsSearchOpen(true);
              }}
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 font-sans text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded pointer-events-none">
              &#8984;K
            </kbd>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <nav
            aria-label="Docs"
            className="flex flex-col px-4 pb-8 pt-2 font-body text-sm"
          >
            {buildClusters([
              { title: "Overview", slug: "/docs" },
              ...docsNav,
            ]).map((cluster, i) => (
              <div
                key={cluster.label ?? `pages-${i}`}
                className={i > 0 ? "mt-7" : undefined}
              >
                {cluster.label !== undefined && (
                  <p className="mb-2 text-xs font-semibold text-foreground">
                    {cluster.label}
                  </p>
                )}
                <div className="flex flex-col">
                  {cluster.items.map((item) => (
                    <NavNode
                      key={item.slug || item.title}
                      item={item}
                      depth={0}
                    />
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </SidebarContent>
      </Sidebar>

      <DocsSearch open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </>
  );
}
