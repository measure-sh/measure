export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 90_000;

const HOP_HEADERS = [
  "host",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "expect",
];

/** Builds the backend URL from the request path & query. */
function targetUrl(request: Request, apiOrigin: string): URL {
  const { pathname, search } = new URL(request.url);
  return new URL(pathname.replace(/^\/api/, "") + search, apiOrigin);
}

/** Copies request headers minus hop-by-hop ones & sets x-forwarded-*. */
function upstreamHeaders(request: Request): Headers {
  const url = new URL(request.url);
  const headers = new Headers(request.headers);
  const forwardedHost = request.headers.get("host") ?? url.host;
  HOP_HEADERS.forEach((name) => headers.delete(name));
  headers.set("x-forwarded-host", forwardedHost);
  headers.set("x-forwarded-proto", url.protocol.replace(":", ""));
  return headers;
}

/** Copies upstream headers minus ones invalidated by fetch decoding. */
function downstreamHeaders(upstream: Response): Headers {
  const headers = new Headers(upstream.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  return headers;
}

/** Returns a generic 502 that never names the upstream. */
function badGateway(): Response {
  return Response.json({ error: "Bad gateway" }, { status: 502 });
}

/** Forwards the request to API_BASE_URL so the upstream URL stays server side. */
async function forward(request: Request): Promise<Response> {
  const apiOrigin = process.env.API_BASE_URL;
  if (!apiOrigin) {
    throw new Error("API_BASE_URL is not set");
  }
  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  try {
    const upstream = await fetch(targetUrl(request, apiOrigin), {
      method: request.method,
      headers: upstreamHeaders(request),
      body: hasBody ? request.body : undefined,
      duplex: "half",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    } as RequestInit);

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: downstreamHeaders(upstream),
    });
  } catch (err) {
    console.error("api proxy upstream failure:", (err as Error).name);
    return badGateway();
  }
}

export {
  forward as GET,
  forward as POST,
  forward as PUT,
  forward as PATCH,
  forward as DELETE,
  forward as HEAD,
  forward as OPTIONS,
};
