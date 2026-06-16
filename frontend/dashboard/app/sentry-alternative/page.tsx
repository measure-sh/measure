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
  title: "Open Source Sentry Alternative",
  description:
    "Mobile focused, open source alternative to Sentry. Crashes, ANRs, performance, network and full session timelines for mobile engineering teams with simple pricing.",
  alternates: { canonical: "/sentry-alternative" },
  openGraph: {
    ...sharedOpenGraph,
    title: "Open Source Sentry Alternative | Measure",
    description:
      "Mobile focused, open source alternative to Sentry. Crashes, ANRs, performance, network and full session timelines for mobile engineering teams with simple pricing.",
    url: "/sentry-alternative",
  },
};

const differentiators: AlternativeDifferentiator[] = [
  {
    heading: "Full session context on every issue",
    icon: <LucideFilm className="w-48 h-48 text-rose-600 p-4" />,
    body: (
      <>
        Sentry gives you stack traces and breadcrumbs out of the box with
        Session Replays billed separately. If you want full context on every
        error, you will need to turn on Session Replays for all of them and
        accommodate the considerable cost increase.
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
        without any compromise on the context.
      </>
    ),
  },
  {
    heading: "Adaptive capture, not fixed sampling",
    icon: <LucideLayers className="w-48 h-48 text-indigo-500 p-4" />,
    body: (
      <>
        Sentry uses client-side sampling. You set a sample rate for traces and
        replays and decide up front what fraction to keep.
        <br />
        <br />
        Measure captures full session context by default, and with{" "}
        <Link href="/product/adaptive-capture" className={underlineLinkStyle}>
          Adaptive Capture
        </Link>{" "}
        you can tune what you collect remotely, without shipping an app update.
        <br />
        <br />
        Dial up sample rates on new releases or when chasing tricky production
        issues, dial down whenever you need to.
      </>
    ),
  },
  {
    heading: "Fully open source",
    icon: <LucideGitPullRequest className="w-48 h-48 text-sky-500 p-4" />,
    body: (
      <>
        Sentry uses a custom source-available rather than OSI open source: its
        main application and dashboard ship under the Functional Source License
        (FSL) with only the SDKs being MIT and the main application only going
        Apache 2.0 after 2 years.
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
        Sentry bills across a range of separate features: errors, spans, replays
        all cost different amounts across various tiers which makes it harder to
        predict costs as your app scales up.
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
        Sentry monitors servers, cloud, serverless, frontend, games and mobile
        across dozens of SDKs. Mobile is one platform among many, and the
        defaults, platform decisions, dashboards and product roadmap are shaped
        by the whole platform rather than by the needs of mobile devs alone.
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
    competitor:
      "Crash reports with breadcrumbs, Session replay billed separately",
  },
  {
    feature: "ANR detection with full session timelines",
    measure: true,
    competitor: "ANRs with breadcrumbs, Session replay billed separately",
  },
  { feature: "Performance traces", measure: true, competitor: true },
  {
    feature: "Network monitoring",
    measure: true,
    competitor: true,
  },
  {
    feature: "User journeys",
    measure: true,
    competitor: false,
  },
  { feature: "In-app bug reports", measure: true, competitor: true },
  {
    feature: "Session timeline on every issue",
    measure: true,
    competitor: "Session Replay billed separately",
  },
  {
    feature: "Dynamic Sampling with Adaptive Capture",
    measure: true,
    competitor: "Client side only sampling",
  },
  {
    feature: "Auto-captured context",
    measure: "Gestures, navigation, network, lifecycle",
    competitor: "Breadcrumbs, deeper context via Replay",
  },
  {
    feature: "Pricing",
    measure: "Simple pricing based on data usage",
    competitor:
      "Separate quotas for errors, spans, replays, profiling, cron, uptime & logs",
  },
  {
    feature: "Open Source",
    measure: "Apache 2.0 (OSI open source)",
    competitor: "FSL — source-available, Apache 2.0 after 2 years",
  },
  { feature: "Self-hostable", measure: true, competitor: true },
  {
    feature: "Public roadmap & issue tracker",
    measure: true,
    competitor: true,
  },

  {
    feature: "Mobile focus",
    measure: true,
    competitor: "One of many Sentry platforms",
  },
];

export default function SentryAlternative() {
  return (
    <AlternativePage
      title="Looking for Sentry alternatives?"
      intro={
        <>
          Sentry is a popular error monitoring tool with roots in the web dev
          world. Mobile support is a more recent expansion to the core error
          monitoring platform.
          <br />
          <br />
          Measure is a mobile first, open source Sentry alternative.
        </>
      }
      differentiators={differentiators}
      competitorName="Sentry"
      competitorColumnLabel="Sentry"
      comparisonRows={comparisonRows}
      ctaLocation="sentry_alternative"
    />
  );
}
