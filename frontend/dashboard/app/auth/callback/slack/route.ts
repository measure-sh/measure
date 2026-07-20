import { NextResponse } from "next/server";
import { getPosthogServer } from "../../../posthog-server";

export const dynamic = "force-dynamic";

const origin = process.env.NEXT_PUBLIC_SITE_URL;
const apiOrigin = process.env.API_BASE_URL;

const posthog = getPosthogServer();

// teamIdFromState reads the teamId out of the OAuth state's unsigned payload.
// The state is created and verified by the API; the dashboard uses this only to
// pick where to redirect, not to authorize anything. A forged teamId only
// changes where the browser lands, while the connect still fails the API's
// signature check. Returns null when the state is absent or unparseable, in
// which case the caller falls back to the dashboard root.
function teamIdFromState(state: string | null): string | null {
  if (!state) {
    return null;
  }
  try {
    const [payload] = state.split(".");
    if (!payload) {
      return null;
    }
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    return typeof decoded.team_id === "string" && decoded.team_id
      ? decoded.team_id
      : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Redirect back to the team being connected when the state names one,
  // otherwise the dashboard root, which forwards to the user's default team.
  const teamId = teamIdFromState(state);
  const returnUrl = teamId ? `${origin}/${teamId}/team` : `${origin}`;

  if (error) {
    console.log(`Slack OAuth failure: ${error}`);
    const errorMessage =
      error === "access_denied"
        ? "Installation cancelled"
        : `Slack OAuth error: ${error}`;
    posthog.captureException(errorMessage, { source: "slack_oauth_callback" });
    return NextResponse.redirect(
      `${returnUrl}?error=${encodeURIComponent(errorMessage)}`,
      { status: 302 },
    );
  }

  if (!code || !state) {
    console.log("Slack OAuth failure: missing code or state");
    posthog.captureException("Slack OAuth failure: missing code or state", {
      source: "slack_oauth_callback",
    });
    return NextResponse.redirect(
      `${returnUrl}?error=${encodeURIComponent("Could not connect Slack workspace")}`,
      { status: 302 },
    );
  }

  if (!apiOrigin) {
    throw new Error("API_BASE_URL is not set");
  }
  const res = await fetch(`${apiOrigin}/slack/connect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code, state }),
  });

  if (!res.ok) {
    const errorResponse = await res.json();
    const baseErrorMessage = "Could not connect to Slack workspace";
    const serverErrorMessage = errorResponse.error;
    const errorMessage = serverErrorMessage
      ? `${baseErrorMessage}: ${serverErrorMessage}`
      : baseErrorMessage;
    posthog.captureException(errorMessage, { source: "slack_oauth_callback" });
    console.error(errorMessage);
    return NextResponse.redirect(
      `${returnUrl}?error=${encodeURIComponent(errorMessage)}`,
      { status: 302 },
    );
  }

  const data = await res.json();

  // Prefer the team the API actually connected; fall back to the state's team.
  const successUrl = data.team_id
    ? `${origin}/${data.team_id}/team`
    : returnUrl;
  const successMessage = `Successfully connected to ${data.slack_team_name} workspace!`;
  return NextResponse.redirect(
    new URL(`${successUrl}?success=${encodeURIComponent(successMessage)}`),
    { status: 303 },
  );
}
