import { buttonVariants } from "@/app/components/button_variants";
import MCPDemo from "@/app/components/mcp_demo";
import TrackCtaLink from "@/app/components/analytics/track_cta_link";
import { sharedOpenGraph } from "@/app/utils/metadata";
import { cn } from "@/app/utils/shadcn_utils";
import type { Metadata } from "next";
import Image from "next/image";
import { codingAgents } from "@/app/utils/coding_agents";
import LandingFooter from "../../components/landing_footer";
import LandingHeader from "../../components/landing_header";

export const metadata: Metadata = {
  title: "MCP Server — Connect AI Agents to Measure",
  description:
    "Connect Measure to Claude Code, Codex, Cursor, Gemini and other AI coding agents. Query crashes, traces, sessions and bug reports from your editor or AI agent workflows.",
  alternates: { canonical: "/product/mcp" },
  openGraph: {
    ...sharedOpenGraph,
    title: "MCP Server — Connect AI Agents to Measure | Measure",
    description:
      "Connect Measure to Claude Code, Codex, Cursor, Gemini and other AI coding agents. Query crashes, traces, sessions and bug reports from your editor or AI agent workflows.",
    url: "/product/mcp",
  },
};

export default function ProductMCP() {
  return (
    <main className="flex flex-col items-center justify-between">
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        <div className="py-16" />
        <h1 className="text-6xl font-display w-full md:w-6xl px-4">
          MCP Server
        </h1>
        <div className="py-2" />
        <p className="text-lg font-body md:w-6xl text-justify px-4">
          Connect Measure with your favorite coding agents through the Model
          Context Protocol.
          <br />
          <br />
          MCP lets AI coding agent access your errors, performance traces,
          session timelines and bug reports directly in your development
          workflow.
          <br />
          <br />
          With MCP, you can simply ask your AI assistant to look up an error,
          let it fetch stack traces, session timelines and related context, and
          ship fixes faster than ever before.
        </p>
        <div className="w-full md:w-6xl mt-12 mb-24">
          <MCPDemo />
        </div>

        {/* Coding agents */}
        <div className="w-full md:w-6xl px-4 mb-32">
          <h2 className="text-3xl font-display mb-4">
            Works with your favorite coding agents
          </h2>
          <p className="text-justify text-lg">
            Built on an open standard, Measure plugs into whatever coding agent
            you already use. Connect your agent to the Measure MCP server and it
            can pull your app telemetry, then help you debug an issue, walk a
            user session, or run an agentic triage and debugging pipeline.
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
          location="product_mcp"
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
