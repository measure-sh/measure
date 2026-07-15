/**
 * Pins the contract between the prose-link override in app/globals.css
 * and the fumadocs typography preset it overrides. The override makes
 * docs links inherit the surrounding text's weight instead of the
 * preset's 500, and it only works while the preset styles links through
 * the selector the override mirrors. If a fumadocs upgrade changes that
 * selector or drops the weight, this fails as a prompt to revisit the
 * override.
 */
import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";

// The typography module wraps its plugin body in tailwindcss's
// plugin.withOptions; the identity mock hands the body back so the test
// can call it with a stub API and capture what it registers.
jest.mock("tailwindcss/plugin", () => ({
  __esModule: true,
  default: { withOptions: (fn: unknown) => fn },
}));

import typography from "@fumadocs/tailwind/typography";

const LINK_SELECTOR = "a:not([data-card])";

interface CapturedRule {
  selector: string;
  style: Record<string, string>;
}

/** Flatten a css-in-js tree into (selector, declarations) pairs. */
function collectRules(
  node: unknown,
  selector: string,
  out: CapturedRule[],
): void {
  if (Array.isArray(node)) {
    for (const entry of node) {
      collectRules(entry, selector, out);
    }
    return;
  }
  if (typeof node !== "object" || node === null) {
    return;
  }
  const style: Record<string, string> = {};
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "string" || typeof value === "number") {
      style[key] = String(value);
    } else {
      collectRules(value, key, out);
    }
  }
  if (Object.keys(style).length > 0) {
    out.push({ selector, style });
  }
}

function registeredProseRules(): CapturedRule[] {
  const optionsFunction = typography as unknown as (
    options?: object,
  ) => (api: {
    addVariant: (name: string, definition: string) => void;
    addComponents: (components: Record<string, unknown>) => void;
    prefix: (selector: string) => string;
  }) => void;
  const rules: CapturedRule[] = [];
  optionsFunction({})({
    addVariant: () => {},
    addComponents: (components) => collectRules(components, ":root", rules),
    prefix: (selector) => selector,
  });
  return rules;
}

describe("docs prose link override", () => {
  it("fumadocs typography still styles prose links via the mirrored selector", () => {
    const linkRules = registeredProseRules().filter((rule) =>
      rule.selector.includes(LINK_SELECTOR),
    );

    expect(linkRules.length).toBeGreaterThan(0);
    const weights = linkRules
      .map((rule) => rule.style.fontWeight ?? rule.style["font-weight"])
      .filter(Boolean);
    expect(weights).toContain("500");
  });

  it("globals.css carries the override mirroring that selector", () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, "..", "..", "app", "globals.css"),
      "utf-8",
    );
    const override = css.match(/\.prose a:not\(\[data-card\]\)\s*\{[^}]*\}/);

    expect(override).not.toBeNull();
    expect(override![0]).toContain("font-weight: inherit");
  });
});
