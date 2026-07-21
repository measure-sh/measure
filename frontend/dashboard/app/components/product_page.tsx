import Image from "next/image";
import type { ReactNode } from "react";
import { codingAgents } from "../utils/coding_agents";
import { cn } from "../utils/shadcn_utils";
import TrackCtaLink from "./analytics/track_cta_link";
import { buttonVariants } from "./button_variants";
import LandingFooter from "./landing_footer";
import LandingHeader from "./landing_header";
import ScaledPreview from "./scaled_preview";

// The demo block has three presentations:
// - "scaled": a full dashboard view rendered inside a ScaledPreview frame;
//   the frame height varies per page.
// - "wide": the demo manages its own layout and renders in a plain
//   full-width column (the agent and MCP chat demos).
// - "card": the demo renders inside a padded, vertically scrollable card
//   (the adaptive capture demo).
export type ProductPageDemo =
  | { frame: "scaled"; heightClassName: string; content: ReactNode }
  | { frame: "wide"; content: ReactNode }
  | { frame: "card"; content: ReactNode };

export type CodingAgentsSection = {
  heading: string;
  body: ReactNode;
};

export type ProductPageProps = {
  title: string;
  intro: ReactNode;
  demo: ProductPageDemo;
  codingAgentsSection?: CodingAgentsSection;
  ctaLocation: string;
};

function Demo({ demo }: { demo: ProductPageDemo }) {
  if (demo.frame === "scaled") {
    return (
      <div
        className={cn(
          "relative w-full max-w-[90vw] md:max-w-6xl mt-12 mb-32 mx-auto border border-border rounded-lg shadow-xl overflow-hidden",
          demo.heightClassName,
        )}
      >
        <ScaledPreview>
          {/* Demos with sticky elements offset against this py-12 padding
              (the session timeline demo pins its charts with -top-12); keep
              the two in sync. */}
          <div className="bg-background text-foreground min-h-screen px-8 py-12">
            {demo.content}
          </div>
        </ScaledPreview>
      </div>
    );
  }

  if (demo.frame === "wide") {
    return <div className="w-full md:w-6xl mt-12 mb-24">{demo.content}</div>;
  }

  return (
    <div className="w-full md:w-6xl md:h-full p-8 mt-12 mb-32 overflow-y-auto border border-border rounded-lg shadow-xl overflow-hidden">
      {demo.content}
    </div>
  );
}

export default function ProductPage({
  title,
  intro,
  demo,
  codingAgentsSection,
  ctaLocation,
}: ProductPageProps) {
  return (
    <main className="flex flex-col items-center justify-between">
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        <div className="py-16" />
        <h1 className="text-6xl font-display w-full md:w-6xl px-4">{title}</h1>
        <div className="py-2" />
        <p className="text-lg font-body md:w-6xl text-justify px-4">{intro}</p>

        <Demo demo={demo} />

        {codingAgentsSection ? (
          <div className="w-full md:w-6xl px-4 mb-32">
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

        {/* CTA */}
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
