import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { pointerDown } from "@/__tests__/helpers/pointer_events";
import { makeSessionReplayFixture } from "@/__tests__/msw/fixtures";
import posthog from "posthog-js";
import SessionReplay from "@/app/components/session_replay/player";

// jsdom has no layout, so it leaves this unimplemented. The player observes
// its stage for resizes.
Object.defineProperty(window, "ResizeObserver", {
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
  writable: true,
  configurable: true,
});

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { captureException: jest.fn() },
}));

// Many tests here drive attachments into failures on purpose, and the player
// reports each one to the console as it would in the browser. Silencing that
// keeps the run readable; the tests that care about a report assert on the
// PostHog mock or on a spy of their own.
jest.spyOn(console, "error").mockImplementation(() => {});

// Shiki highlighting does not run under jsdom; the stacktrace tests only need
// the text.
jest.mock("@/app/components/code_block", () => ({
  __esModule: true,
  CODE_BLOCK_CARD_CLASS: "",
  default: ({ code }: any) => <pre>{code}</pre>,
}));

describe("session replay player", () => {
  // Fixture sessions share an ID, so each test gets a fresh attachment cache.
  let queries = new QueryClient();
  beforeEach(() => {
    queries = new QueryClient();
  });
  const withQueries = (ui: ReactElement) => (
    <QueryClientProvider client={queries}>{ui}</QueryClientProvider>
  );

  const renderReplay = (overrides: Record<string, any> = {}) =>
    render(
      withQueries(
        <SessionReplay
          teamId="test-team"
          appId="app-1"
          session={makeSessionReplayFixture(overrides)}
        />,
      ),
    );

  // Two events five seconds apart, for tests that move the playhead.
  const fiveSecondSession = {
    threads: {
      main: [
        {
          event_type: "lifecycle_activity",
          thread_name: "main",
          type: "created",
          class_name: "sh.measure.demo.MainActivity",
          timestamp: "2026-04-10T10:00:00Z",
        },
        {
          event_type: "lifecycle_app",
          thread_name: "main",
          type: "background",
          timestamp: "2026-04-10T10:00:05Z",
        },
      ],
    },
    traces: [],
  };

  describe("event list", () => {
    it("shows the session's events with the correct titles", async () => {
      renderReplay();

      await waitFor(() => {
        // A lifecycle event is titled from its type and class name, a trace
        // from its name alone.
        expect(screen.getByText(/Created: MainActivity/)).toBeTruthy();
        expect(screen.getByText(/activity\.onCreate/)).toBeTruthy();
      });
    });

    it("titles logs and network calls from their content", async () => {
      renderReplay({
        threads: {
          main: [
            {
              event_type: "string",
              thread_name: "main",
              severity_text: "debug",
              string: "Rendered product grid",
              timestamp: "2026-04-10T10:00:00Z",
            },
            {
              event_type: "http",
              thread_name: "main",
              method: "get",
              status_code: 200,
              url: "https://api.example.com/v1/products",
              timestamp: "2026-04-10T10:00:01Z",
            },
          ],
        },
        traces: [],
      });

      await waitFor(() => {
        // A log's pill carries its severity; the row text is the message.
        expect(screen.getByText("Log: Debug")).toBeTruthy();
        expect(screen.getByText("Rendered product grid")).toBeTruthy();
        expect(
          screen.getByText("GET 200 https://api.example.com/v1/products"),
        ).toBeTruthy();
      });
    });

    it("renders events with matching types, threads and timestamps separately", async () => {
      // These callbacks share a thread and timestamp, so those fields and the
      // event type do not uniquely identify a row. Using them as the React key
      // would trigger a duplicate-key warning. Read the file-level spy directly
      // so restoring a local spy cannot re-enable console errors for later tests.
      const consoleError = console.error as jest.Mock<void, unknown[]>;

      renderReplay({
        threads: {
          "com.apple.main-thread": [
            {
              event_type: "lifecycle_view_controller",
              thread_name: "com.apple.main-thread",
              class_name: "HomeViewController",
              type: "viewWillAppear",
              timestamp: "2026-05-26T10:18:42.322Z",
            },
            {
              event_type: "lifecycle_view_controller",
              thread_name: "com.apple.main-thread",
              class_name: "HomeViewController",
              type: "viewDidAppear",
              timestamp: "2026-05-26T10:18:42.322Z",
            },
          ],
        },
        traces: [],
      });

      // Both colliding events have to render, or the case that triggers the
      // warning is not exercised.
      await waitFor(() => {
        expect(
          screen.getByText("HomeViewController: viewWillAppear"),
        ).toBeTruthy();
        expect(
          screen.getByText("HomeViewController: viewDidAppear"),
        ).toBeTruthy();
      });

      const duplicateKeyWarning = consoleError.mock.calls.find((call) =>
        call.some(
          (arg) =>
            typeof arg === "string" &&
            arg.includes("two children with the same key"),
        ),
      );
      expect(duplicateKeyWarning).toBeUndefined();
    });
  });

  describe("event details", () => {
    it("opens an event's details when its row is clicked", async () => {
      renderReplay();

      const traceRow = (await screen.findByText(/activity\.onCreate/)).closest(
        "button",
      );
      await act(async () => {
        fireEvent.click(traceRow!);
      });

      await waitFor(() => {
        const text = document.body.textContent ?? "";
        expect(text).toContain("trace_id");
        expect(text).toContain("trace-001");
      });
    });

    it("shows details for only the selected event", async () => {
      renderReplay();

      const lifecycleRow = (
        await screen.findByText(/Created: MainActivity/)
      ).closest("button");
      await act(async () => {
        fireEvent.click(lifecycleRow!);
      });
      await waitFor(() => {
        expect(document.body.textContent).toContain("event_type");
      });

      const traceRow = (await screen.findByText(/activity\.onCreate/)).closest(
        "button",
      );
      await act(async () => {
        fireEvent.click(traceRow!);
      });

      await waitFor(() => {
        const text = document.body.textContent ?? "";
        expect(text).toContain("trace_id");
        // Traces have no event_type row, so its absence confirms the lifecycle
        // event details have closed.
        expect(text).not.toContain("event_type");
      });
    });

    it("shows a crash's stacktrace and links to its error group", async () => {
      renderReplay({
        threads: {
          main: [
            {
              event_type: "error",
              thread_name: "main",
              severity: "fatal",
              group_id: "group-9",
              type: "java.lang.IllegalStateException",
              message: "Payment method must be specified",
              file_name: "CheckoutActivity.kt",
              stacktrace:
                "java.lang.IllegalStateException: Payment method must be specified\n\tat MaterialButton.onClick(CheckoutActivity.kt:102)",
              timestamp: "2026-04-10T10:00:00Z",
            },
          ],
        },
        traces: [],
      });

      const row = (
        await screen.findByText(/IllegalStateException: Payment method/)
      ).closest("button");
      await act(async () => {
        fireEvent.click(row!);
      });

      await waitFor(() => {
        expect(screen.getByText(/at MaterialButton\.onClick/)).toBeTruthy();
      });
      const link = screen.getByText("View Error Details").closest("a");
      expect(link?.getAttribute("href")).toBe(
        "/test-team/errors/app-1/group-9/java.lang.IllegalStateException%40CheckoutActivity.kt?from=session_replay_details",
      );
    });

    it.each([
      ["killed", "Main thread blocked for 8s, app killed"],
      ["recovered", "Main thread blocked for 8s"],
    ])("links a %s app hang to app hang details page", async (state, title) => {
      renderReplay({
        threads: {
          main: [
            {
              event_type: "app_hang",
              thread_name: "main",
              group_id: "970e70deaf83c0aaea222463e2cf831e",
              duration: 8000,
              state,
              method_name: "blockMainThread()",
              file_name: "ViewController.swift",
              line_number: 319,
              stacktrace:
                "0 DemoApp 0x104a3f5c0 ViewController.blockMainThread() + 192 (ViewController.swift:319)",
              foreground: true,
              timestamp: "2026-04-10T10:00:00Z",
              attachments: [],
            },
          ],
        },
        traces: [],
      });

      const row = (await screen.findByText(title)).closest("button");
      await act(async () => {
        fireEvent.click(row!);
      });

      const link = (await screen.findByText("View App Hang Details")).closest(
        "a",
      );
      expect(link?.getAttribute("href")).toBe(
        "/test-team/errors/app-1/970e70deaf83c0aaea222463e2cf831e/ViewController.swift?from=session_replay_details",
      );
    });

    it("links an app hang with no file name to app hang details page as unknown_file", async () => {
      renderReplay({
        threads: {
          main: [
            {
              event_type: "app_hang",
              thread_name: "main",
              group_id: "970e70deaf83c0aaea222463e2cf831e",
              duration: 8000,
              state: "recovered",
              method_name: "",
              file_name: "",
              line_number: 0,
              stacktrace: "0 DemoApp 0x104a3f5c0",
              foreground: true,
              timestamp: "2026-04-10T10:00:00Z",
              attachments: [],
            },
          ],
        },
        traces: [],
      });

      const row = (
        await screen.findByText("Main thread blocked for 8s")
      ).closest("button");
      await act(async () => {
        fireEvent.click(row!);
      });

      const link = (await screen.findByText("View App Hang Details")).closest(
        "a",
      );
      expect(link?.getAttribute("href")).toBe(
        "/test-team/errors/app-1/970e70deaf83c0aaea222463e2cf831e/unknown_file?from=session_replay_details",
      );
    });
  });

  describe("controls", () => {
    it("plays and pauses from one control", async () => {
      renderReplay();

      const play = await screen.findByLabelText("Play");
      await act(async () => {
        fireEvent.click(play);
      });
      expect(screen.getByLabelText("Pause")).toBeTruthy();

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Pause"));
      });
      expect(screen.getByLabelText("Play")).toBeTruthy();
    });

    it("moves the playhead from the keyboard", async () => {
      renderReplay(fiveSecondSession);

      const slider = await screen.findByRole("slider", { name: "Playhead" });
      await act(async () => {
        fireEvent.keyDown(slider, { key: "ArrowRight" });
      });

      expect(slider.getAttribute("aria-valuenow")).toBe("1000");
      expect(screen.getByText(/^0:01\.000 \//)).toBeTruthy();
    });

    it("marks a chosen playback speed as pressed", async () => {
      renderReplay(fiveSecondSession);

      const twoX = await screen.findByRole("button", { name: "2x" });
      await act(async () => {
        fireEvent.click(twoX);
      });

      expect(twoX.getAttribute("aria-pressed")).toBe("true");
    });

    it("does not seek on a right or middle click on the scrubber", async () => {
      renderReplay(fiveSecondSession);

      const slider = await screen.findByRole("slider", { name: "Playhead" });
      await act(async () => {
        fireEvent.pointerDown(slider, { button: 2, clientX: 50 });
        fireEvent.pointerDown(slider, { button: 1, clientX: 50 });
      });

      expect(slider.getAttribute("aria-valuenow")).toBe("0");
    });

    it("restores a paused playhead when a session refetch remounts the player", async () => {
      const view = renderReplay(fiveSecondSession);

      const slider = await screen.findByRole("slider", { name: "Playhead" });
      await act(async () => {
        fireEvent.keyDown(slider, { key: "ArrowRight" });
      });
      expect(slider.getAttribute("aria-valuenow")).toBe("1000");

      await act(async () => {
        view.rerender(
          withQueries(
            <SessionReplay
              teamId="test-team"
              appId="app-1"
              session={makeSessionReplayFixture(fiveSecondSession)}
            />,
          ),
        );
      });

      await waitFor(
        () => {
          const after = screen.getByRole("slider", { name: "Playhead" });
          expect(after.getAttribute("aria-valuenow")).toBe("1000");
        },
        { timeout: 3000 },
      );
      expect(screen.getByLabelText("Play")).toBeTruthy();
    });

    it("keeps playing from the same position when the player remounts", async () => {
      const view = renderReplay(fiveSecondSession);

      const play = await screen.findByLabelText("Play");
      await act(async () => {
        fireEvent.click(play);
      });
      const slider = screen.getByRole("slider", { name: "Playhead" });
      await act(async () => {
        fireEvent.keyDown(slider, { key: "ArrowRight" });
      });

      await act(async () => {
        view.rerender(
          withQueries(
            <SessionReplay
              teamId="test-team"
              appId="app-1"
              session={makeSessionReplayFixture(fiveSecondSession)}
            />,
          ),
        );
      });

      await waitFor(
        () => {
          expect(screen.getByLabelText("Pause")).toBeTruthy();
          const after = screen.getByRole("slider", { name: "Playhead" });
          expect(
            Number(after.getAttribute("aria-valuenow")),
          ).toBeGreaterThanOrEqual(1000);
        },
        { timeout: 3000 },
      );
    });

    it("skips the idle session to its end, and again after a restart", async () => {
      renderReplay({
        threads: {
          main: [
            {
              event_type: "lifecycle_activity",
              thread_name: "main",
              type: "created",
              class_name: "sh.measure.demo.MainActivity",
              timestamp: "2026-04-10T10:00:00Z",
            },
            {
              event_type: "lifecycle_app",
              thread_name: "main",
              type: "background",
              timestamp: "2026-04-10T10:00:10Z",
            },
          ],
        },
        traces: [],
      });

      const skip = await screen.findByRole("switch", { name: "Skip idle" });
      await act(async () => {
        fireEvent.click(skip);
      });
      await act(async () => {
        fireEvent.click(screen.getByLabelText("Play"));
      });
      await waitFor(
        () => {
          expect(screen.getByLabelText("Play")).toBeTruthy();
        },
        { timeout: 3000 },
      );
      const slider = screen.getByRole("slider", { name: "Playhead" });
      expect(slider.getAttribute("aria-valuenow")).toBe("10000");

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Play"));
      });
      await waitFor(
        () => {
          expect(screen.getByLabelText("Play")).toBeTruthy();
        },
        { timeout: 3000 },
      );
      expect(slider.getAttribute("aria-valuenow")).toBe("10000");
    });

    it("returns the playhead to the start on restart", async () => {
      renderReplay(fiveSecondSession);

      const slider = await screen.findByRole("slider", { name: "Playhead" });
      await act(async () => {
        fireEvent.keyDown(slider, { key: "ArrowRight" });
      });
      expect(slider.getAttribute("aria-valuenow")).toBe("1000");

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Restart"));
      });
      expect(slider.getAttribute("aria-valuenow")).toBe("0");
      expect(screen.getByText(/^0:00\.000 \//)).toBeTruthy();
    });

    it("plays at normal speed until another is chosen", async () => {
      renderReplay();

      const normal = await screen.findByRole("button", { name: "1x" });
      const double = screen.getByRole("button", { name: "2x" });
      expect(normal.getAttribute("aria-pressed")).toBe("true");
      expect(double.getAttribute("aria-pressed")).toBe("false");

      await act(async () => {
        fireEvent.click(double);
      });
      expect(double.getAttribute("aria-pressed")).toBe("true");
      expect(normal.getAttribute("aria-pressed")).toBe("false");
    });

    it("plays idle stretches unless asked to skip them", async () => {
      renderReplay();

      const skip = await screen.findByRole("switch", { name: "Skip idle" });
      expect(skip.getAttribute("aria-checked")).toBe("false");

      await act(async () => {
        fireEvent.click(skip);
      });
      expect(skip.getAttribute("aria-checked")).toBe("true");
    });

    it("seeks from a strip on the second touch at the same point", async () => {
      const sample = makeSessionReplayFixture().memory_usage_absolute[0];
      renderReplay({
        ...fiveSecondSession,
        memory_usage: [],
        memory_usage_absolute: [0, 1, 2, 3, 4, 5].map((second) => ({
          ...sample,
          timestamp: `2026-04-10T10:00:0${second}Z`,
        })),
      });
      const lane = await screen.findByRole("img", { name: "Memory usage" });
      const slider = screen.getByRole("slider", { name: "Playhead" });
      jest
        .spyOn(lane, "getBoundingClientRect")
        .mockReturnValue({ left: 0, width: 500 } as DOMRect);
      const press = async (target: Element, pointerType: string, x = 0) => {
        await act(async () => {
          pointerDown(target, pointerType, { clientX: x });
        });
      };

      await press(lane, "touch", 200);
      expect(screen.getByText(/^Time:/)).toBeTruthy();
      await press(lane, "touch", 300);
      expect(slider.getAttribute("aria-valuenow")).toBe("0");

      await press(document.body, "touch");
      await waitFor(() => expect(screen.queryByText(/^Time:/)).toBeNull());
      await press(lane, "touch", 300);
      expect(slider.getAttribute("aria-valuenow")).toBe("0");

      await press(lane, "touch", 300);
      expect(slider.getAttribute("aria-valuenow")).toBe("3000");

      await press(lane, "mouse", 100);
      expect(slider.getAttribute("aria-valuenow")).toBe("1000");
    });

    it("draws a lane for each metric series the session carries", async () => {
      renderReplay();

      await waitFor(() => {
        expect(screen.getByRole("img", { name: "CPU usage" })).toBeTruthy();
        expect(
          screen.getAllByRole("img", { name: "Memory usage" }).length,
        ).toBeGreaterThan(0);
      });
    });

    it("plots server-provided dynamic memory in MB and includes it in scaling", async () => {
      const sample = makeSessionReplayFixture().memory_usage[0];
      renderReplay({
        memory_usage: [{ ...sample, dynamic_memory: 524288 }],
        memory_usage_absolute: [],
      });

      const lane = await screen.findByRole("img", { name: "Memory usage" });
      fireEvent(
        lane,
        new MouseEvent("pointermove", { bubbles: true, clientX: 0 }),
      );
      // Deliberately differs from anon_rss + swap: the server owns the sum.
      expect(screen.getByText("Dynamic Memory: 512.00 MB")).toBeTruthy();
      expect(screen.getByText("Java Max Heap: 256.00 MB")).toBeTruthy();
      expect(screen.getByText("RSS: 132.07 MB")).toBeTruthy();
      const lines = lane.querySelectorAll("path");
      expect(lines.length).toBe(8);
      const height = Number(
        lane.querySelector("svg")!.getAttribute("viewBox")!.split(" ")[3],
      );
      const y = Number(
        lines[7].getAttribute("d")!.split(" ")[0].slice(1).split(",")[1],
      );
      // 512 MB raises the scale to 600 MB instead of clipping at the heap max.
      expect(y).toBeCloseTo(height * (1 - 512 / 600));
    });

    it("shows zero dynamic memory as a valid reading", async () => {
      renderReplay({
        memory_usage: [
          { ...makeSessionReplayFixture().memory_usage[0], dynamic_memory: 0 },
        ],
        memory_usage_absolute: [],
      });
      const lane = await screen.findByRole("img", { name: "Memory usage" });
      fireEvent(
        lane,
        new MouseEvent("pointermove", { bubbles: true, clientX: 0 }),
      );
      expect(screen.getByText("Dynamic Memory: 0.00 MB")).toBeTruthy();
    });

    it("keeps older responses usable without a dynamic memory field", async () => {
      const { dynamic_memory, ...sample } =
        makeSessionReplayFixture().memory_usage[0];
      renderReplay({ memory_usage: [sample], memory_usage_absolute: [] });
      const lane = await screen.findByRole("img", { name: "Memory usage" });
      fireEvent(
        lane,
        new MouseEvent("pointermove", { bubbles: true, clientX: 0 }),
      );
      expect(screen.queryByText(/Dynamic Memory:/)).toBeNull();
      expect(screen.getByText("Java Max Heap: 256.00 MB")).toBeTruthy();
      expect(lane.querySelectorAll("path").length).toBe(7);
      expect(lane.innerHTML).not.toContain("NaN");
    });

    it.each([
      { available: 262144, label: "Available Memory: 256.00 MB" },
      { available: 0, label: "Available Memory: 0.00 MB" },
      { available: null, label: "Max Memory: 1000.00 MB" },
      { available: undefined, label: "Max Memory: 1000.00 MB" },
    ])(
      "plots iOS max memory alongside available memory $available",
      async ({ available, label }) => {
        const fixture = makeSessionReplayFixture();
        renderReplay({
          attribute: { ...fixture.attribute, platform: "ios", os_name: "ios" },
          memory_usage: [],
          memory_usage_absolute: [
            {
              ...fixture.memory_usage_absolute[0],
              available_memory: available,
            },
          ],
        });
        const lane = await screen.findByRole("img", { name: "Memory usage" });
        fireEvent(
          lane,
          new MouseEvent("pointermove", { bubbles: true, clientX: 0 }),
        );
        expect(screen.getByText(label)).toBeTruthy();
        expect(screen.getByText("Max Memory: 1000.00 MB")).toBeTruthy();
        if (available == null) {
          expect(screen.queryByText(/Available Memory:/)).toBeNull();
        }
        expect(screen.queryByText(/Unavailable/)).toBeNull();
        expect(screen.getByText("Used Memory: 500.00 MB")).toBeTruthy();
        expect(screen.queryByText(/Dynamic Memory:/)).toBeNull();
        expect(lane.querySelectorAll("path").length).toBe(
          available == null ? 2 : 3,
        );
        expect(lane.innerHTML).not.toContain("NaN");
      },
    );

    it("keeps max memory continuous across missing available-memory samples", async () => {
      const fixture = makeSessionReplayFixture();
      const sample = fixture.memory_usage_absolute[0];
      renderReplay({
        threads: {
          main: [
            ...fixture.threads.main,
            { ...fixture.threads.main[0], timestamp: "2026-04-10T10:00:05Z" },
          ],
        },
        memory_usage: [],
        memory_usage_absolute: [262144, null, 0].map((available, index) => ({
          ...sample,
          timestamp: `2026-04-10T10:00:0${index}Z`,
          available_memory: available,
        })),
      });
      const lane = await screen.findByRole("img", { name: "Memory usage" });
      const lines = lane.querySelectorAll("path");
      expect(lines.length).toBe(3);
      const [availableMemory, maxMemory, usedMemory] = lines;
      expect(availableMemory.getAttribute("d")).toMatch(/^M[\d.,]+ M[\d.,]+ L/);
      expect(maxMemory.getAttribute("d")).not.toContain(" M");
      expect(usedMemory.getAttribute("d")).not.toContain(" M");
      expect(lane.innerHTML).not.toContain("NaN");
      jest
        .spyOn(lane, "getBoundingClientRect")
        .mockReturnValue({ left: 0, width: 500 } as DOMRect);
      fireEvent(
        lane,
        new MouseEvent("pointermove", { bubbles: true, clientX: 100 }),
      );
      expect(screen.getByText("Max Memory: 1000.00 MB")).toBeTruthy();
      expect(screen.queryByText(/Available Memory:/)).toBeNull();
      fireEvent(
        lane,
        new MouseEvent("pointermove", { bubbles: true, clientX: 200 }),
      );
      expect(screen.getByText("Available Memory: 0.00 MB")).toBeTruthy();
      expect(screen.getByText("Max Memory: 1000.00 MB")).toBeTruthy();
    });

    it("draws none when the session carries no samples", async () => {
      renderReplay({
        cpu_usage: [],
        memory_usage: [],
        memory_usage_absolute: [],
      });

      await screen.findByLabelText("Restart");
      expect(screen.queryByRole("img", { name: "CPU usage" })).toBeNull();
    });
  });

  // jsdom has no network, so this stub controls which attachment requests load.
  const stubFetch = () => {
    const original = (globalThis as any).fetch;
    (globalThis as any).fetch = jest.fn(async (url: unknown) => {
      if (String(url).includes("good")) {
        return { ok: true, json: async () => ({ width: 200, height: 400 }) };
      }
      throw new Error("network");
    });
    return () => {
      (globalThis as any).fetch = original;
    };
  };

  // Build a tap with the attachments a test needs. The fetch stub controls
  // which locations load.
  const tapWith = (
    attachments: { type: string; name: string; location?: string }[],
  ) => ({
    threads: {
      main: [
        {
          event_type: "gesture_click",
          thread_name: "main",
          target: "android.widget.Button",
          x: 10,
          y: 10,
          timestamp: "2026-04-10T10:00:00Z",
          attachments: attachments.map((attachment, index) => ({
            id: `a${index}`,
            key: `k${index}`,
            location: `https://cdn/a${index}`,
            ...attachment,
          })),
        },
      ],
    },
    traces: [],
  });

  const tapWithAttachments = (locations: string[]) =>
    tapWith(
      locations.map((location) => ({
        type: "layout_snapshot_json",
        name: "snapshot.json",
        location,
      })),
    );

  it("offers the event list while the first screen is still downloading", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(() => new Promise(() => {})) as any;
    try {
      renderReplay(tapWithAttachments(["https://cdn/slow.json"]));
      expect(await screen.findByLabelText("Play")).toBeTruthy();
      expect(
        screen.getByTestId("session-replay-events").children.length,
      ).toBeGreaterThan(0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('shows "No captures in this session" on the stage when the session captured none', async () => {
    renderReplay(fiveSecondSession);

    expect(await screen.findByText("No captures in this session")).toBeTruthy();
  });

  it("waits for the replay before showing the empty-session message", () => {
    // The session reaches the machine in an effect, so the first paint has no
    // replay to count attachments from and must say nothing either way.
    const { container } = renderReplay(
      tapWith([{ type: "layout_snapshot_json", name: "a.json" }]),
    );

    expect(container.textContent).not.toContain("No captures in this session");
  });

  const loadingMessage = "Captures loading...";
  const failedMessage =
    "Error loading captures here. Refresh page to try again.";

  it('shows "Captures loading..." on the stage while an attachment is being fetched', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(() => new Promise(() => {})) as any;
    try {
      renderReplay(tapWithAttachments(["https://cdn/slow.json"]));

      expect(await screen.findByText(loadingMessage)).toBeTruthy();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("shows nothing on the stage before the session's first attachment", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(() => new Promise(() => {})) as any;
    try {
      // The replay opens on the lifecycle event, which has no attachment and
      // no earlier one to fall back on. The viewer sees no loading or failure
      // message because this moment of the session never had an attachment.
      renderReplay({
        threads: {
          main: [
            {
              event_type: "lifecycle_activity",
              thread_name: "main",
              type: "created",
              class_name: "sh.measure.demo.MainActivity",
              timestamp: "2026-04-10T10:00:00Z",
            },
            {
              event_type: "gesture_click",
              thread_name: "main",
              target: "android.widget.Button",
              x: 10,
              y: 10,
              timestamp: "2026-04-10T10:00:05Z",
              attachments: [
                {
                  id: "a0",
                  name: "snapshot.json",
                  type: "layout_snapshot_json",
                  key: "k0",
                  location: "https://cdn/slow.json",
                },
              ],
            },
          ],
        },
        traces: [],
      });

      await screen.findByLabelText("Play");
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 400));
      });
      expect(screen.queryByText(loadingMessage)).toBeNull();
      expect(screen.queryByText(failedMessage)).toBeNull();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("never shows a loading message for a quickly fetched attachment", async () => {
    const original = (globalThis as any).fetch;
    // The 50 ms fetch finishes before the stage's 200 ms delay, but leaves
    // enough time to catch a loading message shown immediately.
    (globalThis as any).fetch = jest.fn(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ width: 200, height: 400 }),
              }),
            50,
          ),
        ),
    );
    const restoreFetch = () => {
      (globalThis as any).fetch = original;
    };
    // Observe page changes so the test catches a loading message even if it
    // disappears before the attachment is drawn.
    let everShown = false;
    const observer = new MutationObserver(() => {
      everShown ||=
        document.body.textContent?.includes(loadingMessage) === true;
    });
    try {
      const { container } = renderReplay(
        tapWithAttachments(["https://cdn/quick.json"]),
      );
      observer.observe(container, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      await screen.findByTestId("session-replay-touch-ring");
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 400));
      });
      expect(everShown).toBe(false);
      expect(screen.queryByText(loadingMessage)).toBeNull();
    } finally {
      observer.disconnect();
      restoreFetch();
    }
  });

  it("shows error message on the stage when an attachment cannot be fetched", async () => {
    const restoreFetch = stubFetch();
    try {
      renderReplay(tapWithAttachments(["https://cdn/bad.json"]));

      // A failed fetch is retried once, and the query waits about a second
      // before the retry, which is longer than the one second a findBy allows
      // by default.
      expect(
        await screen.findByText(failedMessage, {}, { timeout: 5000 }),
      ).toBeTruthy();
      expect(screen.queryByText(loadingMessage)).toBeNull();
    } finally {
      restoreFetch();
    }
  });

  it("shows nothing on the stage when the fetch for an attachment is cancelled", async () => {
    const original = (globalThis as any).fetch;
    (globalThis as any).fetch = jest.fn(async () => {
      const aborted = new Error("aborted");
      aborted.name = "AbortError";
      throw aborted;
    });
    try {
      // A fetch is aborted when the viewer leaves the replay and when the
      // window of attachments being held moves past this one, and neither means
      // the attachment could not be fetched.
      renderReplay(tapWithAttachments(["https://cdn/gone.json"]));

      await screen.findByLabelText("Play");
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 400));
      });
      expect(screen.queryByText(failedMessage)).toBeNull();
      expect(screen.queryByText(loadingMessage)).toBeNull();
    } finally {
      (globalThis as any).fetch = original;
    }
  });

  it('shows "Error loading captures" on the stage when a fetched screenshot fails to draw', async () => {
    const originalFetch = (globalThis as any).fetch;
    const originalImage = (globalThis as any).Image;
    (globalThis as any).fetch = jest.fn(async () => {
      throw new Error("a screenshot is fetched by the img that draws it");
    });
    (globalThis as any).Image = class {
      naturalWidth = 200;
      naturalHeight = 400;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_url: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    };
    try {
      // Only the screenshot's size is fetched and kept; the image itself is
      // drawn from its URL every time. The fetch can therefore succeed and the
      // drawing still fail, which is what the error event below stands for.
      const { container } = renderReplay({
        threads: {
          main: [
            {
              event_type: "gesture_click",
              thread_name: "main",
              target: "android.widget.Button",
              x: 10,
              y: 10,
              timestamp: "2026-04-10T10:00:00Z",
              attachments: [
                {
                  id: "a0",
                  name: "shot.webp",
                  type: "screenshot",
                  key: "k0",
                  location: "https://cdn/shot.webp",
                },
              ],
            },
          ],
        },
        traces: [],
      });

      const image = await waitFor(() => {
        const found = container.querySelector(
          'img[src="https://cdn/shot.webp"]',
        );
        expect(found).toBeTruthy();
        return found!;
      });
      expect(screen.queryByText(failedMessage)).toBeNull();

      await act(async () => {
        fireEvent.error(image);
      });
      expect(screen.getByText(failedMessage)).toBeTruthy();
    } finally {
      (globalThis as any).fetch = originalFetch;
      (globalThis as any).Image = originalImage;
    }
  });

  it('keeps "Error loading captures" up when a hidden screenshot fails after the shown one', async () => {
    const originalFetch = (globalThis as any).fetch;
    const originalImage = (globalThis as any).Image;
    (globalThis as any).fetch = jest.fn(async () => {
      throw new Error("a screenshot is fetched by the img that draws it");
    });
    (globalThis as any).Image = class {
      naturalWidth = 200;
      naturalHeight = 400;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_url: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    };
    try {
      // Both screenshots belong to the one tap, so the switcher keeps the
      // second mounted and hidden. Presigned URLs expire together, so the
      // hidden one usually fails right behind the shown one.
      const { container } = renderReplay({
        threads: {
          main: [
            {
              event_type: "gesture_click",
              thread_name: "main",
              target: "android.widget.Button",
              x: 10,
              y: 10,
              timestamp: "2026-04-10T10:00:00Z",
              attachments: [
                {
                  id: "a0",
                  name: "shown.webp",
                  type: "screenshot",
                  key: "k0",
                  location: "https://cdn/shown.webp",
                },
                {
                  id: "a1",
                  name: "hidden.webp",
                  type: "screenshot",
                  key: "k0",
                  location: "https://cdn/hidden.webp",
                },
              ],
            },
          ],
        },
        traces: [],
      });

      const shown = await waitFor(() => {
        const found = container.querySelector(
          'img[src="https://cdn/shown.webp"]',
        );
        expect(found).toBeTruthy();
        return found!;
      });
      const hidden = container.querySelector(
        'img[src="https://cdn/hidden.webp"]',
      )!;
      expect(hidden).toBeTruthy();

      await act(async () => {
        fireEvent.error(shown);
      });
      expect(screen.getByText(failedMessage)).toBeTruthy();

      // The hidden one failing says nothing about what the viewer is looking
      // at, and must not take the message away from the shown one.
      await act(async () => {
        fireEvent.error(hidden);
      });
      expect(screen.getByText(failedMessage)).toBeTruthy();
    } finally {
      (globalThis as any).fetch = originalFetch;
      (globalThis as any).Image = originalImage;
    }
  });

  it("does not fetch or report a failed attachment again when the window moves", async () => {
    (posthog.captureException as jest.Mock).mockClear();
    const original = (globalThis as any).fetch;
    const fetched = jest.fn(async () => ({ ok: false, status: 403 }));
    (globalThis as any).fetch = fetched;
    try {
      // Thirty attachments a second apart, so seeking to the end carries the
      // playhead past a stride and the window is worked out again.
      renderReplay({
        threads: {
          main: Array.from({ length: 30 }, (_, index) => ({
            event_type: "gesture_click",
            thread_name: "main",
            target: "android.widget.Button",
            x: 10,
            y: 10,
            timestamp: new Date(
              Date.parse("2026-04-10T10:00:00Z") + index * 1000,
            ).toISOString(),
            attachments: [
              {
                id: `a${index}`,
                name: "snapshot.json",
                type: "layout_snapshot_json",
                key: `k${index}`,
                location: `https://cdn/a${index}.json`,
              },
            ],
          })),
        },
        traces: [],
      });

      await waitFor(() => expect(reportedAttachmentIds()).toHaveLength(30), {
        timeout: 12_000,
      });
      const askedOnce = fetched.mock.calls.length;

      const slider = screen.getByRole("slider", { name: "Playhead" });
      await act(async () => {
        fireEvent.keyDown(slider, { key: "End" });
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      });

      // A query with no data counts as stale however long it is kept fresh,
      // so without the window's check it would fetch and report all thirty
      // attachments again on this pass. The attachment at the playhead is
      // drawn again and gets one more attempt.
      expect(reportedAttachmentIds().filter((id) => id === "a0")).toEqual([
        "a0",
      ]);
      expect(fetched.mock.calls.length - askedOnce).toBeLessThanOrEqual(
        attemptsPerAttachment,
      );
    } finally {
      (globalThis as any).fetch = original;
    }
  }, 20_000);

  it("hides touch indicators when there is no screen to show", async () => {
    renderReplay(tapWith([]));

    await screen.findByLabelText("Play");
    expect(screen.queryByTestId("session-replay-touch-ring")).toBeNull();
  });

  it("waits for the screen to load before showing a touch indicator", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(() => new Promise(() => {})) as any;
    try {
      renderReplay(tapWithAttachments(["https://cdn/slow.json"]));

      // The playhead opens on the tap, so the slice carries the touch. The
      // gesture's coordinates are read against the screen it was made on, and
      // until that screen arrives there is nothing to place the ring against.
      await screen.findByLabelText("Play");
      expect(screen.queryByTestId("session-replay-touch-ring")).toBeNull();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("shows where the user tapped once the screen loads", async () => {
    const restoreFetch = stubFetch();
    try {
      renderReplay(tapWithAttachments(["https://cdn/good.json"]));

      expect(
        await screen.findByTestId("session-replay-touch-ring"),
      ).toBeTruthy();
    } finally {
      restoreFetch();
    }
  });

  it.each([
    ["a wireframe", "snapshot.svg"],
    ["an image of the layout", "snapshot.webp"],
  ])("shows where the user tapped on %s", async (_label, name) => {
    const originalFetch = global.fetch;
    const originalImage = global.Image;
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => '<svg viewBox="0 0 200 400"></svg>',
    })) as any;
    global.Image = class {
      naturalWidth = 200;
      naturalHeight = 400;
      onload: (() => void) | null = null;
      set src(_url: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    } as any;
    try {
      renderReplay(tapWith([{ type: "layout_snapshot", name }]));

      expect(
        await screen.findByTestId("session-replay-touch-ring"),
      ).toBeTruthy();
    } finally {
      global.fetch = originalFetch;
      global.Image = originalImage;
    }
  });

  it("hides the touch indicator when switching to a screenshot", async () => {
    const restoreFetch = stubFetch();
    const originalImage = global.Image;
    global.Image = class {
      naturalWidth = 200;
      naturalHeight = 400;
      onload: (() => void) | null = null;
      set src(_url: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    } as any;
    try {
      renderReplay(
        tapWith([
          {
            type: "layout_snapshot_json",
            name: "snapshot.json",
            location: "https://cdn/good.json",
          },
          { type: "screenshot", name: "shot.webp" },
        ]),
      );
      await screen.findByTestId("session-replay-touch-ring");
      // Both attachments are loaded, so switching cannot hide the ring merely
      // because the screenshot has no size yet.
      await waitFor(() =>
        expect(
          queries.getQueryState(["session-attachment", "sess-001", "a1"])
            ?.status,
        ).toBe("success"),
      );

      fireEvent.click(screen.getByRole("button", { name: "Attachment 2" }));
      expect(screen.queryByTestId("session-replay-touch-ring")).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Attachment 1" }));
      expect(
        await screen.findByTestId("session-replay-touch-ring"),
      ).toBeTruthy();
    } finally {
      restoreFetch();
      global.Image = originalImage;
    }
  });

  // A screen view that occurs during the tap's hold.
  const tapThenScreenView = {
    threads: {
      main: [
        {
          event_type: "gesture_click",
          thread_name: "main",
          target: "android.widget.Button",
          x: 10,
          y: 10,
          timestamp: "2026-04-10T10:00:00.000Z",
          attachments: [
            {
              id: "a0",
              key: "k0",
              type: "layout_snapshot_json",
              name: "snapshot.json",
              location: "https://cdn/good1.json",
            },
          ],
        },
        {
          event_type: "screen_view",
          thread_name: "main",
          name: "Checkout",
          timestamp: "2026-04-10T10:00:00.120Z",
          attachments: [
            {
              id: "a1",
              key: "k1",
              type: "layout_snapshot_json",
              name: "snapshot.json",
              location: "https://cdn/good2.json",
            },
          ],
        },
      ],
    },
    traces: [],
  };

  it("clears the tap indicator when jumping to another screen", async () => {
    const restoreFetch = stubFetch();
    try {
      renderReplay(tapThenScreenView);
      await screen.findByTestId("session-replay-touch-ring");

      const row = (await screen.findByText("Checkout")).closest("button");
      await act(async () => {
        fireEvent.click(row!);
      });

      await waitFor(() =>
        expect(screen.queryByTestId("session-replay-touch-ring")).toBeNull(),
      );
    } finally {
      restoreFetch();
    }
  });

  it("waits for the selected screen capture before showing the touch indicator", async () => {
    const original = (globalThis as any).fetch;
    (globalThis as any).fetch = jest.fn((url: unknown) =>
      String(url).includes("good")
        ? Promise.resolve({
            ok: true,
            json: async () => ({ width: 200, height: 400 }),
          })
        : new Promise(() => {}),
    );
    try {
      // Both attachments belong to the tap the playhead opens on, and the stage
      // plays the first. The second arriving is no reason to draw it, so the
      // ring has nothing to place itself against.
      renderReplay(
        tapWithAttachments(["https://cdn/slow.json", "https://cdn/good.json"]),
      );

      await screen.findByLabelText("Play");
      expect(screen.queryByTestId("session-replay-touch-ring")).toBeNull();
    } finally {
      (globalThis as any).fetch = original;
    }
  });

  // Six hundred taps, one second apart, each with a screen attachment.
  const sixHundredAttachments = {
    threads: {
      main: Array.from({ length: 600 }, (_, index) => ({
        event_type: "gesture_click",
        thread_name: "main",
        target: "android.widget.Button",
        x: 10,
        y: 10,
        timestamp: new Date(
          Date.parse("2026-04-10T10:00:00Z") + index * 1000,
        ).toISOString(),
        attachments: [
          {
            id: `a${index}`,
            name: "snapshot.json",
            type: "layout_snapshot_json",
            key: `k${index}`,
            location: `https://cdn/a${index}.json`,
          },
        ],
      })),
    },
    traces: [],
  };

  // Each attachment gets one initial fetch and one retry.
  const attemptsPerAttachment = 2;

  const reportedAttachmentIds = (): string[] =>
    (posthog.captureException as jest.Mock).mock.calls.map(
      (call) => call[1].attachment_id,
    );

  const cachedAttachmentIds = (client: QueryClient) =>
    client
      .getQueryCache()
      .getAll()
      .filter((query) => query.state.data !== undefined)
      .map((query) => query.queryKey[2]);

  it("fetches the attachments around the playhead and leaves the rest alone", async () => {
    const original = (globalThis as any).fetch;
    const fetched = jest.fn(async () => ({
      ok: true,
      json: async () => ({ width: 200, height: 400 }),
    }));
    (globalThis as any).fetch = fetched;
    try {
      // The playhead opens on the first attachment, so the window reaches ahead
      // of it and no further.
      renderReplay(sixHundredAttachments);

      await screen.findByTestId("session-replay-touch-ring");
      await waitFor(() =>
        expect(queries.getQueryCache().getAll().length).toBeGreaterThan(100),
      );
      expect(fetched.mock.calls.length).toBeLessThanOrEqual(226);
      expect(queries.getQueryCache().getAll().length).toBeLessThanOrEqual(501);
      expect(cachedAttachmentIds(queries)).toContain("a0");
      expect(cachedAttachmentIds(queries)).not.toContain("a599");
    } finally {
      (globalThis as any).fetch = original;
    }
  });

  it("drops the attachments it holds when the viewer leaves the replay", async () => {
    const original = (globalThis as any).fetch;
    (globalThis as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ width: 200, height: 400 }),
    }));
    try {
      const { unmount } = renderReplay(
        tapWithAttachments(["https://cdn/good.json"]),
      );
      await screen.findByTestId("session-replay-touch-ring");
      expect(cachedAttachmentIds(queries)).toContain("a0");

      unmount();

      expect(
        queries
          .getQueryCache()
          .getAll()
          .filter((query) => query.queryKey[0] === "session-attachment"),
      ).toHaveLength(0);
    } finally {
      (globalThis as any).fetch = original;
    }
  });

  it("moves the window to where the playhead lands, dropping what it left", async () => {
    const original = (globalThis as any).fetch;
    (globalThis as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ width: 200, height: 400 }),
    }));
    try {
      renderReplay(sixHundredAttachments);
      await screen.findByTestId("session-replay-touch-ring");
      await waitFor(() =>
        expect(cachedAttachmentIds(queries)).toContain("a100"),
      );

      const slider = screen.getByRole("slider", { name: "Playhead" });
      await act(async () => {
        fireEvent.keyDown(slider, { key: "End" });
      });

      // The attachments around the end are pulled in and the ones the window
      // left behind are dropped, so the store stays the same size.
      await waitFor(
        () => expect(cachedAttachmentIds(queries)).toContain("a599"),
        {
          timeout: 3000,
        },
      );
      expect(cachedAttachmentIds(queries)).not.toContain("a0");
      expect(queries.getQueryCache().getAll().length).toBeLessThanOrEqual(501);
    } finally {
      (globalThis as any).fetch = original;
    }
  });

  it("shows screenshots without touch indicators", async () => {
    const originalFetch = (globalThis as any).fetch;
    const originalImage = (globalThis as any).Image;
    const fetched = jest.fn(async () => {
      throw new Error("a screenshot is fetched by the img that draws it");
    });
    (globalThis as any).fetch = fetched;
    // jsdom loads no images, so this stands in for one that decodes at a
    // known size.
    (globalThis as any).Image = class {
      naturalWidth = 200;
      naturalHeight = 400;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_url: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    };
    try {
      const { container } = renderReplay({
        threads: {
          main: [
            {
              event_type: "gesture_click",
              thread_name: "main",
              target: "android.widget.Button",
              x: 10,
              y: 10,
              timestamp: "2026-04-10T10:00:00Z",
              attachments: [
                {
                  id: "a0",
                  name: "shot.webp",
                  type: "screenshot",
                  key: "k0",
                  location: "https://cdn/shot.webp",
                },
              ],
            },
          ],
        },
        traces: [],
      });

      await waitFor(() =>
        expect(
          container.querySelector('img[src="https://cdn/shot.webp"]'),
        ).toBeTruthy(),
      );
      expect(screen.queryByTestId("session-replay-touch-ring")).toBeNull();
      expect(fetched).not.toHaveBeenCalled();
      expect(
        (queries.getQueryData(["session-attachment", "sess-001", "a0"]) as any)
          .content,
      ).toEqual({ kind: "image" });
    } finally {
      (globalThis as any).fetch = originalFetch;
      (globalThis as any).Image = originalImage;
    }
  });

  it("draws the session's wireframe markup with the accent color", async () => {
    const original = (globalThis as any).fetch;
    (globalThis as any).fetch = jest.fn(async () => ({
      ok: true,
      text: async () =>
        '<svg viewBox="0 0 300 600"><rect stroke="#fef08a"/></svg>',
    }));
    try {
      const { container } = renderReplay(
        tapWith([{ type: "layout_snapshot", name: "snapshot.svg" }]),
      );

      const drawn = await waitFor(() => {
        const img = container.querySelector<HTMLImageElement>(
          'img[src^="data:image/svg"]',
        );
        expect(img).toBeTruthy();
        return img!;
      });
      const markup = decodeURIComponent(drawn.src.split(",")[1]);
      expect(markup).toContain('viewBox="0 0 300 600"');
      expect(markup).not.toContain("#fef08a");
    } finally {
      (globalThis as any).fetch = original;
    }
  });

  it.each([
    [
      "a signature the store has stopped accepting",
      { ok: false, status: 403 },
      { type: "layout_snapshot_json", name: "snapshot.json" },
    ],
    [
      "a layout snapshot that is not a tree",
      { ok: true, json: async () => ({ nope: true }) },
      { type: "layout_snapshot_json", name: "snapshot.json" },
    ],
    [
      "a wireframe with no viewBox to size it by",
      { ok: true, text: async () => "<svg><rect/></svg>" },
      { type: "layout_snapshot", name: "snapshot.svg" },
    ],
  ])("leaves the stage empty for %s", async (_case, response, attachment) => {
    (posthog.captureException as jest.Mock).mockClear();
    const original = (globalThis as any).fetch;
    (globalThis as any).fetch = jest.fn(async () => response);
    try {
      const { container } = renderReplay(tapWith([attachment]));

      await waitFor(
        () =>
          expect(posthog.captureException).toHaveBeenCalledWith(
            new Error("session replay failed to load an attachment"),
            expect.objectContaining({ attachment_id: "a0" }),
          ),
        { timeout: 3000 },
      );
      expect(container.querySelector("img")).toBeNull();
      // The session did list a screen, so the empty-session message stays away
      // even though the download failed.
      expect(screen.queryByText("No captures in this session")).toBeNull();
    } finally {
      (globalThis as any).fetch = original;
    }
  });

  it.each([
    ["did not load", "onerror"],
    ["decoded to nothing", "onload"],
  ])(
    "leaves the stage empty for a screenshot that %s",
    async (_case, event) => {
      (posthog.captureException as jest.Mock).mockClear();
      const originalImage = (globalThis as any).Image;
      (globalThis as any).Image = class {
        naturalWidth = 0;
        naturalHeight = 0;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_url: string) {
          setTimeout(() => (this as any)[event]?.(), 0);
        }
      };
      try {
        renderReplay(tapWith([{ type: "screenshot", name: "shot.webp" }]));

        await waitFor(
          () =>
            expect(posthog.captureException).toHaveBeenCalledWith(
              new Error("session replay failed to load an attachment"),
              { attachment_id: "a0", attachment_format: "raster" },
            ),
          { timeout: 3000 },
        );
      } finally {
        (globalThis as any).Image = originalImage;
      }
    },
  );

  it("records a screenshot the browser could not draw", async () => {
    (posthog.captureException as jest.Mock).mockClear();
    const originalImage = (globalThis as any).Image;
    (globalThis as any).Image = class {
      naturalWidth = 720;
      naturalHeight = 1280;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_url: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    };
    try {
      const { container } = renderReplay(
        tapWith([{ type: "screenshot", name: "shot.webp" }]),
      );

      // The screenshot measured, so its query holds the size and the stage
      // draws it. The browser then fails to fetch the pixels for the img.
      const img = await waitFor(() => {
        const drawn = container.querySelector("img");
        expect(drawn).toBeTruthy();
        return drawn!;
      });
      fireEvent.error(img);

      expect(posthog.captureException).toHaveBeenCalledWith(
        new Error("session replay failed to load an attachment"),
        { attachment_id: "a0", attachment_format: "raster" },
      );
    } finally {
      (globalThis as any).Image = originalImage;
    }
  });

  it("reports a failed attachment only once when the window and stage request it", async () => {
    (posthog.captureException as jest.Mock).mockClear();
    const original = (globalThis as any).fetch;
    (globalThis as any).fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
    }));
    try {
      // The playhead opens on this attachment, so the window prefetches it and
      // the stage subscribes to the same query.
      renderReplay(tapWith([{ type: "layout_snapshot_json", name: "a.json" }]));

      await waitFor(() => expect(posthog.captureException).toHaveBeenCalled(), {
        timeout: 3000,
      });
      expect(posthog.captureException).toHaveBeenCalledTimes(1);
      expect(posthog.captureException).toHaveBeenCalledWith(
        new Error("session replay failed to load an attachment"),
        { attachment_id: "a0", attachment_format: "layout" },
      );
    } finally {
      (globalThis as any).fetch = original;
    }
  });

  it("plays on through a partial attachment failure and records it", async () => {
    (posthog.captureException as jest.Mock).mockClear();
    const restoreFetch = stubFetch();
    try {
      renderReplay(
        tapWithAttachments(["https://cdn/good.json", "https://cdn/bad.json"]),
      );

      await screen.findByLabelText("Restart");
      // The screen that did arrive plays, and the one that did not is reported.
      expect(screen.queryByText("No captures in this session")).toBeNull();
      // The failure is reported once the attachment's one retry is spent.
      await waitFor(
        () =>
          expect(posthog.captureException).toHaveBeenCalledWith(
            new Error("session replay failed to load an attachment"),
            { attachment_id: "a1", attachment_format: "layout" },
          ),
        { timeout: 3000 },
      );
      expect(posthog.captureException).toHaveBeenCalledTimes(1);
    } finally {
      restoreFetch();
    }
  });

  it("plays the session through when no attachment can be fetched", async () => {
    (posthog.captureException as jest.Mock).mockClear();
    const restoreFetch = stubFetch();
    try {
      renderReplay(tapWithAttachments(["https://cdn/bad.json"]));

      // Playback still reaches the end, and the attachment the session listed
      // is reported as a failure rather than passed off as a session that had
      // no attachments at all.
      await screen.findByLabelText("Restart");
      expect(screen.queryByText("No captures in this session")).toBeNull();
      await waitFor(
        () =>
          expect(posthog.captureException).toHaveBeenCalledWith(
            new Error("session replay failed to load an attachment"),
            { attachment_id: "a0", attachment_format: "layout" },
          ),
        { timeout: 3000 },
      );
    } finally {
      restoreFetch();
    }
  });

  it("does not record a failure when a load is cancelled by leaving the page", async () => {
    (posthog.captureException as jest.Mock).mockClear();
    const originalFetch = global.fetch;
    global.fetch = jest.fn(
      (_url: string, options: { signal?: AbortSignal }) =>
        new Promise((_, reject) => {
          options.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    ) as any;
    try {
      const { unmount } = renderReplay(
        tapWithAttachments(["https://cdn/slow.json"]),
      );
      await screen.findByLabelText("Play");
      unmount();
      await act(async () => {
        await Promise.resolve();
      });
      expect(posthog.captureException).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("shows the hover label for the element under the cursor", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        width: 200,
        height: 400,
        type: "Button",
        label: "btn_pay",
      }),
    })) as any;
    try {
      renderReplay(tapWithAttachments(["https://cdn/tree.json"]));
      await screen.findByLabelText("Restart");
      const node = await waitFor(() => {
        const el = document.querySelector<HTMLElement>("[data-label]");
        if (!el) {
          throw new Error("layout nodes not rendered yet");
        }
        return el;
      });
      const move = new Event("pointermove", { bubbles: true }) as any;
      move.clientX = 50;
      move.clientY = 50;
      move.buttons = 0;
      node.dispatchEvent(move);
      await act(async () => {
        await new Promise((resolve) =>
          requestAnimationFrame(() => resolve(null)),
        );
      });
      expect(screen.getByText("btn_pay (Button)")).toBeTruthy();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("renders a session with no metrics, traces or events", async () => {
    renderReplay({
      cpu_usage: [],
      memory_usage: [],
      memory_usage_absolute: [],
      threads: {},
      traces: [],
    });

    await waitFor(() => {
      expect(screen.getByText(/User ID:/)).toBeTruthy();
    });
  });
});
