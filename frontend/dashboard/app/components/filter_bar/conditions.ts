import type {
  ExprTree,
  FilterKey,
  FilterOperator,
  FilterValue,
} from "../../api/filter_types";
import { operatorTakesOneValue, operatorTakesValues } from "./operators";

// A row is only drawn after its key is selected, so `key` and `operator` are
// always set.
export type ConditionRow = {
  id: string;
  key: FilterKey;
  operator: FilterOperator;
  values: FilterValue[];
};

export type ConditionGroup = {
  id: string;
  logicalOperator: "and" | "or";
  children: ConditionOrGroup[];
};

export type ConditionOrGroup = ConditionRow | ConditionGroup;

const noConditions: ConditionGroup = {
  id: "filter",
  logicalOperator: "and",
  children: [],
};

export function isConditionGroup(
  item: ConditionOrGroup,
): item is ConditionGroup {
  return "children" in item;
}

/**
 * Conditions and groups are identified by their position in the filter. The
 * whole filter is `filter`, and each condition or group inside it is its
 * parent's ID followed by its index among its siblings. Because the IDs are
 * position-based, they remain stable when a group is rebuilt, allowing React
 * to reuse the existing rows instead of treating them as new elements.
 */
export function childId(parentId: string, index: number): string {
  return `${parentId}.${index}`;
}

// ─── Conditions to expression tree ───────────────────────────────────────

export function isRowComplete(row: ConditionRow): boolean {
  if (!operatorTakesValues(row.operator)) {
    return row.values.length === 0;
  }
  if (row.values.length === 0) {
    return false;
  }
  // The server refuses a one-value operator that carries more than one value.
  return !operatorTakesOneValue(row.operator) || row.values.length === 1;
}

// Incomplete conditions and empty groups are left out.
export function buildExprTree(filter: ConditionGroup): ExprTree | null {
  const children = buildChildren(filter);
  if (children.length === 0) {
    return null;
  }
  return { logical_operator: filter.logicalOperator, children };
}

function buildChildren(group: ConditionGroup): ExprTree[] {
  const children: ExprTree[] = [];

  for (const child of group.children) {
    if (!isConditionGroup(child)) {
      if (isRowComplete(child)) {
        children.push({
          condition: {
            key_name: child.key.name,
            operator: child.operator,
            values: operatorTakesValues(child.operator)
              ? child.values
              : undefined,
          },
        });
      }
      continue;
    }

    const inner = buildChildren(child);
    if (inner.length > 0) {
      children.push({
        logical_operator: child.logicalOperator,
        children: inner,
      });
    }
  }

  return children;
}

// ─── Expression tree to conditions ───────────────────────────────────────

/**
 * The conditions to draw for a tree. A condition with a key the current
 * entity does not offer is left out, since a row needs the key to draw its
 * label, operators and values.
 */
export function buildConditionGroup(
  exprTree: ExprTree | null,
  keys: FilterKey[],
): ConditionGroup {
  const byName = new Map(keys.map((key) => [key.name, key]));

  const toGroup = (exprGroup: ExprTree, id: string): ConditionGroup => {
    const children: ConditionOrGroup[] = [];

    for (const exprChild of exprGroup.children ?? []) {
      const at = childId(id, children.length);

      if (!exprChild.condition) {
        const inner = toGroup(exprChild, at);
        /**
         * A group emptied by dropping conditions for unavailable keys no longer
         * represents what the filter specified, so it is not rendered. An
         * originally empty group, however, is one the user added but has not yet
         * filled, so it is preserved.
         */
        if (
          inner.children.length > 0 ||
          (exprChild.children ?? []).length === 0
        ) {
          children.push(inner);
        }
        continue;
      }

      const key = byName.get(exprChild.condition.key_name);
      if (key) {
        children.push({
          id: at,
          key,
          operator: exprChild.condition.operator,
          values: exprChild.condition.values ?? [],
        });
      }
    }

    return {
      id,
      logicalOperator: exprGroup.logical_operator ?? "and",
      children,
    };
  };

  if (!exprTree) {
    return noConditions;
  }

  /**
   * The bar renders the entire filter as a group and needs a group to add to,
   * so a filter containing a single condition is wrapped in its own group.
   */
  if (exprTree.condition) {
    return toGroup(
      { logical_operator: "and", children: [exprTree] },
      noConditions.id,
    );
  }
  return toGroup(exprTree, noConditions.id);
}

// ─── Editing ─────────────────────────────────────────────────────────────

// Recursively replaces the condition or group with the matching id;
// `change` returns its replacement or null to remove it.
function replaceById(
  group: ConditionGroup,
  id: string,
  change: (item: ConditionOrGroup) => ConditionOrGroup | null,
): ConditionGroup {
  const children: ConditionOrGroup[] = [];

  for (const child of group.children) {
    if (child.id === id) {
      const changed = change(child);
      if (changed) {
        children.push(changed);
      }
    } else if (isConditionGroup(child)) {
      const changed = replaceById(child, id, change);
      // Removing the last condition in a group removes the group with it,
      // while a group that was already empty stays.
      if (changed.children.length > 0 || child.children.length === 0) {
        children.push(changed);
      }
    } else {
      children.push(child);
    }
  }

  return { ...group, children };
}

export function updateRow(
  filter: ConditionGroup,
  rowId: string,
  patch: Partial<ConditionRow>,
): ConditionGroup {
  return replaceById(filter, rowId, (item) =>
    isConditionGroup(item) ? item : { ...item, ...patch },
  );
}

export function updateGroup(
  filter: ConditionGroup,
  groupId: string,
  change: (group: ConditionGroup) => ConditionGroup,
): ConditionGroup {
  if (filter.id === groupId) {
    return change(filter);
  }
  return replaceById(filter, groupId, (item) =>
    isConditionGroup(item) ? change(item) : item,
  );
}

export function dropById(filter: ConditionGroup, id: string): ConditionGroup {
  return replaceById(filter, id, () => null);
}

// Removes the condition or group with this id only when `shouldDrop` says so
// about what is found there, and leaves the filter alone when there is nothing
// with that id.
export function dropWhen(
  filter: ConditionGroup,
  id: string,
  shouldDrop: (item: ConditionOrGroup) => boolean,
): ConditionGroup {
  return replaceById(filter, id, (item) => (shouldDrop(item) ? null : item));
}

// Reading order, not sibling order.
export function rowBefore(
  filter: ConditionGroup,
  id: string,
): ConditionRow | null {
  const drawn: ConditionOrGroup[] = [];

  const collect = (group: ConditionGroup) => {
    for (const child of group.children) {
      drawn.push(child);
      if (isConditionGroup(child)) {
        collect(child);
      }
    }
  };
  collect(filter);

  const at = drawn.findIndex((item) => item.id === id);
  if (at < 0) {
    return null;
  }

  for (let before = at - 1; before >= 0; before--) {
    const item = drawn[before];
    if (!isConditionGroup(item)) {
      return item;
    }
  }
  return null;
}
