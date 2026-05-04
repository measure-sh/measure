import { LucideCheckCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "../components/card";
import LandingFooter from "../components/landing_footer";
import LandingHeader from "../components/landing_header";
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

export const metadata: Metadata = {
  title: "Plans and Pricing",
  description:
    "Free tier for solo devs and small teams. Usage-based Pro plan for scale. No seat limits, no feature restrictions. 100% Open Source.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Plans and Pricing",
    description:
      "Free tier for solo devs and small teams. Usage-based Pro plan for scale. No seat limits, no feature restrictions. 100% Open Source.",
    url: "/pricing",
  },
};

export default function Pricing() {
  return (
    <main className="flex flex-col items-center justify-between">
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        {/* Header */}
        <div className="py-16" />
        <h1 className="text-6xl font-display">Pricing</h1>

        <div className="py-8" />
        <p className="text-lg leading-relaxed font-body md:w-6xl text-justify px-4">
          Measure Cloud pricing is based on the data you send to us and how long
          you retain it. If you are{" "}
          <Link href="/docs/hosting" className={underlineLinkStyle}>
            self hosting
          </Link>
          , it is completely free to use.
        </p>

        <div className="py-8" />
        <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl px-4 md:px-0">
          <Card className="w-full md:w-1/2">
            <div className="p-4 md:p-8 flex flex-col items-center">
              <p className="text-xl font-display">FREE</p>
              <p className="text-4xl font-display py-2">$0 per month</p>
              <ul className="list-disc space-y-2 mt-6">
                <li className="font-body">{FREE_GB} GB per month</li>
                <li className="font-body">
                  {FREE_RETENTION_DAYS} days retention
                </li>
                <li className="font-body">No credit card needed</li>
              </ul>
            </div>
          </Card>
          <Card className="w-full md:w-1/2 bg-green-50 dark:bg-card border border-green-300 dark:border-border">
            <div className="p-4 md:p-8 flex flex-col items-center">
              <p className="text-xl text-green-900 dark:text-primary font-display">
                PRO
              </p>
              <p className="text-4xl text-green-900 dark:text-primary font-display py-2">
                ${MINIMUM_PRICE_AFTER_FREE_TIER} per month
              </p>
              <ul className="list-disc space-y-2 mt-6">
                <li className="font-body text-green-900 dark:text-foreground">
                  {INCLUDED_PRO_GB} GB per month included
                </li>
                <li className="font-body text-green-900 dark:text-foreground">
                  {PRO_RETENTION_DAYS} days retention
                </li>
                <li className="font-body text-green-900 dark:text-foreground">
                  Extra data charged at ${PRICE_PER_GB_MONTH.toFixed(2)} per
                  GB/month
                </li>
              </ul>
            </div>
          </Card>
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
            <LucideCheckCircle className="text-green-600 dark:text-green-500 w-4 h-4" />
          </div>
          <div className="flex flex-row gap-4 items-center">
            <p>No Seat Limits</p>
            <LucideCheckCircle className="text-green-600 dark:text-green-500 w-4 h-4" />
          </div>
          <div className="flex flex-row gap-4 items-center">
            <p>No feature restrictions</p>
            <LucideCheckCircle className="text-green-600 dark:text-green-500 w-4 h-4" />
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
