import { useCallback } from "react";
import { useChartColors } from "../../utils/chart_utils";

// Every view of a funnel colors a step the same way, so a step reads as the
// same step across the chart, the trend lines and the step selectors.
export function useStepColor(): (index: number) => string {
  const colors = useChartColors();
  return useCallback((index) => colors[index % colors.length], [colors]);
}
