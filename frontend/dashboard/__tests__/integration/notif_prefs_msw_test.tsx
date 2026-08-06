/**
 * Integration tests for Notification Preferences page.
 *
 * Simple settings page with 4 checkbox rows (Crash Spike, ANR Spike,
 * Bug Reports, Daily Summary) and a Save button. Uses a draft/saved
 * split: updatedNotifPrefs tracks local edits, notifPrefs tracks
 * server state. Save is disabled when they match.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";

// --- External dependency mocks ---

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { reset: jest.fn(), capture: jest.fn(), init: jest.fn() },
}));

jest.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/test-team/notif_prefs",
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

// --- MSW ---
import { makeNotifPrefsFixture } from "../msw/fixtures";
import { server } from "../msw/server";

jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// --- Store/component imports ---
import Notifications from "@/app/[teamId]/notif_prefs/page";
import { queryClient } from "@/app/query/query_client";
import { QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/app/stores/provider", () => {
  const actual = jest.requireActual("@/app/stores/provider");
  return {
    ...actual,
  };
});

beforeEach(() => {
  queryClient.clear();
  const { apiClient } = require("@/app/api/api_client");
  apiClient.init({ replace: jest.fn(), push: jest.fn() });
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("Notification Preferences (MSW integration)", () => {
  it("shows error when fetch fails", async () => {
    server.use(
      http.get("*/api/prefs/notifPrefs", () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );
    renderWithProviders(<Notifications />);
    await waitFor(
      () => {
        expect(
          screen.getByText(/Failed to fetch notification preferences/),
        ).toBeTruthy();
      },
      { timeout: 5000 },
    );
  });
});

// ====================================================================
// MUTATIONS
// ====================================================================
describe("Notification Preferences — mutations", () => {
  async function renderAndWaitForData() {
    renderWithProviders(<Notifications />);
    await waitFor(
      () => {
        expect(screen.getByText("Crash Spike email")).toBeTruthy();
      },
      { timeout: 5000 },
    );
  }

  it("toggling a preference enables Save, and saving calls PATCH /prefs/notifPrefs", async () => {
    let capturedBody: any = null;
    let prefsSaved = false;
    server.use(
      http.patch("*/api/prefs/notifPrefs", async ({ request }) => {
        capturedBody = await request.json();
        prefsSaved = true;
        return HttpResponse.json({ ok: true });
      }),
      http.get("*/api/prefs/notifPrefs", () => {
        if (prefsSaved) {
          // Return updated prefs with bug_report flipped to true
          return HttpResponse.json(makeNotifPrefsFixture({ bug_report: true }));
        }
        return HttpResponse.json(makeNotifPrefsFixture());
      }),
    );

    await renderAndWaitForData();

    // Fixture: bug_report is false. Find the Bug Reports checkbox and toggle it.
    // The Checkbox renders as a button with role="checkbox"
    const checkboxes = document.querySelectorAll('[data-slot="checkbox"]');
    // The order matches: Crash Spike (0), ANR spike (1), Bug Reports (2), Daily Summary (3)
    const bugReportCheckbox = checkboxes[2] as HTMLButtonElement;
    expect(bugReportCheckbox).toBeTruthy();

    await act(async () => {
      fireEvent.click(bugReportCheckbox);
    });

    // Save button should now be enabled
    const saveBtn = screen.getByText("Save").closest("button")!;
    await waitFor(() => {
      expect(saveBtn.disabled).toBe(false);
    });

    // Click Save
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // Verify API was called with correct payload (bug_report flipped to true)
    await waitFor(
      () => {
        expect(capturedBody).toEqual({
          error_spike: true,
          app_hang_spike: true,
          bug_report: true,
          daily_summary: true,
        });
      },
      { timeout: 5000 },
    );
  });

  it("Save button becomes disabled again after successful save (prefs match server)", async () => {
    let patchCalled = false;
    server.use(
      http.patch("*/api/prefs/notifPrefs", () => {
        patchCalled = true;
        return HttpResponse.json({ ok: true });
      }),
      http.get("*/api/prefs/notifPrefs", () => {
        if (patchCalled) {
          // After save, server returns the updated prefs
          return HttpResponse.json(makeNotifPrefsFixture({ bug_report: true }));
        }
        return HttpResponse.json(makeNotifPrefsFixture());
      }),
    );

    await renderAndWaitForData();

    // Toggle Bug Reports (false -> true)
    const checkboxes = document.querySelectorAll('[data-slot="checkbox"]');
    const bugReportCheckbox = checkboxes[2] as HTMLButtonElement;

    await act(async () => {
      fireEvent.click(bugReportCheckbox);
    });

    const saveBtn = screen.getByText("Save").closest("button")!;
    await waitFor(() => {
      expect(saveBtn.disabled).toBe(false);
    });

    // Click Save
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // After successful save and refetch, Save should be disabled again
    // because both notifPrefs (server) and updatedNotifPrefs (local) now have bug_report: true
    await waitFor(
      () => {
        expect(patchCalled).toBe(true);
      },
      { timeout: 5000 },
    );

    await waitFor(
      () => {
        expect(saveBtn.disabled).toBe(true);
      },
      { timeout: 5000 },
    );
  });

  it("save returns 500 — error handled gracefully, local state stays changed", async () => {
    server.use(
      http.patch("*/api/prefs/notifPrefs", () => {
        return HttpResponse.json({ error: "server error" }, { status: 500 });
      }),
    );

    await renderAndWaitForData();

    // Toggle Bug Reports (false -> true)
    const checkboxes = document.querySelectorAll('[data-slot="checkbox"]');
    const bugReportCheckbox = checkboxes[2] as HTMLButtonElement;

    await act(async () => {
      fireEvent.click(bugReportCheckbox);
    });

    const saveBtn = screen.getByText("Save").closest("button")!;
    await waitFor(() => {
      expect(saveBtn.disabled).toBe(false);
    });

    // Click Save
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // Wait for the mutation to complete (with error)
    await new Promise((r) => setTimeout(r, 500));

    // The local state should remain changed (bug_report toggled to true)
    // so Save button should still be enabled (local differs from server)
    await waitFor(
      () => {
        expect(saveBtn.disabled).toBe(false);
      },
      { timeout: 5000 },
    );
  });
});
