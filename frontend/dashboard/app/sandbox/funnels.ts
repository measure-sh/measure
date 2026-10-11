import { DateTime } from "luxon";
import type {
  Funnel,
  FunnelConversion,
  FunnelCadence,
  FunnelStepErrorsResponse,
  FunnelStepNetworkResponse,
  FunnelStepOutcome,
  FunnelStepSessionsResponse,
  FunnelStepTracesResponse,
  FunnelTrend,
  FunnelTrendPeriod,
} from "../api/api_calls";
import {
  adoptionOf,
  groupVersionCounts,
  referenceRange,
  sessionsIn,
} from "./adoption";
import {
  PAYMENT_MAINTENANCE,
  paymentMaintenanceShare,
  scaledSeries,
  weekHourWeight,
} from "./aggregate";
import { catalog } from "./catalog";
import type { AppBundle, ErrorGroup, HttpSample } from "./catalog";
import { groupCount, groupMatches, groupSessionsAndUsers } from "./errors";
import {
  deviceAttributeBag,
  matchesFilterExpr,
  matchFraction,
  sessionAttributeBag,
} from "./filter";
import {
  jsonResponse,
  notAvailable,
  paginate,
  parseRange,
  stableInt,
  stableUuid,
  unitInterval,
} from "./query";
import type { SandboxRange, SandboxRoute } from "./query";
import { SANDBOX_ADMIN, SANDBOX_OWNER } from "./team";

type EventSpec = {
  // The share of an app's active users in a range that send the event.
  activeShare: number;
  // The root spans and the path segments of the endpoints the app calls on
  // the way to sending the event. The request that records the event itself,
  // such as the one that adds to the cart, is left out, since users that
  // dropped off do not send it.
  spans: string[];
  endpoints: string[];
};

// The events the sandbox sessions send, with the root spans and endpoints
// the apps report between the event before and this one.
const EVENTS: Record<string, EventSpec> = {
  app_opened: {
    activeShare: 0.96,
    spans: ["app_launch"],
    endpoints: ["profile", "me", "hero"],
  },
  login_viewed: {
    activeShare: 0.09,
    spans: ["app_launch"],
    endpoints: [],
  },
  login_submitted: {
    activeShare: 0.07,
    spans: [],
    endpoints: [],
  },
  login_succeeded: {
    activeShare: 0.065,
    spans: [],
    endpoints: ["auth"],
  },
  category_viewed: {
    activeShare: 0.51,
    spans: [],
    endpoints: ["products", "hero"],
  },
  search_performed: {
    activeShare: 0.14,
    spans: ["search_query"],
    endpoints: ["search"],
  },
  search_result_clicked: {
    activeShare: 0.09,
    spans: ["search_query"],
    endpoints: ["search"],
  },
  product_viewed: {
    activeShare: 0.58,
    spans: ["product_load"],
    endpoints: ["products", "reviews"],
  },
  added_to_cart: {
    activeShare: 0.11,
    spans: ["product_load"],
    endpoints: ["products"],
  },
  cart_viewed: {
    activeShare: 0.12,
    spans: ["product_load"],
    endpoints: ["products"],
  },
  coupon_applied: {
    activeShare: 0.015,
    spans: ["cart_refresh"],
    endpoints: ["cart"],
  },
  checkout_started: {
    activeShare: 0.045,
    spans: ["cart_refresh"],
    endpoints: ["cart", "promo", "promotions", "coupon"],
  },
  payment_submitted: {
    activeShare: 0.034,
    spans: [],
    endpoints: ["payment-methods"],
  },
  order_placed: {
    activeShare: 0.031,
    spans: ["checkout_flow"],
    endpoints: ["checkout", "payment", "payments", "charge", "orders"],
  },
  orders_viewed: {
    activeShare: 0.06,
    spans: [],
    endpoints: [],
  },
};

type StepSeed = {
  event: string;
  // The share of the users that did the previous step and go on to do this
  // one within the conversion window, before any errors on the way.
  rate: number;
  medianSeconds: number;
};

type FunnelSeed = {
  key: string;
  name: string;
  conversionWindowSeconds: number;
  createdDaysAgo: number;
  updatedDaysAgo: number;
  creator: { id: string; email: string };
  // Funnels through the login screen only exist for apps that sign users in.
  needsLogin?: boolean;
  steps: [string, ...StepSeed[]];
};

const MINUTE = 60;
const HOUR = 3_600;
const DAY = 86_400;

const FUNNEL_SEEDS: FunnelSeed[] = [
  {
    key: "checkout",
    name: "Checkout",
    conversionWindowSeconds: DAY,
    createdDaysAgo: 41,
    updatedDaysAgo: 6,
    creator: SANDBOX_OWNER,
    steps: [
      "product_viewed",
      { event: "added_to_cart", rate: 0.19, medianSeconds: 95 },
      { event: "checkout_started", rate: 0.4, medianSeconds: 240 },
      { event: "payment_submitted", rate: 0.74, medianSeconds: 110 },
      { event: "order_placed", rate: 0.93, medianSeconds: 6 },
    ],
  },
  {
    key: "search-to-cart",
    name: "Search to cart",
    conversionWindowSeconds: 30 * MINUTE,
    createdDaysAgo: 38,
    updatedDaysAgo: 38,
    creator: SANDBOX_ADMIN,
    steps: [
      "search_performed",
      { event: "search_result_clicked", rate: 0.63, medianSeconds: 14 },
      { event: "added_to_cart", rate: 0.21, medianSeconds: 85 },
    ],
  },
  {
    key: "login",
    name: "Log in",
    conversionWindowSeconds: HOUR,
    createdDaysAgo: 35,
    updatedDaysAgo: 2,
    creator: SANDBOX_OWNER,
    needsLogin: true,
    steps: [
      "login_viewed",
      { event: "login_submitted", rate: 0.79, medianSeconds: 24 },
      { event: "login_succeeded", rate: 0.94, medianSeconds: 2 },
    ],
  },
  {
    key: "cart-to-order",
    name: "Cart to order",
    conversionWindowSeconds: DAY,
    createdDaysAgo: 33,
    updatedDaysAgo: 12,
    creator: SANDBOX_ADMIN,
    steps: [
      "cart_viewed",
      { event: "checkout_started", rate: 0.38, medianSeconds: 55 },
      { event: "payment_submitted", rate: 0.74, medianSeconds: 110 },
      { event: "order_placed", rate: 0.93, medianSeconds: 6 },
    ],
  },
  {
    key: "browse-to-product",
    name: "Browse to product",
    conversionWindowSeconds: 30 * MINUTE,
    createdDaysAgo: 30,
    updatedDaysAgo: 9,
    creator: SANDBOX_OWNER,
    steps: [
      "app_opened",
      { event: "category_viewed", rate: 0.53, medianSeconds: 19 },
      { event: "product_viewed", rate: 0.64, medianSeconds: 12 },
    ],
  },
  {
    key: "search-to-order",
    name: "Search to order",
    conversionWindowSeconds: DAY,
    createdDaysAgo: 27,
    updatedDaysAgo: 4,
    creator: SANDBOX_ADMIN,
    steps: [
      "search_performed",
      { event: "search_result_clicked", rate: 0.63, medianSeconds: 14 },
      { event: "added_to_cart", rate: 0.21, medianSeconds: 85 },
      { event: "order_placed", rate: 0.27, medianSeconds: 14 * MINUTE },
    ],
  },
  {
    key: "checkout-to-order",
    name: "Checkout to order",
    conversionWindowSeconds: HOUR,
    createdDaysAgo: 22,
    updatedDaysAgo: 22,
    creator: SANDBOX_OWNER,
    steps: [
      "checkout_started",
      { event: "payment_submitted", rate: 0.72, medianSeconds: 110 },
      { event: "order_placed", rate: 0.93, medianSeconds: 6 },
    ],
  },
  {
    key: "abandoned-cart",
    name: "Abandoned cart recovery",
    conversionWindowSeconds: 3 * DAY,
    createdDaysAgo: 19,
    updatedDaysAgo: 5,
    creator: SANDBOX_ADMIN,
    steps: [
      "added_to_cart",
      { event: "cart_viewed", rate: 0.71, medianSeconds: 3 * HOUR },
      { event: "order_placed", rate: 0.39, medianSeconds: 6 * HOUR },
    ],
  },
  {
    key: "order-tracking",
    name: "Order tracking",
    conversionWindowSeconds: DAY,
    createdDaysAgo: 16,
    updatedDaysAgo: 16,
    creator: SANDBOX_OWNER,
    steps: [
      "order_placed",
      { event: "orders_viewed", rate: 0.33, medianSeconds: 35 },
    ],
  },
  {
    key: "coupon-to-order",
    name: "Coupon to order",
    conversionWindowSeconds: DAY,
    createdDaysAgo: 12,
    updatedDaysAgo: 3,
    creator: SANDBOX_ADMIN,
    steps: [
      "coupon_applied",
      { event: "checkout_started", rate: 0.66, medianSeconds: 70 },
      { event: "order_placed", rate: 0.68, medianSeconds: 4 * MINUTE },
    ],
  },
  {
    key: "open-to-purchase",
    name: "Open to purchase",
    conversionWindowSeconds: DAY,
    createdDaysAgo: 9,
    updatedDaysAgo: 1,
    creator: SANDBOX_OWNER,
    steps: [
      "app_opened",
      { event: "product_viewed", rate: 0.6, medianSeconds: 38 },
      { event: "added_to_cart", rate: 0.19, medianSeconds: 95 },
      { event: "order_placed", rate: 0.27, medianSeconds: 12 * MINUTE },
    ],
  },
  {
    key: "product-to-cart",
    name: "Product to cart",
    conversionWindowSeconds: HOUR,
    createdDaysAgo: 6,
    updatedDaysAgo: 6,
    creator: SANDBOX_ADMIN,
    steps: [
      "product_viewed",
      { event: "added_to_cart", rate: 0.17, medianSeconds: 95 },
    ],
  },
  {
    key: "login-to-purchase",
    name: "Log in to purchase",
    conversionWindowSeconds: DAY,
    createdDaysAgo: 4,
    updatedDaysAgo: 1,
    creator: SANDBOX_OWNER,
    needsLogin: true,
    steps: [
      "login_succeeded",
      { event: "product_viewed", rate: 0.71, medianSeconds: 31 },
      { event: "order_placed", rate: 0.09, medianSeconds: 21 * MINUTE },
    ],
  },
];

// The funnels each app starts with pinned, in their pinned order.
const PINNED_SEED_KEYS = ["checkout", "search-to-order", "open-to-purchase"];

// Pins are kept in memory so the demo's pin and reorder controls work. They
// go back to the seeded pins when the page reloads.
const pinnedIdsByApp = new Map<string, string[]>();

const MAX_PINNED_FUNNELS = 10;

function pinnedIdsFor(bundle: AppBundle): string[] {
  let ids = pinnedIdsByApp.get(bundle.app.id);
  if (ids === undefined) {
    ids = PINNED_SEED_KEYS.flatMap((key) => {
      const seed = seedsFor(bundle).find((s) => s.key === key);
      return seed ? [funnelId(bundle, seed)] : [];
    });
    pinnedIdsByApp.set(bundle.app.id, ids);
  }
  return ids;
}

function pinnedResponse(bundle: AppBundle): Response {
  const seeds = seedsFor(bundle);
  return jsonResponse({
    results: pinnedIdsFor(bundle).map((id) =>
      toFunnel(bundle, seeds.find((seed) => funnelId(bundle, seed) === id)!),
    ),
  });
}

function eventNamesOf(seed: FunnelSeed): string[] {
  return seed.steps.map((step) =>
    typeof step === "string" ? step : step.event,
  );
}

function stepSeed(seed: FunnelSeed, step: number): StepSeed {
  return seed.steps[step] as StepSeed;
}

// The indexes of the steps users move from and to. A null step covers the
// whole funnel.
function stepRange(
  seed: FunnelSeed,
  step: number | null,
): { from: number; to: number } {
  return step === null
    ? { from: 0, to: seed.steps.length - 1 }
    : { from: step - 1, to: step };
}

function targetNames(seed: FunnelSeed, step: number | null): string[] {
  const { from, to } = stepRange(seed, step);
  return eventNamesOf(seed).slice(from + 1, to + 1);
}

function signsUsersIn(bundle: AppBundle): boolean {
  return bundle.httpSamples.some((sample) =>
    sample.path.includes("auth/login"),
  );
}

function seedsFor(bundle: AppBundle): FunnelSeed[] {
  return FUNNEL_SEEDS.filter(
    (seed) => !seed.needsLogin || signsUsersIn(bundle),
  );
}

function funnelId(bundle: AppBundle, seed: FunnelSeed): string {
  return stableUuid(`funnel:${bundle.app.id}:${seed.key}`);
}

function toFunnel(bundle: AppBundle, seed: FunnelSeed): Funnel {
  const builtAt = catalog().builtAt;
  const id = funnelId(bundle, seed);
  const pinOrder = pinnedIdsFor(bundle).indexOf(id);
  return {
    id,
    app_id: bundle.app.id,
    name: seed.name,
    steps: eventNamesOf(seed).map((event_name) => ({ event_name })),
    conversion_window_seconds: seed.conversionWindowSeconds,
    pinned: pinOrder !== -1,
    pin_order: pinOrder === -1 ? null : pinOrder,
    created_by: seed.creator.id,
    created_by_email: seed.creator.email,
    created_at: builtAt.minus({ days: seed.createdDaysAgo }).toISO()!,
    updated_at: builtAt.minus({ days: seed.updatedDaysAgo }).toISO()!,
  };
}

// Users come back over the days of a range, so a longer range has more
// sessions per distinct user.
function sessionsPerUser(days: number): number {
  return Math.max(1, 1.6 * Math.pow(days, 0.45));
}

function rangeDays(from: DateTime, to: DateTime): number {
  return Math.max(0, to.diff(from).as("days"));
}

// The share of a version's sessions that match the filter's device and
// version conditions. Each sample session's device attributes are paired with
// this version, so the device conditions match against the app's real devices
// and the version conditions against this version.
function versionMatch(
  bundle: AppBundle,
  version: { name: string; code: string },
  filterExpr: string | null,
): number {
  return matchFraction(
    bundle.sessions,
    (s) => ({
      ...deviceAttributeBag(s.detail.attribute),
      version_name: version.name,
      version_code: version.code,
    }),
    filterExpr,
  );
}

// The share of their eventual conversion that the users entering in
// [from, to] have reached by now. Users still inside the window have not
// all converted yet. Times to convert follow an exponential spread around
// the funnel's typical time, so most users convert within minutes and a few
// near the end of the window.
function completion(
  seed: FunnelSeed,
  from: DateTime,
  to: DateTime,
  now: DateTime,
): number {
  const window = seed.conversionWindowSeconds;
  const typical =
    seed.steps
      .slice(1)
      .reduce((sum, _, i) => sum + stepSeed(seed, i + 1).medianSeconds, 0) /
    Math.LN2;
  const converted = (age: number) => 1 - Math.exp(-age / typical);
  // The integral of `converted` from 0 to an age.
  const area = (age: number) => age + typical * Math.exp(-age / typical);
  const youngest = Math.max(0, now.diff(to).as("seconds"));
  const oldest = Math.max(youngest, now.diff(from).as("seconds"));
  if (oldest === youngest) {
    return Math.min(1, converted(youngest) / converted(window));
  }
  const partialEnd = Math.min(oldest, window);
  const partial = partialEnd > youngest ? area(partialEnd) - area(youngest) : 0;
  const full = Math.max(0, oldest - Math.max(youngest, window));
  return (partial / converted(window) + full) / (oldest - youngest);
}

// How much a version's errors per session between two steps cut the step's
// conversion. A crash ends the session, most users close the app on an ANR,
// an unhandled error usually breaks the screen, and a handled one is only an
// annoyance.
function errorWeight(group: ErrorGroup): number {
  if (group.error_type === "anr") {
    return 15;
  }
  switch (group.severity) {
    case "fatal":
      return 12;
    case "unhandled":
      return 6;
    default:
      return 2;
  }
}

// How likely a user that hit an error between two steps is to still do the
// step, compared with the step's other users. After a crash or an ANR the
// user can only do the step by reopening the app within the conversion
// window, and few do.
function conversionAfterError(
  group: ErrorGroup,
  draw: (min: number, max: number) => number,
): number {
  if (group.error_type === "anr" || group.severity === "fatal") {
    return draw(0.1, 0.25);
  }
  return group.severity === "unhandled" ? draw(0.4, 0.6) : draw(0.7, 0.85);
}

const MAX_STEP_LOSS = 0.3;

// The share of a group's sample errors that happened between two steps of
// the funnel, which in the session replays means the last funnel event
// before the error is the first of the two steps or one between them.
function shareBetweenSteps(
  bundle: AppBundle,
  seed: FunnelSeed,
  step: number | null,
  group: ErrorGroup,
): number {
  const funnelEvents = new Set(eventNamesOf(seed));
  const { from, to } = stepRange(seed, step);
  const previousNames = new Set(eventNamesOf(seed).slice(from, to));
  let matched = 0;
  let seen = 0;
  for (const instance of group.instances) {
    const session = bundle.sessions.find(
      (s) => s.detail.session_id === instance.session_id,
    );
    if (!session) {
      continue;
    }
    seen++;
    const last = Object.values(session.detail.threads)
      .flat()
      .filter(
        (event) =>
          event.event_type === "custom" &&
          funnelEvents.has(String(event.name)) &&
          event.timestamp < instance.timestamp,
      )
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .at(-1);
    if (last !== undefined && previousNames.has(String(last.name))) {
      matched++;
    }
  }
  return seen === 0 ? 0 : matched / seen;
}

// The share of a step's conversion each version loses to the errors users
// hit on the way to it. A bug that shipped in one version and was fixed in the
// next pulls that version's conversion down, so the trend dips while it is
// the version most users run.
function stepLoss(
  bundle: AppBundle,
  seed: FunnelSeed,
  step: number,
): Map<string, number> {
  const versions = bundle.scenario.app.versions;
  const names = versions.map((v) => v.name);
  const reference = referenceRange();
  const loss = new Map(names.map((name) => [name, 0]));
  for (const group of bundle.errorGroups) {
    const share = shareBetweenSteps(bundle, seed, step, group);
    if (share === 0) {
      continue;
    }
    for (const count of groupVersionCounts(bundle, group, reference, names)) {
      const sessions = sessionsIn(bundle, reference, [count.name]);
      if (sessions > 0) {
        loss.set(
          count.name,
          loss.get(count.name)! +
            ((count.count * share) / sessions) * errorWeight(group),
        );
      }
    }
  }
  for (const [name, value] of loss) {
    loss.set(name, Math.min(MAX_STEP_LOSS, value));
  }
  return loss;
}

function stepLosses(
  bundle: AppBundle,
  seed: FunnelSeed,
): (Map<string, number> | null)[] {
  return seed.steps.map((_, step) =>
    step === 0 ? null : stepLoss(bundle, seed, step),
  );
}

// Users that try to place an order during the payment maintenance fail more
// often, in proportion to the share of the users that entered in it.
function withPaymentMaintenance(
  bundle: AppBundle,
  seed: FunnelSeed,
  losses: (Map<string, number> | null)[],
  share: number,
): (Map<string, number> | null)[] {
  const step = maintenanceStep(seed);
  if (step === null || share === 0) {
    return losses;
  }
  const failed = share * PAYMENT_MAINTENANCE.failure;
  return losses.map((loss, i) =>
    i !== step
      ? loss
      : new Map(
          bundle.scenario.app.versions.map((version) => [
            version.name,
            1 - (1 - (loss!.get(version.name) ?? 0)) * (1 - failed),
          ]),
        ),
  );
}

// Errors also make a step take longer, as users retry or reopen the app.
function lossSlowdown(loss: number): number {
  return 1 + 2.5 * loss;
}

type StepTotals = {
  users: number[];
  medianSeconds: (number | null)[];
};

function funnelTotals(
  bundle: AppBundle,
  seed: FunnelSeed,
  losses: (Map<string, number> | null)[],
  enteredByVersion: Map<string, number>,
  progress: number,
  salt: string,
): StepTotals {
  const stepCount = seed.steps.length;
  // The progress of users still inside the window is spread evenly over
  // the steps, so a funnel that has converted half as much so far has lost
  // the same share at each step.
  const stepProgress = Math.pow(progress, 1 / (stepCount - 1));
  const users = Array(stepCount).fill(0);
  const weightedMedians = Array(stepCount).fill(0);
  for (const [version, entered] of enteredByVersion) {
    let reached = entered;
    users[0] += reached;
    for (let step = 1; step < stepCount; step++) {
      const { rate, medianSeconds } = stepSeed(seed, step);
      const loss = losses[step]!.get(version) ?? 0;
      const drift =
        stableInt(
          `funnelrate:${bundle.app.id}:${seed.key}:${step}:${version}`,
          960,
          1040,
        ) / 1000;
      reached *= Math.min(0.98, rate * drift * (1 - loss)) * stepProgress;
      users[step] += reached;
      weightedMedians[step] += reached * medianSeconds * lossSlowdown(loss);
    }
  }
  return {
    users: users.map(Math.round),
    medianSeconds: weightedMedians.map((sum, step) => {
      if (step === 0 || users[step] < 1) {
        return null;
      }
      const wobble =
        stableInt(`funnelmedian:${salt}:${step}`, 900, 1100) / 1000;
      return Math.max(1, Math.round((sum / users[step]) * wobble));
    }),
  };
}

// What a funnel's totals over any range are computed from, worked out once
// for all the ranges of one request.
type FunnelInputs = {
  losses: (Map<string, number> | null)[];
  matches: Map<string, number>;
  entryShare: number;
};

function funnelInputs(
  bundle: AppBundle,
  seed: FunnelSeed,
  filterExpr: string | null,
): FunnelInputs {
  return {
    losses: stepLosses(bundle, seed),
    matches: new Map(
      bundle.scenario.app.versions.map((version) => [
        version.name,
        versionMatch(bundle, version, filterExpr),
      ]),
    ),
    entryShare: EVENTS[eventNamesOf(seed)[0]].activeShare,
  };
}

// Every view counts a range with this function, so a range shows the same
// numbers wherever it appears.
function totalsBetween(
  bundle: AppBundle,
  seed: FunnelSeed,
  inputs: FunnelInputs,
  from: DateTime,
  to: DateTime,
  timezone: string,
): StepTotals {
  const now = DateTime.now();
  const end = to < now ? to : now;
  const perUser = sessionsPerUser(rangeDays(from, end));
  const entered = new Map(
    bundle.scenario.app.versions.map((version) => [
      version.name,
      (sessionsBetween(bundle, version.name, from, end, timezone) / perUser) *
        inputs.entryShare *
        inputs.matches.get(version.name)!,
    ]),
  );
  // Ranges that start on the same date share their wobble, so a trend point
  // and the Breakdown opened from it agree.
  const salt = `${bundle.app.id}:${seed.key}:${from.setZone(timezone).toISODate()}`;
  return funnelTotals(
    bundle,
    seed,
    withPaymentMaintenance(
      bundle,
      seed,
      inputs.losses,
      paymentMaintenanceShare(from, end),
    ),
    entered,
    completion(seed, from, end, now) *
      (stableInt(`funneltrend:${salt}`, 955, 1045) / 1000),
    salt,
  );
}

function conversionFor(
  bundle: AppBundle,
  seed: FunnelSeed,
  range: SandboxRange,
  filterExpr: string | null,
): StepTotals {
  return totalsBetween(
    bundle,
    seed,
    funnelInputs(bundle, seed, filterExpr),
    range.from,
    range.to,
    range.timezone,
  );
}

// How well users that enter the funnel in each hour of the day convert,
// relative to the rest of the day. Users browse late at night and convert
// poorly, and buy more in the evening.
const WEEKDAY_CONVERSION = [
  0.75, 0.65, 0.55, 0.5, 0.5, 0.6, 0.75, 0.85, 0.95, 1, 1, 1, 1.05, 1, 0.95,
  0.95, 1, 1.05, 1.15, 1.25, 1.3, 1.2, 1, 0.85,
];
const WEEKEND_CONVERSION = [
  0.8, 0.7, 0.6, 0.55, 0.5, 0.55, 0.65, 0.8, 0.95, 1.05, 1.1, 1.15, 1.15, 1.15,
  1.1, 1.1, 1.1, 1.15, 1.2, 1.25, 1.3, 1.25, 1.05, 0.9,
];

const MAINTENANCE_EVENT = "order_placed";

// The step at which users place an order, if a step after the first does.
// Users who enter a funnel by placing an order have already paid, so the
// payment maintenance does not lower its conversion.
function maintenanceStep(seed: FunnelSeed): number | null {
  const step = eventNamesOf(seed).indexOf(MAINTENANCE_EVENT);
  return step >= 1 ? step : null;
}

const MAX_CADENCE_WEEKS = 12;

// Splits the conversion over whole weeks across the hours of the week. The
// weeks end at the start of the latest week whose users have all had a full
// conversion window, so every hour of the week is counted the same number of
// times and none is still converting.
function cadenceFor(
  bundle: AppBundle,
  seed: FunnelSeed,
  weeks: number,
  timezone: string,
  filterExpr: string | null,
): FunnelCadence {
  const to = DateTime.now()
    .setZone(timezone)
    .minus({ seconds: seed.conversionWindowSeconds })
    .startOf("week");
  const from = to.minus({ weeks });
  const totals = conversionFor(
    bundle,
    seed,
    { from, to, group: "days", timezone },
    filterExpr,
  );
  const entered = totals.users[0];
  const converted = totals.users[totals.users.length - 1];
  const dips = maintenanceStep(seed) !== null;

  const cells = Array.from({ length: 7 * 24 }, (_, index) => {
    const weekday = Math.floor(index / 24) + 1;
    const hour = index % 24;
    const weekend = weekday >= 6;
    const salt = `funnelhours:${bundle.app.id}:${seed.key}:${weekday}:${hour}`;
    return {
      weekday,
      hour,
      activity:
        weekHourWeight(weekday, hour) *
        (stableInt(`${salt}:activity`, 850, 1150) / 1000),
      conversion:
        (weekend ? WEEKEND_CONVERSION : WEEKDAY_CONVERSION)[hour] *
        (stableInt(`${salt}:conversion`, 900, 1100) / 1000) *
        (dips &&
        weekday === PAYMENT_MAINTENANCE.weekday &&
        PAYMENT_MAINTENANCE.hours.includes(hour)
          ? 1 - PAYMENT_MAINTENANCE.failure
          : 1),
    };
  });
  const activity = cells.reduce((sum, cell) => sum + cell.activity, 0);
  const weighted = cells.reduce(
    (sum, cell) => sum + cell.activity * cell.conversion,
    0,
  );
  return {
    from: from.toISO()!,
    to: to.toISO()!,
    hours: cells
      .map((cell) => {
        const users = Math.round((entered * cell.activity) / activity);
        return {
          weekday: cell.weekday,
          hour: cell.hour,
          users,
          converted: Math.min(
            users,
            Math.round(
              (converted * cell.activity * cell.conversion) / weighted,
            ),
          ),
        };
      })
      .filter((cell) => cell.users > 0),
  };
}

const TREND_PERIODS: Record<FunnelTrendPeriod, number> = {
  day: 30,
  week: 12,
  month: 12,
};

const dailySessionsCache = new WeakMap<
  AppBundle,
  Map<string, Map<string, number>>
>();

// A version's sessions on each day from the app's first data to today, drawn
// over that whole span so a day has the same count whichever range asks for
// it. The sessions plot's seeds keep busy and quiet days the same on both
// pages.
function versionDailySessions(
  bundle: AppBundle,
  versionName: string,
  timezone: string,
): Map<string, number> {
  const today = DateTime.now().setZone(timezone).endOf("day");
  const key = `${versionName}:${timezone}:${today.toISODate()}`;
  let byKey = dailySessionsCache.get(bundle);
  if (byKey === undefined) {
    byKey = new Map();
    dailySessionsCache.set(bundle, byKey);
  }
  let daily = byKey.get(key);
  if (daily === undefined) {
    const app = bundle.scenario.app;
    const series = scaledSeries(
      {
        from: bundle.dataStart.setZone(timezone).startOf("day"),
        to: today,
        group: "days",
        timezone,
      },
      app.dailySessions * 30,
      bundle.dataStart,
      `sessions:${app.id}:${versionName}`,
      app.id,
      adoptionOf(bundle.releases, [versionName]),
    );
    daily = new Map(series.map((point) => [point.datetime, point.instances]));
    byKey.set(key, daily);
  }
  return daily;
}

// A version's sessions in [from, to). A day partly inside the range counts the
// share of its activity that falls in the hours inside it.
function sessionsBetween(
  bundle: AppBundle,
  versionName: string,
  from: DateTime,
  to: DateTime,
  timezone: string,
): number {
  const daily = versionDailySessions(bundle, versionName, timezone);
  let sessions = 0;
  for (
    let day = from.setZone(timezone).startOf("day");
    day < to;
    day = day.plus({ days: 1 })
  ) {
    const count = daily.get(day.toFormat("yyyy-MM-dd")) ?? 0;
    const next = day.plus({ days: 1 });
    if (count === 0) {
      continue;
    }
    if (from <= day && next <= to) {
      sessions += count;
      continue;
    }
    let inside = 0;
    let all = 0;
    for (let at = day; at < next; at = at.plus({ hours: 1 })) {
      const weight = weekHourWeight(at.weekday, at.hour);
      const overlapMillis =
        Math.min(at.plus({ hours: 1 }).toMillis(), to.toMillis()) -
        Math.max(at.toMillis(), from.toMillis());
      all += weight;
      inside += (weight * Math.max(0, overlapMillis)) / 3_600_000;
    }
    sessions += all === 0 ? 0 : (count * inside) / all;
  }
  return sessions;
}

function trendFor(
  bundle: AppBundle,
  seed: FunnelSeed,
  period: FunnelTrendPeriod,
  timezone: string,
  filterExpr: string | null,
): FunnelTrend {
  const now = DateTime.now().setZone(timezone);
  const last = now.startOf(period);
  const first = last.minus({ [period]: TREND_PERIODS[period] - 1 });
  const inputs = funnelInputs(bundle, seed, filterExpr);

  const points: FunnelTrend["points"] = [];
  for (let start = first; start <= last; start = start.plus({ [period]: 1 })) {
    const end = start.plus({ [period]: 1 });
    const totals = totalsBetween(bundle, seed, inputs, start, end, timezone);
    const converted = totals.users[totals.users.length - 1];
    points.push({
      datetime: start.toFormat("yyyy-MM-dd"),
      steps: totals.users.map((users, i) => ({
        users,
        median_seconds_from_previous: totals.medianSeconds[i],
      })),
      // A user's time to convert is the sum of their step times. Users that
      // are slow at one step tend to be slow at the others, which makes the
      // median total longer than the sum of the step medians.
      median_seconds_to_convert:
        converted < 1
          ? null
          : Math.round(
              totals.medianSeconds.reduce<number>(
                (sum, m) => sum + (m ?? 0),
                0,
              ) * 1.15,
            ),
      complete: end.plus({ seconds: seed.conversionWindowSeconds }) <= now,
    });
  }

  return {
    event_names: eventNamesOf(seed),
    points,
    builds: bundle.builds
      .filter((build) => {
        const at = DateTime.fromISO(build.last_updated);
        return at >= first && at <= now;
      })
      .sort((a, b) => a.last_updated.localeCompare(b.last_updated))
      .map((build) => ({
        version_name: build.version_name,
        version_code: build.version_code,
        patch_id: null,
        patch_version: null,
        uploaded_at: build.last_updated,
      })),
  };
}

type Outcomes = { converted: number; dropped: number };

function outcomesOf(
  seed: FunnelSeed,
  totals: StepTotals,
  step: number | null,
): Outcomes {
  const { from, to } = stepRange(seed, step);
  const converted = totals.users[to];
  return { converted, dropped: totals.users[from] - converted };
}

// `conversion` scales the step's conversion rate for the users that hit
// something between the two steps.
function splitUsers(
  users: number,
  conversion: number,
  outcomes: Outcomes,
): Outcomes {
  const reached = outcomes.converted + outcomes.dropped;
  const rate = reached === 0 ? 0 : (outcomes.converted / reached) * conversion;
  const converted = Math.min(outcomes.converted, Math.round(users * rate));
  return {
    converted,
    dropped: Math.min(outcomes.dropped, users - converted),
  };
}

// Most users that hit an error between the two steps are funnel users, and
// few of them go on to do the step. An error elsewhere in the app reaches
// few funnel users and does not change whether they convert. The totals are
// the ones the Errors page lists for the same range and filters.
function stepErrors(
  bundle: AppBundle,
  seed: FunnelSeed,
  step: number | null,
  range: SandboxRange,
  filterExpr: string | null,
): FunnelStepErrorsResponse["results"] {
  const outcomes = outcomesOf(
    seed,
    conversionFor(bundle, seed, range, filterExpr),
    step,
  );
  const salt = `${bundle.app.id}:${seed.key}:${step}`;
  return bundle.errorGroups
    .filter((group) => groupMatches(group, range, filterExpr))
    .map((group) => {
      const total = groupCount(bundle, group, range, filterExpr);
      const onStep = shareBetweenSteps(bundle, seed, step, group) >= 0.5;
      const seen = (min: number, max: number) =>
        min + (max - min) * unitInterval(`funnelerror:${salt}:${group.id}`);
      const share = onStep ? seen(0.55, 0.8) : seen(0.03, 0.1);
      const split = splitUsers(
        Math.round(groupSessionsAndUsers(group, total).users * share),
        onStep ? conversionAfterError(group, seen) : seen(0.9, 1.05),
        outcomes,
      );
      return {
        id: group.id,
        type: group.type,
        error_type: group.error_type,
        severity: group.severity,
        message: group.message,
        method_name: group.method_name,
        file_name: group.file_name,
        count: Math.round(total * share),
        users: split.dropped + split.converted,
        ...split,
      };
    })
    .filter((error) => error.users > 0)
    .sort((a, b) => b.dropped - a.dropped);
}

const QUANTILES: Record<string, number> = {
  p50: 0.5,
  p90: 0.9,
  p95: 0.95,
  p99: 0.99,
};

function quantileOf(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
}

// The count, users and timings of one span or endpoint between two steps.
// A related one is listed in the step event's EventSpec. Most users between
// the steps run it, and the users that dropped off waited longer on it. Few
// of these users run an unrelated one, and both groups waited about as long
// on it. The timings scale `baseMs`,
// the duration at the chosen percentile across the app's samples.
function stepTimings(
  outcomes: Outcomes,
  related: boolean,
  baseMs: number,
  salt: string,
  usesPerUser: [number, number],
) {
  const draw = (name: string, min: number, max: number) =>
    min + (max - min) * unitInterval(`${salt}:${name}`);
  const reach = related ? draw("reach", 0.6, 0.9) : draw("reach", 0.04, 0.15);
  const slowdown = related ? draw("slow", 1.2, 2.1) : draw("slow", 0.95, 1.08);
  const dropped = Math.round(outcomes.dropped * reach);
  const converted = Math.round(
    outcomes.converted *
      reach *
      (related ? draw("conv", 0.75, 0.95) : draw("conv", 0.92, 1.05)),
  );
  return {
    count: Math.round((dropped + converted) * draw("uses", ...usesPerUser)),
    dropped,
    converted,
    droppedMs: dropped > 0 ? Math.round(baseMs * slowdown) : null,
    convertedMs: converted > 0 ? Math.round(baseMs) : null,
  };
}

function stepTraces(
  bundle: AppBundle,
  seed: FunnelSeed,
  step: number | null,
  quantile: number,
  range: SandboxRange,
  filterExpr: string | null,
): FunnelStepTracesResponse["results"] {
  const outcomes = outcomesOf(
    seed,
    conversionFor(bundle, seed, range, filterExpr),
    step,
  );
  const related = new Set(
    targetNames(seed, step).flatMap((name) => EVENTS[name].spans),
  );
  return bundle.rootSpanNames
    .flatMap((spanName) => {
      const durations = bundle.spanRows
        .filter((row) => row.span_name === spanName)
        .map((row) => row.duration);
      if (durations.length === 0) {
        return [];
      }
      // Users load several products before adding one to their cart.
      const timings = stepTimings(
        outcomes,
        related.has(spanName),
        quantileOf(durations, quantile),
        `funneltrace:${bundle.app.id}:${seed.key}:${step}:${spanName}`,
        spanName === "product_load" ? [2.5, 5.5] : [1, 1.6],
      );
      return [
        {
          span_name: spanName,
          count: timings.count,
          dropped: timings.dropped,
          converted: timings.converted,
          dropped_duration_ms: timings.droppedMs,
          converted_duration_ms: timings.convertedMs,
        },
      ];
    })
    .filter((trace) => trace.dropped + trace.converted > 0)
    .sort(
      (a, b) =>
        b.dropped - a.dropped ||
        b.count - a.count ||
        a.span_name.localeCompare(b.span_name),
    );
}

// Whole segments only, so "payment" does not match "/payment-methods". A
// segment can carry a file extension, as in "/hero.webp".
function hasSegment(path: string, segment: string): boolean {
  return path
    .split("/")
    .some((part) => part === segment || part.startsWith(`${segment}.`));
}

function stepNetwork(
  bundle: AppBundle,
  seed: FunnelSeed,
  step: number | null,
  quantile: number,
  range: SandboxRange,
  filterExpr: string | null,
): FunnelStepNetworkResponse["results"] {
  const outcomes = outcomesOf(
    seed,
    conversionFor(bundle, seed, range, filterExpr),
    step,
  );
  const words = targetNames(seed, step).flatMap(
    (name) => EVENTS[name].endpoints,
  );
  const byEndpoint = new Map<string, HttpSample[]>();
  for (const sample of bundle.httpSamples) {
    const key = `${sample.domain}|${sample.path}`;
    byEndpoint.set(key, [...(byEndpoint.get(key) ?? []), sample]);
  }
  return Array.from(byEndpoint.entries())
    .map(([key, samples]) => {
      const [domain, pathPattern] = key.split("|");
      const timings = stepTimings(
        outcomes,
        words.some((word) => hasSegment(pathPattern, word)),
        quantileOf(
          samples.map((s) => s.durationMs),
          quantile,
        ),
        `funnelnetwork:${bundle.app.id}:${seed.key}:${step}:${key}`,
        [1.2, 3.5],
      );
      return {
        domain,
        path_pattern: pathPattern,
        count: timings.count,
        dropped: timings.dropped,
        converted: timings.converted,
        dropped_latency_ms: timings.droppedMs,
        converted_latency_ms: timings.convertedMs,
      };
    })
    .filter((endpoint) => endpoint.dropped + endpoint.converted > 0)
    .sort(
      (a, b) =>
        b.dropped - a.dropped ||
        b.count - a.count ||
        a.domain.localeCompare(b.domain) ||
        a.path_pattern.localeCompare(b.path_pattern),
    );
}

// firstStep is the lowest step the event's name matches, which orders events
// that share a timestamp.
type FunnelEvent = { time: number; step: number; firstStep: number };

// Walks one installation's events the way the server does, so the sessions
// listed for a step belong to installations the funnel counts there.
function reachedTimes(
  events: FunnelEvent[],
  stepCount: number,
  windowMs: number,
  endMs: number,
): number[] {
  const sorted = events
    .filter((event) => event.step !== 1 || event.time < endMs)
    .sort(
      (a, b) => a.time - b.time || a.firstStep - b.firstStep || b.step - a.step,
    );
  const started = sorted.slice(
    Math.max(
      0,
      sorted.findIndex((event) => event.step === 1),
    ),
  );
  if (started.length === 0 || started[0].step !== 1) {
    return [];
  }
  // In a run of events for one step, only the last first-step event and the
  // first event of any later step change the walk.
  const kept = started.filter((event, i) =>
    event.step === 1
      ? i === started.length - 1 || started[i + 1].step !== 1
      : started[i - 1].step !== event.step,
  );

  let paths: (number[] | null)[] = Array(stepCount).fill(null);
  let reached: number[] = [];
  for (const { time, step } of kept) {
    const before = paths;
    const previous = step === 1 ? [] : before[step - 2];
    if (
      step === 1 ||
      (previous !== null &&
        time - previous[0] <= windowMs &&
        (before[step - 1] === null || before[step - 1]![0] !== previous[0]))
    ) {
      paths = [...before];
      paths[step - 1] = [...previous!, time];
    }
    if (
      step === reached.length + 1 &&
      (reached.length === 0 ||
        time - before[reached.length - 1]![0] <= windowMs)
    ) {
      reached = [
        ...(reached.length === 0 ? [] : before[reached.length - 1]!),
        time,
      ];
    }
  }
  return reached;
}

// Lists the sandbox's own sessions, so every row opens a replay whose events
// match the funnel.
function stepSessions(
  bundle: AppBundle,
  seed: FunnelSeed,
  step: number | null,
  outcome: FunnelStepOutcome,
  range: SandboxRange,
  filterExpr: string | null,
): FunnelStepSessionsResponse["results"] {
  const names = eventNamesOf(seed);
  const { from, to } = stepRange(seed, step);
  const windowMs = seed.conversionWindowSeconds * 1000;
  const fromMs = range.from.toMillis();
  const endMs = range.to.toMillis();
  const timeOf = (iso: string) => DateTime.fromISO(iso).toMillis();

  const sessionsByInstallation = new Map<string, AppBundle["sessions"]>();
  for (const session of bundle.sessions) {
    if (!matchesFilterExpr(sessionAttributeBag(session.detail), filterExpr)) {
      continue;
    }
    const id = session.detail.attribute.installation_id;
    sessionsByInstallation.set(id, [
      ...(sessionsByInstallation.get(id) ?? []),
      session,
    ]);
  }

  const attempts: {
    start: number;
    sessions: FunnelStepSessionsResponse["results"];
  }[] = [];
  for (const [installationId, sessions] of sessionsByInstallation) {
    const events = sessions.flatMap((session) =>
      Object.values(session.detail.threads)
        .flat()
        .flatMap((event): FunnelEvent[] => {
          const time = timeOf(event.timestamp);
          if (
            event.event_type !== "custom" ||
            time < fromMs ||
            time >= endMs + windowMs
          ) {
            return [];
          }
          const steps = names.flatMap((name, i) =>
            name === event.name ? [i + 1] : [],
          );
          return steps.map((s) => ({ time, step: s, firstStep: steps[0] }));
        }),
    );
    const reached = reachedTimes(events, names.length, windowMs, endMs);
    if (reached.length <= from) {
      continue;
    }
    const converted = reached.length > to;
    if (converted !== (outcome === "converted")) {
      continue;
    }
    const start = reached[from];
    const end = converted ? reached[to] : reached[0] + windowMs;
    attempts.push({
      start,
      sessions: sessions
        .filter(
          (session) =>
            timeOf(session.list.first_event_time) <= end &&
            timeOf(session.list.last_event_time) >= start,
        )
        .sort((a, b) =>
          a.list.first_event_time.localeCompare(b.list.first_event_time),
        )
        .map(({ list }) => ({
          session_id: list.session_id,
          installation_id: installationId,
          user_id: list.attribute.user_id,
          first_event_time: list.first_event_time,
          duration: Number(list.duration),
        })),
    });
  }
  return attempts
    .sort((a, b) => b.start - a.start)
    .flatMap((attempt) => attempt.sessions);
}

function parseOutcome(url: URL): FunnelStepOutcome | Response {
  const outcome = url.searchParams.get("outcome");
  if (outcome !== "dropped" && outcome !== "converted") {
    return jsonResponse(
      { error: "outcome must be one of dropped or converted" },
      400,
    );
  }
  return outcome;
}

function parseQuantile(url: URL): number | Response {
  const quantile = url.searchParams.get("quantile") ?? "";
  if (!Object.hasOwn(QUANTILES, quantile)) {
    return jsonResponse(
      { error: "quantile must be one of p50, p90, p95 or p99" },
      400,
    );
  }
  return QUANTILES[quantile];
}

function parseStep(url: URL, seed: FunnelSeed): number | null | Response {
  const param = url.searchParams.get("step");
  if (param === null) {
    return null;
  }
  const step = Number(param);
  if (!Number.isInteger(step) || step < 1 || step >= seed.steps.length) {
    return jsonResponse(
      { error: `step must be between 1 and ${seed.steps.length - 1}` },
      400,
    );
  }
  return step;
}

function withFunnel(
  appId: string,
  id: string,
  handle: (bundle: AppBundle, seed: FunnelSeed) => Response,
): Response {
  const bundle = catalog().appById.get(appId);
  const seed = bundle
    ? seedsFor(bundle).find((s) => funnelId(bundle, s) === id)
    : undefined;
  if (!bundle || !seed) {
    return jsonResponse({ error: "Funnel not found" }, 404);
  }
  return handle(bundle, seed);
}

function pageResponse<T>(items: T[], url: URL): Response {
  const page = paginate(items, url);
  return jsonResponse({
    meta: { next: page.hasNext, previous: page.hasPrev },
    results: page.items,
  });
}

export const funnelsRoutes: SandboxRoute[] = [
  {
    method: "GET",
    path: "/api/apps/:appId/funnels",
    handle: ({ params, url }) => {
      const bundle = catalog().appById.get(params.appId);
      if (!bundle) {
        return pageResponse([], url);
      }
      const search = (url.searchParams.get("search") ?? "").toLowerCase();
      const funnels = seedsFor(bundle)
        .filter((seed) => seed.name.toLowerCase().includes(search))
        .sort((a, b) => a.updatedDaysAgo - b.updatedDaysAgo)
        .map((seed) => toFunnel(bundle, seed));
      return pageResponse(funnels, url);
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/funnels/events",
    handle: ({ params, url }) => {
      const bundle = catalog().appById.get(params.appId);
      if (!bundle) {
        return jsonResponse({ results: [] });
      }
      const search = (url.searchParams.get("search") ?? "").toLowerCase();
      const names = [...new Set(seedsFor(bundle).flatMap(eventNamesOf))]
        .filter((name) => name.toLowerCase().includes(search))
        .sort()
        .slice(0, 50);
      return jsonResponse({ results: names });
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/funnels/pinned",
    handle: ({ params }) => {
      const bundle = catalog().appById.get(params.appId);
      return bundle ? pinnedResponse(bundle) : jsonResponse({ results: [] });
    },
  },
  {
    method: "PUT",
    path: "/api/apps/:appId/funnels/pinned",
    handle: ({ params, body }) => {
      const bundle = catalog().appById.get(params.appId);
      if (!bundle) {
        return jsonResponse({ error: "App not found" }, 404);
      }
      const ids = (body as { funnel_ids?: unknown })?.funnel_ids;
      const current = pinnedIdsFor(bundle);
      if (
        !Array.isArray(ids) ||
        ids.length !== current.length ||
        new Set(ids).size !== ids.length ||
        !ids.every((id) => current.includes(id))
      ) {
        return jsonResponse(
          {
            error:
              "Pinned funnels have changed, refresh the page to see the latest pins",
          },
          409,
        );
      }
      pinnedIdsByApp.set(bundle.app.id, ids);
      return pinnedResponse(bundle);
    },
  },
  {
    method: "PUT",
    path: "/api/apps/:appId/funnels/:funnelId/pin",
    handle: ({ params }) =>
      withFunnel(params.appId, params.funnelId, (bundle, seed) => {
        const ids = pinnedIdsFor(bundle);
        if (!ids.includes(params.funnelId)) {
          if (ids.length >= MAX_PINNED_FUNNELS) {
            return jsonResponse(
              {
                error: `Up to ${MAX_PINNED_FUNNELS} funnels can be pinned, unpin one to pin another`,
              },
              409,
            );
          }
          pinnedIdsByApp.set(bundle.app.id, [...ids, params.funnelId]);
        }
        return jsonResponse(toFunnel(bundle, seed));
      }),
  },
  {
    method: "DELETE",
    path: "/api/apps/:appId/funnels/:funnelId/pin",
    handle: ({ params }) =>
      withFunnel(params.appId, params.funnelId, (bundle, seed) => {
        pinnedIdsByApp.set(
          bundle.app.id,
          pinnedIdsFor(bundle).filter((id) => id !== params.funnelId),
        );
        return jsonResponse(toFunnel(bundle, seed));
      }),
  },
  { method: "POST", path: "/api/apps/:appId/funnels", handle: notAvailable },
  {
    method: "GET",
    path: "/api/apps/:appId/funnels/:funnelId",
    handle: ({ params }) =>
      withFunnel(params.appId, params.funnelId, (bundle, seed) =>
        jsonResponse(toFunnel(bundle, seed)),
      ),
  },
  {
    method: "PATCH",
    path: "/api/apps/:appId/funnels/:funnelId",
    handle: notAvailable,
  },
  {
    method: "DELETE",
    path: "/api/apps/:appId/funnels/:funnelId",
    handle: notAvailable,
  },
  {
    method: "GET",
    path: "/api/apps/:appId/funnels/:funnelId/conversion",
    handle: ({ params, url }) =>
      withFunnel(params.appId, params.funnelId, (bundle, seed) => {
        const totals = conversionFor(
          bundle,
          seed,
          parseRange(url),
          url.searchParams.get("filter_expr"),
        );
        const conversion: FunnelConversion = {
          steps: eventNamesOf(seed).map((event_name, i) => ({
            event_name,
            users: totals.users[i],
            median_seconds_from_previous: totals.medianSeconds[i],
          })),
        };
        return jsonResponse(conversion);
      }),
  },
  {
    method: "GET",
    path: "/api/apps/:appId/funnels/:funnelId/errors",
    handle: ({ params, url }) =>
      withFunnel(params.appId, params.funnelId, (bundle, seed) => {
        const step = parseStep(url, seed);
        if (step instanceof Response) {
          return step;
        }
        return pageResponse(
          stepErrors(
            bundle,
            seed,
            step,
            parseRange(url),
            url.searchParams.get("filter_expr"),
          ),
          url,
        );
      }),
  },
  {
    method: "GET",
    path: "/api/apps/:appId/funnels/:funnelId/traces",
    handle: ({ params, url }) =>
      withFunnel(params.appId, params.funnelId, (bundle, seed) => {
        const step = parseStep(url, seed);
        if (step instanceof Response) {
          return step;
        }
        const quantile = parseQuantile(url);
        if (quantile instanceof Response) {
          return quantile;
        }
        return pageResponse(
          stepTraces(
            bundle,
            seed,
            step,
            quantile,
            parseRange(url),
            url.searchParams.get("filter_expr"),
          ),
          url,
        );
      }),
  },
  {
    method: "GET",
    path: "/api/apps/:appId/funnels/:funnelId/network",
    handle: ({ params, url }) =>
      withFunnel(params.appId, params.funnelId, (bundle, seed) => {
        const step = parseStep(url, seed);
        if (step instanceof Response) {
          return step;
        }
        const quantile = parseQuantile(url);
        if (quantile instanceof Response) {
          return quantile;
        }
        return pageResponse(
          stepNetwork(
            bundle,
            seed,
            step,
            quantile,
            parseRange(url),
            url.searchParams.get("filter_expr"),
          ),
          url,
        );
      }),
  },
  {
    method: "GET",
    path: "/api/apps/:appId/funnels/:funnelId/sessions",
    handle: ({ params, url }) =>
      withFunnel(params.appId, params.funnelId, (bundle, seed) => {
        const step = parseStep(url, seed);
        if (step instanceof Response) {
          return step;
        }
        const outcome = parseOutcome(url);
        if (outcome instanceof Response) {
          return outcome;
        }
        return pageResponse(
          stepSessions(
            bundle,
            seed,
            step,
            outcome,
            parseRange(url),
            url.searchParams.get("filter_expr"),
          ),
          url,
        );
      }),
  },
  {
    method: "GET",
    path: "/api/apps/:appId/funnels/:funnelId/cadence",
    handle: ({ params, url }) =>
      withFunnel(params.appId, params.funnelId, (bundle, seed) => {
        const weeks = Number(url.searchParams.get("weeks"));
        if (
          !Number.isInteger(weeks) ||
          weeks < 1 ||
          weeks > MAX_CADENCE_WEEKS
        ) {
          return jsonResponse(
            { error: `weeks must be between 1 and ${MAX_CADENCE_WEEKS}` },
            400,
          );
        }
        return jsonResponse(
          cadenceFor(
            bundle,
            seed,
            weeks,
            url.searchParams.get("timezone") ?? "UTC",
            url.searchParams.get("filter_expr"),
          ),
        );
      }),
  },
  {
    method: "GET",
    path: "/api/apps/:appId/funnels/:funnelId/trend",
    handle: ({ params, url }) =>
      withFunnel(params.appId, params.funnelId, (bundle, seed) => {
        const period = url.searchParams.get("period") as FunnelTrendPeriod;
        if (!Object.hasOwn(TREND_PERIODS, period)) {
          return jsonResponse(
            { error: "period must be one of day, week or month" },
            400,
          );
        }
        const trend = trendFor(
          bundle,
          seed,
          period,
          url.searchParams.get("timezone") ?? "UTC",
          url.searchParams.get("filter_expr"),
        );
        return jsonResponse(
          url.searchParams.get("builds") === "true"
            ? trend
            : { ...trend, builds: [] },
        );
      }),
  },
];
