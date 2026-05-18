/**
 * Integration tests for the markdown content-negotiation route handler at
 * `app/page-md/[...path]/route.ts`.
 *
 * The middleware unit tests cover the *rewrite decision* — given a
 * pathname + matcher, what URL does the function emit? They can't cover
 * what actually happens after the rewrite hits the route handler, which
 * is where the markdown source is resolved, the response is built, and
 * status codes are decided.
 *
 * These tests run in the integration jest config so we get real Fetch
 * API globals (Request/Response/Headers from undici), which NextResponse
 * needs to instantiate. They invoke the exported `GET` handler directly
 * with constructed params — no Next.js server boot required.
 */
import {
  describe,
  expect,
  it,
} from "@jest/globals";
import fs from "fs";
import path from "path";

import { GET } from "@/app/page-md/[...path]/route";

function call(segments: string[] | undefined) {
  // The handler ignores the request object — only params.path is read.
  return GET({} as any, { params: { path: segments } });
}

async function expectMarkdown(res: Response, expectedSubstring: string) {
  expect(res.status).toBe(200);
  expect(res.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
  expect(res.headers.get("Vary")).toBe("Accept");
  expect(res.headers.get("Cache-Control")).toBe(
    "public, max-age=300, s-maxage=600",
  );
  const body = await res.text();
  expect(body).toContain(expectedSubstring);
  return body;
}

async function expect406(res: Response) {
  expect(res.status).toBe(406);
  expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
  expect(res.headers.get("Vary")).toBe("Accept");
  const body = await res.text();
  expect(body).toContain("No markdown representation available");
}

describe("/page-md/[...path] route handler", () => {
  describe("marketing pages (colocated app/<route>/page.md)", () => {
    it("serves the homepage from app/page.md when segments=['index']", async () => {
      const res = await call(["index"]);
      const body = await expectMarkdown(res, "Mobile apps break, get to the root cause faster.");
      // Frontmatter must be stripped before serving
      expect(body.startsWith("---")).toBe(false);
      expect(body).not.toContain("canonical: /");
    });

    it("serves /about from app/about/page.md", async () => {
      const res = await call(["about"]);
      await expectMarkdown(res, "# For mobile engineers, by mobile engineers");
    });

    it("serves /pricing from app/pricing/page.md", async () => {
      const res = await call(["pricing"]);
      await expectMarkdown(res, "# Pricing");
    });

    it("serves nested product pages from app/product/<slug>/page.md", async () => {
      const res = await call(["product", "mcp"]);
      await expectMarkdown(res, "# MCP");
    });

    it("serves every product page that exists on disk", async () => {
      const productDir = path.join(process.cwd(), "app", "product");
      const slugs = fs
        .readdirSync(productDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .filter((name) =>
          fs.existsSync(path.join(productDir, name, "page.md")),
        );

      expect(slugs.length).toBeGreaterThan(0);

      for (const slug of slugs) {
        const res = await call(["product", slug]);
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toBe(
          "text/markdown; charset=utf-8",
        );
      }
    });

    it("returns 406 for marketing paths that have no .md twin (privacy-policy)", async () => {
      const res = await call(["privacy-policy"]);
      await expect406(res);
    });

    it("returns 406 for marketing paths that have no .md twin (terms-of-service)", async () => {
      const res = await call(["terms-of-service"]);
      await expect406(res);
    });

    it("returns 406 for an unknown top-level path", async () => {
      const res = await call(["this-page-does-not-exist"]);
      await expect406(res);
    });

    it("returns 406 for an unknown product subpath", async () => {
      const res = await call(["product", "made-up-feature"]);
      await expect406(res);
    });

    it("returns 406 for routes that have page.tsx but no page.md (e.g. /auth)", async () => {
      // app/auth/page.tsx exists but auth flows aren't marketing — no twin
      const res = await call(["auth"]);
      await expect406(res);
    });
  });

  describe("docs pages", () => {
    it("serves /docs (root) using getDocIndex when segments=['docs']", async () => {
      const res = await call(["docs"]);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe(
        "text/markdown; charset=utf-8",
      );
      const body = await res.text();
      // Root docs README is hand-authored; just confirm it's non-empty markdown
      expect(body.length).toBeGreaterThan(0);
    });

    it("serves a specific doc via getDocBySlug", async () => {
      const res = await call(["docs", "sdk-integration-guide"]);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body.length).toBeGreaterThan(0);
    });

    it("returns 406 for a docs path that doesn't exist", async () => {
      const res = await call(["docs", "this-doc-does-not-exist"]);
      await expect406(res);
    });
  });

  describe("security and edge cases", () => {
    it("returns 406 when params.path is undefined (catch-all matched with no segments)", async () => {
      const res = await call(undefined);
      await expect406(res);
    });

    it("returns 406 when params.path is an empty array", async () => {
      const res = await call([]);
      await expect406(res);
    });

    it("rejects path-traversal attempts via .. segments", async () => {
      // path.join collapses "..", so `app/../etc/passwd` would
      // become `etc/passwd`. The startsWith(APP_DIR) guard catches
      // the escape and returns 406.
      const res = await call(["..", "etc", "passwd"]);
      await expect406(res);
    });

    it("returns 406 for an attempted escape via mixed segments", async () => {
      const res = await call(["product", "..", "..", "package.json"]);
      await expect406(res);
    });

    it("strips frontmatter from the served body", async () => {
      const res = await call(["about"]);
      const body = await res.text();
      // The on-disk file starts with `---\ntitle: ...\n---`, but the
      // response body must not include that block.
      expect(body).not.toMatch(/^---\s*\n/);
      expect(body).not.toContain("canonical: /about");
    });

    it("served homepage body matches app/page.md after frontmatter strip", async () => {
      const res = await call(["index"]);
      const body = await res.text();
      const raw = fs.readFileSync(
        path.join(process.cwd(), "app", "page.md"),
        "utf-8",
      );
      // After stripping frontmatter, what's left should be exactly what
      // the route returns.
      const afterFm = raw.replace(/^---[\s\S]*?---\s*\n?/, "");
      expect(body).toBe(afterFm);
    });
  });

  describe("response shape consistency", () => {
    it("all 200 responses use the same set of headers", async () => {
      const fixtures = [
        ["about"],
        ["pricing"],
        ["product", "mcp"],
      ] as string[][];

      for (const segs of fixtures) {
        const res = await call(segs);
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toBe(
          "text/markdown; charset=utf-8",
        );
        expect(res.headers.get("Vary")).toBe("Accept");
        expect(res.headers.get("Cache-Control")).toBe(
          "public, max-age=300, s-maxage=600",
        );
      }
    });

    it("all 406 responses use the same set of headers", async () => {
      const fixtures = [
        [],
        ["privacy-policy"],
        ["this-does-not-exist"],
        ["docs", "missing-doc"],
      ] as string[][];

      for (const segs of fixtures) {
        const res = await call(segs);
        expect(res.status).toBe(406);
        expect(res.headers.get("Content-Type")).toBe(
          "text/plain; charset=utf-8",
        );
        expect(res.headers.get("Vary")).toBe("Accept");
      }
    });
  });
});
