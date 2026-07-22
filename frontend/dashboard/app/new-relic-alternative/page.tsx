import {
  LucideCircleDollarSign,
  LucideFilm,
  LucideGitPullRequest,
  LucideLayers,
  LucideSmartphone,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { marketingPageMetadata } from "@/app/utils/metadata";
import AlternativePage, {
  type AlternativeComparisonRow,
  type AlternativeDifferentiator,
} from "../components/alternative_page";
import TrackGithubLink from "../components/analytics/track_github_link";
import { underlineLinkStyle } from "../utils/shared_styles";

const seo = {
  title: "Open Source New Relic Alternative",
  description:
    "Mobile focused, open source alternative to New Relic. Crashes, ANRs, performance, network and full session timelines for mobile engineering teams with simple pricing.",
  path: "/new-relic-alternative",
};

export const metadata: Metadata = marketingPageMetadata(seo);

const differentiators: AlternativeDifferentiator[] = [
  {
    heading: "Full session context on every issue",
    icon: <LucideFilm className="w-48 h-48 text-rose-600 p-4" />,
    body: (
      <>
        New Relic gives you stack traces, breadcrumbs and interaction traces,
        and optionally Mobile Session Replay with several sampling options.
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
        The key difference is transparency. Measure is open source, the platform
        that stores your user data is transparent, and you never have to send
        your data to a proprietary, locked platform.
      </>
    ),
  },
  {
    heading: "Adaptive capture, not fixed sampling",
    icon: <LucideLayers className="w-48 h-48 text-indigo-500 p-4" />,
    body: (
      <>
        New Relic offers several sampling strategies. Some of these are server
        controlled but changing other sample rates means shipping an app update
        with new SDK settings.
        <br />
        <br />
        Measure captures full session context by default, and with{" "}
        <Link href="/product/adaptive-capture" className={underlineLinkStyle}>
          Adaptive Capture
        </Link>{" "}
        you can tune what you collect remotely, without shipping an app update.
        <br />
        <br />
        Dial up on new releases or when chasing tricky production issues, dial
        down whenever you need to.
      </>
    ),
  },
  {
    heading: "Fully open source",
    icon: <LucideGitPullRequest className="w-48 h-48 text-sky-500 p-4" />,
    body: (
      <>
        New Relic open sources its mobile agents, but the backend and dashboard
        are proprietary. You can look into the SDK, but you can&apos;t see or
        run the platform that ingests and stores your data.
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
        New Relic charges on data ingest and user seats. This means adding
        teammates and ingesting more data both push the bill up.
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
        New Relic monitors infrastructure, APM, logs, browser, synthetics,
        security and more across one expansive platform. Mobile is one surface
        among many, and the defaults, dashboards, product decisions and roadmap
        are shaped by the whole platform rather than by the needs of mobile devs
        alone.
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
    competitor: "Crash reports with optional Session replays",
  },
  {
    feature: "ANR detection with full session timelines",
    measure: true,
    competitor: "ANRs with optional Session replays",
  },
  { feature: "Performance traces", measure: true, competitor: true },
  { feature: "Network monitoring", measure: true, competitor: true },
  { feature: "User journeys", measure: true, competitor: true },
  { feature: "In-app bug reports", measure: true, competitor: false },
  {
    feature: "Session timeline on every issue",
    measure: true,
    competitor: "Session replay, sampled",
  },
  {
    feature: "Dynamic Sampling with Adaptive Capture",
    measure: true,
    competitor: "Sampled, partial remote control",
  },
  {
    feature: "Auto-captured context",
    measure: "Gestures, navigation, network, lifecycle",
    competitor: "Interactions, network, handled exceptions, breadcrumbs",
  },
  {
    feature: "Pricing",
    measure: "Simple pricing based on data usage",
    competitor: "Per-GB data ingest plus per-user seats",
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

export default function NewRelicAlternative() {
  return (
    <AlternativePage
      seo={seo}
      title="Looking for New Relic alternatives?"
      intro={
        <>
          New Relic is a comprehensive, all-in-one observability platform
          spanning APM, infrastructure, logs, browser monitoring, synthetics and
          mobile.
          <br />
          <br />
          Measure is a mobile first, open source New Relic alternative.
        </>
      }
      differentiators={differentiators}
      competitorName="New Relic"
      competitorColumnLabel="New Relic"
      comparisonRows={comparisonRows}
      ctaLocation="new_relic_alternative"
    />
  );
}
