import { docsNav, getFlatNavSlugs, type NavItem } from "@/app/docs/docs_nav";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

function findTitle(slug: string): string {
  if (slug === "/docs") {
    return "Overview";
  }

  function search(items: NavItem[]): string | null {
    for (const item of items) {
      if (item.slug === slug) {
        return item.title;
      }
      if (item.children) {
        const found = search(item.children);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  return search(docsNav) || "Documentation";
}

export default function DocsNavLinks({ currentSlug }: { currentSlug: string }) {
  const flatSlugs = getFlatNavSlugs();
  const currentIndex = flatSlugs.indexOf(currentSlug);

  if (currentIndex === -1) {
    return null;
  }

  const prevSlug = currentIndex > 0 ? flatSlugs[currentIndex - 1] : null;
  const nextSlug =
    currentIndex < flatSlugs.length - 1 ? flatSlugs[currentIndex + 1] : null;

  return (
    <div className="grid grid-cols-1 gap-4 mt-16 sm:grid-cols-2">
      {prevSlug ? (
        <Link
          href={prevSlug}
          className="group flex flex-col gap-1 rounded-xl border border-border px-4 py-3 transition-colors hover:border-muted-foreground/40"
        >
          <span className="font-body font-medium text-foreground">
            {findTitle(prevSlug)}
          </span>
          <span className="flex items-center gap-1 font-body text-sm text-muted-foreground transition-colors group-hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Previous
          </span>
        </Link>
      ) : (
        <div />
      )}
      {nextSlug ? (
        <Link
          href={nextSlug}
          className="group flex flex-col items-end gap-1 rounded-xl border border-border px-4 py-3 text-right transition-colors hover:border-muted-foreground/40 sm:col-start-2"
        >
          <span className="font-body font-medium text-foreground">
            {findTitle(nextSlug)}
          </span>
          <span className="flex items-center gap-1 font-body text-sm text-muted-foreground transition-colors group-hover:text-foreground">
            Next
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}
