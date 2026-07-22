import { pageSchema } from "fumadocs-core/source/schema";
import {
  defineCollections,
  defineConfig,
  defineDocs,
} from "fumadocs-mdx/config";
import { z } from "zod";

export const blogPosts = defineCollections({
  type: "doc",
  dir: "content/blog",
  schema: pageSchema.extend({
    author: z.object({
      name: z.string(),
      avatar: z.string(),
    }),
    date: z.iso.date().or(z.date()),
    // Social share card image (a path under public/, e.g.
    // /blog/assets/foo.webp); sharing falls back to the site-wide
    // preview image when absent. Must be site-relative: JSON-LD builds
    // the absolute URL by prefixing the origin.
    image: z.string().startsWith("/").optional(),
    // Kebab-case only: tag slugs appear verbatim in /blog/tags/<tag> URLs,
    // so URL-unsafe characters are rejected at build time instead of being
    // escaped at render time.
    tags: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).default([]),
  }),
  postprocess: {
    // Same as docs: exposes page.data.getText("processed") for the
    // /blog/*.md markdown routes and the llms.txt surfaces.
    includeProcessedMarkdown: true,
  },
});

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: pageSchema.extend({
      // Longer SEO title used in <title> and OG tags; the sidebar and the
      // visible page heading use the plain title.
      seoTitle: z.string().optional(),
    }),
    postprocess: {
      // Exposes page.data.getText("processed") for the llms.txt surfaces
      // and the AI chat search index.
      includeProcessedMarkdown: true,
    },
  },
});

export default defineConfig({
  mdxOptions: {
    // Keep image srcs as plain public/ paths instead of bundler imports.
    // With imports, the processed markdown behind llms-full.txt and the
    // /docs/*.md routes serializes srcs as dangling __img0 placeholders.
    // The site still renders through next/image with real dimensions;
    // this only gives up build-time asset hashing and blur placeholders,
    // neither of which the docs use.
    remarkImageOptions: { useImport: false },
  },
});
