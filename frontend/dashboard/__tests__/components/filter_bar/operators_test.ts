import { describe, expect, it } from "@jest/globals";

import type { FilterOperator } from "@/app/api/filter_types";
import {
  operatorTakesOneValue,
  operatorTakesTypedText,
  operatorTakesValues,
  valuesAfterOperatorChange,
} from "@/app/components/filter_bar/operators";

describe("what a condition keeps when its operator changes", () => {
  const versions = [{ text: "1.0" }, { text: "1.1" }, { text: "1.2" }];

  it("keeps the whole selection between operators wanting a list", () => {
    expect(valuesAfterOperatorChange("in", "not_in", versions)).toEqual(
      versions,
    );
  });

  it("keeps a typed fragment between operators wanting one", () => {
    expect(
      valuesAfterOperatorChange("contains", "starts_with", [{ text: "1.0" }]),
    ).toEqual([{ text: "1.0" }]);
  });

  it("keeps a number between comparisons", () => {
    expect(valuesAfterOperatorChange("gt", "lte", [{ text: "1024" }])).toEqual([
      { text: "1024" },
    ]);
  });

  it("clears a picked list when the operator wants typed text", () => {
    expect(valuesAfterOperatorChange("in", "starts_with", versions)).toEqual(
      [],
    );
  });

  it("clears typed text when the operator wants a picked list", () => {
    expect(
      valuesAfterOperatorChange("starts_with", "in", [{ text: "1.0" }]),
    ).toEqual([]);
  });

  it("keeps a date between operators wanting one", () => {
    const day = [{ text: "2026-01-01T00:00:00Z" }];
    expect(valuesAfterOperatorChange("before", "after", day)).toEqual(day);
  });

  it("clears a date when the operator wants a picked list", () => {
    expect(
      valuesAfterOperatorChange("before", "in", [
        { text: "2026-01-01T00:00:00Z" },
      ]),
    ).toEqual([]);
  });

  it("clears everything when the operator takes no values", () => {
    expect(valuesAfterOperatorChange("in", "is_set", versions)).toEqual([]);
  });

  it("says which operators are typed into rather than picked from a list", () => {
    for (const operator of [
      "contains",
      "not_contains",
      "starts_with",
      "ends_with",
    ] as FilterOperator[]) {
      expect(operatorTakesTypedText(operator)).toBe(true);
    }
    for (const operator of [
      "in",
      "not_in",
      "is_set",
      "gt",
    ] as FilterOperator[]) {
      expect(operatorTakesTypedText(operator)).toBe(false);
    }
  });

  it("says which operators take values at all, and how many", () => {
    expect(operatorTakesValues("in")).toBe(true);
    expect(operatorTakesValues("is_set")).toBe(false);
    expect(operatorTakesOneValue("starts_with")).toBe(true);
    expect(operatorTakesOneValue("in")).toBe(false);
  });
});
