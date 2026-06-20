"use client";

import { buttonVariants } from "@/app/components/button_variants";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/app/components/sidebar";
import { cn } from "@/app/utils/shadcn_utils";
import { track } from "@/app/utils/analytics/track";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import DocsAppSidebar from "./components/docs_sidebar";

function deriveDocSection(pathname: string): string {
  // Drop leading "/docs" and any trailing slash to get the in-docs path.
  // "/docs/android/quickstart" -> first segment "android"; "/docs" or "/docs/"
  // -> "index" so we can distinguish the landing doc from individual sections.
  const trimmed = pathname.replace(/^\/docs\/?/, "").replace(/\/$/, "");
  if (trimmed === "") {
    return "index";
  }
  const [first] = trimmed.split("/");
  return first;
}

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  useEffect(() => {
    track("docs_viewed", { doc_section: deriveDocSection(pathname) });
  }, [pathname]);

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "17rem",
        } as React.CSSProperties
      }
    >
      <DocsAppSidebar />
      <SidebarInset>
        {/* Mobile header with logo and sidebar trigger. Hidden on medium and larger screens. */}
        <header className="md:hidden flex items-center justify-between border-b border-border px-4 py-3">
          <Link
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "group/logo py-2 px-0",
            )}
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
          <SidebarTrigger />
        </header>
        <div className="flex py-8 px-4 sm:px-8 md:px-16 max-w-6xl mx-auto w-full">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
