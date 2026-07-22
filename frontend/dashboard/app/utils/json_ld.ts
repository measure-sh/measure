import type { ReactNode } from "react";
import { previewImage, siteOrigin, type MarketingPageSeo } from "./metadata";

// Builders return schema.org nodes without "@context"; the JsonLd
// component adds it when rendering.

export function absoluteUrl(path: string): string {
  return path === "/" ? siteOrigin : `${siteOrigin}${path}`;
}

export const organizationJsonLd = {
  "@type": "Organization",
  "@id": `${siteOrigin}/#organization`,
  name: "Measure",
  legalName: "Measure Inc.",
  url: siteOrigin,
  logo: {
    "@type": "ImageObject",
    url: `${siteOrigin}/images/measure_logo.png`,
    width: 512,
    height: 512,
  },
  sameAs: [
    "https://github.com/measure-sh/measure",
    "https://x.com/measure_sh",
    "https://www.linkedin.com/company/measure-sh",
    "https://bsky.app/profile/measure.sh",
  ],
};

export const webSiteJsonLd = {
  "@type": "WebSite",
  "@id": `${siteOrigin}/#website`,
  name: "Measure",
  url: siteOrigin,
  publisher: { "@id": `${siteOrigin}/#organization` },
};

export function softwareApplicationJsonLd(description: string) {
  return {
    "@type": "SoftwareApplication",
    name: "Measure",
    url: siteOrigin,
    description,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Android, iOS, iPadOS",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };
}

export function webPageJsonLd(
  seo: MarketingPageSeo,
  type: "WebPage" | "AboutPage" = "WebPage",
) {
  return {
    "@type": type,
    name: seo.title,
    description: seo.description,
    url: absoluteUrl(seo.path),
  };
}

export function blogPostingJsonLd({
  title,
  description,
  path,
  datePublished,
  authorName,
  image,
  tags,
}: {
  title: string;
  description?: string;
  path: string;
  datePublished: string;
  authorName: string;
  image?: string;
  tags: string[];
}) {
  return {
    "@type": "BlogPosting",
    headline: title,
    ...(description ? { description } : {}),
    url: absoluteUrl(path),
    mainEntityOfPage: absoluteUrl(path),
    datePublished,
    author: { "@type": "Person", name: authorName },
    image: absoluteUrl(image ?? previewImage),
    ...(tags.length > 0 ? { keywords: tags.join(", ") } : {}),
    publisher: organizationJsonLd,
  };
}

export function techArticleJsonLd({
  headline,
  description,
  path,
}: {
  headline: string;
  description?: string;
  path: string;
}) {
  return {
    "@type": "TechArticle",
    headline,
    ...(description ? { description } : {}),
    url: absoluteUrl(path),
    mainEntityOfPage: absoluteUrl(path),
    author: organizationJsonLd,
    publisher: organizationJsonLd,
  };
}

// Matches the shape of fumadocs breadcrumb items so the docs page can pass
// them through directly.
export type BreadcrumbCrumb = {
  name: ReactNode;
  url?: string;
};

/**
 * Crumbs without a URL are dropped unless they are the trail's last item,
 * since intermediate breadcrumb items must link somewhere; non-string names
 * are dropped because JSON-LD cannot carry React nodes. Positions renumber
 * after filtering.
 */
export function breadcrumbJsonLd(crumbs: BreadcrumbCrumb[]) {
  const linkable = crumbs.filter(
    (crumb, index): crumb is { name: string; url?: string } =>
      typeof crumb.name === "string" &&
      (crumb.url !== undefined || index === crumbs.length - 1),
  );
  return {
    "@type": "BreadcrumbList",
    itemListElement: linkable.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      ...(crumb.url ? { item: absoluteUrl(crumb.url) } : {}),
    })),
  };
}
