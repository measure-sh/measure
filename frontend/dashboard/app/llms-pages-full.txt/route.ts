import { generatePagesFullTxt } from "@/app/utils/llms/llms_full_txt";

// The marketing page.md twins are fixed at build time, so the response
// can be prerendered.
export const dynamic = "force-static";

export function GET() {
  return new Response(generatePagesFullTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
