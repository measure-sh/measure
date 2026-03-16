import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  switch (true) {
    case pathname.startsWith("/api"): {
      // reverse proxy all API requests
      const apiOrigin = process.env.API_BASE_URL || "http://api:8080";
      const apiOriginUrl = new URL(apiOrigin);

      const url = request.nextUrl.clone();
      url.protocol = apiOriginUrl.protocol;
      url.pathname = request.nextUrl.pathname.replace("/api", "");
      url.search = request.nextUrl.search;
      url.hostname = apiOriginUrl.hostname;
      url.port = apiOriginUrl.port;

      return NextResponse.rewrite(url);
    }

    case pathname.startsWith("/yrtmlt/static/"): {
      const url = request.nextUrl.clone();
      url.protocol = "https:";
      url.hostname = "us-assets.i.posthog.com";
      url.port = "";
      url.pathname = pathname.replace("/yrtmlt/static", "/static");

      return NextResponse.rewrite(url);
    }

    case pathname.startsWith("/yrtmlt/"): {
      const phHost = new URL(process.env.POSTHOG_HOST || "");

      const url = request.nextUrl.clone();
      url.protocol = phHost.protocol;
      url.hostname = phHost.hostname;
      url.port = phHost.port;
      url.pathname = pathname.replace("/yrtmlt", "");

      return NextResponse.rewrite(url);
    }

    default:
      // handle non-matching requests as usual
      return NextResponse.next();
  }
}

export const config = {
  matcher: ["/api/:path*", "/yrtmlt/:path*"],
};
