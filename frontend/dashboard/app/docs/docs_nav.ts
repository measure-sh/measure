import navData from "../../content/docs_nav.json";

export interface NavItem {
  title: string;
  slug?: string;
  children?: NavItem[];
}

export const docsNav: NavItem[] = navData;

/**
 * The sidebar renders the nav as clusters: each top-level group is a cluster
 * with a label, and top-level leaf pages join the cluster before them (the
 * first ones form an unlabeled lead cluster). The page-header eyebrow uses
 * the same clustering, so a page's eyebrow always matches the sidebar
 * section it appears under.
 */
export interface NavCluster {
  label?: string;
  items: NavItem[];
}

export function buildClusters(items: NavItem[]): NavCluster[] {
  const clusters: NavCluster[] = [];
  for (const item of items) {
    if (item.children !== undefined && item.children.length > 0) {
      clusters.push({ label: item.title, items: [...item.children] });
      continue;
    }
    const last = clusters[clusters.length - 1];
    if (last !== undefined) {
      last.items.push(item);
    } else {
      clusters.push({ items: [item] });
    }
  }
  return clusters;
}

/**
 * Label of the sidebar cluster a page belongs to, shown as the page-header
 * eyebrow. Pages in the unlabeled lead cluster and pages missing from the
 * nav have none.
 */
export function findSectionTitle(slug: string): string | null {
  function contains(item: NavItem): boolean {
    if (item.slug === slug) {
      return true;
    }
    return item.children?.some(contains) ?? false;
  }

  for (const cluster of buildClusters(docsNav)) {
    if (cluster.items.some(contains)) {
      return cluster.label ?? null;
    }
  }
  return null;
}

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
