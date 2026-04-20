import { GoogleTagManager } from "@/app/components/google_tag_manager";
import { afterEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
// Use the node build explicitly — jsdom resolves react-dom/server to
// server.browser which needs TextEncoder globals that aren't set up in this env.
// @ts-expect-error — react-dom/server.node has no bundled type declarations.
import { renderToString } from "react-dom/server.node";

jest.mock("next/script", () => ({
  __esModule: true,
  default: ({ id, children }: { id?: string; children?: React.ReactNode }) => (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: test-only shim for next/script
    <script data-testid={id} dangerouslySetInnerHTML={{ __html: String(children ?? "") }} />
  ),
}));

afterEach(() => {
  delete process.env.NEXT_PUBLIC_GTM_ID;
});

describe("GoogleTagManager", () => {
  it("renders nothing when NEXT_PUBLIC_GTM_ID is not set", () => {
    expect(renderToString(<GoogleTagManager />)).toBe("");
  });

  it("renders nothing when NEXT_PUBLIC_GTM_ID is empty", () => {
    process.env.NEXT_PUBLIC_GTM_ID = "";
    expect(renderToString(<GoogleTagManager />)).toBe("");
  });

  it("renders the GTM script snippet with the configured ID", () => {
    process.env.NEXT_PUBLIC_GTM_ID = "GTM-TEST1234";

    const html = renderToString(<GoogleTagManager />);

    expect(html).toContain("GTM-TEST1234");
    expect(html).toContain("googletagmanager.com/gtm.js");
    expect(html).toContain("gtm.start");
  });

  it("renders the noscript iframe pointing at the configured GTM container", () => {
    process.env.NEXT_PUBLIC_GTM_ID = "GTM-TEST1234";

    const html = renderToString(<GoogleTagManager />);

    expect(html).toContain("<noscript>");
    expect(html).toContain(
      'src="https://www.googletagmanager.com/ns.html?id=GTM-TEST1234"',
    );
    expect(html).toContain('height="0"');
    expect(html).toContain('width="0"');
    expect(html).toMatch(/display:\s*none/);
    expect(html).toMatch(/visibility:\s*hidden/);
  });
});
