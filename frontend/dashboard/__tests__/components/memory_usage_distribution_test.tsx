import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

jest.mock("@nivo/bar", () => ({
  ResponsiveBar: () => <div data-testid="distribution" />,
}));
jest.mock("next-themes", () => ({ useTheme: () => ({ theme: "light" }) }));
import MemoryUsageDistribution from "@/app/components/memory_usage_distribution";

it.each([null, []])("shows No Data for an empty API response: %p", (data) => {
  render(
    <MemoryUsageDistribution query={{ status: "success", data } as any} />,
  );
  expect(screen.getByText("No Data")).toBeInTheDocument();
  expect(screen.queryByTestId("distribution")).not.toBeInTheDocument();
});
