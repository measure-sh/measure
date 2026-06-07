import {
  LucideCircleDollarSign,
  LucideFilm,
  LucideGitPullRequest,
  LucideLayers,
  LucideSmartphone,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { sharedOpenGraph } from "@/app/utils/metadata";
import AlternativePage, {
  type AlternativeComparisonRow,
  type AlternativeDifferentiator,
} from "../components/alternative_page";
import TrackGithubLink from "../components/analytics/track_github_link";
import { underlineLinkStyle } from "../utils/shared_styles";

export const metadata: Metadata = {
  title: "Open Source Datadog Alternative",
  description:
    "Mobile focused open source alternative to Datadog. Crashes, ANRs, performance, network and full session timelines for mobile engineering teams with simple pricing.",
  alternates: { canonical: "/datadog-alternative" },
  openGraph: {
    ...sharedOpenGraph,
    title: "Open Source Datadog Alternative | Measure",
    description:
      "Mobile focused open source alternative to Datadog. Crashes, ANRs, performance, network and full session timelines for mobile engineering teams with simple pricing.",
    url: "/datadog-alternative",
  },
};

const differentiators: AlternativeDifferentiator[] = [
  {
    heading: "Full session context on every issue",
    icon: <LucideFilm className="w-48 h-48 text-rose-600 p-4" />,
    body: (
      <>
        With Datadog you get the stack trace plus the session&apos;s
        auto-captured actions, views and network requests. The richer,
        replay-style view of what the user did comes from Mobile Session Replay,
        which is sampled and billed as a separate product. This means you
        capture a fraction of sessions when the cost adds up at scale rather
        than all of them.
        <br />
        <br />
        Measure attaches a full{" "}
        <Link href="/product/session-timelines" className={underlineLinkStyle}>
          Session Timeline
        </Link>{" "}
        with gestures, navigation, network calls, lifecycle events and custom
        spans to every crash, ANR and error and you only pay for the data used
        as a whole.
        <br />
        <br />
        You see exactly what the user did and what the app did, on every issue,
        without deciding in advance which sessions are worth recording. No more
        ending with a production issue with no visibility because the session
        context got sampled out.
      </>
    ),
  },
  {
    heading: "Adaptive capture, not fixed sampling",
    icon: <LucideLayers className="w-48 h-48 text-indigo-500 p-4" />,
    body: (
      <>
        Datadog uses fixed client-side sampling. You set a session sample rate,
        with a separate replay sample rate applied on top, decide up front what
        fraction to keep, and the rest is dropped before it ever reaches you.
        <br />
        <br />
        Measure captures full session context by default, and with{" "}
        <Link href="/product/adaptive-capture" className={underlineLinkStyle}>
          Adaptive Capture
        </Link>{" "}
        you tune what you collect remotely, without shipping an app update.
        <br />
        <br />
        Dial up sample rates on new releases or when chasing tricky production
        issues, dial down whenever you need to. Measure puts you in control.
      </>
    ),
  },
  {
    heading: "Fully open source",
    icon: <LucideGitPullRequest className="w-48 h-48 text-sky-500 p-4" />,
    body: (
      <>
        Datadog publishes its mobile SDKs as open source, but the backend and
        dashboard are a proprietary SaaS and there is no self-host option. You
        can read the SDK, but you can&apos;t see or run the platform that
        ingests and stores your data.
        <br />
        <br />
        Measure is{" "}
        <TrackGithubLink
          href="https://github.com/measure-sh/measure"
          target="_blank"
          className={underlineLinkStyle}
        >
          fully open source
        </TrackGithubLink>
        . Read it, run it, self-host it, audit the pipeline and if you think
        something can be done better, send a pull request.
      </>
    ),
  },
  {
    heading: "Simple, predictable pricing",
    icon: <LucideCircleDollarSign className="w-48 h-48 text-green-500 p-4" />,
    body: (
      <>
        Datadog is metered across a long list of separate SKUs. RUM sessions are
        split into tiers, Mobile Session Replay is billed on top, and that sits
        alongside per-host APM and infrastructure and per-gigabyte logs. There
        are consultants who make a living out of helping you understand and
        reduce your Datadog bills.
        <br />
        <br />
        Measure has a single, transparent{" "}
        <Link href="/pricing" className={underlineLinkStyle}>
          price
        </Link>{" "}
        based on how much data you use. No per-seat fees, no separate product
        meters. With{" "}
        <Link href="/product/adaptive-capture" className={underlineLinkStyle}>
          Adaptive Capture
        </Link>{" "}
        you can dial collection up or down without rolling out app updates to
        control your costs even better.
      </>
    ),
  },
  {
    heading: "Built for mobile, by mobile devs",
    icon: <LucideSmartphone className="w-48 h-48 text-yellow-500 p-4" />,
    body: (
      <>
        Datadog monitors infrastructure, servers, cloud, APM, logs, security and
        frontend across hundreds of integrations, so mobile is one small corner
        of a sprawling observability platform. Mobile is one workload among
        many, and the defaults, dashboards and roadmap are shaped by the whole
        platform rather than by mobile alone.
        <br />
        <br />
        Measure is built only for mobile.{" "}
        <Link href="/product/crashes-and-anrs" className={underlineLinkStyle}>
          Crashes &amp; ANRs
        </Link>
        ,{" "}
        <Link href="/product/app-health" className={underlineLinkStyle}>
          App Health
        </Link>
        ,{" "}
        <Link href="/product/performance-traces" className={underlineLinkStyle}>
          Performance Traces
        </Link>
        ,{" "}
        <Link
          href="/product/network-performance"
          className={underlineLinkStyle}
        >
          Network Performance
        </Link>
        ,{" "}
        <Link href="/product/bug-reports" className={underlineLinkStyle}>
          Bug Reports
        </Link>{" "}
        and{" "}
        <Link href="/product/user-journeys" className={underlineLinkStyle}>
          User Journeys
        </Link>{" "}
        are all designed around how mobile apps actually break in production.
        <br />
        <br />
        Mobile is not a part of our product, it is the whole product.
      </>
    ),
  },
];

const comparisonRows: AlternativeComparisonRow[] = [
  {
    feature: "Crash reporting with full session timelines",
    measure: true,
    competitor: "Crash reports, session replay sampled & billed separately",
  },
  {
    feature: "ANR detection with full session timelines",
    measure: true,
    competitor: "ANRs, session replay sampled & billed separately",
  },
  { feature: "Performance traces", measure: true, competitor: true },
  { feature: "Network monitoring", measure: true, competitor: true },
  { feature: "User journeys", measure: true, competitor: true },
  { feature: "In-app bug reports", measure: true, competitor: false },
  {
    feature: "Session timeline on every issue",
    measure: true,
    competitor: "Session replay, sampled & billed separately",
  },
  {
    feature: "Dynamic Sampling with Adaptive Capture",
    measure: true,
    competitor: "Static client side only sampling",
  },
  {
    feature: "Auto-captured context",
    measure: "Gestures, navigation, network, lifecycle",
    competitor: "Actions, views, network, errors",
  },
  {
    feature: "Pricing",
    measure: "Simple pricing based on data usage",
    competitor:
      "Separate SKUs for RUM session tiers, replay, APM, infra & logs",
  },
  {
    feature: "Open Source",
    measure: "Apache 2.0 (OSI open source)",
    competitor: "SDKs only",
  },
  { feature: "Self-hostable", measure: true, competitor: false },
  {
    feature: "Public roadmap & issue tracker",
    measure: true,
    competitor: "SDK repos only",
  },
  {
    feature: "Mobile focus",
    measure: true,
    competitor: "One small part of a huge platform",
  },
];

export default function DatadogAlternative() {
  return (
    <AlternativePage
      title="Looking for Datadog alternatives?"
      intro={
        <>
          Datadog is a comprehensive observability platform with roots in
          infrastructure and backend monitoring, spanning servers, cloud, APM,
          logs, security, web and mobile.
          <br />
          <br />
          Measure is a mobile first, open source Datadog alternative.
        </>
      }
      differentiators={differentiators}
      competitorName="Datadog"
      competitorColumnLabel="Datadog"
      comparisonRows={comparisonRows}
      ctaLocation="datadog_alternative"
    />
  );
}
