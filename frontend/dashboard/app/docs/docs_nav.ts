import navData from "../../content/docs_nav.json";

export interface NavItem {
  title: string;
  slug?: string;
  children?: NavItem[];
}

export const docsNav: NavItem[] = navData;

/**
 * Flatten the nav tree into an ordered list of slugs for prev/next navigation.
 */
export function getFlatNavSlugs(): string[] {
  const slugs: string[] = ["/docs"];

  function walk(items: NavItem[]) {
    for (const item of items) {
      if (item.slug) {
        slugs.push(item.slug);
      }
      if (item.children) {
        walk(item.children);
      }
    }
  }

  walk(docsNav);
  return slugs;
}
