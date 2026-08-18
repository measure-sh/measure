import type { MetadataRoute } from "next";

const CANONICAL_URL = "https://measure.sh";
const isCanonical = process.env.NEXT_PUBLIC_SITE_URL === CANONICAL_URL;

export default function robots(): MetadataRoute.Robots {
  // Staging, self-host & local builds stay out of search entirely.
  if (!isCanonical) {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/",
        },
      ],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/auth/", "/api/", "/yrtmlt/"],
      },
    ],
    sitemap: `${CANONICAL_URL}/sitemap.xml`,
    host: CANONICAL_URL,
  };
}
