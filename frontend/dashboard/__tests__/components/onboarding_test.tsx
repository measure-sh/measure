import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";

// --- Mock state (mutable per test) ---

interface MockApp {
  id: string;
  name: string;
  onboarded: boolean;
  api_key: { key: string };
}

let mockApps: MockApp[] = [];
let mockSelectedApp: MockApp | null = null;

const mockMutateAsync = jest.fn();
const mockToastPositive = jest.fn();
const mockToastNegative = jest.fn();
const mockRefresh = jest.fn();
const mockPush = jest.fn();
const mockFetchAppsFromServer = jest.fn();
const mockFetchFiltersFromServer = jest.fn();
const mockWriteText = jest.fn();
let mockCanCreateApp = true;

let mockIsPending = false;

// --- Mocks ---

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useCreateAppMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
  }),
  useAuthzAndMembersQuery: () => ({
    data: { can_create_app: mockCanCreateApp },
  }),
}));

// filters_store imports a wide surface of types/enums from api_calls, so
// we spread the real module and only override the two functions the
// polling tick exercises.
jest.mock("@/app/api/api_calls", () => {
  const actual = jest.requireActual<typeof import("@/app/api/api_calls")>(
    "@/app/api/api_calls",
  );
  return {
    ...actual,
    fetchAppsFromServer: (...args: any[]) => mockFetchAppsFromServer(...args),
    fetchFiltersFromServer: (...args: any[]) =>
      mockFetchFiltersFromServer(...args),
  };
});

jest.mock("@/app/utils/use_toast", () => ({
  toastPositive: (...args: any[]) => mockToastPositive(...args),
  toastNegative: (...args: any[]) => mockToastNegative(...args),
}));

// Use a real filtersStore instance so its onboarding state actions
// (setOnboardingStep, setOnboardingPlatform, markAppOnboarded) and the
// localStorage hydration are exercised end-to-end. We only need to
// override apps/selectedApp at read time and refresh at call time.
const { createFiltersStore } = jest.requireActual("@/app/stores/filters_store");
const { useStore } = jest.requireActual("zustand");

let filtersStoreInstance: ReturnType<typeof createFiltersStore>;

jest.mock("@/app/stores/provider", () => ({
  useFiltersStore: (selector: any) => {
    // Layer the per-test mock apps/selectedApp on top of the real store's
    // state so onboarding-keyed reads (state.onboarding[appId]) flow
    // through. useStore subscribes correctly so reactive updates work.
    return useStore(filtersStoreInstance, (state: any) =>
      selector({ ...state, apps: mockApps, selectedApp: mockSelectedApp }),
    );
  },
  useMeasureStoreRegistry: () => ({
    filtersStore: {
      getState: () => ({
        ...filtersStoreInstance.getState(),
        // Override refresh — its real implementation would fire
        // fetchAppsFromServer; we want a controllable mock instead.
        refresh: mockRefresh,
      }),
    },
  }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, className }: any) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

jest.mock("lucide-react", () => ({
  Check: () => <span data-testid="icon-check" />,
  ChevronLeft: () => <span data-testid="icon-chevron-left" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  Copy: () => <span data-testid="icon-copy" />,
  Loader2: ({ className }: any) => (
    <span data-testid="icon-loader" className={className} />
  ),
}));

jest.mock("@/app/components/button", () => ({
  Button: ({ children, onClick, disabled, loading, type, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-loading={loading}
      type={type}
      {...props}
    >
      {children}
    </button>
  ),
}));

jest.mock("@/app/components/input", () => ({
  Input: (props: any) => <input {...props} />,
}));

jest.mock("@/app/components/tab_select", () => ({
  __esModule: true,
  default: ({ items, selected, onChangeSelected }: any) => (
    <div data-testid="tab-select">
      {items.map((item: string) => (
        <button
          key={item}
          data-testid={`tab-${item}`}
          data-selected={selected === item}
          onClick={() => onChangeSelected?.(item)}
        >
          {item}
        </button>
      ))}
    </div>
  ),
  TabSize: { Large: "large", Small: "small" },
}));

// --- Import after mocks ---

import Onboarding from "@/app/components/onboarding";

// --- Helpers ---

const mockInitConfig: any = {
  urlFilters: {},
  appVersionsInitialSelectionType: 0,
  filterSource: 0,
};

function makeApp(overrides: Partial<MockApp> = {}): MockApp {
  return {
    id: "app-1",
    name: "My App",
    onboarded: false,
    api_key: { key: "msr_test_key_abc123" },
    ...overrides,
  };
}

function renderOnboarding(props: Partial<{ teamId: string }> = {}) {
  return render(
    <Onboarding
      teamId={props.teamId ?? "team-1"}
      initConfig={mockInitConfig}
    />,
  );
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

// --- Reset state ---

beforeEach(() => {
  jest.clearAllMocks();
  mockApps = [];
  mockSelectedApp = null;
  mockIsPending = false;
  mockCanCreateApp = true;
  mockRefresh.mockResolvedValue(undefined);
  mockFetchAppsFromServer.mockResolvedValue({ status: 1, data: [] });
  // FiltersApiStatus.Success = 1. Default the polling's filters probe to
  // Success so tests that drive the apps endpoint to onboarded=true reach
  // the verified state without per-test setup.
  mockFetchFiltersFromServer.mockResolvedValue({
    status: 1,
    data: {
      versions: [],
      os_versions: [],
      countries: [],
      network_providers: [],
      network_types: [],
      network_generations: [],
      locales: [],
      device_manufacturers: [],
      device_names: [],
      ud_attrs: null,
    },
  });
  Object.assign(navigator, {
    clipboard: { writeText: mockWriteText },
  });
  if (typeof window !== "undefined") {
    window.localStorage.clear();
  }
  // Reconstruct the filters store each test so its onboarding state
  // re-reads localStorage fresh (any seed data each test sets up gets
  // picked up via the synchronous hydration in createFiltersStore).
  filtersStoreInstance = createFiltersStore();
});

// ============================================================
// Step 1: Create app
// ============================================================

describe("Onboarding — Step 1: Create app", () => {
  describe("Rendering", () => {
    it("renders Step 1 when team has zero apps", () => {
      renderOnboarding();
      expect(screen.getByTestId("onboarding-step-create")).toBeInTheDocument();
    });

    it("renders the heading and description", () => {
      renderOnboarding();
      expect(screen.getByText("Get started with Measure")).toBeInTheDocument();
      expect(screen.getByText("Create your app")).toBeInTheDocument();
    });

    it("does not render Step 1 when team already has an app", () => {
      mockApps = [makeApp()];
      mockSelectedApp = makeApp();
      renderOnboarding();
      expect(
        screen.queryByTestId("onboarding-step-create"),
      ).not.toBeInTheDocument();
    });

    it("does not render verify or success states initially", () => {
      renderOnboarding();
      expect(
        screen.queryByTestId("onboarding-step-verify"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("onboarding-success"),
      ).not.toBeInTheDocument();
    });

    it("renders the app name input", () => {
      renderOnboarding();
      expect(
        screen.getByTestId("onboarding-app-name-input"),
      ).toBeInTheDocument();
    });
  });

  describe("Form behavior", () => {
    it("disables submit button when input is empty", () => {
      renderOnboarding();
      expect(screen.getByTestId("onboarding-create-app-button")).toBeDisabled();
    });

    it("disables submit button when input has only whitespace", () => {
      renderOnboarding();
      fireEvent.change(screen.getByTestId("onboarding-app-name-input"), {
        target: { value: "   " },
      });
      expect(screen.getByTestId("onboarding-create-app-button")).toBeDisabled();
    });

    it("enables submit button when input has non-whitespace text", () => {
      renderOnboarding();
      fireEvent.change(screen.getByTestId("onboarding-app-name-input"), {
        target: { value: "My App" },
      });
      expect(
        screen.getByTestId("onboarding-create-app-button"),
      ).not.toBeDisabled();
    });

    it("disables submit button while mutation is pending", () => {
      mockIsPending = true;
      renderOnboarding();
      fireEvent.change(screen.getByTestId("onboarding-app-name-input"), {
        target: { value: "My App" },
      });
      expect(screen.getByTestId("onboarding-create-app-button")).toBeDisabled();
    });

    it("disables the form when user lacks can_create_app permission", () => {
      mockCanCreateApp = false;
      renderOnboarding();
      expect(screen.getByTestId("onboarding-app-name-input")).toBeDisabled();
      expect(screen.getByTestId("onboarding-create-app-button")).toBeDisabled();
      expect(
        screen.getByTestId("onboarding-create-no-permission"),
      ).toBeInTheDocument();
    });

    it("does not call mutation on submit when permission is denied", async () => {
      mockCanCreateApp = false;
      renderOnboarding();
      await act(async () => {
        fireEvent.submit(
          screen.getByTestId("onboarding-app-name-input").closest("form")!,
        );
      });
      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it("hides the permission notice once permission is granted", () => {
      mockCanCreateApp = true;
      renderOnboarding();
      expect(
        screen.queryByTestId("onboarding-create-no-permission"),
      ).not.toBeInTheDocument();
    });

    it("does not call mutation when form submitted with empty input", async () => {
      renderOnboarding();
      await act(async () => {
        fireEvent.submit(
          screen.getByTestId("onboarding-app-name-input").closest("form")!,
        );
      });
      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it("calls mutation with teamId and trimmed app name", async () => {
      mockMutateAsync.mockResolvedValue(makeApp({ name: "My App" }));
      renderOnboarding({ teamId: "team-42" });
      fireEvent.change(screen.getByTestId("onboarding-app-name-input"), {
        target: { value: "  My App  " },
      });
      await act(async () => {
        fireEvent.submit(
          screen.getByTestId("onboarding-app-name-input").closest("form")!,
        );
      });
      expect(mockMutateAsync).toHaveBeenCalledWith({
        teamId: "team-42",
        appName: "My App",
      });
    });
  });

  describe("Success path", () => {
    beforeEach(() => {
      const newApp = makeApp({ name: "My App", id: "app-99" });
      mockMutateAsync.mockResolvedValue(newApp);
      // Simulate the filters store update that the real refresh action
      // performs: a non-empty apps list with the new app selected. This
      // is what flips apps.length > 0 in the next render so the component
      // moves past the 'create' step.
      mockRefresh.mockImplementation(async () => {
        mockApps = [newApp];
        mockSelectedApp = newApp;
      });
    });

    it("refreshes the filters store with the new app id", async () => {
      renderOnboarding({ teamId: "team-42" });
      fireEvent.change(screen.getByTestId("onboarding-app-name-input"), {
        target: { value: "My App" },
      });
      await act(async () => {
        fireEvent.submit(
          screen.getByTestId("onboarding-app-name-input").closest("form")!,
        );
      });
      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalledWith(
          "team-42",
          mockInitConfig,
          "app-99",
        );
      });
    });

    it("shows positive toast with the app name", async () => {
      renderOnboarding();
      fireEvent.change(screen.getByTestId("onboarding-app-name-input"), {
        target: { value: "My App" },
      });
      await act(async () => {
        fireEvent.submit(
          screen.getByTestId("onboarding-app-name-input").closest("form")!,
        );
      });
      await waitFor(() => {
        expect(mockToastPositive).toHaveBeenCalledWith(
          "App My App has been created",
        );
      });
    });

    it("advances to the integrate step", async () => {
      renderOnboarding();
      fireEvent.change(screen.getByTestId("onboarding-app-name-input"), {
        target: { value: "My App" },
      });
      await act(async () => {
        fireEvent.submit(
          screen.getByTestId("onboarding-app-name-input").closest("form")!,
        );
      });
      await waitFor(() => {
        expect(
          screen.getByTestId("onboarding-step-integrate"),
        ).toBeInTheDocument();
      });
    });

    it("marks Step 1 as done after success", async () => {
      renderOnboarding();
      fireEvent.change(screen.getByTestId("onboarding-app-name-input"), {
        target: { value: "My App" },
      });
      await act(async () => {
        fireEvent.submit(
          screen.getByTestId("onboarding-app-name-input").closest("form")!,
        );
      });
      await waitFor(() => {
        expect(
          screen.queryByTestId("onboarding-create-app-button"),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Error path", () => {
    beforeEach(() => {
      mockMutateAsync.mockRejectedValue(new Error("Name already taken"));
    });

    it("shows error toast with error message", async () => {
      renderOnboarding();
      fireEvent.change(screen.getByTestId("onboarding-app-name-input"), {
        target: { value: "My App" },
      });
      await act(async () => {
        fireEvent.submit(
          screen.getByTestId("onboarding-app-name-input").closest("form")!,
        );
      });
      await waitFor(() => {
        expect(mockToastNegative).toHaveBeenCalledWith(
          "Error creating app: Name already taken",
        );
      });
    });

    it("stays on the create step", async () => {
      renderOnboarding();
      fireEvent.change(screen.getByTestId("onboarding-app-name-input"), {
        target: { value: "My App" },
      });
      await act(async () => {
        fireEvent.submit(
          screen.getByTestId("onboarding-app-name-input").closest("form")!,
        );
      });
      await waitFor(() => {
        expect(mockToastNegative).toHaveBeenCalled();
      });
      expect(
        screen.getByTestId("onboarding-create-app-button"),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("onboarding-step-integrate"),
      ).not.toBeInTheDocument();
    });

    it("does not refresh the filters store on error", async () => {
      renderOnboarding();
      fireEvent.change(screen.getByTestId("onboarding-app-name-input"), {
        target: { value: "My App" },
      });
      await act(async () => {
        fireEvent.submit(
          screen.getByTestId("onboarding-app-name-input").closest("form")!,
        );
      });
      await waitFor(() => {
        expect(mockToastNegative).toHaveBeenCalled();
      });
      expect(mockRefresh).not.toHaveBeenCalled();
    });

    it("does not advance to integrate step", async () => {
      renderOnboarding();
      fireEvent.change(screen.getByTestId("onboarding-app-name-input"), {
        target: { value: "My App" },
      });
      await act(async () => {
        fireEvent.submit(
          screen.getByTestId("onboarding-app-name-input").closest("form")!,
        );
      });
      await waitFor(() => {
        expect(mockToastNegative).toHaveBeenCalled();
      });
      expect(
        screen.queryByTestId("onboarding-step-integrate"),
      ).not.toBeInTheDocument();
    });
  });
});

// ============================================================
// Step 2: Install + integrate
// ============================================================

describe("Onboarding — Step 2: Integrate", () => {
  beforeEach(() => {
    mockApps = [makeApp({ name: "Existing App" })];
    mockSelectedApp = makeApp({ name: "Existing App" });
  });

  describe("Rendering", () => {
    it("renders integrate step as the first step when an app already exists", () => {
      renderOnboarding();
      expect(
        screen.getByTestId("onboarding-step-integrate"),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("onboarding-step-create"),
      ).not.toBeInTheDocument();
    });

    it("renders Android, iOS, and Flutter tabs", () => {
      renderOnboarding();
      expect(screen.getByTestId("tab-Android")).toBeInTheDocument();
      expect(screen.getByTestId("tab-iOS")).toBeInTheDocument();
      expect(screen.getByTestId("tab-Flutter")).toBeInTheDocument();
    });

    it("selects Android by default", () => {
      renderOnboarding();
      expect(screen.getByTestId("tab-Android")).toHaveAttribute(
        "data-selected",
        "true",
      );
      expect(screen.getByTestId("tab-iOS")).toHaveAttribute(
        "data-selected",
        "false",
      );
    });

    it("renders all four Android snippet blocks", () => {
      renderOnboarding();
      expect(screen.getByTestId("snippet-dependency")).toBeInTheDocument();
      expect(screen.getByTestId("snippet-manifest")).toBeInTheDocument();
      expect(screen.getByTestId("snippet-init")).toBeInTheDocument();
      expect(screen.getByTestId("snippet-crash")).toBeInTheDocument();
    });

    it("embeds the actual API key in the Android manifest snippet", () => {
      mockSelectedApp = makeApp({ api_key: { key: "msr_actual_key_xyz" } });
      mockApps = [mockSelectedApp];
      renderOnboarding();
      expect(screen.getByTestId("snippet-manifest")).toHaveTextContent(
        "msr_actual_key_xyz",
      );
    });

    it("falls back to YOUR_API_KEY when no app is selected", () => {
      mockApps = [makeApp()];
      mockSelectedApp = null;
      renderOnboarding();
      expect(screen.getByTestId("snippet-manifest")).toHaveTextContent(
        "YOUR_API_KEY",
      );
    });

    it("enables full collection mode in the Android init snippet", () => {
      renderOnboarding();
      expect(screen.getByTestId("snippet-init")).toHaveTextContent(
        "enableFullCollectionMode = true",
      );
    });

    it("shows the test crash removal warning in the crash snippet", () => {
      renderOnboarding();
      expect(screen.getByTestId("snippet-crash")).toHaveTextContent(
        /Remove this code after the crash appears in your dashboard/i,
      );
    });

    it("renders link to full integration guide", () => {
      renderOnboarding();
      const link = screen.getByText("See full integration guide").closest("a");
      expect(link).toHaveAttribute("href", "/docs/sdk-integration-guide");
    });
  });

  describe("Tab switching", () => {
    it("shows Android-specific content by default", () => {
      renderOnboarding();
      expect(screen.getByTestId("snippet-dependency")).toHaveTextContent(
        "measure-android",
      );
      expect(screen.getByTestId("snippet-crash")).toHaveTextContent(
        "RuntimeException",
      );
    });

    it("switches to iOS-specific content", () => {
      renderOnboarding();
      fireEvent.click(screen.getByTestId("tab-iOS"));
      expect(screen.getByTestId("snippet-dependency")).toHaveTextContent(
        "Package.swift",
      );
      expect(screen.getByTestId("snippet-init")).toHaveTextContent(
        "Measure.initialize",
      );
      expect(screen.getByTestId("snippet-init")).toHaveTextContent(
        "enableFullCollectionMode: true",
      );
      expect(screen.getByTestId("snippet-crash")).toHaveTextContent(
        "fatalError",
      );
      // iOS-only tab uses SPM (no Podfile gotcha) and does not need the
      // Android manifest. Those snippets are Flutter-only.
      expect(screen.queryByTestId("snippet-manifest")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("snippet-ios-podfile"),
      ).not.toBeInTheDocument();
    });

    it("switches to Flutter with Android-side snippets by default", () => {
      renderOnboarding();
      fireEvent.click(screen.getByTestId("tab-Flutter"));
      // Default sub-platform is Android, so we get the Android-side native
      // setup plus the Flutter glue. iOS-side bits are hidden.
      expect(screen.getByTestId("snippet-dependency")).toHaveTextContent(
        "measure_flutter",
      );
      expect(screen.getByTestId("snippet-manifest")).toHaveTextContent(
        "sh.measure.android.API_KEY",
      );
      expect(screen.getByTestId("snippet-android-init")).toHaveTextContent(
        "enableFullCollectionMode = true",
      );
      expect(screen.getByTestId("snippet-init")).toHaveTextContent(
        "Measure.instance.init",
      );
      expect(screen.getByTestId("snippet-crash")).toHaveTextContent(
        "Exception('Test crash",
      );
      expect(
        screen.queryByTestId("snippet-ios-podfile"),
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("snippet-ios-init")).not.toBeInTheDocument();
    });

    it("switches to Flutter+iOS snippets when sub-platform is iOS", () => {
      renderOnboarding();
      fireEvent.click(screen.getByTestId("tab-Flutter"));
      fireEvent.click(screen.getByTestId("onboarding-flutter-platform-iOS"));
      expect(screen.getByTestId("snippet-dependency")).toHaveTextContent(
        "measure_flutter",
      );
      expect(screen.getByTestId("snippet-ios-podfile")).toHaveTextContent(
        ":linkage => :static",
      );
      expect(screen.getByTestId("snippet-ios-init")).toHaveTextContent(
        "enableFullCollectionMode: true",
      );
      expect(screen.getByTestId("snippet-init")).toHaveTextContent(
        "Measure.instance.init",
      );
      expect(screen.getByTestId("snippet-crash")).toHaveTextContent(
        "Exception('Test crash",
      );
      expect(screen.queryByTestId("snippet-manifest")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("snippet-android-init"),
      ).not.toBeInTheDocument();
    });

    it("updates selected tab indicator on switch", () => {
      renderOnboarding();
      fireEvent.click(screen.getByTestId("tab-iOS"));
      expect(screen.getByTestId("tab-iOS")).toHaveAttribute(
        "data-selected",
        "true",
      );
      expect(screen.getByTestId("tab-Android")).toHaveAttribute(
        "data-selected",
        "false",
      );
    });

    it("embeds the API key per platform convention", () => {
      mockSelectedApp = makeApp({ api_key: { key: "msr_xkey" } });
      mockApps = [mockSelectedApp];
      renderOnboarding();
      // Android: API key lives in the AndroidManifest.xml meta-data block.
      expect(screen.getByTestId("snippet-manifest")).toHaveTextContent(
        "msr_xkey",
      );
      // iOS: API key passed to ClientInfo() in the init snippet.
      fireEvent.click(screen.getByTestId("tab-iOS"));
      expect(screen.getByTestId("snippet-init")).toHaveTextContent("msr_xkey");
    });
  });

  describe("Flutter sub-platform selector", () => {
    it("does not render the sub-selector on Android or iOS tabs", () => {
      renderOnboarding();
      expect(
        screen.queryByTestId("onboarding-flutter-platform-select"),
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId("tab-iOS"));
      expect(
        screen.queryByTestId("onboarding-flutter-platform-select"),
      ).not.toBeInTheDocument();
    });

    it("renders the sub-selector when Flutter is the active tab", () => {
      renderOnboarding();
      fireEvent.click(screen.getByTestId("tab-Flutter"));
      expect(
        screen.getByTestId("onboarding-flutter-platform-Android"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("onboarding-flutter-platform-iOS"),
      ).toBeInTheDocument();
    });

    it("selects Android as the default sub-platform", () => {
      renderOnboarding();
      fireEvent.click(screen.getByTestId("tab-Flutter"));
      expect(
        screen.getByTestId("onboarding-flutter-platform-Android"),
      ).toHaveAttribute("data-selected", "true");
      expect(
        screen.getByTestId("onboarding-flutter-platform-iOS"),
      ).toHaveAttribute("data-selected", "false");
    });

    it("updates the selected sub-platform indicator on click", () => {
      renderOnboarding();
      fireEvent.click(screen.getByTestId("tab-Flutter"));
      fireEvent.click(screen.getByTestId("onboarding-flutter-platform-iOS"));
      expect(
        screen.getByTestId("onboarding-flutter-platform-iOS"),
      ).toHaveAttribute("data-selected", "true");
      expect(
        screen.getByTestId("onboarding-flutter-platform-Android"),
      ).toHaveAttribute("data-selected", "false");
    });

    it("embeds the API key in the active sub-platform snippet", () => {
      mockSelectedApp = makeApp({ api_key: { key: "msr_flutter_key" } });
      mockApps = [mockSelectedApp];
      renderOnboarding();
      fireEvent.click(screen.getByTestId("tab-Flutter"));
      // Android sub-platform → manifest carries the key.
      expect(screen.getByTestId("snippet-manifest")).toHaveTextContent(
        "msr_flutter_key",
      );
      fireEvent.click(screen.getByTestId("onboarding-flutter-platform-iOS"));
      // iOS sub-platform → key passed to ClientInfo() in the iOS native init.
      expect(screen.getByTestId("snippet-ios-init")).toHaveTextContent(
        "msr_flutter_key",
      );
    });
  });

  describe("Copy buttons", () => {
    it("copies dependency snippet to clipboard", () => {
      renderOnboarding();
      fireEvent.click(screen.getByTestId("snippet-dependency-copy"));
      expect(mockWriteText).toHaveBeenCalledTimes(1);
      expect(mockWriteText.mock.calls[0][0]).toContain("measure-android");
    });

    it("copies the Android manifest snippet with API key to clipboard", () => {
      mockSelectedApp = makeApp({ api_key: { key: "msr_clip" } });
      mockApps = [mockSelectedApp];
      renderOnboarding();
      fireEvent.click(screen.getByTestId("snippet-manifest-copy"));
      expect(mockWriteText.mock.calls[0][0]).toContain("msr_clip");
    });

    it("copies the iOS init snippet with API key to clipboard", () => {
      mockSelectedApp = makeApp({ api_key: { key: "msr_clip" } });
      mockApps = [mockSelectedApp];
      renderOnboarding();
      fireEvent.click(screen.getByTestId("tab-iOS"));
      fireEvent.click(screen.getByTestId("snippet-init-copy"));
      expect(mockWriteText.mock.calls[0][0]).toContain("msr_clip");
    });

    it("copies test crash snippet to clipboard", () => {
      renderOnboarding();
      fireEvent.click(screen.getByTestId("snippet-crash-copy"));
      expect(mockWriteText.mock.calls[0][0]).toContain(
        "Test crash from Measure onboarding",
      );
    });

    it("shows positive toast with the snippet label on copy", () => {
      renderOnboarding();
      fireEvent.click(screen.getByTestId("snippet-init-copy"));
      expect(mockToastPositive).toHaveBeenCalledWith(
        "3. Initialize the SDK copied to clipboard",
      );
    });
  });

  describe("Advancement", () => {
    it("advances to verify step on Next button click", () => {
      renderOnboarding();
      fireEvent.click(screen.getByTestId("onboarding-next-button"));
      expect(screen.getByTestId("onboarding-step-verify")).toBeInTheDocument();
      expect(screen.getByTestId("onboarding-waiting")).toBeInTheDocument();
    });

    it("hides the integrate form after advancing", () => {
      renderOnboarding();
      fireEvent.click(screen.getByTestId("onboarding-next-button"));
      expect(screen.queryByTestId("tab-select")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("snippet-dependency"),
      ).not.toBeInTheDocument();
    });
  });
});

// ============================================================
// Step 3: Verify
// ============================================================

describe("Onboarding — Step 3: Verify", () => {
  beforeEach(() => {
    mockApps = [makeApp({ id: "target-app", onboarded: false })];
    mockSelectedApp = makeApp({ id: "target-app", onboarded: false });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  async function reachVerifyStep() {
    renderOnboarding({ teamId: "team-7" });
    await act(async () => {
      fireEvent.click(screen.getByTestId("onboarding-next-button"));
    });
  }

  describe("Polling", () => {
    it("polls fetchAppsFromServer immediately on entering verify step", async () => {
      mockFetchAppsFromServer.mockResolvedValue({
        status: 1, // AppsApiStatus.Success
        data: [makeApp({ id: "target-app", onboarded: false })],
      });
      await reachVerifyStep();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(mockFetchAppsFromServer).toHaveBeenCalledWith("team-7");
      expect(mockFetchAppsFromServer).toHaveBeenCalledTimes(1);
    });

    it("shows waiting state while not yet onboarded", async () => {
      mockFetchAppsFromServer.mockResolvedValue({
        status: 1,
        data: [makeApp({ id: "target-app", onboarded: false })],
      });
      await reachVerifyStep();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByTestId("onboarding-waiting")).toBeInTheDocument();
      expect(
        screen.queryByTestId("onboarding-success"),
      ).not.toBeInTheDocument();
    });

    it("polls again every 3 seconds", async () => {
      mockFetchAppsFromServer.mockResolvedValue({
        status: 1,
        data: [makeApp({ id: "target-app", onboarded: false })],
      });
      await reachVerifyStep();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(mockFetchAppsFromServer).toHaveBeenCalledTimes(1);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
      });
      expect(mockFetchAppsFromServer).toHaveBeenCalledTimes(2);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
      });
      expect(mockFetchAppsFromServer).toHaveBeenCalledTimes(3);
    });

    it("advances to verified state when target app onboarded flips to true", async () => {
      mockFetchAppsFromServer
        .mockResolvedValueOnce({
          status: 1,
          data: [makeApp({ id: "target-app", onboarded: false })],
        })
        .mockResolvedValueOnce({
          status: 1,
          data: [makeApp({ id: "target-app", onboarded: true })],
        });
      await reachVerifyStep();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(
        screen.queryByTestId("onboarding-success"),
      ).not.toBeInTheDocument();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
      });
      expect(screen.getByTestId("onboarding-success")).toBeInTheDocument();
    });

    it("ignores onboarded flag of other apps in the response", async () => {
      mockFetchAppsFromServer.mockResolvedValue({
        status: 1,
        data: [
          makeApp({ id: "target-app", onboarded: false }),
          makeApp({ id: "other-app", onboarded: true }),
        ],
      });
      await reachVerifyStep();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
      });
      expect(
        screen.queryByTestId("onboarding-success"),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("onboarding-waiting")).toBeInTheDocument();
    });

    it("does not advance when fetch returns error status", async () => {
      mockFetchAppsFromServer.mockResolvedValue({ status: 2, data: null });
      await reachVerifyStep();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
      });
      expect(screen.getByTestId("onboarding-waiting")).toBeInTheDocument();
    });

    it("stops polling after onboarded flag flips", async () => {
      mockFetchAppsFromServer.mockResolvedValue({
        status: 1,
        data: [makeApp({ id: "target-app", onboarded: true })],
      });
      await reachVerifyStep();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByTestId("onboarding-success")).toBeInTheDocument();
      const callsAfterSuccess = mockFetchAppsFromServer.mock.calls.length;
      await act(async () => {
        await jest.advanceTimersByTimeAsync(15000);
      });
      expect(mockFetchAppsFromServer).toHaveBeenCalledTimes(callsAfterSuccess);
    });
  });

  describe("Verified state", () => {
    beforeEach(() => {
      mockFetchAppsFromServer.mockResolvedValue({
        status: 1,
        data: [makeApp({ id: "target-app", onboarded: true })],
      });
    });

    it("shows the success message", async () => {
      await reachVerifyStep();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByText("Crash received.")).toBeInTheDocument();
    });

    it("renders the View on dashboard button", async () => {
      await reachVerifyStep();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(
        screen.getByTestId("onboarding-view-dashboard-button"),
      ).toBeInTheDocument();
    });

    it("navigates to the team crashes page on button click", async () => {
      await reachVerifyStep();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      fireEvent.click(screen.getByTestId("onboarding-view-dashboard-button"));
      expect(mockPush).toHaveBeenCalledWith(
        "/team-7/crashes?a=target-app&d=Last+6+Hours",
      );
    });

    it("hides the waiting state after success", async () => {
      await reachVerifyStep();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(
        screen.queryByTestId("onboarding-waiting"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Back to integrate", () => {
    it("renders a Back button while waiting for the crash", async () => {
      mockFetchAppsFromServer.mockResolvedValue({
        status: 1,
        data: [makeApp({ id: "target-app", onboarded: false })],
      });
      await reachVerifyStep();
      expect(
        screen.getByTestId("onboarding-back-to-integrate-button"),
      ).toBeInTheDocument();
    });

    it("returns to the integrate step on click", async () => {
      mockFetchAppsFromServer.mockResolvedValue({
        status: 1,
        data: [makeApp({ id: "target-app", onboarded: false })],
      });
      await reachVerifyStep();
      await act(async () => {
        fireEvent.click(
          screen.getByTestId("onboarding-back-to-integrate-button"),
        );
      });
      expect(
        screen.getByTestId("onboarding-step-integrate"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("tab-select")).toBeInTheDocument();
      expect(
        screen.queryByTestId("onboarding-waiting"),
      ).not.toBeInTheDocument();
    });

    it("preserves the previously selected platform when going back", async () => {
      mockFetchAppsFromServer.mockResolvedValue({
        status: 1,
        data: [makeApp({ id: "target-app", onboarded: false })],
      });
      renderOnboarding({ teamId: "team-7" });
      // Pick iOS, advance to verify, go back, iOS should still be selected.
      fireEvent.click(screen.getByTestId("tab-iOS"));
      await act(async () => {
        fireEvent.click(screen.getByTestId("onboarding-next-button"));
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      await act(async () => {
        fireEvent.click(
          screen.getByTestId("onboarding-back-to-integrate-button"),
        );
      });
      expect(screen.getByTestId("tab-iOS")).toHaveAttribute(
        "data-selected",
        "true",
      );
    });

    it("stops polling once the user goes back", async () => {
      mockFetchAppsFromServer.mockResolvedValue({
        status: 1,
        data: [makeApp({ id: "target-app", onboarded: false })],
      });
      await reachVerifyStep();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      const callsBeforeBack = mockFetchAppsFromServer.mock.calls.length;
      await act(async () => {
        fireEvent.click(
          screen.getByTestId("onboarding-back-to-integrate-button"),
        );
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(15000);
      });
      expect(mockFetchAppsFromServer).toHaveBeenCalledTimes(callsBeforeBack);
    });

    it("persists the step rollback to localStorage", async () => {
      mockFetchAppsFromServer.mockResolvedValue({
        status: 1,
        data: [makeApp({ id: "target-app", onboarded: false })],
      });
      await reachVerifyStep();
      await act(async () => {
        fireEvent.click(
          screen.getByTestId("onboarding-back-to-integrate-button"),
        );
      });
      const stored = window.localStorage.getItem(
        "measure_onboarding_target-app",
      );
      expect(JSON.parse(stored!).step).toBe("integrate");
    });
  });

  describe("Cleanup", () => {
    it("stops polling after the component unmounts", async () => {
      mockFetchAppsFromServer.mockResolvedValue({
        status: 1,
        data: [makeApp({ id: "target-app", onboarded: false })],
      });
      const { unmount } = renderOnboarding({ teamId: "team-7" });
      await act(async () => {
        fireEvent.click(screen.getByTestId("onboarding-next-button"));
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      const callsBeforeUnmount = mockFetchAppsFromServer.mock.calls.length;
      unmount();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(15000);
      });
      expect(mockFetchAppsFromServer).toHaveBeenCalledTimes(callsBeforeUnmount);
    });

    it("clears localStorage when polling detects onboarded=true", async () => {
      // Seed the store at verify so the component renders the polling
      // state immediately on mount.
      filtersStoreInstance.getState().setOnboardingStep("target-app", "verify");
      mockFetchAppsFromServer.mockResolvedValue({
        status: 1,
        data: [makeApp({ id: "target-app", onboarded: true })],
      });
      renderOnboarding({ teamId: "team-7" });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(
        window.localStorage.getItem("measure_onboarding_target-app"),
      ).toBeNull();
    });
  });
});

// ============================================================
// Persistence
// ============================================================

describe("Onboarding — Persistence", () => {
  const STORAGE_KEY = "measure_onboarding_app-persist";

  beforeEach(() => {
    mockApps = [makeApp({ id: "app-persist", onboarded: false })];
    mockSelectedApp = mockApps[0];
  });

  describe("Saving", () => {
    it("persists the platform on tab switch", () => {
      renderOnboarding();
      fireEvent.click(screen.getByTestId("tab-iOS"));
      const stored = window.localStorage.getItem(STORAGE_KEY);
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!).platform).toBe("iOS");
    });

    it("persists the step on Next click", () => {
      renderOnboarding();
      fireEvent.click(screen.getByTestId("onboarding-next-button"));
      const stored = window.localStorage.getItem(STORAGE_KEY);
      expect(JSON.parse(stored!).step).toBe("verify");
    });

    it("scopes the storage key to the app id", () => {
      mockApps = [makeApp({ id: "scoped-id", onboarded: false })];
      mockSelectedApp = mockApps[0];
      renderOnboarding();
      fireEvent.click(screen.getByTestId("tab-Flutter"));
      expect(
        window.localStorage.getItem("measure_onboarding_scoped-id"),
      ).not.toBeNull();
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("persists the flutterPlatform on sub-selector click", () => {
      renderOnboarding();
      fireEvent.click(screen.getByTestId("tab-Flutter"));
      fireEvent.click(screen.getByTestId("onboarding-flutter-platform-iOS"));
      const stored = window.localStorage.getItem(STORAGE_KEY);
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!).flutterPlatform).toBe("iOS");
    });
  });

  describe("Hydration", () => {
    it("restores the platform from storage on mount", () => {
      // Pre-seed localStorage and rebuild the store so it picks up the
      // entry on construction, the way a fresh page load would.
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          step: "integrate",
          platform: "Flutter",
          flutterPlatform: "Android",
        }),
      );
      filtersStoreInstance = createFiltersStore();
      renderOnboarding();
      expect(screen.getByTestId("tab-Flutter")).toHaveAttribute(
        "data-selected",
        "true",
      );
    });

    it("restores the step from storage on mount", () => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          step: "verify",
          platform: "iOS",
          flutterPlatform: "Android",
        }),
      );
      filtersStoreInstance = createFiltersStore();
      renderOnboarding();
      expect(screen.getByTestId("onboarding-step-verify")).toBeInTheDocument();
      // The integrate section header still renders (collapsed with a check),
      // but the form content (snippets / Next button) should not.
      expect(screen.queryByTestId("tab-select")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("onboarding-next-button"),
      ).not.toBeInTheDocument();
    });

    it("restores the flutterPlatform sub-selection from storage on mount", () => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          step: "integrate",
          platform: "Flutter",
          flutterPlatform: "iOS",
        }),
      );
      filtersStoreInstance = createFiltersStore();
      renderOnboarding();
      expect(
        screen.getByTestId("onboarding-flutter-platform-iOS"),
      ).toHaveAttribute("data-selected", "true");
      // Sub-platform iOS → iOS-side Flutter snippets should be visible.
      expect(screen.getByTestId("snippet-ios-podfile")).toBeInTheDocument();
      expect(screen.queryByTestId("snippet-manifest")).not.toBeInTheDocument();
    });

    it("uses defaults when no stored state exists", () => {
      renderOnboarding();
      expect(
        screen.getByTestId("onboarding-step-integrate"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("tab-Android")).toHaveAttribute(
        "data-selected",
        "true",
      );
    });

    it("ignores malformed storage entries", () => {
      window.localStorage.setItem(STORAGE_KEY, "{not valid json");
      renderOnboarding();
      expect(
        screen.getByTestId("onboarding-step-integrate"),
      ).toBeInTheDocument();
    });

    it("ignores entries with missing fields", () => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ step: "verify" }),
      );
      renderOnboarding();
      // step field is present but platform/flutterPlatform are missing —
      // entry is rejected, so we fall back to the integrate default rather
      // than partial trust.
      expect(
        screen.getByTestId("onboarding-step-integrate"),
      ).toBeInTheDocument();
    });
  });

  describe("Mount race", () => {
    // Regression: hydrate fires setState in the same effect flush as persist,
    // so persist would otherwise read stale defaults and overwrite storage
    // with them before the hydrated state lands. React Strict Mode's
    // mount → unmount → mount probe makes this especially visible.
    it("preserves stored state through a StrictMode mount cycle", () => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          step: "integrate",
          platform: "Flutter",
          flutterPlatform: "iOS",
        }),
      );
      render(
        <React.StrictMode>
          <Onboarding teamId="team-1" initConfig={mockInitConfig} />
        </React.StrictMode>,
      );
      const stored = window.localStorage.getItem(STORAGE_KEY);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.step).toBe("integrate");
      expect(parsed.platform).toBe("Flutter");
      expect(parsed.flutterPlatform).toBe("iOS");
    });

    it("preserves stored state across a re-render with the same selected app", () => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          step: "verify",
          platform: "iOS",
          flutterPlatform: "Android",
        }),
      );
      const { rerender } = renderOnboarding();
      rerender(<Onboarding teamId="team-1" initConfig={mockInitConfig} />);
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(stored!);
      expect(parsed.step).toBe("verify");
      expect(parsed.platform).toBe("iOS");
      expect(parsed.flutterPlatform).toBe("Android");
    });
  });
});
