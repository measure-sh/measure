import ErrorsDistributionPlot from "@/app/components/errors_distribution_plot";
import {
  type AttributeDistribution,
  distributionAttributes,
} from "@/app/query/hooks";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";

let lastBarProps: any = null;

jest.mock("@nivo/bar", () => ({
  ResponsiveBar: (props: any) => {
    lastBarProps = props;
    return <div data-testid="bar-mock" />;
  },
}));

jest.mock("@/app/components/skeleton", () => ({
  SkeletonPlot: () => <div data-testid="skeleton-mock">loading</div>,
}));

function queryWith(overrides: any) {
  return {
    data: undefined,
    status: "pending",
    error: null,
    ...overrides,
  } as any;
}

function attributeQueryWith(overrides: any) {
  return {
    data: undefined,
    status: "pending",
    isPlaceholderData: false,
    ...overrides,
  };
}

function distribution(
  attribute: AttributeDistribution["attribute"],
  overrides: Partial<AttributeDistribution> = {},
): AttributeDistribution {
  return {
    attribute,
    label: attribute,
    values: [{ label: `${attribute}-a`, count: 10 }],
    otherCount: 0,
    distinctCount: 1,
    total: 10,
    ...overrides,
  };
}

const deviceSummary = distribution("device", {
  label: "Device",
  values: [
    { label: "Google - Pixel 8", count: 50 },
    { label: "Samsung - Galaxy S23", count: 30 },
  ],
  otherCount: 20,
  distinctCount: 7,
  total: 100,
});

const summary = distributionAttributes.map((attribute) =>
  attribute === "device" ? deviceSummary : distribution(attribute),
);

const deviceDistribution: AttributeDistribution = {
  ...deviceSummary,
  values: [...deviceSummary.values, { label: "Motorola - Razr", count: 20 }],
  otherCount: 0,
  distinctCount: 3,
};

function renderWithSummary(props: Record<string, unknown> = {}) {
  return render(
    <ErrorsDistributionPlot
      query={queryWith({ data: summary, status: "success" })}
      {...props}
    />,
  );
}

function renderDevice(attributeQuery: any, onSelect = jest.fn()) {
  return renderWithSummary({
    selected: "device",
    attributeQuery,
    onSelect,
  });
}

function renderTooltip(props: any) {
  return render(lastBarProps.tooltip(props)).container.textContent;
}

describe("ErrorsDistributionPlot", () => {
  beforeEach(() => {
    lastBarProps = null;
  });

  it("renders loading state when query is pending", () => {
    render(<ErrorsDistributionPlot query={queryWith({})} />);
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("renders error state when query errors", () => {
    render(
      <ErrorsDistributionPlot
        query={queryWith({ status: "error", error: new Error("boom") })}
      />,
    );
    expect(screen.getByText(/Error fetching plot/)).toBeInTheDocument();
  });

  it("renders empty state when data is null", () => {
    render(
      <ErrorsDistributionPlot
        query={queryWith({ data: null, status: "success" })}
      />,
    );
    expect(screen.getByText("No distribution data found")).toBeInTheDocument();
  });

  it("stacks each attribute's values by rank with the other values on top", () => {
    renderWithSummary();

    expect(lastBarProps.keys).toEqual(["value-0", "value-1", "other"]);
    expect(lastBarProps.data).toContainEqual({
      attribute: "device",
      "value-0": 50,
      "value-1": 30,
      other: 20,
    });
    expect(lastBarProps.data).toContainEqual({
      attribute: "country",
      "value-0": 10,
    });
    expect(lastBarProps.axisBottom.format("device")).toBe("Device");
    expect(lastBarProps.enableLabel).toBe(false);
  });

  it("shows each segment's value, count and share in the tooltip", () => {
    renderWithSummary();

    expect(
      renderTooltip({
        id: "value-1",
        indexValue: "device",
        value: 30,
        color: "#111",
      }),
    ).toContain("Samsung - Galaxy S23 - 30 instances (30.0%)");
    expect(
      renderTooltip({
        id: "other",
        indexValue: "device",
        value: 20,
        color: "#111",
      }),
    ).toContain("Other (5 values) - 20 instances (20.0%)");
  });

  it("selects the clicked attribute", () => {
    const onSelect = jest.fn();
    renderWithSummary({ onSelect });

    act(() => {
      lastBarProps.onClick({ indexValue: "device" });
    });

    expect(onSelect).toHaveBeenCalledWith("device");
  });

  it("draws the selected attribute's chart with the summary's margins", () => {
    renderWithSummary();
    const summaryMargin = lastBarProps.margin;
    const summaryPadding = lastBarProps.padding;

    renderDevice(
      attributeQueryWith({ status: "success", data: deviceDistribution }),
    );

    expect(
      screen.getByTestId("exception-distribution-plot-details"),
    ).toBeInTheDocument();
    expect(lastBarProps.margin).toEqual(summaryMargin);
    // Each of these 3 columns is twice as wide as a summary column, so a bar as
    // wide as the summary's fills 20% of it.
    expect(summaryPadding).toBe(0.6);
    expect(lastBarProps.padding).toBeCloseTo(0.8);
    expect(lastBarProps.colorBy).toBe("indexValue");
    expect(lastBarProps.axisBottom.legend).toBe("Device");
    expect(lastBarProps.data.map((d: any) => d.label)).toEqual([
      "Google - Pixel 8",
      "Samsung - Galaxy S23",
      "Motorola - Razr",
    ]);
    expect(lastBarProps.enableLabel).toBe(false);
    expect(
      renderTooltip({
        data: lastBarProps.data[2],
        value: 20,
        color: "#111",
      }),
    ).toContain("Motorola - Razr - 20 instances (20.0%)");
  });

  it("goes back to all attributes", () => {
    const onSelect = jest.fn();
    renderDevice(
      attributeQueryWith({ status: "success", data: deviceDistribution }),
      onSelect,
    );

    fireEvent.click(screen.getByRole("button", { name: "All attributes" }));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("says how many values the attribute's chart shows", () => {
    renderDevice(
      attributeQueryWith({ status: "success", data: deviceSummary }),
    );

    expect(screen.getByText("Showing 2 of 7 values")).toBeInTheDocument();
  });

  it("leaves out the note while the summary's values stand in", () => {
    renderDevice(
      attributeQueryWith({
        status: "success",
        data: deviceSummary,
        isPlaceholderData: true,
      }),
    );

    expect(screen.queryByText(/Showing \d+ of/)).not.toBeInTheDocument();
  });

  it("leaves out the note when the chart shows every value", () => {
    renderDevice(
      attributeQueryWith({ status: "success", data: deviceDistribution }),
    );

    expect(screen.queryByText(/Showing \d+ of/)).not.toBeInTheDocument();
  });

  it("truncates long value names on the attribute's chart", () => {
    renderDevice(
      attributeQueryWith({
        status: "success",
        data: {
          ...deviceSummary,
          values: [{ label: "A manufacturer - with a long name", count: 5 }],
        },
      }),
    );

    expect(lastBarProps.axisBottom.format("0")).toBe("A manufact…");
  });

  it("renders loading and error states for the selected attribute", () => {
    const { unmount } = renderDevice(attributeQueryWith({ status: "pending" }));
    expect(screen.getByText("loading")).toBeInTheDocument();
    unmount();

    renderDevice(attributeQueryWith({ status: "error" }));
    expect(screen.getByText(/Error fetching values/)).toBeInTheDocument();
  });

  it("shows only the error when a refetch fails over earlier data", () => {
    renderDevice(
      attributeQueryWith({ status: "error", data: deviceDistribution }),
    );

    expect(screen.getByText(/Error fetching values/)).toBeInTheDocument();
    expect(screen.queryByTestId("bar-mock")).not.toBeInTheDocument();
  });

  it("uses demo data in demo mode", () => {
    render(<ErrorsDistributionPlot query={queryWith({})} demo />);

    expect(lastBarProps.axisBottom.format("app_version")).toBe("App Version");
    expect(lastBarProps.axisBottom.format("os_version")).toBe("API Level");
    expect(lastBarProps.data).toContainEqual(
      expect.objectContaining({ attribute: "device", other: 650 }),
    );
  });
});
