import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

// Radix tooltip content measures its arrow via ResizeObserver, absent in jsdom.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
}

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import RowLinkCell from "@/app/components/row_link_cell";

function renderCell(tooltip?: string) {
  return render(
    <table>
      <tbody>
        <tr>
          <RowLinkCell
            href="/team-1/funnels/app-1"
            className="w-[20%]"
            tooltip={tooltip}
          >
            <span>Checkout flow</span>
          </RowLinkCell>
        </tr>
      </tbody>
    </table>,
  );
}

describe("RowLinkCell", () => {
  it("covers the cell with a link that is hidden from keyboard and screen readers", () => {
    const { container } = renderCell();
    const link = container.querySelector("a")!;
    expect(link).toHaveAttribute("href", "/team-1/funnels/app-1");
    expect(link).toHaveAttribute("tabindex", "-1");
    expect(link).toHaveAttribute("aria-hidden", "true");
    expect(link.closest("td")).toHaveClass("w-[20%]");
  });

  it("renders its children inside the cell", () => {
    const { container } = renderCell();
    expect(container.querySelector("td")).toContainElement(
      screen.getByText("Checkout flow"),
    );
  });

  it("shows the tooltip when the link is focused", async () => {
    const { container } = renderCell("Checkout flow with a long name");
    fireEvent.focus(container.querySelector("a")!);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Checkout flow with a long name",
    );
  });
});
