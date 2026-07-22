import MCPDemo from "@/app/components/mcp_demo";
import ProductPage from "@/app/components/product_page";
import { marketingPageMetadata } from "@/app/utils/metadata";
import type { Metadata } from "next";

const seo = {
  title: "MCP Server — Connect AI Agents to Measure",
  description:
    "Connect Measure to Claude Code, Codex, Cursor, Gemini and other AI coding agents. Query crashes, traces, sessions and bug reports from your editor or AI agent workflows.",
  path: "/product/mcp",
};

export const metadata: Metadata = marketingPageMetadata(seo);

export default function ProductMCP() {
  return (
    <ProductPage
      seo={seo}
      title="MCP Server"
      intro={
        <>
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
        </>
      }
      demo={{ frame: "wide", content: <MCPDemo /> }}
      codingAgentsSection={{
        heading: "Works with your favorite coding agents",
        body: (
          <>
            Built on an open standard, Measure plugs into whatever coding agent
            you already use. Connect your agent to the Measure MCP server and it
            can pull your app telemetry, then help you debug an issue, walk a
            user session, or run an agentic triage and debugging pipeline.
            <br />
            <br />
            Works great with Claude Code, OpenAI Codex, Google Antigravity,
            Cursor, OpenCode, Pi, Devin, Kilo Code, Cline, Roo Code and others.
          </>
        ),
      }}
      ctaLocation="product_mcp"
    />
  );
}
