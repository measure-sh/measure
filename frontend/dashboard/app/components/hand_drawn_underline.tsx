import type { ReactNode } from "react";

const COLORS = {
  yellow: "#facc15", // yellow-400
  red: "#ef4444", // red-500
  pink: "#f472b6", // pink-400
  rose: "#fb7185", // rose-400
  sky: "#38bdf8", // sky-400
  green: "#4ade80", // green-400
} as const;

export default function HandDrawnUnderline({
  children,
  color = "yellow",
}: {
  children: ReactNode;
  color?: keyof typeof COLORS;
}) {
  return (
    <span className="relative inline-block whitespace-nowrap">
      {children}
      <svg
        aria-hidden="true"
        className="absolute left-0 -bottom-[0.05em] w-full h-[0.25em] overflow-visible"
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
      >
        <path
          d="M2,5 Q15,2 35,4 T65,3 T98,5"
          stroke={COLORS[color]}
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </span>
  );
}
