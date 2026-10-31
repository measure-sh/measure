import Notifications from "@/app/[teamId]/notif_prefs/page";
import { promiseParams } from "@/__tests__/helpers/promise_params";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

const mockToastPositive = jest.fn();
const mockToastNegative = jest.fn();
const mockMutateAsync = jest.fn();

let mockNotifPrefsData: any = undefined;
let mockNotifPrefsStatus: string = "pending";
let mockMailingListPrefsData: any = undefined;
const mockMarketingMutateAsync = jest.fn();
let mockIsCloud = false;

jest.mock("@/app/components/toast", () => ({
  toastPositive: (...args: any[]) => mockToastPositive(...args),
  toastNegative: (...args: any[]) => mockToastNegative(...args),
}));

jest.mock("@/app/api/api_calls", () => ({
  __esModule: true,
  emptyNotifPrefs: {
    error_spike: true,
    app_hang_spike: true,
    bug_report: true,
    daily_summary: true,
  },
}));

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useNotifPrefsQuery: () => ({
    data: mockNotifPrefsData,
    status: mockNotifPrefsStatus,
    error: null,
    isLoading: mockNotifPrefsStatus === "pending",
    isError: mockNotifPrefsStatus === "error",
    isSuccess: mockNotifPrefsStatus === "success",
  }),
  useSaveNotifPrefsMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  useMailingListPrefsQuery: () => ({
    data: mockMailingListPrefsData,
  }),
  useSaveMailingListPrefsMutation: () => ({
    mutateAsync: mockMarketingMutateAsync,
    isPending: false,
  }),
}));

jest.mock("@/app/utils/env_utils", () => ({
  __esModule: true,
  isCloud: () => mockIsCloud,
}));

jest.mock("@/app/components/switch", () => ({
  Switch: ({ checked, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      onChange={() => onCheckedChange?.(!checked)}
      {...props}
    />
  ),
}));

jest.mock("@/app/components/button", () => ({
  Button: ({ children, loading, disabled, ...props }: any) => (
    <button disabled={disabled || loading} {...props}>
      {children}
    </button>
  ),
}));

jest.mock("@/app/components/checkbox", () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      role="checkbox"
      checked={checked}
      onChange={() => onCheckedChange?.(!checked)}
      {...props}
    />
  ),
}));

jest.mock("@/app/components/skeleton", () => ({
  Skeleton: ({ className, ...props }: any) => (
    <div data-testid="skeleton-mock" className={className} {...props} />
  ),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const defaultNotifPrefs = {
  error_spike: true,
  app_hang_spike: true,
  bug_report: true,
  daily_summary: true,
};

describe("Notifications page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotifPrefsData = undefined;
    mockNotifPrefsStatus = "pending";
    mockMailingListPrefsData = undefined;
    mockIsCloud = false;
  });

  it("renders loading state initially", () => {
    mockNotifPrefsStatus = "pending";
    render(<Notifications params={promiseParams({ teamId: "team-1" })} />);
    expect(screen.getAllByTestId("skeleton-mock").length).toBeGreaterThan(0);
  });

  it("renders four notification checkboxes with correct labels", () => {
    mockNotifPrefsStatus = "success";
    mockNotifPrefsData = defaultNotifPrefs;
    render(<Notifications params={promiseParams({ teamId: "team-1" })} />);

    expect(screen.getByText("Crash Spike email")).toBeInTheDocument();
    expect(screen.getByText("ANR spike email")).toBeInTheDocument();
    expect(screen.getByText("Bug Reports")).toBeInTheDocument();
    expect(screen.getByText("Daily Summary")).toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(4);
    checkboxes.forEach((cb) => {
      expect(cb).toBeChecked();
    });
  });

  it("renders table headers", () => {
    mockNotifPrefsStatus = "success";
    mockNotifPrefsData = defaultNotifPrefs;
    render(<Notifications params={promiseParams({ teamId: "team-1" })} />);

    expect(screen.getByText("Alert type")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("renders description text", () => {
    mockNotifPrefsStatus = "success";
    mockNotifPrefsData = defaultNotifPrefs;
    render(<Notifications params={promiseParams({ teamId: "team-1" })} />);

    expect(
      screen.getByText(/Choose which email notifications you want to receive/),
    ).toBeInTheDocument();
  });

  it("save button is disabled when no changes", () => {
    mockNotifPrefsStatus = "success";
    mockNotifPrefsData = defaultNotifPrefs;
    render(<Notifications params={promiseParams({ teamId: "team-1" })} />);

    expect(screen.getByText("Crash Spike email")).toBeInTheDocument();

    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toBeDisabled();
  });

  it("toggling a checkbox enables save button", () => {
    mockNotifPrefsStatus = "success";
    mockNotifPrefsData = defaultNotifPrefs;
    render(<Notifications params={promiseParams({ teamId: "team-1" })} />);

    expect(screen.getByText("Crash Spike email")).toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);

    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).not.toBeDisabled();
  });

  it("saves updated preferences with correct payload", async () => {
    mockNotifPrefsStatus = "success";
    mockNotifPrefsData = defaultNotifPrefs;
    mockMutateAsync.mockResolvedValue(undefined);
    render(<Notifications params={promiseParams({ teamId: "team-1" })} />);

    expect(screen.getByText("Crash Spike email")).toBeInTheDocument();

    // Uncheck first checkbox (error_spike)
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);

    const saveButton = screen.getByRole("button", { name: "Save" });
    fireEvent.click(saveButton);

    // The mutateAsync should be called with the updated prefs
    expect(mockMutateAsync).toHaveBeenCalledWith({
      notifPrefs: {
        error_spike: false,
        app_hang_spike: true,
        bug_report: true,
        daily_summary: true,
      },
    });
  });

  it("shows success toast after save", async () => {
    mockNotifPrefsStatus = "success";
    mockNotifPrefsData = defaultNotifPrefs;
    mockMutateAsync.mockResolvedValue(undefined);
    render(<Notifications params={promiseParams({ teamId: "team-1" })} />);

    expect(screen.getByText("Crash Spike email")).toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // Wait for the async save to complete
    await Promise.resolve();
    await Promise.resolve();

    expect(mockToastPositive).toHaveBeenCalledWith(
      "Notification preferences saved",
    );
  });

  it("shows error toast on save failure", async () => {
    mockNotifPrefsStatus = "success";
    mockNotifPrefsData = defaultNotifPrefs;
    mockMutateAsync.mockRejectedValue(new Error("something went wrong"));
    render(<Notifications params={promiseParams({ teamId: "team-1" })} />);

    expect(screen.getByText("Crash Spike email")).toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // Wait for the async save to complete
    await Promise.resolve();
    await Promise.resolve();

    expect(mockToastNegative).toHaveBeenCalledWith(
      "Error saving notification preferences",
      "something went wrong",
    );
  });

  it("renders team-scoped disclaimer", () => {
    mockNotifPrefsStatus = "success";
    mockNotifPrefsData = defaultNotifPrefs;
    render(<Notifications params={promiseParams({ teamId: "team-1" })} />);

    expect(screen.getByText(/does not affect your team/)).toBeInTheDocument();
  });

  it("shows error when fetch fails", () => {
    mockNotifPrefsStatus = "error";
    render(<Notifications params={promiseParams({ teamId: "team-1" })} />);

    expect(
      screen.getByText(/Failed to fetch notification preferences/),
    ).toBeInTheDocument();
  });

  describe("mailing list", () => {
    beforeEach(() => {
      mockIsCloud = true;
      mockNotifPrefsStatus = "success";
      mockNotifPrefsData = defaultNotifPrefs;
    });

    it("is hidden when the mailing list is not enabled", () => {
      mockMailingListPrefsData = { enabled: false, subscribed: false };
      render(<Notifications params={promiseParams({ teamId: "team-1" })} />);

      expect(screen.queryByText("Newsletter")).not.toBeInTheDocument();
      expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    });

    it("is hidden for the sandbox team", () => {
      mockMailingListPrefsData = { enabled: true, subscribed: false };
      render(
        <Notifications
          params={promiseParams({
            teamId: "sandbox",
          })}
        />,
      );

      expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    });

    it("shows the user's current consent", () => {
      mockMailingListPrefsData = { enabled: true, subscribed: true };
      render(<Notifications params={promiseParams({ teamId: "team-1" })} />);

      expect(screen.getByText("Newsletter")).toBeInTheDocument();
      expect(screen.getByRole("switch")).toBeChecked();
    });

    it("subscribes from settings when the switch is turned on", async () => {
      mockMailingListPrefsData = { enabled: true, subscribed: false };
      mockMarketingMutateAsync.mockResolvedValue(undefined);
      render(<Notifications params={promiseParams({ teamId: "team-1" })} />);

      fireEvent.click(screen.getByRole("switch"));
      await Promise.resolve();
      await Promise.resolve();

      expect(mockMarketingMutateAsync).toHaveBeenCalledWith({
        subscribed: true,
        attribution: "settings",
      });
      expect(mockToastPositive).toHaveBeenCalledWith(
        "Subscribed to the Measure newsletter",
      );
    });

    it("shows an error toast when saving fails", async () => {
      mockMailingListPrefsData = { enabled: true, subscribed: true };
      mockMarketingMutateAsync.mockRejectedValue(new Error("boom"));
      render(<Notifications params={promiseParams({ teamId: "team-1" })} />);

      fireEvent.click(screen.getByRole("switch"));
      await Promise.resolve();
      await Promise.resolve();

      expect(mockMarketingMutateAsync).toHaveBeenCalledWith({
        subscribed: false,
        attribution: "settings",
      });
      expect(mockToastNegative).toHaveBeenCalledWith(
        "Couldn't update your newsletter subscription",
        "boom",
      );
    });
  });
});
