import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render } from "@testing-library/react";

import {
  embedSiblingPoints,
  PlotTooltipShell,
  PlotTooltipSwatch,
} from "@/app/components/plot_tooltip";

it("preserves chart gaps while omitting missing values from tooltip rows", () => {
  const plot = embedSiblingPoints(
    [
      { id: "missing", data: [{ x: "2026-09-17", y: null }] },
      { id: "zero", data: [{ x: "2026-09-17", y: 0 }] },
      { id: "measured", data: [{ x: "2026-09-17", y: 1024 }] },
    ],
    () => "red",
  );
  expect(plot[0].data[0].y).toBeNull();
  expect(plot[2].data[0].siblings).toEqual([
    { id: "zero", y: 0, color: "red" },
    { id: "measured", y: 1024, color: "red" },
  ]);
});

describe("PlotTooltipShell", () => {
  it("renders children inside the shared tooltip panel", () => {
    const { container, getByText } = render(
      <PlotTooltipShell>
        <p>body</p>
      </PlotTooltipShell>,
    );
    expect(getByText("body")).toBeInTheDocument();
    const shell = container.firstChild as HTMLElement;
    expect(shell.className).toContain("bg-background");
    expect(shell.className).toContain("rounded-md");
    expect(shell.className).toContain("font-body");
    expect(shell.className).toContain("text-xs");
    expect(shell.className).toContain("px-4");
    expect(shell.className).toContain("py-2");
  });

  it("overrides the default padding via className", () => {
    const { container } = render(
      <PlotTooltipShell className="py-4">
        <p>body</p>
      </PlotTooltipShell>,
    );
    const shell = container.firstChild as HTMLElement;
    expect(shell.className).toContain("py-4");
    // twMerge drops the conflicting default so vertical padding isn't doubled,
    // while the unrelated horizontal default is kept.
    expect(shell.className).not.toContain("py-2");
    expect(shell.className).toContain("px-4");
  });
});

describe("PlotTooltipSwatch", () => {
  it("renders a colour dot with the given background colour", () => {
    const { container } = render(<PlotTooltipSwatch color="rgb(1, 2, 3)" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot.className).toContain("rounded-full");
    expect(dot.style.backgroundColor).toBe("rgb(1, 2, 3)");
  });
});
