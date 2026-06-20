import { docsNav, getFlatNavSlugs, type NavItem } from "@/app/docs/docs_nav";
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
    <div className="grid grid-cols-1 gap-4 mt-16 pt-6 border-t border-border sm:grid-cols-2">
      {prevSlug ? (
        <Link
          href={prevSlug}
          className="flex flex-col rounded-lg border border-border px-4 py-3 transition-colors hover:border-primary"
        >
          <span className="font-body text-xs font-medium text-muted-foreground">
            Previous
          </span>
          <span className="font-body text-sm font-medium text-foreground">
            {findTitle(prevSlug)}
          </span>
        </Link>
      ) : (
        <div />
      )}
      {nextSlug ? (
        <Link
          href={nextSlug}
          className="flex flex-col items-end rounded-lg border border-border px-4 py-3 text-right transition-colors hover:border-primary sm:col-start-2"
        >
          <span className="font-body text-xs font-medium text-muted-foreground">
            Next
          </span>
          <span className="font-body text-sm font-medium text-foreground">
            {findTitle(nextSlug)}
          </span>
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}
