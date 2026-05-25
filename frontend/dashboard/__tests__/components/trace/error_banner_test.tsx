import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import TraceErrorBanner from "@/app/components/trace/error_banner";

function setup(
  overrides: Partial<React.ComponentProps<typeof TraceErrorBanner>> = {},
) {
  const props = {
    count: 3,
    index: 0,
    onPrev: jest.fn(),
    onNext: jest.fn(),
    ...overrides,
  };
  render(<TraceErrorBanner {...props} />);
  return props;
}

describe("TraceErrorBanner", () => {
  it("renders count + index", () => {
    setup({ count: 4, index: 1 });
    expect(screen.getByText("4 error spans")).toBeTruthy();
    expect(screen.getByText("2 / 4")).toBeTruthy();
  });

  it("uses singular wording for count=1", () => {
    setup({ count: 1, index: 0 });
    expect(screen.getByText("1 error span")).toBeTruthy();
  });

  it("calls onPrev when prev button clicked", () => {
    const { onPrev } = setup();
    fireEvent.click(screen.getByLabelText("Previous error"));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("calls onNext when next button clicked", () => {
    const { onNext } = setup();
    fireEvent.click(screen.getByLabelText("Next error"));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("has a stable data-testid", () => {
    setup();
    expect(screen.getByTestId("trace-error-banner")).toBeTruthy();
  });
});
