import Image from "next/image";
import Link from "next/link";
import { isCloud } from "@/app/utils/env_utils";
import { underlineLinkStyle } from "@/app/utils/shared_styles";
import { pickMcpParams } from "../params";
import ConsentActions from "./consent_actions";

const maxNameLength = 60;
const maxRedirectUriLength = 200;

type Details = {
  client_name: string;
  client_host: string;
  redirect_host: string;
  redirect_uri: string;
  redirect_is_loopback: boolean;
};

// fetchDetails returns the client details from the agent, or null when unconfigured or the lookup fails.
async function fetchDetails(query: URLSearchParams): Promise<Details | null> {
  const agentOrigin = process.env.AGENT_BASE_URL;
  if (!agentOrigin) {
    return null;
  }
  try {
    const res = await fetch(`${agentOrigin}/oauth/authorize/details?${query}`, {
      cache: "no-store",
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

function displayName(d: Details): string {
  const name = (d.client_name ?? "").trim();
  if (!name) {
    return d.client_host || "An MCP client";
  }
  return name.length > maxNameLength
    ? `${name.slice(0, maxNameLength)}…`
    : name;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function Logo() {
  return (
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
  );
}

function Terms() {
  if (!isCloud()) {
    return null;
  }
  return (
    <p className="font-body text-center text-sm text-muted-foreground max-w-100">
      By continuing, you agree to our{" "}
      <Link href="/terms-of-service" className={underlineLinkStyle}>
        Terms of Service
      </Link>{" "}
      &{" "}
      <Link href="/privacy-policy" className={underlineLinkStyle}>
        Privacy Policy
      </Link>
      .
    </p>
  );
}

function Invalid() {
  return (
    <p className="font-body text-center">
      This sign-in link is invalid or expired. Start again from your MCP client.
    </p>
  );
}

function Consent({ details }: { details: Details }) {
  return (
    <>
      <h1 className="font-display text-center text-xl">
        {displayName(details)} wants to access your Measure account
      </h1>
      <p className="font-body text-center text-xs text-muted-foreground">
        Name provided by the app, not verified
      </p>
      <p className="font-body text-center text-sm">
        You&apos;ll be sent back to{" "}
        <span className="font-semibold">{details.redirect_host}</span>
      </p>
      <p className="font-mono text-center text-xs text-muted-foreground break-all">
        {truncate(details.redirect_uri ?? "", maxRedirectUriLength)}
      </p>
      {details.redirect_is_loopback && (
        <p className="font-body text-center text-sm text-muted-foreground">
          This app runs on this computer. Continue only if you started this
          sign-in.
        </p>
      )}
    </>
  );
}

export default async function McpAuthorize(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const first = (key: string) => {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const params = pickMcpParams({ get: (key) => first(key) ?? null });
  const details =
    first("error") === "1"
      ? null
      : await fetchDetails(new URLSearchParams(params));

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 bg-background text-foreground">
      <div className="w-full space-y-6" style={{ width: "400px" }}>
        <Logo />
        {details ? <Consent details={details} /> : <Invalid />}
        {details && <ConsentActions params={params} />}
      </div>
      <div className="my-6">
        <Terms />
      </div>
    </div>
  );
}
