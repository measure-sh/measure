import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { useColumnResizer } from "@/app/components/trace/use_column_resizer";

function Harness({
  initial = 0.5,
  min = 0.25,
  max = 0.75,
}: {
  initial?: number;
  min?: number;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fraction, setFraction] = useState(initial);
  const onPointerDown = useColumnResizer({
    containerRef: ref,
    min,
    max,
    setFraction,
  });
  return (
    <div ref={ref} data-testid="container">
      <span data-testid="fraction">{fraction}</span>
      <div
        data-testid="resizer"
        onPointerDown={onPointerDown}
        style={{ width: 6 }}
      />
    </div>
  );
}

function mockBoundingRect(el: Element, width = 1000) {
  el.getBoundingClientRect = () => ({
    width,
    left: 0,
    right: width,
    top: 0,
    bottom: 50,
    height: 50,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

beforeEach(() => {
  Element.prototype.setPointerCapture = jest.fn();
  Element.prototype.releasePointerCapture = jest.fn();
});

describe("useColumnResizer", () => {
  it("updates the fraction during a pointer drag", () => {
    render(<Harness />);
    mockBoundingRect(screen.getByTestId("container"));

    fireEvent.pointerDown(screen.getByTestId("resizer"), {
      pointerId: 1,
      clientX: 500,
    });
    act(() => {
      window.dispatchEvent(
        new MouseEvent("pointermove", { clientX: 700, bubbles: true }),
      );
    });
    // 700 / 1000 = 0.7
    expect(screen.getByTestId("fraction").textContent).toBe("0.7");
  });

  it("clamps to the min/max bounds", () => {
    render(<Harness />);
    mockBoundingRect(screen.getByTestId("container"));

    fireEvent.pointerDown(screen.getByTestId("resizer"), {
      pointerId: 1,
      clientX: 500,
    });
    act(() => {
      window.dispatchEvent(
        new MouseEvent("pointermove", { clientX: 9000, bubbles: true }),
      );
    });
    expect(screen.getByTestId("fraction").textContent).toBe("0.75");

    act(() => {
      window.dispatchEvent(
        new MouseEvent("pointermove", { clientX: -500, bubbles: true }),
      );
    });
    expect(screen.getByTestId("fraction").textContent).toBe("0.25");
  });

  it("captures + releases pointer on the resizer element", () => {
    render(<Harness />);
    mockBoundingRect(screen.getByTestId("container"));
    const resizer = screen.getByTestId("resizer");
    const capture = jest.spyOn(resizer, "setPointerCapture");
    const release = jest.spyOn(resizer, "releasePointerCapture");

    fireEvent.pointerDown(resizer, { pointerId: 7, clientX: 500 });
    expect(capture).toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(
        new MouseEvent("pointerup", { clientX: 500, bubbles: true }),
      );
    });
    expect(release).toHaveBeenCalled();
  });

  it("ignores pointer moves after the pointer is released", () => {
    render(<Harness initial={0.5} />);
    mockBoundingRect(screen.getByTestId("container"));

    fireEvent.pointerDown(screen.getByTestId("resizer"), {
      pointerId: 1,
      clientX: 500,
    });
    act(() => {
      window.dispatchEvent(
        new MouseEvent("pointerup", { clientX: 500, bubbles: true }),
      );
    });
    // Move after release should not change anything.
    act(() => {
      window.dispatchEvent(
        new MouseEvent("pointermove", { clientX: 900, bubbles: true }),
      );
    });
    expect(screen.getByTestId("fraction").textContent).toBe("0.5");
  });

  it("does nothing when containerRef is null", () => {
    const Inner = () => {
      const ref = useRef<HTMLDivElement>(null); // never attached
      const [fraction, setFraction] = useState(0.5);
      const onPointerDown = useColumnResizer({
        containerRef: ref,
        min: 0,
        max: 1,
        setFraction,
      });
      return (
        <div>
          <span data-testid="fraction">{fraction}</span>
          <div data-testid="resizer" onPointerDown={onPointerDown} />
        </div>
      );
    };
    render(<Inner />);
    fireEvent.pointerDown(screen.getByTestId("resizer"), {
      pointerId: 1,
      clientX: 500,
    });
    // No throw; no state change.
    expect(screen.getByTestId("fraction").textContent).toBe("0.5");
  });
});
