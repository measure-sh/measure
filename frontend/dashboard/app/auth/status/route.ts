import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// The auth cookies are httpOnly, so marketing pages call this route to learn
// whether the visitor is signed in. The access_token cookie expires long before
// the visitor's session ends, so the route checks refresh_token.
export function GET(request: NextRequest) {
  return NextResponse.json(
    { signed_in: request.cookies.has("refresh_token") },
    { headers: { "Cache-Control": "no-store" } },
  );
}
