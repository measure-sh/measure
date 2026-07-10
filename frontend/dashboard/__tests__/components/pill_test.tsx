import { describe, expect, it, jest } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

import Pill, { PillType } from "@/app/components/pill";

function findBadge(text: string): HTMLElement | null {
  for (const el of screen.queryAllByText(text)) {
    const badge = el.closest('[data-slot="badge"]') as HTMLElement | null;
    if (badge) {
      return badge;
    }
  }
  return null;
}

describe("Pill", () => {
  describe("typed pills (default labels + tint)", () => {
    it("renders 'Error' label with sky tint for PillType.Error", () => {
      render(<Pill type={PillType.Error} />);
      const badge = findBadge("Error");
      expect(badge).not.toBeNull();
      expect(badge!.className).toMatch(/border-sky-400/);
      expect(badge!.className).toMatch(/text-sky-700/);
    });

    it("renders 'ANR' label with violet tint for PillType.Anr", () => {
      render(<Pill type={PillType.Anr} />);
      const badge = findBadge("ANR");
      expect(badge).not.toBeNull();
      expect(badge!.className).toMatch(/border-violet-400/);
    });

    it("renders 'Fatal' label with red tint for PillType.Fatal", () => {
      render(<Pill type={PillType.Fatal} />);
      const badge = findBadge("Fatal");
      expect(badge!.className).toMatch(/border-red-400/);
    });

    it("renders 'Unhandled' label with amber tint for PillType.Unhandled", () => {
      render(<Pill type={PillType.Unhandled} />);
      const badge = findBadge("Unhandled");
      expect(badge!.className).toMatch(/border-amber-400/);
    });

    it("renders 'Handled' label with yellow tint for PillType.Handled", () => {
      render(<Pill type={PillType.Handled} />);
      const badge = findBadge("Handled");
      expect(badge!.className).toMatch(/border-yellow-400/);
    });

    it("renders 'Open' label with green tint for PillType.OpenStatus", () => {
      render(<Pill type={PillType.OpenStatus} />);
      const badge = findBadge("Open");
      expect(badge!.className).toMatch(/border-green-400/);
    });

    it("renders 'Closed' label with indigo tint for PillType.ClosedStatus", () => {
      render(<Pill type={PillType.ClosedStatus} />);
      const badge = findBadge("Closed");
      expect(badge!.className).toMatch(/border-indigo-400/);
    });

    it("defaults to neutral type (no tint, outline variant)", () => {
      render(<Pill>tag</Pill>);
      const badge = findBadge("tag");
      expect(badge!.className).not.toMatch(
        /border-(red|sky|violet|amber|emerald|green|indigo)/,
      );
    });
  });

  describe("session event pills (per-event types)", () => {
    // Exhaustive over every SessionEvent* type that carries a default label:
    // label, colour-family tint, and the rounded-sm shape that distinguishes
    // these from the pill-shaped filter/status chips.
    const sessionCases: Array<[PillType, string, RegExp]> = [
      [PillType.SessionEventFatalError, "Fatal Error", /border-red-400/],
      [
        PillType.SessionEventUnhandledError,
        "Unhandled Error",
        /border-amber-400/,
      ],
      [PillType.SessionEventHandledError, "Handled Error", /border-yellow-400/],
      [PillType.SessionEventError, "Error", /border-red-400/],
      [PillType.SessionEventAnr, "ANR", /border-red-400/],
      [PillType.SessionEventBugReport, "Bug Report", /border-red-400/],
      [PillType.SessionEventGestureClick, "Click", /border-emerald-400/],
      [
        PillType.SessionEventGestureLongClick,
        "Long Click",
        /border-emerald-400/,
      ],
      [PillType.SessionEventGestureScroll, "Scroll", /border-emerald-400/],
      [PillType.SessionEventHttp, "HTTP", /border-cyan-400/],
      [PillType.SessionEventLifecycleActivity, "Activity", /border-indigo-400/],
      [PillType.SessionEventLifecycleFragment, "Fragment", /border-indigo-400/],
      [
        PillType.SessionEventLifecycleViewController,
        "View Controller",
        /border-indigo-400/,
      ],
      [PillType.SessionEventLifecycleSwiftUI, "SwiftUI", /border-indigo-400/],
      [PillType.SessionEventLifecycleApp, "App", /border-indigo-400/],
      [PillType.SessionEventAppExit, "App Exit", /border-indigo-400/],
      [PillType.SessionEventNavigation, "Navigation", /border-fuchsia-400/],
      [PillType.SessionEventScreenView, "Screen View", /border-fuchsia-400/],
      [PillType.SessionEventColdLaunch, "Cold Launch", /border-indigo-400/],
      [PillType.SessionEventWarmLaunch, "Warm Launch", /border-indigo-400/],
      [PillType.SessionEventHotLaunch, "Hot Launch", /border-indigo-400/],
      [PillType.SessionEventLowMemory, "Low Memory", /border-indigo-400/],
      [PillType.SessionEventTrimMemory, "Trim Memory", /border-indigo-400/],
      [PillType.SessionEventTrace, "Trace", /border-pink-400/],
      [PillType.SessionEventCustom, "Custom", /border-purple-400/],
      [PillType.SessionEventLog, "Log", /border-indigo-400/],
    ];

    it.each(sessionCases)(
      "renders %s with its default label and tint",
      (type, label, tintPattern) => {
        render(<Pill type={type} />);
        const badge = findBadge(label);
        expect(badge).not.toBeNull();
        expect(badge!.className).toMatch(tintPattern);
        expect(badge!.className).toMatch(/rounded-sm/);
      },
    );

    const logSeverityCases: Array<[PillType, RegExp]> = [
      [PillType.SessionEventLogDebug, /border-teal-400/],
      [PillType.SessionEventLogInfo, /border-indigo-400/],
      [PillType.SessionEventLogWarning, /border-amber-400/],
      [PillType.SessionEventLogError, /border-red-400/],
      [PillType.SessionEventLogFatal, /border-red-400/],
    ];

    it.each(logSeverityCases)(
      "tints the log severity pill %s from its type",
      (type, tintPattern) => {
        render(<Pill type={type}>Log X</Pill>);
        const badge = findBadge("Log X");
        expect(badge).not.toBeNull();
        expect(badge!.className).toMatch(tintPattern);
        expect(badge!.className).toMatch(/rounded-sm/);
      },
    );

    it("renders SessionEventDefault from children with indigo tint", () => {
      render(<Pill type={PillType.SessionEventDefault}>weird_event</Pill>);
      const badge = findBadge("weird_event");
      expect(badge).not.toBeNull();
      expect(badge!.className).toMatch(/border-indigo-400/);
      expect(badge!.className).toMatch(/rounded-sm/);
    });

    it("renders null for SessionEventDefault with no children", () => {
      const { container } = render(
        <Pill type={PillType.SessionEventDefault} />,
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe("children override default label", () => {
    it("uses children over the typed default label", () => {
      render(<Pill type={PillType.Error}>Custom</Pill>);
      expect(findBadge("Custom")).not.toBeNull();
      expect(findBadge("Error")).toBeNull();
    });

    it("renders null when neither children nor a typed default label exist", () => {
      const { container } = render(<Pill />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("tooltip", () => {
    // No tooltip: the badge renders as a plain Badge with data-slot="badge".
    // With tooltip enabled, Radix wraps it and overrides data-slot via Slot.
    it("renders the badge as a plain Badge when tooltip is omitted", () => {
      render(<Pill>just a chip</Pill>);
      const badge = findBadge("just a chip");
      expect(badge).not.toBeNull();
    });

    it("wraps the badge in a Radix tooltip trigger when tooltip prop is true", () => {
      const { container } = render(<Pill tooltip>Device: Pixel 8</Pill>);
      // Radix overlays data-slot="tooltip-trigger" on the asChild target.
      expect(
        container.querySelector('[data-slot="tooltip-trigger"]'),
      ).not.toBeNull();
    });

    it("wraps the badge in a Radix tooltip trigger when tooltip is a string", () => {
      const { container } = render(<Pill tooltip="full text">truncated</Pill>);
      expect(
        container.querySelector('[data-slot="tooltip-trigger"]'),
      ).not.toBeNull();
    });
  });

  describe("interactive body (onClick)", () => {
    it("renders the body as a button when onClick is provided", () => {
      const onClick = jest.fn();
      render(<Pill onClick={onClick}>open me</Pill>);
      const button = screen.getByRole("button", { name: "open me" });
      fireEvent.click(button);
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("action button (two-zone)", () => {
    it("renders a clear button with X icon when action.icon is 'clear'", () => {
      const onClick = jest.fn();
      const action = { icon: "clear" as const, onClick: jest.fn() };
      render(
        <Pill onClick={onClick} action={action}>
          Country: US
        </Pill>,
      );
      const clearBtn = screen.getByLabelText(/Clear Country/);
      fireEvent.click(clearBtn);
      expect(action.onClick).toHaveBeenCalledTimes(1);
      // Body click stays separate.
      expect(onClick).not.toHaveBeenCalled();
    });

    it("renders a reset button with RotateCcw icon when action.icon is 'reset'", () => {
      const action = { icon: "reset" as const, onClick: jest.fn() };
      render(<Pill action={action}>App versions: 1.0</Pill>);
      const resetBtn = screen.getByLabelText(/Reset App versions/);
      fireEvent.click(resetBtn);
      expect(action.onClick).toHaveBeenCalledTimes(1);
    });

    it("applies the typed tint to the outer shell of the action variant too", () => {
      const action = { icon: "reset" as const, onClick: jest.fn() };
      const { container } = render(
        <Pill type={PillType.Error} action={action}>
          Errors
        </Pill>,
      );
      const outer = container.querySelector("span");
      expect(outer!.className).toMatch(/border-sky-400/);
    });
  });
});
