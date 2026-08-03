import Image from "next/image";
import type { ReactNode } from "react";
import { codingAgents } from "../utils/coding_agents";
import { webPageJsonLd } from "../utils/json_ld";
import type { PageSeo } from "../utils/metadata";
import { cn } from "../utils/shadcn_utils";
import TrackCtaLink from "./analytics/track_cta_link";
import { buttonVariants } from "./button_variants";
import JsonLd from "./json_ld";
import LandingFooter from "./landing_footer";
import LandingHeader from "./landing_header";
import ScaledPreview from "./scaled_preview";

// The demo block has three presentations:
// - "scaled": a full dashboard view rendered inside a ScaledPreview frame;
//   the frame height varies per page. Phones get the screenshot instead,
//   because the preview shrinks the dashboard past reading size.
// - "wide": the demo manages its own layout and renders in a plain
//   full-width column (the agent and MCP chat demos).
// - "card": the demo renders inside a padded, vertically scrollable card
//   (the adaptive capture demo).
export type ProductPageDemo =
  | {
      frame: "scaled";
      heightClassName: string;
      content: ReactNode;
      // Width and height are the screenshot file's real pixel size, which is
      // the ratio the browser reserves space from before the image loads.
      screenshot: {
        src: string;
        alt: string;
        width: number;
        height: number;
      };
    }
  | { frame: "wide"; content: ReactNode }
  | { frame: "card"; content: ReactNode };

export type CodingAgentsSection = {
  heading: string;
  body: ReactNode;
};

export type ProductPageProps = {
  seo: PageSeo;
  title: string;
  intro: ReactNode;
  demo: ProductPageDemo;
  codingAgentsSection?: CodingAgentsSection;
  ctaLocation: string;
};

function Demo({ demo }: { demo: ProductPageDemo }) {
  if (demo.frame === "scaled") {
    return (
      <>
        <Image
          src={demo.screenshot.src}
          alt={demo.screenshot.alt}
          width={demo.screenshot.width}
          height={demo.screenshot.height}
          sizes="100vw"
          className="md:hidden w-full h-auto rounded-lg border border-border shadow-sm"
        />
        <ScaledPreview heightClassName={demo.heightClassName}>
          {demo.content}
        </ScaledPreview>
      </>
    );
  }

  if (demo.frame === "wide") {
    return <div className="w-full">{demo.content}</div>;
  }

  return (
    <div className="w-full p-8 overflow-y-auto border border-border rounded-lg shadow-xl">
      {demo.content}
    </div>
  );
}

export default function ProductPage({
  seo,
  title,
  intro,
  demo,
  codingAgentsSection,
  ctaLocation,
}: ProductPageProps) {
  return (
    <main className="flex flex-col items-center justify-between">
      <JsonLd data={webPageJsonLd(seo)} />
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        <div className="max-w-6xl w-full mx-auto px-4 py-8 font-body">
          {/* Header */}
          <div className="py-16" />
          <h1 className="text-5xl font-display mb-2">{title}</h1>
          <div className="py-4" />
          <p className="text-justify text-lg">{intro}</p>

          <div className="mt-8">
            <Demo demo={demo} />
          </div>

          {codingAgentsSection ? (
            <div className="mt-24">
              <h2 className="text-3xl font-display mb-4">
                {codingAgentsSection.heading}
              </h2>
              <p className="text-justify text-lg">{codingAgentsSection.body}</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-12">
                {codingAgents.map((agent) => (
                  <div
                    key={agent.alt}
                    className="relative h-16 rounded-xl border border-border"
                  >
                    <Image
                      src={agent.src}
                      alt={agent.alt}
                      fill
                      sizes="(min-width: 768px) 220px, 40vw"
                      className="object-contain p-5 brightness-0 dark:invert"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
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
          Get Started For Free
        </TrackCtaLink>
        <div className="py-16" />
      </div>
      <LandingFooter />
    </main>
  );
}
