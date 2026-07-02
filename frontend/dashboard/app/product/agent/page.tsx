import AgentDemo from "@/app/components/agent_demo";
import TrackCtaLink from "@/app/components/analytics/track_cta_link";
import { buttonVariants } from "@/app/components/button_variants";
import { codingAgents } from "@/app/utils/coding_agents";
import { sharedOpenGraph } from "@/app/utils/metadata";
import { cn } from "@/app/utils/shadcn_utils";
import type { Metadata } from "next";
import Image from "next/image";
import LandingFooter from "../../components/landing_footer";
import LandingHeader from "../../components/landing_header";

export const metadata: Metadata = {
  title: "Measure Agent — Debug your apps with full context",
  description:
    "Debug your apps with full context about crashes, errors, sessions and traces from Slack or your coding agent.",
  alternates: { canonical: "/product/agent" },
  openGraph: {
    ...sharedOpenGraph,
    title: "Measure Agent — Debug your apps with full context | Measure",
    description:
      "Debug your apps with full context about crashes, errors, sessions and traces from Slack or your coding agent.",
    url: "/product/agent",
  },
};

export default function ProductAgent() {
  return (
    <main className="flex flex-col items-center justify-between">
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        <div className="py-16" />
        <h1 className="text-6xl font-display w-full md:w-6xl px-4">
          Measure Agent
        </h1>
        <div className="py-2" />
        <p className="text-lg font-body md:w-6xl text-justify px-4">
          Debug your apps with full context about crashes, errors, sessions and
          traces from Slack or your coding agent.
          <br />
          <br />
          Measure Agent turns a question like &ldquo;how are crashes looking
          today?&rdquo; or &ldquo;which endpoints got slower after the last
          release?&rdquo; into the right query, then replies with concrete
          numbers and the sessions, errors and traces behind them. No dashboards
          to build and no query syntax to learn.
          <br />
          <br />
          Use it where you already work: right inside Slack, or from your coding
          agent over MCP.
        </p>
        <div className="w-full md:w-6xl mt-12 mb-24">
          <AgentDemo />
        </div>

        {/* Coding agents */}
        <div className="w-full md:w-6xl px-4 mb-32">
          <h2 className="text-3xl font-display mb-4">
            Debug from your coding agent
          </h2>
          <p className="text-justify text-lg">
            Measure Agent is also available from Measure&apos;s MCP server, so
            you can start debugging straight from your editor or terminal. Your
            coding agent can query it to fix a crash, walk a session, or run an
            agentic triage loop.
            <br />
            <br />
            Works great with Claude Code, OpenAI Codex, Google Antigravity,
            Cursor, OpenCode, Pi, Devin, Kilo Code, Cline, Roo Code and others.
          </p>
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

        {/* CTA */}
        <TrackCtaLink
          location="product_agent"
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
