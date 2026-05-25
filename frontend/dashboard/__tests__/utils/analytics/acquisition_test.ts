/**
 * @jest-environment jsdom
 */

import {
  AcquisitionInput,
  AcquisitionResult,
  determineAcquisitionSource,
} from "@/app/utils/analytics/acquisition";
import { describe, expect, it } from "@jest/globals";

interface Case {
  name: string;
  input: AcquisitionInput;
  expected: AcquisitionResult;
}

const cases: Case[] = [
  // -- outbound_email --
  {
    name: "utm_source=outbound_email → outbound_email (inbound=false)",
    input: { utm_source: "outbound_email" },
    expected: { source: "outbound_email", is_inbound: false },
  },
  {
    name: "utm_medium=outbound_email → outbound_email (inbound=false)",
    input: { utm_medium: "outbound_email", utm_source: "newsletter" },
    expected: { source: "outbound_email", is_inbound: false },
  },
  {
    name: "utm_medium=email + utm_source containing 'outreach' → outbound_email",
    input: { utm_medium: "email", utm_source: "q1_outreach" },
    expected: { source: "outbound_email", is_inbound: false },
  },
  {
    name: "utm_medium=email + utm_source containing 'sales' → outbound_email",
    input: { utm_medium: "email", utm_source: "sales_team" },
    expected: { source: "outbound_email", is_inbound: false },
  },

  // -- outbound_dm --
  {
    name: "utm_source=outbound_dm → outbound_dm (inbound=false)",
    input: { utm_source: "outbound_dm" },
    expected: { source: "outbound_dm", is_inbound: false },
  },
  {
    name: "utm_medium=outbound_dm → outbound_dm",
    input: { utm_medium: "outbound_dm", utm_source: "linkedin" },
    expected: { source: "outbound_dm", is_inbound: false },
  },

  // -- paid_search --
  {
    name: "gclid present → paid_search",
    input: { gclid: "abc123", referrer_domain: "google.com" },
    expected: { source: "paid_search", is_inbound: true },
  },
  {
    name: "utm_medium=cpc → paid_search",
    input: { utm_medium: "cpc", utm_source: "google" },
    expected: { source: "paid_search", is_inbound: true },
  },
  {
    name: "utm_medium=ppc → paid_search",
    input: { utm_medium: "ppc" },
    expected: { source: "paid_search", is_inbound: true },
  },
  {
    name: "utm_medium=paid_search → paid_search",
    input: { utm_medium: "paid_search" },
    expected: { source: "paid_search", is_inbound: true },
  },

  // -- paid_social --
  {
    name: "utm_medium=paid_social → paid_social",
    input: { utm_medium: "paid_social", utm_source: "twitter" },
    expected: { source: "paid_social", is_inbound: true },
  },
  {
    name: "utm_medium=social_paid → paid_social",
    input: { utm_medium: "social_paid" },
    expected: { source: "paid_social", is_inbound: true },
  },

  // -- mcp_directory --
  {
    name: "utm_source=mcp_directory → mcp_directory",
    input: { utm_source: "mcp_directory" },
    expected: { source: "mcp_directory", is_inbound: true },
  },
  {
    name: "referrer_domain=mcp.so → mcp_directory",
    input: { referrer_domain: "mcp.so" },
    expected: { source: "mcp_directory", is_inbound: true },
  },
  {
    name: "referrer_domain=mcpservers.org → mcp_directory",
    input: { referrer_domain: "mcpservers.org" },
    expected: { source: "mcp_directory", is_inbound: true },
  },

  // -- github --
  {
    name: "referrer_domain=github.com → github",
    input: { referrer_domain: "github.com" },
    expected: { source: "github", is_inbound: true },
  },
  {
    name: "utm_source=github.com → github",
    input: { utm_source: "github.com" },
    expected: { source: "github", is_inbound: true },
  },
  {
    name: "referrer_domain=gist.github.com (subdomain) → github",
    input: { referrer_domain: "gist.github.com" },
    expected: { source: "github", is_inbound: true },
  },

  // -- hn --
  {
    name: "referrer_domain=news.ycombinator.com → hn",
    input: { referrer_domain: "news.ycombinator.com" },
    expected: { source: "hn", is_inbound: true },
  },
  {
    name: "referrer_domain=ycombinator.com → hn",
    input: { referrer_domain: "ycombinator.com" },
    expected: { source: "hn", is_inbound: true },
  },

  // -- reddit --
  {
    name: "referrer_domain=reddit.com → reddit",
    input: { referrer_domain: "reddit.com" },
    expected: { source: "reddit", is_inbound: true },
  },
  {
    name: "referrer_domain=old.reddit.com → reddit",
    input: { referrer_domain: "old.reddit.com" },
    expected: { source: "reddit", is_inbound: true },
  },

  // -- twitter --
  {
    name: "referrer_domain=twitter.com → twitter",
    input: { referrer_domain: "twitter.com" },
    expected: { source: "twitter", is_inbound: true },
  },
  {
    name: "referrer_domain=x.com → twitter",
    input: { referrer_domain: "x.com" },
    expected: { source: "twitter", is_inbound: true },
  },

  // -- linkedin --
  {
    name: "referrer_domain=linkedin.com → linkedin",
    input: { referrer_domain: "linkedin.com" },
    expected: { source: "linkedin", is_inbound: true },
  },

  // -- content --
  {
    name: "utm_medium=content → content",
    input: { utm_medium: "content" },
    expected: { source: "content", is_inbound: true },
  },
  {
    name: "referrer_domain=dev.to → content",
    input: { referrer_domain: "dev.to" },
    expected: { source: "content", is_inbound: true },
  },
  {
    name: "referrer_domain=medium.com → content",
    input: { referrer_domain: "medium.com" },
    expected: { source: "content", is_inbound: true },
  },
  {
    name: "referrer_domain=foo.substack.com (subdomain) → content",
    input: { referrer_domain: "foo.substack.com" },
    expected: { source: "content", is_inbound: true },
  },

  // -- referral (other non-empty domain) --
  {
    name: "referrer_domain=example.com → referral",
    input: { referrer_domain: "example.com" },
    expected: { source: "referral", is_inbound: true },
  },
  {
    name: "utm_source=unknown_partner + referrer set → referral",
    input: {
      utm_source: "unknown_partner",
      referrer_domain: "partner.example.com",
    },
    expected: { source: "referral", is_inbound: true },
  },

  // -- direct --
  {
    name: "no signals at all → direct",
    input: {},
    expected: { source: "direct", is_inbound: true },
  },
  {
    name: "all-null inputs → direct",
    input: {
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      referrer_domain: null,
      gclid: null,
    },
    expected: { source: "direct", is_inbound: true },
  },

  // -- other (a utm_source but no recognised category, no referrer) --
  {
    name: "utm_source set, no referrer, no medium → other",
    input: { utm_source: "newsletter_q1" },
    expected: { source: "other", is_inbound: true },
  },

  // -- combination / precedence --
  {
    name: "outbound_email wins over a github referrer",
    input: { utm_source: "outbound_email", referrer_domain: "github.com" },
    expected: { source: "outbound_email", is_inbound: false },
  },
  {
    name: "gclid wins over a twitter referrer",
    input: { gclid: "xyz", referrer_domain: "twitter.com" },
    expected: { source: "paid_search", is_inbound: true },
  },
  {
    name: "paid_social wins over content domain",
    input: { utm_medium: "paid_social", referrer_domain: "dev.to" },
    expected: { source: "paid_social", is_inbound: true },
  },
];

describe("determineAcquisitionSource", () => {
  for (const tc of cases) {
    it(tc.name, () => {
      const got = determineAcquisitionSource(tc.input);
      expect(got).toEqual(tc.expected);
    });
  }

  it("is case-insensitive on utm_source and referrer_domain", () => {
    expect(
      determineAcquisitionSource({ referrer_domain: "GitHub.com" }),
    ).toEqual({ source: "github", is_inbound: true });
    expect(determineAcquisitionSource({ utm_source: "GITHUB.COM" })).toEqual({
      source: "github",
      is_inbound: true,
    });
  });

  it("is_inbound is false ONLY for outbound_email and outbound_dm", () => {
    const outboundEmail = determineAcquisitionSource({
      utm_source: "outbound_email",
    });
    const outboundDm = determineAcquisitionSource({
      utm_source: "outbound_dm",
    });
    const github = determineAcquisitionSource({
      referrer_domain: "github.com",
    });
    const direct = determineAcquisitionSource({});

    expect(outboundEmail.is_inbound).toBe(false);
    expect(outboundDm.is_inbound).toBe(false);
    expect(github.is_inbound).toBe(true);
    expect(direct.is_inbound).toBe(true);
  });
});
