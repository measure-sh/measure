import { generateDocsFullTxt } from "@/app/utils/llms/llms_full_txt";

// The docs tree is fixed at build time, so the response can be
// prerendered.
export const dynamic = "force-static";

export async function GET() {
  return new Response(await generateDocsFullTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
