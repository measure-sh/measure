import type { FilterOperator, FilterValue } from "../../api/filter_types";

const valuelessOperators: FilterOperator[] = ["is_set", "is_not_set"];

const oneValueOperators: FilterOperator[] = [
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "before",
  "after",
];

// Operators that accept free-form text rather than key-provided values.
const typedTextOperators: FilterOperator[] = [
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
];

export function operatorTakesValues(operator: FilterOperator | null): boolean {
  return operator !== null && !valuelessOperators.includes(operator);
}

export function operatorTakesOneValue(
  operator: FilterOperator | null,
): boolean {
  return operator !== null && oneValueOperators.includes(operator);
}

export function operatorTakesTypedText(
  operator: FilterOperator | null,
): boolean {
  return operator !== null && typedTextOperators.includes(operator);
}

// Preserve values when switching between operators with compatible value types.
type ValueKind = "list" | "text" | "scalar" | "date" | "none";

function valueKindForOperator(operator: FilterOperator | null): ValueKind {
  if (operator === null) {
    return "none";
  }
  if (operator === "in" || operator === "not_in") {
    return "list";
  }
  if (typedTextOperators.includes(operator)) {
    return "text";
  }
  if (operator === "before" || operator === "after" || operator === "between") {
    return "date";
  }
  if (valuelessOperators.includes(operator)) {
    return "none";
  }
  return "scalar";
}

export function valuesAfterOperatorChange(
  previous: FilterOperator | null,
  next: FilterOperator | null,
  values: FilterValue[],
): FilterValue[] {
  if (!operatorTakesValues(next)) {
    return [];
  }
  if (valueKindForOperator(previous) !== valueKindForOperator(next)) {
    return [];
  }
  if (operatorTakesOneValue(next)) {
    return values.slice(0, 1);
  }
  return values;
}

export const operatorLabels: Record<FilterOperator, string> = {
  in: "is",
  not_in: "is not",
  contains: "contains",
  not_contains: "does not contain",
  starts_with: "starts with",
  ends_with: "ends with",
  eq: "=",
  neq: "≠",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  is_set: "is set",
  is_not_set: "is not set",
  before: "before",
  after: "after",
  between: "between",
};
