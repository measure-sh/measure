// Acquisition source classification: maps UTM + referrer + gclid signals
// into one of a small set of categories per the PM spec. Pure module, no
// SSR concerns.

export type AcquisitionSource =
  | "github"
  | "content"
  | "hn"
  | "reddit"
  | "twitter"
  | "linkedin"
  | "direct"
  | "referral"
  | "outbound_email"
  | "outbound_dm"
  | "mcp_directory"
  | "paid_search"
  | "paid_social"
  | "other";

export interface AcquisitionInput {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  referrer_domain?: string | null;
  gclid?: string | null;
}

export interface AcquisitionResult {
  source: AcquisitionSource;
  is_inbound: boolean; // false only for outbound_email and outbound_dm
}

// Domain lists are exported so callers can extend or inspect them. Each entry
// is matched against a stripped (no leading "www.") referrer host AND against
// the utm_source value (which we lowercase before checking).
export const MCP_DIRECTORY_DOMAINS: ReadonlyArray<string> = [
  "mcp.so",
  "mcpservers.org",
];

export const CONTENT_DOMAINS: ReadonlyArray<string> = [
  "dev.to",
  "medium.com",
  "hashnode.dev",
  "substack.com",
];

export const GITHUB_DOMAINS: ReadonlyArray<string> = ["github.com"];

export const HN_DOMAINS: ReadonlyArray<string> = [
  "news.ycombinator.com",
  "ycombinator.com",
];

export const REDDIT_DOMAINS: ReadonlyArray<string> = ["reddit.com"];

export const TWITTER_DOMAINS: ReadonlyArray<string> = ["twitter.com", "x.com"];

export const LINKEDIN_DOMAINS: ReadonlyArray<string> = ["linkedin.com"];

function norm(value?: string | null): string {
  if (!value) {
    return "";
  }
  return value.trim().toLowerCase();
}

// matchesDomain returns true when `host` equals or is a subdomain of any
// known domain in `list`. Comparisons are case-insensitive. Subdomain match
// allows e.g. "old.reddit.com" → "reddit.com".
function matchesDomain(host: string, list: ReadonlyArray<string>): boolean {
  if (!host) {
    return false;
  }
  const h = host.toLowerCase();
  for (const d of list) {
    if (h === d || h.endsWith(`.${d}`)) {
      return true;
    }
  }
  return false;
}

// sourceOrDomainMatches checks if either the utm_source value or the
// referrer_domain matches one of the known domains. utm_source matches
// require an exact equal; referrer_domain matches allow subdomain.
function sourceOrDomainMatches(
  utmSource: string,
  referrerDomain: string,
  list: ReadonlyArray<string>,
): boolean {
  if (utmSource && list.includes(utmSource)) {
    return true;
  }
  return matchesDomain(referrerDomain, list);
}

export function determineAcquisitionSource(
  input: AcquisitionInput,
): AcquisitionResult {
  const utmSource = norm(input.utm_source);
  const utmMedium = norm(input.utm_medium);
  const referrerDomain = norm(input.referrer_domain);
  const gclid = norm(input.gclid);

  // 1. outbound_email
  if (
    utmSource === "outbound_email" ||
    utmMedium === "outbound_email" ||
    (utmMedium === "email" &&
      (utmSource.includes("outreach") || utmSource.includes("sales")))
  ) {
    return { source: "outbound_email", is_inbound: false };
  }

  // 2. outbound_dm
  if (utmSource === "outbound_dm" || utmMedium === "outbound_dm") {
    return { source: "outbound_dm", is_inbound: false };
  }

  // 3. paid_search
  if (
    gclid ||
    utmMedium === "cpc" ||
    utmMedium === "ppc" ||
    utmMedium === "paid_search"
  ) {
    return { source: "paid_search", is_inbound: true };
  }

  // 4. paid_social
  if (utmMedium === "paid_social" || utmMedium === "social_paid") {
    return { source: "paid_social", is_inbound: true };
  }

  // 5. mcp_directory
  if (
    utmSource === "mcp_directory" ||
    sourceOrDomainMatches(utmSource, referrerDomain, MCP_DIRECTORY_DOMAINS)
  ) {
    return { source: "mcp_directory", is_inbound: true };
  }

  // 6. named social/code communities
  if (sourceOrDomainMatches(utmSource, referrerDomain, GITHUB_DOMAINS)) {
    return { source: "github", is_inbound: true };
  }
  if (sourceOrDomainMatches(utmSource, referrerDomain, HN_DOMAINS)) {
    return { source: "hn", is_inbound: true };
  }
  if (sourceOrDomainMatches(utmSource, referrerDomain, REDDIT_DOMAINS)) {
    return { source: "reddit", is_inbound: true };
  }
  if (sourceOrDomainMatches(utmSource, referrerDomain, TWITTER_DOMAINS)) {
    return { source: "twitter", is_inbound: true };
  }
  if (sourceOrDomainMatches(utmSource, referrerDomain, LINKEDIN_DOMAINS)) {
    return { source: "linkedin", is_inbound: true };
  }

  // 7. content
  if (
    utmMedium === "content" ||
    sourceOrDomainMatches(utmSource, referrerDomain, CONTENT_DOMAINS)
  ) {
    return { source: "content", is_inbound: true };
  }

  // 8. referral — any other non-empty referrer
  if (referrerDomain) {
    return { source: "referral", is_inbound: true };
  }

  // 9. direct — nothing at all
  if (!utmSource && !utmMedium && !gclid && !referrerDomain) {
    return { source: "direct", is_inbound: true };
  }

  // 10. fallback
  return { source: "other", is_inbound: true };
}
