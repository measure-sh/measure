import { docs } from "collections/server";
import { loader } from "fumadocs-core/source";
import { openapiPlugin } from "fumadocs-openapi/server";

// The docs content source. Fumadocs' setup guides name this module
// lib/source.ts; it lives here because the repo keeps shared code under
// app/utils.
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  // adds method badges to API reference entries in the page tree
  plugins: [openapiPlugin()],
});
