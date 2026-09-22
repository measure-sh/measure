import { mockRouter } from "@/__tests__/helpers/mock_router";
import { promiseParams } from "@/__tests__/helpers/promise_params";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import { DateTime } from "luxon";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { http } from "msw";

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: {
    reset: jest.fn(),
    capture: jest.fn(),
    init: jest.fn(),
    group: jest.fn(),
  },
}));

jest.mock("@/app/utils/navigation", () => ({
  navigateTo: jest.fn(),
  reloadPage: jest.fn(),
}));

let mockPathname = "/sandbox";
jest.mock("next/navigation", () => ({
  ...require("@/__tests__/helpers/mock_router").nextNavigationMock(),
  useRouter: () => ({
    push: require("@/__tests__/helpers/mock_router").mockRouter.pushMock,
    replace: jest.fn(),
  }),
  usePathname: () => mockPathname,
  useParams: () => ({ teamId: "sandbox" }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock("next-themes", () => ({
  __esModule: true,
  useTheme: () => ({ theme: "light" }),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

const mockIsBillingEnabled = jest.fn(() => false);
jest.mock("@/app/utils/feature_flag_utils", () => ({
  __esModule: true,
  isBillingEnabled: () => mockIsBillingEnabled(),
}));

jest.mock("@nivo/line", () => {
  const LineChartStub = ({ data }: any) => (
    <div data-testid="nivo-line-chart">
      {data?.map((s: any) => (
        <span key={s.id} data-testid={`chart-series-${s.id}`}>
          {s.id}: {s.data?.length ?? 0} points
        </span>
      ))}
    </div>
  );
  return {
    __esModule: true,
    ResponsiveLine: LineChartStub,
    ResponsiveLineCanvas: LineChartStub,
  };
});

jest.mock("@nivo/bar", () => ({
  __esModule: true,
  ResponsiveBar: ({ keys }: any) => (
    <div data-testid="nivo-bar-chart">
      {keys?.map((k: string) => (
        <span key={k} data-testid={`bar-key-${k}`}>
          {k}
        </span>
      ))}
    </div>
  ),
}));

jest.mock("@nivo/heatmap", () => ({
  __esModule: true,
  ResponsiveHeatMapCanvas: ({ data }: any) => (
    <div data-testid="nivo-heatmap">{data?.length ?? 0} rows</div>
  ),
}));

jest.mock("@nivo/pie", () => ({
  __esModule: true,
  ResponsivePie: ({ data }: any) => (
    <div data-testid="nivo-pie-chart">
      {data?.map((d: any) => (
        <span key={d.id} data-testid={`pie-slice-${d.id}`}>
          {d.label}: {d.value} sessions, {d.events} events, {d.spans} spans
        </span>
      ))}
    </div>
  ),
}));

jest.mock("@nivo/sankey", () => ({
  __esModule: true,
  ResponsiveSankey: ({ data }: any) => (
    <div data-testid="nivo-sankey">
      {data?.nodes?.map((node: any) => (
        <span
          key={node.id}
          data-testid={`sankey-node-${node.id.split(".").pop()}`}
        >
          {node.id.split(".").pop()}
        </span>
      ))}
    </div>
  ),
}));

// Radix popovers need a resize observer and pointer capture, which jsdom lacks.
(globalThis as any).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView = jest.fn();
Element.prototype.hasPointerCapture = jest.fn(() => false);
Element.prototype.setPointerCapture = jest.fn();
Element.prototype.releasePointerCapture = jest.fn();

import { server } from "../msw/server";

jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

import AlertsOverview from "@/app/[teamId]/alerts/page";
import Apps from "@/app/[teamId]/apps/page";
import Builds from "@/app/[teamId]/builds/page";
import BugReportsOverview from "@/app/[teamId]/bug_reports/page";
import UserJourneysPage from "@/app/[teamId]/journeys/page";
import Notifications from "@/app/[teamId]/notif_prefs/page";
import SessionDetail from "@/app/[teamId]/session_replays/[appId]/[sessionId]/page";
import SessionReplayOverview from "@/app/[teamId]/session_replays/page";
import TeamOverview from "@/app/[teamId]/team/page";
import TracesOverview from "@/app/[teamId]/traces/page";
import Usage from "@/app/[teamId]/usage/page";
import BugReport from "@/app/components/bug_report";
import { ErrorsDetails } from "@/app/components/errors_details";
import { ErrorsOverview } from "@/app/components/errors_overview";
import NetworkDetails from "@/app/components/network_details";
import NetworkOverview from "@/app/components/network_overview";
import Overview from "@/app/components/overview";
import TraceDetails from "@/app/components/trace/details";
import { queryClient } from "@/app/query/query_client";
import { handleSandboxRequest } from "@/app/sandbox/handlers";
import { catalog } from "@/app/sandbox/catalog";
import { DateRange } from "@/app/components/filter_bar/date_range_select";
import { createFiltersStore } from "@/app/stores/filters_store";
import { createOnboardingStore } from "@/app/stores/onboarding_store";
import { QueryClientProvider } from "@tanstack/react-query";

const world = catalog();
const bundle = world.appById.get(world.apps[0].id)!;
const APP_ID = bundle.app.id;
const APP_NAME = bundle.app.name;
const latestVersion = bundle.scenario.app.versions[0].name;
const npeGroup = bundle.errorGroups.find(
  (g) => g.type === "java.lang.NullPointerException",
)!;
const firstBugReport = bundle.bugReports.find((r) => r.status === 0)!;
const firstBugReportText = new RegExp(
  firstBugReport.description
    .slice(0, 30)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
);
const newestVersion = bundle.scenario.app.versions[0];
const newestVersionLabel = `${newestVersion.name} (${newestVersion.code})`;
const [firstCheckoutFlowSpan] = bundle.spanRows.filter(
  (r) => r.span_name === "checkout_flow",
);
const sandboxTrace = bundle.traces.get(firstCheckoutFlowSpan.trace_id)!;
const checkoutEndpoint = bundle.httpSamples.find(
  (s) => s.path === "/v1/checkout",
)!;
const cdnEndpoint = bundle.httpSamples.find(
  (s) => s.domain === "cdn.acme.shop",
)!;

let filtersStore = createFiltersStore();
let onboardingStore = createOnboardingStore();

jest.mock("@/app/stores/provider", () => {
  const { useStore } = require("zustand");
  return {
    __esModule: true,
    useFiltersStore: (selector?: any) =>
      useStore(filtersStore, selector ?? ((s: any) => s)),
    useOnboardingStore: (selector?: any) =>
      useStore(onboardingStore, selector ?? ((s: any) => s)),
    useMeasureStoreRegistry: () => ({ filtersStore, onboardingStore }),
  };
});

beforeEach(() => {
  filtersStore = createFiltersStore();
  onboardingStore = createOnboardingStore();
  queryClient.clear();
  mockRouter.reset();
  mockIsBillingEnabled.mockReturnValue(false);
  const { apiClient } = require("@/app/api/api_client");
  apiClient.init({ replace: jest.fn(), push: jest.fn() });
  server.use(
    http.all("*", () => {
      throw new Error("network call in sandbox");
    }),
  );
});

async function firstSandboxSessionId(): Promise<string> {
  const res = await handleSandboxRequest(
    `/api/apps/${APP_ID}/sessions?from=2000-01-01T00:00:00.000Z&to=2100-01-01T00:00:00.000Z&limit=1&offset=0`,
  );
  const data = await res.json();
  return data.results[0].session_id;
}

function sessionsWithinHours(hours: number, versionName?: string): number {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return bundle.sessions.filter(
    (s) =>
      new Date(s.list.last_event_time).getTime() >= cutoff &&
      (versionName === undefined ||
        s.list.attribute.app_version === versionName),
  ).length;
}

type SandboxCase = {
  name: string;
  path: string;
  render: () => React.ReactElement | Promise<React.ReactElement>;
  expect: () => Promise<void>;
};

const cases: SandboxCase[] = [
  {
    name: "Alerts",
    path: "/sandbox/alerts",
    render: () => (
      <AlertsOverview params={promiseParams({ teamId: "sandbox" })} />
    ),
    expect: async () => {
      expect(
        await screen.findByText(
          bundle.alerts[0].message,
          {},
          { timeout: 5000 },
        ),
      ).toBeTruthy();
      expect(screen.getByText(APP_NAME)).toBeTruthy();
    },
  },
  {
    name: "Apps",
    path: "/sandbox/apps",
    render: () => <Apps params={promiseParams({ teamId: "sandbox" })} />,
    expect: async () => {
      await waitFor(
        () => {
          expect(screen.getByText("Copy SDK Variables")).toBeTruthy();
        },
        { timeout: 5000 },
      );
      expect(screen.getByText("com.acme.shop")).toBeTruthy();
      const apiKeyInput = screen.getByTestId(
        "api-key-input",
      ) as HTMLInputElement;
      expect(apiKeyInput.value).toContain("msrsdk_");
      expect(
        (document.getElementById("change-app-name-input") as HTMLInputElement)
          .disabled,
      ).toBe(true);
      expect(screen.getByText("Rotate").closest("button")?.disabled).toBe(true);
      expect(
        (screen.getByLabelText("Save thresholds") as HTMLButtonElement)
          .disabled,
      ).toBe(true);
      expect(screen.getByText("Create App").closest("button")?.disabled).toBe(
        true,
      );
    },
  },
  {
    name: "Bug reports overview",
    path: "/sandbox/bug_reports",
    render: () => {
      filtersStore.getState().setSelectedDateRange(DateRange.LastMonth);
      return (
        <BugReportsOverview params={promiseParams({ teamId: "sandbox" })} />
      );
    },
    expect: async () => {
      await waitFor(
        () =>
          expect(
            screen.getByText(`ID: ${firstBugReport.event_id}`),
          ).toBeTruthy(),
        { timeout: 5000 },
      );
      expect(screen.getByText(firstBugReportText)).toBeTruthy();
      expect(screen.getByTestId("nivo-line-chart")).toBeTruthy();
      expect(
        screen.getByTestId(`chart-series-${newestVersionLabel}`),
      ).toBeTruthy();
      expect(await screen.findByText(APP_NAME)).toBeTruthy();
    },
  },
  {
    name: "Bug report detail",
    path: "/sandbox/bug_reports",
    render: () => (
      <BugReport
        params={{
          teamId: "sandbox",
          appId: APP_ID,
          bugReportId: firstBugReport.event_id,
        }}
      />
    ),
    expect: async () => {
      await waitFor(
        () => expect(screen.getByText(firstBugReportText)).toBeTruthy(),
        { timeout: 5000 },
      );
      expect(screen.getByTestId("bug-report-detail-status")).toBeTruthy();
      const button = screen.getByText("Close Bug Report").closest("button")!;
      expect(button.disabled).toBe(true);
    },
  },
  {
    name: "Builds",
    path: "/sandbox/builds",
    render: () => {
      filtersStore.getState().setSelectedDateRange(DateRange.LastMonth);
      return <Builds params={promiseParams({ teamId: "sandbox" })} />;
    },
    expect: async () => {
      const [firstBuild] = bundle.builds;
      expect(
        await screen.findByText(
          `${firstBuild.version_name} (${firstBuild.version_code})`,
          {},
          { timeout: 5000 },
        ),
      ).toBeTruthy();
      expect(screen.getAllByText("proguard").length).toBeGreaterThan(0);
      const downloads = screen.getAllByRole("button", { name: "Download" });
      const monthAgo = DateTime.now().minus({ months: 1 });
      expect(downloads.length).toBe(
        bundle.builds
          .filter((b) => DateTime.fromISO(b.last_updated) >= monthAgo)
          .reduce((sum, b) => sum + b.files.length, 0),
      );
      expect(
        downloads.every((button) => (button as HTMLButtonElement).disabled),
      ).toBe(true);
      expect(screen.queryAllByRole("link", { name: "Download" })).toHaveLength(
        0,
      );
    },
  },
  {
    name: "Errors overview",
    path: "/sandbox/errors",
    render: () => <ErrorsOverview teamId="sandbox" />,
    expect: async () => {
      await waitFor(
        () =>
          expect(
            screen.getByText("CheckoutViewModel.kt: onPlaceOrderClicked()"),
          ).toBeTruthy(),
        { timeout: 5000 },
      );
      expect(screen.getByTestId("nivo-line-chart")).toBeTruthy();
      expect(await screen.findByText(APP_NAME)).toBeTruthy();
    },
  },
  {
    name: "Errors detail",
    path: "/sandbox/errors",
    render: () => (
      <ErrorsDetails
        teamId="sandbox"
        appId={APP_ID}
        errorGroupId={npeGroup.id}
      />
    ),
    expect: async () => {
      await waitFor(
        () =>
          expect(
            screen.getByText(`Id: ${npeGroup.instances[0].id}`),
          ).toBeTruthy(),
        { timeout: 5000 },
      );
      expect(screen.getByTestId("exception-detail-pills")).toBeTruthy();
      expect(
        await screen.findByTestId("exception-detail-common-path"),
      ).toBeTruthy();
      expect(screen.getByTestId("nivo-bar-chart")).toBeTruthy();
    },
  },
  {
    name: "Journeys",
    path: "/sandbox/journeys",
    render: () => (
      <UserJourneysPage params={promiseParams({ teamId: "sandbox" })} />
    ),
    expect: async () => {
      await waitFor(
        () => expect(screen.getByTestId("nivo-sankey")).toBeTruthy(),
        { timeout: 5000 },
      );
      expect(screen.getByTestId("sankey-node-CheckoutActivity")).toBeTruthy();
      expect(screen.getByTestId("sankey-node-HomeActivity")).toBeTruthy();
    },
  },
  {
    name: "Network overview",
    path: "/sandbox/network",
    render: () => <NetworkOverview params={{ teamId: "sandbox" }} />,
    expect: async () => {
      await waitFor(
        () => expect(screen.getByTestId("nivo-heatmap")).toBeTruthy(),
        { timeout: 5000 },
      );
      expect(screen.getByTestId("nivo-line-chart")).toBeTruthy();
      expect(screen.getByText("Top Endpoints")).toBeTruthy();
      expect(
        screen.getByText(`${cdnEndpoint.domain}${cdnEndpoint.path}`),
      ).toBeTruthy();
    },
  },
  {
    name: "Network details",
    path: "/sandbox/network/details",
    render: () => {
      mockRouter.setUrl(
        `domain=${checkoutEndpoint.domain}&path=${encodeURIComponent(checkoutEndpoint.path)}`,
      );
      return <NetworkDetails params={{ teamId: "sandbox" }} />;
    },
    expect: async () => {
      await waitFor(
        () => expect(screen.getByTestId("nivo-heatmap")).toBeTruthy(),
        { timeout: 5000 },
      );
      expect(screen.getByText("Latency")).toBeTruthy();
      expect(screen.getByText("Status Codes")).toBeTruthy();
      expect(screen.getAllByTestId("nivo-line-chart")).toHaveLength(2);
    },
  },
  {
    name: "Notification preferences",
    path: "/sandbox/notif_prefs",
    render: () => (
      <Notifications params={promiseParams({ teamId: "sandbox" })} />
    ),
    expect: async () => {
      await waitFor(() => {
        expect(screen.getByText("Crash Spike email")).toBeTruthy();
      });
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(4);
      checkboxes.forEach((checkbox) => {
        expect((checkbox as HTMLButtonElement).disabled).toBe(true);
      });
      expect(
        (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    },
  },
  {
    name: "Overview",
    path: "/sandbox/overview",
    render: () => <Overview params={{ teamId: "sandbox" }} />,
    expect: async () => {
      await waitFor(
        () =>
          expect(
            screen.getByText((text) => /^(\S+)\/\1 sessions$/.test(text)),
          ).toBeTruthy(),
        {
          timeout: 5000,
        },
      );
      expect(screen.getByTestId("nivo-line-chart")).toBeTruthy();
      expect(screen.getByTestId("chart-series-Sessions")).toBeTruthy();
      expect(screen.getByTestId("chart-series-Crashes")).toBeTruthy();
      expect(screen.getByText("App adoption")).toBeTruthy();
      expect(await screen.findByText(APP_NAME)).toBeTruthy();
      expect(await screen.findByText("Filter by app version…")).toBeTruthy();
    },
  },
  {
    name: "Session replay details",
    path: "/sandbox/session_replays",
    render: async () => {
      const sessionId = await firstSandboxSessionId();
      return (
        <SessionDetail
          params={promiseParams({
            teamId: "sandbox",
            appId: APP_ID,
            sessionId,
          })}
        />
      );
    },
    expect: async () => {
      await waitFor(() => expect(screen.getByText(/User ID:/)).toBeTruthy(), {
        timeout: 5000,
      });
      expect(screen.getByText(/App version: 3\./)).toBeTruthy();
      expect(screen.queryByText(/Error fetching session replay/)).toBeNull();
    },
  },
  {
    name: "Session replay details, unknown session",
    path: "/sandbox/session_replays",
    render: () => (
      <SessionDetail
        params={promiseParams({
          teamId: "sandbox",
          appId: APP_ID,
          sessionId: "does-not-exist",
        })}
      />
    ),
    expect: async () => {
      expect(
        await screen.findByText(/Error fetching session replay/),
      ).toBeTruthy();
    },
  },
  {
    name: "Session replays list, filter narrowed",
    path: "/sandbox/session_replays",
    render: () => {
      mockRouter.setUrl(
        `filter_expr=${encodeURIComponent(`version_name:in:${latestVersion}`)}`,
      );
      return (
        <SessionReplayOverview params={promiseParams({ teamId: "sandbox" })} />
      );
    },
    expect: async () => {
      await waitFor(
        () =>
          expect(screen.getAllByText(/Session ID:/).length).toBeGreaterThan(0),
        { timeout: 5000 },
      );
      const narrowedCount = Math.min(sessionsWithinHours(6, latestVersion), 5);
      expect(screen.getAllByText(/Session ID:/)).toHaveLength(narrowedCount);
      expect(
        screen.getAllByText((content) =>
          content.startsWith(`${latestVersion}(`),
        ),
      ).toHaveLength(narrowedCount);
    },
  },
  {
    name: "Session replays list",
    path: "/sandbox/session_replays",
    render: () => (
      <SessionReplayOverview params={promiseParams({ teamId: "sandbox" })} />
    ),
    expect: async () => {
      await waitFor(
        () =>
          expect(screen.getAllByText(/Session ID:/).length).toBeGreaterThan(0),
        { timeout: 5000 },
      );
      expect(screen.getByTestId("nivo-line-chart")).toBeTruthy();
      expect(screen.getAllByText(/Android API Level/).length).toBeGreaterThan(
        0,
      );
    },
  },
  {
    name: "Team",
    path: "/sandbox/team",
    render: () => (
      <TeamOverview params={promiseParams({ teamId: "sandbox" })} />
    ),
    expect: async () => {
      await waitFor(
        () => {
          expect(screen.getByText("Invite Team Members")).toBeTruthy();
        },
        { timeout: 5000 },
      );
      expect(screen.getByText("developer@acme.shop")).toBeTruthy();
      expect(
        (document.getElementById("change-team-name-input") as HTMLInputElement)
          .value,
      ).toBe("Acme Team");
      expect((screen.getByRole("switch") as HTMLButtonElement).disabled).toBe(
        true,
      );
      expect(
        screen.getByText("Send Test Alert").closest("button")?.disabled,
      ).toBe(true);
      expect(
        screen
          .getByRole("button", { name: "Remove Slack connection" })
          .hasAttribute("disabled"),
      ).toBe(true);
      expect(screen.getByText("Invite").closest("button")?.disabled).toBe(true);
      const rolePicker = screen
        .getAllByText("Viewer")
        .map((el) => el.closest("button"))
        .find((button) => button !== null);
      expect(rolePicker?.disabled).toBe(false);
      expect(
        screen.getAllByText("Save").at(-1)?.closest("button")?.disabled,
      ).toBe(true);
      expect(screen.queryByText("Change Role")).toBeNull();
      expect(screen.getAllByText("Remove")).toHaveLength(1);
      expect(screen.getByText("Create Team").closest("button")?.disabled).toBe(
        true,
      );
    },
  },
  {
    name: "Traces overview",
    path: "/sandbox/traces",
    render: () => (
      <TracesOverview params={promiseParams({ teamId: "sandbox" })} />
    ),
    expect: async () => {
      await waitFor(
        () => expect(screen.getByTestId("nivo-line-chart")).toBeTruthy(),
        { timeout: 5000 },
      );
      const defaultSpanName = [...bundle.rootSpanNames].sort()[0];
      expect(
        screen.getByTestId(`chart-series-${newestVersionLabel}`),
      ).toBeTruthy();
      expect(screen.getAllByText(defaultSpanName).length).toBeGreaterThan(0);
    },
  },
  {
    name: "Trace details",
    path: "/sandbox/traces",
    render: () => (
      <TraceDetails
        params={{
          teamId: "sandbox",
          appId: APP_ID,
          traceId: sandboxTrace.trace_id,
        }}
      />
    ),
    expect: async () => {
      expect(
        await screen.findByText(
          `Spans: ${sandboxTrace.spans.length}`,
          {},
          { timeout: 5000 },
        ),
      ).toBeTruthy();
      expect(
        screen.getByText(`App version: ${sandboxTrace.app_version}`),
      ).toBeTruthy();
      expect(
        screen.getByText(`Network type: ${sandboxTrace.network_type}`),
      ).toBeTruthy();
    },
  },
  {
    name: "Usage",
    path: "/sandbox/usage",
    render: () => <Usage params={promiseParams({ teamId: "sandbox" })} />,
    expect: async () => {
      await waitFor(() => {
        expect(screen.getByTestId("nivo-pie-chart")).toBeTruthy();
      });
      expect(
        screen.getByText(new RegExp(`${APP_NAME}: \\d+ sessions`)),
      ).toBeTruthy();
    },
  },
  {
    name: "Usage, billing enabled",
    path: "/sandbox/usage",
    render: () => {
      mockIsBillingEnabled.mockReturnValue(true);
      return <Usage params={promiseParams({ teamId: "sandbox" })} />;
    },
    expect: async () => {
      await waitFor(() => {
        expect(screen.getByTestId("nivo-pie-chart")).toBeTruthy();
      });
      expect(screen.queryByText("Billing")).toBeNull();
    },
  },
];

describe.each(cases)("Sandbox $name page (MSW integration)", (testCase) => {
  it("renders the sandbox fixture with no network call", async () => {
    mockPathname = testCase.path;
    window.history.pushState({}, "", testCase.path);

    render(
      <QueryClientProvider client={queryClient}>
        {await testCase.render()}
      </QueryClientProvider>,
    );

    await testCase.expect();
  });
});
