import type { ScreenKey, UiStyle } from "./layouts";

export type OsName = "android" | "ios";
export type Framework = "native" | "flutter" | "react_native";
export type MappingType = "proguard" | "dsym" | "elf_debug" | "jsbundle";
export type ExceptionFramework = "jvm" | "apple" | "dart" | "js";

export type AppSpec = {
  id: string;
  name: string;
  os: OsName;
  framework: Framework;
  uniqueId: string;
  sdkVersion: string;
  // Days before now each version reached the store, newest first. The oldest
  // version shipped before the app onboarded, so every session before the
  // next release runs it.
  versions: { name: string; code: string; releasedDaysAgo: number }[];
  // The next version, which CI built and uploaded mapping files for today
  // and which no user runs yet.
  candidate: { name: string; code: string };
  mappingTypes: MappingType[];
  createdDaysAgo: number;
  dailySessions: number;
  crashFreeRate: number;
  anrFreeRate?: number;
  perceivedCrashFreeRate: number;
};

export type ScreenSpec = {
  key: string;
  label: string;
  className?: string;
  lifecycle?: "activity" | "fragment" | "view_controller" | "swift_ui";
  parentActivity?: string;
  routeName?: string;
};

export type DeviceSpec = {
  device_name: string;
  device_model: string;
  device_manufacturer: string;
  device_type: "phone" | "tablet";
  os_version: string;
  device_width_px: number;
  device_height_px: number;
  device_density_dpi: number;
  device_density: number;
  device_cpu_arch: string;
  device_is_foldable: boolean;
  device_low_power_mode: boolean;
  device_thermal_throttling_enabled: boolean;
  os_page_size: number;
  network_type: "wifi" | "cellular" | "vpn" | "unknown" | "no_network";
  network_generation: "2g" | "3g" | "4g" | "5g" | "unknown";
  network_provider: string;
};

export type FrameSpec = {
  class_name?: string | null;
  method_name?: string | null;
  file_name?: string | null;
  line_num?: number | null;
  col_num?: number | null;
  module_name?: string | null;
  in_app: boolean;
  instruction_address?: string;
  frame_index?: number;
  binary_name?: string;
  binary_address?: string;
  symbol_address?: string;
  offset?: number;
};

export type ThreadSpec = {
  name: string;
  sequence?: number;
  frames: FrameSpec[];
};

export type BinaryImageSpec = {
  name: string;
  arch: string;
  uuid: string;
  path: string;
};

export type ExceptionSpec = {
  key: string;
  kind: "exception" | "anr";
  type: string;
  message: string;
  severity: "fatal" | "unhandled" | "handled";
  handled: boolean;
  foreground: boolean;
  framework: ExceptionFramework;
  exceptions: {
    type: string;
    message: string;
    frames: FrameSpec[];
    signal?: string;
    thread_name?: string;
    thread_sequence?: number;
    os_build_number?: string;
  }[];
  threads: ThreadSpec[];
  binary_images?: BinaryImageSpec[];
  file_name: string;
  method_name: string;
  line_number: number;
  stacktrace: string;
  // The thread the app reported an error from when the error carries no
  // stack of its own, such as an NSError tracked without a stack.
  reportedOn?: string;
  nativeFollowUp?: string;
  error?: {
    code: string;
    num_code: number;
    meta: Record<string, string | null>;
  };
};

// What a successful response changes in the session's shop state.
export type HttpEffect =
  | "cart_add"
  | "cart_update"
  | "cart_remove"
  | "coupon"
  | "search"
  | "order";

// url, requestBody and responseBody may name session values in braces, such
// as {product_id} or {cart_items}; a braced path segment is reported as * in
// the endpoint's path pattern.
export type HttpSpec = {
  key: string;
  url: string;
  method: "get" | "post" | "put" | "patch" | "delete";
  client: string;
  statusCodes: { code: number; weight: number }[];
  latencyMs: [number, number];
  requestBody?: string;
  responseBody?: string;
  effect?: HttpEffect;
  failure?: {
    reason: string;
    description: string;
    weight: number;
    durationMs: [number, number];
  };
};

export type SpanSpec = {
  key: string;
  name: string;
  durationMs: [number, number];
  status?: 0 | 1 | 2;
  thread?: string;
  startAfterMs?: [number, number];
  parallel?: boolean;
  checkpoints?: string[];
  // Recorded as a checkpoint on the root span when this span ends.
  checkpoint?: string;
  attributes?: Record<string, string>;
  // The request this span stands for: the span takes the request's timing,
  // and fails when the request fails.
  http?: string;
  onlyWith?: "coupon";
  children?: SpanSpec[];
};

export type StepSpec =
  | { kind: "screen"; screen: string; variant?: string }
  | {
      kind: "gesture";
      type: "click" | "long_click" | "scroll";
      node?: string;
      target?: string;
      targetId?: string;
      label?: string;
      width?: number;
      height?: number;
    }
  | { kind: "back" }
  | { kind: "variant"; variant: string | null }
  | {
      kind: "http";
      http: string;
      outcome?: number | "failure";
      params?: string;
    }
  | { kind: "type"; text: string }
  | {
      kind: "custom";
      name: string;
      attributes?: Record<string, string | number | boolean>;
      // Sent once when the SDK starts with a new process, so only a cold
      // launch records it.
      startup?: boolean;
    }
  | {
      kind: "log";
      severity: "debug" | "info" | "warning" | "error" | "fatal";
      body: string;
    }
  | {
      kind: "span";
      span: string;
      fail?: { span: string; status?: number };
      // The app stops before this child span starts, so only the requests
      // before it complete and the unfinished trace is never reported.
      abortBefore?: string;
    }
  | { kind: "exception"; exception: string }
  | { kind: "bug_report"; description: string }
  | { kind: "background"; ms: number }
  | { kind: "wait"; ms: number };

export type FlowSpec = {
  key: string;
  name: string;
  steps: StepSpec[];
};

// A user of one app: person indexes PEOPLE, and the user keeps one device and
// one locale across all of their sessions.
export type UserSpec = { person: number; device: number; locale: string };

export type SessionScript = {
  flow: string;
  user: number;
  version: number;
  agoMinutes: number;
  launch: "cold" | "warm" | "hot";
  // The session keeps every image it decodes, so its memory climbs toward
  // the device's limit.
  memoryLeak?: boolean;
};

export type LaunchSpec = {
  coldMs: [number, number];
  warmMs: [number, number];
  hotMs: [number, number];
};

export type PlatformScenario = {
  app: AppSpec;
  ids: { product: "slug" | "numbered"; orderPrefix: string };
  host?: { className: string; lifecycle: "activity" | "view_controller" };
  ui: { style: UiStyle; screens: Record<string, ScreenKey> };
  screens: ScreenSpec[];
  devices: DeviceSpec[];
  users: UserSpec[];
  http: HttpSpec[];
  exceptions: ExceptionSpec[];
  spans: SpanSpec[];
  flows: FlowSpec[];
  sessions: SessionScript[];
  launch: LaunchSpec;
  threadNames: { main: string; network: string };
};
