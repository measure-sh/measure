// A filter has two forms. The filter expression is the text carried by a link
// or request, such as `mapping_type:in:proguard`. The expression tree is the
// same filter represented as groups and conditions, which the filter bar uses
// to draw its rows. The server parses one form into the other.

export type FilterOperator =
  | "in"
  | "not_in"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "is_set"
  | "is_not_set"
  | "before"
  | "after"
  | "between";

// Controls which values the filter bar offers for a key. `full_list` contains
// a platform-defined set that the bar lists in full. `sample` contains values
// reported by the app, too many to list, so the bar shows the most recently
// seen ones and accepts anything else the user types. `none` provides no
// suggestions; values are entered directly. A key that takes no values at all
// indicates that through its operators.
export type ValueSuggestionMode = "full_list" | "sample" | "none";

export type FilterKey = {
  name: string;
  label: string;
  description: string;
  key_group: string;
  value_type: string;
  operators: FilterOperator[];
  value_suggestion_mode: ValueSuggestionMode;
};

/**
 * Attributes for numeric keys, or null for other key types. Bounds match the
 * column type to prevent out-of-range values; int64 has no bounds because
 * JavaScript cannot represent its full range accurately and the server
 * validates it on request send.
 */
export function numberBoxAttributes(
  valueType: string,
): { step: number | "any"; min?: number; max?: number } | null {
  switch (valueType) {
    case "int32":
      return { step: 1, min: -2147483648, max: 2147483647 };
    case "uint32":
      return { step: 1, min: 0, max: 4294967295 };
    case "int64":
      return { step: 1 };
    case "float64":
      return { step: "any" };
    default:
      return null;
  }
}

// The keys an entity can be filtered by. `key_groups` is in the order the
// server wants the groups shown.
export type FilterKeysResponse = {
  keys: FilterKey[];
  key_groups: string[];
};

export type FilterValue = {
  text: string;
  label?: string;
};

export type ExprTreeCondition = {
  key_name: string;
  operator: FilterOperator;
  values?: FilterValue[];
};

// Each ExprTree is either a group joining its children with and/or, or a
// single condition.
export type ExprTree = {
  logical_operator?: "and" | "or";
  children?: ExprTree[];
  condition?: ExprTreeCondition;
};
