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
import {
  type FilterKey,
  type FilterOperator,
  type FilterValue,
} from "../../api/filter_types";
import {
  useAppsQuery,
  useFilterKeysQuery,
  useRootSpanNamesQuery,
} from "../../query/hooks";
import { toastNegative } from "../toast";
import { useFiltersStore } from "../../stores/provider";
import { Skeleton } from "../skeleton";
import DropdownSelect, { DropdownSelectType } from "../dropdown_select";
import AppSelect from "./app_select";
import DateRangeSelect, {
  DateRange,
  type DateSelection,
  isValidDateRange,
  type UncheckedDateRange,
  pickDateRange,
  toDateSelection,
} from "./date_range_select";
import {
  buildConditionGroup,
  buildDraftTree,
  buildExprTree,
  childId,
  type ConditionGroup,
  type ConditionOrGroup,
  type ConditionRow,
  dropById,
  isConditionGroup,
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
import {
  findFilterIssues,
  findUnusableConditions,
  validateLimits,
} from "./validate";
import KeyPicker, { OperatorPicker } from "./key_picker";
import { formatFilterExpr, parseFilterExpr } from "./parse";
import FilterTextEditor from "./filter_text_editor";
import ValuePicker from "./value_picker";

export const filterExprUrlKey = "filter_expr";

const SHOWN_VALUE_COUNT = 2;

function writeFilterExpr(conditions: ConditionGroup): string | null {
  const tree = buildExprTree(conditions);
  return tree ? formatFilterExpr(tree) : null;
}

export type ReadyFilterState = Extract<FilterState, { status: "ready" }>;

export type FilterState =
  | { status: "pending" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      app: App;
      date: DateSelection;
      filterExpr: string | null;
      rootSpanName: string | null;
      // True when nothing requested was discarded.
      appliedAsRequested: boolean;
    };

export type FilterRequest = {
  appId: string | null;
  dateRange: UncheckedDateRange;
  // The filter as drawn, which can hold a condition with no value yet.
  filterExpr: string | null;
  rootSpanName: string | null;
};

interface FilterBarProps {
  teamId: string;
  entity: string;
  placeholder?: string;
  requestedAppId: string | null;
  requestedDateRange: UncheckedDateRange;
  requestedFilterExpr: string | null;
  filterExprIssues?: FilterExprIssue[] | null;
  showRootSpanSelector?: boolean;
  requestedRootSpanName?: string | null;
  onRequestChange: (change: Partial<FilterRequest>) => void;
  onFilterChange: (state: FilterState) => void;
}

export default function FilterBar({
  teamId,
  entity,
  placeholder = "Filter…",
  requestedAppId,
  requestedDateRange,
  requestedFilterExpr,
  filterExprIssues,
  showRootSpanSelector = false,
  requestedRootSpanName = null,
  onRequestChange,
  onFilterChange,
}: FilterBarProps) {
  const store = useFiltersStore();
  const rememberedAppId = useFiltersStore((s) => s.selectedApp?.id);

  const [keyListOpen, setKeyListOpen] = useState(false);
  const [editingAsText, setEditingAsText] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const [typedText, setTypedText] = useState<string | null>(null);

  // Focus follows a condition as it is added, and moves to the preceding
  // condition when it is removed.
  const focusedControlRef = useRef<HTMLButtonElement>(null);
  const addConditionButtonRef = useRef<HTMLButtonElement>(null);

  const appsQuery = useAppsQuery(teamId);
  const apps = useMemo(() => appsQuery.data ?? [], [appsQuery.data]);

  const selectedApp =
    apps.find((app) => app.id === requestedAppId) ??
    apps.find((app) => app.id === rememberedAppId) ??
    apps[0] ??
    null;

  useEffect(() => {
    if (selectedApp && selectedApp.id !== rememberedAppId) {
      store.setSelectedApp(selectedApp);
    }
  }, [selectedApp?.id]);

  const parsedRequestedFilter = useMemo(
    () =>
      requestedFilterExpr
        ? parseFilterExpr(requestedFilterExpr, { draft: true })
        : null,
    [requestedFilterExpr],
  );

  // The keys listing caps how many custom keys it returns, so a custom key
  // the requested expression specifies can be missing from it. Asking the query
  // for those names resolves them, and the discard check below then keeps
  // the expression.
  const requestedCustomKeyNames = useMemo(() => {
    const names = (parsedRequestedFilter?.tokens ?? [])
      .filter(
        (token) => token.kind === "key" && token.text.startsWith("custom."),
      )
      .map((token) => token.text);
    return [...new Set(names)].sort();
  }, [parsedRequestedFilter]);

  // A custom key typed into the text editor can be beyond the listing cap
  // as well, so names in the draft join the request. A draft name is only
  // sent once its condition has an operator, which keeps the query key
  // stable while the user is still typing the key name itself.
  const queriedCustomKeyNames = useMemo(() => {
    const parsedDraft =
      typedText !== null ? parseFilterExpr(typedText, { draft: true }) : null;
    const draftNames = (parsedDraft?.tokens ?? [])
      .filter(
        (token, index, tokens) =>
          token.kind === "key" &&
          token.text.startsWith("custom.") &&
          tokens[index + 2]?.kind === "operator",
      )
      .map((token) => token.text);
    return [...new Set([...requestedCustomKeyNames, ...draftNames])].sort();
  }, [typedText, requestedCustomKeyNames]);

  const keysQuery = useFilterKeysQuery(
    selectedApp?.id,
    entity,
    queriedCustomKeyNames,
  );

  const rootSpanNamesQuery = useRootSpanNamesQuery(
    showRootSpanSelector ? selectedApp : null,
  );
  // The server answers null when the app has never
  // reported a trace; both mean there is nothing to select.
  const rootSpanNames = useMemo(
    () => rootSpanNamesQuery.data ?? [],
    [rootSpanNamesQuery.data],
  );

  const resolvedRootSpanName = useMemo(() => {
    if (!showRootSpanSelector || rootSpanNames.length === 0) {
      return null;
    }
    if (
      requestedAppId === selectedApp?.id &&
      requestedRootSpanName &&
      rootSpanNames.includes(requestedRootSpanName)
    ) {
      return requestedRootSpanName;
    }
    return rootSpanNames[0];
  }, [
    showRootSpanSelector,
    rootSpanNames,
    requestedAppId,
    requestedRootSpanName,
    selectedApp?.id,
  ]);

  // The requested date range takes precedence over the persisted store range.
  const pickedDateRange = pickDateRange(requestedDateRange, {
    dateRange: store.selectedDateRange,
    startDate: store.selectedStartDate,
    endDate: store.selectedEndDate,
  });
  // A relative range is counted back from now, so the window is computed
  // once per label and does not move between renders.
  const customDateRange = pickedDateRange.dateRange === DateRange.Custom;
  const date = useMemo(
    () => toDateSelection(pickedDateRange)!,
    [
      pickedDateRange.dateRange,
      customDateRange ? pickedDateRange.startDate : null,
      customDateRange ? pickedDateRange.endDate : null,
    ],
  );

  useEffect(() => {
    store.setSelectedDateRange(date.dateRange);
    store.setSelectedStartDate(date.startDate);
    store.setSelectedEndDate(date.endDate);
  }, [date]);

  useEffect(() => {
    if (appsQuery.status === "pending") {
      store.setApps([], "pending");
      return;
    }
    if (appsQuery.status === "error") {
      store.setApps([], "error");
      return;
    }

    const loaded = appsQuery.data;
    store.setApps(loaded, loaded.length === 0 ? "no-apps" : "loaded");
  }, [appsQuery.status, appsQuery.data]);

  const keys = keysQuery.data?.keys ?? [];
  const keyGroups = keysQuery.data?.key_groups ?? [];

  const checkingRequestedFilter =
    parsedRequestedFilter !== null && keysQuery.isPending;

  // A condition with no value yet is drawn but not filtered by.
  const requestConditions = useMemo(
    () =>
      buildConditionGroup(
        parsedRequestedFilter?.ok ? parsedRequestedFilter.tree : null,
        keys,
      ),
    [parsedRequestedFilter, keys],
  );

  const requestedFilterDiscarded = useMemo(
    () =>
      parsedRequestedFilter !== null &&
      !keysQuery.isPending &&
      (!parsedRequestedFilter.ok ||
        findUnusableConditions(parsedRequestedFilter.tokens, keys).length > 0 ||
        validateLimits(requestConditions) !== null),
    [parsedRequestedFilter, keys, keysQuery.isPending, requestConditions],
  );

  const draftFilterExpr =
    typedText ?? (requestedFilterDiscarded ? "" : (requestedFilterExpr ?? ""));

  const parsedDraftFilter = useMemo(
    () => parseFilterExpr(draftFilterExpr, { draft: true }),
    [draftFilterExpr],
  );

  const draftConditions = useMemo(
    () =>
      buildConditionGroup(
        parsedDraftFilter.ok ? parsedDraftFilter.tree : null,
        keys,
      ),
    [parsedDraftFilter, keys],
  );

  const currentFilterExpr = useMemo(
    () =>
      requestedFilterDiscarded ? null : writeFilterExpr(requestConditions),
    [requestedFilterDiscarded, requestConditions],
  );

  // The canonical form of the draft. This makes filters that differ only in
  // spacing or in brackets around a single value compare equal.
  const draftAppliedExpr = useMemo(
    () => writeFilterExpr(draftConditions),
    [draftConditions],
  );

  // Case                           |  Bar                 |  Page
  // -----------------------------------------------------------------------------
  // draft fault the bar catches    |  message, marks       | keeps its rows
  // server refuses the filter      |  message              | blank
  // builds request fails otherwise |  nothing              | fetch error
  // apps or keys cannot be fetched |  skeleton or disabled | fetch error
  // the team has no apps           |  skeleton             | a prompt to add one
  // request names one it can't use |  falls back to default| rows as normal, toast
  //
  // The filter is cleared only in the last case.
  const ownFilterIssues = useMemo(
    () =>
      draftFilterExpr.trim() === ""
        ? []
        : findFilterIssues(parsedDraftFilter, keys, draftConditions),
    [draftFilterExpr, parsedDraftFilter, keys, draftConditions],
  );

  // Server issues belong to the submitted expression. Clear them when the draft
  // changes semantically, and keep their spans only while the submitted text is unchanged.
  const serverIssues = useMemo<FilterExprIssue[]>(() => {
    if (!filterExprIssues?.length || draftAppliedExpr !== currentFilterExpr) {
      return [];
    }

    return filterExprIssues.map((issue) => ({
      ...issue,
      span: draftFilterExpr === currentFilterExpr ? issue.span : undefined,
    }));
  }, [filterExprIssues, draftFilterExpr, draftAppliedExpr, currentFilterExpr]);

  // Prefer local validation; server issues apply only when local validation pass.
  const draftFilterIssues =
    ownFilterIssues.length > 0 ? ownFilterIssues : serverIssues;

  const parserStopped = ownFilterIssues.length > 0 && !parsedDraftFilter.ok;

  const draftIssueMessage = useMemo(() => {
    const [first, ...rest] = draftFilterIssues;
    if (!first) {
      return null;
    }
    return rest.length === 0
      ? first.message
      : `${first.message} (+${rest.length} more)`;
  }, [draftFilterIssues]);

  // The requested app, date, filter expression and root span name can each
  // be invalid for this app. We discard those, use defaults instead and we
  // inform the user via a toast.
  const appDiscarded =
    requestedAppId !== null &&
    appsQuery.status === "success" &&
    !appsQuery.data.some((app: App) => app.id === requestedAppId);

  const dateDiscarded =
    requestedDateRange.dateRange !== null &&
    !isValidDateRange(requestedDateRange);

  const rootSpanNameDiscarded =
    showRootSpanSelector &&
    requestedRootSpanName !== null &&
    requestedAppId === selectedApp?.id &&
    rootSpanNamesQuery.isSuccess &&
    !rootSpanNames.includes(requestedRootSpanName);

  const anythingDiscarded =
    appDiscarded ||
    dateDiscarded ||
    rootSpanNameDiscarded ||
    requestedFilterDiscarded;

  const appliedAsRequested = !anythingDiscarded;

  // The readiness of the app, date and filter expression, before the root
  // span selector is considered. The bar's own controls render once this is
  // ready, so a slow or failed root span names fetch leaves the app select
  // usable.
  const baseFilterState = useMemo<
    | { status: "pending" }
    | { status: "error"; message: string }
    | {
        status: "ready";
        app: App;
        date: DateSelection;
        filterExpr: string | null;
        appliedAsRequested: boolean;
      }
  >(() => {
    if (appsQuery.status === "error") {
      return {
        status: "error",
        message: "Error fetching apps, please refresh page to try again",
      };
    }
    if (appsQuery.status === "success" && appsQuery.data.length === 0) {
      return {
        status: "error",
        message:
          "Looks like you don't have any apps yet. Get started by creating your first app!",
      };
    }
    if (keysQuery.isError) {
      return {
        status: "error",
        message: "Error fetching filters, please refresh page to try again",
      };
    }

    // A requested expression can only be checked once the keys have loaded.
    // Applying an expression the server would reject would waste a request and
    // replace the page content with an error.
    if (!selectedApp || checkingRequestedFilter) {
      return { status: "pending" };
    }
    return {
      status: "ready",
      app: selectedApp,
      date,
      filterExpr: currentFilterExpr,
      appliedAsRequested,
    };
  }, [
    appsQuery.status,
    appsQuery.data,
    keysQuery.isError,
    selectedApp,
    date,
    checkingRequestedFilter,
    currentFilterExpr,
    appliedAsRequested,
  ]);

  // With the selector shown, the ready state is held back until a name has
  // resolved, because the page's span queries cannot run without one.
  const filterState: FilterState = useMemo(() => {
    if (baseFilterState.status !== "ready") {
      return baseFilterState;
    }
    if (!showRootSpanSelector) {
      return { ...baseFilterState, rootSpanName: null };
    }
    if (rootSpanNamesQuery.isError) {
      return {
        status: "error",
        message:
          "Error fetching traces list, please refresh page or select a different app to try again",
      };
    }
    // An app that has never reported a trace has nothing to select, and the
    // app and date it resolved with are still written.
    if (rootSpanNamesQuery.isSuccess && rootSpanNames.length === 0) {
      return { ...baseFilterState, rootSpanName: null };
    }
    if (resolvedRootSpanName === null) {
      return { status: "pending" };
    }
    return { ...baseFilterState, rootSpanName: resolvedRootSpanName };
  }, [
    baseFilterState,
    showRootSpanSelector,
    rootSpanNamesQuery.isError,
    rootSpanNamesQuery.isSuccess,
    rootSpanNames,
    resolvedRootSpanName,
  ]);

  // Every request gets a report, even when it resolves to the same
  // values as the previous request. For example, after a request for
  // app 1, a request with no app also resolves to app 1. Reporting
  // only changed resolutions would leave that second request with no report.
  useEffect(() => {
    onFilterChange(filterState);
  }, [
    filterState,
    requestedAppId,
    requestedDateRange.dateRange,
    requestedDateRange.startDate,
    requestedDateRange.endDate,
    requestedFilterExpr,
    requestedRootSpanName,
  ]);

  useEffect(() => {
    if (anythingDiscarded) {
      toastNegative("Some filters were invalid, page reset to defaults");
    }
  }, [anythingDiscarded]);

  useEffect(() => {
    focusedControlRef.current?.focus();
  }, [focusedId]);

  function setApp(app: App) {
    // Clear filters on app change
    onRequestChange({ appId: app.id, filterExpr: null, rootSpanName: null });
    setTypedText(null);
  }

  // Turns an edit to the conditions back into request text.
  function setConditions(next: ConditionGroup) {
    const limit = validateLimits(next);
    if (limit) {
      toastNegative(limit);
      return;
    }

    onRequestChange({ filterExpr: formatFilterExpr(buildDraftTree(next)) });
  }

  function setRow(rowId: string, patch: Partial<ConditionRow>) {
    setConditions(updateRow(draftConditions, rowId, patch));
  }

  function removeById(id: string) {
    const previous = rowBefore(draftConditions, id);
    setConditions(dropById(draftConditions, id));
    setFocusedId(previous?.id ?? null);
    if (!previous) {
      addConditionButtonRef.current?.focus();
    }
  }

  // A condition or group is added at the end of the group it goes in, so its
  // id is that group's id and an index equal to the number of children
  // already there.
  function addToGroup(groupId: string, make: (id: string) => ConditionOrGroup) {
    let addedId = groupId;
    const next = updateGroup(draftConditions, groupId, (group) => {
      addedId = childId(group.id, group.children.length);
      return { ...group, children: [...group.children, make(addedId)] };
    });

    setConditions(next);
    setFocusedId(addedId);
  }

  function addRow(groupId: string, key: FilterKey) {
    addToGroup(groupId, (id) => ({
      id,
      key,
      operator: key.operators[0],
      values: [],
    }));
  }

  function addGroup(groupId: string) {
    addToGroup(groupId, (id) => ({ id, logicalOperator: "and", children: [] }));
  }

  function clearFilter() {
    onRequestChange({ filterExpr: null });
    setTypedText(null);
    setFocusedId(null);
    addConditionButtonRef.current?.focus();
  }

  function toggleLogicalOperator(groupId: string) {
    setConditions(
      updateGroup(draftConditions, groupId, (group) => ({
        ...group,
        logicalOperator: group.logicalOperator === "and" ? "or" : "and",
      })),
    );
  }

  // Typing redraws the bar at once, while what the page is filtered by stays
  // as it is until the text is applied.
  function changeFilterText(text: string) {
    setTypedText(text);
  }

  function applyFilterText() {
    if (draftIssueMessage || typedText === null) {
      return;
    }
    onRequestChange({ filterExpr: typedText });
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
    // Server-rejected values still retain a valid key/operator, so conditions can
    // be rendered while the value picker lets the user fix the invalid value.
    // applyFilterText prevents applying the draft while any issue remains.
    if (draftIssueMessage && ownFilterIssues.length > 0) {
      toastNegative(draftIssueMessage);
      return;
    }
    applyFilterText();
    setEditingAsText(false);
  }

  const keysUnavailable = keysQuery.isError;

  if (
    !selectedApp ||
    (!keysUnavailable &&
      (baseFilterState.status !== "ready" || keysQuery.isPending))
  ) {
    return (
      <div className="flex flex-wrap gap-4 items-center w-full">
        <Skeleton className="h-9 w-37.5" />
        <Skeleton className="h-9 w-37.5" />
        <Skeleton className="h-9 flex-1 min-w-64" />
      </div>
    );
  }

  const editor: FilterEditor = {
    keys,
    keyGroups,
    selectedAppId: selectedApp.id,
    entity,
    focusedId,
    focusedControlRef,
    onChangeRow: setRow,
    onRemove: removeById,
    onAddRow: addRow,
    onAddGroup: addGroup,
    onToggleLogicalOperator: toggleLogicalOperator,
  };

  return (
    <div className="flex flex-wrap gap-4 items-start w-full">
      <AppSelect apps={apps} selected={selectedApp} onChange={setApp} />
      <DateRangeSelect
        selection={date}
        onChange={(selection) =>
          onRequestChange({
            dateRange:
              selection.dateRange === DateRange.Custom
                ? selection
                : { ...selection, startDate: null, endDate: null },
          })
        }
      />
      {showRootSpanSelector &&
        (rootSpanNamesQuery.isPending ? (
          <Skeleton className="h-9 w-37.5" />
        ) : resolvedRootSpanName !== null ? (
          <DropdownSelect
            title="Trace Name"
            type={DropdownSelectType.SingleString}
            items={rootSpanNames}
            initialSelected={resolvedRootSpanName}
            onChangeSelected={(item) => {
              const name = item as string;
              if (name !== resolvedRootSpanName) {
                onRequestChange({ rootSpanName: name });
              }
            }}
          />
        ) : null)}

      <div className="flex-auto min-w-64">
        <div
          data-testid="filter-bar"
          aria-disabled={keysUnavailable}
          // Ring on keyboard focus only: focus returns here after every pick.
          className={`relative rounded-md border border-input bg-transparent dark:bg-input/30 shadow-xs has-focus-visible:border-ring has-focus-visible:ring-ring/50 has-focus-visible:ring-[3px] ${
            keysUnavailable ? "opacity-50 select-none" : ""
          } ${!editingAsText && !keysUnavailable ? "cursor-pointer" : ""}`}
          // The conditions never cover the whole bar: the padding around them,
          // the room left at the end of a line a condition was too wide to join,
          // and the space after the last one are all empty. A click on any of it
          // opens the key list, so every empty part of the bar adds a condition
          // rather than only the part the button behind them happens to cover.
          // Each control in the bar is a button, so a click that reaches one is
          // left for it to handle.
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
                value={draftFilterExpr}
                tokens={parsedDraftFilter.tokens}
                issues={draftFilterIssues}
                parserStopped={parserStopped}
                placeholder={placeholder}
                onChange={changeFilterText}
                onApply={applyFilterText}
                onCancel={cancelTextEditing}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-1.5 py-1.5 min-h-9 max-h-32 overflow-y-auto">
                {/* Without keys the bar is rendered as a placeholder with no interaction */}
                {keysUnavailable && (
                  <span className="flex-1 min-w-24 h-6 font-body text-sm text-muted-foreground select-none">
                    {placeholder}
                  </span>
                )}

                {!keysUnavailable && (
                  <GroupChildren group={draftConditions} editor={editor} />
                )}

                {!keysUnavailable && (
                  <KeyPicker
                    keys={keys}
                    keyGroups={keyGroups}
                    selected={null}
                    open={keyListOpen}
                    onOpenChange={setKeyListOpen}
                    focusOnClose={focusedControlRef}
                    onSelect={(key) => addRow(draftConditions.id, key)}
                    onAddGroup={() => addGroup(draftConditions.id)}
                    trigger={
                      <button
                        type="button"
                        ref={addConditionButtonRef}
                        data-testid="filter-input"
                        aria-label="Add a filter"
                        // Match the height of adjacent conditions.
                        // Without conditions, fill the bar to center the placeholder.
                        // With conditions, stay compact and anchor the key list.
                        className={`self-stretch min-h-2 text-left outline-none font-body text-sm text-muted-foreground ${
                          draftConditions.children.length === 0
                            ? "flex-1"
                            : "flex-none w-4"
                        }`}
                      >
                        {draftConditions.children.length === 0
                          ? placeholder
                          : ""}
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

            {draftFilterExpr !== "" && (
              <button
                type="button"
                aria-label="Clear filter"
                data-testid="filter-clear"
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
    </div>
  );
}

interface FilterEditor {
  keys: FilterKey[];
  keyGroups: string[];
  selectedAppId: string;
  entity: string;
  focusedId: string | null;
  focusedControlRef: RefObject<HTMLButtonElement | null>;
  onChangeRow: (rowId: string, patch: Partial<ConditionRow>) => void;
  onRemove: (id: string) => void;
  onAddRow: (groupId: string, key: FilterKey) => void;
  onAddGroup: (groupId: string) => void;
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
        focusOnClose={editor.focusedControlRef}
        onSelect={(key) => editor.onAddRow(group.id, key)}
        onAddGroup={() => editor.onAddGroup(group.id)}
        trigger={
          <button
            type="button"
            // A group starts empty, so after it is added, this button receives focus
            // and is where its first condition is selected.
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
  const {
    keys,
    keyGroups,
    selectedAppId,
    entity,
    focusedId,
    focusedControlRef,
    onChangeRow,
    onRemove,
  } = editor;

  return (
    <span className="inline-flex items-stretch h-6 max-w-full min-w-0 overflow-hidden rounded-sm border border-input bg-accent/80 font-display text-xs">
      <KeyPicker
        keys={keys}
        keyGroups={keyGroups}
        selected={row.key}
        onSelect={(key) =>
          onChangeRow(row.id, {
            key,
            operator: key.operators[0],
            values: [],
          })
        }
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
          onChangeRow(row.id, {
            operator: operator as FilterOperator,
            values: valuesAfterOperatorChange(
              row.operator,
              operator as FilterOperator,
              row.values,
            ),
          })
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
          appId={selectedAppId}
          entity={entity}
          keyName={row.key.name}
          valueType={row.key.value_type}
          valueSuggestionMode={row.key.value_suggestion_mode}
          takesTypedText={operatorTakesTypedText(row.operator)}
          takesOneValue={operatorTakesOneValue(row.operator)}
          selected={row.values}
          onChange={(values) => onChangeRow(row.id, { values })}
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
        onClick={() => onRemove(row.id)}
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
  values: FilterValue[];
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
