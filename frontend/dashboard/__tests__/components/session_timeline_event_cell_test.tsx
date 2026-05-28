import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("@/app/utils/time_utils", () => ({
  formatDateToHumanReadableDateTime: (ts: string) => `formatted:${ts}`,
  formatMillisToHumanReadable: (n: number) => `${n}ms`,
}));

jest.mock("@/app/utils/string_utils", () => ({
  formatToCamelCase: (s: string) => s.charAt(0).toUpperCase() + s.slice(1),
}));

// Avoid pulling in the heavy details renderer; the cell collapses inline
// details rendering to this component, which we only check by presence.
jest.mock("@/app/components/session_timeline_event_details", () => ({
  __esModule: true,
  default: () => <div data-testid="event-details" />,
}));

import SessionTimelineEventCell from "@/app/components/session_timeline_event_cell";

type CellOverrides = Partial<{
  teamId: string;
  appId: string;
  demo: boolean;
  eventType: string;
  eventDetails: any;
  threadName: string;
  timestamp: string;
  expanded: boolean;
  onToggle: () => void;
}>;

function renderCell(overrides: CellOverrides = {}) {
  const props = {
    teamId: "team-1",
    appId: "app-1",
    demo: false,
    eventType: "custom",
    eventDetails: { name: "Test Event" },
    threadName: "main",
    timestamp: "2024-01-01T00:00:00Z",
    expanded: false,
    onToggle: jest.fn(),
    ...overrides,
  };
  return { ...render(<SessionTimelineEventCell {...props} />), props };
}

describe("SessionTimelineEventCell", () => {
  describe("Click handling", () => {
    it("calls onToggle when clicked", () => {
      const onToggle = jest.fn();
      renderCell({ onToggle });
      fireEvent.click(screen.getByRole("button"));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe("Expansion", () => {
    it("does not render details when collapsed", () => {
      renderCell({ expanded: false });
      expect(screen.queryByTestId("event-details")).not.toBeInTheDocument();
    });

    it("renders details when expanded", () => {
      renderCell({ expanded: true });
      expect(screen.getByTestId("event-details")).toBeInTheDocument();
    });
  });

  describe("Thread and timestamp display", () => {
    it("displays thread name", () => {
      renderCell({ threadName: "worker-1" });
      expect(screen.getByText("worker-1")).toBeInTheDocument();
    });

    it("displays formatted timestamp", () => {
      renderCell({ timestamp: "2024-01-01T00:00:00Z" });
      expect(
        screen.getByText("formatted:2024-01-01T00:00:00Z"),
      ).toBeInTheDocument();
    });
  });

  describe("Pill label", () => {
    it.each([
      ["error", { type: "NPE", severity: "fatal" }, "Fatal Error"],
      ["error", { type: "NPE", severity: "unhandled" }, "Unhandled Error"],
      ["error", { type: "NPE", severity: "handled" }, "Handled Error"],
      ["error", { type: "NPE" }, "Error"],
      ["anr", { type: "SomeAnrType" }, "ANR"],
      ["bug_report", { description: "Bug" }, "Bug Report"],
      ["gesture_click", { target: "Button" }, "Click"],
      ["gesture_long_click", { target: "View" }, "Long Click"],
      ["gesture_scroll", { target: "List" }, "Scroll"],
      ["navigation", { to: "/home" }, "Navigation"],
      ["screen_view", { name: "Home" }, "Screen View"],
      ["http", { method: "get", status_code: 200, url: "/api" }, "HTTP"],
      ["trace", { trace_name: "checkout" }, "Trace"],
      ["custom", { name: "event" }, "Custom"],
      ["cold_launch", {}, "Cold Launch"],
      ["warm_launch", {}, "Warm Launch"],
      ["hot_launch", {}, "Hot Launch"],
      ["low_memory", {}, "Low Memory"],
      ["trim_memory", {}, "Trim Memory"],
      ["app_exit", { reason: "USER_REQUEST" }, "App Exit"],
      ["lifecycle_app", { type: "foreground" }, "App"],
      [
        "lifecycle_activity",
        { class_name: "MainActivity", type: "created" },
        "Activity",
      ],
      [
        "lifecycle_fragment",
        { class_name: "HomeFragment", type: "resumed" },
        "Fragment",
      ],
      [
        "lifecycle_view_controller",
        { class_name: "HomeVC", type: "viewDidLoad" },
        "View Controller",
      ],
      [
        "lifecycle_swift_ui",
        { class_name: "ContentView", type: "onAppear" },
        "SwiftUI",
      ],
    ])("shows %s pill label", (eventType, eventDetails, expectedLabel) => {
      renderCell({ eventType, eventDetails });
      expect(screen.getByText(expectedLabel)).toBeInTheDocument();
    });
  });

  describe("Pill colour", () => {
    // The pill carries the colour now (not a dot). We assert one Tailwind
    // class per bucket as a smoke test that the colour helper still maps.
    it.each([
      ["error", { type: "NPE", severity: "fatal" }, "bg-red-100"],
      ["error", { type: "NPE", severity: "unhandled" }, "bg-amber-100"],
      ["error", { type: "NPE", severity: "handled" }, "bg-yellow-100"],
      ["anr", { type: "ANR" }, "bg-red-100"],
      ["bug_report", { description: "Bug" }, "bg-red-100"],
      ["gesture_click", { target: "Button" }, "bg-emerald-100"],
      ["navigation", { to: "/home" }, "bg-fuchsia-100"],
      ["http", { method: "get", status_code: 200, url: "/api" }, "bg-cyan-100"],
      ["trace", { trace_name: "checkout" }, "bg-pink-100"],
      ["custom", { name: "event" }, "bg-purple-100"],
      ["cold_launch", {}, "bg-indigo-100"],
    ])("applies %s pill bg", (eventType, eventDetails, expectedClass) => {
      const { container } = renderCell({ eventType, eventDetails });
      const pill = container.querySelector(`.${expectedClass}`);
      expect(pill).not.toBeNull();
    });
  });

  describe("Title content", () => {
    it("shows type and message for errors", () => {
      renderCell({
        eventType: "error",
        eventDetails: {
          type: "NullPointerException",
          message: "object is null",
          severity: "fatal",
        },
      });
      expect(
        screen.getByText("NullPointerException: object is null"),
      ).toBeInTheDocument();
    });

    it("shows type alone when message is empty", () => {
      renderCell({
        eventType: "error",
        eventDetails: {
          type: "NullPointerException",
          message: "",
          severity: "fatal",
        },
      });
      expect(screen.getByText("NullPointerException")).toBeInTheDocument();
    });

    it("shows bug report description as title", () => {
      renderCell({
        eventType: "bug_report",
        eventDetails: { description: "Login broken", bug_report_id: "br-1" },
      });
      expect(screen.getByText("Login broken")).toBeInTheDocument();
    });

    it("falls back to bug report id when no description", () => {
      renderCell({
        eventType: "bug_report",
        eventDetails: { description: "", bug_report_id: "br-1" },
      });
      expect(screen.getByText("br-1")).toBeInTheDocument();
    });

    it("shows short class name as gesture target", () => {
      renderCell({
        eventType: "gesture_click",
        eventDetails: { target: "com.example.views.LoginButton" },
      });
      expect(screen.getByText("LoginButton")).toBeInTheDocument();
    });

    it("shows simple target as-is", () => {
      renderCell({
        eventType: "gesture_click",
        eventDetails: { target: "LoginButton" },
      });
      expect(screen.getByText("LoginButton")).toBeInTheDocument();
    });

    it("shows HTTP method, status and URL as title", () => {
      renderCell({
        eventType: "http",
        eventDetails: {
          method: "get",
          status_code: 200,
          url: "https://api.example.com/users",
        },
      });
      expect(
        screen.getByText("GET 200 https://api.example.com/users"),
      ).toBeInTheDocument();
    });

    it("shows activity title with lifecycle type and short class name", () => {
      renderCell({
        eventType: "lifecycle_activity",
        eventDetails: {
          class_name: "com.example.MainActivity",
          type: "created",
        },
      });
      expect(screen.getByText("Created: MainActivity")).toBeInTheDocument();
    });

    it("shows fragment title", () => {
      renderCell({
        eventType: "lifecycle_fragment",
        eventDetails: {
          class_name: "com.example.HomeFragment",
          type: "resumed",
        },
      });
      expect(screen.getByText("Resumed: HomeFragment")).toBeInTheDocument();
    });

    it("shows view controller title", () => {
      renderCell({
        eventType: "lifecycle_view_controller",
        eventDetails: { class_name: "HomeViewController", type: "viewDidLoad" },
      });
      expect(
        screen.getByText("HomeViewController: viewDidLoad"),
      ).toBeInTheDocument();
    });

    it("shows app lifecycle action as title", () => {
      renderCell({
        eventType: "lifecycle_app",
        eventDetails: { type: "background" },
      });
      expect(screen.getByText("Background")).toBeInTheDocument();
    });

    it("shows app exit reason as title", () => {
      renderCell({
        eventType: "app_exit",
        eventDetails: { reason: "USER_REQUEST" },
      });
      expect(screen.getByText("USER_REQUEST")).toBeInTheDocument();
    });

    it("shows navigation destination as title", () => {
      renderCell({
        eventType: "navigation",
        eventDetails: { to: "/settings" },
      });
      expect(screen.getByText("/settings")).toBeInTheDocument();
    });

    it("shows screen view name as title", () => {
      renderCell({
        eventType: "screen_view",
        eventDetails: { name: "SettingsScreen" },
      });
      expect(screen.getByText("SettingsScreen")).toBeInTheDocument();
    });

    it("shows trace name as title", () => {
      renderCell({
        eventType: "trace",
        eventDetails: { trace_name: "checkout_flow" },
      });
      expect(screen.getByText("checkout_flow")).toBeInTheDocument();
    });

    it("shows custom event name as title", () => {
      renderCell({
        eventType: "custom",
        eventDetails: { name: "purchase_completed" },
      });
      expect(screen.getByText("purchase_completed")).toBeInTheDocument();
    });
  });
});
