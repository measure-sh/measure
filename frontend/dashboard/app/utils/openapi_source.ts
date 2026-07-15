import { createOpenAPI } from "fumadocs-openapi/server";

// Server-side OpenAPI resolver for the REST API reference pages. The specs
// are the source of truth for /docs/api; the per-tag MDX pages under
// content/docs/api are generated from them by scripts/generate_api_docs.mjs.
export const openapi = createOpenAPI({
  input: ["./content/openapi/dashboard.yaml", "./content/openapi/sdk.yaml"],
});
