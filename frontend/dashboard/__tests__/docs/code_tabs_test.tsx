import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  usePathname: () => "/docs/features/feature-performance-tracing",
}));

jest.mock("@/app/utils/analytics/track", () => ({
  track: jest.fn(),
}));

jest.mock("@/app/components/code_block", () => ({
  __esModule: true,
  default: ({ code }: any) => <pre data-testid="panel-code">{code}</pre>,
  CopyCodeButton: ({ onCopy }: any) => (
    <button aria-label="Copy code" onClick={onCopy} />
  ),
  CODE_FRAME_CLASS: "",
  CODE_FRAME_HEADER_CLASS: "",
  CODE_FRAME_PANEL_CLASS: "",
}));

import CodeTabs from "@/app/docs/components/code_tabs";

const TABS = JSON.stringify([
  { label: "Android", code: "kotlin code", className: "language-kotlin" },
  { label: "iOS", code: "swift code", className: "language-swift" },
]);

function panelFor(code: string): HTMLElement {
  const panel = screen
    .getByText(code)
    .closest("[aria-hidden]") as HTMLElement | null;
  expect(panel).not.toBeNull();
  return panel!;
}

describe("CodeTabs", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders all panels stacked with only the first visible", () => {
    render(<CodeTabs tabs={TABS} />);
    expect(screen.getByRole("tab", { name: "Android" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(panelFor("kotlin code")).toHaveAttribute("aria-hidden", "false");
    expect(panelFor("swift code")).toHaveAttribute("aria-hidden", "true");
    expect(panelFor("swift code")).toHaveClass("invisible");
  });

  it("switches the visible panel on tab click", () => {
    render(<CodeTabs tabs={TABS} />);
    fireEvent.click(screen.getByRole("tab", { name: "iOS" }));
    expect(screen.getByRole("tab", { name: "iOS" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(panelFor("swift code")).toHaveAttribute("aria-hidden", "false");
    expect(panelFor("kotlin code")).toHaveAttribute("aria-hidden", "true");
  });

  it("syncs the selected label across groups on the page", () => {
    render(
      <>
        <CodeTabs tabs={TABS} />
        <CodeTabs tabs={TABS} />
      </>,
    );
    const iosTabs = screen.getAllByRole("tab", { name: "iOS" });
    fireEvent.click(iosTabs[0]);
    expect(iosTabs[1]).toHaveAttribute("aria-selected", "true");
  });

  it("remembers the selection and adopts it on mount", () => {
    window.localStorage.setItem("docs-code-tab", "iOS");
    render(<CodeTabs tabs={TABS} />);
    expect(screen.getByRole("tab", { name: "iOS" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("stores the selection on click", () => {
    render(<CodeTabs tabs={TABS} />);
    fireEvent.click(screen.getByRole("tab", { name: "iOS" }));
    expect(window.localStorage.getItem("docs-code-tab")).toBe("iOS");
  });

  it("renders nothing for invalid tab data", () => {
    const { container } = render(<CodeTabs tabs="not json" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the first tab active for sync labels it does not have", () => {
    render(<CodeTabs tabs={TABS} />);
    act(() => {
      window.localStorage.setItem("docs-code-tab", "Rust");
      window.dispatchEvent(new Event("docs-code-tab-select"));
    });
    expect(screen.getByRole("tab", { name: "Android" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
