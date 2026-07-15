import { source } from "@/app/utils/docs_source";
import { createFromSource } from "fumadocs-core/search/server";

// In-process Orama search over the docs source. Lives under /docs/search
// because /api/* is reverse-proxied to the backend API by proxy.ts and
// would never reach this handler at fumadocs' default /api/search path.
export const { GET } = createFromSource(source, {
  language: "english",
});
