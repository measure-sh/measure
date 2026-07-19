import { generateLlmsFullTxt } from "@/app/utils/llms/markdown_generator";

// Prerendered at build time: the docs tree, the blog posts and the
// marketing page.md twins are all fixed at build.
export const dynamic = "force-static";

export async function GET() {
  return new Response(await generateLlmsFullTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
