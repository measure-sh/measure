"use client";

import { cn } from "@/app/utils/shadcn_utils";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

// A heading's "#" anchor link is part of its text content; drop it (and any
// other in-page anchors) so the outline label is just the heading text.
function headingLabel(heading: HTMLElement): string {
  const clone = heading.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('a[href^="#"]').forEach((anchor) => anchor.remove());
  return clone.textContent?.trim() ?? "";
}

// A stable identity for an outline, so we only replace state when the set of
// headings actually changes. We need this because observer also fires for unrelated article
// mutations, like code blocks being highlighted asynchronously.
function tocSignature(items: TocItem[]): string {
  return items
    .map((item) => `${item.level}:${item.id}:${item.text}`)
    .join("\n");
}

export default function DocsToc() {
  const pathname = usePathname();
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build the outline from the rendered headings so its anchors are the exact
  // ids rehype-slug assigned, and subscribe to the article so it stays correct:
  // the article re-renders on client navigation and highlights code blocks
  // asynchronously, both of which can change the headings after this mounts.
  useEffect(() => {
    const article = document.querySelector("article");
    if (!article) {
      return;
    }

    const syncHeadings = () => {
      const next = Array.from(
        article.querySelectorAll<HTMLElement>("h2[id], h3[id]"),
      ).map((heading) => ({
        id: heading.id,
        text: headingLabel(heading),
        level: Number(heading.tagName[1]),
      }));
      // Ignore unrelated changes, only update state if headings change.
      setItems((prev) =>
        tocSignature(prev) === tocSignature(next) ? prev : next,
      );
    };

    syncHeadings();
    const observer = new MutationObserver(syncHeadings);
    observer.observe(article, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  // Highlight the section currently in view: as you scroll, that's the last
  // heading to pass the top of the screen.
  useEffect(() => {
    if (items.length === 0) {
      return;
    }

    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) {
      return;
    }

    let frame = 0;

    const updateActiveId = () => {
      frame = 0;

      // The last sections are too short to ever reach the top of the screen, so
      // once the page is fully scrolled, just highlight the final heading.
      const scrolledToBottom =
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 2;
      if (scrolledToBottom) {
        setActiveId(headings[headings.length - 1].id);
        return;
      }

      // A heading counts as "reached" once its top is within this many pixels
      // of the top of the viewport. We use a small offset so the highlight switches
      // just before the heading touches the very top.
      const activationOffsetPx = 100;
      let current = headings[0].id;
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top > activationOffsetPx) {
          break;
        }
        current = heading.id;
      }
      setActiveId(current);
    };

    const onScroll = () => {
      if (frame === 0) {
        frame = requestAnimationFrame(updateActiveId);
      }
    };

    updateActiveId();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame !== 0) {
        cancelAnimationFrame(frame);
      }
    };
  }, [items]);

  // Keep the active entry within the outline's own scroll area. On long pages
  // the list overflows its max-height, so as the page scrolls the highlight can
  // end up below the fold where it can't be seen.
  useEffect(() => {
    if (!activeId) {
      return;
    }
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    const active = container.querySelector<HTMLElement>(
      `[data-toc-id="${CSS.escape(activeId)}"]`,
    );
    if (!active) {
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    if (activeRect.top < containerRect.top) {
      container.scrollTop -= containerRect.top - activeRect.top;
    } else if (activeRect.bottom > containerRect.bottom) {
      container.scrollTop += activeRect.bottom - containerRect.bottom;
    }
  }, [activeId]);

  return (
    // Always reserve the column at xl (even before headings resolve, or when a
    // page has none) so the article width never shifts as the outline loads.
    <aside className="hidden xl:block w-56 shrink-0 ml-auto">
      {items.length > 0 && (
        // Align the outline with the page <h1>: container py-8 (2rem) + h1 mt-12 (3rem).
        <div
          ref={scrollRef}
          className="fixed top-20 right-8 w-56 overflow-y-auto max-h-[calc(100vh-7rem)]"
        >
          <div className="border-l border-border">
            <p className="text-sm font-body font-medium text-foreground mb-3 pl-4">
              On this page
            </p>
            <nav className="flex flex-col">
              {items.map((item) => (
                <a
                  key={item.id}
                  data-toc-id={item.id}
                  href={`#${item.id}`}
                  className={cn(
                    "-ml-px border-l-2 py-1.5 pl-4 text-sm font-body leading-snug transition-colors",
                    item.level === 3 && "pl-8",
                    activeId === item.id
                      ? "border-primary text-foreground font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.text}
                </a>
              ))}
            </nav>
          </div>
        </div>
      )}
    </aside>
  );
}
