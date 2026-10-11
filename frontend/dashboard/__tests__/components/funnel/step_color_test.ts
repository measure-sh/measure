import { useStepColor } from "@/app/components/funnel/step_color";
import { useChartColors } from "@/app/utils/chart_utils";
import { describe, expect, it } from "@jest/globals";
import { renderHook } from "@testing-library/react";

describe("useStepColor", () => {
  const colors = renderHook(() => useChartColors()).result.current;

  it("colors each step with the chart color at its index", () => {
    const { result } = renderHook(() => useStepColor());
    colors.forEach((color, index) => {
      expect(result.current(index)).toBe(color);
    });
  });

  it("starts again from the first color after the last one", () => {
    const { result } = renderHook(() => useStepColor());
    expect(result.current(colors.length)).toBe(colors[0]);
    expect(result.current(colors.length + 2)).toBe(colors[2]);
    expect(result.current(2 * colors.length - 1)).toBe(
      colors[colors.length - 1],
    );
  });

  // Callers pass the function to memos and effects, so a new function on each
  // render would rerun them.
  it("returns the same function across renders", () => {
    const { result, rerender } = renderHook(() => useStepColor());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
