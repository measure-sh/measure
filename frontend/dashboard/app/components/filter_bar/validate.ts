import type { FilterKey, FilterOperator } from "../../api/filter_types";
import { operatorLabels } from "./operators";
import {
  buildExprTree,
  type ConditionGroup,
  type ConditionRow,
  isConditionGroup,
  isRowComplete,
} from "./conditions";
import {
  MAX_CONDITIONS,
  MAX_DEPTH,
  MAX_FILTER_BYTES,
  MAX_VALUES_PER_CONDITION,
} from "./limits";
import type { FilterExprIssue } from "../../api/api_error";
import { type ExprToken, formatFilterExpr, type ParseOutcome } from "./parse";

function conditionRowsIn(group: ConditionGroup): ConditionRow[] {
  return group.children.flatMap((child) =>
    isConditionGroup(child) ? conditionRowsIn(child) : [child],
  );
}

// Conditions contribute one level to the server's depth calculation. An empty
// group counts as though it held a condition, so a group that could only be
// filled by exceeding the depth limit is rejected when added.
function filterDepth(group: ConditionGroup): number {
  const depths = group.children.map((child) =>
    isConditionGroup(child) ? filterDepth(child) : 1,
  );
  return 1 + Math.max(1, ...depths);
}

// Return the first server limit this filter exceeds.
export function validateLimits(filter: ConditionGroup): string | null {
  const rows = conditionRowsIn(filter);

  if (rows.length > MAX_CONDITIONS) {
    return `A filter can hold at most ${MAX_CONDITIONS} conditions`;
  }

  if (filterDepth(filter) > MAX_DEPTH) {
    return "Filter groups cannot be nested deeper";
  }

  const complete = rows.filter(isRowComplete);

  if (complete.some((row) => row.values.length > MAX_VALUES_PER_CONDITION)) {
    return `A condition can hold at most ${MAX_VALUES_PER_CONDITION} values`;
  }

  const exprTree = buildExprTree(filter);
  if (exprTree) {
    const bytes = new TextEncoder().encode(formatFilterExpr(exprTree)).length;
    if (bytes > MAX_FILTER_BYTES) {
      return `A filter can be at most ${MAX_FILTER_BYTES} bytes long`;
    }
  }

  return null;
}

// A part of the filter that parses but cannot be used against the app on
// screen, and the span of text it covers.
export type KeyIssue = {
  message: string;
  start: number;
  end: number;
};

/**
 * Checks that every key in a filter is offered by the app and entity,
 * and that every operator is supported by its key. Each error includes the
 * span it covers, allowing the text editor to show the issue inline rather
 * than failing the request. Value validity is left to the server to check.
 */
export function findUnusableConditions(
  tokens: ExprToken[],
  keys: FilterKey[],
): KeyIssue[] {
  const byName = new Map(keys.map((key) => [key.name, key]));
  const issues: KeyIssue[] = [];

  tokens.forEach((token, index) => {
    if (token.kind !== "key") {
      return;
    }

    const key = byName.get(token.text);
    if (!key) {
      issues.push({
        message: `There is no filter named ${token.text}`,
        start: token.start,
        end: token.end,
      });
      return;
    }

    // A condition consists of a key, a colon, and an operator, so the operator
    // starts two tokens after the key. If parsing stopped before the operator,
    // it is absent, and the parser reports the error separately.
    const operator = tokens[index + 2];
    if (operator?.kind !== "operator") {
      return;
    }

    const operatorName = operator.text as FilterOperator;
    if (!(operatorName in operatorLabels)) {
      issues.push({
        message: `There is no operator named ${operator.text}`,
        start: operator.start,
        end: operator.end,
      });
      return;
    }

    if (!key.operators.includes(operatorName)) {
      issues.push({
        message: `${key.label} cannot be compared with ${operator.text}`,
        start: operator.start,
        end: operator.end,
      });
    }
  });

  return issues;
}

/**
All issues in a filter, ordered by where they appear in the text.
These checks answer different questions, so they cannot be combined into
one pass. Parsing stops at the first part it cannot read, key validation checks
every token that was read, and limit checks apply to the conditions rather
than the text. Collecting them here keeps the messages and editor marks in
sync.
*/
export function findFilterIssues(
  parsed: ParseOutcome,
  keys: FilterKey[],
  conditions: ConditionGroup,
): FilterExprIssue[] {
  // An issue with nowhere to point sorts last.
  const inOrder: { at: number; issue: FilterExprIssue }[] = [];

  if (!parsed.ok) {
    inOrder.push({
      at: parsed.error.position,
      issue: { message: parsed.error.message },
    });
  }

  for (const keyIssue of findUnusableConditions(parsed.tokens, keys)) {
    inOrder.push({
      at: keyIssue.start,
      issue: {
        message: keyIssue.message,
        span: { start: keyIssue.start, end: keyIssue.end },
      },
    });
  }

  if (parsed.ok) {
    const message = validateLimits(conditions);
    if (message) {
      inOrder.push({ at: Number.MAX_SAFE_INTEGER, issue: { message } });
    }
  }

  return inOrder.sort((one, other) => one.at - other.at).map((it) => it.issue);
}
