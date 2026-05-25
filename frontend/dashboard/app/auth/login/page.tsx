"use client";

import {
  ValidateInviteApiStatus,
  validateInvitesFromServer,
} from "@/app/api/api_calls";
import { fetchCurrentSession, type Session } from "@/app/query/hooks";
import { queryClient } from "@/app/query/query_client";
import { useMeasureStoreRegistry } from "@/app/stores/provider";
import { resetAllStores } from "@/app/stores/reset_all";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { posthog } from "posthog-js";
import { useEffect, useState } from "react";
import { determineAcquisitionSource } from "@/app/utils/analytics/acquisition";
import { getStoredGCLID } from "@/app/utils/analytics/attribution";
import { getUTMState } from "@/app/utils/analytics/utm";
import GitHubSignIn from "./github-sign-in";
import GoogleSignIn from "./google-sign-in";
import Messages from "./messages";

function buildMcpAuthorizeUrl(
  searchParams: { [key: string]: string | string[] | undefined },
  provider: string,
): string {
  const apiBaseUrl = process?.env?.NEXT_PUBLIC_API_BASE_URL || "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "mcp" || value === undefined) {
      continue;
    }
    params.set(key, Array.isArray(value) ? value[0] : value);
  }
  params.set("provider", provider);
  return `${apiBaseUrl}/oauth/authorize?${params.toString()}`;
}

export default function Login({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const error = searchParams["error"];
  const message = searchParams["message"];
  const inviteId = searchParams["inviteId"];
  const isMcp = searchParams["mcp"] === "1";
  const [session, setSession] = useState<Session | null>(null);
  const [home, setHome] = useState("");
  const [loading, setLoading] = useState(!isMcp);
  const [inviteInvalid, setInviteInvalid] = useState(false);
  const router = useRouter();

  const validateInvite = async () => {
    const result = await validateInvitesFromServer(inviteId as string);

    switch (result.status) {
      case ValidateInviteApiStatus.Error:
        setInviteInvalid(true);
        break;
      case ValidateInviteApiStatus.Success:
        setInviteInvalid(false);
        break;
    }
  };

  useEffect(() => {
    if (!isMcp && inviteId) {
      validateInvite();
    }
  }, [inviteId, isMcp]);

  const registry = useMeasureStoreRegistry();

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

  useEffect(() => {
    if (isMcp) {
      return;
    }

    // Clear any leftover state from a previous user so the next sign-in starts fresh
    resetAllStores(registry);
    queryClient.clear();
  }, [isMcp]);

  useEffect(() => {
    if (isMcp) {
      return;
    }

    if (!session) {
      getSession();
      return;
    }

    if (session) {
      const url = `/${session.user.own_team_id}/overview`;
      setHome(url);
      router.replace(url);
    }
  }, [session, isMcp]);

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
      {!isMcp && inviteInvalid && (
        <p className="font-display text-center text-sm p-2 my-4 text-red-600">
          Invalid or expired invite link.
        </p>
      )}
      <Messages />
    </div>
  );
}
