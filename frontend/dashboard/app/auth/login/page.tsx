"use client";

import { validateInvitesFromServer } from "@/app/api/api_calls";
import { ApiError } from "@/app/api/api_error";
import { fetchCurrentSession, type Session } from "@/app/query/hooks";
import { useMeasureStoreRegistry } from "@/app/stores/provider";
import { resetAllStores } from "@/app/stores/reset_all";
import { useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { posthog } from "posthog-js";
import { use, useEffect, useState } from "react";
import { determineAcquisitionSource } from "@/app/utils/analytics/acquisition";
import { getStoredGCLID } from "@/app/utils/analytics/attribution";
import { getUTMState } from "@/app/utils/analytics/utm";
import { isCloud } from "@/app/utils/env_utils";
import { underlineLinkStyle } from "@/app/utils/shared_styles";
import GitHubSignIn from "./github-sign-in";
import GoogleSignIn from "./google-sign-in";
import Messages from "./messages";

function buildMcpAuthorizeUrl(
  searchParams: { [key: string]: string | string[] | undefined },
  provider: string,
): string {
  const agentBaseUrl = process.env.NEXT_PUBLIC_AGENT_BASE_URL;
  if (!agentBaseUrl) {
    throw new Error("NEXT_PUBLIC_AGENT_BASE_URL is not set");
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "mcp" || value === undefined) {
      continue;
    }
    params.set(key, Array.isArray(value) ? value[0] : value);
  }
  params.set("provider", provider);
  return `${agentBaseUrl}/oauth/authorize?${params.toString()}`;
}

function firstParam(
  searchParams: { [key: string]: string | string[] | undefined },
  key: string,
): string {
  const value = searchParams[key];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

// The client_id is the URL of a self-published metadata document, so its host
// is the only part of the client's identity the user can trust.
function mcpClientHost(searchParams: {
  [key: string]: string | string[] | undefined;
}): string {
  try {
    const url = new URL(firstParam(searchParams, "client_id"));
    return url.protocol === "https:" ? url.host : "";
  } catch {
    return "";
  }
}

// A private-use scheme has no hostname, so it is named by its scheme instead.
function mcpRedirectHost(searchParams: {
  [key: string]: string | string[] | undefined;
}): string {
  let url: URL;
  try {
    url = new URL(firstParam(searchParams, "redirect_uri"));
  } catch {
    return "";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return url.protocol.replace(/:$/, "");
  }
  return url.hostname;
}

export default function Login(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = use(props.searchParams);
  const error = searchParams["error"];
  const message = searchParams["message"];
  const inviteId = searchParams["inviteId"];
  const isMcp = searchParams["mcp"] === "1";
  const [session, setSession] = useState<Session | null>(null);
  const home = session ? `/${session.user.own_team_id}/overview` : "";
  const [loading, setLoading] = useState(!isMcp);
  const [inviteInvalid, setInviteInvalid] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isMcp || !inviteId) {
      return;
    }
    const validateInvite = async () => {
      try {
        await validateInvitesFromServer(inviteId as string);
        setInviteInvalid(false);
      } catch (e) {
        // Only a rejection from the server shows that the invite is bad. A
        // failure with no verdict leaves the invite unjudged, so a bad
        // connection does not tell the user that the link is invalid.
        if (e instanceof ApiError) {
          setInviteInvalid(true);
        }
      }
    };
    validateInvite();
  }, [inviteId, isMcp]);

  const registry = useMeasureStoreRegistry();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isMcp) {
      return;
    }

    // Clear any leftover state from a previous user so the next sign-in starts fresh
    resetAllStores(registry, queryClient);
  }, [isMcp]);

  useEffect(() => {
    if (isMcp) {
      return;
    }

    if (session) {
      router.replace(`/${session.user.own_team_id}/overview`);
      return;
    }

    const getSession = async () => {
      const session = await fetchCurrentSession();
      if (session) {
        setSession(session);
        const utm = getUTMState();
        const acquisition = determineAcquisitionSource({
          utm_source: utm?.first_touch_utm_source,
          utm_medium: utm?.first_touch_utm_medium,
          utm_campaign: utm?.first_touch_utm_campaign,
          referrer_domain: utm?.referrer_domain,
          gclid: getStoredGCLID(),
        });
        const email = session.user.email ?? "";
        const atIdx = email.indexOf("@");
        const emailDomain = atIdx >= 0 ? email.slice(atIdx + 1) : undefined;
        posthog.identify(
          session.user.id,
          {
            email,
            name: session.user.name,
          },
          {
            first_touch_utm_source: utm?.first_touch_utm_source,
            first_touch_utm_medium: utm?.first_touch_utm_medium,
            first_touch_utm_campaign: utm?.first_touch_utm_campaign,
            last_touch_utm_source: utm?.last_touch_utm_source,
            last_touch_utm_medium: utm?.last_touch_utm_medium,
            referrer_domain: utm?.referrer_domain,
            signup_acquisition_source: acquisition.source,
            signup_is_inbound: acquisition.is_inbound,
            email_domain: emailDomain,
          },
        );
      }
      setLoading(false);
    };
    getSession();
  }, [session, isMcp]);

  const redirectHost = mcpRedirectHost(searchParams);
  const mcpGitHubUrl = isMcp
    ? buildMcpAuthorizeUrl(searchParams, "github")
    : undefined;
  const mcpGoogleUrl = isMcp
    ? buildMcpAuthorizeUrl(searchParams, "google")
    : undefined;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 bg-background text-foreground">
      {/* a fixed max-width is best as the google sign-in button has a width constraint */}
      <div className="w-full space-y-6" style={{ width: "400px" }}>
        <div className="flex justify-center pb-4">
          <Image
            src="/images/measure_logo_horizontal_black.svg"
            width={200}
            height={80}
            alt={"Measure logo"}
            className="dark:hidden"
          />
          <Image
            src="/images/measure_logo_horizontal_white.svg"
            width={200}
            height={80}
            alt={"Measure logo"}
            className="hidden dark:block"
          />
        </div>

        {isMcp && (
          <p className="font-body text-center text-sm text-muted-foreground">
            Sign in to let{" "}
            <span className="font-semibold text-foreground">
              {mcpClientHost(searchParams) || "an MCP client"}
            </span>{" "}
            use Measure on your behalf.
            {redirectHost !== "" && (
              <>
                {" "}
                You will be sent back to{" "}
                <span className="font-semibold text-foreground">
                  {redirectHost}
                </span>
                .
              </>
            )}
          </p>
        )}
        {loading && <p className="font-body text-center">Loading...</p>}
        {home && <p className="font-body text-center">Logging in...</p>}
        {!loading && !session && !error && !message && (
          <GoogleSignIn mcpAuthorizeUrl={mcpGoogleUrl} />
        )}
      </div>
      <div className="my-6 place-content-end" style={{ width: "400px" }}>
        {!loading && !session && !error && !message && (
          <GitHubSignIn mcpAuthorizeUrl={mcpGitHubUrl} />
        )}
      </div>
      {/* Cloud only: self-hosted deployments aren't bound by these terms. */}
      {isCloud() && (
        <p className="font-body text-center text-sm text-muted-foreground max-w-100">
          By continuing, you agree to our{" "}
          <Link href="/terms-of-service" className={underlineLinkStyle}>
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy-policy" className={underlineLinkStyle}>
            Privacy Policy
          </Link>
          .
        </p>
      )}
      {!isMcp && inviteInvalid && (
        <p className="font-display text-center text-sm p-2 my-4 text-red-600">
          Invalid or expired invite link.
        </p>
      )}
      <Messages />
    </div>
  );
}
