import {
  formatSamplePercent,
  SamplePercent,
} from "@/app/components/sample_percent";
import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

describe("formatSamplePercent", () => {
  it.each([
    [100, "100%"],
    [99.97, "100%"],
    [29.67, "30%"],
    [9.87, "9.9%"],
    [0.2534, "0.25%"],
    [null, "–"],
  ])("formats %p as %s", (percent, text) => {
    expect(formatSamplePercent(percent)).toBe(text);
  });
});

describe("SamplePercent", () => {
  it("shows the formatted percent", () => {
    render(<SamplePercent percent={29.67} />);

    expect(screen.getByText("Sampled at: 30%")).toBeInTheDocument();
  });

  it("shows a dash until the percent is known", () => {
    render(<SamplePercent percent={undefined} />);

    expect(screen.getByText("Sampled at: –")).toBeInTheDocument();
  });

  it("shows a dash when the query found no rows to tell the sample", () => {
    render(<SamplePercent percent={null} />);

    expect(screen.getByText("Sampled at: –")).toBeInTheDocument();
  });
});
