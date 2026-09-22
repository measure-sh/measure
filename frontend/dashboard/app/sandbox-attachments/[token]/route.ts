import { NextResponse } from "next/server";
import { decodeToken, layoutTree, screenshotSvg } from "@/app/sandbox/layouts";

const CACHE = "public, max-age=31536000, immutable";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: file } = await params;
  const dot = file.lastIndexOf(".");
  const token = decodeToken(dot === -1 ? file : file.slice(0, dot));
  const extension = dot === -1 ? "" : file.slice(dot + 1);
  if (token === null) {
    return NextResponse.json({ error: "unknown attachment" }, { status: 404 });
  }
  if (extension === "svg") {
    return new NextResponse(screenshotSvg(token.vp, token.state), {
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": CACHE },
    });
  }
  return NextResponse.json(layoutTree(token.vp, token.state, token.highlight), {
    headers: { "Cache-Control": CACHE },
  });
}
