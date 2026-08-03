"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { underlineLinkStyle } from "../utils/shared_styles";
import AgentDemo from "./agent_demo";
import MCPDemo from "./mcp_demo";
import TabSelect, { TabSize } from "./tab_select";

const sections = [
  {
    title: "Measure Agent",
    description: (
      <>
        Debug with{" "}
        <Link href="/product/agent" className={underlineLinkStyle}>
          Measure Agent
        </Link>{" "}
        right inside Slack or your coding agent. Ask about a crash, error or
        slow endpoint and it digs through your telemetry to find the answer.
      </>
    ),
    demo: <AgentDemo />,
  },
  {
    title: "MCP Server",
    description: (
      <>
        Connect Measure with your favorite coding agents through our{" "}
        <Link href="/product/mcp" className={underlineLinkStyle}>
          MCP Server
        </Link>
        . Let your coding agent query errors, traces and session replays
        directly in your development workflow.
      </>
    ),
    demo: <MCPDemo />,
  },
];

export default function AIDemoCarousel() {
  const [sectionIndex, setSectionIndex] = useState(0);
  // Null until the media query has run, so neither layout mounts a demo on the
  // first client render and the wrong one never starts animating.
  const [isWideViewport, setIsWideViewport] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setIsWideViewport(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return (
    <>
      {/* Phones read both sections one after another rather than switching
          between them, so each one carries its own heading. Each demo animates
          on a timer that keeps running while hidden, so only the demos the
          current width actually shows are mounted. The headings and copy are
          in the markup at both widths, which keeps them server-rendered and
          keeps the layout from changing once the media query resolves. */}
      <div className="md:hidden max-w-6xl w-full mx-auto mt-8 px-4 font-body">
        {sections.map((section) => (
          <div key={section.title} className="mt-24 first:mt-0">
            <h3 className="text-3xl font-display mb-4">{section.title}</h3>
            <p className="text-justify text-lg">{section.description}</p>
            <div className="mt-8">
              {isWideViewport === false ? section.demo : null}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:flex items-center justify-center">
        <TabSelect
          size={TabSize.Large}
          items={sections.map((section) => section.title)}
          selected={sections[sectionIndex].title}
          onChangeSelected={(item) => {
            setSectionIndex(sections.findIndex((s) => s.title === item));
          }}
        />
      </div>
      <p className="hidden md:block max-w-4xl w-full px-4 my-8 text-justify text-lg font-body">
        {sections[sectionIndex].description}
      </p>
      <div className="hidden md:block w-full max-w-6xl px-4">
        {isWideViewport ? sections[sectionIndex].demo : null}
      </div>
    </>
  );
}
