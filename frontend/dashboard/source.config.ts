import { pageSchema } from "fumadocs-core/source/schema";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { z } from "zod";

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
