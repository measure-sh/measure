import { buttonVariants } from "@/app/components/button_variants";
import MCPDemo from "@/app/components/mcp_demo";
import { sharedOpenGraph } from "@/app/utils/metadata";
import { cn } from "@/app/utils/shadcn_utils";
import type { Metadata } from "next";
import Link from "next/link";
import LandingFooter from "../../components/landing_footer";
import LandingHeader from "../../components/landing_header";

export const metadata: Metadata = {
  title: "MCP Server",
  description:
    "Connect Measure to Claude, Codex, Cursor and other coding agents. Query crashes, traces and sessions to fix issues faster than ever with AI.",
  alternates: { canonical: "/product/mcp" },
  openGraph: {
    ...sharedOpenGraph,
    title: "Measure MCP Server",
    description:
      "Connect Measure to Claude, Codex, Cursor and other coding agents. Query crashes, traces and sessions to fix issues faster than ever with AI.",
    url: "/product/mcp",
  },
};

export default function ProductMCP() {
  return (
    <main className="flex flex-col items-center justify-between">
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        <div className="py-16" />
        <h1 className="text-6xl font-display w-full md:w-6xl px-4">MCP</h1>
        <div className="py-2" />
        <p className="text-lg leading-relaxed font-body md:w-6xl text-justify px-4">
          Connect Measure with your favorite coding agents through the Model
          Context Protocol.
          <br />
          <br />
          MCP lets AI coding assistants like Claude, Codex, and Gemini access
          your errors, performance traces, session timelines, and bug reports
          directly in your development workflow.
          <br />
          <br />
          With MCP, you can simply ask your AI assistant to look up an error,
          get the full context including stack traces and session timelines
          leading to the issue and harness the power of AI to ship fixes faster
          than ever before.
        </p>
        <div className="w-full md:w-6xl mt-12 mb-32">
          <MCPDemo />
        </div>

        {/* CTA */}
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
