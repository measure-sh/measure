"use client";

import { buttonVariants } from "@/app/components/button";
import { Input } from "@/app/components/input";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/app/components/sidebar";
import { ThemeToggle } from "@/app/components/theme_toggle";
import { docsNav, type NavItem } from "@/app/docs/docs_nav";
import { cn } from "@/app/utils/shadcn_utils";
import { ChevronRight, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import DocsSearch from "./docs_search";

function NavSection({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const hasChildren = item.children && item.children.length > 0;
  const isChildActive = hasChildren && hasChildActive(item, pathname);

  if (!hasChildren) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={item.slug === pathname} className="h-auto py-2">
          <Link href={item.slug || "/docs"} className="font-body whitespace-normal">
            {item.title}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <CollapsibleNavItem item={item} defaultOpen={isChildActive || false} />
  );
}

function CollapsibleNavItem({
  item,
  defaultOpen,
}: {
  item: NavItem;
  defaultOpen: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => setIsOpen(!isOpen)}
        className="font-body h-auto py-2 whitespace-normal"
      >
        {item.title}
        <ChevronRight
          className={cn(
            "ml-auto transition-transform",
            isOpen && "rotate-90"
          )}
        />
      </SidebarMenuButton>
      {isOpen && (
        <SidebarMenuSub className="mx-2 px-2">
          {item.children!.map((child) => (
            <NavSubItem key={child.slug || child.title} item={child} />
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

function NavSubItem({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const hasChildren = item.children && item.children.length > 0;

  if (hasChildren) {
    const isChildActive = hasChildActive(item, pathname);
    return (
      <CollapsibleSubItem
        item={item}
        defaultOpen={isChildActive || false}
      />
    );
  }

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild isActive={item.slug === pathname} className="h-auto py-1">
        <Link href={item.slug || "/docs"} className="font-body whitespace-normal">
          {item.title}
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

function CollapsibleSubItem({
  item,
  defaultOpen,
}: {
  item: NavItem;
  defaultOpen: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild className="h-auto py-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="font-body whitespace-normal"
        >
          {item.title}
          <ChevronRight
            className={cn(
              "ml-auto transition-transform",
              isOpen && "rotate-90"
            )}
          />
        </button>
      </SidebarMenuSubButton>
      {isOpen && (
        <SidebarMenuSub className="mx-2 px-2">
          {item.children!.map((child) => (
            <NavSubItem key={child.slug || child.title} item={child} />
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuSubItem>
  );
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
  const pathname = usePathname();
  const isDocsIndex = pathname === "/docs";
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <>
      <Sidebar variant="sidebar" className="select-none">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center justify-between my-2">
                <Link
                  className={cn(buttonVariants({ variant: "ghost" }), "group/logo py-2")}
                  href="/"
                >
                  <Image
                    src="/images/measure_logo_horizontal_black.svg"
                    width={120}
                    height={40}
                    alt="Measure logo"
                    className="dark:hidden group-hover/logo:hidden"
                  />
                  <Image
                    src="/images/measure_logo_horizontal_white.svg"
                    width={120}
                    height={40}
                    alt="Measure logo"
                    className="hidden dark:block group-hover/logo:block"
                  />
                </Link>
                <ThemeToggle />
              </div>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <div
                className="relative cursor-pointer"
                onClick={() => setIsSearchOpen(true)}
              >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  readOnly
                  placeholder="Search docs..."
                  className="pl-9 pr-12 cursor-pointer font-body border-0 shadow-none focus-visible:ring-0"
                  onFocus={(e) => {
                    e.target.blur();
                    setIsSearchOpen(true);
                  }}
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded pointer-events-none">&#8984;K</kbd>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isDocsIndex}>
                  <Link href="/docs" className="font-body">
                    Overview
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {docsNav.map((item) => (
                <NavSection key={item.slug || item.title} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <DocsSearch open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </>
  );
}
