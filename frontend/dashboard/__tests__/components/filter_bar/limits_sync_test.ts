import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  MAX_CONDITIONS,
  MAX_DEPTH,
  MAX_FILTER_BYTES,
  MAX_VALUES_PER_CONDITION,
} from "@/app/components/filter_bar/limits";

// Filter bar and server hold copies of same limits so this reads the
// server's file and fails if they are different.
const limitsFile = path.join(
  __dirname,
  "../../../../../backend/libs/exprfilter/limits.go",
);

// Parse only the forms used in limits.go; reject anything else.
function readGoValue(name: string, written: string): number {
  const plain = written.match(/^(\d+)$/);
  if (plain) {
    return Number(plain[1]);
  }

  const shifted = written.match(/^(\d+)\s*<<\s*(\d+)$/);
  if (shifted) {
    return Number(shifted[1]) << Number(shifted[2]);
  }

  throw new Error(`cannot read ${name} = ${written} in limits.go`);
}

function readGoLimits(): Record<string, number> {
  const source = readFileSync(limitsFile, "utf8");
  const limits: Record<string, number> = {};

  for (const line of source.split("\n")) {
    const declared = line.match(/^\s*(Max\w+)\s*=\s*(.+?)\s*$/);
    if (declared) {
      limits[declared[1]] = readGoValue(declared[1], declared[2]);
    }
  }

  return limits;
}

describe("the limits the filter bar copies from the server", () => {
  const goLimits = readGoLimits();

  const copied: [string, number][] = [
    ["MaxFilterBytes", MAX_FILTER_BYTES],
    ["MaxDepth", MAX_DEPTH],
    ["MaxConditions", MAX_CONDITIONS],
    ["MaxValuesPerCondition", MAX_VALUES_PER_CONDITION],
  ];

  it.each(copied)(
    "%s holds the same value as limits.go equivalent",
    (name, here) => {
      expect(goLimits).toHaveProperty(name);
      expect(goLimits[name]).toBe(here);
    },
  );
});
