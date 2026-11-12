import type { FilterKey, FilterOperator } from "../api/filter_types";
import { key } from "./catalog";
import type { AppBundle } from "./catalog";
import { CUSTOM_KEY_PREFIX } from "./filter";

const CUSTOM_KEY_LIMIT = 50;

type AttributeWrite = { name: string; value: unknown; timestamp: string };

function writesOf(
  attributes: Record<string, unknown> | null,
  timestamp: string,
): AttributeWrite[] {
  return Object.entries(attributes ?? {}).map(([name, value]) => ({
    name,
    value,
    timestamp,
  }));
}

function eventWrites(
  bundle: AppBundle,
  includes: (eventType: string) => boolean,
): AttributeWrite[] {
  return bundle.sessions.flatMap((session) =>
    Object.values(session.detail.threads)
      .flat()
      .filter((event) => includes(event.event_type))
      .flatMap((event) =>
        writesOf(
          event.user_defined_attribute as Record<string, unknown> | null,
          event.timestamp,
        ),
      ),
  );
}

function rootSpanWrites(bundle: AppBundle): AttributeWrite[] {
  return [...bundle.traces.values()].flatMap((trace) =>
    trace.spans
      .filter((span) => span.parent_id === "")
      .flatMap((span) => writesOf(span.user_defined_attributes, span.end_time)),
  );
}

function errorWrites(bundle: AppBundle): AttributeWrite[] {
  return bundle.errorGroups.flatMap((group) =>
    group.instances.flatMap((instance) =>
      writesOf(instance.user_defined_attribute, instance.timestamp),
    ),
  );
}

const sessionWrites = (bundle: AppBundle) => eventWrites(bundle, () => true);

// The backend lists error keys from non-bug-report events and span keys from
// all spans. The sandbox lists keys carried by the entity's errors or root
// spans, so each offered key can match.
const WRITES_BY_ENTITY: Record<
  string,
  (bundle: AppBundle) => AttributeWrite[]
> = {
  sessions: sessionWrites,
  funnels: sessionWrites,
  journeys: sessionWrites,
  errors: errorWrites,
  error_group_events: errorWrites,
  bug_reports: (bundle) =>
    eventWrites(bundle, (eventType) => eventType === "bug_report"),
  spans: rootSpanWrites,
};

function valueTypeOf(value: unknown): string {
  if (typeof value === "boolean") {
    return "bool";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? "int64" : "float64";
  }
  return "string";
}

const OPERATORS_BY_VALUE_TYPE: Record<string, FilterOperator[]> = {
  string: [
    "in",
    "not_in",
    "contains",
    "not_contains",
    "starts_with",
    "ends_with",
    "is_set",
    "is_not_set",
  ],
  int64: ["eq", "neq", "gt", "gte", "lt", "lte", "is_set", "is_not_set"],
  float64: ["eq", "neq", "gt", "gte", "lt", "lte", "is_set", "is_not_set"],
  bool: ["eq", "is_set", "is_not_set"],
};

type CustomAttribute = { valueType: string; values: string[] };

// The newest write sets an attribute's type. Non-empty values with that type
// are ordered newest first.
function attributesByName(
  bundle: AppBundle,
  entity: string,
): Map<string, CustomAttribute> {
  const writes = (WRITES_BY_ENTITY[entity]?.(bundle) ?? []).sort(
    (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
  );
  const attributes = new Map<string, CustomAttribute>();
  for (const write of writes) {
    const valueType = valueTypeOf(write.value);
    if (!attributes.has(write.name)) {
      attributes.set(write.name, { valueType, values: [] });
    }
    const attribute = attributes.get(write.name)!;
    const text = String(write.value);
    if (
      attribute.valueType === valueType &&
      text !== "" &&
      !attribute.values.includes(text)
    ) {
      attribute.values.push(text);
    }
  }
  return attributes;
}

function customKey(name: string, valueType: string): FilterKey {
  return key(
    CUSTOM_KEY_PREFIX + name,
    name,
    `The user-defined attribute "${name}", set by the app.`,
    "Custom",
    valueType,
    OPERATORS_BY_VALUE_TYPE[valueType],
    valueType === "string"
      ? "sample"
      : valueType === "bool"
        ? "full_list"
        : "none",
  );
}

// Search runs before the key limit. Requested keys are included even when
// search or the limit would omit them.
export function customKeys(
  bundle: AppBundle,
  entity: string,
  search: string,
  requested: string[],
): { keys: FilterKey[]; truncated: boolean } {
  const attributes = attributesByName(bundle, entity);
  const names = [...attributes.keys()].sort();
  const matching = names.filter((name) =>
    name.toLowerCase().includes(search.toLowerCase()),
  );
  const listed = matching.slice(0, CUSTOM_KEY_LIMIT);
  const added = names.filter(
    (name) =>
      !listed.includes(name) && requested.includes(CUSTOM_KEY_PREFIX + name),
  );
  return {
    keys: [...listed, ...added].map((name) =>
      customKey(name, attributes.get(name)!.valueType),
    ),
    truncated: matching.length > CUSTOM_KEY_LIMIT,
  };
}

export function customKeyValues(
  bundle: AppBundle,
  entity: string,
  keyName: string,
): string[] {
  const attribute = attributesByName(bundle, entity).get(
    keyName.slice(CUSTOM_KEY_PREFIX.length),
  );
  switch (attribute?.valueType) {
    case "string":
      return attribute.values;
    case "bool":
      return ["true", "false"];
    default:
      return [];
  }
}
