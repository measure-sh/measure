import { LucideCheck, LucideX } from "lucide-react";
import type { ReactNode } from "react";
import { webPageJsonLd } from "../utils/json_ld";
import type { MarketingPageSeo } from "../utils/metadata";
import { cn } from "../utils/shadcn_utils";
import TrackCtaLink from "./analytics/track_cta_link";
import { buttonVariants } from "./button_variants";
import JsonLd from "./json_ld";
import LandingFooter from "./landing_footer";
import LandingHeader from "./landing_header";

export type AlternativeComparisonValue = boolean | string;

export type AlternativeComparisonRow = {
  feature: string;
  measure: AlternativeComparisonValue;
  competitor: AlternativeComparisonValue;
};

export type AlternativeDifferentiator = {
  heading: string;
  body: ReactNode;
  icon: ReactNode;
};

export type AlternativePageProps = {
  seo: MarketingPageSeo;
  title: string;
  intro: ReactNode;
  differentiators: AlternativeDifferentiator[];
  competitorName: string;
  competitorColumnLabel: string;
  comparisonRows: AlternativeComparisonRow[];
  ctaLocation: string;
};

function ComparisonCell({
  value,
  emphasis,
}: {
  value: AlternativeComparisonValue;
  emphasis?: boolean;
}) {
  if (value === true) {
    return (
      <LucideCheck
        aria-label="Yes"
        className={cn(
          "w-5 h-5 mx-auto",
          emphasis ? "text-green-500" : "text-sky-500",
        )}
      />
    );
  }
  if (value === false) {
    return (
      <LucideX
        aria-label="No"
        className="w-5 h-5 mx-auto text-muted-foreground/50"
      />
    );
  }
  return <span className="text-sm text-muted-foreground">{value}</span>;
}

export default function AlternativePage({
  seo,
  title,
  intro,
  differentiators,
  competitorName,
  competitorColumnLabel,
  comparisonRows,
  ctaLocation,
}: AlternativePageProps) {
  return (
    <main className="flex flex-col items-center justify-between">
      <JsonLd data={webPageJsonLd(seo)} />
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        <div className="max-w-6xl mx-auto px-4 py-8 font-body">
          {/* Header */}
          <div className="py-16" />
          <h1 className="text-5xl font-display mb-2">{title}</h1>
          <div className="py-4" />
          <p className="text-justify text-lg">{intro}</p>

          {/* Differentiators */}
          {differentiators.map((differentiator) => (
            <div
              key={differentiator.heading}
              className="flex flex-col md:flex-row w-full items-center gap-8 mt-24"
            >
              <div className="flex flex-col flex-1">
                <h2 className="text-3xl font-display mb-4">
                  {differentiator.heading}
                </h2>
                <p className="text-justify text-lg">{differentiator.body}</p>
              </div>
              <div className="flex items-center justify-center w-full md:w-64 flex-shrink-0">
                {differentiator.icon}
              </div>
            </div>
          ))}

          {/* Comparison table */}
          <div className="mt-24">
            <h2 className="text-3xl font-display mb-8">
              Measure vs {competitorName}
            </h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr className="">
                    <th
                      scope="col"
                      className="w-1/2 py-4 px-4 sm:px-6 font-display text-base font-normal"
                    >
                      <span className="sr-only">Capability</span>
                    </th>
                    <th
                      scope="col"
                      className="bg-green-500/5 w-1/4 py-4 px-4 sm:px-6 text-center font-display text-base text-primary-foreground dark:text-white"
                    >
                      Measure
                    </th>
                    <th
                      scope="col"
                      className="w-1/4 py-4 px-4 sm:px-6 text-center font-display text-base text-muted-foreground"
                    >
                      {competitorColumnLabel}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.feature} className="border-t border-border">
                      <th
                        scope="row"
                        className="py-3 px-4 sm:px-6 text-left font-normal align-middle"
                      >
                        {row.feature}
                      </th>
                      <td className="py-3 px-4 sm:px-6 text-center align-middle bg-green-500/5">
                        <ComparisonCell value={row.measure} emphasis />
                      </td>
                      <td className="py-3 px-4 sm:px-6 text-center align-middle">
                        <ComparisonCell value={row.competitor} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-24" />
        <TrackCtaLink
          location={ctaLocation}
          destination="signup"
          href="/auth/login"
          className={cn(
            buttonVariants({ variant: "default" }),
            "text-2xl px-8 py-8",
          )}
        >
          Get To The Root Cause
        </TrackCtaLink>
        <div className="py-16" />
      </div>

      <LandingFooter />
    </main>
  );
}
