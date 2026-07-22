import Image from "next/image";
import type { ReactNode } from "react";
import { webPageJsonLd } from "../utils/json_ld";
import type { MarketingPageSeo } from "../utils/metadata";
import { cn } from "../utils/shadcn_utils";
import TrackCtaLink from "./analytics/track_cta_link";
import { buttonVariants } from "./button_variants";
import JsonLd from "./json_ld";
import LandingFooter from "./landing_footer";
import LandingHeader from "./landing_header";

export type AgentLogo = {
  src: string;
  alt: string;
};

// A feature shows either a single screenshot or, for the coding-agents
// section, a grid of agent logos. The logo SVGs use currentColor, so they
// are tinted per theme in CSS rather than shipping separate color files.
export type PlatformFeature = {
  heading: string;
  body: ReactNode;
} & ({ image: string; imageAlt: string } | { logos: AgentLogo[] });

// Width and height are the logo's intrinsic dimensions; they set the aspect
// ratio so the rendered logo keeps its proportions next to the title.
export type PlatformLogo = {
  src: string;
  width: number;
  height: number;
  className?: string;
};

export type ForPlatformPageProps = {
  seo: MarketingPageSeo;
  title: string;
  logo: PlatformLogo;
  intro: ReactNode;
  features: PlatformFeature[];
  ctaLocation: string;
};

export default function ForPlatformPage({
  seo,
  title,
  logo,
  intro,
  features,
  ctaLocation,
}: ForPlatformPageProps) {
  return (
    <main className="flex flex-col items-center justify-between">
      <JsonLd data={webPageJsonLd(seo)} />
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        <div className="max-w-6xl mx-auto px-4 py-8 font-body">
          {/* Header */}
          <div className="py-16" />
          <h1 className="text-5xl font-display">
            {title}{" "}
            <Image
              src={logo.src}
              alt=""
              width={logo.width}
              height={logo.height}
              className={cn(
                "inline-block w-auto object-contain",
                logo.className ?? "h-12",
              )}
            />
          </h1>

          <div className="py-4" />
          <p className="text-justify text-lg">{intro}</p>

          {/* Features */}
          {features.map((feature, index) => (
            <div
              key={feature.heading}
              className={cn(
                "flex flex-col w-full items-center gap-16 mt-40",
                index % 2 === 0 ? "md:flex-row-reverse" : "md:flex-row",
              )}
            >
              <div className="flex items-center justify-center w-full md:flex-1 md:min-w-0">
                {"logos" in feature ? (
                  <div className="grid grid-cols-2 gap-4 w-full">
                    {feature.logos.map((agent) => (
                      <div
                        key={agent.alt}
                        className="relative h-16 rounded-xl border border-border"
                      >
                        <Image
                          src={agent.src}
                          alt={agent.alt}
                          fill
                          sizes="(min-width: 768px) 240px, 40vw"
                          className="object-contain p-5 brightness-0 dark:invert"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <Image
                    src={feature.image}
                    alt={feature.imageAlt}
                    width={2300}
                    height={1996}
                    sizes="(min-width: 768px) 36rem, 100vw"
                    className="w-full h-auto rounded-xl border border-border shadow-sm"
                  />
                )}
              </div>
              <div className="flex flex-col flex-1">
                <h2 className="text-3xl font-display mb-4">
                  {feature.heading}
                </h2>
                <p className="text-justify text-lg">{feature.body}</p>
              </div>
            </div>
          ))}
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
