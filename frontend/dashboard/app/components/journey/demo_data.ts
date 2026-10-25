import { DateTime } from "luxon";
import type {
  Journey,
  JourneyErrorsResponse,
  JourneyLink,
  JourneyNetworkResponse,
  JourneyNode,
  JourneyPath,
  JourneySelection,
  JourneySessionsResponse,
  JourneyTracesResponse,
} from "../../api/api_calls";
import type { RootSpanMetricsQuantile } from "../../query/hooks";
import { stableInt, stableUuid } from "../../sandbox/query";

// The demo is the journey of the sandbox's Acme shop Android app, so the
// numbers agree with the sandbox and the product screenshots.

function node(
  id: string,
  kind: JourneyNode["kind"],
  step: number,
  users: number,
  continuing: number,
  medianMsFromPrevious: number,
): JourneyNode {
  return {
    id,
    name: id === "fatal" ? "Fatal error" : id,
    kind,
    step,
    users,
    continuing,
    median_ms_from_previous: medianMsFromPrevious,
  };
}

const HOME = "com.acme.shop.home.HomeActivity";
const PRODUCT_LIST = "com.acme.shop.catalog.ProductListActivity";
const SEARCH = "com.acme.shop.search.SearchActivity";
const CART = "com.acme.shop.cart.CartFragment";
const CHECKOUT = "com.acme.shop.checkout.CheckoutActivity";
const PAYMENT = "com.acme.shop.payment.PaymentFragment";
const ORDER_CONFIRMATION = "com.acme.shop.order.OrderConfirmationActivity";

export const demoJourney: Journey = {
  sample_percent: 100,
  nodes: [
    node(HOME, "screen", 0, 105_000, 105_000, 4_171),
    node(PRODUCT_LIST, "screen", 2, 105_000, 105_000, 3_342),
    node("product_viewed", "event", 5, 105_000, 105_000, 2_109),
    node("added_to_cart", "event", 6, 86_447, 86_447, 10_311),
    node(SEARCH, "screen", 6, 18_313, 18_313, 10_483),
    node(CART, "screen", 14, 86_447, 86_447, 61),
    node("cart_viewed", "event", 15, 86_447, 86_447, 953),
    node("fatal", "fatal", 15, 405, 0, 5_841),
    node(CHECKOUT, "screen", 16, 60_001, 60_001, 5_736),
    node("checkout_started", "event", 17, 60_001, 34_100, 579),
    node(PAYMENT, "screen", 18, 34_100, 34_100, 12_592),
    node("payment_submitted", "event", 19, 34_100, 34_100, 6_415),
    node(ORDER_CONFIRMATION, "screen", 20, 33_935, 33_935, 4_356),
    node("coupon_applied", "event", 20, 14_881, 14_881, 14_179),
    node("order_placed", "event", 21, 33_935, 33_935, 999),
  ],
  links: (
    [
      ["product_viewed", "added_to_cart", 86_447],
      ["added_to_cart", PRODUCT_LIST, 86_447],
      [PRODUCT_LIST, HOME, 86_447],
      [HOME, CART, 86_447],
      [CART, "cart_viewed", 86_447],
      [CHECKOUT, "checkout_started", 60_001],
      ["product_viewed", HOME, 59_880],
      ["cart_viewed", CHECKOUT, 45_120],
      [HOME, PRODUCT_LIST, 41_567],
      ["checkout_started", PAYMENT, 34_100],
      [PAYMENT, "payment_submitted", 34_100],
      ["payment_submitted", ORDER_CONFIRMATION, 33_935],
      [ORDER_CONFIRMATION, "order_placed", 33_935],
      [ORDER_CONFIRMATION, HOME, 33_935],
      ["product_viewed", PRODUCT_LIST, 26_851],
      ["cart_viewed", HOME, 26_446],
      [CART, PRODUCT_LIST, 26_446],
      [HOME, SEARCH, 18_313],
      ["product_viewed", SEARCH, 18_313],
      ["cart_viewed", "coupon_applied", 14_881],
      ["coupon_applied", CHECKOUT, 14_881],
      ["payment_submitted", "fatal", 165],
      [PRODUCT_LIST, "fatal", 73],
      ["product_viewed", "fatal", 60],
    ] as const
  ).map(([source, target, users]) => ({ source, target, users })),
};

type ErrorGroup = Omit<
  JourneyErrorsResponse["results"][number],
  "count" | "users"
>;

const errorGroups = {
  promoTimeout: {
    id: "27de6d11-a5fb-4dcf-8a15-212ee82e30f6",
    type: "java.net.SocketTimeoutException",
    error_type: "exception",
    severity: "handled",
    message: "timeout",
    method_name: "validatePromoCode",
    file_name: "CartRepository.kt",
  },
  placeOrderCrash: {
    id: "2275dc25-a7d7-4b7d-95ad-ee01a5dedcd7",
    type: "java.lang.NullPointerException",
    error_type: "exception",
    severity: "fatal",
    message:
      "Attempt to invoke virtual method 'java.lang.String com.acme.shop.data.Cart.getId()' on a null object reference",
    method_name: "onPlaceOrderClicked",
    file_name: "CheckoutViewModel.kt",
  },
  heroBitmapAnr: {
    id: "b5795084-725a-4930-92f0-964e871bdc12",
    type: "sh.measure.android.anr.AnrError",
    error_type: "anr",
    severity: "fatal",
    message: "Application Not Responding for at least 5s",
    method_name: "decodeHeroBitmap$lambda$4",
    file_name: "ProductDetailFragment.kt",
  },
  productListCrash: {
    id: "1bc44fb2-d47a-43cb-8675-a98a9bd69528",
    type: "java.lang.IllegalStateException",
    error_type: "exception",
    severity: "fatal",
    message:
      "Cannot call this method while RecyclerView is computing a layout or scrolling",
    method_name: "onBindViewHolder",
    file_name: "ProductListActivity.kt",
  },
  blurFilterCrash: {
    id: "6d37cd70-07a9-40bc-9c60-5903bf4246c3",
    type: "SIGSEGV",
    error_type: "exception",
    severity: "fatal",
    message: "Use After Free",
    method_name:
      "acme::BlurFilter::blurRow(unsigned char const*, unsigned char*, int)",
    file_name: "blur_filter.cpp",
  },
} satisfies Record<string, ErrorGroup>;

// Each item has its users, and the p50 of its duration or latency in
// milliseconds.
type Items = {
  errors?: [keyof typeof errorGroups, number][];
  traces?: [string, number, number][];
  network?: [string, number, number][];
};

const nodeItems: Record<string, Items> = {
  [HOME]: { network: [["/v1/products", 104_767, 216]] },
  [PRODUCT_LIST]: {
    errors: [["productListCrash", 73]],
    network: [["/v1/products", 86_687, 181]],
  },
  product_viewed: {
    errors: [["blurFilterCrash", 60]],
    traces: [["product_load", 18_313, 1_407]],
    network: [
      ["/v1/cart/items", 86_447, 217],
      ["/v1/products/*", 18_374, 132],
      ["/v1/products/*/reviews", 18_374, 114],
      ["/images/*/hero.webp", 18_374, 760],
    ],
  },
  [SEARCH]: {
    traces: [["search_query", 18_313, 877]],
    network: [["/v1/search", 18_313, 217]],
  },
  [CART]: {
    traces: [["cart_refresh", 86_447, 370]],
    network: [
      ["/v1/cart", 86_447, 124],
      ["/v1/cart/items/*", 26_446, 91],
    ],
  },
  cart_viewed: {
    errors: [["promoTimeout", 19_055]],
    network: [
      ["/v1/cart/items/*", 67_227, 123],
      ["/v1/promotions/validate", 33_935, 10_011],
    ],
  },
  fatal: {
    errors: [
      ["placeOrderCrash", 165],
      ["heroBitmapAnr", 107],
      ["productListCrash", 73],
      ["blurFilterCrash", 60],
    ],
  },
  payment_submitted: {
    errors: [["placeOrderCrash", 165]],
    traces: [["checkout_flow", 33_935, 1_868]],
    network: [
      ["/v1/checkout", 34_100, 443],
      ["/v1/payment", 34_100, 394],
      ["/v1/orders", 33_935, 664],
    ],
  },
  [ORDER_CONFIRMATION]: { network: [["/v1/orders/*", 33_935, 87]] },
};

const linkKey = (source: string, target: string) => `${source}>${target}`;

const linkItems: Record<string, Items> = {
  [linkKey("product_viewed", "added_to_cart")]: {
    network: [["/v1/cart/items", 86_447, 217]],
  },
  [linkKey(CART, "cart_viewed")]: {
    traces: [["cart_refresh", 86_447, 370]],
    network: [["/v1/cart", 86_447, 124]],
  },
  [linkKey("cart_viewed", CHECKOUT)]: {
    errors: [["promoTimeout", 19_055]],
    network: [
      ["/v1/cart/items/*", 25_900, 95],
      ["/v1/promotions/validate", 19_055, 10_011],
    ],
  },
  [linkKey(HOME, PRODUCT_LIST)]: { network: [["/v1/products", 41_327, 159]] },
  [linkKey("payment_submitted", ORDER_CONFIRMATION)]: {
    traces: [["checkout_flow", 33_935, 1_868]],
    network: [
      ["/v1/checkout", 33_935, 565],
      ["/v1/payment", 33_935, 394],
      ["/v1/orders", 33_935, 664],
    ],
  },
  [linkKey(ORDER_CONFIRMATION, "order_placed")]: {
    network: [["/v1/orders/*", 33_935, 87]],
  },
  [linkKey("cart_viewed", HOME)]: {
    network: [["/v1/cart/items/*", 26_446, 123]],
  },
  [linkKey(CART, PRODUCT_LIST)]: {
    network: [["/v1/cart/items/*", 26_446, 91]],
  },
  [linkKey("product_viewed", SEARCH)]: {
    traces: [["product_load", 18_313, 1_407]],
    network: [
      ["/v1/products/*", 18_313, 132],
      ["/v1/products/*/reviews", 18_313, 105],
      ["/images/*/hero.webp", 18_313, 760],
    ],
  },
  [linkKey("cart_viewed", "coupon_applied")]: {
    network: [
      ["/v1/cart/items/*", 14_881, 213],
      ["/v1/promotions/validate", 14_881, 138],
    ],
  },
  [linkKey("payment_submitted", "fatal")]: {
    errors: [["placeOrderCrash", 165]],
    network: [
      ["/v1/checkout", 165, 275],
      ["/v1/payment", 165, 422],
    ],
  },
  [linkKey(PRODUCT_LIST, "fatal")]: {
    errors: [["productListCrash", 73]],
    network: [["/v1/products", 73, 237]],
  },
  [linkKey("product_viewed", "fatal")]: {
    errors: [["blurFilterCrash", 60]],
    network: [
      ["/v1/products/*", 60, 60],
      ["/v1/products/*/reviews", 60, 114],
      ["/images/*/hero.webp", 60, 454],
    ],
  },
};

// The paths the product screenshots show, with the users and lists that the
// sandbox gives them. Other paths are put together from their links.
const featuredPaths: { path: string[]; users: number; items: Items }[] = [
  {
    path: [
      HOME,
      CART,
      "cart_viewed",
      CHECKOUT,
      "checkout_started",
      PAYMENT,
      "payment_submitted",
      ORDER_CONFIRMATION,
      "order_placed",
    ],
    users: 19_055,
    items: {
      errors: [["promoTimeout", 19_055]],
      traces: [
        ["cart_refresh", 19_055, 380],
        ["checkout_flow", 19_055, 1_829],
      ],
      network: [
        ["/v1/cart", 19_055, 124],
        ["/v1/promotions/validate", 19_055, 10_011],
        ["/v1/checkout", 19_055, 565],
        ["/v1/payment", 19_055, 394],
        ["/v1/orders", 19_055, 501],
        ["/v1/orders/*", 19_055, 87],
      ],
    },
  },
  {
    path: [CHECKOUT, "checkout_started", PAYMENT, "payment_submitted", "fatal"],
    users: 165,
    items: {
      errors: [["placeOrderCrash", 165]],
      network: [
        ["/v1/checkout", 165, 275],
        ["/v1/payment", 165, 422],
      ],
    },
  },
];

// The purchase path, which the demo opens with.
export const demoSelection: JourneySelection = {
  path: featuredPaths[0].path,
};

function pathOf(selection: JourneyLink | JourneyPath): string[] {
  return "path" in selection
    ? selection.path
    : [selection.source, selection.target];
}

function linkUsers(source: string, target: string): number {
  return (
    demoJourney.links.find((l) => l.source === source && l.target === target)
      ?.users ?? 0
  );
}

function nodeUsers(id: string): number {
  return demoJourney.nodes.find((n) => n.id === id)?.users ?? 0;
}

function featuredPath(path: string[]) {
  return featuredPaths.find(
    (f) =>
      f.path.length === path.length && f.path.every((id, i) => id === path[i]),
  );
}

// A path keeps the share of each link's users that went on along it.
export function demoPathUsers(path: string[]): number {
  const featured = featuredPath(path);
  if (featured !== undefined) {
    return featured.users;
  }
  let users = nodeUsers(path[0]);
  for (let i = 1; i < path.length; i++) {
    const from = nodeUsers(path[i - 1]);
    users = from === 0 ? 0 : (users * linkUsers(path[i - 1], path[i])) / from;
  }
  return Math.round(users);
}

function mergeItems<Item extends [string, number, ...number[]]>(
  lists: (Item[] | undefined)[],
  users: number,
): Item[] {
  const merged = new Map<string, Item>();
  for (const item of lists.flatMap((list) => list ?? [])) {
    if (!merged.has(item[0])) {
      merged.set(item[0], [
        item[0],
        Math.min(item[1], users),
        ...item.slice(2),
      ] as Item);
    }
  }
  return [...merged.values()];
}

// A path covers the time of each of its links, so it has their items, with
// no more users than the path has.
function itemsOf(selection: JourneySelection): Items {
  if ("node" in selection) {
    return nodeItems[selection.node] ?? {};
  }
  const path = pathOf(selection);
  const featured = featuredPath(path);
  if (featured !== undefined) {
    return featured.items;
  }
  const users = demoPathUsers(path);
  const links = path
    .slice(1)
    .map((target, i) => linkItems[linkKey(path[i], target)] ?? {});
  return {
    errors: mergeItems(
      links.map((link) => link.errors),
      users,
    ),
    traces: mergeItems(
      links.map((link) => link.traces),
      users,
    ),
    network: mergeItems(
      links.map((link) => link.network),
      users,
    ),
  };
}

const QUANTILE_FACTORS: Record<RootSpanMetricsQuantile, number> = {
  p50: 1,
  p90: 1.8,
  p95: 2.3,
  p99: 3.4,
};

const page = { meta: { next: false, previous: false }, sample_percent: 100 };

export function demoErrors(selection: JourneySelection): JourneyErrorsResponse {
  return {
    ...page,
    results: (itemsOf(selection).errors ?? [])
      .map(([key, users]) => ({ ...errorGroups[key], count: users, users }))
      .sort((a, b) => b.users - a.users),
  };
}

export function demoTraces(
  selection: JourneySelection,
  quantile: RootSpanMetricsQuantile,
): JourneyTracesResponse {
  return {
    ...page,
    results: (itemsOf(selection).traces ?? [])
      .map(([span_name, users, ms]) => ({
        span_name,
        count: users,
        users,
        duration_ms: Math.round(ms * QUANTILE_FACTORS[quantile]),
      }))
      .sort((a, b) => b.users - a.users),
  };
}

export function demoNetwork(
  selection: JourneySelection,
  quantile: RootSpanMetricsQuantile,
): JourneyNetworkResponse {
  return {
    ...page,
    results: (itemsOf(selection).network ?? [])
      .map(([path_pattern, users, ms]) => ({
        domain: path_pattern.startsWith("/images/")
          ? "cdn.acme.shop"
          : "api.acme.shop",
        path_pattern,
        count: users,
        users,
        latency_ms: Math.round(ms * QUANTILE_FACTORS[quantile]),
      }))
      .sort((a, b) => b.users - a.users),
  };
}

export function demoSessions(
  selection: JourneySelection,
): JourneySessionsResponse {
  const key = JSON.stringify(selection);
  const users =
    "node" in selection
      ? nodeUsers(selection.node)
      : demoPathUsers(pathOf(selection));
  const count = Math.min(10, Math.ceil(users / 20));
  const now = DateTime.now();
  return {
    ...page,
    results: Array.from({ length: count }, (_, i) => {
      // Seeds from the selection give a selection the same sessions each
      // time it is opened.
      const seed = `journeydemo:${key}:${i}`;
      return {
        session_id: stableUuid(`${seed}:session`),
        installation_id: stableUuid(`${seed}:installation`),
        user_id:
          stableInt(`${seed}:anonymous`, 0, 3) === 0
            ? ""
            : `usr_${stableInt(`${seed}:user`, 100_000, 189_999)}`,
        first_event_time: now
          .minus({ minutes: i * 23 + stableInt(`${seed}:start`, 0, 16) })
          .toISO()!,
        duration: stableInt(`${seed}:duration`, 40_000, 180_000),
      };
    }),
  };
}
