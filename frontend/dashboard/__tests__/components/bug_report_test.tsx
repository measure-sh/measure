/**
 * Unit tests for the BugReport detail component.
 *
 * The component fetches a single bug report, renders its status badge,
 * context pills, description, session replay link and attachment images,
 * and offers a status toggle button gated by team permissions. The query
 * and mutation hooks are mocked here, so these tests cover rendering and
 * button state only; request wiring is covered by the MSW integration
 * tests.
 */
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

// --- Mocks ---

const mockUseBugReportQuery = jest.fn();
const mockUseAuthzAndMembersQuery = jest.fn();
const mockMutateAsync = jest.fn();
let mockMutationPending = false;

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useBugReportQuery: (...args: any[]) => mockUseBugReportQuery(...args),
  useAuthzAndMembersQuery: (...args: any[]) =>
    mockUseAuthzAndMembersQuery(...args),
  useToggleBugReportStatusMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockMutationPending,
  }),
}));

jest.mock("@/app/components/toast", () => ({
  __esModule: true,
  toastPositive: jest.fn(),
  toastNegative: jest.fn(),
}));

jest.mock("@/app/utils/time_utils", () => ({
  __esModule: true,
  formatDateToHumanReadableDateTime: jest.fn(() => "10 Apr, 2026, 2:30:00 PM"),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// next/image is replaced with a plain img. The unoptimized prop is dropped
// because it is not a valid img attribute and React warns when a boolean
// is spread onto one.
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ unoptimized, ...props }: any) => <img {...props} />,
}));

// --- Import ---

import { makeBugReportDetailFixture } from "@/__tests__/msw/fixtures";
import BugReport from "@/app/components/bug_report";

// --- Helpers ---

const defaultParams = {
  teamId: "test-team",
  appId: "app-br-1",
  bugReportId: "evt-br-001",
};

function setBugReport(overrides: Record<string, any> = {}) {
  mockUseBugReportQuery.mockReturnValue({
    data: makeBugReportDetailFixture(overrides),
    isSuccess: true,
    isError: false,
  });
}

function renderBugReport() {
  return render(<BugReport params={defaultParams} />);
}

// ============================================================
// Tests
// ============================================================

describe("BugReport", () => {
  beforeEach(() => {
    mockMutationPending = false;
    setBugReport();
    mockUseAuthzAndMembersQuery.mockReturnValue({
      data: { can_update_bug_reports: true },
    });
  });

  describe("loading and description", () => {
    it("shows skeleton placeholders while the query is loading", () => {
      mockUseBugReportQuery.mockReturnValue({
        data: undefined,
        isSuccess: false,
        isError: false,
      });
      renderBugReport();
      expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy();
      expect(
        screen.queryByText("App crashes when tapping checkout button"),
      ).not.toBeInTheDocument();
    });

    it("renders the description", () => {
      renderBugReport();
      expect(
        screen.getByText("App crashes when tapping checkout button"),
      ).toBeInTheDocument();
    });

    it("renders a long description without truncation", () => {
      const longDesc = "A".repeat(500);
      setBugReport({ description: longDesc });
      renderBugReport();
      expect(screen.getByText(longDesc)).toBeInTheDocument();
    });
  });

  describe("status badge", () => {
    it("renders Open badge for status 0", () => {
      renderBugReport();
      expect(screen.getByText("Open")).toBeInTheDocument();
    });

    it("renders Closed badge for status 1", () => {
      setBugReport({ status: 1 });
      renderBugReport();
      expect(screen.getByText("Closed")).toBeInTheDocument();
    });
  });

  describe("pills", () => {
    it("renders user ID pill", () => {
      renderBugReport();
      expect(screen.getByText("User ID: user-br-123")).toBeInTheDocument();
    });

    it("renders User ID: N/A when user_id is empty", () => {
      setBugReport({
        attribute: { ...makeBugReportDetailFixture().attribute, user_id: "" },
      });
      renderBugReport();
      expect(screen.getByText("User ID: N/A")).toBeInTheDocument();
    });

    it("renders time pill with the formatted timestamp", () => {
      renderBugReport();
      expect(
        screen.getByText("Time: 10 Apr, 2026, 2:30:00 PM"),
      ).toBeInTheDocument();
    });

    it("renders device pill", () => {
      renderBugReport();
      expect(screen.getByText("Device: GooglePixel 8")).toBeInTheDocument();
    });

    it("renders app version pill", () => {
      renderBugReport();
      expect(screen.getByText("App version: 3.1.0 (310)")).toBeInTheDocument();
    });

    it("renders network type pill", () => {
      renderBugReport();
      expect(screen.getByText("Network type: wifi")).toBeInTheDocument();
    });

    it("renders user_defined_attribute pills", () => {
      renderBugReport();
      expect(screen.getByText("premium: true")).toBeInTheDocument();
      expect(screen.getByText("plan: pro")).toBeInTheDocument();
    });

    it("does not render user_defined_attribute pills when null", () => {
      setBugReport({ user_defined_attribute: null });
      renderBugReport();
      expect(screen.queryByText("premium: true")).not.toBeInTheDocument();
    });
  });

  describe("session replay link", () => {
    it("links to the session replay for the report's session", () => {
      renderBugReport();
      const link = screen.getByText("View Session Replay");
      expect(link.closest("a")).toHaveAttribute(
        "href",
        "/test-team/session_replays/app-br-1/sess-br-001",
      );
    });
  });

  describe("status toggle button", () => {
    it("shows Close Bug Report for an open report", () => {
      renderBugReport();
      expect(screen.getByText("Close Bug Report")).toBeInTheDocument();
    });

    it("shows Re-Open Bug Report for a closed report", () => {
      setBugReport({ status: 1 });
      renderBugReport();
      expect(screen.getByText("Re-Open Bug Report")).toBeInTheDocument();
    });

    it("is enabled when the user can update bug reports", () => {
      renderBugReport();
      expect(
        screen.getByText("Close Bug Report").closest("button"),
      ).toBeEnabled();
    });

    it("is disabled when the user cannot update bug reports", () => {
      mockUseAuthzAndMembersQuery.mockReturnValue({
        data: { can_update_bug_reports: false },
      });
      renderBugReport();
      expect(
        screen.getByText("Close Bug Report").closest("button"),
      ).toBeDisabled();
    });

    it("is disabled while the toggle mutation is pending", () => {
      mockMutationPending = true;
      renderBugReport();
      expect(
        screen.getByText("Close Bug Report").closest("button"),
      ).toBeDisabled();
    });
  });

  describe("attachments", () => {
    it("renders an attachment image with its source", () => {
      renderBugReport();
      const img = screen.getByAltText("Screenshot 0");
      expect(img).toHaveAttribute(
        "src",
        makeBugReportDetailFixture().attachments[0].location,
      );
    });

    it("renders multiple attachments", () => {
      setBugReport({
        attachments: [
          {
            id: "att-1",
            name: "screenshot1.png",
            type: "screenshot",
            key: "key-1",
            location: "https://example.com/img1.png",
          },
          {
            id: "att-2",
            name: "screenshot2.png",
            type: "screenshot",
            key: "key-2",
            location: "https://example.com/img2.png",
          },
          {
            id: "att-3",
            name: "screenshot3.png",
            type: "screenshot",
            key: "key-3",
            location: "https://example.com/img3.png",
          },
        ],
      });
      renderBugReport();
      expect(screen.getByAltText("Screenshot 0")).toBeInTheDocument();
      expect(screen.getByAltText("Screenshot 1")).toBeInTheDocument();
      expect(screen.getByAltText("Screenshot 2")).toBeInTheDocument();
    });

    it("does not render attachments when null", () => {
      setBugReport({ attachments: null });
      renderBugReport();
      expect(screen.queryByAltText("Screenshot 0")).not.toBeInTheDocument();
    });

    it("does not render attachments when the list is empty", () => {
      setBugReport({ attachments: [] });
      renderBugReport();
      expect(screen.queryByAltText("Screenshot 0")).not.toBeInTheDocument();
    });
  });
});
