import { buttonVariants } from "@/app/components/button_variants";
import { sharedOpenGraph } from "@/app/utils/metadata";
import { cn } from "@/app/utils/shadcn_utils";
import {
  LucideBug,
  LucideCircleDollarSign,
  LucideGitPullRequest,
  LucideSmartphone,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import LandingFooter from "../components/landing_footer";
import LandingHeader from "../components/landing_header";
import { underlineLinkStyle } from "../utils/shared_styles";

export const metadata: Metadata = {
  title: { absolute: "Why Measure" },
  description:
    "At Measure, Mobile is not an add-on to an observability product. Mobile is the product.",
  alternates: { canonical: "/why-measure" },
  openGraph: {
    ...sharedOpenGraph,
    title: "Why Measure",
    description:
      "At Measure, Mobile is not an add-on to an observability product. Mobile is the product.",
    url: "/why-measure",
  },
};

export default function WhyMeasure() {
  return (
    <main className="flex flex-col items-center justify-between">
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        <div className="max-w-6xl mx-auto px-4 py-8 font-body">
          {/* Header */}
          <div className="py-16" />
          <h1 className="text-5xl font-display mb-2">Why Measure?</h1>
          <div className="py-4" />
          <p className="text-justify text-lg">
            There are several mobile app monitoring tools in the market. What is
            different between these tools is the core philosophy of the teams
            building them which affects the products in small and large ways.
          </p>

          {/* Differentiator 1 */}
          <div className="flex flex-col md:flex-row w-full items-center gap-8 mt-24">
            <div className="flex flex-col flex-1">
              <h2 className="text-3xl font-display mb-4">Beyond Crashes</h2>
              <p className="text-justify text-lg">
                Measure is focused on giving the full picture of apps in
                production to mobile developers and is not just limited to basic
                error tracking.
                <br />
                <br />
                With advanced automated capture techniques and full{" "}
                <Link
                  href="/product/session-timelines"
                  className={underlineLinkStyle}
                >
                  Session Timelines
                </Link>
                , Measure allows you to get the full context of errors and
                performance issues as they happen in the wild.
                <br />
                <br />
                If you&apos;re looking to truly understand what issues occur in
                your app, how they impact users and how to debug them quickly,
                Measure is the right tool for you.
              </p>
            </div>
            <div className="flex items-center justify-center w-full md:w-64 flex-shrink-0">
              <LucideBug className="w-48 h-48 text-rose-600 p-4" />
            </div>
          </div>

          {/* Differentiator 2 */}
          <div className="flex flex-col md:flex-row w-full items-center gap-8 mt-24">
            <div className="flex flex-col flex-1">
              <h2 className="text-3xl font-display mb-4">Mobile Focus</h2>
              <p className="text-justify text-lg">
                Measure is built by mobile developers for mobile developers.
                Every feature, every design decision and every trade-off is made
                with mobile app production monitoring in mind.
                <br />
                <br />
                Mobile is not an add-on or afterthought to an observability
                product, it <b>is</b> the product.
                <br />
                <br />
                If you care about your app being treated with the respect and
                focus it deserves, Measure is the perfect match for you.
              </p>
            </div>
            <div className="flex items-center justify-center w-full md:w-64 flex-shrink-0">
              <LucideSmartphone className="w-48 h-48 text-yellow-500 p-4" />
            </div>
          </div>

          {/* Differentiator 3 */}
          <div className="flex flex-col md:flex-row w-full items-center gap-8 mt-24">
            <div className="flex flex-col flex-1">
              <h2 className="text-3xl font-display mb-4">Open Source</h2>
              <p className="text-justify text-lg">
                Measure is{" "}
                <Link
                  href="https://github.com/measure-sh/measure"
                  target="_blank"
                  className={underlineLinkStyle}
                >
                  fully open source.{" "}
                </Link>
                This means our code is open to scrutiny and community
                contributions which we strongly believe leads to a better
                product.
                <br />
                <br />
                If you value transparency, flexibility and open development,
                Measure is the right community for you.
              </p>
            </div>
            <div className="flex items-center justify-center w-full md:w-64 flex-shrink-0">
              <LucideGitPullRequest className="w-48 h-48 text-sky-500 p-4" />
            </div>
          </div>

          {/* Differentiator 4 */}
          <div className="flex flex-col md:flex-row w-full items-center gap-8 mt-24">
            <div className="flex flex-col flex-1">
              <h2 className="text-3xl font-display mb-4">Simple Pricing</h2>
              <p className="text-justify text-lg">
                Measure Cloud offers clear and transparent{" "}
                <Link href="/pricing" className={underlineLinkStyle}>
                  pricing
                </Link>{" "}
                based on data and retention. There are no bundles, hidden
                charges, seats or tiers (although we do offer discounts for high
                volume apps). You can send any combination of errors, metrics,
                spans etc without worrying about exceeding artificial limits.
                <br />
                <br />
                Further, with{" "}
                <Link
                  href="/product/adaptive-capture"
                  className={underlineLinkStyle}
                >
                  Adaptive Capture
                </Link>
                , you can optimize your data collection to only capture what you
                need and adjust it dynamically without rolling out app updates,
                reducing costs and data bloat.
                <br />
                <br />
                If you hate playing with excel sheets and pricing calculators to
                figure out your monthly bill and would like to adjust your data
                collection based on changing needs, Measure is the right choice
                for you.
              </p>
            </div>
            <div className="flex items-center justify-center w-full md:w-64 flex-shrink-0">
              <LucideCircleDollarSign className="w-48 h-48 text-green-500 p-4" />
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
