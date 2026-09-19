import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import HighMemoryUsageSessions from "@/app/components/high_memory_usage_sessions";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe("HighMemoryUsageSessions", () => {
  it.each([
    [0, "0 MB"],
    [262144, "256 MB"],
  ])(
    "shows iOS available memory at peak utilization, including zero (%s)",
    (available, label) => {
      render(
        <HighMemoryUsageSessions
          teamId="team"
          onNext={jest.fn()}
          onPrev={jest.fn()}
          query={
            {
              status: "success",
              isFetching: false,
              data: {
                meta: { next: false, previous: false },
                results: [
                  {
                    session_id: "session",
                    app_id: "app",
                    first_event_time: "2026-09-18T05:00:00Z",
                    peak_memory_kb: 1048576,
                    peak_memory_limit_utilization: 0.8,
                    available_memory_at_peak_utilization_kb: available,
                    attribute: {
                      app_version: "1.0",
                      app_build: "1",
                      os_name: "ios",
                      os_version: "26",
                      device_model: "iPhone",
                      device_manufacturer: "Apple",
                      device_total_memory: 8388608,
                    },
                  },
                ],
              },
            } as any
          }
        />,
      );
      expect(
        screen.getByText(`${label} available at peak utilization`),
      ).toBeInTheDocument();
      expect(
        screen.getByText("80% of estimated app limit (peak)"),
      ).toBeInTheDocument();
      expect(screen.queryByText(/RAM/)).not.toBeInTheDocument();
    },
  );
});
