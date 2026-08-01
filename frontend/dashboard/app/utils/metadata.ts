import type { Metadata } from "next";

export const siteOrigin = "https://measure.sh";

const siteName = "measure.sh";

const siteTitle = "Measure";

const siteDescription =
  "Measure helps mobile teams monitor and fix crashes, ANRs, bugs, and performance issues. The open source alternative to Firebase Crashlytics.";

export const previewImage = "/images/social_preview.png";

// The X account, in the two shapes its consumers need: the @handle for
// the twitter card tags, and the profile URL for the footer link and the
// Organization sameAs list.
const xUsername = "measure_sh";
export const siteHandle = `@${xUsername}`;
export const siteXUrl = `https://x.com/${xUsername}`;

const sharedOpenGraph = {
  siteName,
  locale: "en_US",
  type: "website" as const,
};

type CardImage = {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
};

const sharedImages: CardImage[] = [
  {
    url: previewImage,
    width: 1200,
    height: 630,
    alt: "Measure preview image",
  },
];

export type PageSeo = {
  title: string;
  description?: string;
  path: string;
};

export type PageMetadataOptions = {
  /**
   * Appends " | Measure" to the Open Graph and card titles, matching the
   * document title that the root layout's title template produces. Docs
   * and blog pages turn this off because their titles read as standalone
   * headlines and already run long.
   */
  addMeasureSuffixToTitle?: boolean;
  /** Share images for this page; the site-wide preview when omitted. */
  images?: CardImage[];
  /** Set on blog posts, which are articles rather than site pages. */
  article?: { publishedTime: string; authors: string[] };
};

type SocialTags = Pick<Metadata, "openGraph" | "twitter">;

/**
 * Open Graph and Twitter card tags for one page. Both carry the same
 * title, description and images, because a scraper reads whichever of
 * the two it supports and the two disagreeing means the same URL shares
 * differently on different networks.
 *
 * Next merges page metadata into the root layout's one field at a time,
 * so a page that fills in only openGraph keeps the layout's twitter tags
 * and X shows the home page title on that page's URL. Building both here
 * is what keeps a page from setting one and forgetting the other.
 */
function socialTags(
  socialTitle: string,
  description: string | undefined,
  path: string,
  images: CardImage[],
  article: PageMetadataOptions["article"],
): SocialTags {
  return {
    openGraph: {
      ...sharedOpenGraph,
      ...(article ? { type: "article" as const, ...article } : {}),
      title: socialTitle,
      description,
      url: path,
      images,
    },
    twitter: {
      card: "summary_large_image",
      site: siteHandle,
      creator: siteHandle,
      title: socialTitle,
      description,
      images,
    },
  };
}

/**
 * The metadata every page of the site needs: SEO title and description,
 * canonical path, Open Graph and Twitter card tags. Pages call this
 * instead of writing the tags themselves, so a new page cannot ship with
 * half of them filled in.
 */
export function pageMetadata(
  { title, description, path }: PageSeo,
  {
    addMeasureSuffixToTitle = true,
    images = sharedImages,
    article,
  }: PageMetadataOptions = {},
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    ...socialTags(
      addMeasureSuffixToTitle ? `${title} | ${siteTitle}` : title,
      description,
      path,
      images,
      article,
    ),
  };
}

/**
 * Metadata for the root layout. It carries the title template that gives
 * every page its "| Measure" document title, and the social tags that a
 * route without its own metadata falls back to. It sets no canonical
 * link: pages declare their own, and one here would be inherited by
 * every page that does not.
 */
export const siteMetadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: {
    default: siteTitle,
    template: `%s | ${siteTitle}`,
  },
  description: siteDescription,
  ...socialTags(siteTitle, siteDescription, "/", sharedImages, undefined),
};
