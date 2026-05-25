import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  RowSpacerCell,
  RowState,
  ThreadCell,
  cellRowClasses,
} from "@/app/components/trace/cells";
import { PreparedSpan } from "@/app/components/trace/model";

function makePreparedSpan(overrides: Partial<PreparedSpan> = {}): PreparedSpan {
  return {
    span_name: "foo",
    span_id: "id-1",
    parent_id: "",
    status: 0,
    start_time: "2024-01-01T00:00:00.000Z",
    end_time: "2024-01-01T00:00:01.000Z",
    duration: 1000,
    thread_name: "main",
    checkpoints: null,
    depth: 0,
    ancestorIds: [],
    ancestorColors: [],
    directChildCount: 0,
    subtreeSize: 0,
    colorKey: "id-1",
    startMs: 0,
    endMs: 1000,
    ...overrides,
  };
}

function makeRowState(overrides: Partial<RowState> = {}): RowState {
  return {
    span: makePreparedSpan(),
    isSelected: false,
    isDimmed: false,
    isSearchMatch: false,
    ...overrides,
  };
}

describe("cellRowClasses", () => {
  it("always includes the base interactive + focus-ring classes", () => {
    const c = cellRowClasses({
      isDimmed: false,
      isSearchMatch: false,
      isHovered: false,
      errorHighlightActive: false,
    });
    expect(c).toContain("cursor-pointer");
    expect(c).toContain("focus-visible:ring-ring/50");
  });

  it("applies amber tint when isSearchMatch", () => {
    const c = cellRowClasses({
      isDimmed: false,
      isSearchMatch: true,
      isHovered: false,
      errorHighlightActive: false,
    });
    expect(c).toContain("bg-amber-50");
  });

  it("applies hover background when hovered and not a search match", () => {
    const c = cellRowClasses({
      isDimmed: false,
      isSearchMatch: false,
      isHovered: true,
      errorHighlightActive: false,
    });
    expect(c).toContain("bg-muted/50");
  });

  it("search-match wins over hover (no muted bg)", () => {
    const c = cellRowClasses({
      isDimmed: false,
      isSearchMatch: true,
      isHovered: true,
      errorHighlightActive: false,
    });
    expect(c).toContain("bg-amber-50");
    expect(c).not.toContain("bg-muted/50");
  });

  it("applies opacity-50 when dimmed (default mode)", () => {
    const c = cellRowClasses({
      isDimmed: true,
      isSearchMatch: false,
      isHovered: false,
      errorHighlightActive: false,
    });
    expect(c).toContain("opacity-50");
  });

  it("applies opacity-30 when dimmed and error highlight is active", () => {
    const c = cellRowClasses({
      isDimmed: true,
      isSearchMatch: false,
      isHovered: false,
      errorHighlightActive: true,
    });
    expect(c).toContain("opacity-30");
    expect(c).not.toContain("opacity-50");
  });

  it("hover defeats dim opacity", () => {
    const c = cellRowClasses({
      isDimmed: true,
      isSearchMatch: false,
      isHovered: true,
      errorHighlightActive: false,
    });
    expect(c).not.toContain("opacity-50");
    expect(c).toContain("bg-muted/50");
  });
});

describe("RowSpacerCell", () => {
  it("calls onSelect on click and routes hover via span_id", () => {
    const onSelect = jest.fn();
    const onHover = jest.fn();
    const { container } = render(
      <RowSpacerCell
        rowState={makeRowState({ span: makePreparedSpan({ span_id: "abc" }) })}
        isHovered={false}
        errorHighlightActive={false}
        onSelect={onSelect}
        onHover={onHover}
      />,
    );
    const cell = container.firstChild as HTMLElement;
    fireEvent.click(cell);
    expect(onSelect).toHaveBeenCalledTimes(1);
    fireEvent.mouseEnter(cell);
    expect(onHover).toHaveBeenCalledWith("abc");
    fireEvent.mouseLeave(cell);
    expect(onHover).toHaveBeenCalledWith(undefined);
  });

  it("is marked aria-hidden so screen readers skip it", () => {
    const { container } = render(
      <RowSpacerCell
        rowState={makeRowState()}
        isHovered={false}
        errorHighlightActive={false}
        onSelect={jest.fn()}
        onHover={jest.fn()}
      />,
    );
    expect(
      (container.firstChild as HTMLElement).getAttribute("aria-hidden"),
    ).toBe("true");
  });
});

describe("ThreadCell", () => {
  it("renders the thread name and exposes it via title for tooltips", () => {
    render(
      <ThreadCell
        rowState={makeRowState({
          span: makePreparedSpan({ thread_name: "okhttp" }),
        })}
        isHovered={false}
        errorHighlightActive={false}
        onSelect={jest.fn()}
        onHover={jest.fn()}
      />,
    );
    expect(screen.getByText("okhttp")).toBeTruthy();
    expect(screen.getByTitle("okhttp")).toBeTruthy();
  });

  it("inherits row state classes via the shared shell", () => {
    const { container } = render(
      <ThreadCell
        rowState={makeRowState({ isDimmed: true })}
        isHovered={false}
        errorHighlightActive={false}
        onSelect={jest.fn()}
        onHover={jest.fn()}
      />,
    );
    expect((container.firstChild as HTMLElement).className).toContain(
      "opacity-50",
    );
  });
});
