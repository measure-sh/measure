import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getFlatNavSlugs, docsNav, type NavItem } from "@/app/docs/docs_nav";

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
  const nextSlug = currentIndex < flatSlugs.length - 1 ? flatSlugs[currentIndex + 1] : null;

  return (
    <div className="flex justify-between items-center mt-12 pt-6 border-t border-border">
      {prevSlug ? (
        <Link
          href={prevSlug}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors font-body"
        >
          <ChevronLeft className="h-4 w-4" />
          {findTitle(prevSlug)}
        </Link>
      ) : (
        <div />
      )}
      {nextSlug ? (
        <Link
          href={nextSlug}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors font-body"
        >
          {findTitle(nextSlug)}
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}
