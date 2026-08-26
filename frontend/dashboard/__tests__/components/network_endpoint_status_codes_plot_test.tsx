import NetworkEndpointStatusCodesPlot from "@/app/components/network_endpoint_status_codes_plot";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

let chartProps: any;

jest.mock("@nivo/line", () => ({
  ResponsiveLineCanvas: (props: any) => {
    chartProps = props;
    return <div data-testid="status-codes-chart" />;
  },
}));

jest.mock("next-themes", () => ({ useTheme: () => ({ theme: "light" }) }));

jest.mock("@/app/utils/time_utils", () => ({
  getPlotTimeGroupNivoConfig: () => ({
    xFormat: "time:%Y-%m-%d",
    xScaleFormat: "%Y-%m-%d",
    xScalePrecision: "day",
    axisBottomFormat: "%b %d",
  }),
}));

jest.mock("@/app/utils/shared_styles", () => ({
  useChartCanvasTheme: () => ({}),
  useChartColor: () => ({
    blue: "#38bdf8",
    green: "#34d399",
    amber: "#fbbf24",
    red: "#f87171",
  }),
}));

describe("NetworkEndpointStatusCodesPlot", () => {
  beforeEach(() => {
    chartProps = undefined;
  });

  it("shows an empty state without status-code data", () => {
    render(
      <NetworkEndpointStatusCodesPlot
        statusCodes={[]}
        data={[]}
        plotTimeGroup={"days" as any}
      />,
    );

    expect(screen.getByText("No Data")).toBeInTheDocument();
    expect(screen.queryByTestId("status-codes-chart")).toBeNull();
  });

  it("maps exact status-code counts into canvas series", () => {
    render(
      <NetworkEndpointStatusCodesPlot
        statusCodes={[200, 404]}
        data={[
          {
            datetime: "2024-01-01",
            total_count: 10,
            count_200: 8,
            count_404: 2,
          },
          {
            datetime: "2024-01-02",
            total_count: 5,
            count_200: 5,
          },
        ]}
        plotTimeGroup={"days" as any}
      />,
    );

    expect(screen.getByTestId("status-codes-chart")).toBeInTheDocument();
    expect(chartProps.data).toMatchObject([
      { id: "200", data: [{ y: 8 }, { y: 5 }] },
      { id: "404", data: [{ y: 2 }, { y: 0 }] },
    ]);
  });
});
