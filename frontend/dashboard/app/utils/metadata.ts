import type { Metadata } from "next";

const siteName = "measure.sh";

export const previewImage = "/images/social_preview.png";

export const sharedOpenGraph = {
  siteName,
  images: [
    {
      url: previewImage,
      width: 1200,
      height: 630,
      alt: "Measure preview image",
    },
  ],
  locale: "en_US",
  type: "website" as const,
};

/**
 * Standard metadata for a marketing page: SEO title and description,
 * canonical path and Open Graph tags. The Open Graph title carries the
 * "| Measure" suffix explicitly because the root layout's title template
 * only applies to the document title.
 */
export function marketingPageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      ...sharedOpenGraph,
      title: `${title} | Measure`,
      description,
      url: path,
    },
  };
}
