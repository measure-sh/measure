import { generateLlmsFullTxt } from "@/app/utils/llms/llms_full_txt";

// The docs tree, the blog posts, and the marketing page.md twins are
// fixed at build time, so the response can be prerendered.
export const dynamic = "force-static";

export async function GET() {
  return new Response(await generateLlmsFullTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
