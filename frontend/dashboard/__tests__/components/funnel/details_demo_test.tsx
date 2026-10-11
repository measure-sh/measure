import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import type FunnelCadencePlot from "@/app/components/funnel/cadence_plot";
import type FunnelTrendPlot from "@/app/components/funnel/trend_plot";

type TrendPlotProps = React.ComponentProps<typeof FunnelTrendPlot>;
type CadencePlotProps = React.ComponentProps<typeof FunnelCadencePlot>;

jest.mock("next/navigation", () =>
  require("@/__tests__/helpers/mock_router").nextNavigationMock(),
);

// FunnelSteps measures its layout with ResizeObserver, which jsdom lacks.
jest.mock("@/app/components/funnel/steps", () => ({
  __esModule: true,
  default: () => <div data-testid="funnel-steps" />,
}));

jest.mock("@/app/components/funnel/chart", () => ({
  __esModule: true,
  default: ({ onSelectStep }: { onSelectStep: (step: number) => void }) => (
    <div data-testid="funnel-chart">
      <button onClick={() => onSelectStep(0)}>first step</button>
      <button onClick={() => onSelectStep(3)}>fourth step</button>
    </div>
  ),
}));

const mockTrendPlot = jest.fn<void, [TrendPlotProps]>();
jest.mock("@/app/components/funnel/trend_plot", () => ({
  __esModule: true,
  FunnelTrendMetric: { Conversion: "Conversion", Time: "Time to convert" },
  default: (props: TrendPlotProps) => {
    mockTrendPlot(props);
    return (
      <button onClick={() => props.onSelectPoint("2026-01-05", 2)}>
        trend point
      </button>
    );
  },
}));

const mockCadencePlot = jest.fn<void, [CadencePlotProps]>();
jest.mock("@/app/components/funnel/cadence_plot", () => ({
  __esModule: true,
  default: (props: CadencePlotProps) => {
    mockCadencePlot(props);
    return (
      <button onClick={() => props.onSelectPoint(3, 14)}>cadence point</button>
    );
  },
}));

import { FunnelDetailsDemo } from "@/app/components/funnel/details";

const lastProps = <T,>(mock: jest.Mock<void, [T]>): T =>
  mock.mock.calls[mock.mock.calls.length - 1][0];

// Every list stays mounted, and the errors list comes first.
const listedErrors = () =>
  [...document.querySelector("table")!.querySelectorAll("tbody tr")].map(
    (row) => row.querySelector("td p")!.textContent,
  );

beforeEach(() => {
  mockTrendPlot.mockClear();
  mockCadencePlot.mockClear();
});

describe("FunnelDetailsDemo", () => {
  it("shows the demo funnel's breakdown and its first page of errors", () => {
    render(<FunnelDetailsDemo />);

    expect(screen.getByText("Funnels")).toBeInTheDocument();
    expect(screen.getByText("Checkout")).toBeInTheDocument();
    expect(
      screen.getByText("24% converted · 2.96K of 12.48K users"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("funnel-chart")).toBeInTheDocument();
    expect(screen.getByText("Overall")).toBeInTheDocument();
    expect(listedErrors()).toEqual([
      "CartRepository.kt: syncCart()",
      "ProductGalleryAdapter.kt: onBindViewHolder()",
      "CheckoutViewModel.kt: applyCoupon()",
      "ImageLoader.kt: fetch()",
      "CartItemsAdapter.kt: onItemRemoved()",
    ]);
  });

  it("leaves out the title, the funnel's actions and the rows' links", () => {
    render(<FunnelDetailsDemo hideTitle />);

    expect(screen.queryByText("Funnels")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Edit funnel")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Delete funnel")).not.toBeInTheDocument();
    expect(document.querySelectorAll("tbody a")).toHaveLength(0);
  });

  it("pages through the errors", () => {
    render(<FunnelDetailsDemo />);

    fireEvent.click(screen.getByText("Next"));

    expect(listedErrors()).toEqual([
      "ProductDetailActivity.kt: onCreate()",
      "AddressFormFragment.kt: validatePostcode()",
      "PaymentSheetCallback.kt: onPaymentResult()",
      "OrderStatusPoller.kt: poll()",
    ]);
  });

  it("lists a step's errors when the step is chosen on the chart", () => {
    render(<FunnelDetailsDemo />);

    fireEvent.click(screen.getByText("fourth step"));

    expect(screen.queryByText("Overall")).not.toBeInTheDocument();
    expect(listedErrors()).toEqual([
      "CheckoutViewModel.kt: applyCoupon()",
      "AddressFormFragment.kt: validatePostcode()",
    ]);
  });

  it("covers the whole funnel when the first step is chosen", () => {
    render(<FunnelDetailsDemo />);
    fireEvent.click(screen.getByText("fourth step"));

    fireEvent.click(screen.getByText("first step"));

    expect(screen.getByText("Overall")).toBeInTheDocument();
    expect(listedErrors()).toHaveLength(5);
  });

  it("shows the trend for the chosen period and opens a point's step in the breakdown", () => {
    render(<FunnelDetailsDemo />);

    fireEvent.click(screen.getByText("Trend"));
    expect(lastProps(mockTrendPlot).period).toBe("week");
    expect(lastProps(mockTrendPlot).trend!.points).toHaveLength(12);

    fireEvent.click(screen.getByText("Daily"));
    expect(lastProps(mockTrendPlot).period).toBe("day");
    expect(lastProps(mockTrendPlot).trend!.points).toHaveLength(30);

    fireEvent.click(screen.getByText("trend point"));
    expect(screen.getByTestId("funnel-chart")).toBeInTheDocument();
    expect(listedErrors()).toEqual([
      "CartRepository.kt: syncCart()",
      "CartItemsAdapter.kt: onItemRemoved()",
    ]);
  });

  it("shows the cadence for the chosen span and opens the breakdown from a point", () => {
    render(<FunnelDetailsDemo />);

    fireEvent.click(screen.getByText("Cadence"));
    const fourWeeks = lastProps(mockCadencePlot).hours!;
    expect(fourWeeks.hours).toHaveLength(7 * 24);

    fireEvent.click(screen.getByText("12 weeks"));
    expect(lastProps(mockCadencePlot).hours).not.toBe(fourWeeks);

    fireEvent.click(screen.getByText("cadence point"));
    expect(screen.getByTestId("funnel-chart")).toBeInTheDocument();
    expect(screen.getByText("Overall")).toBeInTheDocument();
  });
});
