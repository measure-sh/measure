import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // reverse proxy all API requests
  if (request.nextUrl.pathname.startsWith("/api")) {
    const apiOrigin = process.env.API_BASE_URL || "http://api:8080";
    const apiOriginUrl = new URL(apiOrigin);

    const url = request.nextUrl.clone();
    url.pathname = request.nextUrl.pathname.replace("/api", "");
    url.search = request.nextUrl.search;
    url.hostname = apiOriginUrl.hostname;
    url.port = apiOriginUrl.port;

    return NextResponse.rewrite(url);
  }

  // handle non-matching requests as usual
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
