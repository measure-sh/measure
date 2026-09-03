import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { DateTime } from "luxon";
import { formatIsoDateForDateTimeInputField } from "@/app/utils/time_utils";

jest.mock("@/app/components/dropdown_select", () => ({
  __esModule: true,
  DropdownSelectType: { SingleString: "SingleString" },
  default: ({ items, initialSelected, onChangeSelected }: any) => (
    <div data-testid="range-dropdown" data-selected={initialSelected}>
      {items.map((item: string) => (
        <button
          key={item}
          data-testid={`range-${item}`}
          onClick={() => onChangeSelected(item)}
        >
          {item}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("@/app/components/input", () => ({
  __esModule: true,
  Input: (props: any) => <input {...props} />,
}));

import DateRangeSelect, {
  DateRange,
  type DateSelection,
  isValidDateRange,
  pickDateRange,
  toDateSelection,
} from "@/app/components/filter_bar/date_range_select";

const noStoredRange: DateSelection = {
  dateRange: "",
  startDate: "",
  endDate: "",
};

const storedRange = (
  dateRange: string,
  startDate = "2026-01-01T00:00:00.000Z",
  endDate = "2026-01-02T00:00:00.000Z",
): DateSelection => ({ dateRange, startDate, endDate });

const noRequestedRange = { dateRange: null, startDate: null, endDate: null };

describe("isValidDateRange", () => {
  it("takes a range the picker offers", () => {
    expect(
      isValidDateRange({ ...noRequestedRange, dateRange: "Last Week" }),
    ).toBe(true);
  });

  it("refuses a range nothing goes by, and a range that is missing", () => {
    expect(
      isValidDateRange({ ...noRequestedRange, dateRange: "Last Fortnight" }),
    ).toBe(false);
    expect(isValidDateRange(noRequestedRange)).toBe(false);
  });

  it("takes a custom range of two timestamps in the right order", () => {
    expect(
      isValidDateRange({
        dateRange: DateRange.Custom,
        startDate: "2026-01-01T00:00:00.000Z",
        endDate: "2026-01-02T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("refuses a custom range that ends before it starts, or reads as no date", () => {
    expect(
      isValidDateRange({
        dateRange: DateRange.Custom,
        startDate: "2026-01-02T00:00:00.000Z",
        endDate: "2026-01-01T00:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      isValidDateRange({
        dateRange: DateRange.Custom,
        startDate: "whenever",
        endDate: "2026-01-01T00:00:00.000Z",
      }),
    ).toBe(false);
  });
});

describe("toDateSelection", () => {
  it("counts a named range back from now rather than trusting the dates given", () => {
    const selection = toDateSelection({
      dateRange: DateRange.LastHour,
      startDate: "1999-01-01T00:00:00.000Z",
      endDate: "1999-01-02T00:00:00.000Z",
    })!;

    const start = DateTime.fromISO(selection.startDate);
    const end = DateTime.fromISO(selection.endDate);
    expect(end.diff(start, "hours").hours).toBeCloseTo(1, 1);
    expect(Math.abs(end.diffNow("seconds").seconds)).toBeLessThan(5);
  });

  it("keeps the timestamps a custom range was given", () => {
    const selection = toDateSelection({
      dateRange: DateRange.Custom,
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: "2026-01-02T00:00:00.000Z",
    })!;

    expect(selection.dateRange).toBe(DateRange.Custom);
    expect(DateTime.fromISO(selection.startDate).toUTC().toISO()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    expect(DateTime.fromISO(selection.endDate).toUTC().toISO()).toBe(
      "2026-01-02T00:00:00.000Z",
    );
  });

  it("reads as nothing for a range name no range goes by", () => {
    expect(
      toDateSelection({ ...noRequestedRange, dateRange: "Last 7 Fortnights" }),
    ).toBeNull();
  });
});

describe("pickDateRange", () => {
  it("takes the range that was asked for", () => {
    const picked = pickDateRange(
      { ...noRequestedRange, dateRange: DateRange.LastWeek },
      storedRange(DateRange.LastHour),
    );

    expect(picked.dateRange).toBe(DateRange.LastWeek);
  });

  it("falls back to the range another page left on the store", () => {
    const picked = pickDateRange(
      noRequestedRange,
      storedRange(DateRange.LastWeek),
    );

    expect(picked.dateRange).toBe(DateRange.LastWeek);
  });

  it("falls back to the last six hours when neither names a range", () => {
    const picked = pickDateRange(noRequestedRange, noStoredRange);

    expect(picked).toEqual({
      dateRange: DateRange.Last6Hours,
      startDate: null,
      endDate: null,
    });
  });

  it("drops a range name no range goes by", () => {
    const picked = pickDateRange(
      { ...noRequestedRange, dateRange: "Last 7 Fortnights" },
      noStoredRange,
    );

    expect(picked.dateRange).toBe(DateRange.Last6Hours);
  });

  it("keeps a custom range as it was given", () => {
    const requested = {
      dateRange: DateRange.Custom,
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: "2026-01-02T00:00:00.000Z",
    };

    expect(pickDateRange(requested, noStoredRange)).toEqual(requested);
  });

  it.each([
    ["a start that is not a date", "yesterday", "2026-01-02T00:00:00.000Z"],
    ["an end that is not a date", "2026-01-01T00:00:00.000Z", "soon"],
    [
      "a start after its end",
      "2026-01-02T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    ],
    ["no timestamps at all", null, null],
  ])("drops a custom range with %s", (_case, startDate, endDate) => {
    const picked = pickDateRange(
      { dateRange: DateRange.Custom, startDate, endDate },
      noStoredRange,
    );

    expect(picked.dateRange).toBe(DateRange.Last6Hours);
  });

  it("falls back to the store when the custom range asked for cannot be read", () => {
    const picked = pickDateRange(
      { dateRange: DateRange.Custom, startDate: "yesterday", endDate: null },
      storedRange(DateRange.LastWeek),
    );

    expect(picked.dateRange).toBe(DateRange.LastWeek);
  });

  it("keeps a custom range another page left on the store", () => {
    const picked = pickDateRange(
      noRequestedRange,
      storedRange(DateRange.Custom),
    );

    expect(picked).toEqual(storedRange(DateRange.Custom));
  });
});

const timestampInputs = () =>
  Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]'),
  );

describe("DateRangeSelect", () => {
  const custom: DateSelection = {
    dateRange: DateRange.Custom,
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: "2026-01-02T00:00:00.000Z",
  };

  it("shows the range it was given", () => {
    render(
      <DateRangeSelect
        selection={storedRange(DateRange.LastWeek)}
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByTestId("range-dropdown")).toHaveAttribute(
      "data-selected",
      DateRange.LastWeek,
    );
  });

  it("reports a named range with timestamps counted from now", () => {
    const onChange = jest.fn();
    render(
      <DateRangeSelect
        selection={storedRange(DateRange.LastWeek)}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByTestId(`range-${DateRange.LastHour}`));

    const reported = (onChange.mock.calls[0] as any[])[0] as DateSelection;
    expect(reported.dateRange).toBe(DateRange.LastHour);
    const start = DateTime.fromISO(reported.startDate);
    const end = DateTime.fromISO(reported.endDate);
    expect(end.diff(start, "hours").hours).toBeCloseTo(1, 1);
  });

  it("reports nothing when the range picked is the one showing", () => {
    const onChange = jest.fn();
    render(
      <DateRangeSelect
        selection={storedRange(DateRange.LastWeek)}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByTestId(`range-${DateRange.LastWeek}`));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the timestamps when Custom Range is picked", () => {
    const onChange = jest.fn();
    render(
      <DateRangeSelect
        selection={storedRange(DateRange.LastWeek)}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByTestId(`range-${DateRange.Custom}`));

    expect(onChange).toHaveBeenCalledWith({
      dateRange: DateRange.Custom,
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: "2026-01-02T00:00:00.000Z",
    });
  });

  it("shows two timestamp inputs for a custom range", () => {
    render(<DateRangeSelect selection={custom} onChange={jest.fn()} />);

    expect(timestampInputs()).toHaveLength(2);
  });

  it("reports an edited start", () => {
    const onChange = jest.fn();
    render(<DateRangeSelect selection={custom} onChange={onChange} />);

    const [start] = timestampInputs();
    fireEvent.change(start, { target: { value: "2026-01-01T06:00" } });

    const reported = (onChange.mock.calls[0] as any[])[0] as DateSelection;
    expect(DateTime.fromISO(reported.startDate).hour).toBe(6);
    expect(reported.endDate).toBe(custom.endDate);
  });

  it("refuses a start after the end", () => {
    const onChange = jest.fn();
    render(<DateRangeSelect selection={custom} onChange={onChange} />);

    const [start] = timestampInputs();
    fireEvent.change(start, { target: { value: "2026-01-03T00:00" } });

    expect(onChange).not.toHaveBeenCalled();
    expect(start).toHaveValue(
      formatIsoDateForDateTimeInputField(custom.startDate),
    );
  });

  it("refuses an end before the start", () => {
    const onChange = jest.fn();
    render(<DateRangeSelect selection={custom} onChange={onChange} />);

    const [, end] = timestampInputs();
    fireEvent.change(end, { target: { value: "2025-12-31T00:00" } });

    expect(onChange).not.toHaveBeenCalled();
    expect(end).toHaveValue(formatIsoDateForDateTimeInputField(custom.endDate));
  });

  it("shows the range it is re-rendered with", () => {
    const { rerender } = render(
      <DateRangeSelect selection={custom} onChange={jest.fn()} />,
    );
    rerender(
      <DateRangeSelect
        selection={{ ...custom, endDate: "2026-01-05T00:00:00.000Z" }}
        onChange={jest.fn()}
      />,
    );

    const [, end] = timestampInputs();
    expect(end).toHaveValue(
      formatIsoDateForDateTimeInputField("2026-01-05T00:00:00.000Z"),
    );
  });

  it("refuses an end in the future", () => {
    const onChange = jest.fn();
    render(<DateRangeSelect selection={custom} onChange={onChange} />);

    const [, end] = timestampInputs();
    fireEvent.change(end, { target: { value: "2999-01-01T00:00" } });

    expect(onChange).not.toHaveBeenCalled();
  });
});
