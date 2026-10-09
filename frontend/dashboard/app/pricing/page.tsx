import { LucideCheckCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import LandingFooter from "../components/landing_footer";
import LandingHeader from "../components/landing_header";
import PlanFeature from "../components/plan_feature";
import PricingViewed from "./pricing_viewed";
import JsonLd from "../components/json_ld";
import { webPageJsonLd } from "../utils/json_ld";
import { pageMetadata } from "../utils/metadata";
import {
  FREE_GB,
  FREE_RETENTION_DAYS,
  INCLUDED_PRO_GB,
  MINIMUM_PRICE_AFTER_FREE_TIER,
  PRICE_PER_GB_MONTH,
  PRO_RETENTION_DAYS,
} from "../utils/pricing_constants";
import { underlineLinkStyle } from "../utils/shared_styles";
import PricingCalculator from "./pricing_calculator";

const seo = {
  title: "Pricing & Plans",
  description:
    "Free tier for solo devs and small teams. Usage-based Pro plan for scale. No seat limits. No artificial bundles. 100% open source.",
  path: "/pricing",
};

export const metadata: Metadata = pageMetadata(seo);

export default function Pricing() {
  return (
    <main className="flex flex-col items-center justify-between">
      <JsonLd data={webPageJsonLd(seo)} />
      <PricingViewed />
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        {/* Header */}
        <div className="max-w-6xl w-full mx-auto px-4 py-8 font-body">
          <div className="py-16" />
          <h1 className="text-5xl font-display mb-2">Pricing</h1>
          <div className="py-4" />
          <p className="text-justify text-lg">
            Simple pricing based on the data used. No stressing over seat
            limits. No need to buy artificial bundles of crashes and spans -
            just track what you need to get to the root cause faster.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl px-4 md:px-0">
          <section className="flex flex-col rounded-2xl border-2 border-border bg-card text-card-foreground p-8">
            <h2 className="font-display text-2xl">Free</h2>
            <p className="mt-6 flex items-baseline gap-2 font-display">
              <span className="text-6xl">$0</span>{" "}
              <span className="text-lg text-muted-foreground">per month</span>
            </p>
            <p className="mt-2 font-body text-muted-foreground">
              {FREE_GB} GB of data
            </p>
            <ul className="mt-8 pt-8 border-t border-border space-y-3 font-body">
              <PlanFeature>{FREE_RETENTION_DAYS} days retention</PlanFeature>
              <PlanFeature>MCP server</PlanFeature>
              <PlanFeature>No credit card needed</PlanFeature>
            </ul>
          </section>
          <section className="flex flex-col rounded-2xl border-2 border-primary bg-card text-card-foreground p-8">
            <h2 className="font-display text-2xl">Pro</h2>
            <p className="mt-6 flex items-baseline gap-2 font-display">
              <span className="text-6xl">${MINIMUM_PRICE_AFTER_FREE_TIER}</span>{" "}
              <span className="text-lg text-muted-foreground">per month</span>
            </p>
            <p className="mt-2 font-body text-muted-foreground">
              {INCLUDED_PRO_GB} GB of data, then $
              {PRICE_PER_GB_MONTH.toFixed(2)} per GB
            </p>
            <ul className="mt-8 pt-8 border-t border-border space-y-3 font-body">
              <PlanFeature>{PRO_RETENTION_DAYS} days retention</PlanFeature>
              <PlanFeature>MCP server and Measure Agent</PlanFeature>
              <PlanFeature>
                Agent usage at provider token rates + a percentage markup for
                compute
              </PlanFeature>
            </ul>
          </section>
        </div>

        <div className="py-12" />

        <div className="flex flex-wrap justify-between px-4 md:px-0 md:w-4xl gap-4 font-display">
          <div className="flex flex-row gap-4 items-center">
            <p>
              Control costs with{" "}
              <Link
                href="/product/adaptive-capture"
                className={underlineLinkStyle}
              >
                Adaptive Capture
              </Link>
            </p>
            <LucideCheckCircle className="text-green-700 dark:text-green-400 w-4 h-4" />
          </div>
          <div className="flex flex-row gap-4 items-center">
            <p>No Seat Limits</p>
            <LucideCheckCircle className="text-green-700 dark:text-green-400 w-4 h-4" />
          </div>
          <div className="flex flex-row gap-4 items-center">
            <p>No Artificial Bundles</p>
            <LucideCheckCircle className="text-green-700 dark:text-green-400 w-4 h-4" />
          </div>
        </div>

        {/* Cost Estimator */}
        <div className="py-12" />
        <PricingCalculator />
        <div className="py-16" />
      </div>
      <LandingFooter />
    </main>
  );
}
