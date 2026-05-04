"use client";

import { buttonVariants } from "@/app/components/button_variants";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/app/components/sidebar";
import { cn } from "@/app/utils/shadcn_utils";
import Image from "next/image";
import Link from "next/link";
import DocsAppSidebar from "./components/docs_sidebar";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <DocsAppSidebar />
      <SidebarInset>
        {/* Mobile header with logo and sidebar trigger. Hidden on medium and larger screens. */}
        <header className="md:hidden flex items-center justify-between border-b border-border px-4 py-3">
          <Link
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "group/logo py-2",
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
