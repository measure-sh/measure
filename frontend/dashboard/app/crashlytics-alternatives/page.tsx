import {
  LucideCircleDollarSign,
  LucideFilm,
  LucideGitPullRequest,
  LucideLayers,
  LucideSmartphone,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/app/components/button_variants";
import { sharedOpenGraph } from "@/app/utils/metadata";
import { cn } from "@/app/utils/shadcn_utils";
import LandingFooter from "../components/landing_footer";
import LandingHeader from "../components/landing_header";
import { underlineLinkStyle } from "../utils/shared_styles";

export const metadata: Metadata = {
  title: "Open Source Firebase Crashlytics Alternative",
  description: "Open source alternative to Firebase Crashlytics. Unifies crashes, ANRs, performance, network and full session timelines for mobile engineering teams.",
  alternates: { canonical: "/crashlytics-alternatives" },
  openGraph: {
    ...sharedOpenGraph,
    title: "Open Source Firebase Crashlytics Alternative | Measure",
    description: "Open source alternative to Firebase Crashlytics. Unifies crashes, ANRs, performance, network and full session timelines for mobile engineering teams.",
    url: "/crashlytics-alternatives",
  },
};

export default function CrashlyticsAlternatives() {
  return (
    <main className="flex flex-col items-center justify-between">
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        <div className="max-w-6xl mx-auto px-4 py-8 font-body">
          {/* Header */}
          <div className="py-16" />
          <h1 className="text-5xl font-display mb-2">
            Looking for Crashlytics alternatives?
          </h1>
          <div className="py-4" />
          <p className="text-justify text-lg">
            Firebase Crashlytics is a great beginner crash reporting solution .
            Mobile teams need more than crashes and often end up looking for
            complete mobile app monitoring solutions.
            <br />
            <br />
            Measure is an open-source Crashlytics alternative built for mobile.
          </p>

          {/* Differentiator 1 */}
          <div className="flex flex-col md:flex-row w-full items-center gap-8 mt-24">
            <div className="flex flex-col flex-1">
              <h2 className="text-3xl font-display mb-4">Beyond Crashes</h2>
              <p className="text-justify text-lg">
                Crashlytics handles basic crash reporting but requires more
                tooling to complete the mobile app monitoring picture.
                <br />
                <br />
                Want performance traces? You need the Firebase Peformance
                Monitoring add-on. Want to understand what the user was doing
                when the crash happened? You&apos;ll need to enable Google
                Analytics and manually instrument breadcrumb logs for every kind
                of error you care about. Want users to report bugs? Buy a third
                party tool or hack your own. Want to analyse your data? Export
                it to BigQuery and pay per query. The number of SDKs in your app
                and the tools you need to look at keep expanding.
                <br />
                <br />
                Measure unifies{" "}
                <Link
                  href="/product/crashes-and-anrs"
                  className={underlineLinkStyle}
                >
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
                <Link
                  href="/product/performance-traces"
                  className={underlineLinkStyle}
                >
                  Performance Traces
                </Link>
                ,{" "}
                <Link href="/product/app-health" className={underlineLinkStyle}>
                  App Health
                </Link>
                ,{" "}
                <Link
                  href="/product/bug-reports"
                  className={underlineLinkStyle}
                >
                  Bug Reports
                </Link>{" "}
                and{" "}
                <Link
                  href="/product/user-journeys"
                  className={underlineLinkStyle}
                >
                  User Journeys
                </Link>{" "}
                in one product. Every issue comes with a full Session Timeline
                which is auto collected for you without having to manually
                instrument every user interaction in your app.
                <br />
                <br />
                One SDK, one dashboard, one place to look so you can stop
                stitching context and get to the root cause faster.
              </p>
            </div>
            <div className="flex items-center justify-center w-full md:w-64 flex-shrink-0">
              <LucideLayers className="w-48 h-48 text-indigo-500 p-4" />
            </div>
          </div>

          {/* Differentiator 2: Full session context */}
          <div className="flex flex-col md:flex-row w-full items-center gap-8 mt-24">
            <div className="flex flex-col flex-1">
              <h2 className="text-3xl font-display mb-4">
                Full session context, not just stack traces
              </h2>
              <p className="text-justify text-lg">
                When a crash hits in Crashlytics you get the stack trace plus
                breadcrumb logs. Those logs are powered by Google Analytics, so
                screen views are captured automatically but anything richer,
                like taps, navigation timing, network calls or lifecycle events,
                requires error-prone, manual instrumentation.
                <br />
                <br />
                Measure auto-captures gestures, navigation, lifecycle events,
                network calls and custom spans, and replays them as a{" "}
                <Link
                  href="/product/session-timelines"
                  className={underlineLinkStyle}
                >
                  Session Timeline
                </Link>{" "}
                attached to every crash, ANR or error.
                <br />
                <br />
                You see exactly what the user did, what the app did, and where
                things went wrong, without instrumenting every screen by hand.
              </p>
            </div>
            <div className="flex items-center justify-center w-full md:w-64 flex-shrink-0">
              <LucideFilm className="w-48 h-48 text-rose-600 p-4" />
            </div>
          </div>

          {/* Differentiator 3: Open source */}
          <div className="flex flex-col md:flex-row w-full items-center gap-8 mt-24">
            <div className="flex flex-col flex-1">
              <h2 className="text-3xl font-display mb-4">Open source</h2>
              <p className="text-justify text-lg">
                The Crashlytics SDKs are open source on GitHub, but the backend
                and dashboard are closed and run only on Google&apos;s
                infrastructure. Your users&apos; stack traces, device info and
                any breadcrumbs you log all flow through Firebase, and you
                can&apos;t see or change what happens once the data leaves the
                SDK.
                <br />
                <br />
                Measure is{" "}
                <Link
                  href="https://github.com/measure-sh/measure"
                  target="_blank"
                  className={underlineLinkStyle}
                >
                  fully open source
                </Link>
                . Read the SDK, read the backend, file issues, contribute fixes.
                Your data is yours, the pipeline is auditable, and you can be
                part of the community and help make it better.
              </p>
            </div>
            <div className="flex items-center justify-center w-full md:w-64 flex-shrink-0">
              <LucideGitPullRequest className="w-48 h-48 text-sky-500 p-4" />
            </div>
          </div>

          {/* Differentiator 4: Predictable pricing */}
          <div className="flex flex-col md:flex-row w-full items-center gap-8 mt-24">
            <div className="flex flex-col flex-1">
              <h2 className="text-3xl font-display mb-4">
                Predictable, transparent pricing
              </h2>
              <p className="text-justify text-lg">
                Crashlytics itself is free, and if free crash reporting is all
                you need, that&apos;s a fair choice. The catch is that going
                further usually means stepping into the rest of the Firebase and
                GCP price list: BigQuery exports for analysis, Cloud Functions
                for alerting, and other paid GCP services for anything you want
                to do with the data.
                <br />
                <br />
                Measure has a single, transparent{" "}
                <Link href="/pricing" className={underlineLinkStyle}>
                  price
                </Link>{" "}
                based on data volume and retention. No per-seat charges, no
                hidden product bundles. With{" "}
                <Link
                  href="/product/adaptive-capture"
                  className={underlineLinkStyle}
                >
                  Adaptive Capture
                </Link>{" "}
                you can dial collection up or down without rolling out app
                updates.
              </p>
            </div>
            <div className="flex items-center justify-center w-full md:w-64 flex-shrink-0">
              <LucideCircleDollarSign className="w-48 h-48 text-green-500 p-4" />
            </div>
          </div>

          {/* Differentiator 5: Mobile-first team */}
          <div className="flex flex-col md:flex-row w-full items-center gap-8 mt-24">
            <div className="flex flex-col flex-1">
              <h2 className="text-3xl font-display mb-4">
                Built for mobile, by mobile devs
              </h2>
              <p className="text-justify text-lg">
                Crashlytics sits inside the larger Firebase suite where mobile
                is one product line among many. The roadmap is opaque, and
                feature requests compete with the priorities of a much bigger
                platform.
                <br />
                <br />
                Measure is built by a mobile-first team. Every feature, every
                default and every trade-off is shaped by mobile devs solving
                real production issues. The roadmap and issue tracker are public
                on{" "}
                <Link
                  href="https://github.com/measure-sh/measure"
                  target="_blank"
                  className={underlineLinkStyle}
                >
                  GitHub
                </Link>
                . If something is missing, you can file it, see where it sits,
                or send a pull request.
              </p>
            </div>
            <div className="flex items-center justify-center w-full md:w-64 flex-shrink-0">
              <LucideSmartphone className="w-48 h-48 text-yellow-500 p-4" />
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-24" />
        <Link
          href="/auth/login"
          className={cn(
            buttonVariants({ variant: "default" }),
            "text-2xl px-8 py-8",
          )}
        >
          Get To The Root Cause
        </Link>
        <div className="py-16" />
      </div>

      <LandingFooter />
    </main>
  );
}
