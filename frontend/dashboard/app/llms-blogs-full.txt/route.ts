import { generateBlogsFullTxt } from "@/app/utils/llms/llms_full_txt";

// The blog posts are fixed at build time, so the response can be
// prerendered.
export const dynamic = "force-static";

export async function GET() {
  return new Response(await generateBlogsFullTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
