import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import TraceZoomBanner from "@/app/components/trace/zoom_banner";

describe("TraceZoomBanner", () => {
  it("renders formatted start and end", () => {
    render(<TraceZoomBanner startMs={120} endMs={2500} onReset={jest.fn()} />);
    expect(screen.getByText(/120ms.*2\.5s/)).toBeTruthy();
  });

  it("calls onReset when reset button clicked", () => {
    const onReset = jest.fn();
    render(<TraceZoomBanner startMs={0} endMs={1000} onReset={onReset} />);
    fireEvent.click(screen.getByLabelText("Reset zoom"));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
