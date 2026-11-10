import { NextResponse } from "next/server";
import { isOAuthState, setMcpBindingCookie } from "../../cookie";
import { type McpParams, type RawParams, pickMcpParams } from "../params";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const agentOrigin = process.env.AGENT_BASE_URL;

const providers = ["github", "google"];

// isSameOrigin is the CSRF guard. Only requests whose Origin header equals the site origin pass. A missing Origin fails.
function isSameOrigin(request: Request): boolean {
  if (!siteUrl) {
    return false;
  }
  return request.headers.get("origin") === new URL(siteUrl).origin;
}

function errorRedirect(params: McpParams): NextResponse {
  const query = new URLSearchParams(params);
  query.set("error", "1");
  return NextResponse.redirect(`${siteUrl}/auth/mcp/authorize?${query}`, {
    status: 303,
  });
}

async function callAgent(
  path: string,
  body: object,
): Promise<{ ok: boolean; data: any }> {
  try {
    const res = await fetch(`${agentOrigin}/oauth/authorize/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return { ok: res.ok, data: res.ok ? await res.json() : null };
  } catch (e) {
    console.error(`MCP consent ${path} failed:`, e);
    return { ok: false, data: null };
  }
}

async function approve(params: McpParams, provider: string) {
  const { ok, data } = await callAgent("approve", { ...params, provider });
  if (!ok || !data?.provider_url || !data?.binding) {
    return errorRedirect(params);
  }
  if (typeof data.oauth_state !== "string" || !isOAuthState(data.oauth_state)) {
    return errorRedirect(params);
  }
  const res = NextResponse.redirect(data.provider_url, { status: 303 });
  return setMcpBindingCookie(res, data.oauth_state, data.binding);
}

async function deny(params: McpParams) {
  const { ok, data } = await callAgent("deny", params);
  if (!ok || !data?.redirect_url) {
    return errorRedirect(params);
  }
  return NextResponse.redirect(data.redirect_url, { status: 303 });
}

// POST handles the consent form. Deny redirects back to the client & allow redirects to the chosen provider with the binding cookie set. Agent failures redirect to the authorize page with error=1.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (!agentOrigin) {
    throw new Error("AGENT_BASE_URL is not set");
  }
  const form = await request.formData();
  const decision = form.get("decision");
  const provider = String(form.get("provider") ?? "");
  const params = pickMcpParams(form as unknown as RawParams);

  if (decision === "deny") {
    return deny(params);
  }
  if (decision === "allow" && providers.includes(provider)) {
    return approve(params, provider);
  }
  return new NextResponse("Bad Request", { status: 400 });
}
