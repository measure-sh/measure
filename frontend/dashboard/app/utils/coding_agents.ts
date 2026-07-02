export type CodingAgent = {
  src: string;
  alt: string;
};

// Single source of truth for the coding agents Measure's MCP server works
// with, shared by the MCP product page and the per-platform pages. The logo
// SVGs are single-color and tinted per theme via `brightness-0 dark:invert`.
export const codingAgents: CodingAgent[] = [
  { src: "/images/coding_agents/claudecode.svg", alt: "Claude Code" },
  { src: "/images/coding_agents/codex.svg", alt: "OpenAI Codex" },
  { src: "/images/coding_agents/antigravity.svg", alt: "Google Antigravity" },
  { src: "/images/coding_agents/cursor.svg", alt: "Cursor" },
  { src: "/images/coding_agents/opencode.svg", alt: "OpenCode" },
  { src: "/images/coding_agents/pi.svg", alt: "Pi" },
  { src: "/images/coding_agents/devin.svg", alt: "Devin" },
  { src: "/images/coding_agents/kilocode.svg", alt: "Kilo Code" },
  { src: "/images/coding_agents/cline.svg", alt: "Cline" },
  { src: "/images/coding_agents/roocode.svg", alt: "Roo Code" },
];
