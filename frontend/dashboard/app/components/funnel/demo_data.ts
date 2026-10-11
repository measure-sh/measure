import { DateTime } from "luxon";
import type {
  Funnel,
  FunnelCadence,
  FunnelConversion,
  FunnelStepErrorsResponse,
  FunnelStepNetworkResponse,
  FunnelStepTracesResponse,
  FunnelTrend,
  FunnelTrendPeriod,
} from "../../api/api_calls";
import {
  FUNNEL_STEP_LIST_LIMIT,
  type RootSpanMetricsQuantile,
} from "../../query/hooks";

const CONVERSION_WINDOW_SECONDS = 3600;

export const demoFunnel: Funnel = {
  id: "demo-funnel",
  app_id: "demo-app",
  name: "Checkout",
  steps: [
    { event_name: "view_product" },
    { event_name: "add_to_cart" },
    { event_name: "begin_checkout" },
    { event_name: "payment_submitted" },
    { event_name: "order_confirmed" },
  ],
  conversion_window_seconds: CONVERSION_WINDOW_SECONDS,
  pinned: true,
  pin_order: 0,
  created_by: "demo-user",
  created_by_email: "dev@demo-provider.com",
  created_at: DateTime.now().minus({ months: 4 }).toISO(),
  updated_at: DateTime.now().minus({ days: 9 }).toISO(),
};

export const demoConversion: FunnelConversion = {
  steps: [
    {
      event_name: "view_product",
      users: 12480,
      median_seconds_from_previous: null,
    },
    {
      event_name: "add_to_cart",
      users: 7930,
      median_seconds_from_previous: 96,
    },
    {
      event_name: "begin_checkout",
      users: 4620,
      median_seconds_from_previous: 142,
    },
    {
      event_name: "payment_submitted",
      users: 3410,
      median_seconds_from_previous: 211,
    },
    {
      event_name: "order_confirmed",
      users: 2960,
      median_seconds_from_previous: 18,
    },
  ],
};

// Each item belongs to the step users were moving into when they hit it.
type StepItem<T> = T & { step: number };

type StepError = FunnelStepErrorsResponse["results"][number];
type StepTrace = FunnelStepTracesResponse["results"][number];
type StepEndpoint = FunnelStepNetworkResponse["results"][number];

const demoErrors: StepItem<Omit<StepError, "users">>[] = [
  {
    step: 1,
    id: "demo-oom",
    type: "java.lang.OutOfMemoryError",
    error_type: "exception",
    severity: "fatal",
    message:
      "Failed to allocate a 12582928 byte allocation with 4194304 free bytes",
    method_name: "onBindViewHolder",
    file_name: "ProductGalleryAdapter.kt",
    count: 520,
    dropped: 412,
    converted: 38,
  },
  {
    step: 1,
    id: "demo-anr",
    type: "ANR",
    error_type: "anr",
    severity: "fatal",
    message: "Input dispatching timed out",
    method_name: "onCreate",
    file_name: "ProductDetailActivity.kt",
    count: 240,
    dropped: 196,
    converted: 21,
  },
  {
    step: 1,
    id: "demo-image-host",
    type: "java.io.IOException",
    error_type: "exception",
    severity: "handled",
    message: 'Unable to resolve host "cdn.demo-provider.com"',
    method_name: "fetch",
    file_name: "ImageLoader.kt",
    count: 610,
    dropped: 118,
    converted: 240,
  },
  {
    step: 2,
    id: "demo-cart-timeout",
    type: "kotlinx.coroutines.TimeoutCancellationException",
    error_type: "exception",
    severity: "handled",
    message: "Timed out waiting for 10000 ms",
    method_name: "syncCart",
    file_name: "CartRepository.kt",
    count: 1130,
    dropped: 640,
    converted: 210,
  },
  {
    step: 2,
    id: "demo-cart-index",
    type: "java.lang.IndexOutOfBoundsException",
    error_type: "exception",
    severity: "unhandled",
    message: "Index 3 out of bounds for length 3",
    method_name: "onItemRemoved",
    file_name: "CartItemsAdapter.kt",
    count: 290,
    dropped: 205,
    converted: 61,
  },
  {
    step: 3,
    id: "demo-coupon",
    type: "java.lang.IllegalStateException",
    error_type: "exception",
    severity: "unhandled",
    message: "Coupon response is missing discount",
    method_name: "applyCoupon",
    file_name: "CheckoutViewModel.kt",
    count: 402,
    dropped: 318,
    converted: 44,
  },
  {
    step: 3,
    id: "demo-postcode",
    type: "java.lang.NumberFormatException",
    error_type: "exception",
    severity: "handled",
    message: 'For input string: "SW1A 1AA"',
    method_name: "validatePostcode",
    file_name: "AddressFormFragment.kt",
    count: 530,
    dropped: 152,
    converted: 260,
  },
  {
    step: 4,
    id: "demo-payment-sheet",
    type: "java.lang.IllegalStateException",
    error_type: "exception",
    severity: "fatal",
    message: "Payment sheet is not attached to an activity",
    method_name: "onPaymentResult",
    file_name: "PaymentSheetCallback.kt",
    count: 188,
    dropped: 171,
    converted: 9,
  },
  {
    step: 4,
    id: "demo-order-poll",
    type: "java.net.SocketTimeoutException",
    error_type: "exception",
    severity: "handled",
    message: "timeout",
    method_name: "poll",
    file_name: "OrderStatusPoller.kt",
    count: 395,
    dropped: 88,
    converted: 132,
  },
];

const demoTraces: StepItem<StepTrace>[] = [
  {
    step: 1,
    span_name: "screen.product_detail",
    count: 13400,
    dropped: 4310,
    converted: 7790,
    dropped_duration_ms: 1210,
    converted_duration_ms: 980,
  },
  {
    step: 1,
    span_name: "product.load_gallery",
    count: 12600,
    dropped: 3890,
    converted: 7420,
    dropped_duration_ms: 1840,
    converted_duration_ms: 760,
  },
  {
    step: 2,
    span_name: "cart.sync",
    count: 8150,
    dropped: 2980,
    converted: 4410,
    dropped_duration_ms: 2650,
    converted_duration_ms: 910,
  },
  {
    step: 2,
    span_name: "cart.render",
    count: 7400,
    dropped: 2710,
    converted: 4380,
    dropped_duration_ms: 340,
    converted_duration_ms: 310,
  },
  {
    step: 3,
    span_name: "checkout.load_shipping_options",
    count: 5100,
    dropped: 1080,
    converted: 3290,
    dropped_duration_ms: 3120,
    converted_duration_ms: 1180,
  },
  {
    step: 3,
    span_name: "checkout.apply_coupon",
    count: 1900,
    dropped: 520,
    converted: 1310,
    dropped_duration_ms: 1650,
    converted_duration_ms: 620,
  },
  {
    step: 4,
    span_name: "payment.tokenize_card",
    count: 3720,
    dropped: 430,
    converted: 2930,
    dropped_duration_ms: 2480,
    converted_duration_ms: 1340,
  },
  {
    step: 4,
    span_name: "order.confirm",
    count: 3240,
    dropped: 120,
    converted: 2940,
    dropped_duration_ms: 1890,
    converted_duration_ms: 1720,
  },
];

const demoEndpoints: StepItem<StepEndpoint>[] = [
  {
    step: 1,
    domain: "cdn.demo-provider.com",
    path_pattern: "/images/**",
    count: 96500,
    dropped: 4380,
    converted: 7850,
    dropped_latency_ms: 1320,
    converted_latency_ms: 540,
  },
  {
    step: 1,
    domain: "store.demo-provider.com",
    path_pattern: "/v1/products/*",
    count: 24800,
    dropped: 4420,
    converted: 7880,
    dropped_latency_ms: 860,
    converted_latency_ms: 410,
  },
  {
    step: 1,
    domain: "store.demo-provider.com",
    path_pattern: "/v1/recommendations",
    count: 11800,
    dropped: 3020,
    converted: 6100,
    dropped_latency_ms: 690,
    converted_latency_ms: 650,
  },
  {
    step: 2,
    domain: "store.demo-provider.com",
    path_pattern: "/v1/cart",
    count: 15100,
    dropped: 3150,
    converted: 4580,
    dropped_latency_ms: 2310,
    converted_latency_ms: 620,
  },
  {
    step: 2,
    domain: "store.demo-provider.com",
    path_pattern: "/v1/cart/items/*",
    count: 9900,
    dropped: 2460,
    converted: 4510,
    dropped_latency_ms: 540,
    converted_latency_ms: 480,
  },
  {
    step: 3,
    domain: "store.demo-provider.com",
    path_pattern: "/v1/checkout/shipping-rates",
    count: 5200,
    dropped: 1110,
    converted: 3350,
    dropped_latency_ms: 2780,
    converted_latency_ms: 980,
  },
  {
    step: 3,
    domain: "store.demo-provider.com",
    path_pattern: "/v1/coupons/*/apply",
    count: 2100,
    dropped: 470,
    converted: 1290,
    dropped_latency_ms: 1420,
    converted_latency_ms: 560,
  },
  {
    step: 4,
    domain: "payments.demo-provider.com",
    path_pattern: "/v1/payment_intents/*/confirm",
    count: 3600,
    dropped: 440,
    converted: 2950,
    dropped_latency_ms: 2140,
    converted_latency_ms: 1260,
  },
  {
    step: 4,
    domain: "store.demo-provider.com",
    path_pattern: "/v1/orders/*",
    count: 8100,
    dropped: 410,
    converted: 2960,
    dropped_latency_ms: 380,
    converted_latency_ms: 350,
  },
];

const QUANTILE_SCALE: Record<`${RootSpanMetricsQuantile}`, number> = {
  p50: 1,
  p90: 2.1,
  p95: 2.7,
  p99: 4.2,
};

const scaleMs = (ms: number | null, quantile: RootSpanMetricsQuantile) =>
  ms === null ? null : Math.round(ms * QUANTILE_SCALE[quantile]);

// A null step covers the whole funnel, where every item is listed. Only the
// item's users that reached the last step count as converted, and those that
// got past the item's step but dropped off later count as dropped.
function itemsForStep<
  T extends { step: number; converted: number; dropped: number },
>(items: T[], step: number | null): T[] {
  if (step !== null) {
    return items.filter((item) => item.step === step);
  }
  const { steps } = demoConversion;
  const lastUsers = steps[steps.length - 1].users;
  return items.map((item) => {
    const converted = Math.round(
      (item.converted * lastUsers) / steps[item.step].users,
    );
    return {
      ...item,
      converted,
      dropped: item.dropped + item.converted - converted,
    };
  });
}

function page<T>(items: T[], offset: number) {
  return {
    meta: {
      next: offset + FUNNEL_STEP_LIST_LIMIT < items.length,
      previous: offset > 0,
    },
    results: items.slice(offset, offset + FUNNEL_STEP_LIST_LIMIT),
  };
}

export function demoStepErrors(
  step: number | null,
  offset: number,
): FunnelStepErrorsResponse {
  const errors = itemsForStep(demoErrors, step)
    .map(({ step: _, ...error }) => ({
      ...error,
      users: error.dropped + error.converted,
    }))
    .sort((a, b) => b.dropped - a.dropped);
  return page(errors, offset);
}

export function demoStepTraces(
  step: number | null,
  quantile: RootSpanMetricsQuantile,
  offset: number,
): FunnelStepTracesResponse {
  const traces = itemsForStep(demoTraces, step)
    .map(({ step: _, ...trace }) => ({
      ...trace,
      dropped_duration_ms: scaleMs(trace.dropped_duration_ms, quantile),
      converted_duration_ms: scaleMs(trace.converted_duration_ms, quantile),
    }))
    .sort((a, b) => b.dropped - a.dropped);
  return page(traces, offset);
}

export function demoStepNetwork(
  step: number | null,
  quantile: RootSpanMetricsQuantile,
  offset: number,
): FunnelStepNetworkResponse {
  const endpoints = itemsForStep(demoEndpoints, step)
    .map(({ step: _, ...endpoint }) => ({
      ...endpoint,
      dropped_latency_ms: scaleMs(endpoint.dropped_latency_ms, quantile),
      converted_latency_ms: scaleMs(endpoint.converted_latency_ms, quantile),
    }))
    .sort((a, b) => b.dropped - a.dropped);
  return page(endpoints, offset);
}

const uploadedAt = (daysAgo: number) =>
  DateTime.now()
    .minus({ days: daysAgo })
    .set({ hour: 11, minute: 0, second: 0, millisecond: 0 })
    .toUTC()
    .toISO()!;

// Releases every three weeks over the last year up to 2.4.0, which broke the
// payment sheet, then the 2.4.1 hotfix, so the last step converts worse
// between the two.
const demoBuilds: FunnelTrend["builds"] = [
  ...Array.from({ length: 17 }, (_, i) => ({
    version_name: `2.${Math.floor(i / 4)}.${i % 4}`,
    version_code: String(200 + i),
    patch_id: null,
    patch_version: null,
    uploaded_at: uploadedAt(21 * (16 - i) + 12),
  })),
  {
    version_name: "2.4.1",
    version_code: "217",
    patch_id: null,
    patch_version: null,
    uploaded_at: uploadedAt(7),
  },
];

const brokenFrom = DateTime.fromISO(
  demoBuilds.find((b) => b.version_name === "2.4.0")!.uploaded_at,
);
const brokenUntil = DateTime.fromISO(
  demoBuilds.find((b) => b.version_name === "2.4.1")!.uploaded_at,
);

const TREND_LENGTHS: Record<FunnelTrendPeriod, number> = {
  day: 30,
  week: 12,
  month: 12,
};

const BASE_STEP_RATES = [0.64, 0.58, 0.74, 0.88];
const BASE_MEDIANS = [96, 142, 211, 18];

function generateTrend(period: FunnelTrendPeriod): FunnelTrend {
  const now = DateTime.now();
  const length = TREND_LENGTHS[period];
  const current = now.startOf(period);
  const points = Array.from({ length }, (_, i) => {
    const start = current.minus({ [period]: length - 1 - i });
    const end = start.plus({ [period]: 1 });
    const days = end.diff(start, "days").days;
    const elapsed = Math.min(
      1,
      now.diff(start).as("milliseconds") / end.diff(start).as("milliseconds"),
    );
    const weekend = period === "day" && start.weekday >= 6 ? 1.25 : 1;
    let users = Math.round(
      1700 * days * weekend * elapsed * (0.9 + Math.random() * 0.2),
    );
    const broken = start < brokenUntil && end > brokenFrom;
    const steps: FunnelTrend["points"][number]["steps"] = [
      { users, median_seconds_from_previous: null },
    ];
    BASE_STEP_RATES.forEach((rate, step) => {
      const stepRate =
        broken && step === BASE_STEP_RATES.length - 1 ? rate - 0.17 : rate;
      users = Math.round(users * (stepRate + (Math.random() - 0.5) * 0.04));
      steps.push({
        users,
        median_seconds_from_previous: Math.round(
          BASE_MEDIANS[step] * (0.9 + Math.random() * 0.2),
        ),
      });
    });
    return {
      datetime: start.toISODate()!,
      steps,
      median_seconds_to_convert: steps
        .slice(1)
        .reduce((sum, s) => sum + (s.median_seconds_from_previous ?? 0), 0),
      complete: end.plus({ seconds: CONVERSION_WINDOW_SECONDS }) <= now,
    };
  });
  const first = current.minus({ [period]: length - 1 });
  return {
    event_names: demoFunnel.steps.map((s) => s.event_name),
    points,
    builds: demoBuilds.filter((b) => {
      const uploaded = DateTime.fromISO(b.uploaded_at);
      return uploaded >= first && uploaded < now;
    }),
  };
}

export const demoTrends: Record<FunnelTrendPeriod, FunnelTrend> = {
  day: generateTrend("day"),
  week: generateTrend("week"),
  month: generateTrend("month"),
};

// Users enter the funnel most around lunch and in the evening.
function hourlyUsers(hour: number): number {
  const lunch = Math.exp(-((hour - 12.5) ** 2) / 4);
  const evening = Math.exp(-((hour - 21) ** 2) / 5);
  return 4 + 30 * lunch + 45 * evening;
}

function generateCadence(weeks: number): FunnelCadence {
  const to = DateTime.now()
    .minus({ seconds: CONVERSION_WINDOW_SECONDS })
    .startOf("week");
  const hours: FunnelCadence["hours"] = [];
  for (let weekday = 1; weekday <= 7; weekday++) {
    const dayScale = weekday >= 6 ? 1.3 : 1;
    for (let hour = 0; hour < 24; hour++) {
      const users = Math.round(
        weeks * hourlyUsers(hour) * dayScale * (0.85 + Math.random() * 0.3),
      );
      // Evening users convert best.
      const rate = 0.18 + 0.08 * Math.exp(-((hour - 21) ** 2) / 8);
      hours.push({
        weekday,
        hour,
        users,
        converted: Math.round(users * rate),
      });
    }
  }
  return {
    from: to.minus({ weeks }).toISO()!,
    to: to.toISO()!,
    hours,
  };
}

export const demoCadences: Record<number, FunnelCadence> = {
  1: generateCadence(1),
  4: generateCadence(4),
  12: generateCadence(12),
};
