import AgentDemo from "@/app/components/agent_demo";
import ProductPage from "@/app/components/product_page";
import { marketingPageMetadata } from "@/app/utils/metadata";
import type { Metadata } from "next";

export const metadata: Metadata = marketingPageMetadata({
  title: "Measure Agent — Debug your apps with full context",
  description:
    "Debug your apps with full context about crashes, errors, sessions and traces from Slack or your coding agent.",
  path: "/product/agent",
});

export default function ProductAgent() {
  return (
    <ProductPage
      title="Measure Agent"
      intro={
        <>
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
        </>
      }
      demo={{ frame: "wide", content: <AgentDemo /> }}
      codingAgentsSection={{
        heading: "Debug from your coding agent",
        body: (
          <>
            Measure Agent is also available from Measure&apos;s MCP server, so
            you can start debugging straight from your editor or terminal. Your
            coding agent can query it to fix a crash, walk a session, or run an
            agentic triage loop.
            <br />
            <br />
            Works great with Claude Code, OpenAI Codex, Google Antigravity,
            Cursor, OpenCode, Pi, Devin, Kilo Code, Cline, Roo Code and others.
          </>
        ),
      }}
      ctaLocation="product_agent"
    />
  );
}
