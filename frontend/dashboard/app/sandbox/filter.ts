import type {
  ExprTree,
  ExprTreeCondition,
  FilterOperator,
} from "../api/filter_types";
import { parseFilterExpr } from "../components/filter_bar/parse";
import { unitInterval } from "./query";
import { deviceMemoryTier } from "./device_memory";
import type { GeneratedEvent, SessionDetail } from "./catalog";

export function matchesFilterExpr(
  attributes: Record<string, unknown>,
  filterExpr: string | null,
): boolean {
  if (!filterExpr || filterExpr.trim() === "") {
    return true;
  }
  const outcome = parseFilterExpr(filterExpr);
  if (!outcome.ok) {
    return true;
  }
  return matchesTree(outcome.tree, attributes);
}

export function matchFraction<T>(
  items: T[],
  attributesOf: (item: T) => Record<string, unknown>,
  filterExpr: string | null,
): number {
  if (items.length === 0) {
    return 1;
  }
  let matched = 0;
  let all = 0;
  items.forEach((item, i) => {
    const weight = 0.6 + unitInterval(`sampleweight:${i}`) * 0.9;
    all += weight;
    if (matchesFilterExpr(attributesOf(item), filterExpr)) {
      matched += weight;
    }
  });
  return matched / all;
}

// The backend fills country by geo-locating the ingest IP rather than from an
// event attribute, so the sandbox derives it from the device locale.
export function countryOf(locale: string | undefined): string {
  const region = (locale ?? "").split(/[_-]/)[1];
  return region ? region.toUpperCase() : "US";
}

export function deviceAttributeBag(attribute: {
  app_version?: string;
  app_build?: string;
  user_id?: string;
  device_name?: string;
  device_manufacturer?: string;
  device_locale?: string;
  os_name?: string;
  os_version?: string;
  network_type?: string;
  network_generation?: string;
  network_provider?: string;
}): Record<string, unknown> {
  return {
    version_name: attribute.app_version,
    version_code: attribute.app_build,
    user_id: attribute.user_id,
    device_name: attribute.device_name,
    device_manufacturer: attribute.device_manufacturer,
    locale: attribute.device_locale,
    country: countryOf(attribute.device_locale),
    os_name: attribute.os_name,
    os_version: attribute.os_version,
    network_type: attribute.network_type,
    network_generation: attribute.network_generation,
    network_provider: attribute.network_provider,
  };
}

const USER_INTERACTION_EVENTS = [
  "gesture_click",
  "gesture_long_click",
  "gesture_scroll",
];

const FOREGROUND_EVENTS = [
  ...USER_INTERACTION_EVENTS,
  "lifecycle_activity",
  "lifecycle_view_controller",
  "screen_view",
];

const SCREEN_EVENTS = [
  "lifecycle_activity",
  "lifecycle_fragment",
  "lifecycle_view_controller",
];

function text(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function distinctText(values: (string | undefined)[]): string[] {
  return Array.from(
    new Set(values.filter((v): v is string => v !== undefined)),
  );
}

function errorText(event: GeneratedEvent): (string | undefined)[] {
  const fields = [
    event.type,
    event.message,
    event.file_name,
    event.method_name,
  ];
  if (event.event_type === "error") {
    fields.push(
      event.code,
      event.num_code === null || event.num_code === undefined
        ? undefined
        : String(event.num_code),
      event.meta ? JSON.stringify(event.meta) : undefined,
    );
  }
  return fields.map(text);
}

export function sessionAttributeBag(
  detail: Pick<SessionDetail, "session_id" | "attribute" | "threads">,
): Record<string, unknown> {
  const events = Object.values(detail.threads).flat();
  const has = (predicate: (event: GeneratedEvent) => boolean) =>
    events.some(predicate);
  const ofType = (types: string[]) =>
    has((event) => types.includes(event.event_type));
  const errorsOf = (severity: string) =>
    has((event) => event.event_type === "error" && event.severity === severity);
  const appLifecycle = (type: string) =>
    has((event) => event.event_type === "lifecycle_app" && event.type === type);
  const sessionEvents = [
    errorsOf("fatal") && "fatal_error",
    errorsOf("unhandled") && "unhandled_error",
    errorsOf("handled") && "handled_error",
    ofType(["anr"]) && "anr",
    ofType(["bug_report"]) && "bug_report",
    ofType(USER_INTERACTION_EVENTS) && "user_interaction",
  ];
  const foregroundBackground = [
    (appLifecycle("foreground") || ofType(FOREGROUND_EVENTS)) && "foreground",
    appLifecycle("background") && "background",
  ];
  return {
    session_id: detail.session_id,
    session_events: sessionEvents.filter((v) => v !== false),
    session_foreground_background: foregroundBackground.filter(
      (v) => v !== false,
    ),
    device_total_memory: deviceMemoryTier(detail.attribute.device_total_memory),
    session_custom_event: distinctText(
      events
        .filter((event) => event.event_type === "custom")
        .map((event) => text(event.name)),
    ),
    session_log: distinctText(
      events
        .filter((event) => event.event_type === "log")
        .map((event) => text(event.body)),
    ),
    session_screen: distinctText(
      events.map((event) =>
        event.event_type === "screen_view"
          ? text(event.name)
          : SCREEN_EVENTS.includes(event.event_type)
            ? text(event.class_name)
            : undefined,
      ),
    ),
    session_error_text: distinctText(
      events
        .filter(
          (event) => event.event_type === "error" || event.event_type === "anr",
        )
        .flatMap(errorText),
    ),
    ...deviceAttributeBag(detail.attribute),
  };
}

function matchesTree(
  tree: ExprTree,
  attributes: Record<string, unknown>,
): boolean {
  if (tree.condition) {
    return matchesCondition(tree.condition, attributes);
  }
  const children = tree.children ?? [];
  if (children.length === 0) {
    return true;
  }
  return tree.logical_operator === "or"
    ? children.some((child) => matchesTree(child, attributes))
    : children.every((child) => matchesTree(child, attributes));
}

// The sandbox generates no over-the-air patches, so the patch keys read as
// empty everywhere, the way the backend's unset patch columns do. Any other key
// missing from an attribute bag matches, because some callers pass a narrower
// bag, such as the version-only one that selectedVersions checks, and leave
// the remaining keys to the bags that carry them.
const UNSET_KEYS = new Set(["patch_version", "patch_id"]);

function matchesCondition(
  condition: ExprTreeCondition,
  attributes: Record<string, unknown>,
): boolean {
  const unset = UNSET_KEYS.has(condition.key_name);
  if (!unset && !(condition.key_name in attributes)) {
    return true;
  }
  const actual = unset ? "" : attributes[condition.key_name];
  const texts = (condition.values ?? []).map((value) => value.text);
  if (Array.isArray(actual)) {
    const any = (operator: FilterOperator) =>
      actual.some((element) => matchesValue(operator, element, texts));
    switch (condition.operator) {
      case "not_in":
        return !any("in");
      case "not_contains":
        return !any("contains");
      default:
        return any(condition.operator);
    }
  }
  return matchesValue(condition.operator, actual, texts);
}

function matchesValue(
  operator: FilterOperator,
  actual: unknown,
  texts: string[],
): boolean {
  switch (operator) {
    case "in":
      return texts.some((text) => textEquals(actual, text));
    case "not_in":
      return !texts.some((text) => textEquals(actual, text));
    case "eq":
      return textEquals(actual, texts[0]);
    case "neq":
      return !textEquals(actual, texts[0]);
    case "contains":
      return actualText(actual).includes(lower(texts[0]));
    case "not_contains":
      return !actualText(actual).includes(lower(texts[0]));
    case "starts_with":
      return actualText(actual).startsWith(lower(texts[0]));
    case "ends_with":
      return actualText(actual).endsWith(lower(texts[0]));
    case "gt":
    case "gte":
    case "lt":
    case "lte":
      return compareNumeric(actual, texts[0], operator);
    case "before":
    case "after":
      return compareDate(actual, texts[0], operator);
    case "between":
      return compareBetween(actual, texts[0], texts[1]);
    case "is_set":
      return isSet(actual);
    case "is_not_set":
      return !isSet(actual);
    default:
      return true;
  }
}

function actualText(actual: unknown): string {
  return String(actual ?? "").toLowerCase();
}

function lower(text: string | undefined): string {
  return (text ?? "").toLowerCase();
}

function textEquals(actual: unknown, text: string | undefined): boolean {
  return text !== undefined && actualText(actual) === text.toLowerCase();
}

function compareNumeric(
  actual: unknown,
  text: string | undefined,
  operator: Extract<FilterOperator, "gt" | "gte" | "lt" | "lte">,
): boolean {
  const left = Number(actual);
  const right = Number(text);
  if (Number.isNaN(left) || Number.isNaN(right)) {
    return true;
  }
  switch (operator) {
    case "gt":
      return left > right;
    case "gte":
      return left >= right;
    case "lt":
      return left < right;
    case "lte":
      return left <= right;
  }
}

function compareDate(
  actual: unknown,
  text: string | undefined,
  operator: Extract<FilterOperator, "before" | "after">,
): boolean {
  const left = Date.parse(String(actual ?? ""));
  const right = Date.parse(text ?? "");
  if (Number.isNaN(left) || Number.isNaN(right)) {
    return true;
  }
  return operator === "before" ? left < right : left > right;
}

function compareBetween(
  actual: unknown,
  from: string | undefined,
  to: string | undefined,
): boolean {
  const value = Date.parse(String(actual ?? ""));
  const start = Date.parse(from ?? "");
  const end = Date.parse(to ?? "");
  if (Number.isNaN(value) || Number.isNaN(start) || Number.isNaN(end)) {
    return true;
  }
  return value >= start && value <= end;
}

function isSet(actual: unknown): boolean {
  return actual !== null && actual !== undefined && actual !== "";
}
