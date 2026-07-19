/**
 * Typed access to the content/docs collection: the fumadocs loader that
 * gives the compiled MDX pages their urls, page tree and static params.
 * Kept in app/utils rather than app/docs because surfaces outside the
 * docs routes read it too: the llms.txt/llms-full.txt handlers, the
 * /llms.docs per-page markdown route and the proxy-negotiated markdown
 * responses.
 */
import { docs } from "collections/server";
import { loader } from "fumadocs-core/source";
import { openapiPlugin } from "fumadocs-openapi/server";

// Fumadocs' setup guides name this module lib/source.ts; it sits in
// app/utils because the repo keeps shared code there.
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  // adds method badges to API reference entries in the page tree
  plugins: [openapiPlugin()],
});
