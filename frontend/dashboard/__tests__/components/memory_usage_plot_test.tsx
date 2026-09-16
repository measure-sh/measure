import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

let lastLineProps: any;

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { reset: jest.fn(), capture: jest.fn(), init: jest.fn() },
}));
jest.mock("@nivo/line", () => ({
  ResponsiveLineCanvas: (props: any) => {
    lastLineProps = props;
    return <div data-testid="line-mock" />;
  },
}));
jest.mock("next-themes", () => ({ useTheme: () => ({ theme: "light" }) }));
jest.mock("@/app/components/tab_select", () => ({
  __esModule: true,
  default: ({ items, onChangeSelected }: any) => (
    <div>
      {items.map((item: string) => (
        <button key={item} onClick={() => onChangeSelected(item)}>
          {item}
        </button>
      ))}
    </div>
  ),
}));

import MemoryUsagePlot from "@/app/components/memory_usage_plot";

const dates = {
  startDate: "2026-02-01T00:00:00Z",
  endDate: "2026-02-01T08:00:00Z",
};
const point = {
  version: "1.2.3 (10)",
  datetime: "2026-02-01T01:00:00",
  p50: 100 * 1024,
  p90: 200 * 1024,
  p95: 300 * 1024,
  p99: 400 * 1024,
  sample_count: 10,
};

it("groups by full version/build and switches the sample percentile", () => {
  render(
    <MemoryUsagePlot
      {...dates}
      query={
        {
          status: "success",
          data: [
            point,
            { ...point, version: "1.2.3 (11)", p90: 500 * 1024 },
            { ...point, datetime: "2026-02-01T02:00:00" },
          ],
        } as any
      }
    />,
  );

  expect(lastLineProps.data.map((series: any) => series.id)).toEqual([
    "1.2.3 (10)",
    "1.2.3 (11)",
  ]);
  expect(lastLineProps.data[0].data).toHaveLength(2);
  expect(lastLineProps.data[0].data[0].y).toBe(200 * 1024);

  const { unmount } = render(
    lastLineProps.tooltip({
      point: {
        data: {
          ...lastLineProps.data[0].data[0],
          xFormatted: point.datetime,
        },
      },
    }),
  );
  expect(screen.getByText("1.2.3 (10) - 200.0 MB")).toBeInTheDocument();
  expect(screen.getByText("1.2.3 (11) - 500.0 MB")).toBeInTheDocument();
  unmount();

  fireEvent.click(screen.getByRole("button", { name: "p50" }));
  expect(lastLineProps.data[0].data[0].y).toBe(100 * 1024);
});

it.each([null, []])("shows an empty state for %p", (data) => {
  render(
    <MemoryUsagePlot {...dates} query={{ status: "success", data } as any} />,
  );
  expect(screen.getByText("No Data")).toBeInTheDocument();
});
