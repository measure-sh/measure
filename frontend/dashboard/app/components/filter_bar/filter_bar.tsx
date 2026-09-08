"use client";

import { Plus, SlidersHorizontal, Type, X } from "lucide-react";
import {
  Fragment,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type App } from "../../api/api_calls";
import type { FilterExprIssue } from "../../api/api_error";
import { type FilterKey, type FilterOperator } from "../../api/filter_types";
import { useFilterKeysQuery } from "../../query/hooks";
import { toastNegative } from "../toast";
import { Skeleton } from "../skeleton";
import DropdownSelect, { DropdownSelectType } from "../dropdown_select";
import AppSelect from "./app_select";
import DateRangeSelect, {
  DateRange,
  type DateSelection,
  type UncheckedDateRange,
} from "./date_range_select";
import {
  buildConditionGroup,
  buildExprTree,
  childId,
  type ConditionGroup,
  type ConditionOrGroup,
  type ConditionRow,
  dropById,
  isConditionGroup,
  isRowComplete,
  rowBefore,
  updateGroup,
  updateRow,
} from "./conditions";
import {
  operatorLabels,
  operatorTakesOneValue,
  operatorTakesTypedText,
  operatorTakesValues,
  valuesAfterOperatorChange,
} from "./operators";
import { findFilterIssues, validateLimits } from "./validate";
import KeyPicker, { OperatorPicker } from "./key_picker";
import { customKeyNamesIn, formatFilterExpr, parseFilterExpr } from "./parse";
import FilterTextEditor from "./filter_text_editor";
import ValuePicker from "./value_picker";

const SHOWN_VALUE_COUNT = 2;

export type FilterSelection = {
  app: App;
  date: DateSelection;
  filterExpr: string | null;
  rootSpanName: string | null;
  discarded: boolean;
};

export type FilterChange = Partial<{
  appId: string;
  dateRange: UncheckedDateRange;
  filterExpr: string | null;
  rootSpanName: string | null;
}>;

interface FilterBarProps {
  entity: string;
  placeholder?: string;
  value: FilterSelection | null;
  apps: App[];
  keys: FilterKey[] | null;
  keyGroups: string[];
  keysUnavailable: boolean;
  spanNames?: string[] | null;
  filterExprIssues?: FilterExprIssue[] | null;
  // False hides the filter expression editor and keeps the app and date
  // range controls.
  showFilterExpr?: boolean;
  onChange: (change: FilterChange) => void;
}

type OpenPicker =
  | { kind: "keys"; groupId: string }
  | { kind: "values"; rowId: string };

type PendingEdit = {
  appId: string;
  date: DateSelection;
  rootSpanName: string | null;
  tree: ConditionGroup;
  from: string | null;
  to: string | null;
  picker: OpenPicker | null;
  // Changing the key or operator of a complete condition empties its values
  // and opens the value picker. Dismissing that picker without a value puts
  // the filter back to this text, so the condition is not lost.
  revert?: string | null;
};

function writeFilterExpr(conditions: ConditionGroup): string | null {
  const tree = buildExprTree(conditions);
  return tree ? formatFilterExpr(tree) : null;
}

function sameDate(a: DateSelection, b: DateSelection): boolean {
  if (a.dateRange !== b.dateRange) {
    return false;
  }
  return (
    a.dateRange !== DateRange.Custom ||
    (a.startDate === b.startDate && a.endDate === b.endDate)
  );
}

function settle(edit: PendingEdit, value: FilterSelection): PendingEdit | null {
  const filterExpr = value.filterExpr;
  if (
    value.discarded ||
    edit.appId !== value.app.id ||
    !sameDate(edit.date, value.date) ||
    (edit.rootSpanName !== null && edit.rootSpanName !== value.rootSpanName)
  ) {
    return null;
  }
  if (edit.from !== filterExpr && edit.to !== filterExpr) {
    return null;
  }
  if (edit.to === filterExpr && edit.picker === null) {
    return null;
  }
  if (edit.from === filterExpr) {
    return edit;
  }
  return { ...edit, from: edit.to };
}

function rowIn(tree: ConditionGroup, rowId: string): ConditionRow | null {
  for (const child of tree.children) {
    if (child.id === rowId && !isConditionGroup(child)) {
      return child;
    }
    if (isConditionGroup(child)) {
      const found = rowIn(child, rowId);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function withPickerClosed(
  tree: ConditionGroup,
  picker: OpenPicker | null,
): ConditionGroup {
  if (picker === null) {
    return tree;
  }
  if (picker.kind === "keys") {
    return dropById(tree, picker.groupId);
  }
  const row = rowIn(tree, picker.rowId);
  return row !== null && !isRowComplete(row)
    ? dropById(tree, picker.rowId)
    : tree;
}

function appendTo(
  tree: ConditionGroup,
  groupId: string,
  make: (id: string) => ConditionOrGroup,
): { tree: ConditionGroup; id: string } {
  let id = groupId;
  const next = updateGroup(tree, groupId, (group) => {
    id = childId(group.id, group.children.length);
    return { ...group, children: [...group.children, make(id)] };
  });
  return { tree: next, id };
}

export default function FilterBar({
  entity,
  placeholder = "Filter…",
  value,
  apps,
  keys,
  keyGroups,
  keysUnavailable,
  spanNames,
  filterExprIssues,
  showFilterExpr = true,
  onChange,
}: FilterBarProps) {
  const [keyListOpen, setKeyListOpen] = useState(false);
  const [edit, setEdit] = useState<PendingEdit | null>(null);
  const [editingAsText, setEditingAsText] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [typedText, setTypedText] = useState<string | null>(null);

  const focusedControlRef = useRef<HTMLButtonElement>(null);
  const addConditionButtonRef = useRef<HTMLButtonElement>(null);

  const filterExpr = value?.filterExpr ?? null;

  const parsedFilter = useMemo(
    () => (filterExpr ? parseFilterExpr(filterExpr, { draft: true }) : null),
    [filterExpr],
  );

  const conditions = useMemo(
    () =>
      buildConditionGroup(
        parsedFilter?.ok ? parsedFilter.tree : null,
        keys ?? [],
      ),
    [parsedFilter, keys],
  );

  const pending = edit === null || value === null ? edit : settle(edit, value);
  if (pending !== edit) {
    setEdit(pending);
  }

  const drawn = pending?.tree ?? conditions;
  const drawnText = pending !== null ? pending.to : filterExpr;
  const draftText = typedText ?? drawnText ?? "";

  const parsedDraft = useMemo(
    () => parseFilterExpr(draftText, { draft: true }),
    [draftText],
  );

  const urlCustomKeyNames = useMemo(
    () => customKeyNamesIn(parsedFilter?.tokens ?? []),
    [parsedFilter],
  );

  const typedCustomKeyNames = useMemo(
    () =>
      typedText === null
        ? urlCustomKeyNames
        : [
            ...new Set([
              ...urlCustomKeyNames,
              ...customKeyNamesIn(parsedDraft.tokens),
            ]),
          ].sort(),
    [typedText, urlCustomKeyNames, parsedDraft],
  );

  const draftKeysQuery = useFilterKeysQuery(
    typedCustomKeyNames.length > 0 ? value?.app.id : undefined,
    entity,
    typedCustomKeyNames,
  );
  const draftKeys = draftKeysQuery.data?.keys ?? keys ?? [];

  const draftConditions = useMemo(
    () =>
      buildConditionGroup(parsedDraft.ok ? parsedDraft.tree : null, draftKeys),
    [parsedDraft, draftKeys],
  );

  const draftFilterExpr = useMemo(
    () => writeFilterExpr(draftConditions),
    [draftConditions],
  );

  const ownFilterIssues = useMemo(
    () =>
      draftText.trim() === ""
        ? []
        : findFilterIssues(parsedDraft, draftKeys, draftConditions),
    [draftText, parsedDraft, draftKeys, draftConditions],
  );

  const serverIssues = useMemo<FilterExprIssue[]>(() => {
    if (!filterExprIssues?.length || draftFilterExpr !== filterExpr) {
      return [];
    }
    return filterExprIssues.map((issue) => ({
      ...issue,
      span: draftText === filterExpr ? issue.span : undefined,
    }));
  }, [filterExprIssues, draftText, draftFilterExpr, filterExpr]);

  const draftFilterIssues =
    ownFilterIssues.length > 0 ? ownFilterIssues : serverIssues;

  const parserStopped = ownFilterIssues.length > 0 && !parsedDraft.ok;

  const draftIssueMessage = useMemo(() => {
    const [first, ...rest] = draftFilterIssues;
    if (!first) {
      return null;
    }
    return rest.length === 0
      ? first.message
      : `${first.message} (+${rest.length} more)`;
  }, [draftFilterIssues]);

  useEffect(() => {
    focusedControlRef.current?.focus();
  }, [focusedId]);

  if (value === null || keys === null) {
    return (
      <div className="flex flex-wrap gap-4 items-center w-full">
        <Skeleton className="h-9 w-37.5" />
        <Skeleton className="h-9 w-37.5" />
        {showFilterExpr && <Skeleton className="h-9 flex-1 min-w-64" />}
      </div>
    );
  }
  const { app, date, rootSpanName } = value;

  function baseFor(id: string | null): ConditionGroup {
    const picker = pending?.picker ?? null;
    if (picker === null) {
      return drawn;
    }
    const own =
      picker.kind === "keys" ? picker.groupId === id : picker.rowId === id;
    return own ? drawn : withPickerClosed(drawn, picker);
  }

  function send(
    tree: ConditionGroup,
    picker: OpenPicker | null,
    revert?: string | null,
  ) {
    const limit = validateLimits(tree);
    if (limit) {
      toastNegative(limit);
      return;
    }
    const text = writeFilterExpr(tree);
    if (text !== drawnText) {
      onChange({ filterExpr: text });
    }
    setEdit({
      appId: app.id,
      date,
      rootSpanName,
      tree,
      from: pending !== null ? pending.from : filterExpr,
      to: text,
      picker,
      revert,
    });
  }

  function setApp(app: App) {
    onChange({ appId: app.id, filterExpr: null, rootSpanName: null });
    setEdit(null);
    setTypedText(null);
  }

  function focusBefore(id: string) {
    const previous = rowBefore(drawn, id);
    setFocusedId(previous?.id ?? null);
    if (!previous) {
      addConditionButtonRef.current?.focus();
    }
  }

  function removeById(id: string) {
    send(dropById(baseFor(id), id), null);
    focusBefore(id);
  }

  function startRow(groupId: string, key: FilterKey) {
    const operator = key.operators[0];
    const { tree, id } = appendTo(baseFor(groupId), groupId, (rowId) => ({
      id: rowId,
      key,
      operator,
      values: [],
    }));
    send(
      tree,
      operatorTakesValues(operator) ? { kind: "values", rowId: id } : null,
    );
    setFocusedId(id);
  }

  function startGroup(parentId: string) {
    const { tree, id } = appendTo(baseFor(null), parentId, (groupId) => ({
      id: groupId,
      logicalOperator: "and",
      children: [],
    }));
    send(tree, { kind: "keys", groupId: id });
  }

  function closeKeys(groupId: string) {
    setEdit((current) =>
      current?.picker?.kind === "keys" && current.picker.groupId === groupId
        ? {
            ...current,
            tree: withPickerClosed(current.tree, current.picker),
            picker: null,
          }
        : current,
    );
  }

  function changeKey(row: ConditionRow, key: FilterKey) {
    const operator = key.operators[0];
    const opensPicker = operatorTakesValues(operator);
    send(
      updateRow(baseFor(row.id), row.id, { key, operator, values: [] }),
      opensPicker ? { kind: "values", rowId: row.id } : null,
      opensPicker && isRowComplete(row) ? drawnText : undefined,
    );
  }

  function changeOperator(row: ConditionRow, operator: FilterOperator) {
    const values = valuesAfterOperatorChange(
      row.operator,
      operator,
      row.values,
    );
    const opensPicker = operatorTakesValues(operator) && values.length === 0;
    send(
      updateRow(baseFor(row.id), row.id, { operator, values }),
      opensPicker ? { kind: "values", rowId: row.id } : null,
      opensPicker && isRowComplete(row) ? drawnText : undefined,
    );
  }

  function changeValues(
    row: ConditionRow,
    values: ConditionRow["values"],
    done: boolean,
  ) {
    send(
      updateRow(baseFor(row.id), row.id, { values }),
      done ? null : { kind: "values", rowId: row.id },
    );
  }

  function openValues(row: ConditionRow) {
    send(baseFor(row.id), { kind: "values", rowId: row.id });
  }

  function closeValues(row: ConditionRow) {
    if (pending?.picker?.kind !== "values" || pending.picker.rowId !== row.id) {
      return;
    }
    if (!isRowComplete(row) && pending.revert !== undefined) {
      const parsed = pending.revert
        ? parseFilterExpr(pending.revert, { draft: true })
        : null;
      send(
        buildConditionGroup(parsed?.ok ? parsed.tree : null, keys ?? []),
        null,
      );
      setFocusedId(row.id);
      return;
    }
    setEdit({
      ...pending,
      tree: withPickerClosed(pending.tree, pending.picker),
      picker: null,
    });
    if (!isRowComplete(row)) {
      focusBefore(row.id);
    }
  }

  function clearFilter() {
    send({ ...drawn, children: [] }, null);
    setTypedText(null);
    setFocusedId(null);
    if (!editingAsText) {
      addConditionButtonRef.current?.focus();
    }
  }

  function toggleLogicalOperator(groupId: string) {
    send(
      updateGroup(baseFor(null), groupId, (group) => ({
        ...group,
        logicalOperator: group.logicalOperator === "and" ? "or" : "and",
      })),
      null,
    );
  }

  function applyFilterText() {
    if (typedText === null || draftIssueMessage) {
      return;
    }
    send(draftConditions, null);
    setTypedText(null);
  }

  function cancelTextEditing() {
    setTypedText(null);
    setEditingAsText(false);
  }

  function toggleTextEditing() {
    if (!editingAsText) {
      setEditingAsText(true);
      return;
    }
    if (draftIssueMessage && ownFilterIssues.length > 0) {
      toastNegative(draftIssueMessage);
      return;
    }
    applyFilterText();
    setEditingAsText(false);
  }

  const editor: FilterEditor = {
    keys,
    keyGroups,
    appId: app.id,
    entity,
    focusedId,
    focusedControlRef,
    openKeysGroupId:
      pending?.picker?.kind === "keys" ? pending.picker.groupId : null,
    openValuesRowId:
      pending?.picker?.kind === "values" ? pending.picker.rowId : null,
    onChangeKey: changeKey,
    onChangeOperator: changeOperator,
    onChangeValues: changeValues,
    onOpenValues: openValues,
    onCloseValues: closeValues,
    onCloseKeys: closeKeys,
    onRemove: removeById,
    onStartRow: startRow,
    onStartGroup: startGroup,
    onToggleLogicalOperator: toggleLogicalOperator,
  };

  return (
    <div className="flex flex-wrap gap-4 items-start w-full">
      <AppSelect apps={apps} selected={app} onChange={setApp} />
      <DateRangeSelect
        selection={value.date}
        onChange={(selection) =>
          onChange({
            dateRange:
              selection.dateRange === DateRange.Custom
                ? selection
                : { ...selection, startDate: null, endDate: null },
          })
        }
      />
      {spanNames !== undefined &&
        (spanNames === null ? (
          <Skeleton className="h-9 w-37.5" />
        ) : spanNames.length > 0 ? (
          <DropdownSelect
            title="Trace Name"
            type={DropdownSelectType.SingleString}
            items={spanNames}
            initialSelected={value.rootSpanName ?? spanNames[0]}
            onChangeSelected={(item) => {
              const name = item as string;
              if (name !== value.rootSpanName) {
                onChange({ rootSpanName: name });
              }
            }}
          />
        ) : null)}

      {showFilterExpr && (
        <div className="flex-auto min-w-64">
          <div
            data-testid="filter-bar"
            aria-disabled={keysUnavailable}
            // The focus ring shows on keyboard focus only, since focus returns
            // here after every pick.
            className={`relative rounded-md border border-input bg-transparent dark:bg-input/30 shadow-xs has-focus-visible:border-ring has-focus-visible:ring-ring/50 has-focus-visible:ring-[3px] ${
              keysUnavailable ? "opacity-50 select-none" : ""
            } ${!editingAsText && !keysUnavailable ? "cursor-pointer" : ""}`}
            // A click on empty space anywhere in the bar opens the key list.
            // A click that reaches a button is left to that button.
            onClick={(e) => {
              if (editingAsText || keysUnavailable) {
                return;
              }
              if ((e.target as HTMLElement).closest("button")) {
                return;
              }
              setKeyListOpen(true);
            }}
          >
            <SlidersHorizontal className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none z-10" />

            <div className="pl-8 pr-16">
              {editingAsText ? (
                <FilterTextEditor
                  value={draftText}
                  tokens={parsedDraft.tokens}
                  issues={draftFilterIssues}
                  parserStopped={parserStopped}
                  placeholder={placeholder}
                  onChange={setTypedText}
                  onApply={applyFilterText}
                  onCancel={cancelTextEditing}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-1.5 py-1.5 min-h-9 max-h-32 overflow-y-auto">
                  {keysUnavailable && (
                    <span className="flex-1 min-w-24 h-6 font-body text-sm text-muted-foreground select-none">
                      {placeholder}
                    </span>
                  )}

                  {!keysUnavailable && (
                    <GroupChildren group={drawn} editor={editor} />
                  )}

                  {!keysUnavailable && (
                    <KeyPicker
                      keys={keys}
                      keyGroups={keyGroups}
                      selected={null}
                      open={keyListOpen}
                      onOpenChange={setKeyListOpen}
                      focusOnClose={focusedControlRef}
                      onSelect={(key) => startRow(drawn.id, key)}
                      onAddGroup={() => startGroup(drawn.id)}
                      trigger={
                        <button
                          type="button"
                          ref={addConditionButtonRef}
                          data-testid="filter-input"
                          aria-label="Add a filter"
                          // Fills the bar when it holds no conditions so the
                          // placeholder is centred, otherwise stays narrow.
                          className={`self-stretch min-h-2 text-left outline-none font-body text-sm text-muted-foreground ${
                            drawn.children.length === 0
                              ? "flex-1"
                              : "flex-none w-4"
                          }`}
                        >
                          {drawn.children.length === 0 ? placeholder : ""}
                        </button>
                      }
                    />
                  )}
                </div>
              )}
            </div>

            <div className="absolute right-2 top-1.5 flex items-center gap-0.5">
              {!keysUnavailable && (
                <button
                  type="button"
                  aria-label={
                    editingAsText ? "Edit as conditions" : "Edit as text"
                  }
                  aria-pressed={editingAsText}
                  data-testid="filter-toggle-text"
                  title={editingAsText ? "Edit as conditions" : "Edit as text"}
                  onClick={toggleTextEditing}
                  className={`h-6 w-6 inline-flex items-center justify-center rounded hover:bg-accent hover:text-foreground ${
                    editingAsText
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  <Type className="h-3 w-3" />
                </button>
              )}

              {draftText !== "" && (
                <button
                  type="button"
                  aria-label="Clear filter"
                  data-testid="filter-clear"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={clearFilter}
                  className="h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {draftIssueMessage && (
            <p
              role="alert"
              data-testid="filter-issue"
              className="mt-2 font-body text-xs text-muted-foreground"
            >
              {draftIssueMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface FilterEditor {
  keys: FilterKey[];
  keyGroups: string[];
  appId: string;
  entity: string;
  focusedId: string | null;
  focusedControlRef: RefObject<HTMLButtonElement | null>;
  openKeysGroupId: string | null;
  openValuesRowId: string | null;
  onChangeKey: (row: ConditionRow, key: FilterKey) => void;
  onChangeOperator: (row: ConditionRow, operator: FilterOperator) => void;
  onChangeValues: (
    row: ConditionRow,
    values: ConditionRow["values"],
    done: boolean,
  ) => void;
  onOpenValues: (row: ConditionRow) => void;
  onCloseValues: (row: ConditionRow) => void;
  onCloseKeys: (groupId: string) => void;
  onRemove: (id: string) => void;
  onStartRow: (groupId: string, key: FilterKey) => void;
  onStartGroup: (groupId: string) => void;
  onToggleLogicalOperator: (groupId: string) => void;
}

function GroupChildren({
  group,
  editor,
}: {
  group: ConditionGroup;
  editor: FilterEditor;
}) {
  return group.children.map((child, index) => (
    <Fragment key={child.id}>
      {index > 0 && (
        <button
          type="button"
          data-testid="filter-logical-operator"
          title="Switch between and / or"
          onClick={() => editor.onToggleLogicalOperator(group.id)}
          className="font-display text-xs uppercase text-muted-foreground px-0.5 hover:text-foreground"
        >
          {group.logicalOperator}
        </button>
      )}

      {isConditionGroup(child) ? (
        <FilterGroup group={child} editor={editor} />
      ) : (
        <FilterRow row={child} editor={editor} />
      )}
    </Fragment>
  ));
}

function FilterGroup({
  group,
  editor,
}: {
  group: ConditionGroup;
  editor: FilterEditor;
}) {
  const pickingFirstKey = group.id === editor.openKeysGroupId;

  return (
    <span
      role="group"
      aria-label="Filter group"
      data-testid="filter-group"
      className="inline-flex flex-wrap items-center gap-1.5 max-w-full min-w-0 rounded-md outline-1 outline-dashed -outline-offset-1 outline-input px-1.5"
    >
      <GroupChildren group={group} editor={editor} />

      <KeyPicker
        keys={editor.keys}
        keyGroups={editor.keyGroups}
        selected={null}
        open={pickingFirstKey ? true : undefined}
        onOpenChange={
          pickingFirstKey
            ? (open) => {
                if (!open) {
                  editor.onCloseKeys(group.id);
                }
              }
            : undefined
        }
        focusOnClose={editor.focusedControlRef}
        onSelect={(key) => editor.onStartRow(group.id, key)}
        onAddGroup={
          pickingFirstKey ? undefined : () => editor.onStartGroup(group.id)
        }
        trigger={
          <button
            type="button"
            ref={
              group.id === editor.focusedId
                ? editor.focusedControlRef
                : undefined
            }
            aria-label="Add a filter to this group"
            className="h-6 px-1 inline-flex items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
          </button>
        }
      />

      <button
        type="button"
        aria-label="Remove group"
        onClick={() => editor.onRemove(group.id)}
        className="h-6 px-1 inline-flex items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function FilterRow({
  row,
  editor,
}: {
  row: ConditionRow;
  editor: FilterEditor;
}) {
  const { keys, keyGroups, appId, entity, focusedId, focusedControlRef } =
    editor;

  return (
    <span className="inline-flex items-stretch h-6 max-w-full min-w-0 overflow-hidden rounded-sm border border-input bg-accent/80 font-display text-xs">
      <KeyPicker
        keys={keys}
        keyGroups={keyGroups}
        selected={row.key}
        onSelect={(key) => editor.onChangeKey(row, key)}
        trigger={
          <button
            type="button"
            ref={row.id === focusedId ? focusedControlRef : undefined}
            className="px-1.5 rounded-l-sm hover:bg-accent truncate max-w-40 min-w-0"
          >
            {row.key.label}
          </button>
        }
      />

      <OperatorPicker
        operators={row.key.operators}
        selected={row.operator}
        operatorLabels={operatorLabels}
        onSelect={(operator) =>
          editor.onChangeOperator(row, operator as FilterOperator)
        }
        trigger={
          <button
            type="button"
            className="px-1.5 border-x border-input text-muted-foreground hover:bg-accent whitespace-nowrap shrink-0"
          >
            {operatorLabels[row.operator]}
          </button>
        }
      />

      {operatorTakesValues(row.operator) && (
        <ValuePicker
          appId={appId}
          entity={entity}
          keyName={row.key.name}
          valueType={row.key.value_type}
          valueSuggestionMode={row.key.value_suggestion_mode}
          takesTypedText={operatorTakesTypedText(row.operator)}
          takesOneValue={operatorTakesOneValue(row.operator)}
          selected={row.values}
          onChange={(values, done) => editor.onChangeValues(row, values, done)}
          open={row.id === editor.openValuesRowId}
          onOpenChange={(open) => {
            if (open) {
              editor.onOpenValues(row);
            } else {
              editor.onCloseValues(row);
            }
          }}
          trigger={
            <button
              type="button"
              className="px-1.5 hover:bg-accent inline-flex items-center gap-1 min-w-0 overflow-hidden"
            >
              <SelectedValues values={row.values} operator={row.operator} />
            </button>
          }
        />
      )}

      <button
        type="button"
        aria-label="Remove condition"
        onClick={() => editor.onRemove(row.id)}
        className="px-1 rounded-r-sm border-l border-input text-muted-foreground hover:bg-accent hover:text-foreground shrink-0"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function SelectedValues({
  values,
  operator,
}: {
  values: ConditionRow["values"];
  operator: FilterOperator | null;
}) {
  if (values.length === 0) {
    return (
      <span className="text-muted-foreground whitespace-nowrap">
        {operatorTakesOneValue(operator) ? "<value>" : "<values>"}
      </span>
    );
  }

  return (
    <>
      {values.slice(0, SHOWN_VALUE_COUNT).map((value, index) => (
        <Fragment key={value.text}>
          {index > 0 && (
            <span className="text-muted-foreground shrink-0">
              {operator === "not_in" ? "and" : "or"}
            </span>
          )}
          <span className="truncate max-w-28 min-w-0">
            {value.label ?? value.text}
          </span>
        </Fragment>
      ))}
      {values.length > SHOWN_VALUE_COUNT && (
        <span className="text-muted-foreground whitespace-nowrap shrink-0">
          +{values.length - SHOWN_VALUE_COUNT} more
        </span>
      )}
    </>
  );
}
