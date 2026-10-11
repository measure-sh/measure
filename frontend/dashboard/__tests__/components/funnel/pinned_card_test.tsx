import type { Funnel, FunnelTrend } from "@/app/api/api_calls";
import FunnelPinnedCard, {
  FunnelPinButton,
} from "@/app/components/funnel/pinned_card";
import type { FilterParams } from "@/app/query/hooks";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { DateTime, Settings } from "luxon";

const mockPush = jest.fn();
const mockUseFunnelTrendQuery = jest.fn();
let mockTheme = "light";
let mockBarProps: any;

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

jest.mock("next-themes", () => ({
  useTheme: () => ({ theme: mockTheme }),
}));

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useFunnelTrendQuery: (...args: unknown[]) => mockUseFunnelTrendQuery(...args),
}));

// jsdom cannot draw the canvas, so each bar is a button whose click event
// reaches the chart's onClick and then bubbles to the plot, as a canvas click
// does.
jest.mock("@nivo/bar", () => ({
  ResponsiveBarCanvas: (props: any) => {
    mockBarProps = props;
    return (
      <div data-testid="bar-canvas">
        {props.data.map((_: unknown, index: number) => (
          <button
            key={index}
            aria-label={`Bar ${index}`}
            onClick={(event) => props.onClick({ index }, event)}
          />
        ))}
      </div>
    );
  },
}));

// FunnelSteps measures its layout with ResizeObserver, which jsdom lacks.
jest.mock("@/app/components/funnel/steps", () => ({
  __esModule: true,
  default: ({ funnel }: { funnel: Funnel }) => (
    <div data-testid="funnel-steps">
      {funnel.steps.map((step) => step.event_name).join(" > ")}
    </div>
  ),
}));

type TrendPoint = FunnelTrend["points"][number];

const funnel: Funnel = {
  id: "funnel-1",
  app_id: "app-1",
  name: "Checkout flow",
  steps: [
    { event_name: "app_open" },
    { event_name: "add_to_cart" },
    { event_name: "purchase" },
  ],
  conversion_window_seconds: 86_400,
  pinned: true,
  pin_order: 0,
  created_by: "user-1",
  created_by_email: "user@example.com",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

const funnelPath = "/team-1/funnels/app-1/funnel-1";

const params: FilterParams = {
  appId: "app-1",
  startDate: "2026-09-01T00:00:00Z",
  endDate: "2026-10-08T12:00:00Z",
  filterExpr: null,
};

const point = (
  datetime: string,
  users: number[],
  {
    complete = true,
    median = 600,
  }: { complete?: boolean; median?: number | null } = {},
): TrendPoint => ({
  datetime,
  steps: users.map((u) => ({ users: u, median_seconds_from_previous: null })),
  median_seconds_to_convert: median,
  complete,
});

const week1 = "2026-09-21T00:00:00Z";
const week2 = "2026-09-28T00:00:00Z";
const week3 = "2026-10-05T00:00:00Z";

const mockTrend = (
  points: TrendPoint[],
  eventNames = funnel.steps.map((step) => step.event_name),
) =>
  mockUseFunnelTrendQuery.mockReturnValue({
    isPending: false,
    isError: false,
    isSuccess: true,
    data: { event_names: eventNames, points, builds: [] },
  });

const renderCard = (
  overrides: Partial<React.ComponentProps<typeof FunnelPinnedCard>> = {},
) => {
  const props = {
    teamId: "team-1",
    funnel,
    params,
    reordering: false,
    isFirst: false,
    isLast: false,
    pinDisabled: false,
    onMoveUp: jest.fn(),
    onMoveDown: jest.fn(),
    onUnpin: jest.fn(),
    ...overrides,
  };
  render(<FunnelPinnedCard {...props} />);
  return props;
};

const metric = (label: string) => {
  const [, value, detail] = Array.from(
    screen.getByText(label).parentElement!.children,
  );
  return { value: value.textContent, detail: detail?.textContent };
};

const weekChange = () =>
  screen.getByText(/pts vs week before$/).closest("span.flex") as HTMLElement;

const originalZone = Settings.defaultZone;
const originalNow = Settings.now;

beforeAll(() => {
  Settings.defaultZone = "utc";
  const now = DateTime.fromISO("2026-10-08T12:00:00Z").toMillis();
  Settings.now = () => now;
});

afterAll(() => {
  Settings.defaultZone = originalZone;
  Settings.now = originalNow;
});

beforeEach(() => {
  mockTheme = "light";
  mockBarProps = undefined;
});

describe("FunnelPinnedCard metrics", () => {
  it("describes the last complete week and ignores a week still converting", () => {
    mockTrend([
      point(week1, [1000, 500, 250]),
      point(week2, [2000, 1200, 600], { median: 3725 }),
      point(week3, [500, 100, 10], { complete: false, median: 60 }),
    ]);
    renderCard();

    expect(metric("Conversion · Week of 28 Sep")).toEqual({
      value: "30%",
      detail: "+5 pts vs week before",
    });
    expect(weekChange()).toHaveClass("text-green-600");
    expect(weekChange().querySelector("svg")).toHaveClass("lucide-trending-up");
    expect(metric("Users entered")).toEqual({
      value: "2K",
      detail: "600 converted",
    });
    expect(metric("Time to convert")).toEqual({
      value: "1h 2m 5s",
      detail: "Median",
    });
    expect(metric("Biggest drop-off")).toEqual({
      value: "50%",
      detail: "before purchase",
    });
  });

  it("names the biggest drop-off from the trend's steps while an edited funnel's trend loads", () => {
    // The funnel was edited down to two steps, and the trend of its three
    // step version is still shown until the new one arrives.
    mockTrend([point(week1, [1000, 900, 300])]);
    renderCard({
      funnel: {
        ...funnel,
        steps: [{ event_name: "app_open" }, { event_name: "purchase" }],
      },
    });
    expect(metric("Biggest drop-off")).toEqual({
      value: "67%",
      detail: "before purchase",
    });
  });

  it("shows a drop in conversion against the week before", () => {
    mockTrend([point(week1, [1000, 500, 300]), point(week2, [1000, 500, 250])]);
    renderCard();

    expect(metric("Conversion · Week of 28 Sep")).toEqual({
      value: "25%",
      detail: "-5 pts vs week before",
    });
    expect(weekChange()).toHaveClass("text-yellow-600");
    expect(weekChange().querySelector("svg")).toHaveClass(
      "lucide-trending-down",
    );
  });

  it("rounds the week change to one decimal", () => {
    mockTrend([point(week1, [1000, 500, 302]), point(week2, [1000, 500, 303])]);
    renderCard();

    expect(metric("Conversion · Week of 28 Sep")).toEqual({
      value: "30.3%",
      detail: "+0.1 pts vs week before",
    });
  });

  it("shows no change when both weeks round to the same conversion", () => {
    mockTrend([point(week1, [3, 2, 1]), point(week2, [1000, 500, 333])]);
    renderCard();

    expect(metric("Conversion · Week of 28 Sep")).toEqual({
      value: "33.3%",
      detail: "Same as week before",
    });
  });

  it("rounds conversion to one decimal and drop-off to a whole percent", () => {
    mockTrend([point(week2, [3, 2, 2])]);
    renderCard();

    expect(metric("Conversion · Week of 28 Sep").value).toBe("66.7%");
    expect(metric("Biggest drop-off")).toEqual({
      value: "33%",
      detail: "before add_to_cart",
    });
  });

  it("names the earlier step when two steps lose the same share", () => {
    mockTrend([point(week2, [100, 50, 25])]);
    renderCard();

    expect(metric("Biggest drop-off")).toEqual({
      value: "50%",
      detail: "before add_to_cart",
    });
  });

  it("says there is no earlier week when only one week is complete", () => {
    mockTrend([
      point(week2, [100, 50, 20]),
      point(week3, [100, 50, 20], { complete: false }),
    ]);
    renderCard();

    expect(metric("Conversion · Week of 28 Sep")).toEqual({
      value: "20%",
      detail: "No earlier week to compare",
    });
  });

  it("says no users entered when the last complete week has none", () => {
    mockTrend([point(week1, [100, 50, 20]), point(week2, [0, 0, 0])]);
    renderCard();

    expect(metric("Conversion · Week of 28 Sep")).toEqual({
      value: "–",
      detail: "No users entered",
    });
    expect(metric("Users entered")).toEqual({
      value: "0",
      detail: "0 converted",
    });
    // Steps no user reached are skipped, which avoids dividing by zero.
    expect(metric("Biggest drop-off")).toEqual({
      value: "–",
      detail: undefined,
    });
  });

  it("says no users entered the week before when the earlier week has none", () => {
    mockTrend([point(week1, [0, 0, 0]), point(week2, [100, 50, 20])]);
    renderCard();

    expect(metric("Conversion · Week of 28 Sep")).toEqual({
      value: "20%",
      detail: "No users entered the week before",
    });
  });

  it("shows placeholders when no week has finished converting", () => {
    mockTrend([point(week3, [100, 50, 20], { complete: false })]);
    renderCard();

    expect(metric("Conversion")).toEqual({
      value: "–",
      detail: "No week has finished converting yet",
    });
    expect(metric("Users entered")).toEqual({
      value: "–",
      detail: undefined,
    });
    expect(metric("Time to convert")).toEqual({
      value: "–",
      detail: "Median",
    });
    expect(metric("Biggest drop-off")).toEqual({
      value: "–",
      detail: undefined,
    });
  });

  it("shows a placeholder time to convert when the week has no median", () => {
    mockTrend([point(week2, [100, 50, 20], { median: null })]);
    renderCard();

    expect(metric("Time to convert")).toEqual({
      value: "–",
      detail: "Median",
    });
  });

  it("shows skeletons and no metrics while the trend loads", () => {
    mockUseFunnelTrendQuery.mockReturnValue({
      isPending: true,
      isError: false,
      isSuccess: false,
    });
    renderCard();

    expect(
      document.querySelector('[data-slot="skeleton"]'),
    ).toBeInTheDocument();
    expect(screen.queryByText("Users entered")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bar-canvas")).not.toBeInTheDocument();
  });

  it("shows an error and no metrics when the trend fails", () => {
    mockUseFunnelTrendQuery.mockReturnValue({
      isPending: false,
      isError: true,
      isSuccess: false,
    });
    renderCard();

    expect(
      screen.getByText(
        "Error fetching weekly conversion, please refresh page to try again",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Users entered")).not.toBeInTheDocument();
  });
});

describe("FunnelPinnedCard header", () => {
  beforeEach(() => {
    mockTrend([]);
  });

  it("shows the name, steps and conversion window", () => {
    renderCard();

    expect(screen.getByText("Checkout flow")).toBeInTheDocument();
    expect(screen.getByTestId("funnel-steps")).toHaveTextContent(
      "app_open > add_to_cart > purchase",
    );
    expect(screen.getByText("Conversion window: 1 day")).toBeInTheDocument();
  });

  it("links to the funnel and offers unpin outside reorder mode", () => {
    const props = renderCard();

    expect(screen.getByRole("link", { name: "Checkout flow" })).toHaveAttribute(
      "href",
      `${funnelPath}?from=pinned`,
    );
    expect(
      screen.queryByRole("button", { name: /^Move/ }),
    ).not.toBeInTheDocument();
    const unpin = screen.getByRole("button", { name: "Unpin funnel" });
    expect(unpin).toBeEnabled();
    fireEvent.click(unpin);
    expect(props.onUnpin).toHaveBeenCalledTimes(1);
  });

  it("disables unpin when pinning is disabled", () => {
    renderCard({ pinDisabled: true });

    expect(screen.getByRole("button", { name: "Unpin funnel" })).toBeDisabled();
  });

  it("shows move buttons and hides the link and unpin in reorder mode", () => {
    const props = renderCard({ reordering: true });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Unpin funnel" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Move Checkout flow up" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Move Checkout flow down" }),
    );
    expect(props.onMoveUp).toHaveBeenCalledTimes(1);
    expect(props.onMoveDown).toHaveBeenCalledTimes(1);
  });

  it("disables moving up the first card", () => {
    renderCard({ reordering: true, isFirst: true });

    expect(
      screen.getByRole("button", { name: "Move Checkout flow up" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move Checkout flow down" }),
    ).toBeEnabled();
  });

  it("disables moving down the last card", () => {
    renderCard({ reordering: true, isLast: true });

    expect(
      screen.getByRole("button", { name: "Move Checkout flow up" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Move Checkout flow down" }),
    ).toBeDisabled();
  });
});

describe("FunnelPinnedCard weekly plot", () => {
  const points = [
    point(week1, [0, 0, 0]),
    point(week2, [2000, 1200, 600]),
    point(week3, [500, 100, 10], { complete: false }),
  ];

  beforeEach(() => {
    mockTrend(points);
  });

  const renderTooltip = (index: number) =>
    render(
      mockBarProps.tooltip({
        data: mockBarProps.data[index],
        index,
        color: "#000000",
      }),
    ).container;

  it("plots every week's conversion, with zero for a week nobody entered", () => {
    renderCard();

    expect(mockBarProps.data).toEqual([
      { datetime: week1, conversion: 0, entered: 0 },
      { datetime: week2, conversion: 30, entered: 2000 },
      { datetime: week3, conversion: 2, entered: 500 },
    ]);
  });

  it.each(["light", "dark"])(
    "colors a week still converting apart from a complete week in the %s theme",
    (theme) => {
      mockTheme = theme;
      renderCard();

      expect(mockBarProps.colors({ index: 2 })).not.toBe(
        mockBarProps.colors({ index: 1 }),
      );
    },
  );

  it("shows a complete week's conversion and users in the tooltip", () => {
    renderCard();
    const tooltip = renderTooltip(1);

    expect(tooltip).toHaveTextContent("Week of 28 Sep, 2026");
    expect(tooltip).not.toHaveTextContent("Still converting");
    expect(within(tooltip).getByText("30% conversion")).toBeInTheDocument();
    expect(within(tooltip).getByText("Users entered: 2K")).toBeInTheDocument();
  });

  it("marks a week still converting in the tooltip", () => {
    renderCard();
    const tooltip = renderTooltip(2);

    expect(tooltip).toHaveTextContent("Week of 5 Oct, 2026 · Still converting");
    expect(within(tooltip).getByText("2% conversion")).toBeInTheDocument();
  });

  it("says no users entered in the tooltip of an empty week", () => {
    renderCard();
    const tooltip = renderTooltip(0);

    expect(within(tooltip).getByText("No users entered")).toBeInTheDocument();
    expect(within(tooltip).queryByText(/conversion$/)).not.toBeInTheDocument();
    expect(within(tooltip).getByText("Users entered: 0")).toBeInTheDocument();
  });

  it("opens the funnel over a complete week when its bar is clicked", () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Bar 1" }));

    expect(mockPush).toHaveBeenCalledTimes(1);
    const url = new URL(mockPush.mock.calls[0][0] as string, "http://host");
    expect(url.pathname).toBe(funnelPath);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      from: "pinned",
      d: "Custom Range",
      sd: "2026-09-28T00:00:00.000Z",
      ed: "2026-10-05T00:00:00.000Z",
    });
  });

  it("opens the funnel when the plot is clicked between bars", () => {
    renderCard();
    fireEvent.click(screen.getByTestId("bar-canvas"));

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(`${funnelPath}?from=pinned`);
  });

  it("opens nothing when the plot or a bar is clicked in reorder mode", () => {
    renderCard({ reordering: true });
    fireEvent.click(screen.getByRole("button", { name: "Bar 1" }));
    fireEvent.click(screen.getByTestId("bar-canvas"));

    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("FunnelPinButton", () => {
  it("offers unpin and is pressed when pinned", () => {
    const onClick = jest.fn();
    render(<FunnelPinButton pinned disabled={false} onClick={onClick} />);

    const button = screen.getByRole("button", { name: "Unpin funnel" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("offers pin and is not pressed when unpinned", () => {
    render(
      <FunnelPinButton pinned={false} disabled={false} onClick={jest.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Pin funnel" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
