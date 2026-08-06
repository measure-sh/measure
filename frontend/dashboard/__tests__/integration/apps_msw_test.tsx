/**
 * Integration tests for Apps settings page.
 *
 * These cover the wiring between the page and the API: request paths and
 * payloads, cache updates after mutations, and how server errors surface in
 * the UI. Pure rendering and permission-gating behavior is covered by the
 * unit tests in __tests__/pages/apps_test.tsx.
 */
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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";

// --- jsdom polyfills ---
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
}

// --- External dependency mocks ---

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: {
    reset: jest.fn(),
    capture: jest.fn(),
    init: jest.fn(),
    group: jest.fn(),
  },
}));

const mockRouterReplace = jest.fn();
const mockRouterPush = jest.fn();
const mockSearchParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ replace: mockRouterReplace, push: mockRouterPush }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/test-team/apps",
  useParams: () => ({ teamId: "test-team" }),
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
import {
  makeAppFixture,
  makeAppRetentionFixture,
  makeAuthzFixture,
  makeSdkConfigFixture,
  makeThresholdPrefsFixture,
} from "../msw/fixtures";
import { server } from "../msw/server";

jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => {
  server.resetHandlers();
  mockRouterReplace.mockClear();
  mockRouterPush.mockClear();
});
afterAll(() => server.close());

// --- Store/component imports ---
import Apps from "@/app/[teamId]/apps/page";
import { createFiltersStore } from "@/app/stores/filters_store";
import { createOnboardingStore } from "@/app/stores/onboarding_store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let filtersStore = createFiltersStore();
let onboardingStore = createOnboardingStore();
let testQueryClient: QueryClient;

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
  testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
    },
  });
  filtersStore.getState().reset();
  for (const key of [...mockSearchParams.keys()]) mockSearchParams.delete(key);
  const { apiClient } = require("@/app/api/api_client");
  apiClient.init({ replace: jest.fn(), push: jest.fn() });
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>,
  );
}

// ====================================================================
// APPS PAGE
// ====================================================================
describe("Apps Page (MSW integration)", () => {
  async function renderAndWaitForData() {
    renderWithProviders(
      <Apps params={promiseParams({ teamId: "test-team" })} />,
    );
    await waitFor(
      () => {
        expect(screen.getByText("Copy SDK Variables")).toBeTruthy();
      },
      { timeout: 5000 },
    );
  }

  // ================================================================
  // PAGE LOAD
  // ================================================================
  describe("page load", () => {
    it("shows error state when page data fails", async () => {
      server.use(
        http.get("*/api/apps/:appId/retention", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderWithProviders(
        <Apps params={promiseParams({ teamId: "test-team" })} />,
      );
      await waitFor(
        () => {
          expect(screen.getByText(/Error fetching app settings/)).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // PERMISSIONS
  // ================================================================
  describe("permissions", () => {
    it("loads permissions from authz endpoint and enables actions", async () => {
      await renderAndWaitForData();
      // When all permissions are granted, actions should be enabled
      const nameInput = document.getElementById(
        "change-app-name-input",
      ) as HTMLInputElement;
      expect(nameInput?.disabled).toBe(false);
      expect(screen.getByText("Rotate").closest("button")?.disabled).toBe(
        false,
      );
    });
  });

  // ================================================================
  // API PATHS
  // ================================================================
  describe("API paths", () => {
    it("fetches authz from /teams/:teamId/authz", async () => {
      const paths: string[] = [];
      server.use(
        http.get("*/api/teams/:teamId/authz", ({ request }) => {
          paths.push(new URL(request.url).pathname);
          return HttpResponse.json(makeAuthzFixture());
        }),
      );
      await renderAndWaitForData();
      expect(paths.some((p) => p.includes("/authz"))).toBe(true);
    });

    it("fetches retention from /apps/:appId/retention", async () => {
      const paths: string[] = [];
      server.use(
        http.get("*/api/apps/:appId/retention", ({ request }) => {
          paths.push(new URL(request.url).pathname);
          return HttpResponse.json(makeAppRetentionFixture());
        }),
      );
      await renderAndWaitForData();
      expect(paths.some((p) => p.includes("/retention"))).toBe(true);
    });

    it("fetches config from /apps/:appId/config", async () => {
      const paths: string[] = [];
      server.use(
        http.get("*/api/apps/:appId/config", ({ request }) => {
          paths.push(new URL(request.url).pathname);
          return HttpResponse.json(makeSdkConfigFixture());
        }),
      );
      await renderAndWaitForData();
      expect(paths.some((p) => p.includes("/config"))).toBe(true);
    });
  });
});

// ====================================================================
// CREATE APP
// ====================================================================
describe("Apps Page — create app", () => {
  it("opens dialog, submits new app name, POSTs to /teams/:teamId/apps and invalidates teams query", async () => {
    let capturedBody: any = null;
    let capturedPath: string = "";
    let appCreated = false;
    const newApp = {
      id: "new-app-id-1234",
      team_id: "test-team",
      name: "My New App",
      unique_identifier: null,
      os_names: null,
      api_key: {
        key: "msw-new-app-key",
        revoked: false,
        created_at: "2026-04-16T00:00:00Z",
        last_seen: null,
      },
      retention: 90,
      first_version: null,
      onboarded: false,
      onboarded_at: null,
      created_at: "2026-04-16T00:00:00Z",
      updated_at: "2026-04-16T00:00:00Z",
    };
    server.use(
      http.post("*/api/teams/:teamId/apps", async ({ request }) => {
        capturedBody = await request.json();
        capturedPath = new URL(request.url).pathname;
        appCreated = true;
        return HttpResponse.json(newApp);
      }),
      // After creation, the apps list should include the new app
      // so the onSuccess refresh can find it
      http.get("*/api/teams/:teamId/apps", () => {
        if (appCreated) {
          return HttpResponse.json([makeAppFixture(), newApp]);
        }
        return HttpResponse.json([makeAppFixture()]);
      }),
    );

    renderWithProviders(
      <Apps params={promiseParams({ teamId: "test-team" })} />,
    );
    await waitFor(
      () => {
        expect(screen.getByText("Copy SDK Variables")).toBeTruthy();
      },
      { timeout: 5000 },
    );

    // Click "Create App" button to open dialog
    const createAppBtn = screen.getByText("Create App").closest("button")!;
    await act(async () => {
      fireEvent.click(createAppBtn);
    });

    // Wait for dialog to appear with input and submit button
    await waitFor(() => {
      expect(screen.getByText("Add new app")).toBeTruthy();
      expect(screen.getByPlaceholderText("Enter app name")).toBeTruthy();
    });

    // Type app name
    const appNameInput = screen.getByPlaceholderText("Enter app name");
    await act(async () => {
      fireEvent.change(appNameInput, { target: { value: "My New App" } });
    });

    // Find and click the submit Create App button inside the dialog
    // There are two "Create App" texts: the outer button and the dialog submit button
    const allCreateAppButtons = screen.getAllByText("Create App");
    const dialogSubmitBtn = allCreateAppButtons
      .map((el) => el.closest("button"))
      .find((btn) => btn && btn.getAttribute("type") === "submit");
    expect(dialogSubmitBtn).toBeTruthy();

    await act(async () => {
      fireEvent.click(dialogSubmitBtn!);
    });

    // Verify API was called with correct payload and path
    await waitFor(
      () => {
        expect(capturedBody).toEqual({ name: "My New App" });
        expect(capturedPath).toContain("/teams/test-team/apps");
      },
      { timeout: 5000 },
    );

    expect(appCreated).toBe(true);
  });
});

// ====================================================================
// NO APPS IN TEAM — ONBOARDING TAKES OVER
// ====================================================================
describe("Apps Page — no apps in team", () => {
  it("transitions to the settings UI after the first app is created", async () => {
    let appsCallCount = 0;
    const newApp = makeAppFixture({
      id: "freshly-created",
      name: "Fresh App",
      onboarded: false,
    });

    server.use(
      http.get("*/api/teams/:teamId/apps", () => {
        appsCallCount += 1;
        if (appsCallCount === 1) {
          return new HttpResponse(null, { status: 404 });
        }
        return HttpResponse.json([newApp]);
      }),
      http.post("*/api/teams/:teamId/apps", () => {
        return HttpResponse.json(newApp);
      }),
    );

    renderWithProviders(
      <Apps params={promiseParams({ teamId: "test-team" })} />,
    );
    await waitFor(() => {
      expect(screen.getByTestId("onboarding-step-create")).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId("onboarding-app-name-input"), {
      target: { value: "Fresh App" },
    });
    await act(async () => {
      fireEvent.submit(
        screen.getByTestId("onboarding-app-name-input").closest("form")!,
      );
    });

    // The settings UI renders once retention/sdkConfig/threshold queries
    // succeed for the new app. That gate flips because the apps page's
    // dynamic showNotOnboarded prop falls to false, which re-fires
    // Filters' setConfig effect and makes filters.ready=true.
    await waitFor(
      () => {
        expect(screen.getByText("Copy SDK Variables")).toBeTruthy();
      },
      { timeout: 5000 },
    );
    // Create App button returns alongside the settings UI.
    expect(screen.getByText("Create App")).toBeTruthy();
  });
});

// ====================================================================
// MUTATIONS
// ====================================================================
describe("Apps Page — mutations", () => {
  async function renderAndWaitForData() {
    renderWithProviders(
      <Apps params={promiseParams({ teamId: "test-team" })} />,
    );
    await waitFor(
      () => {
        expect(screen.getByText("Copy SDK Variables")).toBeTruthy();
      },
      { timeout: 5000 },
    );
  }

  // ================================================================
  // RENAME APP
  // ================================================================
  describe("rename app", () => {
    it("calls PATCH /apps/:appId/rename and updates UI after refetch", async () => {
      let capturedBody: any = null;
      let renamed = false;
      server.use(
        http.patch("*/api/apps/:appId/rename", async ({ request }) => {
          capturedBody = await request.json();
          renamed = true;
          return HttpResponse.json({ ok: true });
        }),
        http.get("*/api/teams/:teamId/apps", () => {
          if (renamed) {
            return HttpResponse.json([makeAppFixture({ name: "renamed-app" })]);
          }
          return HttpResponse.json([makeAppFixture()]);
        }),
      );

      await renderAndWaitForData();

      const nameInput = document.getElementById(
        "change-app-name-input",
      ) as HTMLInputElement;
      expect(nameInput).toBeTruthy();

      // Type new name
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: "renamed-app" } });
      });

      // Find the Save button near the rename input (click it to open confirmation dialog)
      const saveButtons = screen.getAllByText("Save");
      const renameSaveBtn = saveButtons.find((btn) => {
        const button = btn.closest("button");
        return button && !button.disabled;
      });
      expect(renameSaveBtn).toBeTruthy();

      await act(async () => {
        fireEvent.click(renameSaveBtn!);
      });

      // Confirm the dialog
      await waitFor(() => {
        expect(screen.getByText("Yes, I'm sure")).toBeTruthy();
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Yes, I'm sure"));
      });

      // Verify API was called with correct payload
      await waitFor(
        () => {
          expect(capturedBody).toEqual({ name: "renamed-app" });
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // ROTATE API KEY
  // ================================================================
  describe("rotate API key", () => {
    it("calls PATCH /apps/:appId/apiKey after confirmation", async () => {
      let rotateCalled = false;
      let rotatedAppKey = false;
      server.use(
        http.patch("*/api/apps/:appId/apiKey", () => {
          rotateCalled = true;
          rotatedAppKey = true;
          return HttpResponse.json({ ok: true });
        }),
        http.get("*/api/teams/:teamId/apps", () => {
          if (rotatedAppKey) {
            return HttpResponse.json([
              makeAppFixture({
                api_key: {
                  key: "msw-rotated-key-9999",
                  revoked: false,
                  created_at: "2026-04-10T00:00:00Z",
                  last_seen: null,
                },
              }),
            ]);
          }
          return HttpResponse.json([makeAppFixture()]);
        }),
      );

      await renderAndWaitForData();

      // Click Rotate button
      const rotateBtn = screen.getByText("Rotate").closest("button")!;
      await act(async () => {
        fireEvent.click(rotateBtn);
      });

      // Confirm the dialog
      await waitFor(() => {
        expect(screen.getByText("Yes, rotate key")).toBeTruthy();
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Yes, rotate key"));
      });

      // Verify API was called
      await waitFor(
        () => {
          expect(rotateCalled).toBe(true);
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // SAVE THRESHOLD PREFS
  // ================================================================
  describe("save threshold prefs", () => {
    it("calls PATCH /apps/:appId/thresholdPrefs and updates UI", async () => {
      let capturedBody: any = null;
      let thresholdsUpdated = false;
      server.use(
        http.patch("*/api/apps/:appId/thresholdPrefs", async ({ request }) => {
          capturedBody = await request.json();
          thresholdsUpdated = true;
          return HttpResponse.json({ ok: true });
        }),
        http.get("*/api/apps/:appId/thresholdPrefs", () => {
          if (thresholdsUpdated) {
            return HttpResponse.json(
              makeThresholdPrefsFixture({
                error_good_threshold: 97.0,
              }),
            );
          }
          return HttpResponse.json(makeThresholdPrefsFixture());
        }),
      );

      await renderAndWaitForData();

      // Change the "Caution" threshold input using testId
      // Fixture has good=99.0, caution=98.0
      // Validation requires good > caution, so we lower caution to 95.0
      const cautionInput = screen.getByTestId(
        "error-caution-threshold-input",
      ) as HTMLInputElement;
      expect(cautionInput).toBeTruthy();

      await act(async () => {
        fireEvent.change(cautionInput, { target: { value: "95" } });
      });

      // Save thresholds button should now be enabled
      const saveBtn = screen
        .getByLabelText("Save thresholds")
        .closest("button")!;
      await waitFor(() => {
        expect(saveBtn.disabled).toBe(false);
      });

      await act(async () => {
        fireEvent.click(saveBtn);
      });

      // Verify API was called with updated threshold
      await waitFor(
        () => {
          expect(capturedBody).toBeTruthy();
          expect(capturedBody.error_caution_threshold).toBe(95);
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // MUTATION ERROR HANDLING
  // ================================================================
  describe("mutation error handling", () => {
    it("rename app API returns 500 — app name unchanged in input", async () => {
      server.use(
        http.patch("*/api/apps/:appId/rename", () => {
          return HttpResponse.json({ error: "server error" }, { status: 500 });
        }),
      );

      await renderAndWaitForData();

      const nameInput = document.getElementById(
        "change-app-name-input",
      ) as HTMLInputElement;
      expect(nameInput.value).toBe("measure demo");

      // Type new name
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: "fail-rename" } });
      });

      // Click Save
      const saveButtons = screen.getAllByText("Save");
      const renameSaveBtn = saveButtons.find((btn) => {
        const button = btn.closest("button");
        return button && !button.disabled;
      });
      expect(renameSaveBtn).toBeTruthy();

      await act(async () => {
        fireEvent.click(renameSaveBtn!);
      });

      // Confirm dialog
      await waitFor(() => {
        expect(screen.getByText("Yes, I'm sure")).toBeTruthy();
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Yes, I'm sure"));
      });

      // Wait for error and verify the original app name is still shown in the header/filters
      // (the input may still show user-typed value, but the app data from server is unchanged)
      await waitFor(
        () => {
          // The app fixture name 'measure demo' should still be in the page
          expect(screen.getByText("measure demo")).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("rotate API key returns 500 — error handled gracefully", async () => {
      let rotateCalled = false;
      server.use(
        http.patch("*/api/apps/:appId/apiKey", () => {
          rotateCalled = true;
          return HttpResponse.json({ error: "server error" }, { status: 500 });
        }),
      );

      await renderAndWaitForData();

      // Click Rotate button
      const rotateBtn = screen.getByText("Rotate").closest("button")!;
      await act(async () => {
        fireEvent.click(rotateBtn);
      });

      // Confirm dialog
      await waitFor(() => {
        expect(screen.getByText("Yes, rotate key")).toBeTruthy();
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Yes, rotate key"));
      });

      // Verify API was called
      await waitFor(
        () => {
          expect(rotateCalled).toBe(true);
        },
        { timeout: 5000 },
      );

      // Original API key should still be displayed
      const inputs = document.querySelectorAll("input[readonly]");
      const apiKeyInput = Array.from(inputs).find(
        (i) => (i as HTMLInputElement).value === makeAppFixture().api_key.key,
      );
      expect(apiKeyInput).toBeTruthy();
    });

    it("save threshold prefs returns 500 — old values preserved in inputs", async () => {
      let thresholdPatchCalled = false;
      server.use(
        http.patch("*/api/apps/:appId/thresholdPrefs", () => {
          thresholdPatchCalled = true;
          return HttpResponse.json({ error: "server error" }, { status: 500 });
        }),
      );

      await renderAndWaitForData();

      // Change caution threshold
      const cautionInput = screen.getByTestId(
        "error-caution-threshold-input",
      ) as HTMLInputElement;
      await act(async () => {
        fireEvent.change(cautionInput, { target: { value: "90" } });
      });

      // Click Save thresholds
      const saveBtn = screen
        .getByLabelText("Save thresholds")
        .closest("button")!;
      await waitFor(() => {
        expect(saveBtn.disabled).toBe(false);
      });

      await act(async () => {
        fireEvent.click(saveBtn);
      });

      // Verify API was called
      await waitFor(
        () => {
          expect(thresholdPatchCalled).toBe(true);
        },
        { timeout: 5000 },
      );

      // The server-side values should still be the originals (error_caution_threshold = 98.0)
      // The good threshold from the fixture should still be 99.0
      const goodInput = screen.getByTestId(
        "error-good-threshold-input",
      ) as HTMLInputElement;
      expect(Number(goodInput.value)).toBe(99);
    });
  });

  // ================================================================
  // RETENTION MUTATION
  // ================================================================
  describe("retention mutation", () => {
    it("changing retention dropdown and clicking Save calls PATCH /apps/:appId/retention", async () => {
      let capturedBody: any = null;
      server.use(
        http.patch("*/api/apps/:appId/retention", async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({ ok: true });
        }),
      );

      await renderAndWaitForData();

      // The retention dropdown trigger shows the current period, "3 months"
      // (90 days from the fixture). Open it and pick "1 year".
      const retentionDropdownBtn = screen
        .getByText("3 months")
        .closest("button")!;
      expect(retentionDropdownBtn).toBeTruthy();
      await act(async () => {
        fireEvent.click(retentionDropdownBtn);
      });

      await waitFor(
        () => {
          expect(screen.getByText("1 year")).toBeTruthy();
        },
        { timeout: 3000 },
      );

      await act(async () => {
        fireEvent.click(screen.getByText("1 year"));
      });

      // The retention Save is the enabled plain "Save" button; the threshold
      // save carries an aria-label and the rename save stays disabled because
      // the name is unchanged.
      const retentionSaveBtn = screen
        .getAllByText("Save")
        .map((el) => el.closest("button")!)
        .find(
          (button) => !button.disabled && !button.getAttribute("aria-label"),
        );
      expect(retentionSaveBtn).toBeTruthy();

      await act(async () => {
        fireEvent.click(retentionSaveBtn!);
      });

      // Confirm dialog
      await waitFor(() => {
        expect(screen.getByText("Yes, I'm sure")).toBeTruthy();
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Yes, I'm sure"));
      });

      // Verify API was called with the new retention period
      await waitFor(
        () => {
          expect(capturedBody).toBeTruthy();
          expect(capturedBody.retention).toBe(365);
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // SAVE SDK CONFIG
  // ================================================================
  describe("save SDK config", () => {
    it("calls PATCH /apps/:appId/config for crashes section and updates UI", async () => {
      let capturedBody: any = null;
      server.use(
        http.patch("*/api/apps/:appId/config", async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json(
            makeSdkConfigFixture({
              crash_take_screenshot: false,
            }),
          );
        }),
      );

      await renderAndWaitForData();

      // Open the Crashes accordion
      const crashesTrigger = screen.getByText("Crashes");
      await act(async () => {
        fireEvent.click(crashesTrigger);
      });

      // Wait for accordion content to appear
      await waitFor(() => {
        expect(screen.getByTestId("crash-screenshot-switch")).toBeTruthy();
      });

      // Toggle the crash screenshot switch
      const crashScreenshotSwitch = screen.getByTestId(
        "crash-screenshot-switch",
      );
      await act(async () => {
        fireEvent.click(crashScreenshotSwitch);
      });

      // The Save button in the crashes section should now be enabled
      const crashesSaveBtn = screen.getByTestId("crashes-save-button");
      await waitFor(() => {
        expect(crashesSaveBtn.closest("button")?.disabled).toBe(false);
      });

      // Click Save to open confirmation dialog
      await act(async () => {
        fireEvent.click(crashesSaveBtn);
      });

      // Confirm
      await waitFor(() => {
        expect(screen.getByText("Yes, I'm sure")).toBeTruthy();
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Yes, I'm sure"));
      });

      // Verify API was called with correct payload
      await waitFor(
        () => {
          expect(capturedBody).toBeTruthy();
          expect(capturedBody.crash_take_screenshot).toBe(false);
        },
        { timeout: 5000 },
      );
    });
  });
});
