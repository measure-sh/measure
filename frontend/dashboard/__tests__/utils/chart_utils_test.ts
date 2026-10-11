import { CHART_TEXT_SIZE, dateTickLabelHeight } from "@/app/utils/chart_utils";
import { describe, expect, it } from "@jest/globals";

describe("dateTickLabelHeight", () => {
  it("is the text height for a flat label", () => {
    expect(dateTickLabelHeight(0)).toBe(CHART_TEXT_SIZE);
  });

  it("is the widest label's width for a vertical label", () => {
    expect(dateTickLabelHeight(90)).toBe(45);
  });

  it("rounds the projected height of a rotated label up to whole pixels", () => {
    expect(dateTickLabelHeight(30)).toBe(33);
    expect(dateTickLabelHeight(45)).toBe(40);
    expect(dateTickLabelHeight(60)).toBe(45);
  });

  it("gives the same height for either direction of rotation", () => {
    expect(dateTickLabelHeight(-45)).toBe(dateTickLabelHeight(45));
    expect(dateTickLabelHeight(-90)).toBe(dateTickLabelHeight(90));
  });
});
