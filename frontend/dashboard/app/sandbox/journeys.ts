import type { ScreenKey } from "./layouts";
import type { FlowSpec, SpanSpec, StepSpec } from "./scenario";

export type JourneyBindings = {
  screen: Record<ScreenKey, string>;
  http: {
    products: string;
    cart_add: string;
    cart_update: string;
    cart_remove: string;
    promo: string;
    login: string;
    profile: string;
    orders: string;
    preferences: string;
    order_confirm?: string;
    payment_methods?: string;
  };
  span: {
    product_load: string;
    checkout_flow: string;
    search_query: string;
    cart_refresh: string;
  };
  wallet: "radio_apple_pay" | "radio_google_pay";
};

// Every platform's span specs use these child keys, so a journey can fail or
// stop a trace at the same step on any platform.
export const SPAN_STEPS = {
  productDecode: "product_decode_images",
  productRender: "product_render_detail",
  productDetails: "product_fetch_details",
  cartFetch: "cart_fetch",
  createOrder: "checkout_create_order",
} as const;

type Crash = {
  steps: StepSpec[];
  abortBefore?: string;
  fail?: { span: string; status?: number };
};

// Each span that stands for a request names that request's http key, so the
// trace and the session's network events show the same calls at the same
// times.
export function shopSpans(t: {
  worker: string;
  network: string;
  decode: string;
  requests: {
    detail: string;
    reviews: string;
    image: string;
    search: string;
    cart: string;
    validate?: string;
    payment: string;
    order: string;
  };
  orderBeforePayment?: boolean;
  image: Record<string, string>;
  layout: Record<string, string>;
}): SpanSpec[] {
  const r = t.requests;
  const createOrder: SpanSpec = {
    key: SPAN_STEPS.createOrder,
    name: "create_order",
    thread: t.network,
    http: r.order,
    durationMs: [0, 0],
    startAfterMs: [10, 40],
    checkpoint: "order_created",
    attributes: { cart_total: "{total}", currency: "USD" },
  };
  const payment: SpanSpec[] = [
    {
      key: "checkout_tokenize_payment",
      name: "tokenize_payment",
      thread: t.worker,
      durationMs: [150, 400],
      startAfterMs: [10, 40],
      attributes: { payment_method: "{payment_method}" },
    },
    {
      key: "checkout_authorize_payment",
      name: "authorize_payment",
      thread: t.network,
      http: r.payment,
      durationMs: [0, 0],
      startAfterMs: [5, 20],
      checkpoint: "payment_authorized",
      attributes: { payment_method: "{payment_method}", provider: "stripe" },
    },
  ];
  return [
    {
      key: "product_load",
      name: "product_load",
      durationMs: [300, 400],
      attributes: { product_id: "{product_id}", cache: "miss" },
      children: [
        {
          key: "product_fetch_data",
          name: "fetch_product_data",
          thread: t.worker,
          durationMs: [40, 80],
          startAfterMs: [5, 20],
          parallel: true,
          children: [
            {
              key: SPAN_STEPS.productDetails,
              name: "fetch_product_details",
              thread: t.network,
              http: r.detail,
              durationMs: [0, 0],
              startAfterMs: [5, 20],
              checkpoint: "details_fetched",
              attributes: { product_id: "{product_id}" },
            },
            {
              key: "product_fetch_reviews",
              name: "fetch_reviews",
              thread: t.network,
              http: r.reviews,
              durationMs: [0, 0],
              startAfterMs: [5, 30],
              attributes: { page_size: "20" },
            },
            {
              key: "product_fetch_images",
              name: "fetch_hero_image",
              thread: t.network,
              http: r.image,
              durationMs: [0, 0],
              startAfterMs: [10, 30],
            },
          ],
        },
        {
          key: SPAN_STEPS.productDecode,
          name: "decode_images",
          thread: t.decode,
          durationMs: [20, 40],
          startAfterMs: [5, 20],
          checkpoint: "images_decoded",
          children: [
            {
              key: "product_decode_hero_image",
              name: "decode_hero_image",
              durationMs: [150, 400],
              startAfterMs: [2, 10],
              attributes: t.image,
            },
            {
              key: "product_decode_thumbnails",
              name: "decode_thumbnails",
              durationMs: [100, 250],
              startAfterMs: [5, 20],
              attributes: { count: "4" },
            },
          ],
        },
        {
          key: SPAN_STEPS.productRender,
          name: "render_product_detail",
          thread: "main",
          durationMs: [80, 150],
          startAfterMs: [10, 30],
          checkpoint: "price_rendered",
          children: [
            {
              key: "product_format_price",
              name: "format_price",
              durationMs: [10, 30],
              startAfterMs: [5, 15],
              attributes: { currency: "USD" },
            },
            {
              key: "product_layout_pass",
              name: "layout_pass",
              durationMs: [80, 220],
              startAfterMs: [5, 15],
              attributes: t.layout,
            },
          ],
        },
      ],
    },
    {
      key: "search_query",
      name: "search_query",
      durationMs: [500, 520],
      attributes: { query: "{query}", result_count: "{result_count}" },
      children: [
        {
          key: "search_debounce_input",
          name: "debounce_input",
          durationMs: [300, 320],
          checkpoint: "debounced",
          attributes: { debounce_ms: "300" },
        },
        {
          key: "search_request",
          name: "search_request",
          thread: t.worker,
          durationMs: [30, 60],
          startAfterMs: [5, 20],
          children: [
            {
              key: "search_fetch_results",
              name: "fetch_results",
              thread: t.network,
              http: r.search,
              durationMs: [0, 0],
              startAfterMs: [5, 15],
              checkpoint: "results_received",
              attributes: { query: "{query}", page: "1" },
            },
            {
              key: "search_parse_results",
              name: "parse_results",
              durationMs: [30, 100],
              startAfterMs: [2, 10],
              attributes: { result_count: "{result_count}" },
            },
          ],
        },
        {
          key: "search_rank_results",
          name: "rank_results",
          thread: t.worker,
          durationMs: [40, 150],
          startAfterMs: [5, 20],
          attributes: { result_count: "{result_count}", sort: "relevance" },
        },
        {
          key: "search_render_results",
          name: "render_results",
          durationMs: [40, 120],
          startAfterMs: [5, 20],
          checkpoint: "rendered",
        },
      ],
    },
    {
      key: "cart_refresh",
      name: "cart_refresh",
      durationMs: [200, 260],
      attributes: { item_count: "{item_count}", cart_total: "{total}" },
      children: [
        {
          key: SPAN_STEPS.cartFetch,
          name: "fetch_cart",
          thread: t.network,
          http: r.cart,
          durationMs: [0, 0],
          startAfterMs: [5, 15],
          checkpoint: "cart_fetched",
        },
        {
          key: "cart_recalculate_totals",
          name: "recalculate_totals",
          thread: t.worker,
          durationMs: [20, 50],
          startAfterMs: [5, 15],
          checkpoint: "totals_ready",
          children: [
            {
              key: "cart_apply_tax",
              name: "apply_tax",
              durationMs: [20, 60],
              startAfterMs: [2, 10],
              attributes: { region: "{region}" },
            },
            {
              key: "cart_apply_shipping_rules",
              name: "apply_shipping_rules",
              durationMs: [30, 90],
              startAfterMs: [5, 15],
              attributes: { shipping_method: "standard" },
            },
          ],
        },
        {
          key: "cart_render",
          name: "render_cart",
          durationMs: [50, 150],
          startAfterMs: [10, 30],
        },
      ],
    },
    {
      key: "checkout_flow",
      name: "checkout_flow",
      durationMs: [0, 0],
      attributes: {
        item_count: "{item_count}",
        cart_total: "{total}",
        payment_method: "{payment_method}",
        shipping_method: "{shipping_method}",
      },
      children: [
        r.validate
          ? {
              key: "checkout_validate_cart",
              name: "validate_cart",
              thread: t.network,
              http: r.validate,
              durationMs: [0, 0],
              startAfterMs: [10, 30],
              checkpoint: "cart_validated",
              attributes: { item_count: "{item_count}" },
            }
          : {
              key: "checkout_validate_cart",
              name: "validate_cart",
              thread: t.worker,
              durationMs: [40, 120],
              startAfterMs: [10, 30],
              checkpoint: "cart_validated",
              attributes: { item_count: "{item_count}" },
            },
        {
          key: "checkout_apply_promo",
          name: "apply_promo",
          thread: t.worker,
          onlyWith: "coupon",
          durationMs: [20, 60],
          startAfterMs: [5, 15],
          attributes: { promo_code: "{coupon}", discount: "{discount}" },
        },
        ...(t.orderBeforePayment
          ? [createOrder, ...payment]
          : [...payment, createOrder]),
      ],
    },
  ];
}

type HttpOptions = { outcome?: number | "failure"; params?: string };

const CATEGORIES = ["All", "Shoes", "Audio", "Apparel", "Bags", "Outdoor"];

export class Journey {
  private steps: StepSpec[] = [];
  constructor(
    private b: JourneyBindings,
    private startup?: {
      name: string;
      attributes?: Record<string, string | number | boolean>;
    },
  ) {}

  add(...steps: (StepSpec | StepSpec[] | undefined)[]): this {
    for (const step of steps) {
      if (Array.isArray(step)) {
        this.steps.push(...step);
      } else if (step) {
        this.steps.push(step);
      }
    }
    return this;
  }

  screen(key: ScreenKey, variant?: string): this {
    return this.add({ kind: "screen", screen: this.b.screen[key], variant });
  }

  http(key: keyof JourneyBindings["http"], opts: HttpOptions = {}): this {
    const bound = this.b.http[key];
    return bound ? this.add({ kind: "http", http: bound, ...opts }) : this;
  }

  span(
    key: keyof JourneyBindings["span"],
    opts: {
      fail?: { span: string; status?: number };
      abortBefore?: string;
    } = {},
  ): this {
    return this.add({ kind: "span", span: this.b.span[key], ...opts });
  }

  tap(node: string): this {
    return this.add({ kind: "gesture", type: "click", node });
  }

  type(text: string): this {
    return this.add({ kind: "type", text });
  }

  scroll(): this {
    return this.add({ kind: "gesture", type: "scroll" });
  }

  back(): this {
    return this.add({ kind: "back" });
  }

  variant(name: string | null): this {
    return this.add({ kind: "variant", variant: name });
  }

  log(severity: "debug" | "info" | "warning" | "error", body: string): this {
    return this.add({ kind: "log", severity, body });
  }

  custom(
    name: string,
    attributes?: Record<string, string | number | boolean>,
  ): this {
    return this.add({ kind: "custom", name, attributes });
  }

  exception(key: string): this {
    return this.add({ kind: "exception", exception: key });
  }

  bugReport(description: string): this {
    return this.add({ kind: "bug_report", description });
  }

  background(ms: number): this {
    return this.add({ kind: "background", ms });
  }

  raw(...steps: StepSpec[]): this {
    return this.add(steps);
  }

  apply(part?: (j: Journey) => Journey): this {
    part?.(this);
    return this;
  }

  open(): this {
    return this.screen("home").startupEvent().http("products");
  }

  login(): this {
    return this.screen("login")
      .startupEvent()
      .tap("field_email")
      .tap("field_password")
      .tap("btn_login")
      .http("login")
      .log("info", "Welcome back, resuming session")
      .screen("home")
      .http("products");
  }

  private startupEvent(): this {
    return this.startup
      ? this.add({
          kind: "custom",
          name: this.startup.name,
          attributes: this.startup.attributes,
          startup: true,
        })
      : this;
  }

  openProduct(
    card: string,
    opts: {
      fail?: { span: string; status?: number };
      abortBefore?: string;
    } = {},
  ): this {
    return this.tap(card).screen("product_detail").span("product_load", opts);
  }

  skimHome(cards: string[]): this {
    this.scroll();
    for (const card of cards) {
      this.openProduct(card).scroll().back();
    }
    return this;
  }

  toProducts(category: number | null): this {
    if (category === null) {
      return this.tap("hero_cta").screen("products").http("products");
    }
    return this.tap(`chip_category_${category}`)
      .screen("products", CATEGORIES[category])
      .http("products", categoryParams(category));
  }

  category(index: number): this {
    return this.tap(`chip_category_${index}`).http(
      "products",
      categoryParams(index),
    );
  }

  inspect(
    card: string,
    opts: { size?: number; reviews?: boolean; addToCart?: boolean } = {},
  ): this {
    this.openProduct(card);
    if (opts.size !== undefined) {
      this.tap(`chip_size_${opts.size}`);
    }
    this.scroll();
    if (opts.reviews) {
      this.tap("tab_reviews");
    }
    if (opts.addToCart) {
      this.tap("btn_add_to_cart").http("cart_add");
    }
    return this.back();
  }

  seeAll(): this {
    return this.tap("link_new_arrivals").screen("products").http("products");
  }

  search(fromNav: boolean, query: string): this {
    return this.tap(fromNav ? "nav_search" : "btn_search_icon")
      .screen("search")
      .tap("field_search")
      .type(query)
      .span("search_query");
  }

  openCart(
    opts: { loadFailure?: StepSpec[]; afterOpen?: StepSpec[] } = {},
  ): this {
    this.tap("btn_cart_icon").screen("cart");
    if (opts.loadFailure) {
      this.span("cart_refresh", { fail: { span: SPAN_STEPS.cartFetch } })
        .add(opts.loadFailure)
        .variant("load_error")
        .tap("btn_retry");
    }
    this.span("cart_refresh");
    if (opts.loadFailure) {
      this.variant(null);
    }
    return this.add(opts.afterOpen);
  }

  changeQty(line: number, delta: 1 | -1): this {
    return this.tap(
      `${delta > 0 ? "btn_qty_plus" : "btn_qty_minus"}_${line}`,
    ).http("cart_update");
  }

  removeLine(line: number): this {
    return this.tap(`btn_remove_${line}`).http("cart_remove");
  }

  applyCoupon(code: string, failure?: StepSpec[]): this {
    this.tap("field_coupon").type(code).tap("btn_apply_coupon");
    if (!failure) {
      return this.http("promo");
    }
    return this.http("promo", { outcome: "failure" })
      .add(failure)
      .variant("coupon_error");
  }

  toCheckout(): this {
    return this.scroll().tap("btn_checkout").screen("checkout");
  }

  toPayment(
    opts: { workAddress?: boolean; methodsFailure?: StepSpec[] } = {},
  ): this {
    if (opts.workAddress) {
      this.tap("radio_address_1");
    }
    this.tap("radio_shipping_1")
      .tap("radio_shipping_0")
      .scroll()
      .tap("btn_continue_payment")
      .screen("payment");
    if (opts.methodsFailure) {
      return this.http("payment_methods", { outcome: 503 })
        .add(opts.methodsFailure)
        .variant("methods_error");
    }
    return this.http("payment_methods");
  }

  placeOrder(opts: { crash?: Crash; confirmationVariant?: string } = {}): this {
    this.scroll().tap("btn_place_order");
    if (opts.crash) {
      if (opts.crash.abortBefore) {
        this.span("checkout_flow", { abortBefore: opts.crash.abortBefore });
      }
      return this.add(opts.crash.steps);
    }
    return this.span("checkout_flow")
      .screen("order_confirmation", opts.confirmationVariant)
      .http("order_confirm");
  }

  checkout(
    opts: {
      coupon?: { code: string; failure?: StepSpec[] };
      editQuantity?: boolean;
      workAddress?: boolean;
      pay?: "wallet" | "wallet_then_card";
      methodsFailure?: StepSpec[];
      crash?: Crash;
      confirmationVariant?: string;
    } = {},
  ): this {
    if (opts.editQuantity) {
      this.changeQty(0, 1);
    }
    if (opts.coupon) {
      this.applyCoupon(opts.coupon.code, opts.coupon.failure);
    }
    this.toCheckout().toPayment({
      workAddress: opts.workAddress,
      methodsFailure: opts.methodsFailure,
    });
    if (opts.pay) {
      this.tap(this.b.wallet);
    }
    if (opts.pay === "wallet_then_card") {
      this.tap("radio_card");
    }
    return this.placeOrder({
      crash: opts.crash,
      confirmationVariant: opts.confirmationVariant,
    });
  }

  afterOrder(): this {
    return this.tap("btn_track_order")
      .screen("orders")
      .http("orders")
      .scroll()
      .back()
      .tap("btn_continue_shopping")
      .screen("home")
      .http("products");
  }

  toProfile(): this {
    return this.tap("nav_profile").screen("profile").http("profile");
  }

  build(key: string, name: string): FlowSpec {
    return { key, name, steps: this.steps };
  }
}

function categoryParams(index: number): HttpOptions {
  return index > 0
    ? { params: `category=${CATEGORIES[index].toLowerCase()}` }
    : {};
}

type ReportHook = (j: Journey) => Journey;

export function standardFlows(
  b: JourneyBindings,
  story: {
    checkoutCrash?: Crash;
    listCrash?: StepSpec[];
    detailCrash?: Crash;
    detailAnr?: StepSpec[];
    cartHandled: {
      coupon?: { code: string; failure: StepSpec[] };
      loadFailure?: StepSpec[];
      afterOpen?: StepSpec[];
    };
    // Each hook adds a bug report and the steps that show what it describes,
    // at a fixed point in the flow that owns it.
    reports?: {
      orders?: ReportHook;
      profile?: ReportHook;
      cart?: ReportHook;
      search?: ReportHook;
      payment?: ReportHook;
    };
    sdkCustom?: {
      name: string;
      attributes?: Record<string, string | number | boolean>;
    };
    keys: Record<string, string>;
  },
): FlowSpec[] {
  const J = () => new Journey(b, story.sdkCustom);
  const flows: FlowSpec[] = [];
  const key = (canonical: string) => story.keys[canonical];

  if (key("search")) {
    flows.push(
      J()
        .open()
        .skimHome(["card_product_4"])
        .search(true, "running")
        .inspect("row_result_1", { size: 2, reviews: true })
        .background(38_000)
        .openProduct("row_result_3")
        .scroll()
        .openProduct("card_related_0")
        .log("info", "Rendered product detail for {product_id}")
        .scroll()
        .back()
        .back()
        .scroll()
        .openProduct("row_result_5")
        .tap("chip_size_1")
        .scroll()
        .build(key("search"), "Browse and search"),
    );
  }

  if (key("purchase")) {
    flows.push(
      J()
        .open()
        .skimHome(["card_product_4"])
        .seeAll()
        .category(1)
        .inspect("card_product_0", { size: 2, addToCart: true })
        .category(2)
        .inspect("card_product_1", { size: 0, reviews: true, addToCart: true })
        .openCart()
        .checkout({
          editQuantity: true,
          coupon: { code: "WELCOME10" },
          workAddress: true,
        })
        .log("info", "Order {order_id} confirmed")
        .afterOrder()
        .skimHome(["card_product_8"])
        .build(key("purchase"), "Browse through checkout"),
    );
  }

  if (key("checkout_crash") && story.checkoutCrash) {
    flows.push(
      J()
        .open()
        .toProducts(null)
        .inspect("card_product_3", { size: 3, addToCart: true })
        .scroll()
        .inspect("card_product_6", { reviews: true })
        .openCart()
        .checkout({ crash: story.checkoutCrash })
        .build(key("checkout_crash"), "Checkout, error on place order"),
    );
  }

  if (key("list_crash") && story.listCrash) {
    flows.push(
      J()
        .open()
        .skimHome(["card_product_9"])
        .seeAll()
        .category(3)
        .inspect("card_product_4", { size: 1 })
        .category(0)
        .scroll()
        .inspect("card_product_8")
        .tap("btn_sort")
        .http("products", { params: "sort=price_asc" })
        .scroll()
        .add(story.listCrash)
        .build(key("list_crash"), "Product list, fatal while scrolling"),
    );
  }

  if (key("detail_anr") && story.detailAnr) {
    flows.push(
      J()
        .open()
        .skimHome(["card_product_6"])
        .seeAll()
        .category(1)
        .openProduct("card_product_3")
        .tap("chip_size_2")
        .back()
        .openProduct("card_product_0", {
          abortBefore: SPAN_STEPS.productDecode,
        })
        .add(story.detailAnr)
        .build(key("detail_anr"), "Product detail, ANR decoding hero image"),
    );
  }

  if (key("detail_crash") && story.detailCrash) {
    flows.push(
      J()
        .open()
        .skimHome(["card_product_2"])
        .seeAll()
        .scroll()
        .inspect("card_product_7", { reviews: true })
        .openProduct("card_product_9")
        .tap("chip_size_1")
        .scroll()
        .openProduct("card_related_1", {
          abortBefore: story.detailCrash.abortBefore,
          fail: story.detailCrash.fail,
        })
        .add(story.detailCrash.steps)
        .build(key("detail_crash"), "Product detail, fatal crash"),
    );
  }

  if (key("cart_handled")) {
    flows.push(
      J()
        .open()
        .toProducts(2)
        .inspect("card_product_2", { size: 1, addToCart: true })
        .category(1)
        .inspect("card_product_0", { size: 3, reviews: true, addToCart: true })
        .openCart({
          loadFailure: story.cartHandled.loadFailure,
          afterOpen: story.cartHandled.afterOpen,
        })
        .checkout({ coupon: story.cartHandled.coupon })
        .afterOrder()
        .build(key("cart_handled"), "Cart, handled error"),
    );
  }

  if (key("login")) {
    flows.push(
      J()
        .login()
        .skimHome(["card_product_6", "card_product_9"])
        .seeAll()
        .category(4)
        .inspect("card_product_5", { size: 1, reviews: true })
        .category(5)
        .inspect("card_product_6", { size: 1, addToCart: true })
        .openCart()
        .changeQty(0, 1)
        .background(52_000)
        .changeQty(0, -1)
        .scroll()
        .openProduct("card_saved_0")
        .scroll()
        .build(key("login"), "Log in and browse"),
    );
  }

  if (key("profile")) {
    flows.push(
      J()
        .open()
        .skimHome(["card_product_5"])
        .toProfile()
        .tap("row_orders")
        .screen("orders")
        .http("orders")
        .apply(story.reports?.orders)
        .scroll()
        .back()
        .apply(story.reports?.profile)
        .scroll()
        .tap("switch_promos")
        .http("preferences")
        .tap("nav_home")
        .screen("home")
        .http("products")
        .skimHome(["card_product_2"])
        .build(key("profile"), "Check profile"),
    );
  }

  if (key("cart_bug") && story.reports?.cart) {
    flows.push(
      J()
        .open()
        .toProducts(null)
        .inspect("card_product_3", { size: 2, addToCart: true })
        .scroll()
        .inspect("card_product_9", { reviews: true, addToCart: true })
        .openCart()
        .apply(story.reports.cart)
        .toCheckout()
        .build(key("cart_bug"), "Cart bug report"),
    );
  }

  if (key("search_bug") && story.reports?.search) {
    flows.push(
      J()
        .open()
        .search(false, "running")
        .inspect("row_result_2", { size: 1 })
        .apply(story.reports.search)
        .scroll()
        .inspect("row_result_5", { size: 2, addToCart: true })
        .openCart()
        .build(key("search_bug"), "Search results bug report"),
    );
  }

  if (key("quick_purchase")) {
    flows.push(
      J()
        .open()
        .toProducts(null)
        .scroll()
        .inspect("card_product_7", { size: 1, addToCart: true })
        .openCart()
        .checkout({ pay: "wallet" })
        .tap("btn_continue_shopping")
        .screen("home")
        .http("products")
        .build(key("quick_purchase"), "Quick purchase"),
    );
  }

  if (key("payment_bug") && story.reports?.payment) {
    flows.push(
      J()
        .open()
        .skimHome(["card_product_5"])
        .seeAll()
        .inspect("card_product_1", { size: 1, reviews: true, addToCart: true })
        .openCart()
        .toCheckout()
        .toPayment()
        .tap(b.wallet)
        .scroll()
        .apply(story.reports.payment)
        .tap("radio_card")
        .placeOrder()
        .build(key("payment_bug"), "Payment, wallet sheet bug report"),
    );
  }

  if (key("anr_home") && story.detailAnr) {
    flows.push(
      J()
        .open()
        .skimHome(["card_product_6"])
        .seeAll()
        .category(1)
        .openProduct("card_product_3", {
          abortBefore: SPAN_STEPS.productDecode,
        })
        .add(story.detailAnr)
        .build(key("anr_home"), "Main thread blocked on product detail"),
    );
  }

  return flows;
}
