import { DateTime } from "luxon";
import type { FilterKey, FilterValue } from "../api/filter_types";
import type { App } from "../api/api_calls";
import { SANDBOX_TEAM_ID } from "../utils/sandbox";
import { androidNativeScenario } from "./platforms/android";
import {
  flutterAndroidScenario,
  flutterIosScenario,
} from "./platforms/flutter";
import { iosNativeScenario } from "./platforms/ios";
import { rnAndroidScenario, rnIosScenario } from "./platforms/react_native";
import type {
  AppSpec,
  DeviceSpec,
  ExceptionSpec,
  FrameSpec,
  HttpSpec,
  PlatformScenario,
  ScreenSpec,
  SessionScript,
  SpanSpec,
  StepSpec,
} from "./scenario";
import {
  COUPONS,
  EMPTY_SHOP,
  PRICE_CENTS,
  PRODUCTS,
  encodeToken,
  gestureBox,
  openedProductFor,
  orderTotals,
  parseState,
  scrollBox,
  scrollToReveal,
  searchResults,
  shopAfterTap,
  stateAfterScroll,
  stateAfterTap,
  stateForScreen,
  viewportFor,
  withShop,
  withVariant,
  type CartLine,
  type ScreenKey,
  type ScreenState,
  type ShopData,
  type Viewport,
} from "./layouts";
import {
  bucketsForRange,
  formatBucket,
  noise,
  randomStream,
  SandboxRange,
  stableHex,
  stableInt,
  stableUuid,
  weightedPick,
} from "./query";
import { distributeTotal } from "./aggregate";
import {
  groupCount,
  releasesOf,
  selectedNames,
  sessionsIn,
  type Release,
} from "./adoption";
import { PEOPLE, fullName } from "./people";
import {
  androidMemoryTargetKb,
  deviceTotalMemoryKb,
  iosMemoryLimitKb,
} from "./device_memory";

const scenarios: PlatformScenario[] = [
  androidNativeScenario,
  iosNativeScenario,
  flutterAndroidScenario,
  flutterIosScenario,
  rnAndroidScenario,
  rnIosScenario,
];

export function validateScenario(s: PlatformScenario): string[] {
  const problems: string[] = [];
  if (s.sessions.length !== 10) {
    problems.push(`expected exactly ten sessions, got ${s.sessions.length}`);
  }
  for (const screen of s.screens) {
    if (!screen.className && !screen.routeName) {
      problems.push(`screen ${screen.key} has neither className nor routeName`);
    }
  }
  const screenKeys = new Set(s.screens.map((sc) => sc.key));
  const httpKeys = new Set(s.http.map((h) => h.key));
  const checkSpanRequests = (spec: SpanSpec) => {
    if (spec.http && !httpKeys.has(spec.http)) {
      problems.push(`span ${spec.key} references unknown http ${spec.http}`);
    }
    spec.children?.forEach(checkSpanRequests);
  };
  s.spans.forEach(checkSpanRequests);
  const exceptionKeys = new Set(s.exceptions.map((e) => e.key));
  const spanKeys = new Set(s.spans.map((sp) => sp.key));
  const flowKeys = new Set(s.flows.map((f) => f.key));

  function checkSteps(steps: StepSpec[], context: string) {
    for (const step of steps) {
      if (step.kind === "screen" && !screenKeys.has(step.screen)) {
        problems.push(`${context} references unknown screen ${step.screen}`);
      }
      if (step.kind === "http" && !httpKeys.has(step.http)) {
        problems.push(`${context} references unknown http ${step.http}`);
      }
      if (step.kind === "span" && !spanKeys.has(step.span)) {
        problems.push(`${context} references unknown span ${step.span}`);
      }
      if (step.kind === "exception") {
        if (!exceptionKeys.has(step.exception)) {
          problems.push(
            `${context} references unknown exception ${step.exception}`,
          );
        } else {
          const spec = s.exceptions.find((e) => e.key === step.exception)!;
          if (spec.kind === "anr" && s.app.os !== "android") {
            problems.push(
              `${context} uses anr exception ${step.exception} on a non-android app`,
            );
          }
        }
      }
    }
  }
  for (const flow of s.flows) {
    checkSteps(flow.steps, `flow ${flow.key}`);
  }

  s.users.forEach((user, i) => {
    if (user.device < 0 || user.device >= s.devices.length) {
      problems.push(`user ${i} device index ${user.device} out of range`);
    }
    if (!PEOPLE[user.person]) {
      problems.push(`user ${i} person index ${user.person} out of range`);
    }
    if (s.users.findIndex((u) => u.person === user.person) !== i) {
      problems.push(`user ${i} repeats person ${user.person}`);
    }
  });
  s.sessions.forEach((script, i) => {
    if (!flowKeys.has(script.flow)) {
      problems.push(`session ${i} references unknown flow ${script.flow}`);
    }
    if (script.user < 0 || script.user >= s.users.length) {
      problems.push(`session ${i} user index ${script.user} out of range`);
    }
    const version = s.app.versions[script.version];
    if (!version) {
      problems.push(
        `session ${i} version index ${script.version} out of range`,
      );
    } else if (script.agoMinutes >= version.releasedDaysAgo * 24 * 60) {
      problems.push(`session ${i} runs ${version.name} before its release`);
    }
    const downgrade = s.sessions.find(
      (other) =>
        other.user === script.user &&
        other.agoMinutes < script.agoMinutes &&
        other.version > script.version,
    );
    if (downgrade) {
      problems.push(`session ${i} user moves back to an older version later`);
    }
  });

  const followUpKeys = new Set(
    s.exceptions
      .map((spec) => spec.nativeFollowUp)
      .filter((key): key is string => key !== undefined),
  );
  for (const flow of s.flows) {
    for (const step of flow.steps) {
      if (step.kind === "exception" && followUpKeys.has(step.exception)) {
        problems.push(
          `flow ${flow.key} scripts ${step.exception}, which another exception already reports as its native follow-up`,
        );
      }
    }
  }

  const nativeFramework = s.app.os === "android" ? "jvm" : "apple";
  for (const spec of s.exceptions) {
    problems.push(...exceptionProblems(spec));
    if (spec.nativeFollowUp === undefined) {
      continue;
    }
    const followUp = s.exceptions.find((e) => e.key === spec.nativeFollowUp);
    if (!followUp) {
      problems.push(
        `exception ${spec.key} follows up with unknown exception ${spec.nativeFollowUp}`,
      );
      continue;
    }
    if (spec.severity !== "fatal") {
      problems.push(
        `exception ${spec.key} is ${spec.severity} yet follows up with a native crash`,
      );
    }
    if (followUp.severity !== "fatal" || followUp.kind !== "exception") {
      problems.push(
        `native follow-up ${followUp.key} is not a fatal exception`,
      );
    }
    if (followUp.framework !== nativeFramework) {
      problems.push(
        `native follow-up ${followUp.key} is ${followUp.framework}, not ${nativeFramework} as ${s.app.os} reports it`,
      );
    }
  }

  return problems;
}

const MIN_CRASHING_FRAMES = 12;

function exceptionProblems(spec: ExceptionSpec): string[] {
  const problems: string[] = [];
  const where = `exception ${spec.key}`;
  const frames = spec.exceptions.flatMap((unit) => unit.frames);
  const stackless = spec.exceptions.length === 0 && spec.error !== undefined;

  if (!stackless && frames.length < MIN_CRASHING_FRAMES) {
    problems.push(
      `${where} has ${frames.length} frames on the crashing thread, fewer than ${MIN_CRASHING_FRAMES}`,
    );
  }

  for (const frame of frames) {
    const line = frameToString(frame, spec.framework);
    if (!spec.stacktrace.includes(line)) {
      problems.push(`${where} stacktrace is missing the frame ${line}`);
    }
  }

  const withFile = frames.filter((frame) => frame.file_name);
  const inApp = withFile.filter((frame) => frame.in_app);
  const displayable = inApp.length > 0 ? inApp : withFile;
  const shown = displayable.some(
    (frame) =>
      frame.file_name === spec.file_name &&
      frame.method_name === spec.method_name &&
      (frame.line_num ?? 0) === spec.line_number,
  );
  if (!shown && !stackless) {
    problems.push(
      `${where} reports ${spec.method_name}(${spec.file_name}:${spec.line_number}), which is none of its ${inApp.length > 0 ? "in-app " : ""}frames`,
    );
  }

  const crashingThread = spec.exceptions[0]?.thread_name;
  if (crashingThread && spec.threads.some((t) => t.name === crashingThread)) {
    problems.push(
      `${where} repeats its crashing thread ${crashingThread} in threads`,
    );
  }

  if (spec.framework === "apple") {
    const images = new Set((spec.binary_images ?? []).map((i) => i.name));
    const named = [
      ...frames,
      ...spec.threads.flatMap((thread) => thread.frames),
    ].map((frame) => frame.binary_name);
    for (const name of new Set(named)) {
      if (name && !images.has(name)) {
        problems.push(`${where} names binary ${name} with no binary image`);
      }
    }
    const baseByBinary = new Map<string, string>();
    for (const stack of [frames, ...spec.threads.map((t) => t.frames)]) {
      const seen = new Set<string>();
      for (const frame of stack) {
        if (!frame.method_name) {
          problems.push(
            `${where} leaves ${frame.binary_name} ${frame.symbol_address} without a symbol`,
          );
        }
        const base = baseByBinary.get(frame.binary_name!);
        if (base === undefined) {
          baseByBinary.set(frame.binary_name!, frame.binary_address!);
        } else if (base !== frame.binary_address) {
          problems.push(
            `${where} loads ${frame.binary_name} at both ${base} and ${frame.binary_address}`,
          );
        }
        if (seen.has(frame.symbol_address!)) {
          problems.push(
            `${where} repeats the instruction address ${frame.symbol_address} within one stack`,
          );
        }
        seen.add(frame.symbol_address!);
        if (
          frame.symbol_address! <= frame.binary_address! ||
          frame.symbol_address!.length !== frame.binary_address!.length
        ) {
          problems.push(
            `${where} puts ${frame.symbol_address} outside ${frame.binary_name}, loaded at ${frame.binary_address}`,
          );
        }
      }
    }
  } else if (spec.binary_images) {
    problems.push(`${where} carries binary images outside an apple exception`);
  }

  // The backend names an Apple group by its signal, or by the NSError domain
  // when it has no frames, and gives it no message.
  if (spec.framework === "apple") {
    const signal = spec.exceptions[0]?.signal ?? "";
    const expected =
      spec.exceptions.length > 0 ? signal : (spec.error?.code ?? "");
    if (expected === "") {
      problems.push(
        `${where} has neither a signal nor an error code to be named by`,
      );
    } else if (spec.type !== expected) {
      problems.push(`${where} is typed ${spec.type}, not ${expected}`);
    }
    if (spec.message !== "") {
      problems.push(
        `${where} carries the message ${spec.message}, which an apple group never shows`,
      );
    }
  }

  if (spec.framework === "dart" && spec.stacktrace.includes("\tat ")) {
    problems.push(`${where} renders a Dart error as a JVM stacktrace`);
  }

  return problems;
}

export type SessionAttribute = {
  installation_id: string;
  app_version: string;
  app_build: string;
  app_unique_id: string;
  measure_sdk_version: string;
  thread_name: string;
  user_id: string;
  device_name: string;
  device_model: string;
  device_manufacturer: string;
  device_type: string;
  device_is_foldable: boolean;
  device_is_physical: boolean;
  device_density_dpi: number;
  device_width_px: number;
  device_height_px: number;
  device_density: number;
  device_locale: string;
  device_low_power_mode: boolean;
  device_thermal_throttling_enabled: boolean;
  device_cpu_arch: string;
  device_total_memory: number;
  os_name: string;
  os_version: string;
  os_page_size: number;
  network_type: string;
  network_provider: string;
  network_generation: string;
};

export type GeneratedEvent = Record<string, unknown> & {
  event_type: string;
  timestamp: string;
  thread_name: string;
};

export type SessionListEntry = {
  session_id: string;
  app_id: string;
  first_event_time: string;
  last_event_time: string;
  duration: string;
  attribute: {
    app_version: string;
    app_build: string;
    user_id: string;
    device_name: string;
    device_model: string;
    device_manufacturer: string;
    os_name: string;
    os_version: string;
  };
};

export type SessionDetail = {
  session_id: string;
  app_id: string;
  attribute: SessionAttribute;
  duration: number;
  cpu_usage: { timestamp: string; value: number }[];
  memory_usage: Record<string, unknown>[] | null;
  memory_usage_absolute: Record<string, unknown>[] | null;
  threads: Record<string, GeneratedEvent[]>;
  traces: {
    trace_id: string;
    trace_name: string;
    thread_name: string;
    start_time: string;
    end_time: string;
    duration: number;
  }[];
};

export type SpanRecord = {
  span_name: string;
  span_id: string;
  parent_id: string;
  status: number;
  start_time: string;
  end_time: string;
  duration: number;
  thread_name: string;
  user_defined_attributes: Record<string, unknown> | null;
  checkpoints: { name: string; timestamp: string }[] | null;
};

export type TraceDetail = {
  app_id: string;
  trace_id: string;
  session_id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  duration: number;
  app_version: string;
  os_version: string;
  device_manufacturer: string;
  device_model: string;
  network_type: string;
  spans: SpanRecord[];
};

export type SpanListRow = {
  app_id: string;
  span_name: string;
  span_id: string;
  trace_id: string;
  status: number;
  start_time: string;
  end_time: string;
  duration: number;
  app_version: string;
  app_build: string;
  os_name: string;
  os_version: string;
  device_manufacturer: string;
  device_model: string;
};

export type ErrorInstance = {
  id: string;
  session_id: string;
  timestamp: string;
  type: string;
  attribute: SessionAttribute;
  exception: { title: string; stacktrace: string; message: string } | null;
  anr: { title: string; stacktrace: string } | null;
  severity: string;
  num_code: number | null;
  code: string;
  meta: Record<string, unknown> | null;
  user_defined_attribute: Record<string, unknown> | null;
  attachments: {
    id: string;
    name: string;
    type: string;
    key: string;
    location: string;
  }[];
  threads: { name: string; frames: string[] }[];
};

export type ErrorGroup = {
  id: string;
  app_id: string;
  type: string;
  error_type: "exception" | "anr";
  severity: string;
  is_custom: boolean;
  message: string;
  method_name: string;
  file_name: string;
  line_number: number;
  count: number;
  percentage_contribution: number;
  updated_at: string;
  instances: ErrorInstance[];
  screen: string;
};

export type BugReport = {
  session_id: string;
  app_id: string;
  event_id: string;
  status: 0 | 1;
  description: string;
  timestamp: string;
  attribute: SessionAttribute;
  user_defined_attribute: Record<string, unknown> | null;
  attachments: {
    id: string;
    name: string;
    type: string;
    key: string;
    location: string;
  }[];
};

export type HttpSample = {
  domain: string;
  path: string;
  method: string;
  statusCode: number;
  startTime: DateTime;
  durationMs: number;
  sessionId: string;
  attribute: SessionAttribute;
};

export type JourneyNode = {
  id: string;
  issues: {
    anrs: { id: string; title: string; count: number }[];
    crashes: { id: string; title: string; count: number }[];
  };
};

export type Journey = {
  links: { source: string; target: string; value: number }[];
  nodes: JourneyNode[];
  totalIssues: number;
};

export type Alert = {
  id: string;
  team_id: string;
  app_id: string;
  entity_id: string;
  type: string;
  message: string;
  url: string;
  created_at: string;
  updated_at: string;
};

export type BuildFile = {
  id: string;
  mapping_type: string;
  download_url: string;
  filesize: number;
  last_updated: string;
};

export type Build = {
  version_name: string;
  version_code: string;
  last_updated: string;
  files: BuildFile[];
};

export type Metrics = {
  adoption: {
    all_versions: number;
    selected_version: number;
    adoption: number;
    no_data: boolean;
  };
  anr_free_sessions: {
    anr_free_sessions: number;
    unselected_anr_free_sessions: number;
    no_data: boolean;
    unselected_no_data: boolean;
  } | null;
  cold_launch: {
    p95: number;
    unselected_p95: number;
    no_data: boolean;
    unselected_no_data: boolean;
  };
  crash_free_sessions: {
    crash_free_sessions: number;
    unselected_crash_free_sessions: number;
    no_data: boolean;
    unselected_no_data: boolean;
  };
  hot_launch: {
    p95: number;
    unselected_p95: number;
    no_data: boolean;
    unselected_no_data: boolean;
  };
  perceived_anr_free_sessions: {
    perceived_anr_free_sessions: number;
    unselected_perceived_anr_free_sessions: number;
    no_data: boolean;
    unselected_no_data: boolean;
  } | null;
  perceived_crash_free_sessions: {
    perceived_crash_free_sessions: number;
    unselected_perceived_crash_free_sessions: number;
    no_data: boolean;
    unselected_no_data: boolean;
  };
  warm_launch: {
    p95: number;
    unselected_p95: number;
    no_data: boolean;
    unselected_no_data: boolean;
  };
};

export type AppSize = {
  average_app_size: number;
  selected_app_size: number;
  delta: number;
  no_data: boolean;
  multiple_versions: boolean;
};

export type Usage = {
  app_id: string;
  app_name: string;
  monthly_app_usage: {
    month_year: string;
    sessions: number;
    events: number;
    spans: number;
    bytes_in: number;
  }[];
};

export type NetworkEndpointStats = {
  domain: string;
  path: string;
  dailyRequests: number;
  outcomes: { code: number; weight: number }[];
};

export type AppBundle = {
  app: App;
  scenario: PlatformScenario;
  dataStart: DateTime;
  sessions: { list: SessionListEntry; detail: SessionDetail }[];
  errorGroups: ErrorGroup[];
  bugReports: BugReport[];
  traces: Map<string, TraceDetail>;
  spanRows: SpanListRow[];
  rootSpanNames: string[];
  httpSamples: HttpSample[];
  networkEndpoints: Map<string, NetworkEndpointStats>;
  journey: Journey;
  releases: Release[];
  launchP95: { cold: number; warm: number; hot: number };
  appSizeByVersion: Record<string, number>;
  alerts: Alert[];
  builds: Build[];
  usage: Usage;
};

export type Catalog = {
  team: { id: string; name: string };
  apps: App[];
  appById: Map<string, AppBundle>;
  builtAt: DateTime;
};

function joinNonEmpty(separator: string, parts: (string | number | null)[]) {
  return parts
    .filter((part) => part !== null && part !== "" && part !== undefined)
    .join(separator);
}

const APPLE_MAX_SYMBOL_LENGTH = 55;

function frameToString(frame: FrameSpec, framework: string): string {
  const fileInfo = joinNonEmpty(":", [
    frame.file_name ?? null,
    frame.line_num ? frame.line_num : null,
  ]);
  if (framework === "jvm") {
    const code = joinNonEmpty(".", [
      frame.class_name ?? null,
      frame.method_name ?? null,
    ]);
    return fileInfo === "" ? code : `${code}(${fileInfo})`;
  }
  if (framework === "dart") {
    const num = String(frame.frame_index ?? 0).padStart(2, "0");
    const location = joinNonEmpty(":", [
      `${frame.module_name ?? ""}${frame.file_name ?? ""}`,
      frame.line_num ?? null,
    ]);
    return `#${num}      ${frame.method_name ?? ""} ${location === "" ? "" : `(${location})`}`;
  }
  if (framework === "js") {
    const location = joinNonEmpty(":", [
      frame.file_name ?? null,
      frame.line_num ?? null,
      frame.col_num ?? null,
    ]);
    if (frame.method_name && location !== "") {
      return `at ${frame.method_name} (${location})`;
    }
    return `at ${frame.method_name ?? `(${location})`}`;
  }
  const binary = frame.binary_name ?? "???";
  const address = frame.class_name ?? frame.binary_address ?? "";
  const normalized = /^[0-9a-fA-F]{16}$/.test(address)
    ? `0x${address.toLowerCase()}`
    : address.toLowerCase();
  const symbol = frame.method_name ?? frame.symbol_address ?? "";
  const tail = fileInfo === "" ? ` + ${frame.offset ?? 0}` : `   (${fileInfo})`;
  const shown =
    symbol.length > APPLE_MAX_SYMBOL_LENGTH
      ? `${symbol.slice(0, APPLE_MAX_SYMBOL_LENGTH - 3)}...`
      : symbol;
  const extra =
    symbol.length > APPLE_MAX_SYMBOL_LENGTH
      ? `\n    Full symbol:${symbol}`
      : "";
  const index = String(frame.frame_index ?? 0).padStart(3, " ");
  return `${index}   ${binary.padEnd(28, " ")}  ${normalized}   ${shown}${tail}${extra}`;
}

function layoutAttachment(
  seed: string,
  vp: Viewport,
  state: ScreenState,
  highlight: string | null,
) {
  const token = encodeToken({ vp, state, highlight });
  return {
    id: stableUuid(seed),
    name: "snapshot.json",
    type: "layout_snapshot_json",
    key: token,
    location: `/sandbox-attachments/${token}.json`,
  };
}

function screenshotAttachment(seed: string, vp: Viewport, state: ScreenState) {
  const token = encodeToken({ vp, state, highlight: null });
  return {
    id: stableUuid(seed),
    name: "screenshot.svg",
    type: "screenshot",
    key: token,
    location: `/sandbox-attachments/${token}.svg`,
  };
}

function checkpointsOver(
  names: string[],
  start: DateTime,
  durationMs: number,
): { name: string; timestamp: string }[] {
  const steps = Math.max(1, names.length - 1);
  return names.map((name, i) => ({
    name,
    timestamp: start
      .plus({ milliseconds: Math.round((i / steps) * durationMs) })
      .toISO()!,
  }));
}

type BuiltSession = {
  sessionId: string;
  list: SessionListEntry;
  detail: SessionDetail;
  errorHits: { key: string; event: GeneratedEvent; timestamp: string }[];
  httpHits: { key: string; event: GeneratedEvent }[];
  bugReport: {
    eventId: string;
    description: string;
    timestamp: string;
    attachments: {
      id: string;
      name: string;
      type: string;
      key: string;
      location: string;
    }[];
  } | null;
  traces: TraceDetail[];
};

function resolveThread(
  thread: string | undefined,
  inherited: string,
  threadNames: PlatformScenario["threadNames"],
): string {
  if (thread === undefined) {
    return inherited;
  }
  if (thread === "main" || thread === "network") {
    return threadNames[thread];
  }
  return thread;
}

type SpanRun = {
  include: (spec: SpanSpec) => boolean;
  abortBefore?: string;
  request: (
    spec: SpanSpec,
    start: DateTime,
  ) => { durationMs: number; ok: boolean };
  fill: (value: string) => string;
  checkpoints: { name: string; timestamp: string }[];
  abortedAt: DateTime | null;
};

// A failed child fails its ancestors and, under a sequential parent, the
// siblings after it never start.
function buildSpanTree(
  spec: SpanSpec,
  parentId: string,
  earliest: DateTime,
  seedPrefix: string,
  inheritedThread: string,
  threadNames: PlatformScenario["threadNames"],
  flat: SpanRecord[],
  run: SpanRun,
): { end: DateTime; failed: boolean } {
  if (!run.include(spec)) {
    return { end: earliest, failed: false };
  }
  const spanId = stableHex(`span:${seedPrefix}`, 16);
  const threadName = resolveThread(spec.thread, inheritedThread, threadNames);
  const start = spec.startAfterMs
    ? earliest.plus({
        milliseconds: stableInt(
          `${seedPrefix}:gap`,
          spec.startAfterMs[0],
          spec.startAfterMs[1],
        ),
      })
    : earliest;
  if (spec.key === run.abortBefore) {
    run.abortedAt = start;
    return { end: start, failed: false };
  }
  let ownDuration = stableInt(
    `${seedPrefix}:dur`,
    spec.durationMs[0],
    spec.durationMs[1],
  );
  let failed = false;
  if (spec.http) {
    const request = run.request(spec, start);
    ownDuration = request.durationMs;
    failed = !request.ok;
  }
  let latestChildEnd = start;
  let childCursor = start;
  for (const [i, child] of (spec.children ?? []).entries()) {
    const built = buildSpanTree(
      child,
      spanId,
      spec.parallel ? start : childCursor,
      `${seedPrefix}:${i}`,
      threadName,
      threadNames,
      flat,
      run,
    );
    if (run.abortedAt) {
      return { end: built.end, failed };
    }
    childCursor = built.end;
    if (built.end > latestChildEnd) {
      latestChildEnd = built.end;
    }
    if (built.failed) {
      failed = true;
      if (!spec.parallel) {
        break;
      }
    }
  }
  const childSpan = latestChildEnd.diff(start).as("milliseconds");
  const duration = Math.max(ownDuration, Math.ceil(childSpan));
  const end = start.plus({ milliseconds: duration });
  const checkpoints =
    !failed && spec.checkpoints && spec.checkpoints.length > 0
      ? checkpointsOver(spec.checkpoints, start, duration)
      : null;
  if (spec.checkpoint && !failed) {
    run.checkpoints.push({ name: spec.checkpoint, timestamp: end.toISO()! });
  }
  flat.unshift({
    span_name: spec.name,
    span_id: spanId,
    parent_id: parentId,
    status: failed ? 2 : (spec.status ?? 1),
    start_time: start.toISO()!,
    end_time: end.toISO()!,
    duration,
    thread_name: threadName,
    user_defined_attributes: spec.attributes
      ? Object.fromEntries(
          Object.entries(spec.attributes).map(([k, v]) => [k, run.fill(v)]),
        )
      : null,
    checkpoints,
  });
  return { end, failed };
}

// okhttp reports empty header maps unless the app opts header collection in,
// and dio reports each value as a one-item list.
function httpHeaders(
  client: string,
  requestBody: string,
  appVersion: string,
  osName: string,
  osVersion: string,
  statusCode: number,
  responseBody: string,
): { request: Record<string, string>; response: Record<string, string> } {
  if (client === "okhttp") {
    return { request: {}, response: {} };
  }
  const platform =
    osName === "ios" ? `iOS ${osVersion}` : `Android ${osVersion}`;
  const request: Record<string, string> = {
    Accept: "application/json",
    "Accept-Encoding": "gzip",
    "User-Agent": `AcmeShop/${appVersion} (${platform})`,
  };
  if (requestBody) {
    request["Content-Type"] = "application/json; charset=utf-8";
    request["Content-Length"] = String(requestBody.length);
  }
  const response: Record<string, string> =
    statusCode === 0
      ? {}
      : {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": String(responseBody.length),
          Server: "acme-edge",
          "Cache-Control": "no-store",
        };
  if (client !== "dio") {
    return { request, response };
  }
  const bracket = (headers: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [
        key.toLowerCase(),
        `[${value}]`,
      ]),
    );
  return { request, response: bracket(response) };
}

function fillTemplate(template: string, values: Record<string, string>) {
  return template.replace(
    /\{([a-z_]+)\}/g,
    (whole, name: string) => values[name] ?? whole,
  );
}

export function pathPattern(url: string): { domain: string; path: string } {
  return domainAndPath(url.replace(/\{[a-z_]+\}/g, "*"));
}

const ERROR_NAMES: Record<number, string> = {
  401: "unauthorized",
  402: "payment_required",
  404: "not_found",
  409: "conflict",
  422: "unprocessable_entity",
  500: "internal_error",
  502: "bad_gateway",
  503: "service_unavailable",
  504: "gateway_timeout",
};

const ACTION_GAP: [number, number] = [1_000, 4_000];

function gapAfter(
  step: StepSpec,
  next: StepSpec | undefined,
): [number, number] {
  if (next === undefined) {
    return ACTION_GAP;
  }
  switch (next.kind) {
    case "http":
    case "span":
    case "log":
    case "custom":
      return [120, 600];
    case "screen":
      return [200, 1_200];
    case "exception":
      return step.kind === "gesture" ||
        step.kind === "http" ||
        step.kind === "span"
        ? [120, 600]
        : ACTION_GAP;
    default:
      return ACTION_GAP;
  }
}

const MB = 1024;

// The decoded images and thumbnails a screen holds while it is open.
const SCREEN_IMAGE_KB: Partial<Record<ScreenKey, number>> = {
  home: 14 * MB,
  products: 18 * MB,
  product_detail: 26 * MB,
  search: 7 * MB,
  cart: 8 * MB,
  orders: 6 * MB,
  order_confirmation: 5 * MB,
};

const SCROLL_IMAGE_KB = 4 * MB;
const IMAGE_CACHE_CAP_KB = 72 * MB;

// A leaking session decodes its images at the camera's full resolution, up
// to twelve times the size the screen needs, and never releases them.
const LEAK_MAX_FACTOR = 12;

type MemoryLoad = { atMs: number; kb: number };

function buildSession(
  scenario: PlatformScenario,
  script: SessionScript,
  index: number,
  now: DateTime,
): BuiltSession {
  const app = scenario.app;
  const user = scenario.users[script.user];
  const person = PEOPLE[user.person];
  const device: DeviceSpec = scenario.devices[user.device];
  const version = app.versions[script.version];
  const flow = scenario.flows.find((f) => f.key === script.flow);
  if (!flow) {
    throw new Error(`${app.name}: unknown flow ${script.flow}`);
  }

  const sessionId = stableUuid(`session:${app.id}:${index}`);
  const installationId = stableUuid(`install:${app.id}:${user.person}`);
  // Scripts give whole minutes, so each session moves back by up to three
  // minutes to start at its own second and millisecond.
  const start = now.minus({
    minutes: script.agoMinutes,
    milliseconds: stableInt(`${sessionId}:start`, 0, 179_999),
  });
  let cursor = start;

  const mainThread = scenario.threadNames.main;
  const networkThread = scenario.threadNames.network;
  const threads: Record<string, GeneratedEvent[]> = {};
  function push(thread: string, event: GeneratedEvent) {
    (threads[thread] ??= []).push(event);
  }
  function advance(seed: string, min: number, max: number) {
    cursor = cursor.plus({ milliseconds: stableInt(seed, min, max) });
  }
  let sequence = 0;
  function nextSeed(label: string): string {
    sequence += 1;
    return `${sessionId}:${label}:${sequence}`;
  }

  const traces: TraceDetail[] = [];
  const traceRefs: SessionDetail["traces"] = [];
  const errorHits: BuiltSession["errorHits"] = [];
  const httpHits: BuiltSession["httpHits"] = [];
  let bugReport: BuiltSession["bugReport"] = null;
  let ended = false;
  const vp = viewportFor(scenario.ui.style, device);
  let uiState: ScreenState = stateForScreen("home", 0);
  let openedProduct = 0;
  type Entry = { screen: ScreenSpec; state: ScreenState };
  const stack: Entry[] = [];
  let currentActivity: string | null = null;
  function setUiState(state: ScreenState): void {
    uiState = state;
    if (stack.length > 0) {
      stack[stack.length - 1].state = state;
    }
  }

  const memoryLoads: MemoryLoad[] = [];
  const backgrounded: [number, number][] = [];
  function holdImages(kb: number): void {
    memoryLoads.push({ atMs: cursor.diff(start).as("milliseconds"), kb });
  }

  const orderNumber = String(stableInt(`${sessionId}:order`, 48000, 57999));
  const cartId = `c_${stableInt(`cart:${app.id}:${user.person}`, 10000, 99999)}`;
  let shop: ShopData = {
    ...EMPTY_SHOP,
    date: start.toUTC().toISODate(),
    user: user.person,
  };
  let placed: ShopData | null = null;
  let lastTap: string | null = null;

  // The order screens show the order placed in this session, whose items have
  // left the cart by the time those screens open.
  function shopFor(screen: ScreenKey): ShopData {
    if (screen === "order_confirmation" || screen === "orders") {
      return placed ?? { ...shop, cart: [], coupon: null, order: null };
    }
    return shop;
  }

  function refreshShop(): void {
    setUiState(withShop(uiState, shopFor(parseState(uiState).screen)));
  }

  function productId(index: number): string {
    const product = PRODUCTS[index];
    return scenario.ids.product === "slug"
      ? product.slug
      : `p_${product.number}`;
  }

  function selectedOption(): number {
    const variant = parseState(uiState).variant;
    return variant?.startsWith("size") ? Number(variant.slice(4)) : 0;
  }

  function templateValues(
    basis: ShopData,
    line?: CartLine,
  ): Record<string, string> {
    const product = line?.product ?? openedProduct;
    const option = line?.option ?? selectedOption();
    const totals = orderTotals(basis.cart, basis.coupon, basis.express);
    const hits = searchResults(basis.query);
    const dollars = (cents: number) => (cents / 100).toFixed(2);
    return {
      user_id: person.id,
      email: person.email,
      first_name: person.first,
      last_name: person.last,
      user_name: fullName(person),
      region: person.home.state,
      product_id: productId(product),
      product_name: PRODUCTS[product].name,
      price: dollars(PRICE_CENTS[product]),
      price_cents: String(PRICE_CENTS[product]),
      option: PRODUCTS[product].sizes[option] ?? PRODUCTS[product].sizes[0],
      quantity: String(line?.qty ?? 1),
      query: basis.query,
      query_param: encodeURIComponent(basis.query).replace(/%20/g, "+"),
      result_count: String(hits.length),
      results: JSON.stringify(
        hits.map((i) => ({
          id: productId(i),
          name: PRODUCTS[i].name,
          price_cents: PRICE_CENTS[i],
        })),
      ),
      cart_id: cartId,
      item_count: String(totals.count),
      cart_items: JSON.stringify(
        basis.cart.map((l) => ({
          product_id: productId(l.product),
          option: PRODUCTS[l.product].sizes[l.option],
          quantity: l.qty,
        })),
      ),
      subtotal: dollars(totals.subtotal),
      discount: dollars(totals.discount),
      shipping: dollars(totals.shipping),
      tax: dollars(totals.tax),
      total: dollars(totals.total),
      total_cents: String(totals.total),
      coupon: basis.coupon ?? basis.couponInput,
      order_id: `${scenario.ids.orderPrefix}${orderNumber}`,
      order_number: `ACM-${orderNumber}`,
      payment_method:
        basis.method === "wallet"
          ? app.os === "ios"
            ? "apple_pay"
            : "google_pay"
          : basis.method,
      shipping_method: basis.express ? "express" : "standard",
    };
  }

  function currentValues(): Record<string, string> {
    return templateValues(shop.cart.length === 0 && placed ? placed : shop);
  }

  function effectOf(spec: HttpSpec): { after: ShopData; line?: CartLine } {
    const lineIndex = Number(lastTap?.match(/_(\d+)$/)?.[1] ?? -1);
    const tappedLine = () => {
      const line = shop.cart[lineIndex];
      if (!line) {
        throw new Error(
          `${app.name}: ${script.flow} edits cart line ${lineIndex}, which the cart does not have`,
        );
      }
      return line;
    };
    switch (spec.effect) {
      case "cart_add": {
        const line = {
          product: openedProduct,
          option: selectedOption(),
          qty: 1,
        };
        const existing = shop.cart.findIndex(
          (l) => l.product === line.product && l.option === line.option,
        );
        const cart =
          existing >= 0
            ? shop.cart.map((l, i) =>
                i === existing ? { ...l, qty: l.qty + 1 } : l,
              )
            : [...shop.cart, line];
        return { after: { ...shop, cart }, line };
      }
      case "cart_update": {
        const current = tappedLine();
        const delta = lastTap?.startsWith("btn_qty_minus") ? -1 : 1;
        const line = { ...current, qty: Math.max(1, current.qty + delta) };
        const cart = shop.cart.map((l, i) => (i === lineIndex ? line : l));
        return { after: { ...shop, cart }, line };
      }
      case "cart_remove": {
        const line = tappedLine();
        const cart = shop.cart.filter((_, i) => i !== lineIndex);
        return { after: { ...shop, cart }, line };
      }
      case "coupon":
        return {
          after:
            COUPONS[shop.couponInput] !== undefined
              ? { ...shop, coupon: shop.couponInput }
              : shop,
        };
      case "search":
        return { after: { ...shop, results: shop.query } };
      default:
        return { after: shop };
    }
  }

  function successCode(spec: HttpSpec, seed: string): number {
    const ok = spec.statusCodes.filter((sc) => sc.code < 400);
    return ok.length > 0 ? weightedPick(ok, seed).code : 200;
  }

  function emitHttp(
    spec: HttpSpec,
    startTime: DateTime,
    outcome: number | "failure",
    seed: string,
    params?: string,
  ): { end: DateTime; ok: boolean } {
    const failed = outcome === "failure";
    const statusCode = outcome === "failure" ? 0 : outcome;
    const ok = !failed && statusCode < 400;
    const [minMs, maxMs] = failed
      ? (spec.failure?.durationMs ?? [spec.latencyMs[1], spec.latencyMs[1]])
      : spec.latencyMs;
    const durationMs = stableInt(`${seed}:duration`, minMs, maxMs);
    const { after, line } = effectOf(spec);
    const values = templateValues(
      spec.effect && spec.effect !== "order"
        ? after
        : shop.cart.length === 0 && placed
          ? placed
          : shop,
      line,
    );
    const category = params?.match(/category=([a-z]+)/)?.[1];
    const listed = PRODUCTS.flatMap((p, i) =>
      !category || p.category.toLowerCase() === category ? [i] : [],
    );
    if (params?.includes("sort=price_asc")) {
      listed.sort((a, b) => PRICE_CENTS[a] - PRICE_CENTS[b]);
    }
    values.catalog = JSON.stringify(
      listed.map((i) => ({
        id: productId(i),
        name: PRODUCTS[i].name,
        price_cents: PRICE_CENTS[i],
      })),
    );
    let url = fillTemplate(spec.url, values);
    if (params) {
      url += `${url.includes("?") ? "&" : "?"}${params}`;
    }
    const requestBody = fillTemplate(spec.requestBody ?? "", values);
    const responseBody = failed
      ? ""
      : ok
        ? fillTemplate(spec.responseBody ?? "", values)
        : JSON.stringify({ error: ERROR_NAMES[statusCode] ?? "error" });
    const headers = httpHeaders(
      spec.client,
      requestBody,
      version.name,
      app.os,
      device.os_version,
      statusCode,
      responseBody,
    );
    const endTime = startTime.plus({ milliseconds: durationMs });
    const httpThread =
      spec.client === "okhttp"
        ? `OkHttp ${new URL(url).origin}/...`
        : networkThread;
    const event: GeneratedEvent = {
      event_type: "http",
      user_defined_attribute: null,
      thread_name: httpThread,
      user_triggered: false,
      url,
      method: spec.method,
      status_code: statusCode,
      start_time: startTime.toMillis(),
      end_time: endTime.toMillis(),
      duration: durationMs,
      request_headers: headers.request,
      response_headers: headers.response,
      request_body: requestBody,
      response_body: responseBody,
      failure_reason: failed ? (spec.failure?.reason ?? "") : "",
      failure_description: failed ? (spec.failure?.description ?? "") : "",
      client: spec.client,
      timestamp: startTime.toISO()!,
    };
    push(httpThread, event);
    httpHits.push({ key: spec.key, event });
    if (ok && spec.effect === "order") {
      placed = { ...shop, order: orderNumber };
      shop = { ...shop, cart: [], coupon: null, couponInput: "" };
      refreshShop();
    } else if (ok && spec.effect) {
      shop = after;
      refreshShop();
    }
    return { end: endTime, ok };
  }

  // Scroll coordinates use the same unit as taps: pixels on Android and in
  // Flutter, points on iOS. Swiping up moves the content up to reveal what
  // is below, and swiping left reveals what is to the right.
  function emitScroll(
    target: string,
    targetId: string | undefined,
    seed: string,
    direction: "up" | "down" | "left" | "right",
    travelDp: number,
  ): void {
    const W = vp.width;
    const H = vp.height;
    const travel = Math.max(48, Math.abs(travelDp)) * vp.unitScale;
    const vertical = direction === "up" || direction === "down";
    let x = stableInt(`${seed}:x`, Math.round(W * 0.25), Math.round(W * 0.75));
    let y =
      direction === "up"
        ? stableInt(`${seed}:y`, Math.round(H * 0.6), Math.round(H * 0.8))
        : direction === "down"
          ? stableInt(`${seed}:y`, Math.round(H * 0.25), Math.round(H * 0.4))
          : stableInt(`${seed}:y`, Math.round(H * 0.2), Math.round(H * 0.35));
    if (!vertical) {
      x =
        direction === "left"
          ? stableInt(`${seed}:x`, Math.round(W * 0.65), Math.round(W * 0.85))
          : stableInt(`${seed}:x`, Math.round(W * 0.15), Math.round(W * 0.35));
    }
    const endX = vertical
      ? x + stableInt(`${seed}:drift`, -12, 12)
      : direction === "left"
        ? Math.max(Math.round(W * 0.05), x - travel)
        : Math.min(Math.round(W * 0.95), x + travel);
    const endY = !vertical
      ? y + stableInt(`${seed}:drift`, -8, 8)
      : direction === "up"
        ? Math.max(Math.round(H * 0.12), y - travel)
        : Math.min(Math.round(H * 0.9), y + travel);
    y = Math.round(y);
    push(mainThread, {
      event_type: "gesture_scroll",
      user_defined_attribute: null,
      thread_name: mainThread,
      target,
      target_id: targetId ?? "",
      x,
      y,
      end_x: Math.round(endX),
      end_y: Math.round(endY),
      direction,
      timestamp: cursor.toISO()!,
      attachments: null,
    });
  }

  function scrollTo(state: ScreenState, seed: string): void {
    const before = parseState(uiState);
    const after = parseState(state);
    const scroller = scrollBox(vp, uiState);
    if (after.chipOffset !== before.chipOffset) {
      const travel = after.chipOffset - before.chipOffset;
      emitScroll(
        scroller.target,
        scroller.targetId,
        seed,
        travel > 0 ? "left" : "right",
        travel,
      );
    } else {
      const travel = after.offset - before.offset;
      emitScroll(
        scroller.target,
        scroller.targetId,
        seed,
        travel >= 0 ? "up" : "down",
        travel,
      );
      if (travel > 0 && LIST_SCREENS.includes(after.screen)) {
        holdImages(SCROLL_IMAGE_KB);
      }
    }
    setUiState(state);
  }

  function lifecycleEvent(
    eventType: string,
    type: string,
    className: string,
    extra: Record<string, unknown> = {},
  ): void {
    push(mainThread, {
      event_type: eventType,
      user_defined_attribute: null,
      thread_name: mainThread,
      type,
      class_name: className,
      timestamp: cursor.toISO()!,
      ...extra,
    });
    advance(nextSeed(`${eventType}:${type}`), 10, 30);
  }

  function snapshot(state: ScreenState) {
    return {
      attachments: [layoutAttachment(nextSeed("attachment"), vp, state, null)],
    };
  }

  function activityEvent(type: string, className: string, state?: string) {
    lifecycleEvent(
      "lifecycle_activity",
      type,
      className,
      type === "resumed" && state ? snapshot(state) : {},
    );
  }

  function fragmentEvent(type: string, className: string, parent: string) {
    lifecycleEvent("lifecycle_fragment", type, className, {
      parent_activity: parent,
      parent_fragment: null,
      tag: null,
    });
  }

  function viewControllerEvent(
    type: string,
    className: string,
    state?: string,
  ) {
    lifecycleEvent(
      "lifecycle_view_controller",
      type,
      className,
      type === "viewDidAppear" && state ? snapshot(state) : {},
    );
  }

  function swiftUiEvent(type: string, className: string, state?: string) {
    lifecycleEvent(
      "lifecycle_swift_ui",
      type,
      className,
      type === "on_appear" && state ? snapshot(state) : {},
    );
  }

  function appEvent(type: "foreground" | "background"): void {
    push(mainThread, {
      event_type: "lifecycle_app",
      user_defined_attribute: null,
      thread_name: mainThread,
      type,
      timestamp: cursor.toISO()!,
    });
    advance(nextSeed(`app:${type}`), 5, 20);
  }

  function pushScreenView(name: string, state: ScreenState) {
    push(mainThread, {
      event_type: "screen_view",
      user_defined_attribute: null,
      thread_name: mainThread,
      user_triggered: false,
      name,
      timestamp: cursor.toISO()!,
      ...snapshot(state),
    });
    advance(nextSeed("screen_view"), 10, 30);
  }

  // A cold launch counts from process start, which comes before the SDK's
  // first event, and ends when the first screen draws, a little after it
  // resumes.
  const launchRange = scenario.launch[`${script.launch}Ms`];
  const launchDuration = stableInt(
    `${sessionId}:launch`,
    launchRange[0],
    launchRange[1],
  );
  const launchAt = start.plus({
    milliseconds:
      script.launch === "cold"
        ? Math.round(launchDuration * 0.6)
        : launchDuration,
  });
  let launching = true;

  function paceLaunch(): void {
    if (!launching) {
      return;
    }
    const resumedAt = start.plus({
      milliseconds: Math.round(launchAt.diff(start).as("milliseconds") * 0.7),
    });
    if (resumedAt > cursor) {
      cursor = resumedAt;
    }
  }

  function finishLaunch(className: string): void {
    if (!launching) {
      return;
    }
    launching = false;
    const drawnAt = DateTime.max(launchAt, cursor.plus({ milliseconds: 16 }));
    push(mainThread, {
      event_type: `${script.launch}_launch`,
      user_defined_attribute: null,
      thread_name: mainThread,
      duration: launchDuration,
      launched_activity: className,
      has_saved_state: false,
      intent_data: "",
      timestamp: drawnAt.toISO()!,
    });
    cursor = drawnAt;
    advance(`${sessionId}:launch-gap`, 20, 60);
  }

  function showActivity(className: string, state: ScreenState): void {
    const fresh = !(launching && script.launch === "hot");
    if (fresh) {
      activityEvent("created", className);
    }
    if (launching && app.os === "android") {
      appEvent("foreground");
    }
    paceLaunch();
    activityEvent("resumed", className, state);
    currentActivity = className;
    finishLaunch(className);
  }

  function showViewController(className: string, state: ScreenState): void {
    if (!(launching && script.launch === "hot")) {
      viewControllerEvent("viewDidLoad", className);
    }
    viewControllerEvent("viewWillAppear", className);
    paceLaunch();
    viewControllerEvent("viewDidAppear", className, state);
    finishLaunch(className);
  }

  function hostingActivity(screen: ScreenSpec): string | null {
    if (screen.lifecycle === "activity") {
      return screen.className ?? null;
    }
    if (screen.lifecycle === "fragment") {
      return screen.parentActivity ?? scenario.host?.className ?? null;
    }
    return scenario.host?.lifecycle === "activity"
      ? scenario.host.className
      : null;
  }

  function fragmentOf(screen: ScreenSpec): string | null {
    return screen.lifecycle === "fragment" ? (screen.className ?? null) : null;
  }

  // The iOS screen a user sees: a view controller or a SwiftUI view. Route
  // screens inside a Flutter or React Native host have none of their own.
  function nativeView(screen: ScreenSpec): ScreenSpec | null {
    return screen.lifecycle === "view_controller" ||
      screen.lifecycle === "swift_ui"
      ? screen
      : null;
  }

  function hideView(screen: ScreenSpec): void {
    if (screen.lifecycle === "view_controller") {
      viewControllerEvent("viewWillDisappear", screen.className!);
      viewControllerEvent("viewDidDisappear", screen.className!);
    } else {
      swiftUiEvent("on_disappear", screen.className!);
    }
  }

  function showView(screen: ScreenSpec, state: ScreenState, fresh: boolean) {
    if (screen.lifecycle === "view_controller") {
      if (fresh) {
        showViewController(screen.className!, state);
      } else {
        viewControllerEvent("viewWillAppear", screen.className!);
        viewControllerEvent("viewDidAppear", screen.className!, state);
      }
    } else {
      swiftUiEvent("on_appear", screen.className!, state);
      finishLaunch(screen.className!);
    }
  }

  // Returning to a screen already on the back stack pops everything above
  // it: the covered screen resumes and the popped activities are destroyed,
  // the way a back press or a CLEAR_TOP navigation leaves them.
  function popTo(indexInStack: number): void {
    const target = stack[indexInStack];
    const popped = stack.slice(indexInStack + 1).reverse();
    const top = popped[0];
    const state = withShop(
      target.state,
      shopFor(parseState(target.state).screen),
    );
    if (parseState(state).screen === "product_detail") {
      openedProduct = parseState(state).product;
    }
    const released = SCREEN_IMAGE_KB[parseState(top.state).screen] ?? 0;
    holdImages(-Math.round(released * 0.4));
    if (app.os === "android") {
      const targetActivity = hostingActivity(target.screen);
      const topFragment = fragmentOf(top.screen);
      if (topFragment) {
        fragmentEvent("paused", topFragment, hostingActivity(top.screen)!);
      }
      if (targetActivity && currentActivity !== targetActivity) {
        if (currentActivity) {
          activityEvent("paused", currentActivity);
        }
        activityEvent("resumed", targetActivity, state);
        currentActivity = targetActivity;
      }
      const destroyed = new Set<string>();
      for (const entry of popped) {
        const fragment = fragmentOf(entry.screen);
        const activity = hostingActivity(entry.screen);
        if (fragment) {
          fragmentEvent("detached", fragment, activity ?? "");
        }
        if (
          activity &&
          activity !== targetActivity &&
          !destroyed.has(activity)
        ) {
          activityEvent("destroyed", activity);
          destroyed.add(activity);
        }
      }
      const targetFragment = fragmentOf(target.screen);
      if (targetFragment) {
        fragmentEvent("resumed", targetFragment, targetActivity ?? "");
      }
    } else {
      const hidden = nativeView(top.screen);
      if (hidden) {
        hideView(hidden);
      }
      const shown = nativeView(target.screen);
      if (shown) {
        showView(shown, state, false);
      }
    }
    if (target.screen.routeName) {
      pushScreenView(target.screen.routeName, state);
    }
    stack.length = indexInStack + 1;
    target.state = state;
    uiState = state;
  }

  function enterScreen(screen: ScreenSpec, variant: string | null): void {
    const canonical = scenario.ui.screens[screen.key];
    if (!canonical) {
      throw new Error(`${app.name}: screen ${screen.key} has no layout`);
    }
    const state = stateForScreen(
      canonical,
      openedProduct,
      shopFor(canonical),
      variant,
    );
    holdImages(SCREEN_IMAGE_KB[canonical] ?? 2 * MB);
    // Each product page is its own instance on the stack, while any other
    // screen already open is returned to.
    const top = stack[stack.length - 1];
    const reusable = canonical !== "product_detail";
    if (reusable && top?.screen.key === screen.key) {
      setUiState(state);
      return;
    }
    const existing = reusable
      ? stack.findIndex((entry) => entry.screen.key === screen.key)
      : -1;
    if (existing >= 0) {
      popTo(existing);
      setUiState(state);
      return;
    }
    if (app.os === "android") {
      const activity = hostingActivity(screen);
      if (fragmentOf(screen) && activity && activity !== currentActivity) {
        const host = stack
          .map((entry) => hostingActivity(entry.screen))
          .lastIndexOf(activity);
        if (host >= 0) {
          popTo(host);
        }
      }
      const covered = stack[stack.length - 1];
      const coveredFragment = covered ? fragmentOf(covered.screen) : null;
      if (activity && activity !== currentActivity) {
        if (coveredFragment) {
          fragmentEvent("paused", coveredFragment, currentActivity ?? "");
        }
        if (currentActivity) {
          activityEvent("paused", currentActivity);
        }
        showActivity(activity, state);
      } else if (coveredFragment) {
        fragmentEvent("paused", coveredFragment, currentActivity ?? "");
      }
      const fragment = fragmentOf(screen);
      if (fragment) {
        fragmentEvent("attached", fragment, activity ?? "");
        fragmentEvent("resumed", fragment, activity ?? "");
      }
    } else {
      const shown = nativeView(screen);
      if (shown) {
        const hidden = top ? nativeView(top.screen) : null;
        if (hidden) {
          hideView(hidden);
        }
        showView(shown, state, true);
      }
    }
    if (screen.routeName) {
      pushScreenView(screen.routeName, state);
    }
    stack.push({ screen, state });
    uiState = state;
  }

  function leaveScreen(): void {
    if (stack.length < 2) {
      throw new Error(
        `${app.name}: ${script.flow} goes back with no screen behind`,
      );
    }
    popTo(stack.length - 2);
  }

  // Android pauses the activity, reports the app in the background once the
  // activity stops, and asks the app to trim memory now its UI is hidden.
  function moveToBackground(): void {
    if (app.os === "android") {
      const top = stack[stack.length - 1];
      const fragment = top ? fragmentOf(top.screen) : null;
      if (fragment) {
        fragmentEvent("paused", fragment, currentActivity ?? "");
      }
      if (currentActivity) {
        activityEvent("paused", currentActivity);
      }
      advance(nextSeed("stop"), 650, 800);
    }
    appEvent("background");
    if (app.os === "android") {
      push(mainThread, {
        event_type: "trim_memory",
        user_defined_attribute: null,
        thread_name: mainThread,
        level: "TRIM_MEMORY_UI_HIDDEN",
        timestamp: cursor.toISO()!,
      });
      advance(nextSeed("trim"), 5, 30);
    }
  }

  function returnToForeground(): void {
    appEvent("foreground");
    const top = stack[stack.length - 1];
    if (app.os === "android" && currentActivity) {
      activityEvent("resumed", currentActivity, uiState);
      const fragment = top ? fragmentOf(top.screen) : null;
      if (fragment) {
        fragmentEvent("resumed", fragment, currentActivity);
      }
    }
    const duration = stableInt(
      nextSeed("hot"),
      scenario.launch.hotMs[0],
      scenario.launch.hotMs[1],
    );
    const drawnAt = cursor.plus({ milliseconds: duration });
    push(mainThread, {
      event_type: "hot_launch",
      user_defined_attribute: null,
      thread_name: mainThread,
      duration,
      launched_activity:
        currentActivity ??
        (top ? nativeView(top.screen)?.className : null) ??
        scenario.host?.className ??
        "",
      has_saved_state: false,
      intent_data: "",
      timestamp: drawnAt.toISO()!,
    });
    cursor = drawnAt;
    advance(nextSeed("hot-gap"), 20, 60);
  }

  if (app.os === "ios") {
    appEvent("foreground");
    push(mainThread, {
      event_type: "network_change",
      user_defined_attribute: null,
      thread_name: mainThread,
      network_type: device.network_type,
      network_generation: device.network_generation,
      network_provider: device.network_provider,
      previous_network_type: "unknown",
      previous_network_generation: "unknown",
      timestamp: cursor.toISO()!,
    });
    advance(`${sessionId}:netchange-gap`, 10, 40);
  }

  if (scenario.host) {
    const firstScreen = flow.steps.find((step) => step.kind === "screen");
    const hostState =
      firstScreen && firstScreen.kind === "screen"
        ? stateForScreen(scenario.ui.screens[firstScreen.screen] ?? "home", 0)
        : uiState;
    if (scenario.host.lifecycle === "activity") {
      showActivity(scenario.host.className, hostState);
    } else {
      showViewController(scenario.host.className, hostState);
    }
  }

  // The thread an error event is recorded on: a crash's own thread, the
  // React Native JS thread for a JS error, and the platform main thread for a
  // Dart error, which reaches the native SDK over a platform channel.
  function reportingThread(spec: ExceptionSpec): string {
    if (spec.reportedOn) {
      return spec.reportedOn;
    }
    if (spec.kind === "anr" || spec.framework === "dart") {
      return mainThread;
    }
    if (spec.framework === "js") {
      return app.os === "android" ? "mqt_js" : "com.facebook.react.JavaScript";
    }
    const named = spec.exceptions[0]?.thread_name;
    return !named || named === "main" || named === "Thread 0 Crashed"
      ? mainThread
      : named;
  }

  let stepIndex = 0;
  for (const step of flow.steps) {
    if (ended) {
      break;
    }
    stepIndex += 1;
    const seed = `${sessionId}:${stepIndex}`;

    if (step.kind === "screen") {
      const screen = scenario.screens.find((sc) => sc.key === step.screen);
      if (!screen) {
        throw new Error(`${app.name}: unknown screen ${step.screen}`);
      }
      enterScreen(screen, step.variant ?? null);
    } else if (step.kind === "back") {
      leaveScreen();
    } else if (step.kind === "variant") {
      setUiState(withVariant(uiState, step.variant));
    } else if (step.kind === "gesture") {
      if (step.type === "scroll") {
        scrollTo(stateAfterScroll(vp, uiState), seed);
      } else {
        if (step.node) {
          const revealed = scrollToReveal(vp, uiState, step.node);
          if (revealed !== uiState) {
            scrollTo(revealed, `${seed}:reveal`);
            advance(`${seed}:reveal-gap`, 900, 2_200);
          }
        }
        const box = step.node
          ? gestureBox(vp, uiState, step.node, (min, max) =>
              stableInt(`${seed}:jitter:${min}:${max}`, min, max),
            )
          : null;
        if (step.node && box === null) {
          throw new Error(
            `${app.name}: ${script.flow} taps ${step.node}, which ${uiState} does not show`,
          );
        }
        const highlight = step.node ?? null;
        push(mainThread, {
          event_type:
            step.type === "long_click" ? "gesture_long_click" : "gesture_click",
          user_defined_attribute: null,
          thread_name: mainThread,
          target: box?.target ?? step.target ?? "",
          target_id: box?.targetId ?? step.targetId ?? "",
          label: step.label ?? box?.label ?? "",
          semantic_label: "",
          width:
            box?.width ??
            step.width ??
            stableInt(`${seed}:w`, 120, Math.max(121, vp.width - 120)),
          height: box?.height ?? step.height ?? stableInt(`${seed}:h`, 88, 260),
          x: box?.x ?? stableInt(`${seed}:x`, 40, Math.max(41, vp.width - 40)),
          y:
            box?.y ??
            stableInt(`${seed}:y`, 140, Math.max(141, vp.height - 140)),
          timestamp: cursor.toISO()!,
          attachments: [
            layoutAttachment(`attachment:${seed}`, vp, uiState, highlight),
          ],
        });
        if (step.node) {
          lastTap = step.node;
          const product = openedProductFor(uiState, step.node);
          if (product !== null) {
            openedProduct = product;
          }
          shop = shopAfterTap(shop, uiState, step.node);
          setUiState(stateAfterTap(uiState, step.node));
          refreshShop();
        }
      }
    } else if (step.kind === "http") {
      const spec = scenario.http.find((h) => h.key === step.http);
      if (!spec) {
        throw new Error(`${app.name}: unknown http ${step.http}`);
      }
      if (step.outcome !== undefined) {
        cursor = emitHttp(spec, cursor, step.outcome, seed, step.params).end;
      } else {
        // A drawn server error or network failure is retried, so the steps
        // after the request still see it succeed.
        const drawn = weightedPick(
          [
            ...spec.statusCodes.filter((sc) => sc.code < 400 || sc.code >= 500),
            ...(spec.failure ? [{ code: 0, weight: spec.failure.weight }] : []),
          ],
          `${seed}:status`,
        ).code;
        if (drawn > 0 && drawn < 400) {
          cursor = emitHttp(spec, cursor, drawn, seed, step.params).end;
        } else {
          const first = emitHttp(
            spec,
            cursor,
            drawn === 0 ? "failure" : drawn,
            seed,
            step.params,
          );
          cursor = first.end;
          advance(`${seed}:retry-log`, 5, 30);
          const path = new URL(fillTemplate(spec.url, currentValues()))
            .pathname;
          push(mainThread, {
            event_type: "log",
            user_defined_attribute: null,
            thread_name: mainThread,
            severity_text: "warning",
            severity_number: 13,
            body: `Retrying ${spec.method.toUpperCase()} ${path} after ${drawn === 0 ? spec.failure!.reason : `HTTP ${drawn}`}`,
            timestamp: cursor.toISO()!,
          });
          advance(`${seed}:backoff`, 800, 2_000);
          cursor = emitHttp(
            spec,
            cursor,
            successCode(spec, `${seed}:retry`),
            `${seed}:retry`,
            step.params,
          ).end;
        }
      }
    } else if (step.kind === "type") {
      const screen = parseState(uiState).screen;
      if (screen === "search") {
        shop = { ...shop, query: step.text };
      } else if (screen === "cart") {
        shop = { ...shop, couponInput: step.text };
      }
      refreshShop();
    } else if (step.kind === "custom") {
      if (step.startup && script.launch !== "cold") {
        continue;
      }
      push(mainThread, {
        event_type: "custom",
        user_defined_attribute: step.attributes ?? {},
        thread_name: mainThread,
        user_triggered: true,
        name: step.name,
        timestamp: cursor.toISO()!,
      });
    } else if (step.kind === "log") {
      const severityNumber = {
        debug: 5,
        info: 9,
        warning: 13,
        error: 17,
        fatal: 21,
      }[step.severity];
      push(mainThread, {
        event_type: "log",
        user_defined_attribute: null,
        thread_name: mainThread,
        severity_text: step.severity,
        severity_number: severityNumber,
        body: fillTemplate(step.body, currentValues()),
        timestamp: cursor.toISO()!,
      });
    } else if (step.kind === "span") {
      const spec = scenario.spans.find((sp) => sp.key === step.span);
      if (!spec) {
        throw new Error(`${app.name}: unknown span ${step.span}`);
      }
      const flat: SpanRecord[] = [];
      const rootStart = cursor;
      const traceId = stableHex(`trace:${seed}:${spec.key}`, 32);
      const values = currentValues();
      const run: SpanRun = {
        include: (child) => child.onlyWith !== "coupon" || shop.coupon !== null,
        abortBefore: step.abortBefore,
        request: (child, requestStart) => {
          const httpSpec = scenario.http.find((h) => h.key === child.http)!;
          const outcome =
            step.fail?.span === child.key
              ? (step.fail.status ?? (httpSpec.failure ? "failure" : 503))
              : successCode(httpSpec, `${seed}:${child.key}:status`);
          const result = emitHttp(
            httpSpec,
            requestStart,
            outcome,
            `${seed}:${child.key}`,
          );
          return {
            durationMs: Math.round(
              result.end.diff(requestStart).as("milliseconds"),
            ),
            ok: result.ok,
          };
        },
        fill: (value) => fillTemplate(value, values),
        checkpoints: [],
        abortedAt: null,
      };
      buildSpanTree(
        spec,
        "",
        rootStart,
        `${seed}:${spec.key}`,
        mainThread,
        scenario.threadNames,
        flat,
        run,
      );
      if (run.abortedAt) {
        cursor = run.abortedAt;
      } else {
        const root = flat.find((s) => s.parent_id === "")!;
        if (run.checkpoints.length > 0) {
          root.checkpoints = [
            ...(root.checkpoints ?? []),
            ...run.checkpoints,
          ].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        }
        traces.push({
          app_id: app.id,
          trace_id: traceId,
          session_id: sessionId,
          user_id: person.id,
          start_time: root.start_time,
          end_time: root.end_time,
          duration: root.duration,
          app_version: `${version.name}(${version.code})`,
          os_version: `${app.os} ${device.os_version}`,
          device_manufacturer: device.device_manufacturer,
          device_model: device.device_model,
          network_type: device.network_type,
          spans: flat,
        });
        traceRefs.push({
          trace_id: traceId,
          trace_name: spec.name,
          thread_name: mainThread,
          start_time: root.start_time,
          end_time: root.end_time,
          duration: root.duration,
        });
        // Without setZone the reparse would adopt the machine's local zone
        // and drop the offset the ISO string carries.
        cursor = DateTime.fromISO(root.end_time, { setZone: true });
      }
    } else if (step.kind === "exception") {
      const spec = scenario.exceptions.find((e) => e.key === step.exception);
      if (!spec) {
        throw new Error(`${app.name}: unknown exception ${step.exception}`);
      }
      if (spec.kind === "anr" && app.os !== "android") {
        throw new Error(
          `${app.name}: anr ${spec.key} used on a non-android app`,
        );
      }
      function emitException(
        emitted: ExceptionSpec,
        attachments: ReturnType<typeof screenshotAttachment>[],
      ): GeneratedEvent {
        const timestamp = cursor.toISO()!;
        const threadName = reportingThread(emitted);
        const shared: GeneratedEvent = {
          user_defined_attribute: null,
          thread_name: threadName,
          severity: emitted.severity,
          group_id: stableUuid(`errorgroup:${app.id}:${emitted.key}`),
          type: emitted.type,
          message: emitted.message,
          method_name: emitted.method_name,
          file_name: emitted.file_name,
          line_number: emitted.line_number,
          stacktrace: emitted.stacktrace,
          foreground: emitted.foreground,
          attachments,
          timestamp,
          event_type: emitted.kind === "anr" ? "anr" : "error",
        };
        const emittedEvent: GeneratedEvent =
          emitted.kind === "anr"
            ? shared
            : {
                ...shared,
                user_triggered: false,
                is_custom: false,
                num_code: emitted.error?.num_code ?? null,
                code: emitted.error?.code ?? "",
                meta: emitted.error?.meta ?? null,
              };
        push(threadName, emittedEvent);
        errorHits.push({ key: emitted.key, event: emittedEvent, timestamp });
        return emittedEvent;
      }

      // The ANR watchdog reports only after the main thread has been silent
      // for five seconds.
      if (spec.kind === "anr") {
        const mainEvents = threads[mainThread] ?? [];
        const lastMain = mainEvents[mainEvents.length - 1];
        if (lastMain) {
          const earliest = DateTime.fromISO(lastMain.timestamp, {
            setZone: true,
          }).plus({ milliseconds: stableInt(`${seed}:anr`, 5_200, 6_800) });
          if (earliest > cursor) {
            cursor = earliest;
          }
        }
      }
      const attachments =
        spec.severity === "fatal"
          ? [screenshotAttachment(`attachment:${seed}:crash`, vp, uiState)]
          : [];
      emitException(spec, attachments);

      let processKiller = spec;
      if (spec.nativeFollowUp) {
        const followUp = scenario.exceptions.find(
          (e) => e.key === spec.nativeFollowUp,
        );
        if (!followUp) {
          throw new Error(
            `${app.name}: unknown native follow-up ${spec.nativeFollowUp}`,
          );
        }
        advance(`${seed}:native-crash-gap`, 20, 80);
        emitException(followUp, attachments);
        processKiller = followUp;
      }

      if (spec.severity === "fatal") {
        if (app.os === "android") {
          advance(`${seed}:exit-gap`, 20, 80);
          push(mainThread, {
            event_type: "app_exit",
            user_defined_attribute: null,
            thread_name: mainThread,
            reason: processKiller.kind === "anr" ? "ANR" : "CRASH",
            importance: "FOREGROUND",
            trace: processKiller.stacktrace,
            process_name: app.uniqueId,
            pid: stableInt(`${sessionId}:pid`, 1000, 32000),
            timestamp: cursor.toISO()!,
          });
        }
        ended = true;
      }
    } else if (step.kind === "bug_report") {
      const eventId = stableUuid(`bugreport:${app.id}:${index}`);
      const timestamp = cursor.toISO()!;
      const attachments = [
        screenshotAttachment(`attachment:${seed}:bugreport`, vp, uiState),
      ];
      push(mainThread, {
        event_type: "bug_report",
        user_defined_attribute: null,
        thread_name: mainThread,
        bug_report_id: eventId,
        description: step.description,
        attachments,
        timestamp,
      });
      bugReport = {
        eventId,
        description: step.description,
        timestamp,
        attachments,
      };
    } else if (step.kind === "background") {
      moveToBackground();
      const leftAt = cursor.diff(start).as("milliseconds");
      cursor = cursor.plus({ milliseconds: step.ms });
      backgrounded.push([leftAt, cursor.diff(start).as("milliseconds")]);
      returnToForeground();
    } else if (step.kind === "wait") {
      cursor = cursor.plus({ milliseconds: step.ms });
    }

    if (!ended) {
      const [minGap, maxGap] = gapAfter(step, flow.steps[stepIndex]);
      advance(`${seed}:gap`, minGap, maxGap);
    }
  }

  // A session that did not crash ends with the user leaving the app from the
  // screen they were on.
  if (!ended) {
    advance(`${sessionId}:last-dwell`, 1_500, 6_000);
    moveToBackground();
  }

  // The backend takes last_event_timestamp from the latest event or span end.
  const lastActivityMs = Math.max(
    start.toMillis(),
    ...Object.values(threads).flatMap((events) =>
      events.map((event) =>
        DateTime.fromISO(String(event.timestamp)).toMillis(),
      ),
    ),
    ...traceRefs.map((ref) => DateTime.fromISO(ref.end_time).toMillis()),
  );
  const end = DateTime.fromMillis(lastActivityMs).toUTC();
  const durationMs = Math.max(
    1,
    Math.round(end.diff(start).as("milliseconds")),
  );

  const deviceTotalMemory = deviceTotalMemoryKb(app.os, device.device_model);
  const memory = memorySamples({
    seed: sessionId,
    os: app.os,
    start,
    durationMs,
    loads: memoryLoads,
    limitKb:
      app.os === "android"
        ? androidMemoryTargetKb(deviceTotalMemory, "foreground")
        : iosMemoryLimitKb(deviceTotalMemory),
    deviceTotalMemory,
    leaking: script.memoryLeak === true,
    backgrounded,
    activityAt: (threads[mainThread] ?? []).map((event) =>
      DateTime.fromISO(String(event.timestamp)).diff(start).as("milliseconds"),
    ),
  });
  for (const at of memory.trimAt) {
    push(mainThread, {
      event_type: "trim_memory",
      user_defined_attribute: null,
      thread_name: mainThread,
      level: "TRIM_MEMORY_RUNNING_LOW",
      timestamp: start.plus({ milliseconds: at }).toISO()!,
    });
  }

  // Requests made inside a trace are emitted as the trace is built, which can
  // put them out of order with requests on the same thread.
  for (const events of Object.values(threads)) {
    events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  const attribute: SessionAttribute = {
    installation_id: installationId,
    app_version: version.name,
    app_build: version.code,
    app_unique_id: app.uniqueId,
    measure_sdk_version: app.sdkVersion,
    thread_name: mainThread,
    user_id: person.id,
    device_name: device.device_name,
    device_model: device.device_model,
    device_manufacturer: device.device_manufacturer,
    device_type: device.device_type,
    device_is_foldable: device.device_is_foldable,
    device_is_physical: true,
    device_density_dpi: device.device_density_dpi,
    device_width_px: device.device_width_px,
    device_height_px: device.device_height_px,
    device_density: device.device_density,
    device_locale: user.locale,
    device_low_power_mode: device.device_low_power_mode,
    device_thermal_throttling_enabled: device.device_thermal_throttling_enabled,
    device_cpu_arch: device.device_cpu_arch,
    device_total_memory: deviceTotalMemory,
    os_name: app.os,
    os_version: device.os_version,
    os_page_size: device.os_page_size,
    network_type: device.network_type,
    network_provider: device.network_provider,
    network_generation: device.network_generation,
  };

  const list: SessionListEntry = {
    session_id: sessionId,
    app_id: app.id,
    first_event_time: start.toISO()!,
    last_event_time: end.toISO()!,
    duration: String(durationMs),
    attribute: {
      app_version: attribute.app_version,
      app_build: attribute.app_build,
      user_id: attribute.user_id,
      device_name: attribute.device_name,
      device_model: attribute.device_model,
      device_manufacturer: attribute.device_manufacturer,
      os_name: attribute.os_name,
      os_version: attribute.os_version,
    },
  };

  const detail: SessionDetail = {
    session_id: sessionId,
    app_id: app.id,
    attribute,
    duration: durationMs,
    cpu_usage: memory.cpu,
    memory_usage: app.os === "android" ? memory.android : null,
    memory_usage_absolute: app.os === "ios" ? memory.ios : null,
    threads,
    traces: traceRefs,
  };

  return { sessionId, list, detail, errorHits, httpHits, bugReport, traces };
}

const LIST_SCREENS: ScreenKey[] = [
  "home",
  "products",
  "search",
  "cart",
  "orders",
  "product_detail",
];

// Memory follows what the session holds: a base the app needs to run, the
// images its screens decode, which a bounded cache releases as the user goes
// back, and in a leaking session every image it has decoded. Each 2 s sample
// moves part of the way toward that level, with a small drift carried from
// one sample to the next. On Android the images live in the native heap,
// while the Java heap fills with short-lived objects and drops at each
// collection. The SDK takes no samples while the app is in the background.
function memorySamples(input: {
  seed: string;
  os: string;
  start: DateTime;
  durationMs: number;
  loads: MemoryLoad[];
  limitKb: number;
  deviceTotalMemory: number;
  activityAt: number[];
  leaking: boolean;
  backgrounded: [number, number][];
}): {
  android: Record<string, unknown>[];
  ios: Record<string, unknown>[];
  cpu: { timestamp: string; value: number }[];
  trimAt: number[];
} {
  const { seed, os, start, durationMs, loads, limitKb } = input;
  const next = randomStream(`${seed}:memory`);
  const gauss = () => {
    const u = Math.max(next(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * next());
  };
  const android = os === "android";
  const leaking = input.leaking;
  const loaded = loads.reduce((sum, l) => sum + Math.max(0, l.kb), 0);
  const baseKb = android
    ? stableInt(`${seed}:memory:base`, 150 * MB, 190 * MB)
    : stableInt(`${seed}:memory:base`, 95 * MB, 140 * MB);
  const peakKb =
    (limitKb * (stableInt(`${seed}:memory:peak`, 86, 93) / 100) - baseKb) /
      (android ? 1 : 1.1) -
    IMAGE_CACHE_CAP_KB;
  const leakFactor =
    leaking && loaded > 0
      ? Math.min(LEAK_MAX_FACTOR, Math.max(0, peakKb / loaded))
      : 0;

  const codeKb = stableInt(`${seed}:memory:code`, 96 * MB, 112 * MB);
  const graphicsKb = stableInt(`${seed}:memory:gfx`, 36 * MB, 50 * MB);
  const nativeBase = stableInt(`${seed}:memory:native`, 22 * MB, 34 * MB);
  const swapKb =
    input.deviceTotalMemory < 7 * 1024 * MB
      ? stableInt(`${seed}:memory:swap`, 4 * MB, 12 * MB)
      : 0;
  let javaTotal = stableInt(`${seed}:memory:jheap`, 36 * MB, 48 * MB);
  const javaLiveBase = stableInt(`${seed}:memory:jlive`, 14 * MB, 20 * MB);
  let garbage = 0;

  let cache = 0;
  let leaked = 0;
  let level = 0;
  let drift = 0;
  let cpuDrift = 0;
  let loadIndex = 0;
  const ordered = [...loads].sort((a, b) => a.atMs - b.atMs);
  const out = {
    android: [] as Record<string, unknown>[],
    ios: [] as Record<string, unknown>[],
    cpu: [] as { timestamp: string; value: number }[],
    trimAt: [] as number[],
  };
  let trimmed = false;
  let previousT: number | null = null;
  for (let t = 0; t <= durationMs; t += 2000) {
    if (input.backgrounded.some(([from, to]) => t > from && t < to)) {
      continue;
    }
    while (loadIndex < ordered.length && ordered[loadIndex].atMs <= t) {
      const load = ordered[loadIndex];
      cache = Math.max(0, Math.min(IMAGE_CACHE_CAP_KB, cache + load.kb));
      leaked += Math.max(0, load.kb) * leakFactor;
      loadIndex += 1;
    }
    const wanted = cache + leaked;
    level = t === 0 ? wanted * 0.5 : level + (wanted - level) * 0.55;
    drift = drift * 0.75 + gauss() * 1.2 * MB;
    const ts = start.plus({ milliseconds: t }).toISO()!;
    const interval = previousT === null ? 0 : t - previousT;
    previousT = t;
    const busy = input.activityAt.filter(
      (at) => at > t - 2000 && at <= t,
    ).length;
    cpuDrift = cpuDrift * 0.7 + gauss() * 0.8;
    out.cpu.push({
      timestamp: ts,
      value:
        Math.round(
          Math.max(0.4, Math.min(85, 4 + cpuDrift + Math.min(40, busy * 6))) *
            10,
        ) / 10,
    });
    if (android) {
      const live = javaLiveBase + cache * 0.15;
      javaTotal = Math.min(
        256 * MB,
        Math.max(javaTotal, Math.ceil(live / 0.5 / (4 * MB)) * 4 * MB),
      );
      garbage += (0.5 + next() * 1.1 + busy * 0.4) * MB;
      if (live + garbage > javaTotal * 0.85) {
        garbage = javaTotal * (0.03 + next() * 0.04);
      }
      const javaUsed = live + garbage;
      const nativeTotal = nativeBase + level + drift * 0.4;
      const nativeFree = nativeTotal * (0.04 + next() * 0.02);
      const anonRss = javaTotal + nativeTotal + graphicsKb * 0.35 + 12 * MB;
      const rss = codeKb + javaTotal + nativeTotal + graphicsKb + drift;
      const dynamic = anonRss + swapKb;
      if (!trimmed && dynamic >= limitKb * 0.8) {
        trimmed = true;
        out.trimAt.push(t);
      }
      out.android.push({
        java_max_heap: 262144,
        java_total_heap: Math.round(javaTotal),
        java_free_heap: Math.round(javaTotal - javaUsed),
        total_pss: Math.round(rss * 0.78 + drift * 0.5),
        rss: Math.round(rss),
        anon_rss: Math.round(anonRss),
        swap: swapKb,
        dynamic_memory: Math.round(dynamic),
        native_total_heap: Math.round(nativeTotal),
        native_free_heap: Math.round(nativeFree),
        interval,
        timestamp: ts,
      });
    } else {
      // The iOS SDK reports memory in kilobytes, and max_memory is the
      // device's physical memory.
      const used = Math.round(baseKb + level * 1.1 + drift);
      out.ios.push({
        max_memory: input.deviceTotalMemory,
        used_memory: used,
        available_memory: Math.max(1024, limitKb - used),
        interval,
        timestamp: ts,
      });
    }
  }
  return out;
}

type ScreenStep = {
  name: string;
  timestamp: string;
  kind:
    | "activity"
    | "fragment"
    | "view_controller"
    | "swift_ui"
    | "screen_view";
};

// A fragment detached from the activity on screen hands the screen back to
// that activity, which resumed earlier and so has no event of its own at that
// moment, unless another screen resumes right after the detach.
function screenSequence(
  detail: SessionDetail,
  mainThread: string,
): ScreenStep[] {
  const events = detail.threads[mainThread] ?? [];
  const found: (ScreenStep & { detach: boolean })[] = [];
  let resumedActivity: string | null = null;
  for (const event of events) {
    let name: string | null = null;
    let kind: ScreenStep["kind"] = "screen_view";
    if (
      (event.event_type === "lifecycle_activity" ||
        event.event_type === "lifecycle_fragment") &&
      event.type === "resumed"
    ) {
      name = String(event.class_name);
      kind =
        event.event_type === "lifecycle_activity" ? "activity" : "fragment";
    } else if (
      event.event_type === "lifecycle_fragment" &&
      event.type === "detached" &&
      event.parent_activity === resumedActivity
    ) {
      name = String(event.parent_activity);
      kind = "activity";
    } else if (
      event.event_type === "lifecycle_view_controller" &&
      event.type === "viewDidAppear"
    ) {
      name = String(event.class_name);
      kind = "view_controller";
    } else if (
      event.event_type === "lifecycle_swift_ui" &&
      event.type === "on_appear"
    ) {
      name = String(event.class_name);
      kind = "swift_ui";
    } else if (event.event_type === "screen_view") {
      name = String(event.name);
      kind = "screen_view";
    }
    if (event.event_type === "lifecycle_activity" && event.type === "resumed") {
      resumedActivity = String(event.class_name);
    }
    if (name) {
      found.push({
        name,
        timestamp: String(event.timestamp),
        kind,
        detach: event.type === "detached",
      });
    }
  }
  const sequence: ScreenStep[] = [];
  found.forEach((entry, i) => {
    const next = found[i + 1];
    const replaced =
      entry.detach &&
      next !== undefined &&
      DateTime.fromISO(next.timestamp).toMillis() -
        DateTime.fromISO(entry.timestamp).toMillis() <
        250;
    if (!replaced && sequence[sequence.length - 1]?.name !== entry.name) {
      sequence.push({
        name: entry.name,
        timestamp: entry.timestamp,
        kind: entry.kind,
      });
    }
  });
  return sequence;
}

const HANDLED_ERROR_RATE = 0.00417;
const UNHANDLED_ERROR_RATE = 0.00286;

const BUG_REPORTS_PER_DAY_PER_100K_SESSIONS = 1.2;

const REFERENCE_WINDOW_DAYS = 30;

export function dailyBugReports(app: AppSpec): number {
  return Math.max(
    8,
    (app.dailySessions / 100_000) * BUG_REPORTS_PER_DAY_PER_100K_SESSIONS,
  );
}

function domainAndPath(url: string): { domain: string; path: string } {
  try {
    const u = new URL(url);
    return { domain: u.hostname, path: u.pathname };
  } catch {
    return { domain: "", path: url };
  }
}

const LAUNCH_COMPARISON = { cold: 1.18, warm: 1.15, hot: 1.12 };

function launchMetric(
  p95: number,
  factor: number,
  noData: boolean,
  unselectedNoData: boolean,
) {
  return {
    p95: noData ? 0 : p95,
    unselected_p95: unselectedNoData ? 0 : Math.round(p95 * factor),
    no_data: noData,
    unselected_no_data: unselectedNoData,
  };
}

// Crash and ANR free rates come from the same per-version group counts the
// errors pages show, over the sessions each version ran in the range.
export function computeMetrics(
  bundle: AppBundle,
  filterExpr: string | null,
  range: SandboxRange,
): Metrics {
  const app = bundle.scenario.app;
  const selected = selectedNames(app, filterExpr);
  const unselected = app.versions
    .map((v) => v.name)
    .filter((name) => !selected.includes(name));

  const allSessions = Math.round(
    sessionsIn(
      bundle,
      range,
      app.versions.map((v) => v.name),
    ),
  );
  const selectedSessions = Math.round(sessionsIn(bundle, range, selected));
  const unselectedSessions = allSessions - selectedSessions;
  const noData = selectedSessions === 0;
  const unselectedNoData =
    selected.length === 0 || unselected.length === 0 || unselectedSessions <= 0;

  const failures = (kind: "exception" | "anr", names: string[]) =>
    bundle.errorGroups
      .filter((g) => g.error_type === kind && g.severity === "fatal")
      .reduce((sum, g) => sum + groupCount(bundle, g, range, names), 0);
  const pct = (rate: number) => Math.round(rate * 1000) / 10;
  const freeRate = (count: number, sessions: number) =>
    sessions <= 0 ? 0 : pct(Math.max(0, Math.min(1, 1 - count / sessions)));

  const crashes = failures("exception", selected);
  const otherCrashes = unselectedNoData ? 0 : failures("exception", unselected);
  const anrs = failures("anr", selected);
  const otherAnrs = unselectedNoData ? 0 : failures("anr", unselected);
  const perceivedCrashShare =
    (1 - app.perceivedCrashFreeRate) / (1 - app.crashFreeRate);
  const perceivedAnrShare = 0.75;
  const side = (count: number, sessions: number, off: boolean) =>
    off ? 0 : freeRate(count, sessions);

  const hasAnr = app.anrFreeRate !== undefined;
  const launch = bundle.launchP95;

  return {
    adoption: {
      all_versions: allSessions,
      selected_version: selectedSessions,
      adoption: allSessions === 0 ? 0 : pct(selectedSessions / allSessions),
      no_data: allSessions === 0,
    },
    anr_free_sessions: hasAnr
      ? {
          anr_free_sessions: side(anrs, selectedSessions, noData),
          unselected_anr_free_sessions: side(
            otherAnrs,
            unselectedSessions,
            unselectedNoData,
          ),
          no_data: noData,
          unselected_no_data: unselectedNoData,
        }
      : null,
    cold_launch: launchMetric(
      launch.cold,
      LAUNCH_COMPARISON.cold,
      noData,
      unselectedNoData,
    ),
    crash_free_sessions: {
      crash_free_sessions: side(crashes, selectedSessions, noData),
      unselected_crash_free_sessions: side(
        otherCrashes,
        unselectedSessions,
        unselectedNoData,
      ),
      no_data: noData,
      unselected_no_data: unselectedNoData,
    },
    hot_launch: launchMetric(
      launch.hot,
      LAUNCH_COMPARISON.hot,
      noData,
      unselectedNoData,
    ),
    perceived_anr_free_sessions: hasAnr
      ? {
          perceived_anr_free_sessions: side(
            anrs * perceivedAnrShare,
            selectedSessions,
            noData,
          ),
          unselected_perceived_anr_free_sessions: side(
            otherAnrs * perceivedAnrShare,
            unselectedSessions,
            unselectedNoData,
          ),
          no_data: noData,
          unselected_no_data: unselectedNoData,
        }
      : null,
    perceived_crash_free_sessions: {
      perceived_crash_free_sessions: side(
        crashes * perceivedCrashShare,
        selectedSessions,
        noData,
      ),
      unselected_perceived_crash_free_sessions: side(
        otherCrashes * perceivedCrashShare,
        unselectedSessions,
        unselectedNoData,
      ),
      no_data: noData,
      unselected_no_data: unselectedNoData,
    },
    warm_launch: launchMetric(
      launch.warm,
      LAUNCH_COMPARISON.warm,
      noData,
      unselectedNoData,
    ),
  };
}

function groupTitle(type: string, fileName: string): string {
  return fileName ? `${type}@${fileName}` : type;
}

// A Swift symbol already ends in its parameter list and an Apple group has no
// message, so the alert names the signal in its place.
function spikeMessage(group: ErrorGroup): string {
  const method = group.method_name.endsWith(")")
    ? group.method_name
    : `${group.method_name}()`;
  return `${group.file_name}: ${method} - ${group.message || group.type}`;
}

function buildAppBundle(scenario: PlatformScenario, now: DateTime): AppBundle {
  const problems = validateScenario(scenario);
  if (problems.length > 0) {
    throw new Error(`${scenario.app.name}: ${problems.join("; ")}`);
  }

  const built = scenario.sessions.map((script, i) =>
    buildSession(scenario, script, i, now),
  );
  const sessions = [...built]
    .sort((a, b) =>
      b.list.last_event_time.localeCompare(a.list.last_event_time),
    )
    .map((s) => ({ list: s.list, detail: s.detail }));

  const app = scenario.app;
  const releases = releasesOf(app, now);
  const onboardedAt = now.minus({ days: app.createdDaysAgo - 1 });
  const appEntry: App = {
    id: app.id,
    team_id: SANDBOX_TEAM_ID,
    name: app.name,
    api_key: {
      created_at: now.minus({ days: app.createdDaysAgo }).toISO()!,
      key: `msrsdk_${stableHex(`apikey:${app.id}`, 32)}`,
      last_seen: now.minus({ hours: 2 }).toISO()!,
      revoked: false,
    },
    onboarded: true,
    created_at: now.minus({ days: app.createdDaysAgo }).toISO()!,
    updated_at: now.minus({ days: 1 }).toISO()!,
    os_names: [app.os],
    onboarded_at: onboardedAt.toISO()!,
    unique_identifier: app.uniqueId,
  };

  const groupsByKey = new Map<
    string,
    {
      spec: ExceptionSpec;
      instances: {
        session: BuiltSession;
        event: GeneratedEvent;
        timestamp: string;
      }[];
    }
  >();
  for (const session of built) {
    for (const hit of session.errorHits) {
      const spec = scenario.exceptions.find((e) => e.key === hit.key)!;
      if (!groupsByKey.has(hit.key)) {
        groupsByKey.set(hit.key, { spec, instances: [] });
      }
      groupsByKey.get(hit.key)!.instances.push({
        session,
        event: hit.event,
        timestamp: hit.timestamp,
      });
    }
  }
  const keyEntries = [...groupsByKey.entries()];
  const crashKeys = keyEntries
    .filter(
      ([, g]) => g.spec.kind === "exception" && g.spec.severity === "fatal",
    )
    .map(([key]) => key);
  const anrKeys = keyEntries
    .filter(([, g]) => g.spec.kind === "anr")
    .map(([key]) => key);
  const unhandledKeys = keyEntries
    .filter(
      ([, g]) => g.spec.kind === "exception" && g.spec.severity === "unhandled",
    )
    .map(([key]) => key);
  const handledKeys = keyEntries
    .filter(
      ([, g]) => g.spec.kind === "exception" && g.spec.severity === "handled",
    )
    .map(([key]) => key);

  const crashTotal =
    crashKeys.length === 0
      ? 0
      : Math.round(
          app.dailySessions * REFERENCE_WINDOW_DAYS * (1 - app.crashFreeRate),
        );
  const anrTotal =
    anrKeys.length === 0 || app.anrFreeRate === undefined
      ? 0
      : Math.round(
          app.dailySessions * REFERENCE_WINDOW_DAYS * (1 - app.anrFreeRate),
        );
  const handledTotal =
    handledKeys.length === 0
      ? 0
      : Math.round(
          app.dailySessions * REFERENCE_WINDOW_DAYS * HANDLED_ERROR_RATE,
        );
  const unhandledTotal =
    unhandledKeys.length === 0
      ? 0
      : Math.round(
          app.dailySessions * REFERENCE_WINDOW_DAYS * UNHANDLED_ERROR_RATE,
        );
  const followUpParent = new Map<string, string>();
  for (const [key, g] of keyEntries) {
    if (g.spec.nativeFollowUp && groupsByKey.has(g.spec.nativeFollowUp)) {
      followUpParent.set(g.spec.nativeFollowUp, key);
    }
  }
  function lossRatioFor(key: string): number {
    return stableInt(`nativefollowup:${app.id}:${key}`, 930, 990) / 1000;
  }

  function scaledCountsFor(keys: string[], total: number): [string, number][] {
    const weighted = keys.filter((k) => !followUpParent.has(k));
    const weights = weighted.map((k) => {
      const own =
        groupsByKey.get(k)!.instances.length *
        (stableInt(`errorweight:${app.id}:${k}`, 600, 1500) / 1000);
      const followUp = groupsByKey.get(k)!.spec.nativeFollowUp;
      return followUp && keys.includes(followUp)
        ? own * (1 + lossRatioFor(followUp))
        : own;
    });
    const values = distributeTotal(total, weights);
    const counts: [string, number][] = [];
    weighted.forEach((key, i) => {
      const followUp = groupsByKey.get(key)!.spec.nativeFollowUp;
      if (!followUp || !keys.includes(followUp)) {
        counts.push([key, values[i]]);
        return;
      }
      const ratio = lossRatioFor(followUp);
      const followUpCount = Math.round((values[i] * ratio) / (1 + ratio));
      counts.push([key, values[i] - followUpCount]);
      counts.push([followUp, followUpCount]);
    });
    return counts;
  }
  const countByKey = new Map<string, number>([
    ...scaledCountsFor(crashKeys, crashTotal),
    ...scaledCountsFor(anrKeys, anrTotal),
    ...scaledCountsFor(handledKeys, handledTotal),
    ...scaledCountsFor(unhandledKeys, unhandledTotal),
  ]);
  const overallTotal = crashTotal + anrTotal + handledTotal + unhandledTotal;

  const errorGroups: ErrorGroup[] = [...groupsByKey.entries()].map(
    ([key, g]) => {
      const id = stableUuid(`errorgroup:${app.id}:${key}`);
      const count = countByKey.get(key) ?? 0;
      const percentage =
        overallTotal === 0 ? 0 : Math.round((count / overallTotal) * 1000) / 10;
      const updatedAt = [...g.instances.map((i) => i.timestamp)]
        .sort()
        .slice(-1)[0];
      const sequence = screenSequence(
        g.instances[0].session.detail,
        scenario.threadNames.main,
      );
      const errorTimestamp = g.instances[0].timestamp;
      let screen = "";
      for (const entry of sequence) {
        if (entry.timestamp > errorTimestamp) {
          break;
        }
        if (entry.kind !== "fragment") {
          screen = entry.name;
        }
      }
      const instances: ErrorInstance[] = g.instances.map((inst, i) => ({
        id: stableUuid(`errorinstance:${app.id}:${key}:${i}`),
        session_id: inst.session.sessionId,
        timestamp: inst.timestamp,
        type: g.spec.type,
        attribute: inst.session.detail.attribute,
        exception:
          g.spec.kind === "exception"
            ? {
                title: groupTitle(g.spec.type, g.spec.file_name),
                stacktrace: g.spec.stacktrace,
                message: g.spec.message,
              }
            : null,
        anr:
          g.spec.kind === "anr"
            ? {
                title: groupTitle(g.spec.type, g.spec.file_name),
                stacktrace: g.spec.stacktrace,
              }
            : null,
        severity: g.spec.severity,
        num_code: g.spec.error?.num_code ?? null,
        code: g.spec.error?.code ?? "",
        meta: g.spec.error?.meta ?? null,
        user_defined_attribute: null,
        attachments:
          (inst.event.attachments as ErrorInstance["attachments"]) ?? [],
        threads: g.spec.threads.map((t) => ({
          name: t.name,
          frames: t.frames.map((f) => frameToString(f, g.spec.framework)),
        })),
      }));
      return {
        id,
        app_id: app.id,
        type: g.spec.type,
        error_type: g.spec.kind === "anr" ? "anr" : ("exception" as const),
        severity: g.spec.severity,
        is_custom: false,
        message: g.spec.message,
        method_name: g.spec.method_name,
        file_name: g.spec.file_name,
        line_number: g.spec.line_number,
        count,
        percentage_contribution: percentage,
        updated_at: updatedAt,
        instances,
        screen,
      };
    },
  );

  const bugReportSessions = built.filter((s) => s.bugReport);
  const triageCutoff = now.minus({ hours: 24 }).toISO()!;
  const bugReports: BugReport[] = bugReportSessions.map((s) => ({
    session_id: s.sessionId,
    app_id: app.id,
    event_id: s.bugReport!.eventId,
    status: (s.bugReport!.timestamp >= triageCutoff ? 0 : 1) as 0 | 1,
    description: s.bugReport!.description,
    timestamp: s.bugReport!.timestamp,
    attribute: s.detail.attribute,
    user_defined_attribute: null,
    attachments: s.bugReport!.attachments,
  }));

  const allTraces = built.flatMap((s) => s.traces);
  const traces = new Map(allTraces.map((t) => [t.trace_id, t]));
  const spanRows: SpanListRow[] = allTraces.map((t) => {
    const root = t.spans.find((sp) => sp.parent_id === "")!;
    const versionMatch = t.app_version.match(/^(.*)\(([^)]+)\)$/);
    const osMatch = t.os_version.match(/^(\S+) (.*)$/);
    return {
      app_id: app.id,
      span_name: root.span_name,
      span_id: root.span_id,
      trace_id: t.trace_id,
      status: root.status,
      start_time: t.start_time,
      end_time: t.end_time,
      duration: t.duration,
      app_version: versionMatch?.[1] ?? t.app_version,
      app_build: versionMatch?.[2] ?? "",
      os_name: app.os,
      os_version: osMatch?.[2] ?? t.os_version,
      device_manufacturer: t.device_manufacturer,
      device_model: t.device_model,
    };
  });
  const rootSpanNames = Array.from(
    new Set(spanRows.map((r) => r.span_name)),
  ).sort();

  const specByKey = new Map(scenario.http.map((spec) => [spec.key, spec]));
  const httpSamples: HttpSample[] = built.flatMap((s) =>
    s.httpHits.map(({ key, event }) => {
      const { domain, path } = pathPattern(specByKey.get(key)!.url);
      return {
        domain,
        path,
        method: String(event.method),
        statusCode: Number(event.status_code),
        startTime: DateTime.fromISO(String(event.timestamp)),
        durationMs: Number(event.duration),
        sessionId: s.sessionId,
        attribute: s.detail.attribute,
      };
    }),
  );

  const hitsBySpec = new Map<string, number>();
  for (const session of built) {
    for (const { key } of session.httpHits) {
      hitsBySpec.set(key, (hitsBySpec.get(key) ?? 0) + 1);
    }
  }
  const specsByEndpoint = new Map<string, HttpSpec[]>();
  for (const spec of scenario.http) {
    const { domain, path } = pathPattern(spec.url);
    const key = `${domain}|${path}`;
    specsByEndpoint.set(key, [...(specsByEndpoint.get(key) ?? []), spec]);
  }
  const networkEndpoints = new Map<string, NetworkEndpointStats>();
  for (const [key, specs] of specsByEndpoint) {
    const [domain, path] = key.split("|");
    const hits = specs.reduce(
      (sum, spec) => sum + (hitsBySpec.get(spec.key) ?? 0),
      0,
    );
    if (hits === 0) {
      continue;
    }
    const weightByCode = new Map<number, number>();
    for (const spec of specs) {
      const specHits = hitsBySpec.get(spec.key) ?? 0;
      if (specHits === 0) {
        continue;
      }
      const outcomes = [
        ...spec.statusCodes,
        ...(spec.failure ? [{ code: 0, weight: spec.failure.weight }] : []),
      ];
      const total = outcomes.reduce((sum, o) => sum + o.weight, 0);
      if (total <= 0) {
        continue;
      }
      for (const outcome of outcomes) {
        const share = (outcome.weight / total) * specHits;
        weightByCode.set(
          outcome.code,
          (weightByCode.get(outcome.code) ?? 0) + share,
        );
      }
    }
    networkEndpoints.set(key, {
      domain,
      path,
      dailyRequests:
        (hits / built.length) *
        app.dailySessions *
        (stableInt(`requests:${app.id}:${key}`, 450, 1600) / 1000),
      outcomes: [...weightByCode.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([code, weight]) => ({ code, weight })),
    });
  }

  const linkCounts = new Map<string, number>();
  const nodeIds = new Set<string>();
  for (const session of built) {
    const sequence = screenSequence(session.detail, scenario.threadNames.main);
    sequence.forEach((entry) => nodeIds.add(entry.name));
    for (let i = 0; i < sequence.length - 1; i++) {
      const key = `${sequence[i].name}\u0000${sequence[i + 1].name}`;
      linkCounts.set(key, (linkCounts.get(key) ?? 0) + 1);
    }
  }
  const nodes: JourneyNode[] = Array.from(nodeIds).map((id) => {
    const issuesOn = (errorType: ErrorGroup["error_type"]) =>
      errorGroups
        .filter(
          (g) =>
            g.error_type === errorType &&
            g.severity === "fatal" &&
            g.screen === id,
        )
        .map((g) => ({
          id: g.id,
          title: groupTitle(g.type, g.file_name),
          count: g.count,
        }));
    return {
      id,
      issues: { crashes: issuesOn("exception"), anrs: issuesOn("anr") },
    };
  });

  const sequences = built.map((s) =>
    screenSequence(s.detail, scenario.threadNames.main),
  );
  const reachByNode = new Map(
    Array.from(nodeIds).map((id) => [
      id,
      sequences.filter((sequence) => sequence.some((e) => e.name === id))
        .length,
    ]),
  );
  const entryNodes = Array.from(nodeIds).map((id) => ({
    id,
    weight: sequences.filter((sequence) => sequence[0]?.name === id).length,
  }));
  const monthlySessions = Math.round(app.dailySessions * REFERENCE_WINDOW_DAYS);
  const entryValues = distributeTotal(
    monthlySessions,
    entryNodes.map((n) => n.weight),
  );
  const inflow = new Map<string, number>(
    entryNodes.map((n, i) => [n.id, entryValues[i]]),
  );
  const outgoingByNode = new Map<
    string,
    { target: string; weight: number }[]
  >();
  for (const [key, weight] of linkCounts) {
    const [source, target] = key.split("\u0000");
    const list = outgoingByNode.get(source) ?? [];
    list.push({ target, weight });
    outgoingByNode.set(source, list);
  }
  const order: string[] = [];
  const queued = new Set<string>();
  for (const entry of entryNodes.filter((n) => n.weight > 0)) {
    order.push(entry.id);
    queued.add(entry.id);
  }
  for (let i = 0; i < order.length; i++) {
    for (const edge of outgoingByNode.get(order[i]) ?? []) {
      if (!queued.has(edge.target)) {
        queued.add(edge.target);
        order.push(edge.target);
      }
    }
  }
  for (const id of nodeIds) {
    if (!queued.has(id)) {
      order.push(id);
      queued.add(id);
    }
  }
  const links: Journey["links"] = [];
  for (const source of order) {
    const edges = outgoingByNode.get(source) ?? [];
    if (edges.length === 0) {
      continue;
    }
    const reach = reachByNode.get(source) ?? 1;
    const transitions = edges.reduce((sum, e) => sum + e.weight, 0);
    const continuing = Math.min(1, transitions / Math.max(1, reach));
    const passedOn =
      continuing >= 1
        ? stableInt(`journeydrop:${app.id}:${source}`, 780, 970) / 1000
        : continuing;
    const available = inflow.get(source) ?? 0;
    const values = distributeTotal(
      Math.round(available * passedOn),
      edges.map(
        (e) =>
          e.weight *
          (stableInt(`journeylink:${app.id}:${source}:${e.target}`, 700, 1400) /
            1000),
      ),
    );
    edges.forEach((edge, i) => {
      links.push({ source, target: edge.target, value: values[i] });
      inflow.set(edge.target, (inflow.get(edge.target) ?? 0) + values[i]);
    });
  }
  const journey: Journey = {
    links,
    nodes,
    totalIssues: nodes.reduce(
      (sum, node) =>
        sum +
        node.issues.crashes.reduce((a, i) => a + i.count, 0) +
        node.issues.anrs.reduce((a, i) => a + i.count, 0),
      0,
    ),
  };

  function launchPercentile(kind: "cold" | "warm" | "hot"): number {
    const durations = built
      .map((s) =>
        s.detail.threads[scenario.threadNames.main]?.find(
          (e) => e.event_type === `${kind}_launch`,
        ),
      )
      .filter((e): e is GeneratedEvent => !!e)
      .map((e) => Number(e.duration))
      .sort((a, b) => a - b);
    if (durations.length === 0) {
      return 0;
    }
    const idx = Math.min(
      durations.length - 1,
      Math.ceil(0.95 * durations.length) - 1,
    );
    return durations[idx];
  }

  const launchP95 = {
    cold: launchPercentile("cold"),
    warm: launchPercentile("warm"),
    hot: launchPercentile("hot"),
  };

  const ALERT_COOLDOWN_DAYS = 7;
  const alerts: Alert[] = [];
  for (const group of errorGroups) {
    if (group.severity !== "fatal") {
      continue;
    }
    const url = `/${SANDBOX_TEAM_ID}/errors/${app.id}/${group.id}/${encodeURIComponent(
      group.type + (group.file_name ? `@${group.file_name}` : ""),
    )}`;
    let lastFired: DateTime | null = null;
    for (const instance of [...group.instances].sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp),
    )) {
      const firedAt = DateTime.fromISO(instance.timestamp, { setZone: true });
      if (
        lastFired !== null &&
        lastFired.diff(firedAt).as("days") < ALERT_COOLDOWN_DAYS
      ) {
        continue;
      }
      lastFired = firedAt;
      alerts.push({
        id: stableUuid(`alert:${app.id}:${group.id}:${instance.id}`),
        team_id: SANDBOX_TEAM_ID,
        app_id: app.id,
        entity_id: group.id,
        type: group.error_type === "anr" ? "anr_spike" : "crash_spike",
        message: spikeMessage(group),
        url,
        created_at: instance.timestamp,
        updated_at: instance.timestamp,
      });
    }
  }
  for (const report of bugReports) {
    alerts.push({
      id: stableUuid(`alert:${app.id}:bugreport:${report.event_id}`),
      team_id: SANDBOX_TEAM_ID,
      app_id: app.id,
      entity_id: report.event_id,
      type: "bug_report",
      message: report.description,
      url: `/${SANDBOX_TEAM_ID}/bug_reports/${app.id}/${report.event_id}`,
      created_at: report.timestamp,
      updated_at: report.timestamp,
    });
  }
  alerts.sort((a, b) => b.created_at.localeCompare(a.created_at));

  // A build's mapping files are uploaded from CI hours before the version
  // reaches the store, or at onboarding for a version already released.
  const builds: Build[] = [];
  const createdAt = now.minus({ days: app.createdDaysAgo });
  const uploads = [
    {
      ...app.candidate,
      uploaded: now.minus({
        minutes: stableInt(
          `buildupload:${app.id}:${app.candidate.code}`,
          200,
          330,
        ),
      }),
    },
    ...releases.map((release) => {
      const fromCi = release.at.minus({
        minutes: stableInt(`buildupload:${app.id}:${release.code}`, 240, 1800),
      });
      return {
        name: release.name,
        code: release.code,
        uploaded:
          fromCi > createdAt
            ? fromCi
            : createdAt.plus({
                minutes: stableInt(
                  `buildupload:${app.id}:${release.code}`,
                  30,
                  180,
                ),
              }),
      };
    }),
  ];
  for (const { uploaded, ...version } of uploads) {
    const uploadedAt = uploaded.toUTC().toISO()!;
    const files: BuildFile[] = app.mappingTypes.map((mappingType) => {
      const id = stableUuid(
        `buildfile:${app.id}:${version.code}:${mappingType}`,
      );
      return {
        id,
        mapping_type: mappingType,
        download_url: `/apps/${app.id}/builds/${version.code}/${mappingType}/download`,
        filesize: stableInt(`buildfile-size:${id}`, 400_000, 950_000),
        last_updated: uploadedAt,
      };
    });
    builds.push({
      version_name: version.name,
      version_code: version.code,
      last_updated: uploadedAt,
      files,
    });
  }

  const totalSampleSpans = built.reduce(
    (sum, s) => sum + s.traces.reduce((a, t) => a + t.spans.length, 0),
    0,
  );
  const spansPerSession = totalSampleSpans / built.length;
  const totalSampleEvents = built.reduce(
    (sum, s) =>
      sum +
      Object.values(s.detail.threads).reduce((a, e) => a + e.length, 0) +
      s.detail.cpu_usage.length +
      (s.detail.memory_usage?.length ?? 0) +
      (s.detail.memory_usage_absolute?.length ?? 0),
    0,
  );
  const eventsPerSession = Math.round(totalSampleEvents / built.length);
  const monthly = [2, 1, 0].map((monthsAgo) => {
    const monthStart = now.minus({ months: monthsAgo }).startOf("month");
    const monthEnd = monthsAgo === 0 ? now : monthStart.endOf("month");
    const from = onboardedAt > monthStart ? onboardedAt : monthStart;
    const daysInMonth = Math.max(0, Math.round(monthEnd.diff(from).as("days")));
    const seed = `usage:${app.id}:${monthStart.toFormat("yyyy-MM")}`;
    const variance =
      0.9 + noise(stableInt(`${seed}:variance`, 0, 100000)) * 0.2;
    const sessions = Math.round(app.dailySessions * daysInMonth * variance);
    const events =
      sessions * (eventsPerSession + stableInt(`${seed}:epsession`, -8, 8));
    const spans = Math.round(sessions * spansPerSession);
    return {
      month_year: monthStart.toFormat("MMM yyyy"),
      sessions,
      events,
      spans,
      bytes_in: events * 2048,
    };
  });
  const usage: Usage = {
    app_id: app.id,
    app_name: app.name,
    monthly_app_usage: monthly,
  };

  const appSizeByVersion: Record<string, number> = Object.fromEntries(
    app.versions.map((v) => [
      v.name,
      stableInt(`appsize:${app.id}:${v.name}`, 18_000_000, 42_000_000),
    ]),
  );

  return {
    app: appEntry,
    scenario,
    dataStart: onboardedAt,
    sessions,
    errorGroups,
    bugReports,
    traces,
    spanRows,
    rootSpanNames,
    httpSamples,
    networkEndpoints,
    journey,
    releases,
    launchP95,
    appSizeByVersion,
    alerts,
    builds,
    usage,
  };
}

let cached: Catalog | null = null;

export function catalog(): Catalog {
  if (cached) {
    return cached;
  }
  const now = DateTime.now().toUTC();
  const appById = new Map<string, AppBundle>();
  for (const scenario of scenarios) {
    appById.set(scenario.app.id, buildAppBundle(scenario, now));
  }
  cached = {
    team: { id: SANDBOX_TEAM_ID, name: "Acme Team" },
    apps: Array.from(appById.values()).map((b) => b.app),
    appById,
    builtAt: now,
  };
  return cached;
}

export function bucketCounts(
  timestamps: string[],
  range: SandboxRange,
): { datetime: string; instances: number }[] {
  const buckets = bucketsForRange(range);
  const unit =
    range.group === "minutes"
      ? "minute"
      : range.group === "hours"
        ? "hour"
        : range.group === "months"
          ? "month"
          : "day";
  const parsed = timestamps.map((t) => DateTime.fromISO(t));
  return buckets.map((bucket) => {
    const next = bucket.plus({ [unit]: 1 });
    const count = parsed.filter((t) => t >= bucket && t < next).length;
    return { datetime: formatBucket(bucket, range.group), instances: count };
  });
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const idx = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[Math.max(0, idx)];
}

export function sizesFor(
  bundle: AppBundle,
  selectedVersionNames: string[],
): AppSize {
  const names = new Set(selectedVersionNames);
  if (names.size !== 1) {
    return {
      average_app_size: 0,
      selected_app_size: 0,
      delta: 0,
      no_data: names.size === 0,
      multiple_versions: names.size > 1,
    };
  }
  const sizes = Object.values(bundle.appSizeByVersion);
  const average = Math.round(
    sizes.reduce((sum, s) => sum + s, 0) / sizes.length,
  );
  const selected = bundle.appSizeByVersion[selectedVersionNames[0]] ?? average;
  return {
    average_app_size: average,
    selected_app_size: selected,
    delta: selected - average,
    no_data: false,
    multiple_versions: false,
  };
}

export function key(
  name: string,
  label: string,
  description: string,
  keyGroup: string,
  valueType: string,
  operators: FilterKey["operators"],
  valueSuggestionMode: FilterKey["value_suggestion_mode"],
): FilterKey {
  return {
    name,
    label,
    description,
    key_group: keyGroup,
    value_type: valueType,
    operators,
    value_suggestion_mode: valueSuggestionMode,
  };
}

export function values(texts: string[]): FilterValue[] {
  return Array.from(new Set(texts)).map((text) => ({ text }));
}
