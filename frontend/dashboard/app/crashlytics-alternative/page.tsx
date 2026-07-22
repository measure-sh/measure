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
  title: "Open Source Firebase Crashlytics Alternative",
  description:
    "Mobile focused, open source alternative to Firebase Crashlytics. Crashes, ANRs, performance, network and full session timelines for mobile engineering teams with simple pricing.",
  path: "/crashlytics-alternative",
};

export const metadata: Metadata = marketingPageMetadata(seo);

const differentiators: AlternativeDifferentiator[] = [
  {
    heading: "Beyond Crashes",
    icon: <LucideLayers className="w-48 h-48 text-indigo-500 p-4" />,
    body: (
      <>
        Crashlytics handles basic crash reporting but requires more tooling to
        complete the mobile app monitoring picture.
        <br />
        <br />
        Performance traces need the performance monitoring add-on. Understanding
        what the user was doing when the crash happened requires enabling Google
        Analytics and manually instrumenting breadcrumb logs. Bug reporting
        requires third party tooling. Data analysis needs BigQuery export which
        is charged separately. The number of SDKs in your app and the tools you
        need to look at keep expanding.
        <br />
        <br />
        Measure unifies{" "}
        <Link href="/product/crashes-and-anrs" className={underlineLinkStyle}>
          Crashes &amp; ANRs
        </Link>
        ,{" "}
        <Link
          href="/product/network-performance"
          className={underlineLinkStyle}
        >
          Network Performance
        </Link>
        ,{" "}
        <Link href="/product/performance-traces" className={underlineLinkStyle}>
          Performance Traces
        </Link>
        ,{" "}
        <Link href="/product/app-health" className={underlineLinkStyle}>
          App Health
        </Link>
        ,{" "}
        <Link href="/product/bug-reports" className={underlineLinkStyle}>
          Bug Reports
        </Link>{" "}
        and{" "}
        <Link href="/product/user-journeys" className={underlineLinkStyle}>
          User Journeys
        </Link>{" "}
        in one product. Every issue comes with a full Session Timeline which is
        auto collected for you without having to manually instrument every user
        interaction in your app.
        <br />
        <br />
        One SDK, one dashboard, one place to look so you can stop stitching
        context and get to the root cause faster.
      </>
    ),
  },
  {
    heading: "Full session context, not just stack traces",
    icon: <LucideFilm className="w-48 h-48 text-rose-600 p-4" />,
    body: (
      <>
        Crash reports in Crashlytics come with stack traces and manually
        instrumented breadcrumbs. Taps, navigations, network calls or lifecycle
        events require manual instrumentation which needs to be updated and
        synced when your app code changes in new releases.
        <br />
        <br />
        Measure auto-captures gestures, navigation, lifecycle events, network
        calls and custom spans, and replays them as a{" "}
        <Link href="/product/session-timelines" className={underlineLinkStyle}>
          Session Timeline
        </Link>{" "}
        attached to every crash, ANR or error.
        <br />
        <br />
        Measure makes it easy to see what the user did, what the app did and
        where things went wrong, without instrumenting every screen by hand.
      </>
    ),
  },
  {
    heading: "Open source",
    icon: <LucideGitPullRequest className="w-48 h-48 text-sky-500 p-4" />,
    body: (
      <>
        The Crashlytics SDKs are open source on GitHub, but the backend and
        dashboard are closed and run only on Google&apos;s proprietary
        infrastructure.
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
    heading: "Simple, transparent pricing",
    icon: <LucideCircleDollarSign className="w-48 h-48 text-green-500 p-4" />,
    body: (
      <>
        Crashlytics itself is free. The catch is that going further usually
        means stepping into the rest of the Firebase and GCP pricing ecosystem.
        BigQuery exports for data analysis, Cloud Functions for alerting and
        other paid GCP services require separate payment for advanced operations
        on your data.
        <br />
        <br />
        Measure has a single, transparent{" "}
        <Link href="/pricing" className={underlineLinkStyle}>
          price
        </Link>{" "}
        based on how much data you use. No per-seat charges, no hidden product
        bundles. With{" "}
        <Link href="/product/adaptive-capture" className={underlineLinkStyle}>
          Adaptive Capture
        </Link>{" "}
        you can dial collection up or down without rolling out app updates to
        control costs further.
      </>
    ),
  },
  {
    heading: "Built for mobile, by mobile devs",
    icon: <LucideSmartphone className="w-48 h-48 text-yellow-500 p-4" />,
    body: (
      <>
        Crashlytics sits inside the larger Firebase suite where mobile is one
        product line among many. The product roadmap and platform decisions
        compete with the priorities of a much bigger platform.
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
    competitor: "Crash reports with manual breadcrumbs",
  },
  {
    feature: "ANR detection with full session timelines",
    measure: true,
    competitor: "ANRs with manual breadcrumbs",
  },
  {
    feature: "Performance traces without sampling",
    measure: true,
    competitor: "Sampled",
  },
  {
    feature: "Network monitoring without sampling",
    measure: true,
    competitor: "Sampled",
  },
  {
    feature: "User journeys",
    measure: true,
    competitor: "Needs Google Analytics",
  },
  { feature: "In-app bug reports", measure: true, competitor: false },
  {
    feature: "Session timeline on every issue",
    measure: true,
    competitor: false,
  },
  {
    feature: "Dynamic Sampling with Adaptive Capture",
    measure: true,
    competitor: false,
  },
  {
    feature: "Auto-captured context",
    measure: "Gestures, navigation, network, lifecycle",
    competitor:
      "Screen views if Google Analytics is enabled but rest needs manual instrumentation",
  },
  {
    feature: "Pricing",
    measure: "Simple pricing based on data usage",
    competitor:
      "Free crash reporting but complex Google Analytics + BigQuery pricing for advanced users",
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
    feature: "Raw data access",
    measure: "Data export whenever you need it",
    competitor: "Paid export to BigQuery only",
  },
  {
    feature: "Mobile focus",
    measure: true,
    competitor: "One of many Firebase products",
  },
];

export default function CrashlyticsAlternative() {
  return (
    <AlternativePage
      seo={seo}
      title="Looking for Firebase Crashlytics alternatives?"
      intro={
        <>
          Firebase Crashlytics is a free and popular crash reporting tool that
          many apps start with.
          <br />
          <br />
          Measure is a mobile first, open source Firebase Crashlytics
          alternative.
        </>
      }
      differentiators={differentiators}
      competitorName="Firebase Crashlytics"
      competitorColumnLabel="Crashlytics"
      comparisonRows={comparisonRows}
      ctaLocation="crashlytics_alternative"
    />
  );
}
