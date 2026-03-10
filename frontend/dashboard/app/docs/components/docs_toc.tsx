"use client";

import { useEffect, useState } from "react";
import { cn } from "@/app/utils/shadcn_utils";
import type { TocEntry } from "@/app/docs/docs";

export default function DocsToc({ entries }: { entries: TocEntry[] }) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (entries.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (observerEntries) => {
        for (const entry of observerEntries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -80% 0px" }
    );

    for (const tocEntry of entries) {
      const el = document.getElementById(tocEntry.id);
      if (el) {
        observer.observe(el);
      }
    }

    return () => observer.disconnect();
  }, [entries]);

  if (entries.length === 0) {
    return null;
  }

  return (
    <aside className="hidden xl:block w-56 shrink-0 ml-auto">
      <div className="fixed top-8 right-8 w-56 overflow-y-auto max-h-[calc(100vh-4rem)]">
        <p className="text-sm font-body text-muted-foreground px-2 mb-2">On this page</p>
        <nav className="flex flex-col gap-0.5">
          {entries.map((entry) => (
            <a
              key={entry.id}
              href={`#${entry.id}`}
              className={cn(
                "flex items-center rounded-md px-2 py-1 text-sm font-body transition-colors",
                entry.level === 2 && "pl-4",
                entry.level === 3 && "pl-6",
                activeId === entry.id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              {entry.text}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
}
