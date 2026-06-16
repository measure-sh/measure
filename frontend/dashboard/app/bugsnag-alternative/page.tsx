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
  title: "Open Source Bugsnag Alternative",
  description:
    "Mobile focused, open source alternative to Bugsnag. Crashes, ANRs, performance, network and full session timelines for mobile engineering teams with simple pricing.",
  alternates: { canonical: "/bugsnag-alternative" },
  openGraph: {
    ...sharedOpenGraph,
    title: "Open Source Bugsnag Alternative | Measure",
    description:
      "Mobile focused, open source alternative to Bugsnag. Crashes, ANRs, performance, network and full session timelines for mobile engineering teams with simple pricing.",
    url: "/bugsnag-alternative",
  },
};

const differentiators: AlternativeDifferentiator[] = [
  {
    heading: "Full session context on every issue",
    icon: <LucideFilm className="w-48 h-48 text-rose-600 p-4" />,
    body: (
      <>
        Bugsnag gives you stack traces with breadcrumb trails of what happened
        before the error. Breadcrumbs have a max limit and there is no visual
        replay of the session.
        <br />
        <br />
        Measure attaches a full{" "}
        <Link href="/product/session-timelines" className={underlineLinkStyle}>
          Session Timeline
        </Link>{" "}
        with gestures, navigation, network calls, lifecycle events and custom
        spans to every crash, ANR and error, with no hard limit on what you can
        see.
        <br />
        <br />
        You see exactly what the user did and what the app did, on every issue,
        without any compromise on the context.
      </>
    ),
  },
  {
    heading: "Adaptive capture, not quota sampling",
    icon: <LucideLayers className="w-48 h-48 text-indigo-500 p-4" />,
    body: (
      <>
        Bugsnag keeps you limited to the tier you pay for by sampling.
        Performance data is sampled server-side so it fits your span quota, and
        errors are metered against a monthly event quota. In case of traffic
        spikes or sudden user growth, you would end up with less visibility into
        your system when you need more.
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
        Bugsnag publishes its notifier SDKs on GitHub under the MIT license, but
        the backend and dashboard are proprietary. You can read the SDK but the
        rest of the platform is opaque.
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
        Bugsnag meters two separate things, error events and performance spans,
        each against its own monthly quota. Exceeding quotas means sampling or
        overage.
        <br />
        <br />
        Measure has a single, transparent{" "}
        <Link href="/pricing" className={underlineLinkStyle}>
          price
        </Link>{" "}
        based on how much data you use. No separate product meters. With{" "}
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
        Bugsnag monitors mobile, web and backend across 50+ platforms and is now
        one product inside SmartBear&apos;s larger testing and monitoring suite.
        Mobile is one player among many, and the defaults, platform decisions,
        dashboards and roadmap are shaped by the whole portfolio rather than by
        the needs of mobile devs alone.
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
    competitor: "Crash reports with limited breadcrumbs",
  },
  {
    feature: "ANR detection with full session timelines",
    measure: true,
    competitor: "ANRs with limited breadcrumbs",
  },
  { feature: "Performance traces", measure: true, competitor: true },
  { feature: "Network monitoring", measure: true, competitor: true },
  { feature: "User journeys", measure: true, competitor: false },
  { feature: "In-app bug reports", measure: true, competitor: false },
  {
    feature: "Session timeline on every issue",
    measure: true,
    competitor: "Limited breadcrumbs only",
  },
  {
    feature: "Dynamic Sampling with Adaptive Capture",
    measure: true,
    competitor: "Quota-driven sampling",
  },
  {
    feature: "Auto-captured context",
    measure: "Gestures, navigation, network, lifecycle",
    competitor: "Navigation, network, taps via limited breadcrumbs",
  },
  {
    feature: "Pricing",
    measure: "Simple pricing based on data usage",
    competitor: "Separate quotas for error events & performance spans",
  },
  {
    feature: "Open Source",
    measure: "Apache 2.0 (OSI open source)",
    competitor: "SDKs only",
  },
  {
    feature: "Self-hostable",
    measure: true,
    competitor: "Enterprise on-premise",
  },
  {
    feature: "Public roadmap & issue tracker",
    measure: true,
    competitor: "SDK repos only",
  },
  {
    feature: "Mobile focus",
    measure: true,
    competitor: "One of many platforms",
  },
];

export default function BugsnagAlternative() {
  return (
    <AlternativePage
      title="Looking for Bugsnag alternatives?"
      intro={
        <>
          Bugsnag is an established error monitoring and app stability tool
          covering mobile alongside web and backend across dozens of platforms.
          <br />
          <br />
          Measure is a mobile first, open source Bugsnag alternative.
        </>
      }
      differentiators={differentiators}
      competitorName="Bugsnag"
      competitorColumnLabel="Bugsnag"
      comparisonRows={comparisonRows}
      ctaLocation="bugsnag_alternative"
    />
  );
}
