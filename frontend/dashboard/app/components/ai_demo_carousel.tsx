"use client";

import Link from "next/link";
import { useState } from "react";
import { underlineLinkStyle } from "../utils/shared_styles";
import AgentDemo from "./agent_demo";
import MCPDemo from "./mcp_demo";
import TabSelect, { TabSize } from "./tab_select";

const AGENT = "Measure Agent";
const MCP = "MCP Server";

export default function AIDemoCarousel() {
  const [selected, setSelected] = useState(AGENT);

  return (
    <>
      <div className="flex items-center justify-center">
        <TabSelect
          size={TabSize.Large}
          items={[AGENT, MCP]}
          selected={selected}
          onChangeSelected={setSelected}
        />
      </div>
      <div className="py-2 md:py-4" />
      <p className="text-lg font-body text-justify max-w-4xl px-4">
        {selected === AGENT ? (
          <>
            Debug with{" "}
            <Link href="/product/agent" className={underlineLinkStyle}>
              Measure Agent
            </Link>{" "}
            right inside Slack or your coding agent. Ask about a crash, error or
            slow endpoint and it digs through your telemetry to find the answer.
          </>
        ) : (
          <>
            Connect Measure with your favorite coding agents through our{" "}
            <Link href="/product/mcp" className={underlineLinkStyle}>
              MCP Server
            </Link>
            . Let your coding agent query errors, traces and session timelines
            directly in your development workflow.
          </>
        )}
      </p>
      <div className="py-2 md:py-4" />
      <div className="w-full md:w-6xl">
        {selected === AGENT ? <AgentDemo /> : <MCPDemo />}
      </div>
    </>
  );
}
